/**
 * LearningSessionContext.js
 *
 * Proposal FR-13, Phase 7A — the thin React/RN wrapper around
 * utils/learningSessionTimer.js's pure state machine. Owns the one
 * `setInterval` + one `AppState` subscription for the whole handwriting
 * flow (spec item 10: "do not implement independent timers in
 * LetterWritingScreen/UppercaseWritingScreen/WordWritingScreen/
 * PreWritingScreen — create/reuse one central session-duration
 * mechanism").
 *
 * ── Session identity (spec item 5) ──────────────────────────────────────
 * No new persisted "session" table/object was introduced. This Provider
 * IS the session: it is mounted once per HandwritingNavigator instance
 * (one per student-entry — see navigation/HandwritingNavigator.js), so its
 * lifetime naturally matches "one continuous visit to the handwriting
 * flow for one student." collection_session_id is a completely separate,
 * research-only concept and is never read or written here.
 *
 * ── AppState handling (spec item 4/9) ───────────────────────────────────
 * The accumulator only ticks while AppState.currentState === 'active'.
 * On backgrounding, the interval is cleared entirely (not just skipped) —
 * on foregrounding, a fresh `lastTickAt` timestamp is taken so the
 * backgrounded duration itself is never added as a single large delta.
 * If the app process is killed and relaunched, this Provider simply
 * re-mounts with a fresh state — this pilot deliberately does NOT persist
 * elapsed time across a process restart (spec item 9: "starting again may
 * reasonably begin a new learning session for this pilot").
 *
 * ══ Proposal FR-16, Phase 7B — real-time teacher session monitoring ═══════
 * This Provider is exactly the reusable surface Phase 7A's own header
 * predicted it would become: it already knows elapsed time, break/resume/
 * finish transitions, and per-screen activity boundaries, so FR-16's
 * live-session PUSH logic is layered on top of the SAME state machine —
 * no second timer, no second "session" concept (spec §9).
 *
 * `enterActivity({studentId, activityType})` (called by
 * useLearningSessionActivity below, in place of the old bare
 * registerActive()) both registers FR-13 active-time AND pushes the
 * child's first meaningful live-session event ("screen entered", spec
 * §8). `notifyLiveSessionUpdate(patch)` is exposed for the screen's own
 * further meaningful events (letter/word/attempt/support changed, an
 * attempt was saved). takeBreak/resumeAfterBreak/finishForNow each also
 * push their own status transition (spec §18). A throttled heartbeat
 * (LIVE_SESSION_HEARTBEAT_MS, spec §16) piggybacks on the existing 1s
 * tick interval — no additional interval is created. On the Provider's
 * own unmount (natural navigation out of the whole handwriting module,
 * spec §18) a best-effort final status='ended' push fires.
 *
 * Every push goes through pushLiveSessionSnapshot() (api/liveSession.js),
 * which NEVER throws and is NEVER awaited by anything that gates child
 * behavior (spec §10 — "essential requirement"). If monitoring is down,
 * the child's writing flow is completely unaffected.
 */

'use strict';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import {
  createInitialSessionState, tick, registerActiveScreen, unregisterActiveScreen,
  startWriting, endWriting, shouldShowBreakPrompt, pauseForBreak, resumeFromBreak, finishForNow,
} from '../utils/learningSessionTimer';
import {
  SESSION_WARNING_MS, SESSION_MAX_MS, SESSION_TICK_MS, SESSION_WARNING_MINUTES, SESSION_MAX_MINUTES,
} from '../constants/learningSessionPolicy';
import { LIVE_SESSION_HEARTBEAT_MS } from '../constants/liveSessionPolicy';
import { pushLiveSessionSnapshot } from '../api/liveSession';
import { SPEECH_LOCALE_EN } from '../constants/speechLocale';
import {
  buildActivityEnteredPatch, buildHeartbeatPatch, buildBreakPatch, buildResumePatch, buildEndedPatch,
} from '../utils/liveSessionSnapshot';

const TIMER_CONFIG = { warningMs: SESSION_WARNING_MS, maxMs: SESSION_MAX_MS };

const LearningSessionContext = createContext(null);

