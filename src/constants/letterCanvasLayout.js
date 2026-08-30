/**
 * letterCanvasLayout.js
 *
 * The letter-writing canvas geometry, in ONE place.
 *
 * These numbers were previously declared identically at the top of
 * LetterWritingScreen.js and UppercaseWritingScreen.js — byte-for-byte the
 * same expressions in both files. They are now shared, because a third
 * consumer arrived: the "watch first" demonstration renders the same canvas
 * the child is about to write on, and a demo drawn at even slightly
 * different dimensions would teach a letter at the wrong size.
 *
 * Values are UNCHANGED from both screens' own declarations. This module is a
 * move, not a redesign — the aspect correction, the 4-line ruling fractions
 * and the column split are all exactly as they were.
 */

'use strict';

import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const LETTER_SCREEN_W = SCREEN_W;
export const LETTER_SCREEN_H = SCREEN_H;
export const PAD = 16;

// Two-column split — mirrors WordWritingScreen layout
export const COL_L            = Math.round(SCREEN_W * 0.43);   // left column (letter card)
export const LETTER_CARD_SIZE = COL_L - 8;                      // card fills the column
export const CANVAS_W         = SCREEN_W - COL_L - PAD * 2;     // canvas = right column width
export const CANVAS_H         = Math.round(SCREEN_H * 0.50);    // 50 % of screen height

// Aspect-ratio correction: map fx fractions so equal fx/fy deltas produce
// equal pixel distances, keeping letter shapes true across all devices.
export const ASPECT  = CANVAS_W / CANVAS_H;
export const aspectX = (fx) => 0.5 + (fx - 0.5) / ASPECT;

// 4-line handwriting ruling — evenly spaced (0.28 gap), 0.08 margins
export const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
export const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
export const LINE_3 = Math.round(CANVAS_H * 0.64);  // baseline     — red dashed
export const LINE_4 = Math.round(CANVAS_H * 0.92);  // descender    — blue solid
