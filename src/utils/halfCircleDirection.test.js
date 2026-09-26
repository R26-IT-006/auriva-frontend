// Directional half-circle remediation and its pre-writing presentation.
//
// ── Why "always cw" was wrong ────────────────────────────────────────────
// A stroke id says WHICH primitive a letter uses. For a curve that is half the
// fact: `c` bows one way and `b` the other, and both were warming up with the
// identical arc. Exact-letter remediation that hands two opposite letters the
// same movement is not exact.
//
// ── Where the direction comes from ──────────────────────────────────────
// letterCategories' `strokeVariants`, and every value there is CHECKED here
// against the letter's own reference waypoints: the sign of the curve's
// maximum perpendicular offset from its own chord. Nothing is asserted from a
// description of what a letter looks like.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  STROKE_TYPE_TO_ACTIVITY_ID, REMEDIATION_ACTIVITY_IDS,
  activityIdForStroke, remediationStrokeTypes, buildLetterRemediationActivities,
} from './letterRemediationPlan';
import {
  getLetterStrokeTypes, getLetterStrokeVariants, getAllLetters,
} from '../data/letterCategories';
import { PRE_WRITING_ACTIVITIES } from '../data/preWritingActivities';
import { PRE_WRITING_REASON } from './preWritingSessionGuard';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../constants/childInstructions';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const PRE_WRITING = '../screens/teacher/handwriting/PreWritingActivityScreen.js';

const ALL = () => [...getAllLetters('lowercase'), ...getAllLetters('uppercase')];
const HALF_CIRCLE_LETTERS = () =>
  ALL().filter((e) => (getLetterStrokeTypes(e.letter) ?? []).includes('half_circle'))
       .map((e) => e.letter);
const ids = (letter) => buildLetterRemediationActivities(letter).map((a) => a.id);

// ─── the reference geometry, measured ───────────────────────────────────

/** Extracts one letter's stroke waypoint arrays from a screen's LETTER_PATHS. */
function referenceStrokes(letter) {
  const src = read(letter === letter.toLowerCase()
    ? '../screens/teacher/handwriting/LetterWritingScreen.js'
    : '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js');
  const block = src.slice(src.indexOf('const LETTER_PATHS = {'));
  const at = block.search(new RegExp(`(?:^|[\\s,{])${letter}\\s*:\\s*\\[`, 'm'));
  expect(at).toBeGreaterThan(-1);
  const open = block.indexOf('[', at);
  let depth = 0; let end = open;
  for (let i = open; i < block.length; i += 1) {
    if (block[i] === '[') depth += 1;
    else if (block[i] === ']') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const raw = block.slice(open, end + 1);
  const inner = raw.match(/\[(?:[^[\]]*?\{fx[^[\]]*?)\]/g) || [raw];
  return inner.map((chunk) => [...chunk.matchAll(/fx:\s*([-\d.]+)\s*,\s*fy:\s*([-\d.]+)/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) })));
}

/**
 * Which side of its own chord does this stroke bow?
 * Positive cross product = LEFT of a downward stroke (the c family),
 * negative = RIGHT (the b/p bowl family).
 */
function bowSign(points) {
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return 0;
  let peak = 0;
  for (const p of points) {
    const cross = (dx * (p.y - a.y) - dy * (p.x - a.x)) / chord;
    if (Math.abs(cross) > Math.abs(peak)) peak = cross;
  }
  return peak;
}

/** The most-curved stroke of a letter — its bowl. */
function dominantCurve(letter) {
  const strokes = referenceStrokes(letter).filter((s) => s.length >= 4);
  expect(strokes.length).toBeGreaterThan(0);
  return strokes.reduce((best, s) =>
    Math.abs(bowSign(s)) > Math.abs(bowSign(best)) ? s : best);
}

// Letters whose reference bowl is long and unambiguous enough to measure.
// `e` merges its bowl with the crossbar and `r`'s shoulder is three points
// wide, so their chords are near-horizontal and the sign is not decisive —
// they are asserted for determinism below, not for measured direction.
const MEASURABLE = ['c', 'b', 'p', 'C', 'G', 'D', 'P', 'B', 'R'];

describe('the recorded direction matches the reference geometry', () => {
  it.each(MEASURABLE)('%s', (letter) => {
    const variant = getLetterStrokeVariants(letter)?.half_circle;
    expect(['cap', 'cup']).toContain(variant);
    const sign = bowSign(dominantCurve(letter));
    expect(Math.abs(sign)).toBeGreaterThan(0.15);          // a real bow
    expect(sign > 0 ? 'cap' : 'cup').toBe(variant);
  });

  it('the two families really do bow opposite ways', () => {
    const caps = MEASURABLE.filter((l) => getLetterStrokeVariants(l).half_circle === 'cap');
    const cups = MEASURABLE.filter((l) => getLetterStrokeVariants(l).half_circle === 'cup');
    expect(caps.length).toBeGreaterThan(0);
    expect(cups.length).toBeGreaterThan(0);
    for (const l of caps) expect(bowSign(dominantCurve(l))).toBeGreaterThan(0);
    for (const l of cups) expect(bowSign(dominantCurve(l))).toBeLessThan(0);
  });
});