export function LearningSessionProvider({ children }) {
  const [state, setState] = useState(createInitialSessionState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const lastTickAtRef = useRef(null);
  const intervalRef = useRef(null);
  const lastHeartbeatAtRef = useRef(null);

  // FR-16 — which student/activity the live-session pushes below are
  // currently for. null whenever no learning screen is registered.
  const studentIdRef = useRef(null);
  const activityTypeRef = useRef(null);

  // Fire-and-forget — see api/liveSession.js's own header for the
  // "never throws, never gates child behavior" contract this relies on.
  const pushLiveSession = useCallback((patch) => {
    const sid = studentIdRef.current;
    if (!sid) return;
    pushLiveSessionSnapshot(sid, patch);
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return; // already running
    lastTickAtRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - (lastTickAtRef.current ?? now);
      lastTickAtRef.current = now;
      setState((prev) => tick(prev, deltaMs, TIMER_CONFIG));

      // FR-16 heartbeat (spec §16) — throttled independently of the 1s
      // duration tick, and only while a session is genuinely active. Uses
      // stateRef (may lag the tick above by up to one interval) purely for
      // "roughly how long so far" — acceptable for a heartbeat, never used
      // for any FR-13 gating decision.
      if (studentIdRef.current && stateRef.current.status === 'active') {
        if (!lastHeartbeatAtRef.current || now - lastHeartbeatAtRef.current >= LIVE_SESSION_HEARTBEAT_MS) {
          lastHeartbeatAtRef.current = now;
          pushLiveSession(buildHeartbeatPatch(Math.floor(stateRef.current.elapsedMs / 1000)));
        }
      }
    }, SESSION_TICK_MS);
  }, [pushLiveSession]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastTickAtRef.current = null;
  }, []);

  // Interval only ever runs while the app is foregrounded — background
  // time is never counted (spec item 4/9), and resuming from background
  // never adds the backgrounded duration as one large jump (lastTickAtRef
  // is reset the moment the interval restarts).
  useEffect(() => {
    startInterval();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') startInterval();
      else stopInterval();
    });
    return () => {
      stopInterval();
      subscription.remove();
    };
  }, [startInterval, stopInterval]);

  // FR-16 spec §18 — natural completion/navigation out of the whole
  // handwriting module. This Provider's own unmount IS that moment (see
  // module header on session identity). Best-effort only; a process kill
  // or crash is covered instead by the server's own staleness calculation
  // (spec §13/§18), never by this cleanup running.
  useEffect(() => {
    return () => {
      if (studentIdRef.current) {
        pushLiveSessionSnapshot(studentIdRef.current, buildEndedPatch());
      }
    };
  }, []);

  const registerActive   = useCallback(() => setState((prev) => registerActiveScreen(prev)), []);
  const unregisterActive = useCallback(() => setState((prev) => unregisterActiveScreen(prev)), []);
  const notifyStrokeStart = useCallback(() => setState((prev) => startWriting(prev)), []);
  const notifyStrokeEnd   = useCallback(() => setState((prev) => endWriting(prev)), []);

  // FR-16 — a learning screen has just become the active activity (spec
  // §8/§17). Registers FR-13 active time (unchanged) AND pushes the
  // "screen entered" live-session event with status='active'. started_at
  // identity/preservation is entirely a backend concern (liveSessionService.js).
  const enterActivity = useCallback(({ studentId, activityType }) => {
    if (studentId) studentIdRef.current = studentId;
    if (activityType) activityTypeRef.current = activityType;
    registerActive();
    pushLiveSession(buildActivityEnteredPatch(activityType));
  }, [registerActive, pushLiveSession]);

  const notifyLiveSessionUpdate = useCallback((patch) => {
    pushLiveSession(patch);
  }, [pushLiveSession]);

  const takeBreak = useCallback(() => {
    setState((prev) => pauseForBreak(prev));
    pushLiveSession(buildBreakPatch());
  }, [pushLiveSession]);

  const resumeAfterBreak = useCallback(() => {
    setState((prev) => resumeFromBreak(prev));
    pushLiveSession(buildResumePatch(activityTypeRef.current));
  }, [pushLiveSession]);

  const finishForNowAction = useCallback(() => {
    setState(() => finishForNow());
    pushLiveSession(buildEndedPatch());
    studentIdRef.current = null;
    activityTypeRef.current = null;
  }, [pushLiveSession]);

  const value = {
    status: state.status,
    elapsedMs: state.elapsedMs,
    isWriting: state.isWriting,
    warningMinutes: SESSION_WARNING_MINUTES,
    maxMinutes: SESSION_MAX_MINUTES,
    showBreakPrompt: shouldShowBreakPrompt(state),
    registerActive,
    unregisterActive,
    notifyStrokeStart,
    notifyStrokeEnd,
    takeBreak,
    resumeAfterBreak,
    finishForNow: finishForNowAction,
    // FR-16
    enterActivity,
    notifyLiveSessionUpdate,
  };

  return (
    <LearningSessionContext.Provider value={value}>
      {children}
    </LearningSessionContext.Provider>
  );
}

