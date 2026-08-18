// Verifies attemptFinalization()/syncPendingFinalization() (Reliability
// Step 2) and retryPendingFinalization()/retryPendingFinalizationForStudent()/
// selectOldestPendingRecord() (Reliability Step 3) in isolation. Covers the
// "AssessmentCompleteScreen" test list for everything that is genuinely
// orchestration logic (Tests 1-7, 10) — see the note further down for why
// Tests 8 (collection mode) and 9 (double-tap) cannot be automated with this
// project's current Jest setup.
const mockPatch = jest.fn();
jest.mock('../api/client', () => ({ patch: (...args) => mockPatch(...args) }));

const mockStore = jest.fn();
const mockClear = jest.fn();
const mockGetForStudent = jest.fn();
jest.mock('./storage', () => ({
  storePendingFinalization: (...args) => mockStore(...args),
  clearPendingFinalization: (...args) => mockClear(...args),
  getPendingFinalizationsForStudent: (...args) => mockGetForStudent(...args),
}));

const {
  attemptFinalization, syncPendingFinalization,
  retryPendingFinalization, retryPendingFinalizationForStudent, selectOldestPendingRecord,
} = require('./finalizeSync');

function baseParams(overrides = {}) {
  return {
    studentId: 13,
    assessmentId: 202,
    motorScore: 55,
    motorProfile: { straightScore: 62, curvedScore: 83, complexScore: 68 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.mockResolvedValue(true);
  mockClear.mockResolvedValue(true);
});

// ─── Test 1 — Pending persisted before PATCH ───────────────────────────────

describe('Test 1 — pending persisted before the PATCH', () => {
  it('storePendingFinalization is called, and its call order precedes client.patch', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });

    await attemptFinalization(baseParams());

    expect(mockStore).toHaveBeenCalled();
    expect(mockPatch).toHaveBeenCalled();
    expect(mockStore.mock.invocationCallOrder[0]).toBeLessThan(mockPatch.mock.invocationCallOrder[0]);
  });

  it('the persisted record is a complete, replayable payload (not just the 3 family scores)', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });
    const profile = { straightScore: 62, curvedScore: 83, complexScore: 68, primaryStrength: 'curved', categoryOrder: ['curved'], recommendedSequence: 'x', shapeScores: { a: 1 } };

    await attemptFinalization(baseParams({ motorProfile: profile }));

    expect(mockStore).toHaveBeenNthCalledWith(1, 13, 202, expect.objectContaining({
      assessmentId: 202, studentId: 13, motorScore: 55, motorProfile: profile,
      attemptCount: 0, status: 'pending',
    }));
  });
});

// ─── Test 2 — Successful PATCH ─────────────────────────────────────────────

describe('Test 2 — successful PATCH', () => {
  it('stores, awaits the PATCH, then clears the pending record', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });

    const result = await attemptFinalization(baseParams());

    expect(mockStore).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockClear).toHaveBeenCalledWith(13, 202);
    expect(result).toEqual({ status: 'success' });
  });
});

// ─── Test 3 — already_finalized response ───────────────────────────────────

describe('Test 3 — already_finalized response treated as success', () => {
  it('clears the pending record just like a fresh finalize', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'already_finalized', baselineStatus: 'already_exists' } });

    const result = await attemptFinalization(baseParams());

    expect(mockClear).toHaveBeenCalledWith(13, 202);
    expect(result).toEqual({ status: 'success' });
  });
});

// ─── Test 4 — Network failure ──────────────────────────────────────────────

describe('Test 4 — network failure', () => {
  it('keeps the pending record with attemptCount incremented, still resolves (never throws)', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Network error. Check your connection.'));

    const result = await attemptFinalization(baseParams());

    expect(mockClear).not.toHaveBeenCalled();
    // Second store() call re-persists the record with attemptCount bumped.
    expect(mockStore).toHaveBeenCalledTimes(2);
    expect(mockStore).toHaveBeenNthCalledWith(2, 13, 202, expect.objectContaining({ attemptCount: 1, status: 'pending' }));
    expect(result).toEqual({ status: 'pending' });
  });
});

// ─── Test 5 — 500/server failure ───────────────────────────────────────────

describe('Test 5 — server failure (500)', () => {
  it('same reliability behavior as a network failure', async () => {
    const err = new Error('Internal server error');
    err.status = 500;
    mockPatch.mockRejectedValueOnce(err);

    const result = await attemptFinalization(baseParams());

    expect(mockClear).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'pending' });
  });
});

// ─── Test 6 — 409 conflict ──────────────────────────────────────────────────

