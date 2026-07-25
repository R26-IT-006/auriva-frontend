import { create, act } from 'react-test-renderer';
import PortraitView from '../PortraitView';
import DrawingCanvas, { mapTouchToLogical, appendStroke, MAX_STROKES } from '../DrawingCanvas';

describe('PortraitView', () => {
  test('returns null for null strokes', () => {
    let root;
    act(() => { root = create(<PortraitView strokes={null} size={100} />); });
    expect(root.toJSON()).toBeNull();
  });

  test('returns null for an empty object', () => {
    let root;
    act(() => { root = create(<PortraitView strokes={{}} size={100} />); });
    expect(root.toJSON()).toBeNull();
  });

  test('returns null for an empty strokes array', () => {
    let root;
    act(() => { root = create(<PortraitView strokes={{ v: 1, w: 800, h: 600, strokes: [] }} size={100} />); });
    expect(root.toJSON()).toBeNull();
  });
});

describe('mapTouchToLogical (Fix 1 — touch-to-logical mapping)', () => {
  // Stored/logical space is 800x600; the on-screen container is a
  // differently-sized 400x300 (e.g. re-editing on a different device).
  const layoutW = 400, layoutH = 300, logicalW = 800, logicalH = 600;

  test('top-left corner maps to the logical origin', () => {
    expect(mapTouchToLogical(0, 0, layoutW, layoutH, logicalW, logicalH)).toEqual({ x: 0, y: 0 });
  });

  test('bottom-right corner maps to the logical bottom-right corner', () => {
    expect(mapTouchToLogical(layoutW, layoutH, layoutW, layoutH, logicalW, logicalH)).toEqual({ x: 800, y: 600 });
  });

  test('centre maps to the logical centre', () => {
    expect(mapTouchToLogical(layoutW / 2, layoutH / 2, layoutW, layoutH, logicalW, logicalH)).toEqual({ x: 400, y: 300 });
  });
});

describe('DrawingCanvas load-then-save without drawing (Fix 1 — lossless)', () => {
  test('emits byte-identical point values and unchanged w/h', () => {
    const initialStrokes = {
      v: 1,
      w: 800,
      h: 600,
      strokes: [
        { points: [{ x: 10.5, y: 20.3 }, { x: 15.2, y: 25.7 }], color: '#E53935', width: 24 },
      ],
    };
    const onChange = jest.fn();

    act(() => {
      create(<DrawingCanvas initialStrokes={initialStrokes} onChange={onChange} />);
    });

    expect(onChange).toHaveBeenCalledWith({
      v: 1,
      w: 800,
      h: 600,
      strokes: initialStrokes.strokes,
    });
  });
});

describe('appendStroke MAX_STROKES boundary', () => {
  const stroke = { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000000', width: 4 };

  test('stroke 500 is accepted', () => {
    const at499 = Array.from({ length: MAX_STROKES - 1 }, () => stroke);
    const at500 = appendStroke(at499, stroke);
    expect(at500.length).toBe(MAX_STROKES);
  });

  test('stroke 501 is ignored and existing strokes are untouched', () => {
    const at500 = Array.from({ length: MAX_STROKES }, () => stroke);
    const attempt501 = appendStroke(at500, stroke);
    expect(attempt501.length).toBe(MAX_STROKES);
    expect(attempt501).toBe(at500);
  });
});
