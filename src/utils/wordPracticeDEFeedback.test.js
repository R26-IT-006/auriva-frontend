import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const D = '../components/word/ExerciseD_SpellWord.js';
const E = '../components/word/ExerciseE_WriteWord.js';
const ACTIVITY = '../screens/teacher/handwriting/words/WordActivityScreen.js';

describe('Word Practice D completion feedback', () => {
  test('removes only the extra green marker below the tiles', () => {
    const d = stripComments(read(D));
    expect(d).not.toMatch(/successRow|successAnim|<Ionicons name="checkmark-circle"/);
    expect(d).toContain('setDone(true)');
    expect(d).toContain('await Promise.resolve(onCorrectAnswer?.())');
    expect(d).toContain('onComplete(wrongCount === 0)');
    expect(d).toMatch(/done && styles\.boxDone/);
  });

  test('the approved correct GIF remains the D success presentation', () => {
    const activity = stripComments(read(ACTIVITY));
    expect(activity).toContain('showCorrectAnswerFeedback');
    expect(activity).toContain('<ResultGifFeedback');
    expect(activity).toContain('visible={Boolean(activityFeedback) && !activityFeedback.isWriting}');
  });
});

describe('Word Practice E incomplete feedback', () => {
  const e = stripComments(read(E));
  const activity = stripComments(read(ACTIVITY));

  test('uses one short avatar note and removes the long inline warning', () => {
    expect(activity).toContain("note: 'Finish every letter'");
    expect(activity).toContain('setActivityFeedback(INCOMPLETE_WORD_FEEDBACK)');
    expect(e).not.toContain('Finish every letter, then try Done again');
    expect(activity).toContain('<AttemptAvatarFeedback');
  });

  test('incomplete Done neither progresses nor clears the strokes', () => {
    const start = e.indexOf('if (!authoritative.passed)');
    const failure = e.slice(start, e.indexOf('setDone(true)', start));
    expect(failure).toContain('if (!nextResult.completed)');
    expect(failure).toContain('onIncomplete?.()');
    expect(failure).not.toMatch(/onComplete|setDone|setAllPaths|setCurrentPath/);
    const handlerStart = activity.indexOf('const showIncompleteWritingFeedback');
    const handler = activity.slice(handlerStart, activity.indexOf('const handleExerciseComplete', handlerStart));
    expect(handler).not.toMatch(/setExStatus|setScore|setExIdx|setWordResult/);
  });

  test('the overlay clears after the existing dwell and stays on E', () => {
    const start = activity.indexOf('const showIncompleteWritingFeedback');
    const handler = activity.slice(start, activity.indexOf('const handleExerciseComplete', start));
    expect(handler).toContain('ATTEMPT_FEEDBACK_MS');
    expect(handler).toContain('setActivityFeedback(null)');
    expect(handler).not.toMatch(/setExIdx|setWordResult|navigate|replace/);
  });

  test('valid E keeps its authoritative success path and never uses a GIF', () => {
    expect(e).toContain('setDone(true); setTimeout(() => onComplete(true, nextResult.layoutMessage), 500)');
    expect(activity).toContain('visible={Boolean(activityFeedback) && !activityFeedback.isWriting}');
    expect(activity).toMatch(/const isWriting = ex === 'E'[\s\S]*setActivityFeedback\(\{ passed: wasCorrect, isWriting: true, note \}\)/);
  });

  test('canvas, touch mapping, and authoritative scoring inputs remain intact', () => {
    expect(e).toContain('mapTouchToCanvas({');
    expect(e).toContain('strokes:allPaths');
    expect(e).toContain('canvas_width:CANVAS_W');
    expect(e).toContain('canvas_height:CANVAS_H');
    expect(e).toContain('passed:authoritative.passed');
  });
});
