// The Writing module's "How it works" overview (data/handwritingFlow.js) must
// match the way the screens run the module.

import fs from 'fs';
import path from 'path';
import { buildHandwritingFlow, LETTER_ATTEMPTS_PER_ROUND, LOWERCASE_LETTERS } from '../data/handwritingFlow';
import { MAX_CYCLES_PER_LETTER_PER_DATE } from './letterCycleGuard';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('Writing module "How it works" flow', () => {
  const flow = buildHandwritingFlow();

  test('stages run in the module order', () => {
    expect(flow.map((s) => s.key)).toEqual(
      ['assessment', 'choose', 'lowercase', 'uppercase', 'words', 'progress'],
    );
  });

  test('the round limit comes from the shared letter cycle guard', () => {
    expect(flow.find((s) => s.key === 'lowercase').ifWrong)
      .toContain(`After ${MAX_CYCLES_PER_LETTER_PER_DATE} rounds`);
  });

  test('the attempts-per-round and uppercase-unlock numbers match the screens', () => {
    expect(read('../screens/teacher/handwriting/LetterWritingScreen.js'))
      .toMatch(new RegExp(`isLastAttempt\\s*=\\s*attempt === ${LETTER_ATTEMPTS_PER_ROUND}`));
    expect(read('../screens/teacher/handwriting/LetterPracticeScreen.js'))
      .toMatch(new RegExp(`lowercaseDone\\s*=\\s*lowercaseProgress\\s*>=\\s*${LOWERCASE_LETTERS}`));
  });

  test('the five word activities A–E are the ones WordActivityScreen runs', () => {
    expect(read('../screens/teacher/handwriting/words/WordActivityScreen.js'))
      .toMatch(/const EXERCISES = \['A', 'B', 'C', 'D', 'E'\];/);
    expect(flow.find((s) => s.key === 'words').childDoes).toMatch(/A .* B .* C .* D .* E /);
  });

  test('LetterHome opens it from an ungated "How it works" button', () => {
    const home = read('../screens/teacher/handwriting/LetterHomeScreen.js');
    expect(home).toContain('onPress={() => setShowFlow(true)}');
    expect(home).toMatch(/visible=\{showFlow\}/);
    expect(home).not.toContain("requestGatedAction('howItWorks')");
  });
});
