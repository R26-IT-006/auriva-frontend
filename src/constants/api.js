// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
export const API_BASE_URL = 'http://10.93.255.245:3000/api';

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
  DIALOGUE_LEVEL1_NEXT_WORD:       (sid) => `/teacher/student/${sid}/level1/next-word`,
  DIALOGUE_WORD_BY_ID:             (wid) => `/teacher/word/${wid}`,
  DIALOGUE_LEVEL1_PHASE1_EXPOSURE: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-exposure`,
  DIALOGUE_LEVEL1_PHASE1_GATE:     (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-gate`,
  DIALOGUE_LEVEL1_PHASE2_ASSESS:    (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-assess`,
  DIALOGUE_LEVEL1_PHASE2_NONVERBAL: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-nonverbal`,
  DIALOGUE_LEVEL1_PHASE3_SCENARIO:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-scenario`,
  DIALOGUE_LEVEL1_PHASE3_COMPLETE:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-complete`,
  DIALOGUE_TRAJECTORY:              (sid, wid) => `/teacher/student/${sid}/word/${wid}/trajectory`,

  // Dialogue – TASK-12 Non-Verbal Adaptive Wait-Time Escalation
  DIALOGUE_SPEECH_STATE:            (sid) => `/teacher/student/${sid}/speech-state`,

  // Dialogue – Rule 5 periodic production probe (TASK-37/TASK-39)
  DIALOGUE_PROBE_CANDIDATE: (sid) => `/teacher/student/${sid}/level1/probe-candidate`,
  DIALOGUE_PROBE_RESULT:    (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/probe-result`,

  // Dialogue – Level 1 Evaluations (TASK-15)
  DIALOGUE_EVALUATIONS_STATUS: (sid) => `/teacher/dialogue/evaluations/${sid}`,
  DIALOGUE_EVALUATIONS_BUILD:  (sid, category) => `/teacher/dialogue/evaluations/${sid}/${category}`,
  DIALOGUE_EVALUATIONS_RECORD: (sid, category) => `/teacher/dialogue/evaluations/${sid}/${category}`,

  // Dialogue – Level 2
  LEVEL2_QUESTIONNAIRE:         (sid) => `/teacher/student/${sid}/level2/questionnaire`,
  LEVEL2_PROGRESS:              (sid) => `/teacher/student/${sid}/level2/progress`,
  LEVEL2_SESSION_START:         (sid) => `/teacher/student/${sid}/level2/session/start`,
  LEVEL2_SESSION_COMPLETE:      (sid, sessId) => `/teacher/student/${sid}/level2/session/${sessId}/complete`,
  LEVEL2_STEP3:                 (sid, sessId, sentIdx) => `/teacher/student/${sid}/level2/session/${sessId}/sentence/${sentIdx}/step3`,
  LEVEL2_STEP4:                 (sid, sessId, sentIdx) => `/teacher/student/${sid}/level2/session/${sessId}/sentence/${sentIdx}/step4`,
  LEVEL2_GENDER_SELECTION:      (sid, sessId) => `/teacher/student/${sid}/level2/session/${sessId}/gender-selection`,
  LEVEL2_ACTIVITY_SELECTION:    (sid, sessId) => `/teacher/student/${sid}/level2/session/${sessId}/activity-selection`,
  LEVEL2_PARAGRAPH_ATTEMPT:     (sid, sessId) => `/teacher/student/${sid}/level2/session/${sessId}/paragraph-attempt`,
  LEVEL2_SXS_ATTEMPT:           (sid, sessId, sentIdx) => `/teacher/student/${sid}/level2/session/${sessId}/sentence-by-sentence/${sentIdx}`,
};
