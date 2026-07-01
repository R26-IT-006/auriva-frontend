/**
 * Dynamic Time Warping — pure JavaScript, no dependencies.
 *
 * Complexity: O(n × m) time and space, where n = child points, m = template points.
 * Typical call: 60 template × ≤500 child = 30,000 cells — well under 1 ms on a
 * modern JS engine.  Safe to call synchronously inside handleNext().
 *
 * @param {Array<{x: number, y: number}>} seqA  — child stroke points
 * @param {Array<{x: number, y: number}>} seqB  — template points
 * @returns {{ distance: number|null, normalizedDistance: number|null }}
 *   distance           — raw accumulated cost along the optimal warping path
 *   normalizedDistance — distance ÷ warping path length (comparable across
 *                        letters of different complexity)
 *   Both values are null when either input has fewer than 2 points.
 */
export function computeDTW(seqA, seqB) {
  if (!seqA || !seqB || seqA.length < 2 || seqB.length < 2) {
    return { distance: null, normalizedDistance: null };
  }

  const n = seqA.length;
  const m = seqB.length;

  // Flat Float64Array is faster than a 2-D array for the sizes we use
  const cost = new Float64Array(n * m);

  // Euclidean distance between two {x, y} points
  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Fill DP table
  cost[0] = dist(seqA[0], seqB[0]);

  for (let i = 1; i < n; i++) {
    cost[i * m] = cost[(i - 1) * m] + dist(seqA[i], seqB[0]);
  }
  for (let j = 1; j < m; j++) {
    cost[j] = cost[j - 1] + dist(seqA[0], seqB[j]);
  }
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const left  = cost[i * m + (j - 1)];
      const down  = cost[(i - 1) * m + j];
      const diag  = cost[(i - 1) * m + (j - 1)];
      const min3  = left < down ? (left < diag ? left : diag) : (down < diag ? down : diag);
      cost[i * m + j] = dist(seqA[i], seqB[j]) + min3;
    }
  }

  const distance = cost[n * m - 1];

  // Trace back to measure warping path length (number of steps)
  let i = n - 1;
  let j = m - 1;
  let pathLen = 1;
  while (i > 0 || j > 0) {
    if (i === 0) {
      j--;
    } else if (j === 0) {
      i--;
    } else {
      const left  = cost[i * m + (j - 1)];
      const down  = cost[(i - 1) * m + j];
      const diag  = cost[(i - 1) * m + (j - 1)];
      if (diag <= left && diag <= down) { i--; j--; }
      else if (left <= down)            { j--; }
      else                              { i--; }
    }
    pathLen++;
  }

  return {
    distance,
    normalizedDistance: distance / pathLen,
  };
}

/**
 * Normalize LETTER_PATHS entry to array-of-strokes format.
 * Single-stroke: [{fx,fy}, ...] → [[{fx,fy}, ...]]
 * Multi-stroke:  [[{fx,fy}, ...], [...]] → returned as-is
 */
export function normalizeStrokes(path) {
  if (!path || path.length === 0) return [];
  if (Array.isArray(path[0])) return path;
  return [path];
}

/**
 * Catmull-rom bezier arc-length reparameterization.
 *
 * Converts fractional LETTER_PATHS waypoints into N evenly-spaced points along
 * the smooth bezier curve, in absolute canvas pixels.  Used as the DTW template
 * so the child's strokes are compared against the same curve the ghost/tracer
 * displays — not against the raw piecewise-linear waypoints.
 *
 * Supports both single-stroke and multi-stroke LETTER_PATHS entries.
 * Multi-stroke paths are sampled per-stroke (proportional to arc length)
 * and concatenated.
 *
 * @param {Array} pathOrWaypoints  — LETTER_PATHS entry (single or multi-stroke)
 * @param {number} numSamples   — evenly-spaced output points (default 60)
 * @param {number} canvasW      — canvas pixel width
 * @param {number} canvasH      — canvas pixel height
 * @returns {{ points: Array<{x,y}>, totalLength: number }}
 */
