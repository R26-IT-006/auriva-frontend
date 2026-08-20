import fs from 'fs';
import path from 'path';

// Feature 11 Phase 6 — TeacherReportScreen.js's Feature 11A/11B sections
// can't be mounted under this repo's plain-node jest config (imports
// 'react-native'); verified by source-text assertion, the same established
// technique teacherReportLoadGuard.test.js already uses for this exact
// file. Behavioral coverage for the underlying pure logic (state
// transitions, label content, direction semantics, error/empty handling)
// lives in motorClusterProfile.test.js and letterMotorState.test.js — this
// file covers the SCREEN-level integration properties: independence,
// read-only guarantee, terminology separation, and rendering wiring.

const screenPath = path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js');
const screen = fs.readFileSync(screenPath, 'utf8');

const motorClusterUtil = fs.readFileSync(path.resolve(__dirname, './motorClusterProfile.js'), 'utf8');
const letterMotorUtil  = fs.readFileSync(path.resolve(__dirname, './letterMotorState.js'), 'utf8');

// Strips // and /* */ comments before a "banned word/pattern" assertion —
// several assertions below check that FORBIDDEN language never appears in
// actually-rendered UI text, but this file's own explanatory comments
// legitimately mention those same forbidden words while documenting that
// they must never appear (e.g. "NEVER shows State A/B here.") — without
// stripping comments those bans would trip on the developer note
// explaining the ban, not on real UI text.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return source.slice(start, end);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Feature 11A renders independently
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature 11A section renders independently', () => {
  it('has its own state and its own useFocusEffect, not gated on the main report/loading flags', () => {
    const fn = slice(screen, 'const [motorClusterProfile, setMotorClusterProfile]', 'const [letterMotorLatest');
    expect(fn).toContain('useFocusEffect');
    expect(fn).toContain('fetchMotorClusterProfile(student?.sid)');
    expect(fn).not.toMatch(/if \(loading\)|if \(!report\)/);
  });

  it('MotorClusterProfileCard is rendered unconditionally in the main scroll body (not behind a Feature 11B check)', () => {
    expect(screen).toContain('<MotorClusterProfileCard result={motorClusterProfile} />');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2-5. Evidence-accumulating vs State A/B gating (3/7/10/14/17/20)
// ═══════════════════════════════════════════════════════════════════════════

describe('State A/B is only ever rendered from the found branch, gated strictly on latest.status', () => {
  const cardFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');

  it('the "found" branch (persisted state, only ever created at 14/17/20 server-side) is the only place displayName/state is shown as the current state', () => {
    const foundBranch = slice(cardFn, "if (latest.status === 'found') {", "// latest.status === 'not_found'");
    expect(foundBranch).toContain('Current Letter Motor State');
    expect(foundBranch).toContain('currentState.displayName');
  });

  it('the not_found branch (evidence still accumulating — covers 3/7/10, and any coverage below the first milestone) never renders "Current Letter Motor State" or a state displayName', () => {
    const notFoundBranch = slice(cardFn, "// latest.status === 'not_found'", 'const f11 = StyleSheet.create');
    const codeOnly = stripComments(notFoundBranch);
    expect(codeOnly).not.toContain('Current Letter Motor State');
    expect(codeOnly).not.toContain('currentState.displayName');
    expect(codeOnly).not.toMatch(/State A|State B/);
    expect(notFoundBranch).toContain('Motor evidence is still being collected as the student masters letters.');
  });

  it('never shows "No data" / "Assessment failed" / "Unable to classify" for the accumulating state', () => {
    const notFoundBranch = slice(cardFn, "// latest.status === 'not_found'", 'const f11 = StyleSheet.create');
    expect(notFoundBranch).not.toMatch(/no data|assessment failed|unable to classify/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. State A/B never mapped to good/bad
// ═══════════════════════════════════════════════════════════════════════════

describe('State A/B is never mapped to good/bad/high/low severity language', () => {
  const cardFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');

  it('never applies the good/moderate/needs status tokens or statusToken() to a Letter Motor State value', () => {
    expect(cardFn).not.toMatch(/statusToken\(/);
    expect(cardFn).not.toMatch(/T\.good|T\.moderate|T\.needs/);
  });

  it('never uses good/bad/high/low/strong/weak/impaired language anywhere in the Feature 11B card\'s actual code (not counting explanatory comments)', () => {
    const fullBlock = slice(screen, '// ─── Feature 11B — Letter Motor Development', 'const f11 = StyleSheet.create');
    const lower = stripComments(fullBlock).toLowerCase();
    expect(lower).not.toMatch(/\b(good|bad|high ability|low ability|strong|weak|impaired|normal|mild asd|severe asd|diagnostic)\b/);
  });

  it('Feature 11A card never uses good/bad/diagnostic severity language either (not counting explanatory comments)', () => {
    const fullBlock = slice(screen, '// ─── Feature 11A — Initial Shape Motor Profile', '// ─── Feature 11B');
    const lower = stripComments(fullBlock).toLowerCase();
    expect(lower).not.toMatch(/\b(good|bad|high ability|low ability|mild asd|severe asd|diagnostic subtype)\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. History ordered chronologically (trusts backend order, never re-sorts/reverses)
// ═══════════════════════════════════════════════════════════════════════════

describe('History rendering trusts the backend\'s chronological order', () => {
  it('LetterMotorHistoryList maps over the history array directly, with no .sort()/.reverse() call', () => {
    const fn = slice(screen, 'function LetterMotorHistoryList(', 'function LetterMotorDevelopmentCard(');
    expect(fn).toContain('history.map(');
    expect(fn).not.toMatch(/\.sort\(|\.reverse\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Coverage shown as evidence coverage, not confidence
// ═══════════════════════════════════════════════════════════════════════════

describe('Coverage is presented as an evidence count, never a confidence percentage', () => {
  it('CoverageBadge renders "N / 20 reference letters", never a % or "confidence" string', () => {
    const fn = slice(screen, 'function CoverageBadge(', 'function LetterMotorMetricTiles(');
    expect(fn).toContain('/ 20 reference letters');
    expect(fn).not.toMatch(/%|confidence/i);
  });

  it('no part of the Feature 11B card\'s actual code computes or renders an arbitrary confidence percentage (comments legitimately explain the ban)', () => {
    const fullBlock = slice(screen, '// ─── Feature 11B — Letter Motor Development', 'const f11 = StyleSheet.create');
    expect(stripComments(fullBlock)).not.toMatch(/confidence/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12/13. DTW and Speed CV direction semantics
// ═══════════════════════════════════════════════════════════════════════════

describe('DTW and Speed CV direction semantics are represented correctly', () => {
  it('METRIC_LABELS captions state "lower = ..." for both dtw and speedCv (see letterMotorState.test.js for the full assertion)', () => {
    expect(letterMotorUtil).toMatch(/dtw:\s*\{[\s\S]*?caption:\s*'Lower value = closer path match'/);
    expect(letterMotorUtil).toMatch(/speedCv:\s*\{[\s\S]*?caption:\s*'Lower value = more consistent speed'/);
  });

  it('LetterMotorMetricTiles renders both captions, never a red/green color based on the value', () => {
    const fn = slice(screen, 'function LetterMotorMetricTiles(', 'function LetterMotorHistoryList(');
    expect(fn).toContain('METRIC_LABELS.dtw.caption');
    expect(fn).toContain('METRIC_LABELS.speedCv.caption');
    expect(fn).not.toMatch(/#22C55E|#EF4444|#15803D|#B91C1C/); // no green/red hex literals
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Feature 11A and 11B labels visually distinct
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature 11A and Feature 11B are visually and textually distinct', () => {
  it('use different SectionCard titles and different accent colors', () => {
    expect(screen).toContain('title="Initial Shape Motor Profile"');
    expect(screen).toContain('title="Letter Motor Development"');
    expect(screen).toContain('accentColor="#7C3AED"'); // Feature 11A
    expect(screen).toContain('accentColor="#0891B2"'); // Feature 11B
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Feature 11A cluster never compared directly with Letter State
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature 11A and Feature 11B results are never cross-compared', () => {
  it('the two cards are rendered back-to-back in the ScrollView with no shared variable/condition between them', () => {
    // The render call sites themselves (not the component definitions,
    // which live elsewhere in the file) — proves the two are two
    // independent, side-by-side JSX elements, never one conditioned on or
    // interpolated with the other's data.
    const tag1 = '<MotorClusterProfileCard result={motorClusterProfile} />';
    const tag2Start = '<LetterMotorDevelopmentCard';
    const start = screen.indexOf(tag1);
    expect(start).toBeGreaterThan(-1);
    const between = screen.slice(start + tag1.length, screen.indexOf(tag2Start, start));
    // Only whitespace/JSX-comment-braces between the two render calls — no
    // shared variable, condition, or string interpolation.
    const codeOnly = stripComments(between).replace(/[{}]/g, '').trim();
    expect(codeOnly).toBe('');
  });

  it('no string in either component literally says "changed to" / "improved from" / "Cluster X to Y" style comparison text', () => {
    const fullBlock = slice(screen, '// ─── Feature 11A — Initial Shape Motor Profile', 'const f11 = StyleSheet.create');
    expect(fullBlock).not.toMatch(/changed to|improved from|cluster \d+ to/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. Empty history handled
// ═══════════════════════════════════════════════════════════════════════════

describe('Empty history is handled gracefully', () => {
  it('LetterMotorHistoryList returns null (renders nothing) for an empty/missing history array', () => {
    const fn = slice(screen, 'function LetterMotorHistoryList(', 'function LetterMotorDevelopmentCard(');
    expect(fn).toMatch(/if \(!history \|\| history\.length === 0\) return null;/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. API failure handled — see also motorClusterProfile.test.js / letterMotorState.test.js
// ═══════════════════════════════════════════════════════════════════════════

describe('API failure is handled distinctly from empty/loading states', () => {
  it('Feature 11A renders a distinct message for status "unavailable"', () => {
    const fn = slice(screen, 'function MotorClusterProfileCard(', '// ─── Feature 11B');
    expect(fn).toContain("status === 'unavailable'");
    expect(fn).toContain('Motor profile is temporarily unavailable');
  });

  it('Feature 11B renders a distinct message for latest.status "unavailable"', () => {
    const fn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');
    expect(fn).toContain("latest.status === 'unavailable'");
    expect(fn).toContain('Letter motor development data is temporarily unavailable');
  });

  it('one feature failing does not gate the other — Feature 11A card has no dependency on letterMotor* state, and vice versa', () => {
    const motorClusterFn = slice(screen, 'function MotorClusterProfileCard(', '// ─── Feature 11B');
    expect(motorClusterFn).not.toMatch(/letterMotor/i);
    const letterMotorFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');
    expect(letterMotorFn).not.toMatch(/motorClusterProfile/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18/19. Read-only guarantee — no POST/prediction/mutation call anywhere
// ═══════════════════════════════════════════════════════════════════════════

describe('Read-only guarantee — opening/refreshing TeacherReport never mutates or predicts', () => {
  it('motorClusterProfile.js only ever calls client.get, never post/put/patch/delete', () => {
    expect(motorClusterUtil).toMatch(/client\.get\(/);
    expect(motorClusterUtil).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });

  it('letterMotorState.js only ever calls client.get, never post/put/patch/delete', () => {
    expect(letterMotorUtil).toMatch(/client\.get\(/g);
    expect(letterMotorUtil).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });

  it('neither Feature 11 util ever references the mastery/milestone/prediction backend concepts (evidence they call only the 4 read endpoints, never a write path)', () => {
    for (const source of [motorClusterUtil, letterMotorUtil]) {
      expect(source).not.toMatch(/checkAndTriggerMilestones|onLetterMastered|predictLetterMotorState|LETTER_COMPLETE/);
    }
  });

  it('the TeacherReportScreen Feature 11 sections never call client.post/put/patch/delete', () => {
    const fullBlock = slice(screen, '// ─── Feature 11A — Initial Shape Motor Profile', 'const f11 = StyleSheet.create');
    expect(fullBlock).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });

  it('the Feature 11 fetch effects only ever call the 4 read (fetchX) wrappers, never a mutation', () => {
    const effectsBlock = slice(screen, '// ── Feature 11A — Initial Shape Motor Profile', 'async function handleShare()');
    expect(effectsBlock).toContain('fetchMotorClusterProfile(');
    expect(effectsBlock).toContain('fetchLatestLetterMotorState(');
    expect(effectsBlock).toContain('fetchLetterMotorStateHistory(');
    expect(effectsBlock).toContain('fetchLetterMotorEvidenceTrend(');
    expect(effectsBlock).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. Collection-mode data not used
// ═══════════════════════════════════════════════════════════════════════════

describe('Collection mode is never referenced by the Feature 11 report code', () => {
  it('neither Feature 11 util file references collection_mode/collectionMode', () => {
    expect(motorClusterUtil).not.toMatch(/collection_mode|collectionMode/);
    expect(letterMotorUtil).not.toMatch(/collection_mode|collectionMode/);
  });

  it('the Feature 11 sections of TeacherReportScreen.js never reference collection_mode/collectionMode', () => {
    const fullBlock = slice(screen, '// ─── Feature 11A — Initial Shape Motor Profile', 'const f11 = StyleSheet.create');
    expect(fullBlock).not.toMatch(/collection_mode|collectionMode/);
  });
});
