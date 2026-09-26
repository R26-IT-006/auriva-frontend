/**
 * demoPlayback.js
 *
 * Turns Auriva's EXISTING reference trajectories into the keyframes a
 * demonstration animates over.
 *
 * ── No new path data, anywhere ───────────────────────────────────────────
 * Every demo animates the same geometry the real activity uses:
 *
 *   letters  activityPreviewLetterPaths.js  (the verbatim, screen-free copy
 *            of LetterWritingScreen/UppercaseWritingScreen's LETTER_PATHS
 *            that the worksheet PDF already renders from)
 *   words    wordPaths.js's buildWordGuide + buildWordTracerStrokes
 *   shapes   unifiedShapeScoreMirror.js's computeShapeTemplate — the SAME
 *            template the assessment's own pointer follows and the unified
 *            motor score is computed against
 *
 * If a demo and the real task ever disagreed about where a letter goes, the
 * demo would be teaching the wrong movement. Sharing the source makes that
 * impossible rather than unlikely.
 *
 * ── Same animation technique as the live tracer ──────────────────────────
 * The output is exactly what LetterWritingScreen's Attempt-1 tracer already
 * builds inline: one flat `inputRange` of sample indices with parallel
 * `xRange`/`yRange`, so a single `Animated.Value` interpolates into a
 * position, plus per-stroke bounds and durations so the strokes can be
 * played one at a time in an `Animated.sequence`. Stroke duration comes
 * from `getStrokeDurationForLevel` — the one shared source of tracer pace
 * in this app, so a demo never moves at a speed the child has not already
 * seen.
 *
 * ── Pure ─────────────────────────────────────────────────────────────────
 * No react-native import and no `Animated` here: this module computes
 * numbers, the component animates them. That keeps every geometry rule
 * directly unit-testable under plain jest.
 */

'use strict';

import { normalizeStrokes, sampleSmoothPath } from './dtw';
import { getStrokeDurationForLevel, DEMO_SPEED_LEVELS } from '../constants/demoSpeedLevels';
import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from '../constants/activityPreviewLetterPaths';

// Letters whose strokes are straight segments rather than smoothed curves.
// Copied verbatim from wordPaths.js's own ANGULAR_LOWERCASE/ANGULAR_UPPERCASE
// — the same "copy, don't cross-import" precedent this codebase already uses
// for the letter waypoints themselves (activityPreviewLetterPaths.js's
// header). A drift test pins these to the writing screens' own sets.
export const ANGULAR_LOWERCASE = new Set(['v', 'w', 'z', 'x', 'y', 'k', 'l']);
export const ANGULAR_UPPERCASE = new Set([
  'V', 'W', 'Z', 'X', 'Y', 'K', 'L', 'A', 'E', 'M', 'N', 'T', 'I', 'H', 'F',
]);

// Pause between strokes, and before/after one full pass. Slower than a
// reflex, fast enough not to feel broken — the same calm "trace, then
// pause" rhythm ShapeAssessmentScreen's pointer already uses.
export const INTER_STROKE_DELAY_MS = 400;
export const LEAD_IN_DELAY_MS      = 350;
export const TAIL_DELAY_MS         = 700;

const SAMPLES_PER_STROKE = 60;

/**
 * Samples a straight-segment stroke at evenly spaced arc-length intervals.
 *
 * Copied verbatim from LetterWritingScreen.js / UppercaseWritingScreen.js /
 * wordPaths.js, which each already carry an identical private copy. Adding
 * a fourth copy is deliberate: exporting it from one of those three would
 * mean a demo module importing a 1700-line screen, or a screen importing
 * this one. A test asserts this copy still agrees with the screens'.
 *
 * The `0.5 + (fx - 0.5) / aspect` term is the same aspect correction the
 * writing canvases apply, so a letter is not stretched by a wide canvas.
 */
