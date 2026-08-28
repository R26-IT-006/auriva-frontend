// The two-cycle-per-practice-date ceiling — frontend half.
//
// THE BUG THIS CLOSES: a failed 3-attempt cycle used to run
//
//     setAttempt(1); resetCanvas(); return;
//
// with nothing bounding it. A child who could not yet form `c` stayed on `c`
// for cycle 3, 4, 5 — as long as they kept going. repetitionPolicy.js's own
// header said so: the immediate same-letter retry was "still unbounded".
//
// The rule now: at most TWO completed cycles = SIX attempts per
// (student, letter, case_type, practice date). Cycle 2 follows a failed
// cycle 1 immediately, and cycle 3 a failed cycle 2; a failed cycle 3 sets the
// letter aside for the date. Raised from two to three alongside the
// attempt-3-only mastery rule — see backend config/masteryPolicy.js.

import fs from 'fs';
import path from 'path';

import {
  recordCycleCompleted, getCyclesUsed, canStartAnotherCycle,
  resetLetterCycleGuard, MAX_CYCLES_PER_LETTER_PER_DATE,
} from './letterCycleGuard';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

// Several assertions below are about CODE, not prose — these files explain at
// length what they deliberately avoid, and that explanation must not register
// as a violation of itself.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const letterScreen = read('../screens/handwriting/LetterWritingScreen.js');
const upperScreen  = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');
const guardSrc     = read('./letterCycleGuard.js');

const C = { studentId: 7, letter: 'c', caseType: 'lowercase', interactionId: 'int-1' };

beforeEach(() => resetLetterCycleGuard());

// ─── REGRESSION: the infinite retry is gone ─────────────────────────────

describe('REGRESSION — a failed letter can no longer repeat forever', () => {
  it('allows cycles 1, 2 and 3, and then no more', () => {
    expect(canStartAnotherCycle(C)).toBe(true);          // cycle 1
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(true);          // cycle 2 — immediate
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(true);          // cycle 3 — immediate
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(false);         // no cycle 4
  });

  it('stays closed no matter how many more failures arrive', () => {
    for (let i = 0; i < 10; i++) recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(false);
    expect(getCyclesUsed(C)).toBeGreaterThanOrEqual(MAX_CYCLES_PER_LETTER_PER_DATE);
  });

  it('the screens no longer reset the attempt unconditionally on failure', () => {
    for (const src of [letterScreen, upperScreen]) {
      const failureBranch = src.slice(src.indexOf('const handleFailedCycle'),
        src.indexOf('handleFailedCycle(response'));
      // The old shape — an unconditional retry — is gone from both branches.
      expect(src).not.toMatch(/scheduleAdaptiveRepetitionIfEligible\(\);\s*\n\s*attemptScoresRef\.current\s*=\s*\[\];\s*\n\s*sessionAttemptsRef\.current\s*=\s*\[\];\s*\n\s*setAttempt\(1\);/);
      // Both failure paths now go through the ceiling.
      expect(src).toMatch(/const handleFailedCycle = \(serverCyclesToday\) => \{/);
      expect((src.match(/handleFailedCycle\(/g) ?? []).length).toBe(2); // both failure paths
      // `const` sits in the temporal dead zone until its declaration is
      // evaluated, and both failure branches run EARLIER in the same function
      // body — so the helpers must be declared above them, not below. (They
      // were not, at first; this assertion is why that was caught.)
      expect(src.indexOf('const handleFailedCycle ='))
        .toBeLessThan(src.indexOf('handleFailedCycle(response'));
      expect(src.indexOf('const advancePastLetter'))
        .toBeLessThan(src.indexOf('handleFailedCycle(response'));
      expect(failureBranch).toMatch(/if \(used >= MAX_CYCLES_PER_LETTER_PER_DATE\)/);
    }
  });

  it('the ceiling is 3, in both the guard and the screens', () => {
    expect(MAX_CYCLES_PER_LETTER_PER_DATE).toBe(3);
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE/);
      // Never a hand-typed number — the constant is the single source.
      expect(src).not.toMatch(/used >= [0-9]/);
    }
  });
});

