// Feature 5 Step 4 — Final Orchestration + End-to-End Validation (frontend).
//
// This file does not re-test each individual gate again — every one of
// insertSpacedRepetition()'s branches, the counter's identity/increment
// contract, and fetchRepetitionRecommendation()'s failure-safety already
// have dedicated unit tests in controlledRepetition.test.js,
// repetitionSessionGuard.test.js, repetitionRecommendation.test.js, and
// repetitionActivationOrchestration.test.js (Step 3). This file instead
// proves the SINGLE, most important thing Step 4 asks for: the COMPLETE
// synthetic acceptance scenario (spec §4) walked through end-to-end as one
// narrative, plus explicit coverage for every item in spec §51 (15-30),
// using the exact same pure functions the real screens call — mirroring
// feature4FinalAcceptance.test.js's exact precedent from Feature 4 Step 6.

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
    status: 'evaluated', studentId: 'X', letter: 'c', caseType: 'lowercase',
    family: 'curved', shouldRepeat: true, reason: 'feature3_support_review',
    signals: { feature2Decision: 'hold', feature3Decision: 'support_review' },
    policy: { maxAdaptiveRepetitionsPerInteraction: 1, adaptiveRepetitionsUsed: 0, remainingAdaptiveRepetitions: 1 },
    history: { totalCycles: 1, cleanCycles: 1, malformedCycles: 0 },
    ...overrides,
  };
}

/** Mirrors scheduleAdaptiveRepetitionIfEligible()'s exact logic, including
 * the cycleTokenRef staleness/concurrency check — passed in explicitly here
 * since this file simulates multiple overlapping "handleNext" cycles. */
async function simulateFailedCycle({ student, letter, caseType, letterIdx, sequence, interactionId, collectionMode = false, cycleTokenRef, myCycleToken }) {
  if (collectionMode) return { sequenceAfter: sequence, insertedNow: false };

  const alreadyUsed = getAdaptiveRepetitionsUsed({ studentId: student.sid, caseType, letter, interactionId });
  const recommendation = await fetchRepetitionRecommendation({
    studentId: student.sid, letter, caseType, adaptiveRepetitionsUsed: alreadyUsed,
  });

  // Stale-response / concurrent-request safety — same single-token
  // mechanism the real screens use (Step 3 §22/§23, Step 4 §21/§28/§29).
  if (cycleTokenRef && myCycleToken !== cycleTokenRef.current) return { sequenceAfter: sequence, insertedNow: false, discarded: 'stale' };
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

const student = { sid: 'X' };
const interactionId = 'abc';

// ─── Test 15 (headline) — full [c,o,s] -> [c,o,c,s] scenario, spec §4 ──────

describe('Feature 5 full acceptance scenario (spec §4) — student X, interaction abc, [c,o,s], Feature 3 support_review', () => {
  const sequence = [
    { letter: 'c', caseType: 'lowercase', category: 'curved' },
    { letter: 'o', caseType: 'lowercase', category: 'curved' },
    { letter: 's', caseType: 'lowercase', category: 'mixed' },
  ];

  it('c fails a full 3-attempt cycle -> backend recommends -> insert after one intervening letter -> count=1', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });

    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });

    expect(result.insertedNow).toBe(true);
    expect(result.sequenceAfter.map(e => e.letter)).toEqual(['c', 'o', 'c', 's']);
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(1);
    expect(client.get).toHaveBeenCalledWith('/handwriting/repetition-recommendation/X/c/lowercase?adaptiveRepetitionsUsed=0');
  });

  it('when the adaptive c (now at index 2) also fails, the backend is called with used=1 and cap_reached prevents a third c', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const first = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });

    client.get.mockResolvedValueOnce({ data: evaluatedBody({ shouldRepeat: false, reason: 'cap_reached', signals: null, history: null }) });
    const second = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 2, sequence: first.sequenceAfter, interactionId,
    });

    expect(second.insertedNow).toBe(false);
    expect(second.sequenceAfter.filter(e => e.letter === 'c')).toHaveLength(2); // exactly 2, never 3
    expect(client.get).toHaveBeenLastCalledWith('/handwriting/repetition-recommendation/X/c/lowercase?adaptiveRepetitionsUsed=1');
  });
});

// ─── Test 16 — count increments after insertion ────────────────────────────

describe('Test 16 — count increments only after a real insertion', () => {
  it('count is 0 before, 1 after a successful insertion', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(1);
  });
});

// ─── Test 17 — covered above (headline scenario, second call) ─────────────

