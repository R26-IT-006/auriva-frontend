import {
  calculateTotalDistance,
  calculateDuration,
  calculateAverageSpeed,
  calculateSegmentSpeeds,
  calculateSpeedStats,
  calculatePauseMetrics,
  calculateAttemptDurationFromAbsoluteTime,
  calculateAttemptAverageSpeed,
  calculateAttemptPauseMetrics,
  DEFAULT_PAUSE_THRESHOLD_MS,
} from './trajectoryFeatures';

// ─── calculateTotalDistance ─────────────────────────────────────────────────

describe('calculateTotalDistance', () => {
  it('computes the classic 3-4-5 triangle distance for two points', () => {
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: 3, y: 4, t: 10 }]];
    expect(calculateTotalDistance(strokes)).toBe(5);
  });

  it('sums distances across multiple points within one stroke', () => {
    const strokes = [[
      { x: 0, y: 0, t: 0 },
      { x: 3, y: 4, t: 10 },  // +5
      { x: 3, y: 4 + 12, t: 20 }, // +12
    ]];
    expect(calculateTotalDistance(strokes)).toBe(17);
  });

  it('never adds artificial distance between the end of one stroke and the start of the next', () => {
    const strokes = [
      [{ x: 0, y: 0, t: 0 }, { x: 3, y: 4, t: 10 }, { x: 3, y: 4 + 12, t: 20 }], // 5 + 12 = 17
      [{ x: 500, y: 500, t: 0 }, { x: 500, y: 508, t: 10 }], // +8, but no jump from (3,16) to (500,500)
    ];
    expect(calculateTotalDistance(strokes)).toBe(25); // 17 + 8, NOT 17 + huge-jump + 8
  });

  it('returns 0 for empty or single-point input', () => {
    expect(calculateTotalDistance([])).toBe(0);
    expect(calculateTotalDistance([[{ x: 1, y: 1, t: 0 }]])).toBe(0);
    expect(calculateTotalDistance(null)).toBe(0);
    expect(calculateTotalDistance(undefined)).toBe(0);
  });

  it('skips non-finite points without throwing', () => {
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: NaN, y: 4, t: 10 }, { x: 3, y: 4, t: 20 }]];
    expect(calculateTotalDistance(strokes)).toBe(0); // both segments touch the malformed point
  });
});

// ─── calculateDuration ──────────────────────────────────────────────────────

describe('calculateDuration', () => {
  it('returns the last flattened point\'s t value', () => {
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 842 }]];
    expect(calculateDuration(strokes)).toBe(842);
  });

  it('returns 0 for empty input', () => {
    expect(calculateDuration([])).toBe(0);
    expect(calculateDuration([[]])).toBe(0);
  });
});

// ─── calculateAverageSpeed ──────────────────────────────────────────────────

describe('calculateAverageSpeed', () => {
  it('matches the shape-assessment semantics: 100px / 1000ms = 0.1 px/ms', () => {
    // A single straight segment: distance 100, duration 1000.
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 1000 }]];
    expect(calculateAverageSpeed(strokes)).toBeCloseTo(0.1, 10);
  });

  it('returns null (not 0, not NaN) for zero duration', () => {
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 0 }]];
    expect(calculateAverageSpeed(strokes)).toBeNull();
  });

  it('returns null for negative/invalid duration (last point has a malformed negative t)', () => {
    const strokes = [[{ x: 0, y: 0, t: 100 }, { x: 100, y: 0, t: -5 }]];
    expect(calculateAverageSpeed(strokes)).toBeNull();
  });

  it('returns null for an empty trajectory', () => {
    expect(calculateAverageSpeed([])).toBeNull();
  });

  it('returns null for a one-point trajectory', () => {
    expect(calculateAverageSpeed([[{ x: 5, y: 5, t: 100 }]])).toBeNull();
  });

  it('returns null when stroke_points are missing entirely', () => {
    expect(calculateAverageSpeed(undefined)).toBeNull();
    expect(calculateAverageSpeed(null)).toBeNull();
  });
});

// ─── calculateSegmentSpeeds / calculateSpeedStats ──────────────────────────

