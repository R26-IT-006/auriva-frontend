// Verifies the pending-finalization storage functions added in Reliability
// Step 2. Uses the AsyncStorage package's own bundled jest mock (an in-memory
// store) — no real device storage involved.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// storage.js also imports expo-secure-store (for the unrelated auth-token
// helpers, untouched by this step) — its ESM build isn't transformable under
// this project's deliberately minimal, non-jest-expo Jest config (see
// jest.config.js), so it must be stubbed even though these tests never call it.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const {
  storePendingFinalization, getPendingFinalization, clearPendingFinalization,
  getPendingFinalizationsForStudent,
} = require('./storage');

function makeRecord(overrides = {}) {
  return {
    assessmentId: 202,
    studentId: 13,
    motorScore: 55,
    motorProfile: { straightScore: 62, curvedScore: 83, complexScore: 68 },
    createdAt: '2026-08-07T18:53:00.000Z',
    attemptCount: 0,
    status: 'pending',
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ─── Storage Test 1 — Store then retrieve ──────────────────────────────────

describe('Storage Test 1 — store then retrieve', () => {
  it('retrieves an identical record after storing it', async () => {
    const record = makeRecord();
    const ok = await storePendingFinalization(13, 202, record);

    expect(ok).toBe(true);
    const retrieved = await getPendingFinalization(13, 202);
    expect(retrieved).toEqual(record);
  });
});

// ─── Storage Test 2 — Clear then retrieve ──────────────────────────────────

describe('Storage Test 2 — clear then retrieve', () => {
  it('returns null after clearing', async () => {
    await storePendingFinalization(13, 202, makeRecord());
    const cleared = await clearPendingFinalization(13, 202);

    expect(cleared).toBe(true);
    expect(await getPendingFinalization(13, 202)).toBeNull();
  });
});

// ─── Storage Test 3 — Different assessments, same student ─────────────────

describe('Storage Test 3 — different assessments do not collide', () => {
  it('two assessments for the same student are stored independently', async () => {
    await storePendingFinalization(13, 202, makeRecord({ assessmentId: 202, motorScore: 55 }));
    await storePendingFinalization(13, 305, makeRecord({ assessmentId: 305, motorScore: 70 }));

    expect((await getPendingFinalization(13, 202)).motorScore).toBe(55);
    expect((await getPendingFinalization(13, 305)).motorScore).toBe(70);

    await clearPendingFinalization(13, 202);
    expect(await getPendingFinalization(13, 202)).toBeNull();
    expect((await getPendingFinalization(13, 305)).motorScore).toBe(70); // untouched
  });
});

// ─── Storage Test 4 — Different students do not collide ───────────────────

describe('Storage Test 4 — different students do not collide', () => {
  it('the same assessmentId under two different studentIds does not overwrite', async () => {
    await storePendingFinalization(13, 202, makeRecord({ studentId: 13, motorScore: 55 }));
    await storePendingFinalization(14, 202, makeRecord({ studentId: 14, motorScore: 90 }));

    expect((await getPendingFinalization(13, 202)).motorScore).toBe(55);
    expect((await getPendingFinalization(14, 202)).motorScore).toBe(90);
  });
});

// ─── Storage Test 5 — Write failure is observable ──────────────────────────

describe('Storage Test 5 — write failure is observable', () => {
  // Deliberately NOT jest.spyOn(...).mockRestore() here: AsyncStorage.setItem/
  // removeItem are ALREADY jest.fn()s from the bundled async-storage-mock, and
  // spyOn+mockRestore on an already-mocked function does not reliably restore
  // its real (mock-package) implementation afterward — it can leave the
  // property as an inert stub that silently no-ops for every later test in
  // this file (discovered empirically: it broke every Discovery test below
  // until fixed). Calling .mockRejectedValueOnce() directly on the existing
  // jest.fn() is simpler and self-clears after one use with no restore step.
  let consoleSpy;
  beforeEach(() => { consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('storePendingFinalization returns false when AsyncStorage.setItem rejects', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));

    const ok = await storePendingFinalization(13, 202, makeRecord());

    expect(ok).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('clearPendingFinalization returns false when AsyncStorage.removeItem rejects', async () => {
    AsyncStorage.removeItem.mockRejectedValueOnce(new Error('disk full'));

    const ok = await clearPendingFinalization(13, 202);
    expect(ok).toBe(false);
  });
});

// ─── Storage Test 6 — Malformed stored data handled safely ────────────────

describe('Storage Test 6 — malformed stored data', () => {
  it('returns null instead of throwing when the stored value is not valid JSON', async () => {
    await AsyncStorage.setItem('student_13_pendingFinalize_202', 'not-json{{{');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getPendingFinalization(13, 202);

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Pending discovery / index — Reliability Step 3
// ═════════════════════════════════════════════════════════════════════════

// ─── Discovery Test 1 — one record ──────────────────────────────────────────

describe('Discovery Test 1 — one pending record', () => {
  it('getPendingFinalizationsForStudent returns it', async () => {
    const record = makeRecord();
    await storePendingFinalization(13, 202, record);

    const results = await getPendingFinalizationsForStudent(13);
    expect(results).toEqual([record]);
  });
});

// ─── Discovery Test 2 — two pending assessments ────────────────────────────

describe('Discovery Test 2 — two pending assessments for one student', () => {
  it('returns both', async () => {
    await storePendingFinalization(13, 202, makeRecord({ assessmentId: 202 }));
    await storePendingFinalization(13, 305, makeRecord({ assessmentId: 305 }));

    const results = await getPendingFinalizationsForStudent(13);
    expect(results.map(r => r.assessmentId).sort()).toEqual([202, 305]);
  });
});

// ─── Discovery Test 3 — different students isolated ────────────────────────

describe('Discovery Test 3 — different students remain isolated', () => {
  it('student 14s record never appears in student 13s discovery list', async () => {
    await storePendingFinalization(13, 202, makeRecord({ studentId: 13 }));
    await storePendingFinalization(14, 305, makeRecord({ studentId: 14, assessmentId: 305 }));

    const results13 = await getPendingFinalizationsForStudent(13);
    expect(results13).toHaveLength(1);
    expect(results13[0].assessmentId).toBe(202);
  });
});

// ─── Discovery Test 4 — clearing removes from discovery ────────────────────

describe('Discovery Test 4 — clearing removes it from discovery', () => {
  it('a cleared record no longer appears', async () => {
    await storePendingFinalization(13, 202, makeRecord({ assessmentId: 202 }));
    await storePendingFinalization(13, 305, makeRecord({ assessmentId: 305 }));
    await clearPendingFinalization(13, 202);

    const results = await getPendingFinalizationsForStudent(13);
    expect(results.map(r => r.assessmentId)).toEqual([305]);
  });
});

// ─── Discovery Test 5 — stale index entry handled safely ──────────────────

describe('Discovery Test 5 — stale index entry', () => {
  it('an index entry whose record is missing is dropped safely, without throwing', async () => {
    await storePendingFinalization(13, 202, makeRecord({ assessmentId: 202 }));
    // Simulate corruption: the record itself is gone, but the index (written
    // separately) still references it — e.g. a partial/interrupted write.
    await AsyncStorage.removeItem('student_13_pendingFinalize_202');

    const results = await getPendingFinalizationsForStudent(13);
    expect(results).toEqual([]);

    // Self-healed: a second call finds the same (empty) result without
    // re-attempting to read the now-permanently-missing record forever.
    const resultsAgain = await getPendingFinalizationsForStudent(13);
    expect(resultsAgain).toEqual([]);
  });
});

// ─── Discovery Test 6 — app-restart simulation ─────────────────────────────

describe('Discovery Test 6 — app-restart simulation', () => {
  it('a record stored before a simulated restart is still discoverable after', async () => {
    await storePendingFinalization(13, 202, makeRecord());

    // Simulate an app restart: force storage.js to be freshly re-required,
    // as it would be on a fresh JS process — while AsyncStorage's own module
    // (standing in for the device's real persistent store, which does NOT
    // reset on restart) is deliberately left untouched, keeping its data.
    delete require.cache[require.resolve('./storage')];
    const freshStorage = require('./storage');

    const results = await freshStorage.getPendingFinalizationsForStudent(13);
    expect(results).toHaveLength(1);
    expect(results[0].assessmentId).toBe(202);
  });
});
