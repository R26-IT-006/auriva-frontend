/**
 * trajectoryFeatures.js — canonical stroke-aware trajectory feature calculations.
 *
 * Shared by the shape/letter/uppercase capture screens so multi-stroke
 * attempts are measured consistently: no artificial distance/speed/pause is
 * ever computed across a pen-lift boundary (end of stroke N -> start of
 * stroke N+1). Every function accepts `strokes` in the same shape the
 * screens already use internally: an array of strokes, each stroke an
 * array of captured points `{x, y, t, tAbs, stroke_id}` — i.e.
 * `allPathsRef.current` / `shape.strokes` / `attempt.strokes` throughout
 * the handwriting screens (see ShapeAssessmentScreen.js, LetterWritingScreen.js,
 * uppercase/UppercaseWritingScreen.js).
 *
 * These features (total_distance, avg_speed, speed_mean/std/cv, pause
 * extras and the tAbs-based attempt_* family) sit alongside the screens' own
 * smoothness, pause_count and dtw_distance calculations and do not change
 * them. Note that avg_speed from here is sent with each attempt, and the
 * backend uses it for the Motor Score speed component when present
 * (featureNormalization.js).
 *
 * ── NOTE ON `t` (important for anyone extending this file) ────────────────
 * Each stroke's `t` clock resets to 0 at that stroke's own
 * onPanResponderGrant (see e.g. LetterWritingScreen.js's PanResponder) — it
 * is NOT one continuous clock across a whole multi-stroke attempt.
 * `calculateDuration()` below intentionally keeps the existing app-wide
 * convention (the last point's `t`, in flattened stroke order, as the
 * screens compute duration_ms/completionTime) for backward compatibility.
 * Known limitation: for a multi-stroke attempt it reflects only the last
 * stroke's elapsed time, not the attempt's wall-clock duration. The
 * tAbs-based attempt_* functions at the end of this file avoid it.
 *
 * Side effect of the per-stroke `t` reset: any calculation that guards on
 * `dt > 0` (calculateSegmentSpeeds, and therefore calculateSpeedStats)
 * excludes stroke-boundary segments automatically, because the delta at a
 * boundary is always <= 0. Distance does not get this for free, so the
 * distance and pause functions iterate stroke-by-stroke explicitly.
 */

'use strict';

function isFinitePoint(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function euclidean(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Sum of Euclidean distances between consecutive points, computed
 * separately within each stroke — never across a stroke boundary.
 * Same formula as ShapeAssessmentScreen.js's calculateFeatures():
 * sqrt((x2-x1)^2 + (y2-y1)^2).
 *
 * @param {Array<Array<{x:number,y:number}>>} strokes
 * @returns {number} pixels; 0 for empty/degenerate input
 */
export function calculateTotalDistance(strokes) {
  if (!Array.isArray(strokes)) return 0;
  let total = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1];
      const b = stroke[i];
      if (!isFinitePoint(a) || !isFinitePoint(b)) continue;
      total += euclidean(a, b);
    }
  }
  return total;
}

/**
 * Replicates the existing app-wide duration convention exactly: the `t`
 * value of the very last captured point, in the same flattened
 * (stroke-concatenated) order calculateFeatures()/calculateDrawingFeatures()
 * already use. See the module doc comment above for the multi-stroke
 * caveat this convention inherits unchanged.
 *
 * @param {Array<Array<{t:number}>>} strokes
 * @returns {number} milliseconds; 0 for empty input
 */
export function calculateDuration(strokes) {
  if (!Array.isArray(strokes) || strokes.length === 0) return 0;
  const flat = strokes.flat();
  if (flat.length === 0) return 0;
  const last = flat[flat.length - 1];
  return Number.isFinite(last?.t) ? last.t : 0;
}

function countPoints(strokes) {
  if (!Array.isArray(strokes)) return 0;
  let n = 0;
  for (const stroke of strokes) {
    if (Array.isArray(stroke)) n += stroke.length;
  }
  return n;
}

/**
 * avg_speed = total_distance / duration_ms (same semantics as
 * ShapeAssessmentScreen.js's calculateFeatures()). Returns null, never 0,
 * when duration is not strictly positive/finite or the trajectory has fewer
 * than 2 points: 0 would misrepresent "no data" as "measured, stationary".
 *
 * @param {Array<Array<{x:number,y:number,t:number}>>} strokes
 * @returns {number|null} pixels/millisecond
 */
