// Progress Report — "Next Letter".
//
// ── The bug ─────────────────────────────────────────────────────────────
// The value was `alphabet[completedCount]`, both here and in the backend's
// next_lowercase_letter / next_uppercase_letter fields. That is only ever
// right when the child works straight down A-Z with no gaps, and neither half
// of that holds:
//
//   1. the sequence is ADAPTIVE — generateAdaptiveSequence orders by motor
//      category, so position 4 is not 'e';
//   2. mastery is per-letter — a letter can be left unmastered while later
//      ones are completed, so a count says nothing about WHICH letter is next.
//
// A child resuming at 'c' was told to write 'e' because four letters happened
// to be done. The report now derives the letter the same way the writing
// screens choose one: the first entry of the student's own sequence that is
// not yet mastered.

import fs from 'fs';
import path from 'path';

// masteredLetterFiltering pulls in api/client -> storage -> native modules.
// Only the pure filter is exercised here; the same mock the module's own
// test file uses.
jest.mock('../api/client', () => ({ get: jest.fn() }));
import { filterUnmasteredSequence } from './masteredLetterFiltering';
import { getAllLetters } from '../constants/letterCategories';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const REPORT   = '../screens/handwriting/ProgressReportScreen.js';
const PRACTICE = '../screens/handwriting/LetterPracticeScreen.js';

// The screen's own helper, reproduced exactly so the numbers below are
// checking real behaviour. Kept in step by the source assertions further down.
function deriveNextLetter(letterSequence, caseType, masteredPairs) {
  const forCase = Array.isArray(letterSequence)
    ? letterSequence.filter((l) => l?.caseType === caseType)
    : [];
  const base = forCase.length > 0 ? forCase : getAllLetters(caseType);
  return filterUnmasteredSequence(base, masteredPairs)[0]?.letter ?? null;
}

// An adaptive order — deliberately not alphabetical, which is the whole point.
const SEQ = [
  { letter: 'l', caseType: 'lowercase' },
  { letter: 'i', caseType: 'lowercase' },
  { letter: 't', caseType: 'lowercase' },
  { letter: 'c', caseType: 'lowercase' },
  { letter: 'o', caseType: 'lowercase' },
  { letter: 'L', caseType: 'uppercase' },
  { letter: 'T', caseType: 'uppercase' },
  { letter: 'C', caseType: 'uppercase' },
];

