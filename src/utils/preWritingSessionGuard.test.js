// Feature 4 Step 3 — Warm-Up Completion / Loop-Protection Guard tests.
//
// Pure logic only: no navigation, no component rendering, no adaptive
// trigger (there isn't one yet). Proves the identity/marking contract a
// future adaptive recommendation (Step 4/5) will depend on.

import {
  PRE_WRITING_REASON,
  createPreWritingInteractionId,
  makeWarmupKey,
  hasWarmupHandled,
  markWarmupHandled,
  resetPreWritingGuardStore,
  buildPreWritingNavigationParams,
  resolveAdaptivePreWritingDetour,
  NAV_REASON,
} from './preWritingSessionGuard';

beforeEach(() => {
  resetPreWritingGuardStore();
});

// ─── Interaction id creation ────────────────────────────────────────────────

describe('createPreWritingInteractionId()', () => {
  it('returns a non-empty string', () => {
    const id = createPreWritingInteractionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a collision-resistant id — two calls never collide in a large sample', () => {
    const ids = new Set();
    for (let i = 0; i < 500; i++) ids.add(createPreWritingInteractionId());
    expect(ids.size).toBe(500);
  });

  it('never contains obviously identifying substrings (sanity — it is an opaque token)', () => {
    const id = createPreWritingInteractionId();
    expect(id).toMatch(/^[0-9a-f-]+$/i);
  });
});

// ─── Key stability (Test 1-4) ───────────────────────────────────────────────

describe('makeWarmupKey() — stability and discrimination', () => {
  const base = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };

  it('Test 1 — is stable for the same student+letter+case+interaction', () => {
    expect(makeWarmupKey(base)).toBe(makeWarmupKey({ ...base }));
  });

  it('Test 2 — different letter produces a different key', () => {
    expect(makeWarmupKey(base)).not.toBe(makeWarmupKey({ ...base, letter: 'o' }));
  });

  it('Test 3 — different case produces a different key', () => {
    expect(makeWarmupKey(base)).not.toBe(makeWarmupKey({ ...base, caseType: 'uppercase', letter: 'C' }));
  });

  it('Test 4 — different interaction produces a different key', () => {
    expect(makeWarmupKey(base)).not.toBe(makeWarmupKey({ ...base, interactionId: 'int-B' }));
  });

  it('Test 32 — case sensitivity: lowercase c and uppercase C never collapse to the same key', () => {
    const lower = makeWarmupKey({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    const upper = makeWarmupKey({ studentId: 13, caseType: 'uppercase', letter: 'C', interactionId: 'int-A' });
    expect(lower).not.toBe(upper);
  });
});

// ─── Mark / check (Test 5-8) ────────────────────────────────────────────────

describe('markWarmupHandled() / hasWarmupHandled() — Tests 5-8', () => {
  const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };

  it('Test 6/7 — unhandled key reads false before marking', () => {
    expect(hasWarmupHandled(args)).toBe(false);
  });

  it('Test 5/6 — mark handled, then the same check reads true', () => {
    expect(markWarmupHandled(args)).toBe(true);
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 8 — marking the same key twice is idempotent (no error, still true)', () => {
    markWarmupHandled(args);
    expect(() => markWarmupHandled(args)).not.toThrow();
    expect(hasWarmupHandled(args)).toBe(true);
  });
});

// ─── Reason vocabulary integration (Tests 9-11) ────────────────────────────

describe('Reason vocabulary — Tests 9-11', () => {
  it('Test 9 — fixed session-start reason marks handled', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.SESSION_START });
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 10 — category-transition reason marks handled', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'o', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.CATEGORY_TRANSITION });
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 11 — future adaptive reason (unused today) also marks handled', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 's', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY });
    expect(hasWarmupHandled(args)).toBe(true);

    // A conceptual "second check" for the same letter+interaction, as a
    // future adaptive trigger would perform, must see it as already handled
    // — no actual navigation trigger required to prove this (spec §29).
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('an invalid/unlisted reason string is stored as null rather than trusted blindly', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    expect(markWarmupHandled({ ...args, reason: 'not_a_real_reason' })).toBe(true);
    // still marked handled — reason is metadata only, never part of identity
    expect(hasWarmupHandled(args)).toBe(true);
  });
});

// ─── Teacher skip / save-failure semantics (Tests 12-13) ───────────────────

