/**
 * pronunciationReportPdf.js
 *
 * The Pronunciation report: the Student Profile's Pronunciation tab summary
 * (utils/pronunciationModuleSummary.js) written out as a PDF, so a teacher can
 * download it or share it with a parent or therapist.
 *
 * Same flow as the handwriting report (periodicReportPdf.js):
 *   1. generatePronunciationReportPdf — build the PDF on this device and return
 *      its uri plus the html it was built from, for the preview;
 *   2. share / download THAT file by uri (pdfShare.js), never a rebuilt copy.
 *
 * The report shows only what the tab already shows — overall scores, counts,
 * the per-category breakdown, per-word scores and sounds to practise. No raw
 * model internals (DTW, confidence, calibration) appear in it.
 *
 * expo-print / expo-file-system are required lazily, so the html builder stays
 * unit-testable under plain jest.
 */

'use strict';

import { sharePdfFile, savePdfFile, sanitizeForFilename } from './pdfShare';
import { LOOK_AGAIN_BELOW, ALPHABET_KEY } from './pronunciationModuleSummary';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const pct = (n) => (n == null ? '—' : `${n}%`);

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function kv(rows) {
  return `<table class="kv">${rows
    .map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`)
    .join('')}</table>`;
}

function barHtml(label, value) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return `<div class="bar-row">
    <div class="bar-head"><span>${escapeHtml(label)}</span><span>${escapeHtml(pct(value))}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
  </div>`;
}

function soundsHtml(sounds) {
  if (!sounds?.length) return '<p class="note">No sounds stood out as needing practice.</p>';
  return `<p>${sounds
    .map((s) => `<span class="chip"><b>${escapeHtml(s.text)}</b> ${escapeHtml(pct(s.average))} · ${s.count}×</span>`)
    .join(' ')}</p>`;
}

function categoryHtml(group) {
  const unit = group.key === ALPHABET_KEY ? 'letters' : 'words';
  const change = group.latestScore != null && group.firstScore != null && group.attempts > 1
    ? group.latestScore - group.firstScore
    : null;
  const rows = (group.words || []).map((w) => `<tr>
      <td>${escapeHtml(w.label)}${w.flagged ? ' <span class="flag">(awaiting review)</span>' : ''}</td>
      <td class="num ${w.latest != null && w.latest < LOOK_AGAIN_BELOW ? 'low' : ''}">${escapeHtml(pct(w.latest))}</td>
      <td class="num">${escapeHtml(pct(w.best))}</td>
      <td class="num">${escapeHtml(pct(w.average))}</td>
      <td class="num">${w.attempts}</td>
    </tr>`).join('');

  return `<div class="category">
    <h3>${escapeHtml(group.label)}</h3>
    ${kv([
      ['Practised', `${group.practised}${group.total ? ` of ${group.total}` : ''} ${unit}`],
      ['Tries', String(group.attempts)],
      ['Average score', pct(group.average)],
      ['Latest score', pct(group.latestScore)],
      ['Change since first try', change == null ? '—' : change > 0 ? `+${change}` : String(change)],
      ['Last practised', fmtDate(group.latestAt)],
    ])}
    <div class="subhead">Sounds to practise</div>
    ${soundsHtml(group.sounds)}
    ${rows ? `<div class="subhead">${unit === 'letters' ? 'Letters' : 'Words'}</div>
    <table class="grid">
      <tr><th>${unit === 'letters' ? 'Letter' : 'Word'}</th><th class="num">Latest</th><th class="num">Best</th><th class="num">Average</th><th class="num">Tries</th></tr>
      ${rows}
    </table>` : ''}
    ${group.notYet?.length ? `<p class="note">Not practised yet: ${group.notYet.map(escapeHtml).join(', ')}</p>` : ''}
  </div>`;
}

/**
 * @param {Object} summary  from buildPronunciationSummary()
 * @param {{ studentName: string, generatedAt?: Date }} meta
 * @returns {string} a self-contained html document
 */
export function buildPronunciationReportHtml(summary, { studentName, generatedAt = new Date() } = {}) {
  const s = summary || { attempts: 0, groups: [], lookAgain: [], sounds: [] };
  const groups = s.groups || [];

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1A2E; padding: 32px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .brand { font-size: 12px; letter-spacing: 2px; color: #2A7146; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 22px 0 8px 0; border-bottom: 1px solid #E2E6F0; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 18px 0 6px 0; color: #1F5A3A; }
  .subhead { font-size: 12.5px; font-weight: 700; color: #5A5F7A; margin: 12px 0 4px 0; }
  .note { font-size: 12px; color: #5A5F7A; font-style: italic; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.kv td { padding: 4px 6px; border-bottom: 1px solid #F0F2FA; }
  table.kv td.label { color: #5A5F7A; width: 60%; }
  table.kv td.value { font-weight: 600; text-align: right; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  table.grid th { text-align: left; background: #F4F8F5; padding: 5px 6px; border-bottom: 1px solid #E2E6F0; }
  table.grid td { padding: 5px 6px; border-bottom: 1px solid #F0F2FA; }
  .num { text-align: right; }
  .low { color: #B5462C; font-weight: 700; }
  .flag { color: #B86E12; font-size: 10.5px; }
  .chip { display: inline-block; background: #F4F8F5; border-radius: 6px; padding: 3px 8px; margin: 2px 4px 2px 0; font-size: 12px; }
  .bar-row { margin: 8px 0 10px 0; }
  .bar-head { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; }
  .bar-track { height: 10px; background: #EDF0F7; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 10px; background: #2A7146; border-radius: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .category { page-break-inside: avoid; }
  .footer { margin-top: 28px; font-size: 10px; color: #9B9FB0; }
</style></head>
<body>
  <div class="brand">AURIVA</div>
  <h1>Pronunciation Progress Report</h1>
  ${kv([
    ['Student', studentName || 'Student'],
    ['Report date', fmtDate(generatedAt.toISOString())],
    ['Covers', s.capped ? `The most recent ${s.attempts} attempts` : 'All attempts'],
  ])}

  <h2>1. Overview</h2>
  ${kv([
    ['Attempts', String(s.attempts)],
    ['Words practised', String(s.wordsPractised ?? 0)],
    ['Average score', pct(s.averageScore)],
    ['Latest score', pct(s.latestScore)],
    ['Last practised', fmtDate(s.latestAt)],
    ['Attempts awaiting teacher review', String(s.flagged ?? 0)],
  ])}

  <h2>2. Category breakdown</h2>
  ${groups.length ? groups.map((g) => barHtml(`${g.label} — ${g.practised}${g.total ? ` of ${g.total}` : ''}`, g.average)).join('') : '<p class="note">No practice recorded yet.</p>'}

  <h2>3. Sounds to practise</h2>
  ${soundsHtml(s.sounds)}

  <h2>4. Worth another look</h2>
  ${s.lookAgain?.length
    ? `<p>${s.lookAgain.map((w) => `<span class="chip">${escapeHtml(w.label)} ${escapeHtml(pct(w.score))}</span>`).join(' ')}</p>`
    : '<p class="note">Nothing needs another look right now.</p>'}

  <h2>5. Category details</h2>
  ${groups.map(categoryHtml).join('')}

  <div class="footer">Auriva Pronunciation Progress Report — scores are the app's automatic pronunciation scores, generated for educational supervision purposes.</div>
</body></html>`;
}