describe('Test 6 — 409 conflict', () => {
  it('keeps the pending record marked conflict, does not clear, no special retry', async () => {
    const err = new Error('Assessment has already been finalized with different values');
    err.status = 409;
    mockPatch.mockRejectedValueOnce(err);

    const result = await attemptFinalization(baseParams());

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockStore).toHaveBeenNthCalledWith(2, 13, 202, expect.objectContaining({ status: 'conflict' }));
    expect(result).toEqual({ status: 'conflict' });
  });
});

// ─── Test 7 — No assessmentId ───────────────────────────────────────────────

describe('Test 7 — no assessmentId', () => {
  let warnSpy;
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it('creates no pending record and attempts no PATCH', async () => {
    const result = await attemptFinalization(baseParams({ assessmentId: null }));

    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'skipped' });
  });

  it('also skips when motorScore is null (AssessmentCompleteScreen had no shape data to average)', async () => {
    const result = await attemptFinalization(baseParams({ motorScore: null }));

    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'skipped' });
  });
});

// ─── syncPendingFinalization (direct) ──────────────────────────────────────

describe('syncPendingFinalization', () => {
  it('sends motor_score/motor_profile as the PATCH body to the correct endpoint', async () => {
    mockPatch.mockResolvedValueOnce({ data: { id: 202 } });

    await syncPendingFinalization({ assessmentId: 202, motorScore: 55, motorProfile: { straightScore: 62 } });

    expect(mockPatch).toHaveBeenCalledWith('/handwriting/assessment/202/finalize', {
      motor_score: 55, motor_profile: { straightScore: 62 },
    });
  });

  it('never throws — resolves { ok: false } on any rejection', async () => {
    mockPatch.mockRejectedValueOnce(new Error('boom'));
    await expect(syncPendingFinalization({ assessmentId: 202, motorScore: 55, motorProfile: {} }))
      .resolves.toEqual({ ok: false, conflict: false, response: null });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Reliability Step 3 — retry from LetterHomeScreen
// ═════════════════════════════════════════════════════════════════════════

function makeStoredRecord(overrides = {}) {
  return {
    assessmentId: 202,
    studentId: 13,
    motorScore: 55,
    motorProfile: { straightScore: 62, curvedScore: 83, complexScore: 68 },
    createdAt: '2026-08-07T18:53:00.000Z',
    attemptCount: 1,
    status: 'pending',
    ...overrides,
  };
}

// ─── Retry Test 1 — Pending success ────────────────────────────────────────

describe('Retry Test 1 — pending success', () => {
  it('clears the record when the PATCH succeeds', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });

    const result = await retryPendingFinalization(makeStoredRecord({ attemptCount: 1 }));

    expect(result).toEqual({ status: 'success' });
    expect(mockClear).toHaveBeenCalledWith(13, 202);
    expect(mockStore).not.toHaveBeenCalled(); // no need to re-persist on success
  });
});

// ─── Retry Test 2 — Pending network failure ────────────────────────────────

describe('Retry Test 2 — pending network failure', () => {
  it('bumps attemptCount, keeps status pending, record remains', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Network error. Check your connection.'));

    const result = await retryPendingFinalization(makeStoredRecord({ attemptCount: 1 }));

    expect(result).toEqual({ status: 'pending' });
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockStore).toHaveBeenCalledWith(13, 202, expect.objectContaining({ attemptCount: 2, status: 'pending' }));
  });
});

// ─── Retry Test 3 — Pending 500 ─────────────────────────────────────────────

describe('Retry Test 3 — pending, server 500', () => {
  it('same behavior as a network failure', async () => {
    const err = new Error('Internal server error');
    err.status = 500;
    mockPatch.mockRejectedValueOnce(err);

    const result = await retryPendingFinalization(makeStoredRecord({ attemptCount: 1 }));

    expect(result).toEqual({ status: 'pending' });
    expect(mockStore).toHaveBeenCalledWith(13, 202, expect.objectContaining({ attemptCount: 2, status: 'pending' }));
  });
});

// ─── Retry Test 4 — 409 ──────────────────────────────────────────────────────

describe('Retry Test 4 — 409 conflict', () => {
  it('bumps attemptCount and marks status conflict', async () => {
    const err = new Error('Assessment has already been finalized with different values');
    err.status = 409;
    mockPatch.mockRejectedValueOnce(err);

    const result = await retryPendingFinalization(makeStoredRecord({ attemptCount: 1 }));

    expect(result).toEqual({ status: 'conflict' });
    expect(mockStore).toHaveBeenCalledWith(13, 202, expect.objectContaining({ attemptCount: 2, status: 'conflict' }));
    expect(mockClear).not.toHaveBeenCalled();
  });
});

// ─── Retry Test 5 — Conflict is not retried ────────────────────────────────

