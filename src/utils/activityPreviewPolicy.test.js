// Feature 10 Step 2 — activityPreviewPolicy.js + activityPreviewLetterPaths.js
// pure-function tests. No React, no react-native-svg, no network — every
// test here runs in plain Node (this project's jest.config.js is already
// scoped to src/utils/**, matching the Feature 9 precedent this step
// deliberately follows rather than touching Jest config).

const fs = require('fs');
const path = require('path');

import {
  buildActivityPreview,
  buildActivityPreviewAccessibilityLabel,
  VALID_FAMILIES,
  VALID_CASE_TYPES,
  MAX_FOCUS_LETTER_PREVIEWS,
} from '../constants/activityPreviewPolicy';
import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from '../constants/activityPreviewLetterPaths';

function readPolicySource() {
  return fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewPolicy.js'), 'utf8');
}
function readLetterPathsSource() {
  return fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewLetterPaths.js'), 'utf8');
}
// The policy file's own header comment legitimately DISCUSSES excluded
// concepts by name (e.g. "never reads ... recommendationFingerprint ...")
// to document why they're excluded — the same recurring comment-vs-code
// false-positive pattern hit across every prior feature's own source-scan
// tests. Strip comments before scanning for terms that should never appear
// in actual code.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── 1-8: family policy ─────────────────────────────────────────────────

describe('1. exact families = straight/curved/complex', () => {
  it('VALID_FAMILIES is exactly these three, no fourth', () => {
    expect(VALID_FAMILIES).toEqual(['straight', 'curved', 'complex']);
  });
});

describe('2. straight preview exists', () => {
  it('buildActivityPreview({family: "straight"}) returns a non-null familyPreview', () => {
    const result = buildActivityPreview({ family: 'straight', focusLetters: [] });
    expect(result.familyPreview).not.toBeNull();
    expect(result.familyPreview.family).toBe('straight');
  });
});

describe('3. curved preview exists', () => {
  it('buildActivityPreview({family: "curved"}) returns a non-null familyPreview', () => {
    const result = buildActivityPreview({ family: 'curved', focusLetters: [] });
    expect(result.familyPreview).not.toBeNull();
    expect(result.familyPreview.family).toBe('curved');
  });
});

describe('4. complex preview exists', () => {
  it('buildActivityPreview({family: "complex"}) returns a non-null familyPreview', () => {
    const result = buildActivityPreview({ family: 'complex', focusLetters: [] });
    expect(result.familyPreview).not.toBeNull();
    expect(result.familyPreview.family).toBe('complex');
  });
});

describe('5. invalid family -> null', () => {
  it.each(['unknown', 'diagonal', 'mixed', '', null, undefined, 42])('family=%p -> familyPreview: null', (bad) => {
    const result = buildActivityPreview({ family: bad, focusLetters: [] });
    expect(result.familyPreview).toBeNull();
  });
});

describe('6. exact labels', () => {
  it('straight/curved/complex labels match exactly, never "Difficulty" wording', () => {
    expect(buildActivityPreview({ family: 'straight' }).familyPreview.label).toBe('Straight Movement Preview');
    expect(buildActivityPreview({ family: 'curved' }).familyPreview.label).toBe('Curved Movement Preview');
    expect(buildActivityPreview({ family: 'complex' }).familyPreview.label).toBe('Complex Movement Preview');
  });

  it('no label anywhere contains "Difficulty" or "Zigzag"', () => {
    for (const family of VALID_FAMILIES) {
      const label = buildActivityPreview({ family }).familyPreview.label;
      expect(label).not.toMatch(/Difficulty/i);
      expect(label).not.toMatch(/Zigzag/i);
    }
  });
});

describe('7. family geometry is declarative data', () => {
  it('every shape is a plain object with a type field, never a React element', () => {
    for (const family of VALID_FAMILIES) {
      const { shapes } = buildActivityPreview({ family }).familyPreview;
      expect(Array.isArray(shapes)).toBe(true);
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(typeof shape).toBe('object');
        expect(shape.$$typeof).toBeUndefined(); // React elements carry a $$typeof symbol; plain data never does
        expect(typeof shape.type).toBe('string');
      }
    }
  });
});

