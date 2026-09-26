'use strict';

// ── MIRROR — canonical source is auriva-backend/src/utils/unifiedShapeScore.js. ──
// Edits must be made in the canonical file FIRST, then mirrored here.
// auriva-backend/tests/unifiedShapeScoreMirrorParity.test.js requires both
// files and fails loudly if they ever disagree.
//
// Why a mirror instead of one shared file: the two packages have no shared
// workspace, and adaptive letter sequencing needs this score synchronously
// on-device right after the assessment, before any network round-trip.
//
// Written in CommonJS (module.exports/require), not this project's usual
// ES-module style, specifically so the drift test can require() this file
// directly from Node/Jest in auriva-backend without a build step — Metro/
// Babel handle CJS-from-ESM interop transparently, so `import { x } from
// './unifiedShapeScoreMirror'` from ShapeAssessmentScreen.js works exactly
// like importing any other util here.
//
// This mirror reimplements its own DTW + bounding-box normalization,
// self-contained, rather than requiring this package's ./dtw.js /
// ./dtwNormalization.js (which computeMultiStrokeDTW uses for letters).
// That was the original design — real code reuse — but ./dtw.js /
// ./dtwNormalization.js are ES modules (`export`/`import`), and
// auriva-backend's plain Jest (no Babel/ESM transform configured, and
// deliberately not adding one just for this) can't parse them when the
// parity test requires this file. Self-containment avoids that requiring a
// new backend build toolchain, matches the canonical file's own approach,
// and keeps this file's only real "mirrored" surface small and easy to
// keep in sync: shape template geometry + the invariance-search wrapper +
// the tiny DTW/normalization primitives, all in one place. ./dtw.js /
// ./dtwNormalization.js remain completely untouched and unrelated to this.

const DTW_DIVISOR        = 10;
const ROTATION_STEP_DEG  = 10;
const SMOOTHNESS_CEILING = 0.3;
const SMOOTHNESS_WEIGHT  = 0.2;
const ROTATION_INVARIANT_SHAPES = ['full_circle'];
const N_TEMPLATE_POINTS = 100;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Same geometry as the canonical file's computeShapeTemplate — also used
// directly by ShapeAssessmentScreen.js for the pointer-animation guide, so
// this is the one place shape template geometry is defined on the frontend.
function computeShapeTemplate(shapeId, canvasWidth, canvasHeight, nPoints = N_TEMPLATE_POINTS) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const pts = [];

  if (shapeId === 'horizontal_line') {
    for (let i = 0; i <= nPoints; i++) { const t = i / nPoints; pts.push({ x: cx - 200 + t * 400, y: cy }); }
  } else if (shapeId === 'vertical_line') {
    for (let i = 0; i <= nPoints; i++) { const t = i / nPoints; pts.push({ x: cx, y: cy - 150 + t * 300 }); }
  } else if (shapeId === 'full_circle') {
    const r = 120;
    for (let i = 0; i <= nPoints; i++) { const a = -Math.PI / 2 + (i / nPoints) * 2 * Math.PI; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  } else if (shapeId === 'half_circle') {
    const r = 150;
    for (let i = 0; i <= nPoints; i++) { const a = Math.PI + (i / nPoints) * Math.PI; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  } else if (shapeId === 'zigzag') {
    const nodes = [
      { x: cx - 180, y: cy + 40 }, { x: cx - 120, y: cy - 40 }, { x: cx - 60, y: cy + 40 },
      { x: cx,       y: cy - 40 }, { x: cx + 60,  y: cy + 40 }, { x: cx + 120, y: cy - 40 },
      { x: cx + 180, y: cy + 40 },
    ];
    const segs = nodes.length - 1, perSeg = Math.floor(nPoints / segs);
    for (let s = 0; s < segs; s++) {
      const from = nodes[s], to = nodes[s + 1];
      const count = s === segs - 1 ? nPoints - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) { const t = i / (count > 1 ? count - 1 : 1); pts.push({ x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) }); }
    }
  } else if (shapeId === 'curve_wave') {
    const segs = [
      { p0: { x: cx - 180, y: cy }, p1: { x: cx - 120, y: cy - 60 }, p2: { x: cx - 60, y: cy } },
      { p0: { x: cx - 60,  y: cy }, p1: { x: cx,       y: cy + 60 }, p2: { x: cx + 60, y: cy } },
      { p0: { x: cx + 60,  y: cy }, p1: { x: cx + 120, y: cy - 60 }, p2: { x: cx + 180, y: cy } },
    ];
    const perSeg = Math.floor(nPoints / 3);
    for (let s = 0; s < 3; s++) {
      const { p0, p1, p2 } = segs[s];
      const count = s === 2 ? nPoints - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) {
        const t = i / (count > 1 ? count - 1 : 1);
        pts.push({
          x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
          y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
        });
      }
    }
  }
  return pts;
}