describe('Retry Test 5 — conflict records are never auto-retried', () => {
  it('retryPendingFinalizationForStudent does not call client.patch for a conflict-only record', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetForStudent.mockResolvedValueOnce([makeStoredRecord({ status: 'conflict' })]);

    const result = await retryPendingFinalizationForStudent(13);

    expect(result).toEqual({ status: 'none' });
    expect(mockPatch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('selectOldestPendingRecord itself excludes conflict records', () => {
    const conflict = makeStoredRecord({ assessmentId: 1, status: 'conflict' });
    expect(selectOldestPendingRecord([conflict])).toBeNull();
  });
});

// ─── Retry Test 6 — createdAt preserved ────────────────────────────────────

describe('Retry Test 6 — createdAt preserved', () => {
  it('a failed retry never changes the original createdAt', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Network error. Check your connection.'));
    const original = makeStoredRecord({ createdAt: '2026-01-01T00:00:00.000Z', attemptCount: 1 });

    await retryPendingFinalization(original);

    expect(mockStore).toHaveBeenCalledWith(13, 202, expect.objectContaining({ createdAt: '2026-01-01T00:00:00.000Z' }));
  });
});

// ─── Retry Test 7 — Complete motor profile replayed ────────────────────────

describe('Retry Test 7 — complete motor profile replayed', () => {
  it('PATCH receives exactly motor_score/motor_profile from the stored record', async () => {
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });
    const profile = { straightScore: 62, curvedScore: 83, complexScore: 68, primaryStrength: 'curved', categoryOrder: ['curved'], recommendedSequence: 'x', shapeScores: { a: 1 } };

    await retryPendingFinalization(makeStoredRecord({ motorProfile: profile }));

    expect(mockPatch).toHaveBeenCalledWith('/handwriting/assessment/202/finalize', {
      motor_score: 55, motor_profile: profile,
    });
  });
});

// ─── Retry Test 8 — One selected record ────────────────────────────────────

describe('Retry Test 8 — only the oldest pending record is selected', () => {
  it('selectOldestPendingRecord picks the earliest createdAt among pending records', () => {
    const older   = makeStoredRecord({ assessmentId: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    const newer   = makeStoredRecord({ assessmentId: 2, createdAt: '2026-02-01T00:00:00.000Z' });
    const conflict = makeStoredRecord({ assessmentId: 3, createdAt: '2025-12-01T00:00:00.000Z', status: 'conflict' });

    expect(selectOldestPendingRecord([newer, older, conflict])).toEqual(older);
  });

  it('retryPendingFinalizationForStudent makes exactly one PATCH call, not Promise.all over several', async () => {
    const older = makeStoredRecord({ assessmentId: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeStoredRecord({ assessmentId: 2, createdAt: '2026-02-01T00:00:00.000Z' });
    mockGetForStudent.mockResolvedValueOnce([newer, older]);
    mockPatch.mockResolvedValueOnce({ data: { finalizeStatus: 'finalized' } });

    await retryPendingFinalizationForStudent(13);

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith('/handwriting/assessment/1/finalize', expect.any(Object));
  });
});

// ─── retryPendingFinalizationForStudent — additional coverage ─────────────

describe('retryPendingFinalizationForStudent — additional coverage', () => {
  it('does nothing (no PATCH) when there is no pending record at all', async () => {
    mockGetForStudent.mockResolvedValueOnce([]);
    const result = await retryPendingFinalizationForStudent(13);
    expect(result).toEqual({ status: 'none' });
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('skips a corrupt/incomplete record without sending a malformed PATCH', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetForStudent.mockResolvedValueOnce([makeStoredRecord({ motorProfile: null })]);

    const result = await retryPendingFinalizationForStudent(13);

    expect(result).toEqual({ status: 'invalid_record' });
    expect(mockPatch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs (IDs only) when a conflict record is present, without retrying it', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetForStudent.mockResolvedValueOnce([makeStoredRecord({ assessmentId: 9, status: 'conflict' })]);

    await retryPendingFinalizationForStudent(13);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('conflict requires review'));
    expect(warnSpy.mock.calls[0][0]).toContain('9');
    expect(mockPatch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── Test 8 (collection mode) / Test 9 (double-tap) / Test 10 (calculation
// preserved) — NOT automated here. All three are properties of
// AssessmentCompleteScreen.js's React component (the collectionMode early
// return, the isSaving state guard, and the
// generateAdaptiveSequence/motor_score averaging/storeLetterSequence/
// storeMotorProfile call sites), not of attemptFinalization(). This
// project's jest.config.js runs in a plain Node environment with testMatch
// limited to src/utils/**/*.test.js and no React Native rendering harness
// (no jest-expo preset, no react-test-renderer) — a screen file that imports
// react-native/expo-linear-gradient/expo-av cannot be required from a test
// at all today. See the Reliability Step 2 report for the reviewed diff
// confirming these three behaviors by inspection instead.
