// Word activities A–E as one visual family, with pictures a child can read.
//
// ── What was inconsistent ───────────────────────────────────────────────
// A, C and D already agreed (pane 240 / frame 212 / image 170). E did not
// (170 / 150 / 130). B's answer grid was capped at maxWidth 320 inside a
// column with roughly 446 to give — four 118px pictures in the most
// image-dependent activity of the five.
//
// ── The double frame ────────────────────────────────────────────────────
// Each exercise drew a tinted 2px square, and WordImageDisplay's emoji
// fallback drew ANOTHER white, shadowed card inside it.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  SUPPORT_IMAGE, SUPPORT_IMAGE_COMPACT, ANSWER_IMAGE, BODY, supportImageFrameStyle,
} from '../components/word/wordActivityLayout';
import { computeExerciseECanvasSize } from './wordExerciseECanvas';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const EX = {
  A: '../components/word/ExerciseA_WriteFirst.js',
  B: '../components/word/ExerciseB_CircleImage.js',
  C: '../components/word/ExerciseC_FillBlank.js',
  D: '../components/word/ExerciseD_SpellWord.js',
  E: '../components/word/ExerciseE_WriteWord.js',
};
const SHARED  = '../components/word/wordActivityLayout.js';
const IMAGE   = '../components/word/WordImageDisplay.js';
const STAGE   = '../components/handwriting/WordWritingStage.js';
const WORD_A  = '../screens/handwriting/words/WordActivityScreen.js';

/** Old values, so a silent revert reads as a failure rather than a pass. */
const OLD = {
  supportImage: 170, supportFrame: 212, supportPane: 240,
  eImage: 130, eFrame: 150,
  answerImage: 118, gridMaxWidth: 320, cellBorder: 3,
};

// ─── §20 A / B — the pictures got bigger ────────────────────────────────

describe('A — A, C and D share one enlarged support picture', () => {
  it.each([[EX.A], [EX.C], [EX.D]])('%s uses the shared spec', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/size=\{SUPPORT_IMAGE\.imageSize\}/);
    expect(code).toMatch(/supportImageFrameStyle\(theme\)/);
    expect(code).toMatch(/width: SUPPORT_IMAGE\.paneWidth,/);
    // The old per-file numbers are gone.
    expect(code).not.toMatch(/size=\{170\}/);
    expect(code).not.toMatch(/width: 212,\s*height: 212,/);
    expect(code).not.toMatch(/width: 240,\s*alignItems/);
  });

  it('the increase is substantial, not cosmetic', () => {
    expect(SUPPORT_IMAGE.imageSize).toBeGreaterThan(OLD.supportImage);
    expect(SUPPORT_IMAGE.imageSize - OLD.supportImage).toBeGreaterThanOrEqual(40);
    expect(SUPPORT_IMAGE.frameSize).toBeGreaterThan(OLD.supportFrame);
    expect(SUPPORT_IMAGE.paneWidth).toBeGreaterThan(OLD.supportPane);
  });

  it('the picture never touches the frame edge', () => {
    expect(SUPPORT_IMAGE.frameSize - SUPPORT_IMAGE.imageSize).toBeGreaterThanOrEqual(16);
    expect(SUPPORT_IMAGE.paneWidth).toBeGreaterThanOrEqual(SUPPORT_IMAGE.frameSize);
    expect(SUPPORT_IMAGE_COMPACT.frameSize - SUPPORT_IMAGE_COMPACT.imageSize)
      .toBeGreaterThanOrEqual(12);
  });

  it('A and C are dimensionally identical — they should look related', () => {
    const a = readCode(EX.A).match(/imagePane: \{[\s\S]*?\},/)[0];
    const c = readCode(EX.C).match(/imagePane: \{[\s\S]*?\},/)[0];
    expect(a).toBe(c);
  });
});

