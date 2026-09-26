// Sub-instruction readability.
//
// The bilingual sub-instruction ("Watch and trace" / "බලා අඳින්න" and its
// siblings) was rendered at four different sizes depending on which screen the
// child was on — 10/12 in the letter and word badges, 15/16 in pre-writing,
// 13/18 in the exercises. The Sinhala half was the smaller of the pair every
// time, which is backwards: it is the half a Sinhala-speaking child reads.
//
// One size now, both languages, everywhere. The MAIN target line
// ("Write 'a'" / "Write \"apple\"") is a separate level and is asserted here
// as unchanged.

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

const SUB_FONT_SIZE   = 20;
const SUB_LINE_EN     = 26;
const SUB_LINE_SI     = 28;   // Sinhala vowel signs sit outside the Latin band
const PRE_WRITING_REL = '../screens/teacher/handwriting/PreWritingActivityScreen.js';

// [file, English style, Sinhala style]
const SUB_INSTRUCTIONS = [
  ['../components/handwriting/LetterWritingStage.js', 'attemptTitle',  'attemptHint'],
  ['../components/handwriting/WordWritingStage.js',   'attemptTitle',  'attemptHint'],
  [PRE_WRITING_REL, 'instructionEn', 'instructionSi'],
  ['../components/word/ExerciseA_WriteFirst.js',  'instruction', 'instructionSi'],
  ['../components/word/ExerciseB_CircleImage.js', 'instruction', 'instructionSi'],
  ['../components/word/ExerciseC_FillBlank.js',   'instruction', 'instructionSi'],
  ['../components/word/ExerciseD_SpellWord.js',   'instruction', 'instructionSi'],
  ['../components/word/ExerciseE_WriteWord.js',   'instruction', 'instructionSi'],
];

/**
 * The body of one StyleSheet entry. Sliced by index rather than matched by
 * regex — an earlier sentinel in this repo brace-matched with [^{}]* and
 * silently skipped every style containing a nested object.
 */
