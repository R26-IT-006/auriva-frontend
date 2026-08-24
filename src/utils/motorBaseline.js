/**
 * motorBaseline.js
 *
 * Initial Motor Assessment scoring/consistency fix — fetch wrapper for
 * Feature 1's persisted baseline (GET /handwriting/motor-baseline/:studentId).
 * Mirrors this project's established "thin, impure fetch wrapper + pure
 * normalization + never throws" contract (see familyThresholds.js,
 * supportRecommendation.js).
 *
 * Used by LetterHomeScreen.js's "Assessment Summary" modal as the fallback
 * authoritative source when the in-memory `assessmentData` route param from
 * the just-completed session is unavailable (e.g. the teacher re-opens the
 * summary in a later app session, or reached LetterHome via "Skip
 * Assessment") — so a later visit shows the SAME persisted result instead
 * of an empty state, closing the two-screens-disagree gap for the
 * "immediate vs later" case as well as the "same session" case.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE = Object.freeze({ status: 'read_failed', baseline: null, summary: null });

/**
 * `summary` is the backend's deterministic Initial Motor Baseline Summary
 * (src/utils/initialMotorBaselineSummary.js) — passed through verbatim,
 * never re-derived or reworded here, exactly like every other normalizer in
 * this project. It is null when the backend did not supply one (older
 * server), so the UI can fall back to rendering the raw scores alone.
 *
 * @param {*} data — response.data, or undefined/null.
 * @returns {{
 *   status: 'found'|'baseline_not_found'|'read_failed',
 *   baseline: {straight:number,curved:number,complex:number,overall:number}|null,
 *   summary: object|null,
 * }}
 */
export function normalizeMotorBaselineResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE };
  if (data.status === 'baseline_not_found') return { status: 'baseline_not_found', baseline: null, summary: null };
  if (data.status !== 'found' || !data.baseline || typeof data.baseline.scores !== 'object') {
    return { ...FAILSAFE };
  }

  const { straight, curved, complex, overall } = data.baseline.scores;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  if (![straight, curved, complex, overall].every(isNum)) return { ...FAILSAFE };

  const summary = (data.baseline.summary && typeof data.baseline.summary === 'object')
    ? data.baseline.summary
    : null;

  return { status: 'found', baseline: { straight, curved, complex, overall }, summary };
}

/**
 * Fetches the student's persisted Feature 1 baseline. Never throws — every
 * failure mode resolves to `read_failed`, the same shape the caller already
 * handles for "no baseline recorded yet" (`baseline_not_found`), so the UI
 * needs only one graceful fallback branch.
 *
 * @param {{studentId: number}} params
 * @returns {Promise<ReturnType<typeof normalizeMotorBaselineResponse>>}
 */
export async function fetchMotorBaseline({ studentId } = {}) {
  try {
    const response = await client.get(ENDPOINTS.MOTOR_BASELINE(studentId));
    return normalizeMotorBaselineResponse(response?.data);
  } catch (err) {
    if (err?.response?.status === 404) return { status: 'baseline_not_found', baseline: null, summary: null };
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[motorBaseline] fetch failed — treating as read_failed:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}
