/**
 * pronunciationModuleSummary.js
 *
 * The Student Profile -> Module Progress -> PRONUNCIATION tab summary, laid out
 * like the Concept and Writing tabs: a headline score, a few counts, the words
 * worth another look, and a per-category breakdown.
 *
 * Reads only GET /teacher/students/:id/pronunciation-results — the endpoint the
 * Pronunciation sessions screen already uses — capped at its maximum page, so
 * every figure here describes the child's most recent attempts. Scores are
 * `overall_score`, the same figure the sessions screen shows.
 *
 * Pure: categories and word totals are passed in, so this never imports the
 * word bank (and its images) and stays directly unit-testable.
 */

'use strict';

export const RECENT_LIMIT = 50;
// Below this, a word's latest attempt is listed under "Worth another look".
export const LOOK_AGAIN_BELOW = 60;
export const ALPHABET_KEY = 'alphabet';

const isScore = (n) => typeof n === 'number' && Number.isFinite(n);
const mean = (xs) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

/**
 * @param {Array} results    rows from the results endpoint, newest first
 * @param {{ categories?: Array<{id:string,title:string}>, totals?: Object<string,number> }} opts
 */
export function buildPronunciationSummary(results, { categories = [], totals = {} } = {}) {
  const rows = Array.isArray(results) ? results.filter(Boolean) : [];
  const scored = rows.filter((r) => isScore(r.overall_score));

  const groupKey = (r) => (r.mode === 'alphabet' ? ALPHABET_KEY : r.category_id || null);
  const wordKey = (r) => r.word_id || r.word_label || null;

  // The newest attempt per word decides whether it is worth another look: an
  // early stumble the child has since got right should not keep it listed.
  const latestByWord = new Map();
  for (const r of scored) {
    const k = wordKey(r);
    if (k && !latestByWord.has(`${groupKey(r)}|${k}`)) latestByWord.set(`${groupKey(r)}|${k}`, r);
  }
  const lookAgain = [...latestByWord.values()]
    .filter((r) => r.overall_score < LOOK_AGAIN_BELOW)
    .sort((a, b) => a.overall_score - b.overall_score)
    .map((r) => ({ label: r.word_label || r.word_id, score: r.overall_score }));

  const words = new Set(rows.filter((r) => r.mode !== 'alphabet').map(wordKey).filter(Boolean));

  const labelFor = (key) => (key === ALPHABET_KEY
    ? 'Alphabet'
    : categories.find((c) => c.id === key)?.title
      ?? String(key).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  // Catalogue order, then anything the catalogue does not know about.
  const order = [...categories.map((c) => c.id), ALPHABET_KEY];
  const seen = [...new Set(rows.map(groupKey).filter(Boolean))];
  const keys = [...order.filter((k) => seen.includes(k)), ...seen.filter((k) => !order.includes(k))];

  const groups = keys.map((key) => {
    const inGroup = rows.filter((r) => groupKey(r) === key);
    return {
      key,
      label: labelFor(key),
      attempts: inGroup.length,
      practised: new Set(inGroup.map(wordKey).filter(Boolean)).size,
      total: totals[key] ?? null,
      average: mean(inGroup.map((r) => r.overall_score).filter(isScore)),
    };
  });

  return {
    attempts: rows.length,
    capped: rows.length >= RECENT_LIMIT,
    averageScore: mean(scored.map((r) => r.overall_score)),
    latestScore: scored.length ? scored[0].overall_score : null,
    latestAt: rows[0]?.created_at ?? null,
    wordsPractised: words.size,
    flagged: rows.filter((r) => r.needs_teacher_review && r.teacher_reviewed_score == null).length,
    lookAgain,
    groups,
  };
}
