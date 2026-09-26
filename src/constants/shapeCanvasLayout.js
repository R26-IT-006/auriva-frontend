/**
 * shapeCanvasLayout.js
 *
 * The initial shape-assessment canvas geometry, in ONE place — shared by
 * ShapeAssessmentScreen and the "watch first" assessment demonstration.
 *
 * Values are UNCHANGED from ShapeAssessmentScreen.js's own declarations; the
 * module is a move, not a redesign. The shape templates themselves are NOT
 * here: those come from unifiedShapeScoreMirror.js's `computeShapeTemplate`,
 * which is also what the unified motor score is measured against, so the
 * guide, the pointer, the demonstration and the score can never disagree
 * about where a shape is.
 */

'use strict';

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SHAPE_SCREEN_WIDTH  = SCREEN_WIDTH;
export const SHAPE_SCREEN_HEIGHT = SCREEN_HEIGHT;

export const CANVAS_WIDTH  = SCREEN_WIDTH  * 0.6;
export const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.55;
export const CANVAS_CX     = CANVAS_WIDTH  / 2;
export const CANVAS_CY     = CANVAS_HEIGHT / 2;

export const POINTER_SIZE = 14;
export const POINTER_HALF = POINTER_SIZE / 2;

/**
 * Start coordinates (SVG space) for the pulsing "start here" ring — these
 * match GuideShape's own start dots exactly.
 */
export const SHAPE_STARTS = {
  horizontal_line: { x: CANVAS_CX - 200,  y: CANVAS_CY        },
  vertical_line:   { x: CANVAS_CX,        y: CANVAS_CY - 150  },
  full_circle:     { x: CANVAS_CX,        y: CANVAS_CY - 120  },
  half_circle:     { x: CANVAS_CX - 150,  y: CANVAS_CY        },
  zigzag:          { x: CANVAS_CX - 180,  y: CANVAS_CY + 40   },
  curve_wave:      { x: CANVAS_CX - 180,  y: CANVAS_CY        },
};
