/**
 * resultGifFeedback.js
 *
 * Timing and travel for the shared right/wrong animation.
 *
 * Separate from the component itself so callers — and tests — can read these
 * without pulling in react-native and expo-image, which the pure-node test
 * config cannot load. The component holds the markup; this holds the numbers.
 */

'use strict';

/**
 * How long the verdict stays up. This is the value the five concept screens
 * have always used; word practice A–D adopt it so one answer feels the same
 * everywhere.
 */
export const RESULT_GIF_MS = 1200;

/** Distance the popup travels in from the right edge, in px. */
export const RESULT_GIF_OFFSCREEN = 280;
