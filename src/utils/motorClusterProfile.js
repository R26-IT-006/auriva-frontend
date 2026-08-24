/**
 * motorClusterProfile.js
 *
 * Legacy experimental L2 shape-motor clustering. Retained for
 * research/reference compatibility only. It is not used by the current
 * teacher-facing baseline summary and does not influence adaptive
 * progression.
 *
 * NO ACTIVE CALLER: TeacherReportScreen now renders the deterministic
 * Initial Motor Baseline Summary from utils/motorBaseline.js instead. This
 * module and its endpoint are left in place, unchanged, so the legacy
 * prediction stays available for research/legacy inspection.
 *
 * Feature 11 Phase 6 — fetch wrapper for Feature 11A's INITIAL motor-cluster
 * prediction (GET /handwriting/motor-cluster/:studentId, motor_cluster_v1).
 * Mirrors this project's established "thin, impure fetch wrapper + pure
 * normalization + never throws" contract (see motorBaseline.js,
 * initialAssessmentShapes.js).
 *
 * Research-safe by construction: only display_name/description/profileCode/
 * modelVersion are exposed as "profile" fields for the main card. cluster_id
 * and the geometric distances are kept under `debug` — TeacherReportScreen
 * renders those only inside an expandable technical-details panel (spec
 * §13), never as a headline "confidence"/"accuracy" figure.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE = Object.freeze({ status: 'unavailable', profile: null, debug: null });

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{
 *   status: 'found'|'not_found'|'unavailable',
 *   profile: {displayName: string, description: string, profileCode: string|null, modelVersion: string|null}|null,
 *   debug: {clusterId: number|null, nearestDistance: number|null, secondNearestDistance: number|null, separationMargin: number|null}|null,
 * }}
 */
export function normalizeMotorClusterResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE };

  if (data.status === 'baseline_not_found') {
    return { status: 'not_found', profile: null, debug: null };
  }

  if (data.status !== 'predicted' || !data.prediction || typeof data.prediction !== 'object') {
    return { ...FAILSAFE };
  }

  const p = data.prediction;
  if (typeof p.display_name !== 'string' || typeof p.description !== 'string') {
    return { ...FAILSAFE };
  }

  return {
    status: 'found',
    profile: {
      displayName:  p.display_name,
      description:  p.description,
      profileCode:  typeof p.profile_code === 'string' ? p.profile_code : null,
      modelVersion: typeof p.model_version === 'string' ? p.model_version : null,
    },
    debug: {
      clusterId:              typeof p.cluster_id === 'number' ? p.cluster_id : null,
      nearestDistance:        typeof p.nearest_distance === 'number' ? p.nearest_distance : null,
      secondNearestDistance:  typeof p.second_nearest_distance === 'number' ? p.second_nearest_distance : null,
      separationMargin:       typeof p.separation_margin === 'number' ? p.separation_margin : null,
    },
  };
}

/**
 * Fetches the student's initial Feature 11A motor-cluster profile. Never
 * throws — every failure mode resolves to `unavailable`, distinct from the
 * expected `not_found` (no initial baseline yet) so the UI can show two
 * different, honest empty states rather than conflating "not done yet"
 * with "something went wrong."
 *
 * @param {number|string} studentId
 * @returns {Promise<ReturnType<typeof normalizeMotorClusterResponse>>}
 */
export async function fetchMotorClusterProfile(studentId) {
  try {
    const response = await client.get(ENDPOINTS.MOTOR_CLUSTER(studentId));
    return normalizeMotorClusterResponse(response?.data);
  } catch (err) {
    if (err?.response?.status === 404) return { status: 'not_found', profile: null, debug: null };
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[motorClusterProfile] fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}
