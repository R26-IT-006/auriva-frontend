// Back navigation out of a writing flow, and when the Clear button exists.
//
// ── Back ─────────────────────────────────────────────────────────────────
// Every warm-up detour is a PUSH (navigate) followed by a REPLACE on the way
// out, so each one permanently leaves the frame it was pushed over behind it.
// goBack() popped into that stale frame — a previous letter, mid-cycle, from
// before the detour. Popping to a NAMED origin makes the depth irrelevant.
//
// ── Clear ────────────────────────────────────────────────────────────────
// It rendered unconditionally, offering to erase a canvas the child had not
// drawn on. It now follows the canvas, not the session.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { hasCanvasDrawing } from './canvasDrawingState';
import { resolveBackTarget } from './backToOrigin';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const LOWER  = '../screens/teacher/handwriting/LetterWritingScreen.js';
const UPPER  = '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js';
const WORD   = '../screens/teacher/handwriting/words/WordWritingScreen.js';
const WORD_A = '../screens/teacher/handwriting/words/WordActivityScreen.js';

// Every canvas that renders a Clear action.
const CLEAR_CANVASES = [
  LOWER, UPPER, WORD,
  '../screens/teacher/handwriting/PreWritingActivityScreen.js',
  '../screens/teacher/handwriting/ShapeAssessmentScreen.js',
  '../components/word/ExerciseE_WriteWord.js',
];

// ═══ PART A — back navigation ═══════════════════════════════════════════

describe('A / B — letter flows return to the letters interface', () => {
  it.each([[LOWER], [UPPER]])('%s pops to LetterPractice, not one frame', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const backOrigin = route\.params\?\.originRoute \?\? 'LetterPractice';/);
    expect(code).toMatch(/useGatedBack\(\s*\(\) => goBackToOrigin\(navigation, backOrigin\)\s*\)/);
    expect(code).not.toMatch(/useGatedBack\(\(\) => navigation\.goBack\(\)\)/);
  });

  it('the letters interface names itself as the origin', () => {
    expect(readCode('../screens/teacher/handwriting/LetterPracticeScreen.js'))
      .toMatch(/originRoute: 'LetterPractice'/);
  });

  it('lowercase and uppercase both land on the same letters interface', () => {
    // One screen holds both cases, so both flows return to it — and popping
    // (rather than navigating) leaves its picker state as the child left it.
    for (const rel of [LOWER, UPPER]) {
      expect(readCode(rel)).toMatch(/\?\? 'LetterPractice'/);
    }
  });

  it('a stale duplicate frame is popped past, not landed on', () => {
    // [LetterPractice, LetterWriting, LetterWriting] — the shape one category
    // transition leaves behind.
    expect(resolveBackTarget({
      originRoute: 'LetterPractice',
      stackRouteNames: ['LetterPractice', 'LetterWriting', 'LetterWriting'],
      currentIndex: 2,
    })).toEqual({ action: 'popTo', route: 'LetterPractice' });
  });

  it('several detours deep still returns in one step', () => {
    expect(resolveBackTarget({
      originRoute: 'LetterPractice',
      stackRouteNames: ['LetterHome', 'LetterPractice', 'LetterWriting',
                        'LetterWriting', 'LetterWriting', 'LetterWriting'],
      currentIndex: 5,
    })).toEqual({ action: 'popTo', route: 'LetterPractice' });
  });

  it('C / D — the destination does not depend on the letter’s outcome', () => {
    // Nothing in the back path reads mastery, cycles or attempts, so a
    // mastered, unmastered and set-aside letter all resolve identically.
    for (const rel of [LOWER, UPPER]) {
      const code = readCode(rel);
      const at = code.indexOf('const backOrigin');
      const handler = code.slice(at, code.indexOf(');', code.indexOf('useGatedBack', at)));
      expect(handler).not.toMatch(/mastered|cycle|attempt|remediation|score/i);
    }
  });

  it('an entry with no LetterPractice below falls back safely', () => {
    // The assessment and Writing-Check entries push straight into writing.
    expect(resolveBackTarget({
      originRoute: 'LetterPractice',
      stackRouteNames: ['ShapeAssessment', 'LetterWriting'],
      currentIndex: 1,
    })).toEqual({ action: 'goBack' });
  });
});

