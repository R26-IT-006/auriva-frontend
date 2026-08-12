// Feature 4 Step 5 — fetchPreWritingRecommendation() / normalization tests.
// Mirrors utils/supportRecommendation.test.js's exact convention for
// mocking `client` and proving the never-throw / fail-safe contract.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchPreWritingRecommendation,
  normalizePreWritingRecommendationResponse,
} from './preWritingRecommendation';

beforeEach(() => {
  jest.clearAllMocks();
});

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated',
    studentId: 13, letter: 'c', caseType: 'lowercase',
    family: 'curved', primitiveGroup: 'curved',
    recommended: true, activityId: 'connect_curve_dots', reason: 'feature3_support_review',
    signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    ...overrides,
  };
}

// ─── Test 17 — recommended true + valid activity ───────────────────────────

describe('Test 17 — recommended true + valid activity', () => {
  it('passes activityId/letter/caseType through when the shape is complete', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toEqual({
      recommended: true, activityId: 'connect_curve_dots', letter: 'c', caseType: 'lowercase',
      family: 'curved', primitiveGroup: 'curved', reason: 'feature3_support_review',
    });
  });
});

// ─── Test 18 — recommended false ────────────────────────────────────────────

describe('Test 18 — recommended false', () => {
  it('a clean not-recommended response resolves with activityId=null', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommended: false, activityId: null, reason: 'insufficient_data',
      signals: { feature2Decision: 'insufficient_data', feature3Decision: 'insufficient_data' },
    }) });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
    expect(result.activityId).toBeNull();
    expect(result.reason).toBe('insufficient_data');
  });
});

// ─── Test 19 — malformed response ───────────────────────────────────────────

describe('Test 19 — malformed response', () => {
  it('recommended=true but missing activityId fails safe to not-recommended', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ activityId: null }) });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
    expect(result.activityId).toBeNull();
  });

  it('recommended=true but missing letter fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ letter: undefined }) });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });

  it('recommended=true but invalid caseType fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ caseType: 'sideways' }) });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });

  it('status !== "evaluated" (e.g. an older/different response shape) fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'something_else', recommended: true, activityId: 'x' } });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });

  it('completely empty/null response body fails safe, never throws', async () => {
    client.get.mockResolvedValueOnce({ data: null });
    await expect(fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toEqual({
      recommended: false, activityId: null, letter: null, caseType: null, family: null, primitiveGroup: null, reason: null,
    });
  });

  it('a response with no data field at all fails safe', async () => {
    client.get.mockResolvedValueOnce({});
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });
});

// ─── Test 20 — network error ────────────────────────────────────────────────

describe('Test 20 — network error', () => {
  it('a rejected network error resolves safely to recommended=false, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('Network error. Check your connection.'));
    await expect(fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toEqual({
      recommended: false, activityId: null, letter: null, caseType: null, family: null, primitiveGroup: null, reason: null,
    });
  });
});

// ─── Test 21 — 404 ───────────────────────────────────────────────────────────

describe('Test 21 — 404 (older backend / rollout mismatch)', () => {
  it('resolves safely to recommended=false', async () => {
    const err = new Error('Not Found');
    err.status = 404;
    client.get.mockRejectedValueOnce(err);
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });
});

// ─── Test 22 — 500 ───────────────────────────────────────────────────────────

describe('Test 22 — 500 (e.g. Step 4 read_failed surfaced as a real server error)', () => {
  it('resolves safely to recommended=false', async () => {
    const err = new Error('Failed to evaluate pre-writing recommendation');
    err.status = 500;
    client.get.mockRejectedValueOnce(err);
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.recommended).toBe(false);
  });
});

// ─── Test 23 — no throw, ever ───────────────────────────────────────────────

describe('Test 23 — never throws under any failure mode', () => {
  it.each([
    ['network error', () => client.get.mockRejectedValueOnce(new Error('Network error'))],
    ['timeout', () => client.get.mockRejectedValueOnce(new Error('Request timed out. Please try again.'))],
    ['malformed body', () => client.get.mockResolvedValueOnce({ data: { status: 'evaluated', recommended: 'yes' } })],
    ['non-object body', () => client.get.mockResolvedValueOnce({ data: 'oops' })],
  ])('%s never propagates a rejection', async (_label, setup) => {
    setup();
    await expect(fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.not.toThrow?.();
    await expect(fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeDefined();
  });
});

// ─── Test 24 — activityId preserved ─────────────────────────────────────────

describe('Test 24 — activityId is preserved exactly when recommended', () => {
  it.each(['connect_curve_dots', 'trace_diagonal_forward', 'connect_vertical_dots'])(
    'preserves activityId=%s verbatim',
    async (activityId) => {
      client.get.mockResolvedValueOnce({ data: evaluatedBody({ activityId }) });
      const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
      expect(result.activityId).toBe(activityId);
    }
  );
});

// ─── Test 25 — reason preserved ─────────────────────────────────────────────

describe('Test 25 — reason is preserved exactly', () => {
  it.each([
    'feature2_support_review', 'feature3_support_review', 'insufficient_data',
    'insufficient_target', 'not_applicable', 'no_activity_available', 'no_persistent_difficulty',
  ])('preserves reason=%s verbatim', async (reason) => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommended: false, activityId: null, reason,
    }) });
    const result = await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.reason).toBe(reason);
  });
});

// ─── normalizePreWritingRecommendationResponse() — pure, direct tests ──────

describe('normalizePreWritingRecommendationResponse() — pure', () => {
  it('null/undefined input fails safe', () => {
    expect(normalizePreWritingRecommendationResponse(null).recommended).toBe(false);
    expect(normalizePreWritingRecommendationResponse(undefined).recommended).toBe(false);
  });

  it('never throws on any input shape', () => {
    expect(() => normalizePreWritingRecommendationResponse(42)).not.toThrow();
    expect(() => normalizePreWritingRecommendationResponse('x')).not.toThrow();
    expect(() => normalizePreWritingRecommendationResponse([])).not.toThrow();
  });
});

// ─── Endpoint call shape ─────────────────────────────────────────────────────

describe('fetchPreWritingRecommendation() request shape', () => {
  it('calls the PRE_WRITING_RECOMMENDATION endpoint with studentId/letter/caseType', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await fetchPreWritingRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/pre-writing-recommendation/13/c/lowercase');
  });
});
