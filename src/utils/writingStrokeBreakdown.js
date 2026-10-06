/**
 * writingStrokeBreakdown.js
 *
 * The small "Stroke families" breakdown on the Student Profile -> Module
 * Progress -> WRITING tab — the handwriting counterpart of the Concept tab's
 * category breakdown.
 *
 * Letters are grouped by their dominant stroke, the same deterministic grouping
 * the Writing Progress Report's Motor Pattern section uses (backend
 * data/letterMotorPrimitives.js). The lists are restated here rather than read
 * from the report's `motorPatterns`, so that every letter FORM is classified by
 * its own case: 'a' is curved, 'A' is diagonal.
 *
 * Reads only GET /handwriting/letter-progress-report — the endpoint the report
 * already uses. Nothing is written and the report screen is untouched.
 */

'use strict';

const CURVED              = ['a', 'c', 'e', 'o', 's', 'g', 'C', 'O', 'S', 'G'];
const DIAGONAL            = ['v', 'w', 'x', 'y', 'z', 'k', 'A', 'V', 'W', 'X', 'Y', 'Z', 'K'];
const VERTICAL_HORIZONTAL = ['i', 'l', 't', 'f', 'E', 'F', 'H', 'I', 'L', 'T'];

const ALL_FORMS = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
];
const grouped = new Set([...CURVED, ...DIAGONAL, ...VERTICAL_HORIZONTAL]);
const MIXED = ALL_FORMS.filter((f) => !grouped.has(f));

export const STROKE_FAMILIES = [
  { key: 'curved',              label: 'Curved strokes',              forms: CURVED },
  { key: 'diagonal',            label: 'Diagonal strokes',            forms: DIAGONAL },
  { key: 'vertical_horizontal', label: 'Vertical/horizontal strokes', forms: VERTICAL_HORIZONTAL },
  { key: 'mixed',               label: 'Mixed strokes',               forms: MIXED },
];

/** The letter as written: uppercase rows become 'A', lowercase rows 'a'. */
function formOf(row) {
  const l = String(row?.letter ?? '').trim();
  if (!l) return null;
  return row.case_type === 'uppercase' ? l.toUpperCase() : l.toLowerCase();
}

const mean = (xs) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

/**
 * Pure: the report's `letters` array -> one entry per stroke family.
 *
 * `current` and `initial` are the mean latest / first score over the family's
 * practised letters — the same roll-up the report's Motor Pattern section does.
 * A family nobody has practised reads `practised: 0` and null scores, never 0%.
 */
export function buildStrokeBreakdown(letters) {
  const byForm = {};
  for (const row of Array.isArray(letters) ? letters : []) {
    const form = formOf(row);
    if (form) byForm[form] = row;
  }

  return STROKE_FAMILIES.map((fam) => {
    const rows = fam.forms.map((f) => byForm[f]).filter(Boolean);
    const firsts  = rows.map((r) => r.first_score).filter((s) => typeof s === 'number');
    const latests = rows.map((r) => r.latest_score).filter((s) => typeof s === 'number');
    const current = mean(latests);
    const initial = mean(firsts);
    return {
      key: fam.key,
      label: fam.label,
      total: fam.forms.length,
      practised: rows.length,
      current,
      initial,
      delta: current != null && initial != null ? current - initial : null,
      // Shown on the card so a teacher sees which letters the family means.
      sample: fam.forms.slice(0, 6).join(' '),
      // Every letter in the family, practised or not, for the family pop-up.
      // Only the report row's own figures — nothing derived beyond the delta.
      letters: fam.forms.map((form) => {
        const r = byForm[form];
        return r
          ? {
            form,
            practised: true,
            attempts: r.attempts ?? null,
            sessions: r.sessions ?? null,
            first: typeof r.first_score === 'number' ? r.first_score : null,
            latest: typeof r.latest_score === 'number' ? r.latest_score : null,
            best: typeof r.best_score === 'number' ? r.best_score : null,
            delta: typeof r.delta === 'number' ? r.delta : null,
            latestAt: r.latest_at ?? null,
          }
          : { form, practised: false };
      }),
    };
  });
}

/** Fetches the report's letters and builds the breakdown. Never throws. */
export async function fetchStrokeBreakdown(studentId) {
  if (!studentId) return { status: 'unavailable', families: buildStrokeBreakdown([]) };
  // Lazy, as in writingModuleSummary: importing the pure rules must not drag
  // the HTTP client into a test.
  const client = require('../api/client').default;
  const { ENDPOINTS } = require('../constants/api');
  try {
    const { data } = await client.get(ENDPOINTS.LETTER_PROGRESS_REPORT(studentId));
    return { status: 'ok', families: buildStrokeBreakdown(data?.letters) };
  } catch {
    return { status: 'unavailable', families: buildStrokeBreakdown([]) };
  }
}
