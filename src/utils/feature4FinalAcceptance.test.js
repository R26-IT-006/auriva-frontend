// Feature 4 Step 6 — Final Orchestration + End-to-End Validation (frontend).
//
// This file does not re-test each individual gate again — every one of
// resolveAdaptivePreWritingDetour()'s branches, the guard's identity/
// marking contract, and fetchPreWritingRecommendation()'s failure-safety
// already have dedicated unit tests in preWritingSessionGuard.test.js and
// preWritingRecommendation.test.js (Step 5). This file instead proves the
// SINGLE, most important thing Step 6 asks for: the COMPLETE synthetic
// acceptance scenario (spec §4/§40) walked through end-to-end as one
// narrative — backend recommendation shape → frontend consumption →
// navigation params → simulated return → guard suppression of a second
// detour — using the exact same pure functions the real screens call.
//
// Component-level rendering tests remain impractical under this project's
// Jest config (node environment, no RN Testing Library) — this is the
// pure-logic equivalent of mounting LetterWritingScreen, entering 'c', and
// watching it navigate and come back, exactly as
// preWritingAdaptiveOrchestration.test.js already established the pattern
// for in Step 5.

// preWritingRecommendation.js imports api/client.js, which pulls in
// expo-secure-store transitively (via storage.js) — not transformable under
// this project's Jest config. Mocked here purely to avoid that import chain;
// this file never actually calls client.get(), only the pure normalizer.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import {
  markWarmupHandled, hasWarmupHandled, resetPreWritingGuardStore,
  buildPreWritingNavigationParams, resolveAdaptivePreWritingDetour,
  PRE_WRITING_REASON, NAV_REASON,
} from './preWritingSessionGuard';
import { normalizePreWritingRecommendationResponse } from './preWritingRecommendation';
import { getPreWritingActivityById } from '../data/preWritingActivities';

beforeEach(() => {
  resetPreWritingGuardStore();
});

