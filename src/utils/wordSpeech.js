/**
 * wordSpeech.js
 *
 * The text a word activity hands to the speech engine.
 *
 * ── Why only ANT spoke ───────────────────────────────────────────────────
 * Two hardcoded mutes, in two different screens:
 *
 *   WordActivityScreen   both the auto-speech effect and the speaker button
 *                        were wrapped in `if (currentWord.word === 'ant')`,
 *                        so every other word was silent by construction.
 *
 *   WordWritingScreen    `MUTED_WRITING_WORDS = new Set(['axe','album','arrow'])`
 *                        skipped three words outright.
 *
 * Neither was a stale closure or a dependency bug — the current word was
 * always correct at both sites. They were allow/deny lists, and they are gone.
 *
 * ── Normalisation is for SPEECH only ─────────────────────────────────────
 * The display keeps its own casing (`ANT` on screen), the catalogue keeps its
 * stored value, and nothing here rewrites either. Lower-casing is purely so no
 * engine reads an all-caps string as an initialism.
 *
 * Hyphens become spaces for the same reason: `x-ray` spoken as one token can
 * come out as a spelling, not a word.
 */

'use strict';

/**
 * @param {string|{word: string}} word — the CURRENT word, or its entry.
 * @returns {string} the text to speak; '' when there is nothing sayable, which
 *   callers must treat as "do not speak" rather than speaking an empty string.
 */
export function spokenWord(word) {
  const raw = typeof word === 'string' ? word : word?.word;
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A single letter, as the spell-out reads it aloud.
 * @returns {string} '' for anything that is not a letter.
 */
export function spokenLetter(letter) {
  const ch = String(letter ?? '').trim();
  return /^[A-Za-z]$/.test(ch) ? ch.toUpperCase() : '';
}

/** @returns {boolean} true when this word has something to say. */
export function canSpeakWord(word) {
  return spokenWord(word).length > 0;
}
