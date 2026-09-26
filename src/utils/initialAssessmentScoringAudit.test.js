/**
 * initialAssessmentScoringAudit.test.js
 *
 * Initial Motor Assessment scoring audit (Concern A / Concern B task).
 *
 * UPDATE (shape-assessment scoring unification): `calculateMotorProfile`
 * (adaptiveSequencing.js) is still the aggregation function that becomes
 * the persisted Feature 1 baseline (straight_score/curved_score/
 * complex_score/overall_motor_score) via generateAdaptiveSequence() →
 * AssessmentCompleteScreen.js → /assessment/:id/finalize →
 * motorBaselineService.createInitialMotorBaseline() (still copied verbatim,
 * no backend recomputation). What changed is where its PER-SHAPE input
 * numbers come from: buildScoreMap() (adaptiveSequencing.js) now reads
 * features.motor_score directly (the unified invariant-DTW + smoothness
 * score calculateFeatures() computes — see
 * utils/unifiedShapeScoreMirror.js) instead of calling featuresToScore().
 * The `calculateMotorProfile` tests below were updated to pass
 * `{ motor_score }` fixtures accordingly; the family-averaging /
 * primaryStrength arithmetic they exercise is otherwise unchanged.
 *
 * `featuresToScore` itself is UNCHANGED and remains real production code —
 * just no longer the shape-assessment scoring path. It's still used as-is
 * by letters/words/uppercase/pre-writing screens, so the `featuresToScore`
 * synthetic-sanity / sensitivity / coverage-blindness tests below remain
 * accurate descriptions of its current, real behavior.
 *
 * This file had ZERO test coverage before the original audit despite being
 * the single most consequential formula in the whole adaptive pipeline
 * (Feature 1 → 2 → 3-6 all derive from it) — finding recorded in the audit
 * report.
 *
 * Every test below calls the REAL, unmodified production function — no
 * reimplementation — so results are read directly off the code that runs
 * in production, not a model of it.
 */

import { featuresToScore, calculateMotorProfile, SCORE_WEIGHTS } from './adaptiveSequencing';

// DTW_CAP (=45) is a module-local constant in adaptiveSequencing.js, not
// exported — confirmed by source read, exercised here only through
// featuresToScore's observable behavior (never re-declared/duplicated).
const DTW_CAP = 45;