// ─── Scope: student + letter + case + interaction ───────────────────────

describe('the budget is per student, letter and case', () => {
  it('lowercase c and uppercase C have separate budgets', () => {
    // Exhaust lowercase c entirely...
    for (let i = 0; i < MAX_CYCLES_PER_LETTER_PER_DATE; i++) {
      recordCycleCompleted({ ...C, serverCyclesToday: null });
    }
    expect(canStartAnotherCycle(C)).toBe(false);
    // ...uppercase C is a different letter form, with its own full budget.
    expect(canStartAnotherCycle({ ...C, letter: 'C', caseType: 'uppercase' })).toBe(true);
    expect(getCyclesUsed({ ...C, letter: 'C', caseType: 'uppercase' })).toBe(0);
  });

  it('a different letter is unaffected', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle({ ...C, letter: 'o' })).toBe(true);
  });

  it('a different student is unaffected', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle({ ...C, studentId: 8 })).toBe(true);
  });

  it('REGRESSION — re-entering from the letter list does NOT reset the budget', () => {
    // The guard was first keyed by interactionId. An interaction is one
    // "start writing" tap, so backing out to the letter list and starting
    // again minted a fresh id, zeroed the count, and allowed a THIRD cycle on
    // the same letter the same day. The key is per practice date now.
    for (let i = 0; i < MAX_CYCLES_PER_LETTER_PER_DATE; i++) {
      recordCycleCompleted({ ...C, interactionId: 'int-1', serverCyclesToday: null });
    }
    expect(canStartAnotherCycle({ ...C, interactionId: 'int-1' })).toBe(false);
    // A brand-new interaction, same child, same letter, same day:
    expect(canStartAnotherCycle({ ...C, interactionId: 'int-2-fresh-tap' })).toBe(false);
    expect(getCyclesUsed({ ...C, interactionId: 'int-2-fresh-tap' })).toBe(MAX_CYCLES_PER_LETTER_PER_DATE);
  });

  it('a NEW practice date starts the budget fresh', () => {
    const { currentPracticeDate } = require('./letterCycleGuard');
    expect(currentPracticeDate(new Date('2026-08-26T10:00:00Z'))).toBe('2026-08-26');
    // The date rolls at LOCAL midnight (Asia/Colombo, +5:30), matching the
    // backend's practiceCyclePolicy exactly.
    expect(currentPracticeDate(new Date('2026-08-26T18:29:00Z'))).toBe('2026-08-26');
    expect(currentPracticeDate(new Date('2026-08-26T18:31:00Z'))).toBe('2026-08-27');
  });

  it('the frontend and backend measure the practice date in the SAME zone', () => {
    const { PRACTICE_TIMEZONE } = require('./letterCycleGuard');
    const backend = fs.readFileSync(
      path.resolve(__dirname, '../../../auriva-backend/src/config/practiceCyclePolicy.js'), 'utf8');
    expect(PRACTICE_TIMEZONE).toBe('Asia/Colombo');
    expect(backend).toMatch(/const PRACTICE_TIMEZONE = 'Asia\/Colombo';/);
  });

  it('invalid input never traps a child on a letter with no way forward', () => {
    expect(canStartAnotherCycle({})).toBe(true);
    expect(canStartAnotherCycle({ ...C, letter: '' })).toBe(true);
    expect(canStartAnotherCycle({ ...C, interactionId: null })).toBe(true);
    expect(recordCycleCompleted({})).toBe(0);
  });
});

// ─── The durable half: seeding from the server ──────────────────────────

