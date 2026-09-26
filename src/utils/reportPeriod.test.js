import { computePresetRange, validateCustomRange, resolvePeriodRange, formatPeriodLabel } from './reportPeriod';
import { REPORT_PERIOD_PRESETS } from '../constants/reportPeriodPolicy';

const NOW = new Date('2026-08-20T15:30:00.000Z');

describe('computePresetRange', () => {
  it('Last 7 Days spans exactly 7 inclusive calendar days ending today', () => {
    const r = computePresetRange('last_7_days', NOW);
    expect(r).toEqual({ startDate: '2026-08-14', endDate: '2026-08-20' });
  });
  it('Last 30 Days', () => {
    const r = computePresetRange('last_30_days', NOW);
    expect(r.endDate).toBe('2026-08-20');
    expect(r.startDate).toBe('2026-07-22');
  });
  it('Last 6 Months (180 days) — satisfies the proposal\'s own example', () => {
    const r = computePresetRange('last_6_months', NOW);
    expect(r.endDate).toBe('2026-08-20');
  });
  it('returns null for "custom" (has no fixed day count)', () => {
    expect(computePresetRange('custom', NOW)).toBeNull();
  });
  it('returns null for an unknown key', () => {
    expect(computePresetRange('nonsense', NOW)).toBeNull();
  });
  it('all 4 fixed presets from REPORT_PERIOD_PRESETS resolve to a real range', () => {
    for (const p of REPORT_PERIOD_PRESETS) {
      if (p.key === 'custom') continue;
      expect(computePresetRange(p.key, NOW)).not.toBeNull();
    }
  });
});

describe('validateCustomRange', () => {
  it('accepts a valid past range', () => {
    expect(validateCustomRange('2026-01-01', '2026-06-30', NOW)).toEqual({ ok: true });
  });
  it('rejects missing dates', () => {
    expect(validateCustomRange(null, '2026-06-30', NOW).ok).toBe(false);
    expect(validateCustomRange('2026-01-01', undefined, NOW).ok).toBe(false);
  });
  it('rejects malformed dates', () => {
    expect(validateCustomRange('01/01/2026', '2026-06-30', NOW).ok).toBe(false);
  });
  it('rejects a future-only start date', () => {
    expect(validateCustomRange('2026-09-01', '2026-09-30', NOW).ok).toBe(false);
  });
  it('rejects start > end', () => {
    expect(validateCustomRange('2026-06-30', '2026-01-01', NOW).ok).toBe(false);
  });
  it('rejects an excessively large range', () => {
    expect(validateCustomRange('2015-01-01', '2026-08-20', NOW).ok).toBe(false);
  });
});

describe('resolvePeriodRange', () => {
  it('resolves a preset directly', () => {
    expect(resolvePeriodRange('last_7_days', null, NOW)).toEqual({ startDate: '2026-08-14', endDate: '2026-08-20' });
  });
  it('resolves a valid custom range', () => {
    expect(resolvePeriodRange('custom', { startDate: '2026-01-01', endDate: '2026-01-31' }, NOW))
      .toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
  });
  it('returns null for an invalid custom range rather than a garbage value', () => {
    expect(resolvePeriodRange('custom', { startDate: '2026-09-01', endDate: '2026-09-30' }, NOW)).toBeNull();
  });
  it('returns null for an incomplete custom range', () => {
    expect(resolvePeriodRange('custom', { startDate: '2026-01-01', endDate: null }, NOW)).toBeNull();
  });
});

describe('formatPeriodLabel', () => {
  it('labels a fixed preset by its own name', () => {
    expect(formatPeriodLabel('last_6_months', { startDate: '2026-02-21', endDate: '2026-08-20' })).toBe('Last 6 Months');
  });
  it('labels a custom range by its actual dates', () => {
    expect(formatPeriodLabel('custom', { startDate: '2026-01-01', endDate: '2026-01-31' })).toBe('2026-01-01 to 2026-01-31');
  });
});
