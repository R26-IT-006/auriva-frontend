/**
 * Word-level tracing reference paths.
 *
 * Mirrors the per-letter stroke waypoints used by LetterWritingScreen /
 * UppercaseWritingScreen (LETTER_PATHS) so word tracing gets the same
 * reference-path guide, tracer dot, and DTW scoring as single-letter
 * tracing instead of a flat ghost-text outline.
 *
 * Words are displayed with a capitalised first letter (WordWritingScreen /
 * ExerciseE_WriteWord both render `word.charAt(0).toUpperCase() + ...`), so
 * the guide does the same: the first letter's waypoints come from the
 * uppercase LETTER_PATHS (copied verbatim from UppercaseWritingScreen), the
 * rest from the lowercase set (copied verbatim from LetterWritingScreen).
 * Each letter is tightly packed against its neighbours using its own ink
 * bounding box (not a fixed unit box) plus a small proportional gap, then
 * the whole row is scaled to fit the canvas — see buildWordGuide().
 */

import {
  computeDTW,
  sampleSmoothPath,
  normalizeStrokes,
} from '../utils/dtw';
import {
  normalizeStrokesForDTW,
  normalizePointsForDTW,
} from '../utils/dtwNormalization';

// ─── Per-letter stroke waypoints (fx, fy fractions of a single-letter canvas) ─
// Identical source data to LetterWritingScreen's LETTER_PATHS lowercase set.

