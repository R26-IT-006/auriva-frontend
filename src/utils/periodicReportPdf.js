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

function buildLearningProgressHtml(learning) {
  return table([
    ['Lowercase letters mastered during period', learning.lowercase_mastered_during_period],
    ['Uppercase letters mastered during period', learning.uppercase_mastered_during_period],
    ['Cumulative lowercase mastered (as of end date)', learning.cumulative_lowercase_mastered_by_end_date],
    ['Cumulative uppercase mastered (as of end date)', learning.cumulative_uppercase_mastered_by_end_date],
    ['Current progression stage', learning.current_progression_stage],
  ]);
}

function buildMotorPerformanceHtml(motor) {
  return table([
    ['Attempts in period', motor.attempts_in_period],
    ['Mean motor score', fmtNum(motor.mean_motor_score, ' / 100')],
    ['Median motor score', fmtNum(motor.median_motor_score, ' / 100')],
    ['Mean smoothness score', fmtNum(motor.mean_smoothness_score, ' / 100')],
    ['Mean trajectory similarity (DTW distance)', fmtNum(motor.mean_trajectory_dtw_distance)],
    ['Mean speed consistency (speed CV)', fmtNum(motor.mean_speed_cv)],
    ['Mean attempt duration', motor.mean_duration_ms != null ? `${Math.round(motor.mean_duration_ms / 100) / 10}s` : 'Not available'],
  ]);
}

function buildInitialProfileHtml(profile) {
  if (!profile?.available) {
    return `<p class="note">No initial motor baseline is recorded for this student.</p>`;
  }
  return `
    <p class="note">Baseline/initial context — recorded ${escapeHtml(fmtDate(profile.recorded_at))}. This profile may predate the selected reporting period.</p>
    ${table([
      ['Straight-line control', fmtNum(profile.scores?.straight, ' / 100')],
      ['Curved-line control', fmtNum(profile.scores?.curved, ' / 100')],
      ['Complex-shape control', fmtNum(profile.scores?.complex, ' / 100')],
      ['Overall motor score', fmtNum(profile.scores?.overall, ' / 100')],
    ])}`;
}

function buildLetterMotorDevelopmentHtml(dev) {
  const asOf = dev.state_as_of_end_date;
  const asOfHtml = asOf
    ? table([
        ['Milestone', asOf.milestone],
        ['Letter Motor State', asOf.display_name],
        ['Observed', fmtDate(asOf.observed_at)],
      ])
    : `<p class="note">No Letter Motor State milestone has been observed as of the end of this period.</p>`;

  const rows = dev.milestones_during_period ?? [];
  const historyHtml = rows.length
    ? `<table class="grid"><thead><tr><th>Milestone</th><th>Letter Motor State</th><th>Observed</th></tr></thead><tbody>${
        rows.map((m) => `<tr><td>${escapeHtml(m.milestone)}</td><td>${escapeHtml(m.display_name)}</td><td>${escapeHtml(fmtDate(m.observed_at))}</td></tr>`).join('')
      }</tbody></table>`
    : `<p class="note">No new milestones were observed during this period.</p>`;

  return `<p class="subhead">State as of end of period</p>${asOfHtml}<p class="subhead">Milestones observed during this period</p>${historyHtml}`;
}

function buildWordWritingHtml(words) {
  return `
    ${table([
      ['Words attempted during period', words.words_attempted_during_period],
      ['Attempts during period', words.attempts_during_period],
      ['Words completed during period', words.words_completed_during_period],
      ['Mean word score', fmtNum(words.mean_word_score, ' / 100')],
    ])}
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

  ${section(1, 'Learning Progress', buildLearningProgressHtml(report.learning_progress ?? {}))}
  ${section(2, 'Motor Performance', buildMotorPerformanceHtml(report.motor_performance ?? {}))}
  ${section(3, 'Initial Shape Motor Profile', buildInitialProfileHtml(report.initial_shape_motor_profile ?? {}))}
  ${section(4, 'Letter Motor Development', buildLetterMotorDevelopmentHtml(report.letter_motor_development ?? {}))}
  ${section(5, 'Word Writing', buildWordWritingHtml(report.word_writing ?? {}))}
  ${section(6, 'Recommendations / Teacher Notes', buildRecommendationsHtml(report.adaptive_support ?? {}))}

  <div class="summary">${escapeHtml(report.summary_text)}</div>

  <div class="footer">Auriva Handwriting Progress Report — generated for educational supervision purposes.</div>
</body>
</html>`;
}

/**
 * Sanitizes a student name into a safe filename segment — letters/digits/
 * spaces only, spaces collapsed to underscores (spec §20: "sanitize
 * student name, avoid path traversal").
 */
export function sanitizeForFilename(value) {
  return String(value ?? 'Student')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'Student';
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
  try {
    // Required at call time, not at module top-level, so this pure-logic
    // file can still be imported/unit-tested under plain jest (no RN
    // native module registry) without crashing on import.
    const Print = require('expo-print');
    const Sharing = require('expo-sharing');
    const FileSystem = require('expo-file-system');

    const html = buildReportHtml(report);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // expo-print writes a random cache filename — copy to our own
    // predictable, sanitized name (spec §20) before sharing, so the
    // filename the parent/therapist actually sees is meaningful.
    const filename = buildReportFilename({ studentName, startDate, endDate });
    const targetUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: targetUri });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { status: 'sharing_unavailable', error: 'Sharing is not available on this device.' };
    }

    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Auriva Handwriting Report — ${studentName}`,
      UTI: 'com.adobe.pdf',
    });
    return { status: 'shared', error: null };
  } catch (err) {
    // expo-sharing resolves (not rejects) on user cancellation on most
    // platforms, but some native share-sheet cancellations surface as a
    // rejected promise with a recognizable message — treated as
    // 'cancelled', never as a genuine failure (spec §21).
    const message = err?.message ?? String(err);
    if (/cancel/i.test(message)) {
      return { status: 'cancelled', error: null };
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[periodicReportPdf] export/share failed:', message);
    }
    return { status: 'failed', error: message };
  }
}
