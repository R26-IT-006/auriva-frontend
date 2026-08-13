// Feature 3 Step 3 — tests for buildSessionAttemptRecord(), the pure helper
// extracted from LetterWritingScreen.js / UppercaseWritingScreen.js's
// `handleNext()` (see that file's own header comment for why this exists:
// component-level rendering tests are not practical under this project's
// deliberately minimal, non-jest-expo Jest config — see jest.config.js —
// so the smallest pure piece of the change is extracted and tested here
// instead, exactly as Feature 3 Step 2's rendering-helper tests already do).
import { buildSessionAttemptRecord } from './handwritingAttemptPayload';
import { SUPPORT_LEVELS, getSupportLevelForAttempt, getAdaptiveSupportSequence } from '../constants/handwritingSupportLevels';

function makeFeatures(overrides = {}) {
  return {
    smoothness: 0.12,
    pauseCount: 1,
    completionTime: 500,
    strokeCount: 2,
    dtw_distance: 15.4,
    stroke_order_meta: null,
    // ML readiness pass — additive fields calculateDrawingFeatures() now
    // also returns (see utils/trajectoryFeatures.js).
    total_distance: 120.5,
    avg_speed: 0.24,
    speed_mean: 0.24,
    speed_std: 0.05,
    speed_cv: 0.208,
    pause_count: 1,
    total_pause_duration_ms: 350,
    mean_pause_duration_ms: 350,
    pause_frequency: 2,
    pause_duration_ratio: 0.7,
    // Duration-correction pass — additive fields (see utils/trajectoryFeatures.js's
    // calculateAttemptDurationFromAbsoluteTime()).
    attempt_duration_ms: 1600,
    attempt_avg_speed: 0.075,
    attempt_pause_frequency: 1.25,
    attempt_pause_duration_ratio: 0.21875,
    ...overrides,
  };
}

function makeStrokes() {
  return [{ stroke_id: 1, points: [{ x: 1, y: 2, t: 0, tAbs: 1000, stroke_id: 1 }] }];
}

// ─── Frontend Test 1-3 — support_level tracks the screen's own supportLevel ─

describe('Frontend Test 1 — attempt 1 session record receives support_level = high', () => {
  it('normal mode attempt 1', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 1, collectionMode: false });
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBe(SUPPORT_LEVELS.HIGH);
    expect(record.support_level).toBe('high');
  });
});

describe('Frontend Test 2 — attempt 2 session record receives support_level = medium', () => {
  it('normal mode attempt 2', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 2, collectionMode: false });
    const record = buildSessionAttemptRecord({
      attemptNumber: 2, supportLevel, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBe('medium');
  });
});

describe('Frontend Test 3 — attempt 3 session record receives support_level = low', () => {
  it('normal mode attempt 3', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 3, collectionMode: false });
    const record = buildSessionAttemptRecord({
      attemptNumber: 3, supportLevel, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBe('low');
  });
});

// ─── Frontend Test 4 — collection attempt 3 still sends 'low' ─────────────

describe('Frontend Test 4 — collection attempt 3 still sends low', () => {
  it('persists the logical support-level identity, not a fourth level, despite the collection-protocol rendering override', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 3, collectionMode: true });
    const record = buildSessionAttemptRecord({
      attemptNumber: 3, supportLevel, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBe('low');
    // Sanity: identity is unaffected by collectionMode (Step 2's guarantee) —
    // the collection protocol override changes what is RENDERED
    // (getSupportPresentation), never what is PERSISTED as the identity.
    expect(getSupportLevelForAttempt({ attempt: 3, collectionMode: true }))
      .toBe(getSupportLevelForAttempt({ attempt: 3, collectionMode: false }));
  });
});

// ─── Feature 6 Step 5 — demo_speed_level validation contract ──────────────

describe('demo_speed_level — valid values pass through unchanged', () => {
  it.each(['standard', 'slow'])('demoSpeedLevel=%p is persisted verbatim', (level) => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: 'high', demoSpeedLevel: level, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.demo_speed_level).toBe(level);
  });
});

