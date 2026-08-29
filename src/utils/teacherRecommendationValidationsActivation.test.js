// Feature 9 Step 5 — source-scan proof that TeacherReportScreen.js wires
// the Teacher Review UI correctly. This project has no RN
// component-testing infrastructure (see jest.config.js's own comment) —
// screen-level wiring is proven the same way every previous feature's own
// frontend activation step already proved it: source-scan assertions
// against the exact screen file, plus the already-exhaustive pure-helper
// tests in teacherRecommendationValidations.test.js.

const fs = require('fs');
const path = require('path');

function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}

describe('32. Feature 8 recommendations fetch still happens exactly once', () => {
  it('fetchWorksheetRecommendations( appears exactly once in the screen source', () => {
    const source = readScreen();
    const occurrences = source.match(/fetchWorksheetRecommendations\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('33. history fetch once', () => {
  it('fetchTeacherRecommendationValidationHistory( appears exactly once (single call site, screen-level)', () => {
    const source = readScreen();
    const occurrences = source.match(/fetchTeacherRecommendationValidationHistory\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('the history fetch effect depends only on [student], never per-card', () => {
    const source = readScreen();
    const match = source.match(/const \[teacherHistory, setTeacherHistory\][\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
  });
});

describe('34. current-state calls keyed by fingerprint', () => {
  it('fetchTeacherRecommendationValidationState is called with recommendationFingerprint as part of its arguments', () => {
    const source = readScreen();
    const match = source.match(/fetchTeacherRecommendationValidationState\(\{[\s\S]{0,120}?recommendationFingerprint[\s\S]{0,40}?\}\)/);
    expect(match).not.toBeNull();
  });

  it('the current-state effect dependency array includes studentId, caseType, family, and recommendationFingerprint', () => {
    const source = readScreen();
    const match = source.match(/\}, \[studentId, caseType, family, recommendationFingerprint\]\);/);
    expect(match).not.toBeNull();
  });
});

describe('35/36/37. no automatic POST — submitTeacherRecommendationValidation only reachable from an explicit button press', () => {
  it('submitTeacherRecommendationValidation( appears exactly once, inside handleAction', () => {
    const source = readScreen();
    const occurrences = source.match(/submitTeacherRecommendationValidation\(/g) ?? [];
    expect(occurrences).toHaveLength(1);

    const handleActionMatch = source.match(/async function handleAction\(validation\) \{[\s\S]*?\n {2}\}/);
    expect(handleActionMatch).not.toBeNull();
    expect(handleActionMatch[0]).toMatch(/submitTeacherRecommendationValidation\(/);
  });

  it('handleAction is invoked only from onPress handlers, never from a useEffect/useFocusEffect body', () => {
    const source = readScreen();
    const onPressCalls = source.match(/onPress=\{\(\) => handleAction\('(confirmed|dismissed)'\)\}/g) ?? [];
    expect(onPressCalls.length).toBeGreaterThanOrEqual(2); // Confirm + Not-suitable buttons

    // No effect body anywhere calls handleAction(...).
    const effectBodies = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/g) ?? [];
    for (const body of effectBodies) {
      expect(body).not.toMatch(/handleAction\(/);
    }
  });

  it('neither submit function is ever called from a useFocusEffect body', () => {
    const source = readScreen();
    const focusEffectBodies = source.match(/useFocusEffect\(\s*useCallback\(\(\) => \{[\s\S]*?\n {4}\}, \[student\]\)\s*\n {2}\);/g) ?? [];
    expect(focusEffectBodies.length).toBeGreaterThan(0);
    for (const body of focusEffectBodies) {
      expect(body).not.toMatch(/submitTeacherRecommendationValidation\(/);
    }
  });
});

describe('38. stale-response guard on the current-state fetch', () => {
  it('the TeacherReviewSection effect uses a local active flag AND the mountedRef guard', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).toMatch(/let active = true/);
    expect(trsMatch[0]).toMatch(/mountedRef\.current/);
    expect(trsMatch[0]).toMatch(/return \(\) => \{ active = false; \};/);
  });
});

describe('39/40. Feature 8 and Feature 9 history loading states are independent', () => {
  it('worksheetRecs and teacherHistory are separate useState declarations', () => {
    const source = readScreen();
    expect(source).toMatch(/const \[worksheetRecs, setWorksheetRecs\] = useState/);
    expect(source).toMatch(/const \[teacherHistory, setTeacherHistory\] = useState/);
  });

  it('they are populated by two separate useFocusEffect blocks, neither referencing the other\'s setter', () => {
    const source = readScreen();
    const worksheetEffect = source.match(/setWorksheetRecs\(\{ status: 'loading'[\s\S]*?\}, \[student\]\)\s*\n {2}\);/);
    const historyEffect = source.match(/setTeacherHistory\(\{ status: 'loading'[\s\S]*?\}, \[student\]\)\s*\n {2}\);/);
    expect(worksheetEffect).not.toBeNull();
    expect(historyEffect).not.toBeNull();
    expect(worksheetEffect[0]).not.toMatch(/setTeacherHistory/);
    expect(historyEffect[0]).not.toMatch(/setWorksheetRecs/);
  });
});

describe('41. Share.share() left untouched by Feature 9', () => {
  it('handleShare() never references teacherHistory/recommendationFingerprint/validation/teacherNote', () => {
    const source = readScreen();
    const match = source.match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/teacherHistory|recommendationFingerprint|teacherNote|submitTeacherRecommendationValidation/);
  });
});

describe('42. existing general recommendations (RecommendationCard) untouched', () => {
  it('the report.recommendations render block is unchanged, no Feature 9 identifiers inside it', () => {
    const source = readScreen();
    const match = source.match(/\{report\.recommendations\.map\(\(rec, i\) => \([\s\S]*?\)\)\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/teacherHistory|TeacherReviewSection|recommendationFingerprint/);
  });
});

describe('43. collection flow (unrelated /teacher-validation routes) untouched', () => {
  it('the screen never references the collection-mode TEACHER_VALIDATION endpoint constant', () => {
    const source = readScreen();
    expect(source).not.toMatch(/ENDPOINTS\.TEACHER_VALIDATION\b/);
  });

  it('the screen never hardcodes a bare /teacher-validation path string (goes through the utility/ENDPOINTS layer only)', () => {
    const source = readScreen();
    expect(source).not.toMatch(/['"]\/handwriting\/teacher-validation['"]/);
  });
});

describe('No raw fingerprint ever rendered in JSX text (spec §37/§63)', () => {
  it('TeacherReviewSection never renders recommendationFingerprint as visible text', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    // The prop is read (to fetch/submit) but never interpolated inside a <Text> node.
    expect(trsMatch[0]).not.toMatch(/<Text[^>]*>\s*\{?\s*recommendationFingerprint/);
  });
});

describe('No severity/priority wording introduced by Teacher Review styling (spec §54)', () => {
  it('the trs (Teacher Review section) stylesheet never uses the red/amber/green severity trio', () => {
    const source = readScreen();
    const match = source.match(/const trs = StyleSheet\.create\(\{[\s\S]*?\n\}\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/#EF4444|#F59E0B|#22C55E/);
  });

  it('the Teacher Review UI never renders Correct/Incorrect/Approve/Reject text', () => {
    const source = readScreen();
    const trsMatch = source.match(/function TeacherReviewSection\([\s\S]*?\n}\n/);
    expect(trsMatch).not.toBeNull();
    expect(trsMatch[0]).not.toMatch(/>Correct</);
    expect(trsMatch[0]).not.toMatch(/>Incorrect</);
    expect(trsMatch[0]).not.toMatch(/>Approve</);
    expect(trsMatch[0]).not.toMatch(/>Reject</);
  });
});

describe('Recommendation never suppressed by teacher judgement (spec §31/§41)', () => {
  it('the progress report no longer renders recommendation cards to suppress', () => {
    const source = readScreen();
    expect(source).not.toMatch(/>Adaptive Practice Recommendations</);
    expect(source).not.toMatch(/worksheetRecs\.recommendations\.map/);
  });
});