const LOWERCASE_LETTER_PATHS = {
  a:[{fx:0.63,fy:0.42},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.57,fy:0.625},{fx:0.63,fy:0.58},{fx:0.63,fy:0.42},{fx:0.63,fy:0.64}],
  b:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.41},{fx:0.44,fy:0.36},{fx:0.54,fy:0.38},{fx:0.60,fy:0.45},{fx:0.62,fy:0.50},{fx:0.60,fy:0.57},{fx:0.54,fy:0.625},{fx:0.44,fy:0.64},{fx:0.34,fy:0.60}]],
  c:[{fx:0.62,fy:0.42},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.57,fy:0.625},{fx:0.62,fy:0.58}],
  d:[[{fx:0.58,fy:0.08},{fx:0.58,fy:0.64}],[{fx:0.58,fy:0.41},{fx:0.48,fy:0.36},{fx:0.38,fy:0.38},{fx:0.32,fy:0.45},{fx:0.30,fy:0.50},{fx:0.32,fy:0.57},{fx:0.38,fy:0.625},{fx:0.48,fy:0.64},{fx:0.58,fy:0.60}]],
  e:[{fx:0.37,fy:0.50},{fx:0.63,fy:0.50},{fx:0.63,fy:0.44},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.58,fy:0.625}],
  f:[
    [{fx:0.58,fy:0.16},{fx:0.50,fy:0.11},{fx:0.42,fy:0.14},{fx:0.40,fy:0.22},{fx:0.40,fy:0.64}],
    [{fx:0.30,fy:0.36},{fx:0.56,fy:0.36}]
  ],
  g:[
    [{fx:0.58,fy:0.41},{fx:0.50,fy:0.36},{fx:0.40,fy:0.37},{fx:0.34,fy:0.43},{fx:0.32,fy:0.50},{fx:0.34,fy:0.57},{fx:0.40,fy:0.625},{fx:0.50,fy:0.64},{fx:0.58,fy:0.60}],
    [{fx:0.58,fy:0.36},{fx:0.58,fy:0.80},{fx:0.54,fy:0.88},{fx:0.44,fy:0.90},{fx:0.36,fy:0.86}]
  ],
  h:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.44},{fx:0.40,fy:0.38},{fx:0.48,fy:0.36},{fx:0.56,fy:0.39},{fx:0.60,fy:0.46},{fx:0.60,fy:0.64}]],
  i:[[{fx:0.50,fy:0.36},{fx:0.50,fy:0.64}],[{fx:0.50,fy:0.25}]],
  j:[
    [{fx:0.52,fy:0.36},{fx:0.52,fy:0.80},{fx:0.48,fy:0.88},{fx:0.40,fy:0.90},{fx:0.34,fy:0.86}],
    [{fx:0.52,fy:0.25}]
  ],
  k:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.50},{fx:0.60,fy:0.36}],
    [{fx:0.34,fy:0.50},{fx:0.62,fy:0.64}]
  ],
  l:[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}],
  m:[[{fx:0.26,fy:0.36},{fx:0.26,fy:0.64}],[{fx:0.26,fy:0.42},{fx:0.31,fy:0.37},{fx:0.38,fy:0.36},{fx:0.44,fy:0.39},{fx:0.47,fy:0.45},{fx:0.47,fy:0.64}],[{fx:0.47,fy:0.45},{fx:0.50,fy:0.39},{fx:0.57,fy:0.36},{fx:0.64,fy:0.37},{fx:0.69,fy:0.42},{fx:0.71,fy:0.48},{fx:0.71,fy:0.64}]],
  n:[[{fx:0.34,fy:0.36},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.42},{fx:0.40,fy:0.37},{fx:0.48,fy:0.36},{fx:0.56,fy:0.39},{fx:0.60,fy:0.45},{fx:0.60,fy:0.64}]],
  o:[{fx:0.50,fy:0.36},{fx:0.57,fy:0.375},{fx:0.62,fy:0.42},{fx:0.64,fy:0.50},{fx:0.62,fy:0.58},{fx:0.57,fy:0.625},{fx:0.50,fy:0.64},{fx:0.43,fy:0.625},{fx:0.38,fy:0.58},{fx:0.36,fy:0.50},{fx:0.38,fy:0.42},{fx:0.43,fy:0.375},{fx:0.50,fy:0.36}],
  p:[[{fx:0.34,fy:0.36},{fx:0.34,fy:0.90}],[{fx:0.34,fy:0.41},{fx:0.44,fy:0.36},{fx:0.54,fy:0.38},{fx:0.60,fy:0.45},{fx:0.62,fy:0.50},{fx:0.60,fy:0.57},{fx:0.54,fy:0.625},{fx:0.44,fy:0.64},{fx:0.34,fy:0.60}]],
  q:[[{fx:0.58,fy:0.36},{fx:0.58,fy:0.90}],[{fx:0.58,fy:0.41},{fx:0.48,fy:0.36},{fx:0.38,fy:0.38},{fx:0.32,fy:0.45},{fx:0.30,fy:0.50},{fx:0.32,fy:0.57},{fx:0.38,fy:0.625},{fx:0.48,fy:0.64},{fx:0.58,fy:0.60}]],
  r:[[{fx:0.38,fy:0.36},{fx:0.38,fy:0.64}],[{fx:0.38,fy:0.42},{fx:0.45,fy:0.37},{fx:0.53,fy:0.38}]],
  s:[{fx:0.62,fy:0.41},{fx:0.56,fy:0.375},{fx:0.48,fy:0.37},{fx:0.42,fy:0.40},{fx:0.41,fy:0.45},{fx:0.46,fy:0.49},{fx:0.54,fy:0.51},{fx:0.60,fy:0.55},{fx:0.59,fy:0.61},{fx:0.52,fy:0.64},{fx:0.44,fy:0.635},{fx:0.38,fy:0.60}],
  t:[[{fx:0.50,fy:0.14},{fx:0.50,fy:0.64}],[{fx:0.38,fy:0.36},{fx:0.62,fy:0.36}]],
  u:[{fx:0.37,fy:0.36},{fx:0.37,fy:0.55},{fx:0.40,fy:0.61},{fx:0.45,fy:0.64},{fx:0.50,fy:0.64},{fx:0.56,fy:0.62},{fx:0.61,fy:0.57},{fx:0.63,fy:0.36},{fx:0.63,fy:0.64}],
  v:[{fx:0.36,fy:0.36},{fx:0.50,fy:0.64},{fx:0.64,fy:0.36}],
  w:[{fx:0.28,fy:0.36},{fx:0.40,fy:0.64},{fx:0.50,fy:0.36},{fx:0.60,fy:0.64},{fx:0.72,fy:0.36}],
  x:[
    [{fx:0.36,fy:0.36},{fx:0.64,fy:0.64}],
    [{fx:0.64,fy:0.36},{fx:0.36,fy:0.64}]
  ],
  y:[
    [{fx:0.36,fy:0.36},{fx:0.50,fy:0.60}],
    [{fx:0.64,fy:0.36},{fx:0.36,fy:0.90}]
  ],
  z:[{fx:0.36,fy:0.36},{fx:0.64,fy:0.36},{fx:0.36,fy:0.64},{fx:0.64,fy:0.64}],
};

// ─── Per-letter stroke waypoints — uppercase (used for the word's first letter) ─
// Identical source data to UppercaseWritingScreen's LETTER_PATHS.

