/**
 * supportRecommendation.js
 *
 * Feature 3 Step 6 — Safe Activation of Adaptive Support Rendering.
 *
 * Thin, impure fetch wrapper around
 * GET /handwriting/support-recommendation/:studentId/:letter/:caseType
 * (see auriva-backend's handwritingController.getSupportRecommendation).
 * Deliberately separate from constants/handwritingSupportLevels.js's pure
 * getAdaptiveSupportSequence() — this file is the only impure piece
 * (network I/O), kept small and single-purpose so the sequence logic itself
 * stays trivially unit-testable without mocking `client`.
 *
 * Contract: this function NEVER throws and NEVER surfaces a child-facing
 * error. Every failure mode — network error, timeout, 404 (older backend /
 * rollout mismatch, Step 6 spec §21), 500, or a response whose
 * `recommendedSupport` isn't exactly 'high'/'medium'/'low' (insufficient_data,
 * insufficient_target, not_applicable, support_review's own high value is
 * still valid and passes through, read_failed, or literally any other
 * shape) — resolves to `null`. `null` is the caller's signal to use the
 * legacy default sequence (getAdaptiveSupportSequence(null) — see that
 * function). Adaptive support failing must never prevent handwriting
 * (Step 6 spec §20).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';
import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';

const VALID_START_SUPPORT = new Set(Object.values(SUPPORT_LEVELS));

/**
 * @param {{studentId: number, letter: string, caseType: 'lowercase'|'uppercase'}} params
 * @returns {Promise<'high'|'medium'|'low'|null>}
 */
export async function fetchRecommendedStartSupport({ studentId, letter, caseType }) {
  try {
    const response = await client.get(ENDPOINTS.SUPPORT_RECOMMENDATION(studentId, letter, caseType));
    const recommended = response?.data?.recommendedSupport;
    return VALID_START_SUPPORT.has(recommended) ? recommended : null;
  } catch (err) {
    // Development-only diagnostic — never surfaced to the child, never
    // blocks the session (Step 6 spec §20/§21). `typeof __DEV__ !==
    // 'undefined'` guard: this file runs under plain Jest (no Metro/Expo
    // runtime defining that global) as well as the real app, and must
    // never throw here regardless of environment.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[SupportRecommendation] fetch failed — falling back to legacy sequence:', err?.message ?? err);
    }
    return null;
  }
}

// ─── Feature 3 Step 7 — session-state decision helpers ─────────────────────
//
// Extracted from LetterWritingScreen.js/UppercaseWritingScreen.js's fetch
// effect (Step 6) so the two race-safety/timing guarantees are directly
// unit-testable without React component rendering (this project's Jest
// config has no RN component-testing infrastructure — see jest.config.js's
// own comment; extracting the smallest pure decision piece is the same
// pattern every prior Feature 3 step already used, e.g.
// buildSessionAttemptRecord). Pure functions only — no behavior change from
// what was already inline; this is a refactor for testability, not a new
// decision.

/**
 * Is it still safe to APPLY an arriving recommendation response to the
 * current session? False once the child has already started drawing this
 * letter's first attempt (or is already past attempt 1 for any other
 * reason) — an adaptive recommendation must never retroactively change
 * support mid-attempt (Step 6 spec §19, Step 7 spec §18).
 *
 * Note: this does NOT check "is this response for the currently-viewed
 * letter" — the fetch effect's own closure guarantees `letter` in scope at
 * `.then()` time already IS the exact letter the request was made for (the
 * effect's cleanup flips a `cancelled` flag whenever `letter` changes,
 * before this callback would ever run for a different letter — standard
 * React effect-cleanup semantics). The SEPARATE, redundant guarantee that a
 * stale letter's stored recommendation can never leak into a newly-viewed
 * letter is provided by resolveRecommendedStartSupport() below, at render
 * time — two independent layers, not one.
 *
 * @param {{currentAttempt: number, hasDrawnCurrentAttempt: boolean}} params
 * @returns {boolean}
 */
export function shouldApplyRecommendation({ currentAttempt, hasDrawnCurrentAttempt }) {
  return currentAttempt === 1 && !hasDrawnCurrentAttempt;
}

/**
 * Resolves which starting support (if any) should drive the CURRENTLY
 * rendered letter's adaptive sequence, given whatever recommendation is
 * presently stored in state. Returns `null` (→ the caller falls back to
 * getAdaptiveSupportSequence(null), the legacy sequence) whenever the
 * stored recommendation was resolved for a DIFFERENT letter than the one
 * now being rendered — the render-time half of the stale-response
 * guarantee described above.
 *
 * @param {{
 *   recommendation: {letter: string|null, startSupport: string|null}|null|undefined,
 *   currentLetter: string,
 * }} params
 * @returns {'high'|'medium'|'low'|null}
 */
export function resolveRecommendedStartSupport({ recommendation, currentLetter }) {
  return recommendation?.letter === currentLetter ? (recommendation?.startSupport ?? null) : null;
}
