/**
 * initialAssessmentShapes.js
 *
 * Assessment Summary modal fix — fetch wrapper for the persisted per-shape
 * initial assessment (GET /handwriting/initial-report/:studentId, the SAME
 * endpoint TeacherReportScreen.js already uses). Mirrors this project's
 * established "thin, impure fetch wrapper + pure normalization + never
 * throws" contract (see motorBaseline.js, familyThresholds.js).
 *
 * Replaces motorBaseline.js as LetterHomeScreen.js's fallback source for a
 * LATER visit's Assessment Summary (when the in-memory assessmentData route
 * param from the just-completed session is unavailable). motorBaseline.js
 * only has a real value once Feature 1's StudentMotorBaseline row exists,
 * which requires the source assessment to have been finalized with a valid
 * motor_profile/motor_score — many real assessments (confirmed on live
 * data: e.g. students with dozens of never-finalized rows) never reach that
 * state, so the modal showed nothing at all for them. getInitialReport
 * instead derives a real per-shape score straight from each shape's own
 * raw stroke/smoothness data (see deriveMotorScoreFromStoredShape on the
 * backend) whenever ANY assessment row exists, finalized or not — and
 * returns all 6 individual shapes, not 3 blended family averages, so a
 * later visit now shows the exact same 6-row breakdown the child saw
 * immediately after finishing, instead of a coarser 3-row summary.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE = Object.freeze({ status: 'read_failed', shapes: null });

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'found'|'not_found'|'read_failed', shapes: Array<{shapeId: string, features: {motor_score: number|null}}>|null}}
 */
export function normalizeInitialAssessmentShapesResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE };
  if (!data.hasData) return { status: 'not_found', shapes: null };

  const rawShapes = data.assessment?.shapes;
  if (!Array.isArray(rawShapes) || rawShapes.length === 0) return { status: 'not_found', shapes: null };

  const shapes = rawShapes.map(s => ({
    shapeId: s.shape_id ?? 'unknown',
    features: { motor_score: typeof s.features?.motor_score === 'number' ? s.features.motor_score : null },
  }));
  return { status: 'found', shapes };
}

/**
 * Fetches the student's earliest (initial) assessment, per-shape. Never
 * throws — every failure mode resolves to `read_failed`, the same shape the
 * caller already handles for "no assessment recorded yet" (`not_found`), so
 * the UI needs only one graceful fallback branch.
 *
 * @param {{studentId: number}} params
 * @returns {Promise<ReturnType<typeof normalizeInitialAssessmentShapesResponse>>}
 */
export async function fetchInitialAssessmentShapes({ studentId } = {}) {
  try {
    const response = await client.get(ENDPOINTS.HANDWRITING_INITIAL_REPORT(studentId));
    return normalizeInitialAssessmentShapesResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[initialAssessmentShapes] fetch failed — treating as read_failed:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}