describe('B — the answer pictures are much larger', () => {
  const code = readCode(EX.B);

  it('each answer picture grew meaningfully', () => {
    expect(code).toMatch(/size=\{ANSWER_IMAGE\.imageSize\}/);
    expect(ANSWER_IMAGE.imageSize).toBeGreaterThan(OLD.answerImage);
    expect(ANSWER_IMAGE.imageSize - OLD.answerImage).toBeGreaterThanOrEqual(25);
    expect(code).not.toMatch(/size=\{118\}/);
  });

  it('the grid cap that was holding them back is lifted', () => {
    expect(code).toMatch(/maxWidth: ANSWER_IMAGE\.gridMaxWidth,/);
    expect(ANSWER_IMAGE.gridMaxWidth).toBeGreaterThan(OLD.gridMaxWidth);
    expect(code).not.toMatch(/maxWidth: 320,/);
  });

  it('E — all four still fit two-by-two, with no scrolling', () => {
    const cell = ANSWER_IMAGE.imageSize + ANSWER_IMAGE.cellPadding * 2
      + ANSWER_IMAGE.borderWidth * 2;
    const twoAcross = cell * 2 + ANSWER_IMAGE.gap;
    expect(twoAcross).toBeLessThanOrEqual(ANSWER_IMAGE.gridMaxWidth);
    // Two rows of the same cell, inside the activity card's body.
    expect(cell * 2 + ANSWER_IMAGE.gap).toBeLessThanOrEqual(420);
  });

  it('the gap is still wide enough to prevent a mis-tap', () => {
    expect(ANSWER_IMAGE.gap).toBeGreaterThanOrEqual(14);
  });

  it('the existing selected/correct feedback is preserved', () => {
    expect(code).toMatch(/cellCorrect/);
    expect(code).toMatch(/isHinted/);
    expect(code).toMatch(/showHint/);
  });

  it('no permanent per-card colours were introduced', () => {
    // Every cell shares ONE neutral resting surface. What must not exist is a
    // colour chosen per card — an index or palette lookup, or the screen
    // accent baked into the resting state. (A blanket ban on '#FF' would also
    // outlaw the white this very test requires, so it checks the shape.)
    const cell = code.match(/  cell: \{[\s\S]*?\n  \},/)[0];
    expect(cell).toMatch(/backgroundColor: '#FFFFFF'/);
    expect(cell).toMatch(/borderColor: '#ECEFF3'/);
    expect(cell).not.toMatch(/theme\.button/);
    expect(code).not.toMatch(/CELL_COLORS|PALETTE\[|colou?rs\[(idx|i)\]/);
  });
});

// ─── §20 C — the double grey frame is gone ──────────────────────────────

describe('C — one surface per picture, not two', () => {
  it('the emoji fallback no longer draws a white shadowed card', () => {
    const code = readCode(IMAGE);
    expect(code).toMatch(/emojiBg: \{\s*backgroundColor: 'transparent',/);
    expect(code).not.toMatch(/emojiBg: \{[\s\S]*?shadowOpacity/);
    expect(code).not.toMatch(/emojiBg: \{[\s\S]*?elevation/);
    // The real-image path was always transparent and still is.
    expect(code).toMatch(/img: \{\s*backgroundColor: 'transparent',/);
    expect(code).toMatch(/resizeMode="contain"/);
  });

  it('the outer frame is a hairline, not a heavy border', () => {
    expect(SUPPORT_IMAGE.borderWidth).toBe(1);
    expect(SUPPORT_IMAGE_COMPACT.borderWidth).toBe(1);
    expect(ANSWER_IMAGE.borderWidth).toBeLessThan(OLD.cellBorder);
    for (const rel of [EX.A, EX.C, EX.D, EX.E]) {
      expect(readCode(rel)).not.toMatch(/borderWidth: 2,\s*alignItems: 'center',\s*justifyContent: 'center',\s*\},/);
    }
  });

  it('the surface is a soft tint of the screen colour, never grey', () => {
    const style = supportImageFrameStyle({ button: '#4C6EF5' });
    expect(style.backgroundColor).toBe('#4C6EF50D');
    expect(style.borderColor).toBe('#4C6EF51F');
    expect(style.width).toBe(SUPPORT_IMAGE.frameSize);
    expect(style.borderRadius).toBe(SUPPORT_IMAGE.radius);
  });

  it('a missing theme cannot produce an invalid colour', () => {
    expect(() => supportImageFrameStyle(undefined)).not.toThrow();
    expect(supportImageFrameStyle(null).backgroundColor).toBe('#0000000D');
  });

  it('the per-file frame boxes are gone — one spec, five users', () => {
    for (const rel of [EX.A, EX.C, EX.D, EX.E]) {
      expect(readCode(rel)).toMatch(/import \{[^}]*supportImageFrameStyle[^}]*\} from '\.\/wordActivityLayout'/);
    }
    expect(readCode(SHARED)).toMatch(/export function supportImageFrameStyle/);
  });
});

// ─── §20 G / H / I — geometry is untouched ──────────────────────────────

describe('G / H / I — canvas and reference geometry are untouched', () => {
  it('E’s image column is still the width the canvas is derived from', () => {
    const canvas = readCode('./wordExerciseECanvas.js');
    expect(canvas).toMatch(/const IMAGE_COL_W = 170;/);
    expect(SUPPORT_IMAGE_COMPACT.paneWidth).toBe(170);
    // Widening it would move CANVAS_W and CANVAS_H.
    expect(computeExerciseECanvasSize(1317)).toEqual(
      computeExerciseECanvasSize(1317));
    expect(computeExerciseECanvasSize(1317).width).toBe(560);
  });

  it('E grew its picture WITHIN that column, never the column', () => {
    expect(SUPPORT_IMAGE_COMPACT.imageSize).toBeGreaterThan(OLD.eImage);
    expect(SUPPORT_IMAGE_COMPACT.frameSize).toBeGreaterThan(OLD.eFrame);
    expect(SUPPORT_IMAGE_COMPACT.frameSize).toBeLessThanOrEqual(SUPPORT_IMAGE_COMPACT.paneWidth);
    expect(readCode(EX.E)).toMatch(/width: SUPPORT_IMAGE_COMPACT\.paneWidth,/);
    // It does NOT take the full-size spec.
    expect(readCode(EX.E)).not.toMatch(/SUPPORT_IMAGE\.imageSize/);
  });

  it('E’s canvas, guides, strokes and scoring are unchanged', () => {
    const e = readCode(EX.E);
    expect(e).toMatch(/const \{ width: CANVAS_W, height: CANVAS_H \} = computeExerciseECanvasSize\(SCREEN_W\);/);
    expect(e).toMatch(/const LINE_1 = Math\.round\(CANVAS_H \* 0\.10\);/);
    expect(e).toMatch(/mapTouchToCanvas\(\{/);
    expect(e).toMatch(/stage:'practice_exercise_e'/);
  });

  it('I — WordWriting’s canvas geometry is untouched', () => {
    const layout = readCode('../constants/wordCanvasLayout.js');
    expect(layout).toMatch(/export const COL_L\s+= Math\.round\(SCREEN_W \* 0\.28\);/);
    expect(layout).toMatch(/export const IMG_SIZE = COL_L - 8;/);
    expect(layout).toMatch(/export const CANVAS_W = SCREEN_W - COL_L - PAD \* 2;/);
    // The stage gained a surface, not a size.
    const stage = readCode(STAGE);
    expect(stage).toMatch(/size=\{IMG_SIZE\}/);
    expect(stage).toMatch(/imageCol: \{\s*borderRadius: 28,\s*width: COL_L,/);
    expect(stage).toMatch(/<Svg width=\{CANVAS_W\} height=\{CANVAS_H\}/);
  });
});

// ─── §20 D / E / F — copy, scrolling, correctness ───────────────────────

describe('D / E / F — copy, no scrolling, correctness', () => {
  it('D — every activity keeps its approved bilingual instruction', () => {
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.CHOOSE_FIRST_LETTER])
      .toEqual({ en: 'Choose the first letter', si: 'මුල් අකුර තෝරන්න' });
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.CHOOSE_PICTURE])
      .toEqual({ en: 'Choose the picture', si: 'පින්තූරය තෝරන්න' });
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.CHOOSE_MISSING_LETTER])
      .toEqual({ en: 'Choose the missing letter', si: 'නිවැරදි අකුර තෝරන්න' });
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.MAKE_WORD])
      .toEqual({ en: 'Make the word', si: 'වචනය සාදන්න' });
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.WRITE_WORD])
      .toEqual({ en: 'Write the word', si: 'වචනය ලියන්න' });
    for (const rel of Object.values(EX)) {
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.en\}/);
      expect(readCode(rel)).toMatch(/\{ACTIVITY_INSTRUCTION\.si\}/);
    }
  });

  it('the instruction type sizes are unchanged', () => {
    for (const rel of Object.values(EX)) {
      const code = readCode(rel);
      expect(code).toMatch(/instruction: \{\s*fontSize: 20,/);
      expect(code).toMatch(/instructionSi: \{\s*fontSize: 20,/);
    }
  });

  it('E — no scrolling was introduced anywhere in the activities', () => {
    for (const rel of [...Object.values(EX), WORD_A, SHARED]) {
      const code = readCode(rel);
      expect(code).not.toMatch(/ScrollView|FlatList|horizontal=\{true\}/);
    }
  });

  it('F — the correctness handlers are untouched', () => {
    expect(readCode(EX.A)).toMatch(/const isCorrect = letter === correct;/);
    expect(readCode(EX.A)).toMatch(/onComplete\(wrongCount === 0\)/);
    expect(readCode(EX.B)).toMatch(/const isCorrect = opt\.word === word;/);
    expect(readCode(EX.C)).toMatch(/const isCorrect = letter === correct;/);
    expect(readCode(EX.D)).toMatch(/else onComplete\(true\);/);
    expect(readCode(EX.E)).toMatch(/setDone\(true\); setTimeout\(\(\) => onComplete\(true, nextResult\.layoutMessage\), 500\);/);
  });

  it('the shared module is presentation only', () => {
    const code = readCode(SHARED);
    expect(code).not.toMatch(/onComplete|isCorrect|score|navigation|client\.|useState/);
  });
});