describe('Teacher-skip and save-failure semantics — Tests 12-13', () => {
  it('Test 12 — marking happens on "detour opened", so a teacher skip inside the activity screen cannot unmark it', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    // Marking occurs at the moment the caller decides to navigate — modeled
    // here directly, since PreWritingActivityScreen itself never calls this
    // guard (Step 3 does not modify that screen). Whatever happens inside
    // the screen afterward (teacher skip, multiple retries, scoring) has no
    // bearing on this already-recorded mark.
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.SESSION_START });
    // Simulate "child was teacher-skipped inside PreWritingActivityScreen" —
    // no corresponding guard call exists for that path, by design.
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 13 — a failed backend save does not unmark the guard (marking never depended on the POST)', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.SESSION_START });
    // There is no code path in this module that reacts to
    // POST /pre-writing-activity failing — nothing to simulate beyond
    // asserting the mark is unaffected by anything happening after it.
    expect(hasWarmupHandled(args)).toBe(true);
  });
});

// ─── Collection mode (Test 14) ──────────────────────────────────────────────

describe('Collection mode — Test 14', () => {
  const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };

  it('hasWarmupHandled always returns false for collectionMode=true, even after marking without the flag', () => {
    markWarmupHandled(args); // marked without collectionMode
    expect(hasWarmupHandled({ ...args, collectionMode: true })).toBe(false);
  });

  it('markWarmupHandled is a no-op when collectionMode=true — does not create guard state', () => {
    expect(markWarmupHandled({ ...args, collectionMode: true })).toBe(false);
    expect(hasWarmupHandled(args)).toBe(false); // never marked at all
  });
});

// ─── Invalid input (Test 15) ────────────────────────────────────────────────

describe('Invalid input — Test 15', () => {
  it.each([
    ['missing studentId', { studentId: undefined, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' }],
    ['missing caseType', { studentId: 13, caseType: undefined, letter: 'c', interactionId: 'int-A' }],
    ['invalid caseType', { studentId: 13, caseType: 'sideways', letter: 'c', interactionId: 'int-A' }],
    ['invalid letter (multi-char)', { studentId: 13, caseType: 'lowercase', letter: 'cc', interactionId: 'int-A' }],
    ['invalid letter (digit)', { studentId: 13, caseType: 'lowercase', letter: '3', interactionId: 'int-A' }],
    ['missing letter', { studentId: 13, caseType: 'lowercase', letter: undefined, interactionId: 'int-A' }],
    ['missing interactionId', { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: undefined }],
    ['empty interactionId', { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: '' }],
  ])('%s → makeWarmupKey returns null, hasWarmupHandled false, markWarmupHandled no-ops (never throws)', (_label, badArgs) => {
    expect(() => makeWarmupKey(badArgs)).not.toThrow();
    expect(makeWarmupKey(badArgs)).toBeNull();
    expect(() => hasWarmupHandled(badArgs)).not.toThrow();
    expect(hasWarmupHandled(badArgs)).toBe(false);
    expect(() => markWarmupHandled(badArgs)).not.toThrow();
    expect(markWarmupHandled(badArgs)).toBe(false);
  });

  it('completely empty call (no args object) never throws', () => {
    expect(() => makeWarmupKey()).not.toThrow();
    expect(() => hasWarmupHandled()).not.toThrow();
    expect(() => markWarmupHandled()).not.toThrow();
    expect(hasWarmupHandled()).toBe(false);
  });

  it('a numeric studentId and a string studentId that represent the same id resolve to the same key', () => {
    const a = makeWarmupKey({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    const b = makeWarmupKey({ studentId: '13', caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    expect(a).toBe(b);
  });
});

// ─── Same-letter within one interaction / different letter / different interaction (Tests 27-31) ─

describe('Interaction-scoping — Tests 27-31', () => {
  it('Test 27 — session-start warm-up (c) is recognized as handled after marking', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'session-int-1' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.SESSION_START });
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 28 — category-boundary warm-up (c) is recognized as handled after marking, blocking an immediate re-detour for the same letter', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'session-int-1' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.CATEGORY_TRANSITION });
    expect(hasWarmupHandled(args)).toBe(true);
  });

  it('Test 13 (same letter within one session) — same interaction + same letter is already handled on a second check', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'session-int-1' };
    markWarmupHandled(args);
    expect(hasWarmupHandled(args)).toBe(true);
    expect(hasWarmupHandled(args)).toBe(true); // repeat check, still true
  });

  it('Test 30 — different letter (o) in the same interaction as a handled letter (c) is NOT handled', () => {
    const interactionId = 'session-int-1';
    markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId });
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'o', interactionId })).toBe(false);
  });

  it('Test 31 — same letter (c) handled in interaction A is NOT handled in interaction B', () => {
    markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-A' });
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-B' })).toBe(false);
  });

  it('Test 14 (different family, different letter) — c (curved) handled does not block o (curved) later', () => {
    const interactionId = 'session-int-1';
    markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId, reason: PRE_WRITING_REASON.SESSION_START });
    // o is also curved-family, but the guard is per-letter, not per-family
    // — an adaptive warm-up for 'o' later in the SAME interaction must
    // still be considered "not yet handled".
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'o', interactionId })).toBe(false);
  });
});

