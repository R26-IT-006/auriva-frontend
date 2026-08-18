/**
 * motorScoreV2Candidate.js
 *
 * ═══════════════════════════════════════════════════════════════════════
 * RESEARCH / OFFLINE CANDIDATE MODULE — NOT PRODUCTION CODE.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This module is NEVER imported by any live screen, controller, service,
 * or route. It exists purely to design, compute, and test a candidate
 * `motor_score_v2` for the Initial Motor Assessment, entirely offline —
 * see the "Auriva — Initial Assessment Motor Score V2" task report for the
 * full audit. It reads raw x/y/t/stroke_id data exactly the same shape
 * `calculateFeatures(paths, shapeId)` (ShapeAssessmentScreen.js) already
 * accepts, and reuses this project's ALREADY-EXISTING pure utilities
 * wherever possible instead of duplicating them:
 *   - trajectoryFeatures.js: calculateTotalDistance, calculatePauseMetrics
 *     (pause_duration_ratio — the ratio-based pause measure this module
 *     needs already exists there, computed from the exact same >300ms rule
 *     production code uses).
 *   - dtwNormalization.js / dtw.js: normalizePointsForDTW,
 *     normalizeStrokesForDTW, computeDTW — the SAME device-size-invariant
 *     normalization already used for zigzag/curve_wave in V1.
 *
 * The shape-template constants below (SHAPE_TEMPLATES) mirror
 * ShapeAssessmentScreen.js's computePathPoints()/SHAPE_STARTS numerically
 * — that function is screen-local and not exported, so it is intentionally
 * duplicated here (same convention already used in
 * initialAssessmentScoringAudit.test.js's coverage-blindness proof). Any
 * future change to the real template geometry must be mirrored here too.
 *
 * Every score in this module is 0-100, higher = stronger observed
 * execution, deterministic, and non-clinical — see the report's own
 * "Score component interpretability" section for the full contract.
 */

'use strict';

import { calculateTotalDistance, calculatePauseMetrics } from '../utils/trajectoryFeatures';
import { normalizePointsForDTW, normalizeStrokesForDTW } from '../utils/dtwNormalization';
import { computeDTW } from '../utils/dtw';

export const CANDIDATE_VERSION = 'motor_score_v2_candidate_r1';

// ─── Shape template geometry (mirrors ShapeAssessmentScreen.js) ────────────
//
// computePathPoints() there builds these from CANVAS_CX/CANVAS_CY (canvas
// center, which DOES move with canvas size) plus FIXED absolute-pixel
// offsets (200/150/120/150) that do NOT scale with canvas size — confirmed
// by source read. This module's "normalized" components exist precisely
// because raw pixel values inherit that device-size dependency; see
// computeNormalizedAccuracy() below.
const LINE_HALF_SPAN = { horizontal_line: 200, vertical_line: 150 };
const CIRCLE_RADIUS = { full_circle: 120, half_circle: 150 };
// angleStart/angleSpan match computePathPoints() exactly: full_circle runs
// a full turn starting at -90deg (top); half_circle runs a half turn
// starting at 180deg (left), i.e. the BOTTOM half of the circle.
const CIRCLE_ANGLE = {
  full_circle: { start: -Math.PI / 2, span: 2 * Math.PI },
  half_circle: { start: Math.PI,      span: Math.PI },
};

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/**
 * Live data finding (this audit): the PERSISTED shape format
 * (`HandwritingAssessment.shapes[i].strokes`, confirmed by direct read of
 * production data) is `[{stroke_id, points:[{x,y,t,tAbs,stroke_id}]}]` —
 * an array of stroke OBJECTS — which differs from the in-memory capture
 * format `ShapeAssessmentScreen.js` itself uses while a shape is being
 * drawn (`[[{x,y,t,tAbs,stroke_id}], ...]`, a plain array of point
 * arrays). Both are accepted here, normalized to the plain array-of-arrays
 * shape every function in this module (and the reused
 * trajectoryFeatures.js/dtw.js utilities) expects — mirrors the backend's
 * own `flattenStrokePoints()` in motorScore.js, which exists for exactly
 * this reason. A candidate synthesizing this module against live JSON
 * without this step would silently see zero distance/pauses/continuity
 * for every real record — this was caught and fixed via the live-data
 * comparison itself, not assumed.
 */
