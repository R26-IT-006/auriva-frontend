/**
 * teacherRecommendationValidations.js
 *
 * Feature 9 Step 5 — Teacher Review Frontend Utility.
 *
 * Thin, impure fetch/submit wrappers around the three Feature 9 Step 4
 * endpoints, plus PURE presentation helpers the Teacher Report screen's
 * Teacher Review UI uses. Mirrors worksheetRecommendations.js's own
 * established shape (Feature 8 Step 4) — same "never throws, always
 * resolves to a safe value" contract for every fetch/submit function here.
 *
 * ── Fingerprint discipline (Step 5 spec §2/§19/§63) ─────────────────────
 * This file NEVER computes a recommendationFingerprint — it only ever
 * accepts one already produced by the backend (via
 * worksheetRecommendations.js's own pass-through) and echoes it back
 * verbatim on submit/current-state lookups. It is never logged, never
 * rendered, never stored outside the in-memory recommendation object the
 * caller already holds.
 *
 * ── No automatic writes (Step 5 spec §61) ───────────────────────────────
 * `submitTeacherRecommendationValidation()` is the ONLY function in this
 * file that writes anything — it must only ever be called from an explicit
 * button press. `fetchTeacherRecommendationValidationHistory()` and
 * `fetchTeacherRecommendationValidationState()` are both pure GET reads.
 *
 * ── teacherId exclusion (Step 5 spec §62) ───────────────────────────────
 * The submit body never includes a teacherId/teacher_id field — identity
 * is entirely the authenticated backend's responsibility (the JWT
 * `Authorization` header client.js already attaches to every request).
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

// Mirrors src/models/TeacherRecommendationValidation.js's
// MAX_TEACHER_NOTE_LENGTH on the backend (Step 5 spec §33) — the frontend
// cannot import backend code, so this is a presentation-layer constant
// referencing that same API contract value. The backend independently
// enforces its own bound regardless of what this constant is set to; this
// exists only so the TextInput's own maxLength matches what the backend
// will actually accept, avoiding a confusing "note too long" rejection
// after the teacher has already typed past a silently-different frontend
// limit.
export const TEACHER_NOTE_MAX_LENGTH = 2000;

const VALID_VALIDATIONS = ['confirmed', 'dismissed'];

const HISTORY_FAILSAFE = Object.freeze({ status: 'read_failed', events: [], latestByStream: {} });
const STATE_FAILSAFE = Object.freeze({ status: 'read_failed', current: null });

function devLog(label, err) {
  // `typeof __DEV__ !== 'undefined'` guard: this file runs under plain
  // Jest (no Metro/Expo runtime defining that global) as well as the real
  // app — matches worksheetRecommendations.js's own precedent exactly.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[TeacherRecommendationValidations] ${label}:`, err?.message ?? err);
  }
}

// ─── Pure normalization ──────────────────────────────────────────────────

function normalizeHistoryEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw.recommendation && typeof raw.recommendation === 'object' ? raw.recommendation : {};
  return {
    id: raw.id ?? null,
    caseType: typeof raw.caseType === 'string' ? raw.caseType : null,
    family: typeof raw.family === 'string' ? raw.family : null,
    recommendation: {
      type: typeof rec.type === 'string' ? rec.type : null,
      title: typeof rec.title === 'string' ? rec.title : '',
      // Order preserved exactly — never re-sorted.
      focusLetters: Array.isArray(rec.focusLetters) ? rec.focusLetters.filter((l) => typeof l === 'string') : [],
    },
    validation: VALID_VALIDATIONS.includes(raw.validation) ? raw.validation : null,
    teacherNote: typeof raw.teacherNote === 'string' ? raw.teacherNote : null,
    validatedAt: typeof raw.validatedAt === 'string' ? raw.validatedAt : null,
  };
}

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'evaluated'|'read_failed'|'invalid_input', events: Array<Object>, latestByStream: Object}}
 */