describe('calculateSegmentSpeeds', () => {
  it('ignores segments where dt <= 0, including stroke-boundary transitions', () => {
    const strokes = [
      [{ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 100 }], // speed 0.1
      [{ x: 999, y: 999, t: 0 }, { x: 999, y: 1009, t: 50 }], // speed 0.2 (new stroke, t resets)
    ];
    const speeds = calculateSegmentSpeeds(strokes);
    expect(speeds).toHaveLength(2);
    expect(speeds[0]).toBeCloseTo(0.1, 10);
    expect(speeds[1]).toBeCloseTo(0.2, 10);
  });

  it('drops a segment with dt === 0 or dt < 0 explicitly', () => {
    const strokes = [[
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 0 },   // dt == 0 -> dropped
      { x: 20, y: 0, t: -5 },  // dt < 0 vs previous -> dropped
    ]];
    expect(calculateSegmentSpeeds(strokes)).toHaveLength(0);
  });
});

describe('calculateSpeedStats', () => {
  it('computes mean/std/cv for a known segment-speed sequence', () => {
    // Two segments of equal length (10px) at dt=100 and dt=50 -> speeds 0.1, 0.2
    const strokes = [[
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 100 }, // speed 0.1
      { x: 20, y: 0, t: 150 }, // speed 0.2
    ]];
    const { speed_mean, speed_std, speed_cv } = calculateSpeedStats(strokes);
    expect(speed_mean).toBeCloseTo(0.15, 10);
    // population std dev of [0.1, 0.2] around mean 0.15 = 0.05
    expect(speed_std).toBeCloseTo(0.05, 10);
    expect(speed_cv).toBeCloseTo(0.05 / 0.15, 10);
  });

  it('returns all-null when there are no valid segments', () => {
    expect(calculateSpeedStats([])).toEqual({ speed_mean: null, speed_std: null, speed_cv: null });
    expect(calculateSpeedStats([[{ x: 0, y: 0, t: 0 }]])).toEqual({ speed_mean: null, speed_std: null, speed_cv: null });
  });

  it('leaves speed_cv null when speed_mean is exactly 0 (never divides by zero)', () => {
    // A stroke with zero-length segments (child holds pen still momentarily)
    // still has dt > 0, so segments exist with speed 0 -> mean is 0.
    const strokes = [[{ x: 5, y: 5, t: 0 }, { x: 5, y: 5, t: 50 }, { x: 5, y: 5, t: 100 }]];
    const { speed_mean, speed_cv } = calculateSpeedStats(strokes);
    expect(speed_mean).toBe(0);
    expect(speed_cv).toBeNull();
  });
});

// ─── calculatePauseMetrics ──────────────────────────────────────────────────

describe('calculatePauseMetrics', () => {
  it('uses a strict ">" 300ms boundary, not ">="', () => {
    const exactlyThreshold = [[{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: DEFAULT_PAUSE_THRESHOLD_MS }]];
    expect(calculatePauseMetrics(exactlyThreshold).pause_count).toBe(0);

    const overThreshold = [[{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: DEFAULT_PAUSE_THRESHOLD_MS + 1 }]];
    expect(calculatePauseMetrics(overThreshold).pause_count).toBe(1);
  });

  it('never compares the last point of one stroke against the first point of the next', () => {
    // Neither stroke has an internal gap > 300ms on its own, but stroke2's
    // first point (t=5000) is far from stroke1's last point (t=100) — if
    // the two strokes were ever flattened and diffed together (instead of
    // being walked independently), this would incorrectly register a
    // 4900ms "pause" at the boundary. It must not.
    const strokes = [
      [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 100 }],
      [{ x: 5, y: 5, t: 5000 }, { x: 6, y: 6, t: 5050 }],
    ];
    expect(calculatePauseMetrics(strokes).pause_count).toBe(0);
  });

  it('accumulates total/mean pause duration correctly', () => {
    const strokes = [[
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 500 },  // gap 500 > 300 -> pause
      { x: 2, y: 2, t: 1200 }, // gap 700 > 300 -> pause
      { x: 3, y: 3, t: 1250 }, // gap 50, not a pause
    ]];
    const result = calculatePauseMetrics(strokes);
    expect(result.pause_count).toBe(2);
    expect(result.total_pause_duration_ms).toBe(1200); // 500 + 700
    expect(result.mean_pause_duration_ms).toBe(600);
  });

  it('computes pause_frequency and pause_duration_ratio against duration_ms, guarding zero duration', () => {
    const strokes = [[
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 500 }, // one pause of 500ms
    ]];
    const result = calculatePauseMetrics(strokes, { durationMs: 2000 });
    expect(result.pause_frequency).toBeCloseTo(1 / 2, 10); // 1 pause / 2 seconds
    expect(result.pause_duration_ratio).toBeCloseTo(500 / 2000, 10);

    const zeroDuration = calculatePauseMetrics(strokes, { durationMs: 0 });
    expect(zeroDuration.pause_frequency).toBeNull();
    expect(zeroDuration.pause_duration_ratio).toBeNull();
  });

  it('returns pause_count 0 and null ratios for an empty trajectory, never throws', () => {
    const result = calculatePauseMetrics([]);
    expect(result.pause_count).toBe(0);
    expect(result.total_pause_duration_ms).toBe(0);
    expect(result.mean_pause_duration_ms).toBeNull();
    expect(result.pause_frequency).toBeNull();
    expect(result.pause_duration_ratio).toBeNull();
  });
});

