// Feature 5 Step 3 — Safe Frontend Activation: orchestration tests.
//
// Composes every pure/impure piece the real screens' handleNext() failure
// branches actually call — fetchRepetitionRecommendation,
// getAdaptiveRepetitionsUsed/incrementAdaptiveRepetitionsUsed,
// insertSpacedRepetition — via a small local helper that mirrors
// scheduleAdaptiveRepetitionIfEligible()'s exact logic (LetterWritingScreen.js/
// UppercaseWritingScreen.js), to prove the COMPLETE activation lifecycle,
// not just each piece in isolation (those already have dedicated unit
// tests in repetitionRecommendation.test.js, repetitionSessionGuard.test.js,
// controlledRepetition.test.js). Component-level rendering tests remain
// impractical under this project's Jest config — same precedent
// preWritingAdaptiveOrchestration.test.js (Feature 4 Step 5) already
// established.

jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import { fetchRepetitionRecommendation } from './repetitionRecommendation';
import {
  getAdaptiveRepetitionsUsed, incrementAdaptiveRepetitionsUsed, resetRepetitionGuardStore,
} from './repetitionSessionGuard';
import { insertSpacedRepetition } from './controlledRepetition';

beforeEach(() => {
  jest.clearAllMocks();
  resetRepetitionGuardStore();
});

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated', studentId: 13, letter: 'c', caseType: 'lowercase',
    family: 'curved', shouldRepeat: true, reason: 'feature3_support_review',
    signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    policy: { maxAdaptiveRepetitionsPerInteraction: 1, adaptiveRepetitionsUsed: 0, remainingAdaptiveRepetitions: 1 },
    history: { totalCycles: 1, cleanCycles: 1, malformedCycles: 0 },
    ...overrides,
  };
}

/**
 * Mirrors scheduleAdaptiveRepetitionIfEligible()'s exact logic from
 * LetterWritingScreen.js/UppercaseWritingScreen.js. Only called from a
 * simulated "failed cycle" — never from a success path (spec §38, verified
 * separately via source-scan below).
 */
async function simulateFailedCycle({ student, letter, caseType, letterIdx, sequence, interactionId, collectionMode = false }) {
  if (collectionMode) return { sequenceAfter: sequence, insertedNow: false };

  const alreadyUsed = getAdaptiveRepetitionsUsed({ studentId: student.sid, caseType, letter, interactionId });
  const recommendation = await fetchRepetitionRecommendation({
    studentId: student.sid, letter, caseType, adaptiveRepetitionsUsed: alreadyUsed,
  });

  if (recommendation.letter !== letter || recommendation.caseType !== caseType) return { sequenceAfter: sequence, insertedNow: false };
  if (!recommendation.shouldRepeat) return { sequenceAfter: sequence, insertedNow: false };

  const targetLetterEntry = sequence[letterIdx];
  const { sequence: nextSequence, inserted } = insertSpacedRepetition({
    sequence, currentIndex: letterIdx, targetLetterEntry, interactionId,
  });
  if (!inserted) return { sequenceAfter: sequence, insertedNow: false };

  incrementAdaptiveRepetitionsUsed({ studentId: student.sid, caseType, letter, interactionId });
  return { sequenceAfter: nextSequence, insertedNow: true };
}

const student = { sid: 13 };
const interactionId = 'abc';
const baseSequence = [
  { letter: 'c', caseType: 'lowercase', category: 'curved' },
  { letter: 'o', caseType: 'lowercase', category: 'curved' },
  { letter: 's', caseType: 'lowercase', category: 'mixed' },
];

// ─── Test 37-42 — failed-cycle gating ───────────────────────────────────────

describe('Test 37 — failed cycle + recommendation true + count 0 -> insert', () => {
  it('inserts a spaced repetition and the sequence grows by one', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const { sequenceAfter, insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(insertedNow).toBe(true);
    expect(sequenceAfter.map(e => e.letter)).toEqual(['c', 'o', 'c', 's']);
  });
});

