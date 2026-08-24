/**
 * letterMotorPatternLabels.js
 *
 * THE SINGLE SOURCE of every teacher-facing letter-motor pattern label.
 *
 * Deliberately dependency-free (no api/client, no react-native, no ENDPOINTS)
 * so it can be imported by both the RN screens AND the pure PDF builder
 * (periodicReportPdf.js, which must stay directly unit-testable without an
 * RN environment). letterMotorState.js re-exports these so existing callers
 * keep one import site.
 *
 * ── Why the visible label is derived from state_code ──────────────────────
 * Teacher-facing surfaces must NEVER render the persisted `display_name`.
 * Historical letter_motor_state_history rows legitimately contain legacy
 * values ("Letter Motor State A"/"Letter Motor State B") and those stored
 * values are intentionally left unmodified, so rendering them directly would
 * show two different names for the same thing depending on when the row was
 * written. Mapping from the stable `state_code` instead keeps every surface
 * consistent without rewriting any history.
 *
 * ── Naming rules ──────────────────────────────────────────────────────────
 * Pattern A and Pattern B are NOMINAL categories describing different
 * observed handwriting-performance patterns. Neither represents
 * better/worse, earlier/later, severity, development, progression, or a
 * diagnostic category. Never map a state code to any such language here or
 * anywhere downstream.
 *
 * A raw internal code ("LETTER_STATE_A") must never reach a teacher, so an
 * unknown or missing code falls back to the neutral generic label rather
 * than being printed verbatim.
 */

'use strict';

export const LETTER_MOTOR_PATTERN_LABELS = Object.freeze({
  LETTER_STATE_A: 'Letter Motor Pattern A',
  LETTER_STATE_B: 'Letter Motor Pattern B',
});

export const LETTER_MOTOR_PATTERN_FALLBACK = 'Letter Motor Pattern';

// Rendered wherever a pattern label appears, so the label can never be read
// as a ranking, a severity level or a developmental stage.
export const LETTER_MOTOR_PATTERN_CAPTION =
  'Pattern labels are descriptive categories and do not indicate severity or progression.';

/**
 * @param {*} stateCode — a persisted state_code, or anything at all.
 * @returns {string} a teacher-safe visible label. Never returns a raw code.
 */
export function getLetterMotorPatternLabel(stateCode) {
  if (typeof stateCode !== 'string') return LETTER_MOTOR_PATTERN_FALLBACK;
  return LETTER_MOTOR_PATTERN_LABELS[stateCode] ?? LETTER_MOTOR_PATTERN_FALLBACK;
}