describe('an app restart cannot buy an extra cycle', () => {
  it('seeds from the server count for the practice date', () => {
    // Fresh app process: the in-memory counter is empty, but the server has
    // already seen all three of today's cycles for this letter.
    const used = recordCycleCompleted({ ...C, serverCyclesToday: 3 });
    expect(used).toBe(3);
    expect(canStartAnotherCycle(C)).toBe(false);
  });

  it('after TWO server-seen cycles exactly one remains', () => {
    // Scenario I: restart mid-letter having already failed cycles 1 and 2.
    expect(recordCycleCompleted({ ...C, serverCyclesToday: 2 })).toBe(2);
    expect(canStartAnotherCycle(C)).toBe(true);
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(false);
  });

  it('combines the two counts by MAXIMUM, never by trusting one alone', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: null });   // local 1
    // A stale/low server answer must not lower what this session saw.
    expect(recordCycleCompleted({ ...C, serverCyclesToday: 1 })).toBe(2);
    // A HIGHER server answer wins immediately.
    expect(recordCycleCompleted({ ...C, serverCyclesToday: 3 })).toBe(3);
    expect(canStartAnotherCycle(C)).toBe(false);
  });

  it('a missing server opinion leaves the local guard in charge', () => {
    // A network failure sends null — never permission for another cycle.
    expect(recordCycleCompleted({ ...C, serverCyclesToday: null })).toBe(1);
    expect(recordCycleCompleted({ ...C, serverCyclesToday: undefined })).toBe(2);
    expect(canStartAnotherCycle(C)).toBe(true);   // third still available
    expect(recordCycleCompleted({ ...C, serverCyclesToday: undefined })).toBe(3);
    expect(canStartAnotherCycle(C)).toBe(false);
  });

  it('the screens pass the server count through on a backend-confirmed failure', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/handleFailedCycle\(response\.data\?\.cycle_usage\?\.cycles_today \?\? null\)/);
      // ...and null on a network failure, where there is no server opinion.
      expect(src).toMatch(/handleFailedCycle\(null\)/);
    }
  });

  it('does NOT persist — a crash mid-date must not be remembered wrongly here', () => {
    // The durable answer lives on the server; this is the session latch only.
    expect(stripComments(guardSrc)).not.toMatch(/AsyncStorage|SecureStore/);
  });
});

// The whole handleFailedCycle body, brace-matched and comment-stripped. A
// fixed-width slice used to be enough; the function now also holds the
// cycle-3 remediation detour, and its comments name the very things these
// sentinels forbid — in the course of saying it never does them.
function failedCycleBody(src) {
  const start = src.indexOf('const handleFailedCycle');
  expect(start).toBeGreaterThan(-1);
  let i = src.indexOf('{', src.indexOf('=>', start));
  let depth = 0;
  for (;; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return stripComments(src.slice(start, i + 1));
}

// ─── Attempt numbering is untouched ─────────────────────────────────────

describe('attempt numbering still restarts at 1 for each cycle', () => {
  it('cycle 2 begins at attempt 1, never attempt 4', () => {
    for (const src of [letterScreen, upperScreen]) {
      const branch = failedCycleBody(src);
      expect(branch).toMatch(/setAttempt\(1\);/);
      expect(branch).not.toMatch(/setAttempt\(4\)|setAttempt\(a => a \+ 3\)/);
    }
  });

  it('the within-cycle progression 1 -> 2 -> 3 is unchanged', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/if \(!isLastAttempt\) \{\s*\n\s*setAttempt\(a => a \+ 1\);/);
      expect(src).toMatch(/const \[attempt,\s+setAttempt\]\s+= useState\(1\)/);
    }
  });
});

// ─── Moving on ──────────────────────────────────────────────────────────

