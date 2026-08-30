/**
 * The only custom LEFT-preview letterforms approved for LetterWritingStage.
 * These are display geometry only and must never enter LETTER_PATHS, tracing,
 * touch mapping, DTW, or scoring.
 */

'use strict';

export const LEFT_PREVIEW_STROKE_WIDTH = 14;
export const LEFT_PREVIEW_VIEW_BOX = '0 0 100 100';

const path = (d) => Object.freeze({ type: 'path', d });
const line = (x1, y1, x2, y2) => Object.freeze({ type: 'line', x1, y1, x2, y2 });
const shape = (...elements) => Object.freeze({ elements: Object.freeze(elements) });

export const LEFT_PREVIEW_SHAPES = Object.freeze({
  a: shape(path('M 69 27 L 69 54 C 69 69 60 79 47 79 C 32 79 22 69 22 54 C 22 39 31 28 47 28 C 60 28 69 38 69 54 L 69 72 C 69 78 73 80 77 77')),
  I: shape(
    line(22, 18, 78, 18),
    line(50, 18, 50, 82),
    line(22, 82, 78, 82),
  ),
});

