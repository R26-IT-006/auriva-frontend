/**
 * finalizeSync.js
 *
 * Reliability Step 2/3: replays a pending assessment finalization reliably.
 *
 * Split into two layers on purpose:
 *   syncPendingFinalization() — network only (the PATCH call), no AsyncStorage.
 *   attemptFinalization()     — orchestrates storage lifecycle + network sync
 *                                for a single finalize attempt.
 *
 * This lives under src/utils/ (not inside AssessmentCompleteScreen.js)
 * specifically so it can be unit-tested: this project's Jest setup
 * (jest.config.js) runs in a plain Node environment with testMatch limited
 * to src/utils/**, and has no React Native rendering harness configured —
 * a function that imports react-native/expo-av/expo-linear-gradient (as the
 * screen file does) cannot be required from a test at all today. Keeping
 * this logic here also means Reliability Step 3's LetterHome retry can
 * reuse attemptFinalization() directly without duplicating any of it.
 */

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';
import {
  storePendingFinalization, clearPendingFinalization, getPendingFinalizationsForStudent,
} from './storage';

/**
 * Attempts the finalize PATCH for a pending record. Never throws — always
 * resolves to a structured result so callers don't need their own try/catch.
 *
 * @param {{ assessmentId: number, motorScore: number, motorProfile: Object }} record
 * @returns {Promise<{ ok: boolean, conflict: boolean, response: Object|null }>}
 *   ok       — true only on a genuine HTTP success (2xx).
 *   conflict — true only on HTTP 409 (different values already finalized —
 *              see finalizeAssessment's idempotency check, Reliability Step 1).
 *   response — the parsed response body on success, else null.
 */
export async function syncPendingFinalization(record) {
  try {
    const response = await client.patch(ENDPOINTS.HANDWRITING_FINALIZE(record.assessmentId), {
      motor_score:   record.motorScore,
      motor_profile: record.motorProfile,
    });
    return { ok: true, conflict: false, response: response.data };
  } catch (err) {
    return { ok: false, conflict: err?.status === 409, response: null };
  }
}

/**
 * Full pending-finalization flow for one assessment-complete event:
 *   1. persist a replayable record locally BEFORE any network call
 *      (survives the app closing mid-request — never reversed);
 *   2. await exactly one finalize PATCH (the client's own axios interceptor
 *      already retries pure transient network errors — no second retry loop
 *      is added here);
 *   3. success (finalized or already_finalized — both mean the server has
 *      confirmed persistence)      → clear the pending record;
 *      409 conflict                → keep the record, mark status 'conflict',
 *                                     do not overwrite local values from the
 *                                     server, do not auto-retry;
 *      any other failure           → keep the record, bump attemptCount.
 *
 * Never blocks navigation — the caller always proceeds afterward regardless
 * of the returned status.
 *
 * @param {{ studentId: number, assessmentId: number|null, motorScore: number|null, motorProfile: Object }} params
 * @returns {Promise<{ status: 'success'|'pending'|'conflict'|'skipped' }>}
 */
export async function attemptFinalization({ studentId, assessmentId, motorScore, motorProfile }) {
  // assessmentId can be null when the earlier POST /handwriting/assessment
  // failed (see ShapeAssessmentScreen's submitAssessment try/catch) — a
  // separate, pre-existing upstream reliability gap, out of scope here.
  // motorScore can be null when AssessmentCompleteScreen had no shape data
  // to average a motor_score from. Either way, there is nothing replayable
  // to persist.
  if (!assessmentId || motorScore == null) {
    console.warn('Skipping finalize: no assessmentId or motorScore available (see upstream assessment-submission reliability gap)');
    return { status: 'skipped' };
  }

  const record = {
    assessmentId,
    studentId,
    motorScore,
    motorProfile,
    createdAt: new Date().toISOString(),
    attemptCount: 0,
    status: 'pending',
  };

  // Mandatory ordering: persist BEFORE the network call, never after.
  const stored = await storePendingFinalization(studentId, assessmentId, record);
  if (!stored) {
    // Could not even persist the pending record locally. Proceeding with the
    // PATCH attempt anyway (best effort) rather than blocking the child —
    // but there is no durable fallback if this specific attempt also fails.
    console.warn('Pending finalization record failed to persist locally — proceeding without a durable fallback for this attempt');
  }

  const syncResult = await syncPendingFinalization(record);

  if (syncResult.ok) {
    if (stored) await clearPendingFinalization(studentId, assessmentId);
    return { status: 'success' };
  }

  if (syncResult.conflict) {
    if (stored) {
      await storePendingFinalization(studentId, assessmentId, { ...record, status: 'conflict' });
    }
    return { status: 'conflict' };
  }

  // Network/server failure — retain the pending record for a later retry
  // (Reliability Step 3), recording that one attempt has now failed.
  if (stored) {
    await storePendingFinalization(studentId, assessmentId, { ...record, attemptCount: record.attemptCount + 1 });
  }
  return { status: 'pending' };
}

