// One attempt, one message.
//
// The child used to get two at once: the avatar saying "Good try", and a
// separate pill under the canvas saying "Keep even spaces". The advisory is
// now the avatar's message, so there is exactly one thing to read — and when
// the gaps are genuinely too tight it says so, because the detector can now
// prove the direction.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { childFeedbackMessage } from './wordFeedback';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const WRITING = '../screens/handwriting/words/WordWritingScreen.js';
const ACTIVITY = '../screens/handwriting/words/WordActivityScreen.js';
const EX_E = '../components/word/ExerciseE_WriteWord.js';
const AVATAR = '../screens/handwriting/AttemptAvatarFeedback.js';

const layoutService = () =>
  require(path.resolve(__dirname, '../../../auriva-backend/src/services/wordLayoutService.js'));

// ─── the direction the detector can now prove ───────────────────────────

describe('spacing direction — only when it is real', () => {
  const { resolveChildFeedbackAdvisory, resolveSpacingDirection } = layoutService();
  const layout = (ratios, spacingScore = 40) => ({
    status: 'available',
    size_consistency_score: 90,
    spacing_consistency_score: spacingScore,
    spacing_metrics: ratios.map((gap_ratio, i) => ({
      from_index: i, to_index: i + 1, status: 'available', gap_ratio,
    })),
  });

  it('letters bunched together read as tight', () => {
    expect(resolveSpacingDirection(layout([0.5, 0.55, 0.5]))).toBe('tight');
    expect(resolveChildFeedbackAdvisory(layout([0.5, 0.55, 0.5]))).toBe('spacing_tight');
  });

  it('letters spread apart read as wide', () => {
    expect(resolveSpacingDirection(layout([1.6, 1.55, 1.6]))).toBe('wide');
    expect(resolveChildFeedbackAdvisory(layout([1.6, 1.55, 1.6]))).toBe('spacing_wide');
  });

  it('merely uneven gaps claim no direction', () => {
    // Average is close to right; the gaps just vary. Naming a direction here
    // would tell the child to move letters the wrong way half the time.
    expect(resolveSpacingDirection(layout([0.4, 1.7, 0.9]))).toBeNull();
    expect(resolveChildFeedbackAdvisory(layout([0.4, 1.7, 0.9]))).toBe('spacing');
  });

  it('a big average error still yields when the gaps vary more', () => {
    // mean 0.7 (clearly tight) but the spread between gaps is larger still:
    // 0.2, 0.3, then 1.6. The word is not uniformly tight, it is erratic, and
    // "leave a little space" would be wrong for that last gap.
    expect(resolveSpacingDirection(layout([0.2, 0.3, 1.6]))).toBeNull();
    expect(resolveChildFeedbackAdvisory(layout([0.2, 0.3, 1.6]))).toBe('spacing');
  });

  it('a small deviation is not a direction', () => {
    expect(resolveSpacingDirection(layout([1.05, 0.95]))).toBeNull();
    expect(resolveChildFeedbackAdvisory(layout([1.05, 0.95]))).toBe('spacing');
  });

  it('good spacing still says nothing at all', () => {
    expect(resolveChildFeedbackAdvisory(layout([1, 1, 1], 90))).toBeNull();
  });

  it('size still wins, and both still combine', () => {
    const both = { ...layout([0.5, 0.5]), size_consistency_score: 30 };
    expect(resolveChildFeedbackAdvisory(both)).toBe('both');
    const sizeOnly = { ...layout([1, 1], 90), size_consistency_score: 30 };
    expect(resolveChildFeedbackAdvisory(sizeOnly)).toBe('size');
  });

  it('missing or unavailable metrics never invent a direction', () => {
    expect(resolveSpacingDirection({ spacing_metrics: [] })).toBeNull();
    expect(resolveSpacingDirection({})).toBeNull();
    expect(resolveSpacingDirection({
      spacing_metrics: [{ status: 'unavailable' }, { status: 'available', gap_ratio: NaN }],
    })).toBeNull();
    expect(resolveChildFeedbackAdvisory({ status: 'unavailable' })).toBeNull();
  });
});

// ─── the copy ───────────────────────────────────────────────────────────

