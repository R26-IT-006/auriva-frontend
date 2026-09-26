// Feature 4 Step 3 — Warm-Up Completion / Loop-Protection Guard.
// Feature 4 Step 5 — adds resolveAdaptivePreWritingDetour() at the bottom of
// this file: the pure navigation-decision helper that finally CONSUMES
// hasWarmupHandled() (nothing did, before Step 5 — see below).
//
// This module does NOT make pre-writing adaptive on its own. Step 3 built it
// purely so a FUTURE adaptive recommendation would have a reliable way to
// ask "has this exact letter interaction already been offered its warm-up?"
// Only the two fixed, non-adaptive triggers (session-start in
// LetterPracticeScreen, category-boundary in LetterWritingScreen/
// UppercaseWritingScreen) call markWarmupHandled(). Step 5 is the first step
// where hasWarmupHandled() is actually consulted — by
// resolveAdaptivePreWritingDetour(), to decide whether an arriving adaptive
// recommendation may navigate right now.
//
// ── Why interaction-scoped, not history-scoped ─────────────────────────────
// A "has this student EVER completed this activity" check (via historical
// ShapeFeature rows) is deliberately NOT used here — a child may legitimately
// warm up on the same primitive group again on a later day/session. The
// guard is scoped to one continuous learning interaction (roughly: one
// "start writing" action in LetterPracticeScreen through to returning there),
// identified by an opaque `interactionId`, not to the student/letter pair
// forever.
//
// ── Why route-params + a session-scoped store, not AsyncStorage ────────────
// `interactionId` is created once in LetterPracticeScreen and threaded
// through every navigation.navigate/replace call as a route param — proven
// safe because PreWritingActivityScreen's finish() forwards `nextParams`
// verbatim (never rebuilds it), so anything placed inside `nextParams`
// (including `interactionId`) survives every detour intact. The "which keys
// have been handled" data itself lives in a plain in-memory Map below,
// keyed by a string that already embeds `interactionId` — this is
// interaction-scoped storage, not global forever-history, and correctly
// resets on app process restart (a new interaction/session begins anyway on
// relaunch — see Feature 4 Step 3's report §11 for the explicit evaluation).
// No AsyncStorage, no database, no migration.

import { generateUuidV4 } from './uuid';

const VALID_CASE_TYPES = ['lowercase', 'uppercase'];

// Reasons a warm-up may have been shown. ADAPTIVE_DIFFICULTY is unused
// until Feature 4 Step 4/5 — defined now purely so the guard's reason
// vocabulary doesn't need to change shape later.
export const PRE_WRITING_REASON = {
  SESSION_START: 'session_start',
  CATEGORY_TRANSITION: 'category_transition',
  ADAPTIVE_DIFFICULTY: 'adaptive_difficulty',
  // Two consumed failed cycles on the SAME letter, shown once before cycle 3.
  // Tracked in its own map below, not in handledWarmups — see why there.
  CYCLE_3_REMEDIATION: 'cycle_3_remediation',
};

const VALID_REASONS = Object.values(PRE_WRITING_REASON);

// Interaction-scoped, in-memory only. Never written to AsyncStorage/DB.
// Module-level (not React state) specifically so it survives the
// navigation.replace() remounts PreWritingActivityScreen performs when
// returning to LetterWriting/UppercaseWriting — a screen remount alone is
// not a reason to reach for persistent storage.
const handledWarmups = new Map(); // key -> { reason, markedAt }

/**
 * Cycle-3 remediation is tracked SEPARATELY, and deliberately so.
 *
 * makeWarmupKey is (student, case, letter, interaction) with no reason in it.
 * If remediation shared that map, a category-transition warm-up shown when the
 * child first entered this letter's group would already have marked the key —
 * and the child who then failed two cycles on that very letter would be denied
 * the remediation they had actually earned. Different trigger, different
 * purpose, different bookkeeping.
 *
 * The relationship is one-directional on purpose: remediation ALSO marks the
 * shared map when it opens, so the adaptive-difficulty detour does not fire a
 * second warm-up the moment the child lands back on the letter. A category
 * warm-up never reaches into this map.
 */
const handledRemediations = new Map(); // key -> { markedAt }