function normalizeStrokesShape(strokes) {
  if (!Array.isArray(strokes)) return [];
  if (strokes.length === 0) return [];
  if (Array.isArray(strokes[0])) return strokes; // already array-of-arrays
  if (strokes[0] && Array.isArray(strokes[0].points)) return strokes.map(s => s.points); // persisted {stroke_id, points} shape
  return [strokes]; // a single flat point array was passed directly
}

/** Builds the same 101-point template computePathPoints() would, at the
 * given canvas center — used only for arc-length-ratio coverage
 * (zigzag/curve_wave) and for max-deviation diagnostics. Mirrors that
 * function's math exactly; see module header. */
function buildTemplatePoints(shapeId, cx, cy) {
  const pts = [];
  const N = 100;
  if (shapeId === 'horizontal_line') {
    for (let i = 0; i <= N; i++) pts.push({ x: cx - 200 + (i / N) * 400, y: cy });
  } else if (shapeId === 'vertical_line') {
    for (let i = 0; i <= N; i++) pts.push({ x: cx, y: cy - 150 + (i / N) * 300 });
  } else if (shapeId === 'full_circle') {
    const r = 120;
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI / 2 + (i / N) * 2 * Math.PI;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  } else if (shapeId === 'half_circle') {
    const r = 150;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * Math.PI;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  } else if (shapeId === 'zigzag') {
    const nodes = [
      { x: cx - 180, y: cy + 40 }, { x: cx - 120, y: cy - 40 }, { x: cx - 60, y: cy + 40 },
      { x: cx, y: cy - 40 }, { x: cx + 60, y: cy + 40 }, { x: cx + 120, y: cy - 40 }, { x: cx + 180, y: cy + 40 },
    ];
    const segs = nodes.length - 1;
    const perSeg = Math.floor(N / segs);
    for (let s = 0; s < segs; s++) {
      const from = nodes[s], to = nodes[s + 1];
      const count = s === segs - 1 ? N - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) {
        const t = i / (count > 1 ? count - 1 : 1);
        pts.push({ x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) });
      }
    }
  } else if (shapeId === 'curve_wave') {
    const segs = [
      { p0: { x: cx - 180, y: cy }, p1: { x: cx - 120, y: cy - 60 }, p2: { x: cx - 60, y: cy } },
      { p0: { x: cx - 60, y: cy }, p1: { x: cx, y: cy + 60 }, p2: { x: cx + 60, y: cy } },
      { p0: { x: cx + 60, y: cy }, p1: { x: cx + 120, y: cy - 60 }, p2: { x: cx + 180, y: cy } },
    ];
    const perSeg = Math.floor(N / 3);
    for (let s = 0; s < 3; s++) {
      const { p0, p1, p2 } = segs[s];
      const count = s === 2 ? N - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) {
        const t = i / (count > 1 ? count - 1 : 1);
        pts.push({
          x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
          y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
        });
      }
    }
  }
  return pts;
}

function arcLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════
// A. NORMALIZED PATH ACCURACY
// ═══════════════════════════════════════════════════════════════════════
//
// Two alternative normalizations are computed side by side so the report
// can compare them empirically (per the task's explicit instruction) —
// only `byTemplate` is used in the candidate composition below, chosen
// because the device-size synthetic test (see test file) shows it stays
// stable while `byCanvasDiagonal` does not, for THIS codebase's specific
// template geometry (fixed absolute-pixel template offsets — see module
// header). A future codebase where templates scale with canvas would need
// this choice revisited.
export function computeNormalizedAccuracy({ shapeId, points, cx, cy }) {
  if (!Array.isArray(points) || points.length === 0) return null;

  let rawSum = 0;
  let referenceDimension = null; // the shape's own characteristic size, in the SAME px units as rawSum

  if (shapeId === 'horizontal_line') {
    rawSum = points.reduce((s, p) => s + Math.abs(p.y - cy), 0);
    referenceDimension = LINE_HALF_SPAN.horizontal_line * 2; // full line length
  } else if (shapeId === 'vertical_line') {
    rawSum = points.reduce((s, p) => s + Math.abs(p.x - cx), 0);
    referenceDimension = LINE_HALF_SPAN.vertical_line * 2;
  } else if (shapeId === 'full_circle' || shapeId === 'half_circle') {
    const r = CIRCLE_RADIUS[shapeId];
    rawSum = points.reduce((s, p) => s + Math.abs(Math.hypot(p.x - cx, p.y - cy) - r), 0);
    referenceDimension = r;
  } else {
    return null; // zigzag/curve_wave already use device-size-invariant DTW normalization (dtw_norm_v1) — see §11 of the report
  }

  const rawMeanDeviation = rawSum / points.length;
  const ratioByTemplate = rawMeanDeviation / referenceDimension;

  return {
    rawMeanDeviation,                                  // same value V1's `accuracy` computes, for direct comparison
    ratioByTemplate,                                   // deviation as a fraction of the shape's own size — device-size-invariant for THIS codebase
    // score: a 15%-of-shape-size deviation is treated as "worst" — a
    // conservative pilot default (same disclaimer style as V1's
    // ACCURACY_MAX_PX/DTW_CAP), NOT clinically validated, subject to
    // recalibration once more real assessment volume exists.
    score: Math.round(100 * (1 - clamp(ratioByTemplate / 0.15, 0, 1))),
  };
}

