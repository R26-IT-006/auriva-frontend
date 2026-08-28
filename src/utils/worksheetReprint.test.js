// Worksheet preview + frozen-plan reprint.
//
// The central guarantee: once a worksheet is generated, reprinting it later
// reproduces the sheet the child was actually given — even after the motor
// mapping changes.

import fs from 'fs';
import path from 'path';
import { resolveWorksheetPlan, buildWorksheetHtml } from './worksheetPdf';

const screen = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const STUDENT = { full_name: 'Test Child' };

/** A worksheet as the history API returns it, with its frozen plan. */
function frozenWorksheet(over = {}) {
  return {
    id: 1, worksheet_code: 'HW-2026-0001', target_letter: 'c', case_type: 'lowercase',
    worksheet_intensity: 'standard', status: 'assigned',
    generated_at: '2026-08-26T00:00:00.000Z',
    worksheet_plan: {
      worksheet_plan_version: 'worksheet-plan-v1',
      target_letter: 'c', case_type: 'lowercase', motor_family: 'curved',
      worksheet_intensity: 'standard',
      stroke_types: ['half_circle'],
      warm_up: [{ id: 'half_circle', label: 'Curves', instruction: 'Trace the curves.', rows: 2, emphasised: true }],
      primary_shape: { id: 'half_circle', label: 'Curves', instruction: 'Trace the curves.' },
      shape_practice_sizes: ['large', 'medium', 'small'],
      trace: { rows: 2, per_row: 5, dotted: true, show_start: true },
      copy: { rows: 2, blanks_per_row: 4 },
      independent: { rows: 2 },
    },
    ...over,
  };
}

// ─── Plan resolution precedence ───────────────────────────────────────────

describe('a reprint renders from the FROZEN plan', () => {
  it('prefers the worksheet\'s stored plan over any live plan passed in', () => {
    const live = { warmUp: [{ id: 'zigzag', label: 'Slanted lines', rows: 9 }], primaryShape: { id: 'zigzag' }, shapePracticeSizes: [] };
    const resolved = resolveWorksheetPlan({ worksheet: frozenWorksheet(), plan: live });
    expect(resolved.source).toBe('frozen');
    expect(resolved.warmUp.map((w) => w.id)).toEqual(['half_circle']);
    expect(resolved.warmUp[0].rows).toBe(2);
  });

  it('CHANGING THE CURRENT MAPPING DOES NOT CHANGE A HISTORICAL REPRINT', () => {
    // Simulates the mapping later being corrected: the live plan now says the
    // letter needs diagonals. The stored sheet must be unaffected.
    const mappingChanged = {
      warmUp: [{ id: 'zigzag', label: 'Slanted lines', instruction: 'x', rows: 4, emphasised: false }],
      primaryShape: { id: 'zigzag', label: 'Slanted lines', instruction: 'x' },
      shapePracticeSizes: ['large'],
    };
    const before = buildWorksheetHtml({ student: STUDENT, worksheet: frozenWorksheet(), plan: null });
    const after = buildWorksheetHtml({ student: STUDENT, worksheet: frozenWorksheet(), plan: mappingChanged });
    expect(after).toBe(before);
    expect(after).toContain('Curves');
    expect(after).not.toContain('Slanted lines');
  });

  it('preserves the plan version on the resolved plan', () => {
    expect(resolveWorksheetPlan({ worksheet: frozenWorksheet() }).version).toBe('worksheet-plan-v1');
  });

  it('uses a live plan only for a worksheet that has no stored one yet', () => {
    const live = { warmUp: [{ id: 'full_circle', label: 'Circles', rows: 1 }], primaryShape: { id: 'full_circle', label: 'Circles' }, shapePracticeSizes: ['large'] };
    const resolved = resolveWorksheetPlan({ worksheet: { target_letter: 'o', case_type: 'lowercase' }, plan: live });
    expect(resolved.source).toBe('live');
    expect(resolved.warmUp[0].id).toBe('full_circle');
  });
});

// ─── Backwards compatibility ──────────────────────────────────────────────

describe('worksheets created before plans were persisted', () => {
  const legacy = { id: 7, worksheet_code: 'HW-2025-0009', target_letter: 'c', case_type: 'lowercase', worksheet_intensity: 'standard' };

  it('resolve to null rather than a fabricated plan', () => {
    expect(resolveWorksheetPlan({ worksheet: legacy })).toBeNull();
    expect(resolveWorksheetPlan({ worksheet: legacy, plan: null })).toBeNull();
  });

  it('still render a worksheet, with an honest fallback line — never a crash', () => {
    const html = buildWorksheetHtml({ student: STUDENT, worksheet: legacy, plan: null });
    expect(typeof html).toBe('string');
    expect(html).toContain('HW-2025-0009');
    expect(html).toContain('Movement practice for this letter is not set up yet.');
    // The letter itself still prints — trace/copy/independent do not depend on
    // the motor plan.
    expect(html).toContain('Trace the Letter');
    expect(html).toContain('Write on Your Own');
  });

  it('a malformed stored plan is treated as absent, not trusted', () => {
    expect(resolveWorksheetPlan({ worksheet: { worksheet_plan: { warm_up: 'nonsense' } } })).toBeNull();
    expect(resolveWorksheetPlan({ worksheet: { worksheet_plan: {} } })).toBeNull();
  });

  it('never throws on missing or malformed input', () => {
    for (const bad of [{}, { worksheet: null }, { worksheet: undefined }]) {
      expect(() => resolveWorksheetPlan(bad)).not.toThrow();
    }
    expect(() => buildWorksheetHtml({ student: null, worksheet: null, plan: null })).not.toThrow();
  });
});

