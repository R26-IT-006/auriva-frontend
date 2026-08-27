/**
 * demoGuard.js
 *
 * The synchronous half of demo state.
 *
 * ── Why two different mechanisms, deliberately ──────────────────────────
 * A demonstration has two distinct questions, and answering both with the
 * same store gets one of them wrong:
 *
 *   "has this child COMPLETED this demo?"    persistent, per-student
 *                                            (storage.js — written when the
 *                                            child presses "I'm Ready")
 *
 *   "am I ALREADY navigating to it?"         in-memory, this session only
 *                                            (this file)
 *
 * The second question exists because the check that triggers a demo lives in
 * a mount effect, and reading the persistent store is asynchronous. Between
 * the decision and the navigation the screen can re-render, or remount after
 * `navigation.replace`, and fire the same decision again — two demos pushed
 * onto the stack for one transition. A synchronous marker taken BEFORE
 * navigating closes that window; an `await` cannot.
 *
 * ── Why this one must NOT be persistent ─────────────────────────────────
 * This is the in-flight marker, not the completion record. If it survived a
 * restart, a child whose app crashed during the demonstration would be
 * permanently marked as having "started" it and would never be shown it
 * again. Living in memory means a crash or forced close clears it and the
 * demo is offered again — the safe direction to fail.
 *
 * Same discipline, and the same reasoning, as preWritingSessionGuard.js's
 * in-memory `handledWarmups` map; that module scopes to one interaction,
 * this one to one app session, because a demo's real record of truth is the
 * persistent one and this is only a re-entrancy latch.
 */

'use strict';

import { isValidDemoKey } from './demoPolicy';

// key -> markedAt. Module-level (not React state) specifically so it
// survives the remounts `navigation.replace` performs when returning from
// the demo screen to the writing screen.
const inFlight = new Map();

function makeKey(studentId, demoKey) {
  const studentKey = (typeof studentId === 'number' && Number.isFinite(studentId))
    ? String(studentId)
    : (typeof studentId === 'string' && studentId.length > 0 ? studentId : null);
  if (!studentKey) return null;
  if (!isValidDemoKey(demoKey)) return null;
  // Scoped by student so two children on one shared tablet never inherit
  // each other's in-flight state.
  return `${studentKey}::${demoKey}`;
}

/**
 * @returns {boolean} true if navigation into this demo has already started
 *   in this app session. Never throws; false for any invalid input.
 */
export function isDemoInFlight(studentId, demoKey) {
  const key = makeKey(studentId, demoKey);
  return key ? inFlight.has(key) : false;
}

/**
 * Claims the demo for this session. Call IMMEDIATELY BEFORE navigating —
 * the same "mark on open" ordering preWritingSessionGuard.js uses, so a
 * failed navigation still counts as claimed rather than looping.
 *
 * @returns {boolean} true if this call took the claim; false if something
 *   else already held it (the caller must then NOT navigate).
 */
export function claimDemoNavigation(studentId, demoKey) {
  const key = makeKey(studentId, demoKey);
  if (!key) return false;
  if (inFlight.has(key)) return false;
  inFlight.set(key, Date.now());
  return true;
}

/**
 * Releases the claim. Used only where a demo legitimately needs to be
 * re-offered within the same session — never on completion, since the
 * persistent record already prevents a repeat then.
 */
export function releaseDemoNavigation(studentId, demoKey) {
  const key = makeKey(studentId, demoKey);
  if (key) inFlight.delete(key);
}

/** Test helper — resets the session latch. */
export function resetDemoGuard() {
  inFlight.clear();
}
