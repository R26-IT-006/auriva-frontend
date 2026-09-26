/**
 * worksheetRecommendations.js
 *
 * Feature 8 Step 4 — Teacher Frontend Integration.
 *
 * Thin, impure fetch wrapper around
 * GET /handwriting/worksheet-recommendations/:studentId (Feature 8 Step 3),
 * plus a handful of PURE presentation helpers the Teacher Report screen
 * uses to render Feature 8's response. Mirrors every prior feature's own
 * fetch-wrapper shape (supportRecommendation.js/repetitionRecommendation.js/
 * demoSpeedRecommendation.js) — same "never throws, always resolves to a
 * safe value" contract.
 *
 * ── Backend remains the sole content authority (Step 4 spec §9/§26) ──────
 * This file never recomputes, rephrases, or invents recommendation
 * content — `title`/`rationale`/`suggestedActivities`/`focusLetters` are
 * always exactly whatever the backend sent (after defensive type-safety
 * only, never reordering or reinterpreting). No straight/curved/complex
 * activity text is hardcoded here.
 *
 * ── Feature 9 Step 5: recommendationFingerprint pass-through ─────────────
 * Each recommendation may also carry a `recommendationFingerprint` (an
 * opaque 64-char lowercase hex value, Step 5 spec §2/§11) — this file only
 * validates its shape and passes it through unchanged. It is NEVER
 * computed here (fingerprint computation is exclusively a backend,
 * `feature9Provenance.js`-owned concern) and NEVER rendered to the teacher
 * — it exists in the normalized object purely so the caller can echo it
 * back when submitting a teacher validation (Step 5 spec §63).
 *
 * Contract: `fetchWorksheetRecommendations()` NEVER throws and NEVER
 * surfaces a child- or teacher-facing crash. Every failure mode — network
 * error, timeout, 404, 500, or a malformed/partial response body —
 * resolves to `{status: 'read_failed', recommendations: [], summary: null}`,
 * exactly matching what a real backend `read_failed` response already
 * means to the UI: "could not be loaded" (Step 4 spec §22) — distinct from
 * `{status: 'evaluated', recommendations: []}`, which means "loaded
 * successfully, nothing to recommend right now."
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE_RESULT = Object.freeze({
  status: 'read_failed',
  recommendations: [],
  summary: null,
});

/**
 * Defensively normalizes one raw recommendation object. Never re-sorts
 * `focusLetters`/`suggestedActivities` — only guards against a
 * non-string/non-array shape so a malformed field can never crash a render
 * (Step 4 spec §6 of the fetch-utility test list: "malformed response").
 *
 * @param {*} raw
 * @returns {{
 *   recommendationType: string|null, caseType: string|null, family: string|null,
 *   title: string, focusLetters: string[], rationale: string, suggestedActivities: string[],
 * }|null} `null` when `raw` isn't even an object — filtered out by the caller.
 */
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function normalizeRecommendation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { recommendationType, caseType, family, title, focusLetters, rationale, suggestedActivities, recommendationFingerprint } = raw;
  return {
    recommendationType: typeof recommendationType === 'string' ? recommendationType : null,
    caseType: typeof caseType === 'string' ? caseType : null,
    family: typeof family === 'string' ? family : null,
    title: typeof title === 'string' ? title : '',
    // Order preserved EXACTLY (never re-sorted) — only non-string entries
    // are dropped defensively.
    focusLetters: Array.isArray(focusLetters) ? focusLetters.filter((l) => typeof l === 'string') : [],
    rationale: typeof rationale === 'string' ? rationale : '',
    suggestedActivities: Array.isArray(suggestedActivities) ? suggestedActivities.filter((a) => typeof a === 'string') : [],
    // Feature 9 Step 5 — opaque pass-through only, never displayed, never
    // recomputed. `null` for anything not shaped like a real fingerprint,
    // so a malformed/missing value can never be silently echoed back to
    // the backend as if it were trustworthy.
    recommendationFingerprint: typeof recommendationFingerprint === 'string' && FINGERPRINT_PATTERN.test(recommendationFingerprint)
      ? recommendationFingerprint
      : null,
  };
}

function normalizeSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  return {
    evaluatedStreamCount: num(raw.evaluatedStreamCount, 0),
    persistentStreamCount: num(raw.persistentStreamCount, 0),
    notPersistentCount: num(raw.notPersistentCount, 0),
    insufficientDataCount: num(raw.insufficientDataCount, 0),
    recommendationCount: num(raw.recommendationCount, 0),
  };
}

/**
 * Normalizes a raw HTTP response body into a trustworthy shape. Pure (no
 * I/O) — separated from the fetch itself purely so malformed-shape
 * handling is independently unit-testable without mocking the network.
 *
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'evaluated'|'read_failed'|'invalid_input', recommendations: Array<Object>, summary: Object|null}}
 */
export function normalizeWorksheetRecommendationsResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE_RESULT };

  if (data.status === 'read_failed') {
    return { status: 'read_failed', recommendations: [], summary: null };
  }
  if (data.status === 'invalid_input') {
    return { status: 'invalid_input', recommendations: [], summary: null };
  }
  if (data.status !== 'evaluated') {
    // Any other/unrecognized status is treated the same as a failed read —
    // never guessed as "evaluated, nothing found" (Step 3's own "read
    // failure ≠ zero recommendations" distinction, preserved here).
    return { ...FAILSAFE_RESULT };
  }

  const recommendations = Array.isArray(data.recommendations)
    ? data.recommendations.map(normalizeRecommendation).filter(Boolean)
    : [];

  return { status: 'evaluated', recommendations, summary: normalizeSummary(data.summary) };
}

/**
 * @param {{studentId: number}} params
 * @returns {Promise<ReturnType<typeof normalizeWorksheetRecommendationsResponse>>}
 */
export async function fetchWorksheetRecommendations({ studentId } = {}) {
  try {
    const response = await client.get(ENDPOINTS.WORKSHEET_RECOMMENDATIONS(studentId));
    return normalizeWorksheetRecommendationsResponse(response?.data);
  } catch (err) {
    // Development-only diagnostic — never surfaced to the teacher as a
    // crash, never blocks the rest of the report. `typeof __DEV__ !==
    // 'undefined'` guard: this file runs under plain Jest (no Metro/Expo
    // runtime defining that global) as well as the real app.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[WorksheetRecommendations] fetch failed — treating as read_failed:', err?.message ?? err);
    }
    return { ...FAILSAFE_RESULT };
  }
}

// ─── Pure presentation helpers ──────────────────────────────────────────────
//
// Extracted so the Teacher Report screen's own render logic stays simple —
// same "extract the smallest pure decision piece, test it directly" pattern
// every prior feature's own frontend activation step already used (this
// project has no RN component-testing infrastructure, so these are the
// actually-testable surface, per Step 4 spec §40).

/**
 * @param {'lowercase'|'uppercase'|*} caseType
 * @returns {string} teacher-friendly label, or '' for anything unrecognized
 *   (never a guessed label).
 */
export function formatCaseType(caseType) {
  if (caseType === 'lowercase') return 'Lowercase';
  if (caseType === 'uppercase') return 'Uppercase';
  return '';
}

/**
 * @param {*} focusLetters
 * @returns {boolean} true only for a non-empty array — an empty/missing
 *   focus-letter list should never render an empty "Focus letters:" row
 *   (Step 4 spec §13).
 */
export function shouldShowFocusLetters(focusLetters) {
  return Array.isArray(focusLetters) && focusLetters.length > 0;
}

// Teacher-facing copy — deliberately free of algorithm/threshold/severity
// language (Step 4 spec §5/§19/§20/§21).
const EMPTY_STATE_INSUFFICIENT_DATA =
  'More practice history is needed before an adaptive practice recommendation can be generated.';
const EMPTY_STATE_NOT_PERSISTENT =
  'No persistent handwriting difficulty currently requires an additional practice recommendation.';
const EMPTY_STATE_GENERIC =
  'No additional adaptive practice recommendation is available at this time.';
// Both conditions are true at once across the six evaluated streams. Saying
// only "more practice history is needed" would misdescribe the streams that
// WERE fully evaluated and simply produced no recommendation. Neutral in
// both directions — it reports what was and was not evaluated, and claims
// nothing about difficulty, improvement or trajectory beyond that.
const EMPTY_STATE_MIXED =
  'Some handwriting areas were reviewed and did not require an additional practice '
  + 'recommendation. Others need more practice history before they can be reviewed.';

/**
 * Resolves the teacher-facing empty-state message for a successfully
 * `evaluated` result with zero recommendations. Never called for
 * `read_failed`/`invalid_input` (those get their own distinct error
 * message, Step 4 spec §22) — this helper is specifically for
 * "evaluated, nothing to recommend right now," choosing the most
 * conservative/informative wording available from `summary` (Step 4 spec
 * §41): insufficient evidence is checked first (the most common and most
 * actionable-to-explain case), then not-persistent, then a generic
 * fallback for any other/malformed shape.
 *
 * @param {{insufficientDataCount?: number, notPersistentCount?: number}|null|undefined} summary
 * @returns {string}
 */
export function getWorksheetRecommendationEmptyState(summary) {
  if (!summary || typeof summary !== 'object') return EMPTY_STATE_GENERIC;
  const insufficient = summary.insufficientDataCount ?? 0;
  const notPersistent = summary.notPersistentCount ?? 0;
  // Mixed state is checked FIRST — previously any insufficient stream at all
  // made the whole result read as "insufficient data", even when five of the
  // six streams had been fully evaluated.
  if (insufficient > 0 && notPersistent > 0) return EMPTY_STATE_MIXED;
  if (insufficient > 0) return EMPTY_STATE_INSUFFICIENT_DATA;
  if (notPersistent > 0) return EMPTY_STATE_NOT_PERSISTENT;
  return EMPTY_STATE_GENERIC;
}
