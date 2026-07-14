// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
// Physical device on same WiFi → use machine's LAN IP e.g. http://192.168.1.180:3000/api
// Android emulator → 10.0.2.2 maps to host machine's localhost
export const API_BASE_URL = 'http://192.168.1.180:3000/api';

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
  TEACHER_STUDENT_AVATAR: (id) => `/teacher/students/${id}/avatar`,

  // Concept Learning
  CONCEPT_ITEMS:              (cat) => `/teacher/concepts/${cat}/items`,
  CONCEPT_TIER1_START:        '/teacher/concepts/tier1/start',
  CONCEPT_TIER1_INTERACTION:  '/teacher/concepts/tier1/interaction',
  CONCEPT_TIER1_ATTEMPT:      '/teacher/concepts/tier1/attempt',
  CONCEPT_TIER1_COMPLETE:     '/teacher/concepts/tier1/complete',
  CONCEPT_ADAPTIVE_ATTEMPT:   '/teacher/concepts/adaptive/attempt',
  CONCEPT_ADAPTIVE_COMPLETE:  '/teacher/concepts/adaptive/complete',
  CONCEPT_TIER2_START:        '/teacher/concepts/tier2/start',
  CONCEPT_TIER2_COMPLETE:     '/teacher/concepts/tier2/complete',
  CONCEPT_TIER3_START:        '/teacher/concepts/tier3/start',
  CONCEPT_TIER3_COMPLETE:     '/teacher/concepts/tier3/complete',
  CONCEPT_DISTRACTORS:        '/teacher/concepts/distractors',
};
