/**
 * repetitionRecommendation.js
 *
 * Feature 5 Step 3 — Safe Frontend Activation + Spaced Sequence Reinsertion.
 *
 * Thin, impure fetch wrapper around
 * GET /handwriting/repetition-recommendation/:studentId/:letter/:caseType?adaptiveRepetitionsUsed=N
 * (see auriva-backend's handwritingController.getRepetitionRecommendation).
 * Mirrors utils/preWritingRecommendation.js's exact contract — same
 * failure discipline, kept as a fully separate file/function because
 * Feature 5's recommendation shape (shouldRepeat, family, reason — no
 * activityId/primitiveGroup) is materially different, and this fetch must
 * never be coupled to Feature 3's or Feature 4's own adaptive fetches
 * (each feature's fetch remains fully independent).
 *
 * Contract: this function NEVER throws and NEVER surfaces a child-facing
 * error. Every failure mode — network error, timeout, 404, 500, read_failed,
 * or a malformed/partial response shape (shouldRepeat=true but no
 * resolvable letter/caseType) — resolves to `{ shouldRepeat: false, ... }`.
 * `shouldRepeat: false` is the caller's signal to never insert a spaced
 * repetition — a failure here must never block or alter the existing
 * immediate retry or any other ordinary letter-writing behavior (Step 3
 * spec §6/§31).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const VALID_CASE_TYPES = new Set(['lowercase', 'uppercase']);

const FAILSAFE_RESULT = Object.freeze({
  shouldRepeat: false,
  letter: null,
  caseType: null,
  family: null,
  reason: null,
});

/**
 * Normalizes a raw HTTP response body into the shape callers can trust.
 * Pure (no I/O) — separated from the fetch itself purely so malformed-shape
 * handling is independently unit-testable without mocking the network.
 *
 * @param {*} data — response.data, or undefined/null
 * @returns {{
 *   shouldRepeat: boolean,
 *   letter: string|null,
 *   caseType: 'lowercase'|'uppercase'|null,
 *   family: string|null,
 *   reason: string|null,
 * }}
 */
export function normalizeRepetitionRecommendationResponse(data) {
  if (!data || data.status !== 'evaluated') return { ...FAILSAFE_RESULT };

  const shouldRepeat = data.shouldRepeat === true;
  const letter = typeof data.letter === 'string' && data.letter.length === 1 ? data.letter : null;
  const caseType = VALID_CASE_TYPES.has(data.caseType) ? data.caseType : null;

  // A "shouldRepeat" response missing a resolvable letter/caseType is
  // malformed — fail safe to not-repeating rather than trust a partial
  // shape (same discipline as Feature 4's own normalizer).
  if (shouldRepeat && (!letter || !caseType)) {
    return { ...FAILSAFE_RESULT };
  }

  return {
    shouldRepeat,
    letter,
    caseType,
    family: typeof data.family === 'string' ? data.family : null,
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

/**
 * @param {{studentId: number, letter: string, caseType: 'lowercase'|'uppercase', adaptiveRepetitionsUsed?: number}} params
 * @returns {Promise<ReturnType<typeof normalizeRepetitionRecommendationResponse>>}
 */
export async function fetchRepetitionRecommendation({ studentId, letter, caseType, adaptiveRepetitionsUsed = 0 }) {
  try {
    const response = await client.get(ENDPOINTS.REPETITION_RECOMMENDATION(studentId, letter, caseType, adaptiveRepetitionsUsed));
    return normalizeRepetitionRecommendationResponse(response?.data);
  } catch (err) {
    // Development-only diagnostic — never surfaced to the child, never
    // blocks the session. `typeof __DEV__ !== 'undefined'` guard: this
    // file runs under plain Jest (no Metro/Expo runtime defining that
    // global) as well as the real app.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[RepetitionRecommendation] fetch failed — continuing without spaced repetition:', err?.message ?? err);
    }
    return { ...FAILSAFE_RESULT };
  }
}