/**
 * Creates a new opaque, collision-resistant interaction id. Call ONCE per
 * "start writing" action (LetterPracticeScreen.goToLetterScreen) — never
 * per letter, never per render. Reuses the same dependency-free UUID v4
 * generator collection-mode sessions already use (see collectionSession.js)
 * rather than inventing a second ID scheme. Contains no student-identifying
 * information (no name, no sid) — just a random token.
 *
 * @returns {string}
 */
export function createPreWritingInteractionId() {
  return generateUuidV4();
}

function isValidLetter(letter) {
  return typeof letter === 'string' && /^[A-Za-z]$/.test(letter);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Builds the stable identity string for one (student, letter, case,
 * interaction) combination. Returns null for any invalid/missing
 * ingredient — callers must never fall back to a guessed or partial key.
 * Deliberately does NOT include a timestamp: the interactionId is what
 * scopes this key to "this learning interaction", not wall-clock time.
 *
 * @param {{studentId: string|number, caseType: string, letter: string, interactionId: string}} args
 * @returns {string|null}
 */
export function makeWarmupKey({ studentId, caseType, letter, interactionId } = {}) {
  const studentKey = (typeof studentId === 'number' && Number.isFinite(studentId))
    ? String(studentId)
    : (isNonEmptyString(studentId) ? studentId : null);

  if (!studentKey) return null;
  if (!VALID_CASE_TYPES.includes(caseType)) return null;
  if (!isValidLetter(letter)) return null;
  if (!isNonEmptyString(interactionId)) return null;

  // caseType is included explicitly alongside the literal letter character
  // so 'c' (lowercase) and 'C' (uppercase) are never collapsed into the
  // same key, even though the two literal characters already differ.
  return `${studentKey}::${caseType}::${letter}::${interactionId}`;
}

/**
 * The identity of ONE remediation opportunity: the warm-up key plus the cycle
 * it precedes. Cycle-scoped so a child who fails cycle 2 and later, on a
 * different day or interaction, reaches the same point again is not denied it.
 *
 * @returns {string|null} null for any invalid ingredient — never a partial key.
 */
export function makeRemediationKey({ studentId, caseType, letter, interactionId, cycleNumber } = {}) {
  const base = makeWarmupKey({ studentId, caseType, letter, interactionId });
  if (!base) return null;
  if (!Number.isInteger(cycleNumber) || cycleNumber <= 0) return null;
  return `${base}::${PRE_WRITING_REASON.CYCLE_3_REMEDIATION}::${cycleNumber}`;
}

/**
 * Has this exact remediation already been opened? Stops a navigation replace
 * or a re-render from replaying it.
 * @returns {boolean} false for collection mode or any invalid ingredient.
 */
export function hasRemediationHandled({ collectionMode = false, ...args } = {}) {
  if (collectionMode) return false;
  const key = makeRemediationKey(args);
  return key ? handledRemediations.has(key) : false;
}

/**
 * Marks a remediation as opened. Same "mark on open, not on completion"
 * discipline as markWarmupHandled — a teacher skip or a failed save must
 * still count as handled.
 *
 * Also marks the SHARED warm-up key, so the adaptive-difficulty detour does
 * not immediately add a second warm-up when the child returns to the letter.
 *
 * @returns {boolean} true if it was recorded.
 */
export function markRemediationHandled({ studentId, caseType, letter, interactionId, cycleNumber } = {}) {
  const key = makeRemediationKey({ studentId, caseType, letter, interactionId, cycleNumber });
  if (!key) return false;
  handledRemediations.set(key, { markedAt: Date.now() });
  markWarmupHandled({
    studentId, caseType, letter, interactionId,
    reason: PRE_WRITING_REASON.CYCLE_3_REMEDIATION,
  });
  return true;
}

/**
 * @param {{studentId, caseType, letter, interactionId, collectionMode?: boolean}} args
 * @returns {boolean} true only if a warm-up has already been marked handled
 *   for this exact (student, letter, case, interaction). Always false for
 *   collection mode or any invalid/missing ingredient — never throws.
 */
export function hasWarmupHandled({ studentId, caseType, letter, interactionId, collectionMode = false } = {}) {
  if (collectionMode) return false; // Feature 4 adaptivity never applies to collection mode.
  const key = makeWarmupKey({ studentId, caseType, letter, interactionId });
  if (!key) return false;
  return handledWarmups.has(key);
}

/**
 * Marks a warm-up as handled for this exact (student, letter, case,
 * interaction). Called at the moment the detour is ACCEPTED/OPENED (i.e.
 * right before navigating into PreWritingActivity) — not gated on the
 * child finishing, being teacher-skipped, or the backend save succeeding.
 * This is intentional:
 *   - Teacher Skip must still count as "handled" (§9) — marking on open,
 *     before any scoring/skip branch inside PreWritingActivityScreen even
 *     runs, makes this automatic rather than something that screen has to
 *     additionally report back.
 *   - A failed POST /pre-writing-activity save must not unmark this (§10) —
 *     since marking never depended on that POST succeeding in the first
 *     place, there is nothing to un-mark.
 * Idempotent: marking the same key twice is a harmless no-op overwrite.
 *
 * @param {{studentId, caseType, letter, interactionId, reason?: string, collectionMode?: boolean}} args
 * @returns {boolean} true if the key was actually marked, false if this was
 *   a no-op (collection mode or invalid ingredients).
 */
export function markWarmupHandled({ studentId, caseType, letter, interactionId, reason = null, collectionMode = false } = {}) {
  if (collectionMode) return false;
  const key = makeWarmupKey({ studentId, caseType, letter, interactionId });
  if (!key) return false;

  const safeReason = VALID_REASONS.includes(reason) ? reason : null;
  handledWarmups.set(key, { reason: safeReason, markedAt: Date.now() });
  return true;
}

/**
 * Test-only / defensive utility — clears all handled-warmup state. Not
 * called anywhere in production screens (there is no "clear history"
 * product action); exists so tests never leak state across cases and so a
 * future caller has an explicit, intentional way to reset if ever needed.
 */
export function resetPreWritingGuardStore() {
  handledWarmups.clear();
  handledRemediations.clear();
}

/**
 * Pure route-param assembly for a PreWritingActivity detour. Does NOT
 * select activities (that stays exactly as-is in
 * constants/preWritingActivities.js) and does NOT call markWarmupHandled
 * itself — callers mark handled explicitly, immediately before navigating,
 * keeping "mark on open" visible at the call site instead of hidden inside
 * a params builder. Exists only to avoid re-writing this exact object shape
 * identically in LetterPracticeScreen, LetterWritingScreen, and
 * UppercaseWritingScreen.
 *
 * @param {{
 *   student, theme, activities: object[],
 *   targetLetter: string, targetCaseType: string,
 *   interactionId: string, reason: string,
 *   nextRoute: string, nextParams: object,
 * }} args
 * @returns {object} the full route params object for navigation.navigate('PreWritingActivity', ...)
 */
export function buildPreWritingNavigationParams({
  student, theme, activities, targetLetter, targetCaseType, interactionId, reason, nextRoute, nextParams,
}) {
  return {
    student,
    theme,
    activities,
    targetLetter,
    targetCaseType,
    interactionId,
    warmupReason: reason,
    nextRoute,
    // interactionId is folded into nextParams (not just the top-level
    // params) because PreWritingActivityScreen.finish() forwards
    // nextParams verbatim via navigation.replace(nextRoute, nextParams) —
    // this is the one place that must carry it forward for it to survive
    // into the next LetterWriting/UppercaseWriting mount.
    nextParams: { ...nextParams, interactionId },
  };
}

// ─── Feature 4 Step 5 — adaptive navigation decision (pure) ────────────────
//
// Combines the backend's read-only recommendation with every frontend-only
// safety check before a screen is allowed to actually navigate into
// PreWritingActivity for an ADAPTIVE reason. Never calls hasWarmupHandled()
// or markWarmupHandled() itself — callers compute `alreadyHandled` however/
// whenever they want and pass it in, keeping this function pure (no module
// state, no I/O) and directly testable under plain Jest without simulating
// React effect timing.

export const NAV_REASON = {
  ADAPTIVE_RECOMMENDATION: 'adaptive_recommendation',
  COLLECTION_MODE:         'collection_mode',
  NOT_RECOMMENDED:         'not_recommended',
  STALE_LETTER:            'stale_letter',
  STALE_CASE_TYPE:         'stale_case_type',
  STALE_INTERACTION:       'stale_interaction',
  NO_ACTIVITY_RESOLVED:    'no_activity_resolved',
  ALREADY_HANDLED:         'already_handled',
  SESSION_ENTRY_LETTER:    'session_entry_letter',
  ATTEMPT_ADVANCED:        'attempt_advanced',
  ALREADY_DRAWING:         'already_drawing',
};

/**
 * @param {{
 *   recommendation: {recommended: boolean, letter: string|null, caseType: string|null, interactionId?: string|null}|null|undefined,
 *   activity: object|null|undefined,
 *   alreadyHandled: boolean,
 *   collectionMode: boolean,
 *   isSessionEntryLetter?: boolean,
 *   currentLetter: string,
 *   currentCaseType: string,
 *   currentInteractionId?: string|null,
 *   currentAttempt: number,
 *   hasDrawn: boolean,
 * }} params
 * @returns {{shouldNavigate: boolean, reason: string}}
 */
export function resolveAdaptivePreWritingDetour({
  recommendation, activity, alreadyHandled, collectionMode,
  currentLetter, currentCaseType, currentInteractionId,
  currentAttempt, hasDrawn, isSessionEntryLetter = false,
} = {}) {
  // Feature 4 adaptivity never applies to collection mode — checked first,
  // before even looking at the recommendation shape (Step 5 spec §9).
  if (collectionMode) {
    return { shouldNavigate: false, reason: NAV_REASON.COLLECTION_MODE };
  }

  if (!recommendation || recommendation.recommended !== true) {
    return { shouldNavigate: false, reason: NAV_REASON.NOT_RECOMMENDED };
  }

  // Race/stale-response safety (spec §23/§24): a recommendation resolved for
  // a letter/case/interaction the screen has since moved on from must never
  // be applied to whatever letter is active NOW. This is a second,
  // independent layer on top of the fetch effect's own `cancelled` closure
  // flag — same "two independent layers, not one" discipline Feature 3
  // Step 6 already established for its own stale-recommendation guarantee.
  if (recommendation.letter !== currentLetter) {
    return { shouldNavigate: false, reason: NAV_REASON.STALE_LETTER };
  }
  if (recommendation.caseType !== currentCaseType) {
    return { shouldNavigate: false, reason: NAV_REASON.STALE_CASE_TYPE };
  }
  if (currentInteractionId && recommendation.interactionId
      && recommendation.interactionId !== currentInteractionId) {
    return { shouldNavigate: false, reason: NAV_REASON.STALE_INTERACTION };
  }

  // Cross-repo drift protection (spec §18): a valid backend recommendation
  // whose activityId the frontend catalogue cannot resolve must never
  // navigate, and must never be silently substituted with a different
  // activity.
  if (!activity) {
    return { shouldNavigate: false, reason: NAV_REASON.NO_ACTIVITY_RESOLVED };
  }

  // The child opens a practice session on the FIRST letter of the sequence.
  // Nothing precedes it, so there is nothing to warm up from — normal
  // practice starts by writing, whatever the backend recommends. This is the
  // same product rule the category-transition trigger already follows at
  // index 0, applied to the one remaining path that could still detour there.
  //
  // Scoped to THIS function on purpose. Cycle-3 remediation navigates from
  // handleFailedCycle and never passes through here, so a letter that was the
  // session's first still gets its remediation after two failed cycles —
  // including when the sliced return sequence puts it back at index 0. A
  // blanket "no pre-writing at index 0" rule would have broken exactly that.
  if (isSessionEntryLetter) {
    return { shouldNavigate: false, reason: NAV_REASON.SESSION_ENTRY_LETTER };
  }

  // The Step 3 guard — suppresses a second detour for a letter the fixed
  // session-start/category-boundary trigger (or a prior adaptive detour)
  // already warmed up THIS interaction (spec §19/§20/§25).
  if (alreadyHandled) {
    return { shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED };
  }

  // No mid-attempt detour (spec §22) — same gate Feature 3 Step 6 already
  // uses for shouldApplyRecommendation(): only safe while the child is still
  // on attempt 1 and hasn't started drawing it yet.
  if (currentAttempt !== 1) {
    return { shouldNavigate: false, reason: NAV_REASON.ATTEMPT_ADVANCED };
  }
  if (hasDrawn) {
    return { shouldNavigate: false, reason: NAV_REASON.ALREADY_DRAWING };
  }

  return { shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION };
}
