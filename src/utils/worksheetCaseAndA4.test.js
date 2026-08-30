// Worksheets print ONE case, on ONE A4 page, at a size a child can write in.
//
// ── The case bug ────────────────────────────────────────────────────────
// case_type was never lost. The report sends it, the row stores it, the
// renderer reads it — and then overrode it, printing `C c` in the header and a
// row of each in Trace and Copy. A child sent home to practise lowercase `c`
// got half a sheet of `C`, and the sheet could not say which one mattered.
//
// ── The size problem ────────────────────────────────────────────────────
// Everything was sized in unitless SVG px inside an A4 @page, so a "24" glyph
// printed at ~6mm. Enlarging by eye would have traded a cramped sheet for a
// two-page one, so the heights now live in millimetres and the fit is a real
// assertion rather than a hope.

import fs from 'fs';
import path from 'path';

import { buildWorksheetHtml } from './worksheetPdf';
import {
  A4, CONTENT, BLOCK, REPEATS,
  measureWorksheet, worksheetFitsOnePage, remainingHeightMm, resolveRowHeights,
} from './worksheetLayoutA4';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const STUDENT = { full_name: 'Test Child' };

const planFor = (shapeId, sizes = ['large', 'medium', 'small']) => ({
  warmUp: [{ id: shapeId, label: 'Curves', instruction: 'Trace the curves.', rows: 1 }],
  primaryShape: { id: shapeId, label: 'Curves', instruction: 'Trace the curves.' },
  shapePracticeSizes: sizes,
});

const sheet = (letter, caseType, plan = planFor('half_circle'), over = {}) =>
  buildWorksheetHtml({
    student: STUDENT,
    worksheet: {
      worksheet_code: 'HW-2026-0001', target_letter: letter, case_type: caseType,
      worksheet_intensity: 'standard', generated_at: '2026-08-28T00:00:00.000Z', ...over,
    },
    plan,
  });

/**
 * The header block that names today's letter. Bounded FORWARD from the body
 * markup — `ws-case` also appears in the stylesheet above it, and searching
 * the whole document finds that one first and yields an empty slice.
 */
const targetCard = (html) => {
  const start = html.indexOf('<div class="ws-target">');
  expect(start).toBeGreaterThan(-1);
  const caseAt = html.indexOf('ws-case', start);
  return html.slice(start, html.indexOf('</div>', caseAt));
};

// ═══ §17 case ═══════════════════════════════════════════════════════════

