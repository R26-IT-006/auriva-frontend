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

  async getClassDigest(refresh = false) {
    const { data } = await client.get(ENDPOINTS.TEACHER_DASHBOARD_DIGEST, {
      params: refresh ? { refresh: true } : {},
    });
    return data;
  },
};
