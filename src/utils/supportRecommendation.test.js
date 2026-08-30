// Feature 3 Step 6 — tests for fetchRecommendedStartSupport(), the one
// impure (network-calling) piece of the adaptive-support activation. `client`
// is mocked so these tests never hit a real network; every failure mode
// (network error, non-2xx, malformed body) is exercised explicitly to prove
// the "never throws, always resolves to a safe value" contract (spec §20/§21).
jest.mock('../api/client', () => ({
  get: jest.fn(),
}));

import client from '../api/client';
import { fetchRecommendedStartSupport } from './supportRecommendation';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchRecommendedStartSupport — success cases', () => {
  it('returns "high" when the backend recommends high', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'high', decision: 'recommend_high' } });
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBe('high');
  });

  it('returns "medium" when the backend recommends medium', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'medium', decision: 'recommend_medium' } });
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBe('medium');
  });

  it('returns "low" when the backend recommends low', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'low', decision: 'recommend_low' } });
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBe('low');
  });

  it('returns "high" for support_review (the maximum available support, per spec §10)', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'high', decision: 'support_review', requiresReview: true } });
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBe('high');
  });

  it('calls the endpoint with exactly the given studentId/letter/caseType', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'low' } });
    await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/support-recommendation/13/c/lowercase');
  });
});

describe('fetchRecommendedStartSupport — null-producing decisions never propagate a level', () => {
  it.each(['insufficient_data', 'insufficient_target', 'not_applicable', 'read_failed'])(
    'returns null when the backend response has no recommendedSupport (decision=%s)',
    async (decision) => {
      client.get.mockResolvedValueOnce({ data: { recommendedSupport: null, decision } });
      const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
      expect(result).toBeNull();
    }
  );

  it('returns null for a malformed recommendedSupport value (defensive — never trusts the response blindly)', async () => {
    client.get.mockResolvedValueOnce({ data: { recommendedSupport: 'EXTREME' } });
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBeNull();
  });

  it('returns null when the response body is missing entirely', async () => {
    client.get.mockResolvedValueOnce({});
    const result = await fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(result).toBeNull();
  });
});

describe('fetchRecommendedStartSupport — failure modes never throw, always fall back to null', () => {
  it('a network error resolves to null, never rejects', async () => {
    client.get.mockRejectedValueOnce(new Error('Network error. Check your connection.'));
    await expect(fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeNull();
  });

  it('a 500 response resolves to null, never rejects', async () => {
    const err = new Error('Request failed with status 500');
    err.status = 500;
    client.get.mockRejectedValueOnce(err);
    await expect(fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeNull();
  });

  it('a 404 (older backend / rollout mismatch, spec §21) resolves to null, never rejects', async () => {
    const err = new Error('Request failed with status 404');
    err.status = 404;
    client.get.mockRejectedValueOnce(err);
    await expect(fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeNull();
  });

  it('a request timeout resolves to null, never rejects', async () => {
    client.get.mockRejectedValueOnce(new Error('Request timed out. Please try again.'));
    await expect(fetchRecommendedStartSupport({ studentId: 13, letter: 'c', caseType: 'lowercase' })).resolves.toBeNull();
  });
});
