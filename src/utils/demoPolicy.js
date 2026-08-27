/**
 * demoPolicy.js
 *
 * WHICH demonstrations exist, and WHEN a child is due one.
 *
 * ── The principle this file exists to enforce ────────────────────────────
 * A demonstration is not a decoration. It is shown when the child meets a
 * NEW interaction or a NEW motor category, and never again. Auriva already
 * teaches continuously inside the activities themselves — the shape
 * assessment loops an animated pointer over every shape, and Attempt 1 of
 * every letter runs the "Watch & Trace" tracer at HIGH support. A
 * full-screen demo repeated before every activity would be noise on top of
 * instruction the child is already getting.
 *
 * What the full-screen demo adds that neither of those does is a moment
 * where the child is asked to WATCH and cannot draw: no canvas, no touch
 * target, nothing to get wrong. That moment is worth having exactly nine
 * times in the whole programme.
 *
 * ── Deliberately NOT given a demo ────────────────────────────────────────
 *   • the 2nd..nth letter of a category — same motor pattern, already
 *     introduced by the category's first letter;
 *   • each of the six assessment shapes — one interaction ("follow the
 *     path with your finger"), six instances of it, and each shape already
 *     carries its own looping pointer and spoken instruction;
 *   • Word activities A/B/C — all three are "tap the correct large
 *     option", the interaction the child already performs throughout the
 *     concept tiers;
 *   • Word activity E — the same write-on-a-guide canvas the word-writing
 *     introduction already demonstrated.
 *
 * ── Pure ─────────────────────────────────────────────────────────────────
 * No react-native import, no storage, no navigation. Decides only; the
 * caller reads state, navigates, and persists.
 */

'use strict';

// ─── The nine persistent demo keys ──────────────────────────────────────
// One key = one demonstration a child sees at most once, ever. Stored
// per-student (see storage.js) so a second child starts fresh.
export const DEMO_KEYS = Object.freeze({
  INITIAL_SHAPE_ASSESSMENT: 'initial_shape_assessment',

  LOWERCASE_STRAIGHT: 'lowercase_straight',
  LOWERCASE_CURVED:   'lowercase_curved',
  LOWERCASE_MIXED:    'lowercase_mixed',
  UPPERCASE_STRAIGHT: 'uppercase_straight',
  UPPERCASE_CURVED:   'uppercase_curved',
  UPPERCASE_MIXED:    'uppercase_mixed',

  WORD_WRITING_INTRO:       'word_writing_intro',
  WORD_ACTIVITY_SPELL_TILES: 'word_activity_spell_tiles',
});

// Derived, never a hardcoded count — the audit first said "8" by leaving
// the assessment key out of the tally, and a literal would have carried
// that error into the code.
export const ALL_DEMO_KEYS = Object.freeze(Object.values(DEMO_KEYS));

const VALID_KEYS = new Set(ALL_DEMO_KEYS);

/** The two demo presentations. Nothing else renders a demonstration. */
export const DEMO_TYPES = Object.freeze({
  PATH: 'path', // a pointer travels the real reference trajectory
  TAP:  'tap',  // a hand moves to a target and taps it
});

const VALID_CASE_TYPES = new Set(['lowercase', 'uppercase']);
// The real taxonomy, from constants/letterCategories.js's CATEGORIES —
// copied as plain strings so this module stays dependency-free, and
// asserted against that constant by test so the two can never drift.
const VALID_CATEGORIES = new Set(['straight', 'curved', 'mixed']);

/**
 * The demo key for one letter category, e.g. ('lowercase', 'curved') ->
 * 'lowercase_curved'.
 *
 * Returns null for anything unrecognized rather than composing a key from
 * a guess: an unknown category must mean "no demo", never "a demo under a
 * key nothing will ever match again".
 *
 * @param {{caseType: string, category: string}} args
 * @returns {string|null}
 */