export function calculateAverageSpeed(strokes) {
  if (countPoints(strokes) < 2) return null;
  const totalDistance = calculateTotalDistance(strokes);
  const durationMs = calculateDuration(strokes);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  if (!Number.isFinite(totalDistance)) return null;
  return totalDistance / durationMs;
}

/**
 * Per-segment speed (px/ms) for every consecutive, same-stroke point pair
 * with a strictly positive time delta (segments with dt <= 0 are ignored).
 * Segments spanning a stroke boundary are excluded as a side effect of the
 * dt > 0 guard — see the module doc comment.
 *
 * @param {Array<Array<{x:number,y:number,t:number}>>} strokes
 * @returns {number[]}
 */
export function calculateSegmentSpeeds(strokes) {
  if (!Array.isArray(strokes)) return [];
  const speeds = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1];
      const b = stroke[i];
      if (!isFinitePoint(a) || !isFinitePoint(b)) continue;
      const dt = b.t - a.t;
      if (!Number.isFinite(dt) || dt <= 0) continue;
      speeds.push(euclidean(a, b) / dt);
    }
  }
  return speeds;
}

/**
 * speed_mean / speed_std (population standard deviation) / speed_cv from
 * the valid segment-speed sequence (see calculateSegmentSpeeds). All three
 * are null when there are no valid segments. speed_cv = speed_std /
 * speed_mean, and is null unless speed_mean > 0.
 *
 * @param {Array<Array<{x:number,y:number,t:number}>>} strokes
 * @returns {{speed_mean: number|null, speed_std: number|null, speed_cv: number|null}}
 */
export function calculateSpeedStats(strokes) {
  const speeds = calculateSegmentSpeeds(strokes);
  if (speeds.length === 0) return { speed_mean: null, speed_std: null, speed_cv: null };

  const speed_mean = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  const variance = speeds.reduce((s, v) => s + (v - speed_mean) ** 2, 0) / speeds.length;
  const speed_std = Math.sqrt(variance);
  const speed_cv = speed_mean > 0 ? speed_std / speed_mean : null;

  return { speed_mean, speed_std, speed_cv };
}

// Matches the inline `300` literal in ShapeAssessmentScreen.js's
// calculateFeatures() and the letter screens' calculateDrawingFeatures().
// Those call sites still use their own literal; keep the values in sync.
export const DEFAULT_PAUSE_THRESHOLD_MS = 300;

/**
 * Pause metrics from consecutive, same-stroke point gaps STRICTLY GREATER
 * THAN thresholdMs (never >=, matching the existing app-wide pause
 * definition). Computed per-stroke so a pen-up transition between strokes
 * is never counted as a pause.
 *
 * Gives the same pause_count as the screens' flatten-then-diff code: there,
 * a cross-stroke pair's delta is always <= 0 (each stroke's `t` restarts at
 * 0), so it is never counted either. These metrics therefore measure
 * WITHIN-STROKE pauses only; pen-up time between strokes is not measured.
 *
 * @param {Array<Array<{t:number}>>} strokes
 * @param {{thresholdMs?: number, durationMs?: number}} [options]
 *   durationMs: reference duration for pause_frequency/pause_duration_ratio;
 *   defaults to calculateDuration(strokes) when omitted.
 * @returns {{
 *   pause_count: number,
 *   total_pause_duration_ms: number,
 *   mean_pause_duration_ms: number|null,
 *   pause_frequency: number|null,
 *   pause_duration_ratio: number|null,
 * }}
 */
export function calculatePauseMetrics(strokes, options = {}) {
  const thresholdMs = Number.isFinite(options.thresholdMs) ? options.thresholdMs : DEFAULT_PAUSE_THRESHOLD_MS;
  const durationMs = Number.isFinite(options.durationMs) ? options.durationMs : calculateDuration(strokes);

  let pause_count = 0;
  let total_pause_duration_ms = 0;

  if (Array.isArray(strokes)) {
    for (const stroke of strokes) {
      if (!Array.isArray(stroke)) continue;
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1];
        const b = stroke[i];
        if (!Number.isFinite(a?.t) || !Number.isFinite(b?.t)) continue;
        const gap = b.t - a.t;
        if (gap > thresholdMs) { // strictly greater than — matches the existing convention
          pause_count += 1;
          total_pause_duration_ms += gap;
        }
      }
    }
  }

  const mean_pause_duration_ms = pause_count > 0 ? total_pause_duration_ms / pause_count : null;
  const pause_frequency = Number.isFinite(durationMs) && durationMs > 0
    ? pause_count / (durationMs / 1000)
    : null;
  const pause_duration_ratio = Number.isFinite(durationMs) && durationMs > 0
    ? total_pause_duration_ms / durationMs
    : null;

  return { pause_count, total_pause_duration_ms, mean_pause_duration_ms, pause_frequency, pause_duration_ratio };
}

