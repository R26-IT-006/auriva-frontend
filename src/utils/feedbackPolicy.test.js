// Two feedback mechanisms, kept apart on purpose.
//
//   HANDWRITING   the child's own themed avatar (AttemptAvatarFeedback)
//   CHOICES       the shared correct.gif / wrong.gif (ResultGifFeedback)
//
// A written attempt is judged on how it was formed; a tap is right or wrong.
// Word activity E lives beside A–D but is handwriting, so it keeps the avatar.
//
// ── The timing bug ──────────────────────────────────────────────────────
// Word Writing showed its avatar from an effect on [hasDrawn]: the instant the
// child lifted their finger from the FIRST stroke it scored the canvas
// locally and delivered a verdict — mid-attempt, from a client-side estimate,
// before anything had been submitted.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

// The component imports react-native and expo-image, which the pure-node test
// config cannot load — the numbers live in their own module for exactly that
// reason, and the markup is asserted from source below.
import { RESULT_GIF_MS, RESULT_GIF_OFFSCREEN } from '../constants/resultGifFeedback';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const GIF    = '../components/feedback/ResultGifFeedback.js';
const LOWER  = '../screens/teacher/handwriting/LetterWritingScreen.js';
const UPPER  = '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js';
const WORD_W = '../screens/teacher/handwriting/words/WordWritingScreen.js';
const WORD_A = '../screens/teacher/handwriting/words/WordActivityScreen.js';
const EX = {
  A: '../components/word/ExerciseA_WriteFirst.js',
  B: '../components/word/ExerciseB_CircleImage.js',
  C: '../components/word/ExerciseC_FillBlank.js',
  D: '../components/word/ExerciseD_SpellWord.js',
  E: '../components/word/ExerciseE_WriteWord.js',
};
const CONCEPT = [
  '../screens/teacher/concept/tier1/ConceptActivityScreen.js',
  '../screens/teacher/concept/tier1/ConceptAdaptiveQuizScreen.js',
  '../screens/teacher/concept/tier1/ConceptMatchScreen.js',
  '../screens/teacher/concept/tier2/Tier2ActivityScreen.js',
  '../screens/teacher/concept/tier2/Tier2DragDropScreen.js',
];

// ─── §19 Word Writing timing ────────────────────────────────────────────

