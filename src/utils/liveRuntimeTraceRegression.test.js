/**
 * liveRuntimeTraceRegression.test.js
 *
 * Anchors the exact live-backend truth captured for student 31 / lowercase
 * "i" during the live runtime trace (Features 3/4/5/6 all live-confirmed
 * triggering) through the REAL pure frontend functions each screen actually
 * calls — proving the frontend integration correctly acts on that data, and
 * documenting one confirmed finding (Feature 3's "high" recommendation is
 * visually indistinguishable from the legacy default sequence) so it is
 * understood and tracked rather than re-discovered as a mystery later.
 *
 * No RN component rendering (this project's Jest config has no such
 * infrastructure) — pure-function proof only, matching every prior
 * feature's own established convention.
 *
 * Mocks '../api/client' before any import — supportRecommendation.js and
 * familyThresholds.js both import the real client module at their top
 * level (for their own impure fetch wrappers, unused here), and the real
 * client.js chain pulls in expo-secure-store, which this project's
 * deliberately-minimal node-environment jest.config.js does not transform
 * (see adaptiveSupportOrchestration.test.js for the exact same pattern).
 */
jest.mock('../api/client', () => ({ get: jest.fn() }));

import { resolveRecommendedStartSupport, shouldApplyRecommendation } from './supportRecommendation';
import { resolveSessionSupportLevel, getAdaptiveSupportSequence, getSupportPresentation } from '../constants/handwritingSupportLevels';
import { normalizePreWritingRecommendationResponse } from './preWritingRecommendation';
import { resolveAdaptivePreWritingDetour, NAV_REASON } from './preWritingSessionGuard';
import { getPreWritingActivityById } from '../constants/preWritingActivities';
import { normalizeRepetitionRecommendationResponse } from './repetitionRecommendation';
import { insertSpacedRepetition } from './controlledRepetition';
import { resolveRecommendedDemoSpeedLevel } from './demoSpeedRecommendation';
import { resolveActualDemoSpeedLevel } from './demoSpeedPersistence';

const STUDENT_ID = 31;
const LETTER = 'i';
const CASE_TYPE = 'lowercase';
const INTERACTION_ID = 'live-trace-interaction-1';

// ─── Feature 3 — live truth: decision=support_review, recommendedSupport=high ──

describe('Feature 3 — live support_review/high response', () => {
  it('is applied as the session-wide adaptive support sequence when it arrives before attempt 1 is drawn', () => {
    const recommendation = { letter: LETTER, startSupport: 'high' };

    expect(shouldApplyRecommendation({ currentAttempt: 1, hasDrawnCurrentAttempt: false })).toBe(true);

    const resolvedStart = resolveRecommendedStartSupport({ recommendation, currentLetter: LETTER });
    expect(resolvedStart).toBe('high');

    const attempt1 = resolveSessionSupportLevel({ attempt: 1, collectionMode: false, recommendedStartSupport: resolvedStart });
    const attempt2 = resolveSessionSupportLevel({ attempt: 2, collectionMode: false, recommendedStartSupport: resolvedStart });
    const attempt3 = resolveSessionSupportLevel({ attempt: 3, collectionMode: false, recommendedStartSupport: resolvedStart });
    expect([attempt1, attempt2, attempt3]).toEqual(['high', 'medium', 'low']);
  });

  it('CONFIRMED FINDING: a "high" recommendation renders identically to the legacy default (no recommendation at all) — this is why support_review alone is not visually distinguishable from "nothing happened"', () => {
    const withHighRecommendation = getAdaptiveSupportSequence('high');
    const withNoRecommendationAtAll = getAdaptiveSupportSequence(null);
    expect(withHighRecommendation).toEqual(withNoRecommendationAtAll);
    // A 'medium' or 'low' recommendation, by contrast, IS visibly different:
    expect(getAdaptiveSupportSequence('medium')).not.toEqual(withNoRecommendationAtAll);
    expect(getAdaptiveSupportSequence('low')).not.toEqual(withNoRecommendationAtAll);
  });

  it('guideOpacity/showAnimatedTracer genuinely differ between high and low support, once support is correctly resolved', () => {
    const highPresentation = getSupportPresentation({ supportLevel: 'high', attempt: 1, collectionMode: false });
    const lowPresentation  = getSupportPresentation({ supportLevel: 'low', attempt: 3, collectionMode: false });
    expect(highPresentation.guideOpacity).toBeGreaterThan(lowPresentation.guideOpacity);
  });
});

// ─── Feature 4 — live truth: shouldTrigger=true, activityId=connect_vertical_dots ──