const UPPERCASE_LETTER_PATHS = {
  A:[[{fx:0.28,fy:0.64},{fx:0.50,fy:0.08}],[{fx:0.50,fy:0.08},{fx:0.72,fy:0.64}],[{fx:0.40,fy:0.36},{fx:0.60,fy:0.36}]],
  B:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.52,fy:0.10},{fx:0.60,fy:0.16},{fx:0.60,fy:0.24},{fx:0.52,fy:0.34},{fx:0.34,fy:0.36}],
    [{fx:0.34,fy:0.36},{fx:0.52,fy:0.38},{fx:0.60,fy:0.44},{fx:0.60,fy:0.52},{fx:0.52,fy:0.62},{fx:0.34,fy:0.64}]
  ],
  C:[{fx:0.70,fy:0.18},{fx:0.60,fy:0.11},{fx:0.50,fy:0.08},{fx:0.38,fy:0.11},{fx:0.30,fy:0.19},{fx:0.27,fy:0.36},{fx:0.30,fy:0.53},{fx:0.38,fy:0.61},{fx:0.50,fy:0.64},{fx:0.60,fy:0.61},{fx:0.70,fy:0.54}],
  D:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.11},{fx:0.66,fy:0.22},{fx:0.68,fy:0.36},{fx:0.66,fy:0.50},{fx:0.54,fy:0.61},{fx:0.34,fy:0.64}]
  ],
  E:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.08},{fx:0.66,fy:0.08}],[{fx:0.34,fy:0.36},{fx:0.60,fy:0.36}],[{fx:0.34,fy:0.64},{fx:0.66,fy:0.64}]],
  F:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.66,fy:0.08}],
    [{fx:0.34,fy:0.36},{fx:0.60,fy:0.36}]
  ],
  G:[
    [{fx:0.66,fy:0.18},{fx:0.56,fy:0.10},{fx:0.44,fy:0.09},{fx:0.34,fy:0.15},{fx:0.29,fy:0.26},{fx:0.28,fy:0.36},{fx:0.29,fy:0.46},{fx:0.34,fy:0.57},{fx:0.44,fy:0.63},{fx:0.55,fy:0.64},{fx:0.64,fy:0.58},{fx:0.66,fy:0.50}],
    [{fx:0.50,fy:0.36},{fx:0.66,fy:0.36}],
    [{fx:0.66,fy:0.36},{fx:0.66,fy:0.50}]
  ],
  H:[
    [{fx:0.32,fy:0.08},{fx:0.32,fy:0.64}],
    [{fx:0.32,fy:0.36},{fx:0.68,fy:0.36}],
    [{fx:0.68,fy:0.08},{fx:0.68,fy:0.64}]
  ],
  I:[[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}],[{fx:0.38,fy:0.08},{fx:0.62,fy:0.08}],[{fx:0.38,fy:0.64},{fx:0.62,fy:0.64}]],
  J:[{fx:0.60,fy:0.08},{fx:0.60,fy:0.52},{fx:0.56,fy:0.60},{fx:0.46,fy:0.64},{fx:0.36,fy:0.60},{fx:0.33,fy:0.52}],
  K:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.36},{fx:0.66,fy:0.08}],
    [{fx:0.34,fy:0.36},{fx:0.68,fy:0.64}]
  ],
  L:[{fx:0.36,fy:0.08},{fx:0.36,fy:0.64},{fx:0.64,fy:0.64}],
  M:[
    [{fx:0.24,fy:0.64},{fx:0.24,fy:0.08}],
    [{fx:0.24,fy:0.08},{fx:0.50,fy:0.64}],
    [{fx:0.50,fy:0.64},{fx:0.76,fy:0.08}],
    [{fx:0.76,fy:0.08},{fx:0.76,fy:0.64}]
  ],
  N:[
    [{fx:0.30,fy:0.64},{fx:0.30,fy:0.08}],
    [{fx:0.30,fy:0.08},{fx:0.70,fy:0.64}],
    [{fx:0.70,fy:0.64},{fx:0.70,fy:0.08}]
  ],
  O:[{fx:0.50,fy:0.08},{fx:0.62,fy:0.11},{fx:0.70,fy:0.19},{fx:0.73,fy:0.36},{fx:0.70,fy:0.53},{fx:0.62,fy:0.61},{fx:0.50,fy:0.64},{fx:0.38,fy:0.61},{fx:0.30,fy:0.53},{fx:0.27,fy:0.36},{fx:0.30,fy:0.19},{fx:0.38,fy:0.11},{fx:0.50,fy:0.08}],
  P:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.10},{fx:0.63,fy:0.17},{fx:0.63,fy:0.27},{fx:0.54,fy:0.35},{fx:0.34,fy:0.37}]
  ],
  Q:[
    [{fx:0.50,fy:0.08},{fx:0.62,fy:0.11},{fx:0.70,fy:0.19},{fx:0.73,fy:0.36},{fx:0.70,fy:0.53},{fx:0.62,fy:0.61},{fx:0.50,fy:0.64},{fx:0.38,fy:0.61},{fx:0.30,fy:0.53},{fx:0.27,fy:0.36},{fx:0.30,fy:0.19},{fx:0.38,fy:0.11},{fx:0.50,fy:0.08}],
    [{fx:0.56,fy:0.52},{fx:0.72,fy:0.68}]
  ],
  R:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.10},{fx:0.63,fy:0.17},{fx:0.63,fy:0.27},{fx:0.54,fy:0.35},{fx:0.34,fy:0.37}],
    [{fx:0.34,fy:0.37},{fx:0.66,fy:0.64}]
  ],
  S:[{fx:0.64,fy:0.20},{fx:0.62,fy:0.13},{fx:0.54,fy:0.09},{fx:0.45,fy:0.09},{fx:0.37,fy:0.12},{fx:0.33,fy:0.19},{fx:0.34,fy:0.26},{fx:0.40,fy:0.31},{fx:0.50,fy:0.35},{fx:0.59,fy:0.40},{fx:0.65,fy:0.46},{fx:0.66,fy:0.54},{fx:0.62,fy:0.60},{fx:0.54,fy:0.64},{fx:0.45,fy:0.64},{fx:0.37,fy:0.61},{fx:0.34,fy:0.55}],
  T:[[{fx:0.30,fy:0.08},{fx:0.70,fy:0.08}],[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}]],
  U:[{fx:0.30,fy:0.08},{fx:0.30,fy:0.46},{fx:0.34,fy:0.58},{fx:0.42,fy:0.63},{fx:0.50,fy:0.64},{fx:0.58,fy:0.63},{fx:0.66,fy:0.58},{fx:0.70,fy:0.46},{fx:0.70,fy:0.08}],
  V:[{fx:0.30,fy:0.08},{fx:0.50,fy:0.64},{fx:0.70,fy:0.08}],
  W:[{fx:0.22,fy:0.08},{fx:0.36,fy:0.64},{fx:0.50,fy:0.08},{fx:0.64,fy:0.64},{fx:0.78,fy:0.08}],
  X:[
    [{fx:0.30,fy:0.08},{fx:0.70,fy:0.64}],
    [{fx:0.70,fy:0.08},{fx:0.30,fy:0.64}]
  ],
  Y:[
    [{fx:0.30,fy:0.08},{fx:0.50,fy:0.36}],
    [{fx:0.70,fy:0.08},{fx:0.50,fy:0.36}],
    [{fx:0.50,fy:0.36},{fx:0.50,fy:0.64}]
  ],
  Z:[{fx:0.32,fy:0.08},{fx:0.68,fy:0.08},{fx:0.32,fy:0.64},{fx:0.68,fy:0.64}],
};

