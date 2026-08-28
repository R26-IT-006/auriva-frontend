/**
 * wordImageResolver.js
 *
 * One way to get from a word to its picture, for callers that have the WORD
 * and nothing else.
 *
 * ── Why the report showed nothing ────────────────────────────────────────
 * The child activities are handed a catalogue entry — `{ word, letter, emoji,
 * imageKey }` — so they pass `imageKey` straight to WordImageDisplay and it
 * works. The Progress Report is not: its rows are built in reportEngine from
 * the backend's word-progress payload, which stores only `{ word, status }`.
 * So the report rendered `imageKey={w.imageKey ?? ''}` — a lookup of `''`,
 * always undefined — and `emoji={w.emoji}` — also undefined. Every word fell
 * to the emoji branch with no emoji, i.e. an empty box.
 *
 * The report was never given the fields it was reading. This closes that by
 * resolving from the one field it does have.
 *
 * ── Source of truth ──────────────────────────────────────────────────────
 * constants/wordData.js (the catalogue) and constants/wordImages.js (the
 * require map). No second map is defined here or anywhere else; this only
 * looks things up.
 *
 * ── Asset shape ──────────────────────────────────────────────────────────
 * `require('../../assets/words/A/3-letter/ant.jpg')` returns a React Native
 * asset reference — a module id, NOT a URL. It must be given to <Image> as
 * `source={asset}`. Wrapping it as `{ uri: asset }` produces a silently broken
 * image, so this returns the asset exactly as the map holds it and never
 * constructs a uri object around one.
 */

'use strict';

import WORD_DATA from '../constants/wordData';
import WORD_IMAGES from '../constants/wordImages';

const normaliseKey = (value) => String(value ?? '').trim().toLowerCase();

/** word -> catalogue entry, built once. */
const BY_WORD = WORD_DATA.reduce((acc, entry) => {
  const key = normaliseKey(entry?.word);
  if (key && !acc[key]) acc[key] = entry;
  return acc;
}, Object.create(null));

/**
 * The catalogue entry for a word, whatever case it arrives in.
 * @returns {Object|null}
 */
export function findWordEntry(word) {
  const key = normaliseKey(word);
  return key ? (BY_WORD[key] ?? null) : null;
}

/**
 * The image key a word's picture is stored under.
 * @returns {string} '' when the word is unknown — never a guessed key.
 */
export function resolveWordImageKey(word) {
  return findWordEntry(word)?.imageKey ?? '';
}

/** The word's emoji, the catalogue's own fallback when no picture exists. */
export function resolveWordEmoji(word) {
  return findWordEntry(word)?.emoji ?? '';
}

/**
 * The React Native image source for a word.
 *
 * @returns {*} the asset reference exactly as WORD_IMAGES holds it, or null
 *   when the word is unknown or genuinely has no picture. NEVER a `{ uri }`
 *   wrapper around a local asset.
 */
export function resolveWordImageSource(word) {
  const key = resolveWordImageKey(word);
  return key ? (WORD_IMAGES[key] ?? null) : null;
}

/**
 * Everything a caller needs to render a word's picture from the word alone.
 * @returns {{imageKey: string, emoji: string, hasImage: boolean}}
 */
export function resolveWordImage(word) {
  const imageKey = resolveWordImageKey(word);
  return {
    imageKey,
    emoji: resolveWordEmoji(word),
    hasImage: Boolean(imageKey && WORD_IMAGES[imageKey]),
  };
}
