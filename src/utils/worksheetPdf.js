/**
 * worksheetPdf.js
 *
 * Builds a printable, personalised A4 handwriting practice worksheet.
 *
 * ── The teaching order this file exists to express ────────────────────────
 * The page never opens with the letter the child is struggling with. It works
 * up to it:
 *
 *   1  Motor Warm-Up      the strokes this letter is made of
 *   2  Shape Practice     its primary shape, large -> medium -> small
 *   3  Trace the Letter   dotted letters with a start dot
 *   4  Copy the Letter    one model, then guided blanks
 *   5  Write on Your Own  guidelines only
 *   6  Find the Letter    (optional, light recognition)
 *
 * ── ASD-friendly rendering rules ──────────────────────────────────────────
 * One instruction per section, always in the same place. Black on white, no
 * decorative colour, no illustrations, no scores, no marks, no praise
 * stickers. Generous spacing. Targets start large and narrow gradually.
 * Guidelines are a light grey so the child's own pencil line stays dominant.
 *
 * ── Pure by design ────────────────────────────────────────────────────────
 * buildWorksheetHtml() is a pure string builder with no react-native or api
 * import, exactly like periodicReportPdf.js's own builder, so it is directly
 * unit-testable. Only the export/share helper touches expo-print.
 *
 * Letter glyphs are drawn from the SAME fractional waypoint paths the writing
 * screens use (activityPreviewLetterPaths.js), so a traced letter on paper has
 * the shape the child is taught on screen — not a font approximation.
 */

'use strict';

import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from '../constants/activityPreviewLetterPaths';
// The shared expo-sharing wrapper + filename sanitizer. Dependency-free at
// module level, so the pure builders above stay unit-testable.
import { sharePdfFile, sanitizeForFilename } from './pdfShare';
import { A4, REPEATS, resolveRowHeights } from './worksheetLayoutA4';

// ─── Page geometry (A4 portrait, mm) ────────────────────────────────────────
const PAGE = { width: A4.widthMm, height: A4.heightMm, margin: A4.marginMm };

/** The letter grid. Geometry only — printed size is passed separately, in mm. */
const GLYPH_UNITS = 24;

// Guideline band: top / mid (x-height) / baseline, like ruled practice paper.
const BAND = { top: 0.0, mid: 0.36, base: 0.64, descender: 0.92 };

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Normalizes a letter path to an array of strokes (an array of point arrays). */
function toStrokes(path) {
  if (!Array.isArray(path) || path.length === 0) return [];
  return Array.isArray(path[0]) ? path : [path];
}

function getLetterPath(letter, caseType) {
  const table = caseType === 'uppercase' ? UPPERCASE_LETTER_PATHS : LOWERCASE_LETTER_PATHS;
  return toStrokes(table?.[letter]);
}

/**
 * One letter glyph as SVG, drawn from the real waypoints.
 * `dotted` renders the tracing form; solid renders the model letter.
 */
