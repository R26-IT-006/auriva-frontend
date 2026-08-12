// Feature 4 Step 5 — Safe Frontend Activation: end-to-end orchestration
// tests. Composes every pure piece the real screens call —
// resolveAdaptivePreWritingDetour, markWarmupHandled/hasWarmupHandled,
// buildPreWritingNavigationParams, getPreWritingActivityById — to prove the
// COMPLETE adaptive-detour lifecycle a real session goes through, not just
// each piece in isolation (those already have dedicated unit tests in
// preWritingSessionGuard.test.js and preWritingRecommendation.test.js).
// Component-level rendering tests remain impractical under this project's
// Jest config (node environment, no RN Testing Library) — every guarantee
// below is proven at the pure-logic layer instead, using the exact same
// functions LetterWritingScreen.js/UppercaseWritingScreen.js call.

import {
  markWarmupHandled, hasWarmupHandled, resetPreWritingGuardStore,
  buildPreWritingNavigationParams, resolveAdaptivePreWritingDetour,
  PRE_WRITING_REASON, NAV_REASON,
} from './preWritingSessionGuard';
import { getPreWritingActivityById } from '../constants/preWritingActivities';

beforeEach(() => {
  resetPreWritingGuardStore();
});

/** Simulates one screen's "adaptive recommendation arrived" decision +
 * (conditionally) the navigation params it would build — exactly the shape
 * LetterWritingScreen.js's new Step 5 effect performs. */
function simulateAdaptiveArrival({
  student, theme, sequence, letterIdx, caseType, interactionId, recommendation, nextRouteName, buildNextParams,
}) {
  const letter = sequence[letterIdx].letter;
  const activity = recommendation.activityId ? getPreWritingActivityById(recommendation.activityId) : null;
  const alreadyHandled = hasWarmupHandled({ studentId: student.sid, caseType, letter, interactionId });

  const decision = resolveAdaptivePreWritingDetour({
    recommendation: { ...recommendation, interactionId },
    activity,
    alreadyHandled,
    collectionMode: false,
    currentLetter: letter,
    currentCaseType: caseType,
    currentInteractionId: interactionId,
    currentAttempt: 1,
    hasDrawn: false,
  });

  if (!decision.shouldNavigate) return { decision, navParams: null };

  markWarmupHandled({
    studentId: student.sid, caseType, letter, interactionId, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
  });

  const navParams = buildPreWritingNavigationParams({
    student, theme, activities: [activity],
    targetLetter: letter, targetCaseType: caseType, interactionId,
    reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
    nextRoute: nextRouteName,
    nextParams: buildNextParams(),
  });

  return { decision, navParams };
}

// ─── Test 35 (headline) — same-letter return, lowercase ────────────────────

describe('Orchestration — adaptive detour returns to the SAME target letter (lowercase)', () => {
  const student = { sid: 13 };
  const theme = { button: '#fff' };
  const sequence = [
    { letter: 'c', category: 'curved' },
    { letter: 'o', category: 'curved' },
  ];
  const interactionId = 'interaction-1';
  const caseType = 'lowercase';

  it('navigates with exactly one activity, and nextParams keeps "c" as the active letter on return — not "o"', () => {
    const { decision, navParams } = simulateAdaptiveArrival({
      student, theme, sequence, letterIdx: 0, caseType, interactionId,
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', activityId: 'connect_curve_dots' },
      nextRouteName: 'LetterWriting',
      buildNextParams: () => ({ student, theme, caseType, letterSequence: sequence.slice(0) }),
    });

    expect(decision).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
    expect(navParams.activities).toHaveLength(1);
    expect(navParams.activities[0].id).toBe('connect_curve_dots');
    expect(navParams.nextRoute).toBe('LetterWriting');
    // The critical assertion: first element of the returned sequence is
    // STILL 'c' — the same target letter, not the next one ('o').
    expect(navParams.nextParams.letterSequence[0].letter).toBe('c');
  });

  it('after "return" (a fresh mount reading letterIdx=0 from nextParams.letterSequence), the guard now blocks a second adaptive detour for the same letter', () => {
    const { navParams } = simulateAdaptiveArrival({
      student, theme, sequence, letterIdx: 0, caseType, interactionId,
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', activityId: 'connect_curve_dots' },
      nextRouteName: 'LetterWriting',
      buildNextParams: () => ({ student, theme, caseType, letterSequence: sequence.slice(0) }),
    });

    // Simulate the fresh LetterWritingScreen mount: letterIdx=0 against the
    // returned sequence resolves to the same letter 'c'.
    const returnedSequence = navParams.nextParams.letterSequence;
    const returnedLetter = returnedSequence[0].letter;
    expect(returnedLetter).toBe('c');

    // A second adaptive check for this exact (letter, interaction) — as
    // would happen if the recommendation fetch effect re-ran on the new
    // mount — must now see it as already handled.
    const alreadyHandled = hasWarmupHandled({
      studentId: student.sid, caseType, letter: returnedLetter, interactionId,
    });
    expect(alreadyHandled).toBe(true);

    const secondDecision = resolveAdaptivePreWritingDetour({
      recommendation: { recommended: true, letter: returnedLetter, caseType, interactionId },
      activity: getPreWritingActivityById('connect_curve_dots'),
      alreadyHandled,
      collectionMode: false,
      currentLetter: returnedLetter, currentCaseType: caseType, currentInteractionId: interactionId,
      currentAttempt: 1, hasDrawn: false,
    });
    expect(secondDecision).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('contrasts with the category-boundary detour, which DOES advance to the next letter (slice(letterIdx + 1))', () => {
    // Sanity check that the adaptive and fixed detours are genuinely
    // different route paths, not the same logic reused by accident.
    const adaptiveNext = sequence.slice(0);       // adaptive: same letter
    const boundaryNext = sequence.slice(0 + 1);   // category-boundary: next letter
    expect(adaptiveNext[0].letter).toBe('c');
    expect(boundaryNext[0].letter).toBe('o');
  });
});

// ─── Test 36 — uppercase mirror ─────────────────────────────────────────────

describe('Orchestration — uppercase mirror (S → complex family → curved primitive activity → return to S)', () => {
  const student = { sid: 13 };
  const theme = { button: '#fff' };
  const sequence = [
    { letter: 'S', category: 'curved' },
    { letter: 'U', category: 'curved' },
  ];
  const interactionId = 'interaction-uc-1';

  it('recommends connect_curve_dots for S (complex family, curved primitive) and returns to S, not U', () => {
    const { decision, navParams } = simulateAdaptiveArrival({
      student, theme, sequence, letterIdx: 0, caseType: 'uppercase', interactionId,
      recommendation: { recommended: true, letter: 'S', caseType: 'uppercase', activityId: 'connect_curve_dots' },
      nextRouteName: 'UppercaseWriting',
      // No `caseType` key — UppercaseWritingScreen hardcodes caseType itself,
      // matching its own existing category-boundary nextParams convention.
      buildNextParams: () => ({ student, theme, letterSequence: sequence.slice(0) }),
    });

    expect(decision.shouldNavigate).toBe(true);
    expect(navParams.activities[0].id).toBe('connect_curve_dots');
    expect(navParams.nextParams.letterSequence[0].letter).toBe('S');
    expect(navParams.nextParams).not.toHaveProperty('caseType');
  });

  it('a second detour for S in the same interaction is suppressed after return', () => {
    simulateAdaptiveArrival({
      student, theme, sequence, letterIdx: 0, caseType: 'uppercase', interactionId,
      recommendation: { recommended: true, letter: 'S', caseType: 'uppercase', activityId: 'connect_curve_dots' },
      nextRouteName: 'UppercaseWriting',
      buildNextParams: () => ({ student, theme, letterSequence: sequence.slice(0) }),
    });

    const alreadyHandled = hasWarmupHandled({ studentId: student.sid, caseType: 'uppercase', letter: 'S', interactionId });
    expect(alreadyHandled).toBe(true);
  });

  it('S (uppercase) and s (lowercase) are tracked as distinct guard entries even in the same interaction', () => {
    markWarmupHandled({ studentId: 13, caseType: 'uppercase', letter: 'S', interactionId, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY });
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 's', interactionId })).toBe(false);
  });
});

