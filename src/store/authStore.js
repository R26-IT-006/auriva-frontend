import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authApi } from '../api/auth';

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // React Native has atob available since RN 0.73+
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  hydrate: async () => {
    try {
      const token = await storage.getToken();
      if (token) {
        const user = parseJwt(token);
        if (user) {
          set({ token, user, isAuthenticated: true, isLoading: false });
          return;
        }
        await storage.removeToken();
      }
    } catch {
      // ignore storage errors
    }
    set({ isLoading: false });
  },

  login: async (role, identifier, password) => {
    const { token } = await authApi.login(role, identifier, password);
    const user = parseJwt(token);
    await storage.setToken(token);
    set({ token, user, isAuthenticated: true });
    return user;
  },

  setPassword: async (newPassword) => {
    const { token } = await authApi.setPassword(newPassword);
    const user = parseJwt(token);
    await storage.setToken(token);
    set({ token, user });
    return user;
  },

  logout: async () => {
    await storage.removeToken();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
