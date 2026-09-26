/**
 * reportPeriodPolicy.js
 *
 * Proposal FR-19, Phase 7C — centralized period presets for the periodic
 * report (spec §2/§14). Flexible periods, not a hardcoded 6-month-only
 * report — "Last 6 Months" is one preset among several, satisfying the
 * proposal's "e.g. every 6 months" example without limiting the feature to
 * it.
 *
 * MAX_RANGE_DAYS mirrors (does not re-derive) the backend's own
 * MAX_RANGE_DAYS (auriva-backend/src/utils/reportDateRange.js) — used only
 * for an early, friendly client-side error; the server remains the sole
 * authority on what is actually accepted.
 */

'use strict';

export const REPORT_PERIOD_PRESETS = Object.freeze([
  { key: 'last_7_days',   label: '7 Days',   days: 7 },
  { key: 'last_30_days',  label: '30 Days',  days: 30 },
  { key: 'last_3_months', label: '3 Months', days: 90 },
  { key: 'last_6_months', label: '6 Months', days: 180 },
  { key: 'custom',        label: 'Custom',   days: null },
]);

export const DEFAULT_REPORT_PRESET_KEY = 'last_30_days';

// PILOT / ENGINEERING DEFAULT — mirrors the backend's own cap; see that
// module's header for the full rationale.
export const MAX_RANGE_DAYS = 730;
