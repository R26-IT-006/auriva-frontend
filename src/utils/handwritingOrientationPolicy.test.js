import fs from 'fs';
import path from 'path';

const read = rel => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

const LANDSCAPE_SCREENS = {
  LetterPractice: '../screens/teacher/handwriting/LetterPracticeScreen.js',
  LetterWriting: '../screens/teacher/handwriting/LetterWritingScreen.js',
  UppercaseWriting: '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
  PreWritingActivity: '../screens/teacher/handwriting/PreWritingActivityScreen.js',
  ShapeAssessment: '../screens/teacher/handwriting/ShapeAssessmentScreen.js',
  AssessmentComplete: '../screens/teacher/handwriting/AssessmentCompleteScreen.js',
  HandwritingDemo: '../screens/teacher/handwriting/HandwritingDemoScreen.js',
  WritingCheck: '../screens/teacher/handwriting/WritingCheckScreen.js',
  WordLetterSelect: '../screens/teacher/handwriting/words/WordLetterSelectScreen.js',
  WordActivity: '../screens/teacher/handwriting/words/WordActivityScreen.js',
  WordWriting: '../screens/teacher/handwriting/words/WordWritingScreen.js',
  WordProgress: '../screens/teacher/handwriting/words/WordProgressScreen.js',
  ChildProgressResult: '../screens/teacher/handwriting/ProgressReportScreen.js',
};

describe('handwriting orientation policy', () => {
  it.each(Object.entries(LANDSCAPE_SCREENS))('%s explicitly reacquires landscape on focus', (_name, rel) => {
    const source = read(rel);
    expect(source).toMatch(/useLockLandscape\(\);/);
    expect(source).not.toMatch(/useLockPortrait\(\);/);
  });

  it('keeps only the main teacher Progress Report portrait', () => {
    const source = read('../screens/teacher/handwriting/reports/TeacherReportScreen.js');
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
