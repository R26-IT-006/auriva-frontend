/**
 * thresholdTrace.js
 *
 * Fetch wrapper for the read-only progression-decision explanation
 * (GET /handwriting/threshold-trace/:studentId). Mirrors this project's
 * established "thin, impure fetch wrapper + pure normalization + never
 * throws" contract (see familyThresholds.js, motorBaseline.js).
 *
 * Server-derived rule trace is authoritative. The local explainability engine
 * (utils/explainabilityEngine.js) is retained for offline fallback and does
 * not generate audit traces — if no server trace is available, the "Why this
 * target?" panel simply does not render.
 *
 * Explanation only: this endpoint changes no decision and writes nothing.
 * Internal identifiers (attempt ids, fingerprints, history row ids) are not
 * part of the payload — see the backend's explanationTrace.js header.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const FAILSAFE = Object.freeze({ status: 'unavailable', families: null });

const FAMILIES = ['straight', 'curved', 'complex'];

function isObject(value) {
  return !!value && typeof value === 'object';
}

/**
 * Passes the backend trace through verbatim — never re-derives wording, a
 * decision, or a counterfactual on the client.
 *
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'found'|'not_available'|'unavailable', families: object|null}}
 */
export function normalizeThresholdTraceResponse(data) {
  if (!isObject(data)) return { ...FAILSAFE };

  // A body with no status at all is malformed — treat it as a failure rather
  // than as the legitimate "this student has no targets yet" state.
  if (typeof data.status !== 'string' || data.status.length === 0) return { ...FAILSAFE };

  if (data.status !== 'traced' || !isObject(data.families)) {
    // The server answered, but there is no decision to explain (e.g. no
    // initialized target). A normal, expected state — not an error.
    return { status: 'not_available', families: null };
  }

  const families = {};
  for (const family of FAMILIES) {
    const trace = data.families[family];
    if (isObject(trace)) families[family] = trace;
  }

  if (Object.keys(families).length === 0) return { status: 'not_available', families: null };
  return { status: 'found', families };
}

/**
 * Never throws — every failure mode resolves to `unavailable`, so the panel
 * can be hidden without a caller-side try/catch.
 *
 * @param {number|string} studentId
 * @returns {Promise<ReturnType<typeof normalizeThresholdTraceResponse>>}
 */
export async function fetchThresholdTrace(studentId) {
  try {
    const response = await client.get(ENDPOINTS.THRESHOLD_TRACE(studentId));
    return normalizeThresholdTraceResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[thresholdTrace] fetch failed — treating as unavailable:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}
