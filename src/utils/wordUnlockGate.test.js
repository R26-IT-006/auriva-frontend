import { isWordsUnlocked, REQUIRED_LOWERCASE_COUNT, REQUIRED_UPPERCASE_COUNT } from './wordUnlockGate';

describe('isWordsUnlocked — pre-device P0 fix, Blocker 1', () => {
  it('requires exactly 26/26 for both cases', () => {
    expect(REQUIRED_LOWERCASE_COUNT).toBe(26);
    expect(REQUIRED_UPPERCASE_COUNT).toBe(26);
  });

  it('Scenario 1 — 0 lowercase / 0 uppercase -> locked', () => {
    expect(isWordsUnlocked(0, 0)).toBe(false);
  });

  it('Scenario 2 — partial lowercase (e.g. 10/26), 0 uppercase -> locked', () => {
    expect(isWordsUnlocked(10, 0)).toBe(false);
  });

  it('Scenario 3 — 26 lowercase / 0 uppercase -> locked', () => {
    expect(isWordsUnlocked(26, 0)).toBe(false);
  });

  it('Scenario 4 — 26 lowercase / partial uppercase (e.g. 10/26) -> locked', () => {
    expect(isWordsUnlocked(26, 10)).toBe(false);
  });

  it('Scenario 5 — 26 lowercase / 26 uppercase -> unlocked', () => {
    expect(isWordsUnlocked(26, 26)).toBe(true);
  });

  it('never unlocks from uppercase alone, even if lowercase is somehow behind (defensive, should not occur in practice since uppercase itself requires 26 lowercase first)', () => {
    expect(isWordsUnlocked(10, 26)).toBe(false);
  });

  it('a count above 26 (should never happen — LetterProgress is unique-indexed per letter/case) still unlocks, never treated as invalid', () => {
    expect(isWordsUnlocked(26, 26)).toBe(true);
  });

  it('fails closed (locked) for non-numeric/missing input rather than throwing or defaulting to unlocked', () => {
    expect(isWordsUnlocked(undefined, undefined)).toBe(false);
    expect(isWordsUnlocked(null, null)).toBe(false);
    expect(isWordsUnlocked('26', '26')).toBe(false); // strings are never coerced
  });
});
