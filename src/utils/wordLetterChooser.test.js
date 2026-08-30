// The word-letter chooser: what opens when, and what the child sees while it
// is still shut.
//
// A, B and C are open from the first session — a child should not have to earn
// their way into three starting points. D is the first earned letter, and from
// there the alphabet opens one at a time.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  WORD_LETTERS,
  INITIAL_WORD_LETTERS,
  computeWordLetterUnlocks,
  isWordPracticeLetterCompleted,
} from './wordLetterUnlockPolicy';
import { getSelectedWords, WORD_EXERCISES } from './wordWorkflow';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const CHOOSER = '../screens/teacher/handwriting/words/WordLetterSelectScreen.js';

// Progress in the shape the server returns: { letter: [{ word, status }] }.
// A letter counts as complete only when every catalogue word for it has all
// of A–E recorded — the same evidence the completed-word filtering uses.
const allFive = (status = 'correct') =>
  Object.fromEntries(WORD_EXERCISES.map((ex) => [ex, status]));

function completeLetters(...letters) {
  const progress = {};
  for (const letter of letters) {
    const key = letter.toLowerCase();
    progress[key] = getSelectedWords(key).map(({ word }) => ({ word, status: allFive() }));
  }
  return progress;
}

const openLetters = (progress) =>
  WORD_LETTERS.filter((l) => computeWordLetterUnlocks(progress)[l]);

// ─── §3 the starting state ──────────────────────────────────────────────

describe('§3 — a new student starts with A, B and C', () => {
  it('exactly three letters are open, and they are A B C', () => {
    expect(openLetters({})).toEqual(['A', 'B', 'C']);
    expect(INITIAL_WORD_LETTERS).toEqual(['A', 'B', 'C']);
  });

  it('D through Z are all shut', () => {
    const unlocks = computeWordLetterUnlocks({});
    for (const letter of WORD_LETTERS.slice(3)) {
      expect(unlocks[letter]).toBe(false);
    }
  });

  it('A, B and C do not require each other', () => {
    // Any order, any subset — the three openers stay open regardless.
    for (const progress of [{}, completeLetters('B'), completeLetters('C', 'A')]) {
      const unlocks = computeWordLetterUnlocks(progress);
      expect([unlocks.A, unlocks.B, unlocks.C]).toEqual([true, true, true]);
    }
  });
});

// ─── §4 the first gate ──────────────────────────────────────────────────

