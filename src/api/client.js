import axios from 'axios';
import { API_BASE_URL } from '../constants/api';
import { storage } from '../utils/storage';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  adapter: 'fetch',
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
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;
    if (response) {
      const message =
        response.data?.message ||
        response.data?.error ||
        `Request failed with status ${response.status}`;
      const details = response.data?.details || null;
      const apiError = new Error(message);
      apiError.status = response.status;
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
