/**
 * Coordinate normalization for DTW handwriting scoring.
 *
 * Problem: DTW previously compared raw device-pixel coordinates. Templates
 * and child strokes were both sampled/captured in absolute canvas pixels,
 * which vary by screen size (letters) or aren't scaled to the canvas at all
 * (zigzag/curve_wave). Identical handwriting quality therefore produced
 * different dtw_distance values on different devices, and a child who wrote
 * a letter larger/smaller/shifted than the template was unfairly penalized
 * even when the *shape* was correct.
 *
 * Fix: before DTW runs, both the child path and the template path are each
 * independently translated to their own bounding-box origin and uniformly
 * scaled (aspect ratio preserved) so their larger bounding-box dimension
 * maps to NORMALIZED_SIZE. This removes device/canvas-size and
 * position/size differences while still penalizing genuine shape errors
 * (stretching x and y independently would hide those, so scaling is
 * uniform, not per-axis).
 *
 * NORMALIZATION_VERSION is bumped whenever this method changes, so stored
 * dtw_distance values can be grouped by which normalization produced them.
 */

export const NORMALIZATION_VERSION = 'dtw_norm_v1';
export const NORMALIZED_SIZE = 100;

/**
 * Normalizes an array-of-strokes path (each stroke: array of {x, y, ...}).
 * Stroke boundaries are preserved (same array-of-arrays shape in, shape
 * out); only x/y are rewritten, every other field (t, tAbs, stroke_id, ...)
 * is copied through untouched. Never mutates the input.
 *
 * The bounding box is computed once across ALL points in ALL strokes, so
 * every stroke is translated/scaled by the same transform — relative
 * stroke position and size within the letter/shape is preserved.
 *
 * @param {Array<Array<{x:number,y:number}>>} strokes
 * @param {number} targetSize
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function normalizeStrokesForDTW(strokes, targetSize = NORMALIZED_SIZE) {
  if (!Array.isArray(strokes) || strokes.length === 0) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    for (const p of stroke) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  // No finite points at all (empty/degenerate input) — return same shape,
  // untransformed, rather than throwing on Infinity arithmetic.
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return strokes.map(stroke => (Array.isArray(stroke) ? stroke.map(p => ({ ...p })) : stroke));
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const span = Math.max(width, height);
  // Degenerate bbox (single point, or a perfectly straight line along one
  // axis with zero extent on the other): fall back to scale 1 rather than
  // dividing by zero. The resulting distance against a non-degenerate
  // template will still be a real (large) number, never a fabricated 0.
  const scale = span > 1e-6 ? targetSize / span : 1;

  return strokes.map(stroke => {
    if (!Array.isArray(stroke)) return stroke;
    return stroke.map(p => ({
      ...p,
      x: (p.x - minX) * scale,
      y: (p.y - minY) * scale,
    }));
  });
}

/**
 * Convenience wrapper for a single flat point array (e.g. a concatenated
 * template or a single-stroke child path) instead of an array-of-strokes.
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {number} targetSize
 * @returns {Array<{x:number,y:number}>}
 */
export function normalizePointsForDTW(points, targetSize = NORMALIZED_SIZE) {
  if (!Array.isArray(points)) return [];
  return normalizeStrokesForDTW([points], targetSize)[0] ?? [];
}
