// Feature 6 Step 4 — TESTS: fetch utility (spec item 47) + application-gate
// (spec item 48). `client` is mocked so these tests never hit a real
// network. Mirrors utils/repetitionRecommendation.test.js's exact convention.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchDemoSpeedRecommendation,
  normalizeDemoSpeedRecommendationResponse,
  shouldApplyDemoSpeedRecommendation,
  resolveRecommendedDemoSpeedLevel,
} from './demoSpeedRecommendation';

beforeEach(() => {
  jest.clearAllMocks();
});

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated',
    studentId: 13, letter: 'c', caseType: 'lowercase',
    family: 'curved', recommendedSpeedLevel: 'standard', reason: 'insufficient_data',
    signals: { feature2Decision: 'insufficient_data', feature3Decision: 'insufficient_data' },
    ...overrides,
  };
}

// ─── Fetch utility tests (spec item 47) ────────────────────────────────────

describe('Test 1 — standard response', () => {
  it('resolves recommendedSpeedLevel=standard', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ recommendedSpeedLevel: 'standard' }) });
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toEqual({ letter: 'c', caseType: 'lowercase', recommendedSpeedLevel: 'standard' });
  });
});

describe('Test 2 — slow response', () => {
  it('resolves recommendedSpeedLevel=slow', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendedSpeedLevel: 'slow', reason: 'feature3_support_review',
      signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    }) });
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommendedSpeedLevel).toBe('slow');
  });
});

describe('Test 3 — network failure -> standard, never throws', () => {
  it('resolves safely on a pure network error', async () => {
    client.get.mockRejectedValueOnce(new Error('Network error. Check your connection.'));
    await expect(fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' }))
      .resolves.toEqual({ letter: 'c', caseType: 'lowercase', recommendedSpeedLevel: 'standard' });
  });
});

describe('Test 4 — 404 -> standard', () => {
  it('resolves safely on a 404 (older backend / rollout mismatch)', async () => {
    const err = Object.assign(new Error('Request failed with status 404'), { status: 404 });
    client.get.mockRejectedValueOnce(err);
    await expect(fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' }))
      .resolves.toEqual({ letter: 'c', caseType: 'lowercase', recommendedSpeedLevel: 'standard' });
  });
});

describe('Test 5 — 500 -> standard', () => {
  it('resolves safely on a 500', async () => {
    const err = Object.assign(new Error('Failed to evaluate demo speed recommendation'), { status: 500 });
    client.get.mockRejectedValueOnce(err);
    await expect(fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' }))
      .resolves.toEqual({ letter: 'c', caseType: 'lowercase', recommendedSpeedLevel: 'standard' });
  });
});

describe('Test 6 — malformed response -> standard', () => {
  it('a null response body falls back safely', async () => {
    client.get.mockResolvedValueOnce({ data: null });
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommendedSpeedLevel).toBe('standard');
  });

  it('a missing response body falls back safely', async () => {
    client.get.mockResolvedValueOnce({});
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommendedSpeedLevel).toBe('standard');
  });
});

describe('Test 7 — invalid speed level -> standard', () => {
  it.each(['fast', 'medium', null, undefined, 'unknown', 42])(
    'recommendedSpeedLevel=%p falls back to standard, never guessed',
    async (badLevel) => {
      client.get.mockResolvedValueOnce({ data: evaluatedBody({ recommendedSpeedLevel: badLevel }) });
      const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
      expect(result.recommendedSpeedLevel).toBe('standard');
    }
  );
});

describe('Test 8 — status != evaluated -> standard', () => {
  it.each(['invalid_input', 'read_failed'])('status=%s falls back to standard', async (status) => {
    client.get.mockResolvedValueOnce({ data: { status, recommendedSpeedLevel: 'slow' } });
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommendedSpeedLevel).toBe('standard');
  });

  it('not_applicable (ambiguous letter) response is status=evaluated with reason=not_applicable and family=null — still passes recommendedSpeedLevel through since it is itself a valid "standard"', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ family: null, reason: 'not_applicable', signals: null, recommendedSpeedLevel: 'standard' }) });
    const result = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'a', caseType: 'lowercase' });
    expect(result.recommendedSpeedLevel).toBe('standard');
  });
});

describe('Test 9 — never throws', () => {
  it('a rejection with no message/status still resolves, never rejects', async () => {
    client.get.mockRejectedValueOnce(new Error());
    await expect(fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeDefined();
  });

  it('a timeout resolves safely', async () => {
    client.get.mockRejectedValueOnce(new Error('Request timed out. Please try again.'));
    await expect(fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' }))
      .resolves.toEqual({ letter: 'c', caseType: 'lowercase', recommendedSpeedLevel: 'standard' });
  });
});

describe('Test 10 — correct URL', () => {
  it('calls the DEMO_SPEED_RECOMMENDATION endpoint with exactly the given studentId/letter/caseType', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/demo-speed-recommendation/13/c/lowercase');
  });

  it('reflects the given letter/caseType in the URL for uppercase too', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ letter: 'C', caseType: 'uppercase' }) });
    await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'C', caseType: 'uppercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/demo-speed-recommendation/13/C/uppercase');
  });
});