// Bounding-box normalization — same method as ./dtwNormalization.js
// (translate + scale to a 100-unit box, order-invariant since it only uses
// min/max), reimplemented here for self-containment (see file header).
function normalizePoints(points, targetSize = 100) {
  if (!Array.isArray(points) || points.length === 0) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return points.map(p => ({ ...p }));
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = span > 1e-6 ? targetSize / span : 1;
  return points.map(p => ({ ...p, x: (p.x - minX) * scale, y: (p.y - minY) * scale }));
}

// Same DP algorithm as ./dtw.js's computeDTW, reimplemented here for
// self-containment (see file header).
function computeDtw(seqA, seqB) {
  if (!seqA || !seqB || seqA.length < 2 || seqB.length < 2) return null;
  const n = seqA.length, m = seqB.length;
  const cost = new Float64Array(n * m);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  cost[0] = dist(seqA[0], seqB[0]);
  for (let i = 1; i < n; i++) cost[i * m] = cost[(i - 1) * m] + dist(seqA[i], seqB[0]);
  for (let j = 1; j < m; j++) cost[j] = cost[j - 1] + dist(seqA[0], seqB[j]);
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const left = cost[i * m + (j - 1)], down = cost[(i - 1) * m + j], diag = cost[(i - 1) * m + (j - 1)];
      cost[i * m + j] = dist(seqA[i], seqB[j]) + Math.min(left, down, diag);
    }
  }
  const distance = cost[n * m - 1];

  let i = n - 1, j = m - 1, pathLen = 1;
  while (i > 0 || j > 0) {
    if (i === 0) j--;
    else if (j === 0) i--;
    else {
      const left = cost[i * m + (j - 1)], down = cost[(i - 1) * m + j], diag = cost[(i - 1) * m + (j - 1)];
      if (diag <= left && diag <= down) { i--; j--; }
      else if (left <= down) j--;
      else i--;
    }
    pathLen++;
  }
  return distance / pathLen;
}

function rotateTemplate(template, shiftPoints) {
  return [...template.slice(shiftPoints), ...template.slice(0, shiftPoints)];
}

function computeInvariantDtwDistance(childPoints, shapeId, canvasWidth, canvasHeight) {
  if (!Array.isArray(childPoints) || childPoints.length < 2) return null;
  const template = computeShapeTemplate(shapeId, canvasWidth, canvasHeight);
  if (template.length < 2) return null;

  const normChildFwd = normalizePoints(childPoints);
  const normChildRev = [...normChildFwd].reverse();

  const rotationShifts = ROTATION_INVARIANT_SHAPES.includes(shapeId)
    ? Array.from({ length: Math.round(360 / ROTATION_STEP_DEG) }, (_, k) => Math.round((k * ROTATION_STEP_DEG / 360) * N_TEMPLATE_POINTS))
    : [0];

  let best = Infinity;
  for (const shift of rotationShifts) {
    const rotated = shift === 0 ? template : rotateTemplate(template, shift);
    const normTemplate = normalizePoints(rotated);
    const fwd = computeDtw(normChildFwd, normTemplate);
    const rev = computeDtw(normChildRev, normTemplate);
    if (fwd != null && fwd < best) best = fwd;
    if (rev != null && rev < best) best = rev;
  }
  return Number.isFinite(best) ? best : null;
}

function computeUnifiedShapeScore(dtwDistance, smoothnessRaw) {
  const dtwScore = dtwDistance == null ? null : clamp(100 - (dtwDistance / DTW_DIVISOR) * 100, 0, 100);
  const smoothnessScore = smoothnessRaw == null ? null : clamp(100 - (smoothnessRaw / SMOOTHNESS_CEILING) * 100, 0, 100);

  if (dtwScore == null && smoothnessScore == null) return { motor_score: null, dtw_score: null, smoothness_score: null };
  if (dtwScore == null) return { motor_score: Math.round(smoothnessScore), dtw_score: null, smoothness_score: Math.round(smoothnessScore) };
  if (smoothnessScore == null) return { motor_score: Math.round(dtwScore), dtw_score: Math.round(dtwScore), smoothness_score: null };

  const motor_score = (1 - SMOOTHNESS_WEIGHT) * dtwScore + SMOOTHNESS_WEIGHT * smoothnessScore;
  return {
    motor_score: Math.round(clamp(motor_score, 0, 100)),
    dtw_score: Math.round(dtwScore),
    smoothness_score: Math.round(smoothnessScore),
  };
}

module.exports = {
  DTW_DIVISOR, ROTATION_STEP_DEG, SMOOTHNESS_CEILING, SMOOTHNESS_WEIGHT,
  ROTATION_INVARIANT_SHAPES, N_TEMPLATE_POINTS,
  computeShapeTemplate, computeInvariantDtwDistance, computeUnifiedShapeScore,
};
