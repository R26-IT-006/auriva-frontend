/**
 * handwritingSupportLevels.js
 *
 * Feature 3 Step 2 — Formal Support-Level Model + Behavior-Preserving
 * Rendering Refactor.
 *
 * Introduces a stable, descriptive support vocabulary (high | medium | low)
 * and two pure functions:
 *
 *   getSupportLevelForAttempt({ attempt, collectionMode })
 *     → 'high' | 'medium' | 'low' | null
 *
 *   getSupportPresentation({ supportLevel, attempt, collectionMode })
 *     → { guideOpacity, showAnimatedTracer, showStartMarker,
 *         showDirectionHint, collectionProtocolOverride } | null
 *
 * both reproducing EXACTLY the visual guidance LetterWritingScreen.js and
 * UppercaseWritingScreen.js already rendered before this refactor (see the
 * Feature 3 Step 1 audit and the inline citations below, one per resolved
 * value, pointing at the original inline expression it replaces).
 *
 * ── What this module deliberately is NOT ────────────────────────────────
 * This is a behavior-preserving REFACTOR ONLY. It does not read baseline,
 * family, threshold, performance, DTW, smoothness, support_review, or
 * blocked_attempts, and it makes no adaptive decision of any kind.
 * `supportLevel` is still derived 1:1 from `attempt`, exactly as the two
 * screens' inline `guideOpacity`/tracer/marker conditionals already did —
 * only the SELECTION MECHANISM moved into one shared, testable place.
 *
 * ── attempt vs supportLevel ──────────────────────────────────────────────
 * `attempt` (session position — which try, 1-3, within the current letter:
 * drives progression, the attempt-dots indicator, attemptScoresRef/
 * sessionAttemptsRef indexing) and `supportLevel` (how much visual
 * assistance is shown) are now formally separate concepts, even though they
 * still move in lockstep here. This module is the seam a later step can use
 * to make `supportLevel` vary independently of `attempt` without touching
 * either screen's progression logic. See the Feature 3 Step 1 audit for why
 * this separation matters before adaptive support can be introduced.
 *
 * Pure, UI-import-free by design (no react/react-native/expo-svg imports) —
 * safe to unit test directly and safe to import from both screens without
 * duplicating the attempt→guidance mapping a second time.
 */

'use strict';

// ─── Vocabulary ─────────────────────────────────────────────────────────────
//
// Descriptive, not numeric — see Feature 3 Step 2 spec: a bare
// `supportLevel = 1/2/3` would risk being read in either direction (1 =
// least support, matching `attempt`'s own numbering, or 1 = most support,
// matching a "highest priority" convention) and would re-couple the exact
// thing this module exists to decouple. If a numeric ORDERING is ever
// needed (e.g. "is this level higher than that one"), derive it from this
// enum in one place when that need actually arises — not preemptively here.

export const SUPPORT_LEVELS = Object.freeze({
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
});

const VALID_SUPPORT_LEVELS = new Set(Object.values(SUPPORT_LEVELS));

// ─── Attempt → support-level identity ──────────────────────────────────────

/**
 * Maps the current session `attempt` (1/2/3) to its educational support
 * vocabulary.
 *
 * `collectionMode` is accepted for call-signature symmetry with
 * getSupportPresentation() (a later step may need a mode-dependent
 * identity), but is NOT used for the identity mapping in Step 2 — attempt
 * 1/2/3 map to high/medium/low identically in both normal and collection
 * mode (confirmed against both screens' current `guideOpacity`/tracer/
 * marker conditionals, none of which gate on `collectionMode` except the
 * single guideOpacity exception at attempt 3, which is a PRESENTATION
 * override, not an identity change — see getSupportPresentation below and
 * the Step 1 audit §14/§28). Support-level IDENTITY and support
 * PRESENTATION are deliberately kept as two separate resolution steps.
 *
 * Invalid-input contract (attempt = 0, 4, null, undefined, a string, NaN,
 * etc.): returns `null` explicitly, never a guessed default. The app today
 * only ever sets `attempt` to 1, 2, or 3 (see both screens' `useState(1)` /
 * `setAttempt(a => a + 1)` / reset-to-1 logic) — this path is not expected
 * to be hit in production. It exists so callers and tests have an explicit,
 * documented contract rather than an accidental `undefined` silently
 * propagating into a rendering decision.
 *
 * @param {{attempt: number, collectionMode?: boolean}} params
 * @returns {'high'|'medium'|'low'|null}
 */
export function getSupportLevelForAttempt({ attempt, collectionMode } = {}) {
  // collectionMode is intentionally unused for identity — see JSDoc above.
  // Referenced only so a caller passing a non-boolean here is not silently
  // swallowed by a completely dead parameter; it never changes the result.
  void collectionMode;

  if (attempt === 1) return SUPPORT_LEVELS.HIGH;
  if (attempt === 2) return SUPPORT_LEVELS.MEDIUM;
  if (attempt === 3) return SUPPORT_LEVELS.LOW;
  return null;
}