describe('normalizeDemoSpeedRecommendationResponse() — pure', () => {
  it('never throws on any input shape', () => {
    expect(() => normalizeDemoSpeedRecommendationResponse(null)).not.toThrow();
    expect(() => normalizeDemoSpeedRecommendationResponse(undefined)).not.toThrow();
    expect(() => normalizeDemoSpeedRecommendationResponse(42)).not.toThrow();
    expect(() => normalizeDemoSpeedRecommendationResponse('x')).not.toThrow();
    expect(() => normalizeDemoSpeedRecommendationResponse([])).not.toThrow();
  });
});

// ─── Application-gate tests (spec item 48) ─────────────────────────────────

function gateArgs(overrides = {}) {
  return {
    responseLetter: 'c', responseCaseType: 'lowercase',
    currentLetter: 'c', currentCaseType: 'lowercase',
    currentAttempt: 1, hasDrawn: false, collectionMode: false, cancelled: false,
    ...overrides,
  };
}

describe('Test 11 — correct active letter + no draw -> apply', () => {
  it('accepts a matching, fresh, un-cancelled response at attempt 1 with no drawing yet', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs())).toBe(true);
  });
});

describe('Test 12 — stale letter -> reject', () => {
  it('rejects a response for a different letter than the one now on screen', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ responseLetter: 'o' }))).toBe(false);
  });
});

describe('Test 13 — stale case -> reject', () => {
  it('rejects a response for a different caseType than the one now on screen', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ responseCaseType: 'uppercase' }))).toBe(false);
  });
});

describe('Test 14 — cancelled -> reject', () => {
  it('rejects a response whose effect was already cleaned up', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ cancelled: true }))).toBe(false);
  });
});

describe('Test 15 — collection -> reject', () => {
  it('rejects any response while in collection mode, even a perfectly matching one', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ collectionMode: true }))).toBe(false);
  });
});

describe('Test 16 — child already drew -> reject', () => {
  it('rejects once hasDrawn is true for the current attempt', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ hasDrawn: true }))).toBe(false);
  });

  it('rejects once the child has moved past attempt 1', () => {
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ currentAttempt: 2 }))).toBe(false);
    expect(shouldApplyDemoSpeedRecommendation(gateArgs({ currentAttempt: 3 }))).toBe(false);
  });
});

describe('Test 17 — valid slow accepted', () => {
  it('the gate itself does not inspect the speed level at all — that is resolveRecommendedDemoSpeedLevel\'s job', () => {
    // shouldApplyDemoSpeedRecommendation only decides WHETHER to store a
    // response; it never receives or judges the speed level itself.
    expect(shouldApplyDemoSpeedRecommendation(gateArgs())).toBe(true);
  });
});

describe('Test 18 — invalid level normalized to standard', () => {
  it('resolveRecommendedDemoSpeedLevel falls back to standard for a malformed stored speedLevel', () => {
    const result = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: 'c', caseType: 'lowercase', speedLevel: 'turbo' },
      currentLetter: 'c', currentCaseType: 'lowercase',
    });
    expect(result).toBe('standard');
  });

  it('resolveRecommendedDemoSpeedLevel passes a valid stored slow through', () => {
    const result = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: 'c', caseType: 'lowercase', speedLevel: 'slow' },
      currentLetter: 'c', currentCaseType: 'lowercase',
    });
    expect(result).toBe('slow');
  });

  it('resolveRecommendedDemoSpeedLevel falls back to standard when the stored recommendation is for a different letter', () => {
    const result = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: 'c', caseType: 'lowercase', speedLevel: 'slow' },
      currentLetter: 'o', currentCaseType: 'lowercase',
    });
    expect(result).toBe('standard');
  });

  it('resolveRecommendedDemoSpeedLevel falls back to standard when the stored recommendation is for a different caseType', () => {
    const result = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: 'c', caseType: 'lowercase', speedLevel: 'slow' },
      currentLetter: 'c', currentCaseType: 'uppercase',
    });
    expect(result).toBe('standard');
  });

  it('resolveRecommendedDemoSpeedLevel falls back to standard for the initial default state ({letter: null, caseType: null})', () => {
    const result = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: null, caseType: null, speedLevel: null },
      currentLetter: 'c', currentCaseType: 'lowercase',
    });
    expect(result).toBe('standard');
  });

  it('resolveRecommendedDemoSpeedLevel never throws on a missing/undefined recommendation', () => {
    expect(() => resolveRecommendedDemoSpeedLevel({ currentLetter: 'c', currentCaseType: 'lowercase' })).not.toThrow();
    expect(resolveRecommendedDemoSpeedLevel({ currentLetter: 'c', currentCaseType: 'lowercase' })).toBe('standard');
  });
});
