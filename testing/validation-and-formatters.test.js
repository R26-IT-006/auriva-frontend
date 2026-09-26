import {
  validatePassword,
  validateEmail,
  validatePhone,
  validateDate,
} from '../src/utils/validation';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  getInitials,
  formatCode,
} from '../src/utils/formatters';

describe('frontend validation utilities', () => {
  test('accepts a password satisfying every documented rule', () => {
    const result = validatePassword('StrongPass9!');
    expect(result.isValid).toBe(true);
    expect(Object.values(result.rules)).toEqual([true, true, true, true, true]);
  });

  test.each([
    ['Short1!', 'minLength'],
    ['lowercase9!', 'hasUppercase'],
    ['UPPERCASE9!', 'hasLowercase'],
    ['NoNumber!', 'hasNumber'],
    ['NoSpecial9', 'hasSpecial'],
  ])('rejects %s when %s is absent', (password, failedRule) => {
    const result = validatePassword(password);
    expect(result.isValid).toBe(false);
    expect(result.rules[failedRule]).toBe(false);
  });

  test.each(['teacher@example.com', 'first.last+tag@school.edu'])('accepts valid email %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  test.each(['teacher@', '@example.com', 'has space@example.com', 'plain-address'])('rejects invalid email %s', (email) => {
    expect(validateEmail(email)).toBe(false);
  });

  test('phone is optional and accepts common international punctuation', () => {
    expect(validatePhone('')).toBe(true);
    expect(validatePhone(null)).toBe(true);
    expect(validatePhone('+94 77 1234567')).toBe(true);
    expect(validatePhone('12abc')).toBe(false);
  });

  test('date validation distinguishes usable values from empty or invalid dates', () => {
    expect(validateDate('2020-02-29')).toBe(true);
    expect(validateDate('not-a-date')).toBe(false);
    expect(validateDate('')).toBe(false);
  });
});

describe('frontend formatting utilities', () => {
  test('date and date-time formatters return an em dash for missing values', () => {
    expect(formatDate()).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  test('formatDate emits a stable English month/day/year value', () => {
    expect(formatDate('2024-01-15T12:00:00Z')).toContain('Jan');
    expect(formatDate('2024-01-15T12:00:00Z')).toContain('2024');
  });

  test('formatDuration supports minutes, hours, and missing start times', () => {
    expect(formatDuration()).toBe('—');
    expect(formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:42:00Z')).toBe('42m');
    expect(formatDuration('2024-01-01T10:00:00Z', '2024-01-01T12:15:00Z')).toBe('2h 15m');
  });

  test('getInitials uses at most two words and handles missing names', () => {
    expect(getInitials('Alex Nimal Perera')).toBe('AN');
    expect(getInitials('lily')).toBe('L');
    expect(getInitials()).toBe('?');
  });

  test('formatCode preserves zero and falls back only for nullish values', () => {
    expect(formatCode('STU-0012')).toBe('STU-0012');
    expect(formatCode(0)).toBe(0);
    expect(formatCode(null)).toBe('—');
  });
});
