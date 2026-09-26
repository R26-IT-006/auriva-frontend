// The Student Profile's "Writing Standard" threshold card — REMOVED.
//
// ── What this suite used to do ──────────────────────────────────────────
// It guarded a ThresholdCard on Teacher -> Student Profile -> Writing that
// rendered the three Feature 2 family targets. Its assertions existed to stop
// three specific regressions: reading the legacy `personal_thresholds` field,
// hardcoding a 55 fallback, and fabricating a number for a missing target.
//
// ── Why it now guards a removal ─────────────────────────────────────────
// The Writing tab became a compact module summary (letters mastered, case
// breakdown, word status, home practice, writing pattern) following the
// Concepts pattern. A per-family numeric threshold is report-level detail,
// not an at-a-glance status, so the card — and the request that fed it — were
// removed from this screen.
//
// The suite is KEPT rather than deleted: if that card ever returns, it must
// not return with the flaws these tests were written to prevent, and the
// backend it read from must still be intact. Deleting the file would lose
// both guarantees silently.

const fs = require('fs');
const path = require('path');

const SCREEN_FILE = path.resolve(__dirname, '../screens/teacher/students/StudentDetailScreen.js');
const RESOLVER_FILE = path.resolve(
  __dirname, '../../../auriva-backend/src/services/progressionThresholdResolver.js');

function readScreen() {
  return fs.readFileSync(SCREEN_FILE, 'utf8');
}
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('the threshold card is gone from the Student Profile', () => {
  const code = stripComments(readScreen());

  it('renders no threshold UI', () => {
    expect(code).not.toMatch(/ThresholdCard/);
    expect(code).not.toMatch(/ThresholdWhyPanel/);
    expect(code).not.toMatch(/Writing Standard/);
    expect(code).not.toMatch(/Current Learning Targets/);
  });

  it('makes no threshold request — one fewer call every time Writing opens', () => {
    expect(code).not.toMatch(/fetchFamilyThresholds/);
    expect(code).not.toMatch(/fetchThresholdTrace/);
    expect(code).not.toMatch(/familyThresholds/);
    expect(code).not.toMatch(/thresholdTrace/);
  });

  it('the Writing effect loads exactly one thing now', () => {
    expect(code).toMatch(/if \(activeModule === 'writing'\) loadWritingSummary\(\);/);
  });

  it('left no orphaned threshold or why-panel styles behind', () => {
    const styles = code.slice(code.indexOf('const styles = StyleSheet.create({'));
    expect(styles).not.toMatch(/threshold[A-Z]/);
    expect(styles).not.toMatch(/why[A-Z]/);
  });

  it('still never reads the legacy personal_thresholds field', () => {
    // The original guarantee, and it holds trivially now — but it must keep
    // holding if the card ever comes back.
    expect(code).not.toMatch(/personal_thresholds/);
  });

  it('still hardcodes no 55 fallback anywhere on this screen', () => {
    expect(code).not.toMatch(/GLOBAL_DEFAULT/);
    expect(code).not.toMatch(/\b55\b\s*\/\s*100/);
  });
});

describe('SENTINEL — only the UI was removed, never the logic', () => {
  it('the reusable threshold utils still exist', () => {
    expect(fs.existsSync(path.resolve(__dirname, './familyThresholds.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, './thresholdTrace.js'))).toBe(true);
  });

  it('the backend resolver, its sources and teacher overrides are intact', () => {
    const resolver = fs.readFileSync(RESOLVER_FILE, 'utf8');
    expect(resolver).toMatch(/function resolveProgressionThreshold/);
    expect(resolver).toMatch(/SOURCE_REQUEST_OVERRIDE/);      // teacher override
    expect(resolver).toMatch(/SOURCE_FEATURE2_FAMILY/);       // family targets
    expect(resolver).toMatch(/GLOBAL_DEFAULT = 55/);          // untouched constant
  });

  it('threshold history and the family mapping are untouched', () => {
    const mapping = path.resolve(
      __dirname, '../../../auriva-backend/src/config/letterBaselineFamilies.js');
    expect(fs.existsSync(mapping)).toBe(true);
    const dynamic = path.resolve(
      __dirname, '../../../auriva-backend/src/services/dynamicThresholdService.js');
    expect(fs.existsSync(dynamic)).toBe(true);
  });

  it('the pilot mastery threshold is still 70 — this cleanup changed no policy', () => {
    const policy = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/masteryPolicy.js'), 'utf8');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
  });
});
