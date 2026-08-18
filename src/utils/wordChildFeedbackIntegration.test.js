import fs from 'fs';
import path from 'path';

// Final-completion-pass task — same source-text-assertion technique already
// established in wordWorkflow.test.js's last two tests, used here for the
// same reason: WordWritingScreen.js / ExerciseE_WriteWord.js import
// 'react-native' and can't be mounted under this repo's plain-node jest
// config (see jest.config.js), so the wiring itself — not the pure math,
// which has its own dedicated unit tests — is verified by asserting on the
// actual shipped source rather than a duplicate hand-written model of it.

const writing = fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/words/WordWritingScreen.js'), 'utf8');
const exerciseE = fs.readFileSync(path.resolve(__dirname, '../components/word/ExerciseE_WriteWord.js'), 'utf8');

describe('child feedback is shown only after an authoritative save, never while drawing', () => {
  test('WordWritingScreen resolves the feedback message only after submitWordAttempt has resolved', () => {
    expect(writing.indexOf('saved = await submitWordAttempt')).toBeGreaterThan(-1);
    expect(writing.indexOf('saved = await submitWordAttempt')).toBeLessThan(writing.indexOf('childFeedbackMessage(saved?.child_feedback)'));
  });

  test('ExerciseE_WriteWord resolves the feedback message only after submitWordAttempt has resolved', () => {
    expect(exerciseE.indexOf('const authoritative = await submitWordAttempt')).toBeGreaterThan(-1);
    expect(exerciseE.indexOf('const authoritative = await submitWordAttempt')).toBeLessThan(exerciseE.indexOf('childFeedbackMessage(authoritative.child_feedback)'));
  });
});

describe('child feedback never gates progression or pass/fail', () => {
  test('WordWritingScreen always evaluates afterGuidedAttempt after setting feedback, regardless of message content', () => {
    // The feedback pill state is set unconditionally (message may be null);
    // afterGuidedAttempt/resetCanvas below it is never wrapped in a check on
    // childFeedbackText/message.
    expect(writing.indexOf('setChildFeedbackText(message)')).toBeLessThan(writing.indexOf('afterGuidedAttempt(attempt)'));
    expect(writing).not.toMatch(/if\s*\(\s*message\s*\)\s*\{[^}]*afterGuidedAttempt/);
  });

  test("ExerciseE_WriteWord's pass gate reads only authoritative.passed, never the layout advisory", () => {
    expect(exerciseE).toContain('if (!authoritative.passed) { actionIdRef.current=null; return; }');
  });
});

describe('responsive Exercise E canvas', () => {
  test('ExerciseE_WriteWord derives its canvas size from computeExerciseECanvasSize, not a fixed literal', () => {
    expect(exerciseE).toContain('computeExerciseECanvasSize(SCREEN_W)');
    expect(exerciseE).not.toMatch(/CANVAS_W\s*=\s*490/);
    expect(exerciseE).not.toMatch(/CANVAS_H\s*=\s*220/);
  });
});

describe('gesture termination is handled (not just release)', () => {
  test('WordWritingScreen finalizes an interrupted stroke via onPanResponderTerminate', () => {
    expect(writing).toContain('onPanResponderTerminate:');
  });

  test('ExerciseE_WriteWord finalizes an interrupted stroke via onPanResponderTerminate', () => {
    expect(exerciseE).toContain('onPanResponderTerminate:');
  });
});

describe('canvas accessibility label present on both screens', () => {
  test('WordWritingScreen canvas has a useful accessibility label', () => {
    expect(writing).toContain('accessibilityLabel="Word handwriting practice area"');
  });

  test('ExerciseE_WriteWord canvas has a useful accessibility label', () => {
    expect(exerciseE).toContain('accessibilityLabel="Word handwriting practice area"');
  });
});

describe('next word resets feedback/action-id state', () => {
  test('WordWritingScreen clears the child-feedback pill when the word changes', () => {
    expect(writing).toMatch(/useEffect\(\(\) => \{\s*clearTimeout\(childFeedbackTimerRef\.current\);\s*setChildFeedbackText\(null\);\s*\}, \[word\]\);/);
  });
});
