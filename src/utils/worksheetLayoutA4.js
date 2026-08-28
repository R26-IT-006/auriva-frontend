/**
 * worksheetLayoutA4.js
 *
 * The printed worksheet's vertical budget, in millimetres.
 *
 * ── Why this is a module and not CSS ─────────────────────────────────────
 * "Make the activities bigger" and "keep it on one page" pull against each
 * other, and the only way to hold both is to know what the page has left. The
 * old sheet sized everything in unitless SVG px inside an A4 @page: the boxes
 * were small enough that overflow never came up, which is exactly the problem
 * being fixed. Enlarging them by eye would trade a cramped sheet for a
 * two-page one.
 *
 * ── Why it ALLOCATES rather than asserts ─────────────────────────────────
 * A first version fixed a height per row and checked the sum. That fails on
 * the plans the planner actually produces: a two-stroke letter on extended
 * intensity with an emphasised family is five warm-up rows, and five ideal
 * rows plus everything else is 308mm on a 271mm page. Picking numbers that
 * survive the worst case would have made the common case small again — the
 * original complaint.
 *
 * So the fixed furniture is measured first, and whatever height remains is
 * shared out across the rows that carry the writing. A light plan gets the
 * ideal size; a heavy one is scaled down evenly, never past a floor a child
 * can still write in. `worksheetFitsOnePage()` then means what it says.
 *
 * ── The child this is for ────────────────────────────────────────────────
 * Every number is a MOTOR space, not a typographic one. Repetitions are few
 * and large rather than many and small — eight tiny circles in a row is a
 * puzzle, three big ones is practice.
 */

'use strict';

/** A4 portrait, and the print-safe margin. */
export const A4 = Object.freeze({
  widthMm: 210,
  heightMm: 297,
  // 13mm sits inside every consumer printer's unprintable edge while leaving
  // the most usable width; the spec's range is 12-15mm.
  marginMm: 13,
});

/** The rectangle the worksheet may actually use. */
export const CONTENT = Object.freeze({
  widthMm:  A4.widthMm  - A4.marginMm * 2,   // 184
  heightMm: A4.heightMm - A4.marginMm * 2,   // 271
});

/** Furniture: fixed regardless of how heavy the plan is. */
export const FIXED = Object.freeze({
  header:        20,   // title, name, date
  targetCard:    20,   // today's letter
  sectionChrome:  9,   // number, heading and instruction line of one section
  teacherNote:   10,
  footer:         8,
});

/** The writing rows, at their IDEAL size — what a light plan gets. */
export const IDEAL = Object.freeze({
  warmUpRow:  15,
  shapeRow:   Object.freeze({ large: 19, medium: 16, small: 14 }),
  glyphRow:   24,   // trace / copy — the tallest, they carry the letter
  writingRow: 19,   // independent writing
});

/**
 * The smallest a row may be scaled to. Below these a "writing space" stops
 * being one, so a plan that cannot fit at these sizes is reported as not
 * fitting rather than quietly shrunk into uselessness.
 */
export const FLOOR = Object.freeze({
  warmUpRow:  9,
  shapeRow:   Object.freeze({ large: 12, medium: 10, small: 9 }),
  glyphRow:   16,
  writingRow: 12,
});

/** Backwards-compatible alias — the ideal sizes, plus the fixed furniture. */
export const BLOCK = Object.freeze({ ...FIXED, ...IDEAL });

/**
 * Repetitions per row, chosen so each one is LARGE. Deliberately few: the old
 * sheet packed 4/6/8 shapes into a row and 5 glyphs into a tracing row.
 */
export const REPEATS = Object.freeze({
  warmUpShapes:   5,
  shapePractice:  Object.freeze({ large: 3, medium: 4, small: 5 }),
  traceGlyphs:    4,
  copyBlanks:     3,
});

const round1 = (n) => Math.round(n * 10) / 10;

function planShape(plan, { extended = false } = {}) {
  const warmUp = Array.isArray(plan?.warmUp) ? plan.warmUp : [];
  const sizes = plan?.primaryShape
    ? (Array.isArray(plan.shapePracticeSizes) && plan.shapePracticeSizes.length
        ? plan.shapePracticeSizes : ['large', 'medium', 'small'])
    : [];
  return {
    warmUpRows: warmUp.reduce((n, shape) => n + (shape?.rows ?? 1), 0),
    shapeSizes: sizes,
    freeRows:   plan?.independent?.rows ?? (extended ? 3 : 2),
    hasShapeSection: Boolean(plan?.primaryShape),
  };
}

