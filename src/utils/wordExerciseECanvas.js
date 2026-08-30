// Exercise E responsive canvas sizing (final-completion-pass fix — replaces
// the historical fixed ~490×220 canvas, which could clip on a small phone or
// leave excessive empty width on a tablet). Pure math, deliberately kept out
// of ExerciseE_WriteWord.js (which imports 'react-native' and so can't be
// unit-tested under this repo's plain-node jest config — see jest.config.js)
// so the sizing formula itself stays covered by an automated test.
//
// IMAGE_COL_W/OUTER_GAP mirror ExerciseE_WriteWord's own layout constants
// (styles.leftCol width + styles.wrap's row gap, plus a small safety margin
// for the screen's own outer padding) — keep both in sync if that layout
// changes.
const IMAGE_COL_W = 170;
const OUTER_GAP = 30 + 32;
const ASPECT_H_OVER_W = 220 / 490; // preserves the original 490:220 canvas proportion
const MIN_CANVAS_W = 300;
const MAX_CANVAS_W = 560;

/**
 * @param {number} screenWidth — Dimensions.get('window').width
 * @returns {{width: number, height: number}} canvas pixel dimensions, clamped
 *   to a usable range and rounded to whole pixels (matches every other
 *   canvas-dimension convention in this app — see WordWritingScreen.js).
 */
export function computeExerciseECanvasSize(screenWidth) {
  const available = Number(screenWidth) - IMAGE_COL_W - OUTER_GAP;
  const raw = Number.isFinite(available) ? available : MIN_CANVAS_W;
  const width = Math.round(Math.max(MIN_CANVAS_W, Math.min(MAX_CANVAS_W, raw)));
  const height = Math.round(width * ASPECT_H_OVER_W);
  return { width, height };
}