/** e.g. "Auriva_Pronunciation_Report_Jane_Doe_2026-10-06.pdf" */
export function buildPronunciationReportFilename({ studentName, date = new Date() }) {
  return `Auriva_Pronunciation_Report_${sanitizeForFilename(studentName)}_${date.toISOString().slice(0, 10)}.pdf`;
}

/**
 * Builds the PDF and returns where it landed, WITHOUT sharing it, plus the
 * html it was built from so the preview shows exactly that document.
 * Never throws.
 *
 * @returns {Promise<{status: 'generated'|'failed', fileUri: string|null, filename: string|null, html: string|null, error: string|null}>}
 */
export async function generatePronunciationReportPdf({ summary, studentName }) {
  try {
    const Print = require('expo-print');
    const { File, Paths } = require('expo-file-system');

    const html = buildPronunciationReportHtml(summary, { studentName });
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const filename = buildPronunciationReportFilename({ studentName });
    const target = new File(Paths.cache, filename);
    if (target.exists) target.delete();
    new File(uri).copy(target);

    return { status: 'generated', fileUri: target.uri, filename, html, error: null };
  } catch (err) {
    const message = err?.message ?? String(err);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[pronunciationReportPdf] generate failed:', message);
    }
    return { status: 'failed', fileUri: null, filename: null, html: null, error: message };
  }
}

export function sharePronunciationReportPdf({ fileUri, studentName }) {
  return sharePdfFile({
    fileUri,
    dialogTitle: `Auriva Pronunciation Report — ${studentName}`,
    missingFileMessage: 'No generated report to share.',
    logTag: 'pronunciationReportPdf',
  });
}

export function downloadPronunciationReportPdf({ fileUri, filename }) {
  return savePdfFile({ fileUri, filename, logTag: 'pronunciationReportPdf' });
}