/** Alternative normalization for empirical comparison only (§13 of the
 * report) — divides by the canvas diagonal instead of the template's own
 * dimension. Not used in the candidate composition; see comment above. */
export function computeCanvasDiagonalNormalizedAccuracy({ shapeId, points, cx, cy, canvasWidth, canvasHeight }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let rawSum = 0;
  if (shapeId === 'horizontal_line') rawSum = points.reduce((s, p) => s + Math.abs(p.y - cy), 0);
  else if (shapeId === 'vertical_line') rawSum = points.reduce((s, p) => s + Math.abs(p.x - cx), 0);
  else if (shapeId === 'full_circle' || shapeId === 'half_circle') {
    const r = CIRCLE_RADIUS[shapeId];
    rawSum = points.reduce((s, p) => s + Math.abs(Math.hypot(p.x - cx, p.y - cy) - r), 0);
  } else return null;

  const rawMeanDeviation = rawSum / points.length;
  const diagonal = Math.hypot(canvasWidth, canvasHeight);
  const ratioByCanvasDiagonal = rawMeanDeviation / diagonal;
  return { rawMeanDeviation, ratioByCanvasDiagonal, score: Math.round(100 * (1 - clamp(ratioByCanvasDiagonal / 0.05, 0, 1))) };
}

// ═══════════════════════════════════════════════════════════════════════
// B. PATH COVERAGE / COMPLETION
// ═══════════════════════════════════════════════════════════════════════

/** Lines: fraction of the template's own axis span actually covered by the
 * child's point cloud (min/max projection onto the line's axis) — immune
 * to a child scribbling back and forth over one short segment
 * accumulating distance without covering more of the line. */
export function computeLineCoverage({ shapeId, points, cx, cy }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const axisIsX = shapeId === 'horizontal_line';
  const center = axisIsX ? cx : cy;
  const halfSpan = LINE_HALF_SPAN[shapeId];
  if (halfSpan == null) return null;

  const projections = points.map(p => (axisIsX ? p.x : p.y) - center); // signed offset from center, in [-halfSpan, +halfSpan] for a perfect trace
  const min = Math.min(...projections);
  const max = Math.max(...projections);
  // Coverage = how much of the [-halfSpan, +halfSpan] template range the
  // child's own [min,max] span overlaps — clamped so drawing past either
  // end doesn't earn MORE than 100%.
  const coveredMin = clamp(min, -halfSpan, halfSpan);
  const coveredMax = clamp(max, -halfSpan, halfSpan);
  const coveredSpan = Math.max(0, coveredMax - coveredMin);
  const ratio = coveredSpan / (halfSpan * 2);
  return { ratio, score: Math.round(100 * clamp(ratio, 0, 1)) };
}

/** Circles: angular-bin coverage — divides the template's expected angular
 * span into bins and counts how many bins have at least one point
 * reasonably near the ideal radius. Deliberately separate from accuracy:
 * a small, perfectly-drawn arc scores well on accuracy/deviation but
 * poorly here, exactly distinguishing "accurate but incomplete" (the V1
 * gap this task exists to close). */