function letterGlyphSvg(letter, caseType, printMm, { dotted = true, showStart = true } = {}) {
  const strokes = getLetterPath(letter, caseType);
  if (strokes.length === 0) return '';

  // Geometry stays on a fixed 24-unit grid — the canonical letter shape is
  // untouched — while the PRINTED size is stated in millimetres. The old
  // sheet used the same number for both, so a "24" glyph printed at 24px
  // (~6mm) and no amount of layout work made it bigger.
  const size = GLYPH_UNITS;

  const dash = dotted ? ' stroke-dasharray="2.2 2.6"' : '';
  const colour = dotted ? '#9AA3B2' : '#111827';
  const paths = strokes.map((points) => {
    if (points.length === 1) {
      // A single waypoint is a dot (the tittle on i / j).
      return `<circle cx="${(points[0].fx * size).toFixed(2)}" cy="${(points[0].fy * size).toFixed(2)}" r="${(size * 0.03).toFixed(2)}" fill="${colour}"/>`;
    }
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.fx * size).toFixed(2)},${(p.fy * size).toFixed(2)}`)
      .join(' ');
    return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${(size * 0.055).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  }).join('');

  // A single filled start dot on the first stroke — where the pencil begins.
  const first = strokes[0][0];
  const start = (showStart && dotted && first)
    ? `<circle cx="${(first.fx * size).toFixed(2)}" cy="${(first.fy * size).toFixed(2)}" r="${(size * 0.05).toFixed(2)}" fill="#111827"/>`
    : '';

  return `<svg class="glyph" width="${printMm}mm" height="${printMm}mm" viewBox="0 0 ${size} ${size}">${guidelinesSvg(size)}${paths}${start}</svg>`;
}

/** Faint top / x-height / baseline guides inside a glyph box. */
function guidelinesSvg(size) {
  const line = (y, style) =>
    `<line x1="0" y1="${(y * size).toFixed(2)}" x2="${size}" y2="${(y * size).toFixed(2)}" stroke="#D7DCE5" stroke-width="0.5"${style}/>`;
  return line(BAND.top + 0.08, '')
    + line(BAND.mid, ' stroke-dasharray="1.5 1.5"')
    + line(BAND.base, '');
}

/** A ruled writing row: top, dashed mid, solid baseline. Nothing else. */
function writingRowSvg(widthMm, heightMm) {
  const h = heightMm;
  return `<svg class="row" width="100%" height="${h}mm" viewBox="0 0 100 ${h}" preserveAspectRatio="none">
    <line x1="0" y1="${(h * 0.12).toFixed(2)}" x2="100" y2="${(h * 0.12).toFixed(2)}" stroke="#D7DCE5" stroke-width="0.35"/>
    <line x1="0" y1="${(h * 0.5).toFixed(2)}" x2="100" y2="${(h * 0.5).toFixed(2)}" stroke="#D7DCE5" stroke-width="0.3" stroke-dasharray="1.2 1.2"/>
    <line x1="0" y1="${(h * 0.88).toFixed(2)}" x2="100" y2="${(h * 0.88).toFixed(2)}" stroke="#4B5563" stroke-width="0.45"/>
  </svg>`;
}

// ─── Warm-up shape rows (Section 1) ─────────────────────────────────────────
//
// Each of the six shape ids renders as a repeating dotted motif across a ruled
// row. Large, simple, evenly spaced — a movement to rehearse, not a puzzle.
const SHAPE_MOTIFS = {
  vertical_line:   (x, u) => `M${x + u * 0.5},${u * 0.15} L${x + u * 0.5},${u * 0.85}`,
  horizontal_line: (x, u) => `M${x + u * 0.1},${u * 0.5} L${x + u * 0.9},${u * 0.5}`,
  full_circle:     (x, u) => `M${x + u * 0.5},${u * 0.15} A${u * 0.35},${u * 0.35} 0 1 1 ${x + u * 0.499},${u * 0.15}`,
  half_circle:     (x, u) => `M${x + u * 0.8},${u * 0.2} A${u * 0.35},${u * 0.35} 0 1 0 ${x + u * 0.8},${u * 0.8}`,
  zigzag:          (x, u) => `M${x + u * 0.1},${u * 0.85} L${x + u * 0.5},${u * 0.15} L${x + u * 0.9},${u * 0.85}`,
  curve_wave:      (x, u) => `M${x + u * 0.05},${u * 0.5} Q${x + u * 0.28},${u * 0.12} ${x + u * 0.5},${u * 0.5} Q${x + u * 0.72},${u * 0.88} ${x + u * 0.95},${u * 0.5}`,
};

function shapeRowSvg(shapeId, { count = REPEATS.warmUpShapes, heightMm = 15 } = {}) {
  const motif = SHAPE_MOTIFS[shapeId];
  if (!motif) return '';
  // The motif is drawn in a square cell, so the cell's side IS the row height
  // and the shape is as tall as the space allows. Height is stated in mm so
  // the printed size is the size this module budgeted for.
  const unit = 100 / count;
  const paths = Array.from({ length: count }, (_, i) =>
    `<path d="${motif(i * unit, unit)}" fill="none" stroke="#9AA3B2" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="2.2 2.4"/>`
  ).join('');
  // The first motif gets a start dot so the child knows where to begin.
  const startDot = `<circle cx="${unit * 0.5}" cy="${shapeId === 'horizontal_line' ? unit * 0.5 : unit * 0.15}" r="1.6" fill="#111827"/>`;
  return `<svg class="shaperow" width="100%" height="${heightMm}mm" viewBox="0 0 100 ${unit}" preserveAspectRatio="xMidYMid meet">${paths}${startDot}</svg>`;
}

function section(number, title, instruction, body) {
  return `
  <section class="ws-section">
    <div class="ws-head"><span class="ws-num">${number}</span><h2>${escapeHtml(title)}</h2></div>
    <p class="ws-instr">${escapeHtml(instruction)}</p>
    ${body}
  </section>`;
}


/**
 * Resolves the plan a worksheet should render from.
 *
 * Precedence, and the reason for it:
 *   1. `worksheet.worksheet_plan` — the plan FROZEN when this worksheet was
 *      generated. A printed worksheet is a physical artefact: reprinting it
 *      next term must reproduce the sheet the child was actually given, not
 *      whatever the current motor mapping would produce today. The mapping has
 *      already been corrected once, so this is not hypothetical.
 *   2. a live `plan` passed in — only ever used for a worksheet being created
 *      right now, before it has been stored.
 *   3. neither — a worksheet created before plans were persisted. Returns null
 *      so the renderer shows an honest fallback line rather than fabricating a
 *      preparation sequence for a historical sheet.
 *
 * Pure; never reads the current mapping.
 */
export function resolveWorksheetPlan({ worksheet, plan = null }) {
  const frozen = worksheet?.worksheet_plan ?? null;
  if (frozen && Array.isArray(frozen.warm_up)) {
    // Stored snake_case -> the shape the renderer already speaks. A rename
    // only; no value is recomputed.
    return {
      source: 'frozen',
      version: frozen.worksheet_plan_version ?? null,
      warmUp: frozen.warm_up.map((w) => ({
        id: w.id, label: w.label, instruction: w.instruction,
        rows: w.rows, emphasised: w.emphasised,
      })),
      primaryShape: frozen.primary_shape ?? null,
      shapePracticeSizes: frozen.shape_practice_sizes ?? ['large', 'medium', 'small'],
      trace: frozen.trace ?? null,
      copy: frozen.copy ?? null,
      independent: frozen.independent ?? null,
    };
  }
  if (plan && Array.isArray(plan.warmUp)) {
    return { source: 'live', version: null, ...plan };
  }
  return null;
}

/**
 * Builds the complete worksheet as an HTML document.
 *
 * PURE — no RN, no network, no expo import. Directly unit-testable.
 *
 * @param {Object} params
 * @param {{full_name?: string}} params.student
 * @param {{worksheet_code: string, target_letter: string, case_type: string,
 *          worksheet_intensity: string, teacher_note?: string|null,
 *          generated_at?: string}} params.worksheet
 * @param {{warmUp: Array<Object>, primaryShape: Object|null,
 *          shapePracticeSizes: string[]}} params.plan — from the backend's
 *   worksheetMotorMap. Never recomputed here.
 * @returns {string}
 */
export function buildWorksheetHtml({ student, worksheet, plan: livePlan = null }) {
  // A reprint renders from the worksheet's OWN frozen plan; only a
  // being-created worksheet uses the live one.
  const plan = resolveWorksheetPlan({ worksheet, plan: livePlan });
  const letter = worksheet?.target_letter ?? '';
  const caseType = worksheet?.case_type === 'uppercase' ? 'uppercase' : 'lowercase';
  // ONE case, and it is the one the child is struggling with.
  //
  // case_type was never lost on the way here — the report sends it, the row
  // stores it, and it is read two lines above. This renderer simply used to
  // override it, printing `C c` in the header and a row of each in sections 3
  // and 4. A child sent home to practise lowercase `c` got half a sheet of
  // `C`, and the sheet could not say which one mattered. `c` and `C` are
  // different targets with different strokes; a worksheet is for one of them.
  const target = caseType === 'uppercase' ? letter.toUpperCase() : letter.toLowerCase();
  const extended = worksheet?.worksheet_intensity === 'extended';

  // The heights this sheet will really print at. A light plan gets the ideal
  // sizes; a heavy one (two strokes, extended, an emphasised family) is scaled
  // down evenly rather than spilling onto a second page.
  const rowH = resolveRowHeights(plan, {
    extended, hasTeacherNote: Boolean(worksheet?.teacher_note),
  });

  // ── Section 1: motor warm-up ──
  const warmUp = (plan?.warmUp ?? []);
  const warmUpBody = warmUp.length
    ? warmUp.map((shape) => {
        const rows = Array.from({ length: shape.rows ?? 1 },
          () => `<div class="rowbox">${shapeRowSvg(shape.id, { heightMm: rowH.warmUpRow })}</div>`).join('');
        return `<div class="shapeblock"><div class="shapelabel">${escapeHtml(shape.label)}</div>${rows}</div>`;
      }).join('')
    : '<p class="ws-note">Movement practice for this letter is not set up yet.</p>';

  // ── Section 2: shape practice, large -> small ──
  const primary = plan?.primaryShape ?? null;
  const sizes = plan?.shapePracticeSizes ?? ['large', 'medium', 'small'];
  // Large -> small still steps the movement down toward writing scale, but
  // every step stays a usable motor space: `small` is 14mm tall with 5
  // repetitions, not a row of eight thumbnails.
  const shapeBody = primary
    ? `<div class="shapeblock">${sizes.map((size) =>
        `<div class="rowbox">${shapeRowSvg(primary.id, {
          count: REPEATS.shapePractice[size] ?? REPEATS.shapePractice.medium,
          heightMm: rowH.shapeRow[size] ?? rowH.shapeRow.medium,
        })}</div>`
      ).join('')}</div>`
    : '';

  // ── Section 3: trace ── two rows, uppercase then lowercase.
  const tracePerRow = plan?.trace?.per_row ?? REPEATS.traceGlyphs;
  const traceRow = () =>
    `<div class="glyphrow">${Array.from({ length: tracePerRow },
      () => letterGlyphSvg(target, caseType, rowH.glyphRow)).join('')}</div>`;

  // ── Section 4: copy ── one solid model, then guided blanks.
  const copyBlanks = plan?.copy?.blanks_per_row ?? REPEATS.copyBlanks;
  const copyRow = () => `<div class="glyphrow">
      ${letterGlyphSvg(target, caseType, rowH.glyphRow, { dotted: false, showStart: false })}
      <span class="copyarrow">&rarr;</span>
      ${Array.from({ length: copyBlanks },
        () => `<svg class="glyph" width="${rowH.glyphRow}mm" height="${rowH.glyphRow}mm" viewBox="0 0 ${GLYPH_UNITS} ${GLYPH_UNITS}">${guidelinesSvg(GLYPH_UNITS)}</svg>`).join('')}
    </div>`;

  // ── Section 5: independent ── guidelines only.
  // Frozen layout settings win over the intensity default, so a historical
  // sheet keeps the exact number of rows it was printed with.
  const freeRowCount = plan?.independent?.rows ?? (extended ? 3 : 2);
  const freeRows = Array.from({ length: freeRowCount },
    () => `<div class="rowbox">${writingRowSvg(100, rowH.writingRow)}</div>`).join('');

  const noteBlock = worksheet?.teacher_note
    ? `<div class="ws-teachernote"><strong>Note:</strong> ${escapeHtml(worksheet.teacher_note)}</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
  @page { size: A4 portrait; margin: ${PAGE.margin}mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; }
  .ws-title { font-size: 22px; font-weight: 700; margin: 0 0 2px 0; }
  .ws-sub { font-size: 11px; color: #6B7280; margin: 0 0 6px 0; }
  .ws-fields { display: flex; gap: 16px; font-size: 12px; margin-bottom: 6px; }
  .ws-fields div { flex: 1; border-bottom: 1px solid #9AA3B2; padding-bottom: 4px; }
  .ws-target { display: flex; align-items: center; justify-content: space-between;
               border: 1.5px solid #111827; border-radius: 6px;
               padding: 4px 14px; margin-bottom: 6px; }
  .ws-target .big { font-size: 40px; font-weight: 700; line-height: 1.1; }
  .ws-target .lbl { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; }
  .ws-case { font-size: 11px; color: #374151; text-transform: uppercase; letter-spacing: 1.5px; }
  .ws-section { margin-bottom: 4px; page-break-inside: avoid; }
  .ws-head { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 3px; }
  .ws-num { width: 18px; height: 18px; border-radius: 50%; background: #111827; color: #fff;
            font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .ws-head h2 { font-size: 13px; margin: 0; font-weight: 700; }
  .ws-instr { font-size: 11px; color: #374151; margin: 3px 0 3px 0; }
  .ws-note { font-size: 10.5px; color: #6B7280; font-style: italic; }
  .shapeblock { margin-bottom: 2px; }
  .shapelabel { font-size: 10px; color: #6B7280; margin-bottom: 0; }
  .rowbox { border-bottom: 0.5px solid #E5E7EB; margin-bottom: 1.5mm; }
  .glyphrow { display: flex; align-items: center; gap: 8mm; margin-bottom: 1mm; }
  .glyph { display: block; }
  .copyarrow { color: #9AA3B2; font-size: 15px; }
  .ws-teachernote { font-size: 10.5px; border-left: 2.5px solid #111827; padding-left: 7px; margin-top: 10px; }
  .ws-foot { margin-top: 12px; font-size: 9px; color: #9AA3B2; display: flex; justify-content: space-between; }
  </style></head><body>

  <div class="ws-title">Writing Practice</div>
  <div class="ws-sub">Auriva handwriting practice</div>

  <div class="ws-fields">
    <div>Name: ${escapeHtml(student?.full_name ?? '')}</div>
    <div>Date: ${escapeHtml(fmtDate(worksheet?.generated_at))}</div>
  </div>

  <div class="ws-target">
    <div><div class="lbl">Today&rsquo;s letter</div><div class="big">${escapeHtml(target)}</div></div>
    <div class="ws-case">${caseType === 'uppercase' ? 'Uppercase' : 'Lowercase'}</div>
  </div>

  ${section(1, 'Warm Up', 'Trace the shapes.', warmUpBody)}
  ${primary ? section(2, 'Shape Practice', 'Trace the shape. Start big, then smaller.', shapeBody) : ''}
  ${section(3, 'Trace the Letter', 'Trace the letter. Start at the dot.', traceRow())}
  ${section(4, 'Copy the Letter', 'Copy the letter in the spaces.', copyRow())}
  ${section(5, 'Write on Your Own', 'Write the letter yourself.', freeRows)}

  ${noteBlock}

  <div class="ws-foot">
    <span>Worksheet ID: ${escapeHtml(worksheet?.worksheet_code ?? '')}</span>
    <span>Keep this sheet — your teacher will look at it together with you.</span>
  </div>
  </body></html>`;
}

// ─── Sharing (worksheet-specific wording) ───────────────────────────────────

/** The name a teacher sees on the share sheet. Never a report title. */
export const WORKSHEET_SHARE_TITLE = 'Auriva Handwriting Practice Worksheet';

/**
 * The target letter as it should appear to a person: cased the way the child
 * is practising it, so `c` and `C` are distinguishable without a separate
 * upper/lower tag.
 */
function displayLetter(worksheet) {
  const raw = String(worksheet?.target_letter ?? '').replace(/[^A-Za-z]/g, '').slice(0, 1);
  if (!raw) return '';
  return worksheet?.case_type === 'uppercase' ? raw.toUpperCase() : raw.toLowerCase();
}

/**
 * Auriva_Writing_Practice_<Student>_<letter>_<YYYY-MM-DD>.pdf
 *   e.g. Auriva_Writing_Practice_Hiran_c_2026-08-26.pdf
 *
 * When no usable student name is available the segment is OMITTED rather than
 * filled with a placeholder or an id:
 *   Auriva_Writing_Practice_c_2026-08-26.pdf
 *
 * Deliberately contains only human-facing information — the child's name, the
 * letter, and the date the sheet was generated. No student id, worksheet row
 * id, recommendation id, worksheet code or model/cluster information ever
 * reaches a filename, which travels further than the app (share sheets, email
 * subjects, printer queues, a parent's file manager).
 */
export function buildWorksheetFilename({ student, worksheet }) {
  // '' rather than a 'Student' placeholder: an unavailable name should shorten
  // the filename, not fake one.
  const name = sanitizeForFilename(student?.full_name ?? '', '');
  const letter = displayLetter(worksheet);
  const generated = new Date(worksheet?.generated_at ?? Date.now());
  const date = Number.isNaN(generated.getTime())
    ? new Date().toISOString().slice(0, 10)
    : generated.toISOString().slice(0, 10);

  return ['Auriva_Writing_Practice', name, letter, date]
    .filter((part) => part !== '' && part != null)
    .join('_') + '.pdf';
}

/**
 * The share-sheet dialog title for a worksheet, e.g.
 *   "Auriva Handwriting Practice Worksheet — Hiran, letter c"
 * Falls back to the bare title when neither name nor letter is available.
 * Same privacy rule as the filename: human-facing detail only.
 */
export function buildWorksheetShareTitle({ student, worksheet }) {
  const name = String(student?.full_name ?? '').trim();
  const letter = displayLetter(worksheet);
  const detail = [name, letter ? `letter ${letter}` : ''].filter(Boolean).join(', ');
  return detail ? `${WORKSHEET_SHARE_TITLE} — ${detail}` : WORKSHEET_SHARE_TITLE;
}

/**
 * Shares an ALREADY-GENERATED worksheet PDF.
 *
 * Takes the file uri produced by generateWorksheetPdf() rather than the plan,
 * so it physically cannot send a different sheet from the one the teacher
 * previewed — the same rule the report exporter follows. A historical reprint
 * shares through here too, and sharing never writes anything: no worksheet is
 * created, no status, assigned_at, submitted_at or reviewed_at changes.
 *
 * Never throws.
 *
 * @param {{fileUri: string, worksheet: Object, student: Object}} params
 * @returns {Promise<{status: 'shared'|'cancelled'|'sharing_unavailable'|'failed', error: string|null}>}
 */
export async function shareWorksheetPdf({ fileUri, worksheet, student }) {
  return sharePdfFile({
    fileUri,
    dialogTitle: buildWorksheetShareTitle({ student, worksheet }),
    missingFileMessage: 'There is no worksheet to share.',
    logTag: 'worksheetPdf',
  });
}

/**
 * Renders the worksheet to a real PDF file on this device.
 *
 * The only impure function here — expo-print is imported lazily so the pure
 * builder above stays testable without an RN environment.
 */
export async function generateWorksheetPdf({ student, worksheet, plan }) {
  try {
    const Print = await import('expo-print');
    const html = buildWorksheetHtml({ student, worksheet, plan });
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { status: 'ok', fileUri: uri, filename: buildWorksheetFilename({ student, worksheet }), html };
  } catch (err) {
    return { status: 'failed', fileUri: null, filename: null, error: err?.message ?? 'Unknown error' };
  }
}
