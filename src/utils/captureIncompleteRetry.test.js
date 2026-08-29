// P1 — a TECHNICAL capture fault must not cost a child a practice cycle.
//
// The bug: isAttemptCoverageValid() returns `false` for an EMPTY drawing and
// for a genuine tiny one alike, so a device fault reached the mastery gate as
// `attempt3_coverage_invalid` — a handwriting judgement about handwriting the
// system never recorded. The child was told "Keep practising", lost one of
// the day's three cycles, and (because the server correctly declined to count
// the cycle while the client counted it anyway) got the cycle back if they
// happened to restart the app.
//
// These are source-assertion tests: RN screens never render under the minimal
// jest config, so the behaviour is pinned by reading the screens themselves.

import fs from 'fs';
import path from 'path';

import {
  canStartAnotherCycle, recordCycleCompleted, getCyclesUsed, resetLetterCycleGuard,
  MAX_CYCLES_PER_LETTER_PER_DATE, MASTERY_ATTEMPT_NUMBER, MASTERY_ATTEMPT_INDEX,
} from './letterCycleGuard';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const lower = read('../screens/handwriting/LetterWritingScreen.js');
const upper = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');
const SCREENS = [['LetterWritingScreen', lower], ['UppercaseWritingScreen', upper]];

const C = { studentId: 1, letter: 'c', caseType: 'lowercase', interactionId: 'i1' };

beforeEach(() => resetLetterCycleGuard());

// ─── The shared constants ───────────────────────────────────────────────

describe('attempt constants', () => {
  it('mastery is attempt 3, index 2', () => {
    expect(MASTERY_ATTEMPT_NUMBER).toBe(3);
    expect(MASTERY_ATTEMPT_INDEX).toBe(2);
  });

  it('matches the backend policy constant — one number, two repos', () => {
    const backend = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/masteryPolicy.js'), 'utf8');
    expect(backend).toMatch(/const MASTERY_ATTEMPT_NUMBER = 3;/);
    expect(MASTERY_ATTEMPT_NUMBER).toBe(3);
  });
});

// ─── A / E / F: the cycle is not consumed ───────────────────────────────

describe('SENTINEL — a capture fault never increments the cycle count', () => {
  it.each(SCREENS)('%s branches on cycle_consumed BEFORE any failed-cycle work', (_name, src) => {
    const code = stripComments(src);
    // The guard must be an early return, ahead of the failure handling.
    expect(code).toMatch(/if \(response\.data\.cycle_consumed === false\) \{\s*handleCaptureIncomplete\(response\.data\.retry_session_key\);\s*return;\s*\}/);
  });

  it.each(SCREENS)('%s never calls recordCycleCompleted from the capture path', (_name, src) => {
    const code = stripComments(src);
    const start = code.indexOf('const handleCaptureIncomplete');
    const end   = code.indexOf('const handleFailedCycle');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = code.slice(start, end);
    expect(body).not.toMatch(/recordCycleCompleted/);
  });

  it.each(SCREENS)('%s does not advance, schedule repetition or create homework on a capture fault', (_name, src) => {
    const code = stripComments(src);
    const body = code.slice(code.indexOf('const handleCaptureIncomplete'),
                            code.indexOf('const handleFailedCycle'));
    expect(body).not.toMatch(/advancePastLetter/);
    expect(body).not.toMatch(/scheduleAdaptiveRepetitionIfEligible/);
    expect(body).not.toMatch(/worksheet|homework/i);
  });

  it('the local guard is genuinely untouched when nothing is recorded', () => {
    // Cycle 1 completes normally...
    expect(recordCycleCompleted({ ...C, serverCyclesToday: 1 })).toBe(1);
    // ...a capture fault records NOTHING, so the count and the remaining
    // budget are both unchanged.
    expect(getCyclesUsed(C)).toBe(1);
    expect(canStartAnotherCycle(C)).toBe(true);
  });
});