// ─── Support-level → presentation (pure visual model) ──────────────────────
//
// One entry per support level, capturing every attempt-controlled visual
// guidance element identified in the Step 1 audit's fresh re-inspection of
// both screens:
//   - guideOpacity        — ghost letter path + ghost dots opacity
//   - showAnimatedTracer  — Attempt-1 "Watch & Trace" tracer dot + its loop
//   - showStartMarker     — Attempt-2 numbered start-position circle
//   - showDirectionHint   — Attempt-2 stroke-direction arrows + end markers
//
// Each value below is cited against the exact original inline expression it
// replaces (both screens are byte-identical on every one of these
// expressions — confirmed by fresh inspection before writing this file).

const SUPPORT_PRESENTATIONS = Object.freeze({
  // Original: guideOpacity → `attempt === 1 ? 0.14 : ...` branch.
  // Original tracer: effect guard `attempt !== 1` (disables when false) +
  //   render guard `attempt === 1 && !hasDrawn && tracerVisible && ...`.
  // Original markers: `attempt === 2 && ...` block never true at attempt 1.
  [SUPPORT_LEVELS.HIGH]: Object.freeze({
    guideOpacity:       0.14,
    showAnimatedTracer: true,
    showStartMarker:    false,
    showDirectionHint:  false,
  }),

  // Original: guideOpacity → falls through to the final `: 0.26` branch.
  // Original tracer: `attempt !== 1` is true at attempt 2 → tracer disabled.
  // Original markers: `attempt === 2 && activeGuideStart && (...)` — both
  //   the numbered start circle and the direction-hint arrows/end markers
  //   are gated by this one condition in the original code (never split).
  [SUPPORT_LEVELS.MEDIUM]: Object.freeze({
    guideOpacity:       0.26,
    showAnimatedTracer: false,
    showStartMarker:    true,
    showDirectionHint:  true,
  }),

  // Original: guideOpacity → `(attempt === 3 && !collectionMode) ? 0 : ...`
  //   — true (0) only in normal mode; collection mode's exception is
  //   applied by getSupportPresentation() below, never baked in here.
  // Original tracer/markers: both already false at attempt 3 in every mode.
  [SUPPORT_LEVELS.LOW]: Object.freeze({
    guideOpacity:       0,
    showAnimatedTracer: false,
    showStartMarker:    false,
    showDirectionHint:  false,
  }),
});

// ─── Collection-protocol exception ─────────────────────────────────────────
//
// Original expression this reproduces:
//   guideOpacity = (attempt === 3 && !collectionMode) ? 0 : attempt === 1 ? 0.14 : 0.26;
// At attempt 3 + collectionMode === true, this evaluates to 0.26 — the SAME
// faded ghost guide shown at 'medium', but WITHOUT the numbered start marker
// or direction-hint arrows (those stayed gated on the separate, unrelated
// `attempt === 2` condition, which is never true at attempt 3 in any mode).
//
// This is a fixed research-protocol RENDERING exception, not a fourth
// support level and not an adaptive decision — the three-level vocabulary
// (high/medium/low) is unchanged; only its 'low' presentation is overridden
// for this one exact combination. See Step 1 audit §14/§28.

/**
 * @param {'high'|'medium'|'low'} supportLevel
 * @param {boolean} collectionMode
 * @returns {boolean} true only for the one known exception: collection mode
 *   at the 'low' support tier (== attempt 3 in collection mode, the only
 *   attempt that maps to 'low').
 */
function isCollectionLowOverride(supportLevel, collectionMode) {
  return collectionMode === true && supportLevel === SUPPORT_LEVELS.LOW;
}

/**
 * Resolves the full visual presentation for a session moment.
 *
 * `supportLevel` is the primary input. If it is missing/invalid, it is
 * re-derived from `attempt` + `collectionMode` via getSupportLevelForAttempt
 * (this mirrors the intended call pattern — see Step 2 spec §9 — where a
 * screen computes supportLevel once via getSupportLevelForAttempt and then
 * passes it straight into this function; the fallback exists so this
 * function is also safely callable on its own).
 *
 * Invalid-input contract: if no valid support level can be resolved either
 * directly or via `attempt`, returns `null` explicitly — same "explicit
 * null, no guessed default" contract as getSupportLevelForAttempt.
 *
 * @param {{
 *   supportLevel?: 'high'|'medium'|'low',
 *   attempt?: number,
 *   collectionMode?: boolean,
 * }} params
 * @returns {{
 *   supportLevel: 'high'|'medium'|'low',
 *   guideOpacity: number,
 *   showAnimatedTracer: boolean,
 *   showStartMarker: boolean,
 *   showDirectionHint: boolean,
 *   collectionProtocolOverride: boolean,
 * }|null}
 */
