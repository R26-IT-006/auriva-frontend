/**
 * letterCycleGuard.js
 *
 * The in-app half of the two-cycle ceiling.
 *
 * ── The bug this exists to close ─────────────────────────────────────────
 * A failed 3-attempt cycle used to do exactly this, with nothing bounding it:
 *
 *     setAttempt(1);
 *     resetCanvas();
 *     return;            // same letter, immediately, forever
 *
 * A child who could not yet form `c` stayed on `c` — cycle 3, 4, 5, as long
 * as they kept going. `repetitionPolicy.js`'s own header says so outright:
 * the immediate same-letter retry was "still unbounded". This guard is what
 * makes it bounded.
 *
 * ── The rule ─────────────────────────────────────────────────────────────
 *   at most TWO completed 3-attempt cycles
 *   per (student, letter, case_type, practice date)
 *
 * Cycle 1 fails -> one immediate retry (cycle 2). Cycle 2 fails -> the letter
 * is set aside for the date and the child moves on.
 *
 * ── Two layers, because one is not enough ────────────────────────────────
 * This counter is in-memory and scoped to one PRACTICE DATE — module-level, so
 * it survives screen remounts and, importantly, a child backing out to the
 * letter list and starting again. It still dies when the app does. So it is
 * SEEDED
 * from the server's own count for the practice date, returned on every failed
 * completion (`cycle_usage` on the /letter-complete response). Closing and
 * reopening the app therefore cannot buy a third cycle: the server remembers
 * even though this module does not.
 *
 * The two layers combine by MAXIMUM, never by trust in either alone. A server
 * read failure sends `null`, which leaves this counter in charge rather than
 * granting another cycle.
 *
 * Same in-memory, module-level design as preWritingSessionGuard.js and
 * repetitionSessionGuard.js — and the same reason for not reaching for
 * AsyncStorage: a screen remount is not a reason to persist, and the durable
 * answer already lives on the server.
 *
 * ── Known remaining gap ──────────────────────────────────────────────────
 * A full app RESTART clears this map, and the server's count only reaches the
 * client when a cycle COMPLETES. So a restart mid-date can buy exactly one
 * extra cycle before the server's number lands and closes the door. Bounded,
 * not unbounded — but real. Closing it needs a pre-flight read at letter
 * mount, which is a backend contract change.
 */

'use strict';

/** The ceiling. Mirrors the backend's practiceCyclePolicy constant. */
export const MAX_CYCLES_PER_LETTER_PER_DATE = 3;

/**
 * Which attempt in a cycle is the independent, mastery-deciding one.
 * Mirrors the backend's config/masteryPolicy.js MASTERY_ATTEMPT_NUMBER — the
 * server is authoritative; this exists so the screens never hand-type a 3.
 */
export const MASTERY_ATTEMPT_NUMBER = 3;

/**
 * Zero-based index of that attempt inside the per-cycle attempts array, i.e.
 * how many records to KEEP when a capture fault forces attempt 3 to be
 * retried on its own. Slicing to this index preserves attempts 1 and 2
 * exactly as captured — a device fault must never cost a child their valid
 * guided practice.
 */
export const MASTERY_ATTEMPT_INDEX = MASTERY_ATTEMPT_NUMBER - 1;

/**
 * The timezone a practice date is measured in. Must match the backend's
 * practiceCyclePolicy.PRACTICE_TIMEZONE — the two repos are independent, so
 * this is the same "shared vocabulary, duplicated constant" arrangement
 * demoSpeedLevels.js already uses, pinned by test on both sides.
 */
export const PRACTICE_TIMEZONE = 'Asia/Colombo';

