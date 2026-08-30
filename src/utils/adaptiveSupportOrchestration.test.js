// Feature 3 Step 7 — Final Orchestration + End-to-End Validation (frontend).
//
// Composes every pure/impure piece of the adaptive-support chain together —
// fetchRecommendedStartSupport, shouldApplyRecommendation,
// resolveRecommendedStartSupport, resolveSessionSupportLevel,
// getAdaptiveSupportSequence, buildSessionAttemptRecord — to prove the
// COMPLETE frontend lifecycle a real session goes through, not just each
// piece in isolation (those already have dedicated unit tests in
// handwritingSupportLevels.test.js, supportRecommendation.test.js, and
// handwritingAttemptPayload.test.js). Component-level rendering tests
// remain impractical under this project's Jest config (node environment,
// no RN Testing Library — see jest.config.js) — every guarantee below is
// proven at the pure-logic layer instead, using the exact same functions
// LetterWritingScreen.js/UppercaseWritingScreen.js call.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchRecommendedStartSupport,
  shouldApplyRecommendation,
  resolveRecommendedStartSupport,
} from './supportRecommendation';
import {
  SUPPORT_LEVELS,
  getAdaptiveSupportSequence,
  resolveSessionSupportLevel,
} from '../constants/handwritingSupportLevels';
import { buildSessionAttemptRecord } from './handwritingAttemptPayload';

function makeFeatures(score = 80) {
  return { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 10, stroke_order_meta: null };
}
function makeStrokes() {
  return [{ stroke_id: 1, points: [{ x: 1, y: 2, t: 0, tAbs: 1000, stroke_id: 1 }] }];
}

/** Simulates a whole normal-mode letter session's 3 buildSessionAttemptRecord
 * calls, exactly as handleNext() builds them one attempt at a time. */