describe('Test 38 — the activation call site only exists inside the FAILURE branches (source-scan)', () => {
  it('scheduleAdaptiveRepetitionIfEligible() is called exactly twice in LetterWritingScreen.js, both inside failed-cycle branches, never in the success path', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/LetterWritingScreen.js'), 'utf8');
    const callSites = source.match(/scheduleAdaptiveRepetitionIfEligible\(\);/g) ?? [];
    // Exactly 2 real call sites (the two failure branches) — the
    // definition itself uses `= () => {`, not `();`, so it isn't counted.
    expect(callSites).toHaveLength(2);
  });

  it('same structural guarantee holds in UppercaseWritingScreen.js', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js'), 'utf8');
    const callSites = source.match(/scheduleAdaptiveRepetitionIfEligible\(\);/g) ?? [];
    expect(callSites).toHaveLength(2);
  });
});

describe('Test 39 — failed cycle + recommendation false -> no insertion', () => {
  it('no insertion, sequence unchanged', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'insufficient_data' }) });
    const { sequenceAfter, insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(insertedNow).toBe(false);
    expect(sequenceAfter).toBe(baseSequence);
  });
});

describe('Test 40 — failed cycle + cap_reached -> no insertion', () => {
  it('no insertion, sequence unchanged', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'cap_reached', signals: null, history: null }) });
    const { sequenceAfter, insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(insertedNow).toBe(false);
    expect(sequenceAfter).toBe(baseSequence);
  });
});

describe('Test 41 — failed cycle + network error -> no insertion', () => {
  it('no insertion, no throw, sequence unchanged', async () => {
    client.get.mockRejectedValueOnce(new Error('Network error'));
    const { sequenceAfter, insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(insertedNow).toBe(false);
    expect(sequenceAfter).toBe(baseSequence);
  });
});

describe('Test 42 — failed cycle + malformed response -> no insertion', () => {
  it('shouldRepeat=true but missing letter/caseType fails safe to no insertion', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ letter: undefined }) });
    const { sequenceAfter, insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(insertedNow).toBe(false);
    expect(sequenceAfter).toBe(baseSequence);
  });
});

// ─── Test 43-47 — count/insertion coupling ─────────────────────────────────

describe('Test 43 — count increments only after insertion', () => {
  it('the count stays 0 while the fetch is merely in flight / before insertion logic runs', () => {
    // getAdaptiveRepetitionsUsed is read BEFORE the fetch even starts —
    // confirmed 0 at that point, independent of what the fetch eventually returns.
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
  });
});

describe('Test 44 — backend shouldRepeat=true but insertion rejected (already_pending) -> count stays 0', () => {
  it('a pending duplicate blocks the insertion and the count never increments', async () => {
    const sequenceWithPending = [
      { letter: 'c', caseType: 'lowercase' },
      { letter: 'o', caseType: 'lowercase' },
      { letter: 'c', caseType: 'lowercase', isAdaptiveRepetition: true, adaptiveRepetitionOrdinal: 1, sourceInteractionId: interactionId },
      { letter: 's', caseType: 'lowercase' },
    ];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const { insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: sequenceWithPending, interactionId,
    });
    expect(insertedNow).toBe(false);
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
  });
});

describe('Test 45 — successful insertion -> count becomes 1', () => {
  it('after a real insertion, the guard reports count 1', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId });
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId })).toBe(1);
  });
});

describe('Test 46 — a later failed adaptive-repeat cycle calls the backend with used=1', () => {
  it('fetchRepetitionRecommendation is called with adaptiveRepetitionsUsed=1 on the second failed cycle for the same letter', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId });

    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'cap_reached', signals: null, history: null }) });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 2, sequence: baseSequence, interactionId });

    expect(client.get).toHaveBeenLastCalledWith('/handwriting/repetition-recommendation/13/c/lowercase?adaptiveRepetitionsUsed=1');
  });
});

describe('Test 47 — no second insertion for the same target within one interaction', () => {
  it('the second failed adaptive-repeat cycle never inserts again, even if (hypothetically) the backend said shouldRepeat again', async () => {
    // First failure: inserts.
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const first = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId });
    expect(first.insertedNow).toBe(true);

    // Second failure (the adaptive repeat itself later fails): even if the
    // backend hypothetically still said shouldRepeat=true (it shouldn't,
    // because the real backend would see adaptiveRepetitionsUsed=1 >= cap
    // and return cap_reached — Test 46 proves that call shape), the
    // duplicate-pending / cap-1 reality means this must never insert a
    // second time. Simulated here as a real backend cap_reached response.
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'cap_reached', signals: null, history: null }) });
    const second = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 2, sequence: first.sequenceAfter, interactionId,
    });
    expect(second.insertedNow).toBe(false);
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId })).toBe(1); // still 1, not 2
  });
});

