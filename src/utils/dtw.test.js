import { computeDTW, computeMultiStrokeDTW } from './dtw';
import { normalizePointsForDTW } from './dtwNormalization';

// ── Shared fixtures ─────────────────────────────────────────────────────────
// An "L" shape (down, then right) in raw device-pixel coordinates, standing
// in for a template sampled at some arbitrary canvas size. Deliberately not
// a straight line, so direction/shape differences produce unambiguous
// distance differences.
function lShapeTemplate() {
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push({ x: 200, y: 100 + i * 20 }); // down
  for (let i = 1; i <= 6; i++) pts.push({ x: 200 + i * 20, y: 260 }); // right
  return pts;
}

// A visually different shape (a horizontal-only line) used as the "wrong
// shape" case — same point count, same bounding-box scale, different path.
function horizontalLineShape() {
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push({ x: 200 + i * 20, y: 180 });
  return pts;
}

function shift(points, dx, dy) {
  return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

function scale(points, factor) {
  return points.map(p => ({ x: p.x * factor, y: p.y * factor }));
}

function jitter(points, amplitude, seed = 1) {
  // Deterministic pseudo-random noise so the test is not flaky.
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return points.map(p => ({
    x: p.x + (rand() - 0.5) * 2 * amplitude,
    y: p.y + (rand() - 0.5) * 2 * amplitude,
  }));
}

function normDTW(childPoints, templatePoints) {
  const child = normalizePointsForDTW(childPoints);
  const template = normalizePointsForDTW(templatePoints);
  return computeDTW(child, template).normalizedDistance;
}

describe('computeDTW after dtw_norm_v1 normalization', () => {
  it('perfect match gives very low DTW', () => {
    const template = lShapeTemplate();
    const distance = normDTW(template, template);
    expect(distance).toBeLessThan(1);
  });

  it('a shifted path (same shape, translated) gives low/moderate DTW', () => {
    const template = lShapeTemplate();
    const shifted = shift(template, 400, 250); // simulates writing the letter in a different spot
    const distance = normDTW(shifted, template);
    expect(distance).toBeLessThan(2);
  });

  it('a scaled-up path (same shape, larger) gives low/moderate DTW', () => {
    const template = lShapeTemplate();
    const larger = scale(template, 2.2); // simulates a bigger canvas / bigger handwriting
    const distance = normDTW(larger, template);
    expect(distance).toBeLessThan(2);
  });

  it('a scaled-down path (same shape, smaller) gives low/moderate DTW', () => {
    const template = lShapeTemplate();
    const smaller = scale(template, 0.4);
    const distance = normDTW(smaller, template);
    expect(distance).toBeLessThan(2);
  });

  it('a wrong shape gives high DTW', () => {
    const template = lShapeTemplate();
    const wrongShape = horizontalLineShape();
    const perfectDistance = normDTW(template, template);
    const wrongDistance = normDTW(wrongShape, template);
    expect(wrongDistance).toBeGreaterThan(perfectDistance + 10);
  });

  it('a reversed path gives a higher DTW than the same path drawn forwards', () => {
    const template = lShapeTemplate();
    const reversed = [...template].reverse();
    const forwardDistance  = normDTW(template, template);
    const reversedDistance = normDTW(reversed, template);
    expect(reversedDistance).toBeGreaterThan(forwardDistance);
  });

  it('a noisy correct path gives a moderate DTW — worse than perfect, much better than wrong-shape', () => {
    const template = lShapeTemplate();
    const noisy = jitter(template, 3); // +/-3px jitter, small relative to the ~160px shape span
    const wrongShape = horizontalLineShape();
    const perfectDistance = normDTW(template, template);
    const noisyDistance   = normDTW(noisy, template);
    const wrongDistance   = normDTW(wrongShape, template);
    expect(noisyDistance).toBeGreaterThan(perfectDistance);
    expect(noisyDistance).toBeLessThan(wrongDistance);
  });

  it('device/canvas size does not change the distance for the same relative handwriting quality', () => {
    // Same shape traced with the same *relative* jitter on a small vs. a
    // large simulated canvas — dtw_distance must come out the same, which
    // is the whole point of normalizing before DTW runs.
    const small = lShapeTemplate();
    const large = scale(small, 3);
    const smallNoisy = jitter(small, 3, 7);
    const largeNoisy = jitter(large, 9, 7); // same relative jitter (3x canvas -> 3x jitter)
    const smallDistance = normDTW(smallNoisy, small);
    const largeDistance = normDTW(largeNoisy, large);
    expect(smallDistance).toBeCloseTo(largeDistance, 1);
  });
});

describe('computeDTW missing/short input handling (never fabricates 0 or a perfect score)', () => {
  it('returns null distance for an empty child path', () => {
    const template = lShapeTemplate();
    expect(computeDTW([], template).normalizedDistance).toBeNull();
  });

  it('returns null distance for a single-point child path (too short to compare)', () => {
    const template = lShapeTemplate();
    expect(computeDTW([{ x: 1, y: 1 }], template).normalizedDistance).toBeNull();
  });
});

// ── Multi-stroke letters (e.g. 't', 'k') ────────────────────────────────────
// Template: a vertical stroke crossed by a horizontal stroke, expressed in
// the {fx, fy} fractional-waypoint format LETTER_PATHS uses.
const CROSS_TEMPLATE = [
  [{ fx: 0.5, fy: 0.1 }, { fx: 0.5, fy: 0.9 }],   // stroke 0: vertical
  [{ fx: 0.3, fy: 0.4 }, { fx: 0.7, fy: 0.4 }],   // stroke 1: horizontal crossbar
];
const CANVAS = 300; // square canvas -> aspect ratio 1, fx/fy map directly to pixels

function densify(p0, p1, n = 6) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) });
  }
  return pts;
}

