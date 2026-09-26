// Feature 5 Step 3 — insertSpacedRepetition() tests (Tests 27-36).
//
// Pure logic only: no navigation, no component rendering, no network.

import { insertSpacedRepetition } from './controlledRepetition';

function letterEntry(letter, overrides = {}) {
  return { letter, caseType: 'lowercase', category: 'curved', complexity: 1, ...overrides };
}

// ─── Test 27/28/29 — spacing rule + fallbacks ──────────────────────────────

describe('Test 27 — [c,o,s] @ c -> [c,o,c,s] (one intervening letter)', () => {
  it('inserts the clone at index 2', () => {
    const sequence = [letterEntry('c'), letterEntry('o'), letterEntry('s')];
    const { sequence: result, inserted, insertionIndex } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0],
    });
    expect(inserted).toBe(true);
    expect(insertionIndex).toBe(2);
    expect(result.map(e => e.letter)).toEqual(['c', 'o', 'c', 's']);
  });
});

describe('Test 28 — [c,o] -> [c,o,c] (exactly one letter remains -> append)', () => {
  it('appends the clone at the end', () => {
    const sequence = [letterEntry('c'), letterEntry('o')];
    const { sequence: result, inserted } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0],
    });
    expect(inserted).toBe(true);
    expect(result.map(e => e.letter)).toEqual(['c', 'o', 'c']);
  });
});

describe('Test 29 — [c] -> fallback [c,c] (no intervening letter at all)', () => {
  it('appends the clone at the end', () => {
    const sequence = [letterEntry('c')];
    const { sequence: result, inserted } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0],
    });
    expect(inserted).toBe(true);
    expect(result.map(e => e.letter)).toEqual(['c', 'c']);
  });
});

// ─── Test 30 — clone vs original ────────────────────────────────────────────

describe('Test 30 — inserted entry is a clone, original unchanged', () => {
  it('the clone is a different object reference than the original', () => {
    const sequence = [letterEntry('c'), letterEntry('o'), letterEntry('s')];
    const original = sequence[0];
    const { sequence: result } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: original });
    const clone = result[2];
    expect(clone).not.toBe(original);
    expect(result[0]).toBe(original); // original entry untouched, same reference
  });
});

// ─── Test 31 — metadata marks adaptive repeat ──────────────────────────────

describe('Test 31 — metadata marks the clone as an adaptive repeat', () => {
  it('sets isAdaptiveRepetition/adaptiveRepetitionOrdinal/sourceInteractionId, never on the original', () => {
    const sequence = [letterEntry('c'), letterEntry('o')];
    const { sequence: result } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0], interactionId: 'int-A',
    });
    const clone = result[2];
    expect(clone.isAdaptiveRepetition).toBe(true);
    expect(clone.adaptiveRepetitionOrdinal).toBe(1);
    expect(clone.sourceInteractionId).toBe('int-A');
    expect(result[0].isAdaptiveRepetition).toBeUndefined();
  });
});

// ─── Test 32 — only one duplicate inserted ──────────────────────────────────

describe('Test 32 — only one duplicate is ever inserted per call', () => {
  it('a single call produces exactly one new entry', () => {
    const sequence = [letterEntry('c'), letterEntry('o'), letterEntry('s'), letterEntry('a')];
    const { sequence: result } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: sequence[0] });
    expect(result).toHaveLength(sequence.length + 1);
    expect(result.filter(e => e.isAdaptiveRepetition).length).toBe(1);
  });
});

// ─── Test 33 — duplicate pending repeat prevents second insertion ─────────

describe('Test 33 — an already-pending adaptive repeat for the same target prevents a second insertion', () => {
  it('does not insert again, returns inserted=false, reason=already_pending', () => {
    const sequence = [
      letterEntry('c'), letterEntry('o'),
      { ...letterEntry('c'), isAdaptiveRepetition: true, adaptiveRepetitionOrdinal: 1, sourceInteractionId: 'int-A' },
      letterEntry('s'),
    ];
    const { sequence: result, inserted, reason } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0], interactionId: 'int-A',
    });
    expect(inserted).toBe(false);
    expect(reason).toBe('already_pending');
    expect(result).toBe(sequence); // unchanged, same reference
    expect(result.filter(e => e.isAdaptiveRepetition).length).toBe(1); // still just the one
  });

  it('a PAST (already-completed, before currentIndex) adaptive entry does not block a new one — only PENDING (after currentIndex) counts', () => {
    const sequence = [
      { ...letterEntry('c'), isAdaptiveRepetition: true }, // hypothetical past entry before current
      letterEntry('o'),
      letterEntry('c'), // now currently active — a plain (non-repeat) 'c' entry
      letterEntry('s'),
    ];
    const { inserted } = insertSpacedRepetition({ sequence, currentIndex: 2, targetLetterEntry: sequence[2] });
    expect(inserted).toBe(true);
  });
});

