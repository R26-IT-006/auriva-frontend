/**
 * wordActivityLayout.js
 *
 * The dimensions and surface treatment the five word activities share, so
 * A–E read as one family instead of five near-misses.
 *
 * ── What was inconsistent ────────────────────────────────────────────────
 * A, C and D already agreed (pane 240 / frame 212 / image 170). E did not
 * (170 / 150 / 130), and B's answer grid was capped at `maxWidth: 320` inside
 * a right-hand column with roughly 446 to give — four answer pictures at 118
 * each, in the most image-dependent exercise on the screen.
 *
 * ── The double frame ─────────────────────────────────────────────────────
 * Each exercise drew a tinted, 2px-bordered square, and WordImageDisplay's
 * emoji fallback drew ANOTHER white, shadowed card inside it. Two nested
 * surfaces around one picture. The outer one is kept and softened; the inner
 * one is gone.
 *
 * ── Why E is smaller, deliberately ───────────────────────────────────────
 * `wordExerciseECanvas.computeExerciseECanvasSize` derives the writing canvas
 * from `IMAGE_COL_W = 170`. Widening E's image column would change CANVAS_W
 * and CANVAS_H — and with them the guide path, the guide boxes and the
 * coordinate space every stroke is stored in. So E keeps its column and grows
 * its image only within it. Same treatment, its own size: the activity
 * genuinely differs, and the canvas contract wins.
 */

'use strict';

/** The support picture on A, C, D — the shared "family" size. */
export const SUPPORT_IMAGE = Object.freeze({
  paneWidth:  278,
  frameSize:  262,
  imageSize:  230,
  radius:      28,
  borderWidth:  1,
});

/**
 * E's support picture. Same treatment, smaller box, because its column width
 * is an input to the canvas geometry and must not move.
 */
export const SUPPORT_IMAGE_COMPACT = Object.freeze({
  paneWidth:  170,   // MUST match wordExerciseECanvas.IMAGE_COL_W
  frameSize:  164,
  imageSize:  148,
  radius:      24,
  borderWidth:  1,
});

/** B's four answer pictures. */
export const ANSWER_IMAGE = Object.freeze({
  imageSize:     150,
  cellPadding:    10,
  borderWidth:     2,
  radius:         20,
  gap:            18,
  // 2 x (150 + 10*2 + 2*2) + 18 = 386. Two columns, four cells, no scrolling.
  gridMaxWidth:  400,
});

/** The row every activity body lays out with. */
export const BODY = Object.freeze({
  columnGap: 34,
});

/**
 * One simple surface for a support picture: a soft tint of the screen's own
 * colour, a hairline outline, a modest radius, and enough room that the
 * picture never touches an edge.
 *
 * @param {{button: string}} theme
 * @param {typeof SUPPORT_IMAGE} spec
 */
export function supportImageFrameStyle(theme, spec = SUPPORT_IMAGE) {
  return {
    width: spec.frameSize,
    height: spec.frameSize,
    borderRadius: spec.radius,
    borderWidth: spec.borderWidth,
    backgroundColor: `${theme?.button ?? '#000000'}0D`,
    borderColor: `${theme?.button ?? '#000000'}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  };
}
