// Child-facing instruction copy — English + Sinhala.
//
// One primary instruction per activity, from one shared source, so the child
// hears the same sentence for the same task on every screen — and so one
// prerecorded clip per key can later cover every screen that uses it.
//
// What this suite is NOT about: feedback. Pass/retry messages, avatar
// reactions and celebrations are asserted UNCHANGED at the bottom, because the
// copy pass must not have reached them.

import fs from 'fs';
import path from 'path';

import {
  CHILD_INSTRUCTIONS, INSTRUCTION_KEYS, SUPPORT_INSTRUCTION_KEY,
  instructionForSupport, writeLetterInstruction, writeWordInstruction,
} from '../constants/childInstructions';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const K = INSTRUCTION_KEYS;

const PRE_WRITING  = '../screens/handwriting/PreWritingActivityScreen.js';
const LETTER_STAGE = '../components/handwriting/LetterWritingStage.js';
const LOWERCASE    = '../screens/handwriting/LetterWritingScreen.js';
const UPPERCASE    = '../screens/handwriting/uppercase/UppercaseWritingScreen.js';
const WORD_STAGE   = '../components/handwriting/WordWritingStage.js';
const WORD_SCREEN  = '../screens/handwriting/words/WordWritingScreen.js';
const DEMO         = '../screens/handwriting/HandwritingDemoScreen.js';

const EX = {
  A: '../components/word/ExerciseA_WriteFirst.js',
  B: '../components/word/ExerciseB_CircleImage.js',
  C: '../components/word/ExerciseC_FillBlank.js',
  D: '../components/word/ExerciseD_SpellWord.js',
  E: '../components/word/ExerciseE_WriteWord.js',
};

// ─── the approved copy, exactly ─────────────────────────────────────────