/**
 * Base hook — direct access to the full context value (status, actions).
 * Prefer useLearningSessionActivity() from a learning screen (below) for
 * the common "register while focused" case.
 */
export function useLearningSession() {
  const ctx = useContext(LearningSessionContext);
  if (!ctx) {
    // Defensive fallback so a screen accidentally rendered outside the
    // Provider (e.g. in an isolated test) never crashes — matches this
    // project's general "never trap the child on a hard error" discipline.
    return {
      status: 'idle', elapsedMs: 0, isWriting: false,
      warningMinutes: SESSION_WARNING_MINUTES, maxMinutes: SESSION_MAX_MINUTES,
      showBreakPrompt: false,
      registerActive: () => {}, unregisterActive: () => {},
      notifyStrokeStart: () => {}, notifyStrokeEnd: () => {},
      takeBreak: () => {}, resumeAfterBreak: () => {}, finishForNow: () => {},
      enterActivity: () => {}, notifyLiveSessionUpdate: () => {},
    };
  }
  return ctx;
}

/**
 * For the learning screens (PreWritingActivity, LetterWriting,
 * UppercaseWriting, WordWriting/WordActivity) — call once per screen,
 * unconditionally, at the top level. Registers this screen as "active
 * learning time" for as long as it stays mounted; the caller is expected
 * to mount/unmount this screen via normal React Navigation focus behavior
 * (a Stack screen unmounts on navigating away in this app's existing
 * convention — see every other screen's own useFocusEffect pattern).
 *
 * Deliberately NOT wired to useFocusEffect internally — a plain mount/
 * unmount effect is enough here since these screens are always pushed/
 * popped as distinct stack entries (never tab-hidden-but-mounted), and
 * keeps this hook trivial to reason about and test.
 *
 * ── collection_mode (spec item 13, Phase 7A / spec §19, Phase 7B) ───────
 * FR-13's break flow AND FR-16's live-session monitoring are both for
 * open-ended, self-paced child practice. A collection_mode session
 * (LetterWritingScreen/UppercaseWritingScreen only) is a short, fixed,
 * teacher-supervised research-capture protocol, and this pilot
 * deliberately EXCLUDES it from BOTH: pass `{ suspend: collectionMode }`
 * and this hook skips registration/live-session entry entirely, so
 * collection-mode time never accumulates against the shared elapsed
 * clock, never contributes to a break prompt, and never appears in the
 * teacher's live-monitor feed. This does not touch collection protocol
 * semantics themselves (task order, capture rules, validation) — it only
 * decides whether these two unrelated features run.
 *
 * `studentId`/`activityType` (FR-16) are optional so any pre-existing
 * call site that only needs FR-13 registration keeps working unchanged —
 * see the "backward-compatible path" branch below. Every real screen in
 * this app passes both.
 */
export function useLearningSessionActivity(options = {}) {
  const { suspend = false, studentId = null, activityType = null } = options;
  const {
    registerActive, unregisterActive, notifyStrokeStart, notifyStrokeEnd,
    enterActivity, notifyLiveSessionUpdate,
  } = useLearningSession();

  useEffect(() => {
    if (suspend) return undefined; // collection_mode: neither FR-13 nor FR-16 register this screen's time
    if (studentId && activityType) {
      enterActivity({ studentId, activityType });
    } else {
      registerActive(); // backward-compatible path — FR-13 only, no live-session identity supplied
    }
    return () => unregisterActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspend, studentId, activityType]);

  return { notifyStrokeStart, notifyStrokeEnd, notifyLiveSessionUpdate };
}

// ─── Audio (spec item 11) ───────────────────────────────────────────────────
// One short, calm sentence — spoken once when the break prompt first
// appears, never repeated on re-render. Stopped on unmount so it can never
// overlap with whatever the child navigates to next.
export function speakBreakPrompt() {
  Speech.stop();
  Speech.speak('Time for a short break.', { rate: 0.85, pitch: 1.0, language: SPEECH_LOCALE_EN });
}

export function stopBreakPromptSpeech() {
  Speech.stop();
}
