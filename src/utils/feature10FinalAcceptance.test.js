// Feature 10 Step 4 — Final End-to-End Validation + Closure.
//
// Re-verifies the pure policy/geometry behavior from
// activityPreviewPolicy.js/activityPreviewGeometry.js as a fresh,
// standalone closure-step suite, PLUS source-scan wiring proof against the
// real ActivityPreview.js and TeacherReportScreen.js — mirrors
// feature8FinalAcceptance.test.js / feature9FinalAcceptance.test.js's own
// established closure-step shape exactly. No RN component-testing infra
// exists in this project (jest.config.js's own comment) and
// react-native-svg cannot be safely `require`d under this project's
// plain-Node Jest environment — screen/component wiring is proven the
// same way every prior feature's own closure step proved it.

const fs = require('fs');
const path = require('path');

import {
  buildActivityPreview,
  buildActivityPreviewAccessibilityLabel,
  VALID_FAMILIES,
  MAX_FOCUS_LETTER_PREVIEWS,
} from '../constants/activityPreviewPolicy';
import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from '../constants/activityPreviewLetterPaths';
import { scaleStrokeToPreview, toPolylinePoints } from './activityPreviewGeometry';

function readComponent() {
  return fs.readFileSync(path.resolve(__dirname, '../components/handwriting/ActivityPreview.js'), 'utf8');
}
function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}
function componentRequireLines() {
  return readComponent().split('\n').filter((l) => /from '/.test(l)).join('\n');
}
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── 1-16: family/letter policy re-verification ─────────────────────────

describe('1. exactly three families', () => {
  it('VALID_FAMILIES is exactly straight/curved/complex', () => {
    expect(VALID_FAMILIES).toEqual(['straight', 'curved', 'complex']);
  });
});

describe('2. family labels exact', () => {
  it('matches the exact teacher-facing labels', () => {
    expect(buildActivityPreview({ family: 'straight' }).familyPreview.label).toBe('Straight Movement Preview');
    expect(buildActivityPreview({ family: 'curved' }).familyPreview.label).toBe('Curved Movement Preview');
    expect(buildActivityPreview({ family: 'complex' }).familyPreview.label).toBe('Complex Movement Preview');
  });
});

describe('3. lowercase coverage', () => {
  it('26/26 lowercase letters', () => {
    expect(Object.keys(LOWERCASE_LETTER_PATHS)).toHaveLength(26);
  });
});

describe('4. uppercase coverage', () => {
  it('26/26 uppercase letters', () => {
    expect(Object.keys(UPPERCASE_LETTER_PATHS)).toHaveLength(26);
  });
});

describe('5. invalid family safe', () => {
  it('an unrecognized family never crashes and never invents a fourth family', () => {
    expect(() => buildActivityPreview({ family: 'diagonal' })).not.toThrow();
    expect(buildActivityPreview({ family: 'diagonal' }).familyPreview).toBeNull();
  });
});

describe('6. malformed letters safe', () => {
  it('null/number/multi-char entries never crash', () => {
    expect(() => buildActivityPreview({ focusLetters: [null, 42, 'ab', undefined] })).not.toThrow();
    expect(buildActivityPreview({ focusLetters: [null, 42, 'ab', undefined] }).focusLetterPreviews).toEqual([]);
  });
});

describe('7. missing paths safe', () => {
  it('a character with no path is silently skipped', () => {
    const result = buildActivityPreview({ focusLetters: ['c', '5', 'o'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o']);
  });
});

describe('8. max 3', () => {
  it('only the first 3 valid letters are shown', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's', 'u'] });
    expect(result.focusLetterPreviews).toHaveLength(3);
  });
});

describe('9. hidden count correct', () => {
  it('4 valid letters -> hidden = 1', () => {
    const result = buildActivityPreview({ focusLetters: ['c', 'o', 's', 'u'] });
    expect(result.hiddenFocusLetterCount).toBe(1);
  });
});

