// Initial Motor Assessment scoring/consistency fix — Section 58 of the
// audit: proves AssessmentCompleteScreen.js and LetterHomeScreen.js's
// "Assessment Summary" modal consume the SAME authoritative score field
// (features.motor_score — the unified invariant-DTW + smoothness score
// calculateFeatures() computes via utils/unifiedShapeScoreMirror.js), with
// no separate hidden calculation of their own left behind.
//
// Formerly both screens called featuresToScore() from adaptiveSequencing.js
// directly; the shape-assessment scoring unification moved that role to
// features.motor_score (featuresToScore itself is unchanged and still used,
// unrelated to this test, by letters/words/uppercase/pre-writing screens).
//
// UPDATE (teacher-report null-score fix): both screens used to read
// features.motor_score ?? 50 — a silent fallback that would render a
// missing score as a fabricated, plausible-looking 50. Both now read
// features.motor_score directly (nullable) and render an explicit "Not
// available" state instead — this test asserts that ?? 50 is GONE from
// both, not present.
//
// This project's Jest config only matches src/utils/**/*.test.js (see
// jest.config.js) and these screens cannot be `require`d directly under
// plain Jest (native RN/Expo imports) — matching the established
// source-scan convention (e.g. studentDetailThresholdCard.test.js), this
// file reads the real screen source as text.

const fs = require('fs');
const path = require('path');

const ASSESSMENT_COMPLETE_FILE = path.resolve(__dirname, '../screens/teacher/handwriting/AssessmentCompleteScreen.js');
const LETTER_HOME_FILE = path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

describe('AssessmentCompleteScreen.js and LetterHomeScreen.js share one scoring source', () => {
  it('both read features?.motor_score — no screen owns its own formula', () => {
    const complete = read(ASSESSMENT_COMPLETE_FILE);
    const home = read(LETTER_HOME_FILE);
    expect(complete).toMatch(/\.features\?\.\s*motor_score/);
    expect(home).toMatch(/\.features\?\.\s*motor_score/);
  });

  it('neither screen silently defaults a missing motor_score to 50 — a missing score must render as "Not available", never a fabricated mid-range number', () => {
    const complete = read(ASSESSMENT_COMPLETE_FILE);
    const home = read(LETTER_HOME_FILE);
    expect(complete).not.toMatch(/motor_score\s*\?\?\s*50/);
    expect(home).not.toMatch(/motor_score\s*\?\?\s*50/);
    expect(complete).toMatch(/Not available/);
    expect(home).toMatch(/Not available/);
  });

  it('the old, independently-diverging local formulas no longer exist in either screen', () => {
    const complete = read(ASSESSMENT_COMPLETE_FILE);
    const home = read(LETTER_HOME_FILE);
    // AssessmentCompleteScreen's own former accuracy/smoothness score formula.
    expect(complete).not.toMatch(/function\s+getAccuracyScore/);
    // LetterHomeScreen's own former smoothness-only badge/label formulas.
    expect(home).not.toMatch(/function\s+getBadge\s*\(\s*smoothness/);
    expect(home).not.toMatch(/function\s+getOverallLabel/);
  });

  // UPDATE (6-column Assessment Summary fix): the fallback source changed
  // from utils/motorBaseline (Feature 1's persisted baseline — a coarser
  // 3-family average, and only populated once an assessment has been
  // finalized, which many real assessments on live data never reach) to
  // utils/initialAssessmentShapes (the same 6-shape-per-attempt data
  // getInitialReport already derives for any assessment, finalized or
  // not). A later visit now shows the identical 6-row breakdown the child
  // saw immediately after finishing, never a blended 3-row summary.
  it('LetterHomeScreen falls back to the same 6-shape initial-report data (utils/initialAssessmentShapes) rather than a coarser 3-family summary or an empty state', () => {
    const home = read(LETTER_HOME_FILE);
    expect(home).toMatch(/import\s*{\s*fetchInitialAssessmentShapes\s*}\s*from\s*['"].*utils\/initialAssessmentShapes['"]/);
    expect(home).toMatch(/summaryShapes\.length > 0/);
    expect(home).not.toMatch(/utils\/motorBaseline/);
    expect(home).not.toMatch(/FAMILY_ORDER/);
  });

  it('both screens bucket "Good/Moderate/Needs practice"-style labels from a score >= 75 / >= 50 threshold, not from raw smoothness', () => {
    const complete = read(ASSESSMENT_COMPLETE_FILE);
    const home = read(LETTER_HOME_FILE);
    expect(complete).toMatch(/score\s*>=\s*75/);
    expect(complete).toMatch(/score\s*>=\s*50/);
    expect(home).toMatch(/score\s*>=\s*75/);
    expect(home).toMatch(/score\s*>=\s*50/);
  });
});
