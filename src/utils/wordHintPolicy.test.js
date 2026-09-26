// Hint is support, not a wrong answer.
//
// ── The bug ─────────────────────────────────────────────────────────────
// A–C reported `onComplete(wrongCount === 0)` and the screen fed that one
// boolean to BOTH the saved status and the feedback GIF. Two wrong answers
// revealed the hint; the child then chose correctly — and saw wrong.gif,
// because the GIF was reporting "solved with help", not "this answer is right".

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  WRONG_ANSWERS_BEFORE_HINT,
  HINT_REVEAL_DELAY_MS,
  isHintUnlocked,
  unlocksHint,
  HINT_COLORS,
} from '../components/word/wordHintPolicy';
import { RESULT_GIF_MS } from '../constants/resultGifFeedback';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const SCREEN = '../screens/teacher/handwriting/words/WordActivityScreen.js';
const EX = {
  A: '../components/word/ExerciseA_WriteFirst.js',
  B: '../components/word/ExerciseB_CircleImage.js',
  C: '../components/word/ExerciseC_FillBlank.js',
  D: '../components/word/ExerciseD_SpellWord.js',
  E: '../components/word/ExerciseE_WriteWord.js',
};
const CHOICE = [['A', EX.A], ['B', EX.B], ['C', EX.C], ['D', EX.D]];

// ─── §26 the policy itself ──────────────────────────────────────────────

describe('§3 / §26 — two wrong ANSWERS unlock the hint', () => {
  it('the threshold is two, and nothing before it', () => {
    expect(WRONG_ANSWERS_BEFORE_HINT).toBe(2);
    expect(isHintUnlocked(0)).toBe(false);
    expect(isHintUnlocked(1)).toBe(false);
    expect(isHintUnlocked(2)).toBe(true);
    expect(isHintUnlocked(3)).toBe(true);
  });

  it('the reveal fires exactly once — on the second wrong answer', () => {
    expect(unlocksHint(1)).toBe(false);
    expect(unlocksHint(2)).toBe(true);
    expect(unlocksHint(3)).toBe(false);   // already unlocked; no second timer
  });

  it('§4 the second wrong answer keeps its own feedback first', () => {
    expect(HINT_REVEAL_DELAY_MS).toBe(RESULT_GIF_MS);
  });
});

// ─── §1 / §2 / §9 verdict vs persistence ────────────────────────────────

describe('§1 / §9 — the GIF reports the answer, the status reports the help', () => {
  const code = readCode(SCREEN);

  it('the completion verdict is no longer derived from the persisted status', () => {
    // The exact shape that produced the bug.
    expect(code).not.toMatch(/setActivityFeedback\(\{ passed: wasCorrect, isWriting \}\)/);
    expect(code).toMatch(/showCorrectAnswerFeedback = useCallback\([\s\S]*showChoiceAnswerFeedback\(true\)/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed, isWriting: false \}\)/);
  });

  it('§8 persistence is untouched — with-help still saves as good', () => {
    expect(code).toMatch(/const result\s+= wasCorrect \? 'correct' : 'good';/);
    expect(code).toMatch(/saveWordActivity\(\{ student, word: currentWord\.word, activity: ex, status: result \}\)/);
    expect(code).toMatch(/setScore\(s => \(\{ correct: s\.correct \+ \(wasCorrect \? 1 : 0\), total: s\.total \+ 1 \}\)\)/);
    // The exercises still report first-try-ness, which is what 'good' means.
    for (const rel of [EX.A, EX.B, EX.C]) {
      expect(readCode(rel)).toMatch(/onComplete\(wrongCount === 0\)/);
    }
  });

  it('E keeps presenting its own scored verdict', () => {
    expect(code).toMatch(/const isWriting = ex === 'E';/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed: wasCorrect, isWriting: true, note \}\)/);
  });
});

// ─── §5 / §26 the wrong-answer channel ──────────────────────────────────

