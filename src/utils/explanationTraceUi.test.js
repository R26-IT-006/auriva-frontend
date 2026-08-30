// Rule-based explanation UI — source-text assertions.
//
// TeacherReportScreen.js / StudentDetailScreen.js cannot be mounted under this
// repo's plain-node jest config (they import 'react-native'); verified by
// source-text assertion, the same established technique
// teacherReportFeature11.test.js and teacherReportLoadGuard.test.js use.
//
// Proves: the misleading "% match" score display is gone, both "Why" panels
// exist and are collapsed by default, no internal identifier is rendered, and
// no explanation string reaches a child-facing screen.

// thresholdTrace.js imports the shared api client; mocked exactly as
// motorBaseline.test.js and familyThresholds.test.js already do.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { normalizeThresholdTraceResponse } from './thresholdTrace';

const teacherReport = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/reports/TeacherReportScreen.js'), 'utf8');
const studentDetail = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/students/StudentDetailScreen.js'), 'utf8');
const traceUtil = fs.readFileSync(path.resolve(__dirname, './thresholdTrace.js'), 'utf8');
const offlineEngine = fs.readFileSync(path.resolve(__dirname, './explainabilityEngine.js'), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return source.slice(start, end);
}

// ─── L. The misleading score display is gone ────────────────────────────────

describe('rule activation score is no longer shown as a percentage match', () => {
  const code = stripComments(teacherReport);

  it('never renders the score with a % sign', () => {
    expect(code).not.toMatch(/\{analysis\.confidence\}%/);
    expect(code).not.toMatch(/secondaryDifficulty\.confidence\}%/);
  });

  it('never labels the score "match" or "confidence" in rendered text', () => {
    const badge = stripComments(slice(teacherReport, 'analysis.confidence != null && (', '{/* Secondary difficulty */}'));
    // Rendered literals only — `analysis.confidence` remains as the API field
    // name for compatibility and is deliberately not asserted against here.
    const rendered = (badge.match(/>[^<>{}]+</g) ?? []).join(' ');
    expect(rendered).not.toMatch(/match/i);
    expect(rendered).not.toMatch(/confidence/i);
    expect(rendered).not.toMatch(/%/);
    expect(badge).toContain('Activation');
  });

  it('the secondary difficulty uses neutral wording too', () => {
    expect(code).toMatch(/rule activation \{analysis\.secondaryDifficulty\.confidence\}/);
  });

  it('carries a short non-probability disclosure', () => {
    expect(teacherReport).toMatch(/It is not a probability\./);
  });
});

// ─── Panels exist, are collapsed by default, and hide internals ─────────────

describe('Why panels', () => {
  it('the difficulty card has a collapsed "Why this recommendation?" panel', () => {
    const panel = slice(teacherReport, 'function ConditionTracePanel(', 'const ct = StyleSheet.create');
    expect(panel).toContain('Why this recommendation?');
    expect(panel).toMatch(/useState\(false\)/);
    expect(panel).toContain('Factor');
    expect(panel).toContain('Observed');
    expect(panel).toContain('Rule threshold');
    expect(panel).toContain('Condition met?');
  });

  it('the difficulty panel renders only when the server supplied a trace', () => {
    expect(stripComments(teacherReport)).toMatch(/analysis\.conditionTraces\?\.length > 0 &&/);
  });

  // The Student Profile's own "Why this target?" panel was REMOVED with the
  // Writing Standard card: a threshold, and the reasoning behind it, are
  // report-level detail rather than an at-a-glance module summary. The
  // equivalent explanation still lives in the Teacher Report, and the
  // assertions that protected it were moved there rather than deleted.
  it('the Student Profile no longer carries a threshold explanation panel', () => {
    const code = stripComments(studentDetail);
    expect(code).not.toMatch(/ThresholdWhyPanel/);
    expect(code).not.toMatch(/Why this target\?/);
    expect(code).not.toMatch(/Current Learning Targets/);
  });

  it('the Teacher Report still explains a target when the server supplied a trace', () => {
    const panel = slice(teacherReport, 'function ConditionTracePanel(', 'const ct = StyleSheet.create');
    expect(panel).toMatch(/useState\(false\)/);
  });

  // HONEST RECORD, not a passing assertion dressed up as one: the teacher
  // override "protected" notice existed ONLY inside the Student Profile's
  // ThresholdWhyPanel. Removing that card removed the notice, and the Teacher
  // Report does not currently show an equivalent. The override itself still
  // functions (progressionThresholdResolver's request_override branch); it is
  // the DISPLAY that has no home right now. This test pins that reality so it
  // is visible rather than silently lost.
  it('the teacher-override notice currently has no UI home (documented gap)', () => {
    expect(stripComments(studentDetail)).not.toMatch(/teacher_override/);
    expect(stripComments(teacherReport)).not.toMatch(/teacher_override/);
    // The mechanism is untouched — only its display is missing.
    const resolver = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/progressionThresholdResolver.js'), 'utf8');
    expect(resolver).toMatch(/SOURCE_REQUEST_OVERRIDE/);
  });

  it('the surviving panel renders no internal identifier', () => {
    const a = stripComments(slice(teacherReport, 'function ConditionTracePanel(', 'const ct = StyleSheet.create'));
    expect(a).not.toMatch(/attempt_id|attemptId|fingerprint|history_id|historyId/);
    expect(a).not.toMatch(/\{t\.condition_id\}|\{t\.rule_id\}|rule_id\}/);
    // ...and the Student Profile renders no trace of any kind now.
    expect(stripComments(studentDetail)).not.toMatch(/attempt_id|fingerprint|history_id|rule_id/);
  });

  it('no explanation wording is re-derived on the client — strings come from the trace', () => {
    // Now asserted on the Teacher Report, the one place a rule trace still
    // renders. The Student Profile derives no explanation wording at all.
    const panel = slice(teacherReport, 'function ConditionTracePanel(', 'const ct = StyleSheet.create');
    expect(stripComments(panel)).not.toMatch(/4 - |requiredMetCount|metTargetCount -/);
    expect(stripComments(studentDetail)).not.toMatch(/counterfactual|requiredMetCount/);
  });
});

