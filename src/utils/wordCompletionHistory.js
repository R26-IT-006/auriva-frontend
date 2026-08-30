/**
 * wordCompletionHistory.js
 *
 * Which words a child has already finished, so a new practice sequence does
 * not hand them the same word again tomorrow.
 *
 * ── What was wrong ───────────────────────────────────────────────────────
 * `getSelectedWords(letter)` filters the catalogue by initial letter and sorts
 * by length. It has never consulted what the child has done, so tapping `a` on
 * any day produced the same five words in the same order — a child who
 * finished ANT on Monday met ANT again on Tuesday.
 *
 * The evidence to prevent that was already being fetched: WordLetterSelect
 * loads authoritative progress on focus and uses it only to colour the letter
 * cards. This module is the missing predicate, not a new completion model.
 *
 * ── The source of truth ──────────────────────────────────────────────────
 * The backend's WordActivityProgress row, one per (student, word), whose
 * `activity_status` accumulates the five exercises. Nothing else counts:
 *
 *   A-D  written by upsertActivity ONLY for a 'correct' or 'good' outcome
 *   E    written ONLY when a practice_exercise_e attempt actually passed
 *
 * So opening a screen, advancing the local UI, or attempting a word records
 * nothing. A word is complete when all five are present — the exercises the
 * flow itself defines in WORD_EXERCISES, not a number written down twice.
 *
 * ── Dates ────────────────────────────────────────────────────────────────
 * A completion does not expire, so the filter needs no date arithmetic to
 * satisfy "not again on a later practice date" — and deliberately performs
 * none, rather than inventing a UTC day boundary the rest of the app does not
 * use. Where a completion date IS surfaced, it comes from the project's own
 * Asia/Colombo practice-date rule (letterCycleGuard.currentPracticeDate), the
 * same convention letter cycles are keyed on.
 *
 * This is NOT spaced repetition: a finished word simply stops being offered.
 */

'use strict';

import { WORD_EXERCISES } from './wordWorkflow';
import { currentPracticeDate } from './letterCycleGuard';

/** The outcomes the backend will actually persist. Anything else is not done. */
export const COMPLETED_STATUSES = Object.freeze(['correct', 'good']);

const normaliseWord = (word) => String(word ?? '').trim().toLowerCase();

/**
 * @param {Object|null|undefined} activityStatus — the row's activity_status.
 * @returns {boolean} true only when every exercise A-E is recorded as done.
 */
export function isWordCompleted(activityStatus) {
  if (!activityStatus || typeof activityStatus !== 'object') return false;
  return WORD_EXERCISES.every((key) => COMPLETED_STATUSES.includes(activityStatus[key]));
}

/**
 * Every completed word for one initial letter.
 *
 * @param {Object} progress — GET /word-progress payload: { letter: [{word, status}] }
 * @param {string} letter
 * @returns {Set<string>} lower-cased words, empty for anything unusable.
 */
export function completedWordsForLetter(progress, letter) {
  const key = normaliseWord(letter);
  if (!key || !progress || typeof progress !== 'object') return new Set();
  // source_letter is stored lower-cased; accepting either casing means a
  // future change there degrades to "filters nothing" nowhere.
  const entries = Array.isArray(progress[key])
    ? progress[key]
    : progress[key.toUpperCase()];
  if (!Array.isArray(entries)) return new Set();
  return new Set(
    entries
      .filter((entry) => isWordCompleted(entry?.status))
      .map((entry) => normaliseWord(entry?.word))
      .filter(Boolean)
  );
}

/**
 * The words still worth practising, in the catalogue's own order.
 *
 * Order and content are otherwise untouched — this removes, it never
 * reorders, substitutes or repeats.
 *
 * @param {Array<{word: string}>} words — from getSelectedWords()
 * @param {Object} progress
 * @param {string} letter
 * @returns {Array} the same entry objects, minus the finished ones.
 */
export function filterUnfinishedWords(words, progress, letter) {
  if (!Array.isArray(words)) return [];
  const done = completedWordsForLetter(progress, letter);
  if (done.size === 0) return [...words];
  return words.filter((entry) => !done.has(normaliseWord(entry?.word)));
}

/**
 * The practice DATE a word was completed on, in the project's Asia/Colombo
 * convention — never a raw UTC day.
 *
 * @param {{updated_at?: string}} entry — a progress entry.
 * @returns {string|null} 'YYYY-MM-DD', or null when unknown.
 */
export function completedPracticeDate(entry) {
  const raw = entry?.updated_at;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : currentPracticeDate(at);
}