export function sampleStraightStroke(waypoints, numSamples, canvasW, canvasH) {
  if (!waypoints || waypoints.length < 2) return { points: [], totalLength: 0 };
  const aspect = canvasW / canvasH;
  const pts = waypoints.map((p) => ({
    x: (0.5 + (p.fx - 0.5) / aspect) * canvasW,
    y: p.fy * canvasH,
  }));
  const cumLen = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLength = cumLen[cumLen.length - 1];
  if (totalLength === 0) return { points: [pts[0]], totalLength: 0 };
  const points = [];
  for (let k = 0; k < numSamples; k++) {
    const target = (k / (numSamples - 1)) * totalLength;
    let seg = 0;
    while (seg < pts.length - 2 && cumLen[seg + 1] < target) seg++;
    const span = cumLen[seg + 1] - cumLen[seg];
    const frac = span > 0 ? (target - cumLen[seg]) / span : 0;
    points.push({
      x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac,
      y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac,
    });
  }
  return { points, totalLength };
}

/** Arc length of an already-sampled pixel stroke. */
function arcLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * Scales already-pixel strokes to fit a demo canvas, preserving aspect and
 * centring what is left over.
 *
 * Needed only for shape templates: `computeShapeTemplate` draws at the
 * assessment canvas's own fixed pixel extents (±200 px wide, ±150 px tall),
 * which would overflow a smaller demo canvas. Scaling uniformly changes the
 * shape's SIZE and nothing else — the movement being demonstrated is
 * identical.
 */
export function fitStrokesToBox(strokes, { width, height, padding = 24 }) {
  const all = strokes.flat();
  if (all.length === 0) return strokes;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of all) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return strokes;

  const boxW = Math.max(1, width  - padding * 2);
  const boxH = Math.max(1, height - padding * 2);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min(boxW / spanX, boxH / spanY);

  const offsetX = padding + (boxW - spanX * scale) / 2;
  const offsetY = padding + (boxH - spanY * scale) / 2;

  return strokes.map((stroke) => stroke.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  })));
}

/**
 * The shared core: sampled pixel strokes -> the keyframes and per-stroke
 * timing a single Animated.Value plays.
 *
 * @param {Array<{points: Array<{x,y}>, totalLength: number}>} perStroke
 * @param {string} speedLevel  'standard' | 'slow'
 * @returns {{
 *   keyframes: {inputRange: number[], xRange: number[], yRange: number[]},
 *   strokes: Array<{start: number, end: number, durationMs: number}>,
 *   polylines: Array<Array<{x,y}>>,
 *   startPoint: {x, y},
 *   totalDurationMs: number,
 * }|null} null when there is nothing animatable — the caller must then show
 *   the demo's fallback rather than an empty canvas.
 */
export function buildTimelineFromSampledStrokes(perStroke, speedLevel = DEMO_SPEED_LEVELS.STANDARD) {
  if (!Array.isArray(perStroke) || perStroke.length === 0) return null;

  const inputRange = [];
  const xRange = [];
  const yRange = [];
  const strokes = [];
  const polylines = [];
  let offset = 0;

  for (const entry of perStroke) {
    const points = entry?.points ?? [];
    if (points.length === 0) continue;

    const start = offset;
    for (let k = 0; k < points.length; k++) {
      // Guards a malformed waypoint from poisoning the whole interpolation:
      // Animated.interpolate requires a strictly increasing inputRange and
      // finite outputs.
      if (!Number.isFinite(points[k].x) || !Number.isFinite(points[k].y)) return null;
      inputRange.push(offset + k);
      xRange.push(points[k].x);
      yRange.push(points[k].y);
    }
    offset += points.length;

    const length = Number.isFinite(entry.totalLength) ? entry.totalLength : arcLength(points);
    strokes.push({
      start,
      end: offset - 1,
      durationMs: getStrokeDurationForLevel(length, speedLevel),
    });
    polylines.push(points);
  }

  if (inputRange.length < 2) return null;

  const totalDurationMs =
    LEAD_IN_DELAY_MS + TAIL_DELAY_MS
    + strokes.reduce((sum, s) => sum + s.durationMs, 0)
    + INTER_STROKE_DELAY_MS * Math.max(0, strokes.length - 1);

  return {
    keyframes: { inputRange, xRange, yRange },
    strokes,
    polylines,
    startPoint: { x: xRange[0], y: yRange[0] },
    totalDurationMs,
  };
}

/**
 * Timeline for ONE letter, from the real reference waypoints.
 *
 * @param {{letter: string, caseType: string, canvasW: number, canvasH: number, speedLevel?: string}} args
 */