describe('E / F — word flows return to the word chooser', () => {
  it.each([[WORD], [WORD_A]])('%s pops to WordLetterSelect', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const backOrigin = route\.params\?\.originRoute \?\? 'WordLetterSelect';/);
    expect(code).toMatch(/useGatedBack\(\s*\(\) => goBackToOrigin\(navigation, backOrigin\)\s*\)/);
    expect(code).not.toMatch(/useGatedBack\(\(\) => navigation\.goBack\(\)\)/);
  });

  it('F exercises A–E all live in ONE screen, so none can be backed into', () => {
    const code = readCode(WORD_A);
    for (const ex of ['ExerciseA_WriteFirst', 'ExerciseB_CircleImage', 'ExerciseC_FillBlank',
                      'ExerciseD_SpellWord', 'ExerciseE_WriteWord']) {
      expect(code).toContain(ex);
    }
    // They are rendered, never navigated to.
    expect(code).not.toMatch(/navigate\('Exercise/);
  });

  it('a demo detour’s stale frame is popped past', () => {
    expect(resolveBackTarget({
      originRoute: 'WordLetterSelect',
      stackRouteNames: ['LetterHome', 'WordLetterSelect', 'WordWriting', 'WordPractice'],
      currentIndex: 3,
    })).toEqual({ action: 'popTo', route: 'WordLetterSelect' });
  });

  it('never returns to an old word-writing canvas', () => {
    const target = resolveBackTarget({
      originRoute: 'WordLetterSelect',
      stackRouteNames: ['WordLetterSelect', 'WordWriting', 'WordWriting'],
      currentIndex: 2,
    });
    expect(target.route).toBe('WordLetterSelect');
    expect(target.route).not.toBe('WordWriting');
  });
});

