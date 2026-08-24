/**
 * reportPeriod.js
 *
 * Proposal FR-19, Phase 7C — pure, framework-free period-range logic for
 * the periodic report's UI. Mirrors the backend's own UTC/inclusive
 * semantics (auriva-backend/src/utils/reportDateRange.js) so a preset
 * computed here and the server's own interpretation of the resulting
 * start_date/end_date strings always agree — but this module is a
 * CONVENIENCE for the UI only; the server remains the sole authority on
 * validity (spec §3 — never trust client-side validation for anything
 * that matters).
 */

'use strict';

import { REPORT_PERIOD_PRESETS, MAX_RANGE_DAYS } from '../constants/reportPeriodPolicy';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyUtcString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * 'YYYY-MM-DD' -> Date at UTC midnight. Returns null for anything invalid.
 *
 * Lives here rather than in the ReportDateField component so it stays
 * dependency-free and directly unit-testable under this repo's plain-node
 * jest config (importing it from a component would drag in react-native and
 * the native date picker). Same reasoning as letterMotorPatternLabels.js.
 */
export function parseDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects impossible days that Date rolls over (e.g. 2026-02-31 -> Mar 3).
  return toDateOnlyUtcString(date) === value ? date : null;
}

/** Date -> 'YYYY-MM-DD' in UTC. */
export function formatDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return toDateOnlyUtcString(date);
}

/**
 * Clamps a candidate date into [min, max]. The native picker already prevents
 * out-of-range selection, but Android's spinner variant can still report an
 * edge value, and a caller may pass a stored value predating the bounds.
 */
export function clampDate(date, minDate, maxDate) {
  if (!date) return null;
  if (minDate && date.getTime() < minDate.getTime()) return minDate;
  if (maxDate && date.getTime() > maxDate.getTime()) return maxDate;
  return date;
}

/** Today at UTC midnight — the latest day a report period may cover. */
export function startOfTodayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Normalizes any timestamp the API may return for a student's registration
 * (ISO string, epoch number, or Date) to a `YYYY-MM-DD` UTC date-only string.
 * Returns null for a missing/unparseable value so callers can fall back to
 * "no lower bound" rather than to a wrong one.
 */
export function toDateOnly(value) {
  if (value == null) return null;
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toDateOnlyUtcString(date);
}

/**
 * @param {string} presetKey — one of REPORT_PERIOD_PRESETS' keys, never 'custom'.
 * @param {Date} [now]
 * @returns {{startDate: string, endDate: string}|null} null for 'custom' or an unknown key.
 */
export function computePresetRange(presetKey, now = new Date()) {
  const preset = REPORT_PERIOD_PRESETS.find((p) => p.key === presetKey);
  if (!preset || preset.days == null) return null;

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startUtc = new Date(todayUtc.getTime() - (preset.days - 1) * 24 * 60 * 60 * 1000);

  return { startDate: toDateOnlyUtcString(startUtc), endDate: toDateOnlyUtcString(todayUtc) };
}

/**
 * Client-side pre-validation for the Custom period fields — a friendly
 * early error only. Mirrors (does not replace) the server's own rules.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateCustomRange(startDateStr, endDateStr, now = new Date(), minDate = null) {
  if (!startDateStr || !endDateStr) {
    return { ok: false, error: 'Please select both a start and end date.' };
  }
  if (!DATE_ONLY_RE.test(startDateStr) || !DATE_ONLY_RE.test(endDateStr)) {
    return { ok: false, error: 'Dates must be in YYYY-MM-DD format.' };
  }
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end   = new Date(`${endDateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Please enter valid dates.' };
  }

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (start.getTime() > todayUtc.getTime()) {
    return { ok: false, error: 'Start date cannot be in the future.' };
  }
  // The END date was previously allowed to run past today and was silently
  // clamped in the range-length calculation below. A future end date is now
  // rejected outright so the label and the report can never disagree about
  // what period was actually covered.
  if (end.getTime() > todayUtc.getTime()) {
    return { ok: false, error: 'End date cannot be in the future.' };
  }
  // No data can exist before the student was registered, so a range starting
  // earlier is misleading rather than merely empty. Optional: callers without
  // a known registration date pass null and keep the previous behaviour.
  if (minDate instanceof Date && !Number.isNaN(minDate.getTime()) && start.getTime() < minDate.getTime()) {
    return {
      ok: false,
      error: `Start date cannot be before the student joined (${toDateOnlyUtcString(minDate)}).`,
    };
  }
  if (start.getTime() > end.getTime()) {
    return { ok: false, error: 'Start date must be on or before the end date.' };
  }

  const rangeDays = Math.round((Math.min(end.getTime(), todayUtc.getTime()) - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return { ok: false, error: `Date range is too large (max ${MAX_RANGE_DAYS} days).` };
  }

  return { ok: true };
}

/**
 * @param {string} presetKey
 * @param {{startDate: string, endDate: string}} customRange — only read when presetKey === 'custom'.
 * @param {Date} [now]
 * @returns {{startDate: string, endDate: string}|null}
 */
export function resolvePeriodRange(presetKey, customRange, now = new Date()) {
  if (presetKey === 'custom') {
    if (!customRange?.startDate || !customRange?.endDate) return null;
    const validation = validateCustomRange(customRange.startDate, customRange.endDate, now);
    return validation.ok ? { startDate: customRange.startDate, endDate: customRange.endDate } : null;
  }
  return computePresetRange(presetKey, now);
}

/** A short, human-readable label for the currently-resolved range. */
export function formatPeriodLabel(presetKey, range) {
  const preset = REPORT_PERIOD_PRESETS.find((p) => p.key === presetKey);
  if (presetKey !== 'custom' && preset) return `Last ${preset.label}`;
  if (!range) return 'Custom Range';
  return `${range.startDate} to ${range.endDate}`;
}
