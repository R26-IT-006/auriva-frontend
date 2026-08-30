/**
 * worksheetLabels.js
 *
 * THE SINGLE SOURCE of every teacher-facing homework-worksheet label.
 *
 * Deliberately dependency-free (no api/client, no react-native, no ENDPOINTS)
 * so it can be imported by the RN screens AND by the pure PDF builders, which
 * must stay unit-testable without an RN environment — the same discipline
 * letterMotorPatternLabels.js already follows.
 *
 * ── Why one module ────────────────────────────────────────────────────────
 * The same worksheet appears on TeacherReportScreen, in PeriodicReportSection
 * and in the exported PDF. Wording drifting between those three is exactly the
 * class of bug this project has already had to fix twice, so every visible
 * string lives here once.
 *
 * ── Vocabulary rules ──────────────────────────────────────────────────────
 * A worksheet is teacher-directed SUPPORT MATERIAL. Nothing here may read as a
 * grade, a pass/fail, a severity, or a developmental level. In particular
 * there is deliberately no "Failed" review outcome: a returned worksheet is
 * practice evidence a teacher reads, not something a child passes.
 */

'use strict';

// ─── Worksheet lifecycle ────────────────────────────────────────────────────
// Mirrors the backend's own status vocabulary exactly.
export const WORKSHEET_STATUS_LABELS = Object.freeze({
  generated: 'Generated',
  assigned:  'Assigned',
  submitted: 'Submitted',
  reviewed:  'Reviewed',
  archived:  'Archived',
});

// ─── Review outcomes ────────────────────────────────────────────────────────
// The teacher's own reading of a returned page. Neutral, actionable, never a
// verdict on the child.
export const REVIEW_STATUS_LABELS = Object.freeze({
  pending_review:      'Pending review',
  reviewed:            'Completed satisfactorily',
  needs_more_practice: 'Continue practice',
});

/**
 * The three options a teacher picks from when reviewing a returned worksheet.
 *
 * "Discuss in next session" deliberately maps to the SAME stored status as
 * "Continue practice": both mean the letter is still being worked on, and the
 * distinction the teacher wants to record is carried by their comment. Adding
 * a third stored status would imply a distinction the backend does not model.
 */
export const REVIEW_OPTIONS = Object.freeze([
  { key: 'completed',  label: 'Completed satisfactorily', status: 'reviewed' },
  { key: 'continue',   label: 'Continue practice',        status: 'needs_more_practice' },
  { key: 'discuss',    label: 'Discuss in next session',  status: 'needs_more_practice' },
]);

export const INTENSITY_LABELS = Object.freeze({
  standard: 'Standard Practice',
  extended: 'Extended Practice',
});

export const INTENSITY_OPTIONS = Object.freeze([
  { key: 'standard', label: 'Standard Practice' },
  { key: 'extended', label: 'Extended Practice' },
]);

// ─── Empty states ───────────────────────────────────────────────────────────
// Each says which specific thing is absent. "No worksheet recommended" and
// "no worksheet assigned yet" are different facts and must never collapse into
// one message.
export const EMPTY_NO_RECOMMENDATION =
  'No homework worksheet is currently recommended.';
export const EMPTY_NO_HISTORY =
  'No homework worksheets have been assigned yet.';
export const EMPTY_NO_SUBMISSION =
  'No completed worksheet has been uploaded yet.';
export const EMPTY_NO_PERIOD_ACTIVITY =
  'No homework worksheets were assigned during this period.';
export const PENDING_REVIEW_TEXT =
  'Submitted — awaiting teacher review.';
export const ALREADY_ASSIGNED_TEXT =
  'An active worksheet already exists for this letter.';
export const UNMAPPED_LETTER_TEXT =
  'Practice shapes for this letter are not set up yet. Please choose another letter.';

// The practice progression, in the child's order. Shown to the teacher so they
// can see what the page will actually contain before generating it.
export const PRACTICE_SEQUENCE_TEXT =
  'Motor warm-up → Letter tracing → Copying → Independent writing';