// ─── Frozen layout settings ───────────────────────────────────────────────

describe('frozen section settings are honoured', () => {
  it('the independent-writing row count comes from the stored plan', () => {
    const threeRows = frozenWorksheet();
    threeRows.worksheet_plan.independent = { rows: 3 };
    const html = buildWorksheetHtml({ student: STUDENT, worksheet: threeRows, plan: null });
    const standard = buildWorksheetHtml({ student: STUDENT, worksheet: frozenWorksheet(), plan: null });
    expect(html).not.toBe(standard);
  });

  it('the stored warm-up row count is reproduced exactly', () => {
    const oneRow = frozenWorksheet();
    oneRow.worksheet_plan.warm_up = [{ id: 'half_circle', label: 'Curves', instruction: 'x', rows: 1, emphasised: false }];
    const a = buildWorksheetHtml({ student: STUDENT, worksheet: oneRow, plan: null });
    const b = buildWorksheetHtml({ student: STUDENT, worksheet: frozenWorksheet(), plan: null });
    expect(a).not.toBe(b);
  });

  it('the worksheet code and target letter still print', () => {
    const html = buildWorksheetHtml({ student: STUDENT, worksheet: frozenWorksheet(), plan: null });
    expect(html).toContain('HW-2026-0001');
    // A worksheet prints ONE case — the one the child is practising. This
    // fixture is lowercase c, and the header used to read 'C c', which is
    // exactly the mixing this task removed.
    expect(html).toContain('>c</div>');
    expect(html).not.toContain('C c');
    expect(html).toContain('Lowercase');
    expect(html).toContain('Test Child');
  });
});

// ─── Preview UI ───────────────────────────────────────────────────────────

describe('worksheet preview', () => {
  const card = screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));

  it('reuses the existing report preview modal rather than a second framework', () => {
    expect(screen).toMatch(/import ReportPreviewModal from/);
    expect(card).toMatch(/<ReportPreviewModal/);
    expect(card).toMatch(/visible=\{!!preview\}/);
    expect(card).toMatch(/html=\{preview\?\.html \?\? null\}/);
  });

  it('opens with the rendered worksheet, not just a filename', () => {
    expect(card).toMatch(/setPreview\(\{ uri: res\.fileUri, filename: res\.filename, html: res\.html, worksheet \}\)/);
    // The old filename-only placeholder is gone.
    expect(card).not.toMatch(/Worksheet ready to print:/);
  });

  it('handles generation failure and a missing file/URI without opening', () => {
    expect(card).toMatch(/if \(res\.status !== 'ok' \|\| !res\.fileUri \|\| !res\.html\)/);
    expect(card).toMatch(/could not be prepared for printing/);
  });

  it('closes safely and can be reopened — nothing is torn down', () => {
    expect(card).toMatch(/const closePreview = \(\) => \{ setPreview\(null\); setPreviewMessage\(null\); \};/);
    expect(card).toMatch(/onClose=\{closePreview\}/);
  });

  it('shares from the preview using the WORKSHEET share helper, not the report one', () => {
    expect(screen).toMatch(/import \{ generateWorksheetPdf, shareWorksheetPdf \}/);
    expect(screen).not.toMatch(/sharePeriodicReportPdf/);
    expect(card).toMatch(/onShare=\{doSharePreview\}/);
    expect(card).toMatch(/setPreviewMessage/);
  });

  it('a share failure is reported, never thrown', () => {
    const fn = card.slice(card.indexOf('const doSharePreview'), card.indexOf('const closePreview'));
    expect(fn).toMatch(/catch \(err\)/);
    expect(fn).toMatch(/could not be shared/);
  });
});

// ─── Reprint is read-only ─────────────────────────────────────────────────

describe('reprint from history is read-only', () => {
  const card = screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));

  it('a history reprint does NOT mark the worksheet assigned', () => {
    expect(card).toMatch(/doPreview\(reprintTarget, \{ markAssigned: false \}\)/);
    expect(card).toMatch(/if \(markAssigned\) \{/);
  });

  it('the first preview of an active worksheet still hands it out', () => {
    expect(card).toMatch(/doPreview\(active\)/);
    expect(card).toMatch(/apiAssignWorksheet\(worksheet\.id, null\)/);
  });

  it('reprint creates no new worksheet and changes no status or date', () => {
    const fn = card.slice(card.indexOf('const doPreview'), card.indexOf('const doSharePreview'));
    expect(fn).not.toMatch(/apiGenerateWorksheet/);
    expect(fn).not.toMatch(/apiReviewSubmission|apiSubmitWorksheet/);
    for (const field of ['submitted_at', 'reviewed_at', 'status:']) {
      expect(fn).not.toContain(field);
    }
  });

  it('viewing a historical worksheet goes through the parent gate', () => {
    expect(card).toMatch(/const gReprint\s+= useGatedBack\(/);
    expect(card).toMatch(/\{gReprint\.gateModal\}/);
    expect(card).toMatch(/setReprintTarget\(w\)/);
  });

  it('the renderer is given the worksheet, so its OWN frozen plan is used', () => {
    expect(card).toMatch(/generateWorksheetPdf\(\{ student, worksheet, plan: null \}\)/);
  });
});
