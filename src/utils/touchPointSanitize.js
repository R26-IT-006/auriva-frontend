// Sanitizes raw PanResponder touch coordinates before they become a stroke
// point, on every handwriting drawing canvas. Prevents a long, straight,
// unintended line appearing when a touch runs near the canvas border.
//
// Why page coordinates: React Native's `nativeEvent.locationX/locationY` are
// relative to whichever native view the touch currently appears to be over.
// When a drag grazes the canvas border, they can be re-based mid-gesture
// (an RN/Android quirk). Each event still looks like a small step, but the
// stroke ends up as one long straight line. pageToLocal() instead uses
// `nativeEvent.pageX/pageY`, which always share one reference frame, minus
// the canvas origin measured with `View.measure()` on layout (also page
// space; see mapTouchToCanvas below).
//
// clampToCanvas() and isImplausibleJump() are defense-in-depth: a touch can
// still land past the canvas edge (clamping keeps drawing up to the edge
// correct), and a single event can still glitch (the jump guard drops it).
//
// All four functions are pure and shared by every drawing canvas
// (LetterWritingScreen, UppercaseWritingScreen, ShapeAssessmentScreen,
// PreWritingActivityScreen, WordWritingScreen, ExerciseE_WriteWord).

// @param {number} pageX/pageY — nativeEvent.pageX/pageY (page space)
// @param {{x: number, y: number}} origin — the canvas view's own position in
//   THE SAME page space, from View.measure()'s pageX/pageY, captured on layout.
//   Deliberately not measureInWindow(): see mapTouchToCanvas below.
export function pageToLocal(pageX, pageY, origin) {
  return {
    x: pageX - (origin?.x ?? 0),
    y: pageY - (origin?.y ?? 0),
  };
}

// Keeps a mapped point inside the canvas so a border touch cannot produce an off-canvas stroke.
export function clampToCanvas(x, y, width, height) {
  return {
    x: Math.min(Math.max(x, 0), width),
    y: Math.min(Math.max(y, 0), height),
  };
}

// A fraction of the canvas's larger dimension — generous enough that fast,
// legitimate drawing is never mistaken for a glitch, tight enough to catch
// an implausible single-event jump (e.g. from one edge clear across to the
// other) right at a border.
const MAX_PLAUSIBLE_JUMP_FRACTION = 0.6;

export function isImplausibleJump(lastPoint, nextPoint, width, height) {
  if (!lastPoint || !nextPoint) return false;
  const maxJump = Math.max(width, height) * MAX_PLAUSIBLE_JUMP_FRACTION;
  return Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) > maxJump;
}

/**
 * Maps a raw touch into the canvas's LOGICAL coordinate space — the space the
 * SVG actually draws in.
 *
 * ── Why this is a subtraction and nothing more ───────────────────────────
 * Every canvas has the identical structure: the responder, the measured view
 * and the Svg's parent are ONE element, and the Svg is its direct child at
 * its full logical size:
 *
 *     <View style={canvasCard} ref onLayout {...panHandlers}>   // border-box
 *       <Svg width={CANVAS_W} height={CANVAS_H}>                // full size
 *
 * React Native's box model is border-box, so the card's CONTENT box is
 * `CANVAS_H - 2*border` — but the Svg is not shrunk into it (flexShrink
 * defaults to 0). It is laid out at the content origin at its FULL height and
 * the overflow is clipped. So the Svg's coordinate space begins exactly
 * `border` px inside the view and runs 1:1 from there.
 *
 * That makes the whole transform:  local - border. (No scaling: the content
 * box `measured - 2*border` is not the size the Svg is drawn at.)
 *
 * ── Why View.measure(), not measureInWindow() ────────────────────────────
 * Touches arrive in page space (`nativeEvent.pageX/pageY`). On Android, when
 * the app draws under a translucent status bar, window space excludes the
 * system inset and page space includes it. A window-space origin would leave
 * a constant vertical offset. `View.measure()` reports the view's own
 * pageX/pageY, so origin and touch share one space.
 *
 * Output stays in CANVAS_W/CANVAS_H logical units, the same space as every
 * reference path, guide and score.
 *
 * @param {{
 *   pageX: number, pageY: number,
 *   origin: {x: number, y: number},   // measure() pageX/pageY — page space
 *   logical: {width: number, height: number},   // CANVAS_W / CANVAS_H
 *   inset?: number,                   // the canvas's own borderWidth
 * }} args
 * @returns {{x: number, y: number}} clamped logical coordinates
 */
export function mapTouchToCanvas({ pageX, pageY, origin, logical, inset = 0 }) {
  const local = pageToLocal(pageX, pageY, origin);

  const border = Number.isFinite(inset) && inset > 0 ? inset : 0;

  // A missing/unusable logical size clamps to 0 rather than producing NaN.
  const logicalW = Number(logical?.width);
  const logicalH = Number(logical?.height);
  const w = Number.isFinite(logicalW) && logicalW > 0 ? logicalW : 0;
  const h = Number.isFinite(logicalH) && logicalH > 0 ? logicalH : 0;

  // A non-numeric touch coordinate would clamp to NaN and poison the stroke;
  // treat it as the canvas origin instead. Infinities clamp normally.
  const lx = Number.isNaN(local.x) ? 0 : local.x;
  const ly = Number.isNaN(local.y) ? 0 : local.y;

  return clampToCanvas(lx - border, ly - border, w, h);
}
