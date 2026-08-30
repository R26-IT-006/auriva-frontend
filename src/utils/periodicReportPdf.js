/**
 * periodicReportPdf.js
 *
 * Proposal FR-19/FR-20, Phase 7C/7D — real PDF export + native share for
 * the periodic report (spec §16-§21).
 *
 * Architecture (spec §11/§16): backend is the authoritative report DATA
 * (periodicReportService.js); this module is presentation only — it never
 * recomputes anything, it only formats the already-fetched report object
 * into an HTML document, then hands that HTML to expo-print
 * (Print.printToFileAsync) to rasterize a real PDF file, then to
 * expo-sharing (Sharing.shareAsync) for native document sharing.
 *
 * Split into a PURE html builder (buildReportHtml — directly unit-testable,
 * no RN import) and an IMPURE export/share function
 * (exportAndSharePeriodicReportPdf — the only part that touches
 * expo-print/expo-sharing/expo-file-system), mirroring this project's
 * established pure-core/thin-RN-wrapper convention.
 *
 * Privacy (spec §19): never renders raw stroke points, auth data, Feature
 * 11 centroid distances, or model-debug metadata — the backend's report
 * JSON already excludes all of that (see periodicReportService.js's own
 * header), and no internal database id (student_id/sid) is ever printed —
 * only the human-facing student_name/student_code.
 */

'use strict';

// Dependency-free import by design — letterMotorPatternLabels.js pulls in no
// RN/api code, so buildReportHtml() below stays directly unit-testable.
import {
  getLetterMotorPresentation, buildReferenceProgressText, LETTER_MOTOR_PATTERN_CAPTION,
  getWritingCheckPresentation,
} from './letterMotorPatternLabels';
// Same shared wording module the two screens use — dependency-free, so this
// builder stays unit-testable without an RN environment.
import {
  getWorksheetStatusLabel, getReviewStatusLabel, getIntensityLabel,
  formatWorksheetDate, EMPTY_NO_PERIOD_ACTIVITY,
} from './worksheetLabels';
// The single expo-sharing wrapper, shared with the worksheet exporter so the
// share-sheet mechanics (availability check, cancellation-is-not-failure,
// never re-render) exist in ONE place. Dependency-free at module level.
import { sharePdfFile, sanitizeForFilename as sanitizeSegment } from './pdfShare';

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtNum(value, suffix = '') {
  return value == null ? 'Not available' : `${value}${suffix}`;
}