describe('§17 — a worksheet practises ONE case', () => {
  it.each([
    ['c', 'lowercase', 'c', 'C'],
    ['C', 'uppercase', 'C', 'c'],
    ['b', 'lowercase', 'b', 'B'],
    ['B', 'uppercase', 'B', 'b'],
  ])('%s (%s) shows %s and never %s as a target', (letter, caseType, wanted, banned) => {
    const card = targetCard(sheet(letter, caseType));
    expect(card).toContain(`>${wanted}<`);
    expect(card).not.toContain(`>${banned}<`);
  });

  it('the header names the case explicitly, since the letter alone cannot', () => {
    expect(sheet('c', 'lowercase')).toContain('Lowercase');
    expect(sheet('C', 'uppercase')).toContain('Uppercase');
  });

  it('the old both-cases header is gone', () => {
    for (const [l, c] of [['c', 'lowercase'], ['C', 'uppercase'], ['b', 'lowercase'], ['B', 'uppercase']]) {
      const html = sheet(l, c);
      expect(html).not.toContain('C c');
      expect(html).not.toContain('B b');
    }
  });

  it('Trace and Copy render ONE row each, not one per case', () => {
    const code = readCode('./worksheetPdf.js');
    expect(code).toMatch(/section\(3, 'Trace the Letter'[^)]*traceRow\(\)\)/);
    expect(code).toMatch(/section\(4, 'Copy the Letter'[^)]*copyRow\(\)\)/);
    expect(code).not.toMatch(/traceRow\(upper\) \+ traceRow\(lower\)/);
    expect(code).not.toMatch(/copyRow\(upper\) \+ copyRow\(lower\)/);
  });

  it('the case comes from case_type, never from the letter’s own casing', () => {
    const code = readCode('./worksheetPdf.js');
    expect(code).toMatch(/const target = caseType === 'uppercase' \? letter\.toUpperCase\(\) : letter\.toLowerCase\(\);/);
    // The old pair is gone entirely.
    expect(code).not.toMatch(/const upper = letter\.toUpperCase\(\);/);
    expect(code).not.toMatch(/const lower = letter\.toLowerCase\(\);/);
    // The glyph is asked for the worksheet's case, not a guess from `ch`.
    expect(code).not.toMatch(/ch === upper \? 'uppercase' : 'lowercase'/);
    // BOTH call sites — trace and copy. A single toMatch passes while the
    // other one is derived from the letter's own casing, which is equivalent
    // only for as long as the data stays consistent.
    expect((code.match(/letterGlyphSvg\(target, caseType,/g) || [])).toHaveLength(2);
    expect(code).not.toMatch(/letterGlyphSvg\(target, target/);
  });

  it('a mis-cased stored letter is still rendered in its declared case', () => {
    // target_letter 'C' with case_type lowercase is a data fault; the declared
    // case wins, because that is what the recommendation decided.
    expect(targetCard(sheet('C', 'lowercase'))).toContain('>c<');
    expect(targetCard(sheet('c', 'uppercase'))).toContain('>C<');
  });

  it('lowercase c and uppercase C produce different sheets', () => {
    expect(sheet('c', 'lowercase')).not.toBe(sheet('C', 'uppercase'));
  });
});

// ═══ §19 A4 ═════════════════════════════════════════════════════════════

describe('§19 — A4 portrait, one page, safe margins', () => {
  it('the page is A4 portrait with a print-safe margin', () => {
    expect(A4.widthMm).toBe(210);
    expect(A4.heightMm).toBe(297);
    expect(A4.marginMm).toBeGreaterThanOrEqual(12);
    expect(A4.marginMm).toBeLessThanOrEqual(15);
    expect(CONTENT.widthMm).toBe(184);
    expect(CONTENT.heightMm).toBe(271);
  });

  it('the stylesheet declares that page, from the shared constants', () => {
    const html = sheet('c', 'lowercase');
    expect(html).toContain('@page { size: A4 portrait; margin: 13mm; }');
    expect(readCode('./worksheetPdf.js'))
      .toMatch(/const PAGE = \{ width: A4\.widthMm, height: A4\.heightMm, margin: A4\.marginMm \};/);
  });

  it.each([
    ['standard, 1 warm-up shape', planFor('half_circle'), { extended: false }],
    ['extended, 1 warm-up shape', planFor('half_circle'), { extended: true }],
    ['two warm-up shapes',
      { ...planFor('vertical_line'),
        warmUp: [{ id: 'vertical_line', rows: 1 }, { id: 'half_circle', rows: 1 }] },
      { extended: false }],
    ['the heaviest plan: 2 shapes x 2 rows, extended, teacher note',
      { ...planFor('vertical_line'),
        warmUp: [{ id: 'vertical_line', rows: 2 }, { id: 'half_circle', rows: 2 }] },
      { extended: true, hasTeacherNote: true }],
  ])('%s fits one page', (_label, plan, options) => {
    expect(worksheetFitsOnePage(plan, options)).toBe(true);
    expect(remainingHeightMm(plan, options)).toBeGreaterThanOrEqual(0);
  });

  it('the budget is a real sum, not an assertion', () => {
    const { totalMm, sections } = measureWorksheet(planFor('half_circle'));
    expect(sections.map((s) => s.id)).toEqual([
      'header', 'target', 'warmUp', 'shapePractice', 'trace', 'copy', 'independent', 'footer',
    ]);
    expect(totalMm).toBe(sections.reduce((a, s) => a + s.heightMm, 0));
    expect(totalMm).toBeLessThanOrEqual(CONTENT.heightMm);
  });

  it('a plan heavy enough to overflow is REPORTED, not silently clipped', () => {
    const absurd = { ...planFor('half_circle'),
      warmUp: Array.from({ length: 12 }, () => ({ id: 'half_circle', rows: 2 })) };
    expect(worksheetFitsOnePage(absurd)).toBe(false);
    expect(remainingHeightMm(absurd)).toBeLessThan(0);
  });

  it('a plan with no primary shape simply omits that section', () => {
    const { sections } = measureWorksheet({ warmUp: [{ id: 'half_circle', rows: 1 }] });
    expect(sections.map((s) => s.id)).not.toContain('shapePractice');
    expect(sheet('c', 'lowercase', { warmUp: [{ id: 'half_circle', rows: 1 }] }))
      .not.toContain('Shape Practice');
  });
});

