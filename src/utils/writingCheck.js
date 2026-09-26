/**
 * writingCheck.js
 *
 * Client for the Writing Check — the dedicated, teacher-initiated route for the
 * frozen letter motor pattern model.
 *
 * ── Child-facing vocabulary ────────────────────────────────────────────────
 * The child sees "Writing Check" and nothing else. No model, clustering,
 * Pattern A/B, reference range, cluster id or OOD terminology appears in any
 * string this module or its screens render to a child.
 *
 * Same thin-wrapper contract as every other fetch util here: never throws, a
 * failure degrades to an explicit `unavailable` status rather than an
 * exception, and no value is ever fabricated on failure.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

/** The model's own protocol size. Never a client-side policy choice. */
export const WRITING_CHECK_REQUIRED_COUNT = 20;

const FAILSAFE = Object.freeze({ status: 'unavailable', check: null, remaining: [] });

/**
 * Starts a Writing Check, or resumes the student's unfinished one.
 * `remaining` comes back in protocol order, so the child screen simply walks it.
 */
export async function startWritingCheck({ studentId, collectionSessionId }) {
  try {
    const { data } = await client.post(ENDPOINTS.WRITING_CHECK_START(), {
      student_id: studentId,
      collection_session_id: collectionSessionId,
    });
    if (!data || (data.status !== 'started' && data.status !== 'resumed')) return { ...FAILSAFE };
    return {
      status: data.status,
      check: data.check ?? null,
      remaining: Array.isArray(data.remaining) ? data.remaining : [],
      requiredCount: data.required_count ?? WRITING_CHECK_REQUIRED_COUNT,
    };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[writingCheck] start failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}

/** Live progress for one check. */
export async function fetchWritingCheckProgress(checkId) {
  try {
    const { data } = await client.get(ENDPOINTS.WRITING_CHECK_PROGRESS(checkId));
    if (!data || data.status !== 'found') return { ...FAILSAFE };
    return {
      status: 'found',
      check: data.check ?? null,
      capturedCount: data.captured_count ?? 0,
      requiredCount: data.required_count ?? WRITING_CHECK_REQUIRED_COUNT,
      remaining: Array.isArray(data.remaining) ? data.remaining : [],
      complete: Boolean(data.complete),
    };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[writingCheck] progress failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}

/**
 * Asks the server to evaluate a completed check.
 *
 * Every returned status is an honest outcome, including `incomplete` (fewer
 * than the required pairs — the model is never called) and
 * `ml_service_unavailable` (retryable, nothing persisted). The child never sees
 * any of them.
 */
export async function completeWritingCheck(checkId) {
  try {
    const { data } = await client.post(ENDPOINTS.WRITING_CHECK_COMPLETE(checkId));
    return { status: data?.status ?? 'unavailable', check: data?.check ?? null };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[writingCheck] complete failed — treating as unavailable:', err?.message ?? err);
    }
    return { status: 'unavailable', check: null };
  }
}

/** Teacher-facing Writing Check history, newest first. */
export async function fetchWritingCheckHistory(studentId) {
  try {
    const { data } = await client.get(ENDPOINTS.WRITING_CHECK_HISTORY(studentId));
    if (!data || data.status !== 'found' || !Array.isArray(data.checks)) {
      return { status: 'unavailable', checks: [] };
    }
    return { status: 'found', checks: data.checks };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[writingCheck] history failed — treating as unavailable:', err?.message ?? err);
    }
    return { status: 'unavailable', checks: [] };
  }
}

// Teacher-facing presentation lives in the dependency-free
// letterMotorPatternLabels.js so periodicReportPdf.js (which must not pull in
// api/client or AsyncStorage) can use it too. Re-exported here so screens have
// one import site.
export { getWritingCheckPresentation } from './letterMotorPatternLabels';