export function computeAngularCoverage({ shapeId, points, cx, cy, binCount = 16, radiusToleranceRatio = 0.35 }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const r = CIRCLE_RADIUS[shapeId];
  const { start, span } = CIRCLE_ANGLE[shapeId] ?? {};
  if (r == null || start == null) return null;

  const bins = new Array(binCount).fill(false);
  const tolerance = r * radiusToleranceRatio; // generous — coverage should not double-penalize a wide radius deviation already captured by accuracy
  for (const p of points) {
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (Math.abs(dist - r) > tolerance) continue; // too far off-radius to plausibly be "on" this arc at all
    let angle = Math.atan2(p.y - cy, p.x - cx);
    // Normalize angle into [start, start+span) so it maps onto this
    // shape's own expected bin range regardless of atan2's [-pi,pi] wrap.
    let rel = angle - start;
    while (rel < 0) rel += 2 * Math.PI;
    while (rel >= 2 * Math.PI) rel -= 2 * Math.PI;
    if (rel > span + 1e-6) continue; // outside the expected arc entirely (e.g. half_circle's untraced top half)
    const bin = Math.min(binCount - 1, Math.floor((rel / span) * binCount));
    bins[bin] = true;
  }
  const covered = bins.filter(Boolean).length;
  const ratio = covered / binCount;
  return { ratio, coveredBins: covered, totalBins: binCount, score: Math.round(100 * ratio) };
}

/** Zigzag/curve_wave: arc-length ratio — child's own total traced distance
 * relative to the template's own total arc length. Simple, robust,
 * matches the task's own suggested "path/template progression" option. */
export function computeArcLengthCoverage({ shapeId, strokes, cx, cy }) {
  const template = buildTemplatePoints(shapeId, cx, cy);
  const templateLen = arcLength(template);
  if (templateLen <= 0) return null;
  const childLen = calculateTotalDistance(strokes);
  const ratio = clamp(childLen / templateLen, 0, 1); // clamp at 1 — excessive back-and-forth distance must not read as ">100% covered"
  return { ratio, score: Math.round(100 * ratio) };
}

// ═══════════════════════════════════════════════════════════════════════
// C. STROKE CONTINUITY
// ═══════════════════════════════════════════════════════════════════════
//
// Every one of the six shapes is a single continuous template stroke (no
// multi-stroke shape exists in this battery — confirmed via
// computePathPoints()), so "expected stroke count" = 1 for all six.
// Deliberately conservative: one extra unplanned lift costs 15 points, not
// a catastrophic penalty, and never floors below 40 for a genuine attempt
// (a still-recognizable, if imperfectly executed, trace) — a fixed pilot
// default, not clinically validated.
export function computeContinuityScore(strokeCount) {
  if (!Number.isFinite(strokeCount) || strokeCount <= 0) return null;
  if (strokeCount === 1) return 100;
  return Math.round(clamp(100 - (strokeCount - 1) * 15, 40, 100));
}

// ═══════════════════════════════════════════════════════════════════════
// D. PAUSE BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════
//
// Reuses trajectoryFeatures.js's calculatePauseMetrics() verbatim — no
// duplicate pause-detection logic. pause_duration_ratio (fraction of total
// attempt time spent inside a >300ms gap) is used rather than raw
// pause_count, specifically BECAUSE it is duration-normalized: a slow but
// continuously-moving trace has pause_duration_ratio ≈ 0 regardless of how
// long it took (no >300ms gaps exist), while repeated real stops
// accumulate a meaningfully large ratio — directly satisfying "distinguish
// slow continuous movement from repeated stopping" without penalizing
// slowness itself.
export function computePauseControlScoreV2(strokes) {
  const { pause_duration_ratio } = calculatePauseMetrics(strokes);
  if (pause_duration_ratio == null) return null;
  // A trace spending 40%+ of its total time paused is treated as "worst" —
  // conservative pilot default, not clinically validated.
  return Math.round(100 * (1 - clamp(pause_duration_ratio / 0.4, 0, 1)));
}

// ═══════════════════════════════════════════════════════════════════════
// E. DIRECTION / REVERSAL CONSISTENCY — shape-specific, lines/circles ONLY
// ═══════════════════════════════════════════════════════════════════════
//
// Deliberately NOT computed for zigzag/curve_wave — those shapes legitimately
// reverse direction by design (that IS the template), so a generic
// reversal-density penalty would be actively wrong for them. Returns null
// (not a low score — "not applicable", never silently treated as 0) for
// those two shapes.
const REVERSAL_ANGLE_RAD = Math.PI / 2;