describe('the message the child reads', () => {
  it('too close asks for a little space', () => {
    expect(childFeedbackMessage('spacing_tight')).toBe('Leave a little space');
  });

  it('too far apart asks for closer letters', () => {
    expect(childFeedbackMessage('spacing_wide')).toBe('Keep letters closer');
  });

  it('no direction falls back to even spaces', () => {
    expect(childFeedbackMessage('spacing')).toBe('Keep even spaces');
  });

  it('every message stays short, English and imperative', () => {
    for (const k of ['size', 'spacing', 'spacing_tight', 'spacing_wide', 'both']) {
      const m = childFeedbackMessage(k);
      expect(m.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(m).not.toMatch(/^Try to /);
      expect(m).not.toMatch(/[.]$/);
      expect(m).not.toMatch(/[඀-෿]/);   // no Sinhala
    }
  });
});

// ─── one feedback, not two ──────────────────────────────────────────────

describe('the advisory is the avatar, not a second thing beside it', () => {
  it('the avatar takes a note and lets it replace the generic line', () => {
    const code = readCode(AVATAR);
    expect(code).toMatch(/function AttemptAvatarFeedback\(\{ avatarKey, passed, attempt, supportLevel, theme, note \}\)/);
    expect(code).toMatch(/const message = note \|\| generic;/);
    // The generic wording is still there for attempts with no advisory.
    expect(code).toMatch(/const generic = passed/);
  });

  it('Word Writing no longer renders a pill', () => {
    const code = readCode(WRITING);
    expect(code).not.toMatch(/layoutFeedbackPill/);
    expect(code).not.toMatch(/layoutFeedbackText/);
    expect(code).toMatch(/note=\{childFeedbackText\}/);
  });

  it('Word Writing shows and clears the advisory with the avatar', () => {
    const code = readCode(WRITING);
    // No dwell of its own any more.
    expect(code).not.toMatch(/childFeedbackTimerRef/);
    expect(code).toMatch(/setChildFeedbackText\(childFeedbackMessage\(saved\?\.child_feedback\)\)/);
    expect(code).toMatch(/setFeedbackData\(null\);\s*setChildFeedbackText\(null\);/);
  });

  it('Exercise E hands its advisory up instead of printing it', () => {
    const code = readCode(EX_E);
    expect(code).toMatch(/onComplete\(true, nextResult\.layoutMessage\)/);
    // Neither of the two places it used to be rendered.
    expect(code).not.toMatch(/layoutHintText/);
    expect(code).not.toMatch(/result\.layoutMessage \? `/);
    expect(code).not.toMatch(/Finish every letter, then try Done again/);
    expect(code).toMatch(/onIncomplete\?\.\(\)/);
  });

  it('the word activity carries the note to the avatar', () => {
    const code = readCode(ACTIVITY);
    expect(code).toMatch(/handleExerciseComplete = useCallback\(async \(wasCorrect, note\) =>/);
    expect(code).toMatch(/setActivityFeedback\(\{ passed: wasCorrect, isWriting: true, note \}\)/);
    expect(code).toMatch(/INCOMPLETE_WORD_FEEDBACK[\s\S]*note: 'Finish every letter'/);
    expect(code).toMatch(/note=\{activityFeedback\.note\}/);
  });

  it('A–D pass no note, so their GIF is untouched', () => {
    for (const rel of ['../components/word/ExerciseA_WriteFirst.js',
                       '../components/word/ExerciseB_CircleImage.js',
                       '../components/word/ExerciseC_FillBlank.js',
                       '../components/word/ExerciseD_SpellWord.js']) {
      const code = readCode(rel);
      expect(code).not.toMatch(/layoutMessage|childFeedbackMessage/);
      expect(code).toMatch(/onComplete\((wrongCount === 0|true)\)/);
    }
  });
});

// ─── regression ─────────────────────────────────────────────────────────

describe('nothing about scoring or pass/fail moved', () => {
  it('the advisory still never decides anything', () => {
    const e = readCode(EX_E);
    const at = e.indexOf('const nextResult');
    expect(e.slice(at, at + 400)).toMatch(/passed:authoritative\.passed/);
    expect(e).toMatch(/if \(!authoritative\.passed\) \{[\s\S]*actionIdRef\.current = null;[\s\S]*onIncomplete\?\.\(\)[\s\S]*return;/);
    expect(readCode(WRITING)).toMatch(/setFeedbackData\(getFeedbackFromScore\(saved\?\.score\)\)/);
  });

  it('the score threshold and layout constants are unchanged', () => {
    const svc = read('../../../auriva-backend/src/services/wordLayoutService.js');
    expect(svc).toMatch(/CHILD_FEEDBACK_SCORE_THRESHOLD = 55/);
    expect(svc).toMatch(/SPACING_CONSISTENCY_SCALE = 110/);
    expect(svc).toMatch(/SPACING_DIRECTION_MIN_DEVIATION = 0\.15/);
  });

  it('A–D feedback, word audio and guide replay still stand', () => {
    expect(readCode(ACTIVITY)).toMatch(/<ResultGifFeedback/);
    expect(readCode(ACTIVITY)).toMatch(/Speech\.speak\(spoken, \{ rate: 0\.75/);
    expect(readCode('./guideReplayCycle.js')).toMatch(/GUIDE_IDLE_REPLAY_MS = 2000/);
  });
});
