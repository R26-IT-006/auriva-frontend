// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
// Physical device on same WiFi → use machine's LAN IP e.g. http://192.168.1.19:3000/api
// Android emulator → 10.0.2.2 maps to host machine's localhost
export const API_BASE_URL = 'http://192.168.1.19:3000/api'; // Replace with your machine's LAN IP

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
  TEACHER_STUDENT_NOTES: (id) => `/teacher/students/${id}/notes`,
  TEACHER_STUDENT_NOTE: (id, noteId) => `/teacher/students/${id}/notes/${noteId}`,
  TEACHER_CONCEPT_SUMMARY: (id) => `/teacher/students/${id}/concepts/summary`,
  TEACHER_CONCEPT_REPORT:  (id) => `/teacher/students/${id}/concepts/report`,
  // AI summaries — teacher-facing narration of the two payloads above. Optional
  // by design: both may answer { available: false }.
  TEACHER_CONCEPT_NARRATIVE: (id) => `/teacher/students/${id}/concepts/narrative`,
  TEACHER_DASHBOARD_DIGEST:  "/teacher/dashboard/digest",

  // Saved reports — frozen snapshots of one named period, listed newest first.
  // The list endpoint deliberately omits each report's payload; fetch the one
  // being opened rather than a year of them.
  TEACHER_CONCEPT_PERIODS: (id) => `/teacher/students/${id}/concepts/periods`,
  TEACHER_CONCEPT_REPORTS: (id) => `/teacher/students/${id}/concepts/reports`,
  TEACHER_CONCEPT_REPORT_ONE: (id, reportId) =>
    `/teacher/students/${id}/concepts/reports/${reportId}`,

  // Handwriting
  HANDWRITING_ASSESSMENT:     '/handwriting/assessment',
  HANDWRITING_FINALIZE:       (id)       => `/handwriting/assessment/${id}/finalize`,
  HANDWRITING_INITIAL_REPORT: (studentId) => `/handwriting/initial-report/${studentId}`,
  LETTER_COMPLETE:            '/handwriting/letter-complete',
  LETTER_PROGRESS:            (studentId) => `/handwriting/progress/${studentId}`,

  // Dialogue – Level 1
  DIALOGUE_LEVEL1_OVERVIEW:        (sid) => `/teacher/student/${sid}/level1/overview`,
  DIALOGUE_LEVEL1_NEXT_WORD:       (sid) => `/teacher/student/${sid}/level1/next-word`,
  DIALOGUE_LEVEL1_PHASE1_EXPOSURE: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-exposure`,
  DIALOGUE_LEVEL1_PHASE1_GATE:     (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase1-gate`,
  DIALOGUE_LEVEL1_PHASE2_ASSESS:    (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-assess`,
  DIALOGUE_LEVEL1_PHASE2_NONVERBAL: (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase2-nonverbal`,
  DIALOGUE_LEVEL1_PHASE3_SCENARIO:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-scenario`,
  DIALOGUE_LEVEL1_PHASE3_COMPLETE:  (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/phase3-complete`,

  // Days of the Week – specific endpoints
  DAYS_PHASE3_QUESTION:         (sid, wid) => `/teacher/student/${sid}/level1/days/phase3-question/${wid}`,
  DAYS_SPINNING_WHEEL:          (sid, ids) => `/teacher/student/${sid}/level1/days/spinning-wheel${ids?.length ? `?attempted_word_ids=${ids.join(',')}` : ''}`,
  DAYS_SPINNING_WHEEL_ATTEMPT:  (sid) => `/teacher/student/${sid}/level1/days/spinning-wheel/attempt`,

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
  CONCEPT_GAME_START:         '/teacher/concepts/game/start',
  CONCEPT_GAME_COMPLETE:      '/teacher/concepts/game/complete',
  CONCEPT_COLORING_SAVE:      '/teacher/concepts/tier3/coloring',
  CONCEPT_COLORING_LIST:      (studentId) => `/teacher/concepts/coloring/${studentId}`,
  CONCEPT_DISTRACTORS:        '/teacher/concepts/distractors',

  // Concept Learning – cross-concept activities
  CONCEPT_ACTIVITY_STATUS:    (cat) => `/teacher/concepts/${cat}/activity/status`,
  CONCEPT_ACTIVITY_START:     '/teacher/concepts/activity/start',
  CONCEPT_ACTIVITY_ATTEMPT:   '/teacher/concepts/activity/attempt',
  CONCEPT_ACTIVITY_COMPLETE:  '/teacher/concepts/activity/complete',
};
