// The writing screen does not move while a child draws on it.
//
// ── The jump ────────────────────────────────────────────────────────────
// A writing screen's action row is content-sized, and on Letter, Uppercase and
// Word Writing BOTH its children are conditional:
//
//     {canClearCanvas && <Clear/>}   appears on the FIRST drawn point
//     {hasDrawn && <Next/>}          appears when the finger lifts
//
// So at rest the row was its padding and nothing else. The instant a child
// touched the canvas, Clear appeared and the row grew ~45px. The row sits
// below `mainRow`, which is `flex: 1` and centres its content — so the row
// growing handed the canvas less space and re-centred it INTO that space: the
// whole card jumped upward under the finger, mid-stroke. Lifting the finger
// added Next and moved it again.

import fs from 'fs';
import path from 'path';

import { actionRowMinHeight, ACTION_LABEL_LINE_HEIGHT } from '../constants/writingActionRow';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const LOWER = '../screens/teacher/handwriting/LetterWritingScreen.js';
const UPPER = '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js';
const WORD  = '../screens/teacher/handwriting/words/WordWritingScreen.js';
const EX_E  = '../components/word/ExerciseE_WriteWord.js';

// [file, row style, TALLEST button style, its paddingVertical, its borderWidth,
//  row paddingVertical]
//
// The tallest child is Clear, not Next/Done: its 1.5px border adds 3px, which
// outweighs the 1px of extra padding the other button carries.
const ROWS = [
  [LOWER, 'buttonsRow', 'clearBtn', 12, 1.5, 6],
  [UPPER, 'buttonsRow', 'clearBtn', 12, 1.5, 6],
  [WORD,  'buttonsRow', 'clearBtn', 10, 1.5, 6],
  [EX_E,  'actions',    'clearBtn', 10, 1.5, 0],
];
/** The OTHER button in each row, which must also fit. */
const OTHER = { [LOWER]: ['nextBtn', 13], [UPPER]: ['nextBtn', 13],
                [WORD]: ['nextBtn', 11], [EX_E]: ['doneBtn', 11] };
const CANVASES = [LOWER, UPPER, WORD, EX_E];

