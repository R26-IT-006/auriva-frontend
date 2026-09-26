import { clampToCanvas, isImplausibleJump, pageToLocal } from './touchPointSanitize';

describe('pageToLocal', () => {
  test('subtracts the measured canvas origin from absolute screen coordinates', () => {
    expect(pageToLocal(150, 220, { x: 100, y: 200 })).toEqual({ x: 50, y: 20 });
  });

  test('a canvas at the screen origin (0,0) passes coordinates through unchanged', () => {
    expect(pageToLocal(75, 40, { x: 0, y: 0 })).toEqual({ x: 75, y: 40 });
  });

  test('a missing/not-yet-measured origin falls back to (0,0) rather than throwing', () => {
    expect(pageToLocal(75, 40, null)).toEqual({ x: 75, y: 40 });
    expect(pageToLocal(75, 40, undefined)).toEqual({ x: 75, y: 40 });
    expect(pageToLocal(75, 40, {})).toEqual({ x: 75, y: 40 });
  });

  test('stays stable across a simulated drag near the canvas edge — the frame never re-bases', () => {
    const origin = { x: 300, y: 150 };
    // A drag that grazes the border: page coordinates move smoothly and
    // slowly, so the resulting local coordinates must too (no re-basing
    // jump partway through, unlike the raw locationX/locationY bug this
    // replaces).
    const pagePoints = [{ x: 310, y: 160 }, { x: 305, y: 158 }, { x: 300, y: 156 }, { x: 298, y: 155 }];
    const localPoints = pagePoints.map(p => pageToLocal(p.x, p.y, origin));
    for (let i = 1; i < localPoints.length; i++) {
      const dist = Math.hypot(localPoints[i].x - localPoints[i - 1].x, localPoints[i].y - localPoints[i - 1].y);
      expect(dist).toBeLessThan(10);
    }
  });
});

describe('clampToCanvas', () => {
  test('a point already inside the canvas is returned unchanged', () => {
    expect(clampToCanvas(50, 60, 490, 220)).toEqual({ x: 50, y: 60 });
  });

  test('a point exactly on the border is unchanged', () => {
    expect(clampToCanvas(0, 0, 490, 220)).toEqual({ x: 0, y: 0 });
    expect(clampToCanvas(490, 220, 490, 220)).toEqual({ x: 490, y: 220 });
  });

  test('negative overshoot (touch just past the left/top border) clamps to 0', () => {
    expect(clampToCanvas(-4, -1.5, 490, 220)).toEqual({ x: 0, y: 0 });
  });

  test('positive overshoot (touch just past the right/bottom border) clamps to the edge', () => {
    expect(clampToCanvas(496, 225, 490, 220)).toEqual({ x: 490, y: 220 });
  });

  test('a wild out-of-range value still clamps into bounds rather than passing through', () => {
    expect(clampToCanvas(-9999, 9999, 490, 220)).toEqual({ x: 0, y: 220 });
  });
});

describe('isImplausibleJump', () => {
  const W = 490, H = 220;

  test('no previous point (start of a stroke) is never implausible', () => {
    expect(isImplausibleJump(null, { x: 10, y: 10 }, W, H)).toBe(false);
  });

  test('a normal small move between two touch events is plausible', () => {
    expect(isImplausibleJump({ x: 100, y: 100 }, { x: 106, y: 103 }, W, H)).toBe(false);
  });

  test('a fast but real drag is still plausible', () => {
    expect(isImplausibleJump({ x: 50, y: 50 }, { x: 130, y: 90 }, W, H)).toBe(false);
  });

  test('a border-glitch teleport clear across the canvas is implausible', () => {
    expect(isImplausibleJump({ x: 2, y: 100 }, { x: 488, y: 100 }, W, H)).toBe(true);
  });

  test('scales with canvas size — the same relative jump is implausible on a small canvas too', () => {
    expect(isImplausibleJump({ x: 1, y: 50 }, { x: 199, y: 50 }, 200, 100)).toBe(true);
  });
});
