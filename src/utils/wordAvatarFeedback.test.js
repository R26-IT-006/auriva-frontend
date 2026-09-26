// Word practice uses the letter screens' avatar feedback — not a second one.
//
// ── What was there ──────────────────────────────────────────────────────
// Four separate inline verdicts: a coloured pill under the word canvas
// ('Excellent! ✓' / 'Good effort! ✓' / 'Keep going!'), 'Well done!' inside
// Exercise D, and — worst — a raw `Score 72/100` shown to the child in
// Exercise E. Each was its own presentation of the same idea.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { GUIDED_SUPPORT } from './wordWorkflow';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const AVATAR   = '../screens/teacher/handwriting/AttemptAvatarFeedback.js';
const LETTER   = '../screens/teacher/handwriting/LetterWritingScreen.js';
const WORD_W   = '../screens/teacher/handwriting/words/WordWritingScreen.js';
const WORD_A   = '../screens/teacher/handwriting/words/WordActivityScreen.js';
const EX = {
  A: '../components/word/ExerciseA_WriteFirst.js',
  B: '../components/word/ExerciseB_CircleImage.js',
  C: '../components/word/ExerciseC_FillBlank.js',
  D: '../components/word/ExerciseD_SpellWord.js',
  E: '../components/word/ExerciseE_WriteWord.js',
};

// ─── one mechanism, not two ─────────────────────────────────────────────

describe('the SAME component the letter screens use', () => {
  it.each([[WORD_W], [WORD_A]])('%s renders AttemptAvatarFeedback', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/import AttemptAvatarFeedback from '\.\.\/AttemptAvatarFeedback'/);
    expect(code).toMatch(/<AttemptAvatarFeedback/);
    expect(code).toMatch(/avatarKey=\{student\?\.avatar_key\}/);
    expect(code).toMatch(/theme=\{theme\}/);
  });

  it('no second feedback component, avatar asset or animation was created', () => {
    const files = fs.readdirSync(path.resolve(__dirname, '../screens/handwriting'))
      .concat(fs.readdirSync(path.resolve(__dirname, '../components/word')));
    expect(files.filter((f) => /AvatarFeedback|WordFeedbackOverlay/.test(f)))
      .toEqual(['AttemptAvatarFeedback.js']);
    for (const rel of [WORD_W, WORD_A, ...Object.values(EX)]) {
      expect(readCode(rel)).not.toMatch(/AVATAR_MAP|avatar-images/);
    }
  });

  it('the shared component uses the approved short support messages', () => {
    const code = readCode(AVATAR);
    expect(code).toMatch(/PASS_MESSAGES_BY_SUPPORT = \{\s*high:\s+'Great tracing!',/);
    expect(code).toMatch(/medium:\s+'Nice work!'/);
    expect(code).toMatch(/low:\s+'Great writing!'/);
    expect(code).toMatch(/RETRY_MESSAGES_BY_SUPPORT = \{\s*high:\s+'Try again!',/);
    expect(code).toMatch(/medium:\s+'Follow the guide!'/);
    expect(code).toMatch(/low:\s+'Try once more!'/);
    expect(code).toMatch(/\? passMessages\[lookupKey\] \?\? 'Nice work!'/);
    expect(code).toMatch(/: retryMessages\[lookupKey\] \?\? 'Try again!'/);
    expect(code).not.toMatch(/word|Word/);
  });

  it('L — Letter Writing still drives it exactly as before', () => {
    const code = readCode(LETTER);
    expect(code).toMatch(/setAttemptFeedback\(\{ passed: attemptPassed, attempt, supportLevel \}\)/);
    expect(code).toMatch(/const ATTEMPT_FEEDBACK_MS = 2200;/);
    expect(code).toMatch(/attempt=\{attemptFeedback\.attempt\}/);
    expect(code).toMatch(/supportLevel=\{attemptFeedback\.supportLevel\}/);
  });

  it('word practice reuses the same dwell', () => {
    expect(readCode(WORD_A)).toMatch(/const ATTEMPT_FEEDBACK_MS = 2200;/);
  });
});

