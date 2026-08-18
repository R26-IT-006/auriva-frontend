import {
  GUIDED_SUPPORT,
  WORD_EXERCISES,
  afterExerciseESuccess,
  afterGuidedAttempt,
  buildWordRouteParams,
  resolveWordSession,
} from './wordWorkflow';
import fs from 'fs';
import path from 'path';

const student = { sid: 40 };
const theme = { button: '#123456' };
const selectedWords = [
  { word: 'cat', letter: 'c' },
  { word: 'car', letter: 'c' },
  { word: 'cup', letter: 'c' },
];

test('the selected-word session starts at the first word', () => {
  const session = resolveWordSession({ selectedLetter: 'c', selectedWords, currentWordIndex: 0 });
  expect(session.currentWord.word).toBe('cat');
  expect(session.currentWordIndex).toBe(0);
});

test('guided attempts remain on one word and then enter practice for that word', () => {
  expect(afterGuidedAttempt(1)).toEqual({ type: 'attempt', attemptNumber: 2 });
  expect(afterGuidedAttempt(2)).toEqual({ type: 'attempt', attemptNumber: 3 });
  expect(afterGuidedAttempt(3)).toEqual({ type: 'route', route: 'WordPractice' });
  expect(GUIDED_SUPPORT).toEqual({ 1: 'high', 2: 'medium', 3: 'low' });
});

test('A through E complete before the next selected word begins', () => {
  expect(WORD_EXERCISES).toEqual(['A', 'B', 'C', 'D', 'E']);
  expect(afterExerciseESuccess(0, selectedWords.length)).toEqual({ route: 'WordWriting', currentWordIndex: 1 });
});

test('non-final E success preserves the selection and advances exactly one word', () => {
  const next = afterExerciseESuccess(0, selectedWords.length);
  const params = buildWordRouteParams({ student, theme, selectedLetter: 'c', selectedWords, currentWordIndex: next.currentWordIndex });
  expect(params).toMatchObject({ studentId: 40, selectedLetter: 'c', selectedWords, currentWordIndex: 1 });
  expect(resolveWordSession(params).currentWord.word).toBe('car');
});

test('each next-word screen starts from attempt 1/high with isolated local state', () => {
  const initialScreenState = () => ({ attempt: 1, support: GUIDED_SUPPORT[1], strokes: [], score: null, actionId: null });
  const cat = initialScreenState();
  cat.strokes.push([{ x: 1, y: 1 }]);
  cat.score = 70;
  cat.actionId = 'cat-action';
  cat.attempt = 3;
  const car = initialScreenState();
  expect(car).toEqual({ attempt: 1, support: 'high', strokes: [], score: null, actionId: null });
});

test('final-word E success leads to server-backed WordProgress', () => {
  expect(afterExerciseESuccess(2, selectedWords.length)).toEqual({ route: 'WordProgress', currentWordIndex: 2 });
});

test('the next word cannot be selected before Exercise E succeeds', () => {
  for (const exercise of WORD_EXERCISES.slice(0, -1)) {
    expect(exercise).not.toBe('E');
  }
  expect(afterExerciseESuccess(0, selectedWords.length).currentWordIndex).toBe(1);
});

test('CAT, CAR, CUP follow the exact guided-then-A-E ordering', () => {
  const events = [];
  selectedWords.forEach((entry, index) => {
    for (const attemptNumber of [1, 2, 3]) events.push(`${entry.word}:guided:${attemptNumber}`);
    for (const activity of WORD_EXERCISES) events.push(`${entry.word}:activity:${activity}`);
    const transition = afterExerciseESuccess(index, selectedWords.length);
    events.push(`${entry.word}:next:${transition.route}`);
  });
  expect(events).toEqual([
    'cat:guided:1', 'cat:guided:2', 'cat:guided:3',
    'cat:activity:A', 'cat:activity:B', 'cat:activity:C', 'cat:activity:D', 'cat:activity:E',
    'cat:next:WordWriting',
    'car:guided:1', 'car:guided:2', 'car:guided:3',
    'car:activity:A', 'car:activity:B', 'car:activity:C', 'car:activity:D', 'car:activity:E',
    'car:next:WordWriting',
    'cup:guided:1', 'cup:guided:2', 'cup:guided:3',
    'cup:activity:A', 'cup:activity:B', 'cup:activity:C', 'cup:activity:D', 'cup:activity:E',
    'cup:next:WordProgress',
  ]);
});

test('screen orchestration blocks navigation when authoritative saves fail', () => {
  const writing = fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/words/WordWritingScreen.js'), 'utf8');
  const practice = fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/words/WordActivityScreen.js'), 'utf8');
  const exerciseE = fs.readFileSync(path.resolve(__dirname, '../components/word/ExerciseE_WriteWord.js'), 'utf8');

  expect(writing.indexOf('await submitWordAttempt')).toBeLessThan(writing.indexOf('afterGuidedAttempt(attempt)'));
  expect(writing).toContain("catch { setSaveError('Could not save yet. Check the connection and try again.'); setSubmitting(false); return; }");
  expect(writing).not.toContain('setWordIdx');
  expect(practice).toContain("catch { setSaveError('Could not save yet. Check the connection and try again.'); setSaving(false); return; }");
  expect(practice).not.toContain('setWordIdx');
  expect(exerciseE.indexOf('if (!authoritative.passed)')).toBeLessThan(exerciseE.indexOf('onComplete(true)'));
});

test('network retries reuse an action id while the next saved attempt gets a fresh id', () => {
  const writing = fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/words/WordWritingScreen.js'), 'utf8');
  expect(writing).toContain('submitActionIdRef.current ||= newActionId()');
  expect(writing.indexOf('await submitWordAttempt')).toBeLessThan(writing.indexOf('submitActionIdRef.current = null'));
  expect(writing.indexOf('submitActionIdRef.current = null')).toBeLessThan(writing.indexOf("catch { setSaveError"));
});