describe('8. no JSX/React dependency', () => {
  it('activityPreviewPolicy.js never imports react or react-native-svg', () => {
    const requireLines = readPolicySource().split('\n').filter((l) => /^import /.test(l)).join('\n');
    expect(requireLines).not.toMatch(/from 'react'/);
    expect(requireLines).not.toMatch(/react-native-svg/);
  });
});

// ─── 9-11: straight geometry ─────────────────────────────────────────────

describe('9. straight preview contains a vertical line', () => {
  it('one shape has type "line" with x1 === x2 (vertical)', () => {
    const { shapes } = buildActivityPreview({ family: 'straight' }).familyPreview;
    const vertical = shapes.find((s) => s.type === 'line' && s.x1 === s.x2);
    expect(vertical).toBeDefined();
  });
});

describe('10. straight preview contains a horizontal line', () => {
  it('one shape has type "line" with y1 === y2 (horizontal)', () => {
    const { shapes } = buildActivityPreview({ family: 'straight' }).familyPreview;
    const horizontal = shapes.find((s) => s.type === 'line' && s.y1 === s.y2);
    expect(horizontal).toBeDefined();
  });
});

describe('11. no score/severity fields on straight shapes', () => {
  it('shapes never carry score/severity/priority/confidence keys', () => {
    const { shapes } = buildActivityPreview({ family: 'straight' }).familyPreview;
    for (const shape of shapes) {
      expect(shape).not.toHaveProperty('score');
      expect(shape).not.toHaveProperty('severity');
      expect(shape).not.toHaveProperty('priority');
      expect(shape).not.toHaveProperty('confidence');
    }
  });
});

// ─── 12-14: curved geometry ───────────────────────────────────────────────

describe('12. curved preview contains a circle', () => {
  it('one shape has type "circle"', () => {
    const { shapes } = buildActivityPreview({ family: 'curved' }).familyPreview;
    expect(shapes.some((s) => s.type === 'circle')).toBe(true);
  });
});

describe('13. curved preview contains a half-circle/path', () => {
  it('one shape has type "path" with an arc ("A") command', () => {
    const { shapes } = buildActivityPreview({ family: 'curved' }).familyPreview;
    const arcPath = shapes.find((s) => s.type === 'path' && typeof s.d === 'string' && s.d.includes('A'));
    expect(arcPath).toBeDefined();
  });
});

describe('14. no score/severity fields on curved shapes', () => {
  it('shapes never carry score/severity/priority/confidence keys', () => {
    const { shapes } = buildActivityPreview({ family: 'curved' }).familyPreview;
    for (const shape of shapes) {
      expect(shape).not.toHaveProperty('score');
      expect(shape).not.toHaveProperty('severity');
    }
  });
});

// ─── 15-17: complex geometry ──────────────────────────────────────────────

describe('15. complex preview contains a direction-change representation', () => {
  it('one shape has type "polyline" with more than 2 points (direction changes)', () => {
    const { shapes } = buildActivityPreview({ family: 'complex' }).familyPreview;
    const polyline = shapes.find((s) => s.type === 'polyline');
    expect(polyline).toBeDefined();
    expect(polyline.points.length).toBeGreaterThan(2);
  });
});

describe('16. label says complex, not zigzag difficulty', () => {
  it('the complex label is exactly "Complex Movement Preview"', () => {
    expect(buildActivityPreview({ family: 'complex' }).familyPreview.label).toBe('Complex Movement Preview');
  });
});

describe('17. comments/policy do not classify all complex letters as zigzag', () => {
  it('the source explicitly documents the complex preview as representative-only, not exhaustive', () => {
    const source = readPolicySource();
    expect(source).toMatch(/[Rr]epresentative movement example only/);
    expect(source).toMatch(/family includes multiple combined/i);
  });
});

// ─── 18-23: letter coverage ───────────────────────────────────────────────