// ─── calculateAttemptDurationFromAbsoluteTime (tAbs-based, ML-safe) ───────

describe('calculateAttemptDurationFromAbsoluteTime', () => {
  // Test A — single stroke
  it('Test A: single stroke, tAbs 1000/1200/1500 -> 500ms', () => {
    const strokes = [[{ tAbs: 1000 }, { tAbs: 1200 }, { tAbs: 1500 }]];
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBe(500);
  });

  // Test B — multi-stroke, must span the WHOLE attempt, not just the last stroke
  it('Test B: multi-stroke spans the full attempt (2100-1000=1100), never the final stroke\'s own span (300)', () => {
    const strokes = [
      [{ tAbs: 1000 }, { tAbs: 1200 }, { tAbs: 1500 }],
      [{ tAbs: 1800 }, { tAbs: 2100 }],
    ];
    const result = calculateAttemptDurationFromAbsoluteTime(strokes);
    expect(result).toBe(1100);
    expect(result).not.toBe(300);
  });

  it('matches the worked multi-stroke example from the spec exactly (101600 - 100000 = 1600)', () => {
    const strokes = [
      [{ tAbs: 100000 }, { tAbs: 100400 }, { tAbs: 100900 }],
      [{ tAbs: 101200 }, { tAbs: 101600 }],
    ];
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBe(1600);
  });

  // Test D — missing tAbs entirely
  it('Test D: returns null when no point has a valid tAbs', () => {
    const strokes = [[{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 100 }]]; // no tAbs field at all
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBeNull();
  });

  // Test E — exactly one valid timestamp
  it('Test E: returns null with only one valid tAbs value', () => {
    expect(calculateAttemptDurationFromAbsoluteTime([[{ tAbs: 5000 }]])).toBeNull();
    // two points but only one has a finite tAbs
    expect(calculateAttemptDurationFromAbsoluteTime([[{ tAbs: 5000 }, { tAbs: NaN }]])).toBeNull();
  });

  it('ignores invalid tAbs values (NaN/undefined/non-numeric) mixed with valid ones', () => {
    const strokes = [[{ tAbs: 1000 }, { tAbs: undefined }, { tAbs: NaN }, { tAbs: 1500 }]];
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBe(500);
  });

  it('returns null (never negative, never 0) when max <= min', () => {
    // Degenerate case: every valid tAbs identical (max === min).
    const strokes = [[{ tAbs: 1000 }, { tAbs: 1000 }]];
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBeNull();
  });

  it('returns null for empty/missing input, never throws', () => {
    expect(calculateAttemptDurationFromAbsoluteTime([])).toBeNull();
    expect(calculateAttemptDurationFromAbsoluteTime(null)).toBeNull();
    expect(calculateAttemptDurationFromAbsoluteTime(undefined)).toBeNull();
  });

  it('never crosses a stroke boundary incorrectly — result equals true min/max across ALL strokes regardless of stroke order in the array', () => {
    const strokes = [
      [{ tAbs: 5000 }, { tAbs: 5200 }],
      [{ tAbs: 4000 }, { tAbs: 4300 }], // an out-of-array-order stroke (shouldn't happen in practice, but min/max must still be global)
    ];
    expect(calculateAttemptDurationFromAbsoluteTime(strokes)).toBe(1200); // 5200 - 4000
  });
});

