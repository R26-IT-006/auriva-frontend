import {
  normalizeStrokesForDTW,
  normalizePointsForDTW,
  NORMALIZATION_VERSION,
  NORMALIZED_SIZE,
} from './dtwNormalization';

describe('NORMALIZATION_VERSION', () => {
  it('is the documented dtw_norm_v1 tag', () => {
    expect(NORMALIZATION_VERSION).toBe('dtw_norm_v1');
  });
});

describe('normalizeStrokesForDTW', () => {
  it('translates the bounding box to the origin', () => {
    const strokes = [[{ x: 300, y: 400 }, { x: 320, y: 420 }]];
    const [normalized] = normalizeStrokesForDTW(strokes);
    const xs = normalized.map(p => p.x);
    const ys = normalized.map(p => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(0);
  });

  it('scales the larger bounding-box dimension to exactly NORMALIZED_SIZE', () => {
    // width 200, height 50 -> width is the larger dimension
    const strokes = [[{ x: 0, y: 0 }, { x: 200, y: 50 }]];
    const [normalized] = normalizeStrokesForDTW(strokes);
    const xs = normalized.map(p => p.x);
    const ys = normalized.map(p => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(NORMALIZED_SIZE, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(NORMALIZED_SIZE * 0.25, 5);
  });

  it('produces identical output for the same shape at a different position/scale/canvas size', () => {
    // Same square shape, once small near the origin, once large and shifted —
    // simulates the same letter drawn on a small vs. large-canvas device.
    const small = [[{ x: 10, y: 10 }, { x: 10, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 10 }]];
    const large = [[{ x: 500, y: 500 }, { x: 500, y: 700 }, { x: 700, y: 700 }, { x: 700, y: 500 }]];
    const [normSmall] = normalizeStrokesForDTW(small);
    const [normLarge] = normalizeStrokesForDTW(large);
    normSmall.forEach((p, i) => {
      expect(p.x).toBeCloseTo(normLarge[i].x, 5);
      expect(p.y).toBeCloseTo(normLarge[i].y, 5);
    });
  });

  it('preserves the array-of-strokes shape (stroke boundaries) and non-coordinate fields', () => {
    const strokes = [
      [{ x: 0, y: 0, t: 0, tAbs: 111, stroke_id: 1 }, { x: 10, y: 0, t: 5, tAbs: 116, stroke_id: 1 }],
      [{ x: 0, y: 10, t: 20, tAbs: 131, stroke_id: 2 }, { x: 10, y: 10, t: 25, tAbs: 136, stroke_id: 2 }],
    ];
    const normalized = normalizeStrokesForDTW(strokes);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toHaveLength(2);
    expect(normalized[1]).toHaveLength(2);
    expect(normalized[0][0].t).toBe(0);
    expect(normalized[0][0].tAbs).toBe(111);
    expect(normalized[0][0].stroke_id).toBe(1);
    expect(normalized[1][1].stroke_id).toBe(2);
  });

  it('does not mutate the input arrays/objects (raw data must survive untouched)', () => {
    const original = [[{ x: 300, y: 400 }, { x: 320, y: 420 }]];
    const snapshot = JSON.parse(JSON.stringify(original));
    normalizeStrokesForDTW(original);
    expect(original).toEqual(snapshot);
  });

  it('handles a degenerate (single-point / zero-extent) stroke without NaN or throwing', () => {
    const strokes = [[{ x: 50, y: 50 }, { x: 50, y: 50 }]];
    const [normalized] = normalizeStrokesForDTW(strokes);
    expect(Number.isFinite(normalized[0].x)).toBe(true);
    expect(Number.isFinite(normalized[0].y)).toBe(true);
    expect(normalized[0].x).toBe(0);
    expect(normalized[0].y).toBe(0);
  });

  it('returns an empty array for empty input', () => {
    expect(normalizeStrokesForDTW([])).toEqual([]);
    expect(normalizeStrokesForDTW(null)).toEqual([]);
  });

  it('shares one bounding box across all strokes so relative stroke position is preserved', () => {
    // Two strokes forming an L; normalizing them together must not
    // independently rescale each stroke to fill 0-100 on its own.
    const strokes = [
      [{ x: 0, y: 0 }, { x: 0, y: 100 }],   // tall vertical stroke
      [{ x: 0, y: 100 }, { x: 20, y: 100 }], // short horizontal stroke
    ];
    const normalized = normalizeStrokesForDTW(strokes);
    // Horizontal stroke's x-extent should be a small fraction of the
    // vertical stroke's y-extent (20/100 of it), not independently scaled to 100.
    const horizXExtent = Math.abs(normalized[1][1].x - normalized[1][0].x);
    const vertYExtent  = Math.abs(normalized[0][1].y - normalized[0][0].y);
    expect(horizXExtent).toBeCloseTo(vertYExtent * 0.2, 5);
  });
});

describe('normalizePointsForDTW', () => {
  it('normalizes a flat point array the same way as a single-stroke input', () => {
    const points = [{ x: 300, y: 400 }, { x: 320, y: 420 }];
    const viaFlat = normalizePointsForDTW(points);
    const [viaStrokes] = normalizeStrokesForDTW([points]);
    expect(viaFlat).toEqual(viaStrokes);
  });
});
