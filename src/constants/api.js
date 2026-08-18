// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
// Physical device on same WiFi → use machine's LAN IP
// Android emulator → 10.0.2.2 maps to host machine's localhost
export const API_BASE_URL = "http://192.168.1.8:3000/api";

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
  // Initial Motor Assessment scoring audit — read-only Feature 1 baseline
  // fetch, used to show the AUTHORITATIVE persisted assessment result when
  // the in-memory assessmentData from the just-completed session is no
  // longer available (e.g. reopening "Assessment Summary" in a later app
  // session). Never duplicates the scoring formula — this is a straight
  // read of what motorBaselineService.js already persisted.
  MOTOR_BASELINE:             (studentId) => `/handwriting/motor-baseline/${studentId}`,
  HANDWRITING_ASSESSMENT:     '/handwriting/assessment',
  PRE_WRITING_ACTIVITY:       '/handwriting/pre-writing-activity',
  HANDWRITING_FINALIZE:       (id)       => `/handwriting/assessment/${id}/finalize`,
  HANDWRITING_INITIAL_REPORT: (studentId) => `/handwriting/initial-report/${studentId}`,
  LETTER_COMPLETE:            '/handwriting/letter-complete',
  LETTER_PROGRESS:            (studentId) => `/handwriting/progress/${studentId}`,
  LETTER_PROGRESS_REPORT:     (studentId) => `/handwriting/letter-progress-report/${studentId}`,
  WORD_ATTEMPT:               '/handwriting/word-attempt',
  WORD_ACTIVITY:              '/handwriting/word-activity',
  WORD_PROGRESS:              (studentId) => `/handwriting/word-progress/${studentId}`,
  WORD_ATTEMPTS:              (studentId) => `/handwriting/word-attempts/${studentId}`,
  WORD_REPORT:                (studentId) => `/handwriting/word-report/${studentId}`,
  // Teacher Dashboard integration fix — read-only, all three current
  // Feature 2 family thresholds together (never the legacy
  // /teacher/students/:id personal_thresholds shape).
  FAMILY_THRESHOLDS:          (studentId) => `/handwriting/family-thresholds/${studentId}`,
  // Feature 3 Step 6 — read-only adaptive support recommendation, scoped to
  // one (student, letter, caseType) since support is family-specific.
  SUPPORT_RECOMMENDATION:     (studentId, letter, caseType) => `/handwriting/support-recommendation/${studentId}/${letter}/${caseType}`,
  // Feature 4 Step 5 — read-only adaptive pre-writing recommendation, same
  // (student, letter, caseType) scope as SUPPORT_RECOMMENDATION above.
  PRE_WRITING_RECOMMENDATION: (studentId, letter, caseType) => `/handwriting/pre-writing-recommendation/${studentId}/${letter}/${caseType}`,
  // Feature 5 Step 3 — read-only adaptive repetition recommendation, same
  // (student, letter, caseType) scope, plus the caller-supplied
  // interaction-scoped adaptiveRepetitionsUsed count as a query param.
  REPETITION_RECOMMENDATION: (studentId, letter, caseType, adaptiveRepetitionsUsed) =>
    `/handwriting/repetition-recommendation/${studentId}/${letter}/${caseType}?adaptiveRepetitionsUsed=${adaptiveRepetitionsUsed}`,
  // Feature 6 Step 3/4 — read-only adaptive demo-speed recommendation, same
  // (student, letter, caseType) scope as the recommendation endpoints above.
  DEMO_SPEED_RECOMMENDATION: (studentId, letter, caseType) => `/handwriting/demo-speed-recommendation/${studentId}/${letter}/${caseType}`,
  // Feature 8 Step 3/4 — read-only, student-wide worksheet-recommendation
  // list (one entry per Feature 7 persistent stream). Student-wide, unlike
  // the narrower per-(letter, caseType) recommendation endpoints above.
  WORKSHEET_RECOMMENDATIONS: (studentId) => `/handwriting/worksheet-recommendations/${studentId}`,
  // Feature 9 Step 4/5 — teacher validation history (GET, POST) and current
  // validation-state (GET) for Feature 8 recommendations. Path functions
  // take only :studentId, matching Step 4's exact route shape — optional/
  // required query params (?caseType=&family=&recommendationFingerprint=)
  // are attached at the call site via axios `params`, not baked into the
  // path string here (unlike REPETITION_RECOMMENDATION above), since GET
  // history's filters are independently optional while GET state's three
  // params are all required — a single manually-built query string would
  // need two different shapes for the same constant.
  WORKSHEET_RECOMMENDATION_VALIDATIONS: (studentId) => `/handwriting/worksheet-recommendation-validations/${studentId}`,
  WORKSHEET_RECOMMENDATION_VALIDATION_STATE: (studentId) => `/handwriting/worksheet-recommendation-validation-state/${studentId}`,

  // Data Collection Mode
  COLLECTION_SESSION_START:    '/handwriting/collection-session/start',
  COLLECTION_SESSION_COMPLETE: (id) => `/handwriting/collection-session/${id}/complete`,
  TEACHER_VALIDATION:          '/handwriting/teacher-validation',

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
  CONCEPT_DISTRACTORS:        '/teacher/concepts/distractors',

  // Concept Learning – cross-concept activities
  CONCEPT_ACTIVITY_STATUS:    (cat) => `/teacher/concepts/${cat}/activity/status`,
  CONCEPT_ACTIVITY_START:     '/teacher/concepts/activity/start',
  CONCEPT_ACTIVITY_ATTEMPT:   '/teacher/concepts/activity/attempt',
  CONCEPT_ACTIVITY_COMPLETE:  '/teacher/concepts/activity/complete',
};
