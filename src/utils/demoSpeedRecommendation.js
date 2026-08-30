/**
 * demoSpeedRecommendation.js
 *
 * Feature 6 Step 4 — Safe Frontend Activation of Demonstration Speed.
 *
 * Thin, impure fetch wrapper around
 * GET /handwriting/demo-speed-recommendation/:studentId/:letter/:caseType
 * (see auriva-backend's handwritingController.getDemoSpeedRecommendation),
 * plus the two pure decision helpers the writing screens use around it.
 * Mirrors utils/supportRecommendation.js's exact three-piece shape (fetch +
 * apply-gate + render-time resolve) — same double-layer staleness guarantee,
 * same "never throws, never blocks handwriting" contract, kept as its own
 * file because Feature 6's recommendation (`recommendedSpeedLevel`) is a
 * materially different shape and must stay fully independent of Feature 3's
 * own fetch (spec §43/§44: each feature's fetch is never coupled to another).
 *
 * Contract: fetchDemoSpeedRecommendation() NEVER throws and NEVER surfaces a
 * child-facing error. Every failure mode — network error, timeout, 404, 500,
 * a malformed body, an invalid/unknown speed level ('fast', 'medium', null,
 * undefined, anything not exactly 'standard'/'slow'), or a `status` other
 * than 'evaluated' — resolves to `recommendedSpeedLevel: DEMO_SPEED_LEVELS.STANDARD`.
 * `standard` is always the safe fallback: it reproduces today's exact,
 * already-shipped tracer speed, so a demo-speed failure is invisible to the
 * child (Step 4 spec §5/§6/§40).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';
import { DEMO_SPEED_LEVELS, isValidDemoSpeedLevel } from '../constants/demoSpeedLevels';

/**
 * Normalizes a raw HTTP response body into a trustworthy speed level. Pure
 * (no I/O) — separated from the fetch itself purely so malformed-shape
 * handling is independently unit-testable without mocking the network.
 *
 * @param {*} data — response.data, or undefined/null
 * @returns {'standard'|'slow'}
 */
export function normalizeDemoSpeedRecommendationResponse(data) {
  if (!data || data.status !== 'evaluated') return DEMO_SPEED_LEVELS.STANDARD;
  return isValidDemoSpeedLevel(data.recommendedSpeedLevel)
    ? data.recommendedSpeedLevel
    : DEMO_SPEED_LEVELS.STANDARD;
}

/**
 * @param {{studentId: number, letter: string, caseType: 'lowercase'|'uppercase'}} params
 * @returns {Promise<{letter: string, caseType: string, recommendedSpeedLevel: 'standard'|'slow'}>}
 *   `letter`/`caseType` are echoed back from the INPUT params (never trusted
 *   from the response body) so the caller always has a reliable identity to
 *   tag the result with, regardless of what the backend returned.
 */
export async function fetchDemoSpeedRecommendation({ studentId, letter, caseType }) {
  try {
    const response = await client.get(ENDPOINTS.DEMO_SPEED_RECOMMENDATION(studentId, letter, caseType));
    return { letter, caseType, recommendedSpeedLevel: normalizeDemoSpeedRecommendationResponse(response?.data) };
  } catch (err) {
    // Development-only diagnostic — never surfaced to the child, never
    // blocks the session. `typeof __DEV__ !== 'undefined'` guard: this file
    // runs under plain Jest (no Metro/Expo runtime defining that global) as
    // well as the real app.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[DemoSpeedRecommendation] fetch failed — falling back to standard speed:', err?.message ?? err);
    }
    return { letter, caseType, recommendedSpeedLevel: DEMO_SPEED_LEVELS.STANDARD };
  }
}

// ─── Feature 6 Step 4 — session-state decision helpers ─────────────────────
//
// Extracted so the two race-safety/timing guarantees are directly
// unit-testable without React component rendering — same "extract the
// smallest pure decision piece" pattern Feature 3/4/5 already used
// (shouldApplyRecommendation/resolveRecommendedStartSupport,
// shouldApplyDemoSpeedRecommendation's own acceptance table below mirrors
// shouldApplyRecommendation's, with two additions: an explicit letter/case
// match (Feature 3 relies on effect-cleanup timing alone for this; Feature 6
// makes it an explicit, independently-testable condition — spec §17/§19)
// and an explicit collection-mode rejection (spec §13, defense in depth
// alongside the fetch effect's own `if (collectionMode) return;` guard).

/**
 * Is it still safe to APPLY an arriving demo-speed response to the current
 * session? Mirrors supportRecommendation.js's shouldApplyRecommendation,
 * plus the explicit letter/case/collection checks Step 4 spec §19 asks for.
 *
 * False whenever:
 *   - the response was cancelled (effect cleanup already fired — stale
 *     letter/unmount race, spec §17)
 *   - collectionMode is true (spec §13 — collection must never receive
 *     adaptive-recommendation evidence, defense-in-depth alongside the
 *     fetch effect's own early return)
 *   - the response is for a different letter or caseType than the one
 *     currently on screen (spec §17 — a late `c` response must never be
 *     applied to `o`)
 *   - the child is no longer at the safe starting point of this letter
 *     (`currentAttempt !== 1`) or has already started drawing (spec §18 —
 *     an adaptive recommendation must never retroactively change the speed
 *     mid-attempt; if drawing already started before the response arrived,
 *     it is discarded, and the same-letter retry simply keeps `standard`,
 *     exactly as Feature 3's own recommendation does in this situation)
 *
 * @param {{
 *   responseLetter: string,
 *   responseCaseType: string,
 *   currentLetter: string,
 *   currentCaseType: string,
 *   currentAttempt: number,
 *   hasDrawn: boolean,
 *   collectionMode: boolean,
 *   cancelled: boolean,
 * }} params
 * @returns {boolean}
 */
export function shouldApplyDemoSpeedRecommendation({
  responseLetter,
  responseCaseType,
  currentLetter,
  currentCaseType,
  currentAttempt,
  hasDrawn,
  collectionMode,
  cancelled,
}) {
  return (
    !cancelled &&
    !collectionMode &&
    responseLetter === currentLetter &&
    responseCaseType === currentCaseType &&
    currentAttempt === 1 &&
    !hasDrawn
  );
}

/**
 * Resolves which recommended speed level (if any) should drive the
 * CURRENTLY rendered letter, given whatever recommendation is presently
 * stored in state. Returns `DEMO_SPEED_LEVELS.STANDARD` (never a guessed
 * `slow`) whenever the stored recommendation was resolved for a DIFFERENT
 * letter/caseType than the one now being rendered — the render-time half of
 * the stale-response guarantee, independent of shouldApplyDemoSpeedRecommendation
 * above (same two-layer pattern as
 * supportRecommendation.js's resolveRecommendedStartSupport). This is also
 * what naturally resets a new letter back to `standard` before/while its own
 * fetch is pending (spec §16) — no separate reset action needed.
 *
 * @param {{
 *   recommendation: {letter: string|null, caseType: string|null, speedLevel: string|null}|null|undefined,
 *   currentLetter: string,
 *   currentCaseType: string,
 * }} params
 * @returns {'standard'|'slow'}
 */
export function resolveRecommendedDemoSpeedLevel({ recommendation, currentLetter, currentCaseType }) {
  const matchesCurrentLetter =
    recommendation?.letter === currentLetter && recommendation?.caseType === currentCaseType;
  const speedLevel = matchesCurrentLetter ? recommendation?.speedLevel : null;
  return isValidDemoSpeedLevel(speedLevel) ? speedLevel : DEMO_SPEED_LEVELS.STANDARD;
}
