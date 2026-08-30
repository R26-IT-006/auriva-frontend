/**
 * wordUnlockGate.js
 *
 * Pre-device P0 fix — Blocker 1 (word-writing unlock gate was hardcoded
 * `true` in LetterHomeScreen.js, so Words was reachable at any mastery
 * level). Extracted as a small, independently-testable pure function
 * rather than an inline boolean, so the actual unlock RULE (not just the
 * screen's source text) has real test coverage.
 *
 * ── Rule audited and applied ────────────────────────────────────────────
 * The proposal's own three-tier ordering is lowercase -> uppercase -> word
 * level. Every existing letter-proficiency concept already in this
 * codebase was checked before choosing this rule:
 *   - LetterPracticeScreen.js's uppercase-unlock gate: lowercaseProgress >= 26
 *   - ProgressReportScreen.js's own identical `lowercase >= 26` convention
 *   - the word module's own content (WordLetterSelectScreen.js /
 *     WordWritingScreen.js) — confirmed to draw lowercase letterforms
 *     only; uppercase glyphs are used purely cosmetically (display
 *     capitalization, TTS pronunciation), never as a guide path a child
 *     traces
 * None of these established a narrower "lowercase alone" requirement for
 * Words specifically — the only place that idea existed was the hardcoded
 * `true` itself, which is the bug, not a validated requirement. Absent any
 * contrary evidence, the literal proposal ordering is applied: Words
 * unlocks only once BOTH the 26 lowercase AND the 26 uppercase letters are
 * mastered.
 *
 * Both counts must come from the backend-authoritative LetterProgress
 * counts (LETTER_PROGRESS endpoint's lowercase_completed/
 * uppercase_completed) — never AsyncStorage, never a client-only flag.
 */

'use strict';

const REQUIRED_LOWERCASE_COUNT = 26;
const REQUIRED_UPPERCASE_COUNT = 26;

/**
 * @param {number} lowercaseProgress — authoritative count of mastered
 *   lowercase letters (0-26).
 * @param {number} uppercaseProgress — authoritative count of mastered
 *   uppercase letters (0-26).
 * @returns {boolean} true only once both counts have reached their
 *   required total. Never true from a partial count, and never trusts a
 *   non-numeric/negative input as "done" (fails closed).
 */
export function isWordsUnlocked(lowercaseProgress, uppercaseProgress) {
  const lower = typeof lowercaseProgress === 'number' ? lowercaseProgress : 0;
  const upper = typeof uppercaseProgress === 'number' ? uppercaseProgress : 0;
  return lower >= REQUIRED_LOWERCASE_COUNT && upper >= REQUIRED_UPPERCASE_COUNT;
}

export { REQUIRED_LOWERCASE_COUNT, REQUIRED_UPPERCASE_COUNT };