function fmtDate(iso) {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function section(num, title, bodyHtml) {
  return `
    <section class="section">
      <h2>${num}. ${escapeHtml(title)}</h2>
      ${bodyHtml}
    </section>`;
}

function table(rows) {
  const trs = rows
    .filter((r) => r != null)
    .map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<table class="kv">${trs}</table>`;
}

// A print-safe progress bar: plain divs with a solid fill, no gradient, so it
// rasterizes cleanly in the PDF and stays legible in greyscale.
function progressBarHtml(label, value, total) {
  const safeTotal = typeof total === 'number' && total > 0 ? total : null;
  const safeValue = typeof value === 'number' && value >= 0 ? value : 0;
  const pct = safeTotal ? Math.round(Math.min(1, safeValue / safeTotal) * 100) : 0;
  const counts = safeTotal ? `${safeValue} / ${safeTotal}` : String(safeValue);
  return `
    <div class="bar-row">
      <div class="bar-head"><span>${escapeHtml(label)}</span><strong>${escapeHtml(counts)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-pct">${pct}%</div>
    </div>`;
}

function buildLearningProgressHtml(learning) {
  return `
    ${progressBarHtml('Lowercase Letters', learning.cumulative_lowercase_mastered_by_end_date, learning.lowercase_total)}
    ${progressBarHtml('Uppercase Letters', learning.cumulative_uppercase_mastered_by_end_date, learning.uppercase_total)}
    ${table([
      ['Lowercase Letters Mastered', learning.lowercase_mastered_during_period],
      ['Uppercase Letters Mastered', learning.uppercase_mastered_during_period],
      ['Total Lowercase Letters Mastered', learning.cumulative_lowercase_mastered_by_end_date],
      ['Total Uppercase Letters Mastered', learning.cumulative_uppercase_mastered_by_end_date],
      ['Current Practice Level', learning.current_progression_stage],
    ])}`;
}

function buildMotorPerformanceHtml(motor) {
  return table([
    ['Practice Attempts', motor.attempts_in_period],
    ['Average Motor Performance Score', fmtNum(motor.mean_motor_score, ' / 100')],
    ['Median Motor Performance Score', fmtNum(motor.median_motor_score, ' / 100')],
    ['Average Writing Smoothness', fmtNum(motor.mean_smoothness_score, ' / 100')],
    ['Average Trajectory Similarity', fmtNum(motor.mean_trajectory_dtw_distance)],
    ['Average Speed Consistency', fmtNum(motor.mean_speed_cv)],
    ['Average Attempt Duration', motor.mean_duration_ms != null ? `${Math.round(motor.mean_duration_ms / 100) / 10}s` : 'Not available'],
  ]);
}

function buildInitialProfileHtml(profile) {
  if (!profile?.available) {
    return `<p class="note">Initial handwriting assessment not yet available. It appears here once the student completes the shape assessment.</p>`;
  }
  // Row labels match the on-screen card exactly — the printed report and the
  // screen must not name the same four scores differently.
  // The server-built summary narrative, from the same builder the dashboard
  // card and the on-screen periodic report use. Omitted entirely on an older
  // server that does not send it — never fabricated here.
  const summary = profile.summary ?? null;
  const summaryHtml = summary?.description
    ? `<p class="subhead">Summary</p><p>${escapeHtml(summary.description)}</p>`
    : '';
  const disclosureHtml = summary?.disclosure
    ? `<p class="note">${escapeHtml(summary.disclosure)}</p>`
    : '';

  return `
    <p class="note">Baseline/initial context — recorded ${escapeHtml(fmtDate(profile.recorded_at))}. This baseline summary may predate the selected reporting period.</p>
    ${table([
      ['Straight Line Shapes', fmtNum(profile.scores?.straight, ' / 100')],
      ['Curved Shapes', fmtNum(profile.scores?.curved, ' / 100')],
      ['Complex Shapes', fmtNum(profile.scores?.complex, ' / 100')],
      ['Overall Score', fmtNum(profile.scores?.overall, ' / 100')],
    ])}
    ${summaryHtml}
    ${disclosureHtml}`;
}

// Inline SVG trend chart for the printed report. Inline (not an <img>) so it
// rasterizes at full resolution in the PDF with no external asset to load.
// Same rules as the on-screen chart: one line, straight segments between real
// points (no smoothing), Y pinned to 0-100, and days without practice absent
// rather than plotted as zero.
function buildMotorTrendSvg(points) {
  const usable = (points ?? []).filter(
    (p) => typeof p?.mean_motor_score === 'number' && Number.isFinite(p.mean_motor_score)
  );
  if (usable.length < 2) {
    return `<p class="note">Not enough session data to show a trend yet.</p>`;
  }

  const W = 520, H = 180, padL = 34, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (i) => padL + (i / (usable.length - 1)) * plotW;
  const y = (v) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

  const line = usable.map((p, i) => `${x(i)},${y(p.mean_motor_score)}`).join(' ');
  const dots = usable
    .map((p, i) => `<circle cx="${x(i)}" cy="${y(p.mean_motor_score)}" r="3" fill="#FFFFFF" stroke="#4338CA" stroke-width="2"/>`)
    .join('');
  const grid = [0, 50, 100]
    .map((v) => `<line x1="${padL}" y1="${y(v)}" x2="${padL + plotW}" y2="${y(v)}" stroke="#E2E6F0" stroke-width="1"/>`
      + `<text x="${padL - 6}" y="${y(v) + 4}" font-size="10" fill="#6B7280" text-anchor="end">${v}</text>`)
    .join('');

  const step = usable.length <= 5 ? 1 : Math.ceil(usable.length / 5);
  const ticks = usable
    .map((p, i) => (i % step === 0 || i === usable.length - 1
      ? `<text x="${x(i)}" y="${H - 8}" font-size="10" fill="#6B7280" text-anchor="middle">${escapeHtml(String(p.date).slice(5))}</text>`
      : ''))
    .join('');

  return `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${grid}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#9CA3AF" stroke-width="1"/>
      <polyline points="${line}" fill="none" stroke="#4338CA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${ticks}
    </svg>
    <p class="note">Motor performance score (0-100) per practice day.</p>`;
}

// Writing Pattern Summary — a descriptive card, never a chart, gauge,
// percentage or ranking. Mirrors the on-screen three-state logic exactly.
// Writing Check — the dedicated, teacher-initiated route. Rendered as a dated
// LIST, never a chart: Pattern A and Pattern B are NOMINAL categories, so a
// line/bar over time would falsely imply they are ordinal. No arrows, no
// colour coding, no improvement/decline wording; each check is an independent
// observation. Cluster ids, model versions and OOD diagnostics stay internal.
function buildWritingCheckHtml(dev) {
  const latest = dev?.latest_writing_check ?? null;
  const during = dev?.writing_checks_during_period ?? [];

  const latestRows = latest
    ? [
        ['Latest Writing Check', fmtDate(latest.observed_at)],
        ['Current Writing Pattern', getWritingCheckPresentation(latest).patternValue],
        ['Reference Status', getWritingCheckPresentation(latest).referenceStatus],
      ]
    : [['Latest Writing Check', 'Not yet available']];

  const latestNote = latest
    ? `<p class="note">${escapeHtml(getLetterMotorPresentation(
        latest.evaluation_status === 'outside_reference_range' ? 'outside_reference_range' : 'assigned'
      ).supportingText)}</p>`
    : '<p class="note">A Writing Check has not yet been completed.</p>';

  const duringHtml = during.length
    ? `<table class="grid"><thead><tr><th>Date</th><th>Result</th><th>Reference Status</th></tr></thead><tbody>${
        during.slice().reverse().map((c) => {
          const p = getWritingCheckPresentation(c);
          return `<tr><td>${escapeHtml(fmtDate(c.observed_at))}</td><td>${escapeHtml(p.patternValue)}</td><td>${escapeHtml(p.referenceStatus)}</td></tr>`;
        }).join('')
      }</tbody></table>`
    : '<p class="note">No Writing Checks were completed during this period.</p>';

  return `
    <p class="subhead">Writing Check</p>
    ${table(latestRows)}
    ${latestNote}
    <p class="subhead">Writing Checks During This Period</p>
    ${duringHtml}`;
}

function buildWritingPatternHtml(dev) {
  const asOf = dev?.state_as_of_end_date ?? null;

  // S2 — the server states which of the four cases applies. An older server
  // that sends no evaluation_status falls back to the previous
  // pattern-present/absent reading.
  const evaluationStatus = dev?.evaluation_status ?? (asOf ? 'assigned' : 'not_reached');
  const presentation = getLetterMotorPresentation(evaluationStatus, { stateCode: asOf?.state_code });
  const patternLabel = presentation.patternValue;
  const referenceStatus = presentation.referenceStatus;

  // Real milestone progress, shown ONLY while no milestone has been
  // evaluated — after a rejection the evidence is complete, so "N of 14"
  // would misdescribe why no pattern appears. Omitted entirely on an older
  // server that does not send reference_progress — never a fabricated count.
  const refProgress = dev?.reference_progress ?? null;
  const progressText = evaluationStatus === 'not_reached'
    ? buildReferenceProgressText(refProgress)
    : null;
  const pendingNote = progressText ? `<p class="note">${escapeHtml(progressText)}</p>` : '';

  return `
    ${table([
      ['Current Writing Pattern', patternLabel],
      ['Pattern Updates', (dev?.milestones_during_period ?? []).length],
      ['Reference Status', referenceStatus],
    ])}
    <p class="note">${escapeHtml(presentation.supportingText)}</p>
    ${pendingNote}
    ${buildWritingCheckHtml(dev)}
    <p class="note">${escapeHtml(LETTER_MOTOR_PATTERN_CAPTION)}</p>`;
}

function buildWordWritingHtml(words) {
  return `
    ${table([
      ['Words Practiced', words.words_attempted_during_period],
      ['Practice Attempts', words.attempts_during_period],
      ['Words Completed', words.words_completed_during_period],
      // Only shown when something was practised — 0 of 0 is not 0%.
      words.words_attempted_during_period > 0
        ? ['Completion', `${Math.round((words.words_completed_during_period / words.words_attempted_during_period) * 100)}%`]
        : null,
      ['Average Word Score', fmtNum(words.mean_word_score, ' / 100')],
    ])}
    ${words.words_attempted_during_period > 0
      ? ''
      : '<p class="note">No word writing was practised during this period.</p>'}
    <p class="note">${escapeHtml(words.size_spacing_feedback_note)}</p>`;
}

function buildRecommendationsHtml(support) {
  const recs = support.worksheet_recommendations_current ?? [];
  const recsHtml = recs.length
    ? `<table class="grid"><thead><tr><th>Family</th><th>Recommendation</th></tr></thead><tbody>${
        recs.map((r) => `<tr><td>${escapeHtml(r.case_type)} / ${escapeHtml(r.family)}</td><td>${escapeHtml(r.title)}</td></tr>`).join('')
      }</tbody></table>`
    : `<p class="note">No worksheet recommendations are currently active.</p>`;

  const validations = support.teacher_validations_during_period ?? [];
  const validationsHtml = validations.length
    ? `<table class="grid"><thead><tr><th>Date</th><th>Recommendation</th><th>Decision</th></tr></thead><tbody>${
        validations.map((v) => `<tr><td>${escapeHtml(fmtDate(v.at))}</td><td>${escapeHtml(v.title)}</td><td>${escapeHtml(v.decision)}</td></tr>`).join('')
      }</tbody></table>`
    : `<p class="note">No teacher review actions were recorded during this period.</p>`;

  return `<p class="subhead">Current worksheet recommendations</p>${recsHtml}<p class="subhead">Teacher review actions during this period</p>${validationsHtml}`;
}

// Home practice summary. Compact by design: counts, the worksheet live on the
// end date, and a short activity table. The scanned worksheet image is NEVER
// embedded, and a full teacher comment is not carried here — a short review
// outcome is what a periodic report needs.
function buildHomePracticeHtml(home) {
  const active = home?.active_worksheet_as_of_end_date ?? null;
  const during = home?.worksheets_during_period ?? [];
  const reviews = home?.teacher_reviews_during_period ?? [];

  const rows = [
    ['Worksheets Assigned', home?.worksheets_assigned ?? 0],
    ['Worksheets Submitted', home?.worksheets_submitted ?? 0],
    ['Worksheets Reviewed', home?.worksheets_reviewed ?? 0],
  ];
  if (active) {
    rows.push(['Active Worksheet', active.worksheet_code]);
    rows.push(['Target Letter', active.target_letter]);
    rows.push(['Status', getWorksheetStatusLabel(active.status)]);
  }

  const activity = [
    ...during.map((w) => [w.assigned_at, w.target_letter, getWorksheetStatusLabel(w.status)]),
    ...reviews.map((r) => [r.reviewed_at, r.target_letter ?? '', getReviewStatusLabel(r.review_status)]),
  ].sort((a, b) => new Date(a[0]) - new Date(b[0]));

  const activityHtml = activity.length
    ? `<table class="grid"><thead><tr><th>Date</th><th>Target Letter</th><th>Activity</th></tr></thead><tbody>${
        activity.map(([when, letter, status]) =>
          `<tr><td>${escapeHtml(formatWorksheetDate(when))}</td><td>${escapeHtml(letter)}</td><td>${escapeHtml(status)}</td></tr>`
        ).join('')
      }</tbody></table>`
    : `<p class="note">${escapeHtml(EMPTY_NO_PERIOD_ACTIVITY)}</p>`;

  return `${table(rows)}${activityHtml}`;
}

/**
 * Pure HTML builder — no RN import, directly unit-testable.
 * @param {Object} report — the exact object GET /handwriting/report returns.
 * @returns {string} a complete, self-contained HTML document.
 */
export function buildReportHtml(report) {
  const m = report.metadata ?? {};
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1A2E; padding: 32px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .brand { font-size: 12px; letter-spacing: 2px; color: #6B8EE8; font-weight: 700; margin-bottom: 4px; }
  .meta table { margin-bottom: 20px; }
  h2 { font-size: 15px; margin: 22px 0 8px 0; border-bottom: 1px solid #E2E6F0; padding-bottom: 4px; }
  .subhead { font-size: 12.5px; font-weight: 700; color: #5A5F7A; margin: 12px 0 4px 0; }
  .note { font-size: 12px; color: #5A5F7A; font-style: italic; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.kv td { padding: 4px 6px; border-bottom: 1px solid #F0F2FA; }
  table.kv td.label { color: #5A5F7A; width: 60%; }
  table.kv td.value { font-weight: 600; text-align: right; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  table.grid th { text-align: left; background: #F7F8FC; padding: 5px 6px; border-bottom: 1px solid #E2E6F0; }
  table.grid td { padding: 5px 6px; border-bottom: 1px solid #F0F2FA; }
  .summary { font-size: 13px; background: #F7F8FC; border-radius: 8px; padding: 12px 14px; margin-top: 8px; }
  .bar-row { margin: 10px 0 14px 0; }
  .bar-head { display: flex; justify-content: space-between; font-size: 12.5px; color: #1A1A2E; margin-bottom: 4px; }
  .bar-track { height: 10px; background: #EDF0F7; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 10px; background: #4338CA; border-radius: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bar-pct { font-size: 11px; color: #5A5F7A; text-align: right; margin-top: 2px; }
  svg { display: block; margin: 6px auto; max-width: 100%; }
  .footer { margin-top: 28px; font-size: 10px; color: #9B9FB0; }
</style>
</head>
<body>
  <div class="brand">AURIVA</div>
  <h1>Handwriting Progress Report</h1>

  <div class="meta">
    ${table([
      ['Student', m.student_name],
      ['Teacher', m.teacher_name],
      ['Reporting period', `${m.period?.start_date ?? ''} to ${m.period?.end_date ?? ''}`],
      ['Generated', fmtDate(m.generated_at)],
    ])}
  </div>

  ${section(1, 'Letter Learning Progress', buildLearningProgressHtml(report.learning_progress ?? {}))}
  ${section(2, 'Handwriting Performance', buildMotorPerformanceHtml(report.motor_performance ?? {}))}
  ${section(3, 'Motor Performance Over Time', buildMotorTrendSvg(report.motor_performance?.daily_series))}
  ${section(4, 'Initial Handwriting Skills Summary', buildInitialProfileHtml(report.initial_shape_motor_profile ?? {}))}
  ${section(5, 'Writing Pattern Summary', buildWritingPatternHtml(report.letter_motor_development ?? {}))}
  ${section(6, 'Word Writing Progress', buildWordWritingHtml(report.word_writing ?? {}))}
  ${section(7, 'Recommendations / Teacher Notes', buildRecommendationsHtml(report.adaptive_support ?? {}))}
  ${section(8, 'Home Practice', buildHomePracticeHtml(report.home_practice ?? {}))}

  <div class="summary">${escapeHtml(report.summary_text)}</div>

  <div class="footer">Auriva Handwriting Progress Report — generated for educational supervision purposes.</div>
</body>
</html>`;
}

/**
 * Sanitizes a student name into a safe filename segment — letters/digits/
 * spaces only, spaces collapsed to underscores (spec §20: "sanitize
 * student name, avoid path traversal").
 *
 * Now a thin alias over the shared implementation in pdfShare.js, so the
 * report and the worksheet sanitize names identically. Behaviour, including
 * the 'Student' fallback, is unchanged.
 */
export function sanitizeForFilename(value) {
  return sanitizeSegment(value, 'Student');
}

/**
 * @param {{studentName: string, startDate: string, endDate: string}} params
 * @returns {string} e.g. "Auriva_Handwriting_Report_Jane_Doe_2026-01-01_2026-06-30.pdf"
 */
export function buildReportFilename({ studentName, startDate, endDate }) {
  return `Auriva_Handwriting_Report_${sanitizeForFilename(studentName)}_${startDate}_${endDate}.pdf`;
}

/**
 * Generates a real PDF from the report and opens the native share sheet
 * for it (spec §21 — genuine document sharing, never a plaintext
 * fallback). The ONLY function in this module that touches
 * expo-print/expo-sharing/expo-file-system.
 *
 * Never throws to the caller — every failure resolves to a tagged result
 * so the screen can show an adult-facing message without crashing (spec
 * §22). A cancelled share is reported as 'cancelled', never as a failure
 * (spec §21).
 *
 * @param {{report: Object, studentName: string, startDate: string, endDate: string}} params
 * @returns {Promise<{status: 'shared'|'cancelled'|'sharing_unavailable'|'failed', error: string|null}>}
 */
export async function exportAndSharePeriodicReportPdf({ report, studentName, startDate, endDate }) {
  const generated = await generatePeriodicReportPdf({ report, studentName, startDate, endDate });
  if (generated.status !== 'generated') return { status: generated.status, error: generated.error };
  return sharePeriodicReportPdf({ fileUri: generated.fileUri, studentName });
}

/**
 * STEP 1 — build the PDF and return where it landed, WITHOUT sharing it.
 *
 * Split out so a teacher can review the report before deciding whether to send
 * it to anyone: the previous single action generated and immediately opened the
 * share sheet, giving no opportunity to check the contents first. Sharing a
 * child's progress report is not reversible once it has left the device, so the
 * review step is a safeguard, not a convenience.
 *
 * Also returns the `html` used to build the PDF, so the preview can render
 * exactly the document that was written to disk rather than a second,
 * separately-assembled approximation that could drift from it.
 *
 * Never throws — every failure resolves to a tagged result.
 *
 * @param {{report: Object, studentName: string, startDate: string, endDate: string}} params
 * @returns {Promise<{status: 'generated'|'failed', fileUri: string|null, filename: string|null, html: string|null, error: string|null}>}
 */
export async function generatePeriodicReportPdf({ report, studentName, startDate, endDate }) {
  try {
    // Required at call time, not at module top-level, so this pure-logic
    // file can still be imported/unit-tested under plain jest (no RN
    // native module registry) without crashing on import.
    const Print = require('expo-print');
    // expo-file-system v19 (Expo SDK 54) moved the old filesystem API behind
    // `expo-file-system/legacy`. On the main entry point `cacheDirectory` is
    // no longer exported (so it reads as `undefined`) and `copyAsync` THROWS
    // a deprecation Error at runtime. Migrated to the supported File/Paths
    // API rather than importing the deprecated entry point.
    const { File, Paths } = require('expo-file-system');

    const html = buildReportHtml(report);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // expo-print writes a random cache filename — copy to our own
    // predictable, sanitized name (spec §20) before sharing, so the
    // filename the parent/therapist actually sees is meaningful.
    const filename = buildReportFilename({ studentName, startDate, endDate });
    const target = new File(Paths.cache, filename);

    // `File.copy()` throws if the destination already exists, whereas the
    // previous `copyAsync` overwrote it. Exporting the same student+range
    // twice in one session is entirely normal, so clear a stale copy first.
    if (target.exists) target.delete();

    new File(uri).copy(target);

    return { status: 'generated', fileUri: target.uri, filename, html, error: null };
  } catch (err) {
    const message = err?.message ?? String(err);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[periodicReportPdf] generate failed:', message);
    }
    return { status: 'failed', fileUri: null, filename: null, html: null, error: message };
  }
}

/**
 * STEP 2 — share an ALREADY-GENERATED file. Called only after the teacher has
 * reviewed the report and chosen to send it.
 *
 * Takes a file uri rather than the report object so it physically cannot share
 * a different document from the one that was previewed.
 *
 * @param {{fileUri: string, studentName: string}} params
 * @returns {Promise<{status: 'shared'|'cancelled'|'sharing_unavailable'|'failed', error: string|null}>}
 */
export async function sharePeriodicReportPdf({ fileUri, studentName }) {
  // Report-specific wording only; the mechanics (availability, cancellation
  // handling, never re-rendering) live in pdfShare.js and are shared with the
  // worksheet exporter.
  return sharePdfFile({
    fileUri,
    dialogTitle: `Auriva Handwriting Report — ${studentName}`,
    missingFileMessage: 'No generated report to share.',
    logTag: 'periodicReportPdf',
  });
}