export function computeDirectionConsistencyScore(shapeId, points) {
  if (shapeId === 'zigzag' || shapeId === 'curve_wave') return null; // not meaningful — see header
  if (!Array.isArray(points) || points.length < 3) return null;

  let reversals = 0, angleCount = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const v1x = points[i].x - points[i - 1].x, v1y = points[i].y - points[i - 1].y;
    const v2x = points[i + 1].x - points[i].x, v2y = points[i + 1].y - points[i].y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 === 0 || l2 === 0) continue;
    const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
    const angle = Math.acos(clamp(dot, -1, 1));
    angleCount++;
    if (angle > REVERSAL_ANGLE_RAD) reversals++;
  }
  if (angleCount === 0) return null;
  // A quarter of all segments being sharp reversals is treated as
  // "worst" — same conservative-default discipline as elsewhere.
  return Math.round(100 * (1 - clamp((reversals / angleCount) / 0.25, 0, 1)));
}

// ═══════════════════════════════════════════════════════════════════════
// F. SMOOTHNESS
// ═══════════════════════════════════════════════════════════════════════
//
// Retained as a real, separately-weighted component (not folded silently
// into accuracy the way V1 does) — but because coverage (§B) is now always
// part of the composed score, an incomplete-but-smooth trace can no longer
// inflate the total the way V1 allows.
const SMOOTHNESS_MAX_RAD = 1.0; // matches backend motorScore.js's own constant exactly

export function computeSmoothnessScoreV2(smoothnessRadians) {
  if (smoothnessRadians == null || !Number.isFinite(smoothnessRadians)) return null;
  return Math.round(100 * (1 - clamp(smoothnessRadians / SMOOTHNESS_MAX_RAD, 0, 1)));
}

// ═══════════════════════════════════════════════════════════════════════
// G. CIRCLE CLOSURE — full_circle ONLY
// ═══════════════════════════════════════════════════════════════════════
//
// Never applied to half_circle (its two ends are SUPPOSED to be far apart —
// opposite ends of the diameter — closure is meaningless there, per the
// task's explicit instruction).
export function computeClosureScore(shapeId, points) {
  if (shapeId !== 'full_circle') return null;
  if (!Array.isArray(points) || points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  const ratio = gap / CIRCLE_RADIUS.full_circle;
  // A closure gap equal to a full radius is treated as "worst" —
  // conservative pilot default.
  return Math.round(100 * (1 - clamp(ratio, 0, 1)));
}

// ═══════════════════════════════════════════════════════════════════════
// MAX DEVIATION — diagnostic only, never part of any composed score (§5)
// ═══════════════════════════════════════════════════════════════════════
export function computeMaxDeviation({ shapeId, points, cx, cy }) {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (shapeId === 'horizontal_line') return Math.max(...points.map(p => Math.abs(p.y - cy)));
  if (shapeId === 'vertical_line') return Math.max(...points.map(p => Math.abs(p.x - cx)));
  if (shapeId === 'full_circle' || shapeId === 'half_circle') {
    const r = CIRCLE_RADIUS[shapeId];
    return Math.max(...points.map(p => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)));
  }
  return null; // zigzag/curve_wave: no single-axis/radius "deviation" concept applies the same way
}

