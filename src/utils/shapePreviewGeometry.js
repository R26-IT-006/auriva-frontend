// Teacher report — per-shape drawing preview. The child's raw strokes are
// already sent to the client by GET /handwriting/initial-report (nothing
// new exposed here); this turns them into a small, self-contained SVG-ready
// path so the teacher can see roughly how the child actually drew each
// shape, right next to its score. Deliberately scales to the STROKE'S OWN
// bounding box rather than the original drawing canvas's pixel size — the
// canvas size varies by device and isn't even stored for pre-unification
// assessments (see deriveMotorScoreFromStoredShape), but the raw points
// always carry their own real proportions, which is all a small preview
// needs.
//
// @param {Array<Array<{x: number, y: number}>>} strokes
// @param {number} viewW / viewH — target preview box size (pixels)
// @param {number} padding — inset from the box edges, same units
// @returns {Array<Array<{x: number, y: number}>>} strokes rescaled/
//   translated to fit inside [padding, viewW-padding] × [padding, viewH-padding],
//   preserving the original aspect ratio and centered. Empty input (no
//   strokes, or strokes with fewer than 2 usable points total) returns [].
export function computeShapePreviewPaths(strokes, viewW, viewH, padding = 6) {
  if (!Array.isArray(strokes) || strokes.length === 0) return [];

  const cleanStrokes = strokes
    .map(stroke => (Array.isArray(stroke) ? stroke.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : []))
    .filter(stroke => stroke.length > 0);

  const allPoints = cleanStrokes.flat();
  if (allPoints.length < 2) return [];

  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));
  const rawW = maxX - minX;
  const rawH = maxY - minY;

  const availW = Math.max(1, viewW - padding * 2);
  const availH = Math.max(1, viewH - padding * 2);

  // A perfectly flat stroke (a single dot, or a straight horizontal/
  // vertical line with zero extent on one axis) has a 0 in rawW or rawH —
  // fall back to the OTHER axis's scale so it doesn't collapse to a point;
  // a stroke with zero extent on BOTH axes (a single point) already failed
  // the allPoints.length < 2 check above only when every point is
  // identical, so guard that too.
  const scaleX = rawW > 0 ? availW / rawW : null;
  const scaleY = rawH > 0 ? availH / rawH : null;
  const scale = Math.min(scaleX ?? scaleY ?? 1, scaleY ?? scaleX ?? 1);
  if (!Number.isFinite(scale) || scale <= 0) return [];

  const scaledW = rawW * scale;
  const scaledH = rawH * scale;
  const offsetX = padding + (availW - scaledW) / 2;
  const offsetY = padding + (availH - scaledH) / 2;

  return cleanStrokes.map(stroke =>
    stroke.map(p => ({
      x: offsetX + (p.x - minX) * scale,
      y: offsetY + (p.y - minY) * scale,
    }))
  );
}
