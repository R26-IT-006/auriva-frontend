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
export function validateCustomRange(startDateStr, endDateStr, now = new Date()) {
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
