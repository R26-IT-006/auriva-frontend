import fs from 'fs';
import path from 'path';

// Feature 11 Phase 6 — TeacherReportScreen.js's Feature 11A/11B sections
// can't be mounted under this repo's plain-node jest config (imports
// 'react-native'); verified by source-text assertion, the same established
// technique teacherReportLoadGuard.test.js already uses for this exact
// file. Behavioral coverage for the underlying pure logic (state
// transitions, label content, direction semantics, error/empty handling)
// lives in motorBaseline.test.js and letterMotorState.test.js — this
// file covers the SCREEN-level integration properties: independence,
// read-only guarantee, terminology separation, and rendering wiring.

const screenPath = path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js');
const screen = fs.readFileSync(screenPath, 'utf8');

const motorClusterUtil = fs.readFileSync(path.resolve(__dirname, './motorClusterProfile.js'), 'utf8');
const letterMotorUtil  = fs.readFileSync(path.resolve(__dirname, './letterMotorState.js'), 'utf8');
const patternLabels    = fs.readFileSync(path.resolve(__dirname, './letterMotorPatternLabels.js'), 'utf8');

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

/**
 * ONE function's body, by brace matching.
 *
 * Preferred over slice() whenever the assertion is about a single component:
 * a marker-to-marker slice silently widens as unrelated code is added
 * between the two markers, so it can start failing for something that is not
 * the component under test.
 */
function functionBody(source, startMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);

  // Skip the PARAMETER LIST first. A destructured signature — ({ history }) —
  // opens a brace of its own, and matching from that one returns the
  // signature instead of the body.
  let i = source.indexOf('(', start);
  let paren = 0;
  for (; i < source.length; i++) {
    if (source[i] === '(') paren += 1;
    else if (source[i] === ')') { paren -= 1; if (paren === 0) { i += 1; break; } }
  }

  i = source.indexOf('{', i);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Feature 11A renders independently
// ═══════════════════════════════════════════════════════════════════════════

