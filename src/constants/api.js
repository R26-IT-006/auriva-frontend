// For Android emulator: http://10.0.2.2:3000/api
// For iOS simulator: http://localhost:3000/api
// For physical device: use your machine's local IP
export const API_BASE_URL = "http://172.28.8.178:3000/api";

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
  TEACHER_SESSION_START: '/teacher/session/start',
  TEACHER_SESSION_END: '/teacher/session/end',
  TEACHER_STUDENT_AVATAR: (id) => `/teacher/students/${id}/avatar`,

  // Handwriting
  HANDWRITING_ASSESSMENT:     '/handwriting/assessment',
  PRE_WRITING_ACTIVITY:       '/handwriting/pre-writing-activity',
  HANDWRITING_FINALIZE:       (id)       => `/handwriting/assessment/${id}/finalize`,
  HANDWRITING_INITIAL_REPORT: (studentId) => `/handwriting/initial-report/${studentId}`,
  LETTER_COMPLETE:            '/handwriting/letter-complete',
  LETTER_PROGRESS:            (studentId) => `/handwriting/progress/${studentId}`,
  LETTER_PROGRESS_REPORT:     (studentId) => `/handwriting/letter-progress-report/${studentId}`,
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
};
