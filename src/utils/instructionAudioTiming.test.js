const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('instruction-first handwriting timing', () => {
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
  ])('%s gates the canvas and speaks its target once per attempt', (_name, source) => {
    expect(source).toContain('autoPlay: Boolean(instructionKey)');
    expect(source).toContain('canWriteRef.current = !instructionPlaying');
    expect(source).toContain('onStartShouldSetPanResponder: () => canWriteRef.current');
    expect(source).toContain('if (!canWriteRef.current) return;');
    expect(source).toMatch(/targetSpokenAttemptRef\.current = false; \}, \[letter, attempt\]\)/);
    expect(source).toContain('if (!targetSpokenAttemptRef.current)');
    expect(source).toMatch(/canvasPointerEvents=\{(?:attemptFeedback \|\| )?instructionPlaying \? 'none' : 'auto'\}/);
    expect(source).not.toMatch(/useEffect\([\s\S]{0,300}playLetterSound\(letter\)/);
  });

  test('Word Writing follows the same gate without changing its approved target-word speech', () => {
    expect(wordWriting).toContain('autoPlay: true');
    expect(wordWriting).toContain('canWriteRef.current = !instructionPlaying');
    expect(wordWriting).toContain('if (!canWriteRef.current) return;');
    expect(wordWriting).toMatch(/targetSpokenAttemptRef\.current = false; \}, \[wordEntry\?\.word, attempt\]\)/);
    expect(wordWriting).toContain('spellWordRef.current?.();');
    expect(wordWriting).toContain("canvasPointerEvents={instructionPlaying ? 'none' : 'auto'}");
  });

  test('Word Practice gates only Exercise E and speaks the visible word on its first valid stroke', () => {
    expect(wordActivity).toContain("autoPlay: currentExercise === 'E'");
    expect(wordActivity).toContain('canWrite: !instructionPlaying');
    expect(wordActivity).toMatch(/currentExercise === 'E' && instructionPlaying/);
    expect(exerciseE).toContain('canWriteRef.current = canWrite');
    expect(exerciseE).toContain('if (!canWriteRef.current || doneRef.current) return;');
    expect(exerciseE).toContain('if (!targetSpokenRef.current)');
    expect(exerciseE).toContain('const spoken = spokenWord(wordEntry);');
    expect(exerciseE).toContain('language: SPEECH_LOCALE_EN');
    expect(exerciseE).toContain("pointerEvents={canWrite ? 'auto' : 'none'}");
  });

  test('manual replay re-gates and does not clear existing drawing state', () => {
    for (const source of [lower, upper, wordWriting]) {
      expect(source).toContain('onPlayInstruction={replaySupportInstruction}');
      const replay = source.slice(
        source.indexOf('const replaySupportInstruction'),
        source.indexOf('const replaySupportInstruction') + 450,
      );
      expect(replay).toContain('replayInstruction()');
      expect(replay).not.toMatch(/setAllPaths|setCurrentPath|resetCanvas/);
    }
    expect(wordActivity).toContain('onPress={replayCurrentInstruction}');
  });

  test('actual playback completion drives unlock and failure fallback cannot leave a permanent gate', () => {
    expect(player).toMatch(/status\.didJustFinish[\s\S]*finish\('completed'\)/);
    expect(player).toContain("finish('failed')");
    expect(hook).toContain("if (reason === 'failed') startFallback();");
    expect(hook).toContain('onDone: finishRun');
    expect(hook).toContain('onStopped: finishRun');
    expect(hook).toContain('onError: finishRun');
    expect(hook).toMatch(/catch \{[\s\S]{0,80}finishRun\(\)/);
    expect(hook).toContain('playback.token !== autoPlayToken');
  });
});
