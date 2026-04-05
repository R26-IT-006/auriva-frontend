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
};
