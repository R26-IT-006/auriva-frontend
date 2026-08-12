/**
 * handwritingAttemptPayload.js
 *
 * Feature 3 Step 3 — Persist Support Level on LetterAttempt (frontend side).
 *
 * Extracts the single, small piece of payload-shaping logic that was
 * duplicated identically in LetterWritingScreen.js and
 * UppercaseWritingScreen.js's `handleNext()`: building one
 * `sessionAttemptsRef.current` entry (the "ML: per-attempt features + raw
 * strokes" record eventually sent as one element of the `attempts` array in
 * the POST to /handwriting/letter-complete).
 *
 * This is a DATA-CAPTURE change only — it adds `support_level` to that
 * per-attempt record using the `supportLevel` the screen already computed
 * via getSupportLevelForAttempt() (Feature 3 Step 2) to decide what to
 * RENDER for this exact attempt. No new support-level computation happens
 * here; this module only shapes the object, it never decides the value.
 *
 * Pure, UI-import-free — safe to unit test directly, and shared so both
 * screens build this record identically instead of maintaining two
 * hand-copied object literals that could quietly drift apart.
 */

'use strict';

import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';

const VALID_SUPPORT_LEVELS = new Set(Object.values(SUPPORT_LEVELS));

/**
 * Builds one element of `sessionAttemptsRef.current` (later sent verbatim as
 * one entry of the `attempts` array in the POST to LETTER_COMPLETE).
 *
 * Field shape is intentionally unchanged from the pre-Step-3 object literal
 * — `attempt_number`, `features`, `strokes` — with exactly one new field
 * added: `support_level`. No existing field was renamed, removed, or
 * reordered.
 *
 * `supportLevel` is validated defensively against the shared vocabulary
 * before being persisted: if it is not exactly 'high'/'medium'/'low' (e.g.
 * the screen's own getSupportLevelForAttempt() returned null for an
 * out-of-range attempt — see Step 2's documented invalid-input contract),
 * this function stores `null` rather than propagating a bad value —
 * matching the backend's own "invalid → null, never guessed" contract for
 * this same field (see auriva-backend's resolveAttemptSupportLevel()).
 *
 * ML readiness pass (Part 1-3): six ADDITIVE fields are now also
 * whitelisted through — total_distance, avg_speed, speed_mean, speed_std,
 * speed_cv, and the pause-extras (pause_count/total_pause_duration_ms/
 * mean_pause_duration_ms/pause_frequency/pause_duration_ratio) — all
 * computed by calculateDrawingFeatures() via utils/trajectoryFeatures.js.
 * None of the six original fields above them were renamed, removed, or
 * reordered; `features.pauseCount` (camelCase, existing) and the new
 * `features.pause_count` (snake_case, from calculatePauseMetrics) are
 * intentionally distinct keys — see featureNormalization.js on the backend
 * for how each is mapped.
 *
 * Duration-correction pass: four more ADDITIVE fields are now also
 * whitelisted through — attempt_duration_ms, attempt_avg_speed,
 * attempt_pause_frequency, attempt_pause_duration_ratio — the tAbs-derived,
 * ML-safe counterparts to duration_ms/avg_speed/pause_frequency/
 * pause_duration_ratio (see utils/trajectoryFeatures.js's
 * calculateAttemptDurationFromAbsoluteTime()). The legacy fields are
 * completely unchanged; these are new keys only.
 *
 * @param {{
 *   attemptNumber: number,
 *   supportLevel: 'high'|'medium'|'low'|null|undefined,
 *   features: {
 *     smoothness: number, pauseCount: number, completionTime: number,
 *     strokeCount: number, dtw_distance: number|null, stroke_order_meta: any,
 *     total_distance?: number, avg_speed?: number|null,
 *     speed_mean?: number|null, speed_std?: number|null, speed_cv?: number|null,
 *     pause_count?: number, total_pause_duration_ms?: number,
 *     mean_pause_duration_ms?: number|null, pause_frequency?: number|null,
 *     pause_duration_ratio?: number|null,
 *     attempt_duration_ms?: number|null, attempt_avg_speed?: number|null,
 *     attempt_pause_frequency?: number|null, attempt_pause_duration_ratio?: number|null,
 *   },
 *   strokes: Array<{stroke_id: number, points: Array<Object>}>,
 * }} params
 * @returns {{
 *   attempt_number: number,
 *   support_level: 'high'|'medium'|'low'|null,
 *   features: Object,
 *   strokes: Array<Object>,
 * }}
 */
export function buildSessionAttemptRecord({ attemptNumber, supportLevel, features, strokes }) {
  return {
    attempt_number: attemptNumber,
    support_level: VALID_SUPPORT_LEVELS.has(supportLevel) ? supportLevel : null,
    features: {
      smoothness:        features.smoothness,
      pauseCount:        features.pauseCount,
      completionTime:    features.completionTime,
      strokeCount:       features.strokeCount,
      dtw_distance:      features.dtw_distance,
      stroke_order_meta: features.stroke_order_meta,
      // ML readiness pass — additive only, see the doc comment above.
      total_distance:           features.total_distance,
      avg_speed:                features.avg_speed,
      speed_mean:                features.speed_mean,
      speed_std:                 features.speed_std,
      speed_cv:                  features.speed_cv,
      pause_count:               features.pause_count,
      total_pause_duration_ms:   features.total_pause_duration_ms,
      mean_pause_duration_ms:    features.mean_pause_duration_ms,
      pause_frequency:           features.pause_frequency,
      pause_duration_ratio:      features.pause_duration_ratio,
      // Duration-correction pass — additive only, see the doc comment above.
      attempt_duration_ms:          features.attempt_duration_ms,
      attempt_avg_speed:             features.attempt_avg_speed,
      attempt_pause_frequency:       features.attempt_pause_frequency,
      attempt_pause_duration_ratio:  features.attempt_pause_duration_ratio,
    },
    strokes,
  };
}
