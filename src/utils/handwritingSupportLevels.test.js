// Feature 3 Step 2 — pure-function tests for the formal support-level model.
//
// Lives under src/utils/ (not src/constants/, where the module itself lives)
// because jest.config.js's testMatch is deliberately scoped to
// `src/utils/**/*.test.js` only (see jest.config.js's own comment — a
// minimal, non-jest-expo Jest setup for pure-JS unit tests). Rather than
// widen that glob or add a jest-expo/RN component-testing preset just for
// this one file, the test imports the module from its actual home in
// ../constants/ — no test-infrastructure change, no new risk to the
// existing 4-suite/62-test baseline.
import {
  SUPPORT_LEVELS,
  getSupportLevelForAttempt,
  getSupportPresentation,
  getAdaptiveSupportSequence,
} from '../constants/handwritingSupportLevels';

// ─── Attempt → support-level identity ──────────────────────────────────────

describe('Support Test 1 — normal attempt 1 → high', () => {
  it('maps attempt 1 to high in normal mode', () => {
    expect(getSupportLevelForAttempt({ attempt: 1, collectionMode: false })).toBe(SUPPORT_LEVELS.HIGH);
  });
});

describe('Support Test 2 — normal attempt 2 → medium', () => {
  it('maps attempt 2 to medium in normal mode', () => {
    expect(getSupportLevelForAttempt({ attempt: 2, collectionMode: false })).toBe(SUPPORT_LEVELS.MEDIUM);
  });
});

describe('Support Test 3 — normal attempt 3 → low', () => {
  it('maps attempt 3 to low in normal mode', () => {
    expect(getSupportLevelForAttempt({ attempt: 3, collectionMode: false })).toBe(SUPPORT_LEVELS.LOW);
  });
});

describe('Support Test — attempt identity is unaffected by collectionMode', () => {
  it('maps attempt 1/2/3 identically regardless of collectionMode', () => {
    expect(getSupportLevelForAttempt({ attempt: 1, collectionMode: true })).toBe(SUPPORT_LEVELS.HIGH);
    expect(getSupportLevelForAttempt({ attempt: 2, collectionMode: true })).toBe(SUPPORT_LEVELS.MEDIUM);
    expect(getSupportLevelForAttempt({ attempt: 3, collectionMode: true })).toBe(SUPPORT_LEVELS.LOW);
  });
});

// ─── High presentation ──────────────────────────────────────────────────────

describe('Support Test 4 — high presentation retains existing opacity', () => {
  it('resolves guideOpacity = 0.14 for high', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: false });
    expect(presentation.guideOpacity).toBe(0.14);
  });
});

describe('Support Test 5 — high shows animated tracer', () => {
  it('resolves showAnimatedTracer = true for high', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: false });
    expect(presentation.showAnimatedTracer).toBe(true);
  });
});

describe('Support Test 6 — high does not show medium start markers', () => {
  it('resolves showStartMarker = false and showDirectionHint = false for high', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: false });
    expect(presentation.showStartMarker).toBe(false);
    expect(presentation.showDirectionHint).toBe(false);
  });
});

// ─── Medium presentation ────────────────────────────────────────────────────

describe('Support Test 7 — medium retains current opacity', () => {
  it('resolves guideOpacity = 0.26 for medium', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });
    expect(presentation.guideOpacity).toBe(0.26);
  });
});

describe('Support Test 8 — medium shows start marker', () => {
  it('resolves showStartMarker = true for medium', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });
    expect(presentation.showStartMarker).toBe(true);
  });
});

describe('Support Test 9 — medium shows direction hints', () => {
  it('resolves showDirectionHint = true for medium', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });
    expect(presentation.showDirectionHint).toBe(true);
  });
});

describe('Support Test 10 — medium does not show tracer', () => {
  it('resolves showAnimatedTracer = false for medium', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });
    expect(presentation.showAnimatedTracer).toBe(false);
  });
});

// ─── Low presentation (normal mode) ────────────────────────────────────────

describe('Support Test 11 — low normal mode opacity = 0', () => {
  it('resolves guideOpacity = 0 for low in normal mode', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: false });
    expect(presentation.guideOpacity).toBe(0);
  });
});

