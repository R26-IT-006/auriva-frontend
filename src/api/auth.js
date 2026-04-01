import client from './client';
import { ENDPOINTS } from '../constants/api';

export const authApi = {
  /**
   * Login as principal or teacher
   * @param {'principal'|'teacher'} role
   * @param {string} identifier - username (principal) or email (teacher)
   * @param {string} password
   */
  async login(role, identifier, password) {
    const body =
      role === 'principal'
        ? { role, username: identifier, password }
        : { role, email: identifier, password };

    const { data } = await client.post(ENDPOINTS.LOGIN, body);
    return data; // { token }
  },

  /**
   * Set new password on first teacher login
   * @param {string} newPassword
   */
  async setPassword(newPassword) {
    const { data } = await client.post(ENDPOINTS.SET_PASSWORD, { newPassword });
    return data; // { message, token }
  },

  /**
   * Request a password reset OTP to be sent to the given email
   * @param {string} email
   */
  async forgotPassword(email) {
    const { data } = await client.post(ENDPOINTS.FORGOT_PASSWORD, { email });
    return data; // { message }
  },

  /**
   * Verify OTP and receive a short-lived reset token
   * @param {string} email
   * @param {string} otp
   */
  async verifyOtp(email, otp) {
    const { data } = await client.post(ENDPOINTS.VERIFY_OTP, { email, otp });
    return data; // { reset_token }
  },

  /**
   * Reset password using the reset token from verifyOtp
   * @param {string} resetToken
   * @param {string} newPassword
   */
  async resetPassword(resetToken, newPassword) {
    const { data } = await client.post(
      ENDPOINTS.RESET_PASSWORD,
      { newPassword },
      { headers: { Authorization: `Bearer ${resetToken}` } }
    );
    return data; // { message }
  },
};
