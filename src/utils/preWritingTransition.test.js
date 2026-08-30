// Pre-writing runs on category TRANSITIONS, and only on transitions.
//
// Two faults, one at each end of the sequence:
//
//   index 0     LetterPracticeScreen warmed up for sequence[0] every time.
//               There is no transition at index 0 — nothing precedes it. Its
//               fallback invented a first letter from
//               `categoryOrder?.[0] ?? 'straight'`, which is why a straight
//               warm-up appeared regardless of the real first category.
//
//   mid-flow    The writing screens took the NEXT letter's group alone and
//               never looked at the letter just finished, so l → i → t warmed
//               up before every letter instead of not at all.

import fs from 'fs';
import path from 'path';

import {
  primitiveGroupOnEntering, isCategoryTransition, categoryTransitionIndices,
} from './preWritingTransition';
import { getLetterPrimitiveGroup, PRIMITIVE_GROUPS } from '../data/preWritingActivities';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const PRACTICE  = '../screens/teacher/handwriting/LetterPracticeScreen.js';
const LOWERCASE = '../screens/teacher/handwriting/LetterWritingScreen.js';
const UPPERCASE = '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js';

const seq = (...letters) => letters.map((letter) => ({ letter }));

// The groups the spec's examples rely on, taken from the real map rather than
// assumed — if the catalogue ever re-groups a letter these read as failures
// here instead of silently changing what the cases mean.
describe('the letters used below really are in the groups the cases assume', () => {
  it.each([
    ['l', PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL],
    ['i', PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL],
    ['t', PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL],
    ['c', PRIMITIVE_GROUPS.CURVED],
    ['o', PRIMITIVE_GROUPS.CURVED],
    ['x', PRIMITIVE_GROUPS.DIAGONAL],
    ['y', PRIMITIVE_GROUPS.DIAGONAL],
  ])('%s is %s', (letter, group) => {
    expect(getLetterPrimitiveGroup(letter)).toBe(group);
  });
});

// ─── the five required cases ────────────────────────────────────────────

describe('the spec cases', () => {
  it('CASE 1 — l, i, c, o, x', () => {
    const s = seq('l', 'i', 'c', 'o', 'x');
    expect(categoryTransitionIndices(s)).toEqual([2, 4]);
    expect(primitiveGroupOnEntering(s, 0)).toBeNull();          // l
    expect(primitiveGroupOnEntering(s, 1)).toBeNull();          // i
    expect(primitiveGroupOnEntering(s, 2)).toBe(PRIMITIVE_GROUPS.CURVED);   // PRE → c
    expect(primitiveGroupOnEntering(s, 3)).toBeNull();          // o
    expect(primitiveGroupOnEntering(s, 4)).toBe(PRIMITIVE_GROUPS.DIAGONAL); // PRE → x
  });

  it('CASE 2 — c, o, l, i, x  (curved FIRST, no warm-up before it)', () => {
    const s = seq('c', 'o', 'l', 'i', 'x');
    expect(categoryTransitionIndices(s)).toEqual([2, 4]);
    expect(primitiveGroupOnEntering(s, 0)).toBeNull();
    expect(primitiveGroupOnEntering(s, 1)).toBeNull();
    expect(primitiveGroupOnEntering(s, 2)).toBe(PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL);
    expect(primitiveGroupOnEntering(s, 3)).toBeNull();
    expect(primitiveGroupOnEntering(s, 4)).toBe(PRIMITIVE_GROUPS.DIAGONAL);
  });

  it('CASE 3 — x, y, c, o, l  (diagonal first)', () => {
    const s = seq('x', 'y', 'c', 'o', 'l');
    expect(categoryTransitionIndices(s)).toEqual([2, 4]);
    expect(primitiveGroupOnEntering(s, 2)).toBe(PRIMITIVE_GROUPS.CURVED);
    expect(primitiveGroupOnEntering(s, 4)).toBe(PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL);
  });

  it('CASE 4 — a single letter has no transition at all', () => {
    expect(categoryTransitionIndices(seq('o'))).toEqual([]);
    expect(primitiveGroupOnEntering(seq('o'), 0)).toBeNull();
    expect(isCategoryTransition(seq('o'), 0)).toBe(false);
  });

  it('CASE 5 — one family throughout, never a warm-up', () => {
    const s = seq('l', 'i', 't');
    expect(categoryTransitionIndices(s)).toEqual([]);
    for (let i = 0; i < s.length; i += 1) {
      expect(primitiveGroupOnEntering(s, i)).toBeNull();
    }
  });

  it('UPPERCASE — C, O, L behaves identically', () => {
    const s = seq('C', 'O', 'L');
    expect(categoryTransitionIndices(s)).toEqual([2]);
    expect(primitiveGroupOnEntering(s, 0)).toBeNull();   // no warm-up before C
    expect(primitiveGroupOnEntering(s, 2)).toBe(getLetterPrimitiveGroup('L'));
  });
});