export function sampleSmoothPath(pathOrWaypoints, numSamples = 60, canvasW, canvasH) {
  const strokes = normalizeStrokes(pathOrWaypoints);
  if (strokes.length === 0) return { points: [], totalLength: 0 };

  const aspect = canvasW / canvasH;
  const perStroke = strokes.map(waypoints => {
    if (!waypoints || waypoints.length < 2) return { points: [], totalLength: 0 };
    return _sampleOneStroke(waypoints, numSamples, canvasW, canvasH, aspect);
  });

  if (strokes.length === 1) return perStroke[0];

  const grandTotal = perStroke.reduce((s, r) => s + r.totalLength, 0);
  if (grandTotal === 0) return { points: [], totalLength: 0 };

  const allPoints = [];
  for (const r of perStroke) {
    const share = Math.max(2, Math.round((r.totalLength / grandTotal) * numSamples));
    if (r.points.length === 0) continue;
    const step = (r.points.length - 1) / (share - 1);
    for (let k = 0; k < share; k++) {
      const idx = Math.min(Math.round(k * step), r.points.length - 1);
      allPoints.push(r.points[idx]);
    }
  }
  return { points: allPoints, totalLength: grandTotal };
}

// Penalty added per unmatched stroke (child has fewer or more strokes than
// the template).  Units: normalizedDistance.  The final multi-stroke score
// averages per-stroke costs over templateStrokeCount, so the penalty must be
// large enough that  penalty / maxTemplateStrokes  >  DTW_CORRECT_THRESHOLD
// (currently 65).  150 / 2 = 75 > 65, guaranteeing a missing stroke fails
// the gate even when the matched stroke is perfect.
const UNMATCHED_STROKE_PENALTY = 150;

/**
 * Order-invariant DTW for multi-stroke letters.
 *
 * Single-stroke template → delegates to the existing concatenated computeDTW
 * (behaviour is byte-identical to the old code path).
 *
 * Multi-stroke template → samples each template stroke independently, then
 * does optimal bipartite matching between child strokes and template strokes
 * so the child can draw them in any order without penalty.
 *
 * @param {Array}  templatePath   — raw LETTER_PATHS entry (single or multi)
 * @param {Array<Array<{x,y}>>} childStrokes — allPathsRef.current (array of
 *        stroke arrays; NOT flattened)
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {{
 *   normalizedDistance: number|null,
 *   strokeOrderMeta: null | {
 *     childStrokeCount: number,
 *     templateStrokeCount: number,
 *     strokeOrderMatchesTemplate: boolean,
 *     matchedOrder: Array<{childStroke: number, templateStroke: number}>
 *   }
 * }}
 */
export function computeMultiStrokeDTW(templatePath, childStrokes, canvasW, canvasH) {
  const templateStrokeDefs = normalizeStrokes(templatePath);

  // ── Single-stroke: existing concatenated DTW (unchanged) ──────────────
  if (templateStrokeDefs.length <= 1) {
    const { points: templatePts } = sampleSmoothPath(templatePath, 60, canvasW, canvasH);
    const childPts = childStrokes.flat().map(p => ({ x: p.x, y: p.y }));
    const result = computeDTW(childPts, templatePts);
    return { normalizedDistance: result.normalizedDistance, strokeOrderMeta: null };
  }

  // ── Multi-stroke: per-stroke bipartite matching ───────────────────────
  const aspect = canvasW / canvasH;
  const sampledTemplate = templateStrokeDefs.map(wp => {
    if (wp.length === 1) {
      const pt = {
        x: (0.5 + (wp[0].fx - 0.5) / aspect) * canvasW,
        y: wp[0].fy * canvasH,
      };
      return { points: [pt], totalLength: 0, isDot: true };
    }
    return _sampleOneStroke(wp, 60, canvasW, canvasH, aspect);
  });

  const nTemplate = sampledTemplate.length;
  const nChild    = childStrokes.length;

  if (nChild === 0) {
    return {
      normalizedDistance: null,
      strokeOrderMeta: {
        childStrokeCount: 0,
        templateStrokeCount: nTemplate,
        strokeOrderMatchesTemplate: false,
        matchedOrder: [],
      },
    };
  }

  // Cost matrix: costMatrix[c][t] = normalizedDistance child‑stroke c ↔ template‑stroke t
  // For single-point (dot) template strokes, use minimum point-to-point
  // distance from the child stroke — DTW requires ≥ 2 points per sequence.
  const childPtsPerStroke = childStrokes.map(s => s.map(p => ({ x: p.x, y: p.y })));
  const costMatrix = [];
  for (let c = 0; c < nChild; c++) {
    costMatrix[c] = [];
    for (let t = 0; t < nTemplate; t++) {
      if (sampledTemplate[t].isDot) {
        const dp = sampledTemplate[t].points[0];
        let minDist = Infinity;
        for (const p of childPtsPerStroke[c]) {
          const dx = p.x - dp.x, dy = p.y - dp.y;
          minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
        }
        costMatrix[c][t] = childPtsPerStroke[c].length > 0 ? minDist : UNMATCHED_STROKE_PENALTY;
      } else {
        const r = computeDTW(childPtsPerStroke[c], sampledTemplate[t].points);
        costMatrix[c][t] = r.normalizedDistance ?? UNMATCHED_STROKE_PENALTY;
      }
    }
  }

  // Optimal bipartite assignment (brute-force permutations — fine for N ≤ 6)
  const { totalCost, pairs } = _bestStrokeAssignment(costMatrix, nChild, nTemplate);

  const unmatchedCount = Math.abs(nChild - nTemplate);
  const avgDist = (totalCost + unmatchedCount * UNMATCHED_STROKE_PENALTY) / nTemplate;

  // ── Stroke-order metadata (research only — does NOT affect scoring) ───
  const sortedByTemplate = [...pairs].sort((a, b) => a.templateIdx - b.templateIdx);
  const childOrder = sortedByTemplate.map(p => p.childIdx);
  const orderMatches = childOrder.every((v, i) => i === 0 || v > childOrder[i - 1]);

  return {
    normalizedDistance: avgDist,
    strokeOrderMeta: {
      childStrokeCount: nChild,
      templateStrokeCount: nTemplate,
      strokeOrderMatchesTemplate: orderMatches,
      matchedOrder: sortedByTemplate.map(p => ({
        childStroke: p.childIdx,
        templateStroke: p.templateIdx,
      })),
    },
  };
}