export function getSupportPresentation({ supportLevel, attempt, collectionMode = false } = {}) {
  const resolvedLevel = VALID_SUPPORT_LEVELS.has(supportLevel)
    ? supportLevel
    : getSupportLevelForAttempt({ attempt, collectionMode });

  const base = resolvedLevel != null ? SUPPORT_PRESENTATIONS[resolvedLevel] : null;
  if (!base) return null;

  if (isCollectionLowOverride(resolvedLevel, collectionMode)) {
    return {
      supportLevel: resolvedLevel,
      ...base,
      guideOpacity: 0.26,
      collectionProtocolOverride: true,
    };
  }

  return {
    supportLevel: resolvedLevel,
    ...base,
    collectionProtocolOverride: false,
  };
}

// ─── Feature 3 Step 6 — adaptive support SEQUENCE ──────────────────────────
//
// Pure function only: given a recommended STARTING support level (from the
// backend's read-only recommendation, Feature 3 Step 5/6 —
// GET /handwriting/support-recommendation/:studentId/:letter/:caseType),
// returns the three-attempt sequence of support levels a normal-mode
// session should use. This module never fetches anything itself and never
// decides what to recommend — see utils/supportRecommendation.js for the
// (impure, network-calling) fetch wrapper that produces the `startSupport`
// value this function consumes.
//
// Monotonic by design (Step 6 spec §13/§14): support only ever stays the
// same or REDUCES across the three attempts within one session, never
// increases. The starting recommendation already reflects historical
// evidence gathered before this session began; this step does not yet do
// mid-session, performance-driven support escalation — see the module
// header's own note that any future increase belongs in a later
// orchestration step, not here.
//
//   high   → [high, medium, low]   (identical to today's legacy sequence —
//                                   a HIGH recommendation produces zero
//                                   visible change, Step 6 spec §28)
//   medium → [medium, low, low]
//   low    → [low, low, low]
//   anything else (null/invalid)
//          → [high, medium, low]   (the legacy default — safe fallback for
//                                   "no recommendation yet", "no safe
//                                   recommendation", or a malformed value)

const LEGACY_SUPPORT_SEQUENCE = Object.freeze([SUPPORT_LEVELS.HIGH, SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW]);

const ADAPTIVE_SUPPORT_SEQUENCES = Object.freeze({
  [SUPPORT_LEVELS.HIGH]:   Object.freeze([SUPPORT_LEVELS.HIGH,   SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW]),
  [SUPPORT_LEVELS.MEDIUM]: Object.freeze([SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW,    SUPPORT_LEVELS.LOW]),
  [SUPPORT_LEVELS.LOW]:    Object.freeze([SUPPORT_LEVELS.LOW,    SUPPORT_LEVELS.LOW,    SUPPORT_LEVELS.LOW]),
});

/**
 * @param {'high'|'medium'|'low'|null|undefined} startSupport — the backend's
 *   recommended starting support level, or null/undefined/anything invalid
 *   to explicitly request the legacy default sequence.
 * @returns {ReadonlyArray<'high'|'medium'|'low'>} always exactly 3 entries,
 *   indexed by `attempt - 1` (attempt 1/2/3 → index 0/1/2).
 */
export function getAdaptiveSupportSequence(startSupport) {
  return ADAPTIVE_SUPPORT_SEQUENCES[startSupport] ?? LEGACY_SUPPORT_SEQUENCE;
}

// ─── Feature 3 Step 7 — per-attempt support resolution (session-wide) ─────
//
// Extracted from LetterWritingScreen.js/UppercaseWritingScreen.js's inline
// `collectionMode ? getSupportLevelForAttempt(...) : adaptiveSequence[...]`
// ternary so the single most safety-critical branch in Feature 3 — "collection
// mode NEVER consumes an adaptive recommendation, no matter what" — is
// directly unit-testable without RN component rendering (same "extract the
// smallest pure decision piece" pattern this whole feature has used
// throughout — see buildSessionAttemptRecord, shouldApplyRecommendation).
// Pure; no behavior change from what was already inline.

/**
 * @param {{
 *   attempt: number,
 *   collectionMode: boolean,
 *   recommendedStartSupport: 'high'|'medium'|'low'|null,
 * }} params
 * @returns {'high'|'medium'|'low'|null} the support level to render/persist
 *   for this specific attempt.
 */
export function resolveSessionSupportLevel({ attempt, collectionMode, recommendedStartSupport }) {
  if (collectionMode) {
    // Collection mode ALWAYS uses the fixed research-protocol identity
    // mapping — `recommendedStartSupport` is never even consulted here,
    // regardless of its value (Step 6 spec §17, Step 7 spec §20).
    return getSupportLevelForAttempt({ attempt, collectionMode });
  }
  return getAdaptiveSupportSequence(recommendedStartSupport)[attempt - 1];
}
