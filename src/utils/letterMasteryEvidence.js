/**
 * letterMasteryEvidence.js
 *
 * The child's actual writing from the attempt that mastered a letter.
 *
 * ── Why Letter Details showed nothing ────────────────────────────────────
 * The teacher report's Letter Details panel said "No writing evidence
 * available yet" for every letter, including mastered ones. The strokes were
 * never missing — LetterAttempt.stroke_points has held them all along — but
 * the report's payload deliberately excludes trajectories (52 letters' worth
 * of raw points is not something to send for a panel opened one letter at a
 * time), and nothing recorded WHICH attempt established mastery.
 *
 * So the panel had neither the strokes nor a defensible way to choose them.
 *
 * ── Fetched only when the panel opens ────────────────────────────────────
 * One letter, one case, one attempt. Nothing here is added to the bulk report.
 *
 * ── Never a guess ────────────────────────────────────────────────────────
 * The server answers with a `status`, and only 'available' carries strokes.
 * The other statuses are real answers, not failures: a letter mastered before
 * the attempt link existed genuinely cannot be attributed, and saying so is
 * the point. Nothing in this module or behind it falls back to the best or
 * most recent attempt.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

/** Statuses the server can return. Mirrors EVIDENCE_STATUS on the backend. */
export const EVIDENCE_STATUS = Object.freeze({
  AVAILABLE:    'available',
  NOT_MASTERED: 'not_mastered',
  UNLINKED:     'unlinked',
  ATTEMPT_GONE: 'attempt_missing',
  NO_STROKES:   'no_strokes',
  READ_FAILED:  'read_failed',   // client-side only: the request never landed
});

/**
 * What the teacher is told when there is no drawing to show.
 *
 * Each case says something different and true. None of them implies the child
 * did not master the letter, and none implies a drawing exists that we are
 * withholding.
 */
export function evidenceUnavailableMessage(status) {
  switch (status) {
    case EVIDENCE_STATUS.UNLINKED:
      return 'Mastery writing evidence unavailable for this earlier record.';
    case EVIDENCE_STATUS.NO_STROKES:
    case EVIDENCE_STATUS.ATTEMPT_GONE:
      return 'The mastery attempt for this letter has no saved writing.';
    case EVIDENCE_STATUS.READ_FAILED:
      return 'Could not load writing evidence. Check the connection and reopen.';
    case EVIDENCE_STATUS.NOT_MASTERED:
    default:
      return 'No writing evidence available yet.';
  }
}

/**
 * The case a letter is written in, from the letter itself.
 *
 * The report keys letters by the exact character practised — 's' and 'S' are
 * separate entries — so the case is already encoded and needs no extra field.
 * Getting this wrong would show uppercase strokes under a lowercase letter,
 * which is why it is one function with one rule rather than an inline guess.
 *
 * @returns {'lowercase'|'uppercase'|null} null for anything not A-Z or a-z.
 */
export function caseTypeForLetter(letter) {
  const ch = String(letter ?? '').trim();
  if (!/^[A-Za-z]$/.test(ch)) return null;
  return ch === ch.toUpperCase() ? 'uppercase' : 'lowercase';
}

/**
 * One letter's mastery writing evidence.
 *
 * Never throws — a failed request resolves to READ_FAILED, so the panel shows
 * an honest message instead of an error boundary.
 *
 * @returns {Promise<{status: string, evidence: Object|null}>}
 */
export async function fetchLetterMasteryEvidence(studentId, letter) {
  const caseType = caseTypeForLetter(letter);
  const sid = Number(studentId);
  if (!caseType || !Number.isInteger(sid) || sid <= 0) {
    return { status: EVIDENCE_STATUS.NOT_MASTERED, evidence: null };
  }
  try {
    const response = await client.get(
      ENDPOINTS.LETTER_MASTERY_EVIDENCE(sid, letter, caseType),
    );
    const status = response?.data?.status;
    const evidence = response?.data?.evidence ?? null;
    // A body without a recognised status is not evidence, whatever else it
    // holds — treat it as a failed read rather than rendering an unknown shape.
    if (!status || (status === EVIDENCE_STATUS.AVAILABLE && !evidence)) {
      return { status: EVIDENCE_STATUS.READ_FAILED, evidence: null };
    }
    return { status, evidence: status === EVIDENCE_STATUS.AVAILABLE ? evidence : null };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[letterMasteryEvidence] fetch failed:', err?.message ?? err);
    }
    return { status: EVIDENCE_STATUS.READ_FAILED, evidence: null };
  }
}

/**
 * The caption under the drawing: which attempt this was, and how it scored.
 *
 * The attempt number comes from the stored row, not from the policy constant —
 * if a row ever carried something else, the teacher sees what is true rather
 * than what was assumed. Cycle is deliberately absent: LetterAttempt does not
 * persist one, so there is nothing honest to print.
 */
export function evidenceCaption(evidence) {
  if (!evidence) return '';
  const attempt = Number(evidence.attempt_number);
  const parts = [];
  parts.push(Number.isFinite(attempt) ? `Mastery attempt · Attempt ${attempt}` : 'Mastery attempt');
  // `evidence.score == null` first: Number(null) is 0, which is finite, so a
  // missing score would otherwise print "Score 0%" — a wrong number, not a
  // missing one.
  const score = evidence.score == null ? NaN : Number(evidence.score);
  if (Number.isFinite(score)) parts.push(`Score ${Math.round(score)}%`);
  return parts.join('  ·  ');
}
