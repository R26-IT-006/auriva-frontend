// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
export const API_BASE_URL = 'http://192.168.1.5:3000/api';

export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  SET_PASSWORD: '/auth/set-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_OTP: '/auth/verify-otp',
  RESET_PASSWORD: '/auth/reset-password',

  // Principal
  PRINCIPAL_DASHBOARD: '/principal/dashboard',
  PRINCIPAL_TEACHERS: '/principal/teachers',
  PRINCIPAL_TEACHER: (id) => `/principal/teachers/${id}`,
  PRINCIPAL_STUDENTS: '/principal/students',
  PRINCIPAL_STUDENT: (id) => `/principal/students/${id}`,
  PRINCIPAL_ASSIGN_STUDENT: (id) => `/principal/students/${id}/assign`,

  // Teacher
  TEACHER_DASHBOARD: '/teacher/dashboard',
  TEACHER_STUDENTS: '/teacher/students',
  TEACHER_STUDENT: (id) => `/teacher/students/${id}`,
  TEACHER_SESSION_START: '/teacher/session/start',
  TEACHER_SESSION_END: '/teacher/session/end',
  TEACHER_STUDENT_AVATAR: (id) => `/teacher/students/${id}/avatar`,

  // Dialogue – Level 1
  DIALOGUE_LEVEL1_OVERVIEW:        (sid) => `/teacher/student/${sid}/level1/overview`,
  DIALOGUE_LEVEL1_NEXT_WORD:       (sid, category) => `/teacher/student/${sid}/level1/next-word${category ? `?category=${category}` : ''}`,
  DIALOGUE_LEVEL1_PHASE1_EXPOSURE: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-exposure`,
  DIALOGUE_LEVEL1_PHASE1_GATE:     (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-gate`,
  DIALOGUE_LEVEL1_PHASE2_ASSESS:    (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-assess`,
  DIALOGUE_LEVEL1_PHASE2_NONVERBAL: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-nonverbal`,
  DIALOGUE_LEVEL1_PHASE3_SCENARIO:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-scenario`,
  DIALOGUE_LEVEL1_PHASE3_COMPLETE:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-complete`,

};