describe('18. lowercase 26/26', () => {
  it('LOWERCASE_LETTER_PATHS has exactly 26 keys, a-z', () => {
    const keys = Object.keys(LOWERCASE_LETTER_PATHS).sort();
    expect(keys).toEqual('abcdefghijklmnopqrstuvwxyz'.split('').sort());
  });
});

describe('19. uppercase 26/26', () => {
  it('UPPERCASE_LETTER_PATHS has exactly 26 keys, A-Z', () => {
    const keys = Object.keys(UPPERCASE_LETTER_PATHS).sort();
    expect(keys).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').sort());
  });
});

describe('20. all paths non-empty', () => {
  it('every lowercase and uppercase entry has at least one point', () => {
    for (const table of [LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS]) {
      for (const [letter, path] of Object.entries(table)) {
        expect(Array.isArray(path) && path.length > 0).toBe(true);
      }
    }
  });
});

describe('21. all points finite', () => {
  it('every fx/fy across both tables is a finite number', () => {
    for (const table of [LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS]) {
      for (const path of Object.values(table)) {
        const strokes = Array.isArray(path[0]) ? path : [path];
        for (const stroke of strokes) {
          for (const pt of stroke) {
            expect(Number.isFinite(pt.fx)).toBe(true);
            expect(Number.isFinite(pt.fy)).toBe(true);
          }
        }
      }
    }
  });
});

