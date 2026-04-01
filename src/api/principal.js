import client from './client';
import { ENDPOINTS } from '../constants/api';

export const principalApi = {
  // Dashboard
  async getDashboard() {
    const { data } = await client.get(ENDPOINTS.PRINCIPAL_DASHBOARD);
    return data;
  },

  // Teachers
  async getTeachers() {
    const { data } = await client.get(ENDPOINTS.PRINCIPAL_TEACHERS);
    return data;
  },

  async getTeacher(id) {
    const { data } = await client.get(ENDPOINTS.PRINCIPAL_TEACHER(id));
    return data;
  },

  async createTeacher(formData) {
    const { data } = await client.post(ENDPOINTS.PRINCIPAL_TEACHERS, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async updateTeacher(id, formData) {
    const { data } = await client.put(ENDPOINTS.PRINCIPAL_TEACHER(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deleteTeacher(id) {
    const { data } = await client.delete(ENDPOINTS.PRINCIPAL_TEACHER(id));
    return data;
  },

  // Students
  async getStudents() {
    const { data } = await client.get(ENDPOINTS.PRINCIPAL_STUDENTS);
    return data;
  },

  async getStudent(id) {
    const { data } = await client.get(ENDPOINTS.PRINCIPAL_STUDENT(id));
    return data;
  },

  async createStudent(formData) {
    const { data } = await client.post(ENDPOINTS.PRINCIPAL_STUDENTS, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async updateStudent(id, formData) {
    const { data } = await client.put(ENDPOINTS.PRINCIPAL_STUDENT(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deleteStudent(id) {
    const { data } = await client.delete(ENDPOINTS.PRINCIPAL_STUDENT(id));
    return data;
  },

  async assignStudent(studentId, teacherId) {
    const { data } = await client.put(ENDPOINTS.PRINCIPAL_ASSIGN_STUDENT(studentId), {
      teacher_id: teacherId,
    });
    return data;
  },
};
