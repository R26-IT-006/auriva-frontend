/**
 * liveSessionSnapshot.js
 *
 * Proposal FR-16, Phase 7B — pure, framework-free helpers shared by the
 * child-side push call sites (LearningSessionContext.js) and the teacher-
 * side display (LiveSessionCard.js). Two responsibilities, deliberately
 * kept in one small pure module so both sides always agree on field names
 * and neutral wording:
 *
 *  1. buildXPatch() — small object builders for each "meaningful event"
 *     (spec §8), so no screen hand-writes `{ current_item: ..., ... }`
 *     literals of its own that could drift from the backend's whitelist.
 *  2. describeLiveSession() — turns the raw GET response into neutral,
 *     teacher-facing labels (spec §14: "neutral language, no raw JSON, no
 *     model terminology unless actually relevant").
 *
 * Never reads or builds raw stroke coordinates, medical/diagnosis fields,
 * or Feature 11 research internals (spec §4) — there is structurally
 * nothing in this file that could carry them.
 */

'use strict';

// ─── Child-side patch builders (spec §8 — meaningful events only) ─────────

/** Screen entered / became the active learning activity. */
export function buildActivityEnteredPatch(activityType) {
  return { activity_type: activityType, status: 'active' };
}

/** Letter/word, attempt, and/or support level changed — one bundled event. */
export function buildProgressPatch({ currentItem, caseType, attemptNumber, supportLevel } = {}) {
  const patch = {};
  if (currentItem !== undefined) patch.current_item = currentItem;
  if (caseType !== undefined) patch.case_type = caseType;
  if (attemptNumber !== undefined) patch.attempt_number = attemptNumber;
  if (supportLevel !== undefined) patch.support_level = supportLevel;
  return patch;
}

/** An attempt/word was just saved — the score just persisted, never raw strokes. */
export function buildScorePatch(score) {
  return { latest_saved_score: score };
}

/** Throttled elapsed-time heartbeat (spec §16) — no faster than LIVE_SESSION_HEARTBEAT_MS. */
export function buildHeartbeatPatch(elapsedSeconds) {
  return { elapsed_active_seconds: elapsedSeconds };
}

export function buildBreakPatch() {
  return { status: 'break', activity_type: 'break' };
}

export function buildResumePatch(activityType) {
  return { status: 'active', activity_type: activityType ?? 'idle' };
}

export function buildEndedPatch() {
  return { status: 'ended', activity_type: 'completed' };
}

// ─── Teacher-side display (spec §14 — neutral language, no raw JSON) ──────

const ACTIVITY_LABELS = Object.freeze({
  prewriting:       'Pre-Writing Activity',
  lowercase_letter: 'Lowercase Letters',
  uppercase_letter: 'Uppercase Letters',
  word_writing:     'Word Writing',
  word_activity:    'Word Activity',
  break:            'On a Break',
  idle:             'Getting Started',
  completed:        'Session Ended',
});

const STATUS_LABELS = Object.freeze({
  active: 'Active',
  break:  'On a Break',
  ended:  'Session Ended',
});

const CONNECTION_LABELS = Object.freeze({
  live:        'Live',
  stale:       'Connection Interrupted',
  not_active:  'Not Active',
});

/** mm:ss for anything under an hour, otherwise Hh MMm. Never negative. */
export function formatElapsed(totalSeconds) {
  const s = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * @param {*} raw — the GET /handwriting/live-session/:studentId response
 *   ({status:'not_active'} or a full snapshot with connection_status).
 * @returns a display-ready object; `active: false` for both "no session
 *   ever started" and a row whose own status is 'ended' — the teacher UI
 *   needs only one NOT ACTIVE branch, matching this project's established
 *   "single safe fallback shape" convention (see familyThresholds.js).
 */
export function describeLiveSession(raw) {
  if (!raw || typeof raw !== 'object' || raw.status === 'not_active' || raw.connection_status === 'not_active') {
    return {
      active: false,
      connection: 'not_active',
      connectionLabel: CONNECTION_LABELS.not_active,
    };
  }

  return {
    active: true,
    connection: raw.connection_status,
    connectionLabel: CONNECTION_LABELS[raw.connection_status] ?? CONNECTION_LABELS.not_active,
    activityLabel: ACTIVITY_LABELS[raw.activity_type] ?? 'Learning',
    statusLabel: STATUS_LABELS[raw.status] ?? 'Active',
    currentItem: raw.current_item ?? null,
    caseType: raw.case_type ?? null,
    attemptNumber: raw.attempt_number ?? null,
    supportLevel: raw.support_level ?? null,
    elapsedSeconds: raw.elapsed_active_seconds ?? 0,
    elapsedLabel: formatElapsed(raw.elapsed_active_seconds),
    latestScore: typeof raw.latest_saved_score === 'number' ? Math.round(raw.latest_saved_score) : null,
    startedAt: raw.started_at ?? null,
    lastUpdatedAt: raw.last_updated_at ?? null,
  };
}
