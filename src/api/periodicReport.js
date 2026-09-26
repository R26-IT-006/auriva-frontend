/**
 * api/periodicReport.js
 *
 * Proposal FR-19/FR-20, Phase 7C/7D — thin fetch wrapper for the periodic
 * report endpoint. Mirrors this project's established "thin, impure fetch
 * wrapper, never throws" contract (see utils/familyThresholds.js) — the
 * caller (PeriodicReportSection.js) owns loading/error/stale-response
 * handling; this module only talks to the network.
 */

'use strict';

import client from './client';
import { ENDPOINTS } from '../constants/api';

const READ_FAILED = Object.freeze({ status: 'read_failed', report: null, error: null });

/**
 * @param {{studentId: number, startDate: string, endDate: string}} params
 * @returns {Promise<{status: 'ok'|'invalid_input'|'read_failed', report: Object|null, error: string|null}>}
 */
export async function fetchPeriodicReport({ studentId, startDate, endDate }) {
  if (!studentId || !startDate || !endDate) {
    return { status: 'invalid_input', report: null, error: 'Missing student or date range.' };
  }
  try {
    const { data } = await client.get(ENDPOINTS.PERIODIC_REPORT(studentId, startDate, endDate));
    return { status: 'ok', report: data, error: null };
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[periodicReport] fetch failed:', err?.message ?? err);
    }
    return { status: 'read_failed', report: null, error: err?.message ?? 'Could not load the report.' };
  }
}
