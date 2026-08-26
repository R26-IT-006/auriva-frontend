/**
 * letterMotorState.js
 *
 * Feature 11B Phase 6 — fetch wrappers for the 3 read-only Phase 5 backend
 * endpoints (letter-motor-state/latest, letter-motor-state/history,
 * letter-motor-evidence-trend). Mirrors this project's established "thin,
 * impure fetch wrapper + pure normalization + never throws" contract.
 *
 * Also the single source of research-safe teacher-facing labels —
 * LETTER_MOTOR_PATTERN_LABELS, MILESTONE_LABELS and METRIC_LABELS — so
 * TeacherReportScreen.js never hardcodes a pattern/milestone/metric string
 * inline, and a label can never silently drift out of sync between the
 * current-pattern banner, the history list and the exported report.
 *
 * A pattern label is never translated to good/bad/high/low anywhere in this
 * file. Visible labels are derived from `state_code` only; the persisted
 * `display_name` is never surfaced (historical rows carry legacy values that
 * are intentionally left unmodified).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';
import { getLetterMotorPatternLabel } from './letterMotorPatternLabels';

// ─── Teacher-facing pattern labels ─────────────────────────────────────────
//
// THE SINGLE SOURCE of every visible A/B pattern label. Teacher-facing
// surfaces map from `state_code` through getLetterMotorPatternLabel() and
// must NEVER render the persisted `display_name`: historical rows legitimately
// contain legacy values ("Letter Motor State A"/"B") which are left untouched
// by design, so rendering them directly would show two different names for
// the same thing.
//
// Pattern A and Pattern B are nominal categories describing different
// observed handwriting-performance patterns. Neither represents
// better/worse, earlier/later, severity, development, progression, or a
// diagnostic category — never map a state_code to any such language here or
// anywhere downstream.

// Defined in letterMotorPatternLabels.js — a dependency-free module so the
// pure PDF builder can share the exact same mapping without importing any
// RN/api code. Re-exported here so existing callers keep one import site.
export {
  LETTER_MOTOR_PATTERN_LABELS,
  LETTER_MOTOR_PATTERN_FALLBACK,
  LETTER_MOTOR_PATTERN_CAPTION,
  getLetterMotorPatternLabel,
} from './letterMotorPatternLabels';

// ─── Milestone labels ──────────────────────────────────────────────────────
// Factual curriculum-coverage names only. They describe WHICH reference
// letters had been mastered when the observation was taken — never a stage
// the learner has reached, and never an implication that a later milestone
// is a better result than an earlier one.

export const MILESTONE_LABELS = Object.freeze({
  UPPERCASE_STRAIGHT_14: 'Uppercase Straight',
  UPPERCASE_CURVED_17:   'Uppercase Curved',
  FULL_REFERENCE_20:     'Full Reference',
});

// Size of the complete reference-letter set. Used ONLY as a presentation
// signal: at full coverage every milestone's required letters exist, so a
// still-missing pattern means one could not be assigned rather than that
// evidence is still being collected. Mirrors the backend's own 20-letter
// reference set (config/letterMotorReferenceLetters.js) — this constant
// never drives a milestone decision, which stays entirely server-side.
export const FULL_REFERENCE_COVERAGE = 20;

export function formatMilestoneLabel(milestone) {
  return MILESTONE_LABELS[milestone] ?? milestone ?? 'Unknown milestone';
}

// ─── Metric labels (spec §11) ───────────────────────────────────────────────
// Direction captions are informational only — never rendered as a
// red/green judgement, never compared across measurements automatically.

export const METRIC_LABELS = Object.freeze({
  smoothness: { label: 'Writing Smoothness',    caption: null },
  dtw:        { label: 'Trajectory Similarity', caption: 'Lower value = closer path match' },
  speedCv:    { label: 'Speed Consistency',     caption: 'Lower value = more consistent speed' },
});

const FAILSAFE_LATEST  = Object.freeze({ status: 'unavailable', state: null });
const FAILSAFE_HISTORY = Object.freeze({ status: 'unavailable', history: [] });
const FAILSAFE_TREND   = Object.freeze({ status: 'unavailable', coverageN: 0, meanSmoothness: null, meanDtw: null, meanSpeedCv: null });

function normalizeStateRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id:                row.id ?? null,
    milestone:         row.milestone ?? null,
    milestoneLabel:    formatMilestoneLabel(row.milestone),
    coverageN:         typeof row.coverage_n === 'number' ? row.coverage_n : null,
    observedAt:        row.observed_at ?? null,
    stateCode:         row.state_code ?? null,
    // Visible label derived from state_code ONLY. The persisted
    // display_name is deliberately not exposed here — see the header.
    patternLabel:      getLetterMotorPatternLabel(row.state_code),
    smoothnessScore:   typeof row.smoothness_score === 'number' ? row.smoothness_score : null,
    dtwDistance:       typeof row.dtw_distance === 'number' ? row.dtw_distance : null,
    speedCv:           typeof row.speed_cv === 'number' ? row.speed_cv : null,
    modelVersion:       row.model_version ?? null,
    // Kept for a technical-details panel only — never a headline
    // confidence/accuracy figure (spec §13).
    debug: {
      clusterId:             typeof row.cluster_id === 'number' ? row.cluster_id : null,
      nearestDistance:       typeof row.nearest_distance === 'number' ? row.nearest_distance : null,
      secondNearestDistance: typeof row.second_nearest_distance === 'number' ? row.second_nearest_distance : null,
      separationMargin:      typeof row.separation_margin === 'number' ? row.separation_margin : null,
    },
  };
}

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'found'|'not_found'|'unavailable', state: object|null}}
 */