// ═══════════════════════════════════════════════════════════════════════
// DTW-based accuracy for zigzag/curve_wave (reuses V1's own normalized DTW
// pipeline verbatim — already device-size-invariant, nothing to redesign)
// ═══════════════════════════════════════════════════════════════════════
function computeDtwAccuracyScore(shapeId, strokes, cx, cy) {
  const template = buildTemplatePoints(shapeId, cx, cy);
  const normTemplate = normalizePointsForDTW(template);
  const normChild = normalizeStrokesForDTW(strokes).flat().map(p => ({ x: p.x, y: p.y }));
  const { normalizedDistance } = computeDTW(normChild, normTemplate);
  if (normalizedDistance == null) return null;
  const DTW_CAP = 45; // matches adaptiveSequencing.js's own DTW_CAP exactly
  return Math.round(100 * (1 - clamp(normalizedDistance / DTW_CAP, 0, 1)));
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT EVALUATION — one shape, every applicable component
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {{shapeId: string, strokes: Array<Array<{x,y,t,tAbs,stroke_id}>>, canvasWidth: number, canvasHeight: number, smoothness?: number}} params
 * @returns {Object} every 0-100 component score (or null when not
 *   applicable to this shape), plus raw diagnostics (maxDeviation, the two
 *   normalization alternatives for §13's comparison).
 */
export function evaluateShapeComponents({ shapeId, strokes: rawStrokes, canvasWidth, canvasHeight, smoothness = null }) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  // Accept either the in-memory capture shape or the persisted
  // {stroke_id, points} shape — see normalizeStrokesShape()'s doc comment.
  const strokes = normalizeStrokesShape(rawStrokes);
  const points = strokes.flat();
  const isDtwShape = shapeId === 'zigzag' || shapeId === 'curve_wave';

  const normalizedAccuracy = isDtwShape ? null : computeNormalizedAccuracy({ shapeId, points, cx, cy });
  const canvasDiagAccuracy = isDtwShape ? null : computeCanvasDiagonalNormalizedAccuracy({ shapeId, points, cx, cy, canvasWidth, canvasHeight });
  const dtwAccuracyScore = isDtwShape ? computeDtwAccuracyScore(shapeId, strokes, cx, cy) : null;

  const coverage = isDtwShape
    ? computeArcLengthCoverage({ shapeId, strokes, cx, cy })
    : (shapeId === 'full_circle' || shapeId === 'half_circle')
      ? computeAngularCoverage({ shapeId, points, cx, cy })
      : computeLineCoverage({ shapeId, points, cx, cy });

  return {
    pathAccuracyScore: isDtwShape ? dtwAccuracyScore : normalizedAccuracy?.score ?? null,
    coverageScore: coverage?.score ?? null,
    continuityScore: computeContinuityScore(strokes.length || null),
    pauseControlScore: computePauseControlScoreV2(strokes),
    directionConsistencyScore: computeDirectionConsistencyScore(shapeId, points),
    smoothnessScore: computeSmoothnessScoreV2(smoothness),
    closureScore: computeClosureScore(shapeId, points),
    // Diagnostics only — never fed into any composed score.
    maxDeviation: computeMaxDeviation({ shapeId, points, cx, cy }),
    normalizedAccuracyDiagnostics: normalizedAccuracy,
    canvasDiagonalAccuracyDiagnostics: canvasDiagAccuracy,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CANDIDATE COMPOSITION SCHEMES
// ═══════════════════════════════════════════════════════════════════════
//
// Null-aware weighting (same discipline as backend motorScore.js): a
// component that's null (not applicable to this shape, e.g. closure on a
// line) is dropped and the remaining weights renormalize — never treated
// as 0.

function composeWeighted(components, weights) {
  let weightedSum = 0, weightTotal = 0;
  for (const key of Object.keys(weights)) {
    const value = components[key];
    if (value == null) continue;
    weightedSum += weights[key] * value;
    weightTotal += weights[key];
  }
  if (weightTotal === 0) return null;
  return Math.round(clamp(weightedSum / weightTotal, 0, 100));
}

// Candidate A — minimal conservative: fixes ONLY the #1 confirmed defect
// (coverage blindness) while staying as close to V1's spirit as possible.
export const CANDIDATE_A_WEIGHTS = {
  pathAccuracyScore: 0.6,
  coverageScore:     0.4,
};

// Candidate B — balanced: adds pause/continuity/direction/closure, still
// keeping path accuracy + coverage as the two largest components.
export const CANDIDATE_B_WEIGHTS = {
  pathAccuracyScore:        0.35,
  coverageScore:            0.30,
  pauseControlScore:        0.15,
  continuityScore:          0.10,
  directionConsistencyScore:0.10,
};

// Candidate C — richer/exploratory: adds smoothness and closure as
// explicit separate components. More components than B; NOT the
// recommended candidate (see report §33) — included for completeness per
// the task's "Candidate C if created" allowance.
export const CANDIDATE_C_WEIGHTS = {
  pathAccuracyScore:         0.30,
  coverageScore:             0.25,
  pauseControlScore:         0.15,
  continuityScore:           0.10,
  directionConsistencyScore: 0.10,
  smoothnessScore:           0.05,
  closureScore:              0.05,
};

export function evaluateCandidates(components) {
  return {
    candidateA: composeWeighted(components, CANDIDATE_A_WEIGHTS),
    candidateB: composeWeighted(components, CANDIDATE_B_WEIGHTS),
    candidateC: composeWeighted(components, CANDIDATE_C_WEIGHTS),
  };
}

/** Convenience one-shot entry point: components + all three candidate scores. */
export function evaluateShapeCandidate(params) {
  const components = evaluateShapeComponents(params);
  return { components, ...evaluateCandidates(components) };
}
