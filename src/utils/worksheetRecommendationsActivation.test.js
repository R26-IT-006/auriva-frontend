// Feature 8 Step 4 — source-scan proof that TeacherReportScreen.js wires
// Feature 8 correctly. This project has no RN component-testing
// infrastructure (see jest.config.js's own comment, and the identical note
// in every prior feature's own frontend-activation step) — screen-level
// wiring is proven the same way every previous feature proved it:
// source-scan assertions against the exact screen file, plus the already-
// exhaustive pure-helper tests in worksheetRecommendations.test.js.

const fs = require('fs');
const path = require('path');

function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}

describe('TeacherReportScreen.js imports the Feature 8 fetch utility and helpers', () => {
  it('imports fetchWorksheetRecommendations/formatCaseType/shouldShowFocusLetters/getWorksheetRecommendationEmptyState', () => {
    const source = readScreen();
    expect(source).toMatch(/import \{\s*fetchWorksheetRecommendations, formatCaseType, shouldShowFocusLetters, getWorksheetRecommendationEmptyState,?\s*\} from '.*utils\/worksheetRecommendations';/);
  });
});

describe('Feature 8 fetch happens once per (screen-focus, student), not per card', () => {
  it('the worksheet-recommendations useFocusEffect depends only on [student]', () => {
    const source = readScreen();
    const match = source.match(/fetchWorksheetRecommendations\(\{ studentId: student\?\.sid \}\)[\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
  });

  it('the fetch effect never depends on attempt/expand/local UI state', () => {
    const source = readScreen();
    const match = source.match(/const \[worksheetRecs, setWorksheetRecs\][\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/\bopen\b|\bexpanded\b/);
  });
});

describe('Stale-response safety (spec §43)', () => {
  it('the Feature 8 fetch effect uses the same active-flag guard as the main report effect', () => {
    const source = readScreen();
    const match = source.match(/const \[worksheetRecs, setWorksheetRecs\][\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/let active = true/);
    expect(match[0]).toMatch(/if \(!active\) return;/);
    expect(match[0]).toMatch(/return \(\) => \{ active = false; \};/);
  });
});

describe('No direct Feature 7 fetch from the frontend (spec §25)', () => {
  it('the screen never references a persistent-difficulty endpoint/constant', () => {
    const source = readScreen();
    expect(source).not.toMatch(/PERSISTENT_DIFFICULTY|persistent-difficulty/);
  });

  it('the screen calls the worksheet-recommendations fetch exactly once (single call site)', () => {
    const source = readScreen();
    const occurrences = source.match(/fetchWorksheetRecommendations\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});

describe('No recommendation content duplicated in the frontend (spec §26)', () => {
  it('the screen never hardcodes straight/curved/complex worksheet activity text', () => {
    const source = readScreen();
    expect(source).not.toMatch(/Circle tracing exercises|Vertical line tracing|Zigzag tracing/);
  });
});

describe('No severity/priority applied to Feature 8 recommendations (spec §6/§18)', () => {
  it('AdaptivePracticeRecommendationCard never reads a .priority field', () => {
    const source = readScreen();
    const match = source.match(/function AdaptivePracticeRecommendationCard[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/\.priority/);
    expect(match[0]).not.toMatch(/high|medium|low/i);
  });

  it('the apc (AdaptivePracticeRecommendationCard) stylesheet uses one flat accent color, never a severity palette keyed by priority', () => {
    const source = readScreen();
    const match = source.match(/const apc = StyleSheet\.create\(\{[\s\S]*?\n\}\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/#EF4444|#F59E0B|#22C55E/); // the red/amber/green trio RecommendationCard's priority colors use
  });
});

describe('No teacher-action affordances added (spec §28/§29)', () => {
  it('the progress report no longer renders the adaptive subsection or its actions', () => {
    expect(readScreen()).not.toMatch(/>Adaptive Practice Recommendations</);
  });
});

describe('Existing Share.share() summary left untouched (spec §30)', () => {
  it('handleShare() never references worksheetRecs/recommendationType/focusLetters', () => {
    const source = readScreen();
    const match = source.match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/worksheetRecs|recommendationType|focusLetters/);
  });
});

describe('Independent per-card expand/collapse (spec §50)', () => {
  it('AdaptivePracticeRecommendationCard reuses WhyPanel (own internal state) rather than a shared boolean', () => {
    const source = readScreen();
    const match = source.match(/function AdaptivePracticeRecommendationCard[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/<WhyPanel label="Why this recommendation\?" explanation=\{recommendation\.rationale\} \/>/);
    // No screen-level useState managing this card's own open/closed state.
    expect(match[0]).not.toMatch(/useState/);
  });
});

describe('No raw diagnostics rendered (spec §38)', () => {
  it('the removed subsection cannot expose raw diagnostics', () => {
    expect(readScreen()).not.toMatch(/>Adaptive Practice Recommendations</);
  });
});

describe('Backend order preserved (spec §26/§45) — no local sort', () => {
  it('the retained recommendation data path still never sorts backend results', () => {
    const source = readScreen();
    expect(source).not.toMatch(/worksheetRecs\.recommendations\.sort/);
  });
});
