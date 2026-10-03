/**
 * wordCanvasLayout.js
 *
 * The word-writing canvas geometry, in ONE place — shared by
 * WordWritingScreen and the "watch first" word demonstration, so the demo
 * can never lay a word out at a different width, height or letter position
 * than the screen the child meets next.
 *
 * Values are UNCHANGED from WordWritingScreen.js's own declarations; this is
 * a move, not a redesign. Note that they deliberately differ from the
 * single-letter canvas (constants/letterCanvasLayout.js): a whole word needs
 * far more horizontal room, so the image column is 0.28 of the screen rather
 * than 0.43, and the canvas is 46% of the height rather than 50%.
 */

'use strict';

import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const WORD_SCREEN_W = SCREEN_W;
export const WORD_SCREEN_H = SCREEN_H;
export const PAD = 16;

export const COL_L    = Math.round(SCREEN_W * 0.28);   // left column (image)
export const IMG_SIZE = COL_L - 8;                      // image fills the column
// The canvas is 85% of the right column's width — narrower, same height. The
// word guide's letter size and spacing come from CANVAS_H alone (x =
// 0.5·W + (fx − 0.5)·H in wordPaths.js), so a narrower canvas only re-centres
// the same word; nothing about the letters changes.
export const CANVAS_AREA_W = SCREEN_W - COL_L - PAD * 2;  // the right column's full width
export const CANVAS_W = Math.round(CANVAS_AREA_W * 0.85);
export const CANVAS_H = Math.round(SCREEN_H * 0.46);    // 46 % of screen height

// 4-line handwriting ruling — baseline/descender match the LETTER_PATHS
// fy=0.64/0.92 convention so the word guide sits exactly on these lines.
export const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
export const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
export const LINE_3 = Math.round(CANVAS_H * 0.64);  // baseline     — red dashed
export const LINE_4 = Math.round(CANVAS_H * 0.92);  // descender    — blue solid