describe('§2 / §5 — a wrong answer shows wrong.gif and completes nothing', () => {
  const code = readCode(SCREEN);

  it('the screen has a verdict-only channel for wrong answers', () => {
    expect(code).toMatch(/const showWrongAnswerFeedback = useCallback\(/);
    expect(code).toMatch(/showChoiceAnswerFeedback\(false\)/);
    expect(code).toMatch(/onWrongAnswer: showWrongAnswerFeedback,/);
  });

  it('it saves nothing, scores nothing and advances nothing', () => {
    const at = code.indexOf('const showChoiceAnswerFeedback');
    const body = code.slice(at, code.indexOf('}, []);', at));
    for (const forbidden of ['saveWordActivity', 'setExStatus', 'setScore',
                             'setExIdx', 'navigation.replace', 'onComplete',
                             'advancingRef.current = true']) {
      expect(body).not.toMatch(new RegExp(forbidden.replace(/[.()]/g, '\\$&')));
    }
    // It stands down while a completion owns the overlay.
    expect(body).toMatch(/if \(advancingRef\.current \|\| answerFeedbackRef\.current\) return Promise\.resolve\(false\);/);
  });

  it('a pending wrong.gif cannot survive into the completion verdict', () => {
    expect(code).toMatch(/if \(isWriting\) \{\s*clearTimeout\(wrongTimerRef\.current\);/);
    expect(code).toMatch(/clearTimeout\(feedbackTimerRef\.current\);\s*clearTimeout\(wrongTimerRef\.current\);/);
  });
});

// ─── §10-§13 per activity ───────────────────────────────────────────────

describe('§10-§13 — every choice activity, same rule', () => {
  it.each(CHOICE)('Activity %s reports a wrong answer and counts only answers', (_n, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/onWrongAnswer\?\.\(\);/);
    // One counter bump, in the wrong branch, and nowhere else.
    expect((code.match(/const next = w \+ 1;/g) || [])).toHaveLength(1);
    expect((code.match(/setWrongCount\(/g) || [])).toHaveLength(1);
  });

  it.each(CHOICE)('Activity %s never calls onComplete from the wrong branch', (_n, rel) => {
    const code = readCode(rel);
    const at = code.indexOf('onWrongAnswer?.();');
    const branch = code.slice(at, at + 400);
    expect(branch).not.toMatch(/onComplete/);
    expect(branch).not.toMatch(/setDone\(true\)/);
  });

  it.each(CHOICE)('Activity %s reveals the hint only after the delay', (_n, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/if \(unlocksHint\(next\)\) \{\s*hintTimerRef\.current = setTimeout\(\(\) => setHintReady\(true\), HINT_REVEAL_DELAY_MS\);/);
    expect(code).toMatch(/isHintUnlocked\(wrongCount\) && hintReady/);
    expect(code).toMatch(/useEffect\(\(\) => \(\) => clearTimeout\(hintTimerRef\.current\), \[\]\)/);
    // The old unguarded threshold is gone.
    expect(code).not.toMatch(/const showHint = wrongCount >= 2;/);
  });

  it.each(CHOICE)('Activity %s never lets the hint touch the counter or a verdict', (_n, rel) => {
    const code = readCode(rel);
    const at = code.indexOf('setHintReady(true)');
    const reveal = code.slice(at - 120, at + 120);
    expect(reveal).not.toMatch(/setWrongCount|onWrongAnswer|onComplete|setActivityFeedback/);
  });

  it('§13 Activity D counts a mis-tapped tile, not every tile tap', () => {
    const code = readCode(EX.D);
    // The wrong event is the existing shake branch — the tap that does not
    // match the letter the word needs next. Correct taps only advance.
    expect(code).toMatch(/if \(demoMode\) return;[\s\S]*const feedbackDone = onWrongAnswer\?\.\(\);/);
    expect(code).toMatch(/if \(tile\.letter === letters\[pos\]\) \{/);
    const at = code.indexOf('if (tile.letter === letters[pos]) {');
    const correctBranch = code.slice(at, code.indexOf('} else {', at));
    expect(correctBranch).not.toMatch(/setWrongCount|onWrongAnswer/);
    // Spelling/tile logic itself is unchanged.
    expect(code).toMatch(/if \(newFilled\.length === letters\.length\) \{/);
    expect(code).toMatch(/onComplete\(wrongCount === 0\);/);
  });

  it('§13 Activity D points at the next needed letter, and only points', () => {
    const code = readCode(EX.D);
    expect(code).toMatch(/const hintedTileIdx = showHint\s*\?\s*tiles\.findIndex\(\(t, i\) => !tileUsed\[i\] && t\.letter === letters\[filled\.length\]\)/);
    const at = code.indexOf('const hintedTileIdx');
    expect(code.slice(at, at + 300)).not.toMatch(/handleTile|onComplete/);
  });

  it('the demo driver never produces a verdict', () => {
    expect(readCode(EX.D)).toMatch(/if \(demoMode\) return;/);
  });
});

// ─── §15-§21 hint UI ────────────────────────────────────────────────────

describe('§15-§21 — the hint reads as support, not as a warning', () => {
  it('the palette is mint and teal', () => {
    expect(HINT_COLORS).toEqual({ surface: '#E6F7F4', border: '#0E8C80', text: '#0B5F57' });
  });

  it.each(CHOICE)('Activity %s dropped the yellow/orange treatment', (_n, rel) => {
    const code = readCode(rel);
    for (const old of ['#FFF176', '#F9A825', '#E65100', '#FFB300', '#FFF9C4']) {
      expect(code).not.toContain(old);
    }
  });

  it.each([['A', EX.A], ['C', EX.C]])('Activity %s hints through the shared tokens', (_n, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/isHinted\s+\? HINT_COLORS\.surface/);
    expect(code).toMatch(/: isHinted \? HINT_COLORS\.border/);
    expect(code).toMatch(/hintText:\s+\{ color: HINT_COLORS\.text \}/);
  });

  it('Activity B hints through the shared tokens', () => {
    expect(readCode(EX.B)).toMatch(/cellHint: \{\s*borderColor: HINT_COLORS\.border,\s*backgroundColor: HINT_COLORS\.surface,\s*\}/);
  });

  it('§21 the hint adds no motion of its own', () => {
    for (const [, rel] of CHOICE) {
      const code = readCode(rel);
      // The reveal statement itself, not its neighbours in handlePress.
      const at = code.indexOf('if (unlocksHint(next))');
      const reveal = code.slice(at, code.indexOf('return next;', at));
      expect(reveal).not.toMatch(/Animated\.|pulse|flash|shake|bounce|glow/i);
      // And no new looping motion was introduced anywhere for the hint.
      const loops = code.match(/Animated\.loop\(/g) || [];
      expect(loops.length).toBe(rel.endsWith('ExerciseD_SpellWord.js') ? 1 : 0);
    }
  });

  it('§24 hinting changes colour only — never a dimension', () => {
    // Nothing in the hint tokens can affect layout.
    expect(Object.keys(HINT_COLORS)).toEqual(['surface', 'border', 'text']);
    const tokens = readCode('../components/word/wordHintPolicy.js');
    for (const dim of ['width', 'height', 'padding', 'margin', 'borderWidth', 'borderRadius']) {
      expect(tokens).not.toMatch(new RegExp(dim));
    }
    // And the per-activity styles keep their fixed geometry.
    expect(readCode(EX.A)).toMatch(/tile: \{\s*width: 68,\s*height: 68,\s*borderRadius: 16,\s*borderWidth: 2,/);
    expect(readCode(EX.D)).toMatch(/tile: \{\s*width: 62,\s*height: 62,\s*borderRadius: 14,\s*borderWidth: 2,\s*borderBottomWidth: 5,/);
    expect(readCode(EX.B)).toMatch(/borderWidth: ANSWER_IMAGE\.borderWidth,/);
  });

  it('§22 every option is a labelled button, and the hinted one says why', () => {
    for (const [, rel] of CHOICE) {
      const code = readCode(rel);
      expect(code).toMatch(/accessibilityRole="button"/);
      expect(code).toMatch(/accessibilityLabel=\{/);
      expect(code).toMatch(/accessibilityHint=\{isHinted \? 'Hint: /);
    }
    // Touch targets: 68 (A/C), 62 (D), and B's cell is the answer image at 150+.
    expect(readCode(EX.A)).toMatch(/width: 68,\s*height: 68,/);
    expect(readCode(EX.D)).toMatch(/width: 62,\s*height: 62,/);
    const { ANSWER_IMAGE } = require('../components/word/wordActivityLayout');
    expect(ANSWER_IMAGE.imageSize).toBeGreaterThanOrEqual(44);
  });
});

// ─── §23 / §25 / §30 regression ─────────────────────────────────────────

describe('§25 / §30 — everything else stands', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('§25 Activity E was not touched', () => {
    const code = readCode(EX.E);
    expect(code).not.toMatch(/onWrongAnswer/);
    expect(code).not.toMatch(/HINT_COLORS|isHintUnlocked/);
    expect(code).not.toMatch(/ResultGifFeedback/);
    expect(code).toMatch(/submitWordAttempt|hasCanvasDrawing/);
  });

  it('§23 the GIF is still a non-reflowing overlay', () => {
    const gif = readCode('../components/feedback/ResultGifFeedback.js');
    expect(gif).toMatch(/position: 'absolute'/);
    expect(gif).toMatch(/pointerEvents="none"/);
    expect(readCode(SCREEN)).toMatch(/visible=\{Boolean\(activityFeedback\) && !activityFeedback\.isWriting\}/);
  });

  it('A–D correctness and answer sets are unchanged', () => {
    expect(readCode(EX.A)).toMatch(/const correct = word\[0\];/);
    expect(readCode(EX.B)).toMatch(/const isCorrect = opt\.word === word;/);
    expect(readCode(EX.C)).toMatch(/getBlankInfo\(word\)/);
    expect(readCode(EX.D)).toMatch(/function buildTiles\(word\)/);
  });

  it('progress semantics, filtering, audio and guide replay are unchanged', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode(SCREEN)).toMatch(/Speech\.speak\(spoken, \{ rate: 0\.75/);
    expect(readCode('./guideReplayCycle.js')).toMatch(/GUIDE_IDLE_REPLAY_MS = 2000/);
  });

  it('canvas, touch mapping, navigation, mastery and Motor Score are unchanged', () => {
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(readCode(SCREEN)).toMatch(/\?\? 'WordLetterSelect'/);
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('Word Writing and Concept feedback are unchanged', () => {
    expect(readCode('../screens/teacher/handwriting/words/WordWritingScreen.js'))
      .toMatch(/<AttemptAvatarFeedback/);
    expect(readCode('../screens/teacher/concept/tier1/ConceptActivityScreen.js'))
      .toMatch(/<ResultGifFeedback/);
  });
});
