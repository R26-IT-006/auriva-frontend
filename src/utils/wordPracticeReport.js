/**
 * wordPracticeReport.js
 *
 * One entry per word, carrying everything known about that word.
 *
 * ── What was split ──────────────────────────────────────────────────────
 * The report's Word Practice section listed the same words twice under two
 * headings. "Word activities" grouped them by letter and showed the A–E
 * chips; "Word writing" was a flat list far below with the writing score and
 * the size/spacing labels. A teacher looking at ANT's activity results had to
 * scroll past every other letter to find ANT's handwriting result, and the two
 * lists never referred to each other.
 *
 * Both data sources are unchanged and still fetched separately. This joins
 * them, so each word appears once with its own complete evidence.
 *
 * ── The join ─────────────────────────────────────────────────────────────
 * On the word itself, trimmed and lower-cased. The activity payload and the
 * writing payload both key on the stored catalogue word, so the match is
 * exact — no fuzzy matching, and a word that matches nothing gets `null`
 * rather than another word's score.
 *
 * ── Writing-only words ───────────────────────────────────────────────────
 * A word can have a writing attempt and no activity row (exercise E writes
 * before A–D are all recorded). Dropping it would silently lose evidence the
 * teacher previously saw in the flat list, so it joins its own letter group as
 * a word with no activity statuses — visible, and honestly empty.
 *
 * It does NOT touch that letter's summary numbers. `words`, `accuracy` and
 * `masteryStatus` are computed upstream from activity data alone and are
 * carried through untouched, so this reorganises the detail without moving a
 * single percentage.
 */

'use strict';

const normalise = (word) => String(word ?? '').trim().toLowerCase();

/** The letter a word is filed under: its own first character. */
export function initialLetterOf(word) {
  const first = normalise(word)[0] ?? '';
  // A letter, or nothing. '7' is not a letter group, and filing a word under
  // one would create a row no letter heading could explain.
  return /^[a-z]$/.test(first) ? first : '';
}

/**
 * Writing records keyed by normalised word.
 * A later duplicate never overwrites an earlier one — the payload is already
 * one row per word, and silently preferring the last would hide a change in
 * that contract.
 */
export function indexWritingByWord(writingWords) {
  const index = new Map();
  if (!Array.isArray(writingWords)) return index;
  for (const record of writingWords) {
    const key = normalise(record?.word);
    if (key && !index.has(key)) index.set(key, record);
  }
  return index;
}

/**
 * Every word of one letter, activity results and writing results together.
 *
 * @param {Array} byLetter — computeWordMastery().byLetter
 * @param {Array} writingWords — wordWritingHistory.words
 * @returns {Array} the same letter groups, same summary fields, with each
 *   wordList entry gaining `writing` (the matching record or null) and any
 *   writing-only word appended as `{ word, status: {}, stars: 0, writing }`.
 */
export function mergeWordPracticeByLetter(byLetter, writingWords) {
  const groups = Array.isArray(byLetter) ? byLetter : [];
  const writingIndex = indexWritingByWord(writingWords);
  const claimed = new Set();

  const merged = groups.map((group) => {
    const wordList = (Array.isArray(group?.wordList) ? group.wordList : []).map((entry) => {
      const key = normalise(entry?.word);
      if (key) claimed.add(key);
      return { ...entry, writing: writingIndex.get(key) ?? null };
    });
    return { ...group, wordList };
  });

  // Writing-only words, filed under the letter they begin with.
  const leftovers = new Map();
  for (const [key, record] of writingIndex) {
    if (claimed.has(key)) continue;
    const letter = initialLetterOf(key);
    if (!letter) continue;
    if (!leftovers.has(letter)) leftovers.set(letter, []);
    leftovers.get(letter).push({ word: record.word, status: {}, stars: 0, writing: record });
  }
  if (leftovers.size === 0) return merged;

  const withLeftovers = merged.map((group) => {
    const extra = leftovers.get(normalise(group?.letter));
    if (!extra) return group;
    leftovers.delete(normalise(group?.letter));
    // Appended to the DETAIL only. `words`, `accuracy` and `masteryStatus`
    // stay exactly as computed from activity data.
    return { ...group, wordList: [...group.wordList, ...extra] };
  });

  // A letter with writing but no activity group at all still deserves a row.
  for (const [letter, extra] of leftovers) {
    withLeftovers.push({
      letter,
      words: 0, correct: 0, good: 0, total: 0,
      accuracy: 0, withHelp: 0,
      masteryStatus: 'Needs Practice',
      exBreakdown: null, bestEx: null, worstEx: null,
      wordList: extra,
    });
  }
  return withLeftovers;
}

/**
 * Whether a word has a writing attempt to show.
 * Callers show "No writing attempt" rather than empty metrics when false.
 */
export function hasWritingResult(entry) {
  const score = entry?.writing?.latest_score;
  // `score == null` first: Number(null) is 0, which is finite, so a record
  // with no score would otherwise render as a real "Latest 0".
  return score != null && Number.isFinite(Number(score));
}