/**
 * The actual printed height of every row type for this plan.
 *
 * @returns {{scale: number, warmUpRow: number, shapeRow: Object,
 *            glyphRow: number, writingRow: number}}
 */
export function resolveRowHeights(plan, options = {}) {
  const { warmUpRows, shapeSizes, freeRows, hasShapeSection } = planShape(plan, options);
  const sectionCount = hasShapeSection ? 5 : 4;

  const fixed = FIXED.header + FIXED.targetCard + FIXED.footer
    + FIXED.sectionChrome * sectionCount
    + (options.hasTeacherNote ? FIXED.teacherNote : 0);

  const idealFlex =
      warmUpRows * IDEAL.warmUpRow
    + shapeSizes.reduce((h, s) => h + (IDEAL.shapeRow[s] ?? IDEAL.shapeRow.medium), 0)
    + IDEAL.glyphRow * 2                       // trace + copy, one row each
    + freeRows * IDEAL.writingRow;

  const available = CONTENT.heightMm - fixed;
  const scale = idealFlex > 0 ? Math.min(1, available / idealFlex) : 1;

  const at = (ideal, floor) => round1(Math.max(floor, ideal * scale));

  return {
    scale: round1(scale),
    warmUpRow:  at(IDEAL.warmUpRow, FLOOR.warmUpRow),
    shapeRow: {
      large:  at(IDEAL.shapeRow.large,  FLOOR.shapeRow.large),
      medium: at(IDEAL.shapeRow.medium, FLOOR.shapeRow.medium),
      small:  at(IDEAL.shapeRow.small,  FLOOR.shapeRow.small),
    },
    glyphRow:   at(IDEAL.glyphRow, FLOOR.glyphRow),
    writingRow: at(IDEAL.writingRow, FLOOR.writingRow),
  };
}

/**
 * Total height of one rendered worksheet, at the heights it will really print.
 *
 * @returns {{totalMm: number, sections: Array<{id: string, heightMm: number}>,
 *            rows: Object}}
 */
export function measureWorksheet(plan, options = {}) {
  const rows = resolveRowHeights(plan, options);
  const { warmUpRows, shapeSizes, freeRows, hasShapeSection } = planShape(plan, options);

  const sections = [
    { id: 'header', heightMm: FIXED.header },
    { id: 'target', heightMm: FIXED.targetCard },
    { id: 'warmUp', heightMm: FIXED.sectionChrome + warmUpRows * rows.warmUpRow },
  ];
  if (hasShapeSection) {
    sections.push({
      id: 'shapePractice',
      heightMm: FIXED.sectionChrome
        + shapeSizes.reduce((h, s) => h + (rows.shapeRow[s] ?? rows.shapeRow.medium), 0),
    });
  }
  // ONE row each now, in the target case only — the old sheet printed two of
  // each because it rendered both cases.
  sections.push({ id: 'trace', heightMm: FIXED.sectionChrome + rows.glyphRow });
  sections.push({ id: 'copy',  heightMm: FIXED.sectionChrome + rows.glyphRow });
  sections.push({ id: 'independent', heightMm: FIXED.sectionChrome + freeRows * rows.writingRow });
  if (options.hasTeacherNote) sections.push({ id: 'teacherNote', heightMm: FIXED.teacherNote });
  sections.push({ id: 'footer', heightMm: FIXED.footer });

  return {
    totalMm: round1(sections.reduce((a, s) => a + s.heightMm, 0)),
    sections,
    rows,
  };
}

/** @returns {boolean} true when the worksheet fits the printable height. */
export function worksheetFitsOnePage(plan, options) {
  return measureWorksheet(plan, options).totalMm <= CONTENT.heightMm;
}

/** Printable height left over. Negative means it would spill onto page 2. */
export function remainingHeightMm(plan, options) {
  return round1(CONTENT.heightMm - measureWorksheet(plan, options).totalMm);
}