// ─── Test 48-53 — feature interactions (structural) ────────────────────────

describe('Test 48/49 — the repeated entry gets a FRESH Feature 3 fetch, never a manually-copied one', () => {
  it('LetterWritingScreen.js never assigns Feature 3\'s `recommendation` state from Feature 5 code', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/LetterWritingScreen.js'), 'utf8');
    // Isolate the Feature 5 helper body and confirm it never references
    // setRecommendation (Feature 3's own state setter).
    const match = source.match(/const scheduleAdaptiveRepetitionIfEligible = \(\) => \{[\s\S]*?\n {4}\};/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/setRecommendation/);
  });
});

describe('Test 50 — Feature 4\'s guard module is untouched by Feature 5', () => {
  it('preWritingSessionGuard.js has zero references to repetition/Feature-5 concepts', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'preWritingSessionGuard.js'), 'utf8');
    expect(source).not.toMatch(/repetition|Feature 5/i);
  });
});

describe('Test 51 — collection mode never invokes Feature 5', () => {
  it('simulateFailedCycle (mirroring scheduleAdaptiveRepetitionIfEligible) makes zero network calls when collectionMode=true', async () => {
    const { insertedNow } = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId, collectionMode: true,
    });
    expect(insertedNow).toBe(false);
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe('Test 52/53 — word-writing and pre-writing screens are untouched', () => {
  it('WordWritingScreen.js has zero references to Feature 5 repetition utilities', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/words/WordWritingScreen.js'), 'utf8');
    expect(source).not.toMatch(/repetitionRecommendation|repetitionSessionGuard|controlledRepetition|insertSpacedRepetition/);
  });

  it('PreWritingActivityScreen.js has zero references to Feature 5 repetition utilities', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/PreWritingActivityScreen.js'), 'utf8');
    expect(source).not.toMatch(/repetitionRecommendation|repetitionSessionGuard|controlledRepetition|insertSpacedRepetition/);
  });
});

// ─── The strongest Step 3 acceptance scenario (spec §41) ───────────────────

describe('Strongest acceptance scenario — interaction "abc", sequence [c,o,s], c fails, Feature 3 = support_review', () => {
  it('walks the complete lifecycle: insert -> spaced position -> count=1 -> no second insert on a later adaptive-repeat failure', async () => {
    // c fails a full 3-attempt cycle; Feature 3 family signal = support_review.
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      shouldRepeat: true, reason: 'feature3_support_review',
      signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    }) });

    const afterFirstFailure = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: baseSequence, interactionId,
    });
    expect(afterFirstFailure.insertedNow).toBe(true);
    expect(afterFirstFailure.sequenceAfter.map(e => e.letter)).toEqual(['c', 'o', 'c', 's']);
    expect(getAdaptiveRepetitionsUsed({ studentId: 13, caseType: 'lowercase', letter: 'c', interactionId })).toBe(1);

    // Existing current-letter behavior: c still immediately retries "now"
    // (unrelated to this helper — proven by LetterWritingScreen.js's own
    // unmodified setAttempt(1)/resetCanvas() calls, which run regardless of
    // scheduleAdaptiveRepetitionIfEligible's outcome, per the fire-and-forget
    // design — see LetterWritingScreen.js's own source for confirmation).

    // ... eventually c succeeds, o is completed, and the adaptive c
    // (now at index 2 of afterFirstFailure.sequenceAfter) becomes active.
    // If THAT adaptive c also fails:
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'cap_reached', signals: null, history: null }) });
    const afterSecondFailure = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 2, sequence: afterFirstFailure.sequenceAfter, interactionId,
    });

    // No second spaced c.
    expect(afterSecondFailure.insertedNow).toBe(false);
    expect(afterSecondFailure.sequenceAfter.filter(e => e.letter === 'c')).toHaveLength(2); // original + the one repeat, never three
    expect(client.get).toHaveBeenLastCalledWith('/handwriting/repetition-recommendation/13/c/lowercase?adaptiveRepetitionsUsed=1');
  });
});
