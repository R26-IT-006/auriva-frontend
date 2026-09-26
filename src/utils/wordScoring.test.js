import { buildWordGuide, buildWordTracerStrokes } from '../data/wordPaths';
import { evaluateWordAttempt, WORD_PASS_SCORE } from './wordScoring';

const W = 490, H = 220;
const guide = buildWordGuide('cat');
const perfect = buildWordTracerStrokes(guide.strokeDescriptors, W, H, 30).map(item => item.points);

describe('word scoring and completion', () => {
  test('a supported full word selects a complete template and scores highly', () => {
    expect(guide.strokeDescriptors.length).toBeGreaterThan(0);
    const result = evaluateWordAttempt({ wordGuide: guide, childStrokes: perfect, canvasW: W, canvasH: H });
    expect(result.completed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(WORD_PASS_SCORE);
    expect(result.passed).toBe(true);
  });

  test('an unsupported word fails safely', () => {
    expect(evaluateWordAttempt({ wordGuide: buildWordGuide('123'), childStrokes: perfect, canvasW: W, canvasH: H }))
      .toMatchObject({ score: 0, passed: false, completed: false });
  });

  test('one accurately drawn letter cannot high-score a three-letter word', () => {
    const firstLetter = perfect.filter((_, index) => guide.strokeDescriptors[index].letterIndex === 0);
    expect(evaluateWordAttempt({ wordGuide: guide, childStrokes: firstLetter, canvasW: W, canvasH: H }))
      .toMatchObject({ score: 0, passed: false, completed: false, coveredLetters: 1, letterCount: 3 });
  });

  test('a missing middle or final letter is rejected', () => {
    for (const missing of [1, 2]) {
      const strokes = perfect.filter((_, index) => guide.strokeDescriptors[index].letterIndex !== missing);
      expect(evaluateWordAttempt({ wordGuide: guide, childStrokes: strokes, canvasW: W, canvasH: H }).passed).toBe(false);
    }
  });

  test.each([null, [], [[{ x: NaN, y: 2 }]], 'bad'])('malformed input %p is finite and bounded', childStrokes => {
    const result = evaluateWordAttempt({ wordGuide: guide, childStrokes, canvasW: W, canvasH: H });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.passed).toBe(false);
  });

  test('proportional writing is device-size invariant', () => {
    const smallGuide = buildWordGuide('cat');
    const small = buildWordTracerStrokes(smallGuide.strokeDescriptors, 245, 110, 30).map(item => item.points);
    const a = evaluateWordAttempt({ wordGuide: guide, childStrokes: perfect, canvasW: W, canvasH: H });
    const b = evaluateWordAttempt({ wordGuide: smallGuide, childStrokes: small, canvasW: 245, canvasH: 110 });
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(1);
  });
});