export function normalizeTeacherValidationHistoryResponse(data) {
  if (!data || typeof data !== 'object') return { ...HISTORY_FAILSAFE };
  if (data.status === 'invalid_input') return { status: 'invalid_input', events: [], latestByStream: {} };
  if (data.status !== 'evaluated') return { ...HISTORY_FAILSAFE };

  // Events are NEVER re-sorted here — the backend already returns
  // newest-first (created_at DESC, id DESC); this file only filters out
  // malformed entries defensively.
  const events = Array.isArray(data.events) ? data.events.map(normalizeHistoryEvent).filter(Boolean) : [];
  const latestByStream = data.latestByStream && typeof data.latestByStream === 'object' ? data.latestByStream : {};
  return { status: 'evaluated', events, latestByStream };
}

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'evaluated'|'read_failed'|'invalid_input', current: {validation:string, teacherNote:string|null, validatedAt:string}|null}}
 */
export function normalizeCurrentValidationStateResponse(data) {
  if (!data || typeof data !== 'object') return { ...STATE_FAILSAFE };
  if (data.status === 'invalid_input') return { status: 'invalid_input', current: null };
  if (data.status !== 'evaluated') return { ...STATE_FAILSAFE };

  if (!data.current || typeof data.current !== 'object') return { status: 'evaluated', current: null };
  const { validation, teacherNote, validatedAt } = data.current;
  return {
    status: 'evaluated',
    current: {
      validation: VALID_VALIDATIONS.includes(validation) ? validation : null,
      teacherNote: typeof teacherNote === 'string' ? teacherNote : null,
      validatedAt: typeof validatedAt === 'string' ? validatedAt : null,
    },
  };
}

// ─── Fetch/submit (impure) ───────────────────────────────────────────────

/**
 * Fetches this student's full teacher-validation history — once per
 * (screen-focus, student), never per card (Step 5 spec §46/§47). Never
 * throws.
 *
 * @param {{studentId: number, caseType?: string, family?: string}} params
 * @returns {Promise<ReturnType<typeof normalizeTeacherValidationHistoryResponse>>}
 */
export async function fetchTeacherRecommendationValidationHistory({ studentId, caseType, family } = {}) {
  try {
    const params = {};
    if (caseType !== undefined) params.caseType = caseType;
    if (family !== undefined) params.family = family;
    const response = await client.get(ENDPOINTS.WORKSHEET_RECOMMENDATION_VALIDATIONS(studentId), { params });
    return normalizeTeacherValidationHistoryResponse(response?.data);
  } catch (err) {
    devLog('history fetch failed — treating as read_failed', err);
    return { ...HISTORY_FAILSAFE };
  }
}

/**
 * Resolves the teacher's current judgement for ONE exact recommendation
 * instance, identified by its fingerprint — never computed here, always
 * the backend-provided value the caller already holds in memory (Step 5
 * spec §19). Never throws.
 *
 * @param {{studentId: number, caseType: string, family: string, recommendationFingerprint: string}} params
 * @returns {Promise<ReturnType<typeof normalizeCurrentValidationStateResponse>>}
 */
export async function fetchTeacherRecommendationValidationState({ studentId, caseType, family, recommendationFingerprint } = {}) {
  try {
    const response = await client.get(ENDPOINTS.WORKSHEET_RECOMMENDATION_VALIDATION_STATE(studentId), {
      params: { caseType, family, recommendationFingerprint },
    });
    return normalizeCurrentValidationStateResponse(response?.data);
  } catch (err) {
    devLog('current-state fetch failed — treating as read_failed', err);
    return { ...STATE_FAILSAFE };
  }
}

/**
 * Records one explicit teacher judgement. The ONLY writing function in
 * this file — must only ever be invoked from a Confirm/Not-suitable button
 * press (Step 5 spec §61). Sends exactly
 * `{caseType, family, validation, teacherNote, recommendationFingerprint}`
 * — no `studentId` in the body (it's the URL path param) and no
 * `teacherId`/`teacher_id` ever (Step 5 spec §20/§62). Never throws — every
 * failure mode (network, 409, 422, 500) resolves to a distinct, safe
 * `status` the caller can branch on.
 *
 * @param {{studentId: number, caseType: string, family: string, validation: 'confirmed'|'dismissed', teacherNote?: string, recommendationFingerprint: string}} params
 * @returns {Promise<{status: 'validated'|'recommendation_changed'|'recommendation_not_found'|'invalid_input'|'write_failed', duplicate: boolean, message: string|null}>}
 */
