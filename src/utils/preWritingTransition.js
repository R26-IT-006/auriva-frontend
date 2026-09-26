/**
 * preWritingTransition.js
 *
 * When a pre-writing warm-up is due: ONLY when the letter sequence crosses
 * from one motor primitive group into another.
 *
 * ── What was wrong ───────────────────────────────────────────────────────
 * Two separate faults, one at each end of the sequence.
 *
 * 1. SESSION START. LetterPracticeScreen warmed up for `sequence[0]`
 *    unconditionally. There is no transition at index 0 — nothing precedes
 *    it — so the child sat through a warm-up for the very category they were
 *    about to start, every single time. Its fallback made it worse: with no
 *    sequence it invented a first letter from `categoryOrder?.[0] ?? 'straight'`,
 *    which is why it looked like "always straight pre-writing" regardless of
 *    the real first category.
 *
 * 2. MID SEQUENCE. The writing screens warmed up before EVERY next letter
 *    whose group happened to have activities — they never looked at the
 *    letter just finished. Going l → i (both vertical_horizontal) triggered a
 *    warm-up exactly as l → c (vertical_horizontal → curved) did.
 *
 * ── The rule ─────────────────────────────────────────────────────────────
 *     index 0                     → never
 *     group(seq[i-1]) === group(seq[i]) → never
 *     otherwise                   → warm up for group(seq[i]) — the group
 *                                   being ENTERED, not the one being left
 *
 * The sequence is authoritative. No category order is assumed anywhere here:
 * curved → vertical_horizontal → mixed is as valid as the reverse, and a
 * previous group is NEVER inferred or defaulted when one does not exist.
 *
 * ── Which taxonomy ───────────────────────────────────────────────────────
 * `getLetterPrimitiveGroup` — the four MOTOR PRIMITIVE groups
 * (vertical_horizontal, curved, diagonal, mixed). These are NOT the three
 * letterCategories buckets (straight, curved, mixed); the primitive groups
 * are what the warm-up catalogue is indexed by, so they are the only ones
 * that can decide which warm-up to show. No second mapping is introduced.
 */

'use strict';

import { getLetterPrimitiveGroup } from '../data/preWritingActivities';

const letterAt = (sequence, index) => {
  const entry = sequence?.[index];
  const letter = typeof entry === 'string' ? entry : entry?.letter;
  return typeof letter === 'string' && letter.length > 0 ? letter : null;
};

/**
 * The primitive group a warm-up should be shown for before `sequence[index]`,
 * or null when no warm-up is due.
 *
 * @param {Array<{letter: string}|string>} sequence — the letters in the order
 *   the child will actually write them.
 * @param {number} index — position of the letter about to be presented.
 * @returns {string|null} the group being entered, or null.
 */
export function primitiveGroupOnEntering(sequence, index) {
  if (!Array.isArray(sequence)) return null;
  // Index 0 has nothing before it. A single-letter selection is this case too:
  // no transition exists, so no warm-up — never a previous group invented to
  // manufacture one.
  if (!Number.isInteger(index) || index <= 0 || index >= sequence.length) return null;

  const previous = letterAt(sequence, index - 1);
  const current  = letterAt(sequence, index);
  if (!previous || !current) return null;

  const previousGroup = getLetterPrimitiveGroup(previous);
  const currentGroup  = getLetterPrimitiveGroup(current);

  return previousGroup === currentGroup ? null : currentGroup;
}

/**
 * True when the sequence changes primitive group at `index`.
 * @returns {boolean}
 */
export function isCategoryTransition(sequence, index) {
  return primitiveGroupOnEntering(sequence, index) !== null;
}

/**
 * Every index at which a warm-up is due — useful for reasoning about a whole
 * sequence at once, and for asserting that a run of same-group letters
 * produces exactly one transition rather than one per letter.
 *
 * @returns {number[]} ascending indices, never including 0.
 */
export function categoryTransitionIndices(sequence) {
  if (!Array.isArray(sequence)) return [];
  const out = [];
  for (let i = 1; i < sequence.length; i += 1) {
    if (primitiveGroupOnEntering(sequence, i) !== null) out.push(i);
  }
  return out;
}
