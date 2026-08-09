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
};