// ─── calculateAttemptAverageSpeed ──────────────────────────────────────────

describe('calculateAttemptAverageSpeed', () => {
  // Test C
  it('Test C: 550px / 1100ms = 0.5 px/ms', () => {
    expect(calculateAttemptAverageSpeed(550, 1100)).toBeCloseTo(0.5, 10);
  });

  it('returns null when attemptDurationMs <= 0', () => {
    expect(calculateAttemptAverageSpeed(100, 0)).toBeNull();
    expect(calculateAttemptAverageSpeed(100, -50)).toBeNull();
  });

  it('returns null when attemptDurationMs is null/missing', () => {
    expect(calculateAttemptAverageSpeed(100, null)).toBeNull();
    expect(calculateAttemptAverageSpeed(100, undefined)).toBeNull();
  });

  it('returns null when totalDistance is unavailable', () => {
    expect(calculateAttemptAverageSpeed(null, 1000)).toBeNull();
    expect(calculateAttemptAverageSpeed(NaN, 1000)).toBeNull();
  });
});

// ─── calculateAttemptPauseMetrics ──────────────────────────────────────────

describe('calculateAttemptPauseMetrics', () => {
  // Test F
  it('Test F: pause_count=2, attempt_duration_ms=4000 -> 0.5 pauses/sec', () => {
    const { attempt_pause_frequency } = calculateAttemptPauseMetrics(2, 800, 4000);
    expect(attempt_pause_frequency).toBeCloseTo(0.5, 10);
  });

  // Test G
  it('Test G: total_pause_duration_ms=800, attempt_duration_ms=4000 -> ratio 0.2', () => {
    const { attempt_pause_duration_ratio } = calculateAttemptPauseMetrics(2, 800, 4000);
    expect(attempt_pause_duration_ratio).toBeCloseTo(0.2, 10);
  });

  it('returns both null when attemptDurationMs <= 0', () => {
    expect(calculateAttemptPauseMetrics(2, 800, 0)).toEqual({ attempt_pause_frequency: null, attempt_pause_duration_ratio: null });
    expect(calculateAttemptPauseMetrics(2, 800, -1)).toEqual({ attempt_pause_frequency: null, attempt_pause_duration_ratio: null });
    expect(calculateAttemptPauseMetrics(2, 800, null)).toEqual({ attempt_pause_frequency: null, attempt_pause_duration_ratio: null });
  });

  it('returns null per-field when pauseCount/totalPauseDurationMs individually are not finite', () => {
    const result = calculateAttemptPauseMetrics(null, 800, 4000);
    expect(result.attempt_pause_frequency).toBeNull();
    expect(result.attempt_pause_duration_ratio).toBeCloseTo(0.2, 10);
  });
});

// ─── Integration: attempt_* fields never overwrite legacy fields ─────────

describe('legacy vs attempt-safe duration — both survive independently', () => {
  it('demonstrates the exact bug scenario from the spec: legacy duration_ms undercounts a multi-stroke attempt', () => {
    // Stroke 1: t 0->900 (own clock). Stroke 2: t resets to 0->650. Stroke 3: t resets to 0->500.
    const strokes = [
      [{ x: 0, y: 0, t: 0, tAbs: 100000 }, { x: 1, y: 1, t: 900, tAbs: 100900 }],
      [{ x: 2, y: 2, t: 0, tAbs: 101100 }, { x: 3, y: 3, t: 650, tAbs: 101750 }],
      [{ x: 4, y: 4, t: 0, tAbs: 101950 }, { x: 5, y: 5, t: 500, tAbs: 102450 }],
    ];
    const legacyDuration = calculateDuration(strokes); // last point's own-stroke-relative t
    const attemptDuration = calculateAttemptDurationFromAbsoluteTime(strokes); // true wall-clock span

    expect(legacyDuration).toBe(500); // matches the spec's stated (mis)behavior
    expect(attemptDuration).toBe(2450); // 102450 - 100000, the true span
    expect(attemptDuration).toBeGreaterThan(legacyDuration);
  });
});
