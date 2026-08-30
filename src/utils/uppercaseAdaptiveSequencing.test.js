/**
 * Uppercase progression fix — pure-logic coverage for adaptiveSequencing.js
 * itself, which is UNCHANGED by this fix (only its callers changed — see
 * uppercaseProgressionFix.test.js for the screen-level integration). This
 * file exists because adaptiveSequencing.js previously had no direct test
 * coverage at all; the uppercase progression fix is the first thing to
 * actually call generateAdaptiveSequence(data, 'uppercase') in production,
 * so its real behavior for that case is verified explicitly here rather
 * than assumed.
 */

import { generateAdaptiveSequence, calculateMotorProfile } from './adaptiveSequencing';

function shape(shapeId, motor_score) {
  return { shapeId, features: { motor_score } };
}

// straightScore = avg(horizontal_line, vertical_line); curvedScore =
// avg(full_circle, half_circle) — see calculateMotorProfile(). zigzag/
// curve_wave only affect complexScore, irrelevant to category ordering.
const BALANCED = [
  shape('horizontal_line', 60), shape('vertical_line', 60),
  shape('full_circle', 60), shape('half_circle', 60),
  shape('zigzag', 50), shape('curve_wave', 50),
];
const STRAIGHT_FAVORING = [
  shape('horizontal_line', 90), shape('vertical_line', 90),
  shape('full_circle', 40), shape('half_circle', 40),
  shape('zigzag', 50), shape('curve_wave', 50),
];
const CURVED_FAVORING = [
  shape('horizontal_line', 40), shape('vertical_line', 40),
  shape('full_circle', 90), shape('half_circle', 90),
  shape('zigzag', 50), shape('curve_wave', 50),
];

const UPPERCASE_STRAIGHT = ['I', 'L', 'T', 'F', 'E', 'H'];
const UPPERCASE_CURVED   = ['O', 'C', 'U', 'J', 'S', 'G', 'Q'];
const UPPERCASE_MIXED    = ['D', 'P', 'B', 'V', 'Y', 'A', 'K', 'M', 'N', 'R', 'W', 'X', 'Z'];

function categoriesInOrder(letters) {
  // Collapses a sequence of letter objects into its category "runs", e.g.
  // straight,straight,straight,curved,... -> ['straight','curved','mixed'].
  const runs = [];
  for (const l of letters) {
    if (runs[runs.length - 1] !== l.category) runs.push(l.category);
  }
  return runs;
}

describe('Uppercase taxonomy is preserved exactly (spec item 3)', () => {
  it('generateAdaptiveSequence(data, "uppercase") returns exactly the 6/7/13 letter taxonomy, no substitutions', () => {
    const { letters } = generateAdaptiveSequence(BALANCED, 'uppercase');
    expect(letters.filter(l => l.category === 'straight').map(l => l.letter)).toEqual(UPPERCASE_STRAIGHT);
    expect(letters.filter(l => l.category === 'curved').map(l => l.letter)).toEqual(UPPERCASE_CURVED);
    expect(letters.filter(l => l.category === 'mixed').map(l => l.letter)).toEqual(UPPERCASE_MIXED);
    expect(letters.length).toBe(26);
    expect(new Set(letters.map(l => l.letter)).size).toBe(26); // no duplicates
  });

  it('every returned letter object is tagged caseType: "uppercase"', () => {
    const { letters } = generateAdaptiveSequence(BALANCED, 'uppercase');
    expect(letters.every(l => l.caseType === 'uppercase')).toBe(true);
  });
});

describe('Category-order personalization is preserved for uppercase (spec items 3/4)', () => {
  it('balanced profile -> uppercase straight -> curved -> mixed', () => {
    const { letters, motorProfile } = generateAdaptiveSequence(BALANCED, 'uppercase');
    expect(motorProfile.primaryStrength).toBe('balanced');
    expect(categoriesInOrder(letters)).toEqual(['straight', 'curved', 'mixed']);
  });

  it('straight-favoring profile -> uppercase straight -> curved -> mixed', () => {
    const { letters, motorProfile } = generateAdaptiveSequence(STRAIGHT_FAVORING, 'uppercase');
    expect(motorProfile.primaryStrength).toBe('straight');
    expect(categoriesInOrder(letters)).toEqual(['straight', 'curved', 'mixed']);
  });

  it('curved-favoring profile -> uppercase curved -> straight -> mixed', () => {
    const { letters, motorProfile } = generateAdaptiveSequence(CURVED_FAVORING, 'uppercase');
    expect(motorProfile.primaryStrength).toBe('curved');
    expect(categoriesInOrder(letters)).toEqual(['curved', 'straight', 'mixed']);
  });

  it('mixed is always last, regardless of profile (spec item 5)', () => {
    for (const data of [BALANCED, STRAIGHT_FAVORING, CURVED_FAVORING]) {
      const { letters } = generateAdaptiveSequence(data, 'uppercase');
      const runs = categoriesInOrder(letters);
      expect(runs[runs.length - 1]).toBe('mixed');
    }
  });
});

describe('Uppercase and lowercase share the SAME categoryOrder for the same assessment data', () => {
  it('categoryOrder is identical whether generateAdaptiveSequence is called with "lowercase" or "uppercase" for the same data', () => {
    for (const data of [BALANCED, STRAIGHT_FAVORING, CURVED_FAVORING]) {
      const lower = generateAdaptiveSequence(data, 'lowercase');
      const upper = generateAdaptiveSequence(data, 'uppercase');
      expect(upper.motorProfile.categoryOrder).toEqual(lower.motorProfile.categoryOrder);
      expect(upper.motorProfile.primaryStrength).toBe(lower.motorProfile.primaryStrength);
    }
  });

  it('calculateMotorProfile() itself is pure/deterministic — calling it via each case twice yields the same profile', () => {
    const a = calculateMotorProfile(CURVED_FAVORING);
    const b = calculateMotorProfile(CURVED_FAVORING);
    expect(a).toEqual(b);
  });
});

describe('Lowercase behavior is completely unchanged (spec item 8 regression)', () => {
  it('lowercase taxonomy/order is untouched by this fix', () => {
    const { letters } = generateAdaptiveSequence(BALANCED, 'lowercase');
    expect(letters.filter(l => l.category === 'straight').map(l => l.letter)).toEqual(['l', 'i', 't']);
    expect(letters.filter(l => l.category === 'curved').map(l => l.letter)).toEqual(['o', 'c', 'e', 'u', 'a', 's']);
    expect(letters.length).toBe(26);
    expect(letters.every(l => l.caseType === 'lowercase')).toBe(true);
  });

  it('lowercase categoryOrder still flips for a curved-favoring profile, exactly as before', () => {
    const { letters } = generateAdaptiveSequence(CURVED_FAVORING, 'lowercase');
    expect(categoriesInOrder(letters)).toEqual(['curved', 'straight', 'mixed']);
  });
});
