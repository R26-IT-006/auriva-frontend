const fs = require('fs');
const path = require('path');
const {
  INSTRUCTION_WRITE_UNLOCK_RATIO,
  createInstructionTargetSpeechQueue,
  hasReachedInstructionWriteThreshold,
} = require('./instructionAudioGate');

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('75% instruction-audio writing threshold', () => {
  test.each([
    [0, false],
    [2000, false],
    [2999, false],
    [3000, true],
    [3500, true],
  ])('4000 ms recording at %i ms => writable %s', (positionMillis, expected) => {
    expect(hasReachedInstructionWriteThreshold({
      isLoaded: true,
      durationMillis: 4000,
      positionMillis,
      isPlaying: true,
    })).toBe(expected);
  });

  test('uses 75% and keeps unknown durations locked for lifecycle fallback', () => {
    expect(INSTRUCTION_WRITE_UNLOCK_RATIO).toBe(0.75);
    expect(hasReachedInstructionWriteThreshold({ isLoaded: true, positionMillis: 3000 })).toBe(false);
    expect(hasReachedInstructionWriteThreshold({
      isLoaded: true,
      durationMillis: 0,
      positionMillis: 3000,
    })).toBe(false);
  });
});

describe('instruction/target speech sequencing', () => {
  test('first touch in the final 25% queues target speech and completion speaks once', () => {
    const queue = createInstructionTargetSpeechQueue();
    const speak = jest.fn();
    queue.begin({ reset: true });
    queue.request(speak);
    queue.request(speak);
    expect(speak).not.toHaveBeenCalled();
    queue.complete();
    queue.complete();
    expect(speak).toHaveBeenCalledTimes(1);
  });

  test('touch after instruction completion speaks immediately', () => {
    const queue = createInstructionTargetSpeechQueue();
    const speak = jest.fn();
    queue.begin({ reset: true });
    queue.complete();
    queue.request(speak);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  test('attempt reset discards an old queued target', () => {
    const queue = createInstructionTargetSpeechQueue();
    const oldAttempt = jest.fn();
    const newAttempt = jest.fn();
    queue.begin({ reset: true });
    queue.request(oldAttempt);
    queue.begin({ reset: true });
    queue.request(newAttempt);
    queue.complete();
    expect(oldAttempt).not.toHaveBeenCalled();
    expect(newAttempt).toHaveBeenCalledTimes(1);
  });

  test('manual replay preserves a queued target without duplicating it', () => {
    const queue = createInstructionTargetSpeechQueue();
    const speak = jest.fn();
    queue.begin({ reset: true });
    queue.request(speak);
    queue.begin();
    queue.complete();
    expect(speak).toHaveBeenCalledTimes(1);
  });
});

describe('screen wiring for the 75% gate', () => {
  const lower = read('src/screens/handwriting/LetterWritingScreen.js');
  const upper = read('src/screens/handwriting/uppercase/UppercaseWritingScreen.js');
  const wordWriting = read('src/screens/handwriting/words/WordWritingScreen.js');
  const wordActivity = read('src/screens/handwriting/words/WordActivityScreen.js');
  const exerciseE = read('src/components/word/ExerciseE_WriteWord.js');
  const hook = read('src/utils/useInstructionAudio.js');
  const player = read('src/utils/handwritingInstructionAudio.js');

  test.each([
    ['lowercase', lower],
    ['uppercase', upper],
  ])('%s accepts strokes at the threshold and queues first-touch target speech', (_name, source) => {
    expect(source).toContain('canWriteRef.current = canWrite');
    expect(source).toContain('onStartShouldSetPanResponder: () => canWriteRef.current');
    expect(source).toContain('if (!canWriteRef.current) return;');
    expect(source).toContain('requestTargetSpeech(() => playLetterSoundRef.current?.())');
    expect(source).toContain("!canWrite ? 'none' : 'auto'");
  });

  test('Word Writing uses the same gate and retains current-word speech', () => {
    expect(wordWriting).toContain('canWriteRef.current = canWrite');
    expect(wordWriting).toContain('requestTargetSpeech(() => spellWordRef.current?.())');
    expect(wordWriting).toContain("canvasPointerEvents={canWrite ? 'auto' : 'none'}");
    expect(wordWriting).toContain('language: SPEECH_LOCALE_EN');
  });

  test('Word Practice gates only Activity E and queues its visible target word', () => {
    expect(wordActivity).toContain("autoPlay: currentExercise === 'E'");
    expect(wordActivity).toContain("canWrite: currentExercise !== 'E' || instructionCanWrite");
    expect(wordActivity).toContain('requestTargetSpeech,');
    expect(exerciseE).toContain('requestTargetSpeech(() => {');
    expect(exerciseE).toContain('const spoken = spokenWord(wordEntry);');
    expect(exerciseE).toContain('language: SPEECH_LOCALE_EN');
  });

  test('real playback status unlocks; completion/failure provide safe fallback', () => {
    expect(player).toContain('onPlaybackStatus?.(status)');
    expect(hook).toContain('hasReachedInstructionWriteThreshold(status)');
    expect(hook).toMatch(/reason === 'failed'[\s\S]{0,180}unlockWriting\(\)/);
    expect(hook).toMatch(/reason === 'completed'[\s\S]{0,80}finishRun\(\)/);
  });

  test('manual replay does not reset an already-open gate or drawing state', () => {
    expect(hook).toContain('resetWriteGate = false');
    expect(hook).toContain('replay({ resetWriteGate: true })');
    for (const source of [lower, upper, wordWriting]) {
      const replay = source.slice(
        source.indexOf('const replaySupportInstruction'),
        source.indexOf('const replaySupportInstruction') + 450,
      );
      expect(replay).toContain('replayInstruction()');
      expect(replay).not.toMatch(/setAllPaths|setCurrentPath|resetCanvas/);
    }
  });
});
