// Teacher-set practice target notice — Writing Progress Report only.
//
// The notice existed once before, inside the Student Profile's
// ThresholdWhyPanel, and was lost when that card was removed as
// report-level detail. It now lives in the report's Teacher Recommendations
// section, which is the section that already explains AUTOMATIC adjustment —
// "protected from automatic adjustment" is only meaningful next to it.
//
// The rule these tests exist to protect: the notice reflects the CURRENTLY
// EFFECTIVE target source, never the mere historical existence of an override.

// familyThresholds.js imports the HTTP client at module scope, which the
// minimal jest config cannot transform. Mocked exactly as
// familyThresholds.test.js already does — these tests exercise the pure
// extractor, never a real request.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  extractTeacherOverrideFamilies, normalizeFamilyThresholdsResponse,
} from './familyThresholds';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const report  = stripComments(read('../screens/teacher/handwriting/reports/TeacherReportScreen.js'));
const profile = stripComments(read('../screens/teacher/students/StudentDetailScreen.js'));

const fam = (source, status = 'available', threshold = 82) => ({ status, threshold, source });
const body = (families) => ({ status: 'resolved', families });

// ─── The display condition ──────────────────────────────────────────────

describe('an EFFECTIVE teacher override shows the notice', () => {
  it('one family overridden', () => {
    const r = extractTeacherOverrideFamilies(body({
      straight: fam('teacher_override'),
      curved:   fam('automatic'),
      complex:  fam('initial_from_baseline'),
    }));
    expect(r.status).toBe('resolved');
    expect(r.families).toEqual(['straight']);
  });

  it('several families overridden', () => {
    const r = extractTeacherOverrideFamilies(body({
      straight: fam('teacher_override'),
      curved:   fam('teacher_override'),
      complex:  fam('automatic'),
    }));
    expect(r.families).toEqual(['straight', 'curved']);
  });
});

describe('no override shows nothing', () => {
  it.each([
    ['automatic', 'automatic'],
    ['initial_from_baseline', 'initial_from_baseline'],
    ['legacy', 'legacy'],
  ])('every family sourced %s -> no notice', (_label, source) => {
    const r = extractTeacherOverrideFamilies(body({
      straight: fam(source), curved: fam(source), complex: fam(source),
    }));
    expect(r.families).toEqual([]);
  });

  it('a student with no targets at all', () => {
    expect(extractTeacherOverrideFamilies(body({
      straight: { status: 'unavailable' },
      curved:   { status: 'unavailable' },
      complex:  { status: 'unavailable' },
    })).families).toEqual([]);
  });
});

describe('a SUPERSEDED override shows nothing — the critical rule', () => {
  it('an override later replaced by an automatic target is not effective', () => {
    // The endpoint's per-family `source` is the CURRENT ThresholdHistory row
    // (getCurrentFamilyThreshold's sourceEvent), so a superseded override
    // simply never appears in the payload as the effective source.
    const r = extractTeacherOverrideFamilies(body({
      straight: fam('automatic'),           // was teacher_override, now automatic
      curved:   fam('initial_from_baseline'),
      complex:  fam('automatic'),
    }));
    expect(r.families).toEqual([]);
  });

  it('SENTINEL — the extractor reads the EFFECTIVE source only, never history', () => {
    const mod = stripComments(read('./familyThresholds.js'));
    // No history/event scanning of any kind.
    expect(mod).not.toMatch(/history|events|previous|last_override/i);
    expect(mod).toMatch(/entry\.source === TEACHER_OVERRIDE_SOURCE/);
  });

  it('an entry that is not "available" never counts, whatever its source', () => {
    expect(extractTeacherOverrideFamilies(body({
      straight: fam('teacher_override', 'unavailable'),
      curved:   fam('teacher_override', 'no_target'),
      complex:  fam('automatic'),
    })).families).toEqual([]);
  });
});

// ─── Failure handling ───────────────────────────────────────────────────

describe('it fails closed, never claiming protection', () => {
  it.each([
    ['null', null], ['undefined', undefined], ['a string', 'nope'], ['a number', 7],
    ['an empty object', {}], ['a read_failed body', { status: 'read_failed' }],
    ['a missing families key', { status: 'resolved' }],
    ['families as an array', { status: 'resolved', families: [] }],
  ])('%s -> unavailable, no families', (_label, input) => {
    const r = extractTeacherOverrideFamilies(input);
    expect(r.status).toBe('unavailable');
    expect(r.families).toEqual([]);
  });

  it('always returns an array, so callers need no null guard', () => {
    for (const input of [null, {}, body({})]) {
      expect(Array.isArray(extractTeacherOverrideFamilies(input).families)).toBe(true);
    }
  });
});

