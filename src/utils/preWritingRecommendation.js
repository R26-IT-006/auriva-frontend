/**
 * preWritingRecommendation.js
 *
 * Feature 4 Step 5 — Safe Frontend Activation of Adaptive Pre-Writing.
 *
 * Thin, impure fetch wrapper around
 * GET /handwriting/pre-writing-recommendation/:studentId/:letter/:caseType
 * (see auriva-backend's handwritingController.getPreWritingRecommendation).
 * Mirrors utils/supportRecommendation.js's fetchRecommendedStartSupport()
 * exactly — same contract, same failure discipline — kept as a separate
 * file/function because Feature 4's recommendation shape (activityId,
 * primitiveGroup, family) is materially different from Feature 3's
 * (recommendedSupport), and the two adaptive fetches must never be coupled
 * (Step 5 spec §26).
 *
 * Contract: this function NEVER throws and NEVER surfaces a child-facing
 * error. Every failure mode — network error, timeout, 404 (older backend /
 * rollout mismatch), 500, read_failed, or a malformed/partial response
 * shape (recommended=true but no resolvable activityId/letter/caseType) —
 * resolves to `{ recommended: false, activityId: null, ... }`. `recommended:
 * false` is the caller's signal to never navigate into PreWritingActivity —
 * adaptive pre-writing failing must never block or alter ordinary letter
 * writing (Step 5 spec §8).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const VALID_CASE_TYPES = new Set(['lowercase', 'uppercase']);

const FAILSAFE_RESULT = Object.freeze({
  recommended: false,
  activityId: null,
  letter: null,
  caseType: null,
  family: null,
  primitiveGroup: null,
  reason: null,
});

/**
 * Normalizes a raw HTTP response body into the shape callers can trust.
 * Pure (no I/O) — separated from the fetch itself purely so malformed-shape
 * handling is independently unit-testable without mocking the network.
 *
 * @param {*} data — response.data, or undefined/null
 * @returns {{
 *   recommended: boolean,
 *   activityId: string|null,
 *   letter: string|null,
 *   caseType: 'lowercase'|'uppercase'|null,
 *   family: string|null,
 *   primitiveGroup: string|null,
 *   reason: string|null,
 * }}
 */
export function normalizePreWritingRecommendationResponse(data) {
  if (!data || data.status !== 'evaluated') return { ...FAILSAFE_RESULT };

  const recommended = data.recommended === true;
  const activityId = typeof data.activityId === 'string' && data.activityId.length > 0 ? data.activityId : null;
  const letter = typeof data.letter === 'string' && data.letter.length === 1 ? data.letter : null;
  const caseType = VALID_CASE_TYPES.has(data.caseType) ? data.caseType : null;

  // A "recommended" response missing a resolvable activityId/letter/caseType
  // is malformed — fail safe to not-recommended rather than trust a partial
  // shape (Step 5 spec §7/§8/§18/§19: malformed data must never navigate).
  if (recommended && (!activityId || !letter || !caseType)) {
    return { ...FAILSAFE_RESULT };
  }

  return {
    recommended,
    activityId: recommended ? activityId : null,
    letter,
    caseType,
    family: typeof data.family === 'string' ? data.family : null,
    primitiveGroup: typeof data.primitiveGroup === 'string' ? data.primitiveGroup : null,
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

/**
 * @param {{studentId: number, letter: string, caseType: 'lowercase'|'uppercase'}} params
 * @returns {Promise<ReturnType<typeof normalizePreWritingRecommendationResponse>>}
 */
export async function fetchPreWritingRecommendation({ studentId, letter, caseType }) {
  try {
    const response = await client.get(ENDPOINTS.PRE_WRITING_RECOMMENDATION(studentId, letter, caseType));
    return normalizePreWritingRecommendationResponse(response?.data);
  } catch (err) {
    // Development-only diagnostic — never surfaced to the child, never
    // blocks the session (Step 5 spec §8). `typeof __DEV__ !== 'undefined'`
    // guard: this file runs under plain Jest (no Metro/Expo runtime
    // defining that global) as well as the real app.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[PreWritingRecommendation] fetch failed — continuing ordinary letter writing:', err?.message ?? err);
    }
    return { ...FAILSAFE_RESULT };
  }
}