// Letters that look wrong with catmull-rom smoothing (sharp corners get
// rounded off) — rendered as straight line segments instead, same sets
// LetterWritingScreen / UppercaseWritingScreen use.
const ANGULAR_LOWERCASE = new Set(['v', 'w', 'z', 'x', 'y', 'k', 'l']);
const ANGULAR_UPPERCASE = new Set([
  'V', 'W', 'Z', 'X', 'Y', 'K', 'L', 'A', 'E', 'M', 'N', 'T', 'I', 'H', 'F',
]);

// Gap between adjacent letters, as a fraction of the *average* letter ink
// width in the word — proportional so short and long words both read as
// evenly, naturally spaced (not a fixed fraction of a fixed-size unit box).
const LETTER_GAP_FRACTION = 0.22;

function strokeBoundsX(strokes) {
  let minX = Infinity, maxX = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke) {
      if (p.fx < minX) minX = p.fx;
      if (p.fx > maxX) maxX = p.fx;
    }
  }
  return { minX, maxX };
}

/**
 * Builds a whole-word tracing guide: first letter from the uppercase
 * LETTER_PATHS (matching the capitalised display word), remaining letters
 * from the lowercase set — exact fx/fy waypoints, untouched. Each letter is
 * packed against its own ink bounding box (not a fixed unit box), so there's
 * no wasted margin between letters, then the whole row is scaled to fit.
 *
 * Each stroke also carries its letterIndex / localStrokeIndex within that
 * letter (e.g. the 2nd stroke of the 3rd letter → letterIndex 2, localStrokeIndex 1)
 * so Attempt 2's stroke-order marker can number strokes the same way single-
 * letter tracing does — "1, 2, 3…" per letter, not a running count across
 * the whole word.
 *
 * @param {string} word
 * @returns {{
 *   rawPath: Array<Array<{fx,fy}>>,                       — multi-stroke, LETTER_PATHS-shaped, fx in word-space
 *   strokeDescriptors: Array<{points, angular, letterIndex, localStrokeIndex}>,
 * }}
 */
