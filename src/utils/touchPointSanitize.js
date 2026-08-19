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

// @param {number} pageX/pageY — nativeEvent.pageX/pageY (screen-absolute)
// @param {{x: number, y: number}} origin — the canvas view's own screen
//   position, from View.measureInWindow(), captured once on layout.
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
