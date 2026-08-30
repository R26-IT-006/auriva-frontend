/**
 * familyThresholds.js
 *
 * Teacher Dashboard integration fix — fetch wrapper for Feature 2's current
 * family thresholds (GET /handwriting/family-thresholds/:studentId).
 * Mirrors this project's established "thin, impure fetch wrapper + pure
 * normalization + never throws" contract (see worksheetRecommendations.js,
 * supportRecommendation.js).
 *
 * Deliberately does NOT compute or duplicate the threshold formula — every
 * value returned here is exactly what the backend's Feature 2 service
 * already resolved (baseline + margin, or a live dynamic re-evaluation).
 * `student.personal_thresholds` (the legacy field) is never read by this
 * file.
 */

'use strict';

import client from '../api/client';
import { ENDPOINTS } from '../constants/api';

const VALID_FAMILIES = ['straight', 'curved', 'complex'];

const FAILSAFE = Object.freeze({
  status: 'read_failed',
  families: { straight: null, curved: null, complex: null },
});

function normalizeFamilyEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.status !== 'available') return null;
  return typeof raw.threshold === 'number' ? raw.threshold : null;
}

/**
 * @param {*} data — response.data, or undefined/null.
 * @returns {{status: 'resolved'|'read_failed'|'invalid_input', families: {straight: number|null, curved: number|null, complex: number|null}}}
 *   A `null` family value means "not currently available" — the caller
 *   must render a neutral unavailable state for it, never a fallback
 *   number of its own invention.
 */
export function normalizeFamilyThresholdsResponse(data) {
  if (!data || typeof data !== 'object') return { ...FAILSAFE };
  if (data.status === 'invalid_input') {
    return { status: 'invalid_input', families: { straight: null, curved: null, complex: null } };
  }
  if (data.status !== 'resolved' || !data.families || typeof data.families !== 'object') {
    return { ...FAILSAFE };
  }

  const families = {};
  for (const family of VALID_FAMILIES) {
    families[family] = normalizeFamilyEntry(data.families[family]);
  }
  return { status: 'resolved', families };
}

/**
 * Fetches the student's current Feature 2 family thresholds. Never throws —
 * every failure mode (network, 4xx/5xx, malformed body) resolves to the
 * same safe `read_failed` shape the caller already has to handle for a
 * genuinely-unavailable target, so the UI needs only one "not available"
 * branch, not two.
 *
 * @param {{studentId: number}} params
 * @returns {Promise<ReturnType<typeof normalizeFamilyThresholdsResponse>>}
 */
export async function fetchFamilyThresholds({ studentId } = {}) {
  try {
    const response = await client.get(ENDPOINTS.FAMILY_THRESHOLDS(studentId));
    return normalizeFamilyThresholdsResponse(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[familyThresholds] fetch failed — treating as read_failed:', err?.message ?? err);
    }
    return { ...FAILSAFE };
  }
}

// ── Effective teacher-override provenance ────────────────────────────────
//
// normalizeFamilyThresholdsResponse() above flattens each family to a bare
// number, which is all its own callers ever needed. The EFFECTIVE source of
// that number — which the endpoint does send — is discarded there, so this
// is a second, ADDITIVE reader rather than a change to the existing one:
// nothing that already depends on the flattened shape is affected.
//
// "Effective" is the whole point. The endpoint's per-family `source` comes
// from the CURRENT ThresholdHistory row (getCurrentFamilyThreshold's
// sourceEvent), so a teacher override that was later superseded by an
// automatic or initial_from_baseline row does NOT appear here. Historical
// existence is never enough.

const TEACHER_OVERRIDE_SOURCE = 'teacher_override';

/**
 * @param {*} data — the raw GET /handwriting/family-thresholds body
 * @returns {{status: 'resolved'|'unavailable', families: string[]}}
 *   families = the families whose CURRENTLY EFFECTIVE target is a teacher
 *   override. Empty array when none — never null, so callers need no guard.
 */
export function extractTeacherOverrideFamilies(data) {
  if (!data || typeof data !== 'object') return { status: 'unavailable', families: [] };
  // Array.isArray is checked explicitly: `typeof [] === 'object'`, so an
  // array body would otherwise be accepted as "resolved with no overrides"
  // — reporting success for a malformed payload.
  if (data.status !== 'resolved'
      || !data.families
      || typeof data.families !== 'object'
      || Array.isArray(data.families)) {
    return { status: 'unavailable', families: [] };
  }

  const families = VALID_FAMILIES.filter((family) => {
    const entry = data.families[family];
    return !!entry
      && typeof entry === 'object'
      && entry.status === 'available'
      && entry.source === TEACHER_OVERRIDE_SOURCE;
  });

  return { status: 'resolved', families };
}

/**
 * Fetches the effective teacher-override families. Fails closed: any error
 * resolves to "unavailable, none", so a failed request can never make the
 * report claim a target is teacher-protected when it is not.
 */
export async function fetchTeacherOverrideFamilies(studentId) {
  if (!studentId) return { status: 'unavailable', families: [] };
  try {
    const response = await client.get(ENDPOINTS.FAMILY_THRESHOLDS(studentId));
    return extractTeacherOverrideFamilies(response?.data);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[familyThresholds] override provenance fetch failed:', err?.message ?? err);
    }
    return { status: 'unavailable', families: [] };
  }
}