describe('22. all fx/fy in valid normalized range', () => {
  it('every fx/fy is within [0, 1]', () => {
    for (const table of [LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS]) {
      for (const path of Object.values(table)) {
        const strokes = Array.isArray(path[0]) ? path : [path];
        for (const stroke of strokes) {
          for (const pt of stroke) {
            expect(pt.fx).toBeGreaterThanOrEqual(0);
            expect(pt.fx).toBeLessThanOrEqual(1);
            expect(pt.fy).toBeGreaterThanOrEqual(0);
            expect(pt.fy).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('23. multi-stroke arrays preserved', () => {
  it('a known multi-stroke lowercase letter (b) keeps its 2-stroke array shape in the raw table', () => {
    expect(Array.isArray(LOWERCASE_LETTER_PATHS.b[0])).toBe(true);
    expect(LOWERCASE_LETTER_PATHS.b).toHaveLength(2);
  });

  it('a known single-stroke lowercase letter (c) stays a flat point array in the raw table', () => {
    // c[0] is a point object ({fx, fy}), not a nested array — confirms c is single-stroke.
    expect(Array.isArray(LOWERCASE_LETTER_PATHS.c[0])).toBe(false);
    expect(typeof LOWERCASE_LETTER_PATHS.c[0].fx).toBe('number');
  });

  it('buildActivityPreview always normalizes to an array of strokes, for both shapes', () => {
    const multi = buildActivityPreview({ focusLetters: ['b'] }).focusLetterPreviews[0];
    const single = buildActivityPreview({ focusLetters: ['c'] }).focusLetterPreviews[0];
    expect(Array.isArray(multi.strokes[0])).toBe(true);
    expect(Array.isArray(single.strokes[0])).toBe(true);
    expect(multi.strokes.length).toBe(2); // b has 2 strokes
    expect(single.strokes.length).toBe(1); // c has 1 stroke
  });
});

// ─── 24-33: focus-letter behavior ─────────────────────────────────────────

describe('24. lowercase example c,o', () => {
  it('resolves both letters with strokes', () => {
    const result = buildActivityPreview({ family: 'curved', focusLetters: ['c', 'o'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o']);
  });
});

describe('25. uppercase C,O', () => {
  it('resolves both uppercase letters with strokes', () => {
    const result = buildActivityPreview({ family: 'curved', caseType: 'uppercase', focusLetters: ['C', 'O'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['C', 'O']);
  });
});

describe('26. order preserved', () => {
  it('["o", "c"] stays ["o", "c"], never re-sorted alphabetically', () => {
    const result = buildActivityPreview({ focusLetters: ['o', 'c'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['o', 'c']);
  });
});

describe('27. case preserved', () => {
  it('an uppercase letter in the input stays uppercase in the output', () => {
    const result = buildActivityPreview({ focusLetters: ['C'] });
    expect(result.focusLetterPreviews[0].letter).toBe('C');
  });
});

describe('28. duplicates preserved', () => {
  it('["c", "c", "o"] produces two independent "c" preview entries', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'c', 'o'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'c', 'o']);
  });
});

describe('29. empty array', () => {
  it('focusLetters: [] -> focusLetterPreviews: [], hiddenFocusLetterCount: 0, family preview still present', () => {
    const result = buildActivityPreview({ family: 'straight', focusLetters: [] });
    expect(result.focusLetterPreviews).toEqual([]);
    expect(result.hiddenFocusLetterCount).toBe(0);
    expect(result.familyPreview).not.toBeNull();
  });
});

describe('30. undefined', () => {
  it('focusLetters: undefined is treated safely as [], never throws', () => {
    expect(() => buildActivityPreview({ family: 'straight' })).not.toThrow();
    const result = buildActivityPreview({ family: 'straight' });
    expect(result.focusLetterPreviews).toEqual([]);
  });

  it('focusLetters: null is also treated safely as []', () => {
    const result = buildActivityPreview({ family: 'straight', focusLetters: null });
    expect(result.focusLetterPreviews).toEqual([]);
  });
});

describe('31. malformed entries filtered', () => {
  it('null/undefined/number/multi-char entries are skipped without crashing', () => {
    const result = buildActivityPreview({ focusLetters: [null, undefined, 42, 'ab', 'c'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c']);
  });
});

describe('32. missing path filtered', () => {
  it('a character with no LETTER_PATHS entry (e.g. a digit or symbol) is skipped', () => {
    const result = buildActivityPreview({ focusLetters: ['c', '5', 'o'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o']);
  });
});

describe('33. no mutation', () => {
  it('calling buildActivityPreview never mutates the LETTER_PATHS constants', () => {
    const beforeC = JSON.stringify(LOWERCASE_LETTER_PATHS.c);
    const result = buildActivityPreview({ focusLetters: ['c'] });
    result.focusLetterPreviews[0].strokes[0][0].fx = 999; // attempt mutation on the returned copy
    expect(JSON.stringify(LOWERCASE_LETTER_PATHS.c)).toBe(beforeC);
  });

  it('never mutates the caller-supplied focusLetters array', () => {
    const input = ['c', 'o'];
    const frozenInput = Object.freeze([...input]);
    expect(() => buildActivityPreview({ focusLetters: frozenInput })).not.toThrow();
  });
});

// ─── 34-40: max-3 behavior ────────────────────────────────────────────────

describe('34. one letter', () => {
  it('1 valid letter -> 1 shown, 0 hidden', () => {
    const result = buildActivityPreview({ focusLetters: ['c'] });
    expect(result.focusLetterPreviews).toHaveLength(1);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('35. two letters', () => {
  it('2 valid letters -> 2 shown, 0 hidden', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o'] });
    expect(result.focusLetterPreviews).toHaveLength(2);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('36. three letters', () => {
  it('3 valid letters -> 3 shown, 0 hidden', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's'] });
    expect(result.focusLetterPreviews).toHaveLength(3);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('37. four valid letters -> 3 shown + hidden=1', () => {
  it('["c","o","s","u"] -> shown [c,o,s], hidden=1', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's', 'u'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o', 's']);
    expect(result.hiddenFocusLetterCount).toBe(1);
  });
});

describe('38. five valid letters -> 3 shown + hidden=2', () => {
  it('["c","o","s","u","v"] -> shown [c,o,s], hidden=2', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's', 'u', 'v'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o', 's']);
    expect(result.hiddenFocusLetterCount).toBe(2);
  });
});

describe('39. invalid entry does not consume a slot', () => {
  it('["c", null, "o", "s"] -> shown [c,o,s], hidden=0 (null never consumes a visible slot)', () => {
    const result = buildActivityPreview({ focusLetters: ['c', null, 'o', 's'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o', 's']);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('40. missing-path entry does not increase hidden count', () => {
  it('["c","?","o"] -> shown [c,o], hidden=0', () => {
    const result = buildActivityPreview({ focusLetters: ['c', '?', 'o'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o']);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });

  it('a missing-path entry beyond the visible limit is also not counted as hidden', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's', '?'] });
    expect(result.focusLetterPreviews).toHaveLength(3);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

// ─── 41-43: defensive copying ─────────────────────────────────────────────

describe('41. returned family geometry mutation does not alter constants', () => {
  it('mutating a returned shape does not affect a subsequent independent call', () => {
    const first = buildActivityPreview({ family: 'straight' });
    first.familyPreview.shapes[0].x1 = 9999;
    first.familyPreview.label = 'MUTATED';
    const second = buildActivityPreview({ family: 'straight' });
    expect(second.familyPreview.shapes[0].x1).not.toBe(9999);
    expect(second.familyPreview.label).toBe('Straight Movement Preview');
  });
});

describe('42. returned letter strokes mutation does not alter constants', () => {
  it('mutating returned stroke points does not affect a subsequent independent call', () => {
    const first = buildActivityPreview({ focusLetters: ['c'] });
    first.focusLetterPreviews[0].strokes[0][0].fx = -1;
    const second = buildActivityPreview({ focusLetters: ['c'] });
    expect(second.focusLetterPreviews[0].strokes[0][0].fx).not.toBe(-1);
  });
});

describe('43. repeated build returns original clean values', () => {
  it('two independent calls with identical input are deep-equal', () => {
    const a = buildActivityPreview({ family: 'curved', caseType: 'lowercase', focusLetters: ['c', 'o'] });
    const b = buildActivityPreview({ family: 'curved', caseType: 'lowercase', focusLetters: ['c', 'o'] });
    expect(a).toEqual(b);
  });
});

// ─── 44-48: accessibility ─────────────────────────────────────────────────

describe('44. family-only accessibility label', () => {
  it('no focus letters -> label ends with the family phrase only', () => {
    const preview = buildActivityPreview({ family: 'curved', focusLetters: [] });
    expect(buildActivityPreviewAccessibilityLabel(preview)).toBe('Curved movement practice preview.');
  });
});

describe('45. label with one focus letter', () => {
  it('one letter -> "... Focus letters c."', () => {
    const preview = buildActivityPreview({ family: 'curved', focusLetters: ['c'] });
    expect(buildActivityPreviewAccessibilityLabel(preview)).toBe('Curved movement practice preview. Focus letters c.');
  });
});

describe('46. label with multiple letters', () => {
  it('two letters -> exact example from the spec', () => {
    const preview = buildActivityPreview({ family: 'curved', focusLetters: ['c', 'o'] });
    expect(buildActivityPreviewAccessibilityLabel(preview)).toBe('Curved movement practice preview. Focus letters c, o.');
  });
});

describe('47. hidden-count note (not included, by deliberate design choice)', () => {
  it('the label does not encode the hidden count (kept simple; documented as optional in the builder\'s own JSDoc)', () => {
    const preview = buildActivityPreview({ focusLetters: ['c', 'o', 's', 'u'], family: 'curved' });
    const label = buildActivityPreviewAccessibilityLabel(preview);
    expect(label).toBe('Curved movement practice preview. Focus letters c, o, s.');
    expect(label).not.toMatch(/more/i);
  });
});

describe('48. no severity/clinical wording', () => {
  it('no accessibility label anywhere contains severity/diagnosis/score/correctness language', () => {
    for (const family of VALID_FAMILIES) {
      const preview = buildActivityPreview({ family, focusLetters: ['c', 'o'] });
      const label = buildActivityPreviewAccessibilityLabel(preview);
      expect(label).not.toMatch(/severity|diagnos|score|correct|incorrect|impairment/i);
    }
  });

  it('an invalid family with no resolvable letters produces an empty label, never a fabricated one', () => {
    const preview = buildActivityPreview({ family: 'unknown', focusLetters: [] });
    expect(buildActivityPreviewAccessibilityLabel(preview)).toBe('');
  });

  it('Step 4 spec §19 fix: an invalid family with a still-resolvable letter produces a letters-only label, never empty', () => {
    const preview = buildActivityPreview({ family: 'unknown', focusLetters: ['c'] });
    expect(buildActivityPreviewAccessibilityLabel(preview)).toBe('Focus letters c.');
  });
});

// ─── 49-56: source-scan purity ────────────────────────────────────────────

function policyRequireLines() {
  return readPolicySource().split('\n').filter((l) => /^import /.test(l)).join('\n');
}
function letterPathsRequireLines() {
  return readLetterPathsSource().split('\n').filter((l) => /^import /.test(l)).join('\n');
}

describe('49. no React import', () => {
  it('neither file imports react', () => {
    expect(policyRequireLines()).not.toMatch(/from 'react'/);
    expect(letterPathsRequireLines()).not.toMatch(/from 'react'/);
  });
});

describe('50. no react-native-svg import', () => {
  it('neither file imports react-native-svg', () => {
    expect(policyRequireLines()).not.toMatch(/react-native-svg/);
    expect(letterPathsRequireLines()).not.toMatch(/react-native-svg/);
  });
});

describe('51. no Feature 4 import', () => {
  it('never imports preWritingActivities.js', () => {
    expect(policyRequireLines()).not.toMatch(/preWritingActivities/);
  });
});

describe('52. no assessment-screen import', () => {
  it('never imports ShapeAssessmentScreen.js', () => {
    expect(policyRequireLines()).not.toMatch(/ShapeAssessmentScreen/);
  });
});

describe('53. no writing-screen import', () => {
  it('never imports LetterWritingScreen.js or UppercaseWritingScreen.js', () => {
    expect(policyRequireLines()).not.toMatch(/LetterWritingScreen/);
    expect(policyRequireLines()).not.toMatch(/UppercaseWritingScreen/);
    expect(letterPathsRequireLines()).not.toMatch(/LetterWritingScreen/);
    expect(letterPathsRequireLines()).not.toMatch(/UppercaseWritingScreen/);
  });
});

describe('54. no network', () => {
  it('never imports the api client or fetch-related modules', () => {
    expect(policyRequireLines()).not.toMatch(/api\/client|axios|fetch/);
  });
});

describe('55. no DB/persistence', () => {
  it('never references AsyncStorage or any persistence utility', () => {
    const source = readPolicySource();
    expect(source).not.toMatch(/AsyncStorage/);
    expect(policyRequireLines()).not.toMatch(/utils\/storage/);
  });
});

describe('56. no fingerprint/history dependency', () => {
  it('never references recommendationFingerprint, teacherRecommendationValidations, or Feature 9 concepts in actual code', () => {
    const code = stripComments(readPolicySource());
    expect(code).not.toMatch(/recommendationFingerprint/);
    expect(code).not.toMatch(/teacherRecommendationValidations/);
    expect(code).not.toMatch(/evidenceFingerprint/);
  });
});

// ─── VALID_CASE_TYPES + MAX constant sanity (supplementary) ──────────────

describe('supplementary: exported constants', () => {
  it('VALID_CASE_TYPES is exactly lowercase/uppercase', () => {
    expect(VALID_CASE_TYPES).toEqual(['lowercase', 'uppercase']);
  });
  it('MAX_FOCUS_LETTER_PREVIEWS is exactly 3', () => {
    expect(MAX_FOCUS_LETTER_PREVIEWS).toBe(3);
  });
});

// ─── §28 caseType-mismatch behavior (explicit) ────────────────────────────

describe('CaseType mismatch behavior (Step 2 spec §28)', () => {
  it('caseType="lowercase" with an uppercase letter still renders that uppercase letter (Feature 8 focusLetters is authoritative)', () => {
    const result = buildActivityPreview({ caseType: 'lowercase', focusLetters: ['C'] });
    expect(result.focusLetterPreviews[0].letter).toBe('C');
  });

  it('caseType="uppercase" with a lowercase letter still renders that lowercase letter', () => {
    const result = buildActivityPreview({ caseType: 'uppercase', focusLetters: ['c'] });
    expect(result.focusLetterPreviews[0].letter).toBe('c');
  });
});