export function buildWordGuide(word) {
  const clean = (word ?? '').replace(/[^a-zA-Z]/g, '');
  if (clean.length === 0) return { rawPath: [], strokeDescriptors: [] };

  const letterDefs = clean.split('').map((ch, i) => {
    const isFirst = i === 0;
    const raw = isFirst
      ? UPPERCASE_LETTER_PATHS[ch.toUpperCase()]
      : LOWERCASE_LETTER_PATHS[ch.toLowerCase()];
    if (!raw) return null;
    const strokes = normalizeStrokes(raw);
    const { minX, maxX } = strokeBoundsX(strokes);
    return {
      strokes,
      minX,
      width: maxX - minX,
      angular: isFirst ? ANGULAR_UPPERCASE.has(ch.toUpperCase()) : ANGULAR_LOWERCASE.has(ch.toLowerCase()),
    };
  }).filter(Boolean);

  if (letterDefs.length === 0) return { rawPath: [], strokeDescriptors: [] };

  const avgWidth = letterDefs.reduce((sum, l) => sum + l.width, 0) / letterDefs.length;
  const gap = avgWidth * LETTER_GAP_FRACTION;
  const totalWidth = letterDefs.reduce((sum, l) => sum + l.width, 0) + gap * (letterDefs.length - 1);

  const rawPath = [];
  const strokeDescriptors = [];
  let cursor = 0; // running x offset, in the same units as each letter's own fx

  letterDefs.forEach(({ strokes, minX, width, angular }, letterIndex) => {
    strokes.forEach((stroke, localStrokeIndex) => {
      const positioned = stroke.map(p => ({
        fx: (cursor + (p.fx - minX)) / totalWidth,
        fy: p.fy,
      }));
      rawPath.push(positioned);
      strokeDescriptors.push({ points: positioned, angular, letterIndex, localStrokeIndex });
    });
    cursor += width + gap;
  });

  return { rawPath, strokeDescriptors };
}

// ─── SVG path / dot rendering ───────────────────────────────────────────────
// Same aspect-ratio correction as LetterWritingScreen, applied per canvas.

function makeAspectX(canvasW, canvasH) {
  const aspect = canvasW / canvasH;
  return (fx) => 0.5 + (fx - 0.5) / aspect;
}

/**
 * Builds a smooth (catmull-rom) + straight (angular strokes) SVG path `d`
 * string for the whole word guide — the reference path children trace over.
 */
