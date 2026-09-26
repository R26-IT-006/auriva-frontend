import fs from 'fs';
import path from 'path';

// Assessment Summary "6 columns" fix — LetterHomeScreen.js can't be mounted
// under this repo's plain-node jest config (imports 'react-native');
// verified by source-text assertion, the same established technique other
// screen-behavior tests in this repo use.
//
// Bug: on a later visit (no in-memory assessmentData from the just-
// completed session), the modal fell back to utils/motorBaseline — Feature
// 1's persisted 3-family baseline, which only exists once an assessment has
// been finalized. Two real, concrete problems on live data:
//   1. Many assessments are never finalized (confirmed: some students have
//      dozens of HandwritingAssessment rows, all with motor_score/
//      motor_profile still null) — no StudentMotorBaseline row ever gets
//      created for them, so the modal rendered nothing at all.
//   2. Even when a baseline DID exist, it only has 3 blended family scores
//      (straight/curved/complex), not the 6 individual shape scores the
//      child saw moments after finishing — a visibly different, "mixed"
//      view for the exact same assessment.
// Fixed by fetching the same 6-shape data getInitialReport already derives
// per-shape from raw stroke data (works even for a never-finalized
// assessment) and rendering it through the identical 6-row UI used for the
// in-memory case — one data shape, one rendering path, always 6 shapes.

const home = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'), 'utf8');

test('the fallback fetch uses the 6-shape initial-report source, not the 3-family baseline', () => {
  expect(home).toContain('fetchInitialAssessmentShapes');
  expect(home).not.toContain('fetchMotorBaseline');
});

test('a unified summaryShapes source feeds ONE rendering path for both the just-completed and later-visit cases', () => {
  const summaryShapesIndex = home.indexOf('const summaryShapes = assessmentData.length > 0 ? assessmentData : (initialShapesSummary.shapes ?? []);');
  const renderMapIndex = home.indexOf('{summaryShapes.map((item, index) => {');
  expect(summaryShapesIndex).toBeGreaterThan(-1);
  expect(renderMapIndex).toBeGreaterThan(summaryShapesIndex);
});

test('there is no separate 3-family rendering branch left in the modal', () => {
  expect(home).not.toMatch(/FAMILY_ORDER\.map/);
  expect(home).not.toContain('FAMILY_LABELS');
  expect(home).not.toContain('FAMILY_ICONS');
});

test('a genuinely unavailable per-shape score still renders "N/A" rather than a fabricated number', () => {
  expect(home).toContain("score != null ? `${score}%` : 'N/A'");
});

test('the modal still has a loading state and a final empty state when nothing is available at all', () => {
  expect(home).toContain("initialShapesSummary.status === 'loading'");
  expect(home).toContain('No assessment data available.');
});
