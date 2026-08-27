/**
 * writingModuleSummary.js
 *
 * The Student Profile -> Module Progress -> WRITING tab summary.
 *
 * A compact overview only. Everything detailed — motor performance charts,
 * the initial shape assessment, difficulty analysis, Writing Check history,
 * per-letter history, worksheet history, periodic charts — stays in the
 * dedicated Writing Progress Report, which this tab links to.
 *
 * ── Why a separate pure module ───────────────────────────────────────────
 * The counting and locking RULES matter more than the layout, and RN screens
 * do not render under this project's minimal jest config. Keeping the rules
 * here means they are directly unit-testable rather than only assertable as
 * source text.
 *
 * ── Mastery semantics ────────────────────────────────────────────────────
 * "Mastered" means LetterProgress.mastered_at IS NOT NULL, never row
 * existence. This module never counts rows itself — it reads the two
 * backend counts that already apply that rule
 * (handwritingController's lowercase_completed / uppercase_completed, which
 * both filter mastered_at != null). A letter that was practised and failed
 * therefore never inflates this summary.
 *
 * ── Totals ───────────────────────────────────────────────────────────────
 * 52 letter FORMS: 26 lowercase + 26 uppercase, counted independently
 * (lowercase 'c' and uppercase 'C' are two forms, as everywhere else in this
 * codebase). Words are a separate module and are NEVER folded into the
 * 52-letter percentage.
 */

'use strict';

import {
  isWordsUnlocked, REQUIRED_LOWERCASE_COUNT, REQUIRED_UPPERCASE_COUNT,
} from './wordUnlockGate';

export const TOTAL_LOWERCASE = REQUIRED_LOWERCASE_COUNT;   // 26
export const TOTAL_UPPERCASE = REQUIRED_UPPERCASE_COUNT;   // 26
export const TOTAL_LETTER_FORMS = TOTAL_LOWERCASE + TOTAL_UPPERCASE; // 52

/** Teacher-facing Writing Check wording. Never a cluster id, never good/bad. */
export const WRITING_PATTERN_LABEL = {
  A:        'Pattern A',
  B:        'Pattern B',
  OOD:      'Outside reference range',
  UNKNOWN:  'Not checked yet',
};

const clampCount = (value, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
};

/**
 * Maps a stored Writing Check result to teacher-facing wording.
 *
 * Deliberately tolerant about the shape: the history endpoint has carried
 * several field names over time, and an unrecognised value must degrade to
 * "Not checked yet" rather than leak a raw model label into the UI.
 */
export function toWritingPatternLabel(check) {
  if (!check) return WRITING_PATTERN_LABEL.UNKNOWN;

  const raw = String(
    check.pattern_label ?? check.pattern ?? check.result_label ?? check.result ?? '',
  ).trim().toUpperCase();

  if (raw === 'A' || raw === 'PATTERN A' || raw === 'PATTERN_A') return WRITING_PATTERN_LABEL.A;
  if (raw === 'B' || raw === 'PATTERN B' || raw === 'PATTERN_B') return WRITING_PATTERN_LABEL.B;
  if (raw === 'OOD' || raw === 'OUT_OF_DISTRIBUTION' || raw === 'OUTSIDE_REFERENCE_RANGE') {
    return WRITING_PATTERN_LABEL.OOD;
  }
  return WRITING_PATTERN_LABEL.UNKNOWN;
}

/** The most recent EVALUATED check. An in-progress check is not a result. */
export function latestEvaluatedCheck(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return null;
  const evaluated = checks.filter(
    c => c && (c.status === 'evaluated' || c.evaluated_at != null || c.pattern_label != null),
  );
  const pool = evaluated.length > 0 ? evaluated : [];
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const ta = new Date(a.evaluated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.evaluated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  })[0];
}

/**
 * Builds the summary view-model from already-fetched pieces.
 *
 * Pure: no I/O, no dates, no randomness. Every unavailable input degrades to
 * a neutral empty state rather than a fabricated number — a brand-new child
 * reads 0/52, Locked, Not checked yet, never an error.
 *
 * @param {{
 *   progress?: {lowercase_completed?: number, uppercase_completed?: number}|null,
 *   candidates?: Array|null,
 *   checks?: Array|null,
 * }} parts
 */
export function buildWritingSummary({ progress, candidates, checks } = {}) {
  const lowercaseMastered = clampCount(progress?.lowercase_completed, TOTAL_LOWERCASE);
  const uppercaseMastered = clampCount(progress?.uppercase_completed, TOTAL_UPPERCASE);
  const totalMastered = lowercaseMastered + uppercaseMastered;

  // Words are NOT part of this percentage — they are a separate module.
  const masteredPercent = Math.round((totalMastered / TOTAL_LETTER_FORMS) * 100);

  // The real product rule, shared with the child-facing gate. It reads only
  // the two authoritative counts, so a demo/preview unlock flag can never
  // make Words look genuinely available to a teacher.
  const wordsUnlocked = isWordsUnlocked(lowercaseMastered, uppercaseMastered);

  // Exact-letter home practice. Counted, never listed — the full worksheet
  // history belongs to the report.
  const homePracticeCount = Array.isArray(candidates) ? candidates.length : null;
  const homePracticeLetters = Array.isArray(candidates)
    ? [...new Set(candidates.map(c => c?.suggestedLetter).filter(Boolean))]
    : [];

  return {
    lowercaseMastered,
    uppercaseMastered,
    totalMastered,
    totalLetterForms: TOTAL_LETTER_FORMS,
    masteredPercent,
    lowercasePercent: Math.round((lowercaseMastered / TOTAL_LOWERCASE) * 100),
    uppercasePercent: Math.round((uppercaseMastered / TOTAL_UPPERCASE) * 100),
    wordsUnlocked,
    homePracticeCount,
    homePracticeLetters,
    writingPatternLabel: toWritingPatternLabel(latestEvaluatedCheck(checks)),
  };
}

/**
 * Fetches the three pieces the summary needs, in parallel.
 *
 * Every request is independently fault-tolerant: one failing endpoint
 * degrades its own row to a neutral state and never blanks the whole tab or
 * shows a database error to a teacher.
 */
export async function fetchWritingSummary(studentId) {
  if (!studentId) return { status: 'unavailable', summary: buildWritingSummary({}) };

  // Required lazily, INSIDE the function, so importing this module for its
  // pure rules never drags the HTTP client (and its native/axios deps) into
  // a caller that only needs buildWritingSummary. That is what keeps the
  // counting and locking rules directly unit-testable.
  const client = require('../api/client').default;
  const { ENDPOINTS } = require('../constants/api');

  const safe = async (fn) => { try { return await fn(); } catch { return null; } };

  const [progress, candidates, checks] = await Promise.all([
    safe(async () => (await client.get(ENDPOINTS.LETTER_PROGRESS(studentId))).data),
    safe(async () => (await client.get(ENDPOINTS.WORKSHEET_CANDIDATES(studentId))).data?.candidates ?? null),
    safe(async () => (await client.get(ENDPOINTS.WRITING_CHECK_HISTORY(studentId))).data?.checks ?? null),
  ]);

  return {
    // 'partial' is honest rather than cosmetic: the letter counts are the
    // spine of this summary, so the caller can tell "nothing loaded" from
    // "the optional extras did not load".
    status: progress ? 'ok' : 'partial',
    summary: buildWritingSummary({ progress, candidates, checks }),
  };
}