// ─── the rules the cases are instances of ───────────────────────────────

describe('index 0 never warms up', () => {
  it.each([['l'], ['c'], ['x'], ['o'], ['A'], ['Z']])(
    'whatever category %s is', (first) => {
      expect(primitiveGroupOnEntering(seq(first, 'c', 'o'), 0)).toBeNull();
    });

  it('no previous group is invented for it', () => {
    // The old fallback defaulted to 'straight'. If any default crept back,
    // index 0 of a curved-first sequence would report a transition.
    expect(primitiveGroupOnEntering(seq('c', 'o'), 0)).toBeNull();
    expect(categoryTransitionIndices(seq('c', 'o'))).toEqual([]);
  });

  it('the guard is EXPLICIT, not merely implied by a missing previous letter', () => {
    // Behaviour alone cannot pin this: with the guard weakened to `index < 0`,
    // letterAt(sequence, -1) is undefined and every case above still passes.
    // The spec asked for an explicit index-0 guard, so assert it is there —
    // it is what stops a future "tolerant" lookup from resurrecting the bug.
    const helper = readCode('./preWritingTransition.js');
    expect(helper).toMatch(/index <= 0 \|\| index >= sequence\.length\) return null;/);
  });

  it('an empty sequence produces nothing', () => {
    expect(categoryTransitionIndices([])).toEqual([]);
    expect(primitiveGroupOnEntering([], 0)).toBeNull();
  });
});

describe('only once per transition', () => {
  it('a run of six same-group letters yields exactly one transition', () => {
    const s = seq('l', 'i', 't', 'c', 'o', 'e');
    expect(categoryTransitionIndices(s)).toEqual([3]);
    expect(categoryTransitionIndices(s)).toHaveLength(1);
  });

  it('the warm-up names the group being ENTERED, not the one being left', () => {
    expect(primitiveGroupOnEntering(seq('l', 'c'), 1)).toBe(PRIMITIVE_GROUPS.CURVED);
    expect(primitiveGroupOnEntering(seq('c', 'l'), 1)).toBe(PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL);
    expect(primitiveGroupOnEntering(seq('l', 'x'), 1)).toBe(PRIMITIVE_GROUPS.DIAGONAL);
    expect(primitiveGroupOnEntering(seq('x', 'c'), 1)).toBe(PRIMITIVE_GROUPS.CURVED);
  });

  it('every order is honoured — no category order is assumed', () => {
    // curved → vertical_horizontal → diagonal is as valid as the reverse.
    expect(categoryTransitionIndices(seq('c', 'l', 'x'))).toEqual([1, 2]);
    expect(categoryTransitionIndices(seq('x', 'c', 'l'))).toEqual([1, 2]);
    expect(categoryTransitionIndices(seq('l', 'x', 'c'))).toEqual([1, 2]);
  });

  it('returning to an earlier group still counts as a transition', () => {
    // l l c c l — entering vertical_horizontal again is a real change.
    expect(categoryTransitionIndices(seq('l', 'i', 'c', 'o', 't'))).toEqual([2, 4]);
  });
});