// ─── §D1-4 direction is applied ─────────────────────────────────────────

describe('half-circle remediation is direction-aware', () => {
  it('is NOT hardcoded to one arc', () => {
    const chosen = new Set(
      HALF_CIRCLE_LETTERS().flatMap((l) => ids(l))
        .filter((id) => id.startsWith('trace_half_circle')));
    expect(chosen).toEqual(new Set(['trace_half_circle_cw', 'trace_half_circle_ccw']));
    expect(readCode('./letterRemediationPlan.js'))
      .not.toMatch(/half_circle:\s*'trace_half_circle_cw'/);
  });

  it('§D2 c gets the cap arc', () => {
    expect(getLetterStrokeVariants('c').half_circle).toBe('cap');
    expect(ids('c')).toEqual(['trace_half_circle_cw']);
  });

  it('§D3 b gets the cup arc, after its vertical stem', () => {
    expect(getLetterStrokeVariants('b').half_circle).toBe('cup');
    expect(ids('b')).toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
  });

  it('THE POINT — c and b no longer receive the same movement', () => {
    const cArc = ids('c').find((i) => i.startsWith('trace_half_circle'));
    const bArc = ids('b').find((i) => i.startsWith('trace_half_circle'));
    expect(cArc).toBeTruthy();
    expect(bArc).toBeTruthy();
    expect(cArc).not.toBe(bArc);
  });

  it('§D4 every half-circle letter resolves deterministically', () => {
    for (const letter of HALF_CIRCLE_LETTERS()) {
      const variant = getLetterStrokeVariants(letter)?.half_circle;
      expect(['cap', 'cup']).toContain(variant);
      const arc = ids(letter).filter((i) => i.startsWith('trace_half_circle'));
      expect(arc).toHaveLength(1);
      expect(arc[0]).toBe(variant === 'cap' ? 'trace_half_circle_cw' : 'trace_half_circle_ccw');
      // Same answer every time.
      expect(ids(letter)).toEqual(ids(letter));
    }
  });

  it('the complete affected-letter table', () => {
    const table = Object.fromEntries(
      HALF_CIRCLE_LETTERS().map((l) => [l, getLetterStrokeVariants(l).half_circle]));
    expect(table).toEqual({
      c: 'cap', e: 'cap', r: 'cap', C: 'cap', G: 'cap',
      b: 'cup', p: 'cup', D: 'cup', P: 'cup', B: 'cup', R: 'cup',
    });
  });

  it('a curve with no recorded direction is skipped, never guessed', () => {
    expect(activityIdForStroke('half_circle', null)).toBeNull();
    expect(activityIdForStroke('half_circle', {})).toBeNull();
    expect(activityIdForStroke('half_circle', { half_circle: 'sideways' })).toBeNull();
    // Non-curves are unaffected by variants.
    expect(activityIdForStroke('vertical_line', null)).toBe('connect_vertical_dots');
  });

  it('the metadata lives WITH the letter, not in a second map', () => {
    const plan = readCode('./letterRemediationPlan.js');
    expect(plan).toMatch(/getLetterStrokeVariants/);
    for (const l of 'bcdepr') expect(plan).not.toMatch(new RegExp(`\\n\\s*${l}:\\s*'c(ap|up)'`));
    const cats = readCode('../data/letterCategories.js');
    expect((cats.match(/strokeVariants: \{ half_circle: '(cap|cup)' \}/g) || [])).toHaveLength(11);
  });

  it('§D5 no new geometry — still the same 18 activities', () => {
    expect(PRE_WRITING_ACTIVITIES).toHaveLength(18);
    expect((read('../data/preWritingActivities.js').match(/generatePoints:/g) || []).length).toBe(18);
    expect(readCode('./letterRemediationPlan.js')).not.toMatch(/generatePoints|arcPoints|Math\.PI/);
    for (const id of REMEDIATION_ACTIVITY_IDS) {
      expect(PRE_WRITING_ACTIVITIES.some((a) => a.id === id)).toBe(true);
    }
  });

  it('§D6 non-half-circle recipes are unchanged', () => {
    expect(remediationStrokeTypes('o')).toEqual(['full_circle']);
    expect(ids('o')).toEqual(['trace_circle']);
    expect(ids('d')).toEqual(['trace_circle', 'connect_vertical_dots']);
    expect(ids('a')).toEqual(['trace_circle', 'connect_vertical_dots']);
    expect(ids('l')).toEqual(['connect_vertical_dots']);
    expect(ids('t')).toEqual(['connect_vertical_dots', 'connect_horizontal_dots']);
    expect(ids('m')).toEqual(['connect_vertical_dots', 'connect_curve_dots']);
    expect(ids('s')).toEqual(['connect_curve_dots']);
    expect(ids('v')).toEqual(['trace_zigzag']);
    expect(ids('w')).toEqual(['trace_zigzag']);
    expect(STROKE_TYPE_TO_ACTIVITY_ID.half_circle).toBeUndefined();
  });

  it('§D11 lowercase and uppercase both resolve', () => {
    expect(ids('C')).toEqual(['trace_half_circle_cw']);
    expect(ids('P')).toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
    expect(ids('R')).toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
    expect(ids('e')).toEqual(['trace_half_circle_cw', 'connect_horizontal_dots']);
  });

  it('the cap is still two activities everywhere', () => {
    for (const e of ALL()) expect(ids(e.letter).length).toBeLessThanOrEqual(2);
  });
});

