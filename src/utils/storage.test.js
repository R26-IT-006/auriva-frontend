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
  it('storePendingFinalization returns false when AsyncStorage.setItem rejects', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await storePendingFinalization(13, 202, makeRecord());

    expect(ok).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('clearPendingFinalization returns false when AsyncStorage.removeItem rejects', async () => {
    const spy = jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await clearPendingFinalization(13, 202);
    expect(ok).toBe(false);
    spy.mockRestore();
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
