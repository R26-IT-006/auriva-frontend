// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
export const API_BASE_URL = 'http://192.168.1.5:3000/api';

export const ENDPOINTS = {
  // Auth
  LOGIN: "/auth/login",
  SET_PASSWORD: "/auth/set-password",
  FORGOT_PASSWORD: "/auth/forgot-password",
  VERIFY_OTP: "/auth/verify-otp",
  RESET_PASSWORD: "/auth/reset-password",

  // Principal
  PRINCIPAL_DASHBOARD: "/principal/dashboard",
  PRINCIPAL_TEACHERS: "/principal/teachers",
  PRINCIPAL_TEACHER: (id) => `/principal/teachers/${id}`,
  PRINCIPAL_STUDENTS: "/principal/students",
  PRINCIPAL_STUDENT: (id) => `/principal/students/${id}`,
  PRINCIPAL_ASSIGN_STUDENT: (id) => `/principal/students/${id}/assign`,

  // Teacher
  TEACHER_DASHBOARD: "/teacher/dashboard",
  TEACHER_STUDENTS: "/teacher/students",
  TEACHER_STUDENT: (id) => `/teacher/students/${id}`,
  TEACHER_STUDENT_AVATAR: (id) => `/teacher/students/${id}/avatar`,
  TEACHER_CONCEPT_SUMMARY: (id) => `/teacher/students/${id}/concepts/summary`,
  TEACHER_CONCEPT_REPORT:  (id) => `/teacher/students/${id}/concepts/report`,

  // Handwriting
  HANDWRITING_ASSESSMENT:     '/handwriting/assessment',
  HANDWRITING_FINALIZE:       (id)       => `/handwriting/assessment/${id}/finalize`,
  HANDWRITING_INITIAL_REPORT: (studentId) => `/handwriting/initial-report/${studentId}`,
  LETTER_COMPLETE:            '/handwriting/letter-complete',
  LETTER_PROGRESS:            (studentId) => `/handwriting/progress/${studentId}`,

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

  // Dialogue – TASK-43 explainable trajectory predictions (teacher reports).
  // The report screen calls the batch endpoint; the per-word one explains a
  // single word.
  DIALOGUE_TRAJECTORY_EXPLAIN:      (sid, wid) => `/teacher/student/${sid}/word/${wid}/trajectory/explain`,
  DIALOGUE_TRAJECTORY_REPORT:       (sid) => `/teacher/student/${sid}/dialogue/trajectory-report`,

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

  // Concept Learning – cross-concept activities
  CONCEPT_ACTIVITY_STATUS:    (cat) => `/teacher/concepts/${cat}/activity/status`,
  CONCEPT_ACTIVITY_START:     '/teacher/concepts/activity/start',
  CONCEPT_ACTIVITY_ATTEMPT:   '/teacher/concepts/activity/attempt',
  CONCEPT_ACTIVITY_COMPLETE:  '/teacher/concepts/activity/complete',
};