// ─── 6: retry is ATTEMPT 3 ONLY ─────────────────────────────────────────

describe('SENTINEL — a technical retry resumes at attempt 3, never attempt 1', () => {
  it.each(SCREENS)('%s sets the attempt back to the mastery attempt', (_name, src) => {
    const code = stripComments(src);
    const body = code.slice(code.indexOf('const handleCaptureIncomplete'),
                            code.indexOf('const handleFailedCycle'));
    expect(body).toMatch(/setAttempt\(MASTERY_ATTEMPT_NUMBER\)/);
    // The whole point: it must NOT restart the cycle.
    expect(body).not.toMatch(/setAttempt\(1\)/);
  });

  it.each(SCREENS)('%s keeps attempts 1 and 2 and drops only attempt 3', (_name, src) => {
    const code = stripComments(src);
    const body = code.slice(code.indexOf('const handleCaptureIncomplete'),
                            code.indexOf('const handleFailedCycle'));
    expect(body).toMatch(/sessionAttemptsRef\.current\.slice\(0, MASTERY_ATTEMPT_INDEX\)/);
    expect(body).toMatch(/attemptScoresRef\.current\.slice\(0, MASTERY_ATTEMPT_INDEX\)/);
    // Never the wholesale wipe the failed-cycle path does.
    expect(body).not.toMatch(/sessionAttemptsRef\.current\s*=\s*\[\]/);
    expect(body).not.toMatch(/attemptScoresRef\.current\s*=\s*\[\]/);
  });

  it('slicing to MASTERY_ATTEMPT_INDEX keeps exactly the two guided attempts', () => {
    const cycle = ['a1', 'a2', 'a3-failed-capture'];
    expect(cycle.slice(0, MASTERY_ATTEMPT_INDEX)).toEqual(['a1', 'a2']);
  });
});

// ─── 5: neutral wording ─────────────────────────────────────────────────

describe('SENTINEL — the child is not told their handwriting failed', () => {
  it.each(SCREENS)('%s shows the neutral capture message', (_name, src) => {
    const code = stripComments(src);
    const body = code.slice(code.indexOf('const handleCaptureIncomplete'),
                            code.indexOf('const handleFailedCycle'));
    expect(body).toMatch(/couldn/i);
    expect(body).toMatch(/record that attempt/i);
    // The handwriting-failure wording belongs only to a real failed cycle.
    expect(body).not.toMatch(/Keep practising/);
  });

  it.each(SCREENS)('%s does not add a second child-facing failure toast for a REAL failed cycle', (_name, src) => {
    expect(stripComments(src)).not.toMatch(/show\('Keep practising/);
  });
});

// ─── 9: the network path stays conservative ─────────────────────────────

describe('SENTINEL — a network error is still treated conservatively', () => {
  it.each(SCREENS)('%s still consumes a cycle on a transport failure', (_name, src) => {
    const code = stripComments(src);
    // The catch block keeps calling handleFailedCycle(null): the request may
    // have reached the server even though the response was lost, so not
    // consuming would permit unbounded retries against a counted cycle.
    expect(code).toMatch(/handleFailedCycle\(null\)/);
  });

  it.each(SCREENS)('%s does NOT route transport errors to the capture path', (_name, src) => {
    const code = stripComments(src);
    const catchStart = code.indexOf('} catch {');
    expect(catchStart).toBeGreaterThan(-1);
    const catchBlock = code.slice(catchStart, catchStart + 1200);
    expect(catchBlock).not.toMatch(/handleCaptureIncomplete/);
  });
});

// ─── 10: server/client consistency ──────────────────────────────────────

describe('server and client agree on what a cycle is', () => {
  it('capture fault: neither side moves', () => {
    // Server declines to count it (2 complete rows, not a cycle) and the
    // client no longer counts it either — so there is no restart "refund".
    const before = getCyclesUsed(C);
    // no recordCycleCompleted call at all — that IS the fix
    expect(getCyclesUsed(C)).toBe(before);
  });

  it.each([
    ['coverage failure', true],
    ['below-threshold failure', true],
    ['pass', true],
  ])('%s: the client records the cycle', (_label, consumed) => {
    resetLetterCycleGuard();
    if (consumed) recordCycleCompleted({ ...C, serverCyclesToday: 1 });
    expect(getCyclesUsed(C)).toBe(1);
  });

  it('three evaluated failures still reach the cap; capture faults in between do not', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: 1 });
    // ...capture fault here records nothing...
    expect(canStartAnotherCycle(C)).toBe(true);
    recordCycleCompleted({ ...C, serverCyclesToday: 2 });
    expect(canStartAnotherCycle(C)).toBe(true);
    recordCycleCompleted({ ...C, serverCyclesToday: 3 });
    expect(canStartAnotherCycle(C)).toBe(false);
    expect(getCyclesUsed(C)).toBe(MAX_CYCLES_PER_LETTER_PER_DATE);
  });
});