describe('the approved bilingual copy', () => {
  it.each([
    [K.FOLLOW_PATH,           'Follow the path',           'රේඛාව දිගේ අඳින්න'],
    [K.WATCH_TRACE,           'Watch and trace',           'බලා අඳින්න'],
    [K.FOLLOW_GUIDE,          'Follow the guide',          'සලකුණු අනුව අඳින්න'],
    [K.WRITE_BY_YOURSELF,     'Write by yourself',         'තනියම ලියන්න'],
    [K.CHOOSE_FIRST_LETTER,   'Choose the first letter',   'මුල් අකුර තෝරන්න'],
    [K.CHOOSE_PICTURE,        'Choose the picture',        'පින්තූරය තෝරන්න'],
    [K.CHOOSE_MISSING_LETTER, 'Choose the missing letter', 'නිවැරදි අකුර තෝරන්න'],
    [K.MAKE_WORD,             'Make the word',             'වචනය සාදන්න'],
    [K.WRITE_WORD,            'Write the word',            'වචනය ලියන්න'],
  ])('%s', (key, en, si) => {
    expect(CHILD_INSTRUCTIONS[key]).toEqual({ en, si });
  });

  it('every key has both languages, and nothing is blank', () => {
    const keys = Object.values(K);
    expect(keys).toHaveLength(10);   // + PRACTISE_FIRST
    expect(Object.keys(CHILD_INSTRUCTIONS).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(CHILD_INSTRUCTIONS[key].en.length).toBeGreaterThan(0);
      expect(CHILD_INSTRUCTIONS[key].si.length).toBeGreaterThan(0);
    }
  });

  it('reads well aloud — no attempt numbers, ampersands, circled digits or slashes', () => {
    for (const { en, si } of Object.values(CHILD_INSTRUCTIONS)) {
      for (const text of [en, si]) {
        expect(text).not.toMatch(/Attempt|&|[①②③]|\//);
        expect(text).not.toMatch(/[.!]$/);      // a label, not an exclamation
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(5);
      }
    }
  });

  it('an unknown support level yields empty strings rather than throwing', () => {
    expect(instructionForSupport('nonsense')).toEqual({ en: '', si: '' });
    expect(() => instructionForSupport(undefined)).not.toThrow();
  });
});

// ─── the case bug ───────────────────────────────────────────────────────

describe('the letter target keeps its own case', () => {
  it('lowercase stays lowercase', () => {
    expect(writeLetterInstruction('a')).toEqual({ en: "Write 'a'", si: "'a' ලියන්න" });
    expect(writeLetterInstruction('c')).toEqual({ en: "Write 'c'", si: "'c' ලියන්න" });
  });

  it('uppercase stays uppercase', () => {
    expect(writeLetterInstruction('A')).toEqual({ en: "Write 'A'", si: "'A' ලියන්න" });
    expect(writeLetterInstruction('C')).toEqual({ en: "Write 'C'", si: "'C' ලියන්න" });
  });

  it('THE BUG — the same letter in two cases must give two different instructions', () => {
    expect(writeLetterInstruction('a').en).not.toBe(writeLetterInstruction('A').en);
    expect(writeLetterInstruction('a').si).not.toBe(writeLetterInstruction('A').si);
  });

  it('the stage no longer forces a case', () => {
    const code = readCode(LETTER_STAGE);
    expect(code).not.toMatch(/Write '\{String\(letter \?\? ''\)\.toUpperCase\(\)\}'/);
    expect(code).not.toMatch(/letter[^\n]*\.toUpperCase\(\)/);
    expect(code).toMatch(/const targetInstruction = writeLetterInstruction\(letter\);/);
  });

  it('the helper itself never touches case', () => {
    const code = readCode('../constants/childInstructions.js');
    const fn = code.slice(code.indexOf('export function writeLetterInstruction'));
    expect(fn.slice(0, 250)).not.toMatch(/toUpperCase|toLowerCase/);
  });

  it('missing or odd input cannot crash a child mid-activity', () => {
    expect(() => writeLetterInstruction(undefined)).not.toThrow();
    expect(writeLetterInstruction(null).en).toBe("Write ''");
    expect(writeWordInstruction(undefined).en).toBe('Write ""');
  });

  it('the word target wraps the word without altering it', () => {
    expect(writeWordInstruction('apple')).toEqual({ en: 'Write "apple"', si: '"apple" ලියන්න' });
    expect(writeWordInstruction('ice-cream').en).toBe('Write "ice-cream"');
  });
});

// ─── pre-writing: one instruction, not two ──────────────────────────────

describe('pre-writing shows ONE primary instruction', () => {
  const code = readCode(PRE_WRITING);

  it('uses FOLLOW_PATH', () => {
    expect(code).toMatch(/const PRE_WRITING_INSTRUCTION = CHILD_INSTRUCTIONS\[INSTRUCTION_KEYS\.FOLLOW_PATH\];/);
    expect(code).toMatch(/\{PRE_WRITING_INSTRUCTION\.en\}/);
    expect(code).toMatch(/\{PRE_WRITING_INSTRUCTION\.si\}/);
  });

  it('the second instruction is gone from the child UI', () => {
    expect(code).not.toMatch(/\{activity\.name\}/);
    expect(code).not.toMatch(/\{activity\.prompt_text\}/);
    // Exactly one EN and one SI line ON SCREEN — not a heading plus a card.
    // (The same constant is also read by the two Speech.speak calls, which is
    // why this counts the rendered JSX rather than every reference.)
    expect((code.match(/\{PRE_WRITING_INSTRUCTION\.en\}/g) || []).length).toBe(1);
    expect((code.match(/\{PRE_WRITING_INSTRUCTION\.si\}/g) || []).length).toBe(1);
  });

  it('but the data keeps both fields — nothing was deleted from the catalogue', () => {
    const cat = read('../constants/preWritingActivities.js');
    expect((cat.match(/prompt_text:/g) || []).length).toBe(18);
    expect((cat.match(/^ {4}name: '/gm) || []).length).toBe(18);
  });

  it('the activity itself is untouched', () => {
    expect(code).toMatch(/generatePoints\(CANVAS_CX, CANVAS_CY, DEFAULT_N_POINTS\)/);
    expect(code).toMatch(/const hasPointerPath = pathPoints\.length > 1;/);
    expect(code).toMatch(/<GuideActivity activity=\{activity\} theme=\{theme\} \/>/);
  });

  it('TTS speaks the new primary instruction, and is otherwise unchanged', () => {
    // Same two calls, same 300ms delay, same speaker button — new text.
    // The British locale was added afterwards; timing and call count are what
    // this asserts, plus that the text is the new primary instruction.
    expect(code).toMatch(/setTimeout\(\(\) => \{ Speech\.speak\(PRE_WRITING_INSTRUCTION\.en, ukSpeechOptions\(\)\); \}, 300\)/);
    expect(code).toMatch(/onPress=\{\(\) => Speech\.speak\(PRE_WRITING_INSTRUCTION\.en, ukSpeechOptions\(\)\)\}/);
    expect((code.match(/Speech\.speak\(/g) || []).length).toBe(2);
    expect(code).not.toMatch(/Speech\.speak\(activity\./);
  });
});

// ─── letter writing ─────────────────────────────────────────────────────

describe('letter writing shows the target and one support instruction', () => {
  it('the support mapping is level -> key, nothing more', () => {
    expect(SUPPORT_INSTRUCTION_KEY).toEqual({
      high: K.WATCH_TRACE, medium: K.FOLLOW_GUIDE, low: K.WRITE_BY_YOURSELF,
    });
    expect(instructionForSupport('high')).toEqual({ en: 'Watch and trace',   si: 'බලා අඳින්න' });
    expect(instructionForSupport('medium')).toEqual({ en: 'Follow the guide', si: 'සලකුණු අනුව අඳින්න' });
    expect(instructionForSupport('low')).toEqual({ en: 'Write by yourself',  si: 'තනියම ලියන්න' });
  });

  it('the stage renders EN above SI, on separate lines', () => {
    const code = readCode(LETTER_STAGE);
    expect(code).toMatch(/\{targetInstruction\.en\}/);
    expect(code).toMatch(/\{targetInstruction\.si\}/);
    expect(code).toMatch(/\{instruction\?\.en\}/);
    expect(code).toMatch(/\{instruction\?\.si\}/);
    // Never concatenated into one line.
    expect(code).not.toMatch(/\.en\}\s*[·|-]\s*\{[^}]*\.si/);
    expect(code.indexOf('targetInstruction.en')).toBeLessThan(code.indexOf('targetInstruction.si'));
    expect(code.indexOf('instruction?.en')).toBeLessThan(code.indexOf('instruction?.si'));
  });

  it.each([[LOWERCASE], [UPPERCASE]])('%s passes the shared instruction', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/instruction=\{instructionForSupport\(supportLevel\)\}/);
    expect(code).toMatch(/import \{ instructionForSupport \} from '[^']*childInstructions'/);
  });

  it.each([[LOWERCASE], [UPPERCASE], [LETTER_STAGE], [WORD_SCREEN], [WORD_STAGE]])(
    '%s shows no visible Attempt 1/2/3 label', (rel) => {
      const code = readCode(rel);
      expect(code).not.toMatch(/'Attempt \d/);
      expect(code).not.toMatch(/`Attempt \$\{attempt\}/);
      expect(code).not.toMatch(/Attempt \d · /);
    });

  it('the long support hints are gone from every screen', () => {
    for (const rel of [LETTER_STAGE, LOWERCASE, UPPERCASE, WORD_SCREEN, WORD_STAGE, DEMO]) {
      const code = readCode(rel);
      expect(code).not.toMatch(/SUPPORT_HINTS|ATTEMPT_HINTS/);
      expect(code).not.toMatch(/Watch the dot|Start at the number|Write from memory/);
      expect(code).not.toMatch(/Listen to the letters|marks where to start/);
    }
  });

  it('lowercase and uppercase share ONE copy source — not two', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      const code = readCode(rel);
      expect(code).not.toMatch(/'Watch and trace'|'Follow the guide'|'Write by yourself'/);
    }
    expect(readCode(LETTER_STAGE)).not.toMatch(/export const SUPPORT_(INSTRUCTIONS|HINTS)/);
  });

  it('the demonstration uses the same shared copy', () => {
    const code = readCode(DEMO);
    expect(code).toMatch(/const DEMO_INSTRUCTION = instructionForSupport\(SUPPORT_LEVELS\.HIGH\);/);
    expect(code).toMatch(/instruction=\{DEMO_INSTRUCTION\}/);
  });
});

// ─── word writing matches letter writing ────────────────────────────────

describe('word writing follows the same structure', () => {
  it('the target is an instruction, in both languages', () => {
    const code = readCode(WORD_STAGE);
    expect(code).toMatch(/const targetInstruction = writeWordInstruction\(displayWord\);/);
    expect(code).toMatch(/\{targetInstruction\.en\}/);
    expect(code).toMatch(/\{targetInstruction\.si\}/);
  });

  it('attempt 1/2/3 map onto the same three support instructions', () => {
    const code = readCode(WORD_SCREEN);
    expect(code).toMatch(/const ATTEMPT_SUPPORT_LEVEL = \{ 1: 'high', 2: 'medium', 3: 'low' \};/);
    expect(code).toMatch(/instruction=\{instructionForSupport\(ATTEMPT_SUPPORT_LEVEL\[attempt\]\)\}/);
    expect(code).not.toMatch(/ATTEMPT_TITLES/);
  });

  it('word and letter writing now say the identical thing per level', () => {
    for (const level of ['high', 'medium', 'low']) {
      expect(instructionForSupport(level)).toBe(instructionForSupport(level));
    }
    // One object, one source — a screen cannot reword it locally.
    expect(Object.isFrozen(CHILD_INSTRUCTIONS)).toBe(true);
  });
});

// ─── word activities A–E ────────────────────────────────────────────────

describe('word activities A–E', () => {
  it.each([
    ['A', EX.A, 'CHOOSE_FIRST_LETTER',   'Choose the first letter',   'මුල් අකුර තෝරන්න'],
    ['B', EX.B, 'CHOOSE_PICTURE',        'Choose the picture',        'පින්තූරය තෝරන්න'],
    ['C', EX.C, 'CHOOSE_MISSING_LETTER', 'Choose the missing letter', 'නිවැරදි අකුර තෝරන්න'],
    ['D', EX.D, 'MAKE_WORD',             'Make the word',             'වචනය සාදන්න'],
    ['E', EX.E, 'WRITE_WORD',            'Write the word',            'වචනය ලියන්න'],
  ])('activity %s uses %s exactly', (_label, rel, key, en, si) => {
    const code = readCode(rel);
    expect(code).toMatch(new RegExp(`CHILD_INSTRUCTIONS\\[INSTRUCTION_KEYS\\.${key}\\]`));
    expect(code).toMatch(/\{ACTIVITY_INSTRUCTION\.en\}/);
    expect(code).toMatch(/\{ACTIVITY_INSTRUCTION\.si\}/);
    expect(CHILD_INSTRUCTIONS[key]).toEqual({ en, si });
  });

  it.each(Object.entries(EX))('%s carries no leftover hardcoded instruction', (_l, rel) => {
    const code = readCode(rel);
    for (const old of ['Tap the missing first letter', 'Find the picture for this word',
                       'Fill in the missing letter', 'Spell the word!']) {
      expect(code).not.toContain(old);
    }
  });

  it('B no longer shows a SECOND instruction — but keeps its glow', () => {
    const code = readCode(EX.B);
    expect(code).not.toMatch(/Tap the glowing picture/);
    expect(code).not.toMatch(/styles\.hintLabel/);
    // The visual cue and everything driving it are untouched.
    expect(code).toMatch(/showHint/);
    expect(code).toMatch(/isHinted/);
  });

  it('exactly one EN and one SI instruction per activity', () => {
    for (const rel of Object.values(EX)) {
      const code = readCode(rel);
      expect((code.match(/ACTIVITY_INSTRUCTION\.en/g) || []).length).toBe(1);
      expect((code.match(/ACTIVITY_INSTRUCTION\.si/g) || []).length).toBe(1);
    }
  });

  it('tile-selection and canvas behaviour are untouched', () => {
    expect(readCode(EX.A)).toMatch(/onPress=\{\(\) => handlePress\(letter, idx\)\}/);
    expect(readCode(EX.B)).toMatch(/onPress=\{\(\) => handlePress\(opt, idx\)\}/);
    expect(readCode(EX.C)).toMatch(/onPress=\{\(\) => handlePress\(letter, idx\)\}/);
    expect(readCode(EX.E)).toMatch(/mapTouchToCanvas\(\{/);
  });
});

// ─── nothing but copy moved ─────────────────────────────────────────────

describe('SENTINEL — feedback, flow, logic, geometry and layout unchanged', () => {
  it('feedback messages are untouched', () => {
    const feedback = readCode('../screens/handwriting/AttemptAvatarFeedback.js');
    expect(feedback).not.toMatch(/childInstructions|CHILD_INSTRUCTIONS|ACTIVITY_INSTRUCTION/);
    for (const [rel, marker] of [
      [LOWERCASE,   /PASS_MESSAGES|RETRY_MESSAGES|attemptFeedback/],
      [UPPERCASE,   /PASS_MESSAGES|RETRY_MESSAGES|attemptFeedback/],
      // Word writing names its feedback state differently — it has no
      // PASS_/RETRY_ tables of its own.
      [WORD_SCREEN, /setFeedbackData|feedbackData/],
    ]) {
      expect(readCode(rel)).toMatch(marker);
    }
  });

  it('the instruction module knows nothing about feedback or scoring', () => {
    const code = readCode('../constants/childInstructions.js');
    expect(code).not.toMatch(/PASS_|RETRY_|celebrat|score|mastery|threshold/i);
  });

  it('support levels, guide opacity and the tracer still decide themselves', () => {
    const code = readCode(LETTER_STAGE);
    expect(code).toMatch(/supportPresentation\?\.showAnimatedTracer/);
    expect(code).toMatch(/supportPresentation\?\.showStartMarker/);
    expect(code).toMatch(/guideOpacity > 0 && rawPath/);
    // The level is still chosen by the support engine, never by copy.
    expect(readCode('../constants/handwritingSupportLevels.js'))
      .not.toMatch(/childInstructions/);
  });

  it('the attempt number still drives everything it did before', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      const code = readCode(rel);
      expect(code).toMatch(/SUPPORT_BADGE/);
      expect(code).toMatch(/\[1, 2, 3\]\.map\(n => \(/);          // attempt dots
      expect(code).toMatch(/n === attempt/);
    }
  });

  it('reference paths and canvas geometry are untouched', () => {
    const stage = readCode(LETTER_STAGE);
    expect(stage).toMatch(/<Svg width=\{CANVAS_W\} height=\{CANVAS_H\}/);
    expect(stage).toMatch(/d=\{isAngular \? toStraightPath\(rawPath\) : toSmoothPath\(rawPath\)\}/);
    expect(stage).not.toMatch(/viewBox|preserveAspectRatio/);
    for (const rel of ['../constants/wordPaths.js', '../constants/letterCanvasLayout.js']) {
      expect(readCode(rel)).not.toMatch(/childInstructions/);
    }
  });

  it('the MAIN TARGET sizes are unchanged', () => {
    // The copy pass did not resize anything. The sub-instruction slots were
    // enlarged later, deliberately and separately — subInstructionSize.test.js
    // owns those numbers, so they are not duplicated here.
    expect(readCode(LETTER_STAGE)).toMatch(/writeLabel: \{\s*fontSize: 26,/);
    expect(readCode(LETTER_STAGE)).toMatch(/writeLabelSi: \{\s*fontSize: 13,/);
    expect(readCode(WORD_STAGE)).toMatch(/wordTitle: \{\s*fontSize: 30,/);
    expect(readCode(WORD_STAGE)).toMatch(/wordTitleSi: \{\s*fontSize: 12,/);
  });

  it('every Sinhala line pairs its weight with a real Nunito face', () => {
    // The app has no Sinhala face loaded — see the report. What this asserts is
    // only that the module-wide weight/family rule was not broken.
    for (const rel of [LETTER_STAGE, WORD_STAGE, PRE_WRITING, ...Object.values(EX)]) {
      const code = readCode(rel);
      for (const m of code.matchAll(/(\w*[Ss]i): \{([^}]*)\}/g)) {
        if (/fontWeight/.test(m[2])) expect(m[2]).toMatch(/fontFamily/);
      }
    }
  });

  it('scoring, mastery and thresholds are untouched', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('NO AUDIO was added — this is text only', () => {
    const code = readCode('../constants/childInstructions.js');
    expect(code).not.toMatch(/require\(|\.mp3|\.m4a|Audio\.|Sound|playAsync/);
  });
});