function crossChildStrokes() {
  const vertical   = densify({ x: 150, y: 30 },  { x: 150, y: 270 });
  const horizontal = densify({ x: 90,  y: 120 }, { x: 210, y: 120 });
  return { vertical, horizontal };
}

describe('computeMultiStrokeDTW — stroke order scoring', () => {
  it('drawing strokes in template order reports strokeOrderMatchesTemplate = true', () => {
    const { vertical, horizontal } = crossChildStrokes();
    const result = computeMultiStrokeDTW(CROSS_TEMPLATE, [vertical, horizontal], CANVAS, CANVAS);
    expect(result.strokeOrderMeta.strokeOrderMatchesTemplate).toBe(true);
  });

  it('drawing the same strokes in the opposite order reports strokeOrderMatchesTemplate = false '
    + 'and receives a small order penalty (not a strict/harsh one)', () => {
    const { vertical, horizontal } = crossChildStrokes();
    const correctOrder = computeMultiStrokeDTW(CROSS_TEMPLATE, [vertical, horizontal], CANVAS, CANVAS);
    const wrongOrder    = computeMultiStrokeDTW(CROSS_TEMPLATE, [horizontal, vertical], CANVAS, CANVAS);

    expect(wrongOrder.strokeOrderMeta.strokeOrderMatchesTemplate).toBe(false);
    expect(wrongOrder.normalizedDistance).toBeGreaterThan(correctOrder.normalizedDistance);
    // Small penalty: the gap should be a minor nudge, not enough to turn a
    // near-perfect trace into a failing one on its own.
    const gap = wrongOrder.normalizedDistance - correctOrder.normalizedDistance;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(10);
  });
});

describe('computeMultiStrokeDTW — missing/short stroke handled safely', () => {
  it('returns null distance (not 0, not a fabricated score) when no strokes were drawn at all', () => {
    const result = computeMultiStrokeDTW(CROSS_TEMPLATE, [], CANVAS, CANVAS);
    expect(result.normalizedDistance).toBeNull();
    expect(result.strokeOrderMeta.childStrokeCount).toBe(0);
  });

  it('a genuinely missing stroke (child drew only one of two required strokes) '
    + 'produces a real, high distance — not null, not 0', () => {
    const { vertical } = crossChildStrokes();
    const bothStrokes = computeMultiStrokeDTW(
      CROSS_TEMPLATE, [vertical, crossChildStrokes().horizontal], CANVAS, CANVAS
    );
    const oneStrokeOnly = computeMultiStrokeDTW(CROSS_TEMPLATE, [vertical], CANVAS, CANVAS);

    expect(oneStrokeOnly.normalizedDistance).not.toBeNull();
    expect(oneStrokeOnly.normalizedDistance).toBeGreaterThan(0);
    expect(oneStrokeOnly.normalizedDistance).toBeGreaterThan(bothStrokes.normalizedDistance);
  });

  it('single-stroke template: an empty child path returns null distance, never 0', () => {
    const singleStrokeTemplate = [{ fx: 0.5, fy: 0.1 }, { fx: 0.5, fy: 0.9 }];
    const result = computeMultiStrokeDTW(singleStrokeTemplate, [], CANVAS, CANVAS);
    expect(result.normalizedDistance).toBeNull();
  });
});
