// Exact-letter remediation before cycle 3.
//
// A child who fails TWO cycles on the same letter gets a short motor warm-up
// built from that letter's OWN strokeTypes, then cycle 3 begins normally.
//
// The two things this must never become: a fourth cycle, or a second copy of
// the 52-letter decomposition.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  STROKE_TYPE_TO_ACTIVITY_ID, MAX_REMEDIATION_ACTIVITIES,
  remediationStrokeTypes, buildLetterRemediationActivities,
} from './letterRemediationPlan';
import { getLetterStrokeTypes, getAllLetters } from '../constants/letterCategories';
import { PRE_WRITING_ACTIVITIES } from '../constants/preWritingActivities';
import {
  PRE_WRITING_REASON, makeRemediationKey, hasRemediationHandled,
  markRemediationHandled, hasWarmupHandled, markWarmupHandled,
  resetPreWritingGuardStore,
} from './preWritingSessionGuard';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../constants/childInstructions';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const LOWERCASE = '../screens/handwriting/LetterWritingScreen.js';
const UPPERCASE = '../screens/handwriting/uppercase/UppercaseWritingScreen.js';
const SCREENS = [LOWERCASE, UPPERCASE];

/**
 * The remediation branch only. Anchored on CODE, never on comments —
 * readCode() strips those, so a comment anchor silently returns -1 and the
 * slice runs to the end of the file, swallowing the category-transition
 * block that legitimately uses slice(letterIdx + 1).
 */
