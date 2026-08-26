import {
  normalizeLatestStateResponse, normalizeStateHistoryResponse, normalizeEvidenceTrendResponse,
  formatMilestoneLabel, MILESTONE_LABELS, METRIC_LABELS,
} from './letterMotorState';

jest.mock('../api/client', () => ({ get: jest.fn() }));
import client from '../api/client';
import { fetchLatestLetterMotorState, fetchLetterMotorStateHistory, fetchLetterMotorEvidenceTrend } from './letterMotorState';

function stateRow(overrides = {}) {
  return {
    id: 1, milestone: 'UPPERCASE_STRAIGHT_14', coverage_n: 14, observed_at: '2026-08-20T10:00:00.000Z',
    cluster_id: 1, state_code: 'LETTER_STATE_B', display_name: 'Letter Motor State B',
    smoothness_score: 72.5, dtw_distance: 12.1, speed_cv: 0.28,
    nearest_distance: 0.4, second_nearest_distance: 1.8, separation_margin: 1.4,
    model_version: 'letter_motor_cluster_v1',
    ...overrides,
  };
}

describe('research-safe labels', () => {
  it('MILESTONE_LABELS covers exactly the 3 known milestones with teacher-friendly names', () => {
    expect(MILESTONE_LABELS).toEqual({
      UPPERCASE_STRAIGHT_14: 'Uppercase Straight',
      UPPERCASE_CURVED_17:   'Uppercase Curved',
      FULL_REFERENCE_20:     'Full Reference',
    });
  });

  it('formatMilestoneLabel falls back gracefully for an unknown code', () => {
    expect(formatMilestoneLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(formatMilestoneLabel(null)).toBe('Unknown milestone');
  });

  it('METRIC_LABELS never uses good/bad/high/low language, and captions direction only for dtw/speedCv', () => {
    expect(METRIC_LABELS.smoothness.label).toBe('Writing Smoothness');
    expect(METRIC_LABELS.dtw.label).toBe('Trajectory Similarity');
    expect(METRIC_LABELS.speedCv.label).toBe('Speed Consistency');
    expect(METRIC_LABELS.dtw.caption).toMatch(/lower/i);
    expect(METRIC_LABELS.speedCv.caption).toMatch(/lower/i);
    for (const key of Object.keys(METRIC_LABELS)) {
      const text = JSON.stringify(METRIC_LABELS[key]).toLowerCase();
      expect(text).not.toMatch(/\b(good|bad|high|low ability|strong|weak|impaired|normal)\b/);
    }
  });
});

describe('normalizeLatestStateResponse', () => {
  it('returns found + fully normalized state, with the visible label derived from state_code', () => {
    const result = normalizeLatestStateResponse({ status: 'found', result: stateRow() });
    expect(result.status).toBe('found');
    expect(result.state.stateCode).toBe('LETTER_STATE_B');
    // Visible label comes from state_code, never the persisted display_name.
    expect(result.state.patternLabel).toBe('Letter Motor Pattern B');
    expect(result.state.displayName).toBeUndefined();
    expect(result.state.milestoneLabel).toBe('Uppercase Straight');
    expect(result.state.coverageN).toBe(14);
    expect(result.state.smoothnessScore).toBe(72.5);
    expect(result.state.dtwDistance).toBe(12.1);
    expect(result.state.speedCv).toBe(0.28);
    expect(result.state.debug.clusterId).toBe(1);
  });

  it('returns not_found (a legitimate "no state yet" state), never confused with unavailable', () => {
    expect(normalizeLatestStateResponse({ status: 'not_found', result: null })).toEqual({ status: 'not_found', state: null });
  });

  it('returns unavailable for malformed/missing data, never throws', () => {
    expect(normalizeLatestStateResponse(undefined)).toEqual({ status: 'unavailable', state: null });
    expect(normalizeLatestStateResponse({ status: 'found', result: null })).toEqual({ status: 'unavailable', state: null });
  });
});

describe('normalizeStateHistoryResponse', () => {
  it('returns found + normalized rows in the order the backend sent them (already chronological server-side)', () => {
    const result = normalizeStateHistoryResponse({
      status: 'found',
      results: [stateRow({ milestone: 'UPPERCASE_STRAIGHT_14', coverage_n: 14 }), stateRow({ milestone: 'UPPERCASE_CURVED_17', coverage_n: 17 })],
    });
    expect(result.status).toBe('found');
    expect(result.history.map(h => h.milestone)).toEqual(['UPPERCASE_STRAIGHT_14', 'UPPERCASE_CURVED_17']);
  });

  it('an empty history array is `found` with [] — a legitimate state, not an error', () => {
    expect(normalizeStateHistoryResponse({ status: 'found', results: [] })).toEqual({ status: 'found', history: [] });
  });

  it('returns unavailable for malformed data', () => {
    expect(normalizeStateHistoryResponse(undefined)).toEqual({ status: 'unavailable', history: [] });
    expect(normalizeStateHistoryResponse({ status: 'found', results: 'nope' })).toEqual({ status: 'unavailable', history: [] });
  });
});

describe('normalizeEvidenceTrendResponse', () => {
  it('returns found + the descriptive means, coverage as a count not a percent/confidence', () => {
    const result = normalizeEvidenceTrendResponse({ status: 'found', coverageN: 7, meanSmoothness: 65, meanDtw: 14, meanSpeedCv: 0.3 });
    expect(result).toEqual({ status: 'found', coverageN: 7, meanSmoothness: 65, meanDtw: 14, meanSpeedCv: 0.3 });
  });

  it('returns unavailable for malformed data', () => {
    expect(normalizeEvidenceTrendResponse(undefined)).toEqual({ status: 'unavailable', coverageN: 0, meanSmoothness: null, meanDtw: null, meanSpeedCv: null });
  });
});

describe('fetch wrappers never throw', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetchLatestLetterMotorState: 404 -> not_found', async () => {
    const err = new Error('Not Found'); err.response = { status: 404 };
    client.get.mockRejectedValueOnce(err);
    expect(await fetchLatestLetterMotorState(9)).toEqual({ status: 'not_found', state: null });
  });

  it('fetchLatestLetterMotorState: network failure -> unavailable', async () => {
    client.get.mockRejectedValueOnce(new Error('down'));
    const result = await fetchLatestLetterMotorState(9);
    expect(result.status).toBe('unavailable');
  });

  it('fetchLetterMotorStateHistory: success -> found', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'found', results: [stateRow()] } });
    const result = await fetchLetterMotorStateHistory(9);
    expect(result.status).toBe('found');
    expect(result.history.length).toBe(1);
  });

  it('fetchLetterMotorStateHistory: failure -> unavailable, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('down'));
    const result = await fetchLetterMotorStateHistory(9);
    expect(result).toEqual({ status: 'unavailable', history: [] });
  });

  it('fetchLetterMotorEvidenceTrend: success -> found', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'found', coverageN: 10, meanSmoothness: 60, meanDtw: 15, meanSpeedCv: 0.25 } });
    const result = await fetchLetterMotorEvidenceTrend(9);
    expect(result.status).toBe('found');
    expect(result.coverageN).toBe(10);
  });

  it('fetchLetterMotorEvidenceTrend: failure -> unavailable, never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('down'));
    const result = await fetchLetterMotorEvidenceTrend(9);
    expect(result.status).toBe('unavailable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S2 — milestone evaluation events
// ═══════════════════════════════════════════════════════════════════════════

describe('S2 — fetchLetterMotorEvaluations / resolveLetterMotorEvaluationStatus', () => {
  const {
    fetchLetterMotorEvaluations, normalizeEvaluationsResponse, resolveLetterMotorEvaluationStatus,
  } = require('./letterMotorState');

  it('normalizes a found response', () => {
    const r = normalizeEvaluationsResponse({
      status: 'found',
      results: [{ id: 1, evaluation_status: 'outside_reference_range' }],
      latest: { id: 1, evaluation_status: 'outside_reference_range' },
    });
    expect(r.status).toBe('found');
    expect(r.results).toHaveLength(1);
    expect(r.latest.evaluation_status).toBe('outside_reference_range');
  });

  it('an unrecognized shape degrades to unavailable, never to "nothing has happened"', () => {
    for (const bad of [null, undefined, {}, { status: 'found' }, { status: 'nope', results: [] }]) {
      expect(normalizeEvaluationsResponse(bad).status).toBe('unavailable');
    }
  });

  it('a failed fetch resolves to unavailable and never throws', async () => {
    client.get.mockRejectedValueOnce(new Error('network down'));
    await expect(fetchLetterMotorEvaluations(9)).resolves.toEqual({
      status: 'unavailable', latest: null, results: [],
    });
  });

  it('resolves assigned when a pattern state exists', () => {
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'found', state: { patternLabel: 'Letter Motor Pattern A' } },
      { status: 'found', latest: null },
    )).toBe('assigned');
  });

  it('resolves outside_reference_range from the persisted evaluation, not from coverage', () => {
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'not_found', state: null },
      { status: 'found', latest: { evaluation_status: 'outside_reference_range' } },
    )).toBe('outside_reference_range');
  });

  it('resolves not_reached only when the evaluation log is genuinely empty', () => {
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'not_found', state: null },
      { status: 'found', latest: null },
    )).toBe('not_reached');
  });

  it('resolves unavailable when either read failed — never silently not_reached', () => {
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'unavailable', state: null }, { status: 'found', latest: null },
    )).toBe('unavailable');
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'not_found', state: null }, { status: 'unavailable', latest: null },
    )).toBe('unavailable');
  });

  it('an assigned pattern wins even if the evaluation log is unreadable', () => {
    expect(resolveLetterMotorEvaluationStatus(
      { status: 'found', state: { patternLabel: 'Letter Motor Pattern B' } },
      { status: 'unavailable', latest: null },
    )).toBe('assigned');
  });
});
