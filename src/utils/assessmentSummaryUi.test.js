import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterHomeScreen.js'),
  'utf8',
);

describe('Assessment Summary presentation', () => {
  test('keeps the existing unified six-shape rendering and score source', () => {
    expect(source).toContain('{summaryShapes.map((item, index) => {');
    expect(source).toContain('const score    = shapeScores[index];');
    expect(source).toContain('const badge    = getScoreBadge(score);');
  });

  test('uses consistent shape icons, aligned scores, badges, and subtle indicators', () => {
    expect(source).toContain('function AssessmentShapeIcon({ shapeId, color })');
    expect(source).toContain('styles.shapeMetricColumn');
    expect(source).toContain('styles.shapeProgressTrack');
    expect(source).toContain('styles.shapeScoreText');
    expect(source).toContain('styles.badge');
  });

  test('presents the existing overall score and status as a compact summary', () => {
    expect(source).toContain('styles.overallResultRow');
    expect(source).toContain('styles.overallBadge');
    expect(source).toContain('score={overallShapeScore}');
  });

  test('does not add scrolling or change the close action', () => {
    expect(source).not.toMatch(/ScrollView/);
    expect(source).toContain('onPress={() => setShowSummary(false)}');
  });
});