export function normalizeLatestStateResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE_LATEST };
  if (data.status === 'not_found') return { status: 'not_found', state: null };
  if (data.status !== 'found') return { ...FAILSAFE_LATEST };
  const state = normalizeStateRow(data.result);
  return state ? { status: 'found', state } : { ...FAILSAFE_LATEST };
}

/**
 * @param {*} data
 * @returns {{status: 'found'|'unavailable', history: object[]}} — `found`
 *   with an EMPTY array is a legitimate, non-error state (no milestone
 *   reached yet), distinct from `unavailable` (a real fetch failure).
 */
export function normalizeStateHistoryResponse(data) {
  if (!data || typeof data !== 'object' || data.status !== 'found' || !Array.isArray(data.results)) {
    return { ...FAILSAFE_HISTORY };
  }
  return { status: 'found', history: data.results.map(normalizeStateRow).filter(Boolean) };
}

/**
 * @param {*} data
 * @returns {{status: 'found'|'unavailable', coverageN: number, meanSmoothness: number|null, meanDtw: number|null, meanSpeedCv: number|null}}
 */
export function normalizeEvidenceTrendResponse(data) {
  if (!data || typeof data !== 'object' || data.status !== 'found') return { ...FAILSAFE_TREND };
  return {
    status: 'found',
    coverageN:      typeof data.coverageN === 'number' ? data.coverageN : 0,
    meanSmoothness: typeof data.meanSmoothness === 'number' ? data.meanSmoothness : null,
    meanDtw:        typeof data.meanDtw === 'number' ? data.meanDtw : null,
    meanSpeedCv:    typeof data.meanSpeedCv === 'number' ? data.meanSpeedCv : null,
  };
}

/** @param {number|string} studentId */
export async function fetchLatestLetterMotorState(studentId) {
  try {
    const response = await client.get(ENDPOINTS.LETTER_MOTOR_STATE_LATEST(studentId));
    return normalizeLatestStateResponse(response?.data);
  } catch (err) {
    if (err?.response?.status === 404) return { status: 'not_found', state: null };
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[letterMotorState] latest fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE_LATEST };
  }
}

/** @param {number|string} studentId */
export async function fetchLetterMotorStateHistory(studentId) {
  try {
    const response = await client.get(ENDPOINTS.LETTER_MOTOR_STATE_HISTORY(studentId));
    return normalizeStateHistoryResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[letterMotorState] history fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE_HISTORY };
  }
}

// ─── S2 — milestone evaluation events ──────────────────────────────────────
//
// The four semantic states a teacher-facing surface must distinguish. Before
// S2 a reference-range rejection persisted nothing at all, so 'not_reached'
// and 'outside_reference_range' were indistinguishable and the screen had to
// guess from evidence coverage.
export const EVALUATION_NOT_REACHED = 'not_reached';
export const EVALUATION_ASSIGNED = 'assigned';
export const EVALUATION_OUTSIDE_REFERENCE_RANGE = 'outside_reference_range';
export const EVALUATION_UNAVAILABLE = 'unavailable';

const FAILSAFE_EVALUATIONS = Object.freeze({ status: 'unavailable', latest: null, results: [] });

/**
 * Normalizes GET /handwriting/letter-motor-evaluations/:studentId.
 * Never throws; an unrecognized shape degrades to 'unavailable' rather than
 * being reported as "no evaluation has happened".
 */
export function normalizeEvaluationsResponse(data) {
  if (!data || typeof data !== 'object' || data.status !== 'found' || !Array.isArray(data.results)) {
    return { ...FAILSAFE_EVALUATIONS };
  }
  return {
    status: 'found',
    latest: data.latest ?? null,
    results: data.results,
  };
}

/** @param {number|string} studentId */
export async function fetchLetterMotorEvaluations(studentId) {
  try {
    const response = await client.get(ENDPOINTS.LETTER_MOTOR_EVALUATIONS(studentId));
    return normalizeEvaluationsResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[letterMotorState] evaluations fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE_EVALUATIONS };
  }
}

/**
 * Resolves the single teacher-facing semantic state from the three
 * already-fetched reads. Pure — no I/O, no inference from missing values:
 * a pattern row means 'assigned', a persisted rejection means
 * 'outside_reference_range', and only a genuinely empty evaluation log
 * means 'not_reached'.
 *
 * @param {{status: string, state: Object|null}} latestState
 * @param {{status: string, latest: Object|null}} evaluations
 * @returns {'assigned'|'outside_reference_range'|'not_reached'|'unavailable'}
 */
export function resolveLetterMotorEvaluationStatus(latestState, evaluations) {
  if (latestState?.status === 'found' && latestState.state) return EVALUATION_ASSIGNED;
  if (latestState?.status === 'unavailable') return EVALUATION_UNAVAILABLE;
  if (evaluations?.status !== 'found') return EVALUATION_UNAVAILABLE;
  if (evaluations.latest?.evaluation_status === EVALUATION_OUTSIDE_REFERENCE_RANGE) {
    return EVALUATION_OUTSIDE_REFERENCE_RANGE;
  }
  return EVALUATION_NOT_REACHED;
}

/** @param {number|string} studentId */
export async function fetchLetterMotorEvidenceTrend(studentId) {
  try {
    const response = await client.get(ENDPOINTS.LETTER_MOTOR_EVIDENCE_TREND(studentId));
    return normalizeEvidenceTrendResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[letterMotorState] trend fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE_TREND };
  }
}
