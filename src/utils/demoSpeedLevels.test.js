// Feature 6 Step 2 — demoSpeedLevels.js tests (pure config/helpers, no I/O,
// not wired into any writing screen yet).
//
// The source file itself lives in src/constants/demoSpeedLevels.js
// (matching every other Feature 4/5 config file's location) — this test
// file lives in src/utils/ purely because this project's Jest config scopes
// testMatch to `src/utils/**/*.test.js` only (see jest.config.js), the same
// established convention already used for testing constants/preWritingActivities.js
// from within src/utils/preWritingAdaptiveOrchestration.test.js.

import {
  DEMO_SPEED_LEVELS,
  isValidDemoSpeedLevel,
  STANDARD_TRACER_PX_PER_MS,
  SLOW_SPEED_MULTIPLIER,
  DEMO_SPEED_MULTIPLIERS,
  MIN_STROKE_DURATION_MS,
  getTracerSpeedForLevel,
  getStrokeDurationForLevel,
} from '../constants/demoSpeedLevels';

// ─── Vocabulary ─────────────────────────────────────────────────────────────

describe('Vocabulary', () => {
  it('DEMO_SPEED_LEVELS contains exactly standard and slow, no fast', () => {
    expect(Object.values(DEMO_SPEED_LEVELS).sort()).toEqual(['slow', 'standard']);
  });

  it.each(['fast', 'very_slow', 'medium'])('%p is not a value in DEMO_SPEED_LEVELS', (candidate) => {
    expect(Object.values(DEMO_SPEED_LEVELS)).not.toContain(candidate);
  });

  it.each(['fast', '0.5', '0.21', '', 'STANDARD', 'Slow', null, undefined, 0.75, true])(
    'isValidDemoSpeedLevel(%p) is false',
    (candidate) => {
      expect(() => isValidDemoSpeedLevel(candidate)).not.toThrow();
      expect(isValidDemoSpeedLevel(candidate)).toBe(false);
    }
  );

  it('isValidDemoSpeedLevel accepts exactly "standard" and "slow"', () => {
    expect(isValidDemoSpeedLevel('standard')).toBe(true);
    expect(isValidDemoSpeedLevel('slow')).toBe(true);
  });
});

// ─── Test 11/12 — multipliers ───────────────────────────────────────────────

describe('Test 11 — standard multiplier = 1.0', () => {
  it('DEMO_SPEED_MULTIPLIERS.standard === 1.0', () => {
    expect(DEMO_SPEED_MULTIPLIERS[DEMO_SPEED_LEVELS.STANDARD]).toBe(1.0);
  });
});

describe('Test 12 — slow multiplier = 0.75', () => {
  it('DEMO_SPEED_MULTIPLIERS.slow === SLOW_SPEED_MULTIPLIER === 0.75', () => {
    expect(SLOW_SPEED_MULTIPLIER).toBe(0.75);
    expect(DEMO_SPEED_MULTIPLIERS[DEMO_SPEED_LEVELS.SLOW]).toBe(0.75);
  });
});

// ─── Test 13/14 — resolved speeds ───────────────────────────────────────────

describe('Test 13 — standard speed = 0.28', () => {
  it('STANDARD_TRACER_PX_PER_MS === 0.28 (byte-identical to both screens\' own constant)', () => {
    expect(STANDARD_TRACER_PX_PER_MS).toBe(0.28);
  });

  it('getTracerSpeedForLevel("standard") === 0.28', () => {
    expect(getTracerSpeedForLevel('standard')).toBe(0.28);
  });
});

describe('Test 14 — slow speed = 0.21', () => {
  it('getTracerSpeedForLevel("slow") === 0.21 (0.28 × 0.75)', () => {
    expect(getTracerSpeedForLevel('slow')).toBeCloseTo(0.21, 10);
  });
});

// ─── Test 15/16/17 — fallback to standard ──────────────────────────────────

describe('Test 15 — invalid level falls back to standard', () => {
  it.each(['fast', 'very_slow', 'medium', '0.21', 'SLOW'])('getTracerSpeedForLevel(%p) === STANDARD speed', (bad) => {
    expect(getTracerSpeedForLevel(bad)).toBe(STANDARD_TRACER_PX_PER_MS);
  });
});

describe('Test 16 — null falls back to standard', () => {
  it('getTracerSpeedForLevel(null) === STANDARD speed', () => {
    expect(getTracerSpeedForLevel(null)).toBe(STANDARD_TRACER_PX_PER_MS);
  });
});

describe('Test 17 — undefined falls back to standard', () => {
  it('getTracerSpeedForLevel(undefined) === STANDARD speed, and omitting the arg entirely also falls back', () => {
    expect(getTracerSpeedForLevel(undefined)).toBe(STANDARD_TRACER_PX_PER_MS);
    expect(getTracerSpeedForLevel()).toBe(STANDARD_TRACER_PX_PER_MS);
  });
});

// ─── Test 18/19 — never faster than standard ───────────────────────────────

describe('Test 18 — no level produces a speed greater than STANDARD (0.28)', () => {
  it.each(['standard', 'slow', 'garbage', null, undefined])('getTracerSpeedForLevel(%p) <= 0.28', (level) => {
    expect(getTracerSpeedForLevel(level)).toBeLessThanOrEqual(0.28);
  });
});