describe('robustness', () => {
  it.each([[null], [undefined], ['nope'], [{}], [42]])('%s is not a sequence', (bad) => {
    expect(categoryTransitionIndices(bad)).toEqual([]);
    expect(primitiveGroupOnEntering(bad, 1)).toBeNull();
  });

  it('an out-of-range or non-integer index yields null', () => {
    const s = seq('l', 'c');
    for (const i of [-1, 2, 99, 1.5, NaN, null, undefined, '1']) {
      expect(primitiveGroupOnEntering(s, i)).toBeNull();
    }
  });

  it('malformed entries never throw', () => {
    expect(() => primitiveGroupOnEntering([{ letter: 'l' }, null], 1)).not.toThrow();
    expect(primitiveGroupOnEntering([{ letter: 'l' }, null], 1)).toBeNull();
    expect(primitiveGroupOnEntering([{}, { letter: 'c' }], 1)).toBeNull();
  });

  it('plain strings work as well as {letter} objects', () => {
    expect(primitiveGroupOnEntering(['l', 'c'], 1)).toBe(PRIMITIVE_GROUPS.CURVED);
    expect(primitiveGroupOnEntering(['l', 'i'], 1)).toBeNull();
  });
});

// ─── the screens are actually wired to it ───────────────────────────────

describe('session start goes straight to the letter', () => {
  const code = readCode(PRACTICE);

  it('LetterPracticeScreen no longer detours through a warm-up', () => {
    expect(code).not.toMatch(/PreWritingActivity/);
    expect(code).not.toMatch(/selectPreWritingActivities|getLetterPrimitiveGroup/);
    expect(code).not.toMatch(/PRE_WRITING_REASON\.SESSION_START/);
  });

  it('the invented first letter is gone', () => {
    expect(code).not.toMatch(/categoryOrder\?\.\[0\] \?\? 'straight'/);
    expect(code).not.toMatch(/const firstLetter/);
  });

  it('it navigates to the writing screen directly, keeping the interaction id', () => {
    expect(code).toMatch(/const interactionId = createPreWritingInteractionId\(\);/);
    // originRoute was added later so Back can pop past the frames the
    // warm-up detours leave behind; the direct navigate is unchanged.
    expect(code).toMatch(/navigation\.navigate\(screen, \{ \.\.\.params, interactionId, originRoute: 'LetterPractice' \}\);/);
    expect(code).toMatch(/caseType === 'lowercase' \? 'LetterWriting' : 'UppercaseWriting'/);
  });
});

describe('mid-sequence uses the shared transition rule', () => {
  it.each([[LOWERCASE], [UPPERCASE]])('%s compares against the previous letter', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const group\s+= primitiveGroupOnEntering\(sequence, letterIdx \+ 1\);/);
    expect(code).toMatch(/import \{ primitiveGroupOnEntering \} from '[^']*preWritingTransition'/);
  });

  it.each([[LOWERCASE], [UPPERCASE]])('%s no longer groups the next letter in isolation', (rel) => {
    const code = readCode(rel);
    expect(code).not.toMatch(/nextLetterObj \? getLetterPrimitiveGroup\(nextLetterObj\.letter\) : null/);
  });

  it.each([[LOWERCASE], [UPPERCASE]])('%s still warms up for the entered group only', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const activities = group \? selectPreWritingActivities\(group\) : \[\];/);
    expect(code).toMatch(/reason: PRE_WRITING_REASON\.CATEGORY_TRANSITION/);
  });

  it('no second category mapping was introduced', () => {
    const helper = readCode('./preWritingTransition.js');
    expect(helper).toMatch(/import \{ getLetterPrimitiveGroup \} from '\.\.\/constants\/preWritingActivities'/);
    expect(helper).not.toMatch(/straight|LETTER_CATEGORIES|categoryOrder/);
    expect(helper).not.toMatch(/PRIMITIVE_GROUPS\./);   // never hardcodes a group
  });
});

// ─── the stale letter audio ─────────────────────────────────────────────