/**
 * Asia/Colombo is UTC+5:30 with NO daylight saving, so the date is fixed
 * offset arithmetic rather than `Intl.DateTimeFormat({ timeZone })`.
 *
 * That is deliberate: Hermes on Android ships without full ICU in some
 * configurations, and a timezone-aware Intl format there silently falls back
 * to UTC - which would put the client's day boundary 5.5 hours away from the
 * server's and hand a child extra cycles between 18:30 and midnight. Offset
 * arithmetic gives the same answer on every engine.
 */
const PRACTICE_UTC_OFFSET_MINUTES = 330; // +05:30

/** Today's practice date as 'YYYY-MM-DD', local to PRACTICE_TIMEZONE. */
export function currentPracticeDate(now = new Date()) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(t)) return new Date().toISOString().slice(0, 10);
  return new Date(t + PRACTICE_UTC_OFFSET_MINUTES * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const VALID_CASE_TYPES = ['lowercase', 'uppercase'];

// key -> count of COMPLETED cycles observed for this letter on this date.
const cycleCounts = new Map();

/**
 * Keyed by PRACTICE DATE, not by interaction.
 *
 * It was keyed by `interactionId` at first, and that was wrong: an
 * interaction is one "start writing" tap, so backing out to the letter list
 * and starting again minted a fresh id, reset the count to zero, and let a
 * third cycle begin on the same letter the same day. The rule is per DATE,
 * so the key must be per date.
 *
 * `interactionId` is still accepted and ignored, so both writing screens
 * could keep passing what they already pass.
 */
function makeKey({ studentId, letter, caseType, date = null }) {
  const studentKey = (typeof studentId === 'number' && Number.isFinite(studentId))
    ? String(studentId)
    : (typeof studentId === 'string' && studentId.length > 0 ? studentId : null);
  if (!studentKey) return null;
  if (!VALID_CASE_TYPES.includes(caseType)) return null;
  if (typeof letter !== 'string' || !/^[A-Za-z]$/.test(letter)) return null;
  // caseType is in the key alongside the literal character so lowercase `c`
  // and uppercase `C` can never share a budget.
  return `${studentKey}::${caseType}::${letter}::${date ?? currentPracticeDate()}`;
}

/**
 * Records that one COMPLETED cycle just finished for this letter.
 *
 * @param {{
 *   studentId, letter, caseType, interactionId,
 *   serverCyclesToday?: number|null,   // from the response's cycle_usage
 * }} args
 * @returns {number} cycles now used for this letter today, as best known.
 */
export function recordCycleCompleted({
  studentId, letter, caseType, interactionId, serverCyclesToday = null,
}) {
  const key = makeKey({ studentId, letter, caseType, interactionId });
  if (!key) return 0;

  const local = (cycleCounts.get(key) ?? 0) + 1;
  // The server counts the whole practice date, this counts the interaction.
  // Whichever saw more is the truth; a missing/failed server read never
  // lowers the count.
  const known = Number.isInteger(serverCyclesToday) && serverCyclesToday > local
    ? serverCyclesToday
    : local;

  cycleCounts.set(key, known);
  return known;
}

/**
 * @returns {number} cycles already used for this letter in this interaction.
 */
export function getCyclesUsed({ studentId, letter, caseType, interactionId }) {
  const key = makeKey({ studentId, letter, caseType, interactionId });
  return key ? (cycleCounts.get(key) ?? 0) : 0;
}

/**
 * The question the failure branch asks: may this letter have another cycle?
 *
 * @returns {boolean} false once the ceiling is reached. Invalid input answers
 *   true, so a malformed key can never trap a child on a letter with no way
 *   forward — the screen's own sequence advance still applies.
 */
export function canStartAnotherCycle({ studentId, letter, caseType, interactionId }) {
  const key = makeKey({ studentId, letter, caseType, interactionId });
  if (!key) return true;
  return (cycleCounts.get(key) ?? 0) < MAX_CYCLES_PER_LETTER_PER_DATE;
}

/** Test/support helper — clears the interaction-scoped counters. */
export function resetLetterCycleGuard() {
  cycleCounts.clear();
}
