/**
 * letterRemediationPlan.js
 *
 * The short motor warm-up shown to a child who has failed TWO cycles on the
 * same letter, immediately before cycle 3 begins.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 * Not the category-transition warm-up (utils/preWritingTransition.js). That
 * one fires when the SEQUENCE moves between motor primitive groups and knows
 * nothing about how the child performed. This one fires on demonstrated
 * difficulty with one exact letter and ignores the sequence entirely. Same
 * screen, same activities, different trigger and different purpose — the two
 * state machines are deliberately kept apart.
 *
 * ── No new data ──────────────────────────────────────────────────────────
 * The recipe is the letter's OWN `strokeTypes`, read from
 * constants/letterCategories.js — the single frontend source, the same arrays
 * the backend's worksheetMotorMap mirrors under a CI drift test. There is no
 * second 52-letter map here, and no new geometry: every stroke id resolves to
 * an activity that already exists in preWritingActivities.js.
 *
 * ── Deliberately short ───────────────────────────────────────────────────
 * At most TWO activities, after de-duplicating repeated strokes. A child who
 * has just failed twice needs a brief reset, not an exercise set. `m`
 * (vertical_line, curve_wave, curve_wave) de-duplicates to two; uppercase `R`
 * (vertical_line, half_circle, zigzag) is the only letter in 52 with three
 * distinct strokes and is truncated to its first two in source order — a flat
 * cap, deliberately not a ranking algorithm built for one letter.
 *
 * ── Size ─────────────────────────────────────────────────────────────────
 * No large/medium/small ladder. The existing activities are used at their
 * existing geometry; generatePoints is untouched and takes no scale.
 */

'use strict';

import { getLetterStrokeTypes, getLetterStrokeVariants } from '../data/letterCategories';
import { PRE_WRITING_ACTIVITIES } from '../data/preWritingActivities';

/** The most activities a remediation may ever contain. */
export const MAX_REMEDIATION_ACTIVITIES = 2;

/**
 * stroke id -> an EXISTING pre-writing activity id. Six rows, one per stroke
 * id in the teaching taxonomy. No new activity is defined anywhere.
 *
 * `half_circle` is NOT here: a curve's identity is incomplete without its
 * direction, and `c` and `b` bow opposite ways. It resolves through
 * HALF_CIRCLE_BY_VARIANT below instead.
 */
export const STROKE_TYPE_TO_ACTIVITY_ID = Object.freeze({
  vertical_line:   'connect_vertical_dots',
  horizontal_line: 'connect_horizontal_dots',
  full_circle:     'trace_circle',
  zigzag:          'trace_zigzag',
  curve_wave:      'connect_curve_dots',
});

/**
 * The two existing half-circle activities, chosen by the letter's own bow
 * direction (constants/letterCategories.js `strokeVariants`).
 *
 *   cap  the curve bows LEFT of a downward stroke — c, C, G, e, r
 *        -> trace_half_circle_cw, the arc that goes OVER the top
 *   cup  it bows RIGHT — b, p, B, D, P, R
 *        -> trace_half_circle_ccw, the arc that goes UNDER the bottom
 *
 * ── What this does and does not fix ──────────────────────────────────────
 * It stops `c` and `b` receiving the identical movement, which was the whole
 * complaint. It does not make the warm-up arc share the letter bowl's exact
 * orientation: both existing activities are arcs over a HORIZONTAL chord
 * (∩ and ∪), while a letter bowl turns about a VERTICAL one (⊂ and ⊃). The
 * pairing above matches each letter to the half of its own bowl that
 * dominates — a `c` is entered over the top, a `b`/`p` bowl closes under the
 * bottom. A true ⊂/⊃ warm-up would need a rotated arc, i.e. new geometry,
 * which is deliberately out of scope.
 *
 * A letter with no variant recorded gets NO half-circle warm-up rather than a
 * guessed direction — the remaining strokes still warm up normally.
 */
const HALF_CIRCLE_BY_VARIANT = Object.freeze({
  cap: 'trace_half_circle_cw',
  cup: 'trace_half_circle_ccw',
});

/** Every activity id this module can ever select. */
export const REMEDIATION_ACTIVITY_IDS = Object.freeze([
  ...Object.values(STROKE_TYPE_TO_ACTIVITY_ID),
  ...Object.values(HALF_CIRCLE_BY_VARIANT),
]);

/**
 * @param {string} strokeType
 * @param {Object|null} variants — the letter's strokeVariants, or null.
 * @returns {string|null} the activity id, or null when this stroke cannot be
 *   resolved for this letter (unknown stroke, or a curve with no direction).
 */
export function activityIdForStroke(strokeType, variants) {
  if (strokeType === 'half_circle') {
    return HALF_CIRCLE_BY_VARIANT[variants?.half_circle] ?? null;
  }
  return STROKE_TYPE_TO_ACTIVITY_ID[strokeType] ?? null;
}

const activityById = (id) => PRE_WRITING_ACTIVITIES.find((a) => a.id === id) ?? null;

/**
 * The de-duplicated, capped list of stroke ids to warm up for one letter.
 *
 * @param {string} letter — in the case the child is writing.
 * @returns {string[]} at most MAX_REMEDIATION_ACTIVITIES ids, in the letter's
 *   own source order. Empty for an unknown letter or an unmapped stroke —
 *   never a substituted default.
 */
export function remediationStrokeTypes(letter) {
  const strokeTypes = getLetterStrokeTypes(letter);
  if (!Array.isArray(strokeTypes)) return [];
  const variants = getLetterStrokeVariants(letter);

  const seen = new Set();
  const out = [];
  for (const id of strokeTypes) {
    if (seen.has(id)) continue;                       // m: curve_wave twice -> once
    if (!activityIdForStroke(id, variants)) continue; // unresolvable, never guessed
    seen.add(id);
    out.push(id);
    if (out.length === MAX_REMEDIATION_ACTIVITIES) break;
  }
  return out;
}

/**
 * The activities to hand PreWritingActivityScreen for this letter.
 *
 * @param {string} letter
 * @returns {Array} real activity objects from the existing catalogue, in
 *   stroke order. Empty means "no remediation is possible" — the caller must
 *   continue straight to cycle 3 rather than showing an empty screen.
 */
export function buildLetterRemediationActivities(letter) {
  const variants = getLetterStrokeVariants(letter);
  return remediationStrokeTypes(letter)
    .map((id) => activityById(activityIdForStroke(id, variants)))
    .filter(Boolean);
}
