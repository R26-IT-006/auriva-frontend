// Data-collection isolation (final integration audit, Part B) — source-scan
// regression proof that LetterWritingScreen.js and UppercaseWritingScreen.js
// never write a collection-mode attempt into local AsyncStorage progress
// (storeLetterProgress), the exact defect that let collection-mode sessions
// pollute TeacherReportScreen's normal "completed letters" / letter-progress
// display (reportEngine.js's computeLetterMetrics/computeProgressIndicators).
//
// This project's Jest config has no RN component-testing infrastructure —
// screen-level behavior is proven the same "source-scan proof" convention
// already used throughout this engagement (e.g. demoSpeedActivation.test.js,
// repetitionActivationOrchestration.test.js), since these two screens cannot
// be `require`d/rendered under plain Jest.

const fs = require('fs');
const path = require('path');

const SCREEN_FILES = [
  '../screens/teacher/handwriting/LetterWritingScreen.js',
  '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
];

function readScreen(file) {
  return fs.readFileSync(path.resolve(__dirname, file), 'utf8');
}

describe('storeLetterProgress is never called unconditionally', () => {
  it.each(SCREEN_FILES)('%s guards every storeLetterProgress call with a collectionMode check', (file) => {
    const source = readScreen(file);
    const calls = source.match(/[^\n]*storeLetterProgress\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0); // the call must still exist for normal mode
    for (const line of calls) {
      // The exact guard this fix introduced: `collectionMode ? Promise.resolve() : storeLetterProgress(`
      expect(line).toMatch(/collectionMode\s*\?\s*Promise\.resolve\(\)\s*:\s*storeLetterProgress\(/);
    }
  });
});

describe('storeLetterProgress import is still present (fix did not remove the call, only guard it)', () => {
  it.each(SCREEN_FILES)('%s still imports storeLetterProgress from utils/storage', (file) => {
    const source = readScreen(file);
    expect(source).toMatch(/storeLetterProgress/);
    expect(source).toMatch(/from\s+['"].*utils\/storage['"]/);
  });
});

describe('other Feature 3/4/6 collection-mode guards remain intact (no regression from this fix)', () => {
  it.each(SCREEN_FILES)('%s still short-circuits its adaptive fetch effects under collectionMode', (file) => {
    const source = readScreen(file);
    const shortCircuits = source.match(/if \(collectionMode\) return;/g) ?? [];
    expect(shortCircuits.length).toBeGreaterThan(0);
  });
});