/** One StyleSheet entry's body. */
function styleBody(rel, name) {
  const src = readCode(rel);
  const at = src.indexOf(`  ${name}: {`);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf('\n  },', at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
}
const num = (body, prop) => {
  const m = body.match(new RegExp(`${prop}:\\s*([\\d.]+)`));
  return m ? Number(m[1]) : null;
};

// ─── the reservation ────────────────────────────────────────────────────

describe('the action row reserves its height before anything is in it', () => {
  it.each(ROWS)('%s — %s declares a minHeight', (rel, row) => {
    expect(styleBody(rel, row)).toMatch(/minHeight: actionRowMinHeight\(\{/);
  });

  it.each(ROWS)('%s — the reservation is derived from its OWN tallest button',
    (rel, row, button, btnPad, btnBorder, rowPad) => {
      // The button really does have the padding and border assumed.
      expect(num(styleBody(rel, button), 'paddingVertical')).toBe(btnPad);
      expect(num(styleBody(rel, button), 'borderWidth')).toBe(btnBorder);
      expect(num(styleBody(rel, row), 'paddingVertical') ?? 0).toBe(rowPad);
      const body = styleBody(rel, row);
      expect(body).toMatch(new RegExp(`maxButtonPaddingVertical: ${btnPad}`));
      expect(body).toMatch(new RegExp(`maxButtonBorderWidth: ${btnBorder}`));
      if (rowPad > 0) expect(body).toMatch(new RegExp(`rowPaddingVertical: ${rowPad}`));
    });

  it.each(ROWS)('%s — the reserved height covers BOTH buttons',
    (rel, row, button, btnPad, btnBorder, rowPad) => {
      const reserved = actionRowMinHeight({
        maxButtonPaddingVertical: btnPad,
        maxButtonBorderWidth: btnBorder,
        rowPaddingVertical: rowPad,
      });
      const height = (pad, border) =>
        ACTION_LABEL_LINE_HEIGHT + pad * 2 + border * 2 + rowPad * 2;
      // Clear — the taller one.
      expect(reserved).toBeGreaterThanOrEqual(height(btnPad, btnBorder));
      // And the other button, which must fit in the same reservation.
      const [otherName, otherPad] = OTHER[rel];
      expect(num(styleBody(rel, otherName), 'paddingVertical')).toBe(otherPad);
      const otherBorder = num(styleBody(rel, otherName), 'borderWidth') ?? 0;
      expect(reserved).toBeGreaterThanOrEqual(height(otherPad, otherBorder));
    });

  it('the helper is arithmetic, not a table of magic numbers', () => {
    // letter / uppercase, word, exercise E
    expect(actionRowMinHeight({ maxButtonPaddingVertical: 12, maxButtonBorderWidth: 1.5, rowPaddingVertical: 6 })).toBe(61);
    expect(actionRowMinHeight({ maxButtonPaddingVertical: 10, maxButtonBorderWidth: 1.5, rowPaddingVertical: 6 })).toBe(57);
    expect(actionRowMinHeight({ maxButtonPaddingVertical: 10, maxButtonBorderWidth: 1.5 })).toBe(45);
    expect(actionRowMinHeight({ maxButtonPaddingVertical: 13, rowPaddingVertical: 6 })).toBe(60);
    expect(actionRowMinHeight()).toBeNaN();   // a caller must state the padding
  });

  it('space is RESERVED — Clear is still genuinely absent before drawing', () => {
    for (const rel of CANVASES) {
      const code = readCode(rel);
      expect(code).toMatch(/\{canClearCanvas && \(/);
      // No always-rendered placeholder or invisible button took its place.
      expect(code).not.toMatch(/opacity: canClearCanvas \? 1 : 0/);
      expect(code).not.toMatch(/visibility|placeholderBtn/);
    }
    expect(readCode('./canvasDrawingState.js'))
      .toMatch(/if \(strokeHasPoints\(currentPath\)\) return true;/);
  });
});

// ─── nothing else moves on touch ────────────────────────────────────────

describe('no touch handler moves the page', () => {
  it.each(CANVASES)('%s — the responder never writes a layout value', (rel) => {
    const code = readCode(rel);
    const at = code.indexOf('PanResponder.create(');
    expect(at).toBeGreaterThan(-1);
    const responder = code.slice(at, code.indexOf('onPanResponderTerminate', at) + 400);
    expect(responder).not.toMatch(/translateY|marginTop|paddingTop|top:|setHeight|scrollTo/);
    expect(responder).not.toMatch(/LayoutAnimation/);
  });

  it('no writing screen animates layout while drawing', () => {
    for (const rel of CANVASES) {
      expect(readCode(rel)).not.toMatch(/LayoutAnimation/);
    }
  });

  it('the canvas container’s size never depends on drawing state', () => {
    // canvasOuter/canvasCard are fixed to the logical canvas size, and no
    // drawing flag appears in their style objects.
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    expect(styleBodyOf(stage, 'canvasOuter')).toMatch(/height: CANVAS_H/);
    expect(styleBodyOf(stage, 'canvasCard')).toMatch(/height: CANVAS_H/);
    for (const name of ['canvasOuter', 'canvasCard']) {
      expect(styleBodyOf(stage, name)).not.toMatch(/hasDrawn|canClearCanvas|currentPath|allPaths/);
    }
    function styleBodyOf(src, name) {
      const at = src.indexOf(`  ${name}: {`);
      expect(at).toBeGreaterThan(-1);
      return src.slice(at, src.indexOf('\n  },', at));
    }
  });

  it('the feedback overlay floats — it can never reflow the page', () => {
    const avatar = readCode('../screens/teacher/handwriting/AttemptAvatarFeedback.js');
    expect(avatar).toMatch(/overlay: \{\s*position: 'absolute',/);
    expect(avatar).toMatch(/pointerEvents="none"/);
  });

  it('the only touch-driven conditionals live inside the reserved row', () => {
    for (const [rel, row] of ROWS) {
      const code = readCode(rel);
      // Both drawing-state conditionals sit after the row opens.
      const rowAt = code.indexOf(`styles.${row}`);
      expect(rowAt).toBeGreaterThan(-1);
      const clearAt = code.indexOf('{canClearCanvas && (');
      expect(clearAt).toBeGreaterThan(rowAt);
    }
  });

  it('ExerciseE never jumped — its Done button is unconditional', () => {
    const code = readCode(EX_E);
    const at = code.indexOf(`styles.actions`);
    const row = code.slice(at, at + 1400);
    expect(row).toMatch(/\{canClearCanvas && \(/);
    // Done is not behind a drawing flag, so that row always had height. The
    // reservation there is insurance, not a fix.
    expect(row).toMatch(/styles\.doneBtn/);
    expect(row).not.toMatch(/\{hasDrawn && \(\s*<TouchableOpacity[\s\S]{0,200}doneBtn/);
  });
});

// ─── §3 the coordinate fix is byte-identical ────────────────────────────

describe('SENTINEL — the touch mapping is untouched', () => {
  it('the mapper is exactly as the coordinate fix left it', () => {
    const code = readCode('./touchPointSanitize.js');
    expect(code).toMatch(
      /export function mapTouchToCanvas\(\{ pageX, pageY, origin, logical, inset = 0 \}\)/);
    expect(code).toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(code).not.toMatch(/measured/);
  });

  it.each(CANVASES)('%s still takes its origin from measure() page space', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(
      /canvasRef\.current\?\.measure\?\.\(\(_x, _y, _w, _h, pageX, pageY\) => \{[\s\S]*?canvasOriginRef\.current = \{ x: pageX, y: pageY \};/);
    expect(code).toMatch(/pageX: evt\.nativeEvent\.pageX, pageY: evt\.nativeEvent\.pageY/);
    expect(code).toMatch(/inset: CANVAS_BORDER_WIDTH/);
  });

  it('canvas geometry and the rendered stroke are unchanged', () => {
    expect(readCode('../constants/letterCanvasLayout.js'))
      .toMatch(/export const CANVAS_H\s+= Math\.round\(SCREEN_H \* 0\.50\);/);
    expect(readCode('../constants/wordCanvasLayout.js'))
      .toMatch(/export const CANVAS_W = SCREEN_W - COL_L - PAD \* 2;/);
    expect(readCode('./wordExerciseECanvas.js')).toMatch(/const IMAGE_COL_W = 170;/);
    expect(readCode('../components/handwriting/LetterWritingStage.js'))
      .toMatch(/points=\{stroke\.map\(p => `\$\{p\.x\},\$\{p\.y\}`\)\.join\(' '\)\}/);
  });
});

// ─── §8 regression ──────────────────────────────────────────────────────

describe('SENTINEL — §8 behaviour unchanged', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('the writing action row gained ONLY a minHeight', () => {
    for (const [rel, row] of ROWS) {
      const body = styleBody(rel, row);
      expect(body).toMatch(/flexDirection: 'row'/);
      expect(body).toMatch(/alignItems: 'center'/);
      expect(body).toMatch(/gap: 12/);
      expect(body).not.toMatch(/height: |maxHeight|position: 'absolute'/);
    }
  });

  it('attempts, cycles, mastery and scoring are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
  });

  it('feedback, hints and audio are unchanged', () => {
    expect(readCode(LOWER)).toMatch(/const ATTEMPT_FEEDBACK_MS = 2200;/);
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
    expect(readCode('../screens/teacher/handwriting/words/WordActivityScreen.js'))
      .toMatch(/<AttemptAvatarFeedback/);
  });

  it('the reservation module touches nothing but a number', () => {
    const code = readCode('../constants/writingActionRow.js');
    expect(code).not.toMatch(/CANVAS|pageX|origin|navigation|score|mastery|StyleSheet/);
  });
});
