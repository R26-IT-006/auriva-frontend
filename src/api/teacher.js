import client from './client';
import { ENDPOINTS } from '../constants/api';

// The scoring pipeline can run ffmpeg, Whisper, and the phoneme GOP worker,
// then persist a comparatively large audio row. Real attempts regularly take
// longer than the client's 15-second default, especially on the first run.
const PRONUNCIATION_SCORING_TIMEOUT_MS = 120000;
const PRONUNCIATION_BUSY_RETRY_DELAY_MS = 800;
const PRONUNCIATION_RESULT_RETRY_DELAY_MS = 800;

export const teacherApi = {
  async getDashboard() {
    const { data } = await client.get(ENDPOINTS.TEACHER_DASHBOARD);
    return data;
  },

  async getStudents() {
    const { data } = await client.get(ENDPOINTS.TEACHER_STUDENTS);
    return data;
  },

  async getStudent(id) {
    const { data } = await client.get(ENDPOINTS.TEACHER_STUDENT(id));
    return data;
  },

  async startSession(studentId) {
    const { data } = await client.post(ENDPOINTS.TEACHER_SESSION_START, {
      student_id: studentId,
    });
    return data;
  },

  async endSession(studentId) {
    const { data } = await client.post(ENDPOINTS.TEACHER_SESSION_END, {
      student_id: studentId,
    });
    return data;
  },

  async setAvatar(studentId, avatarKey) {
    const { data } = await client.post(ENDPOINTS.TEACHER_STUDENT_AVATAR(studentId), {
      avatar_key: avatarKey,
    });
    return data;
  },

  async getStudentNotes(studentId) {
    const { data } = await client.get(ENDPOINTS.TEACHER_STUDENT_NOTES(studentId));
    return data;
  },

  async addStudentNote(studentId, body) {
    const { data } = await client.post(ENDPOINTS.TEACHER_STUDENT_NOTES(studentId), { body });
    return data;
  },

  async deleteStudentNote(studentId, noteId) {
    await client.delete(ENDPOINTS.TEACHER_STUDENT_NOTE(studentId, noteId));
  },

  // Cheap — progress table only. Safe to call on the student profile.
  async getConceptSummary(studentId) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_SUMMARY(studentId));
    return data;
  },

  // Expensive — aggregates the interaction log. Lazy-load from the report screen.
  async getConceptReport(studentId, days = 90) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_REPORT(studentId), {
      params: { days },
    });
    return data;
  },

  // Slowest of the three on a cache miss — a model call. Always fetch it after
  // the screen has already rendered, never as a precondition for rendering.
  // Resolves to { available: false } when the feature is off or the model fails;
  // callers should render nothing in that case rather than showing an error.
  async getConceptNarrative(studentId, refresh = false) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_NARRATIVE(studentId), {
      params: refresh ? { refresh: true } : {},
    });
    return data;
  },

  async setSensorySettings(studentId, reduceStimulation) {
    const { data } = await client.put(ENDPOINTS.TEACHER_STUDENT_SENSORY_SETTINGS(studentId), {
      reduce_stimulation: reduceStimulation,
    });
    return data;
  },

  async scorePronunciationAttempt(studentId, payload, { signal } = {}) {
    const submit = async () => {
      const { data } = await client.post(
        ENDPOINTS.TEACHER_PRONUNCIATION_SCORE(studentId),
        payload,
        {
          signal,
          timeout: PRONUNCIATION_SCORING_TIMEOUT_MS,
          timeoutMessage:
            'Pronunciation scoring is taking longer than expected. Please try again.',
        }
      );
      return data;
    };

    try {
      return await submit();
    } catch (error) {
      // DATABASE_BUSY is emitted only when Sequelize never acquired a DB
      // connection, so the failed request performed no insert and one retry
      // cannot duplicate an attempt.
      if (error.code !== 'DATABASE_BUSY' || signal?.aborted) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, PRONUNCIATION_BUSY_RETRY_DELAY_MS)
      );
      return submit();
    }
  },

  async savePronunciationResult(studentId, payload) {
    const completePersistedResult = Boolean(payload?.result_id);
    const submit = async () => {
      const { data } = await client.post(
        ENDPOINTS.TEACHER_PRONUNCIATION_RESULTS(studentId),
        payload,
        // Completing an already-persisted result is idempotent and safe to
        // retry if the network drops. The legacy create path is not.
        completePersistedResult ? { retryOnNetworkError: true } : undefined
      );
      return data;
    };

    try {
      return await submit();
    } catch (error) {
      // A transient server/DB failure can leave a scored row marked as an
      // incomplete workflow. Updating that existing row is idempotent, so a
      // single delayed retry is safe. Never retry the legacy create path.
      const isTransient = error.code === 'DATABASE_BUSY' || error.status >= 500;
      if (!completePersistedResult || !isTransient) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, PRONUNCIATION_RESULT_RETRY_DELAY_MS)
      );
      return submit();
    }
  },

  async getPronunciationResults(studentId, limit) {
    const { data } = await client.get(
      ENDPOINTS.TEACHER_PRONUNCIATION_RESULTS(studentId),
      { params: limit ? { limit } : undefined }
    );
    return data;
  },

  async getPronunciationResultAudio(resultId) {
    const { data } = await client.get(
      ENDPOINTS.TEACHER_PRONUNCIATION_RESULT_AUDIO(resultId)
    );
    return data;
  },

  // ── Saved reports ─────────────────────────────────────────────────────────
  // Which weeks and months actually hold something. Drives the picker, so a
  // teacher is never offered a period that would generate an empty report.
  async getConceptPeriods(studentId) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_PERIODS(studentId));
    return data;
  },

  // Already sorted newest first by the server. Do NOT re-sort in the client:
  // two screens ordering the same list differently is how a teacher ends up
  // reading the wrong week.
  async listConceptReports(studentId) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_REPORTS(studentId));
    return data;
  },

  async getSavedConceptReport(studentId, reportId) {
    const { data } = await client.get(ENDPOINTS.TEACHER_CONCEPT_REPORT_ONE(studentId, reportId));
    return data;
  },

  // Slow and rate-limited: it runs the full aggregate and then a model call.
  // Throws 422 when the period holds nothing — that message is written for the
  // teacher and should be shown as-is.
  async createConceptReport(studentId, periodType, periodStart) {
    const { data } = await client.post(ENDPOINTS.TEACHER_CONCEPT_REPORTS(studentId), {
      period_type: periodType,
      period_start: periodStart,
    });
    return data;
  },

  async deleteConceptReport(studentId, reportId) {
    await client.delete(ENDPOINTS.TEACHER_CONCEPT_REPORT_ONE(studentId, reportId));
  },

  async getClassDigest(refresh = false) {
    const { data } = await client.get(ENDPOINTS.TEACHER_DASHBOARD_DIGEST, {
      params: refresh ? { refresh: true } : {},
    });
    return data;
  },

  // ── Pronunciation review queue ────────────────────────────────────────────
  async getPronunciationReviewQueue(limit) {
    const { data } = await client.get(ENDPOINTS.TEACHER_PRONUNCIATION_REVIEW_QUEUE, {
      params: limit ? { limit } : undefined,
    });
    return data;
  },

  async submitPronunciationReview(resultId, teacherReviewedScore) {
    const { data } = await client.patch(
      ENDPOINTS.TEACHER_PRONUNCIATION_REVIEW(resultId),
      { teacher_reviewed_score: teacherReviewedScore }
    );
    return data;
  },
};
