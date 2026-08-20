/**
 * letterMotorState.js
 *
 * Feature 11B Phase 6 — fetch wrappers for the 3 read-only Phase 5 backend
 * endpoints (letter-motor-state/latest, letter-motor-state/history,
 * letter-motor-evidence-trend). Mirrors this project's established "thin,
 * impure fetch wrapper + pure normalization + never throws" contract.
 *
 * Also the single source of research-safe teacher-facing labels (spec
 * §6/§9/§10/§11/§12) — MILESTONE_LABELS and METRIC_LABELS — so
 * TeacherReportScreen.js never hardcodes a milestone/metric string inline,
 * and a label can never silently drift out of sync between the coverage
 * card and the history list.
 *
 * State A/B is never translated to good/bad/high/low anywhere in this
 * file — the backend's own state_code/display_name pass through verbatim.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

// ─── Research-safe labels (spec §6/§9/§10) ─────────────────────────────────
// State A and State B represent different observed handwriting-performance
// patterns in the pilot model, NOT a ranked severity scale — never map
// state_code to good/bad/high/low here or anywhere downstream.

export const MILESTONE_LABELS = Object.freeze({
  UPPERCASE_STRAIGHT_14: 'Uppercase Straight',
  UPPERCASE_CURVED_17:   'Uppercase Curved',
  FULL_REFERENCE_20:     'Full Reference',
});

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
    displayName:       typeof row.display_name === 'string' ? row.display_name : (row.state_code ?? 'Unknown state'),
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