// ─── Attempt duration from absolute time (tAbs) ────────────────────────────
//
// calculateDuration() above, and therefore avg_speed, pause_frequency and
// pause_duration_ratio, reflects only the LAST stroke's elapsed time for a
// multi-stroke attempt (the per-stroke `t` clock resets). Every point also
// carries `tAbs` (Date.now(), epoch ms), which does NOT reset between
// strokes. The functions below derive duration, speed and pause rates from
// `tAbs` instead. The functions above are left unchanged for backward
// compatibility with existing scoring and already-stored values.

/**
 * True wall-clock span of a (possibly multi-stroke) attempt, derived from
 * `tAbs` rather than the stroke-local `t` clock.
 *
 * attempt_duration_ms = max(valid tAbs) - min(valid tAbs), across every
 * point in every stroke. Requires at least 2 valid (finite) `tAbs` values
 * with max strictly greater than min; returns null (never 0, never
 * negative, never invented) otherwise — an attempt with only one usable
 * timestamp, or none, has no measurable duration.
 *
 * @param {Array<Array<{tAbs:number}>>} strokes
 * @returns {number|null} milliseconds
 */
export function calculateAttemptDurationFromAbsoluteTime(strokes) {
  if (!Array.isArray(strokes)) return null;
  let min = Infinity;
  let max = -Infinity;
  let validCount = 0;

  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    for (const point of stroke) {
      const tAbs = point?.tAbs;
      if (!Number.isFinite(tAbs)) continue;
      validCount += 1;
      if (tAbs < min) min = tAbs;
      if (tAbs > max) max = tAbs;
    }
  }

  if (validCount < 2) return null;
  if (max <= min) return null;
  return max - min;
}

/**
 * Attempt-level average speed: total_distance / attempt_duration_ms. Kept
 * separate from calculateAverageSpeed(), which divides by the legacy,
 * possibly truncated calculateDuration().
 *
 * @param {number|null} totalDistance — the existing, within-stroke-only
 *   calculateTotalDistance() result; pen-up movement is never included.
 * @param {number|null} attemptDurationMs — from
 *   calculateAttemptDurationFromAbsoluteTime().
 * @returns {number|null} pixels/millisecond
 */
export function calculateAttemptAverageSpeed(totalDistance, attemptDurationMs) {
  if (!Number.isFinite(totalDistance)) return null;
  if (!Number.isFinite(attemptDurationMs) || attemptDurationMs <= 0) return null;
  return totalDistance / attemptDurationMs;
}

/**
 * Attempt-level pause rates, using attempt_duration_ms as the denominator
 * instead of the legacy calculateDuration(). Reuses pause_count and
 * total_pause_duration_ms from calculatePauseMetrics() (same within-stroke
 * detection, default threshold 300 ms); only the denominator differs.
 *
 * @param {number|null} pauseCount
 * @param {number|null} totalPauseDurationMs
 * @param {number|null} attemptDurationMs
 * @returns {{attempt_pause_frequency: number|null, attempt_pause_duration_ratio: number|null}}
 */
export function calculateAttemptPauseMetrics(pauseCount, totalPauseDurationMs, attemptDurationMs) {
  if (!Number.isFinite(attemptDurationMs) || attemptDurationMs <= 0) {
    return { attempt_pause_frequency: null, attempt_pause_duration_ratio: null };
  }
  const attempt_pause_frequency = Number.isFinite(pauseCount)
    ? pauseCount / (attemptDurationMs / 1000)
    : null;
  const attempt_pause_duration_ratio = Number.isFinite(totalPauseDurationMs)
    ? totalPauseDurationMs / attemptDurationMs
    : null;
  return { attempt_pause_frequency, attempt_pause_duration_ratio };
}
