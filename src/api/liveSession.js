/**
 * api/liveSession.js
 *
 * Proposal FR-16, Phase 7B — thin fetch wrapper for the live-session
 * snapshot endpoint. Mirrors this project's established "thin, impure
 * fetch wrapper, never throws" contract (see utils/familyThresholds.js).
 *
 * pushLiveSessionSnapshot() is the SINGLE most important contract in this
 * whole feature (spec §10 — "essential requirement"): it must NEVER throw
 * and must NEVER be awaited by anything that gates child-facing behavior.
 * Every failure mode (network error, 4xx/5xx, timeout) resolves to
 * `false` — the caller (LearningSessionContext.js) always fires this and
 * moves on; monitoring is purely observational.
 */

'use strict';

import client from './client';
import { ENDPOINTS } from '../constants/api';

/**
 * @param {number} studentId
 * @param {object} patch — a buildXPatch() result from utils/liveSessionSnapshot.js
 * @returns {Promise<boolean>} true on success, false on ANY failure — never rejects.
 */
export async function pushLiveSessionSnapshot(studentId, patch) {
  if (!studentId || !patch || typeof patch !== 'object') return false;
  try {
    await client.put(ENDPOINTS.LIVE_SESSION(studentId), patch);
    return true;
  } catch (err) {
    // Non-fatal by design (spec §10) — child writing must continue
    // regardless of monitoring availability.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[liveSession] push failed (non-fatal):', err?.message ?? err);
    }
    return false;
  }
}

const NOT_ACTIVE = Object.freeze({ status: 'not_active' });

/**
 * Teacher-side read. Never throws — a network failure or 4xx/5xx resolves
 * to the same NOT_ACTIVE shape a genuinely-inactive student would return,
 * so the card only needs one "nothing to show" branch.
 * @param {number} studentId
 */
export async function fetchLiveSessionSnapshot(studentId) {
  if (!studentId) return NOT_ACTIVE;
  try {
    const { data } = await client.get(ENDPOINTS.LIVE_SESSION(studentId));
    return data ?? NOT_ACTIVE;
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[liveSession] fetch failed:', err?.message ?? err);
    }
    return NOT_ACTIVE;
  }
}