describe('demo_speed_level — invalid/missing values persist as null, never guessed', () => {
  it.each(['fast', 'medium', 'FAST', '', 0.21, true, {}])('demoSpeedLevel=%p is rejected to null', (bad) => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: 'high', demoSpeedLevel: bad, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.demo_speed_level).toBeNull();
  });

  it('a missing demoSpeedLevel (undefined) persists as null — the expected shape for MEDIUM/LOW support, reduce-motion, and collection mode, where no tracer was actually shown', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 2, supportLevel: 'medium', features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.demo_speed_level).toBeNull();
  });

  it('an explicit null demoSpeedLevel persists as null', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 2, supportLevel: 'medium', demoSpeedLevel: null, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.demo_speed_level).toBeNull();
  });
});

// ─── Frontend Test 5 — no existing payload fields removed ─────────────────

describe('Frontend Test 5 — no existing attempt payload fields removed', () => {
  it('retains attempt_number, features (every original sub-field, plus the ML-readiness additions), and strokes exactly as before, plus support_level (Feature 3 Step 3) and demo_speed_level (Feature 6 Step 5) additively', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 2, collectionMode: false });
    const features = makeFeatures();
    const strokes = makeStrokes();
    const record = buildSessionAttemptRecord({ attemptNumber: 2, supportLevel, demoSpeedLevel: 'slow', features, strokes });

    expect(record.attempt_number).toBe(2);
    expect(record.features).toEqual({
      smoothness: features.smoothness,
      pauseCount: features.pauseCount,
      completionTime: features.completionTime,
      strokeCount: features.strokeCount,
      dtw_distance: features.dtw_distance,
      stroke_order_meta: features.stroke_order_meta,
      total_distance: features.total_distance,
      avg_speed: features.avg_speed,
      speed_mean: features.speed_mean,
      speed_std: features.speed_std,
      speed_cv: features.speed_cv,
      pause_count: features.pause_count,
      total_pause_duration_ms: features.total_pause_duration_ms,
      mean_pause_duration_ms: features.mean_pause_duration_ms,
      pause_frequency: features.pause_frequency,
      pause_duration_ratio: features.pause_duration_ratio,
      attempt_duration_ms: features.attempt_duration_ms,
      attempt_avg_speed: features.attempt_avg_speed,
      attempt_pause_frequency: features.attempt_pause_frequency,
      attempt_pause_duration_ratio: features.attempt_pause_duration_ratio,
    });
    expect(record.strokes).toBe(strokes); // same array reference — never copied/mutated
    expect(Object.keys(record).sort()).toEqual(
      ['attempt_number', 'demo_speed_level', 'features', 'strokes', 'support_level'].sort()
    );
  });
});

// ─── ML readiness pass — new fields pass through untouched, including nulls ─

describe('Frontend Test — ML-readiness fields pass through calculateDrawingFeatures() output as-is', () => {
  it('propagates a genuinely-null avg_speed/speed_cv (e.g. an empty/degenerate attempt) rather than fabricating 0', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 1, collectionMode: false });
    const features = makeFeatures({ avg_speed: null, speed_std: null, speed_cv: null, mean_pause_duration_ms: null });
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel, features, strokes: makeStrokes(),
    });
    expect(record.features.avg_speed).toBeNull();
    expect(record.features.speed_std).toBeNull();
    expect(record.features.speed_cv).toBeNull();
    expect(record.features.mean_pause_duration_ms).toBeNull();
  });

  it('propagates a genuinely-null attempt_duration_ms/attempt_avg_speed (e.g. missing tAbs) rather than fabricating 0, independently of the legacy duration_ms-based fields', () => {
    const supportLevel = getSupportLevelForAttempt({ attempt: 1, collectionMode: false });
    const features = makeFeatures({
      attempt_duration_ms: null, attempt_avg_speed: null,
      attempt_pause_frequency: null, attempt_pause_duration_ratio: null,
      // legacy fields stay populated — proves the two families are independent
      completionTime: 500, avg_speed: 0.24, pause_frequency: 2,
    });
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel, features, strokes: makeStrokes(),
    });
    expect(record.features.attempt_duration_ms).toBeNull();
    expect(record.features.attempt_avg_speed).toBeNull();
    expect(record.features.attempt_pause_frequency).toBeNull();
    expect(record.features.attempt_pause_duration_ratio).toBeNull();
    expect(record.features.completionTime).toBe(500);
    expect(record.features.avg_speed).toBe(0.24);
    expect(record.features.pause_frequency).toBe(2);
  });
});

