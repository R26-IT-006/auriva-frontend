import fs from 'fs';
import path from 'path';

const SCREEN = '../screens/teacher/handwriting/AssessmentCompleteScreen.js';
const read = () => fs.readFileSync(path.resolve(__dirname, SCREEN), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function styleBody(source, name) {
  const at = source.indexOf(`  ${name}: {`);
  expect(at).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('\n  },', at));
}

describe('Initial Assessment completion report rows', () => {
  const source = stripComments(read());

  test('all assessment rows use the existing rounded motor_score source', () => {
    expect(source).toMatch(/const scores = assessmentData\.map\(s => \{[\s\S]*s\.features\?\.motor_score[\s\S]*Math\.round\(v\)/);
    expect(source).toContain('assessmentData.map((shape, i) => {');
    expect(source).toContain('const score      = scores[i]');
    expect(source).not.toMatch(/assessmentData\.(slice|filter)\(/);
  });

  test('the number and bar consume the exact same row score', () => {
    expect(source).toContain("{score != null ? `${score}%` : 'N/A'}");
    expect(source).toContain("{ width: `${score ?? 0}%`, backgroundColor: theme.button }");
    expect(source).toContain('<Text style={styles.metaLabel}>Accuracy</Text>');
    expect(styleBody(source, 'accuracyHeader')).toMatch(/width: 110[\s\S]*justifyContent: 'space-between'/);
  });

  test('missing scores remain visibly unavailable rather than fabricated', () => {
    expect(source).toContain("score != null ? `${score}%` : 'N/A'");
    expect(source).not.toMatch(/motor_score\s*\?\?\s*50/);
  });
});

describe('Initial Assessment completion report footer', () => {
  const source = stripComments(read());

  test('removes Back to Assessment and keeps Continue', () => {
    expect(source).not.toContain('Back to Assessment');
    expect(source).not.toMatch(/styles\.retakeButton|retakeButton:|retakeText:/);
    expect(source).not.toContain('onPress={requestBack}');
    expect(source).toContain('>Continue</Text>');
  });

  test('the single remaining action is centered without adding scrolling', () => {
    expect(styleBody(source, 'footer')).toMatch(/alignItems: 'center'[\s\S]*justifyContent: 'center'/);
    expect(styleBody(source, 'doneButton')).toMatch(/justifyContent: 'center'[\s\S]*minWidth: 180/);
    expect(source).not.toMatch(/ScrollView/);
  });

  test('Continue retains collection mode and finalization while resetting normal practice', () => {
    expect(source).toMatch(/if \(collectionMode\)[\s\S]*navigation\.navigate\('LetterWriting'/);
    expect(source).toContain('await attemptFinalization({');
    expect(source).toMatch(/resetToPostAssessmentPractice\(navigation, \{/);
    expect(source).not.toMatch(/navigation\.navigate\('LetterHome', \{/);
  });
});