function remediationBranch(rel) {
  const code = readCode(rel);
  const start = code.indexOf('if (used === MAX_CYCLES_PER_LETTER_PER_DATE - 1');
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf('setAttempt(1);', start);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

const ids = (letter) => buildLetterRemediationActivities(letter).map((a) => a.id);

beforeEach(() => resetPreWritingGuardStore());

// ─── §19 the recipes, against the REAL source data ──────────────────────

describe('recipes come from the letter’s own strokeTypes', () => {
  it.each([
    ['c', ['half_circle']],
    ['b', ['vertical_line', 'half_circle']],
    ['o', ['full_circle']],
    ['d', ['full_circle', 'vertical_line']],
    ['a', ['full_circle', 'vertical_line']],
    ['e', ['half_circle', 'horizontal_line']],
    ['l', ['vertical_line']],
    ['t', ['vertical_line', 'horizontal_line']],
    ['v', ['zigzag']],
    ['w', ['zigzag']],                                   // zigzag,zigzag -> one
    ['m', ['vertical_line', 'curve_wave']],              // vl,cw,cw -> two
    ['s', ['curve_wave']],
  ])('%s -> %s', (letter, expected) => {
    expect(remediationStrokeTypes(letter)).toEqual(expected);
  });

  it('every recipe is a prefix of the letter’s real strokeTypes, de-duplicated', () => {
    for (const entry of [...getAllLetters('lowercase'), ...getAllLetters('uppercase')]) {
      const real = getLetterStrokeTypes(entry.letter);
      const plan = remediationStrokeTypes(entry.letter);
      const dedup = [...new Set(real)].slice(0, MAX_REMEDIATION_ACTIVITIES);
      expect(plan).toEqual(dedup);
    }
  });

  it('there is no second 52-letter map in the frontend', () => {
    const plan = readCode('./letterRemediationPlan.js');
    expect(plan).toMatch(/import \{ getLetterStrokeTypes, getLetterStrokeVariants \} from '\.\.\/constants\/letterCategories'/);
    // Five static rows plus the two directional half-circle arcs — not
    // fifty-two. half_circle resolves through the letter's own variant.
    expect(Object.keys(STROKE_TYPE_TO_ACTIVITY_ID)).toHaveLength(5);
    for (const l of 'abcdefghijklmnopqrstuvwxyz') {
      expect(plan).not.toMatch(new RegExp(`\\n\\s*${l}:\\s*\\[`));
    }
  });

  it('the accessor reads the catalogue rather than duplicating it', () => {
    const cats = readCode('../constants/letterCategories.js');
    expect(cats).toMatch(/export function getLetterStrokeTypes\(letter\)/);
    expect(getLetterStrokeTypes('a')).toEqual(['full_circle', 'vertical_line']);
    expect(getLetterStrokeTypes('A')).toEqual(['zigzag', 'horizontal_line']);   // never symmetric
    expect(getLetterStrokeTypes('?')).toBeNull();
    // A caller cannot mutate the source.
    const first = getLetterStrokeTypes('a');
    first.push('nonsense');
    expect(getLetterStrokeTypes('a')).toEqual(['full_circle', 'vertical_line']);
  });
});

// ─── §4/§6/§7/§8 the mapping and its limits ─────────────────────────────

describe('the stroke -> activity mapping', () => {
  it('every stroke id resolves to an activity that already exists', () => {
    for (const [strokeType, activityId] of Object.entries(STROKE_TYPE_TO_ACTIVITY_ID)) {
      const activity = PRE_WRITING_ACTIVITIES.find((a) => a.id === activityId);
      expect(activity).toBeDefined();
      expect(typeof activity.target_shape.generatePoints).toBe('function');
      expect(strokeType).toBeTruthy();
    }
  });

  it('is exactly the five direction-free rows', () => {
    // half_circle is deliberately absent: a curve without its direction is an
    // incomplete instruction, so it resolves per letter — see
    // halfCircleDirection.test.js.
    expect(STROKE_TYPE_TO_ACTIVITY_ID).toEqual({
      vertical_line:   'connect_vertical_dots',
      horizontal_line: 'connect_horizontal_dots',
      full_circle:     'trace_circle',
      zigzag:          'trace_zigzag',
      curve_wave:      'connect_curve_dots',
    });
  });

  it('half_circle uses the project’s CANONICAL arc — the one the assessment scores', () => {
    const activities = read('../constants/preWritingActivities.js');
    const cw = activities.slice(activities.indexOf("id: 'trace_half_circle_cw'"));
    expect(cw.slice(0, 400)).toContain('arcPoints(cx, cy, 150, Math.PI, 2 * Math.PI, n)');
    // Byte-identical sweep to unifiedShapeScoreMirror's half_circle template.
    const mirror = read('./unifiedShapeScoreMirror.js');
    expect(mirror).toContain('const a = Math.PI + (i / nPoints) * Math.PI;');
  });

  it('NO new geometry was added', () => {
    const plan = readCode('./letterRemediationPlan.js');
    expect(plan).not.toMatch(/generatePoints|arcPoints|straightLine|Math\.PI|target_shape:/);
    // The catalogue still holds exactly its 18 activities.
    expect(PRE_WRITING_ACTIVITIES).toHaveLength(18);
    expect((read('../constants/preWritingActivities.js').match(/generatePoints:/g) || []).length).toBe(18);
  });

  it('no size ladder — generatePoints still takes no scale', () => {
    const activities = read('../constants/preWritingActivities.js');
    expect(activities).not.toMatch(/generatePoints: \([^)]*scale/);
    expect(readCode('./letterRemediationPlan.js')).not.toMatch(/large|medium|small|scale/i);
  });

  it('never more than two activities, for any letter in either case', () => {
    for (const entry of [...getAllLetters('lowercase'), ...getAllLetters('uppercase')]) {
      expect(ids(entry.letter).length).toBeLessThanOrEqual(MAX_REMEDIATION_ACTIVITIES);
    }
    expect(MAX_REMEDIATION_ACTIVITIES).toBe(2);
  });

  it('§7 uppercase R — three distinct strokes, truncated to the first two in source order', () => {
    expect(getLetterStrokeTypes('R')).toEqual(['vertical_line', 'half_circle', 'zigzag']);
    expect(remediationStrokeTypes('R')).toEqual(['vertical_line', 'half_circle']);
    expect(ids('R')).toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
  });

  it('R is the ONLY letter that needed truncating', () => {
    const over = [...getAllLetters('lowercase'), ...getAllLetters('uppercase')]
      .filter((e) => new Set(getLetterStrokeTypes(e.letter)).size > MAX_REMEDIATION_ACTIVITIES)
      .map((e) => e.letter);
    expect(over).toEqual(['R']);
  });

  it('an unknown letter yields nothing rather than a default', () => {
    expect(remediationStrokeTypes('7')).toEqual([]);
    expect(buildLetterRemediationActivities(undefined)).toEqual([]);
    expect(buildLetterRemediationActivities('')).toEqual([]);
  });

  it('the built activities are the real catalogue objects, in stroke order', () => {
    expect(ids('b')).toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
    expect(ids('d')).toEqual(['trace_circle', 'connect_vertical_dots']);
    expect(ids('m')).toEqual(['connect_vertical_dots', 'connect_curve_dots']);
    expect(ids('o')).toEqual(['trace_circle']);
    for (const a of buildLetterRemediationActivities('b')) {
      expect(PRE_WRITING_ACTIVITIES).toContain(a);
    }
  });
});

// ─── §10/§17 the guard ──────────────────────────────────────────────────

describe('replay prevention and trigger separation', () => {
  const who = { studentId: 51, caseType: 'lowercase', letter: 'c', interactionId: 'int-1' };

  it('the fourth reason exists alongside the other three', () => {
    expect(PRE_WRITING_REASON.CYCLE_3_REMEDIATION).toBe('cycle_3_remediation');
    expect(Object.keys(PRE_WRITING_REASON)).toHaveLength(4);
  });

  it('marking once suppresses a replay of the SAME remediation', () => {
    expect(hasRemediationHandled({ ...who, cycleNumber: 3 })).toBe(false);
    expect(markRemediationHandled({ ...who, cycleNumber: 3 })).toBe(true);
    expect(hasRemediationHandled({ ...who, cycleNumber: 3 })).toBe(true);
  });

  it('§17 a CATEGORY warm-up on the same letter must NOT suppress remediation', () => {
    markWarmupHandled({ ...who, reason: PRE_WRITING_REASON.CATEGORY_TRANSITION });
    expect(hasWarmupHandled(who)).toBe(true);
    // The child still earned this after two failed cycles.
    expect(hasRemediationHandled({ ...who, cycleNumber: 3 })).toBe(false);
  });

  it('remediation DOES stand the adaptive detour down, so no double warm-up', () => {
    markRemediationHandled({ ...who, cycleNumber: 3 });
    expect(hasWarmupHandled(who)).toBe(true);
  });

  it('the key separates student, case, letter, interaction and cycle', () => {
    const base = makeRemediationKey({ ...who, cycleNumber: 3 });
    expect(base).toContain('cycle_3_remediation');
    for (const differs of [
      { studentId: 52 }, { caseType: 'uppercase', letter: 'C' },
      { letter: 'o' }, { interactionId: 'int-2' }, { cycleNumber: 2 },
    ]) {
      expect(makeRemediationKey({ ...who, cycleNumber: 3, ...differs })).not.toBe(base);
    }
  });

  it('an invalid ingredient yields no key, never a partial one', () => {
    for (const bad of [
      { studentId: null }, { caseType: 'cursive' }, { letter: 'cc' },
      { interactionId: '' }, { cycleNumber: 0 }, { cycleNumber: 1.5 },
    ]) {
      expect(makeRemediationKey({ ...who, cycleNumber: 3, ...bad })).toBeNull();
    }
    expect(hasRemediationHandled({ ...who, cycleNumber: null })).toBe(false);
    expect(markRemediationHandled({})).toBe(false);
  });

  it('collection mode never remediates', () => {
    markRemediationHandled({ ...who, cycleNumber: 3 });
    expect(hasRemediationHandled({ ...who, cycleNumber: 3, collectionMode: true })).toBe(false);
  });

  it('no database or storage was introduced', () => {
    const guard = readCode('./preWritingSessionGuard.js');
    expect(guard).toMatch(/const handledRemediations = new Map\(\);/);
    expect(guard).not.toMatch(/AsyncStorage|SecureStore|client\.|ENDPOINTS/);
  });
});

// ─── §2/§11/§12 the wiring ──────────────────────────────────────────────

describe('the trigger sits at the cycle-2 failure point', () => {
  it.each(SCREENS)('%s fires only when the SECOND cycle has been consumed', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/if \(used === MAX_CYCLES_PER_LETTER_PER_DATE - 1 && !collectionMode\) \{/);
    // Inside handleFailedCycle, after recordCycleCompleted, before the
    // setAttempt(1) that starts the next cycle.
    const fn = code.slice(code.indexOf('const handleFailedCycle'), code.indexOf('const scheduleAdaptiveRepetitionIfEligible'));
    expect(fn.indexOf('const used = recordCycleCompleted'))
      .toBeLessThan(fn.indexOf('MAX_CYCLES_PER_LETTER_PER_DATE - 1'));
    expect(fn.indexOf('MAX_CYCLES_PER_LETTER_PER_DATE - 1'))
      .toBeLessThan(fn.lastIndexOf('setAttempt(1);'));
  });

  it.each(SCREENS)('%s returns to the SAME letter for cycle 3', (rel) => {
    const block = remediationBranch(rel);
    expect(block).toMatch(/letterSequence: sequence\.slice\(letterIdx\),/);
    // slice(letterIdx + 1) would advance PAST the letter that just failed.
    expect(block).not.toMatch(/sequence\.slice\(letterIdx \+ 1\)/);
    expect(block).toMatch(/student, theme, caseType,/);
    expect(block).toMatch(/interactionId/);
  });

  it.each(SCREENS)('%s marks on OPEN and passes the real activities', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const remediationActivities = buildLetterRemediationActivities\(letter\);/);
    expect(code).toMatch(/markRemediationHandled\(\{/);
    expect(code).toMatch(/activities: remediationActivities,/);
    expect(code).toMatch(/reason: PRE_WRITING_REASON\.CYCLE_3_REMEDIATION,/);
    // Nothing happens when there is no recipe — cycle 3 proceeds as before.
    expect(code).toMatch(/if \(remediationActivities\.length > 0 && !alreadyRemediated\) \{/);
  });

  it.each(SCREENS)('%s does not touch cycle or attempt state on the way out', (rel) => {
    const block = remediationBranch(rel);
    expect(block).not.toMatch(/recordCycleCompleted|setAttempt|setLetterIdx|advancePastLetter/);
    expect(block).not.toMatch(/client\.post|LetterAttempt|mastered|motor_score|threshold/i);
  });

  it.each(SCREENS)('%s reuses PreWritingActivityScreen, never a new screen', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/navigation\.navigate\('PreWritingActivity', buildPreWritingNavigationParams\(\{/);
    expect(code).not.toMatch(/RemediationScreen|navigate\('Remediation/);
  });

  it('the pre-writing screen already accepts an explicit activities array', () => {
    const screen = readCode('../screens/handwriting/PreWritingActivityScreen.js');
    expect(screen).toMatch(/if \(Array\.isArray\(activitiesParam\)\) return activitiesParam;/);
    // Its ACTIVITY handling is untouched — the screen later gained a lead-in
    // line for the remediation reason only, and that is asserted in
    // halfCircleDirection.test.js rather than duplicated here.
    expect(screen).not.toMatch(/buildLetterRemediationActivities|remediationStrokeTypes/);
  });
});

// ─── §18 copy ───────────────────────────────────────────────────────────

describe('the child-facing line', () => {
  it('is neutral and bilingual, in the shared source', () => {
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.PRACTISE_FIRST]).toEqual({
      en: "Let's practise first", si: 'මුලින් පුහුණු වෙමු',
    });
  });

  it('never names failure, cycles, attempts or scores', () => {
    const { en, si } = CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.PRACTISE_FIRST];
    for (const text of [en, si]) {
      expect(text).not.toMatch(/fail|wrong|cycle|try|score|again/i);
    }
  });
});

// ─── §21 regression ─────────────────────────────────────────────────────

describe('SENTINEL — cycle, mastery and scoring policy unchanged', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('threshold 70, attempt-3 mastery, 3-cycle cap, 9-attempt maximum', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
  });

  it('cycle-consumption semantics are untouched — capture faults still free', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/return failReason !== MASTERY_FAIL_REASON\.CAPTURE_INCOMPLETE;/);
    expect(policy).toMatch(/COVERAGE_INVALID:\s+'attempt3_coverage_invalid'/);
  });

  it('a capture fault returns BEFORE the failed-cycle path, so it cannot remediate', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      expect(code).toMatch(/if \(response\.data\.cycle_consumed === false\) \{\s*handleCaptureIncomplete\(response\.data\.retry_session_key\);\s*return;/);
      expect(code.indexOf('handleCaptureIncomplete(response.data.retry_session_key)'))
        .toBeLessThan(code.indexOf('handleFailedCycle(response.data?.cycle_usage?.cycles_today ?? null)'));
    }
  });

  it('category-transition pre-writing and the first-letter rule are untouched', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel)).toMatch(/const group\s+= primitiveGroupOnEntering\(sequence, letterIdx \+ 1\);/);
    }
    expect(readCode('../screens/handwriting/LetterPracticeScreen.js')).not.toMatch(/PreWritingActivity/);
    expect(readCode('./preWritingTransition.js')).toMatch(/index <= 0 \|\| index >= sequence\.length\) return null;/);
  });

  it('current-letter audio, canvas mapping and reference paths are untouched', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      expect(code).toMatch(/if \(!masteredSequenceReady \|\| !letterObj\) return undefined;/);
      expect(code).toMatch(/mapTouchToCanvas\(\{/);
      expect(code).toMatch(/const LETTER_PATHS = \{/);
    }
    expect(readCode('../utils/touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
  });

  it('Motor Score, DTW, worksheets and Writing Check are untouched', () => {
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/worksheetMotorMap.js')).toMatch(/const LETTER_STROKE_TYPES = Object\.freeze\(\{/);
    expect(readCode('./letterRemediationPlan.js')).not.toMatch(/dtw|motorScore|writingCheck|worksheet/i);
  });

  it('remediation results never reach mastery or sequencing', () => {
    const plan = readCode('./letterRemediationPlan.js');
    expect(plan).not.toMatch(/mastery|mastered|threshold|score|cycle/i);
    expect(plan).not.toMatch(/client\.|ENDPOINTS|navigation/);
  });
});