// ─── §20 J / K / L — the earlier phases still stand ─────────────────────

describe('J / K / L — phases 1 and 2 are intact', () => {
  it('J — Phase 2 avatar feedback still renders, unobscured', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/<AttemptAvatarFeedback/);
    expect(code).toMatch(/const ATTEMPT_FEEDBACK_MS = 2200;/);
    // The overlay is absolute and pointer-transparent, so a larger body
    // cannot capture its taps or push it off-screen.
    const avatar = readCode('../screens/handwriting/AttemptAvatarFeedback.js');
    expect(avatar).toMatch(/position: 'absolute'/);
    expect(avatar).toMatch(/pointerEvents="none"/);
    // Nothing in this phase touched it.
    expect(avatar).not.toMatch(/SUPPORT_IMAGE|ANSWER_IMAGE/);
  });

  it('K — Phase 1 completed-word filtering still stands', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode('../screens/handwriting/words/WordLetterSelectScreen.js'))
      .toMatch(/const selectedWords = filterUnfinishedWords\(/);
  });

  it('L — Back still returns to the word chooser', () => {
    for (const rel of [WORD_A, '../screens/handwriting/words/WordWritingScreen.js']) {
      expect(readCode(rel)).toMatch(/route\.params\?\.originRoute \?\? 'WordLetterSelect'/);
      expect(readCode(rel)).not.toMatch(/useGatedBack\(\(\) => navigation\.goBack\(\)\)/);
    }
  });

  it('the Clear rule and canvasDrawingState are untouched', () => {
    expect(readCode('./canvasDrawingState.js'))
      .toMatch(/if \(strokeHasPoints\(currentPath\)\) return true;/);
    expect(readCode(EX.E)).toMatch(/const canClearCanvas = hasCanvasDrawing\(\{ allPaths, currentPath \}\);/);
    expect(readCode(EX.E)).toMatch(/\{canClearCanvas && \(/);
  });
});

// ─── §22 regression ─────────────────────────────────────────────────────

describe('SENTINEL — §22 logic untouched', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('mastery, threshold, cycles and Motor Score are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
  });

  it('remediation, worksheets and touch mapping are unchanged', () => {
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
  });

  it('en-GB speech and the word catalogue are unchanged', () => {
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
    expect((read('../constants/wordData.js').match(/\{ word: '/g) || []).length).toBe(154);
  });

  it('the word-practice shell is untouched', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/const cfg\s+= STATUS\[exStatus\?\.\[ex\]\] \?\? STATUS\.pending;/);
    expect(code).toMatch(/maxWidth: 780/);
    expect(code).toMatch(/saveWordActivity\(\{ student, word: currentWord\.word, activity: ex, status: result \}\)/);
  });
});
