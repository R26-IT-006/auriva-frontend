const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('word-practice verdict and result experience wiring', () => {
  const screen = read('../screens/handwriting/words/WordActivityScreen.js');
  const exercises = ['ExerciseA_WriteFirst.js', 'ExerciseB_CircleImage.js', 'ExerciseC_FillBlank.js'];

  it.each(exercises)('%s locks, retains a selected verdict, and shuffles only after feedback', file => {
    const code = read(`../components/word/${file}`);
    expect(code).toMatch(/const \[inputLocked, setInputLocked\] = useState\(false\)/);
    expect(code).toMatch(/if \(done \|\| inputLockRef\.current\) return;/);
    expect(code).toMatch(/setVerdict\(\{ id: .* correct: false \}\)/);
    expect(code).toMatch(/await Promise\.resolve\(feedbackDone\);[\s\S]*shuffleSameOptions/);
    expect(code).toMatch(/disabled=\{done \|\| inputLocked\}/);
    expect(code).toMatch(/ANSWER_FEEDBACK_COLORS\.wrongSurface/);
    expect(code).toMatch(/ANSWER_FEEDBACK_COLORS\.correctSurface/);
  });

  it('D shuffles available candidates only and reports independence from actual retries', () => {
    const code = read('../components/word/ExerciseD_SpellWord.js');
    expect(code).toMatch(/shuffleAvailableTiles\(current, tileUsed\)/);
    expect(code).toMatch(/if \(done \|\| inputLockRef\.current \|\| tileUsed\[tileIdx\]\) return;/);
    expect(code).toMatch(/onComplete\(wrongCount === 0\)/);
    expect(code).not.toMatch(/shakeError/);
    expect(code).toMatch(/if \(tileUsed\[idx\] && !isRight\)/);
  });

  it('wrong feedback resolves after the shared dwell, allowing shuffle and unlock afterward', () => {
    expect(screen).toMatch(/return new Promise\(\(resolve\) => \{[\s\S]*resolve\(true\);[\s\S]*RESULT_GIF_MS/);
    expect(screen).toMatch(/answerFeedbackRef\.current/);
  });

  it('shows the result once after E and defers existing navigation to Keep Going', () => {
    expect(screen).toMatch(/setWordResult\(\{ word: currentWord\.word, statuses: newStatus \}\)/);
    expect(screen).toMatch(/const continueFromWordResult = useCallback/);
    expect(screen).toMatch(/afterExerciseESuccess\(wordIdx, letterWords\.length\)/);
    expect(screen).toMatch(/resultContinuingRef\.current = true/);
    expect(screen).toMatch(/<WordPracticeResultCard/);

    const card = read('../components/word/WordPracticeResultCard.js');
    expect(card).toContain('Well done!');
    expect(card).toContain('completed independently');
    expect(card).toContain('Keep Going');
    expect(card).not.toMatch(/Motor Score|DTW|threshold/);
  });

  it('preserves A-C session outcomes through the existing Activity D demo detour', () => {
    expect(screen).toMatch(/initialExerciseStatus: exStatus/);
    expect(screen).toMatch(/\.\.\.\(route\.params\?\.initialExerciseStatus \?\? \{\}\)/);
  });
});
