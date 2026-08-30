// Custom report period bounds.
//
// The Custom range must not be able to cover days before the student was
// registered (no data can exist) or days in the future (the report describes
// what happened). The native picker makes those days unselectable; these tests
// pin the pure logic behind it, which is the part that still has to hold when
// a range arrives from anywhere other than the picker.

import {
  validateCustomRange, startOfTodayUtc, toDateOnly,
  parseDateOnly, formatDateOnly, clampDate,
} from './reportPeriod';

const NOW = new Date('2026-08-25T09:30:00.000Z');
const TODAY = '2026-08-25';
const REGISTERED = new Date('2026-06-01T00:00:00.000Z');

describe('startOfTodayUtc', () => {
  it('returns today at UTC midnight, discarding the time of day', () => {
    expect(startOfTodayUtc(NOW).toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });
});

describe('toDateOnly', () => {
  it.each([
    ['ISO timestamp', '2026-06-01T13:45:12.000Z', '2026-06-01'],
    ['already date-only', '2026-06-01', '2026-06-01'],
    ['Date object', new Date('2026-06-01T23:59:59.000Z'), '2026-06-01'],
  ])('normalizes a %s', (_label, input, expected) => {
    expect(toDateOnly(input)).toBe(expected);
  });

  it.each([
    ['null', null], ['undefined', undefined], ['empty string', ''], ['garbage', 'not-a-date'],
  ])('returns null for %s so callers fall back to no lower bound', (_label, input) => {
    expect(toDateOnly(input)).toBeNull();
  });
});

describe('validateCustomRange — registration lower bound', () => {
  it('accepts a range starting exactly on the registration day (inclusive)', () => {
    expect(validateCustomRange('2026-06-01', TODAY, NOW, REGISTERED)).toEqual({ ok: true });
  });

  it('rejects a start date before the student joined, and names the date', () => {
    const result = validateCustomRange('2026-05-31', '2026-06-10', NOW, REGISTERED);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Start date cannot be before the student joined (2026-06-01).');
  });

  it('keeps the previous behaviour when no registration date is known', () => {
    // The child-side flow can reach the report with a lighter student object;
    // an unknown registration date must not block the teacher.
    expect(validateCustomRange('2020-01-01', '2020-01-31', NOW, null)).toEqual({ ok: true });
  });
});

describe('validateCustomRange — future upper bound', () => {
  it('accepts an end date of today (inclusive)', () => {
    expect(validateCustomRange('2026-08-01', TODAY, NOW, REGISTERED)).toEqual({ ok: true });
  });

  it('rejects an end date in the future rather than silently clamping it', () => {
    const result = validateCustomRange('2026-08-01', '2026-09-01', NOW, REGISTERED);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('End date cannot be in the future.');
  });

  it('still rejects a future start date', () => {
    const result = validateCustomRange('2026-09-01', '2026-09-10', NOW, REGISTERED);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Start date cannot be in the future.');
  });

  it('still rejects an inverted range', () => {
    const result = validateCustomRange('2026-08-10', '2026-08-01', NOW, REGISTERED);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Start date must be on or before the end date.');
  });
});

describe('date-only helpers', () => {
  it('parses and formats date-only strings in UTC', () => {
    expect(formatDateOnly(parseDateOnly('2026-08-25'))).toBe('2026-08-25');
  });

  it.each([
    ['null', null], ['bad format', '25-08-2026'], ['non-string', 20260825], ['impossible date', '2026-13-45'],
  ])('parseDateOnly returns null for %s', (_label, input) => {
    expect(parseDateOnly(input)).toBeNull();
  });

  it('clamps a value below the minimum up to the minimum', () => {
    const clamped = clampDate(parseDateOnly('2026-01-01'), REGISTERED, startOfTodayUtc(NOW));
    expect(formatDateOnly(clamped)).toBe('2026-06-01');
  });

  it('clamps a value above the maximum down to the maximum', () => {
    const clamped = clampDate(parseDateOnly('2027-01-01'), REGISTERED, startOfTodayUtc(NOW));
    expect(formatDateOnly(clamped)).toBe(TODAY);
  });

  it('leaves an in-range value untouched', () => {
    const clamped = clampDate(parseDateOnly('2026-07-04'), REGISTERED, startOfTodayUtc(NOW));
    expect(formatDateOnly(clamped)).toBe('2026-07-04');
  });

  it('does not shift the day across a UTC boundary', () => {
    // A local-time round-trip would move this to the 24th or 26th for
    // teachers east/west of UTC; the whole pipeline is UTC date-only.
    expect(formatDateOnly(parseDateOnly(TODAY))).toBe(TODAY);
    expect(toDateOnly('2026-08-25T23:59:59.999Z')).toBe(TODAY);
  });
});