// ─── Session-scoping / no global forever-history (Tests 16-18) ─────────────

describe('State scoping — Tests 16-18', () => {
  it('Test 16 — resetPreWritingGuardStore() clears all state (proves the store is not permanent by construction)', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled(args);
    expect(hasWarmupHandled(args)).toBe(true);
    resetPreWritingGuardStore();
    expect(hasWarmupHandled(args)).toBe(false);
  });

  it('Test 17 — this module never imports AsyncStorage or any RN storage API', () => {
    // Static source-scan, same technique used elsewhere in this project to
    // prove a module has no dependency on a particular API (see Feature 3's
    // source-scan tests in the backend for the same pattern). Scoped to
    // actual import/require statements, not prose — this file's own doc
    // comments legitimately discuss AsyncStorage (explaining why it is NOT
    // used), so a bare substring match on "AsyncStorage" would be a false
    // positive (the exact mistake Feature 3's own source-scan test made
    // once — see this project's memory of that fix).
    // eslint-disable-next-line global-require
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'preWritingSessionGuard.js'), 'utf8');
    const importLines = source.split('\n').filter(line => /^\s*import\s/.test(line));
    expect(importLines.some(line => /AsyncStorage/.test(line))).toBe(false);
    expect(importLines.some(line => /['"]\.\/storage['"]/.test(line))).toBe(false);
  });

  it('Test 18 — many distinct interactions do not leak into each other (no accidental global accumulation across interaction ids)', () => {
    for (let i = 0; i < 50; i++) {
      markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: `int-${i}` });
    }
    // Each interaction's key is independent — checking a brand-new,
    // never-marked interaction id still reads false regardless of how many
    // other interactions exist in the store.
    expect(hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-never-seen' })).toBe(false);
  });
});

// ─── buildPreWritingNavigationParams() — pure route-param assembly ─────────

describe('buildPreWritingNavigationParams()', () => {
  const baseArgs = {
    student: { sid: 13 },
    theme: { button: '#fff' },
    activities: [{ id: 'trace_circle' }],
    targetLetter: 'c',
    targetCaseType: 'lowercase',
    interactionId: 'int-A',
    reason: PRE_WRITING_REASON.SESSION_START,
    nextRoute: 'LetterWriting',
    nextParams: { student: { sid: 13 }, theme: { button: '#fff' }, caseType: 'lowercase', letterSequence: [] },
  };

  it('carries targetLetter/targetCaseType/interactionId/warmupReason at the top level', () => {
    const result = buildPreWritingNavigationParams(baseArgs);
    expect(result.targetLetter).toBe('c');
    expect(result.targetCaseType).toBe('lowercase');
    expect(result.interactionId).toBe('int-A');
    expect(result.warmupReason).toBe(PRE_WRITING_REASON.SESSION_START);
  });

  it('folds interactionId into nextParams so it survives navigation.replace(nextRoute, nextParams)', () => {
    const result = buildPreWritingNavigationParams(baseArgs);
    expect(result.nextParams.interactionId).toBe('int-A');
    // every other nextParams field is preserved untouched (same object
    // reference as the input nextParams.student, not baseArgs.student —
    // those are deliberately two separate literals in this fixture).
    expect(result.nextParams.caseType).toBe('lowercase');
    expect(result.nextParams.student).toBe(baseArgs.nextParams.student);
  });

  it('does not mutate the input nextParams object', () => {
    const original = { ...baseArgs.nextParams };
    buildPreWritingNavigationParams(baseArgs);
    expect(baseArgs.nextParams).toEqual(original);
  });

  it('passes activities and student/theme through unchanged (no activity-selection logic here)', () => {
    const result = buildPreWritingNavigationParams(baseArgs);
    expect(result.activities).toBe(baseArgs.activities);
    expect(result.student).toBe(baseArgs.student);
    expect(result.theme).toBe(baseArgs.theme);
  });

  it('does NOT mark any guard state itself — callers must call markWarmupHandled explicitly', () => {
    resetPreWritingGuardStore();
    buildPreWritingNavigationParams(baseArgs);
    expect(hasWarmupHandled({
      studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A',
    })).toBe(false);
  });
});

// ─── resolveAdaptivePreWritingDetour() — Feature 4 Step 5, Tests 26-39 ─────