describe('a letter set aside moves on the same way a mastered one does', () => {
  it('reuses the sequence advance, not a second hand-written one', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/const advancePastLetter = \(\) => \{/);
      expect(src).toMatch(/advancePastLetter\(\);/);
      // Same category / end-of-run handling as the mastered path.
      const advance = src.slice(src.indexOf('const advancePastLetter'),
        src.indexOf('const handleFailedCycle'));
      expect(advance).toMatch(/ALL_DONE_CELEBRATION/);
      expect(advance).toMatch(/CATEGORY_CELEBRATION/);
      expect(advance).toMatch(/setLetterIdx\(i => i \+ 1\)/);
    }
  });

  it('setting a letter aside does NOT master it', () => {
    for (const src of [letterScreen, upperScreen]) {
      const branch = failedCycleBody(src);
      expect(branch).not.toMatch(/mastered|mastery|LetterProgress/i);
    }
  });

  it('collection mode is untouched — the research protocol never caps', () => {
    for (const src of [letterScreen, upperScreen]) {
      // The failure branches that call the ceiling are already inside
      // `!collectionMode` guards, exactly as before.
      expect(src).toMatch(/if \(!collectionMode && response\.data\.completed === false\)/);
      expect(src).toMatch(/if \(!collectionMode && !wroteCorrectly\)/);
    }
  });
});

// ─── Teacher-facing wording ─────────────────────────────────────────────

describe('the Additional Home Practice card', () => {
  const labels = read('./worksheetLabels.js');
  const screen = read('../screens/handwriting/reports/TeacherReportScreen.js');

  it('uses the agreed wording', () => {
    const {
      TWO_CYCLE_SECTION_LABEL, TWO_CYCLE_STATUS_LABEL, TWO_CYCLE_DEFER_LABEL,
      isTwoCycleCandidate, CANDIDATE_SOURCE_TWO_CYCLE,
    } = require('./worksheetLabels');
    expect(TWO_CYCLE_SECTION_LABEL).toBe('Additional Home Practice');
    expect(TWO_CYCLE_STATUS_LABEL).toBe('Not yet mastered');
    expect(TWO_CYCLE_DEFER_LABEL).toBe('Not Now');
    expect(CANDIDATE_SOURCE_TWO_CYCLE).toBe('two_cycle_failure');
    expect(isTwoCycleCandidate({ source: 'two_cycle_failure' })).toBe(true);
    expect(isTwoCycleCandidate({ source: 'persistent_difficulty' })).toBe(false);
    expect(isTwoCycleCandidate(null)).toBe(false);
  });

  it('shows the letter, its status, and Generate Worksheet / Not Now', () => {
    expect(screen).toMatch(/\{isTwoCycleCandidate\(recommendation\) \? TWO_CYCLE_SECTION_LABEL/);
    expect(screen).toMatch(/\{TWO_CYCLE_STATUS_LABEL\}/);
    expect(screen).toMatch(/\{isTwoCycleCandidate\(recommendation\) \? TWO_CYCLE_DEFER_LABEL : 'Dismiss'\}/);
    expect(screen).toMatch(/Generate Worksheet/);
  });

  it('exposes no cycle count, threshold, score or internal identifier', () => {
    const card = stripComments(screen.slice(
      screen.indexOf('{!active && recommendation && !dismissed ?'),
      screen.indexOf('Active Homework Worksheet')));
    for (const leak of ['failedCycles', 'totalCycles', 'recommendationFingerprint',
      'threshold', 'motor_score', 'bestScore', 'session_key', 'practiceDate']) {
      expect(card).not.toContain(leak);
    }
    // The rendered TEXT never says "cycle". Identifiers like
    // isTwoCycleCandidate are code, not something a teacher reads.
    const visibleText = (card.match(/>[^<>{}]+</g) ?? []).join(' ');
    expect(visibleText).not.toMatch(/cycle/i);
    expect(visibleText).not.toMatch(/threshold|score/i);
  });

  it('the worksheet flow itself is unchanged', () => {
    const { PRACTICE_SEQUENCE_TEXT } = require('./worksheetLabels');
    expect(screen).toMatch(/\{PRACTICE_SEQUENCE_TEXT\}/);
    expect(labels).toMatch(/PRACTICE_SEQUENCE_TEXT/);
  });
});