export async function submitTeacherRecommendationValidation({
  studentId, caseType, family, validation, teacherNote, recommendationFingerprint,
} = {}) {
  const body = {
    caseType,
    family,
    validation,
    teacherNote: normalizeTeacherNoteForSubmit(teacherNote),
    recommendationFingerprint,
  };

  try {
    const response = await client.post(ENDPOINTS.WORKSHEET_RECOMMENDATION_VALIDATIONS(studentId), body);
    const data = response?.data ?? {};
    return { status: 'validated', duplicate: data.duplicate === true, message: null };
  } catch (err) {
    devLog('validation submit failed', err);

    // client.js's response interceptor attaches `status` (HTTP status) and
    // `details` (the backend ApiError's own third argument, e.g.
    // {status: 'recommendation_changed'}) to every rejected error — see
    // src/controllers/handwritingController.js's postWorksheetRecommendationValidation
    // (Feature 9 Step 4) for the exact backend-side shape being read here.
    if (err?.status === 409 && err?.details?.status === 'recommendation_changed') {
      return { status: 'recommendation_changed', duplicate: false, message: 'This recommendation has changed. Refresh the report before reviewing it.' };
    }
    if (err?.status === 409 && err?.details?.status === 'recommendation_not_found') {
      return { status: 'recommendation_not_found', duplicate: false, message: 'This recommendation is no longer available. Refresh the report.' };
    }
    if (err?.status === 422) {
      return { status: 'invalid_input', duplicate: false, message: 'Teacher review could not be saved.' };
    }
    return { status: 'write_failed', duplicate: false, message: 'Teacher review could not be saved.' };
  }
}

// ─── Pure presentation helpers ───────────────────────────────────────────

/**
 * @param {'confirmed'|'dismissed'|*} validation
 * @returns {string} teacher-facing label — never the raw machine value
 *   (Step 5 spec §30/§35). Deliberately never "Correct"/"Incorrect"/
 *   "High confidence"/"Rejected by teacher" (Step 5 spec §30/§31).
 */
export function formatTeacherReviewLabel(validation) {
  if (validation === 'confirmed') return 'Confirmed';
  if (validation === 'dismissed') return 'Not suitable';
  return 'Not reviewed';
}

/**
 * A teacher may change their mind (Step 5 spec §42) — the append-only
 * history supports it — but the UI should only ever offer the OPPOSITE
 * action of the current state, never re-offer the same action (Step 5
 * spec §43, avoids an encouraged "Confirm, Confirm, Confirm" pattern).
 *
 * @param {'confirmed'|'dismissed'|null} currentValidation
 * @returns {'confirmed'|'dismissed'|null} `null` when never reviewed —
 *   both actions should be offered in that case.
 */
export function getOppositeValidationAction(currentValidation) {
  if (currentValidation === 'confirmed') return 'dismissed';
  if (currentValidation === 'dismissed') return 'confirmed';
  return null;
}

/**
 * Trims a teacher-typed note; an empty/whitespace-only result becomes
 * `null` (Step 5 spec §34), never an empty string sent to the backend.
 *
 * @param {*} note
 * @returns {string|null}
 */
export function normalizeTeacherNoteForSubmit(note) {
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Filters an already-fetched, once-per-screen history array down to the
 * events relevant to one card's stream — purely client-side, no additional
 * request (Step 5 spec §49). Order is preserved exactly as given.
 *
 * @param {Array<Object>} events
 * @param {string} caseType
 * @param {string} family
 * @returns {Array<Object>}
 */
export function filterHistoryForStream(events, caseType, family) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => event.caseType === caseType && event.family === family);
}

/**
 * Formats a validatedAt ISO timestamp as "14 Aug 2026" — matches the
 * backend CLI's own date format choice
 * (dryRunTeacherRecommendationValidationHistory.js). Never throws on a
 * malformed value.
 *
 * @param {*} isoString
 * @returns {string}
 */
export function formatReviewDate(isoString) {
  if (typeof isoString !== 'string') return '';
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) return '';
  const day = date.getUTCDate();
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