// ─── Test 34 — uppercase preserved ──────────────────────────────────────────

describe('Test 34 — uppercase entries are preserved correctly', () => {
  it('an uppercase target clones with caseType=uppercase intact', () => {
    const target = { letter: 'S', caseType: 'uppercase', category: 'curved' };
    const sequence = [target, letterEntry('U', { caseType: 'uppercase' })];
    const { sequence: result } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: target });
    const clone = result[result.length - 1];
    expect(clone.letter).toBe('S');
    expect(clone.caseType).toBe('uppercase');
  });

  it('uppercase S and lowercase s are treated as distinct targets for the pending-duplicate check', () => {
    const sequence = [
      { letter: 's', caseType: 'lowercase' },
      { letter: 'o', caseType: 'lowercase' },
      { ...{ letter: 'S', caseType: 'uppercase' }, isAdaptiveRepetition: true },
    ];
    const { inserted } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: sequence[0] });
    expect(inserted).toBe(true); // the pending 'S' (uppercase) does not block 's' (lowercase)
  });
});

// ─── Test 35 — other letter metadata preserved ─────────────────────────────

describe('Test 35 — every other field on the target entry is preserved on the clone', () => {
  it('category/complexity/any custom field survive the clone unchanged', () => {
    const target = letterEntry('c', { category: 'curved', complexity: 2, customField: 'x' });
    const sequence = [target, letterEntry('o')];
    const { sequence: result } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: target });
    const clone = result[result.length - 1];
    expect(clone.category).toBe('curved');
    expect(clone.complexity).toBe(2);
    expect(clone.customField).toBe('x');
  });
});

// ─── Test 36 — input sequence not mutated ──────────────────────────────────

describe('Test 36 — the input sequence array and its entries are never mutated', () => {
  it('a successful insertion returns a new array, leaves the original array/objects untouched', () => {
    const sequence = [letterEntry('c'), letterEntry('o'), letterEntry('s')];
    const originalCopy = sequence.map(e => ({ ...e }));
    const { sequence: result } = insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: sequence[0] });
    expect(result).not.toBe(sequence);
    expect(sequence).toEqual(originalCopy);
    expect(sequence).toHaveLength(3); // original length unchanged
  });
});

// ─── Invalid input ───────────────────────────────────────────────────────────

describe('Invalid input', () => {
  it('non-array sequence returns invalid_input, never throws', () => {
    expect(() => insertSpacedRepetition({ sequence: null, currentIndex: 0, targetLetterEntry: letterEntry('c') })).not.toThrow();
    const result = insertSpacedRepetition({ sequence: null, currentIndex: 0, targetLetterEntry: letterEntry('c') });
    expect(result.inserted).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it.each([-1, 1.5, 99, 'zero'])('an invalid currentIndex (%p) returns invalid_input', (badIndex) => {
    const sequence = [letterEntry('c'), letterEntry('o')];
    const result = insertSpacedRepetition({ sequence, currentIndex: badIndex, targetLetterEntry: sequence[0] });
    expect(result.inserted).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('a missing/malformed targetLetterEntry returns invalid_input', () => {
    const sequence = [letterEntry('c'), letterEntry('o')];
    expect(insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: null }).inserted).toBe(false);
    expect(insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: { letter: 'cc' } }).inserted).toBe(false);
    expect(insertSpacedRepetition({ sequence, currentIndex: 0, targetLetterEntry: {} }).inserted).toBe(false);
  });

  it('completely missing args object never throws', () => {
    expect(() => insertSpacedRepetition()).not.toThrow();
    expect(insertSpacedRepetition().inserted).toBe(false);
  });
});