function styleBody(src, name) {
  const at = src.indexOf(`  ${name}: {`);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf('\n  },', at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
}

const num = (body, prop) => {
  const m = body.match(new RegExp(`${prop}:\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
};

// ─── the increase ───────────────────────────────────────────────────────

describe('every sub-instruction is one readable size', () => {
  it.each(SUB_INSTRUCTIONS)('%s — English %s is 20px', (rel, en) => {
    const body = styleBody(read(rel), en);
    expect(num(body, 'fontSize')).toBe(SUB_FONT_SIZE);
  });

  it.each(SUB_INSTRUCTIONS)('%s — Sinhala %s is the SAME 20px', (rel, _en, si) => {
    const body = styleBody(read(rel), si);
    expect(num(body, 'fontSize')).toBe(SUB_FONT_SIZE);
  });

  it('English and Sinhala are never sized differently from each other', () => {
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      expect(num(styleBody(src, en), 'fontSize'))
        .toBe(num(styleBody(src, si), 'fontSize'));
    }
  });

  it('no screen is left behind at the old sizes', () => {
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      for (const name of [en, si]) {
        const size = num(styleBody(src, name), 'fontSize');
        expect([10, 12, 13, 15, 16, 18]).not.toContain(size);
        expect(size).toBeGreaterThanOrEqual(18);
        expect(size).toBeLessThanOrEqual(20);
      }
    }
  });

  it('it really is an INCREASE — every one of these grew', () => {
    // What each was before, so a silent revert reads as a failure here.
    const BEFORE = {
      'LetterWritingStage.js':      { en: 12, si: 10 },
      'WordWritingStage.js':        { en: 12, si: 10 },
      'PreWritingActivityScreen.js':{ en: 16, si: 15 },
      'ExerciseA_WriteFirst.js':    { en: 18, si: 13 },
      'ExerciseB_CircleImage.js':   { en: 18, si: 13 },
      'ExerciseC_FillBlank.js':     { en: 18, si: 13 },
      'ExerciseD_SpellWord.js':     { en: 18, si: 13 },
      'ExerciseE_WriteWord.js':     { en: 18, si: 13 },
    };
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      const was = BEFORE[path.basename(rel)];
      expect(num(styleBody(src, en), 'fontSize')).toBeGreaterThan(was.en);
      expect(num(styleBody(src, si), 'fontSize')).toBeGreaterThan(was.si);
    }
  });
});

// ─── leading ────────────────────────────────────────────────────────────

describe('line height leaves room for Sinhala', () => {
  it.each(SUB_INSTRUCTIONS)('%s — English leading is %s', (rel, en) => {
    expect(num(styleBody(read(rel), en), 'lineHeight'))
      .toBe(rel === PRE_WRITING_REL ? 28 : SUB_LINE_EN);
  });

  it.each(SUB_INSTRUCTIONS)('%s — Sinhala gets MORE leading than English', (rel, en, si) => {
    const src = read(rel);
    const siLine = num(styleBody(src, si), 'lineHeight');
    expect(siLine).toBe(rel === PRE_WRITING_REL ? 32 : SUB_LINE_SI);
    expect(siLine).toBeGreaterThan(num(styleBody(src, en), 'lineHeight'));
  });

  it('every sub-instruction declares an explicit leading — none left to auto', () => {
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      for (const name of [en, si]) {
        expect(styleBody(src, name)).toMatch(/lineHeight:/);
      }
    }
  });

  it('other instructions stay in the 26–28 band; Pre-Writing gets collision-safe leading', () => {
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      for (const name of [en, si]) {
        const lh = num(styleBody(src, name), 'lineHeight');
        expect(lh).toBeGreaterThanOrEqual(26);
        expect(lh).toBeLessThanOrEqual(rel === PRE_WRITING_REL ? 32 : 28);
      }
    }
  });
});

// ─── weight ─────────────────────────────────────────────────────────────

describe('weight stays readable while Sinhala may use its system fallback', () => {
  it('English sub-instructions are Bold and Sinhala is SemiBold — not heavier', () => {
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      expect(styleBody(src, en)).toMatch(/fontWeight: '700'/);
      expect(styleBody(src, en)).toMatch(/fontFamily: 'Nunito_700Bold'/);
      expect(styleBody(src, si)).toMatch(/fontWeight: '600'/);
      if (rel === PRE_WRITING_REL) {
        expect(styleBody(src, si)).not.toMatch(/fontFamily:/);
      } else {
        expect(styleBody(src, si)).toMatch(/fontFamily: 'Nunito_600SemiBold'/);
      }
    }
  });

  it('no new font family was introduced', () => {
    for (const [rel] of SUB_INSTRUCTIONS) {
      for (const m of read(rel).matchAll(/fontFamily:\s*'([^']+)'/g)) {
        expect(m[1]).toMatch(/^Nunito_/);
      }
    }
  });

  it('every weight still resolves to its matching face', () => {
    const PAIR = { '600': 'Nunito_600SemiBold', '700': 'Nunito_700Bold' };
    for (const [rel, en, si] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      for (const name of [en, si]) {
        const body = styleBody(src, name);
        const w = body.match(/fontWeight: '(\d+)'/)[1];
        if (rel === PRE_WRITING_REL && name === si) {
          expect(body).not.toMatch(/fontFamily:/);
          continue;
        }
        expect(body).toMatch(new RegExp(`fontFamily: '${PAIR[w]}'`));
      }
    }
  });
});

// ─── the main target must NOT have changed ──────────────────────────────

describe('SENTINEL — the main target line is untouched', () => {
  const LETTER_STAGE = '../components/handwriting/LetterWritingStage.js';
  const WORD_STAGE   = '../components/handwriting/WordWritingStage.js';

  it("Write 'a' / Write 'A' keeps its exact size and weight", () => {
    const body = styleBody(read(LETTER_STAGE), 'writeLabel');
    expect(num(body, 'fontSize')).toBe(26);
    expect(body).toMatch(/fontWeight: '900'/);
    expect(body).toMatch(/fontFamily: 'Nunito_900Black'/);
    expect(body).toMatch(/letterSpacing: 0\.3/);
  });

  it('its Sinhala target line is also unchanged', () => {
    expect(num(styleBody(read(LETTER_STAGE), 'writeLabelSi'), 'fontSize')).toBe(13);
  });

  it('Write "apple" keeps its exact size and weight', () => {
    const body = styleBody(read(WORD_STAGE), 'wordTitle');
    expect(num(body, 'fontSize')).toBe(30);
    expect(body).toMatch(/fontWeight: '900'/);
    expect(body).toMatch(/fontFamily: 'Nunito_900Black'/);
  });

  it('its Sinhala target line is also unchanged', () => {
    expect(num(styleBody(read(WORD_STAGE), 'wordTitleSi'), 'fontSize')).toBe(12);
  });

  it('the target is still visually the larger level', () => {
    expect(num(styleBody(read(LETTER_STAGE), 'writeLabel'), 'fontSize'))
      .toBeGreaterThan(SUB_FONT_SIZE);
    expect(num(styleBody(read(WORD_STAGE), 'wordTitle'), 'fontSize'))
      .toBeGreaterThan(SUB_FONT_SIZE);
  });
});

// ─── nothing else moved ─────────────────────────────────────────────────

describe('SENTINEL — glyphs, geometry and logic untouched', () => {
  it('the reference letter card uses custom a/I and the restored text fallback', () => {
    const source = read('../components/handwriting/LetterWritingStage.js');
    expect(source).toMatch(/letterCardText:/);
    expect(source).toMatch(/LEFT_PREVIEW_SHAPES\[letter\]/);
    expect(source).not.toMatch(/getCanonicalPreviewViewBox/);
  });

  it('the exercise and word glyph styles are untouched', () => {
    for (const [rel, name, size] of [
      ['../components/word/ExerciseA_WriteFirst.js',  'tileText',  null],
      ['../components/word/ExerciseB_CircleImage.js', 'wordText',  null],
      ['../components/word/ExerciseC_FillBlank.js',   'tileText',  null],
    ]) {
      const body = styleBody(read(rel), name);
      expect(body).not.toMatch(/fontFamily/);
      if (size !== null) expect(num(body, 'fontSize')).toBe(size);
    }
  });

  it('reference path and layout constants carry no font styling at all', () => {
    for (const rel of ['../constants/letterCanvasLayout.js', '../data/wordPaths.js',
                       '../constants/activityPreviewLetterPaths.js']) {
      const src = read(rel);
      expect(src).not.toMatch(/fontSize|fontWeight|fontFamily/);
    }
  });

  it('the canvas keeps its own size and border', () => {
    const stage = read('../components/handwriting/LetterWritingStage.js');
    expect(stage).toMatch(/<Svg width=\{CANVAS_W\} height=\{CANVAS_H\}/);
    expect(styleBody(stage, 'canvasCard')).toMatch(/borderWidth: 1\.5/);
    expect(styleBody(stage, 'canvasOuter')).toMatch(/height: CANVAS_H/);
  });

  it('the instruction WORDING is unchanged', () => {
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.WATCH_TRACE]).toEqual({
      en: 'Watch and trace', si: 'බලා අඳින්න',
    });
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH].en).toBe('Follow the path');
  });

  it('scoring, mastery and thresholds are untouched', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('no support, attempt or touch logic sits in a style block', () => {
    for (const [rel] of SUB_INSTRUCTIONS) {
      const src = read(rel);
      const styles = src.slice(src.indexOf('StyleSheet.create'));
      expect(styles).not.toMatch(/supportLevel|attempt\b|mapTouchToCanvas|Speech\./);
    }
  });
});
