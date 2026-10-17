import axios from 'axios';
import { API_BASE_URL } from '../constants/api';
import { storage } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
client.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    if (token) {
      // Attaches the stored JWT to every backend API request.
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize errors from the backend
const MAX_RETRIES  = 3;
const RETRY_DELAY  = 700; // ms between retries

// ── Which methods may be replayed automatically ──────────────────────────
//
// A network error means "no HTTP response arrived" — which is NOT the same as
// "the server never processed the request". The request may well have reached
// the server, been applied, and only the response been lost.
//
// For a GET that is harmless: replaying it reads the same state again. For a
// POST it is not. Replaying POST /handwriting/letter-complete created a SECOND
// complete practice cycle: recordLetterCompletion mints a fresh
// `sessionKey = randomUUID()` on every call, there is no idempotency key, and
// letter_attempts has no unique constraint on (session_key, attempt_number).
// letterCycleService counts cycles by distinct session_key, so the duplicate
// also consumed one of the child's three cycles for a performance they only
// gave once, and appeared in the research data as two independent cycles.
//
// So retries are now restricted to methods that are idempotent by definition.
// Everything else surfaces the network error to the caller, which is the only
// party that knows whether replaying is safe.
const RETRYABLE_METHODS = new Set(['get', 'head']);

function isRetryableMethod(config) {
  // axios lowercases `method` internally, but a hand-built config may not have;
  // default to the non-retryable branch when it is missing entirely.
  const method = typeof config?.method === 'string' ? config.method.toLowerCase() : null;
  return method != null && RETRYABLE_METHODS.has(method);
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config   = error.config;
    const response = error.response;

    // Silently retry on pure network errors (no HTTP response received).
    // This covers transient TCP/ARP failures common on local dev networks.
    //
    // Restricted to safe/idempotent methods (see RETRYABLE_METHODS above).
    // A POST/PATCH/PUT/DELETE that fails this way falls through to the
    // rejection below with the SAME error message it already produced after
    // exhausting its retries, so no caller's error handling changes shape —
    // it simply happens immediately instead of ~2.1s later.
    if (!response && error.code !== 'ECONNABORTED' && isRetryableMethod(config)) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        return client(config);
      }
      return Promise.reject(new Error('Network error. Check your connection.'));
    }

    if (response) {
      if (response.status === 401) {
        useAuthStore.getState().logout();
        return Promise.reject(new Error('Session expired. Please log in again.'));
      }
      const message =
        response.data?.message ||
        response.data?.error ||
        `Request failed with status ${response.status}`;
      const details  = response.data?.details || null;
      const apiError = new Error(message);
      apiError.status  = response.status;
      apiError.details = details;
      return Promise.reject(apiError);
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }

    return Promise.reject(new Error('Network error. Check your connection.'));
  }
);

export default client;
