import fs from 'fs';
import path from 'path';

// TeacherReportScreen.js can't be mounted under this repo's plain-node jest
// config (imports 'react-native'); verified by source-text assertion, the
// same established technique other screen-behavior tests in this repo use
// (see wordWorkflow.test.js's last two tests).
//
// Bug fixed: report load() wraps most steps in try/catch, but a handful of
// local-storage reads and the report computation itself were NOT
// individually guarded — if one of those threw (e.g. a legacy/corrupted
// local record for an older student), the outer catch swallowed the error
// but `report` was never set. The render then assumed "loading finished"
// meant "report is ready" and read straight into report.summary/etc. with
// no null check — a hard crash to a blank/broken screen for that student,
// while unrelated students (whose load() happened not to hit the same
// local-storage edge case) rendered fine. Fixed by tracking load failure
// explicitly and gating the report body on `report` actually being set.

const screen = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'),
  'utf8'
);

test('a load failure is tracked explicitly (not just swallowed by console.warn)', () => {
  const catchBlock = screen.slice(
    screen.indexOf('} catch (e) {\n          console.warn(\'Report load error:\''),
    screen.indexOf('} finally {')
  );
  expect(catchBlock).toContain('setLoadError(true)');
});

test('the report body only renders once `report` is actually set, not just when loading is false', () => {
  // The ternary must branch on report (and loadError) BEFORE ever reaching
  // the ScrollView that reads report.summary/report.motorScore/etc.
  const loadingGateIndex = screen.indexOf('{loading ? (');
  const notReportBranch = screen.indexOf(') : !report || loadError ? (');
  const scrollViewBranch = screen.indexOf(') : (\n          <ScrollView');
  expect(loadingGateIndex).toBeGreaterThan(-1);
  expect(notReportBranch).toBeGreaterThan(loadingGateIndex);
  expect(scrollViewBranch).toBeGreaterThan(notReportBranch);
});

test('the failure state offers a retry rather than a permanent dead end', () => {
  expect(screen).toContain("Couldn't load this report");
  expect(screen).toContain("navigation.replace('TeacherReport', { student, theme })");
});

test('loadError is reset at the start of every load, so a retry can succeed', () => {
  const loadStart = screen.indexOf('async function load() {');
  const setLoadingTrue = screen.indexOf('setLoading(true);', loadStart);
  const setLoadErrorFalse = screen.indexOf('setLoadError(false);', loadStart);
  expect(setLoadErrorFalse).toBeGreaterThan(setLoadingTrue);
  expect(setLoadErrorFalse).toBeLessThan(screen.indexOf('try {', loadStart));
});

test('per-shape preview strokes are wired from the report breakdown through to ShapeRow', () => {
  expect(screen).toContain('computeShapePreviewPaths');
  expect(screen).toContain('<ShapePreview strokes={shape.strokes}');
});

test('ShapePreview never fabricates a drawing — falls back to a neutral placeholder icon', () => {
  const shapePreviewFn = screen.slice(
    screen.indexOf('function ShapePreview('),
    screen.indexOf('function ShapeRow(')
  );
  expect(shapePreviewFn).toContain('paths.length > 0');
  expect(shapePreviewFn).toContain('image-outline'); // placeholder icon, not a fabricated shape
});
