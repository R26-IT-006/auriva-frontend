import fs from 'fs';
import path from 'path';

// Initial-assessment gate task — WelcomeScreen.js imports 'react-native' and
// so can't be mounted under this repo's plain-node jest config (see
// jest.config.js); verified by source-text assertion instead, the same
// established technique wordWorkflow.test.js / wordChildFeedbackIntegration.
// test.js already use for the same reason.
//
// Intent: the 6-shape initial assessment is core to adaptivity/
// personalization (Feature 1 baseline, Feature 2 thresholds) and must only
// be OFFERED on a student's first visit — a returning student (one who
// already has a stored, non-collection-mode assessment) is routed straight
// to LetterHome instead of seeing the assessment flow again. The actual
// data (never overridden once created) is already protected server-side in
// motorBaselineService.js/dynamicThresholdService.js — this only checks the
// FRONTEND gate that decides whether to show the flow at all.

const welcome = fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/WelcomeScreen.js'), 'utf8');

test('WelcomeScreen checks the same authoritative initial-report endpoint TeacherReportScreen uses', () => {
  expect(welcome).toContain('ENDPOINTS.HANDWRITING_INITIAL_REPORT(student?.sid)');
});

test('a returning student (hasData true) is routed straight to LetterHome, before entrance animations start', () => {
  const checkEffectStart = welcome.indexOf('HANDWRITING_INITIAL_REPORT');
  const replaceCall = welcome.indexOf("navigation.replace('LetterHome'");
  const animationStart = welcome.indexOf('entrance.start()');
  expect(replaceCall).toBeGreaterThan(-1);
  expect(checkEffectStart).toBeLessThan(replaceCall);
  // The gate's own effect (which can redirect) is registered before the
  // entrance-animation effect starts anything.
  expect(checkEffectStart).toBeLessThan(animationStart);
});

test('the check reads res.data.hasData and only redirects when it is true (never guesses on missing data)', () => {
  expect(welcome).toContain('if (res.data?.hasData) {');
});

test('a network failure fails OPEN — the assessment flow still shows rather than blocking the student', () => {
  const catchBlock = welcome.slice(
    welcome.indexOf('} catch (netErr) {', welcome.indexOf('HANDWRITING_INITIAL_REPORT')),
    welcome.indexOf('setCheckingReturningStudent(false)') + 40
  );
  expect(catchBlock).toContain('console.warn');
  expect(welcome).toContain('setCheckingReturningStudent(false)');
});

test('the loading gate renders only a blank themed background, not the full assessment UI, while checking', () => {
  expect(welcome).toContain('if (checkingReturningStudent) {');
  expect(welcome).toContain('return <SafeAreaView style={styles.safe} />;');
});

test('this is purely a routing gate — no scoring/baseline/threshold logic was touched', () => {
  expect(welcome).not.toMatch(/motor_score|motorProfile|StudentMotorBaseline|ThresholdHistory/);
});
