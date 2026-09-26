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

// ─── S2 — teacher-facing copy for the four evaluation states ───────────────
//
// Defined once and shared by TeacherReportScreen, PeriodicReportSection and
// the PDF builder, so the three surfaces cannot drift apart in wording.
//
// Deliberately absent from every string below: abnormal, severe, poor,
// failed, deficient, high difficulty, and any third pattern. An
// outside-reference-range result describes the RELATIONSHIP between this
// child's evidence and the pilot reference data — never the child.

export const LETTER_MOTOR_VALUE_NOT_YET_OBSERVED = 'Not yet observed';
export const LETTER_MOTOR_VALUE_NOT_REPORTED = 'Not reported';
export const LETTER_MOTOR_VALUE_UNAVAILABLE = 'Unavailable';

export const LETTER_MOTOR_REFERENCE_STATUS_NOT_YET_OBSERVED = 'Not yet observed';
export const LETTER_MOTOR_REFERENCE_STATUS_WITHIN = 'Within represented reference range';
export const LETTER_MOTOR_REFERENCE_STATUS_OUTSIDE = 'Outside represented reference range';

export const LETTER_MOTOR_NOT_REACHED_TEXT =
  'More eligible handwriting evidence is needed before a writing pattern can be described.';

export const LETTER_MOTOR_ASSIGNED_TEXT =
  'Writing patterns describe movement characteristics only and do not indicate ability, '
  + 'ASD severity, or improvement.';

export const LETTER_MOTOR_OUTSIDE_RANGE_TEXT =
  'The available handwriting evidence differs from the data represented by the current '
  + 'pattern model, so no writing pattern was assigned.';

export const LETTER_MOTOR_UNAVAILABLE_TEXT =
  'Writing pattern information could not be evaluated at this time.';

/**
 * Builds the "Recorded from N of the M required reference letters." line.
 * Returns null when the server sent no progress figures — never a
 * fabricated "0 of null".
 *
 * @param {{evidence_letters?: number, first_milestone_required?: number}|null} referenceProgress
 * @returns {string|null}
 */
export function buildReferenceProgressText(referenceProgress) {
  if (!referenceProgress) return null;
  const { evidence_letters: recorded, first_milestone_required: required } = referenceProgress;
  if (typeof recorded !== 'number' || typeof required !== 'number') return null;
  return `Recorded from ${recorded} of the ${required} required reference letters.`;
}

/**
 * The complete teacher-facing presentation for one evaluation state.
 * Every surface renders these exact strings.
 *
 * @param {'assigned'|'outside_reference_range'|'not_reached'|'unavailable'} evaluationStatus
 * @param {{stateCode?: *}} [options]
 * @returns {{patternValue: string, referenceStatus: string, supportingText: string}}
 */
export function getLetterMotorPresentation(evaluationStatus, { stateCode = null } = {}) {
  if (evaluationStatus === 'assigned') {
    return {
      patternValue: getLetterMotorPatternLabel(stateCode),
      referenceStatus: LETTER_MOTOR_REFERENCE_STATUS_WITHIN,
      supportingText: LETTER_MOTOR_ASSIGNED_TEXT,
    };
  }
  if (evaluationStatus === 'outside_reference_range') {
    return {
      patternValue: LETTER_MOTOR_VALUE_NOT_REPORTED,
      referenceStatus: LETTER_MOTOR_REFERENCE_STATUS_OUTSIDE,
      supportingText: LETTER_MOTOR_OUTSIDE_RANGE_TEXT,
    };
  }
  if (evaluationStatus === 'unavailable') {
    return {
      patternValue: LETTER_MOTOR_VALUE_UNAVAILABLE,
      referenceStatus: LETTER_MOTOR_VALUE_UNAVAILABLE,
      supportingText: LETTER_MOTOR_UNAVAILABLE_TEXT,
    };
  }
  return {
    patternValue: LETTER_MOTOR_VALUE_NOT_YET_OBSERVED,
    referenceStatus: LETTER_MOTOR_REFERENCE_STATUS_NOT_YET_OBSERVED,
    supportingText: LETTER_MOTOR_NOT_REACHED_TEXT,
  };
}

/**
 * @param {*} stateCode — a persisted state_code, or anything at all.
 * @returns {string} a teacher-safe visible label. Never returns a raw code.
 */
export function getLetterMotorPatternLabel(stateCode) {
  if (typeof stateCode !== 'string') return LETTER_MOTOR_PATTERN_FALLBACK;
  return LETTER_MOTOR_PATTERN_LABELS[stateCode] ?? LETTER_MOTOR_PATTERN_FALLBACK;
}

/**
 * Teacher-facing presentation for ONE Writing Check history entry.
 *
 * Patterns are NOMINAL. This never compares two checks, never orders them, and
 * never emits improvement/decline language — A -> B and B -> A both read as two
 * independent observations.
 *
 * @param {{evaluation_status: string|null, state_code: string|null, status: string}} check
 * @returns {{patternValue: string, referenceStatus: string}}
 */
export function getWritingCheckPresentation(check) {
  if (!check) return { patternValue: 'Not reported', referenceStatus: 'Not available' };

  if (check.evaluation_status === 'outside_reference_range') {
    return { patternValue: 'Not reported', referenceStatus: 'Outside represented reference range' };
  }
  if (check.evaluation_status === 'assigned') {
    const labels = {
      LETTER_STATE_A: 'Letter Motor Pattern A',
      LETTER_STATE_B: 'Letter Motor Pattern B',
    };
    return {
      patternValue: labels[check.state_code] ?? 'Letter Motor Pattern',
      referenceStatus: 'Within represented reference range',
    };
  }
  if (check.status === 'in_progress') {
    return { patternValue: 'Not finished', referenceStatus: 'Writing Check not completed' };
  }
  return { patternValue: 'Not reported', referenceStatus: 'Not available' };
}