describe('the next letter follows the sequence, not the count', () => {
  it('nothing mastered yet — the first letter of the sequence', () => {
    expect(deriveNextLetter(SEQ, 'lowercase', [])).toBe('l');
  });

  it('two mastered in order — the third of the sequence, not the third letter of the alphabet', () => {
    const mastered = [
      { letter: 'l', caseType: 'lowercase' },
      { letter: 'i', caseType: 'lowercase' },
    ];
    expect(deriveNextLetter(SEQ, 'lowercase', mastered)).toBe('t');
    // The old rule: alphabet[2] === 'c'. Which is a letter the child has not
    // even reached yet.
    expect(deriveNextLetter(SEQ, 'lowercase', mastered)).not.toBe('c');
  });

  it('THE REPORTED BUG — a gap in mastery must not advance the pointer', () => {
    // Four mastered, but 'i' was skipped. Count-indexing says alphabet[4]='e';
    // the child must actually go back and write 'i'.
    const mastered = [
      { letter: 'l', caseType: 'lowercase' },
      { letter: 't', caseType: 'lowercase' },
      { letter: 'c', caseType: 'lowercase' },
      { letter: 'o', caseType: 'lowercase' },
    ];
    expect(mastered).toHaveLength(4);
    expect(deriveNextLetter(SEQ, 'lowercase', mastered)).toBe('i');
    expect(deriveNextLetter(SEQ, 'lowercase', mastered)).not.toBe('e');
  });

  it('is exactly the letter the writing screen will present', () => {
    // Same two helpers, same order — LetterWritingScreen takes [0] of this.
    const mastered = [{ letter: 'l', caseType: 'lowercase' }];
    const asWritingScreenSees = filterUnmasteredSequence(
      SEQ.filter((l) => l.caseType === 'lowercase'), mastered,
    );
    expect(deriveNextLetter(SEQ, 'lowercase', mastered)).toBe(asWritingScreenSees[0].letter);
  });

  it('uppercase is derived from the uppercase half, in its own order', () => {
    expect(deriveNextLetter(SEQ, 'uppercase', [])).toBe('L');
    expect(deriveNextLetter(SEQ, 'uppercase', [{ letter: 'L', caseType: 'uppercase' }])).toBe('T');
  });

  it('mastering a lowercase letter never moves the uppercase pointer', () => {
    const mastered = [
      { letter: 'l', caseType: 'lowercase' },
      { letter: 'i', caseType: 'lowercase' },
      { letter: 't', caseType: 'lowercase' },
    ];
    expect(deriveNextLetter(SEQ, 'uppercase', mastered)).toBe('L');
  });

  it('every letter of a case mastered — null, so the UI shows its dash', () => {
    const all = SEQ.filter((l) => l.caseType === 'lowercase');
    expect(deriveNextLetter(SEQ, 'lowercase', all)).toBeNull();
  });

  it('no stored sequence falls back to the default order, still skipping mastered', () => {
    const dflt = getAllLetters('lowercase');
    expect(deriveNextLetter([], 'lowercase', [])).toBe(dflt[0].letter);
    expect(deriveNextLetter(undefined, 'lowercase', [])).toBe(dflt[0].letter);
    expect(deriveNextLetter([], 'lowercase', [dflt[0]])).toBe(dflt[1].letter);
  });

  it('a failed mastered-letters read fails open — never a blank or a crash', () => {
    // fetchMasteredLetters resolves to an empty list on error.
    expect(deriveNextLetter(SEQ, 'lowercase', [])).toBe('l');
    expect(() => deriveNextLetter(SEQ, 'lowercase', null)).not.toThrow();
  });
});