// ─── Test 18 — pending duplicate protection ────────────────────────────────

describe('Test 18 — pending duplicate protection', () => {
  it('a sequence already containing a pending adaptive c blocks a second insertion', async () => {
    const sequenceWithPending = [
      { letter: 'c', caseType: 'lowercase' },
      { letter: 'o', caseType: 'lowercase' },
      { letter: 'c', caseType: 'lowercase', isAdaptiveRepetition: true, adaptiveRepetitionOrdinal: 1, sourceInteractionId: interactionId },
      { letter: 's', caseType: 'lowercase' },
    ];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence: sequenceWithPending, interactionId });
    expect(result.insertedNow).toBe(false);
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
  });
});

// ─── Test 19 — different letter independent ────────────────────────────────

describe('Test 19 — different letter remains independently eligible', () => {
  it('c handled does not block o from a later independent insertion', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }, { letter: 's', caseType: 'lowercase' }];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });

    client.get.mockResolvedValueOnce({ data: evaluatedBody({ letter: 'o' }) });
    const result = await simulateFailedCycle({ student, letter: 'o', caseType: 'lowercase', letterIdx: 1, sequence, interactionId });
    expect(result.insertedNow).toBe(true);
  });
});

// ─── Test 20 — different interaction independent ───────────────────────────

describe('Test 20 — different interaction remains independently eligible', () => {
  it('c used=1 in interaction A does not affect c in interaction B', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId: 'interaction-A' });

    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId: 'interaction-B' })).toBe(0);
  });
});

// ─── Test 21 — case independent ─────────────────────────────────────────────

describe('Test 21 — case-specific isolation', () => {
  it('c (lowercase) used=1 does not affect C (uppercase) in the same interaction', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'uppercase', letter: 'C', interactionId })).toBe(0);
  });
});

// ─── Test 22 — last-item fallback ───────────────────────────────────────────

describe('Test 22 — last-item fallback is handled safely (documented, non-blocking)', () => {
  it('[c] -> [c,c] — a single capped revisit even with zero intervening letters', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    expect(result.sequenceAfter.map(e => e.letter)).toEqual(['c', 'c']);
    // Not "spaced" by an intervening item, but still exactly one capped
    // revisit — does not block the MVP (Step 4 spec §20).
  });
});

// ─── Test 23 — stale cycle response ─────────────────────────────────────────

describe('Test 23 — a stale failed-cycle response cannot insert', () => {
  it('a response tagged with an outdated cycle token is discarded', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    const cycleTokenRef = { current: 1 };
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });

    // Simulate: by the time the response arrives, a NEWER cycle has already
    // started (cycleTokenRef.current moved on to 2) — e.g. another failure
    // or the letter succeeding and advancing.
    const fetchPromise = simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId, cycleTokenRef, myCycleToken: 1,
    });
    cycleTokenRef.current = 2; // a newer cycle starts before the response resolves
    const result = await fetchPromise;

    expect(result.insertedNow).toBe(false);
    expect(result.discarded).toBe('stale');
  });
});

// ─── Test 24 — concurrent protection ────────────────────────────────────────

describe('Test 24 — concurrent overlapping responses cannot double-insert', () => {
  it('only the response matching the CURRENT token may act — an earlier overlapping one is discarded', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }, { letter: 's', caseType: 'lowercase' }];
    const cycleTokenRef = { current: 1 };

    // Two "failures" fire close together; token advances to 2 for the
    // second one before either resolves.
    client.get.mockResolvedValueOnce({ data: evaluatedBody() }); // response for token=1 (stale by the time it resolves)
    const stalePromise = simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId, cycleTokenRef, myCycleToken: 1,
    });
    cycleTokenRef.current = 2;

    client.get.mockResolvedValueOnce({ data: evaluatedBody() }); // response for token=2 (current)
    const currentPromise = simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId, cycleTokenRef, myCycleToken: 2,
    });

    const [staleResult, currentResult] = await Promise.all([stalePromise, currentPromise]);
    expect(staleResult.insertedNow).toBe(false);
    expect(currentResult.insertedNow).toBe(true);
    // Exactly one insertion total, never two.
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(1);
  });
});

// ─── Test 25 — failed recommendation fallback ──────────────────────────────