function simulateSession({ collectionMode = false, recommendedStartSupport = null } = {}) {
  return [1, 2, 3].map((attempt) => {
    const supportLevel = resolveSessionSupportLevel({ attempt, collectionMode, recommendedStartSupport });
    return buildSessionAttemptRecord({
      attemptNumber: attempt, supportLevel, features: makeFeatures(), strokes: makeStrokes(),
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Test 15/16/17 — starting-recommendation sequences ────────────────────

describe('Orchestration Test 15 — recommend_high sequence', () => {
  it('a high recommendation renders/persists high, medium, low — identical to legacy', () => {
    const attempts = simulateSession({ recommendedStartSupport: SUPPORT_LEVELS.HIGH });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Orchestration Test 16 — recommend_medium sequence', () => {
  it('a medium recommendation renders/persists medium, low, low', () => {
    const attempts = simulateSession({ recommendedStartSupport: SUPPORT_LEVELS.MEDIUM });
    expect(attempts.map(a => a.support_level)).toEqual(['medium', 'low', 'low']);
  });
});

describe('Orchestration Test 17 — recommend_low sequence', () => {
  it('a low recommendation renders/persists low, low, low', () => {
    const attempts = simulateSession({ recommendedStartSupport: SUPPORT_LEVELS.LOW });
    expect(attempts.map(a => a.support_level)).toEqual(['low', 'low', 'low']);
  });
});

// ─── Test 18/19 — insufficient/failure → legacy ────────────────────────────

describe('Orchestration Test 18 — insufficient_data → legacy sequence', () => {
  it('a null recommendedSupport (insufficient_data/insufficient_target/not_applicable) renders/persists the legacy sequence', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: null, decision: 'insufficient_data' } });
    const startSupport = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    const attempts = simulateSession({ recommendedStartSupport: startSupport });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Orchestration Test 19 — malformed/failure response → legacy sequence, handwriting never blocked', () => {
  it.each([
    ['network error', () => client.get.mockRejectedValueOnce(new Error('Network error'))],
    ['500', () => { const e = new Error('500'); e.status = 500; client.get.mockRejectedValueOnce(e); }],
    ['404 older backend', () => { const e = new Error('404'); e.status = 404; client.get.mockRejectedValueOnce(e); }],
    ['malformed body', () => client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'EXTREME' } })],
    ['missing body', () => client.get.mockResolvedValueOnce({})],
  ])('%s falls back to the legacy sequence end-to-end', async (_label, setupMock) => {
    setupMock();
    const startSupport = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(startSupport).toBeNull();
    const attempts = simulateSession({ recommendedStartSupport: startSupport });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

// ─── Test 20/21 — payload correctness ──────────────────────────────────────

describe('Orchestration Test 20 — adaptive sequence produces matching support_level payloads', () => {
  it('every persisted attempt\'s support_level exactly equals getAdaptiveSupportSequence[attempt-1]', () => {
    for (const start of [SUPPORT_LEVELS.HIGH, SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW, null]) {
      const sequence = getAdaptiveSupportSequence(start);
      const attempts = simulateSession({ recommendedStartSupport: start });
      for (let i = 0; i < 3; i++) {
        expect(attempts[i].support_level).toBe(sequence[i]);
      }
    }
  });
});

describe('Orchestration Test 21 — attempt numbers remain 1/2/3 regardless of adaptive sequence', () => {
  it('attempt_number is never rewritten by any starting recommendation', () => {
    for (const start of [SUPPORT_LEVELS.HIGH, SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW, null]) {
      const attempts = simulateSession({ recommendedStartSupport: start });
      expect(attempts.map(a => a.attempt_number)).toEqual([1, 2, 3]);
    }
  });
});

// ─── Test 22 — collection mode never consumes the recommendation ──────────

describe('Orchestration Test 22 — collection mode always uses the fixed protocol sequence', () => {
  it('collectionMode=true ignores recommendedStartSupport entirely, even a resolved medium/low recommendation', () => {
    for (const start of [SUPPORT_LEVELS.HIGH, SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW, null]) {
      const attempts = simulateSession({ collectionMode: true, recommendedStartSupport: start });
      expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
    }
  });

  it('resolveSessionSupportLevel never even calls getAdaptiveSupportSequence-derived values in collection mode', () => {
    // Directly proves the branch: same recommendedStartSupport, different
    // collectionMode, must diverge only in the collection case ignoring it.
    const normal     = resolveSessionSupportLevel({ attempt: 1, collectionMode: false, recommendedStartSupport: 'low' });
    const collection = resolveSessionSupportLevel({ attempt: 1, collectionMode: true,  recommendedStartSupport: 'low' });
    expect(normal).toBe('low');       // adaptive — honors the low recommendation
    expect(collection).toBe('high');  // collection — fixed identity mapping, attempt 1 = high regardless
  });
});

// ─── Test 23/24 — new-letter isolation / stale response ignored ───────────

describe('Orchestration Test 23 — new-letter recommendation isolation', () => {
  it('a recommendation resolved for letter "c" does not apply when the current letter is "i"', () => {
    const recommendation = { letter: 'c', startSupport: 'medium' };
    const result = resolveRecommendedStartSupport({ recommendation, currentLetter: 'i' });
    expect(result).toBeNull(); // → legacy sequence for the new letter, never c's medium
  });

  it('the SAME recommendation correctly applies once the current letter matches again', () => {
    const recommendation = { letter: 'c', startSupport: 'medium' };
    expect(resolveRecommendedStartSupport({ recommendation, currentLetter: 'c' })).toBe('medium');
  });
});

describe('Orchestration Test 24 — stale/late response for a previously-viewed letter is ignored', () => {
  it('simulates: fetch for "c" starts, child advances to "i", the late "c" response cannot change "i"\'s support', () => {
    // The stored recommendation is always tagged with the letter it was
    // resolved FOR (never the letter being rendered when it arrives) —
    // resolveRecommendedStartSupport is the render-time guard that rejects
    // it once the viewed letter has moved on.
    const lateResponseForC = { letter: 'c', startSupport: 'low' };
    const currentlyViewedLetter = 'i';
    const applied = resolveRecommendedStartSupport({ recommendation: lateResponseForC, currentLetter: currentlyViewedLetter });
    expect(applied).toBeNull();
    const attempts = simulateSession({ recommendedStartSupport: applied });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']); // legacy, not c's low
  });
});

// ─── Test 25 — draw-before-response safety ─────────────────────────────────

describe('Orchestration Test 25 — a recommendation arriving after the child has started drawing is never applied', () => {
  it('shouldApplyRecommendation is false once hasDrawn is true, even at attempt 1', () => {
    expect(shouldApplyRecommendation({ currentAttempt: 1, hasDrawnCurrentAttempt: true })).toBe(false);
  });

  it('shouldApplyRecommendation is false once attempt has advanced past 1, drawn or not', () => {
    expect(shouldApplyRecommendation({ currentAttempt: 2, hasDrawnCurrentAttempt: false })).toBe(false);
    expect(shouldApplyRecommendation({ currentAttempt: 3, hasDrawnCurrentAttempt: false })).toBe(false);
  });

  it('shouldApplyRecommendation is true only at attempt 1 with nothing drawn yet', () => {
    expect(shouldApplyRecommendation({ currentAttempt: 1, hasDrawnCurrentAttempt: false })).toBe(true);
  });
});

// ─── Test 26 — same-letter retry keeps the same adaptive sequence ─────────

describe('Orchestration Test 26 — same-letter retry keeps the already-resolved sequence', () => {
  it('resolveRecommendedStartSupport is stable across a retry (attempt resets to 1, hasDrawn resets to false, letter unchanged)', () => {
    const recommendation = { letter: 'c', startSupport: 'medium' };
    // Before the retry (mid-session, e.g. attempt 3 about to fail):
    const beforeRetry = resolveRecommendedStartSupport({ recommendation, currentLetter: 'c' });
    // After the retry resets attempt→1 and hasDrawn→false — letter is still
    // 'c', so the effect never re-fires (letter unchanged in its dependency
    // array) and the stored recommendation is untouched:
    const afterRetry = resolveRecommendedStartSupport({ recommendation, currentLetter: 'c' });
    expect(afterRetry).toBe(beforeRetry);
    expect(afterRetry).toBe('medium');

    // The resulting sequence — and therefore every attempt's rendered/
    // persisted support_level — is identical across the retry.
    const firstPass  = simulateSession({ recommendedStartSupport: beforeRetry });
    const retryPass  = simulateSession({ recommendedStartSupport: afterRetry });
    expect(retryPass.map(a => a.support_level)).toEqual(firstPass.map(a => a.support_level));
  });
});

// ─── Test 27 — support_review → high sequence ──────────────────────────────

describe('Orchestration Test 27 — support_review resolves to the high sequence, not a blocked session', () => {
  it('the backend\'s support_review recommendedSupport=high value flows through to high/medium/low, never blocking the child', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'high', decision: 'support_review', requiresReview: true } });
    const startSupport = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(startSupport).toBe('high');
    const attempts = simulateSession({ recommendedStartSupport: startSupport });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

// ─── Test 28 — ambiguous letter → legacy ───────────────────────────────────

describe('Orchestration Test 28 — ambiguous/unmapped letter (not_applicable) → legacy sequence', () => {
  it('a not_applicable decision (family: null) resolves to no starting support, legacy sequence renders/persists', async () => {
    client.get.mockResolvedValueOnce({
      data: { status: 'resolved', family: null, recommendedSupport: null, decision: 'not_applicable' },
    });
    const startSupport = await fetchRecommendedStartSupport({ studentId: 13, letter: 'a', caseType: 'lowercase' });
    expect(startSupport).toBeNull();
    const attempts = simulateSession({ recommendedStartSupport: startSupport });
    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

// ─── §31 Full acceptance scenario (frontend half) ──────────────────────────

describe('§31 Full acceptance scenario — recommend_medium end-to-end (frontend half)', () => {
  it('fetch → sequence → per-attempt persisted payload matches the spec\'s exact example', async () => {
    client.get.mockResolvedValueOnce({
      data: {
        status: 'resolved', studentId: 13, letter: 'o', caseType: 'lowercase', family: 'curved',
        recommendedSupport: 'medium', decision: 'recommend_medium',
        reason: 'medium_is_lowest_complete_support_meeting_target', requiresReview: false, evidenceBasis: 'historical_proxy_only',
      },
    });

    const startSupport = await fetchRecommendedStartSupport({ studentId: 13, letter: 'o', caseType: 'lowercase' });
    expect(startSupport).toBe('medium');

    // shouldApplyRecommendation gates it (attempt still 1, nothing drawn yet):
    expect(shouldApplyRecommendation({ currentAttempt: 1, hasDrawnCurrentAttempt: false })).toBe(true);

    const attempts = simulateSession({ recommendedStartSupport: startSupport });
    expect(attempts.map(a => ({ attempt_number: a.attempt_number, support_level: a.support_level }))).toEqual([
      { attempt_number: 1, support_level: 'medium' },
      { attempt_number: 2, support_level: 'low' },
      { attempt_number: 3, support_level: 'low' },
    ]);
  });
});
