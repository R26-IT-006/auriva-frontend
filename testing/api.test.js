import client from '../src/api/client';
import { authApi } from '../src/api/auth';
import { ENDPOINTS } from '../src/constants/api';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null, manifest2: null, manifest: null },
}));

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('authentication API contract', () => {
  test('principal login sends username while teacher login sends email', async () => {
    client.post.mockResolvedValueOnce({ data: { token: 'principal-token' } });
    await expect(authApi.login('principal', 'principal01', 'secret')).resolves.toEqual({ token: 'principal-token' });
    expect(client.post).toHaveBeenLastCalledWith(ENDPOINTS.LOGIN, {
      role: 'principal', username: 'principal01', password: 'secret',
    });

    client.post.mockResolvedValueOnce({ data: { token: 'teacher-token' } });
    await authApi.login('teacher', 'teacher@example.com', 'secret');
    expect(client.post).toHaveBeenLastCalledWith(ENDPOINTS.LOGIN, {
      role: 'teacher', email: 'teacher@example.com', password: 'secret',
    });
  });

  test('set password and forgot password return response data', async () => {
    client.post.mockResolvedValueOnce({ data: { message: 'set' } });
    await expect(authApi.setPassword('StrongPass9')).resolves.toEqual({ message: 'set' });
    expect(client.post).toHaveBeenLastCalledWith(ENDPOINTS.SET_PASSWORD, { newPassword: 'StrongPass9' });

    client.post.mockResolvedValueOnce({ data: { message: 'sent' } });
    await expect(authApi.forgotPassword('a@b.com')).resolves.toEqual({ message: 'sent' });
    expect(client.post).toHaveBeenLastCalledWith(ENDPOINTS.FORGOT_PASSWORD, { email: 'a@b.com' });
  });

  test('OTP verification and reset password use the expected credential placement', async () => {
    client.post.mockResolvedValueOnce({ data: { reset_token: 'reset-1' } });
    await authApi.verifyOtp('a@b.com', '123456');
    expect(client.post).toHaveBeenLastCalledWith(ENDPOINTS.VERIFY_OTP, { email: 'a@b.com', otp: '123456' });

    client.post.mockResolvedValueOnce({ data: { message: 'done' } });
    await authApi.resetPassword('reset-1', 'NewStrong9');
    expect(client.post).toHaveBeenLastCalledWith(
      ENDPOINTS.RESET_PASSWORD,
      { newPassword: 'NewStrong9' },
      { headers: { Authorization: 'Bearer reset-1' } },
    );
  });
});

describe('dynamic API endpoint construction', () => {
  test('constructs principal and teacher resource URLs', () => {
    expect(ENDPOINTS.PRINCIPAL_TEACHER(7)).toBe('/principal/teachers/7');
    expect(ENDPOINTS.PRINCIPAL_ASSIGN_STUDENT('STU-1')).toBe('/principal/students/STU-1/assign');
    expect(ENDPOINTS.TEACHER_PRONUNCIATION_SCORE(5)).toBe('/teacher/students/5/pronunciation-score');
    expect(ENDPOINTS.TEACHER_PRONUNCIATION_REVIEW(9)).toBe('/teacher/pronunciation-results/9/review');
  });

  test('adds spinning-wheel attempts only when IDs exist', () => {
    expect(ENDPOINTS.DAYS_SPINNING_WHEEL(2, [])).toBe('/teacher/student/2/level1/days/spinning-wheel');
    expect(ENDPOINTS.DAYS_SPINNING_WHEEL(2, ['a', 'b'])).toBe(
      '/teacher/student/2/level1/days/spinning-wheel?attempted_word_ids=a,b',
    );
  });
});