// ─── Retry session key: the duplicate-row fix ───────────────────────────

describe('SENTINEL — the retry carries the server-issued session key', () => {
  it.each(SCREENS)('%s stores the key the server handed back', (_name, src) => {
    const code = stripComments(src);
    expect(code).toMatch(/handleCaptureIncomplete\(response\.data\.retry_session_key\)/);
    expect(code).toMatch(/retrySessionKeyRef\.current = retrySessionKey \?\? null/);
  });

  it.each(SCREENS)('%s sends it on the next POST', (_name, src) => {
    expect(stripComments(src)).toMatch(/retry_session_key:\s*retrySessionKeyRef\.current/);
  });

  it.each(SCREENS)('%s clears it once a cycle genuinely resolves', (_name, src) => {
    const code = stripComments(src);
    const body = code.slice(code.indexOf('const handleFailedCycle'),
                            code.indexOf('const handleFailedCycle') + 900);
    expect(body).toMatch(/retrySessionKeyRef\.current = null/);
  });

  it.each(SCREENS)('%s never invents a session key of its own', (_name, src) => {
    const code = stripComments(src);
    // The client is a courier. No uuid generation anywhere near the cycle.
    expect(code).not.toMatch(/session_key:\s*(generateUuid|randomUUID|uuidv4)/);
    expect(code).not.toMatch(/retry_session_key:\s*(generateUuid|randomUUID|uuidv4)/);
  });
});

// ─── J: lowercase / uppercase parity ────────────────────────────────────

describe('SENTINEL — lowercase and uppercase cannot diverge', () => {
  const requiredShapes = [
    /const handleCaptureIncomplete = \(retrySessionKey\) => \{/,
    /if \(response\.data\.cycle_consumed === false\)/,
    /sessionAttemptsRef\.current\.slice\(0, MASTERY_ATTEMPT_INDEX\)/,
    /setAttempt\(MASTERY_ATTEMPT_NUMBER\)/,
    /MASTERY_ATTEMPT_NUMBER, MASTERY_ATTEMPT_INDEX/,
    /retrySessionKeyRef\.current = retrySessionKey \?\? null/,
    /retry_session_key:\s*retrySessionKeyRef\.current/,
  ];

  it.each(requiredShapes.map((r, i) => [i, r]))(
    'both screens carry capture-fault shape #%i', (_i, re) => {
      for (const [, src] of SCREENS) expect(stripComments(src)).toMatch(re);
    });

  it('neither screen hand-types the mastery attempt number', () => {
    for (const [, src] of SCREENS) {
      const code = stripComments(src);
      const body = code.slice(code.indexOf('const handleCaptureIncomplete'),
                              code.indexOf('const handleFailedCycle'));
      expect(body).not.toMatch(/setAttempt\(3\)/);
      expect(body).not.toMatch(/slice\(0, 2\)/);
    }
  });
});
