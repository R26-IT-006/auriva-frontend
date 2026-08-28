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