describe('the spoken letter is the visible letter', () => {
  it.each([[LOWERCASE], [UPPERCASE]])('%s waits for the filtered sequence', (rel) => {
    const code = readCode(rel);
    // `sequence` is runtimeSequence ?? effectiveSequence ?? baseSequence, and
    // effectiveSequence is null until the mastered-letter read resolves — so
    // before that, `letter` is the pre-filter letter the child never sees.
    expect(code).toMatch(/const instructionKey = masteredSequenceReady && letterObj/);
    expect(code).toMatch(/autoPlay: Boolean\(instructionKey\)/);
  });

  it.each([[LOWERCASE, "'a'"], [UPPERCASE, "'A'"]])(
    '%s speaks from the same source the target renders', (rel, fallback) => {
      const code = readCode(rel);
      expect(code).toMatch(/const letterObj\s+= sequence\[letterIdx\];/);
      // The placeholder each screen falls back to when the sequence has not
      // resolved. It is exactly what used to be SPOKEN before the guard: the
      // audio ran while the render was still gated, so the child heard the
      // pre-filter letter. It stays as a render-safety default only.
      expect(code.replace(/\s+/g, ' '))
        .toContain(`const letter = letterObj?.letter ?? ${fallback};`);
      expect(code).toMatch(/Speech\.speak\(spoken\.toUpperCase\(\)/);
    });

  it.each([[LOWERCASE], [UPPERCASE]])('%s never speaks a route param or a cached letter', (rel) => {
    const code = readCode(rel);
    for (const call of code.match(/Speech\.speak\([^;]*;/g) || []) {
      expect(call).toMatch(/\b(letter|spoken)\b/);
      expect(call).not.toMatch(/route\.params|initialLetter|sequence\[0\]/);
    }
  });

  it.each([[LOWERCASE], [UPPERCASE]])('%s tap-to-hear falls back to the current letter', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const spoken = String\(l \?\? letter \?\? ''\);/);
    expect(code).toMatch(/if \(!spoken\) return;/);
  });
});

// ─── nothing else moved ─────────────────────────────────────────────────

describe('SENTINEL — sequencing, scoring and geometry untouched', () => {
  it('the category definitions and the primitive map are unchanged', () => {
    const cats = readCode('../data/letterCategories.js');
    expect(cats).toMatch(/export function getAllLetters/);
    expect(cats).not.toMatch(/preWritingTransition/);
    const pre = readCode('../data/preWritingActivities.js');
    expect(pre).toMatch(/function getLetterPrimitiveGroup\(letter\) \{/);
    expect(pre).toMatch(/return LETTER_PRIMITIVE_MAP\[letter\] \?\? PRIMITIVE_GROUPS\.MIXED;/);
    expect(pre).toMatch(/\[PRIMITIVE_GROUPS\.MIXED\]:\s+0,/);
  });

  it('adaptive sequencing and mastery filtering are untouched', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      const code = readCode(rel);
      expect(code).toMatch(/const filtered = filterUnmasteredSequence\(baseSequence, pairs\);/);
      expect(code).toMatch(/setEffectiveSequence\(filtered\)/);
    }
  });

  it('the adaptive-difficulty detour is a separate trigger and still exists', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      expect(readCode(rel)).toMatch(/PRE_WRITING_REASON\.ADAPTIVE_DIFFICULTY/);
    }
  });

  it('collection mode still never detours', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      const code = readCode(rel);
      expect(code).toMatch(/\} else if \(collectionMode\) \{/);
    }
  });

  it('the transition helper touches nothing but grouping', () => {
    const helper = readCode('./preWritingTransition.js');
    expect(helper).not.toMatch(/navigation|Speech|score|mastery|threshold|CANVAS|fetch/i);
  });

  it('scoring, mastery and thresholds are untouched', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
  });

  it('reference paths and pre-writing geometry are untouched', () => {
    const pre = read('../data/preWritingActivities.js');
    expect((pre.match(/generatePoints:/g) || []).length).toBe(18);
    expect(readCode('../constants/letterCanvasLayout.js'))
      .toMatch(/export const CANVAS_H\s+= Math\.round\(SCREEN_H \* 0\.50\);/);
  });
});
