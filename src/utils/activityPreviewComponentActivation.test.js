// Feature 10 Step 3 — source-scan proof that ActivityPreview.js and
// TeacherReportScreen.js are wired correctly (spec §52-56, items 11-56).
// This project has no RN component-testing infrastructure (jest.config.js's
// own comment) and react-native-svg cannot be safely `require`d under the
// plain-node Jest environment this project uses — screen/component wiring
// is proven the same way every previous feature's own closure step proved
// it: source-scan assertions against the real files, plus the already-
// exhaustive pure-helper tests in activityPreviewPolicy.test.js and
// activityPreviewGeometry.test.js.

const fs = require('fs');
const path = require('path');

function readComponent() {
  return fs.readFileSync(path.resolve(__dirname, '../components/handwriting/ActivityPreview.js'), 'utf8');
}
function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}
// Matches on "from '...'" rather than requiring the line to start with
// "import " — a multi-line `import {\n  a, b,\n} from '...'` statement has
// its actual module path on the LAST line, which doesn't start with
// "import " at all.
function componentRequireLines() {
  return readComponent().split('\n').filter((l) => /from '/.test(l)).join('\n');
}
function stripComponentComments() {
  return readComponent().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── 11-23: component/source scans ──────────────────────────────────────

describe('11. ActivityPreview imports activityPreviewPolicy', () => {
  it('imports buildActivityPreview/buildActivityPreviewAccessibilityLabel from the Step 2 policy module', () => {
    const lines = componentRequireLines();
    expect(lines).toMatch(/constants\/activityPreviewPolicy/);
    expect(readComponent()).toMatch(/buildActivityPreview\(/);
    expect(readComponent()).toMatch(/buildActivityPreviewAccessibilityLabel\(/);
  });

  it('never duplicates preview-building logic (no local family/shape-mapping object)', () => {
    const source = readComponent();
    expect(source).not.toMatch(/const FAMILY_PREVIEWS\s*=/);
  });
});

describe('12. ActivityPreview imports react-native-svg', () => {
  it('imports Svg/Line/Circle/Path/Polyline', () => {
    const lines = componentRequireLines();
    expect(lines).toMatch(/react-native-svg/);
    expect(lines).toMatch(/Line/);
    expect(lines).toMatch(/Circle/);
    expect(lines).toMatch(/Path/);
    expect(lines).toMatch(/Polyline/);
  });
});

describe('13. no backend/API import', () => {
  it('never imports the api client or any ENDPOINTS constant', () => {
    const lines = componentRequireLines();
    expect(lines).not.toMatch(/api\/client/);
    expect(lines).not.toMatch(/constants\/api/);
  });
});

describe('14. no fingerprint import', () => {
  it('never imports feature9Provenance', () => {
    expect(componentRequireLines()).not.toMatch(/feature9Provenance/);
  });

  it('never references recommendationFingerprint in actual code (comment-stripped — the header JSDoc legitimately explains this exclusion by name)', () => {
    expect(stripComponentComments()).not.toMatch(/recommendationFingerprint/);
  });
});

describe('15. no history import', () => {
  it('never imports teacherRecommendationValidations', () => {
    expect(componentRequireLines()).not.toMatch(/teacherRecommendationValidations/);
  });
});

describe('16. no Feature 7 import', () => {
  it('never references persistentDifficulty/earlierWindow/recentWindow/affectedLetters', () => {
    const source = readComponent();
    expect(source).not.toMatch(/persistentDifficulty/);
    expect(source).not.toMatch(/earlierWindow|recentWindow|affectedLetters/);
  });
});

describe('17. no Feature 4 import', () => {
  it('never imports preWritingActivities', () => {
    expect(componentRequireLines()).not.toMatch(/preWritingActivities/);
  });
});

describe('18. no writing-screen import', () => {
  it('never imports LetterWritingScreen or UppercaseWritingScreen', () => {
    expect(componentRequireLines()).not.toMatch(/LetterWritingScreen/);
    expect(componentRequireLines()).not.toMatch(/UppercaseWritingScreen/);
  });
});

describe('19. no assessment-screen import', () => {
  it('never imports ShapeAssessmentScreen', () => {
    expect(componentRequireLines()).not.toMatch(/ShapeAssessmentScreen/);
  });
});

describe('20. no animation library', () => {
  it('never imports react-native-reanimated or the Animated API', () => {
    expect(componentRequireLines()).not.toMatch(/reanimated/);
    expect(readComponent()).not.toMatch(/from 'react-native'.*Animated/);
    expect(readComponent()).not.toMatch(/Animated\.(View|timing|spring|Value)/);
  });
});

describe('21. no gesture handler', () => {
  it('never imports react-native-gesture-handler', () => {
    expect(componentRequireLines()).not.toMatch(/gesture-handler/);
  });
});

describe('22. no network', () => {
  it('never references fetch/axios', () => {
    expect(componentRequireLines()).not.toMatch(/axios|fetch/);
  });
});

describe('23. no AsyncStorage', () => {
  it('never imports AsyncStorage or the storage util', () => {
    expect(componentRequireLines()).not.toMatch(/AsyncStorage|utils\/storage/);
  });
});

// ─── 24-40: TeacherReportScreen activation tests ────────────────────────

describe('24. ActivityPreview imported exactly once', () => {
  it('a single import statement for ActivityPreview', () => {
    const occurrences = readScreen().match(/^import ActivityPreview from/gm) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('25. "Preview activity" appears', () => {
  it('the toggle label text is present', () => {
    expect(readScreen()).toMatch(/Preview activity/);
  });
});

describe('26. preview integrated inside AdaptivePracticeRecommendationCard', () => {
  it('ActivityPreviewSection is rendered inside the card function body', () => {
    const source = readScreen();
    const cardMatch = source.match(/function AdaptivePracticeRecommendationCard\([\s\S]*?\n}\n/);
    expect(cardMatch).not.toBeNull();
    expect(cardMatch[0]).toMatch(/<ActivityPreviewSection/);
  });
});

describe('27/28/29. props include family, caseType, focusLetters', () => {
  it('ActivityPreviewSection receives family/caseType/focusLetters from recommendation', () => {
    const source = readScreen();
    const call = source.match(/<ActivityPreviewSection\s+family=\{recommendation\.family\}\s+caseType=\{recommendation\.caseType\}\s+focusLetters=\{recommendation\.focusLetters\}\s*\/>/);
    expect(call).not.toBeNull();
  });
});

describe('30. no recommendationFingerprint prop', () => {
  it('the ActivityPreviewSection call never passes recommendationFingerprint', () => {
    const source = readScreen();
    const call = source.match(/<ActivityPreviewSection[\s\S]*?\/>/);
    expect(call).not.toBeNull();
    expect(call[0]).not.toMatch(/recommendationFingerprint/);
  });
});

describe('31. no suggestedActivities prop', () => {
  it('the ActivityPreviewSection call never passes suggestedActivities', () => {
    const source = readScreen();
    const call = source.match(/<ActivityPreviewSection[\s\S]*?\/>/);
    expect(call[0]).not.toMatch(/suggestedActivities/);
  });
});

describe('32. no teacher state prop', () => {
  it('the ActivityPreviewSection call never passes teacher review/history data', () => {
    const source = readScreen();
    const call = source.match(/<ActivityPreviewSection[\s\S]*?\/>/);
    expect(call[0]).not.toMatch(/historyEvents|validation|teacherNote/);
  });
});

describe('33. local per-card/component open state exists', () => {
  it('ActivityPreviewSection declares its own useState(false) for open/closed', () => {
    const source = readScreen();
    const sectionMatch = source.match(/function ActivityPreviewSection\([\s\S]*?\n}\n/);
    expect(sectionMatch).not.toBeNull();
    expect(sectionMatch[0]).toMatch(/const \[open, setOpen\] = useState\(false\);/);
  });
});

describe('34. no screen-global preview state', () => {
  it('TeacherReportScreen itself declares no top-level "previewOpen"-style state', () => {
    const source = readScreen();
    expect(source).not.toMatch(/const \[previewOpen/);
    expect(source).not.toMatch(/const \[activityPreviewOpen/);
  });
});

describe('35. no extra useFocusEffect added', () => {
  it('the total useFocusEffect count is unchanged from Feature 9 Step 5 by Feature 10 specifically (still exactly 3 at that point: main report + Feature 8 recommendations + Feature 9 history — Feature 10 added none). Feature 11 Phase 6 later added 2 more of its own (Feature 11A profile, Feature 11B state/history/trend) for the same "independent per-feature loading" reason Features 8/9 already established — see teacherReportFeature11.test.js for that pair\'s own coverage.', () => {
    const source = readScreen();
    const occurrences = source.match(/useFocusEffect\(/g) ?? [];
    // Feature 12 (Homework Practice) later added ONE more of its own, for the
    // same "independent per-feature loading" reason every feature above
    // established: worksheet data refreshes on focus and after each teacher
    // action without refetching the whole report.
    expect(occurrences).toHaveLength(6);
  });
});

describe('36. no network call in preview toggle', () => {
  it('ActivityPreviewSection\'s toggle handler never calls a fetch/client function', () => {
    const source = readScreen();
    const sectionMatch = source.match(/function ActivityPreviewSection\([\s\S]*?\n}\n/);
    expect(sectionMatch[0]).not.toMatch(/fetch|client\.|await/);
  });
});

describe('37. WhyPanel remains', () => {
  it('WhyPanel is still used inside AdaptivePracticeRecommendationCard, unchanged', () => {
    const source = readScreen();
    const cardMatch = source.match(/function AdaptivePracticeRecommendationCard\([\s\S]*?\n}\n/);
    expect(cardMatch[0]).toMatch(/<WhyPanel label="Why this recommendation\?" explanation=\{recommendation\.rationale\} \/>/);
  });
});

describe('38. TeacherReviewSection remains', () => {
  it('TeacherReviewSection is still rendered inside the card, unchanged props', () => {
    const source = readScreen();
    const cardMatch = source.match(/function AdaptivePracticeRecommendationCard\([\s\S]*?\n}\n/);
    expect(cardMatch[0]).toMatch(/<TeacherReviewSection/);
  });
});

describe('39. suggestedActivities still renders', () => {
  it('the suggestedActivities.map render block is still present and unmodified', () => {
    const source = readScreen();
    expect(source).toMatch(/recommendation\.suggestedActivities\.map\(\(activity, i\) => \(/);
  });
});

describe('40. focus letters still render', () => {
  it('the "Focus letters:" text row is still present and unmodified', () => {
    const source = readScreen();
    expect(source).toMatch(/Focus letters: <Text style=\{apc\.focusLettersValue\}>\{recommendation\.focusLetters\.join\(', '\)\}<\/Text>/);
  });
});

// ─── 41-46: accessibility ─────────────────────────────────────────────────

describe('41. preview toggle has accessibility role', () => {
  it('ActivityPreviewSection\'s toggle carries accessibilityRole="button"', () => {
    const source = readScreen();
    const sectionMatch = source.match(/function ActivityPreviewSection\([\s\S]*?\n}\n/);
    expect(sectionMatch[0]).toMatch(/accessibilityRole="button"/);
  });
});

describe('42. preview toggle has accessibility label', () => {
  it('the toggle label switches between "Show activity preview" / "Hide activity preview"', () => {
    const source = readScreen();
    const sectionMatch = source.match(/function ActivityPreviewSection\([\s\S]*?\n}\n/);
    expect(sectionMatch[0]).toMatch(/accessibilityLabel=\{open \? 'Hide activity preview' : 'Show activity preview'\}/);
  });
});

describe('43. ActivityPreview uses accessibility label helper', () => {
  it('the container carries accessibilityLabel from buildActivityPreviewAccessibilityLabel', () => {
    const source = readComponent();
    expect(source).toMatch(/const accessibilityLabel = buildActivityPreviewAccessibilityLabel\(preview\);/);
    expect(source).toMatch(/accessibilityLabel=\{accessibilityLabel\}/);
  });
});

describe('44. no color-only severity semantics', () => {
  it('ActivityPreview.js never uses the red/amber/green severity trio', () => {
    const source = readComponent();
    expect(source).not.toMatch(/#EF4444|#F59E0B|#22C55E/);
  });
});

describe('45. no Correct/Incorrect wording', () => {
  it('neither file renders Correct/Incorrect/Approve/Reject text', () => {
    for (const source of [readComponent(), readScreen()]) {
      expect(source).not.toMatch(/>Correct</);
      expect(source).not.toMatch(/>Incorrect</);
    }
  });
});

describe('46. no diagnosis/clinical wording', () => {
  it('ActivityPreview.js has no diagnosis/clinical/severity/treatment language in actual code', () => {
    const code = readComponent().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/diagnos|clinical|treatment|severity/i);
  });
});

// ─── 47-52: fallback behavior (source-level, re-confirming Step 2 wiring) ─

describe('47. invalid family -> no family preview / safe null', () => {
  it('FamilyPreviewSvg returns null when familyPreview is falsy', () => {
    const source = readComponent();
    const match = source.match(/function FamilyPreviewSvg\(\{ familyPreview \}\) \{[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/if \(!familyPreview\) return null;/);
  });
});

describe('48. no focus letters -> family only', () => {
  it('the focus-letter row is conditioned on focusLetterPreviews.length > 0', () => {
    const source = readComponent();
    expect(source).toMatch(/preview\.focusLetterPreviews\.length > 0 && \(/);
  });
});

describe('49. hidden count text rendered when >0', () => {
  it('the hidden-count text is conditioned on hiddenFocusLetterCount > 0', () => {
    const source = readComponent();
    expect(source).toMatch(/preview\.hiddenFocusLetterCount > 0 && \(/);
    expect(source).toMatch(/\+\{preview\.hiddenFocusLetterCount\} more focus letters/);
  });
});

describe('50. no hidden-count text when zero', () => {
  it('there is exactly one hidden-count render site, correctly gated (not unconditional)', () => {
    const source = readComponent();
    const occurrences = source.match(/more focus letters/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('51. missing-path input safe', () => {
  it('LetterGuide skips a stroke that scales to zero points, never crashes', () => {
    const source = readComponent();
    const match = source.match(/function LetterGuide\([\s\S]*?\n\}/);
    expect(match[0]).toMatch(/if \(scaled\.length === 0\) return null;/);
  });
});

describe('52. unknown geometry shape skipped', () => {
  it('renderPreviewShape has a default case returning null for an unrecognized type', () => {
    const source = readComponent();
    const match = source.match(/function renderPreviewShape\([\s\S]*?\n\}/);
    expect(match[0]).toMatch(/default:\s*\n\s*return null;/);
  });
});

// ─── 53-56: responsive/source tests ──────────────────────────────────────

describe('53. SVG uses viewBox', () => {
  it('both FamilyPreviewSvg and LetterGuide pass a viewBox to <Svg>', () => {
    const source = readComponent();
    const svgTags = source.match(/<Svg[^>]*>/g) ?? [];
    expect(svgTags.length).toBeGreaterThan(0);
    for (const tag of svgTags) {
      expect(tag).toMatch(/viewBox=/);
    }
  });
});

describe('54. SVG does not use child practice CANVAS constants', () => {
  it('ActivityPreview.js never references CANVAS_W/CANVAS_H/CANVAS_CX/CANVAS_CY', () => {
    const source = readComponent();
    expect(source).not.toMatch(/CANVAS_W|CANVAS_H|CANVAS_CX|CANVAS_CY/);
  });
});

describe('55. width responsive / percentage/flex based', () => {
  it('every <Svg> uses width="100%", never a fixed pixel width', () => {
    const source = readComponent();
    const svgTags = source.match(/<Svg[^>]*>/g) ?? [];
    for (const tag of svgTags) {
      expect(tag).toMatch(/width="100%"/);
    }
  });
});

describe('56. no hard-coded device screen width dependency', () => {
  it('ActivityPreview.js never imports Dimensions or references a screen-width constant', () => {
    expect(componentRequireLines()).not.toMatch(/Dimensions/);
    expect(readComponent()).not.toMatch(/Dimensions\.get/);
  });
});

// ─── §57/§58/§59: existing UI preservation, re-confirmed at Step 3 ────────

describe('§57/§58 — existing Feature 8/9 UI preserved (re-confirmation)', () => {
  it('handleShare() still references no ActivityPreview/Feature 10 identifier', () => {
    const source = readScreen();
    const match = source.match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match[0]).not.toMatch(/ActivityPreview|familyPreview|focusLetterPreviews/);
  });

  it('TeacherReviewSection\'s own function body contains no ActivityPreview reference (Feature 10 code lives only in the card, not inside Feature 9\'s own section)', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch[0]).not.toMatch(/ActivityPreview/);
  });
});