describe('Support Test 12 — low normal mode no markers/tracer', () => {
  it('resolves every guidance flag to false for low in normal mode', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: false });
    expect(presentation.showAnimatedTracer).toBe(false);
    expect(presentation.showStartMarker).toBe(false);
    expect(presentation.showDirectionHint).toBe(false);
    expect(presentation.collectionProtocolOverride).toBe(false);
  });
});

// ─── Collection-mode behavior (must NOT be normalized to plain medium/low) ─

describe('Collection Test 1 — attempt 1 remains current high presentation', () => {
  it('collection mode attempt 1 is identical to normal mode attempt 1', () => {
    const normal     = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: false });
    const collection = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 1, collectionMode: true });
    expect(collection).toEqual(normal);
  });
});

describe('Collection Test 2 — attempt 2 remains current medium presentation', () => {
  it('collection mode attempt 2 is identical to normal mode attempt 2', () => {
    const normal     = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });
    const collection = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: true });
    expect(collection).toEqual(normal);
  });
});

describe('Collection Test 3 — attempt 3 preserves guideOpacity = 0.26', () => {
  it('collection mode attempt 3 (low) keeps the faded ghost guide visible', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: true });
    expect(presentation.guideOpacity).toBe(0.26);
  });
});

describe('Collection Test 4 — collection attempt 3: animated tracer = false', () => {
  it('does not show the animated tracer at the low tier in collection mode', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: true });
    expect(presentation.showAnimatedTracer).toBe(false);
  });
});

describe('Collection Test 5 — collection attempt 3: start marker = false', () => {
  it('does not show the medium start marker at the low tier in collection mode', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: true });
    expect(presentation.showStartMarker).toBe(false);
  });
});

describe('Collection Test 6 — collection attempt 3: direction hint = false', () => {
  it('does not show direction-hint arrows at the low tier in collection mode', () => {
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: true });
    expect(presentation.showDirectionHint).toBe(false);
  });
});

describe('Collection Test — collection attempt 3 is flagged as a protocol override, not normalized to medium', () => {
  it('exposes collectionProtocolOverride = true and is NOT equal to the plain medium presentation', () => {
    const collectionLow = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.LOW, attempt: 3, collectionMode: true });
    const plainMedium    = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.MEDIUM, attempt: 2, collectionMode: false });

    expect(collectionLow.collectionProtocolOverride).toBe(true);
    // Same guideOpacity as medium (0.26) is expected and intentional — but
    // the two presentations must remain otherwise distinguishable: collection
    // attempt 3 has no start marker / direction hint, medium has both.
    expect(collectionLow.guideOpacity).toBe(plainMedium.guideOpacity);
    expect(collectionLow.showStartMarker).not.toBe(plainMedium.showStartMarker);
    expect(collectionLow.showDirectionHint).not.toBe(plainMedium.showDirectionHint);
    expect(collectionLow).not.toEqual(plainMedium);
  });
});

// ─── getSupportPresentation deriving supportLevel from attempt directly ───

describe('Support Test — getSupportPresentation can derive supportLevel from attempt alone', () => {
  it('resolves the correct presentation when supportLevel is omitted', () => {
    expect(getSupportPresentation({ attempt: 1, collectionMode: false }).supportLevel).toBe(SUPPORT_LEVELS.HIGH);
    expect(getSupportPresentation({ attempt: 2, collectionMode: false }).supportLevel).toBe(SUPPORT_LEVELS.MEDIUM);
    expect(getSupportPresentation({ attempt: 3, collectionMode: false }).supportLevel).toBe(SUPPORT_LEVELS.LOW);
    expect(getSupportPresentation({ attempt: 3, collectionMode: true }).guideOpacity).toBe(0.26);
  });
});

// ─── Invalid-input contract (§18) ──────────────────────────────────────────

