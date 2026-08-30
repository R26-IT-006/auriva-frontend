/**
 * activityPreviewGeometry.js
 *
 * Feature 10 Step 3 — pure geometry-transformation helpers used by
 * ActivityPreview.js (src/components/handwriting/ActivityPreview.js).
 *
 * Deliberately kept in a separate, React/react-native-svg-free file
 * (Step 3 spec §47/§48/§49): this project's Jest config runs under a
 * plain Node environment (no jest-expo/react-native preset — see
 * jest.config.js's own comment), so a file that imports `react-native-svg`
 * cannot safely be `require`d from a test at all. Every prior feature's
 * own screen/component file is therefore proven only via source-scan
 * (never imported directly) — this file exists so the actual scaling MATH
 * has a real, directly-testable, RN-free home instead of also being
 * proven only by source-scan.
 *
 * Pure only: no React, no react-native-svg, no mutation of inputs, no
 * randomness, no I/O.
 */

'use strict';

/**
 * Scales one letter stroke (an array of fractional `{fx, fy}` waypoints,
 * 0-1 range — see activityPreviewLetterPaths.js) into a local pixel-space
 * array of `{x, y}` points for one preview letter cell. Never mutates the
 * input stroke; a non-finite/malformed point is defensively dropped
 * rather than propagated (Step 3 spec §50).
 *
 * @param {Array<{fx:number, fy:number}>} stroke
 * @param {{width:number, height:number, padding?:number}} dims
 * @returns {Array<{x:number, y:number}>}
 */
export function scaleStrokeToPreview(stroke, { width, height, padding = 0 } = {}) {
  if (!Array.isArray(stroke)) return [];
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(padding)) return [];

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  const scaled = [];
  for (const pt of stroke) {
    if (!pt || !Number.isFinite(pt.fx) || !Number.isFinite(pt.fy)) continue; // malformed point, skip safely
    scaled.push({
      x: padding + pt.fx * innerW,
      y: padding + pt.fy * innerH,
    });
  }
  return scaled;
}

/**
 * Converts an array of `{x, y}` points into the space-separated
 * "x1,y1 x2,y2 ..." string `<Polyline points="...">` expects. Pure and
 * deterministic — identical input always yields an identical string.
 *
 * @param {Array<{x:number, y:number}>} points
 * @returns {string}
 */
export function toPolylinePoints(points) {
  if (!Array.isArray(points)) return '';
  return points
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}
