// Feature 5 Step 3 — repetitionSessionGuard.js tests (Tests 17-26).
//
// Pure logic only: no navigation, no component rendering, no network.
// Proves the interaction-scoped adaptive-repetition counter contract Step 3
// activation depends on.

import {
  makeRepetitionKey,
  getAdaptiveRepetitionsUsed,
  incrementAdaptiveRepetitionsUsed,
  resetRepetitionGuardStore,
} from './repetitionSessionGuard';

beforeEach(() => {
  resetRepetitionGuardStore();
});

// ─── Test 17 — initial count 0 ──────────────────────────────────────────────

describe('Test 17 — initial count is 0 before any increment', () => {
  it('returns 0 for a never-touched key', () => {
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' })).toBe(0);
  });
});

// ─── Test 18 — increment to 1 ───────────────────────────────────────────────

describe('Test 18 — increment to 1', () => {
  it('a single increment brings the count to 1', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    expect(incrementAdaptiveRepetitionsUsed(args)).toBe(true);
    expect(getAdaptiveRepetitionsUsed(args)).toBe(1);
  });
});

// ─── Test 19 — duplicate increment behavior explicit ───────────────────────

describe('Test 19 — duplicate increment behavior is explicit (each call adds 1, no dedup)', () => {
  it('two increments produce count 2 — callers are responsible for calling exactly once per real insertion', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    incrementAdaptiveRepetitionsUsed(args);
    incrementAdaptiveRepetitionsUsed(args);
    expect(getAdaptiveRepetitionsUsed(args)).toBe(2);
  });
});

// ─── Test 20 — different letter independent ────────────────────────────────

describe('Test 20 — different letter is independent', () => {
  it('incrementing c does not affect o in the same interaction', () => {
    const interactionId = 'int-A';
    incrementAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId });
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'o', interactionId })).toBe(0);
  });
});

// ─── Test 21 — uppercase/lowercase independent ─────────────────────────────

describe('Test 21 — uppercase/lowercase independent', () => {
  it('c (lowercase) and C (uppercase) never share a count', () => {
    const interactionId = 'int-A';
    incrementAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId });
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'uppercase', letter: 'C', interactionId })).toBe(0);
  });
});

// ─── Test 22 — different interaction independent ───────────────────────────

describe('Test 22 — different interaction independent', () => {
  it('c handled in interaction A does not affect c in interaction B', () => {
    incrementAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-A' });
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'interaction-B' })).toBe(0);
  });
});

// ─── Test 23 — collection no-op ─────────────────────────────────────────────

describe('Test 23 — collection mode is always a no-op', () => {
  const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };

  it('getAdaptiveRepetitionsUsed always returns 0 for collectionMode=true, even after an increment without the flag', () => {
    incrementAdaptiveRepetitionsUsed(args);
    expect(getAdaptiveRepetitionsUsed({ ...args, collectionMode: true })).toBe(0);
  });

  it('incrementAdaptiveRepetitionsUsed is a no-op when collectionMode=true — creates no state', () => {
    expect(incrementAdaptiveRepetitionsUsed({ ...args, collectionMode: true })).toBe(false);
    expect(getAdaptiveRepetitionsUsed(args)).toBe(0); // never incremented at all
  });
});

// ─── Test 24 — invalid input ────────────────────────────────────────────────

describe('Test 24 — invalid input fails safely, never throws', () => {
  it.each([
    ['missing studentId', { studentId: undefined, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' }],
    ['invalid caseType', { studentId: 13, caseType: 'sideways', letter: 'c', interactionId: 'int-A' }],
    ['invalid letter (multi-char)', { studentId: 13, caseType: 'lowercase', letter: 'cc', interactionId: 'int-A' }],
    ['missing interactionId', { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: undefined }],
    ['empty interactionId', { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: '' }],
  ])('%s -> makeRepetitionKey null, getAdaptiveRepetitionsUsed 0, incrementAdaptiveRepetitionsUsed false', (_label, badArgs) => {
    expect(() => makeRepetitionKey(badArgs)).not.toThrow();
    expect(makeRepetitionKey(badArgs)).toBeNull();
    expect(() => getAdaptiveRepetitionsUsed(badArgs)).not.toThrow();
    expect(getAdaptiveRepetitionsUsed(badArgs)).toBe(0);
    expect(() => incrementAdaptiveRepetitionsUsed(badArgs)).not.toThrow();
    expect(incrementAdaptiveRepetitionsUsed(badArgs)).toBe(false);
  });

  it('completely empty call (no args object) never throws', () => {
    expect(() => makeRepetitionKey()).not.toThrow();
    expect(() => getAdaptiveRepetitionsUsed()).not.toThrow();
    expect(() => incrementAdaptiveRepetitionsUsed()).not.toThrow();
    expect(getAdaptiveRepetitionsUsed()).toBe(0);
  });

  it('a numeric studentId and a string studentId that represent the same id resolve to the same key', () => {
    const a = makeRepetitionKey({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    const b = makeRepetitionKey({ studentId: '13', caseType: 'lowercase', letter: 'c', interactionId: 'int-A' });
    expect(a).toBe(b);
  });
});

// ─── Test 25 — no AsyncStorage ──────────────────────────────────────────────

describe('Test 25 — this module never imports AsyncStorage or any RN storage API', () => {
  it('scoped to actual import statements, not prose (same discipline as preWritingSessionGuard.test.js Test 17)', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'repetitionSessionGuard.js'), 'utf8');
    const importLines = source.split('\n').filter(line => /^\s*import\s/.test(line));
    expect(importLines).toHaveLength(0); // this module has zero imports at all
    expect(source).not.toMatch(/from ['"].*AsyncStorage['"]/);
  });
});

// ─── Test 26 — process/session-scoped only ─────────────────────────────────

describe('Test 26 — state is process/session-scoped only, no global forever-history', () => {
  it('resetRepetitionGuardStore() clears all state (proves the store is not permanent by construction)', () => {
    const args = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };
    incrementAdaptiveRepetitionsUsed(args);
    expect(getAdaptiveRepetitionsUsed(args)).toBe(1);
    resetRepetitionGuardStore();
    expect(getAdaptiveRepetitionsUsed(args)).toBe(0);
  });

  it('many distinct interactions do not leak into each other', () => {
    for (let i = 0; i < 50; i++) {
      incrementAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: `int-${i}` });
    }
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-never-seen' })).toBe(0);
  });
});

// ─── Key stability (mirrors preWritingSessionGuard's own coverage) ─────────

describe('makeRepetitionKey() — stability and discrimination', () => {
  const base = { studentId: 13, caseType: 'lowercase', letter: 'c', interactionId: 'int-A' };

  it('is stable for the same student+letter+case+interaction', () => {
    expect(makeRepetitionKey(base)).toBe(makeRepetitionKey({ ...base }));
  });

  it('is independent from Feature 4\'s own warmup key namespace (different module, no shared key format assumption enforced beyond this module\'s own tests)', () => {
    // Not directly comparable (different modules), but sanity-check the
    // format itself is the expected delimiter-joined string.
    expect(makeRepetitionKey(base)).toBe('13::lowercase::c::int-A');
  });
});
