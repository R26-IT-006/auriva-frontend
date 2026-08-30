import Constants from "expo-constants";

// Physical device on same WiFi → machine's LAN IP, e.g. http://192.168.1.180:3000/api
// Android emulator → 10.0.2.2 maps to the host machine's localhost
// iOS simulator → http://localhost:3000/api
// This is only the last-resort fallback: an EXPO_PUBLIC_API_BASE_URL env var or
// the Expo host detected below both take precedence, so it rarely applies.
const DEFAULT_API_BASE_URL = "http://10.15.2.86:3000/api";

function normalizeApiBaseUrl(value) {
  if (!value) return DEFAULT_API_BASE_URL;
  return String(value).replace(/\/+$/, "");
}

function getExpoHostApiBaseUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;
  const host = hostUri?.split(":")?.[0];

  if (!host || host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  return `http://${host}:3000/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    getExpoHostApiBaseUrl() ||
    Constants.expoConfig?.extra?.apiBaseUrl ||
    DEFAULT_API_BASE_URL,
);

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
  // Initial Motor Assessment scoring audit — read-only Feature 1 baseline
  // fetch, used to show the AUTHORITATIVE persisted assessment result when
  // the in-memory assessmentData from the just-completed session is no
  // longer available (e.g. reopening "Assessment Summary" in a later app
  // session). Never duplicates the scoring formula — this is a straight
  // read of what motorBaselineService.js already persisted.
  MOTOR_BASELINE:             (studentId) => `/handwriting/motor-baseline/${studentId}`,
  // Read-only explanation of the CURRENT progression decision per movement
  // family — the rule, the evidence window, teacher-override protection and a
  // rule-derived counterfactual. Explanation only: it changes no decision and
  // writes nothing. Teacher-facing only.
  THRESHOLD_TRACE:            (studentId) => `/handwriting/threshold-trace/${studentId}`,
  // Legacy experimental L2 shape-motor clustering. Retained for
  // research/reference compatibility only. It is not used by the current
  // teacher-facing baseline summary and does not influence adaptive
  // progression.
  //
  // TeacherReportScreen's former "Initial Shape Motor Profile" section is now
  // the "Initial Motor Baseline Summary", served by MOTOR_BASELINE above.
  // This constant is kept so the legacy endpoint stays reachable for
  // research/legacy inspection; no active screen references it.
  //
  // Feature 11A pilot model — read-only INITIAL motor-cluster prediction
  // (motor_cluster_v1), computed from the SAME baseline MOTOR_BASELINE
  // exposes.
  MOTOR_CLUSTER:              (studentId) => `/handwriting/motor-cluster/${studentId}`,
  HANDWRITING_ASSESSMENT:     '/handwriting/assessment',
  PRE_WRITING_ACTIVITY:       '/handwriting/pre-writing-activity',
  HANDWRITING_FINALIZE:       (id)       => `/handwriting/assessment/${id}/finalize`,
  HANDWRITING_INITIAL_REPORT: (studentId) => `/handwriting/initial-report/${studentId}`,
  LETTER_COMPLETE:            '/handwriting/letter-complete',
  LETTER_PROGRESS:            (studentId) => `/handwriting/progress/${studentId}`,
  LETTER_PROGRESS_REPORT:     (studentId) => `/handwriting/letter-progress-report/${studentId}`,
  // Feature 11B Phase 5 — normal-progression fix, NOT a Feature 11B
  // adaptation change: the authoritative (backend LetterProgress) list of
  // every (letter, caseType) pair this student has mastered, used to skip
  // already-mastered letters and resume at the first remaining one.
  MASTERED_LETTERS:           (studentId) => `/handwriting/mastered-letters/${studentId}`,
  // Proposal FR-16, Phase 7B — real-time (near-real-time, ~5s snapshot
  // polling) teacher session monitoring. PUT from the child-side learning
  // screens (via LearningSessionContext.js), GET from the teacher's Live
  // Handwriting Session card. Same student-scoped path convention as every
  // other endpoint on this list.
  LIVE_SESSION:                (studentId) => `/handwriting/live-session/${studentId}`,
  // Proposal FR-19/FR-20, Phase 7C/7D — periodic progress report. Explicit
  // start_date/end_date (YYYY-MM-DD) query params — see the backend's
  // utils/reportDateRange.js for exact UTC/inclusive semantics.
  PERIODIC_REPORT:              (studentId, startDate, endDate) =>
    `/handwriting/report/${studentId}?start_date=${startDate}&end_date=${endDate}`,
  // Feature 11B Phase 5 — read-only mastery-based Letter Motor State.
  LETTER_MOTOR_STATE_LATEST:  (studentId) => `/handwriting/letter-motor-state/latest/${studentId}`,
  LETTER_MOTOR_STATE_HISTORY: (studentId) => `/handwriting/letter-motor-state/history/${studentId}`,
  LETTER_MOTOR_EVIDENCE_TREND: (studentId) => `/handwriting/letter-motor-evidence-trend/${studentId}`,
  // Feature 11B S2 — milestone evaluation log, including reference-range
  // rejections (which persist no pattern row).
  LETTER_MOTOR_EVALUATIONS: (studentId) => `/handwriting/letter-motor-evaluations/${studentId}`,
  // Writing Check — the dedicated teacher-initiated route for the frozen
  // letter motor pattern model. Descriptive assessment only.
  WRITING_CHECK_START:    () => '/handwriting/writing-check/start',
  WRITING_CHECK_PROGRESS: (checkId) => `/handwriting/writing-check/${checkId}/progress`,
  WRITING_CHECK_COMPLETE: (checkId) => `/handwriting/writing-check/${checkId}/complete`,
  WRITING_CHECK_HISTORY:  (studentId) => `/handwriting/writing-check/history/${studentId}`,
  // Homework practice worksheets — teacher-facing throughout.
  WORKSHEET_CANDIDATES: (studentId) => `/handwriting/worksheets/candidates/${studentId}`,
  WORKSHEET_HISTORY:    (studentId) => `/handwriting/worksheets/${studentId}`,
  WORKSHEET_GENERATE:   () => '/handwriting/worksheets/generate',
  WORKSHEET_ASSIGN:     (worksheetId) => `/handwriting/worksheets/${worksheetId}/assign`,
  WORKSHEET_SUBMIT:     (worksheetId) => `/handwriting/worksheets/${worksheetId}/submit`,
  WORKSHEET_REVIEW:     (submissionId) => `/handwriting/worksheet-submissions/${submissionId}/review`,
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
  // One mastered letter's actual writing, for the teacher report's Letter
  // Details panel. Same (student, letter, caseType) scope as
  // SUPPORT_RECOMMENDATION below; deliberately NOT part of any bulk report
  // payload - stroke_points is far too large to send 52 of.
  LETTER_MASTERY_EVIDENCE:    (studentId, letter, caseType) => `/handwriting/letter-mastery-evidence/${studentId}/${letter}/${caseType}`,
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
  DIALOGUE_WORD_BY_ID:              (wid) => `/teacher/word/${wid}`,
  DIALOGUE_TRAJECTORY:              (sid, wid) => `/teacher/student/${sid}/word/${wid}/trajectory`,

  // Dialogue – TASK-43 explainable trajectory predictions (teacher reports).
  // The report screen calls the batch endpoint; the per-word one explains a
  // single word.
  DIALOGUE_TRAJECTORY_EXPLAIN:      (sid, wid) => `/teacher/student/${sid}/word/${wid}/trajectory/explain`,
  DIALOGUE_TRAJECTORY_REPORT:       (sid) => `/teacher/student/${sid}/dialogue/trajectory-report`,

  // Dialogue – TASK-47 practice-trend timelines (module-level and per-word).
  DIALOGUE_TIMELINE:                (sid) => `/teacher/student/${sid}/dialogue/timeline`,
  DIALOGUE_WORD_TIMELINE:           (sid, wid) => `/teacher/student/${sid}/word/${wid}/dialogue/timeline`,

  // Dialogue – TASK-12 Non-Verbal Adaptive Wait-Time Escalation
  DIALOGUE_SPEECH_STATE:            (sid) => `/teacher/student/${sid}/speech-state`,

  // Dialogue – Rule 5 periodic production probe (TASK-37/TASK-39)
  DIALOGUE_PROBE_CANDIDATE: (sid) => `/teacher/student/${sid}/level1/probe-candidate`,
  DIALOGUE_PROBE_RESULT:    (sid, wid) => `/teacher/student/${sid}/level1/word/${wid}/probe-result`,

  // Dialogue – Level 1 Evaluations (TASK-15)
  DIALOGUE_EVALUATIONS_STATUS: (sid) => `/teacher/dialogue/evaluations/${sid}`,
  DIALOGUE_EVALUATIONS_BUILD:  (sid, category) => `/teacher/dialogue/evaluations/${sid}/${category}`,
  DIALOGUE_EVALUATIONS_RECORD: (sid, category) => `/teacher/dialogue/evaluations/${sid}/${category}`,

  // Days of the Week – specific endpoints
  DAYS_PHASE3_QUESTION:         (sid, wid) => `/teacher/student/${sid}/level1/days/phase3-question/${wid}`,
  DAYS_SPINNING_WHEEL:          (sid, ids) => `/teacher/student/${sid}/level1/days/spinning-wheel${ids?.length ? `?attempted_word_ids=${ids.join(',')}` : ''}`,
  DAYS_SPINNING_WHEEL_ATTEMPT:  (sid) => `/teacher/student/${sid}/level1/days/spinning-wheel/attempt`,

  // Dialogue – Level 2
  LEVEL2_QUESTIONNAIRE:         (sid) => `/teacher/student/${sid}/level2/questionnaire`,
  // TASK-46 — teacher-facing Level 2 report, all three topics in one call.
  LEVEL2_REPORT:                (sid) => `/teacher/student/${sid}/level2/report`,
  // TASK-47 — practice-trend timelines (module-level and per-topic).
  LEVEL2_TIMELINE:              (sid) => `/teacher/student/${sid}/level2/timeline`,
  LEVEL2_TOPIC_TIMELINE:        (sid, topic) => `/teacher/student/${sid}/level2/topic/${topic}/timeline`,
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
  TEACHER_SESSION_START: "/teacher/session/start",
  TEACHER_SESSION_END: "/teacher/session/end",
  TEACHER_STUDENT_SENSORY_SETTINGS: (id) =>
    `/teacher/students/${id}/sensory-settings`,
  TEACHER_PRONUNCIATION_SCORE: (id) =>
    `/teacher/students/${id}/pronunciation-score`,
  TEACHER_PRONUNCIATION_RESULTS: (id) =>
    `/teacher/students/${id}/pronunciation-results`,
  TEACHER_PRONUNCIATION_RESULT_AUDIO: (id) =>
    `/teacher/pronunciation-results/${id}/audio`,
};