// ─── §11 E / F — Word Writing ───────────────────────────────────────────

describe('E / F — Word Writing success and retry both use the avatar', () => {
  const code = readCode(WORD_W);

  it('the avatar carries the verdict, keyed by the support just presented', () => {
    expect(code).toMatch(/passed=\{feedbackData\.passed\}/);
    expect(code).toMatch(/supportLevel=\{GUIDED_SUPPORT\[attempt\]\}/);
    // Attempts 1/2/3 are high/medium/low — the same three the letter screens
    // key their wording on, so the words are factually right here too.
    expect(GUIDED_SUPPORT).toEqual({ 1: 'high', 2: 'medium', 3: 'low' });
  });

  it('the verdict BOUNDARY is unchanged — the tick line was already 50', () => {
    // A non-numeric score is no longer treated as a pass: the old client-side
    // estimate always produced a number, the server's may not.
    expect(code).toMatch(/return \{ passed: Number\.isFinite\(score\) && score >= 50 \};/);
  });

  it('G — the old pill no longer renders', () => {
    expect(code).not.toMatch(/styles\.feedbackPill/);
    expect(code).not.toContain('Excellent! ✓');
    expect(code).not.toContain('Good effort! ✓');
    expect(code).not.toContain('Keep going!');
  });

  it('the avatar and a leftover verdict never show together', () => {
    const body = code.slice(code.indexOf('<AttemptAvatarFeedback'));
    expect(body).not.toMatch(/feedbackText|feedbackPill/);
  });

  it('§6 attempts, canvas and Done are untouched', () => {
    expect(code).toMatch(/afterGuidedAttempt\(attempt\)/);
    expect(code).toMatch(/mapTouchToCanvas\(\{/);
    expect(code).toMatch(/submitWordAttempt\(\{student,actionId:submitActionIdRef\.current/);
    // The verdict is the SERVER's score for the submitted attempt. The
    // client-side estimate that used to run on every stroke is gone — see
    // wordWritingFeedbackTiming.test.js.
    expect(code).toMatch(/setFeedbackData\(getFeedbackFromScore\(saved\?\.score\)\)/);
  });
});

// ─── §11 A–D and E via the parent ───────────────────────────────────────

describe('A / B / C / D — a choice result goes to the avatar', () => {
  const code = readCode(WORD_A);

  it('the ONE completion handler presents every exercise’s result', () => {
    // A-D are choices and now take the shared right/wrong GIF; E is
    // handwriting and keeps the themed avatar. One decision point either way.
    expect(code).toMatch(/const isWriting = ex === 'E';/);
    // Phase 4 split the verdict from the persisted status. E still presents
    // its own scored result; A-D present "the answer just given was correct",
    // because reaching completion in a choice activity means exactly that.
    // Deriving the GIF from `wasCorrect` showed wrong.gif to a child who had
    // used the hint and then answered correctly.
    expect(code).toMatch(/showCorrectAnswerFeedback = useCallback/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed, isWriting: false \}\)/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed: wasCorrect, isWriting: true, note \}\)/);
    // Two raise-sites now: this completion verdict, and a wrong ANSWER that
    // does not complete anything. No third.
    expect((code.match(/setActivityFeedback\(\{/g) || []).length).toBe(2);
    expect(code).toMatch(/showChoiceAnswerFeedback\(false\)/);
  });

  it('A correct → positive, A incorrect → encouragement', () => {
    // wasCorrect is the exercise's own verdict; the component maps it.
    expect(readCode(EX.A)).toMatch(/onComplete\(wrongCount === 0\)/);
    expect(code).toMatch(/handleExerciseComplete = useCallback\(async \(wasCorrect, note\) =>/);
    expect(code).toMatch(/const result\s+= wasCorrect \? 'correct' : 'good';/);
  });

  it('the choice activities do not use the avatar at all', () => {
    // A tile choice is right or wrong; the avatar's vocabulary is about how a
    // stroke was formed, which says nothing about a tap.
    expect(code).toMatch(/\{activityFeedback\?\.isWriting && \(/);
    expect(code).toMatch(/<ResultGifFeedback/);
    expect(code).toMatch(/visible=\{Boolean\(activityFeedback\) && !activityFeedback\.isWriting\}/);
  });

  it('D — the redundant in-place completion tick is gone', () => {
    const d = readCode(EX.D);
    expect(d).not.toContain('Well done!');
    expect(d).not.toMatch(/successRow|successLabel|successAnim/);
    expect(d).not.toMatch(/<Ionicons name="checkmark-circle"/);
  });

  it('H / I — correctness and retry behaviour are unchanged', () => {
    for (const [label, rel] of Object.entries(EX)) {
      const ex = readCode(rel);
      expect(label).toBeTruthy();
      expect(ex).not.toMatch(/AttemptAvatarFeedback/);       // the parent presents
      expect(ex).not.toMatch(/ATTEMPT_FEEDBACK_MS/);
    }
    expect(readCode(EX.A)).toMatch(/const isCorrect = letter === correct;/);
    expect(readCode(EX.B)).toMatch(/const isCorrect = opt\.word === word;/);
    expect(readCode(EX.C)).toMatch(/const isCorrect = letter === correct;/);
    // The hint/glow retry affordances are untouched.
    for (const rel of [EX.A, EX.B, EX.C]) expect(readCode(rel)).toMatch(/showHint/);
  });
});

describe('D — Exercise E result reaches the avatar, its canvas does not change', () => {
  const e = readCode(EX.E);

  it('E reports its own pass upward, unchanged', () => {
    expect(e).toMatch(/setDone\(true\); setTimeout\(\(\) => onComplete\(true, nextResult\.layoutMessage\), 500\);/);
  });

  it('§10 the raw score is NO LONGER shown to the child', () => {
    expect(e).not.toMatch(/Score \$\{result\.score\}\/100/);
    expect(e).not.toMatch(/\/100/);
    expect(e).toContain('Try once more');
    expect(e).not.toContain('Finish every letter, then try Done again');
    expect(readCode(WORD_A)).toContain("note: 'Finish every letter'");
  });

  it('no numbers, thresholds or internals leak anywhere in the word flow', () => {
    for (const rel of [WORD_W, WORD_A, ...Object.values(EX)]) {
      const code = readCode(rel);
      expect(code).not.toMatch(/Motor Score|dtw_distance\}|threshold|probability/i);
      expect(code).not.toMatch(/\$\{[a-zA-Z.]*score[a-zA-Z.]*\}\s*\/\s*100/);
    }
  });

  it('§8 its canvas, strokes, touch mapping and scoring are untouched', () => {
    expect(e).toMatch(/mapTouchToCanvas\(\{/);
    expect(e).toMatch(/submitWordAttempt\(\{student,actionId:actionIdRef\.current,word,stage:'practice_exercise_e'/);
    expect(e).toMatch(/canvasOriginRef\.current = \{ x: pageX, y: pageY \}/);
  });
});

// ─── §11 J — progression fires once ─────────────────────────────────────

describe('J — the activity advances exactly once', () => {
  const code = readCode(WORD_A);

  it('a second report during feedback is refused', () => {
    expect(code).toMatch(/if \(saving \|\| advancingRef\.current\) return;/);
    expect(code).toMatch(/advancingRef\.current = true;/);
  });

  it('the guard is released only on the path that stays on the screen', () => {
    // Counted across the WHOLE handler, not sliced from the navigate branch:
    // a release inserted anywhere ABOVE that branch is exactly the bug, and a
    // slice starting at it cannot see one.
    const at = code.indexOf('const handleExerciseComplete');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    expect((handler.match(/advancingRef\.current = false/g) || [])).toHaveLength(1);
    expect(handler).toMatch(/advancingRef\.current = false;\s*animateTransition\(\(\) => setExIdx\(e => e \+ 1\)\);/);
    // And it sits AFTER the feedback, never before the result is shown.
    expect(handler.indexOf('setActivityFeedback({'))
      .toBeLessThan(handler.indexOf('advancingRef.current = false'));
  });

  it('the feedback pause is a single awaited timer, not a parallel one', () => {
    // Choice GIFs, completed E feedback, and incomplete E feedback each own
    // one isolated dwell.
    expect(code).toMatch(/feedbackTimerRef\.current = setTimeout\(resolve, ATTEMPT_FEEDBACK_MS\)/);
    expect(code).toMatch(/wrongTimerRef\.current = setTimeout\([\s\S]*RESULT_GIF_MS/);
    // Still ONE awaited timer in the completion path. The other two belong to
    // non-progressing choice and incomplete-word overlays.
    const at = code.indexOf('const handleExerciseComplete');
    const handler = code.slice(at, code.indexOf('}, [wordIdx', at));
    expect((handler.match(/setTimeout\(/g) || []).length).toBe(1);
    expect((code.match(/setTimeout\(/g) || []).length).toBe(3);
  });

  it('an unmount mid-feedback cannot resolve into a navigate', () => {
    expect(code).toMatch(/clearTimeout\(feedbackTimerRef\.current\);\s*clearTimeout\(wrongTimerRef\.current\);/);
  });

  it('the existing continuation is reused, never duplicated', () => {
    expect(code).toMatch(/const transition = afterExerciseESuccess\(wordIdx, letterWords\.length\)/);
    expect((code.match(/navigation\.replace\('WordWriting'/g) || []).length).toBe(1);
  });
});

// ─── §13 regression ─────────────────────────────────────────────────────

describe('SENTINEL — §13 nothing else changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('K / Phase 1 — completion filtering and persistence are untouched', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode('../screens/teacher/handwriting/words/WordLetterSelectScreen.js'))
      .toMatch(/const selectedWords = filterUnfinishedWords\(/);
    expect(readCode(WORD_A)).toMatch(/saveWordActivity\(\{ student, word: currentWord\.word, activity: ex, status: result \}\)/);
    expect(b('src/services/wordWritingService.js'))
      .toMatch(/if \(input\.stage === 'practice_exercise_e' && result\.passed\) \{/);
  });

  it('the 154-word catalogue and its ordering are untouched', () => {
    expect((read('../data/wordData.js').match(/\{ word: '/g) || []).length).toBe(154);
    expect(readCode('./wordWorkflow.js'))
      .toMatch(/\.sort\(\(a, b\) => getLengthGroup\(a\.word\) - getLengthGroup\(b\.word\)\)/);
  });

  it('the A–E progress dots are untouched — a checklist, not a verdict', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/const cfg\s+= STATUS\[exStatus\?\.\[ex\]\] \?\? STATUS\.pending;/);
    expect(code).toMatch(/label: 'Correct!'/);
    expect(code).toMatch(/label: 'With help'/);
  });

  it('letter mastery, threshold and Motor Score are untouched', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('pre-writing, remediation and worksheets are untouched', () => {
    expect(readCode('./preWritingTransition.js')).toMatch(/index <= 0 \|\| index >= sequence\.length\) return null;/);
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
  });

  it('the permanent task instructions all survive', () => {
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    for (const key of ['CHOOSE_FIRST_LETTER', 'CHOOSE_PICTURE', 'CHOOSE_MISSING_LETTER',
                       'MAKE_WORD', 'WRITE_WORD']) {
      expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS[key]].en.length).toBeGreaterThan(0);
    }
    for (const rel of Object.values(EX)) {
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.en\}/);
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.si\}/);
    }
  });

  it('navigation is unchanged', () => {
    expect(readCode(WORD_A)).toMatch(/const backOrigin = route\.params\?\.originRoute \?\? 'WordLetterSelect';/);
    expect(readCode(WORD_W)).toMatch(/const backOrigin = route\.params\?\.originRoute \?\? 'WordLetterSelect';/);
  });
});