// ═══ §9-§13 the writing space ═══════════════════════════════════════════

describe('§9-§13 — the activities are motor spaces, not thumbnails', () => {
  it('every printed area is stated in millimetres', () => {
    const html = sheet('c', 'lowercase');
    expect(html).toMatch(/<svg class="glyph" width="[0-9.]+mm" height="[0-9.]+mm"/);
    expect(html).toMatch(/<svg class="row" width="100%" height="[0-9.]+mm"/);
    expect(html).toMatch(/<svg class="shaperow" width="100%" height="[0-9.]+mm"/);
    // A light plan prints at the ideal sizes.
    const rows = resolveRowHeights(planFor('half_circle'), { extended: false });
    expect(rows.scale).toBe(1);
    expect(html).toContain(`width="${rows.glyphRow}mm"`);
  });

  it('the glyph geometry grid is separate from its printed size', () => {
    // The canonical letter shape is untouched; only the paper size changed.
    const code = readCode('./worksheetPdf.js');
    expect(code).toMatch(/const GLYPH_UNITS = 24;/);
    expect(code).toMatch(/viewBox="0 0 \$\{size\} \$\{size\}"/);
    expect(code).toMatch(/width="\$\{printMm\}mm" height="\$\{printMm\}mm"/);
  });

  it('OLD vs NEW — every area grew', () => {
    // Old effective sizes: glyph 24px (~6.35mm), writing row 16mm,
    // warm-up unit 14px (~3.7mm), shape practice 26/19/14px.
    const MM_PER_PX = 25.4 / 96;
    expect(BLOCK.glyphRow).toBeGreaterThan(24 * MM_PER_PX);
    expect(BLOCK.writingRow).toBeGreaterThan(16);
    expect(BLOCK.warmUpRow).toBeGreaterThan(14 * MM_PER_PX);
    for (const [size, oldPx] of [['large', 26], ['medium', 19], ['small', 14]]) {
      expect(BLOCK.shapeRow[size]).toBeGreaterThan(oldPx * MM_PER_PX);
    }
  });

  it('§11 fewer, larger repetitions — never many small ones', () => {
    // Old: 7 warm-up motifs, 4/6/8 shape-practice, 5 trace glyphs.
    expect(REPEATS.warmUpShapes).toBeLessThan(7);
    expect(REPEATS.shapePractice.large).toBeLessThan(4);
    expect(REPEATS.shapePractice.medium).toBeLessThan(6);
    expect(REPEATS.shapePractice.small).toBeLessThan(8);
    expect(REPEATS.traceGlyphs).toBeLessThan(5);
  });

  it('§13 large -> small still steps down, and small stays usable', () => {
    expect(BLOCK.shapeRow.large).toBeGreaterThan(BLOCK.shapeRow.medium);
    expect(BLOCK.shapeRow.medium).toBeGreaterThan(BLOCK.shapeRow.small);
    // A 14mm tall shape is still a movement a child can make.
    expect(BLOCK.shapeRow.small).toBeGreaterThanOrEqual(12);
    expect(REPEATS.shapePractice.small).toBeLessThanOrEqual(5);
  });

  it('§14 no decorative clutter was added', () => {
    const html = sheet('c', 'lowercase');
    expect(html).not.toMatch(/background-image|box-shadow|<img/);
    // Sections keep their plain numbered headings.
    for (const heading of ['Warm Up', 'Shape Practice', 'Trace the Letter',
                           'Copy the Letter', 'Write on Your Own']) {
      expect(html).toContain(heading);
    }
  });

  it('§10 the section order follows the existing planner', () => {
    const html = sheet('c', 'lowercase');
    const order = ['Warm Up', 'Shape Practice', 'Trace the Letter',
                   'Copy the Letter', 'Write on Your Own'];
    let at = -1;
    for (const heading of order) {
      const next = html.indexOf(heading);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });
});

// ═══ §16 representative samples ═════════════════════════════════════════

describe('§16 — the four required samples', () => {
  it.each([['c', 'lowercase'], ['b', 'lowercase'], ['C', 'uppercase'], ['B', 'uppercase']])(
    '%s (%s) renders one correctly-cased A4 page', (letter, caseType) => {
      const plan = planFor(letter.toLowerCase() === 'c' ? 'half_circle' : 'vertical_line');
      const html = sheet(letter, caseType, plan);
      expect(html).toContain('@page { size: A4 portrait; margin: 13mm; }');
      expect(targetCard(html)).toContain(`>${letter}<`);
      expect(worksheetFitsOnePage(plan, { extended: false })).toBe(true);
      // A real glyph was drawn, not an empty box.
      expect(html).toMatch(/<svg class="glyph" width="[0-9.]+mm"/);
    });
});

// ═══ §20 regression ═════════════════════════════════════════════════════

describe('SENTINEL — §20 decision logic untouched', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('the planner and its letter map are unchanged', () => {
    const map = b('src/config/worksheetMotorMap.js');
    expect(map).toMatch(/const LETTER_STROKE_TYPES = Object\.freeze\(\{/);
    expect(map).toMatch(/shapePracticeSizes: \['large', 'medium', 'small'\]/);
    expect(map).toMatch(/c: \['half_circle'\]/);
    expect(map).toMatch(/b: \['vertical_line', 'half_circle'\]/);
  });

  it('LIVE_STATUSES and the workflow semantics are unchanged', () => {
    expect(b('src/services/worksheetService.js'))
      .toMatch(/const LIVE_STATUSES = Object\.freeze\(\['generated', 'assigned', 'submitted'\]\);/);
    // The duplicate guard still keys on letter AND case.
    expect(b('src/services/worksheetService.js'))
      .toMatch(/\$\{w\.target_letter\}\|\$\{w\.case_type\}/);
  });

  it('mastery, cycles and Motor Score are untouched', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('the renderer still reads the FROZEN plan for a reprint', () => {
    expect(readCode('./worksheetPdf.js'))
      .toMatch(/const plan = resolveWorksheetPlan\(\{ worksheet, plan: livePlan \}\);/);
  });

  it('the layout module is pure — no decisions, no I/O', () => {
    const code = readCode('./worksheetLayoutA4.js');
    expect(code).not.toMatch(/client\.|ENDPOINTS|mastery|threshold|score|difficult/i);
    expect(code).not.toMatch(/require\(|import .* from '\.\//);
  });

  it('canonical letter geometry is untouched', () => {
    expect(readCode('../constants/activityPreviewLetterPaths.js'))
      .not.toMatch(/worksheet|A4|mm/i);
    expect(readCode('./worksheetPdf.js')).toMatch(/getLetterPath\(letter, caseType\)/);
  });
});

// ═══ §18 the Homework Practice card ═════════════════════════════════════

describe('§18 — the report card is a summary; the workflow is behind View', () => {
  const screen = read('../screens/teacher/handwriting/reports/TeacherReportScreen.js');
  const card = screen.slice(screen.indexOf('function HomeworkPracticeCard'),
                            screen.indexOf('const hw = StyleSheet.create'));
  /** The active-worksheet summary block only — not the detail modal below it. */
  const summary = card.slice(card.indexOf('B. Active worksheet'),
                             card.indexOf('C. History'));
  /** The detail sheet the View button opens. */
  // From the <Modal> tag itself, not from its visible prop — the opening tag
  // is what proves this is a modal rather than a pushed screen. Anchored on
  // the close handler, which is unique to this sheet: `visible` changed when
  // the whole modal was put behind an `active` guard.
  const detailAt = card.indexOf('setDetailOpen(false)');
  const detail = card.slice(card.lastIndexOf('<Modal', detailAt),
                            card.indexOf('{gGenerate.gateModal}'));

  it('the summary shows the four facts a teacher scans for', () => {
    for (const label of ['Letter', 'Case', 'Status', 'Generated']) {
      expect(summary).toContain(`>${label}<`);
    }
    expect(summary).toMatch(/displayWorksheetLetter\(active\)/);
    expect(summary).toMatch(/formatCaseType\(active\.case_type\)/);
    expect(summary).toMatch(/getWorksheetStatusLine\(active\)/);
  });

  it('the summary offers View, and nothing that acts', () => {
    expect(summary).toContain('>View</Text>');
    expect(summary).toMatch(/setDetailOpen\(true\)/);
    for (const action of ['Take Photo', 'Choose from Gallery', 'Save Review',
                          'Teacher Review', 'Preview / Print']) {
      expect(summary).not.toContain(action);
    }
    expect(summary).not.toMatch(/gCamera|gGallery|gReview|gPreview/);
  });

  it('§6 the detail sheet carries the status-aware workflow', () => {
    expect(detail).toContain('Preview / Print');
    expect(detail).toContain('Take Photo');
    expect(detail).toContain('Choose from Gallery');
    expect(detail).toContain('Teacher Review');
    expect(detail).toContain('Save Review');
  });

  it('§6 upload only while the sheet is still out; review only when pending', () => {
    expect(detail).toMatch(/active\?\.status === 'submitted' && latestSubmission/);
    expect(detail).toMatch(/PENDING_REVIEW_TEXT/);
    expect(detail).toMatch(/latestSubmission\.review_status === 'pending_review'/);
  });

  it('every action keeps its existing parent gate — permissions unchanged', () => {
    for (const gate of ['gPreview.requestBack', 'gCamera.requestBack',
                        'gGallery.requestBack', 'gReview.requestBack']) {
      expect(detail).toContain(gate);
    }
  });

  it('the case is shown, because the letter alone cannot say which sheet', () => {
    // The helper sits just above the component, so it is asserted on the file.
    expect(screen).toMatch(/function displayWorksheetLetter\(worksheet\)/);
    expect(screen).toMatch(/worksheet\?\.case_type === 'uppercase' \? raw\.toUpperCase\(\) : raw\.toLowerCase\(\)/);
  });

  it('§7 the generate guard is untouched — no re-showing Generate', () => {
    // The card still keys "already covered" on the live worksheet set.
    expect(card).toMatch(/recommendationAlreadyCovered/);
    expect(card).toMatch(/!active && recommendation && !dismissed/);
  });

  it('the detail sheet is a Modal over the report, not a new screen', () => {
    expect(detail).toMatch(/<Modal/);
    expect(detail).toMatch(/onRequestClose=\{\(\) => setDetailOpen\(false\)\}/);
    expect(card).not.toMatch(/navigate\('WorksheetDetail/);
  });

  it('the sheet is not built at all without an active worksheet', () => {
    // A Modal's children are constructed even when visible={false} — only its
    // PRESENTATION is conditional. Reading active.status inside one with no
    // active worksheet is what threw "Cannot read property 'status' of null".
    expect(card).toMatch(/\{active \? \(\s*<Modal/);
    expect(detail).not.toMatch(/\{active\.[a-z_]+/);
  });
});
