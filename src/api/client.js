import axios from 'axios';
import { API_BASE_URL } from '../constants/api';
import { storage } from '../utils/storage';

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

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config   = error.config;
    const response = error.response;

    // Silently retry on pure network errors (no HTTP response received).
    // This covers transient TCP/ARP failures common on local dev networks.
    if (!response && error.code !== 'ECONNABORTED') {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        return client(config);
      }
      return Promise.reject(new Error('Network error. Check your connection.'));
    }

    if (response) {
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
