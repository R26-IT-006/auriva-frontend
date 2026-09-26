/**
 * wordHintPolicy.js
 *
 * When the hint appears in word activities A–D, and what it looks like.
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * A–C used to report their result as `onComplete(wrongCount === 0)`, and the
 * screen fed that single boolean to BOTH the saved status and the feedback
 * GIF. So a child who got it wrong twice, saw the hint, and then chose the
 * RIGHT answer was shown wrong.gif — the GIF was reporting "solved with help",
 * not "this answer is correct".
 *
 * Those are two different questions and they now have two different channels:
 *
 *   verdict      is the answer the child just gave correct?   → the GIF
 *   persistence  did they need help getting there?            → 'correct' / 'good'
 *
 * The hint is support. It is never an answer, so it never produces a verdict
 * and never moves the counter.
 *
 * ── Counting ─────────────────────────────────────────────────────────────
 * Only a submitted wrong ANSWER counts: a chosen letter, a chosen picture, a
 * tapped tile that is not the next letter of the word. Revealing the hint,
 * pressing the speaker, re-rendering, navigating and dismissing feedback all
 * count for nothing.
 */

'use strict';

import { RESULT_GIF_MS } from '../../constants/resultGifFeedback';

/** Genuine wrong answers required before the hint is offered. */
export const WRONG_ANSWERS_BEFORE_HINT = 2;

/**
 * The second wrong answer earns its wrong.gif before the hint appears —
 * the child sees the verdict on what they did, then the support arrives.
 */
export const HINT_REVEAL_DELAY_MS = RESULT_GIF_MS;

/**
 * @param {number} wrongCount answers only — never hint reveals or taps.
 * @returns {boolean} whether the hint has been earned.
 */
export function isHintUnlocked(wrongCount) {
  return Number(wrongCount) >= WRONG_ANSWERS_BEFORE_HINT;
}

/**
 * Whether THIS wrong answer is the one that unlocks the hint, so a caller
 * schedules the reveal exactly once rather than on every later wrong answer.
 */
export function unlocksHint(wrongCountAfterAnswer) {
  return Number(wrongCountAfterAnswer) === WRONG_ANSWERS_BEFORE_HINT;
}

/**
 * The hinted answer's treatment.
 *
 * Replaces the old bright yellow fill (#FFF176 / #FFF9C4) with an orange
 * border (#F9A825 / #FFB300) and burnt-orange text (#E65100) — a warning
 * palette on what is actually a helping hand. Mint and teal read as support,
 * stay legible beside the untouched neutral options, and sit with the rest of
 * the Auriva surfaces.
 *
 * Colours only. Every dimension — width, height, padding, border WIDTH,
 * radius — is deliberately absent so a hinted option occupies exactly the
 * same space as an unhinted one and nothing on the row can move.
 */
export const HINT_COLORS = {
  surface: '#E6F7F4',   // very light mint fill
  border:  '#0E8C80',   // teal outline
  text:    '#0B5F57',   // dark teal-navy glyph
};

/** The neutral, un-hinted option — unchanged from before. */
export const OPTION_COLORS = {
  surface: '#F5F5F5',
  border:  '#E0E0E0',
  text:    '#333333',
};
