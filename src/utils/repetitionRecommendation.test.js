// Feature 5 Step 3 — fetchRepetitionRecommendation() / normalization tests.
// Mirrors utils/preWritingRecommendation.test.js's exact convention.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchRepetitionRecommendation,
  normalizeRepetitionRecommendationResponse,
} from './repetitionRecommendation';

beforeEach(() => {
  jest.clearAllMocks();
});

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated',
    studentId: 13, letter: 'c', caseType: 'lowercase',
    family: 'curved', shouldRepeat: true, reason: 'feature3_support_review',
    signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    policy: { maxAdaptiveRepetitionsPerInteraction: 1, adaptiveRepetitionsUsed: 0, remainingAdaptiveRepetitions: 1 },
    history: { totalCycles: 1, cleanCycles: 1, malformedCycles: 0 },
    ...overrides,
  };
}

describe('recommended (shouldRepeat) true + valid shape', () => {
  it('passes letter/caseType/family/reason through when the shape is complete', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toEqual({
      shouldRepeat: true, letter: 'c', caseType: 'lowercase', family: 'curved', reason: 'feature3_support_review',
    });
  });
});

describe('shouldRepeat false', () => {
  it('a clean not-repeating response resolves cleanly', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'insufficient_data' }) });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.shouldRepeat).toBe(false);
    expect(result.reason).toBe('insufficient_data');
  });
});

describe('malformed response', () => {
  it('shouldRepeat=true but missing letter fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ letter: undefined }) });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.shouldRepeat).toBe(false);
  });

  it('shouldRepeat=true but invalid caseType fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ caseType: 'sideways' }) });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.shouldRepeat).toBe(false);
  });

  it('status !== "evaluated" fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'read_failed', shouldRepeat: true, letter: 'c', caseType: 'lowercase' } });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.shouldRepeat).toBe(false);
  });

  it('null/undefined response body fails safe, never throws', async () => {
    client.get.mockResolvedValueOnce({ data: null });
    await expect(fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toEqual({
      shouldRepeat: false, letter: null, caseType: null, family: null, reason: null,
    });
  });
});

describe('network error / 404 / 500 / timeout', () => {
  it.each([
    ['network error', new Error('Network error. Check your connection.')],
    ['404', Object.assign(new Error('Not Found'), { status: 404 })],
    ['500', Object.assign(new Error('Failed to evaluate repetition recommendation'), { status: 500 })],
    ['timeout', new Error('Request timed out. Please try again.')],
  ])('%s resolves safely to shouldRepeat=false, never throws', async (_label, err) => {
    client.get.mockRejectedValueOnce(err);
    await expect(fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toEqual({
      shouldRepeat: false, letter: null, caseType: null, family: null, reason: null,
    });
  });
});

describe('reason preserved', () => {
  it.each([
    'feature2_support_review', 'feature3_support_review', 'no_persistent_difficulty',
    'insufficient_data', 'insufficient_target', 'not_applicable', 'cap_reached',
  ])('preserves reason=%s verbatim', async (reason) => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason }) });
    const result = await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result.reason).toBe(reason);
  });
});

describe('normalizeRepetitionRecommendationResponse() — pure', () => {
  it('never throws on any input shape', () => {
    expect(() => normalizeRepetitionRecommendationResponse(null)).not.toThrow();
    expect(() => normalizeRepetitionRecommendationResponse(42)).not.toThrow();
    expect(() => normalizeRepetitionRecommendationResponse('x')).not.toThrow();
  });
});

describe('request shape', () => {
  it('calls the REPETITION_RECOMMENDATION endpoint with studentId/letter/caseType/adaptiveRepetitionsUsed', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase', adaptiveRepetitionsUsed: 1 });
    expect(client.get).toHaveBeenCalledWith('/handwriting/repetition-recommendation/13/c/lowercase?adaptiveRepetitionsUsed=1');
  });

  it('defaults adaptiveRepetitionsUsed to 0 when omitted', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await fetchRepetitionRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/repetition-recommendation/13/c/lowercase?adaptiveRepetitionsUsed=0');
  });
});