/**
 * Brute-force optimal assignment of min(nChild,nTemplate) pairs.
 * Returns the set of (childIdx, templateIdx) pairs with minimal total cost.
 */
function _bestStrokeAssignment(costMatrix, nChild, nTemplate) {
  const nMatch   = Math.min(nChild, nTemplate);
  const pickFrom = nChild >= nTemplate ? nChild : nTemplate;
  let bestCost  = Infinity;
  let bestPairs = [];

  function search(depth, used, current) {
    if (depth === nMatch) {
      let cost = 0;
      const pairs = [];
      for (let i = 0; i < nMatch; i++) {
        const c = nChild >= nTemplate ? current[i] : i;
        const t = nChild >= nTemplate ? i : current[i];
        cost += costMatrix[c][t];
        pairs.push({ childIdx: c, templateIdx: t });
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestPairs = pairs.slice();
      }
      return;
    }
    for (let k = 0; k < pickFrom; k++) {
      if (used.has(k)) continue;
      used.add(k);
      current.push(k);
      search(depth + 1, used, current);
      current.pop();
      used.delete(k);
    }
  }

  search(0, new Set(), []);
  return { totalCost: bestCost, pairs: bestPairs };
}

function _sampleOneStroke(waypoints, numSamples, canvasW, canvasH, aspect) {
  if (!waypoints || waypoints.length < 2) return { points: [], totalLength: 0 };
  const pts = waypoints.map(p => [(0.5 + (p.fx - 0.5) / aspect) * canvasW, p.fy * canvasH]);

  const DENSE = 20;
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    for (let s = (i === 0 ? 0 : 1); s <= DENSE; s++) {
      const t  = s / DENSE;
      const mt = 1 - t;
      dense.push({
        x: mt*mt*mt*p1[0] + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*p2[0],
        y: mt*mt*mt*p1[1] + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*p2[1],
      });
    }
  }

  const cumLen = [0];
  for (let i = 1; i < dense.length; i++) {
    const dx = dense[i].x - dense[i - 1].x;
    const dy = dense[i].y - dense[i - 1].y;
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLength = cumLen[cumLen.length - 1];
  if (totalLength === 0) return { points: [dense[0]], totalLength: 0 };

  const points = [];
  for (let k = 0; k < numSamples; k++) {
    const target = (k / (numSamples - 1)) * totalLength;
    let lo = 0, hi = dense.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumLen[mid] <= target) lo = mid; else hi = mid;
    }
    const span = cumLen[hi] - cumLen[lo];
    const frac = span > 0 ? (target - cumLen[lo]) / span : 0;
    points.push({
      x: dense[lo].x + frac * (dense[hi].x - dense[lo].x),
      y: dense[lo].y + frac * (dense[hi].y - dense[lo].y),
    });
  }
  return { points, totalLength };
}