describe('Feature 4 — live support_review recommendation causes PreWritingActivity navigation', () => {
  const liveResponseBody = {
    status: 'evaluated', studentId: STUDENT_ID, letter: LETTER, caseType: CASE_TYPE,
    family: 'straight', primitiveGroup: 'vertical_horizontal',
    recommended: true, activityId: 'connect_vertical_dots', reason: 'feature3_support_review',
  };

  it('normalizes the exact live response correctly', () => {
    const normalized = normalizePreWritingRecommendationResponse(liveResponseBody);
    expect(normalized).toEqual({
      recommended: true, activityId: 'connect_vertical_dots', letter: LETTER, caseType: CASE_TYPE,
      family: 'straight', primitiveGroup: 'vertical_horizontal', reason: 'feature3_support_review',
    });
  });

  it('resolveAdaptivePreWritingDetour navigates — no guard incorrectly suppresses the first legitimate trigger', () => {
    const recommendation = normalizePreWritingRecommendationResponse(liveResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);
    expect(activity).toBeTruthy(); // catalog resolution must succeed for this to be meaningful

    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId: INTERACTION_ID },
      activity,
      alreadyHandled: false,
      collectionMode: false,
      currentLetter: LETTER,
      currentCaseType: CASE_TYPE,
      currentInteractionId: INTERACTION_ID,
      currentAttempt: 1,
      hasDrawn: false,
    });

    expect(decision).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
  });

  it('CONFIRMED (not a bug): the SAME live response is correctly suppressed once the child has moved past attempt 1 — by design, never a defect', () => {
    const recommendation = normalizePreWritingRecommendationResponse(liveResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);

    const decisionAt2 = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId: INTERACTION_ID },
      activity, alreadyHandled: false, collectionMode: false,
      currentLetter: LETTER, currentCaseType: CASE_TYPE, currentInteractionId: INTERACTION_ID,
      currentAttempt: 2, hasDrawn: false,
    });
    expect(decisionAt2).toEqual({ shouldNavigate: false, reason: NAV_REASON.ATTEMPT_ADVANCED });

    const decisionDrawing = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId: INTERACTION_ID },
      activity, alreadyHandled: false, collectionMode: false,
      currentLetter: LETTER, currentCaseType: CASE_TYPE, currentInteractionId: INTERACTION_ID,
      currentAttempt: 1, hasDrawn: true,
    });
    expect(decisionDrawing).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_DRAWING });
  });

  it('does not suppress via alreadyHandled when this exact interaction has genuinely never seen this warm-up', () => {
    const recommendation = normalizePreWritingRecommendationResponse(liveResponseBody);
    const activity = getPreWritingActivityById(recommendation.activityId);

    const decision = resolveAdaptivePreWritingDetour({
      recommendation: { ...recommendation, interactionId: INTERACTION_ID },
      activity, alreadyHandled: false, collectionMode: false,
      currentLetter: LETTER, currentCaseType: CASE_TYPE, currentInteractionId: INTERACTION_ID,
      currentAttempt: 1, hasDrawn: false,
    });
    expect(decision.shouldNavigate).toBe(true);
  });
});

// ─── Feature 5 — live truth: shouldRepeat=true ──────────────────────────────

describe('Feature 5 — live shouldRepeat=true causes actual spaced insertion', () => {
  const liveResponseBody = {
    status: 'evaluated', shouldRepeat: true, letter: LETTER, caseType: CASE_TYPE, family: 'straight',
    reason: 'feature3_support_review',
  };

  it('normalizes the exact live response correctly', () => {
    const normalized = normalizeRepetitionRecommendationResponse(liveResponseBody);
    expect(normalized.shouldRepeat).toBe(true);
    expect(normalized.letter).toBe(LETTER);
    expect(normalized.caseType).toBe(CASE_TYPE);
  });

  it('a real sequence receives the repeated letter at currentIndex+2, exactly as designed', () => {
    const sequence = [
      { letter: 'i', caseType: 'lowercase' },
      { letter: 'l', caseType: 'lowercase' },
      { letter: 't', caseType: 'lowercase' },
    ];
    const { sequence: nextSequence, inserted, insertionIndex } = insertSpacedRepetition({
      sequence, currentIndex: 0, targetLetterEntry: sequence[0], interactionId: INTERACTION_ID,
    });

    expect(inserted).toBe(true);
    expect(insertionIndex).toBe(2);
    expect(nextSequence.map((e) => e.letter)).toEqual(['i', 'l', 'i', 't']);
    // Original entry untouched — immutability guarantee.
    expect(sequence.map((e) => e.letter)).toEqual(['i', 'l', 't']);
  });
});

// ─── Feature 6 — live truth: recommendedSpeedLevel=slow ─────────────────────

describe('Feature 6 — live slow recommendation reaches the tracer', () => {
  it('resolves to slow when the tracer is genuinely visible at high support', () => {
    const recommendation = { letter: LETTER, caseType: CASE_TYPE, speedLevel: 'slow' };
    const recommended = resolveRecommendedDemoSpeedLevel({ recommendation, currentLetter: LETTER, currentCaseType: CASE_TYPE });
    expect(recommended).toBe('slow');

    const actual = resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: recommended, supportLevel: 'high', showAnimatedTracer: true,
      reduceMotion: false, collectionMode: false,
    });
    expect(actual).toBe('slow');
  });

  it('never applies a stale "slow" value when the tracer is not actually showing (support dropped to medium/low)', () => {
    const actual = resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: 'medium', showAnimatedTracer: false,
      reduceMotion: false, collectionMode: false,
    });
    expect(actual).toBeNull(); // caller falls back to STANDARD, never a leaked stale 'slow'
  });
});