describe('Initial Motor Baseline Summary section renders independently', () => {
  it('has its own state and its own useFocusEffect, not gated on the main report/loading flags', () => {
    const fn = slice(screen, 'const [motorBaseline, setMotorBaseline]', 'const [letterMotorLatest');
    expect(fn).toContain('useFocusEffect');
    expect(fn).toContain('fetchMotorBaseline({ studentId: student?.sid })');
    expect(fn).not.toMatch(/if \(loading\)|if \(!report\)/);
  });

  it('InitialMotorBaselineSummaryCard is rendered unconditionally in the main scroll body (not behind a Feature 11B check)', () => {
    expect(screen).toContain('<InitialMotorBaselineSummaryCard result={motorBaseline} assessment={assessmentEvidence} />');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2-5. Evidence-accumulating vs State A/B gating (3/7/10/14/17/20)
// ═══════════════════════════════════════════════════════════════════════════

describe('State A/B is only ever rendered from the found branch, gated strictly on latest.status', () => {
  const cardFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');

  it('the "found" branch (persisted state, only ever created at 14/17/20 server-side) is the only place displayName/state is shown as the current state', () => {
    const foundBranch = slice(cardFn, "if (latest.status === 'found') {", "// latest.status === 'not_found'");
    expect(foundBranch).toContain('Current Letter Motor Pattern');
    expect(foundBranch).toContain('currentState.patternLabel');
    // The persisted display_name must never be rendered.
    expect(foundBranch).not.toContain('currentState.displayName');
  });

  it('the not_found branch (evidence still accumulating — covers 3/7/10, and any coverage below the first milestone) never renders "Current Letter Motor State" or a state displayName', () => {
    const notFoundBranch = slice(cardFn, "// latest.status === 'not_found'", 'const f11 = StyleSheet.create');
    const codeOnly = stripComments(notFoundBranch);
    expect(codeOnly).not.toContain('Current Letter Motor State');
    expect(codeOnly).not.toContain('currentState.displayName');
    expect(codeOnly).not.toMatch(/State A|State B/);
    // S2 — the approved not-reached wording, shared with the periodic report and the PDF.
    expect(notFoundBranch).toContain('More eligible handwriting evidence is needed before a writing pattern can be described.');
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

  it('the baseline summary card never uses good/bad/diagnostic severity language either (not counting explanatory comments)', () => {
    const fullBlock = slice(screen, '// ─── Initial Motor Baseline Summary', '// ─── Feature 11B');
    const lower = stripComments(fullBlock).toLowerCase();
    expect(lower).not.toMatch(/\b(good|bad|high ability|low ability|mild asd|severe asd|diagnostic subtype)\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. History ordered chronologically (trusts backend order, never re-sorts/reverses)
// ═══════════════════════════════════════════════════════════════════════════

describe('History rendering trusts the backend\'s chronological order', () => {
  it('LetterMotorHistoryList maps over the history array directly, with no .sort()/.reverse() call', () => {
    // THIS component's body only. A marker-to-marker slice spanned ~780 lines
    // and swept in unrelated helpers that may legitimately sort their own data
    // (e.g. picking the latest worksheet submission by date).
    const fn = functionBody(screen, 'function LetterMotorHistoryList(');
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
    expect(screen).toContain('title="Initial Handwriting Skills Summary"');
    expect(screen).toContain('title="Letter Motor Patterns"');
    expect(screen).toContain('accentColor="#7C3AED"'); // Initial Motor Baseline Summary
    expect(screen).toContain('accentColor="#0891B2"'); // Feature 11B
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Feature 11A cluster never compared directly with Letter State
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature 11A and Feature 11B results are never cross-compared', () => {
  it('the two cards are independent siblings — neither conditioned on the other', () => {
    // They are no longer physically adjacent: the agreed report order places
    // Writing Check between the Initial Handwriting Skills Summary and the
    // Letter Motor Patterns card. Adjacency was only ever a proxy for the
    // real property, which is that neither card reads, conditions on, or
    // interpolates the other's data.
    const tag1 = '<InitialMotorBaselineSummaryCard result={motorBaseline} assessment={assessmentEvidence} />';
    const tag2 = '<LetterMotorDevelopmentCard';
    const i1 = screen.indexOf(tag1);
    const i2 = screen.indexOf(tag2, i1);
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);

    // Each is a self-contained JSX element fed only by its own state.
    expect(screen).toMatch(/<InitialMotorBaselineSummaryCard result=\{motorBaseline\} assessment=\{assessmentEvidence\} \/>/);
    // Neither card's props mention the other's state.
    const card1Props = tag1;
    expect(card1Props).not.toMatch(/letterMotor|latest|trend|evaluations/);
    const card2Start = screen.indexOf(tag2);
    const card2Props = screen.slice(card2Start, screen.indexOf('/>', card2Start));
    expect(card2Props).not.toMatch(/motorBaseline|assessmentEvidence/);
  });

  it('no string in either component literally says "changed to" / "improved from" / "Cluster X to Y" style comparison text', () => {
    const fullBlock = slice(screen, '// ─── Initial Motor Baseline Summary', 'const f11 = StyleSheet.create');
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
  it('the baseline summary renders distinct messages for "baseline_not_found" and for a read failure', () => {
    const fn = slice(screen, 'function InitialMotorBaselineSummaryCard(', 'const imb = StyleSheet.create');
    expect(fn).toContain("status === 'baseline_not_found'");
    expect(fn).toContain('Complete the initial motor assessment to see the baseline summary');
    expect(fn).toContain('Initial motor baseline is temporarily unavailable');
  });

  it('Feature 11B renders a distinct message for latest.status "unavailable"', () => {
    const fn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');
    expect(fn).toContain("latest.status === 'unavailable'");
    expect(fn).toContain('Letter motor pattern data is temporarily unavailable');
  });

  it('one feature failing does not gate the other — the baseline summary card has no dependency on letterMotor* state, and vice versa', () => {
    const summaryFn = slice(screen, 'function InitialMotorBaselineSummaryCard(', 'const imb = StyleSheet.create');
    expect(summaryFn).not.toMatch(/letterMotor/i);
    const letterMotorFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');
    expect(letterMotorFn).not.toMatch(/motorBaseline/);
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

  it('the TeacherReportScreen baseline-summary + Feature 11B sections never call client.post/put/patch/delete', () => {
    const fullBlock = slice(screen, '// ─── Initial Motor Baseline Summary', 'const f11 = StyleSheet.create');
    expect(fullBlock).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });

  it('the Feature 11 fetch effects only ever call the 4 read (fetchX) wrappers, never a mutation', () => {
    const effectsBlock = slice(screen, '// ── Initial Motor Baseline Summary', 'async function handleShare()');
    expect(effectsBlock).toContain('fetchMotorBaseline(');
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

  it('the baseline-summary + Feature 11B sections of TeacherReportScreen.js never reference collection_mode/collectionMode', () => {
    const fullBlock = slice(screen, '// ─── Initial Motor Baseline Summary', 'const f11 = StyleSheet.create');
    expect(fullBlock).not.toMatch(/collection_mode|collectionMode/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. Legacy experimental L2 shape-motor clustering is RETAINED but INACTIVE
// ═══════════════════════════════════════════════════════════════════════════

describe('legacy experimental L2 shape-motor clustering is retained but inactive', () => {
  it('the L2 util file still exists and its prediction wrapper is unchanged', () => {
    expect(fs.existsSync(path.resolve(__dirname, './motorClusterProfile.js'))).toBe(true);
    expect(motorClusterUtil).toMatch(/export function normalizeMotorClusterResponse/);
    expect(motorClusterUtil).toMatch(/export async function fetchMotorClusterProfile/);
    expect(motorClusterUtil).toMatch(/ENDPOINTS\.MOTOR_CLUSTER\(studentId\)/);
  });

  it('the L2 endpoint constant is still defined, so the legacy route stays reachable', () => {
    const api = fs.readFileSync(path.resolve(__dirname, '../constants/api.js'), 'utf8');
    expect(api).toMatch(/MOTOR_CLUSTER:\s*\(studentId\)\s*=>\s*`\/handwriting\/motor-cluster\/\$\{studentId\}`/);
  });

  it('the retained L2 integration points carry the exact legacy-experimental marker', () => {
    // Normalizes comment leaders (`//`, ` * `) and line wrapping so the
    // marker can be asserted verbatim regardless of how it is wrapped.
    const normalize = (src) => src.replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
    const MARKER = 'Legacy experimental L2 shape-motor clustering. Retained for research/reference '
      + 'compatibility only. It is not used by the current teacher-facing baseline summary and does '
      + 'not influence adaptive progression.';

    for (const source of [
      motorClusterUtil,
      fs.readFileSync(path.resolve(__dirname, '../constants/api.js'), 'utf8'),
    ]) {
      expect(normalize(source)).toContain(MARKER);
    }
  });

  // The core of this refactor: retained in the repo, not wired into the
  // active teacher-facing flow.
  it('TeacherReportScreen never imports, calls, or renders the L2 prediction', () => {
    const code = stripComments(screen);
    expect(code).not.toMatch(/fetchMotorClusterProfile/);
    expect(code).not.toMatch(/MotorClusterProfileCard/);
    expect(code).not.toMatch(/from '\.\.\/\.\.\/\.\.\/utils\/motorClusterProfile'/);
    expect(code).not.toMatch(/ENDPOINTS\.MOTOR_CLUSTER/);
  });

  it('TeacherReportScreen fetches the baseline endpoint instead', () => {
    const code = stripComments(screen);
    expect(code).toMatch(/import \{ fetchMotorBaseline \} from '\.\.\/\.\.\/\.\.\/utils\/motorBaseline'/);
    expect(code).toMatch(/fetchMotorBaseline\(\{ studentId: student\?\.sid \}\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. No cluster/profile terminology reaches the teacher report
// ═══════════════════════════════════════════════════════════════════════════

describe('teacher report shows no L2 profile output', () => {
  it('the rendered screen code contains no Profile A / Profile B / Distinct Motor Profile label', () => {
    const code = stripComments(screen);
    expect(code).not.toMatch(/Profile A|Profile B|Distinct Motor Profile|PROFILE_/);
  });

  it('the baseline summary card renders no cluster id, centroid distance, confidence or probability', () => {
    const fn = stripComments(slice(screen, 'function InitialMotorBaselineSummaryCard(', 'const imb = StyleSheet.create'));
    expect(fn).not.toMatch(/clusterId|cluster_id|centroid|separationMargin|nearestDistance|confidence|probability/i);
  });

  it('the baseline summary card renders the four measured values and the required disclosure', () => {
    const fn = slice(screen, 'function InitialMotorBaselineSummaryCard(', 'const imb = StyleSheet.create');
    expect(fn).toContain('Overall Motor Score');
    expect(fn).toContain('Movement-family baseline');
    expect(fn).toContain('FAMILY_ROW_LABELS.map('); // family rows are data-driven
    expect(screen).toContain("['straight', 'Straight']");
    expect(screen).toContain("['curved',   'Curved']");
    expect(screen).toContain("['complex',  'Complex']");
    expect(fn).toContain('summary?.description');
    expect(fn).toMatch(/not diagnostic or ASD-severity measures/);
  });

  it('the periodic report presentation uses the baseline-summary heading, not cluster terminology', () => {
    const section = fs.readFileSync(
      path.resolve(__dirname, '../components/handwriting/reports/PeriodicReportSection.js'), 'utf8');
    const pdf = fs.readFileSync(path.resolve(__dirname, './periodicReportPdf.js'), 'utf8');
    expect(section).toContain('title="Initial Handwriting Skills Summary"');
    expect(pdf).toContain("'Initial Handwriting Skills Summary'"); // renamed in the Periodic Report redesign
    for (const source of [stripComments(section), stripComments(pdf)]) {
      expect(source).not.toMatch(/Profile A|Profile B|Distinct Motor Profile/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 23. Child-facing screens carry no L2 output and no baseline summary
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 24. Pattern labels: state_code is the sole source; display_name is never shown
// ═══════════════════════════════════════════════════════════════════════════

describe('teacher-facing pattern labels come only from state_code', () => {
  const pdf = fs.readFileSync(path.resolve(__dirname, './periodicReportPdf.js'), 'utf8');
  const section = fs.readFileSync(
    path.resolve(__dirname, '../components/handwriting/reports/PeriodicReportSection.js'), 'utf8');
  const surfaces = { 'TeacherReportScreen.js': screen, 'periodicReportPdf.js': pdf, 'PeriodicReportSection.js': section };

  it.each(Object.keys(surfaces))('%s never renders the persisted display_name', (name) => {
    const code = stripComments(surfaces[name]);
    expect(code).not.toMatch(/display_name/);
    expect(code).not.toMatch(/\.displayName/);
  });

  it('all three code surfaces derive the label through the shared label helpers', () => {
    // S2 — the PDF and the periodic section now go through
    // getLetterMotorPresentation(), which itself calls
    // getLetterMotorPatternLabel() for the assigned case. Neither builds a
    // label of its own.
    expect(stripComments(pdf)).toMatch(/getLetterMotorPresentation\(/);
    expect(stripComments(section)).toMatch(/getLetterMotorPresentation\(/);
    expect(stripComments(patternLabels)).toMatch(/getLetterMotorPatternLabel\(stateCode\)/);
    // The screen consumes the already-mapped `patternLabel` from the normalizer.
    expect(stripComments(screen)).toMatch(/patternLabel/);
    expect(stripComments(letterMotorUtil)).toMatch(/getLetterMotorPatternLabel\(row\.state_code\)/);
  });

  it('no teacher-facing surface contains the legacy "Letter Motor State A/B" wording', () => {
    for (const [name, source] of Object.entries(surfaces)) {
      expect(stripComments(source)).not.toMatch(/Letter Motor State [AB]/);
    }
  });

  it('no teacher-facing surface contains the old "Letter Motor Development" heading', () => {
    for (const source of Object.values(surfaces)) {
      expect(stripComments(source)).not.toMatch(/Letter Motor Development/);
    }
  });

  it('no raw internal state code can be rendered', () => {
    for (const source of Object.values(surfaces)) {
      expect(stripComments(source)).not.toMatch(/['"`]LETTER_STATE_[AB]['"`]/);
    }
  });

  it('the nominal-label caption accompanies the pattern label on every surface that shows one', () => {
    expect(stripComments(screen)).toMatch(/LETTER_MOTOR_PATTERN_CAPTION/);
    expect(stripComments(pdf)).toMatch(/LETTER_MOTOR_PATTERN_CAPTION/);
    expect(stripComments(section)).toMatch(/LETTER_MOTOR_PATTERN_CAPTION/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 25. Outside-reference-range wording, and scoped banned-vocabulary checks
// ═══════════════════════════════════════════════════════════════════════════

describe('outside-reference-range presentation', () => {
  const cardFn = slice(screen, 'function LetterMotorDevelopmentCard(', 'const f11 = StyleSheet.create');

  it('renders the approved heading and supporting text', () => {
    expect(cardFn).toContain('Letter motor pattern not reported');
    // S2 — the approved outside-range wording, identical on all three surfaces.
    expect(cardFn).toMatch(/differs from the data represented by the/);
    expect(cardFn).toMatch(/so no writing pattern was assigned/);
  });

  it('never shows a pattern label in the not-reported branch', () => {
    const branch = slice(cardFn, "if (evaluationStatus === 'outside_reference_range') {", 'return (\n    <SectionCard title="Letter Motor Patterns"');
    expect(stripComments(branch)).not.toMatch(/patternLabel|Pattern A|Pattern B/);
  });

  // Scoped deliberately: model status is permitted in metadata and in the
  // collapsible technical-details panel, but never in main teacher-facing text.
  it('main teacher-facing strings carry no banned vocabulary', () => {
    const visible = (stripComments(cardFn).match(/(?:>|["'`])\s*[A-Z][^<>{}"'`]{12,}/g) ?? []).join(' ');
    expect(visible).not.toMatch(/\b(experimental|pilot|abnormal|anomaly|impaired|severe|risk|confidence|probability)\b/i);
  });

  it('technical details remain available for model status', () => {
    expect(cardFn).toContain('Technical details');
  });
});

describe('child-facing screens never display L2 output or the baseline summary', () => {
  const childScreens = [
    '../screens/handwriting/LetterHomeScreen.js',
    '../screens/handwriting/AssessmentCompleteScreen.js',
  ];

  it.each(childScreens)('%s contains no cluster/profile/baseline-summary output', (relPath) => {
    const abs = path.resolve(__dirname, relPath);
    if (!fs.existsSync(abs)) return; // never assert against a file that does not exist
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    expect(code).not.toMatch(/motorClusterProfile|fetchMotorClusterProfile|MOTOR_CLUSTER/);
    expect(code).not.toMatch(/Profile A|Profile B|Distinct Motor Profile|PROFILE_/);
    expect(code).not.toMatch(/InitialMotorBaselineSummaryCard|Initial Motor Baseline Summary|Initial Handwriting Skills Summary/);
    expect(code).not.toMatch(/relative_summary|tie_groups/);
    // No letter-motor pattern information may reach a child screen either.
    expect(code).not.toMatch(/Letter Motor Pattern|patternLabel|LETTER_STATE_|outside_reference_range|not reported/);
  });
});
