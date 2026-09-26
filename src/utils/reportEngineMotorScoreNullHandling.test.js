/**
 * reportEngineMotorScoreNullHandling.test.js
 *
 * Teacher-report null-score fix: computeUnifiedMotorReportScore() must
 * never render a missing shape.features.motor_score as a fabricated
 * plausible-looking 50 — a missing score is an explicit "Not available"
 * state, excluded from the average, distinct from every real score.
 *
 * Calls the REAL, unmodified production function — no reimplementation.
 */

import { computeUnifiedMotorReportScore, computeProgressIndicators, generateRecommendations } from './reportEngine';

function shape(shapeId, motor_score) {
  return { shapeId, features: { motor_score } };
}

describe('computeUnifiedMotorReportScore — null motor_score handling', () => {
  it('all six shapes with real scores: behaves exactly as before (regression)', () => {
    const result = computeUnifiedMotorReportScore([
      shape('horizontal_line', 90), shape('vertical_line', 80),
      shape('full_circle', 85), shape('half_circle', 75),
      shape('zigzag', 70), shape('curve_wave', 70),
    ], null);
    expect(result.score).toBe(78); // round(mean(90,80,85,75,70,70))
    expect(result.breakdown.every(b => b.score != null)).toBe(true);
    expect(result.breakdown.every(b => b.label !== 'Not available')).toBe(true);
  });

  it('one shape missing motor_score (null): excluded from the average, not treated as 0 or 50', () => {
    const result = computeUnifiedMotorReportScore([
      shape('horizontal_line', 90), shape('vertical_line', 80),
      shape('full_circle', null), // missing — old rows before the field existed
      shape('half_circle', 75), shape('zigzag', 70), shape('curve_wave', 70),
    ], null);
    // average of the 5 REAL scores, not divided by 6 and not counting the
    // missing one as 0 or 50
    expect(result.score).toBe(Math.round((90 + 80 + 75 + 70 + 70) / 5));
    const missingEntry = result.breakdown.find(b => b.shapeId === 'full_circle');
    expect(missingEntry.score).toBeNull();
    expect(missingEntry.label).toBe('Not available');
    expect(result.explanation).toMatch(/1 shape could not be scored/);
  });

  it('ALL shapes missing motor_score: returns the explicit "No data" state, never a fabricated average', () => {
    const result = computeUnifiedMotorReportScore([
      shape('horizontal_line', null), shape('vertical_line', null),
    ], null);
    expect(result.score).toBeNull();
    expect(result.level).toBe('No data');
    expect(result.breakdown.every(b => b.score === null && b.label === 'Not available')).toBe(true);
  });

  it('best/worst shape selection ignores "Not available" entries — never cites a missing shape as best or worst', () => {
    const result = computeUnifiedMotorReportScore([
      shape('horizontal_line', 95),
      shape('vertical_line', null), // would look like the "worst" (0/null) if not filtered
      shape('full_circle', 60),
    ], null);
    expect(result.explanation).toMatch(/Best shape: horizontal_line/);
    expect(result.explanation).toMatch(/Shape needing most practice: full_circle/);
    expect(result.explanation).not.toMatch(/vertical_line \(null/);
  });

  it('undefined assessmentData still returns the pre-existing empty state (regression)', () => {
    const result = computeUnifiedMotorReportScore([], null);
    expect(result.score).toBeNull();
    expect(result.level).toBe('No data');
  });
});

describe('downstream consumers stay null-safe given a breakdown with missing shapes', () => {
  it('generateRecommendations never cites a "Not available" shape as the weakest, and never renders "scored null/100"', () => {
    const motorScore = computeUnifiedMotorReportScore([
      shape('horizontal_line', 95),
      shape('vertical_line', null),
      shape('full_circle', 60),
    ], null);
    const recs = generateRecommendations({ motorScore, letterMetrics: {}, wordMastery: {}, completedLetters: [] });
    const motorRec = recs.find(r => r.text.includes('strokes with larger arm movements'));
    expect(motorRec).toBeDefined();
    expect(motorRec.text).toMatch(/full circle/);
    expect(motorRec.rationale).not.toMatch(/null/);
  });

  it('computeProgressIndicators renders the overall (real-score-averaged) motor score, not affected by individual missing shapes', () => {
    const motorScore = computeUnifiedMotorReportScore([
      shape('horizontal_line', 95),
      shape('vertical_line', null),
    ], null);
    const indicators = computeProgressIndicators({ motorScore, letterMetrics: {}, wordMastery: {}, completedLetters: [] });
    const strokeControl = indicators.find(i => i.label === 'Stroke Control');
    expect(strokeControl).toBeDefined();
    expect(strokeControl.xai).toMatch(/95/);
  });
});
