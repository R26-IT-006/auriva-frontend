/**
 * demoSpeedLevels.js
 *
 * Feature 6 Step 2 — Formal Demonstration-Speed Vocabulary (frontend).
 *
 * PURE CONFIGURATION/HELPERS — as of Step 2/3 this was not wired into any
 * writing screen yet; both screens used their own inline
 * `TRACER_PX_PER_MS = 0.28` constant and `Math.max(600, Math.round(len /
 * TRACER_PX_PER_MS))` formula (Step 2 spec §54).
 *
 * Feature 6 Step 4 UPDATE: getStrokeDurationForLevel() below is now the live
 * runtime source of truth for the tracer animation in both
 * LetterWritingScreen.js and UppercaseWritingScreen.js — see those screens'
 * own tracer-duration call sites. It reproduces the old inline formula
 * byte-for-byte whenever the effective speed level is 'standard' (still true
 * for every session until a `slow` recommendation is both received AND
 * actually renders a tracer — see utils/demoSpeedPersistence.js).
 *
 * ── Why frontend AND backend both need vocabulary (Step 2 spec §9) ───────
 * Backend (`src/config/demoSpeedPolicy.js`, auriva-backend) owns WHICH
 * speed level should be recommended — it never needs to know about canvas
 * pixels, `Animated.timing`, or stroke path length. This file owns what a
 * level MEANS for pixel-based animation. The shared conceptual contract
 * between the two repos is only the categorical vocabulary itself
 * (`standard`/`slow`) — verified never to drift via a golden-fixture parity
 * test on the backend side (mirrors Feature 3/4's own cross-repo parity
 * convention, since these are independent git repositories).
 *
 * ── Speed vs duration (Step 2 spec §5) ───────────────────────────────────
 * `SLOW_SPEED_MULTIPLIER = 0.75` means 75% of current tracer VELOCITY
 * (≈25% slower). Because `duration = arcLength / speed`, this produces a
 * `1/0.75 ≈ 1.333×` (≈33% LONGER) duration for the same stroke — related
 * but not the same percentage; do not conflate them.
 *
 * ── Pilot status ──────────────────────────────────────────────────────────
 * 0.75 is a conservative engineering/pilot default — NOT clinically
 * validated, NOT a therapeutic threshold, NOT an autism diagnostic
 * parameter, requires teacher/pilot validation.
 */

'use strict';

export const DEMO_SPEED_LEVELS = Object.freeze({
  STANDARD: 'standard',
  SLOW: 'slow',
});

const VALID_DEMO_SPEED_LEVELS = new Set(Object.values(DEMO_SPEED_LEVELS));

/**
 * @param {*} value
 * @returns {boolean} true only for the exact strings 'standard'|'slow'.
 */
export function isValidDemoSpeedLevel(value) {
  return typeof value === 'string' && VALID_DEMO_SPEED_LEVELS.has(value);
}

// The current, already-deployed, UNMODIFIED tracer speed — byte-identical
// to LetterWritingScreen.js's/UppercaseWritingScreen.js's own
// `TRACER_PX_PER_MS = 0.28` (Step 1 audit §3/§4). This is the SAME value,
// documented here as the authoritative STANDARD baseline for the future
// policy layer — the two screens' own constants are not replaced or
// re-pointed at this file in Step 2; they remain their own separate,
// untouched literals until a future activation step deliberately does so.
export const STANDARD_TRACER_PX_PER_MS = 0.28;

// Pilot engineering default — NOT clinically validated. See module header.
export const SLOW_SPEED_MULTIPLIER = 0.75;

export const DEMO_SPEED_MULTIPLIERS = Object.freeze({
  [DEMO_SPEED_LEVELS.STANDARD]: 1.0,
  [DEMO_SPEED_LEVELS.SLOW]: SLOW_SPEED_MULTIPLIER,
});

// Existing 600ms per-stroke floor (Step 1 audit §4/§13) — preserved
// exactly, never changed by Feature 6, in either speed level.
export const MIN_STROKE_DURATION_MS = 600;

/**
 * Resolves the effective tracer speed (px/ms) for a speed level. Any
 * invalid/missing/null/undefined level falls back to STANDARD — Feature 6
 * failing in any way must always reproduce today's exact, current
 * presentation (Step 2 spec §41), never a guessed or defaulted-to-SLOW
 * value.
 *
 * @param {'standard'|'slow'|null|undefined|*} speedLevel
 * @returns {number} pixels/millisecond — always <= STANDARD_TRACER_PX_PER_MS
 */
export function getTracerSpeedForLevel(speedLevel) {
  const multiplier = isValidDemoSpeedLevel(speedLevel)
    ? DEMO_SPEED_MULTIPLIERS[speedLevel]
    : DEMO_SPEED_MULTIPLIERS[DEMO_SPEED_LEVELS.STANDARD];
  return STANDARD_TRACER_PX_PER_MS * multiplier;
}

/**
 * Formal (NOT YET WIRED) contract for a single stroke's demonstration
 * duration, given its arc length and a speed level. Byte-identical to the
 * existing inline formula in both writing screens
 * (`Math.max(600, Math.round(len / TRACER_PX_PER_MS))`) whenever
 * `speedLevel` is STANDARD, missing, or invalid (Step 2 spec §12/§50
 * backward-compatibility proof) — this function is not called by either
 * screen yet; it exists purely as the documented, testable contract a
 * future activation step will use.
 *
 * @param {number} strokeArcLengthPx — same absolute-canvas-pixel arc
 *   length both screens already compute via sampleSmoothPath/_sampleOneStroke.
 * @param {'standard'|'slow'|null|undefined} [speedLevel]
 * @returns {number} milliseconds, always >= MIN_STROKE_DURATION_MS
 */
export function getStrokeDurationForLevel(strokeArcLengthPx, speedLevel) {
  const speed = getTracerSpeedForLevel(speedLevel);
  return Math.max(MIN_STROKE_DURATION_MS, Math.round(strokeArcLengthPx / speed));
}
