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
 * This module is purely additive: it introduces NEW derived features
 * (total_distance/avg_speed for letters, plus speed_std/speed_cv/pause
 * extras for ML use) alongside the existing calculateFeatures()/
 * calculateDrawingFeatures() functions in those screens. It does not
 * change, replace, or duplicate any existing formula that already feeds
 * child-facing scoring (smoothness, pause_count, dtw_distance, accuracy).
 *
 * ── NOTE ON `t` (important for anyone extending this file) ────────────────
 * Each stroke's `t` clock resets to 0 at that stroke's own
 * onPanResponderGrant (see e.g. LetterWritingScreen.js's PanResponder) — it
 * is NOT one continuous clock across a whole multi-stroke attempt.
 * `calculateDuration()` below intentionally REPLICATES the existing
 * app-wide convention (the last point's `t`, in flattened stroke order,
 * exactly as ShapeAssessmentScreen.js's calculateFeatures() and
 * LetterWritingScreen.js's calculateDrawingFeatures() already compute
 * duration_ms/completionTime) for backward compatibility — it is
 * deliberately NOT "fixed" here, even though for a multi-stroke attempt it
 * technically only reflects the last stroke's own elapsed time rather than
 * the whole attempt's wall-clock duration. See the ML readiness audit for
 * this known, pre-existing caveat; changing it is out of scope for this
 * feature-completeness pass.
 *
 * One useful side effect of the per-stroke `t` reset: any calculation that
 * guards on `dt > 0` (calculateSegmentSpeeds, and therefore
 * calculateSpeedStats) automatically excludes stroke-boundary segments on
 * its own, because the delta at a boundary is always <= 0. Distance and
 * pause calculations don't get this for free (x/y and t-gaps don't jump
 * predictably at a boundary), so they explicitly iterate stroke-by-stroke
 * instead of flattening first.
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
 * separately within each stroke — never across a stroke boundary (Part 12).
 * Uses the exact same distance() formula as ShapeAssessmentScreen.js's
 * calculateFeatures() (sqrt((x2-x1)^2 + (y2-y1)^2)).
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
 * avg_speed = total_distance / duration_ms — the exact semantics
 * ShapeAssessmentScreen.js's calculateFeatures() already uses. Returns
 * null (never an invented number, and never a fabricated 0) when duration
 * is not strictly positive/finite, or the trajectory has fewer than 2
 * points total (Part 2: "protect against ... empty trajectory, one-point
 * trajectory" — a single point has no distance to measure a speed from,
 * so 0 would misrepresent "no data" as "measured, stationary").
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
 * with a strictly positive time delta (Part 6: "ignore invalid segments
 * where dt <= 0"). Segments spanning a stroke boundary are excluded as a
 * side effect of the dt > 0 guard — see the module doc comment.
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
 * are null when there are no valid segments; speed_cv is additionally null
 * whenever speed_mean is not strictly positive (Part 6: "speed_cv =
 * speed_std / speed_mean only when speed_mean > 0").
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
// calculateFeatures() and LetterWritingScreen.js's/
// UppercaseWritingScreen.js's calculateDrawingFeatures() exactly. Kept as
// a named default here (those three call sites are left untouched) so any
// future consolidation has one place to change.
export const DEFAULT_PAUSE_THRESHOLD_MS = 300;

/**
 * Pause metrics from consecutive, same-stroke point gaps STRICTLY GREATER
 * THAN thresholdMs (never >=  — matches the existing app-wide pause
 * definition exactly, Part 7). Computed per-stroke so a pen-up transition
 * between strokes is never counted as a pause.
 *
 * This produces IDENTICAL pause_count results to the existing
 * calculateFeatures()/calculateDrawingFeatures() flatten-then-diff
 * implementations: those flatten across strokes and diff every consecutive
 * pair, but because each stroke's `t` resets to 0 at its own start, a
 * cross-stroke pair's delta is always <= 0 there too and so is never
 * counted — this function just makes that stroke-boundary exclusion
 * explicit and intentional instead of an accidental side effect. In other
 * words: these pause metrics measure WITHIN-STROKE pauses only. Pen-up
 * time between strokes is not (and, given the current per-stroke `t`
 * clock, cannot be) measured by this function.
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

// ─── ML-safe "attempt" duration — absolute-time based ──────────────────────
//
// calculateDuration() above (and therefore avg_speed/pause_frequency/
// pause_duration_ratio) inherits a real limitation: because each stroke's
// relative `t` resets to 0 at that stroke's own start, `calculateDuration()`
// only ever reflects the LAST stroke's own elapsed time for a multi-stroke
// attempt, not the true wall-clock span of the whole attempt. Every
// captured point also carries `tAbs` (`Date.now()`, an absolute epoch-ms
// timestamp that does NOT reset between strokes — verified monotonic
// across strokes for real captured data). The functions below derive an
// ML-safe duration/speed/pause-rate family from `tAbs` instead, WITHOUT
// touching `calculateDuration()`/`calculateAverageSpeed()`/
// `calculatePauseMetrics()` above, which remain exactly as they were for
// backward compatibility with existing child-facing scoring and already-
// stored `duration_ms`/`avg_speed`/`pause_frequency`/`pause_duration_ratio`
// values.

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
 * ML-safe average speed: total_distance / attempt_duration_ms. Kept
 * distinct from calculateAverageSpeed() (which divides by the legacy,
 * possibly-truncated calculateDuration()) — both are preserved side by
 * side (Part 3).
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
 * ML-safe pause-rate pair, using attempt_duration_ms as the denominator
 * instead of the legacy calculateDuration(). Takes the already-computed
 * pause_count/total_pause_duration_ms (from calculatePauseMetrics() —
 * the underlying >300ms, within-stroke-only pause DETECTION itself is
 * unchanged, only the rate/ratio denominator differs here) rather than
 * recomputing pause detection a second time.
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