describe('Test 25 — recommendation fetch failure falls back safely', () => {
  it.each([
    ['network error', () => client.get.mockRejectedValueOnce(new Error('Network error'))],
    ['404', () => client.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))],
    ['500', () => client.get.mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 500 }))],
    ['malformed response', () => client.get.mockResolvedValueOnce({ data: { status: 'evaluated', shouldRepeat: 'yes' } })],
  ])('%s -> no insertion, count unchanged, no throw', async (_label, setup) => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    setup();
    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    expect(result.insertedNow).toBe(false);
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
  });
});

// ─── Test 26 — collection exclusion ─────────────────────────────────────────

describe('Test 26 — collection mode makes zero Feature 5 calls', () => {
  it('collectionMode=true never fetches, never inserts, never increments', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    const result = await simulateFailedCycle({
      student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId, collectionMode: true,
    });
    expect(result.insertedNow).toBe(false);
    expect(client.get).not.toHaveBeenCalled();
    expect(getAdaptiveRepetitionsUsed({ studentId: 'X', caseType: 'lowercase', letter: 'c', interactionId })).toBe(0);
  });
});

// ─── Test 27 — original sequence not mutated ───────────────────────────────

describe('Test 27 — the original sequence array/objects are never mutated', () => {
  it('a successful insertion returns a new array, the input is untouched', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }, { letter: 's', caseType: 'lowercase' }];
    const originalSnapshot = sequence.map(e => ({ ...e }));
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    expect(result.sequenceAfter).not.toBe(sequence);
    expect(sequence).toEqual(originalSnapshot);
  });
});

// ─── Test 28 — inserted metadata ────────────────────────────────────────────

describe('Test 28 — the inserted clone carries exactly the intended metadata', () => {
  it('isAdaptiveRepetition/adaptiveRepetitionOrdinal/sourceInteractionId, original entry unaffected', async () => {
    const sequence = [{ letter: 'c', caseType: 'lowercase' }, { letter: 'o', caseType: 'lowercase' }];
    client.get.mockResolvedValueOnce({ data: evaluatedBody() });
    const result = await simulateFailedCycle({ student, letter: 'c', caseType: 'lowercase', letterIdx: 0, sequence, interactionId });
    const clone = result.sequenceAfter[result.sequenceAfter.length - 1];
    expect(clone).toMatchObject({ letter: 'c', isAdaptiveRepetition: true, adaptiveRepetitionOrdinal: 1, sourceInteractionId: interactionId });
    expect(result.sequenceAfter[0].isAdaptiveRepetition).toBeUndefined();
  });
});

// ─── Test 29 — fresh Feature 3 behavior structurally preserved ────────────

describe('Test 29 — Feature 5 never manually carries Feature 3 support state', () => {
  it('the Feature 5 activation helper in both screens never references setRecommendation (Feature 3\'s own state setter)', () => {
    const fs = require('fs');
    const path = require('path');
    for (const file of ['../screens/teacher/handwriting/LetterWritingScreen.js', '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      const match = source.match(/const scheduleAdaptiveRepetitionIfEligible = \(\) => \{[\s\S]*?\n {4}\};/);
      expect(match).not.toBeNull();
      expect(match[0]).not.toMatch(/setRecommendation/);
    }
  });
});

// ─── Test 30 — Feature 4 independence ───────────────────────────────────────

describe('Test 30 — Feature 4 remains fully independent of Feature 5', () => {
  it('preWritingSessionGuard.js and preWritingRecommendation.js have zero Feature 5 references', () => {
    const fs = require('fs');
    const path = require('path');
    for (const file of ['./preWritingSessionGuard.js', './preWritingRecommendation.js']) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source).not.toMatch(/repetitionRecommendation|repetitionSessionGuard|controlledRepetition|insertSpacedRepetition/);
    }
  });

  it('repetitionSessionGuard.js and controlledRepetition.js never IMPORT Feature 4 modules (only discuss them in comments)', () => {
    // Scoped to actual import statements, not prose — repetitionSessionGuard.js's
    // own header comment legitimately DISCUSSES preWritingSessionGuard.js
    // (explaining the deliberate parallel/independence), so a bare substring
    // match would be a false positive — same precedent as
    // preWritingSessionGuard.test.js's own Test 17 / feature4FinalAcceptance's
    // Checkpoint 6.
    const fs = require('fs');
    const path = require('path');
    for (const file of ['./repetitionSessionGuard.js', './controlledRepetition.js']) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const importLines = source.split('\n').filter(line => /^\s*import\s/.test(line));
      expect(importLines.some(l => /preWritingSessionGuard|preWritingRecommendation/.test(l))).toBe(false);
    }
  });
});
