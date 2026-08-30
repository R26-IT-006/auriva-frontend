/**
 * demoAccess.js
 *
 * ONE switch that opens Uppercase and Words for a demonstration, without
 * touching the rules that decide when a child has actually earned them.
 *
 * ── Where the switch comes from ──────────────────────────────────────────
 * An environment variable, not a hand-edited source constant:
 *
 *     EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK=true
 *
 * in a local `.env` (already gitignored, alongside the API_BASE_URL example
 * this project ships). Expo SDK 54 inlines `EXPO_PUBLIC_*` at bundle time, so
 * no dotenv package, no config plugin and no new build step are involved —
 * this is the environment mechanism the project already has, finally used.
 *
 * The default is OFF. A build made without that variable — which is every
 * build unless someone deliberately sets it — behaves exactly as the app did
 * before preview access existed. Shipping it enabled now requires an
 * explicit act, not a forgotten one.
 *
 * ── Fails closed, always ─────────────────────────────────────────────────
 * Absent, empty, misspelled, `"1"`, `"yes"`, `"TRUE "` with a stray space —
 * only the literal string `true` (trimmed, any case) turns it on. Anything
 * this parser does not recognise is `false`. There is no input that fails
 * open.
 *
 * ── What this does NOT do ────────────────────────────────────────────────
 * It does not modify `isWordsUnlocked()`, it does not modify the
 * `lowercaseProgress >= 26` uppercase rule, and it does not mark anything as
 * mastered. Those two gates keep answering exactly what they answered
 * before — the flag is OR'd in at the tap site only, and the screens still
 * ask the real gate to decide how the card LOOKS. So a demo build shows the
 * true state of the child's progress and merely lets you walk past it.
 *
 * ── Why it is a visible "Preview", not a silent unlock ───────────────────
 * A control that looks locked but works anyway is the worst option for an
 * autistic child: it makes the interface unpredictable, which is the one
 * thing this app is built to avoid. So a demo-opened card is neither dressed
 * up as earned nor left looking dead. It gets its own calm, consistent
 * state — a soft "Preview" badge and one short line saying what comes first
 * — which is honest in both directions: you can go in, and it is not yet
 * your turn.
 */

'use strict';

/**
 * The parsing rule, exported so it is directly testable without depending on
 * how any particular bundler substitutes environment variables.
 *
 * @param {*} raw
 * @returns {boolean} true ONLY for the string 'true' (trimmed, any case).
 */
export function parseDemoPreviewFlag(raw) {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'true';
}

/**
 * Demo switch. `true` = Uppercase and Words can be opened before they are
 * earned, clearly marked as a preview.
 *
 * Read once, at module load. Written as a direct `process.env.EXPO_PUBLIC_*`
 * member access because that is the exact form Metro replaces with a literal;
 * assigning `process.env` to a variable first would silently defeat it.
 */
export const DEMO_PREVIEW_UNLOCK = parseDemoPreviewFlag(
  process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK,
);

// One line, once per app launch (module scope runs once), never per render,
// and never anywhere a child can see it. Silent in a normal build, because
// the flag is false there.
if (DEMO_PREVIEW_UNLOCK && typeof console !== 'undefined') {
  console.warn('[DEMO] Progression preview access is enabled. Uppercase and Words can be opened before they are earned. Do not ship this build to a child.');
}

/**
 * @param {boolean} earned — what the REAL gate decided.
 * @returns {boolean} whether the card can be opened right now.
 */
export function canOpen(earned) {
  return Boolean(earned) || DEMO_PREVIEW_UNLOCK;
}

/**
 * @param {boolean} earned
 * @returns {boolean} true only when the card is open BECAUSE of the demo
 *   switch — i.e. it should wear the preview state rather than the earned one.
 */
export function isPreview(earned) {
  return !earned && DEMO_PREVIEW_UNLOCK;
}

// ── Wording ──────────────────────────────────────────────────────────────
// One short line each, present tense, no negation, no exclamation, no
// "you can't". Says what to do first, not what is forbidden.
export const PREVIEW_BADGE = 'Preview';
export const UPPERCASE_ORDER_CAPTION = 'Finish all lowercase letters first.';
export const WORDS_ORDER_CAPTION     = 'Finish all letters first.';
