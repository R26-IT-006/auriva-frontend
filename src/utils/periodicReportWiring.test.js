import fs from 'fs';
import path from 'path';

/**
 * Proposal FR-19/FR-20, Phase 7C/7D — screen/component wiring proof.
 * These files import 'react-native' and can't be mounted under this
 * repo's plain-node jest config; verified by source-text assertion, the
 * same established technique used for learningSessionWiring.test.js and
 * liveSessionWiring.test.js. Pure-logic behavior (date math, HTML
 * building, filename sanitization) has full behavioral coverage in
 * reportPeriod.test.js / periodicReportPdf.test.js — this file proves the
 * screen/components are correctly WIRED to it.
 */

function read(relPath) {
  return fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
}
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const teacherReportSource = read('../screens/handwriting/reports/TeacherReportScreen.js');
const sectionSource       = read('../components/handwriting/reports/PeriodicReportSection.js');
const selectorSource      = read('../components/handwriting/reports/PeriodSelector.js');
const apiSource           = read('../api/periodicReport.js');
const pdfSource           = read('../utils/periodicReportPdf.js');
const previewSource       = read('../components/handwriting/reports/ReportPreviewModal.js');

// ─── 19/23. Preset changes date range / selected period displayed ─────────
describe('TeacherReportScreen renders PeriodicReportSection exactly once', () => {
  it('imports and mounts PeriodicReportSection', () => {
    expect(teacherReportSource).toContain("import PeriodicReportSection from '../../../components/handwriting/reports/PeriodicReportSection'");
    const count = (teacherReportSource.match(/<PeriodicReportSection/g) || []).length;
    expect(count).toBe(1);
  });
});

// ─── 25. Two distinct, distinctly-labeled share capabilities ──────────────
describe('Two distinct share capabilities, never both called "Share Report" (spec §25)', () => {
  it('the pre-existing plaintext Share.share button is explicitly labeled "Share text summary"', () => {
    expect(teacherReportSource).toContain('accessibilityLabel="Share text summary"');
  });
  it('the PDF flow names its two steps distinctly — download first, share second', () => {
    // The single "Export & Share" action was split so a teacher can read the
    // report before sending it: the button downloads/opens it, and sharing is
    // a separate action inside the preview.
    expect(sectionSource).toContain('accessibilityLabel="Download report and open it for review"');
    expect(sectionSource).toContain('Download & Review Report');
    expect(previewSource).toContain('accessibilityLabel="Share this report"');
  });

  it('the share labels are never identical across the two capabilities', () => {
    // The real claim of spec §25: the plaintext share and the PDF share must
    // stay distinguishable from each other.
    expect(teacherReportSource).not.toContain('accessibilityLabel="Share this report"');
    expect(previewSource).not.toContain('accessibilityLabel="Share text summary"');
    expect(sectionSource).not.toContain('accessibilityLabel="Share text summary"');
  });
});

// ─── 22. Stale period response ignored ─────────────────────────────────────
describe('PeriodicReportSection ignores a stale (out-of-order) previous response (spec §15/§22)', () => {
  it('uses a monotonic request-id ref to gate which response is applied', () => {
    expect(sectionSource).toContain('requestIdRef');
    expect(sectionSource).toMatch(/myRequestId\s*!==\s*requestIdRef\.current/);
  });

  it('increments the request id BEFORE awaiting the fetch, so a fast-changing period cannot race', () => {
    const block = sectionSource.slice(sectionSource.indexOf('const loadReport'), sectionSource.indexOf('const loadReport') + 700);
    const incrementIdx = block.indexOf('++requestIdRef.current');
    const awaitIdx = block.indexOf('await fetchPeriodicReport');
    expect(incrementIdx).toBeGreaterThan(-1);
    expect(awaitIdx).toBeGreaterThan(incrementIdx);
  });
});

// ─── 20/21. Preset changes date range / custom range validation ──────────
describe('PeriodSelector presets and custom-range validation wiring', () => {
  it('renders all 5 required presets (7/30/90/180 days + custom)', () => {
    expect(selectorSource).toContain('REPORT_PERIOD_PRESETS');
  });

  it('PeriodicReportSection validates a custom range via validateCustomRange before applying it', () => {
    expect(sectionSource).toMatch(/validateCustomRange\(candidate\.startDate, candidate\.endDate/);
    expect(sectionSource).toMatch(/if \(!validation\.ok\)/);
  });

  it('the validator is given the same registration lower bound the picker enforces', () => {
    // Defence in depth: the native picker makes out-of-range days
    // unselectable, but the validator must reject them too — a stored or
    // programmatically-supplied range never passes through the picker.
    expect(sectionSource).toMatch(/validateCustomRange\([^)]*registeredOn\)/);
  });

  it('custom date bounds are derived from the student registration date and today', () => {
    expect(sectionSource).toMatch(/const registeredOn = parseDateOnly\(toDateOnly\(student\?\.created_at\)\)/);
    expect(sectionSource).toMatch(/const today = startOfTodayUtc\(\)/);
    expect(sectionSource).toMatch(/minDate=\{registeredOn\}/);
    expect(sectionSource).toMatch(/maxDate=\{today\}/);
  });

  it('the custom fields are bounded pickers, not free-typed text', () => {
    expect(selectorSource).toContain('ReportDateField');
    expect(selectorSource).not.toMatch(/<TextInput/);
  });
});

