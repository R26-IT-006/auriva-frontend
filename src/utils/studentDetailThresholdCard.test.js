// Feature 2 Teacher Dashboard integration fix — StudentDetailScreen.js's
// ThresholdCard.
//
// This project's Jest config only matches src/utils/**/*.test.js (see
// jest.config.js), and StudentDetailScreen.js cannot be `require`d directly
// under plain Jest (native RN/Expo imports) — so, matching the exact
// convention collectionModeStorageIsolation.test.js already established,
// this file lives in src/utils/ and reads the real screen source as text.
//
// Comments are stripped before every NEGATIVE ("must not contain X")
// assertion — this screen's own explanatory comments legitimately discuss
// `personal_thresholds` and "55/100" BY NAME (documenting what was removed
// and why), and a naive scan would false-positive on those exact comments.
// This is the same comment-stripping discipline this engagement's source-scan
// tests have needed before (recurred most recently in
// teacherRecommendationValidationService.test.js).

const fs = require('fs');
const path = require('path');

const SCREEN_FILE = path.resolve(__dirname, '../screens/teacher/students/StudentDetailScreen.js');

function readScreen() {
  return fs.readFileSync(SCREEN_FILE, 'utf8');
}

/** Strips // line comments and block comments so negative assertions only
 * ever see actual code. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('ThresholdCard reads real Feature 2 data, never the legacy field', () => {
  it('never reads student.personal_thresholds in actual code', () => {
    const code = stripComments(readScreen());
    expect(code).not.toMatch(/personal_thresholds/);
  });

  it('never references a hardcoded GLOBAL_DEFAULT / 55 fallback in actual code', () => {
    const code = stripComments(readScreen());
    expect(code).not.toMatch(/GLOBAL_DEFAULT/);
    expect(code).not.toMatch(/\b55\s*\/\s*100\b/); // the old fabricated "55/100" display
  });

  it('imports fetchFamilyThresholds from utils/familyThresholds, not a duplicated formula', () => {
    const source = readScreen();
    expect(source).toMatch(/import\s*{\s*fetchFamilyThresholds\s*}\s*from\s*['"].*utils\/familyThresholds['"]/);
  });

  it('renders all three real families (straight/curved/complex), each independently', () => {
    const source = readScreen();
    expect(source).toMatch(/straight:\s*['"]Straight['"]/);
    expect(source).toMatch(/curved:\s*['"]Curved['"]/);
    expect(source).toMatch(/complex:\s*['"]Complex['"]/);
  });

  it('has a distinct loading branch before rendering any threshold value', () => {
    const source = readScreen();
    expect(source).toMatch(/status\s*===\s*['"]loading['"]/);
  });

  it('has a distinct unavailable branch that never fabricates a number for a missing target', () => {
    const source = readScreen();
    expect(source).toMatch(/anyAvailable/);
    expect(source).toMatch(/Learning targets not available yet/);
  });

  it('lazily fetches thresholds only when the Writing module tab is active, not on every render', () => {
    const source = readScreen();
    expect(source).toMatch(/activeModule\s*===\s*['"]writing['"][\s\S]{0,80}loadFamilyThresholds\(\)/);
    expect(source).toMatch(/\[\s*activeModule\s*,\s*loadFamilyThresholds\s*\]/); // effect dependency array
  });
});
