import { normalizeMasteredLettersResponse, filterUnmasteredSequence } from './masteredLetterFiltering';

jest.mock('../api/client', () => ({ get: jest.fn() }));
import client from '../api/client';
import { fetchMasteredLetters } from './masteredLetterFiltering';

describe('normalizeMasteredLettersResponse', () => {
  it('returns found + pairs for a well-formed response', () => {
    const result = normalizeMasteredLettersResponse({
      status: 'found',
      pairs: [{ letter: 'l', caseType: 'lowercase' }, { letter: 'i', caseType: 'lowercase' }],
    });
    expect(result).toEqual({
      status: 'found',
      pairs: [{ letter: 'l', caseType: 'lowercase' }, { letter: 'i', caseType: 'lowercase' }],
    });
  });

  it('returns read_failed for missing/malformed data, never throws', () => {
    expect(normalizeMasteredLettersResponse(undefined)).toEqual({ status: 'read_failed', pairs: [] });
    expect(normalizeMasteredLettersResponse(null)).toEqual({ status: 'read_failed', pairs: [] });
    expect(normalizeMasteredLettersResponse({})).toEqual({ status: 'read_failed', pairs: [] });
    expect(normalizeMasteredLettersResponse({ status: 'not_found' })).toEqual({ status: 'read_failed', pairs: [] });
    expect(normalizeMasteredLettersResponse({ status: 'found', pairs: 'nope' })).toEqual({ status: 'read_failed', pairs: [] });
  });

  it('drops malformed individual pair entries rather than throwing', () => {
    const result = normalizeMasteredLettersResponse({
      status: 'found',
      pairs: [{ letter: 'l', caseType: 'lowercase' }, { letter: 5, caseType: 'lowercase' }, null, {}],
    });
    expect(result).toEqual({ status: 'found', pairs: [{ letter: 'l', caseType: 'lowercase' }] });
  });
});

describe('fetchMasteredLetters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the normalized pairs on success', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'found', pairs: [{ letter: 't', caseType: 'lowercase' }] } });
    const result = await fetchMasteredLetters(42);
    expect(result).toEqual({ status: 'found', pairs: [{ letter: 't', caseType: 'lowercase' }] });
  });

  it('never throws — a network failure resolves to read_failed with empty pairs', async () => {
    client.get.mockRejectedValueOnce(new Error('network down'));
    const result = await fetchMasteredLetters(42);
    expect(result).toEqual({ status: 'read_failed', pairs: [] });
  });
});

