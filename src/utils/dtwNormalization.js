/**
 * Coordinate normalization for DTW handwriting scoring.
 *
 * Before DTW runs, the child path and the template path are each translated
 * to their own bounding-box origin and scaled uniformly (aspect ratio
 * preserved) so their larger bounding-box dimension maps to NORMALIZED_SIZE.
 * This removes device/canvas size, position and overall letter size from
 * dtw_distance. Scaling is uniform, not per-axis: stretching x and y
 * independently would hide genuine shape errors.
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
  // Degenerate bbox (all points coincide, so both width and height are ~0):
  // fall back to scale 1 rather than dividing by zero. A straight line along
  // one axis still has a non-zero span and is scaled normally. The resulting
  // distance against a non-degenerate template is still a real (large)
  // number, never a fabricated 0.
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
