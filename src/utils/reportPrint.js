// TASK-48 — shared print/export for the two dialogue report screens.
//
// expo-print and expo-sharing are NATIVE modules: their JS lives in
// node_modules, but the native half only exists in an app binary built after
// they were added. A top-level `import` of them therefore throws
// "Cannot find native module 'ExpoPrint'" at module-evaluation time on any
// older build — which would take down both report screens, not just printing.
//
// So they are required lazily, inside the call, and their absence is reported
// as a normal error the screen can show. Building the HTML never touches them
// at all, which also keeps this module importable in tests and on web.
//
// This module does NO data interpretation. Callers pass sentences that are
// already the exact strings their screen renders, so the printed wording can
// never drift from the on-screen wording. Everything here is layout only.
//
// The document is deliberately self-contained: no <script>, no <link>, no
// remote fonts or images. A teacher may print this on a device with no network,
// and a print job that silently waited on a CDN would be worse than a plain one.

/** Minimal HTML escaping — student names and word text are user data. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a2e;
    margin: 32px;
    font-size: 12pt;
    line-height: 1.45;
  }
  h1 { font-size: 18pt; margin: 0 0 2px; }
  .sub { color: #5a5f7a; font-size: 10pt; margin: 0; }
  .generated { color: #9b9fb0; font-size: 9pt; margin: 2px 0 20px; }
  .overview { border: 1px solid #e2e6f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
  .overview table { width: 100%; border-collapse: collapse; }
  .overview td { padding: 3px 12px 3px 0; font-size: 11pt; vertical-align: baseline; }
  .overview td.label { color: #5a5f7a; }
  .overview td.value { font-weight: 700; text-align: right; white-space: nowrap; }
  h2 {
    font-size: 13pt;
    margin: 22px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e6f0;
    page-break-after: avoid;
  }
  ul { margin: 0 0 4px; padding-left: 18px; }
  li { margin: 2px 0; page-break-inside: avoid; }
  .empty { color: #5a5f7a; font-style: italic; }
  .footnote { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e2e6f0; color: #5a5f7a; font-size: 9pt; }
`;

/**
 * Builds a self-contained print document from a generic report shape both
 * dialogue report screens can produce:
 *
 *   { title, studentName, generatedAt, footnote,
 *     overview: [{ label, value }],
 *     sections: [{ heading, lines: [string, ...] }] }
 *
 * `lines` are already-plain-language sentences produced by the calling screen.
 * A report with no sections (a brand-new student) still renders a valid page.
 */
export function buildReportHtml({
  title = 'Report',
  studentName = '',
  generatedAt = '',
  footnote = '',
  overview = [],
  sections = [],
} = {}) {
  const overviewHtml = overview.length === 0 ? '' : `
    <div class="overview">
      <table>
        ${overview.map((o) => `
          <tr>
            <td class="label">${escapeHtml(o.label)}</td>
            <td class="value">${escapeHtml(o.value)}</td>
          </tr>`).join('')}
      </table>
    </div>`;

  const sectionsHtml = sections.length === 0
    ? '<p class="empty">No activity has been recorded for this student yet.</p>'
    : sections.map((s) => `
        <h2>${escapeHtml(s.heading)}</h2>
        ${(s.lines || []).length === 0
          ? '<p class="empty">Nothing recorded yet.</p>'
          : `<ul>${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`}
      `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${studentName ? `<p class="sub">${escapeHtml(studentName)}</p>` : ''}
${generatedAt ? `<p class="generated">Generated ${escapeHtml(generatedAt)}</p>` : ''}
${overviewHtml}
${sectionsHtml}
${footnote ? `<p class="footnote">${escapeHtml(footnote)}</p>` : ''}
</body>
</html>`;
}

/** Loads a native module, or null when this build does not contain it. */
function loadNativeModule(name) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = name === 'expo-print' ? require('expo-print') : require('expo-sharing');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

const PRINT_UNAVAILABLE =
  'Printing needs a new build of the app. The print feature was added after '
  + 'this build was installed, so its native part is missing — rebuild and '
  + 'reinstall the app, then try again.';

/** True when this build actually contains the printing native module. */
export function isPrintAvailable() {
  return loadNativeModule('expo-print') !== null;
}

/**
 * Opens the native print dialog (which on both iOS and Android also offers
 * "Save as PDF"). If that call throws — some devices have no print service —
 * falls back to rendering a PDF and opening the share sheet so the teacher can
 * still save or send it. If sharing is unavailable too, the original error is
 * rethrown for the caller to surface.
 */
export async function printReport(html) {
  const Print = loadNativeModule('expo-print');
  if (!Print) throw new Error(PRINT_UNAVAILABLE);

  try {
    await Print.printAsync({ html });
  } catch (err) {
    const { uri } = await Print.printToFileAsync({ html });
    const Sharing = loadNativeModule('expo-sharing');
    if (Sharing && await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } else {
      throw err;
    }
  }
}

/** Human date for the "Generated ..." line. */
export function printTimestamp(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
