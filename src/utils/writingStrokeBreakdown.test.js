import { buildStrokeBreakdown, STROKE_FAMILIES } from './writingStrokeBreakdown';

describe('writingStrokeBreakdown', () => {
  test('every one of the 52 letter forms lands in exactly one family', () => {
    const all = STROKE_FAMILIES.flatMap((f) => f.forms);
    expect(all).toHaveLength(52);
    expect(new Set(all).size).toBe(52);
  });

  test('a brand-new child reads nothing practised, never 0%', () => {
    for (const fam of buildStrokeBreakdown([])) {
      expect(fam.practised).toBe(0);
      expect(fam.current).toBeNull();
      expect(fam.delta).toBeNull();
    }
  });

  test('classifies each form by its own case', () => {
    const fams = buildStrokeBreakdown([
      { letter: 'a', case_type: 'lowercase', first_score: 40, latest_score: 60 },
      // Stored lowercase but written uppercase: 'A' is diagonal, not curved.
      { letter: 'a', case_type: 'uppercase', first_score: 50, latest_score: 50 },
    ]);
    const by = Object.fromEntries(fams.map((f) => [f.key, f]));
    expect(by.curved.practised).toBe(1);
    expect(by.curved.current).toBe(60);
    expect(by.curved.delta).toBe(20);
    expect(by.diagonal.practised).toBe(1);
    expect(by.diagonal.delta).toBe(0);
  });

  test('averages first and latest scores across the family', () => {
    const fams = buildStrokeBreakdown([
      { letter: 'c', case_type: 'lowercase', first_score: 40, latest_score: 70 },
      { letter: 'o', case_type: 'lowercase', first_score: 60, latest_score: 90 },
    ]);
    const curved = fams.find((f) => f.key === 'curved');
    expect(curved).toMatchObject({ practised: 2, initial: 50, current: 80, delta: 30, total: 10 });
  });

  test('lists every letter of the family, with the report row figures', () => {
    const fams = buildStrokeBreakdown([
      { letter: 'c', case_type: 'lowercase', attempts: 4, sessions: 2,
        first_score: 40, latest_score: 70, best_score: 75, delta: 30 },
    ]);
    const curved = fams.find((x) => x.key === 'curved');
    expect(curved.letters).toHaveLength(10);
    expect(curved.letters.find((l) => l.form === 'c')).toMatchObject({
      practised: true, attempts: 4, sessions: 2, latest: 70, best: 75, delta: 30,
    });
    expect(curved.letters.find((l) => l.form === 'o')).toEqual({ form: 'o', practised: false });
  });
});
