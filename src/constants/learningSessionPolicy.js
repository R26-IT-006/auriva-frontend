/**
 * learningSessionPolicy.js
 *
 * Proposal FR-13 ("monitor session duration and automatically end/pause
 * the learning session when a predefined time limit or fatigue threshold
 * is reached") — Phase 7A pilot implementation.
 *
 * ── Scientific/product framing (do not weaken) ──────────────────────────
 * This module intentionally implements ELAPSED ACTIVE LEARNING TIME
 * against a configurable duration limit — NOT a clinical or physiological
 * fatigue-detection mechanism. Nothing here infers fatigue from motor
 * performance, camera, sensors, or biometric signal. "Break recommended"
 * / "Learning break" / "Session time" are the only terms this feature (or
 * anything that consumes it) may use. Never "fatigue detected",
 * "autistic fatigue detected", "clinical fatigue", or "motor fatigue
 * diagnosis" — see learningSessionTimer.js's own tests for the explicit
 * terminology guard.
 *
 * ── Values below are PILOT / ENGINEERING DEFAULTS ───────────────────────
 * No existing research-validated continuous-session duration exists
 * anywhere in this codebase (confirmed: this is the first FR-13
 * implementation — see the final pre-device audit). These two numbers are
 * a reasonable, conservative starting point for a young child's
 * continuous handwriting practice (commonly-cited children's-occupational-
 * therapy guidance suggests short bursts of focused fine-motor work,
 * often well under 20 minutes at a time for this age/attention profile),
 * chosen the same way this project's other pilot constants were (Feature
 * 2's +5 margin, Feature 6's 0.75 slow-speed multiplier, Feature 7's
 * window=5 rule): a defensible, clearly-labeled engineering default,
 * explicitly NOT presented as clinically validated, and easy to retune
 * from ONE place once real pilot data exists.
 */

'use strict';

// Soft signal only — available for a future subtle "time check" indicator.
// Reaching this alone does NOT show the break prompt.
export const SESSION_WARNING_MINUTES = 15;

// The configured continuous-session duration (spec item 2D) — reaching
// this is what makes the calm break prompt eligible to appear, at the
// next safe transition (never mid-stroke).
export const SESSION_MAX_MINUTES = 20;

// How often the active-time accumulator ticks. 1s granularity is more
// than enough for a multi-minute duration and cheap on battery/CPU.
export const SESSION_TICK_MS = 1000;

export const SESSION_WARNING_MS = SESSION_WARNING_MINUTES * 60 * 1000;
export const SESSION_MAX_MS     = SESSION_MAX_MINUTES * 60 * 1000;
