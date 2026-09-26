/**
 * learningSessionTimer.js
 *
 * Proposal FR-13, Phase 7A — the pure, framework-free state machine behind
 * the learning-session duration/break feature. No React, no RN, no
 * timers/AppState here (see context/LearningSessionContext.js for the thin
 * RN wrapper) — every transition is a pure function of (state, action) so
 * the actual RULE is fully unit-testable without mounting a component.
 *
 * ── What this tracks ─────────────────────────────────────────────────────
 * Elapsed ACTIVE learning time only: time only accumulates while at least
 * one registered learning screen is focused (activeScreenCount > 0) — see
 * spec item 4 ("prewriting, lowercase writing, uppercase writing, word
 * writing/practice" count; teacher report browsing/setup/login/background
 * do not). The caller (LearningSessionContext) is responsible for only
 * calling tick() with real wall-clock deltas while the app is foregrounded
 * — this module has no concept of AppState itself.
 *
 * ── Status lifecycle ─────────────────────────────────────────────────────
 *   idle -> active -> warning -> limit_reached
 *                        \-> paused (Take a Break) -> active (resume)
 *   any status -> idle (Finish for Now / resetSession)
 *
 * "warning" is a soft, non-blocking signal only (spec: reaching
 * SESSION_WARNING_MINUTES alone never shows the break prompt).
 * "limit_reached" is what makes shouldShowBreakPrompt() eligible to
 * return true — gated additionally on `!isWriting`, so a prompt is never
 * shown to interrupt an in-progress stroke (spec item 6).
 */

'use strict';

export const SESSION_STATUS = Object.freeze({
  IDLE:          'idle',
  ACTIVE:        'active',
  WARNING:       'warning',
  LIMIT_REACHED: 'limit_reached',
  PAUSED:        'paused',
});

/**
 * @returns {object} a fresh, empty session-timer state.
 */
export function createInitialSessionState() {
  return {
    status: SESSION_STATUS.IDLE,
    elapsedMs: 0,
    activeScreenCount: 0,
    isWriting: false,
    warningReached: false,
    limitReached: false,
  };
}

function isCounting(state) {
  return state.activeScreenCount > 0 && state.status !== SESSION_STATUS.PAUSED;
}

function deriveStatus(state) {
  if (state.status === SESSION_STATUS.PAUSED) return state; // paused is explicit, only exited by an explicit action
  if (state.limitReached) return { ...state, status: SESSION_STATUS.LIMIT_REACHED };
  if (state.warningReached) return { ...state, status: SESSION_STATUS.WARNING };
  if (state.activeScreenCount > 0) return { ...state, status: SESSION_STATUS.ACTIVE };
  return { ...state, status: SESSION_STATUS.IDLE };
}

/**
 * Advances elapsed active time by deltaMs — a no-op unless a learning
 * screen is currently registered as active and the session isn't paused.
 * Never accumulates while backgrounded — the caller simply never calls
 * this while AppState !== 'active' (see LearningSessionContext.js).
 *
 * @param {object} state
 * @param {number} deltaMs — real wall-clock milliseconds since the last tick.
 * @param {{warningMs: number, maxMs: number}} config
 * @returns {object} new state
 */
export function tick(state, deltaMs, config) {
  if (!isCounting(state)) return state;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return state;

  const elapsedMs = state.elapsedMs + deltaMs;
  const warningReached = state.warningReached || elapsedMs >= config.warningMs;
  const limitReached   = state.limitReached   || elapsedMs >= config.maxMs;

  return deriveStatus({ ...state, elapsedMs, warningReached, limitReached });
}

/**
 * A learning screen (prewriting/lowercase/uppercase/word writing-practice)
 * gained focus. Never called for teacher-report/setup/login screens.
 */
export function registerActiveScreen(state) {
  return deriveStatus({ ...state, activeScreenCount: state.activeScreenCount + 1 });
}

/**
 * The learning screen that called registerActiveScreen lost focus/unmounted.
 * Floors at 0 — defensive against a mismatched register/unregister pair
 * (e.g. two fast focus events) rather than ever going negative.
 */
export function unregisterActiveScreen(state) {
  const activeScreenCount = Math.max(0, state.activeScreenCount - 1);
  return deriveStatus({ ...state, activeScreenCount });
}

/** A stroke/gesture began on a drawing canvas — blocks the break prompt. */
export function startWriting(state) {
  return { ...state, isWriting: true };
}

/** A stroke/gesture ended — the break prompt may now appear if eligible. */
export function endWriting(state) {
  return { ...state, isWriting: false };
}

/**
 * @param {object} state
 * @returns {boolean} true only when the configured duration has genuinely
 *   been reached AND no stroke is currently in progress (spec item 6: the
 *   prompt must never interrupt active writing).
 */
export function shouldShowBreakPrompt(state) {
  return state.status === SESSION_STATUS.LIMIT_REACHED && !state.isWriting;
}

/**
 * "Take a Break" (spec item 7) — pauses active-session timing. Elapsed
 * time and the reached flags are deliberately RETAINED (not reset): a
 * break is a pause within the same continuous-session window, not the end
 * of it. Resuming (the next registerActiveScreen call after navigating
 * back into a learning screen) continues from here, status becomes
 * 'active' again via deriveStatus — but limitReached stays true, so
 * shouldShowBreakPrompt() would immediately be eligible again once
 * writing stops; the caller (context) is expected to treat a fresh
 * "resume" as implicitly acknowledging the break was taken (see
 * resumeFromBreak below, which clears limitReached/warningReached so the
 * child gets a genuinely fresh window after actually taking the break).
 */
export function pauseForBreak(state) {
  return { ...state, status: SESSION_STATUS.PAUSED };
}

/**
 * Resuming after a break the child actually took — starts a fresh
 * warning/limit window (clears the reached flags and elapsed time) rather
 * than immediately re-triggering the same prompt the instant they resume.
 */
export function resumeFromBreak(state) {
  return deriveStatus({
    ...state, elapsedMs: 0, warningReached: false, limitReached: false, status: SESSION_STATUS.IDLE,
  });
}

/**
 * "Finish for Now" (spec item 8/9) — ends the current continuous-session
 * window entirely. The NEXT time a learning screen registers, it starts a
 * fresh duration window (spec item 9: "a learning session intentionally
 * finished/restarted later should receive a fresh duration window").
 * Equivalent to a full resetSession(); kept as a separate, intent-named
 * export so callers read clearly at the call site.
 */
export function finishForNow() {
  return createInitialSessionState();
}

/** Explicit full reset — used on app restart / new student session start. */
export function resetSession() {
  return createInitialSessionState();
}
