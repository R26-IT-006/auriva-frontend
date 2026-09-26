/**
 * liveSessionPolicy.js
 *
 * Proposal FR-16, Phase 7B — centralized policy for real-time (near-
 * real-time, snapshot-polling) teacher session monitoring. Mirrors
 * constants/learningSessionPolicy.js's own convention: named, documented
 * pilot/engineering defaults, imported everywhere rather than hardcoded in
 * a screen (spec §15's "centralize the polling interval constant").
 *
 * These values MUST match the backend's own
 * auriva-backend/src/config/liveSessionPolicy.js — the backend is the
 * single source of truth for connection_status (computed server-side from
 * STALE_THRESHOLD_SECONDS), so LIVE_SESSION_STALE_SECONDS here exists only
 * for documentation/tests, never for the frontend to re-derive staleness
 * itself from a raw timestamp (spec §13).
 */

'use strict';

// Teacher-side polling interval (spec §15: "recommended interval
// approximately 3–5 seconds"). PILOT / ENGINEERING DEFAULT.
export const LIVE_SESSION_POLL_MS = 5000;

// Child-side heartbeat interval — "no faster than the teacher polling
// interval" (spec §16). Equal to LIVE_SESSION_POLL_MS so the documented
// request-volume estimate (spec §22: "~12 writes/minute") is exact.
// PILOT / ENGINEERING DEFAULT.
export const LIVE_SESSION_HEARTBEAT_MS = 5000;

// Matches the backend's STALE_THRESHOLD_SECONDS (config/liveSessionPolicy.js)
// — documentation/test value only; the server computes connection_status
// itself, this is never used to re-derive it on the frontend.
// PILOT / ENGINEERING DEFAULT.
export const LIVE_SESSION_STALE_SECONDS = 15;

// The activity_type vocabulary a child screen may report — must exactly
// match the backend's LIVE_ACTIVITY_TYPES (config/liveSessionPolicy.js).
export const LIVE_ACTIVITY_TYPES = Object.freeze({
  PREWRITING:        'prewriting',
  LOWERCASE_LETTER:  'lowercase_letter',
  UPPERCASE_LETTER:  'uppercase_letter',
  WORD_WRITING:      'word_writing',
  WORD_ACTIVITY:     'word_activity',
  BREAK:             'break',
  IDLE:              'idle',
  COMPLETED:         'completed',
});

export const LIVE_SESSION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  BREAK:  'break',
  ENDED:  'ended',
});