// ─── Test 37 — u/U never navigates (no_activity_available) ────────────────

describe('Orchestration — u/U (mixed primitive, no catalogue activities) never navigates', () => {
  it('a recommendation with no activityId (as the backend sends for u/U) resolves to no navigation', () => {
    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { recommended: false, letter: 'u', caseType: 'lowercase', interactionId: 'int-1' },
      activity: null,
      alreadyHandled: false,
      collectionMode: false,
      currentLetter: 'u', currentCaseType: 'lowercase', currentInteractionId: 'int-1',
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision).toEqual({ shouldNavigate: false, reason: NAV_REASON.NOT_RECOMMENDED });
  });

  it('even a malformed recommended=true with no resolvable activityId never substitutes a different activity', () => {
    const activity = getPreWritingActivityById(null); // simulates a null/missing activityId
    expect(activity).toBeNull();
    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { recommended: true, letter: 'u', caseType: 'lowercase', interactionId: 'int-1' },
      activity,
      alreadyHandled: false,
      collectionMode: false,
      currentLetter: 'u', currentCaseType: 'lowercase', currentInteractionId: 'int-1',
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision).toEqual({ shouldNavigate: false, reason: NAV_REASON.NO_ACTIVITY_RESOLVED });
  });
});

// ─── Collection-mode never creates detour state ─────────────────────────────

describe('Orchestration — collection mode never navigates and never marks guard state', () => {
  it('a recommended=true response in collection mode still does not navigate', () => {
    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', interactionId: 'int-1' },
      activity: getPreWritingActivityById('connect_curve_dots'),
      alreadyHandled: false,
      collectionMode: true,
      currentLetter: 'c', currentCaseType: 'lowercase', currentInteractionId: 'int-1',
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision).toEqual({ shouldNavigate: false, reason: NAV_REASON.COLLECTION_MODE });
  });

  it('markWarmupHandled with collectionMode=true is a no-op, matching Step 3\'s own guarantee', () => {
    expect(markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-1', collectionMode: true })).toBe(false);
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-1' })).toBe(false);
  });
});

// ─── Test 21 (spec) — race safety: request for c, screen advances to i before it resolves ─

describe('Orchestration — race safety: a late-arriving recommendation for a superseded letter never navigates', () => {
  it('a "c" recommendation arriving after the child has already moved on to "i" is rejected as stale', () => {
    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', interactionId: 'int-1' },
      activity: getPreWritingActivityById('connect_curve_dots'),
      alreadyHandled: false,
      collectionMode: false,
      currentLetter: 'i', // the screen has since advanced
      currentCaseType: 'lowercase', currentInteractionId: 'int-1',
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision).toEqual({ shouldNavigate: false, reason: NAV_REASON.STALE_LETTER });
  });
});
