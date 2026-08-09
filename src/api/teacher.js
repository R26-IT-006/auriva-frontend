import client from './client';
import { ENDPOINTS } from '../constants/api';

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

  async setAvatar(studentId, avatarKey) {
    const { data } = await client.post(ENDPOINTS.TEACHER_STUDENT_AVATAR(studentId), {
      avatar_key: avatarKey,
    });
    return data;
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

  async setSensorySettings(studentId, reduceStimulation) {
    const { data } = await client.put(ENDPOINTS.TEACHER_STUDENT_SENSORY_SETTINGS(studentId), {
      reduce_stimulation: reduceStimulation,
    });
    return data;
  },

  async scorePronunciationAttempt(studentId, payload) {
    const { data } = await client.post(
      ENDPOINTS.TEACHER_PRONUNCIATION_SCORE(studentId),
      payload
    );
    return data;
  },

  async savePronunciationResult(studentId, payload) {
    const { data } = await client.post(
      ENDPOINTS.TEACHER_PRONUNCIATION_RESULTS(studentId),
      payload
    );
    return data;
  },

  async getPronunciationResults(studentId) {
    const { data } = await client.get(
      ENDPOINTS.TEACHER_PRONUNCIATION_RESULTS(studentId)
    );
    return data;
  },

  async getPronunciationResultAudio(resultId) {
    const { data } = await client.get(
      ENDPOINTS.TEACHER_PRONUNCIATION_RESULT_AUDIO(resultId)
    );
    return data;
  },
};