// ─── Defensive: invalid/missing supportLevel never propagates ─────────────

describe('Frontend Test — invalid or missing supportLevel is stored as null, never propagated', () => {
  it('stores null when supportLevel is null (e.g. an out-of-range attempt per Step 2 contract)', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 0, supportLevel: null, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBeNull();
  });

  it('stores null when supportLevel is an unrecognized string', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: 'extreme', features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBeNull();
  });

  it('stores null when supportLevel is undefined', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBeNull();
  });

  it('rejects the uppercase enum keys as invalid values — only lowercase strings persist', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: 'HIGH', features: makeFeatures(), strokes: makeStrokes(),
    });
    expect(record.support_level).toBeNull();
  });
});

// ─── Feature 3 Step 6 — persistence correctness for adaptive sequences ────
//
// Proves the exact conceptual example from the Step 6 spec: a "recommend
// medium" starting recommendation produces sequence [medium, low, low], and
// building all three attempt records with that sequence yields the exact
// persisted shape the spec describes — attempt_number always 1/2/3 (session
// position, untouched), support_level following the ADAPTIVE sequence, not
// a fixed attempt→support mapping. No backend derivation from attempt
// number is involved anywhere in this — the frontend is the sole source of
// what was actually rendered (spec §34).

function buildSessionAttempts(sequence) {
  return [1, 2, 3].map((attemptNumber) =>
    buildSessionAttemptRecord({
      attemptNumber,
      supportLevel: sequence[attemptNumber - 1],
      features: makeFeatures(),
      strokes: makeStrokes(),
    })
  );
}

describe('Persistence Test — recommend_medium produces [medium, low, low], persisted per-attempt', () => {
  it('matches the Step 6 spec\'s exact conceptual example', () => {
    const sequence = getAdaptiveSupportSequence(SUPPORT_LEVELS.MEDIUM);
    const attempts = buildSessionAttempts(sequence);

    expect(attempts.map(a => ({ attempt_number: a.attempt_number, support_level: a.support_level }))).toEqual([
      { attempt_number: 1, support_level: 'medium' },
      { attempt_number: 2, support_level: 'low' },
      { attempt_number: 3, support_level: 'low' },
    ]);
  });
});

describe('Persistence Test — recommend_low produces [low, low, low]', () => {
  it('the child practices independently for all three attempts, all persisted as low', () => {
    const sequence = getAdaptiveSupportSequence(SUPPORT_LEVELS.LOW);
    const attempts = buildSessionAttempts(sequence);

    expect(attempts.map(a => a.support_level)).toEqual(['low', 'low', 'low']);
    expect(attempts.map(a => a.attempt_number)).toEqual([1, 2, 3]);
  });
});

describe('Persistence Test — recommend_high reproduces today\'s exact persisted shape', () => {
  it('is identical to what getSupportLevelForAttempt already produced pre-Step-6, attempt by attempt', () => {
    const sequence = getAdaptiveSupportSequence(SUPPORT_LEVELS.HIGH);
    const attempts = buildSessionAttempts(sequence);

    for (const attemptNumber of [1, 2, 3]) {
      const legacy = getSupportLevelForAttempt({ attempt: attemptNumber, collectionMode: false });
      expect(attempts[attemptNumber - 1].support_level).toBe(legacy);
    }
  });
});

describe('Persistence Test — insufficient_data (no recommendation) reproduces today\'s exact flow', () => {
  it('null startSupport → legacy sequence → identical persisted shape to pre-Step-6 behavior', () => {
    const sequence = getAdaptiveSupportSequence(null);
    const attempts = buildSessionAttempts(sequence);

    expect(attempts.map(a => a.support_level)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Persistence Test — attempt numbering is never rewritten by the adaptive sequence', () => {
  it('attempt_number always reads 1, 2, 3 regardless of which support sequence was used', () => {
    for (const start of [SUPPORT_LEVELS.HIGH, SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW, null]) {
      const attempts = buildSessionAttempts(getAdaptiveSupportSequence(start));
      expect(attempts.map(a => a.attempt_number)).toEqual([1, 2, 3]);
    }
  });
});