// ─── The existing normalizer is untouched ───────────────────────────────

describe('the existing flattened normalizer is unchanged', () => {
  it('still flattens each family to a bare number', () => {
    const r = normalizeFamilyThresholdsResponse(body({
      straight: fam('teacher_override', 'available', 85),
      curved:   fam('automatic', 'available', 80),
      complex:  fam('automatic', 'available', 78),
    }));
    expect(r.status).toBe('resolved');
    expect(r.families).toEqual({ straight: 85, curved: 80, complex: 78 });
  });

  it('the new reader is additive, not a replacement', () => {
    const mod = stripComments(read('./familyThresholds.js'));
    expect(mod).toMatch(/export function normalizeFamilyThresholdsResponse/);
    expect(mod).toMatch(/export function extractTeacherOverrideFamilies/);
    expect(mod).toMatch(/export async function fetchTeacherOverrideFamilies/);
  });
});

// ─── The rendered notice ────────────────────────────────────────────────

describe('the notice in the report', () => {
  it('renders nothing when there are no overridden families', () => {
    expect(report).toMatch(/if \(!Array\.isArray\(families\) \|\| families\.length === 0\) return null;/);
  });

  it('uses the agreed teacher-facing copy', () => {
    expect(report).toMatch(/Teacher-set practice target/);
    expect(report).toMatch(/set by the teacher and is protected from/);
    expect(report).toMatch(/automatic adjustment\./);
  });

  it('exposes no technical or provenance terminology', () => {
    const notice = report.slice(report.indexOf('function TeacherTargetNotice'),
                                report.indexOf('const tov = StyleSheet.create'));
    for (const banned of [/SOURCE_REQUEST_OVERRIDE/, /teacher_override/, /ThresholdHistory/,
                          /provenance/i, /source/i, /database/i, /historyId/]) {
      expect(notice).not.toMatch(banned);
    }
  });

  it('shows no numeric threshold — the report does not otherwise show one', () => {
    const notice = report.slice(report.indexOf('function TeacherTargetNotice'),
                                report.indexOf('const tov = StyleSheet.create'));
    expect(notice).not.toMatch(/threshold/i);
    expect(notice).not.toMatch(/\{[^}]*target[^}]*\}/i);
  });

  it('is a small inline callout — no card, no modal, no navigation', () => {
    const notice = report.slice(report.indexOf('function TeacherTargetNotice'),
                                report.indexOf('const tov = StyleSheet.create'));
    expect(notice).not.toMatch(/SectionCard|Modal|navigation\.|TouchableOpacity/);
    expect(notice).toMatch(/<View style=\{tov\.wrap\}>/);
  });

  it('stays in Teacher Recommendations after the adaptive subsection is removed', () => {
    const idx = report.indexOf('<TeacherTargetNotice');
    const recs = report.indexOf('Teacher Recommendations');
    expect(idx).toBeGreaterThan(recs);
    expect(report).not.toMatch(/>Adaptive Practice Recommendations</);
  });

  it('its fetch is non-fatal and fails closed to no notice', () => {
    expect(report).toMatch(/\.catch\(\(\) => setOverrideFamilies\(\[\]\)\)/);
  });
});

// ─── Nothing else moved ─────────────────────────────────────────────────

describe('nothing outside the report changed', () => {
  it('the Student Profile Writing summary is untouched', () => {
    expect(profile).not.toMatch(/TeacherTargetNotice/);
    expect(profile).not.toMatch(/teacher_override/);
    expect(profile).not.toMatch(/Teacher-set practice target/);
    // ...and it still has no threshold UI or request.
    expect(profile).not.toMatch(/ThresholdCard|fetchFamilyThresholds|Writing Standard/);
  });

  it('SENTINEL — the threshold resolver and override behaviour are untouched', () => {
    const resolver = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/progressionThresholdResolver.js'), 'utf8');
    expect(resolver).toMatch(/SOURCE_REQUEST_OVERRIDE/);
    expect(resolver).toMatch(/GLOBAL_DEFAULT = 55/);
    expect(resolver).toMatch(/typeof requestedQualityThreshold === 'number'/);
  });

  it('SENTINEL — mastery policy is untouched', () => {
    const policy = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/masteryPolicy.js'), 'utf8');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    const cap = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/practiceCyclePolicy.js'), 'utf8');
    expect(cap).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
  });

  it('the notice reads only an existing endpoint — no new API', () => {
    const mod = stripComments(read('./familyThresholds.js'));
    expect(mod).toMatch(/ENDPOINTS\.FAMILY_THRESHOLDS/);
    const api = read('../constants/api.js');
    expect(api).toMatch(/FAMILY_THRESHOLDS/);
  });
});
