import { computeShapePreviewPaths } from './shapePreviewGeometry';

const VIEW = 60;

describe('computeShapePreviewPaths', () => {
  test('a simple diagonal stroke scales to fit inside the preview box', () => {
    const strokes = [[{ x: 0, y: 0 }, { x: 100, y: 200 }]];
    const result = computeShapePreviewPaths(strokes, VIEW, VIEW, 6);
    expect(result).toHaveLength(1);
    result[0].forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEW);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(VIEW);
    });
  });

  test('preserves aspect ratio — a wide, short stroke stays wide and short', () => {
    const strokes = [[{ x: 0, y: 0 }, { x: 400, y: 40 }]];
    const [path] = computeShapePreviewPaths(strokes, VIEW, VIEW, 6);
    const w = Math.max(...path.map(p => p.x)) - Math.min(...path.map(p => p.x));
    const h = Math.max(...path.map(p => p.y)) - Math.min(...path.map(p => p.y));
    expect(w / h).toBeCloseTo(400 / 40, 1);
  });

  test('multiple strokes are all rescaled into the same shared bounding box', () => {
    const strokes = [
      [{ x: 0, y: 0 }, { x: 50, y: 50 }],
      [{ x: 50, y: 0 }, { x: 0, y: 50 }],
    ];
    const result = computeShapePreviewPaths(strokes, VIEW, VIEW, 6);
    expect(result).toHaveLength(2);
    const allPoints = result.flat();
    allPoints.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEW);
    });
  });

  test('a purely vertical stroke (zero width) does not collapse to nothing', () => {
    const strokes = [[{ x: 10, y: 0 }, { x: 10, y: 100 }]];
    const result = computeShapePreviewPaths(strokes, VIEW, VIEW, 6);
    const h = Math.max(...result[0].map(p => p.y)) - Math.min(...result[0].map(p => p.y));
    expect(h).toBeGreaterThan(0);
  });

  test('a purely horizontal stroke (zero height) does not collapse to nothing', () => {
    const strokes = [[{ x: 0, y: 10 }, { x: 100, y: 10 }]];
    const result = computeShapePreviewPaths(strokes, VIEW, VIEW, 6);
    const w = Math.max(...result[0].map(p => p.x)) - Math.min(...result[0].map(p => p.x));
    expect(w).toBeGreaterThan(0);
  });

  test('empty/missing strokes return an empty array rather than throwing', () => {
    expect(computeShapePreviewPaths([], VIEW, VIEW)).toEqual([]);
    expect(computeShapePreviewPaths(null, VIEW, VIEW)).toEqual([]);
    expect(computeShapePreviewPaths(undefined, VIEW, VIEW)).toEqual([]);
    expect(computeShapePreviewPaths([[]], VIEW, VIEW)).toEqual([]);
  });

  test('a single point (fewer than 2 usable points total) returns an empty array', () => {
    expect(computeShapePreviewPaths([[{ x: 5, y: 5 }]], VIEW, VIEW)).toEqual([]);
  });

  test('malformed points (NaN/missing coordinates) are filtered out, never thrown on', () => {
    const strokes = [[{ x: NaN, y: 5 }, { x: 10, y: 10 }, { x: 20, y: 5 }, {}]];
    expect(() => computeShapePreviewPaths(strokes, VIEW, VIEW)).not.toThrow();
  });

  test('all-identical points (degenerate zero-size stroke) do not throw or produce NaN', () => {
    const strokes = [[{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }]];
    const result = computeShapePreviewPaths(strokes, VIEW, VIEW);
    result.flat().forEach(p => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });

  test('real captured stroke data (from the assessment DB) renders without throwing', () => {
    const realStroke = [
      { x: 282.82, y: 211.76, t: 0 }, { x: 282.82, y: 211.76, t: 12 }, { x: 350.97, y: 211.76, t: 99 },
      { x: 417.32, y: 215.51, t: 158 }, { x: 508.17, y: 223.99, t: 259 },
    ];
    const result = computeShapePreviewPaths([realStroke], VIEW, VIEW, 6);
    expect(result[0].length).toBe(realStroke.length);
  });
});
