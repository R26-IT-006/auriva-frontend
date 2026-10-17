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

/**
 * RESEARCH STATUS OF A PREVIEW-UNLOCKED BUILD
 *
 * Kept deliberately enabled for pilot/usability testing, so Uppercase and
 * Words can be reached without first completing the full curriculum. What
 * that costs, stated plainly so it is never discovered later:
 *
 * SAFE — nothing about measurement changes. This flag is consumed at exactly
 * two tap sites (LetterHomeScreen, LetterPracticeScreen) via canOpen().
 * It does not touch scoring, the attempt-3 mastery rule, the mastery
 * threshold, cycle counting, support levels, or the earned-progression gates
 * themselves — isWordsUnlocked() and the lowercase >= 26 rule still answer
 * exactly what they answered before, and the cards still SHOW the child's
 * true state.
 *
 * NOT SAFE FOR TRAINING DATA — a preview-unlocked session produces real
 * letter_attempts rows for letters the child had not yet earned, so the
 * curriculum ORDER those rows imply is not the designed one. Nothing on the
 * row records that it was collected under preview access.
 *
 * ALREADY EXCLUDED FROM THE ML EXPORT — and this is the one piece of good
 * news, so rely on it rather than re-deriving it: preview practice is always
 * NORMAL mode (collection_mode = false). Collection mode is entered only from
 * WelcomeScreen's explicit Data Collection path, which this flag does not
 * touch. GET /handwriting/ml-samples/export filters `collection_mode = true`,
 * so preview rows cannot reach it.
 *
 * The gap that remains: a DIRECT query of normal-practice letter_attempts
 * rows WILL include preview sessions, and cannot distinguish them. Closing
 * that properly needs a new column, which is deliberately not done here.
 * Until then, usability-test participants must be kept out of any
 * normal-practice training export by participant id.
 */

// One line, once per app launch (module scope runs once), never per render,
// and never anywhere a child can see it. Silent in a normal build, because
// the flag is false there.
if (DEMO_PREVIEW_UNLOCK && typeof console !== 'undefined') {
  console.warn(
    '[DEMO] Progression preview access is enabled.\n' +
    '  Uppercase and Words can be opened before they are earned. Do not ship this build to a child.\n' +
    '  PILOT / USABILITY TESTING ONLY — this build must not be used for ML training data collection.\n' +
    '  Scoring, mastery (attempt 3 only, threshold unchanged) and cycle counting are NOT affected.\n' +
    '  Attempts recorded in this build are real rows with no preview marker on them.\n' +
    '  They are excluded from /handwriting/ml-samples/export (collection_mode = false),\n' +
    '  but a direct query of normal-practice attempts CANNOT tell them apart —\n' +
    '  exclude usability-test participants by participant id. See constants/demoAccess.js.',
  );
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