describe('Test 19 — slow < standard', () => {
  it('getTracerSpeedForLevel("slow") is strictly less than getTracerSpeedForLevel("standard")', () => {
    expect(getTracerSpeedForLevel('slow')).toBeLessThan(getTracerSpeedForLevel('standard'));
  });
});

// ─── Test 20/21/22/50/51 — duration helper ─────────────────────────────────

describe('Test 20 — slow duration > standard duration for the same path', () => {
  it.each([100, 250, 500, 1000])('length=%ipx: slow duration is greater than standard duration', (len) => {
    const standardDur = getStrokeDurationForLevel(len, 'standard');
    const slowDur = getStrokeDurationForLevel(len, 'slow');
    expect(slowDur).toBeGreaterThanOrEqual(standardDur);
  });

  it('for a length large enough to clear the 600ms floor at both levels, slow is STRICTLY greater', () => {
    const standardDur = getStrokeDurationForLevel(500, 'standard');
    const slowDur = getStrokeDurationForLevel(500, 'slow');
    expect(slowDur).toBeGreaterThan(standardDur);
  });
});

describe('Test 21 — the 600ms floor is preserved by the duration helper, at both speed levels', () => {
  it('a very short stroke never produces a duration below 600ms', () => {
    expect(getStrokeDurationForLevel(1, 'standard')).toBeGreaterThanOrEqual(MIN_STROKE_DURATION_MS);
    expect(getStrokeDurationForLevel(1, 'slow')).toBeGreaterThanOrEqual(MIN_STROKE_DURATION_MS);
    expect(getStrokeDurationForLevel(0, 'standard')).toBe(MIN_STROKE_DURATION_MS);
  });

  it('MIN_STROKE_DURATION_MS is exactly 600 — unchanged from the existing screens\' own floor', () => {
    expect(MIN_STROKE_DURATION_MS).toBe(600);
  });

  it('short strokes near the floor: both standard and slow can land exactly on 600ms (floor dominates, no proportional slowdown there)', () => {
    // 100px: 100/0.28≈357 (floored to 600); 100/0.21≈476 (also floored to 600).
    expect(getStrokeDurationForLevel(100, 'standard')).toBe(600);
    expect(getStrokeDurationForLevel(100, 'slow')).toBe(600);
  });
});

describe('Test 22 (spec §50) — exact backward-compatibility with the existing inline formula', () => {
  it.each([100, 250, 500])('length=%ipx: getStrokeDurationForLevel(len, "standard") === Math.max(600, Math.round(len / 0.28)) exactly', (len) => {
    const oldFormula = Math.max(600, Math.round(len / 0.28));
    expect(getStrokeDurationForLevel(len, 'standard')).toBe(oldFormula);
  });

  it('omitting speedLevel entirely also reproduces the old formula exactly (same fallback-to-standard path)', () => {
    for (const len of [100, 250, 500]) {
      const oldFormula = Math.max(600, Math.round(len / 0.28));
      expect(getStrokeDurationForLevel(len)).toBe(oldFormula);
    }
  });
});

describe('Test (spec §51) — slow/standard duration ratio approaches 1.333 above the floor region', () => {
  it.each([250, 500, 1000])('length=%ipx: slowDuration / standardDuration ≈ 1/0.75 (≈1.333), subject to rounding', (len) => {
    const standardDur = getStrokeDurationForLevel(len, 'standard');
    const slowDur = getStrokeDurationForLevel(len, 'slow');
    const ratio = slowDur / standardDur;
    expect(ratio).toBeGreaterThan(1.32);
    expect(ratio).toBeLessThan(1.35);
  });

  it('near/under the floor, the ratio is NOT ≈1.333 (the floor compresses short strokes — documented, not a bug)', () => {
    const standardDur = getStrokeDurationForLevel(100, 'standard'); // 600 (floored)
    const slowDur = getStrokeDurationForLevel(100, 'slow');         // also 600 (floored)
    expect(slowDur / standardDur).toBe(1); // NOT 1.333 — floor dominates for short strokes
  });
});

// ─── Trust-model note: this file has no timing-signal logic at all ────────

describe('This module never references timing/support-review signals — pure presentation math only', () => {
  it('the source has zero references to attempt_duration_ms/support_review/fetch/client', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../constants/demoSpeedLevels.js'), 'utf8');
    expect(source).not.toMatch(/attempt_duration_ms|support_review|fetch\(|api\/client/);
  });
});

// ─── Runtime activation (Feature 6 Step 4) ─────────────────────────────────
//
// UPDATED for Step 4: this module WAS "not wired into any writing screen
// yet" as of Step 2/3 — that guarantee is now intentionally retired, since
// Step 4's entire purpose is activating it. See
// utils/demoSpeedActivation.test.js for the full activation test suite
// (source-of-truth wiring, TRACER_PX_PER_MS retirement, no duplicate 0.21
// literal, no fast branch).

describe('Now wired into both writing screens (Step 4 activation)', () => {
  it('LetterWritingScreen.js and UppercaseWritingScreen.js both import demoSpeedLevels.js as their speed source of truth', () => {
    const fs = require('fs');
    const path = require('path');
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/from '.*constants\/demoSpeedLevels'/);
    }
  });
});
