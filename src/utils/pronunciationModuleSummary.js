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
// Below this, a sound inside an attempt counts towards "Sounds to practise" —
// the same cut-off the Pronunciation sessions screen uses.
export const WEAK_SOUND_BELOW = 65;
export const ALPHABET_KEY = 'alphabet';

const isScore = (n) => typeof n === 'number' && Number.isFinite(n);
const mean = (xs) => (xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

/**
 * Sounds scored below WEAK_SOUND_BELOW across these attempts, most frequent
 * first. Reads phoneme_scores ({ text, score }) as stored on each attempt.
 */
function weakSounds(rows, limit = 4) {
  const byText = new Map();
  for (const r of rows) {
    for (const p of Array.isArray(r.phoneme_scores) ? r.phoneme_scores : []) {
      const score = Number(p?.score);
      if (!p?.text || !Number.isFinite(score) || score >= WEAK_SOUND_BELOW) continue;
      const cur = byText.get(p.text) || { text: p.text, count: 0, total: 0 };
      cur.count += 1;
      cur.total += score;
      byText.set(p.text, cur);
    }
  }
  return [...byText.values()]
    .map((s) => ({ text: s.text, count: s.count, average: Math.round(s.total / s.count) }))
    .sort((a, b) => b.count - a.count || a.average - b.average)
    .slice(0, limit);
}

/**
 * One row per word in a group, from that word's attempts (newest first).
 * Lowest latest score first, so the words that need help lead the list.
 */
function wordRows(inGroup, wordKey) {
  const byWord = new Map();
  for (const r of inGroup) {
    const k = wordKey(r);
    if (!k) continue;
    if (!byWord.has(k)) byWord.set(k, []);
    byWord.get(k).push(r);
  }
  return [...byWord.entries()].map(([key, attempts]) => {
    const scores = attempts.map((r) => r.overall_score).filter(isScore);
    const latest = attempts.find((r) => isScore(r.overall_score))?.overall_score ?? null;
    const first = [...attempts].reverse().find((r) => isScore(r.overall_score))?.overall_score ?? null;
    return {
      key,
      label: attempts[0].word_label || attempts[0].word_id || key,
      attempts: attempts.length,
      latest,
      best: scores.length ? Math.max(...scores) : null,
      average: mean(scores),
      delta: latest != null && first != null && attempts.length > 1 ? latest - first : null,
      latestAt: attempts[0].created_at ?? null,
      flagged: attempts.some((r) => r.needs_teacher_review && r.teacher_reviewed_score == null),
    };
  }).sort((a, b) => (a.latest ?? 101) - (b.latest ?? 101) || a.label.localeCompare(b.label));
}

/**
 * @param {Array} results    rows from the results endpoint, newest first
 * @param {{
 *   categories?: Array<{id:string,title:string}>,
 *   totals?: Object<string,number>,
 *   catalogue?: Object<string, Array<{id:string,label:string}>>,  // every word a group offers
 * }} opts
 */
export function buildPronunciationSummary(results, { categories = [], totals = {}, catalogue = {} } = {}) {
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
    const words = wordRows(inGroup, wordKey);
    const groupScored = inGroup.filter((r) => isScore(r.overall_score));
    const seenWords = new Set(words.flatMap((w) => [String(w.key).toLowerCase(), String(w.label).toLowerCase()]));
    return {
      key,
      label: labelFor(key),
      attempts: inGroup.length,
      practised: new Set(inGroup.map(wordKey).filter(Boolean)).size,
      total: totals[key] ?? null,
      average: mean(inGroup.map((r) => r.overall_score).filter(isScore)),
      latestScore: groupScored.length ? groupScored[0].overall_score : null,
      firstScore: groupScored.length ? groupScored[groupScored.length - 1].overall_score : null,
      latestAt: inGroup[0]?.created_at ?? null,
      flagged: inGroup.filter((r) => r.needs_teacher_review && r.teacher_reviewed_score == null).length,
      words,
      sounds: weakSounds(inGroup),
      // Offered words with no attempt in this window.
      notYet: (catalogue[key] || [])
        .filter((w) => !seenWords.has(String(w.id).toLowerCase()) && !seenWords.has(String(w.label).toLowerCase()))
        .map((w) => w.label),
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
    sounds: weakSounds(rows),
    groups,
  };
}