describe('resolveAdaptivePreWritingDetour()', () => {
  const activity = { id: 'connect_curve_dots' };

  function baseParams(overrides = {}) {
    return {
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', interactionId: 'int-A' },
      activity,
      alreadyHandled: false,
      collectionMode: false,
      currentLetter: 'c',
      currentCaseType: 'lowercase',
      currentInteractionId: 'int-A',
      currentAttempt: 1,
      hasDrawn: false,
      ...overrides,
    };
  }

  it('Test 26 — recommended + unhandled + attempt 1 + not drawn → navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams());
    expect(result).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
  });

  it('Test 27 — recommended + already handled → no navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ alreadyHandled: true }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('Test 28 — recommendation.recommended=false → no navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({
      recommendation: { recommended: false, letter: 'c', caseType: 'lowercase', interactionId: 'int-A' },
    }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.NOT_RECOMMENDED });
  });

  it('Test 29 — collectionMode=true → no navigate, checked before anything else', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ collectionMode: true }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.COLLECTION_MODE });
  });

  it('Test 30 — activity=null (unresolvable activityId) → no navigate, never substitutes another activity', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ activity: null }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.NO_ACTIVITY_RESOLVED });
  });

  it('Test 31 — stale letter (recommendation for a different letter than currentLetter) → no navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ currentLetter: 'i' }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.STALE_LETTER });
  });

  it('stale case type in isolation (same literal letter, mismatched caseType) → no navigate', () => {
    // Artificial in practice (letter and caseType normally move together),
    // but isolates the caseType-mismatch branch specifically, independent
    // of the letter check above it.
    const result = resolveAdaptivePreWritingDetour(baseParams({ currentCaseType: 'uppercase' }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.STALE_CASE_TYPE });
  });

  it('Test 32 — stale interaction (recommendation resolved for a since-superseded interaction) → no navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ currentInteractionId: 'int-B' }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.STALE_INTERACTION });
  });

  it('Test 33 — child has already started drawing → no navigate (no mid-attempt detour)', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ hasDrawn: true }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_DRAWING });
  });

  it('Test 34 — attempt already advanced past 1 → no navigate', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ currentAttempt: 2 }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ATTEMPT_ADVANCED });
  });

  it('Test 35 — a fixed session-start mark (real guard, not a stub) suppresses the adaptive detour', () => {
    resetPreWritingGuardStore();
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.SESSION_START });
    const alreadyHandled = hasWarmupHandled(args);
    const result = resolveAdaptivePreWritingDetour(baseParams({ alreadyHandled }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('Test 36 — a fixed category-boundary mark (real guard) suppresses the adaptive detour', () => {
    resetPreWritingGuardStore();
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.CATEGORY_TRANSITION });
    const alreadyHandled = hasWarmupHandled(args);
    const result = resolveAdaptivePreWritingDetour(baseParams({ alreadyHandled }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('Test 37 — a prior adaptive mark (real guard) suppresses a SECOND adaptive detour for the same letter/interaction', () => {
    resetPreWritingGuardStore();
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    markWarmupHandled({ ...args, reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY });
    const alreadyHandled = hasWarmupHandled(args);
    const result = resolveAdaptivePreWritingDetour(baseParams({ alreadyHandled }));
    expect(result).toEqual({ shouldNavigate: false, reason: NAV_REASON.ALREADY_HANDLED });
  });

  it('Test 38 — a different letter (not yet marked) remains eligible even though another letter in the same interaction is handled', () => {
    resetPreWritingGuardStore();
    markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    const alreadyHandled = hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'o', interactionId: 'int-A' });
    const result = resolveAdaptivePreWritingDetour(baseParams({
      recommendation: { recommended: true, letter: 'o', caseType: 'lowercase', interactionId: 'int-A' },
      currentLetter: 'o', alreadyHandled,
    }));
    expect(result).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
  });

  it('Test 39 — the same letter in a different interaction remains eligible even though it was handled in interaction A', () => {
    resetPreWritingGuardStore();
    markWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-A' });
    const alreadyHandled = hasWarmupHandled({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-B' });
    const result = resolveAdaptivePreWritingDetour(baseParams({
      currentInteractionId: 'interaction-B', alreadyHandled,
      recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', interactionId: 'interaction-B' },
    }));
    expect(result).toEqual({ shouldNavigate: true, reason: NAV_REASON.ADAPTIVE_RECOMMENDATION });
  });

  it('missing/undefined recommendation never throws', () => {
    expect(() => resolveAdaptivePreWritingDetour(baseParams({ recommendation: null }))).not.toThrow();
    expect(resolveAdaptivePreWritingDetour(baseParams({ recommendation: null }))).toEqual({
      shouldNavigate: false, reason: NAV_REASON.NOT_RECOMMENDED,
    });
  });

  it('completely missing args object never throws', () => {
    expect(() => resolveAdaptivePreWritingDetour()).not.toThrow();
    expect(resolveAdaptivePreWritingDetour().shouldNavigate).toBe(false);
  });

  it('order of checks: collection mode wins even over a stale/mismatched recommendation', () => {
    const result = resolveAdaptivePreWritingDetour(baseParams({ collectionMode: true, activity: null, currentLetter: 'z' }));
    expect(result.reason).toBe(NAV_REASON.COLLECTION_MODE);
  });
});