export const WORKSHEET_SUPPORTING_TEXT =
  'Homework worksheets are additional teacher-directed practice. They do not '
  + 'change a letter’s mastery, scores, or the child’s practice sequence.';

/** @returns {string} a teacher-safe status label; never a raw code. */
export function getWorksheetStatusLabel(status) {
  return WORKSHEET_STATUS_LABELS[status] ?? 'Not available';
}

/** @returns {string} a teacher-safe review label; never a raw code. */
export function getReviewStatusLabel(reviewStatus) {
  return REVIEW_STATUS_LABELS[reviewStatus] ?? 'Not available';
}

export function getIntensityLabel(intensity) {
  return INTENSITY_LABELS[intensity] ?? 'Standard Practice';
}

/**
 * The single status line for one worksheet, combining its lifecycle status
 * with its latest review outcome where one exists.
 *
 * ONE line per worksheet — never a separate timeline entry per state change,
 * which would show the same worksheet three times in a history list.
 *
 * @param {{status: string, submissions?: Array<{review_status: string}>}} worksheet
 * @returns {string}
 */
export function getWorksheetStatusLine(worksheet) {
  if (!worksheet) return 'Not available';
  const latest = Array.isArray(worksheet.submissions) && worksheet.submissions.length > 0
    ? worksheet.submissions[0]
    : null;

  if (worksheet.status === 'reviewed' && latest) {
    return `Reviewed — ${getReviewStatusLabel(latest.review_status)}`;
  }
  if (worksheet.status === 'submitted') {
    return 'Submitted — Pending review';
  }
  return getWorksheetStatusLabel(worksheet.status);
}

/** dd MMM yyyy, or '' when absent — never 'Invalid Date' or 'null'. */
export function formatWorksheetDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A short, teacher-friendly description of the motor preparation a worksheet
 * will rehearse, built from the backend's own plan.
 *
 * Reads the plan's labels verbatim — it never re-derives which shapes a letter
 * needs, and never exposes a raw shape id.
 *
 * @param {{warmUp?: Array<{label: string}>}|null} plan
 * @returns {string}
 */
export function describeMotorPreparation(plan) {
  const labels = (plan?.warmUp ?? []).map((w) => w?.label).filter(Boolean);
  if (labels.length === 0) return 'Not available';
  return labels.join(' · ');
}

// ─── Exact-letter home practice (two failed cycles on one practice date) ──
// A SECOND recommendation source alongside the family-level persistent
// difficulty one. Teacher-facing wording only: it never mentions cycles,
// thresholds, scores or any internal identifier - just the letter, whether it
// is mastered yet, and what to do.

export const CANDIDATE_SOURCE_TWO_CYCLE = 'two_cycle_failure';
// The cap became three cycles when mastery moved to attempt-3-only (see
// backend config/masteryPolicy.js). New candidates carry this source; the
// old one above is still emitted by NOTHING but still present on every
// worksheet row created before the change, so both must be recognised.
export const CANDIDATE_SOURCE_THREE_CYCLE = 'three_cycle_failure';
export const EXACT_LETTER_CANDIDATE_SOURCES = [
  CANDIDATE_SOURCE_THREE_CYCLE,
  CANDIDATE_SOURCE_TWO_CYCLE,
];

export const TWO_CYCLE_SECTION_LABEL = 'Additional Home Practice';
export const TWO_CYCLE_STATUS_LABEL  = 'Not yet mastered';
export const TWO_CYCLE_DEFER_LABEL   = 'Not Now';

/** @returns {boolean} true for the exact-letter home-practice candidate. */
export function isTwoCycleCandidate(recommendation) {
  // Accepts the historical source too — a teacher looking at a
  // recommendation issued before the three-cycle policy must still see it
  // rendered as an exact-letter home-practice card, not fall through to the
  // generic "Homework Recommendation" branch.
  return EXACT_LETTER_CANDIDATE_SOURCES.includes(recommendation?.source);
}
