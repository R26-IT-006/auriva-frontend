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
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize errors from the backend
const MAX_RETRIES  = 3;
const RETRY_DELAY  = 700; // ms between retries
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config   = error.config;
    const response = error.response;

    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      const cancellationError = new Error('Request cancelled.');
      cancellationError.code = 'REQUEST_CANCELLED';
      return Promise.reject(cancellationError);
    }

    // Only retry read-only requests. Retrying a POST/PUT/PATCH after the
    // response is lost can repeat a mutation that the backend already
    // completed (pronunciation scoring persists an attempt before replying).
    const method = String(config?.method || 'get').toLowerCase();
    const canRetry =
      RETRYABLE_METHODS.has(method) || config?.retryOnNetworkError === true;
    if (!response && error.code !== 'ECONNABORTED' && config && canRetry) {
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
      apiError.code    = response.data?.code || null;
      apiError.details = details;
      return Promise.reject(apiError);
    }

    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error(
        config?.timeoutMessage || 'Request timed out. Please try again.'
      );
      timeoutError.code = 'REQUEST_TIMEOUT';
      return Promise.reject(timeoutError);
    }

    return Promise.reject(new Error('Network error. Check your connection.'));
  }
);

export default client;