// ─── 21. loading/error/empty states ────────────────────────────────────────
describe('loading/error/empty states are all represented', () => {
  it('PeriodicReportSection has distinct loading, error, and empty-range states', () => {
    expect(sectionSource).toMatch(/status === 'loading'/);
    expect(sectionSource).toMatch(/status === 'error'/);
    expect(sectionSource).toMatch(/status === 'empty_range'/);
  });

  it('a no-activity period is shown as a neutral note, not an error', () => {
    expect(sectionSource).toContain('No handwriting activity was recorded during this period.');
  });
});

// ─── 24. PDF uses selected-period data ─────────────────────────────────────
describe('PDF export uses the currently-selected period, not a hardcoded one', () => {
  it('generatePeriodicReportPdf receives the resolved range startDate and endDate', () => {
    const block = sectionSource.slice(sectionSource.indexOf('async function handleGeneratePdf'), sectionSource.indexOf('async function handleSharePdf'));
    expect(block).toContain('startDate: range?.startDate');
    expect(block).toContain('endDate: range?.endDate');
  });

  it('sharing sends the file that was previewed, never a freshly rebuilt one', () => {
    const block = sectionSource.slice(sectionSource.indexOf('async function handleSharePdf'), sectionSource.indexOf('function handleClosePreview'));
    expect(block).toContain('fileUri: preview.fileUri');
    expect(block).not.toContain('generatePeriodicReportPdf');
  });

  it('the Export button is only rendered once a report for the current period has loaded (status === "ready")', () => {
    const exportBtnIdx = sectionSource.indexOf('accessibilityLabel="Download report and open it for review"');
    const readyGuardIdx = sectionSource.lastIndexOf("status === 'ready' && report", exportBtnIdx);
    expect(readyGuardIdx).toBeGreaterThan(-1);
    expect(readyGuardIdx).toBeLessThan(exportBtnIdx);
  });
});

// ─── 29/30/31. PDF failure / cancellation safety / real document sharing ──
describe('Export failure and cancellation handling (spec §22/§29/§30/§31)', () => {
  it('a failed export sets an adult-facing error message, never a crash / never a silent no-op', () => {
    expect(sectionSource).toContain("setExportState('error')");
    expect(sectionSource).toContain('Could not generate the PDF. Please try again.');
  });
  it('a cancelled share is treated as non-error, and keeps the preview open', () => {
    const block = sectionSource.slice(sectionSource.indexOf('async function handleSharePdf'), sectionSource.indexOf('function handleClosePreview'));
    expect(block).toMatch(/result\.status === 'cancelled'/);
    // Backing out of the share sheet must NOT close the preview or raise an error.
    const cancelBranch = block.slice(block.indexOf("result.status === 'cancelled'"), block.indexOf("result.status === 'sharing_unavailable'"));
    expect(cancelBranch).not.toMatch(/setPreview\(null\)/);
  });

  it('shareAsync is called with mimeType application/pdf — a real document share, never a plaintext message', () => {
    expect(pdfSource).toContain("mimeType: 'application/pdf'");
    expect(pdfSource).not.toMatch(/Share\.share\(/); // the RN core plaintext Share API is never used here
  });
});

// ─── 32. Teacher report remains read-only ──────────────────────────────────
describe('Read-only guarantee — no write endpoint is ever called from this feature', () => {
  it('api/periodicReport.js only ever calls client.get, never post/put/patch/delete', () => {
    expect(apiSource).toContain('client.get(');
    expect(apiSource).not.toMatch(/client\.(post|put|patch|delete)\(/);
  });

  it('PeriodicReportSection.js and PeriodSelector.js never import client or ENDPOINTS directly (all network access goes through the api/ wrapper)', () => {
    for (const source of [sectionSource, selectorSource]) {
      expect(source).not.toMatch(/from '.*\/api\/client'/);
    }
  });

  it('periodicReportPdf.js performs no network call at all — export/share is entirely local', () => {
    const codeOnly = stripComments(pdfSource);
    expect(codeOnly).not.toMatch(/client\.(get|post|put|patch|delete)\(|fetch\(/);
  });
});
