import fs from 'fs';
import path from 'path';

const read = rel => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

const LANDSCAPE_SCREENS = {
  LetterPractice: '../screens/handwriting/LetterPracticeScreen.js',
  LetterWriting: '../screens/handwriting/LetterWritingScreen.js',
  UppercaseWriting: '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
  PreWritingActivity: '../screens/handwriting/PreWritingActivityScreen.js',
  ShapeAssessment: '../screens/handwriting/ShapeAssessmentScreen.js',
  AssessmentComplete: '../screens/handwriting/AssessmentCompleteScreen.js',
  HandwritingDemo: '../screens/handwriting/HandwritingDemoScreen.js',
  WritingCheck: '../screens/handwriting/WritingCheckScreen.js',
  WordLetterSelect: '../screens/handwriting/words/WordLetterSelectScreen.js',
  WordActivity: '../screens/handwriting/words/WordActivityScreen.js',
  WordWriting: '../screens/handwriting/words/WordWritingScreen.js',
  WordProgress: '../screens/handwriting/words/WordProgressScreen.js',
  ChildProgressResult: '../screens/handwriting/ProgressReportScreen.js',
};

describe('handwriting orientation policy', () => {
  it.each(Object.entries(LANDSCAPE_SCREENS))('%s explicitly reacquires landscape on focus', (_name, rel) => {
    const source = read(rel);
    expect(source).toMatch(/useLockLandscape\(\);/);
    expect(source).not.toMatch(/useLockPortrait\(\);/);
  });

  it('keeps only the main teacher Progress Report portrait', () => {
    const source = read('../screens/handwriting/reports/TeacherReportScreen.js');
    expect(source).toMatch(/useLockPortrait\(\);/);
    expect(source).not.toMatch(/useLockLandscape\(\);/);
  });

  it('does not scatter native orientation calls across screens or components', () => {
    const roots = ['../screens/handwriting', '../components/handwriting'];
    const visit = rel => {
      const absolute = path.resolve(__dirname, rel);
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        const child = path.join(absolute, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (/\.js$/.test(entry.name)) {
          const source = fs.readFileSync(child, 'utf8');
          expect(source).not.toMatch(/ScreenOrientation\.(lockAsync|unlockAsync)/);
        }
      }
    };
    roots.forEach(visit);
  });

  it('keeps app-level orientation flexible so the report can rotate portrait', () => {
    const app = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../app.json'), 'utf8'));
    expect(app.expo.orientation).toBe('default');
  });
});
