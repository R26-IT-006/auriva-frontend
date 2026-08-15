// Feature 8 Step 4 — TESTS: fetch utility (spec item 39) + UI helpers
// (spec item 40/41). `client` is mocked so these tests never hit a real
// network. Mirrors utils/demoSpeedRecommendation.test.js's exact convention.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchWorksheetRecommendations,
  normalizeWorksheetRecommendationsResponse,
  formatCaseType,
  shouldShowFocusLetters,
  getWorksheetRecommendationEmptyState,
} from './worksheetRecommendations';

beforeEach(() => {
  jest.clearAllMocks();
});

function recommendation(overrides = {}) {
  return {
    recommendationType: 'motor_family_practice',
    caseType: 'lowercase', family: 'curved',
    title: 'Curved Movement Practice',
    focusLetters: ['c', 'o'],
    rationale: 'Curved movement practice is recommended because difficulty remained across two separate practice periods.',
    suggestedActivities: ['Circle tracing exercises', 'Half-circle tracing with visual guides', 'Slow curved-stroke repetition', 'Guided tracing of focus letters', 'Independent writing of focus letters'],
    // Feature 9 Step 5 — matches a real backend response shape now that
    // worksheetRecommendationService.js adds this field (used as both the
    // mocked raw server response AND the expected normalized output below,
    // since normalizeRecommendation() passes a well-formed fingerprint
    // through unchanged).
    recommendationFingerprint: 'a'.repeat(64),
    ...overrides,
  };
}

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated', studentId: 13, evaluatedAt: '2026-08-14T00:00:00.000Z',
    recommendations: [],
    summary: { evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 0, insufficientDataCount: 6, recommendationCount: 0 },
    ...overrides,
  };
}

// ─── Test 1 — evaluated + one recommendation ───────────────────────────────

describe('Test 1 — evaluated + one recommendation', () => {
  it('passes the recommendation through with all fields intact', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation()],
      summary: { evaluatedStreamCount: 6, persistentStreamCount: 1, notPersistentCount: 0, insufficientDataCount: 5, recommendationCount: 1 },
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.status).toBe('evaluated');
    expect(result.recommendations).toEqual([recommendation()]);
    expect(result.summary.recommendationCount).toBe(1);
  });
});

// ─── Test 2 — evaluated + empty ────────────────────────────────────────────

describe('Test 2 — evaluated + empty', () => {
  it('resolves with an empty recommendations array and a populated summary', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.status).toBe('evaluated');
    expect(result.recommendations).toEqual([]);
    expect(result.summary.insufficientDataCount).toBe(6);
  });
});

// ─── Test 3 — read_failed ───────────────────────────────────────────────────

describe('Test 3 — read_failed', () => {
  it('backend read_failed status resolves to status=read_failed, recommendations=[], summary=null', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'read_failed', studentId: 13, evaluatedAt: null, recommendations: null, summary: null } });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result).toEqual({ status: 'read_failed', recommendations: [], summary: null });
  });
});

// ─── Test 4 — invalid_input ─────────────────────────────────────────────────

describe('Test 4 — invalid_input', () => {
  it('backend invalid_input status resolves to status=invalid_input, recommendations=[], summary=null', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'invalid_input', studentId: null, evaluatedAt: null, recommendations: null, summary: null } });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result).toEqual({ status: 'invalid_input', recommendations: [], summary: null });
  });
});

// ─── Test 5 — network error ────────────────────────────────────────────────

describe('Test 5 — network error / 404 / 500 / timeout', () => {
  it.each([
    ['network error', new Error('Network error. Check your connection.')],
    ['404', Object.assign(new Error('Not Found'), { status: 404 })],
    ['500', Object.assign(new Error('Failed to evaluate worksheet recommendations'), { status: 500 })],
    ['timeout', new Error('Request timed out. Please try again.')],
  ])('%s resolves safely to read_failed, never throws', async (_label, err) => {
    client.get.mockRejectedValueOnce(err);
    await expect(fetchWorksheetRecommendations({ studentId: 13 })).resolves.toEqual({ status: 'read_failed', recommendations: [], summary: null });
  });
});

// ─── Test 6 — malformed response ───────────────────────────────────────────

describe('Test 6 — malformed response', () => {
  it('null response body fails safe to read_failed, never throws', async () => {
    client.get.mockResolvedValueOnce({ data: null });
    await expect(fetchWorksheetRecommendations({ studentId: 13 })).resolves.toEqual({ status: 'read_failed', recommendations: [], summary: null });
  });

  it('an unrecognized status value fails safe', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'something_else' } });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.status).toBe('read_failed');
  });

  it('recommendations that is not an array resolves to []', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ recommendations: 'not-an-array' }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations).toEqual([]);
  });

  it('a malformed individual recommendation entry is dropped, valid ones kept', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ recommendations: [null, 'garbage', recommendation(), 42] }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations).toEqual([recommendation()]);
  });

  it('a recommendation with malformed focusLetters/suggestedActivities defaults to empty arrays, never throws', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ focusLetters: 'c,o', suggestedActivities: null })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].focusLetters).toEqual([]);
    expect(result.recommendations[0].suggestedActivities).toEqual([]);
  });

  it('a missing summary resolves to summary=null, never a guessed object', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ summary: undefined }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.summary).toBeNull();
  });
});

// ─── Test 7 — uppercase preservation ───────────────────────────────────────