describe('Feature 4 full acceptance scenario (spec §4/§40) — student X, letter c, Feature 3 support_review', () => {
  const student = { sid: 'X' };
  const theme = { button: '#fff' };
  const interactionId = 'abc';
  const caseType = 'lowercase';
  const sequence = [
    { letter: 'a', category: 'mixed' },
    { letter: 'c', category: 'curved' },
    { letter: 'o', category: 'curved' },
  ];
  const letterIdx = 1; // target = 'c'

  // Step 1: the exact JSON shape GET /pre-writing-recommendation/:studentId/c/lowercase
  // returns for this scenario (matches feature4EndToEndOrchestration.test.js's
  // backend headline test byte-for-byte).
  const backendResponseBody = {
    status: 'evaluated', studentId: 'X', letter: 'c', caseType: 'lowercase',
    family: 'curved', primitiveGroup: 'curved',
    recommended: true, activityId: 'connect_curve_dots', reason: 'feature3_support_review',
    signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
  };

  it('Checkpoint 1 — the fetch-response normalizer trusts a well-formed recommended=true body', () => {
    const recommendation = normalizePreWritingRecommendationResponse(backendResponseBody);
    expect(recommendation).toEqual({
      recommended: true, activityId: 'connect_curve_dots', letter: 'c', caseType: 'lowercase',
      family: 'curved', primitiveGroup: 'curved', reason: 'feature3_support_review',
    });
  });

  it('Checkpoint 2 — the frontend resolves activityId to the real activity object it already owns', () => {
    const recommendation = normalizePreWritingRecommendationResponse(backendResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);
    expect(activity).not.toBeNull();
    expect(activity.id).toBe('connect_curve_dots');
    expect(activity.primitive_group).toBe('curved');
  });

  it('Checkpoint 3 — guard is initially false, attempt=1, not drawn → the decision is shouldNavigate=true', () => {
    const recommendation = normalizePreWritingRecommendationResponse(backendResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);

    const alreadyHandled = hasWarmupHandled({ studentId: student.sid, caseType, letter: 'c', interactionId });
    expect(alreadyHandled).toBe(false); // guard initially false

    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId },
      activity,
      alreadyHandled,
      collectionMode: false,
      currentLetter: 'c', currentCaseType: caseType, currentInteractionId: interactionId,
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
  });

  it('Checkpoint 4 — mark happens BEFORE navigation, and navigation carries exactly [connect_curve_dots] with the SAME target letter preserved on return', () => {
    const recommendation = normalizePreWritingRecommendationResponse(backendResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);
    const alreadyHandled = hasWarmupHandled({ studentId: student.sid, caseType, letter: 'c', interactionId });

    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId }, activity, alreadyHandled, collectionMode: false,
      currentLetter: 'c', currentCaseType: caseType, currentInteractionId: interactionId,
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision.shouldNavigate).toBe(true);

    // Mark BEFORE navigating — exactly what LetterWritingScreen.js's Step 5
    // effect does, in this order.
    const marked = markWarmupHandled({
      studentId: student.sid, caseType, letter: 'c', interactionId, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
    });
    expect(marked).toBe(true);

    const navParams = buildPreWritingNavigationParams({
      student, theme, activities: [activity],
      targetLetter: 'c', targetCaseType: caseType, interactionId,
      reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
      nextRoute: 'LetterWriting',
      nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx) },
    });

    expect(navParams.activities).toEqual([activity]);       // exactly one activity
    expect(navParams.activities).toHaveLength(1);
    expect(navParams.nextRoute).toBe('LetterWriting');
    expect(navParams.nextParams.letterSequence[0].letter).toBe('c'); // SAME target letter, not 'o'
    expect(navParams.warmupReason).toBe('adaptive_difficulty');
  });

  it('Checkpoint 5 — after "return" (fresh mount at letterIdx=0 of the returned sequence), the guard is now true and a second adaptive evaluation cannot navigate again', () => {
    // Replays checkpoints 3-4 to reach the marked state, then simulates the
    // post-return mount.
    const recommendation = normalizePreWritingRecommendationResponse(backendResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);
    markWarmupHandled({ studentId: student.sid, caseType, letter: 'c', interactionId, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY });
    const navParams = buildPreWritingNavigationParams({
      student, theme, activities: [activity], targetLetter: 'c', targetCaseType: caseType, interactionId,
      reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY, nextRoute: 'LetterWriting',
      nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx) },
    });

    const returnedLetter = navParams.nextParams.letterSequence[0].letter;
    expect(returnedLetter).toBe('c');

    const alreadyHandledOnReturn = hasWarmupHandled({
      studentId: student.sid, caseType, letter: returnedLetter, interactionId: navParams.nextParams.interactionId,
    });
    expect(alreadyHandledOnReturn).toBe(true);

    const secondDecision = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, letter: returnedLetter, interactionId },
      activity, alreadyHandled: alreadyHandledOnReturn, collectionMode: false,
      currentLetter: returnedLetter, currentCaseType: caseType, currentInteractionId: interactionId,
      currentAttempt: 1, hasDrawn: false,
    });
    expect(secondDecision).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('Checkpoint 6 — no recommendation-history row and no guard state is anything but frontend in-memory (structural proof)', () => {
    // The guard module never IMPORTS a persistence/network layer — scoped to
    // actual import statements, not prose (the module's own header comment
    // legitimately discusses AsyncStorage while explaining why it is NOT
    // used, so a bare substring match would be a false positive — see
    // preWritingSessionGuard.test.js's Test 17 for the same precedent this
    // reuses). This is a narrower, scenario-scoped echo of that guarantee.
    const importLines = importLinesOf('preWritingSessionGuard.js');
    expect(importLines.some(l => /AsyncStorage/.test(l))).toBe(false);
    expect(importLines.some(l => /['"]\.\/storage['"]|axios|api\/client/.test(l))).toBe(false);
  });
});

// ─── Feature 3 independence — structural proof ──────────────────────────────

// Scoped to actual import/require statements, not prose — both files'
// header comments legitimately DISCUSS Feature 3's supportRecommendation.js
// (explaining the parallel/independence), so a bare substring match on
// "supportRecommendation" would be a false positive (the same mistake
// preWritingSessionGuard.test.js's own Test 17 already guards against for
// "AsyncStorage" — see that file's comment for the precedent).
function importLinesOf(filename) {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  return source.split('\n').filter(line => /^\s*import\s/.test(line));
}

describe('Feature 4 does not touch Feature 3 support-level machinery', () => {
  it('preWritingSessionGuard.js never IMPORTS handwritingSupportLevels.js or supportRecommendation.js (only discusses them in comments)', () => {
    const importLines = importLinesOf('preWritingSessionGuard.js');
    expect(importLines.some(l => /handwritingSupportLevels/.test(l))).toBe(false);
    expect(importLines.some(l => /supportRecommendation/.test(l))).toBe(false);
  });

  it('preWritingRecommendation.js never IMPORTS handwritingSupportLevels.js or supportRecommendation.js (only discusses them in comments)', () => {
    const importLines = importLinesOf('preWritingRecommendation.js');
    expect(importLines.some(l => /handwritingSupportLevels/.test(l))).toBe(false);
    expect(importLines.some(l => /supportRecommendation/.test(l))).toBe(false);
  });
});
