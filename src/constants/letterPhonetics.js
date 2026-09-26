/**
 * letterPhonetics.js
 *
 * Letter pronunciation for the writing module, in ONE place, in
 * **Standard Southern British English** (non-rhotic RP/SSB).
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The lowercase and uppercase screens each carried their own private copy of
 * the same table. They had already drifted: the uppercase copy spelled `w`
 * with a CYRILLIC у (U+0443) instead of a Latin u, so the same letter was
 * transcribed differently depending on which screen the child was on. Two
 * copies of one fact is the bug; this is the single copy.
 *
 * ── NAME vs SOUND ────────────────────────────────────────────────────────
 * These are two different things and the old table only had one of them.
 *
 *   NAME   what the letter is CALLED   — b is "bee"  /biː/
 *   SOUND  what the letter SAYS        — b says      /b/
 *
 * What was previously labelled "PHONETICS" and shown under the target letter
 * was the NAME throughout. That is kept and corrected; SOUND is added
 * alongside it so both are available from one source and cannot disagree
 * between cases.
 *
 * Sounds are written as the PURE phoneme: /b/, /t/, /m/ — never "buh",
 * "tuh", "muh". The trailing schwa is an artefact of saying a consonant in
 * isolation, not part of the sound, and teaching it makes blending harder for
 * early readers.
 *
 * ── British, not American ────────────────────────────────────────────────
 * The corrections made here, all of which the old table got wrong:
 *
 *   r   /ɑːr/ → /ɑː/     non-rhotic: no /r/ before a consonant or a pause
 *   o   /oʊ/  → /əʊ/     GOAT is /əʊ/ in SSB, /oʊ/ in GA
 *   e-set /ɛ/ → /e/      DRESS is conventionally /e/ in British transcription
 *                        (f, l, m, n, s, x, z)
 *
 * `z` was already /zed/ rather than the American /ziː/, and stays.
 *
 * ── The single-sound trap ────────────────────────────────────────────────
 * A letter does not have one sound. `PRIMARY_SOUND` below is the value taught
 * FIRST in early phonics, not the only one a letter can make; `ALSO_SOUNDS`
 * carries the common alternates with a worked example taken from this app's
 * own word list (constants/wordData.js), never an invented one. Anything
 * presented to a child must not claim these are exhaustive.
 */

'use strict';

/**
 * Letter NAMES — what the letter is called. British IPA, non-rhotic.
 * Shared by both writing screens; the case of the key is irrelevant, the
 * name is the same for 'a' and 'A'.
 */
export const LETTER_NAMES = Object.freeze({
  a: 'eɪ',    b: 'biː',   c: 'siː',   d: 'diː',   e: 'iː',
  f: 'ef',    g: 'dʒiː',  h: 'eɪtʃ',  i: 'aɪ',    j: 'dʒeɪ',
  k: 'keɪ',   l: 'el',    m: 'em',    n: 'en',    o: 'əʊ',
  p: 'piː',   q: 'kjuː',  r: 'ɑː',    s: 'es',    t: 'tiː',
  u: 'juː',   v: 'viː',   w: 'ˈdʌbljuː', x: 'eks', y: 'waɪ', z: 'zed',
});

/**
 * Letter SOUNDS — the phoneme taught first. Pure consonants, no schwa.
 * Short-vowel values are the British ones and are context-dependent: see
 * ALSO_SOUNDS and the note above.
 */
export const PRIMARY_SOUND = Object.freeze({
  a: 'æ',  b: 'b',  c: 'k',  d: 'd',  e: 'e',
  f: 'f',  g: 'ɡ',  h: 'h',  i: 'ɪ',  j: 'dʒ',
  k: 'k',  l: 'l',  m: 'm',  n: 'n',  o: 'ɒ',
  p: 'p',  q: 'kw', r: 'r',  s: 's',  t: 't',
  u: 'ʌ',  v: 'v',  w: 'w',  x: 'ks', y: 'j',  z: 'z',
});

/**
 * The letters whose sound genuinely depends on the word, with an example
 * drawn from this app's own practice words. `example: null` means the current
 * word list contains no instance of that alternate — worth knowing before
 * anyone teaches it from a word the child will never meet here.
 */
export const ALSO_SOUNDS = Object.freeze({
  c: [{ sound: 's',  example: null,          note: 'soft c, as in "city" — no soft-c word in the current list' }],
  g: [{ sound: 'dʒ', example: 'engine',      note: 'soft g' }],
  q: [{ sound: 'kj', example: 'queue',       note: 'the one word in the list where qu is not /kw/' }],
  x: [{ sound: 'z',  example: 'xylophone',   note: 'word-initial x' },
      { sound: 'eks', example: 'x-ray',      note: 'the letter name itself, used as a word' }],
  y: [{ sound: 'ɪ',  example: null,          note: 'y as a vowel, as in "happy"' },
      { sound: 'əʊ', example: 'yo-yo',       note: 'y as a vowel, word-final' }],
  a: [{ sound: 'ɑː', example: 'grass',       note: 'BATH vowel — /ɑː/ in British, /æ/ in American' }],
});

const norm = (letter) => String(letter ?? '').toLowerCase();

/** @returns {string} the letter's British name in IPA, or '' if unknown. */
export function letterName(letter) {
  return LETTER_NAMES[norm(letter)] ?? '';
}

/** @returns {string} the letter's first-taught sound, or '' if unknown. */
export function letterSound(letter) {
  return PRIMARY_SOUND[norm(letter)] ?? '';
}

/**
 * The bracketed name as the writing screens display it, e.g. `[biː]`.
 * Identical for 'b' and 'B' — the name does not depend on case.
 * @returns {string} '' for an unknown letter, so nothing is rendered.
 */
export function letterNameDisplay(letter) {
  const name = letterName(letter);
  return name ? `[${name}]` : '';
}
