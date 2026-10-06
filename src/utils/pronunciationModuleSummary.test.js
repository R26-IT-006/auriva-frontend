import { buildPronunciationSummary, RECENT_LIMIT } from './pronunciationModuleSummary';

const categories = [
  { id: 'animals', title: 'Animals' },
  { id: 'fruits', title: 'Fruits' },
];

// Newest first, as the endpoint returns them.
const rows = [
  { mode: 'word', category_id: 'animals', word_id: 'cat', word_label: 'cat', overall_score: 80, created_at: '2026-10-05T10:00:00Z' },
  { mode: 'word', category_id: 'animals', word_id: 'dog', word_label: 'dog', overall_score: 40, needs_teacher_review: true, teacher_reviewed_score: null },
  { mode: 'word', category_id: 'animals', word_id: 'cat', word_label: 'cat', overall_score: 30 },
  { mode: 'alphabet', category_id: null, word_id: 'b', word_label: 'B', overall_score: 50, needs_teacher_review: true, teacher_reviewed_score: 70 },
];

describe('pronunciationModuleSummary', () => {
  test('a child with no attempts reads empty, never 0%', () => {
    const s = buildPronunciationSummary([]);
    expect(s).toMatchObject({ attempts: 0, averageScore: null, latestScore: null, wordsPractised: 0, flagged: 0 });
    expect(s.groups).toEqual([]);
  });

  test('headline figures come from overall_score, newest first', () => {
    const s = buildPronunciationSummary(rows, { categories, totals: { animals: 10, alphabet: 26 } });
    expect(s.attempts).toBe(4);
    expect(s.averageScore).toBe(50);
    expect(s.latestScore).toBe(80);
    expect(s.latestAt).toBe('2026-10-05T10:00:00Z');
    expect(s.wordsPractised).toBe(2);
    expect(s.capped).toBe(false);
  });

  test('only unreviewed flagged attempts count as waiting for review', () => {
    expect(buildPronunciationSummary(rows).flagged).toBe(1);
  });

  test('a word is worth another look only if its LATEST attempt is low', () => {
    const s = buildPronunciationSummary(rows, { categories });
    expect(s.lookAgain.map((w) => w.label)).toEqual(['dog', 'B']); // cat's latest is 80
  });

  test('groups follow catalogue order, alphabet last, with totals', () => {
    const s = buildPronunciationSummary(rows, { categories, totals: { animals: 10, alphabet: 26 } });
    expect(s.groups.map((g) => g.key)).toEqual(['animals', 'alphabet']);
    expect(s.groups[0]).toMatchObject({ label: 'Animals', attempts: 3, practised: 2, total: 10, average: 50 });
    expect(s.groups[1]).toMatchObject({ label: 'Alphabet', practised: 1, total: 26 });
  });

  test('says when it is reading a capped page', () => {
    const many = Array.from({ length: RECENT_LIMIT }, () => rows[0]);
    expect(buildPronunciationSummary(many).capped).toBe(true);
  });
});
