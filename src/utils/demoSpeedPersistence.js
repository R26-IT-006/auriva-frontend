/**
 * demoSpeedPersistence.js
 *
 * Feature 6 Step 3 — Persistence-Semantics helper (frontend).
 *
 * PURE FUNCTION — still not wired into any LetterAttempt payload or network
 * call (no `demo_speed_level` value is sent anywhere by this codebase yet —
 * that remains a future step's decision, Step 3 spec §29/§48/§50).
 *
 * Feature 6 Step 4 UPDATE: this function IS now imported and called by
 * LetterWritingScreen.js and UppercaseWritingScreen.js, to compute the
 * actual-rendered speed that drives the live tracer animation (never to
 * persist anything) — see those screens' own `actualDemoSpeedLevel`/
 * `effectiveDemoSpeedLevel` derivation. WordWritingScreen.js and
 * PreWritingActivityScreen.js remain untouched (Step 4 spec §2).
 *
 * ── Why "recommended" and "actually shown" must be kept separate ─────────
 * The backend's demo-speed recommendation (`GET
 * /handwriting/demo-speed-recommendation/:studentId/:letter/:caseType`,
 * `demoSpeedRecommendationService.js`) answers a purely categorical
 * question — "would a slower demonstration help this student on this
 * letter, based on Feature 2/3 signals" — with no awareness of whether a
 * demonstration is even being rendered right now. But the animated tracer
 * only ever exists at HIGH support (`showAnimatedTracer` is true only in
 * `SUPPORT_PRESENTATIONS.high`, see handwritingSupportLevels.js), and is
 * further suppressed whenever the student has reduce-motion enabled
 * (PreWritingActivityScreen.js's own `reduceMotion` state — tracked but,
 * per the Feature 6 Step 1 audit, never actually consulted yet; this helper
 * assumes a future fix wires it in, and treats `reduceMotion: true` as
 * "no animation was shown" regardless).
 *
 * A `slow` recommendation at MEDIUM/LOW support, or with reduce-motion on,
 * describes a demonstration speed that was never on screen. Persisting
 * `demo_speed_level: 'slow'` in that case would misrepresent what the
 * student actually experienced — mirroring the same "actual rendered value,
 * not a mere recommendation" distinction Feature 3 already draws between
 * `support_level` (rendered) and a support *recommendation*.
 *
 * This function is the single seam a future activation step should use
 * to decide what (if anything) is safe to persist — resolving that value
 * to `null` whenever no animation was actually shown, so `demo_speed_level`
 * never contains a value that misdescribes the session.
 *
 * ── Collection mode ────────────────────────────────────────────────────
 * Collection-mode sessions always use the fixed research-protocol support
 * identity (`resolveSessionSupportLevel` — collection mode never consumes
 * an adaptive recommendation, Feature 3 Step 6/7). Consistently, this
 * function always resolves to `null` when `collectionMode` is true: a
 * collection-mode row must never carry adaptive-recommendation evidence,
 * regardless of which support level or tracer state happens to apply
 * (Step 3 spec §49).
 *
 * Pure, UI-import-free by design — no react/react-native/expo-svg imports —
 * safe to unit test directly, matching every other orchestration helper in
 * this directory (resolveSessionSupportLevel, shouldApplyRecommendation,
 * buildSessionAttemptRecord).
 */

'use strict';

import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';
import { isValidDemoSpeedLevel } from '../constants/demoSpeedLevels';

/**
 * Resolves the demo-speed value that would actually be safe to persist for
 * one attempt, given the backend's recommendation and the session's real
 * rendering state. Returns `null` whenever no animated tracer was actually
 * on screen — a `demo_speed_level` should never be non-null unless a
 * tracer was truly rendered at that speed.
 *
 * @param {Object} params
 * @param {'standard'|'slow'|null|undefined} params.recommendedSpeedLevel —
 *   the backend recommendation (`demoSpeedRecommendationService`'s
 *   `recommendedSpeedLevel`).
 * @param {'high'|'medium'|'low'|null|undefined} params.supportLevel — the
 *   support level actually resolved/rendered for this attempt (e.g. via
 *   `resolveSessionSupportLevel`) — NOT merely a recommendation.
 * @param {boolean} params.showAnimatedTracer — the actual rendered
 *   presentation flag for this attempt (`getSupportPresentation(...)
 *   .showAnimatedTracer`), defensive alongside `supportLevel` in case a
 *   future presentation change ever decouples the two.
 * @param {boolean} [params.reduceMotion] — whether the student's
 *   reduce-motion preference is active for this session.
 * @param {boolean} [params.collectionMode] — whether this attempt is part
 *   of a data-collection session (always fixed-protocol, never adaptive).
 * @returns {'standard'|'slow'|null} `null` unless a tracer was genuinely
 *   rendered at the recommended speed — HIGH support, tracer actually
 *   shown, reduce-motion off, not a collection-mode session, and a valid
 *   recommended level.
 */
export function resolveActualDemoSpeedLevel({
  recommendedSpeedLevel,
  supportLevel,
  showAnimatedTracer,
  reduceMotion,
  collectionMode,
} = {}) {
  // Collection mode is always the fixed research protocol — never carries
  // adaptive-recommendation evidence, regardless of anything else.
  if (collectionMode) return null;

  // Reduce-motion means no animation was actually shown, whatever the
  // support level or recommendation says.
  if (reduceMotion) return null;

  // The animated tracer only ever exists at HIGH support — anything else
  // means no demonstration-speed was on screen to have a value at all.
  if (supportLevel !== SUPPORT_LEVELS.HIGH) return null;

  // Defensive check alongside supportLevel: the tracer must have actually
  // been rendered, not merely eligible to be.
  if (showAnimatedTracer !== true) return null;

  // An invalid/missing recommendation is never persisted as a guess.
  if (!isValidDemoSpeedLevel(recommendedSpeedLevel)) return null;

  return recommendedSpeedLevel;
}