// ─── The offline engine is untouched and documented as non-authoritative ────

describe('offline explainability engine is left alone', () => {
  it('contains no trace logic', () => {
    expect(offlineEngine).not.toMatch(/conditionTraces|condition_id|buildConditionTraces|rulesVersion/);
  });

  it('the authoritative-source decision is documented', () => {
    expect(traceUtil).toMatch(/Server-derived rule trace is authoritative/);
    expect(traceUtil).toMatch(/retained for offline fallback and does\s*\n?\s*\*?\s*not generate audit traces/);
  });
});

// ─── thresholdTrace normalizer ──────────────────────────────────────────────

describe('normalizeThresholdTraceResponse', () => {
  const families = { straight: { scope: { family: 'straight' } }, curved: {}, complex: {} };

  it('passes a traced payload through verbatim', () => {
    const r = normalizeThresholdTraceResponse({ status: 'traced', families });
    expect(r.status).toBe('found');
    expect(r.families.straight).toEqual(families.straight);
  });

  it.each([
    ['null', null],
    ['non-object', 'nope'],
    ['missing status', {}],
  ])('fails safe to unavailable for %s', (_label, data) => {
    expect(normalizeThresholdTraceResponse(data)).toEqual({ status: 'unavailable', families: null });
  });

  it('distinguishes "no targets yet" from a failed request', () => {
    expect(normalizeThresholdTraceResponse({ status: 'no_target', families: null }).status).toBe('not_available');
    expect(normalizeThresholdTraceResponse({ status: 'traced', families: {} }).status).toBe('not_available');
  });

  it('only ever calls client.get', () => {
    expect(traceUtil).toMatch(/client\.get\(/);
    expect(traceUtil).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });
});

// ─── N. Child-facing isolation ──────────────────────────────────────────────

describe('child-facing screens contain no explanation trace', () => {
  const childScreens = [
    '../screens/teacher/handwriting/LetterHomeScreen.js',
    '../screens/teacher/handwriting/AssessmentCompleteScreen.js',
    '../screens/teacher/handwriting/LetterWritingScreen.js',
  ];

  it.each(childScreens)('%s exposes no trace/explanation output', (relPath) => {
    const abs = path.resolve(__dirname, relPath);
    if (!fs.existsSync(abs)) return; // never assert against a file that does not exist
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    expect(code).not.toMatch(/Why this target\?|Why this recommendation\?/);
    expect(code).not.toMatch(/conditionTraces|rule_activation_score|ruleActivationScore/);
    expect(code).not.toMatch(/threshold-trace|thresholdTrace|fetchThresholdTrace|THRESHOLD_TRACE/);
    expect(code).not.toMatch(/teacher_override|evidence_window|met_target_count/);
  });
});
