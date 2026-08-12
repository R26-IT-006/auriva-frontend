// Feature 5 Step 3 — Interaction-scoped adaptive-repetition counter.
//
// This module answers one question: "how many automatic Feature-5 spaced
// repetitions has this exact (student, letter, case, interaction) already
// received?" It is the Feature 5 analogue of Feature 4's
// preWritingSessionGuard.js hasWarmupHandled()/markWarmupHandled() pair —
// same interaction-scoped philosophy, same in-memory-only storage, same
// reasons for NOT using AsyncStorage.
//
// ── Why a COUNT, not a boolean (Step 3 spec §8) ─────────────────────────
// The current pilot cap (repetitionPolicy.js's
// MAX_ADAPTIVE_REPETITIONS_PER_LETTER_PER_INTERACTION) is 1, so a boolean
// would technically suffice today — but storing an integer keeps this
// helper compatible with a future policy change (e.g. cap=2) without
// needing a shape change here, and it is what the backend's own
// `adaptiveRepetitionsUsed` parameter already expects (an integer, not a
// flag).
//
// ── Why interaction-scoped, not history-scoped ───────────────────────────
// A "how many times has this student EVER received an adaptive repetition
// for this letter" count (reconstructed from historical LetterAttempt rows)
// is deliberately NOT used here — Feature 5 Step 1/Step 2 both established
// that lifetime cycle history must never drive or gate the cap (manual
// re-practice, immediate retries, and past adaptive repetitions are
// indistinguishable in that history). This guard is scoped to one
// continuous learning interaction only, identified by the same opaque
// `interactionId` Feature 4 already threads through route params.
//
// ── Why in-memory, not AsyncStorage (Step 3 spec §7) ─────────────────────
// Same rationale as preWritingSessionGuard.js: a screen remount alone is
// not a reason to reach for persistent storage, and this state correctly
// (and intentionally) resets on app process restart — a new interaction
// begins anyway on relaunch.

const VALID_CASE_TYPES = ['lowercase', 'uppercase'];

// Interaction-scoped, in-memory only. Never written to AsyncStorage/DB.
// Module-level (not React state) so it survives the same kind of
// navigation.replace() remounts a spaced repetition ultimately causes
// (child re-entering the writing screen at the repeated target).
const adaptiveRepetitionCounts = new Map(); // key -> count (integer)

function isValidLetter(letter) {
  return typeof letter === 'string' && /^[A-Za-z]$/.test(letter);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Builds the stable identity string for one (student, letter, case,
 * interaction) combination — byte-identical construction to Feature 4's
 * makeWarmupKey(), reused here as its own copy (not imported) so this
 * module has zero dependency on preWritingSessionGuard.js — the two guards
 * must remain fully independent modules (Step 3 spec: no Feature 4/5
 * coupling).
 *
 * @param {{studentId: string|number, caseType: string, letter: string, interactionId: string}} args
 * @returns {string|null}
 */
export function makeRepetitionKey({ studentId, caseType, letter, interactionId } = {}) {
  const studentKey = (typeof studentId === 'number' && Number.isFinite(studentId))
    ? String(studentId)
    : (isNonEmptyString(studentId) ? studentId : null);

  if (!studentKey) return null;
  if (!VALID_CASE_TYPES.includes(caseType)) return null;
  if (!isValidLetter(letter)) return null;
  if (!isNonEmptyString(interactionId)) return null;

  return `${studentKey}::${caseType}::${letter}::${interactionId}`;
}

/**
 * @param {{studentId, caseType, letter, interactionId, collectionMode?: boolean}} args
 * @returns {number} how many adaptive repetitions this exact target has
 *   already received this interaction. Always 0 for collection mode or any
 *   invalid/missing ingredient — never throws, never negative.
 */
export function getAdaptiveRepetitionsUsed({ studentId, caseType, letter, interactionId, collectionMode = false } = {}) {
  if (collectionMode) return 0; // Feature 5 never applies to collection mode.
  const key = makeRepetitionKey({ studentId, caseType, letter, interactionId });
  if (!key) return 0;
  return adaptiveRepetitionCounts.get(key) ?? 0;
}

/**
 * Increments the adaptive-repetition count for this exact target. Callers
 * must only call this AFTER an actual sequence reinsertion has been
 * performed (Step 3 spec §10) — never when a fetch merely starts, never
 * merely because the backend said shouldRepeat=true, never on a failed/
 * rejected insertion attempt. Idempotent in the sense that it always
 * increments by exactly 1 per call — callers are responsible for calling it
 * exactly once per real insertion.
 *
 * @param {{studentId, caseType, letter, interactionId, collectionMode?: boolean}} args
 * @returns {boolean} true if the count was actually incremented, false if
 *   this was a no-op (collection mode or invalid ingredients).
 */
export function incrementAdaptiveRepetitionsUsed({ studentId, caseType, letter, interactionId, collectionMode = false } = {}) {
  if (collectionMode) return false;
  const key = makeRepetitionKey({ studentId, caseType, letter, interactionId });
  if (!key) return false;

  const current = adaptiveRepetitionCounts.get(key) ?? 0;
  adaptiveRepetitionCounts.set(key, current + 1);
  return true;
}

/**
 * Test-only / defensive utility — clears all adaptive-repetition count
 * state. Not called anywhere in production screens; exists so tests never
 * leak state across cases.
 */
export function resetRepetitionGuardStore() {
  adaptiveRepetitionCounts.clear();
}