describe('Test 7 — uppercase preservation', () => {
  it('["C", "O"] stays exactly ["C", "O"]', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ caseType: 'uppercase', focusLetters: ['C', 'O'] })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].focusLetters).toEqual(['C', 'O']);
    expect(result.recommendations[0].caseType).toBe('uppercase');
  });
});

// ─── Test 8 — focus-letter order preservation ──────────────────────────────

describe('Test 8 — focus-letter order preservation', () => {
  it('never re-sorts a deliberately non-alphabetical order', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ focusLetters: ['x', 's', 'a'] })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].focusLetters).toEqual(['x', 's', 'a']);
  });
});

// ─── Test 9 — suggestedActivities preserved ────────────────────────────────

describe('Test 9 — suggestedActivities preserved', () => {
  it('passes through the exact activity list and order, never trimmed/reordered', async () => {
    const activities = ['Zigzag tracing', 'Direction-change pattern tracing', 'Combined-stroke tracing', 'Guided tracing of focus letters', 'Independent writing of focus letters'];
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ family: 'complex', title: 'Complex Movement Practice', suggestedActivities: activities })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].suggestedActivities).toEqual(activities);
  });
});

// ─── Test 10 — no raw diagnostics expected ─────────────────────────────────

describe('Test 10 — no raw diagnostics expected', () => {
  it('normalizeRecommendation never surfaces separationMs/windowSize/validCycleCount even if the backend somehow sent them', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [{ ...recommendation(), separationMs: 172800000, windowSize: 5, validCycleCount: 10 }],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0]).not.toHaveProperty('separationMs');
    expect(result.recommendations[0]).not.toHaveProperty('windowSize');
    expect(result.recommendations[0]).not.toHaveProperty('validCycleCount');
    expect(Object.keys(result.recommendations[0]).sort()).toEqual(
      ['recommendationType', 'caseType', 'family', 'title', 'focusLetters', 'rationale', 'suggestedActivities', 'recommendationFingerprint'].sort()
    );
  });

  it('calls the WORKSHEET_RECOMMENDATIONS endpoint with exactly the given studentId', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await fetchWorksheetRecommendations({ studentId: 13 });
    expect(client.get).toHaveBeenCalledWith('/handwriting/worksheet-recommendations/13');
  });
});

describe('normalizeWorksheetRecommendationsResponse() — pure', () => {
  it('never throws on any input shape', () => {
    expect(() => normalizeWorksheetRecommendationsResponse(null)).not.toThrow();
    expect(() => normalizeWorksheetRecommendationsResponse(undefined)).not.toThrow();
    expect(() => normalizeWorksheetRecommendationsResponse(42)).not.toThrow();
    expect(() => normalizeWorksheetRecommendationsResponse('x')).not.toThrow();
    expect(() => normalizeWorksheetRecommendationsResponse([])).not.toThrow();
  });
});

// ─── UI helper tests (spec item 40) ────────────────────────────────────────

describe('formatCaseType', () => {
  it('lowercase -> "Lowercase"', () => {
    expect(formatCaseType('lowercase')).toBe('Lowercase');
  });
  it('uppercase -> "Uppercase"', () => {
    expect(formatCaseType('uppercase')).toBe('Uppercase');
  });
  it.each([null, undefined, '', 'LOWERCASE', 'mixed', 42])('%p -> "" (never a guessed label)', (bad) => {
    expect(formatCaseType(bad)).toBe('');
  });
});

describe('shouldShowFocusLetters', () => {
  it('a non-empty array -> true', () => {
    expect(shouldShowFocusLetters(['c', 'o'])).toBe(true);
  });
  it.each([[], null, undefined, 'c,o', 42])('%p -> false', (bad) => {
    expect(shouldShowFocusLetters(bad)).toBe(false);
  });
});

describe('getWorksheetRecommendationEmptyState', () => {
  it('6 insufficient -> the "more practice history" message (spec §41 example 1)', () => {
    const msg = getWorksheetRecommendationEmptyState({ evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 0, insufficientDataCount: 6, recommendationCount: 0 });
    expect(msg).toBe('More practice history is needed before an adaptive practice recommendation can be generated.');
  });

  it('0 insufficient + some notPersistent -> the "no persistent difficulty" message (spec §41 example 2)', () => {
    const msg = getWorksheetRecommendationEmptyState({ evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 3, insufficientDataCount: 0, recommendationCount: 0 });
    expect(msg).toBe('No persistent handwriting difficulty currently requires an additional practice recommendation.');
  });

  it('mixed insufficient + notPersistent -> prefers the more conservative "more practice history" message', () => {
    const msg = getWorksheetRecommendationEmptyState({ evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 2, insufficientDataCount: 4, recommendationCount: 0 });
    expect(msg).toBe('More practice history is needed before an adaptive practice recommendation can be generated.');
  });

  it('a missing/malformed summary -> the generic fallback message, never throws', () => {
    expect(() => getWorksheetRecommendationEmptyState(null)).not.toThrow();
    expect(getWorksheetRecommendationEmptyState(null)).toBe('No additional adaptive practice recommendation is available at this time.');
    expect(getWorksheetRecommendationEmptyState(undefined)).toBe('No additional adaptive practice recommendation is available at this time.');
  });

  it('never mentions the 24-hour rule, algorithm, severity, or window mechanics', () => {
    for (const summary of [
      { insufficientDataCount: 6 }, { notPersistentCount: 3 }, null,
    ]) {
      const msg = getWorksheetRecommendationEmptyState(summary);
      expect(msg).not.toMatch(/24.hour|window|algorithm|severity|threshold/i);
    }
  });
});
