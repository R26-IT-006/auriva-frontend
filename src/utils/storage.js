import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auriva_auth_token';

export const storage = {
  async getToken() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (err) {
      console.error('Failed to save token:', err);
    }
  },

  async removeToken() {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};