// ─── Cycle-3 instruction presentation ───────────────────────────────────

describe('the cycle-3 instruction presentation', () => {
  const code = readCode(PRE_WRITING);
  const card = code.slice(code.indexOf('styles.instructionTexts'),
                          code.indexOf('styles.speakerBtn'));

  it('does not render the PRACTISE_FIRST lead-in', () => {
    expect(code).not.toMatch(/REMEDIATION_LEAD_IN|PRACTISE_FIRST|leadInEn|leadInSi/);
    expect(card).not.toMatch(/Let's practise first|මුලින් පුහුණු වෙමු/);
  });

  it('shows only the approved bilingual FOLLOW_PATH instruction', () => {
    expect(card).toMatch(/\{PRE_WRITING_INSTRUCTION\.en\}/);
    expect(card).toMatch(/\{PRE_WRITING_INSTRUCTION\.si\}/);
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH]).toEqual({
      en: 'Follow the path', si: 'රේඛාව දිගේ අඳින්න',
    });
  });

  it('uses the existing centered instruction card without an extra wrapper', () => {
    expect(card).not.toMatch(/Modal|<Card|navigate\(/);
    expect(code).not.toMatch(/navigate\('Remediation|RemediationScreen/);
    expect((code.match(/Modal/g) || []).length)
      .toBe((read(PRE_WRITING).match(/BreakPromptModal/g) || []).length);
    expect(card).toMatch(/PRE_WRITING_INSTRUCTION/);
  });

  it('uses one prerecorded FOLLOW_PATH clip and no second instruction audio', () => {
    expect((code.match(/Speech\.speak\(/g) || []).length).toBe(0);
    expect(code).toMatch(/useInstructionAudio\(INSTRUCTION_KEYS\.FOLLOW_PATH/);
    expect(code).toMatch(/fallbackText:\s*PRE_WRITING_INSTRUCTION\.en/);
    expect((code.match(/useInstructionAudio\(/g) || []).length).toBe(1);
  });

  it('retains the shared PRACTISE_FIRST key without rendering it here', () => {
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.PRACTISE_FIRST]).toEqual({
      en: "Let's practise first", si: 'මුලින් පුහුණු වෙමු',
    });
    expect(PRE_WRITING_REASON.CYCLE_3_REMEDIATION).toBe('cycle_3_remediation');
  });
});

// ─── §D10/§D12 regression ───────────────────────────────────────────────

describe('SENTINEL — cycle, mastery and scoring untouched', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
  const SCREENS = [
    '../screens/teacher/handwriting/LetterWritingScreen.js',
    '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
  ];

  it('the trigger and its policy are unchanged', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      expect(code).toMatch(/if \(used === MAX_CYCLES_PER_LETTER_PER_DATE - 1 && !collectionMode\) \{/);
      expect(code).toMatch(/letterSequence: sequence\.slice\(letterIdx\),/);
    }
  });

  it('§D12 the caps are unchanged', () => {
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('the backend mirror is deliberately NOT carrying direction', () => {
    // Printed worksheets render an undirected row of curves; the mirror maps
    // half_circle -> one library shape and has no arc-direction concept.
    const map = b('src/config/worksheetMotorMap.js');
    expect(map).toMatch(/half_circle:\s+\{ id: 'half_circle'/);
    expect(map).not.toMatch(/strokeVariants|cap|cup/);
    // Its drift test compares strokeTypes only, so the sibling key is safe.
    expect(b('tests/worksheetMotorMap.test.js'))
      .toMatch(/strokeTypes:\s*\\s\*\\\[\(\[\^\\\]\]\*\)\\\]/);
  });

  it('reference paths and canvas mapping are untouched', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel)).toMatch(/const LETTER_PATHS = \{/);
      expect(readCode(rel)).toMatch(/mapTouchToCanvas\(\{/);
    }
    expect(readCode('../utils/touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
  });

  it('the planner still reaches nothing but grouping', () => {
    const plan = readCode('./letterRemediationPlan.js');
    expect(plan).not.toMatch(/mastery|mastered|threshold|score|navigation|client\./i);
  });

  it('Motor Score and DTW are untouched', () => {
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });
});
