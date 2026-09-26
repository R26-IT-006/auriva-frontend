/**
 * canvasDrawingState.js
 *
 * Does this canvas currently hold any of the child's own drawing?
 *
 * ── Why a shared predicate ───────────────────────────────────────────────
 * The Clear button used to render unconditionally, so a child saw an offer to
 * erase a canvas they had not drawn on yet. Deciding that per screen would
 * mean six slightly different answers to one question, and the screens already
 * carry a `hasDrawn` flag that means something else: it gates the guide, the
 * tracer and the adaptive recommendation, and it is deliberately NOT what this
 * returns. Clear must follow the CANVAS, not the session.
 *
 * ── What counts ──────────────────────────────────────────────────────────
 * Both halves of the stroke state, because the child's very first point lives
 * in `currentPath` and does not reach `allPaths` until they lift their finger.
 * Waiting for the release would leave Clear hidden through the whole of the
 * first stroke.
 *
 * An empty stroke is not drawing: `[[]]` is what a canvas looks like the
 * instant after a stroke is discarded, and it must read as empty.
 */

'use strict';

const strokeHasPoints = (stroke) => Array.isArray(stroke) && stroke.length > 0;

/**
 * @param {{allPaths?: Array, currentPath?: Array}} args — the two stroke
 *   arrays every writing canvas in the module keeps.
 * @returns {boolean} true when at least one real point has been drawn.
 */
export function hasCanvasDrawing({ allPaths, currentPath } = {}) {
  if (strokeHasPoints(currentPath)) return true;
  return Array.isArray(allPaths) && allPaths.some(strokeHasPoints);
}