// ─── Reliability Step 3: quiet retry from LetterHomeScreen ─────────────────

/**
 * Picks which pending record to retry, given possibly more than one. Only
 * 'pending' records are eligible — 'conflict' records are never auto-retried.
 * Deliberately synchronous/pure so it's trivially testable and so callers
 * never need Promise.all: at most one record is ever selected per call.
 *
 * @param {Object[]} records
 * @returns {Object|null} the oldest eligible record, or null if none.
 */
export function selectOldestPendingRecord(records) {
  const eligible = (records ?? []).filter(r => r?.status === 'pending');
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
}

// A record missing any of these cannot be safely replayed into a PATCH body.
function isReplayableRecord(record) {
  return (
    record?.assessmentId != null &&
    record?.studentId != null &&
    record?.motorScore != null &&
    record?.motorProfile != null && typeof record.motorProfile === 'object'
  );
}

/**
 * Retries a single ALREADY-STORED pending record. Unlike attemptFinalization()
 * (which creates a brand-new record with attemptCount:0/createdAt:now for a
 * fresh assessment-complete event), this preserves the existing record's
 * createdAt and increments its existing attemptCount — it must never reset
 * either, since that would erase real retry history for a record that may
 * already have survived an app restart.
 *
 * @param {Object} record — an existing pending-finalization record (as
 *   returned by getPendingFinalization/getPendingFinalizationsForStudent).
 * @returns {Promise<{ status: 'success'|'pending'|'conflict' }>}
 */
export async function retryPendingFinalization(record) {
  const syncResult = await syncPendingFinalization(record);

  if (syncResult.ok) {
    await clearPendingFinalization(record.studentId, record.assessmentId);
    return { status: 'success' };
  }

  if (syncResult.conflict) {
    await storePendingFinalization(record.studentId, record.assessmentId, {
      ...record,
      status: 'conflict',
      attemptCount: record.attemptCount + 1,
    });
    return { status: 'conflict' };
  }

  await storePendingFinalization(record.studentId, record.assessmentId, {
    ...record,
    attemptCount: record.attemptCount + 1,
  });
  return { status: 'pending' };
}

/**
 * The full quiet, bounded, one-shot retry LetterHomeScreen calls on every
 * focus event: discover this student's pending records (works purely from
 * studentId — no assessmentId needed, so this works after an app restart via
 * any navigation path, not just the immediate post-assessment transition),
 * select at most one, retry it if safe to replay.
 *
 * Never throws. Makes at most one network call. 'conflict' records are
 * logged (IDs only) but never retried automatically.
 *
 * @param {number|string} studentId
 * @returns {Promise<{ status: 'none'|'invalid_record'|'success'|'pending'|'conflict' }>}
 */
export async function retryPendingFinalizationForStudent(studentId) {
  const records = await getPendingFinalizationsForStudent(studentId);

  const conflicts = records.filter(r => r?.status === 'conflict');
  if (conflicts.length > 0) {
    console.warn(
      `Pending finalization conflict requires review [student ${studentId}]: assessment(s) ${conflicts.map(c => c.assessmentId).join(', ')}`
    );
  }

  const candidate = selectOldestPendingRecord(records);
  if (!candidate) return { status: 'none' };

  if (!isReplayableRecord(candidate)) {
    // Corrupt/incomplete record — never send a malformed PATCH. Left in
    // place rather than deleted (manual diagnosis may be useful) or given a
    // new 'invalid' status (not needed: skipping + logging is enough, since
    // re-attempting it next focus event is equally safe and equally cheap —
    // it will simply be skipped again).
    console.warn(`Skipping corrupt pending finalization record [student ${studentId}, assessment ${candidate?.assessmentId}]`);
    return { status: 'invalid_record' };
  }

  return retryPendingFinalization(candidate);
}