describe('§4 — D needs all three of A, B and C', () => {
  it('one of the three is not enough', () => {
    expect(computeWordLetterUnlocks(completeLetters('A')).D).toBe(false);
  });

  it('two of the three is not enough', () => {
    expect(computeWordLetterUnlocks(completeLetters('A', 'B')).D).toBe(false);
    expect(computeWordLetterUnlocks(completeLetters('B', 'C')).D).toBe(false);
  });

  it('all three opens D — and D alone', () => {
    const unlocks = computeWordLetterUnlocks(completeLetters('A', 'B', 'C'));
    expect(unlocks.D).toBe(true);
    expect(unlocks.E).toBe(false);
    expect(openLetters(completeLetters('A', 'B', 'C'))).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ─── §4 one at a time, all the way to Z ─────────────────────────────────

describe('§4 — then one new letter per completed letter', () => {
  it('D opens E, E opens F, F opens G', () => {
    const abc = ['A', 'B', 'C'];
    expect(openLetters(completeLetters(...abc, 'D'))).toEqual([...abc, 'D', 'E']);
    expect(openLetters(completeLetters(...abc, 'D', 'E'))).toEqual([...abc, 'D', 'E', 'F']);
    expect(openLetters(completeLetters(...abc, 'D', 'E', 'F'))).toEqual([...abc, 'D', 'E', 'F', 'G']);
  });

  it('every step from D to Z opens exactly one more letter', () => {
    const done = ['A', 'B', 'C'];
    for (let i = 3; i < WORD_LETTERS.length; i++) {
      const open = openLetters(completeLetters(...done));
      // One further than what has been finished, until Z has no successor.
      expect(open).toEqual(WORD_LETTERS.slice(0, Math.min(i + 1, WORD_LETTERS.length)));
      done.push(WORD_LETTERS[i]);
    }
    // Finishing Y opens Z; finishing Z opens nothing new.
    expect(openLetters(completeLetters(...WORD_LETTERS.slice(0, 25)))).toEqual(WORD_LETTERS);
    expect(openLetters(completeLetters(...WORD_LETTERS))).toEqual(WORD_LETTERS);
  });

  it('skipping a letter does not open the one after it', () => {
    // D and F finished, E not: F was already open, but G stays shut.
    const progress = completeLetters('A', 'B', 'C', 'D', 'F');
    const unlocks = computeWordLetterUnlocks(progress);
    expect(unlocks.E).toBe(true);    // earned by D
    expect(unlocks.F).toBe(false);   // E is still outstanding
    expect(unlocks.G).toBe(false);
  });
});

// ─── §5 what "completed" means ──────────────────────────────────────────

describe('§5 — completion is the existing all-of-A-to-E evidence', () => {
  const firstWord = () => getSelectedWords('a')[0].word;

  it('a letter with no progress is not complete', () => {
    expect(isWordPracticeLetterCompleted({}, 'A')).toBe(false);
  });

  it('one word finished is not the letter finished', () => {
    const progress = { a: [{ word: firstWord(), status: allFive() }] };
    expect(isWordPracticeLetterCompleted(progress, 'A')).toBe(false);
  });

  it('every word but one exercise short is not complete', () => {
    const progress = completeLetters('A');
    delete progress.a[0].status.E;
    expect(isWordPracticeLetterCompleted(progress, 'A')).toBe(false);
  });

  it('all words with all of A–E is complete', () => {
    expect(isWordPracticeLetterCompleted(completeLetters('A'), 'A')).toBe(true);
  });

  it('a "good" pass counts — help does not disqualify the word', () => {
    const progress = {
      a: getSelectedWords('a').map(({ word }) => ({ word, status: allFive('good') })),
    };
    expect(isWordPracticeLetterCompleted(progress, 'A')).toBe(true);
  });

  it('the policy reads the shared completion helper, not a second model', () => {
    const code = readCode('./wordLetterUnlockPolicy.js');
    expect(code).toMatch(/from '\.\/wordCompletionHistory'/);
    expect(code).toMatch(/completedWordsForLetter\(progress, key\)/);
    expect(code).toMatch(/from '\.\/wordWorkflow'/);
  });

  it('rubbish input is not a completed letter', () => {
    for (const bad of ['', '  ', 'AB', null, undefined, 1]) {
      expect(isWordPracticeLetterCompleted(completeLetters('A'), bad)).toBe(false);
    }
  });

  it('unlock state is per student, because progress is', () => {
    // The policy is a pure function of one student's progress payload; the
    // chooser refetches it per student on focus.
    expect(openLetters(completeLetters('A', 'B', 'C'))).toHaveLength(4);
    expect(openLetters({})).toHaveLength(3);
    expect(readCode(CHOOSER)).toMatch(/fetchWordProgress\(student\)/);
    expect(readCode(CHOOSER)).toMatch(/\}, \[student\?\.sid\]\)/);
  });
});

// ─── §2 the two top buttons ─────────────────────────────────────────────

describe('§2 — Word Progress and Progress Report', () => {
  const code = readCode(CHOOSER);

  it('the labels read Word Progress and Progress Report', () => {
    expect(code).toMatch(/>Word Progress<\/Text>/);
    expect(code).toMatch(/>Progress Report<\/Text>/);
    expect(code).not.toMatch(/>Rewards<\/Text>/);
    expect(code).not.toMatch(/>Teacher<\/Text>/);
    expect(code).not.toMatch(/accessibilityLabel="View rewards"/);
  });

  it('Word Progress goes to the existing WordProgress screen', () => {
    expect(code).toMatch(/navigation\.navigate\('WordProgress', \{ student, theme \}\)/);
  });

  it('Progress Report goes to the existing TeacherReport route, behind the gate', () => {
    // Same destination and params as LetterHomeScreen's gated progress action.
    // This phase renamed the LABEL; the screen behind it did not move.
    expect(code).toMatch(/requestBack: requestTeacherReport/);
    expect(code).toMatch(/gateModal: teacherReportGateModal/);
    expect(code).toMatch(/useGatedBack\(\(\) => navigation\.navigate\('TeacherReport', \{/);
    expect(code).toMatch(/originRoute: 'WordLetterSelect'/);
    expect(code).toMatch(/onPress=\{requestTeacherReport\}/);
    expect(code).toMatch(/\{teacherReportGateModal\}/);
    // It stays behind the parent gate — never a bare tap.
    expect(code).not.toMatch(/onPress=\{\(\) => navigation\.navigate\('TeacherReport'/);
  });

  it('no duplicate progress or report screen was introduced', () => {
    const nav = readCode('../navigation/HandwritingNavigator.js');
    expect((nav.match(/name="TeacherReport"/g) || [])).toHaveLength(1);
    expect((nav.match(/name="WordProgress"/g) || [])).toHaveLength(1);
  });
});

// ─── §6 / §7 / §8 the locked card ───────────────────────────────────────

describe('§6-§8 — a locked card is still its own card', () => {
  const code = readCode(CHOOSER);

  it('it keeps its palette, not a grey rectangle', () => {
    const at = code.indexOf('if (!isUnlocked) {');
    const locked = code.slice(at, code.indexOf('return (\n    <Animated.View', at));
    expect(locked).toMatch(/backgroundColor: palette\.bg, borderColor: palette\.border/);
    expect(locked).toMatch(/styles\.shineCircle, \{ backgroundColor: palette\.shine \}/);
    expect(locked).toMatch(/color: palette\.text/);
    // The old grey treatment is gone entirely.
    expect(code).not.toMatch(/cardLocked/);
    expect(code).not.toMatch(/#CCCCCC/);
    expect(code).not.toMatch(/color="#BBBBBB"/);
  });

  it('the six card colours themselves are untouched', () => {
    const palette = read(CHOOSER).slice(read(CHOOSER).indexOf('const PALETTE = ['));
    for (const hex of ['#EAF4FE', '#E8F5ED', '#EDE8FA', '#FEF0E8', '#FEF8E6', '#FDEDF3']) {
      expect(palette).toContain(hex);
    }
  });

  it('the letter stays big — only softened', () => {
    expect(code).toMatch(/styles\.letter, styles\.letterLocked/);
    expect(readCode(CHOOSER)).toMatch(/letterLocked: \{\s*opacity: 0\.55,\s*\}/);
  });

  it('a lock badge sits in the corner, and no stars', () => {
    const at = code.indexOf('if (!isUnlocked) {');
    const locked = code.slice(at, code.indexOf('return (\n    <Animated.View', at));
    expect(locked).toMatch(/styles\.lockBadge/);
    expect(locked).toMatch(/name="lock-closed"/);
    expect(locked).not.toMatch(/starsRow|⭐/);
    expect(locked).not.toMatch(/progressBadge/);
  });

  it('§8 it cannot be pressed, and shows no popup', () => {
    const at = code.indexOf('if (!isUnlocked) {');
    const locked = code.slice(at, code.indexOf('return (\n    <Animated.View', at));
    expect(locked).not.toMatch(/TouchableOpacity|onPress/);
    expect(locked).not.toMatch(/show\(|Alert/);
    // And the press handler itself still refuses a locked letter.
    expect(code).toMatch(/if \(!isUnlocked\) return;/);
  });

  it('§7 it announces itself as a disabled button, with no prose on the card', () => {
    const at = code.indexOf('if (!isUnlocked) {');
    const locked = code.slice(at, code.indexOf('return (\n    <Animated.View', at));
    expect(locked).toMatch(/accessibilityRole="button"/);
    expect(locked).toMatch(/accessibilityLabel=\{`Letter \$\{letter\} locked`\}/);
    expect(locked).toMatch(/accessibilityState=\{\{ disabled: true \}\}/);
    // No prerequisite sentence rendered inside the card: exactly one <Text>,
    // and it holds the letter.
    expect((locked.match(/<Text/g) || [])).toHaveLength(1);
    expect(locked).toMatch(/>\s*\{letter\}\s*</);
  });

  it('the pulse belongs to cards a child can tap', () => {
    const at = code.indexOf('if (!isUnlocked) {');
    const locked = code.slice(at, code.indexOf('return (\n    <Animated.View', at));
    expect(locked).not.toMatch(/globalPulse/);
  });
});

// ─── §9 the counter ─────────────────────────────────────────────────────

describe('§9 — the counter still counts what it always counted', () => {
  it('it counts letters STARTED, and says so', () => {
    const code = readCode(CHOOSER);
    expect(code).toMatch(/const doneCount\s+= LETTERS\.filter\(l => !!wordProgress\[l\.toLowerCase\(\)\]\)\.length;/);
    expect(code).toMatch(/\$\{doneCount\} \/ \$\{LETTERS\.length\} letters started/);
    // Not rewired to the completion predicate.
    expect(code).not.toMatch(/doneCount[\s\S]{0,80}isWordPracticeLetterCompleted/);
  });
});

// ─── §12 regression ─────────────────────────────────────────────────────

describe('§12 — nothing outside the chooser moved', () => {
  it('the catalogue, word order and filtering are unchanged', () => {
    expect((read('../data/wordData.js').match(/\{ word: '/g) || [])).toHaveLength(154);
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode(CHOOSER)).toMatch(/filterUnfinishedWords\(/);
    expect(readCode(CHOOSER)).toMatch(/navigation\.navigate\('WordWriting', buildWordRouteParams\(\{/);
  });

  it('A–E correctness, audio, hints and feedback are unchanged', () => {
    expect(readCode('../components/word/ExerciseA_WriteFirst.js')).toMatch(/const correct = word\[0\];/);
    expect(readCode('../components/word/wordHintPolicy.js')).toMatch(/WRONG_ANSWERS_BEFORE_HINT = 2/);
    expect(readCode('./wordSpeech.js')).toMatch(/export function spokenWord/);
    expect(readCode('./wordFeedback.js')).toMatch(/spacing_tight: 'Leave a little space'/);
  });

  it('mastery and scoring are unchanged', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });
});