describe('the report screen is wired to that derivation', () => {
  const code = readCode(REPORT);

  it('no longer indexes an alphabet by a completed count', () => {
    expect(code).not.toMatch(/LETTERS\[/);
    expect(code).not.toMatch(/'abcdefghijklmnopqrstuvwxyz'/);
    expect(code).not.toMatch(/next_lowercase_letter|next_uppercase_letter/);
  });

  it('uses the same two helpers as the writing screens', () => {
    expect(code).toMatch(/import \{ fetchMasteredLetters, filterUnmasteredSequence \} from '\.\.\/\.\.\/utils\/masteredLetterFiltering';/);
    expect(code).toMatch(/import \{ getAllLetters \} from '\.\.\/\.\.\/constants\/letterCategories';/);
    expect(code).toMatch(/filterUnmasteredSequence\(base, masteredPairs\)\[0\]\?\.letter \?\? null/);
  });

  it('filters the sequence by caseType before taking the first entry', () => {
    expect(code).toMatch(/letterSequence\.filter\(l => l\?\.caseType === caseType\)/);
    expect(code).toMatch(/forCase\.length > 0 \? forCase : getAllLetters\(caseType\)/);
  });

  it('derives BOTH cases the same way', () => {
    expect(code).toMatch(/deriveNextLetter\(letterSequence, 'lowercase', masteredPairs\)/);
    expect(code).toMatch(/deriveNextLetter\(letterSequence, 'uppercase', masteredPairs\)/);
    expect((code.match(/deriveNextLetter\(/g) || []).length).toBe(3);   // 1 definition + 2 uses
  });

  it('waits for the mastered read rather than guessing from an empty list', () => {
    expect(code).toMatch(/const \[masteredPairs, setMasteredPairs\] = useState\(null\)/);
    expect(code).toMatch(/masteredPairs === null\s*\?\s*null/);
  });

  it('cancels the fetch on unmount', () => {
    const eff = code.slice(code.indexOf('fetchMasteredLetters(student.sid)'));
    expect(eff.slice(0, 300)).toMatch(/if \(!cancelled\) setMasteredPairs\(pairs\)/);
    expect(eff.slice(0, 300)).toMatch(/return \(\) => \{ cancelled = true; \};/);
  });

  it('the uppercase pill shows the derived uppercase letter, not an offset one', () => {
    expect(code).toMatch(/\(lowercaseDone && nextUppercaseLetter\) \|\| '-'/);
  });

  it('BOTH sections render a Next Letter badge', () => {
    // Previously only lowercase had one.
    expect((code.match(/styles\.nextLetterBadge/g) || []).length).toBe(2);
    expect((code.match(/>Next Letter</g) || []).length).toBe(2);
  });

  it('each badge shows its own case, in its own section colour', () => {
    const low = code.indexOf('Lowercase Letters');
    const up  = code.indexOf('Uppercase Letters');
    expect(low).toBeLessThan(up);
    const lowSection = code.slice(low, up);
    const upSection  = code.slice(up);
    expect(lowSection).toMatch(/\{nextLetter\}/);
    expect(lowSection).toMatch(/color: '#2E7D32'/);
    expect(upSection).toMatch(/\{nextUppercaseLetter\}/);
    expect(upSection).toMatch(/color: '#7B1FA2'/);
    // Neither may render the other case's letter.
    expect(lowSection).not.toMatch(/nextUppercaseLetter/);
  });

  it('the uppercase badge hides itself once every uppercase letter is mastered', () => {
    // nextUppercaseLetter is null then, so the guard needs no separate flag.
    expect(code).toMatch(/\{nextUppercaseLetter && \(/);
  });

  it('reuses the existing badge styles — no new palette', () => {
    expect(code).toMatch(/nextLetterBadge: \{/);
    expect((code.match(/nextLetterBadge: \{/g) || []).length).toBe(1);
    expect((code.match(/nextLetterLabel: \{/g) || []).length).toBe(1);
    expect((code.match(/nextLetterValue: \{/g) || []).length).toBe(1);
  });
});

describe('the report is given the sequence to work from', () => {
  it('LetterPracticeScreen passes letterSequence to ProgressReport', () => {
    const nav = readCode(PRACTICE);
    const call = nav.slice(nav.indexOf("navigate('ProgressReport'"));
    expect(call.slice(0, 400)).toMatch(/letterSequence,/);
  });

  it('the report reads it with a safe default', () => {
    expect(readCode(REPORT)).toMatch(/letterSequence = \[\],/);
  });
});

describe('SENTINEL — nothing else in the report changed', () => {
  const code = readCode(REPORT);

  it('the counts and percentages still come from the same endpoint fields', () => {
    expect(code).toMatch(/report\?\.lowercase_completed \?\? initLow/);
    expect(code).toMatch(/report\?\.uppercase_completed \?\? initUp/);
    expect(code).toMatch(/Math\.min\(100, Math\.round\(\(lowercase \/ 26\) \* 100\)\)/);
    expect(code).toMatch(/Math\.min\(100, Math\.round\(\(uppercase \/ 26\) \* 100\)\)/);
    expect(code).toMatch(/const lowercaseDone\s+= lowercase >= 26;/);
    expect(code).toMatch(/totalPercent = Math\.min\(100, Math\.round\(\(totalCompleted \/ 52\) \* 100\)\)/);
  });

  it('the endpoint, orientation lock and gated back are untouched', () => {
    expect(code).toMatch(/ENDPOINTS\.LETTER_PROGRESS\(student\.sid\)/);
    expect(code).toMatch(/useLockPortrait\(\)/);
    expect(code).toMatch(/goBackToOrigin\(navigation, route\.params\?\.originRoute\)/);
  });

  it('the mastery rule itself is untouched — this screen only READS it', () => {
    expect(code).not.toMatch(/mastered_at|threshold|motor_score/i);
    const backend = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(backend('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('the writing screens still choose their own letter exactly as before', () => {
    for (const rel of ['../screens/handwriting/LetterWritingScreen.js',
                       '../screens/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const w = readCode(rel);
      expect(w).toMatch(/const filtered = filterUnmasteredSequence\(baseSequence, pairs\);/);
      expect(w).toMatch(/setEffectiveSequence\(filtered\)/);
    }
  });
});
