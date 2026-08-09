/**
 * Developer-only DTW debug export.
 *
 * Bundles everything needed to inspect a single DTW comparison — raw and
 * normalized coordinates for both sides, the resulting distance/order
 * metadata, and the derived quality score — into one object so it can be
 * logged or written to a file during development. Never sent to the
 * backend and never used by production scoring; callers must gate calls to
 * this module behind `if (__DEV__)`.
 *
 * @param {Object} params
 * @param {Array<Array<{x:number,y:number}>>} params.childStrokes — raw child path (array of strokes)
 * @param {Array<{x:number,y:number}>} params.templatePoints — raw template path (flat points, already sampled to pixels)
 * @param {{normalizedDistance: number|null, strokeOrderMeta: Object|null}} [params.dtwResult]
 * @param {number|null} [params.qualityScore]
 * @returns {{
 *   raw_child_path: Array,
 *   template_path: Array,
 *   normalized_child_path: Array,
 *   normalized_template_path: Array,
 *   dtw_distance: number|null,
 *   stroke_order_meta: Object|null,
 *   quality_score: number|null,
 * }}
 */
import { normalizeStrokesForDTW, normalizePointsForDTW } from './dtwNormalization';

export function buildDtwDebugExport({ childStrokes, templatePoints, dtwResult, qualityScore }) {
  return {
    raw_child_path: childStrokes ?? [],
    template_path: templatePoints ?? [],
    normalized_child_path: normalizeStrokesForDTW(childStrokes ?? []),
    normalized_template_path: normalizePointsForDTW(templatePoints ?? []),
    dtw_distance: dtwResult?.normalizedDistance ?? null,
    stroke_order_meta: dtwResult?.strokeOrderMeta ?? null,
    quality_score: qualityScore ?? null,
  };
}
