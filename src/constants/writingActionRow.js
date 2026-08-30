/**
 * writingActionRow.js
 *
 * The height a writing screen's action row reserves before anything is in it.
 *
 * ── The jump this exists to stop ─────────────────────────────────────────
 * Every writing screen's action row is content-sized, and BOTH its children
 * are conditional:
 *
 *     {canClearCanvas && <Clear/>}     appears on the first drawn point
 *     {hasDrawn && <Next/>}            appears when the finger lifts
 *
 * So at rest the row is its padding and nothing else — and the instant a child
 * touches the canvas, Clear appears and the row grows by roughly 45px. The row
 * sits below `mainRow`, which is `flex: 1` and centres its content, so the row
 * growing means the canvas is handed less space and re-centres INTO it: the
 * whole card, canvas included, jumps upward under the child's finger mid-
 * stroke. Lifting the finger added Next and moved it again.
 *
 * Reserving the row's full height up front makes both appearances free: the
 * buttons come and go horizontally inside a box whose height never changes.
 * Clear is still genuinely absent before drawing — this reserves space, it does
 * not render an invisible button.
 *
 * ── Derived, not guessed ─────────────────────────────────────────────────
 * The rows differ because their buttons differ, so the number is computed from
 * the tallest button each row can hold rather than hardcoded three times.
 * Nothing here touches the canvas, its coordinates or its geometry.
 */

'use strict';

/**
 * The rendered height of a single line of button label. Nunito at the sizes
 * these buttons use (13-17px) lands under this; it is the constant the
 * reservation is built on, deliberately generous by a pixel or two so a
 * slightly taller glyph cannot reintroduce the reflow.
 */
export const ACTION_LABEL_LINE_HEIGHT = 22;

/**
 * The minimum height an action row must reserve.
 *
 * @param {{
 *   maxButtonPaddingVertical: number,  // the TALLEST button's paddingVertical
 *   rowPaddingVertical?: number,       // the row's own paddingVertical
 *   maxButtonBorderWidth?: number,     // that button's borderWidth, if any
 * }} args
 * @returns {number} height in px, rounded up to a whole pixel.
 */
export function actionRowMinHeight({
  maxButtonPaddingVertical,
  rowPaddingVertical = 0,
  maxButtonBorderWidth = 0,
} = {}) {
  const button = ACTION_LABEL_LINE_HEIGHT
    + maxButtonPaddingVertical * 2
    + maxButtonBorderWidth * 2;
  return Math.ceil(button + rowPaddingVertical * 2);
}