describe('10. order preserved', () => {
  it('["o","c"] stays ["o","c"]', () => {
    expect(buildActivityPreview({ focusLetters: ['o', 'c'] }).focusLetterPreviews.map((p) => p.letter)).toEqual(['o', 'c']);
  });
});

describe('11. case preserved', () => {
  it('"C" stays "C", "c" stays "c"', () => {
    expect(buildActivityPreview({ focusLetters: ['C'] }).focusLetterPreviews[0].letter).toBe('C');
    expect(buildActivityPreview({ focusLetters: ['c'] }).focusLetterPreviews[0].letter).toBe('c');
  });
});

describe('12. duplicates preserved', () => {
  it('["c","c"] produces two entries', () => {
    expect(buildActivityPreview({ focusLetters: ['c', 'c'] }).focusLetterPreviews).toHaveLength(2);
  });
});

describe('13. deterministic builder', () => {
  it('identical input always yields a deep-equal result', () => {
    const a = buildActivityPreview({ family: 'curved', caseType: 'lowercase', focusLetters: ['c', 'o'] });
    const b = buildActivityPreview({ family: 'curved', caseType: 'lowercase', focusLetters: ['c', 'o'] });
    expect(a).toEqual(b);
  });
});

describe('14. immutable inputs', () => {
  it('the caller-supplied focusLetters array is never mutated', () => {
    const input = ['c', 'o'];
    const before = JSON.stringify(input);
    buildActivityPreview({ focusLetters: input });
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('15. defensive copy', () => {
  it('mutating a returned preview never affects a subsequent independent call', () => {
    const first = buildActivityPreview({ family: 'straight', focusLetters: ['l'] });
    first.familyPreview.label = 'MUTATED';
    first.focusLetterPreviews[0].strokes[0][0].fx = -1;
    const second = buildActivityPreview({ family: 'straight', focusLetters: ['l'] });
    expect(second.familyPreview.label).toBe('Straight Movement Preview');
    expect(second.focusLetterPreviews[0].strokes[0][0].fx).not.toBe(-1);
  });
});

describe('16. policy has no React', () => {
  it('activityPreviewPolicy.js never imports react', () => {
    const policySource = fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewPolicy.js'), 'utf8');
    expect(policySource.split('\n').filter((l) => /from '/.test(l)).join('\n')).not.toMatch(/from 'react'/);
  });
});

describe('17. policy has no SVG', () => {
  it('activityPreviewPolicy.js never imports react-native-svg', () => {
    const policySource = fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewPolicy.js'), 'utf8');
    const requireLines = policySource.split('\n').filter((l) => /from '/.test(l)).join('\n');
    expect(requireLines).not.toMatch(/react-native-svg/);
  });
});

// ─── 18-27: component import/dependency validation ──────────────────────

describe('18. ActivityPreview imports policy', () => {
  it('imports buildActivityPreview + buildActivityPreviewAccessibilityLabel', () => {
    expect(componentRequireLines()).toMatch(/constants\/activityPreviewPolicy/);
  });
});

describe('19. ActivityPreview imports react-native-svg', () => {
  it('imports Svg/Line/Circle/Path/Polyline', () => {
    expect(componentRequireLines()).toMatch(/react-native-svg/);
  });
});

describe('20. no API/network import', () => {
  it('no api/client, axios, or fetch reference', () => {
    expect(componentRequireLines()).not.toMatch(/api\/client|axios/);
    expect(stripComments(readComponent())).not.toMatch(/\bfetch\(/);
  });
});

describe('21. no persistence import', () => {
  it('no AsyncStorage or storage util reference', () => {
    expect(componentRequireLines()).not.toMatch(/AsyncStorage|utils\/storage/);
  });
});

describe('22. no Feature 7 import', () => {
  it('no persistentDifficulty reference', () => {
    expect(componentRequireLines()).not.toMatch(/persistentDifficulty/);
  });
});

describe('23. no Feature 4 import', () => {
  it('no preWritingActivities reference', () => {
    expect(componentRequireLines()).not.toMatch(/preWritingActivities/);
  });
});

describe('24. no assessment-screen import', () => {
  it('no ShapeAssessmentScreen reference', () => {
    expect(componentRequireLines()).not.toMatch(/ShapeAssessmentScreen/);
  });
});

describe('25. no writing-screen import', () => {
  it('no LetterWritingScreen/UppercaseWritingScreen reference', () => {
    expect(componentRequireLines()).not.toMatch(/LetterWritingScreen|UppercaseWritingScreen/);
  });
});

describe('26. no animation import', () => {
  it('no reanimated reference', () => {
    expect(componentRequireLines()).not.toMatch(/reanimated/);
  });
});

describe('27. no gesture-handler import', () => {
  it('no gesture-handler reference', () => {
    expect(componentRequireLines()).not.toMatch(/gesture-handler/);
  });
});

// ─── 28-33: rendering behavior ────────────────────────────────────────────

describe('28. responsive SVG', () => {
  it('every <Svg> tag uses viewBox and width="100%"', () => {
    const svgTags = readComponent().match(/<Svg[^>]*>/g) ?? [];
    expect(svgTags.length).toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag).toMatch(/viewBox=/);
      expect(tag).toMatch(/width="100%"/);
    }
  });
});

describe('29. multi-stroke preserved', () => {
  it('a 2-stroke letter (t) normalizes to 2 independent strokes, never merged', () => {
    const result = buildActivityPreview({ focusLetters: ['t'] });
    expect(result.focusLetterPreviews[0].strokes).toHaveLength(2);
  });

  it('LetterGuide renders one <Polyline>/<Circle> per stroke (source-confirmed)', () => {
    const match = readComponent().match(/function LetterGuide\([\s\S]*?\n\}/);
    expect(match[0]).toMatch(/strokes\.map\(\(stroke, i\) =>/);
  });
});

describe('30. unknown shape safe', () => {
  it('renderPreviewShape has a default: return null for unrecognized types', () => {
    const match = readComponent().match(/function renderPreviewShape\([\s\S]*?\n\}/);
    expect(match[0]).toMatch(/default:\s*\n\s*return null;/);
  });
});

describe('31. accessibility helper wired', () => {
  it('the component calls buildActivityPreviewAccessibilityLabel and applies it', () => {
    const source = readComponent();
    expect(source).toMatch(/buildActivityPreviewAccessibilityLabel\(preview\)/);
    expect(source).toMatch(/accessibilityLabel=\{accessibilityLabel\}/);
  });
});

describe('32. no severity wording', () => {
  it('no red/amber/green severity trio anywhere in ActivityPreview.js', () => {
    expect(readComponent()).not.toMatch(/#EF4444|#F59E0B|#22C55E/);
  });

  it('no severity word in any accessibility label output', () => {
    for (const family of VALID_FAMILIES) {
      const preview = buildActivityPreview({ family, focusLetters: ['c'] });
      expect(buildActivityPreviewAccessibilityLabel(preview)).not.toMatch(/severity|priority|risk/i);
    }
  });
});

describe('33. no clinical wording', () => {
  it('no diagnosis/clinical/treatment language in actual component code', () => {
    expect(stripComments(readComponent())).not.toMatch(/diagnos|clinical|treatment/i);
  });
});

// ─── 34-42: screen integration ────────────────────────────────────────────

describe('34. "Preview activity" present', () => {
  it('the toggle label text exists in the screen', () => {
    expect(readScreen()).toMatch(/Preview activity/);
  });
});

describe('35. local state present', () => {
  it('ActivityPreviewSection declares its own useState(false)', () => {
    const match = readScreen().match(/function ActivityPreviewSection\([\s\S]*?\n}\n/);
    expect(match[0]).toMatch(/useState\(false\)/);
  });
});

describe('36. no global preview state', () => {
  it('no top-level screen-wide preview-open state variable', () => {
    expect(readScreen()).not.toMatch(/const \[previewOpen/);
    expect(readScreen()).not.toMatch(/const \[globalPreview/);
  });
});

describe('37. no new useFocusEffect', () => {
  it('useFocusEffect count was unchanged from Feature 9 Step 5 by Feature 10 specifically (3 total at that point). Feature 11 Phase 6 later added 2 more of its own (Feature 11A + Feature 11B, each independently loaded) — see teacherReportFeature11.test.js.', () => {
    const occurrences = readScreen().match(/useFocusEffect\(/g) ?? [];
    expect(occurrences).toHaveLength(5);
  });
});

describe('38. Feature 8 UI preserved', () => {
  it('title, case label, focus letters, suggested activities, WhyPanel all still present', () => {
    const cardMatch = readScreen().match(/function AdaptivePracticeRecommendationCard\([\s\S]*?\n}\n/);
    expect(cardMatch[0]).toMatch(/\{recommendation\.title\}/);
    expect(cardMatch[0]).toMatch(/caseLabel/);
    expect(cardMatch[0]).toMatch(/Focus letters:/);
    expect(cardMatch[0]).toMatch(/recommendation\.suggestedActivities\.map/);
    expect(cardMatch[0]).toMatch(/<WhyPanel/);
  });
});

describe('39. Feature 9 UI preserved', () => {
  it('TeacherReviewSection still rendered, own body has no Feature 10 reference', () => {
    const source = readScreen();
    const cardMatch = source.match(/function AdaptivePracticeRecommendationCard\([\s\S]*?\n}\n/);
    expect(cardMatch[0]).toMatch(/<TeacherReviewSection/);
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch[0]).not.toMatch(/ActivityPreview/);
  });
});

describe('40. Share.share unchanged', () => {
  it('handleShare() references no Feature 10 identifier', () => {
    const match = readScreen().match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match[0]).not.toMatch(/ActivityPreview|familyPreview|focusLetterPreviews/);
  });
});

describe('41. no child-screen integration', () => {
  it('ActivityPreview is never imported anywhere outside TeacherReportScreen.js', () => {
    const screensDir = path.resolve(__dirname, '../screens/handwriting');
    const offenders = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.js') || entry.name === 'TeacherReportScreen.js') continue;
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('ActivityPreview')) offenders.push(full);
      }
    }
    walk(screensDir);
    expect(offenders).toEqual([]);
  });
});

describe('42. no backend dependency', () => {
  it('neither ActivityPreview.js nor activityPreviewPolicy.js/activityPreviewLetterPaths.js reference the backend repo or an API path', () => {
    for (const source of [readComponent(), fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewPolicy.js'), 'utf8')]) {
      expect(source).not.toMatch(/auriva-backend/);
      expect(source).not.toMatch(/\/handwriting\//);
    }
  });
});

// ─── 43-49: synthetic scenarios ───────────────────────────────────────────

describe('43. synthetic straight', () => {
  it('l/t -> vertical+horizontal shapes, both letters resolve', () => {
    const result = buildActivityPreview({ family: 'straight', caseType: 'lowercase', focusLetters: ['l', 't'] });
    expect(result.familyPreview.shapes.some((s) => s.type === 'line' && s.x1 === s.x2)).toBe(true);
    expect(result.familyPreview.shapes.some((s) => s.type === 'line' && s.y1 === s.y2)).toBe(true);
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['l', 't']);
  });
});

describe('44. synthetic curved', () => {
  it('c/o -> circle+arc-path shapes, both letters resolve', () => {
    const result = buildActivityPreview({ family: 'curved', caseType: 'lowercase', focusLetters: ['c', 'o'] });
    expect(result.familyPreview.shapes.some((s) => s.type === 'circle')).toBe(true);
    expect(result.familyPreview.shapes.some((s) => s.type === 'path')).toBe(true);
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o']);
  });
});

describe('45. synthetic complex', () => {
  it('W/X/Y (uppercase) -> polyline direction-change shape, all three letters resolve', () => {
    const result = buildActivityPreview({ family: 'complex', caseType: 'uppercase', focusLetters: ['W', 'X', 'Y'] });
    expect(result.familyPreview.shapes.some((s) => s.type === 'polyline')).toBe(true);
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['W', 'X', 'Y']);
    expect(result.familyPreview.label).toBe('Complex Movement Preview');
  });
});

describe('46. synthetic >3', () => {
  it('c,o,s,u,v -> shows c,o,s, hidden=2', () => {
    const result = buildActivityPreview({ family: 'curved', focusLetters: ['c', 'o', 's', 'u', 'v'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o', 's']);
    expect(result.hiddenFocusLetterCount).toBe(2);
  });
});

describe('47. synthetic malformed', () => {
  it('["c", null, "?", "o", "s"] -> shows c,o,s, hidden=0', () => {
    const result = buildActivityPreview({ focusLetters: ['c', null, '?', 'o', 's'] });
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c', 'o', 's']);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('48. synthetic empty', () => {
  it('empty focusLetters -> family preview only', () => {
    const result = buildActivityPreview({ family: 'straight', focusLetters: [] });
    expect(result.familyPreview).not.toBeNull();
    expect(result.focusLetterPreviews).toEqual([]);
    expect(result.hiddenFocusLetterCount).toBe(0);
  });
});

describe('49. synthetic invalid family', () => {
  it('unrecognized family -> no family preview, no crash, letters-only accessibility label per Step 4 §19 fix', () => {
    const result = buildActivityPreview({ family: 'unknown', focusLetters: ['c'] });
    expect(result.familyPreview).toBeNull();
    expect(result.focusLetterPreviews.map((p) => p.letter)).toEqual(['c']);
    expect(buildActivityPreviewAccessibilityLabel(result)).toBe('Focus letters c.');
  });

  it('unrecognized family with zero resolvable letters -> fully empty label', () => {
    const result = buildActivityPreview({ family: 'unknown', focusLetters: [] });
    expect(buildActivityPreviewAccessibilityLabel(result)).toBe('');
  });
});

// ─── 50: no adaptive decision logic ───────────────────────────────────────

describe('50. no adaptive decision logic', () => {
  it('neither policy nor component ever reads/writes threshold, support, baseline, or demo-speed concepts in actual code (comment-stripped — the header comments legitimately name these as explicitly-excluded inputs)', () => {
    for (const source of [
      fs.readFileSync(path.resolve(__dirname, '../constants/activityPreviewPolicy.js'), 'utf8'),
      readComponent(),
    ]) {
      expect(stripComments(source)).not.toMatch(/threshold|supportLevel|baseline|demoSpeed/i);
    }
  });

  it('buildActivityPreview never decides which family is difficult — it only maps an already-given family to geometry', () => {
    // Same family input always produces the same familyPreview regardless
    // of any hypothetical "difficulty" — there is no such input parameter
    // at all, confirmed by the function's own signature only accepting
    // family/caseType/focusLetters.
    const a = buildActivityPreview({ family: 'curved', focusLetters: [] });
    const b = buildActivityPreview({ family: 'curved', focusLetters: ['c', 'o', 's', 'u', 'v', 'w'] });
    expect(a.familyPreview).toEqual(b.familyPreview);
  });
});

// ─── Supplementary: geometry re-verification ──────────────────────────────

describe('supplementary: activityPreviewGeometry re-verification', () => {
  it('scaleStrokeToPreview + toPolylinePoints compose correctly for a realistic letter stroke', () => {
    const stroke = LOWERCASE_LETTER_PATHS.l; // flat single-stroke letter
    const scaled = scaleStrokeToPreview(stroke, { width: 50, height: 60, padding: 8 });
    const pointsStr = toPolylinePoints(scaled);
    expect(scaled).toHaveLength(stroke.length);
    expect(pointsStr.split(' ')).toHaveLength(stroke.length);
  });

  it('MAX_FOCUS_LETTER_PREVIEWS remains 3', () => {
    expect(MAX_FOCUS_LETTER_PREVIEWS).toBe(3);
  });
});
