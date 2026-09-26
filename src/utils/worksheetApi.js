/**
 * worksheetApi.js
 *
 * Client for the homework-worksheet endpoints.
 *
 * Same thin-wrapper contract as every other fetch util here: never throws, a
 * failure degrades to an explicit `unavailable` status rather than an
 * exception, and no value is ever fabricated on failure. A failed upload must
 * never take the teacher report down with it.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE_LIST = Object.freeze({ status: 'unavailable', worksheets: [], active: null });
const FAILSAFE_CANDIDATES = Object.freeze({ status: 'unavailable', candidates: [] });

function devLog(what, err) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[worksheetApi] ${what} failed — treating as unavailable:`, err?.message ?? err);
  }
}

/** Persistent streams a worksheet could target, with the suggested letter. */
export async function fetchWorksheetCandidates(studentId) {
  try {
    const { data } = await client.get(ENDPOINTS.WORKSHEET_CANDIDATES(studentId));
    if (!data || data.status !== 'evaluated' || !Array.isArray(data.candidates)) {
      return { ...FAILSAFE_CANDIDATES };
    }
    return { status: 'evaluated', candidates: data.candidates };
  } catch (err) {
    devLog('candidates', err);
    return { ...FAILSAFE_CANDIDATES };
  }
}

/** Worksheet history, newest first, with the active worksheet flagged. */
export async function fetchWorksheetHistory(studentId) {
  try {
    const { data } = await client.get(ENDPOINTS.WORKSHEET_HISTORY(studentId));
    if (!data || data.status !== 'found' || !Array.isArray(data.worksheets)) {
      return { ...FAILSAFE_LIST };
    }
    return { status: 'found', worksheets: data.worksheets, active: data.active ?? null };
  } catch (err) {
    devLog('history', err);
    return { ...FAILSAFE_LIST };
  }
}

/**
 * Creates a worksheet for a TEACHER-APPROVED target.
 *
 * `already_assigned` and `unmapped_letter` are honest outcomes the server
 * returns with a 200 — they are surfaced to the teacher, not treated as
 * errors, and neither creates a duplicate.
 */
export async function generateWorksheet({
  studentId, targetLetter, caseType, motorFamily,
  intensity = 'standard', teacherNote = null, recommendationFingerprint = null,
}) {
  try {
    const { data } = await client.post(ENDPOINTS.WORKSHEET_GENERATE(), {
      student_id: studentId,
      target_letter: targetLetter,
      case_type: caseType,
      motor_family: motorFamily ?? null,
      worksheet_intensity: intensity,
      teacher_note: teacherNote,
      recommendation_fingerprint: recommendationFingerprint,
    });
    return {
      status: data?.status ?? 'unavailable',
      worksheet: data?.worksheet ?? null,
      plan: data?.plan ?? null,
      letter: data?.letter ?? null,
    };
  } catch (err) {
    devLog('generate', err);
    return { status: 'unavailable', worksheet: null, plan: null };
  }
}

/** Marks a generated worksheet as handed out. */
export async function assignWorksheet(worksheetId, worksheetFileUrl = null) {
  try {
    const { data } = await client.patch(ENDPOINTS.WORKSHEET_ASSIGN(worksheetId), {
      worksheet_file_url: worksheetFileUrl,
    });
    return { status: data?.status ?? 'unavailable', worksheet: data?.worksheet ?? null };
  } catch (err) {
    devLog('assign', err);
    return { status: 'unavailable', worksheet: null };
  }
}

/**
 * Uploads the completed paper as multipart.
 *
 * The image is stored and shown to the teacher. Nothing analyses, scores or
 * grades it — there is no handwriting recognition anywhere in this flow.
 *
 * @param {{uri: string, name?: string, mimeType?: string}} file
 */
export async function submitWorksheet(worksheetId, file, submissionType = 'photo') {
  try {
    const form = new FormData();
    form.append('worksheet', {
      uri: file.uri,
      name: file.name ?? `worksheet-${worksheetId}.jpg`,
      type: file.mimeType ?? 'image/jpeg',
    });
    form.append('submission_type', submissionType);

    const { data } = await client.post(ENDPOINTS.WORKSHEET_SUBMIT(worksheetId), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { status: data?.status ?? 'unavailable', submission: data?.submission ?? null };
  } catch (err) {
    devLog('submit', err);
    // A rejected upload (wrong student, unsupported type, too large) must be
    // reported to the teacher, never silently swallowed.
    return {
      status: 'unavailable',
      submission: null,
      message: err?.response?.data?.message ?? 'The worksheet could not be uploaded. Please try again.',
    };
  }
}

/** Saves the teacher's own review of a returned worksheet. */
export async function reviewSubmission(submissionId, reviewStatus, teacherComment = null) {
  try {
    const { data } = await client.patch(ENDPOINTS.WORKSHEET_REVIEW(submissionId), {
      review_status: reviewStatus,
      teacher_comment: teacherComment,
    });
    return {
      status: data?.status ?? 'unavailable',
      submission: data?.submission ?? null,
      worksheet: data?.worksheet ?? null,
    };
  } catch (err) {
    devLog('review', err);
    return { status: 'unavailable', submission: null, worksheet: null };
  }
}
