import { computeWordMastery } from './reportEngine';

test('word reports accept and count the production A-E exercise schema', () => {
  const status = { A: 'correct', B: 'correct', C: 'good', D: 'correct', E: 'correct' };
  const report = computeWordMastery({ c: [{ word: 'cat', status }] });
  expect(report.overall).toEqual({ correct: 4, total: 5, pct: 80 });
  expect(report.byLetter[0].exBreakdown.E).toEqual({ correct: 1, good: 0, total: 1 });
  expect(report.byLetter[0].masteryStatus).toBe('Mastered');
});
