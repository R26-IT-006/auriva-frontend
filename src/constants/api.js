import Constants from "expo-constants";

const DEFAULT_API_BASE_URL = "http://192.168.8.152:3000/api";

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
  TEACHER_SESSION_START: "/teacher/session/start",
  TEACHER_SESSION_END: "/teacher/session/end",
  TEACHER_STUDENT_AVATAR: (id) => `/teacher/students/${id}/avatar`,
  TEACHER_PRONUNCIATION_SCORE: (id) =>
    `/teacher/students/${id}/pronunciation-score`,
  TEACHER_PRONUNCIATION_RESULTS: (id) =>
    `/teacher/students/${id}/pronunciation-results`,
  TEACHER_PRONUNCIATION_RESULT_AUDIO: (id) =>
    `/teacher/pronunciation-results/${id}/audio`,
};