export function makeLetterCategoryDemoKey({ caseType, category } = {}) {
  if (!VALID_CASE_TYPES.has(caseType)) return null;
  if (!VALID_CATEGORIES.has(category)) return null;
  const key = `${caseType}_${category}`;
  return VALID_KEYS.has(key) ? key : null;
}

/** @returns {boolean} true only for one of the nine defined keys. */
export function isValidDemoKey(value) {
  return typeof value === 'string' && VALID_KEYS.has(value);
}

/**
 * The single decision every caller asks.
 *
 * @param {{
 *   demoKey: string|null,
 *   shownKeys: string[]|Set<string>|null,
 *   collectionMode?: boolean,
 *   inFlight?: boolean,
 * }} args
 * @returns {boolean} true only when this child should be taken to the
 *   demonstration right now.
 *
 * Never throws, and answers `false` for every uncertain input — a missing
 * or still-loading `shownKeys` must not cause a demo the child has already
 * completed to play again.
 */
export function shouldShowDemo({ demoKey, shownKeys, collectionMode = false, inFlight = false } = {}) {
  // The controlled-trajectory research protocol is a fixed script; it never
  // detours, exactly as pre-writing warm-ups never do (see
  // preWritingSessionGuard.js's own collectionMode rule).
  if (collectionMode) return false;
  if (inFlight) return false;
  if (!isValidDemoKey(demoKey)) return false;
  // `null` means "not read yet", NOT "nothing shown".
  if (shownKeys == null) return false;

  const has = typeof shownKeys?.has === 'function'
    ? (k) => shownKeys.has(k)
    : (k) => Array.isArray(shownKeys) && shownKeys.includes(k);

  return !has(demoKey);
}

// ─── Child-facing wording (spec §4) ─────────────────────────────────────
// One instruction at a time, three words where three words will do. No
// score, no attempt count, no praise beyond a calm confirmation.
export const DEMO_COPY = Object.freeze({
  WATCH_FIRST: 'Watch first.',
  START_HERE:  'Start here.',
  NOW_YOU_TRY: 'Now you try.',
  REPLAY:      'Replay',
  READY:       "I'm Ready",
});

/**
 * The title + one-line instruction for each demo. Kept here rather than in
 * the component so the wording is testable without rendering, and so every
 * demo reads in the same voice.
 */
const DEMO_PRESENTATION = Object.freeze({
  [DEMO_KEYS.INITIAL_SHAPE_ASSESSMENT]: {
    type: DEMO_TYPES.PATH,
    title: 'Watch first.',
    instruction: 'Follow the line with your finger.',
  },
  [DEMO_KEYS.LOWERCASE_STRAIGHT]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the line.',
  },
  [DEMO_KEYS.LOWERCASE_CURVED]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the curve.',
  },
  [DEMO_KEYS.LOWERCASE_MIXED]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the line.',
  },
  [DEMO_KEYS.UPPERCASE_STRAIGHT]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the line.',
  },
  [DEMO_KEYS.UPPERCASE_CURVED]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the curve.',
  },
  [DEMO_KEYS.UPPERCASE_MIXED]: {
    type: DEMO_TYPES.PATH, title: 'Watch first.', instruction: 'Follow the line.',
  },
  [DEMO_KEYS.WORD_WRITING_INTRO]: {
    type: DEMO_TYPES.PATH,
    title: 'Watch first.',
    instruction: 'Write the letters in order.',
  },
  [DEMO_KEYS.WORD_ACTIVITY_SPELL_TILES]: {
    type: DEMO_TYPES.TAP,
    title: 'Watch first.',
    instruction: 'Tap the letters in order.',
  },
});

/**
 * @param {string} demoKey
 * @returns {{type: string, title: string, instruction: string}|null}
 */
export function getDemoPresentation(demoKey) {
  if (!isValidDemoKey(demoKey)) return null;
  return DEMO_PRESENTATION[demoKey] ?? null;
}
