// Feature 10 Step 3 — activityPreviewGeometry.js pure-function tests
// (spec §51, items 1-10). No React, no react-native-svg — runs in plain
// Node, matching this project's existing jest.config.js scope.

import { scaleStrokeToPreview, toPolylinePoints } from './activityPreviewGeometry';

const DIMS = { width: 50, height: 60, padding: 6 };

describe('1. normalized letter point scales correctly', () => {
  it('a mid-range fractional point scales proportionally into the cell', () => {
    const scaled = scaleStrokeToPreview([{ fx: 0.5, fy: 0.5 }], DIMS);
    const innerW = DIMS.width - DIMS.padding * 2;
    const innerH = DIMS.height - DIMS.padding * 2;
    expect(scaled[0].x).toBeCloseTo(DIMS.padding + 0.5 * innerW);
    expect(scaled[0].y).toBeCloseTo(DIMS.padding + 0.5 * innerH);
  });
});

describe('2. min coordinate', () => {
  it('fx=0, fy=0 scales to exactly (padding, padding)', () => {
    const scaled = scaleStrokeToPreview([{ fx: 0, fy: 0 }], DIMS);
    expect(scaled[0]).toEqual({ x: DIMS.padding, y: DIMS.padding });
  });
});

describe('3. max coordinate', () => {
  it('fx=1, fy=1 scales to exactly (width - padding, height - padding)', () => {
    const scaled = scaleStrokeToPreview([{ fx: 1, fy: 1 }], DIMS);
    expect(scaled[0]).toEqual({ x: DIMS.width - DIMS.padding, y: DIMS.height - DIMS.padding });
  });
});

describe('4. padding applied', () => {
  it('zero padding places fx=0 at exactly x=0', () => {
    const scaled = scaleStrokeToPreview([{ fx: 0, fy: 0 }], { width: 50, height: 60, padding: 0 });
    expect(scaled[0]).toEqual({ x: 0, y: 0 });
  });

  it('a larger padding shrinks the usable inner area proportionally', () => {
    const smallPad = scaleStrokeToPreview([{ fx: 1, fy: 1 }], { width: 100, height: 100, padding: 0 });
    const bigPad = scaleStrokeToPreview([{ fx: 1, fy: 1 }], { width: 100, height: 100, padding: 20 });
    expect(bigPad[0].x).not.toBe(smallPad[0].x);
    expect(bigPad[0].x).toBe(80); // padding(20) + 1 * innerW(60)
  });
});

describe('5. point order preserved', () => {
  it('scaled output preserves the exact input order', () => {
    const stroke = [{ fx: 0.1, fy: 0.1 }, { fx: 0.9, fy: 0.9 }, { fx: 0.5, fy: 0.2 }];
    const scaled = scaleStrokeToPreview(stroke, DIMS);
    expect(scaled).toHaveLength(3);
    expect(scaled[0].x).toBeLessThan(scaled[1].x);
  });
});

describe('6. multi-stroke separation preserved', () => {
  it('scaling two strokes independently never merges their points', () => {
    const strokeA = [{ fx: 0, fy: 0 }, { fx: 0.5, fy: 0.5 }];
    const strokeB = [{ fx: 1, fy: 1 }];
    const scaledA = scaleStrokeToPreview(strokeA, DIMS);
    const scaledB = scaleStrokeToPreview(strokeB, DIMS);
    expect(scaledA).toHaveLength(2);
    expect(scaledB).toHaveLength(1);
    expect(toPolylinePoints(scaledA)).not.toBe(toPolylinePoints(scaledB));
  });
});

describe('7. input immutability', () => {
  it('the source stroke array/points are never mutated', () => {
    const stroke = [{ fx: 0.25, fy: 0.75 }];
    const before = JSON.stringify(stroke);
    scaleStrokeToPreview(stroke, DIMS);
    expect(JSON.stringify(stroke)).toBe(before);
  });

  it('mutating the returned scaled points never touches the source stroke', () => {
    const stroke = [{ fx: 0.25, fy: 0.75 }];
    const scaled = scaleStrokeToPreview(stroke, DIMS);
    scaled[0].x = -999;
    expect(stroke[0].fx).toBe(0.25);
  });
});

describe('8. invalid point skipped safely', () => {
  it('null/undefined/non-finite points are dropped, never crash, never produce NaN', () => {
    const stroke = [{ fx: 0.2, fy: 0.2 }, null, { fx: NaN, fy: 0.5 }, undefined, { fx: 0.8, fy: 0.8 }];
    const scaled = scaleStrokeToPreview(stroke, DIMS);
    expect(scaled).toHaveLength(2);
    for (const p of scaled) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('a non-array stroke returns [] rather than throwing', () => {
    expect(scaleStrokeToPreview(null, DIMS)).toEqual([]);
    expect(scaleStrokeToPreview(undefined, DIMS)).toEqual([]);
    expect(scaleStrokeToPreview('not-an-array', DIMS)).toEqual([]);
  });

  it('non-finite dimensions return [] rather than producing NaN output', () => {
    expect(scaleStrokeToPreview([{ fx: 0.5, fy: 0.5 }], { width: NaN, height: 60 })).toEqual([]);
  });
});

describe('9. output finite', () => {
  it('every scaled point is a finite number, across a full realistic stroke', () => {
    const stroke = [{ fx: 0, fy: 0 }, { fx: 0.5, fy: 0.5 }, { fx: 1, fy: 1 }];
    const scaled = scaleStrokeToPreview(stroke, DIMS);
    for (const p of scaled) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('10. polyline string deterministic', () => {
  it('the same points always produce the same string', () => {
    const points = [{ x: 1.5, y: 2.5 }, { x: 3, y: 4 }];
    expect(toPolylinePoints(points)).toBe(toPolylinePoints(points));
    expect(toPolylinePoints(points)).toBe('1.5,2.5 3,4');
  });

  it('a non-array input returns an empty string, never throws', () => {
    expect(toPolylinePoints(null)).toBe('');
    expect(toPolylinePoints(undefined)).toBe('');
  });

  it('malformed points are filtered out of the string safely', () => {
    const points = [{ x: 1, y: 1 }, null, { x: NaN, y: 2 }, { x: 3, y: 3 }];
    expect(toPolylinePoints(points)).toBe('1,1 3,3');
  });
});