export function buildLetterDemoTimeline({ letter, caseType, canvasW, canvasH, speedLevel }) {
  if (typeof letter !== 'string' || !/^[A-Za-z]$/.test(letter)) return null;
  if (!(canvasW > 0) || !(canvasH > 0)) return null;

  const upper = caseType === 'uppercase';
  const ch = upper ? letter.toUpperCase() : letter.toLowerCase();
  const rawPath = upper ? UPPERCASE_LETTER_PATHS[ch] : LOWERCASE_LETTER_PATHS[ch];
  // No invented fallback letter: an unmapped letter means no demo at all,
  // never a demonstration of a DIFFERENT letter than the one the child is
  // about to write.
  if (!rawPath) return null;

  const isAngular = (upper ? ANGULAR_UPPERCASE : ANGULAR_LOWERCASE).has(ch);
  const perStroke = normalizeStrokes(rawPath).map((stroke) => {
    // A single-point stroke is the dot on `i`/`j` — held in place rather
    // than dropped, so the child sees that it is part of the letter.
    if (stroke && stroke.length === 1) {
      const aspect = canvasW / canvasH;
      const pt = {
        x: (0.5 + (stroke[0].fx - 0.5) / aspect) * canvasW,
        y: stroke[0].fy * canvasH,
      };
      return { points: [pt, pt], totalLength: 0 };
    }
    return isAngular
      ? sampleStraightStroke(stroke, SAMPLES_PER_STROKE, canvasW, canvasH)
      : sampleSmoothPath(stroke, SAMPLES_PER_STROKE, canvasW, canvasH);
  });

  return buildTimelineFromSampledStrokes(perStroke, speedLevel);
}

/**
 * Timeline for a whole WORD, in writing order, from wordPaths.js's own
 * composed guide — the exact strokes WordWritingScreen traces.
 *
 * `buildWordGuide` and `buildWordTracerStrokes` are injected rather than
 * imported so this module stays free of the constants layer's own imports
 * and the geometry can be tested with a stub; the screen passes the real
 * functions.
 */
export function buildWordDemoTimeline({
  word, canvasW, canvasH, speedLevel, buildWordGuide, buildWordTracerStrokes,
}) {
  if (typeof word !== 'string' || word.trim() === '') return null;
  if (!(canvasW > 0) || !(canvasH > 0)) return null;
  if (typeof buildWordGuide !== 'function' || typeof buildWordTracerStrokes !== 'function') return null;

  const guide = buildWordGuide(word);
  const descriptors = guide?.strokeDescriptors ?? [];
  if (descriptors.length === 0) return null;

  return buildTimelineFromSampledStrokes(
    buildWordTracerStrokes(descriptors, canvasW, canvasH),
    speedLevel,
  );
}

/**
 * Timeline for one assessment SHAPE, from the scoring template itself.
 *
 * `computeShapeTemplate` is injected for the same reason as above (it is a
 * CommonJS module, and this keeps the geometry testable in isolation).
 */
export function buildShapeDemoTimeline({
  shapeId, canvasW, canvasH, speedLevel, computeShapeTemplate,
  fitToCanvas = true, padding = 32,
}) {
  if (typeof shapeId !== 'string' || shapeId === '') return null;
  if (!(canvasW > 0) || !(canvasH > 0)) return null;
  if (typeof computeShapeTemplate !== 'function') return null;

  const template = computeShapeTemplate(shapeId, canvasW, canvasH);
  if (!Array.isArray(template) || template.length < 2) return null;

  // `fitToCanvas: false` is what the real assessment demonstration uses: the
  // template is ALREADY in that canvas's own coordinates, and rescaling it
  // would slide the pointer off the dashed guide the child is looking at.
  // Fitting exists only for rendering a template inside a smaller box.
  const points = fitToCanvas
    ? fitStrokesToBox([template], { width: canvasW, height: canvasH, padding })[0]
    : template;

  return buildTimelineFromSampledStrokes(
    [{ points, totalLength: arcLength(points) }],
    speedLevel,
  );
}

/**
 * Converts a stroke to the `points` string react-native-svg's Polyline
 * wants. Same helper shape activityPreviewGeometry.js already uses for the
 * teacher-facing preview.
 */
export function toPolylinePoints(points) {
  return (points ?? [])
    .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}