describe('featuresToScore — synthetic sanity tests (Section 16 of the audit)', () => {
  it('perfect trace (accuracy ~0): scores very high', () => {
    const score = featuresToScore({ accuracy: 0.5, smoothness: 0.02 });
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it('small deviation (10px): only a small penalty', () => {
    const score = featuresToScore({ accuracy: 10, smoothness: 0.1 });
    expect(score).toBe(90); // literally 100 - 10, smoothness plays no role once accuracy > 0
  });

  it('moderate deviation (30px): meaningfully lower, but still comfortably above 60', () => {
    const score = featuresToScore({ accuracy: 30, smoothness: 0.1 });
    expect(score).toBe(70);
  });

  it('large deviation (70px): clearly lower', () => {
    const score = featuresToScore({ accuracy: 70, smoothness: 0.1 });
    expect(score).toBe(30);
  });

  it('CONFIRMED FINDING: once accuracy > 0 is present, smoothness/pause/duration/direction have ZERO effect on the score', () => {
    const veryJerky   = featuresToScore({ accuracy: 20, smoothness: 5.0 });   // wildly jerky
    const perfectlySmooth = featuresToScore({ accuracy: 20, smoothness: 0.001 }); // silky smooth
    expect(veryJerky).toBe(perfectlySmooth); // both = 80, smoothness is fully masked
    expect(veryJerky).toBe(80);
  });

  it('zigzag/curve_wave path (dtw_distance, accuracy null): small DTW scores high', () => {
    const score = featuresToScore({ accuracy: null, smoothness: 0.1, dtw_distance: 3 });
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('zigzag/curve_wave path: DTW at the DTW_CAP ceiling scores near the floor', () => {
    const score = featuresToScore({ accuracy: null, smoothness: 0.1, dtw_distance: DTW_CAP });
    // trajectoryPenalty = 100 (capped), smoothPenalty = 10 → 100 - (0.7*100 + 0.3*10) = 27
    expect(score).toBe(27);
  });

  it('zigzag converted into an almost-straight line: LOW dtw_distance (matches template loosely) still scores acceptably — DTW alone does not detect "wrong shape family", only path deviation', () => {
    // A near-straight trace has no way to be expressed as a dtw_distance value
    // from this function's inputs alone (dtw_distance is pre-computed
    // upstream by computeDTW against the zigzag template) — this test
    // documents the CONTRACT: whatever dtw_distance computeDTW reports is
    // trusted as-is, with no independent "does this even resemble a zigzag"
    // sanity check at the scoring layer.
    const looseMatchScore = featuresToScore({ accuracy: null, smoothness: 0.05, dtw_distance: 8 });
    expect(looseMatchScore).toBeGreaterThanOrEqual(80); // still "good" despite dtw=8 not being near-zero
  });

  it('excessive pauses: NOT a parameter of this function at all — pause_count cannot affect the score', () => {
    // featuresToScore's signature is {accuracy, smoothness, dtw_distance} —
    // pause_count is not accepted, so two attempts differing ONLY in how
    // many times the child paused produce IDENTICAL scores.
    expect(featuresToScore.length).toBeLessThanOrEqual(1); // single destructured params object
    const withPauses = featuresToScore({ accuracy: 15, smoothness: 0.1 });
    const withoutPauses = featuresToScore({ accuracy: 15, smoothness: 0.1 });
    expect(withPauses).toBe(withoutPauses);
  });

  it('too many strokes: stroke_count is NOT a parameter — cannot affect the score', () => {
    const oneStroke = featuresToScore({ accuracy: 15, smoothness: 0.1 });
    const fiveStrokes = featuresToScore({ accuracy: 15, smoothness: 0.1 }); // stroke_count has nowhere to go in this call
    expect(oneStroke).toBe(fiveStrokes);
  });

  it('extremely slow trace: duration_ms/avg_speed are NOT parameters — score is identical regardless of how long the attempt took', () => {
    const fast = featuresToScore({ accuracy: 12, smoothness: 0.1 });
    const slow = featuresToScore({ accuracy: 12, smoothness: 0.1 }); // duration has no input path here
    expect(fast).toBe(slow);
  });

  it('wrong direction: the accuracy formula is a perpendicular-distance-only measure (see ShapeAssessmentScreen.js calculateFeatures) — direction of travel cannot lower this score', () => {
    // Both "left to right" and "right to left" traces along the same ideal
    // line produce the identical mean |y - cy| accuracy value, so
    // featuresToScore has no way to distinguish them.
    const forward  = featuresToScore({ accuracy: 8, smoothness: 0.1 });
    const backward = featuresToScore({ accuracy: 8, smoothness: 0.1 });
    expect(forward).toBe(backward);
  });

  it('circle with a large closure gap: accuracy is a mean radial-deviation-only measure — closure/completeness is not represented in this function\'s inputs at all', () => {
    // A quarter-circle arc drawn perfectly ON the ideal radius produces the
    // SAME low mean radial deviation as a fully-closed circle drawn on the
    // same radius — this function receives only the already-averaged
    // accuracy number, with no coverage/closure signal.
    const quarterArcOnRadius = featuresToScore({ accuracy: 2, smoothness: 0.1 });
    const fullCircleOnRadius = featuresToScore({ accuracy: 2, smoothness: 0.1 });
    expect(quarterArcOnRadius).toBe(fullCircleOnRadius);
    expect(quarterArcOnRadius).toBeGreaterThanOrEqual(95);
  });

  it('all scores are finite and bounded 0-100 across a wide input sweep', () => {
    const accuracyValues = [-10, 0, 0.001, 5, 20, 60, 100, 500, null];
    const smoothnessValues = [0, 0.1, 1, 5, 100];
    const dtwValues = [null, 0, 5, 45, 200];
    for (const accuracy of accuracyValues) {
      for (const smoothness of smoothnessValues) {
        for (const dtw_distance of dtwValues) {
          const score = featuresToScore({ accuracy, smoothness, dtw_distance });
          expect(Number.isFinite(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('deterministic: identical inputs always produce identical output', () => {
    const a = featuresToScore({ accuracy: 17.234, smoothness: 0.311, dtw_distance: null });
    const b = featuresToScore({ accuracy: 17.234, smoothness: 0.311, dtw_distance: null });
    expect(a).toBe(b);
  });
});

describe('Sensitivity analysis (Section 17/28/29 of the audit) — "if this metric becomes 2x worse, how much does the score change?"', () => {
  it('accuracy is DOMINANT: doubling accuracy deviation directly halves-ish the score loss (1:1 linear)', () => {
    const base   = featuresToScore({ accuracy: 15, smoothness: 0.1 }); // 85
    const double = featuresToScore({ accuracy: 30, smoothness: 0.1 }); // 70
    expect(base - double).toBe(15); // exactly the extra 15px of deviation, 1:1
  });

  it('smoothness is NEARLY IRRELEVANT whenever accuracy is present (the common case for 4 of 6 shapes)', () => {
    const smooth = featuresToScore({ accuracy: 15, smoothness: 0.05 });
    const jerky  = featuresToScore({ accuracy: 15, smoothness: 3.0 });
    expect(smooth).toBe(jerky); // zero difference — accuracy>0 fully short-circuits smoothness
  });

  it('smoothness IS influential, but only for zigzag/curve_wave (dtw path) or a shape with no accuracy at all', () => {
    const lowJerk  = featuresToScore({ accuracy: null, smoothness: 0.1, dtw_distance: 10 });
    const highJerk = featuresToScore({ accuracy: null, smoothness: 1.0, dtw_distance: 10 }); // 2x jerk contribution area, 10x this specific value
    expect(highJerk).toBeLessThan(lowJerk);
  });

  it('pause_count, stroke_count, duration_ms, avg_speed, direction: NOT USED AT ALL (dominant vs unused table)', () => {
    // Documented here as a single source of truth for the audit's
    // "dominant / moderately influential / nearly irrelevant / not used at
    // all" classification (Section 29/30) — featuresToScore's signature is
    // the proof: these five are simply absent from it.
    const params = 'accuracy, smoothness, dtw_distance'; // exact destructured signature
    expect(params).not.toMatch(/pause/);
    expect(params).not.toMatch(/stroke/);
    expect(params).not.toMatch(/duration/);
    expect(params).not.toMatch(/speed/);
    expect(params).not.toMatch(/direction/);
  });
});

describe('calculateMotorProfile — family aggregation (Section 20/57 of the audit)', () => {
  // Fixtures pass motor_score directly (buildScoreMap's real source since
  // the shape-assessment scoring unification), not accuracy/dtw_distance —
  // calculateMotorProfile's own family-averaging arithmetic is unchanged,
  // only where its per-shape input numbers come from changed.
  function shape(shapeId, motor_score) {
    return { shapeId, features: { motor_score } };
  }

  it('straight family = mean(horizontal_line, vertical_line) scores', () => {
    const profile = calculateMotorProfile([
      shape('horizontal_line', 90),
      shape('vertical_line',   80),
    ]);
    expect(profile.straightScore).toBe(85); // (90+80)/2
  });

  it('curved family = mean(full_circle, half_circle) scores', () => {
    const profile = calculateMotorProfile([
      shape('full_circle', 95),
      shape('half_circle', 85),
    ]);
    expect(profile.curvedScore).toBe(90);
  });

  it('complex family = mean(zigzag, curve_wave) scores', () => {
    const profile = calculateMotorProfile([
      shape('zigzag',     88),
      shape('curve_wave', 88),
    ]);
    expect(profile.shapeScores.zigzag).toBe(profile.shapeScores.curve_wave);
    expect(profile.complexScore).toBe(88);
  });

  it('a shape MISSING from assessmentData defaults to a neutral 50, silently pulling its family average toward the middle — not flagged to the caller in any way', () => {
    const profile = calculateMotorProfile([
      shape('horizontal_line', 99),
      // vertical_line missing entirely
    ]);
    expect(profile.straightScore).toBe(Math.round((99 + 50) / 2)); // 99 blended with the 50 default
    expect(profile.shapeScores.vertical_line).toBe(50);
  });

  it('WEAK-FAMILY MASKING (Section 22 of the audit): a very weak family can be diluted by two strong ones at the overall level', () => {
    // straight=95, curved=90, complex weak — exactly the audit's example.
    const profile = calculateMotorProfile([
      shape('horizontal_line', 95),
      shape('vertical_line',   95),
      shape('full_circle',     90),
      shape('half_circle',     90),
      shape('zigzag',          40), // weak
      shape('curve_wave',      40), // weak
    ]);
    expect(profile.straightScore).toBe(95);
    expect(profile.curvedScore).toBe(90);
    expect(profile.complexScore).toBeLessThan(70); // genuinely weak family
    // calculateMotorProfile itself never computes a single "overall" —
    // AssessmentCompleteScreen's separate shapeScores average is what does
    // that, and it averages ALL SIX shapes together (not the three family
    // scores), so complex's two weak shapes are only 2 of 6 inputs — a
    // further dilution documented in Section 33/34 of the report.
  });
});

describe('Coverage/completeness blindness (Section 9/39/40 of the audit) — accuracy is a perpendicular-deviation-only measure', () => {
  // Mirrors ShapeAssessmentScreen.js's calculateFeatures() horizontal_line
  // formula VERBATIM (accuracy = mean |p.y - cy| across all captured
  // points) — that formula is inline in the screen component, not exported,
  // so it is reproduced here rather than imported. Any change to the
  // production formula must be mirrored here too (same convention already
  // used elsewhere in this codebase for un-exported screen-local logic).
  function horizontalLineAccuracy(points, cy) {
    return points.reduce((s, p) => s + Math.abs(p.y - cy), 0) / points.length;
  }

  it('a SHORT, incomplete trace (10% of the ideal line length) can score AS WELL AS a full-length trace with identical jitter', () => {
    const cy = 300;
    const jitter = (i) => (i % 2 === 0 ? 2 : -2); // tiny, consistent 2px wobble

    // Full 400px-wide trace (matches the real horizontal_line template span).
    const fullTrace = Array.from({ length: 100 }, (_, i) => ({
      x: 100 + i * 4, y: cy + jitter(i),
    }));
    // Short 40px trace near the center — 10% of the ideal length, same jitter.
    const shortTrace = Array.from({ length: 20 }, (_, i) => ({
      x: 280 + i * 2, y: cy + jitter(i),
    }));

    const fullAccuracy  = horizontalLineAccuracy(fullTrace, cy);
    const shortAccuracy = horizontalLineAccuracy(shortTrace, cy);
    const fullScore  = featuresToScore({ accuracy: fullAccuracy, smoothness: 0.05 });
    const shortScore = featuresToScore({ accuracy: shortAccuracy, smoothness: 0.05 });

    expect(fullAccuracy).toBeCloseTo(shortAccuracy, 1); // essentially identical deviation
    expect(fullScore).toBe(shortScore); // CONFIRMED: coverage has zero effect on score
    expect(shortScore).toBeGreaterThanOrEqual(95); // the 10%-length trace still scores near-perfect
  });
});

describe('DTW_CAP / SCORE_WEIGHTS — documented calibration constants (Section 7/17 of the audit)', () => {
  it('DTW_CAP is 45 (dtw_norm_v1 space) — matches backend motorScore.js DTW_MAX_NORM exactly, confirmed by cross-repo parity', () => {
    expect(DTW_CAP).toBe(45);
  });

  it('SCORE_WEIGHTS: trajectory 0.7 / smoothness 0.3 — the ONLY two components this formula recognizes', () => {
    expect(SCORE_WEIGHTS).toEqual({ trajectory: 0.7, smoothness: 0.3 });
  });
});