describe('G — hardware back resolves the same way', () => {
  it('useGatedBack wires the hardware button to the SAME handler', () => {
    const hook = readCode('./useGatedBack.js');
    expect(hook).toMatch(/BackHandler\.addEventListener\('hardwareBackPress'/);
    expect(hook).toMatch(/useGatedHardwareBack\(requestBack, !gateVisible\)/);
  });

  it.each([[LOWER], [UPPER], [WORD], [WORD_A]])(
    '%s has exactly one back handler, used by both', (rel) => {
      const code = readCode(rel);
      expect((code.match(/useGatedBack\(/g) || []).length).toBe(1);
      expect(code).toMatch(/onPress=\{requestBack\}/);
      // No second, screen-local hardware listener to diverge from it.
      expect(code).not.toMatch(/BackHandler\.addEventListener/);
    });
});

describe('H — back never replays a warm-up or touches progress', () => {
  it('the back path calls no navigation but goBackToOrigin', () => {
    for (const rel of [LOWER, UPPER, WORD, WORD_A]) {
      const code = readCode(rel);
      const at = code.indexOf('const backOrigin');
      const handler = code.slice(at, code.indexOf('}', code.indexOf('useGatedBack', at)) + 1);
      expect(handler).toMatch(/goBackToOrigin\(navigation, backOrigin\)/);
      expect(handler).not.toMatch(/PreWritingActivity|HandwritingDemo|navigate\(/);
    }
  });

  it('backToOrigin itself only ever pops', () => {
    const code = readCode('./backToOrigin.js');
    expect(code).not.toMatch(/client\.|ENDPOINTS|mastery|cycle|attempt/i);
    expect(code).toMatch(/navigation\.popTo\(target\.route\)/);
  });

  it('resolveBackTarget is pure and total', () => {
    for (const args of [undefined, {}, { originRoute: '' }, { originRoute: 'X' },
                        { originRoute: 'X', stackRouteNames: [] }]) {
      expect(resolveBackTarget(args)).toEqual({ action: 'goBack' });
    }
    // An origin at or above the current screen is not something to pop to.
    expect(resolveBackTarget({
      originRoute: 'LetterWriting', stackRouteNames: ['LetterWriting'], currentIndex: 0,
    })).toEqual({ action: 'goBack' });
  });
});

// ═══ PART B — the Clear button ══════════════════════════════════════════

describe('the Clear button follows the canvas', () => {
  it('an empty canvas has nothing to clear', () => {
    expect(hasCanvasDrawing({ allPaths: [], currentPath: [] })).toBe(false);
    expect(hasCanvasDrawing({})).toBe(false);
    expect(hasCanvasDrawing()).toBe(false);
  });

  it('the FIRST point shows it — before the finger is lifted', () => {
    expect(hasCanvasDrawing({ allPaths: [], currentPath: [{ x: 1, y: 1 }] })).toBe(true);
  });

  it('a completed stroke keeps it', () => {
    expect(hasCanvasDrawing({ allPaths: [[{ x: 1, y: 1 }]], currentPath: [] })).toBe(true);
  });

  it('clearing hides it again', () => {
    const drawn = { allPaths: [[{ x: 1, y: 1 }], [{ x: 2, y: 2 }]], currentPath: [] };
    expect(hasCanvasDrawing(drawn)).toBe(true);
    expect(hasCanvasDrawing({ allPaths: [], currentPath: [] })).toBe(false);
  });

  it('an EMPTY stroke is not drawing', () => {
    expect(hasCanvasDrawing({ allPaths: [[]], currentPath: [] })).toBe(false);
    expect(hasCanvasDrawing({ allPaths: [[], []], currentPath: [] })).toBe(false);
    expect(hasCanvasDrawing({ allPaths: [[], [{ x: 1, y: 1 }]], currentPath: [] })).toBe(true);
  });

  it('malformed state never throws', () => {
    for (const bad of [{ allPaths: null }, { allPaths: 'x' }, { allPaths: [null, undefined] },
                       { currentPath: 'x' }, { allPaths: [{}] }]) {
      expect(() => hasCanvasDrawing(bad)).not.toThrow();
      expect(hasCanvasDrawing(bad)).toBe(false);
    }
  });

  it.each(CLEAR_CANVASES)('%s gates Clear on real stroke data', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const canClearCanvas = hasCanvasDrawing\(\{ allPaths, currentPath \}\);/);
    expect(code).toMatch(/\{canClearCanvas && \(/);
    // The gate wraps the Clear button itself.
    const at = code.indexOf('{canClearCanvas && (');
    expect(code.slice(at, at + 700)).toMatch(/>Clear</);
  });

  it.each(CLEAR_CANVASES)('%s does NOT gate Clear on session state', (rel) => {
    const code = readCode(rel);
    const at = code.indexOf('const canClearCanvas');
    expect(at).toBeGreaterThan(-1);
    const line = code.slice(at, code.indexOf('\n', at));
    // Not the attempt, not a sticky touch flag, not a score or animation.
    expect(line).not.toMatch(/hasDrawn|attempt|score|reduceMotion|tracer|showDone|showNext/);
  });

  it('hasDrawn still exists for what it actually gates', () => {
    // It drives the guide, the tracer and the adaptive recommendation, and is
    // deliberately NOT what Clear reads — §14 keeps those rules untouched.
    for (const rel of [LOWER, UPPER, WORD]) {
      expect(readCode(rel)).toMatch(/const \[hasDrawn,\s+setHasDrawn\]\s+= useState\(false\)/);
    }
  });

  it('the primary action’s own rules are unchanged', () => {
    // Next/Done still appear on hasDrawn, exactly as before.
    expect(readCode(LOWER)).toMatch(/\{hasDrawn && \(/);
    expect(readCode(WORD)).toMatch(/\{hasDrawn && \(/);
    expect(readCode('../components/word/ExerciseE_WriteWord.js'))
      .toMatch(/if \(!hasDrawn \|\| done \|\| submitting\) return;/);
  });

  it('Clear itself resets only drawing state', () => {
    const clear = readCode('../components/word/ExerciseE_WriteWord.js')
      .match(/function handleClear\(\) \{[\s\S]*?\n  \}/)[0];
    expect(clear).toMatch(/setCurrentPath\(\[\]\)/);
    expect(clear).toMatch(/setAllPaths\(\[\]\)/);
    expect(clear).not.toMatch(/setAttempt|setLetterIdx|cycle|mastery|remediation/i);
  });

  it('no screen without a Clear action gained one', () => {
    const withClear = CLEAR_CANVASES.filter((rel) => readCode(rel).includes('>Clear<'));
    expect(withClear).toHaveLength(CLEAR_CANVASES.length);
    // The stages render canvases but never a Clear button — still true.
    for (const rel of ['../components/handwriting/LetterWritingStage.js',
                       '../components/handwriting/WordWritingStage.js']) {
      expect(readCode(rel)).not.toMatch(/canClearCanvas|>Clear</);
    }
  });
});

// ═══ §14 regression ═════════════════════════════════════════════════════

describe('SENTINEL — practice logic untouched', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('cycle, mastery and threshold rules are unchanged', () => {
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('remediation, category transition and the adaptive guard are unchanged', () => {
    for (const rel of [LOWER, UPPER]) {
      const code = readCode(rel);
      expect(code).toMatch(/if \(used === MAX_CYCLES_PER_LETTER_PER_DATE - 1 && !collectionMode\) \{/);
      expect(code).toMatch(/const group\s+= primitiveGroupOnEntering\(sequence, letterIdx \+ 1\);/);
      expect(code).toMatch(/isSessionEntryLetter: letterIdx === 0,/);
    }
  });

  it('touch mapping, geometry and instructions are unchanged', () => {
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect((read('../data/preWritingActivities.js').match(/generatePoints:/g) || []).length).toBe(18);
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH].en).toBe('Follow the path');
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
  });

  it('the two new modules touch nothing but their own concern', () => {
    const drawing = readCode('./canvasDrawingState.js');
    expect(drawing).not.toMatch(/navigation|attempt|cycle|mastery|score|client\./i);
    const back = readCode('./backToOrigin.js');
    expect(back).not.toMatch(/allPaths|currentPath|Clear/);
  });
});