describe('filterUnmasteredSequence', () => {
  const SEQ = [
    { letter: 'l', caseType: 'lowercase' },
    { letter: 'i', caseType: 'lowercase' },
    { letter: 't', caseType: 'lowercase' },
    { letter: 'o', caseType: 'lowercase' },
    { letter: 'c', caseType: 'lowercase' },
  ];

  it('removes mastered pairs while preserving the remaining order (spec example: l+i mastered -> starts at t)', () => {
    const filtered = filterUnmasteredSequence(SEQ, [
      { letter: 'l', caseType: 'lowercase' }, { letter: 'i', caseType: 'lowercase' },
    ]);
    expect(filtered).toEqual([
      { letter: 't', caseType: 'lowercase' },
      { letter: 'o', caseType: 'lowercase' },
      { letter: 'c', caseType: 'lowercase' },
    ]);
  });

  it('uppercase progression fix: I+L mastered, T not mastered -> next session begins at T (same rule as lowercase, now real for uppercase too)', () => {
    const UPPER_SEQ = [
      { letter: 'I', caseType: 'uppercase' },
      { letter: 'L', caseType: 'uppercase' },
      { letter: 'T', caseType: 'uppercase' },
      { letter: 'F', caseType: 'uppercase' },
      { letter: 'E', caseType: 'uppercase' },
    ];
    const filtered = filterUnmasteredSequence(UPPER_SEQ, [
      { letter: 'I', caseType: 'uppercase' }, { letter: 'L', caseType: 'uppercase' },
    ]);
    expect(filtered).toEqual([
      { letter: 'T', caseType: 'uppercase' },
      { letter: 'F', caseType: 'uppercase' },
      { letter: 'E', caseType: 'uppercase' },
    ]);
  });

  it('returns the full sequence unchanged when nothing is mastered', () => {
    expect(filterUnmasteredSequence(SEQ, [])).toEqual(SEQ);
    expect(filterUnmasteredSequence(SEQ, null)).toEqual(SEQ);
  });

  it('never reorders the remaining entries, even when mastered letters are scattered non-contiguously', () => {
    const filtered = filterUnmasteredSequence(SEQ, [
      { letter: 'i', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' },
    ]);
    expect(filtered).toEqual([
      { letter: 'l', caseType: 'lowercase' },
      { letter: 't', caseType: 'lowercase' },
      { letter: 'c', caseType: 'lowercase' },
    ]);
  });

  it('returns an empty array when every letter is mastered (caller navigates away)', () => {
    expect(filterUnmasteredSequence(SEQ, SEQ)).toEqual([]);
  });

  it('never cross-contaminates case types — an uppercase "mastered L" does not remove lowercase "l"', () => {
    const filtered = filterUnmasteredSequence(SEQ, [{ letter: 'l', caseType: 'uppercase' }]);
    expect(filtered).toEqual(SEQ);
  });

  it('handles malformed input defensively, never throws', () => {
    expect(filterUnmasteredSequence(null, [])).toEqual([]);
    expect(filterUnmasteredSequence(undefined, [{ letter: 'l', caseType: 'lowercase' }])).toEqual([]);
    expect(filterUnmasteredSequence(SEQ, 'not-an-array')).toEqual(SEQ);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Mastery-semantics correction — a FAILED letter must stay in the sequence
//
// The backend used to report any letter_progress row as mastered, including
// the rows its own failure branch creates to hold blocked_attempts. This
// filter then removed a letter the child had FAILED, so it was never
// presented again. The backend now sends only genuinely mastered pairs
// (mastered_at IS NOT NULL); these pin the resulting child-facing behaviour.
// ═══════════════════════════════════════════════════════════════════════════

describe('failed vs mastered letters in the practice sequence', () => {
  const sequence = [
    { letter: 'l', caseType: 'lowercase' },
    { letter: 'i', caseType: 'lowercase' },
    { letter: 't', caseType: 'lowercase' },
    { letter: 'o', caseType: 'lowercase' },
  ];

  it('a FAILED letter is absent from the mastered list, so it stays practisable', () => {
    // The server omits 'i' because it was failed, never mastered.
    const mastered = [{ letter: 'l', caseType: 'lowercase' }];
    const remaining = filterUnmasteredSequence(sequence, mastered);
    expect(remaining.map(e => e.letter)).toEqual(['i', 't', 'o']);
  });

  it('a MASTERED letter is removed from the unmastered sequence', () => {
    const mastered = [
      { letter: 'l', caseType: 'lowercase' },
      { letter: 'i', caseType: 'lowercase' },
    ];
    const remaining = filterUnmasteredSequence(sequence, mastered);
    expect(remaining.map(e => e.letter)).toEqual(['t', 'o']);
  });

  it('FAIL then PASS: the letter is practisable first, then filtered out', () => {
    const beforePass = filterUnmasteredSequence(sequence, []);
    expect(beforePass.map(e => e.letter)).toContain('l');

    const afterPass = filterUnmasteredSequence(sequence, [{ letter: 'l', caseType: 'lowercase' }]);
    expect(afterPass.map(e => e.letter)).not.toContain('l');
  });

  it('case is respected — mastering lowercase l never hides uppercase L', () => {
    const mixed = [
      { letter: 'l', caseType: 'lowercase' },
      { letter: 'L', caseType: 'uppercase' },
    ];
    const remaining = filterUnmasteredSequence(mixed, [{ letter: 'l', caseType: 'lowercase' }]);
    expect(remaining).toEqual([{ letter: 'L', caseType: 'uppercase' }]);
  });

  it('an empty mastered list leaves the sequence untouched and in order', () => {
    expect(filterUnmasteredSequence(sequence, [])).toEqual(sequence);
  });
});