export function wordGuideToSvgPath(strokeDescriptors, canvasW, canvasH) {
  const aspectX = makeAspectX(canvasW, canvasH);
  let d = '';
  for (const { points, angular } of strokeDescriptors) {
    if (!points || points.length < 2) continue;
    const pts = points.map(p => [aspectX(p.fx) * canvasW, p.fy * canvasH]);
    d += ` M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    if (angular) {
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      }
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
    }
  }
  return d.trim();
}

// Single-point strokes (dots on 'i' / 'j') rendered as ghost circles.
export function wordGuideGhostDots(strokeDescriptors, canvasW, canvasH) {
  const aspectX = makeAspectX(canvasW, canvasH);
  const dots = [];
  for (const { points } of strokeDescriptors) {
    if (points && points.length === 1) {
      dots.push({ cx: aspectX(points[0].fx) * canvasW, cy: points[0].fy * canvasH });
    }
  }
  return dots;
}

/**
 * Attempt-2 "where to start / which way to go" hint for a single stroke —
 * identical shape/logic to LetterWritingScreen's getStrokeDirectionHint,
 * just parameterised on canvasW/canvasH instead of module-level constants.
 *
 * @param {Array<{fx,fy}>} waypoints — one stroke's *positioned* (word-space) points
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {boolean} showEverySegment — angular strokes get an arrow per segment;
 *   smooth strokes get just one, near the start
 */
export function getWordStrokeDirectionHint(waypoints, canvasW, canvasH, showEverySegment = false) {
  if (!waypoints?.length) return null;
  const aspectX = makeAspectX(canvasW, canvasH);
  const points = waypoints.map(p => ({
    x: aspectX(p.fx) * canvasW,
    y: p.fy * canvasH,
  }));
  const segmentCount = showEverySegment
    ? points.length - 1
    : Math.min(1, points.length - 1);
  const arrows = [];

  for (let index = 0; index < segmentCount; index++) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 2) continue;
    const ux = dx / distance;
    const uy = dy / distance;
    const shaftOffset = Math.min(18, distance * 0.35);
    const tipOffset = Math.max(shaftOffset + 8, Math.min(50, distance * 0.82));
    const shaftStart = {
      x: segmentStart.x + ux * shaftOffset,
      y: segmentStart.y + uy * shaftOffset,
    };
    const tip = {
      x: segmentStart.x + ux * tipOffset,
      y: segmentStart.y + uy * tipOffset,
    };
    const base = { x: tip.x - ux * 10, y: tip.y - uy * 10 };
    const px = -uy * 6;
    const py = ux * 6;
    arrows.push({
      shaftStart,
      tip,
      arrowHead: `${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`,
    });
  }

  const endGuides = points.length < 2
    ? []
    : showEverySegment ? points.slice(1) : points.slice(-1);

  return {
    start: points[0],
    arrows,
    endGuides,
  };
}

function sampleStraightStroke(waypoints, numSamples, canvasW, canvasH) {
  if (!waypoints || waypoints.length < 2) return { points: [], totalLength: 0 };
  const aspect = canvasW / canvasH;
  const pts = waypoints.map(p => ({
    x: (0.5 + (p.fx - 0.5) / aspect) * canvasW,
    y: p.fy * canvasH,
  }));
  const cumLen = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    cumLen.push(cumLen[i-1] + Math.sqrt(dx*dx + dy*dy));
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
      x: pts[seg].x + frac * (pts[seg+1].x - pts[seg].x),
      y: pts[seg].y + frac * (pts[seg+1].y - pts[seg].y),
    });
  }
  return { points, totalLength };
}

/**
 * Per-stroke sampled points for the animated tracer dot (Attempt 1),
 * honouring each stroke's straight-vs-smooth render mode.
 */
export function buildWordTracerStrokes(strokeDescriptors, canvasW, canvasH, numSamples = 40) {
  return strokeDescriptors.map(({ points, angular }) => {
    if (points && points.length === 1) {
      const aspectX = makeAspectX(canvasW, canvasH);
      const pt = { x: aspectX(points[0].fx) * canvasW, y: points[0].fy * canvasH };
      return { points: [pt, pt], totalLength: 0 };
    }
    return angular
      ? sampleStraightStroke(points, numSamples, canvasW, canvasH)
      : sampleSmoothPath(points, numSamples, canvasW, canvasH);
  });
}

/**
 * DTW accuracy of a drawn word against its composed reference path.
 * Mirrors computeMultiStrokeDTW's single-stroke branch (concatenated,
 * order-sensitive DTW over normalized coordinates) rather than the
 * bipartite multi-stroke matcher — that matcher is brute-force over stroke
 * permutations and only tractable for a single letter's few strokes, not
 * the 10-20+ strokes a whole word can have. Words are always written
 * letter-by-letter in order, so an order-sensitive comparison is also the
 * semantically correct one here.
 *
 * @param {Array<Array<{fx,fy}>>} rawPath — from buildWordGuide().rawPath
 * @param {Array<Array<{x,y}>>} childStrokes — allPathsRef.current
 * @returns {number|null} normalizedDistance, same scale as letter dtw_distance
 */
export function computeWordDTW(rawPath, childStrokes, canvasW, canvasH) {
  if (!rawPath || rawPath.length === 0 || !childStrokes || childStrokes.length === 0) {
    return null;
  }
  const sampleCount = Math.max(60, rawPath.length * 20);
  const { points: templatePts } = sampleSmoothPath(rawPath, sampleCount, canvasW, canvasH);
  if (templatePts.length < 2) return null;

  const normTemplatePts   = normalizePointsForDTW(templatePts);
  const normChildStrokes  = normalizeStrokesForDTW(childStrokes);
  const childPts          = normChildStrokes.flat().map(p => ({ x: p.x, y: p.y }));

  const result = computeDTW(childPts, normTemplatePts);
  return result.normalizedDistance;
}