describe('§19 — Word Writing shows its verdict only on submit', () => {
  const code = readCode(WORD_W);

  it('nothing about DRAWING produces feedback any more', () => {
    // Counting RAISE-SITES, not shapes. Rejecting the old effect's exact form
    // is not enough: any new effect that raises a verdict — with hasDrawn in
    // its dependency array rather than its call — is the same bug back, and a
    // shape-matcher cannot see it.
    const raises = code.match(/setFeedbackData\((?!null\))/g) || [];
    expect(raises).toHaveLength(1);

    // ...and that one raise is inside the submit handler.
    const at = code.indexOf('const handleNext');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    expect((handler.match(/setFeedbackData\((?!null\))/g) || [])).toHaveLength(1);

    // The client-side estimate that fed the old one is gone with it.
    expect(code).not.toMatch(/computeWordDTW\(wordGuide\.rawPath/);
    expect(code).not.toMatch(/featuresToScore\(\{ smoothness/);
    expect(code).not.toMatch(/useEffect\(\(\) => \{\s*if \(hasDrawn/);
  });

  it('no effect anywhere on this screen can raise a verdict', () => {
    // Every useEffect body, checked for a raise — whatever it depends on.
    for (const m of code.matchAll(/useEffect\(\(\) =>/g)) {
      const body = code.slice(m.index, code.indexOf('}, [', m.index) + 40);
      expect(body).not.toMatch(/setFeedbackData\((?!null\))/);
    }
  });

  it('the verdict comes from the SUBMITTED attempt’s server score', () => {
    expect(code).toMatch(/setFeedbackData\(getFeedbackFromScore\(saved\?\.score\)\)/);
    expect(code).toMatch(/return \{ passed: Number\.isFinite\(score\) && score >= 50 \};/);
  });

  it('it is set INSIDE the submit handler, after the save', () => {
    const at = code.indexOf('const handleNext');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    expect(handler).toMatch(/submitWordAttempt\(/);
    expect(handler.indexOf('submitWordAttempt('))
      .toBeLessThan(handler.indexOf('setFeedbackData(getFeedbackFromScore'));
    // Shown before the transition, so the child actually sees it.
    expect(handler.indexOf('setFeedbackData(getFeedbackFromScore'))
      .toBeLessThan(handler.indexOf('const transition = afterGuidedAttempt'));
  });

  it('a failed save shows no verdict at all', () => {
    const at = code.indexOf('const handleNext');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    // The catch returns before anything is presented.
    expect(handler).toMatch(/catch \{ setSaveError\([^)]*\); setSubmitting\(false\); return; \}/);
    expect(handler.indexOf('catch { setSaveError'))
      .toBeLessThan(handler.indexOf('setFeedbackData(getFeedbackFromScore'));
  });

  it('every attempt takes the same path — 1, 2 and the last', () => {
    const at = code.indexOf('const handleNext');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    // One presentation, before a branch that distinguishes attempt from done.
    expect((handler.match(/setFeedbackData\(getFeedbackFromScore/g) || [])).toHaveLength(1);
    expect(handler).toMatch(/if \(transition\.type === 'attempt'\)/);
    expect(handler).toMatch(/navigation\.replace\('WordPractice'/);
  });

  it('the dwell is one timer, cleared on unmount', () => {
    expect(code).toMatch(/feedbackTimerRef\.current = setTimeout\(resolve, ATTEMPT_FEEDBACK_MS\)/);
    expect(code).toMatch(/clearTimeout\(feedbackTimerRef\.current\)/);
    expect(code).toMatch(/const ATTEMPT_FEEDBACK_MS = 2200;/);
  });

  it('Word Writing keeps the AVATAR, not a GIF', () => {
    expect(code).toMatch(/<AttemptAvatarFeedback/);
    expect(code).not.toMatch(/ResultGifFeedback/);
  });
});

// ─── §20 Letter Writing, unchanged ──────────────────────────────────────

describe('§20 — Letter Writing already behaved this way', () => {
  it.each([[LOWER], [UPPER]])('%s sets its verdict from the evaluated attempt', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/setAttemptFeedback\(\{ passed: attemptPassed, attempt, supportLevel \}\)/);
    expect(code).toMatch(/<AttemptAvatarFeedback/);
    expect(code).not.toMatch(/ResultGifFeedback/);
  });

  it.each([[LOWER], [UPPER]])('%s never derives feedback from a drawing signal', (rel) => {
    const code = readCode(rel);
    for (const trigger of ['hasDrawn', 'currentPath', 'allPaths', 'canClearCanvas']) {
      expect(code).not.toMatch(new RegExp(`setAttemptFeedback\\([^)]*${trigger}`));
    }
    // Drawing only CLEARS a stale verdict; it never raises one.
    expect(code).toMatch(/setAttemptFeedback\(null\)/);
  });
});

// ─── §21 / §22 word activities ──────────────────────────────────────────

describe('§21 / §22 — A–D use the GIF, E keeps the avatar', () => {
  const code = readCode(WORD_A);

  it('the branch is on the exercise, and only on the exercise', () => {
    expect(code).toMatch(/const isWriting = ex === 'E';/);
    // Phase 4: the GIF reports the ANSWER, the saved status reports the help.
    expect(code).toMatch(/showChoiceAnswerFeedback\(true\)/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed, isWriting: false \}\)/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed: wasCorrect, isWriting: true, note \}\)/);
  });

  it('§22 A–D render the GIF and never the avatar', () => {
    expect(code).toMatch(/<ResultGifFeedback\s*\n\s*visible=\{Boolean\(activityFeedback\) && !activityFeedback\.isWriting\}/);
    expect(code).toMatch(/correct=\{Boolean\(activityFeedback\?\.passed\)\}/);
    expect(code).toMatch(/\{activityFeedback\?\.isWriting && \(/);
  });

  it('§21 E renders the avatar and never the GIF', () => {
    // The avatar is gated on isWriting, which is true only for E.
    const at = code.indexOf('{activityFeedback?.isWriting && (');
    expect(code.slice(at, at + 300)).toMatch(/<AttemptAvatarFeedback/);
    expect(code.slice(at, at + 300)).toMatch(/supportLevel="low"/);
    expect(readCode(EX.E)).not.toMatch(/ResultGifFeedback|correct\.gif|wrong\.gif/);
  });

  it('§9 the GIF decides nothing — wasCorrect is the exercise’s own verdict', () => {
    expect(readCode(EX.A)).toMatch(/onComplete\(wrongCount === 0\)/);
    expect(readCode(EX.B)).toMatch(/const isCorrect = opt\.word === word;/);
    expect(readCode(EX.C)).toMatch(/const isCorrect = letter === correct;/);
    expect(readCode(EX.D)).toMatch(/onComplete\(wrongCount === 0\);/);
    expect(code).toMatch(/const result\s+= wasCorrect \? 'correct' : 'good';/);
    const gif = readCode(GIF);
    expect(gif).not.toMatch(/isCorrect|score|onComplete|===\s*answer/);
  });

  it('no exercise renders feedback of its own', () => {
    for (const rel of Object.values(EX)) {
      const ex = readCode(rel);
      expect(ex).not.toMatch(/ResultGifFeedback|AttemptAvatarFeedback/);
      expect(ex).not.toMatch(/correct\.gif|wrong\.gif/);
    }
  });
});

// ─── §23 concept ────────────────────────────────────────────────────────

describe('§23 — concept uses the SAME shared component', () => {
  it.each(CONCEPT)('%s renders ResultGifFeedback', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/import ResultGifFeedback from '[^']*components\/feedback\/ResultGifFeedback'/);
    expect(code).toMatch(/<ResultGifFeedback/);
  });

  it.each(CONCEPT)('%s no longer holds its own copy of the popup', (rel) => {
    const code = readCode(rel);
    expect(code).not.toMatch(/CORRECT_GIF|WRONG_GIF/);
    expect(code).not.toMatch(/gifPopup|gifImage/);
    expect(code).not.toMatch(/require\([^)]*feedback\/(correct|wrong)\.gif\)/);
  });

  it('each screen drives it from its OWN correctness state', () => {
    // ConceptActivityScreen keeps a { selectedKey, result } object; the other
    // four keep a plain string. Assuming one shape for all five is exactly
    // what left four of them referencing an identifier that does not exist.
    const activity = readCode(CONCEPT[0]);
    expect(activity).toMatch(/correct=\{feedback\?\.result === 'correct'\}/);
    expect(activity).toMatch(/const \[feedback,/);
    for (const rel of CONCEPT.slice(1)) {
      const code = readCode(rel);
      expect(code).toMatch(/correct=\{feedbackResult === 'correct'\}/);
      expect(code).toMatch(/const \[feedbackResult,/);
    }
  });

  it('§16 concept correctness, scoring and TTS are untouched', () => {
    const activity = readCode(CONCEPT[0]);
    expect(activity).toMatch(/const wasCorrect\s+= selectedKey === round\.concept_key;/);
    expect(activity).toMatch(/was_correct:\s+wasCorrect/);
    expect(activity).toMatch(/const FEEDBACK_MS = 1200;/);
    expect(activity).toMatch(/'si-LK'/);
  });

  it('the shared dwell matches what concept always used', () => {
    expect(RESULT_GIF_MS).toBe(1200);
  });
});

// ─── §10 / §11 / §25 the shared component ───────────────────────────────

describe('§10 / §11 / §25 — one component, and it cannot move the page', () => {
  const code = readCode(GIF);

  it('there is exactly ONE place the gifs are required', () => {
    expect(code).toMatch(/require\('\.\.\/\.\.\/\.\.\/assets\/feedback\/correct\.gif'\)/);
    expect(code).toMatch(/require\('\.\.\/\.\.\/\.\.\/assets\/feedback\/wrong\.gif'\)/);
    // Nowhere else.
    const others = [WORD_A, ...Object.values(EX), ...CONCEPT];
    for (const rel of others) {
      expect(readCode(rel)).not.toMatch(/require\([^)]*(correct|wrong)\.gif\)/);
    }
  });

  it('§7 the existing assets are used as-is', () => {
    for (const name of ['correct.gif', 'wrong.gif']) {
      expect(fs.existsSync(path.resolve(__dirname, '../../assets/feedback/', name))).toBe(true);
    }
  });

  it('§25 it takes no layout space and no touches', () => {
    expect(code).toMatch(/popup: \{\s*position: 'absolute',/);
    expect(code).toMatch(/pointerEvents="none"/);
    // Slides on transform, on the native driver — never height/margin/top.
    expect(code).toMatch(/transform: \[\{ translateY: slide \}\]/);
    expect(code).toMatch(/useNativeDriver: true/);
    expect(code).not.toMatch(/height:\s*'|marginTop|paddingTop|LayoutAnimation/);
    expect(RESULT_GIF_OFFSCREEN).toBeGreaterThan(0);
  });

  it('the image keeps its aspect ratio at a fixed size', () => {
    expect(code).toMatch(/contentFit="contain"/);
    expect(code).toMatch(/image: \{\s*width: 200,\s*height: 200,/);
  });

  it('it presents only — it decides nothing', () => {
    expect(code).not.toMatch(/useState|navigation|client\.|score|mastery|onComplete/);
  });
});

// ─── §24 progression ────────────────────────────────────────────────────

describe('§24 — one feedback event, one timer, one continuation', () => {
  it('the word activity uses a single timer whose length depends on the mechanism', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/feedbackTimerRef\.current = setTimeout\(resolve, ATTEMPT_FEEDBACK_MS\)/);
    expect(code).toMatch(/wrongTimerRef\.current = setTimeout\([\s\S]*RESULT_GIF_MS/);
    const at = code.indexOf('const handleExerciseComplete');
    const handler = code.slice(at, code.indexOf('}, [wordIdx', at));
    expect((handler.match(/setTimeout\(/g) || [])).toHaveLength(1);
    // Both timers are cleared on unmount — the awaited one and the wrong-answer one.
    expect(code).toMatch(/clearTimeout\(feedbackTimerRef\.current\);\s*clearTimeout\(wrongTimerRef\.current\);/);
  });

  it('the double-progression guard is still in place', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/if \(saving \|\| advancingRef\.current\) return;/);
    const at = code.indexOf('const handleExerciseComplete');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    expect((handler.match(/advancingRef\.current = false/g) || [])).toHaveLength(1);
    const continuation = code.slice(code.indexOf('const continueFromWordResult'));
    expect((continuation.match(/navigation\.replace\('WordWriting'/g) || [])).toHaveLength(1);
    expect(code).toMatch(/resultContinuingRef\.current = true/);
  });

  it('Word Writing advances once, after its own single dwell', () => {
    const code = readCode(WORD_W);
    const at = code.indexOf('const handleNext');
    const handler = code.slice(at, code.indexOf('\n  }, [', at));
    expect((handler.match(/setTimeout\(resolve, ATTEMPT_FEEDBACK_MS\)/g) || [])).toHaveLength(1);
    expect((handler.match(/navigation\.replace\(/g) || [])).toHaveLength(1);
    expect(handler).toMatch(/if \(submitting \|\| !hasDrawn\) return;/);
  });
});

// ─── §17 / §18 / §26 regression ─────────────────────────────────────────

describe('SENTINEL — §26 nothing else changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('§17 / §18 no duplicate inline verdict survives', () => {
    for (const rel of [WORD_W, WORD_A, ...Object.values(EX)]) {
      const code = readCode(rel);
      for (const banned of ['Excellent! ✓', 'Good effort! ✓', 'Keep going!', 'Well done!']) {
        expect(code).not.toContain(banned);
      }
      expect(code).not.toMatch(/\/100/);           // never a raw score
    }
    expect(readCode(EX.E)).not.toContain('Finish every letter, then try Done again');
    expect(readCode(WORD_A)).toContain("note: 'Finish every letter'");
  });

  it('the permanent instructions all survive', () => {
    for (const rel of Object.values(EX)) {
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.en\}/);
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.si\}/);
    }
  });

  it('Phase 1 (this series) row reservations are intact', () => {
    for (const rel of [LOWER, UPPER, WORD_W, EX.E]) {
      expect(readCode(rel)).toMatch(/minHeight: actionRowMinHeight\(\{/);
    }
  });

  it('completed-word filtering, correctness and progress semantics are unchanged', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode(WORD_A)).toMatch(/saveWordActivity\(\{ student, word: currentWord\.word, activity: ex, status: result \}\)/);
    expect(b('src/services/wordWritingService.js'))
      .toMatch(/if \(input\.stage === 'practice_exercise_e' && result\.passed\) \{/);
  });

  it('mastery, scoring, geometry, navigation and speech are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
    expect(readCode(WORD_A)).toMatch(/\?\? 'WordLetterSelect'/);
  });

  it('A–E dimensions and word images are unchanged', () => {
    const { SUPPORT_IMAGE, ANSWER_IMAGE } = require('../components/word/wordActivityLayout');
    expect(SUPPORT_IMAGE.imageSize).toBe(230);
    expect(ANSWER_IMAGE.imageSize).toBe(150);
    expect(readCode('./wordImageResolver.js')).toMatch(/export function resolveWordImageKey/);
  });
});
