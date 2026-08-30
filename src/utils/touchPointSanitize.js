// Sanitizes raw PanResponder touch coordinates before they become a stroke
// point, on every handwriting drawing canvas. Fixes a real reported bug:
// touching near/at a canvas's border produces a long, straight, unintended
// line the child never drew.
//
// ROOT CAUSE (confirmed after an initial clamp-only fix did NOT fully
// resolve it — see pageToLocal() below, which is the actual fix; clamping
// and the jump guard are a secondary safety net, not the primary cause):
// React Native's `nativeEvent.locationX/locationY` are computed relative to
// *whichever native view the touch currently appears to be over*, not
// reliably relative to the PanResponder's own view, once a drag crosses a
// view boundary (a documented RN/Android quirk). A drag that grazes the
// canvas's border/rounded-corner/shadow edge can have `locationX/Y` silently
// re-based mid-gesture — each individual touch-move event still looks like a
// small, plausible step in ITS OWN (now-wrong) frame, so no single event
// looks like an obvious glitch, but the accumulated stroke ends up as one
// long straight line from the last correctly-framed point to wherever the
// re-based coordinates drifted to.
//
// THE FIX — pageToLocal(): use `nativeEvent.pageX/pageY` (absolute
// screen coordinates — always the SAME reference frame, regardless of which
// native view is nominally under the finger) minus the canvas's own
// on-screen origin, measured once via `View.measureInWindow()` on layout.
// This never re-bases mid-gesture, so it can't produce the bug above.
//
// clampToCanvas() / isImplausibleJump() remain as defense-in-depth: even
// with a stable coordinate frame, a touch can still genuinely land past the
// canvas edge (clamp keeps "draw right up to the edge" correct) or a single
// event can still glitch for unrelated reasons (the jump guard drops it).
//
// All three are pure, side-effect-free, and used identically across every
// drawing canvas (LetterWritingScreen, UppercaseWritingScreen,
// ShapeAssessmentScreen, PreWritingActivityScreen, WordWritingScreen,
// ExerciseE_WriteWord) — one fix, not six separate ones.

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

export function clampToCanvas(x, y, width, height) {
  return {
    x: Math.min(Math.max(x, 0), width),
    y: Math.min(Math.max(y, 0), height),
  };
}

// A fraction of the canvas's larger dimension â€” generous enough that fast,
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
 * That makes the whole transform:  local - border.
 *
 * A scale by `logical / (measured - 2*border)` was tried here and was wrong in
 * both directions: the denominator is the content box, which is not the size
 * the Svg is drawn at, and on a device where the two agree it multiplied every
 * coordinate by ~1.01 for nothing. Removed.
 *
 * ── The bug this fixes ───────────────────────────────────────────────────
 * The origin used to come from `measureInWindow()` while the touches come from
 * `nativeEvent.pageX/pageY`. On Android those are NOT the same coordinate
 * space when the app draws under a translucent status bar — window space
 * excludes the system inset, page space includes it. Subtracting a window-space
 * origin from a page-space touch left a CONSTANT vertical offset, invisible on
 * X because there is no equivalent horizontal inset. `View.measure()` reports
 * the view's own pageX/pageY, so origin and touch are now read in one space and
 * the difference is a true local coordinate.
 *
 * The renderer keeps drawing in CANVAS_W/CANVAS_H units, the stored point
 * format is unchanged, and every reference path, guide and score still lives in
 * the same logical space. Nothing downstream knows this happened.
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