describe('Support Test — invalid attempt values return null explicitly', () => {
  it('getSupportLevelForAttempt returns null for out-of-range/malformed attempt', () => {
    expect(getSupportLevelForAttempt({ attempt: 0 })).toBeNull();
    expect(getSupportLevelForAttempt({ attempt: 4 })).toBeNull();
    expect(getSupportLevelForAttempt({ attempt: null })).toBeNull();
    expect(getSupportLevelForAttempt({ attempt: undefined })).toBeNull();
    expect(getSupportLevelForAttempt({ attempt: '1' })).toBeNull();
    expect(getSupportLevelForAttempt({})).toBeNull();
    expect(getSupportLevelForAttempt()).toBeNull();
  });

  it('getSupportPresentation returns null when no valid support level can be resolved', () => {
    expect(getSupportPresentation({ attempt: 0 })).toBeNull();
    expect(getSupportPresentation({ attempt: 4 })).toBeNull();
    expect(getSupportPresentation({ supportLevel: 'extreme', attempt: null })).toBeNull();
    expect(getSupportPresentation({})).toBeNull();
    expect(getSupportPresentation()).toBeNull();
  });

  it('getSupportPresentation prefers an explicit valid supportLevel over a mismatched attempt', () => {
    // supportLevel is the primary input — an explicitly valid value is
    // trusted even if attempt disagrees, matching the documented contract.
    const presentation = getSupportPresentation({ supportLevel: SUPPORT_LEVELS.HIGH, attempt: 3, collectionMode: false });
    expect(presentation.supportLevel).toBe(SUPPORT_LEVELS.HIGH);
    expect(presentation.guideOpacity).toBe(0.14);
  });
});

// ─── Vocabulary shape ───────────────────────────────────────────────────────

describe('Support Test — SUPPORT_LEVELS vocabulary is stable and descriptive', () => {
  it('exposes exactly the three descriptive values, not numeric ones', () => {
    expect(SUPPORT_LEVELS).toEqual({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });
  });

  it('is frozen (cannot be mutated at runtime)', () => {
    expect(Object.isFrozen(SUPPORT_LEVELS)).toBe(true);
  });
});

// ─── Feature 3 Step 6 — getAdaptiveSupportSequence ─────────────────────────

describe('Sequence Test 15 — high → high/medium/low', () => {
  it('matches the legacy sequence exactly (zero visible change for a HIGH recommendation)', () => {
    expect(getAdaptiveSupportSequence(SUPPORT_LEVELS.HIGH)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Sequence Test 16 — medium → medium/low/low', () => {
  it('is monotonic — support never increases across the three attempts', () => {
    expect(getAdaptiveSupportSequence(SUPPORT_LEVELS.MEDIUM)).toEqual(['medium', 'low', 'low']);
  });
});

describe('Sequence Test 17 — low → low/low/low', () => {
  it('stays at low for all three attempts', () => {
    expect(getAdaptiveSupportSequence(SUPPORT_LEVELS.LOW)).toEqual(['low', 'low', 'low']);
  });
});

describe('Sequence Test 18 — null → legacy high/medium/low', () => {
  it('falls back to the legacy default when no recommendation is available', () => {
    expect(getAdaptiveSupportSequence(null)).toEqual(['high', 'medium', 'low']);
  });

  it('falls back for undefined too', () => {
    expect(getAdaptiveSupportSequence(undefined)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Sequence Test 19 — invalid value → legacy sequence', () => {
  it.each(['extreme', 'HIGH', 1, true, {}, []])('falls back to the legacy default for invalid input %j', (bad) => {
    expect(getAdaptiveSupportSequence(bad)).toEqual(['high', 'medium', 'low']);
  });
});

describe('Sequence Test 20 — attempt index picks the correct support', () => {
  it('sequence[attempt - 1] resolves the right level for attempts 1/2/3, for every starting recommendation', () => {
    const cases = [
      { start: 'high',   expected: ['high', 'medium', 'low'] },
      { start: 'medium', expected: ['medium', 'low', 'low'] },
      { start: 'low',    expected: ['low', 'low', 'low'] },
      { start: null,     expected: ['high', 'medium', 'low'] },
    ];
    for (const { start, expected } of cases) {
      const sequence = getAdaptiveSupportSequence(start);
      for (const attempt of [1, 2, 3]) {
        expect(sequence[attempt - 1]).toBe(expected[attempt - 1]);
      }
    }
  });
});

describe('Sequence Test 21 — every sequence has exactly 3 entries and is frozen', () => {
  it.each(['high', 'medium', 'low', null])('returns a frozen 3-element array for %j', (start) => {
    const sequence = getAdaptiveSupportSequence(start);
    expect(sequence).toHaveLength(3);
    expect(Object.isFrozen(sequence)).toBe(true);
  });
});
