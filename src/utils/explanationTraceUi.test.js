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
  path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
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

  it('the threshold card has a collapsed "Why this target?" panel', () => {
    const panel = slice(studentDetail, 'function ThresholdWhyPanel(', 'const styles = StyleSheet.create');
    expect(panel).toContain('Why this target?');
    expect(panel).toMatch(/useState\(false\)/);
    expect(panel).toContain('Current target:');
    expect(panel).toContain('Recent eligible attempts');
    expect(panel).toContain('Met target');
    expect(panel).toContain('Did not meet target');
    expect(panel).toContain('What would satisfy the progression condition');
  });

  it('the threshold panel renders only when a server trace is present', () => {
    expect(stripComments(studentDetail)).toMatch(/trace\?\.status === 'found' && <ThresholdWhyPanel/);
  });

  it('teacher override protection is shown prominently when active', () => {
    const panel = slice(studentDetail, 'function ThresholdWhyPanel(', 'const styles = StyleSheet.create');
    expect(panel).toMatch(/teacher_override\?\.protected/);
    expect(panel).toMatch(/protected by a teacher-defined setting/);
  });

  it('neither panel renders an internal identifier', () => {
    const a = stripComments(slice(teacherReport, 'function ConditionTracePanel(', 'const ct = StyleSheet.create'));
    const b = stripComments(slice(studentDetail, 'function ThresholdWhyPanel(', 'const styles = StyleSheet.create'));
    for (const source of [a, b]) {
      expect(source).not.toMatch(/attempt_id|attemptId|fingerprint|history_id|historyId/);
      expect(source).not.toMatch(/\{t\.condition_id\}|\{t\.rule_id\}|rule_id\}/);
    }
  });

  it('no explanation wording is re-derived on the client — strings come from the trace', () => {
    const panel = slice(studentDetail, 'function ThresholdWhyPanel(', 'const styles = StyleSheet.create');
    expect(panel).toMatch(/t\.explanation\?\.summary/);
    expect(panel).toMatch(/t\.explanation\?\.counterfactual/);
    // No client-side arithmetic on the rule.
    expect(stripComments(panel)).not.toMatch(/4 - |requiredMetCount|metTargetCount -/);
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
    '../screens/handwriting/LetterHomeScreen.js',
    '../screens/handwriting/AssessmentCompleteScreen.js',
    '../screens/handwriting/LetterWritingScreen.js',
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
