import { computeExerciseECanvasSize } from './wordExerciseECanvas';
import { buildWordGuide, buildWordLetterBoxes, wordGuideToSvgPath } from '../data/wordPaths';

describe('computeExerciseECanvasSize', () => {
  test('a typical phone width produces a finite, positive-size canvas', () => {
    const { width, height } = computeExerciseECanvasSize(390); // iPhone-class width
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('a very small screen clamps to the minimum usable width rather than shrinking indefinitely', () => {
    const { width } = computeExerciseECanvasSize(250);
    expect(width).toBe(300);
  });

  test('a very large (tablet) screen clamps to the maximum rather than growing indefinitely', () => {
    const { width } = computeExerciseECanvasSize(2000);
    expect(width).toBe(560);
  });

  test('height preserves the original 490:220 aspect ratio at every clamped width', () => {
    [250, 390, 500, 700, 2000].forEach(screenWidth => {
      const { width, height } = computeExerciseECanvasSize(screenWidth);
      expect(height / width).toBeCloseTo(220 / 490, 2);
    });
  });

  test('width grows monotonically with screen width inside the clamped range', () => {
    const small = computeExerciseECanvasSize(400);
    const large = computeExerciseECanvasSize(600);
    expect(large.width).toBeGreaterThan(small.width);
  });

  test('non-finite or missing screen width falls back to the minimum rather than throwing/NaN', () => {
    [NaN, undefined, null, 'not-a-number'].forEach(input => {
      const { width, height } = computeExerciseECanvasSize(input);
      expect(Number.isFinite(width)).toBe(true);
      expect(Number.isFinite(height)).toBe(true);
      expect(width).toBeGreaterThan(0);
    });
  });
});

describe('Exercise E canvas — same transform as guide/boxes at the responsive size', () => {
  test('guide boxes fully contain their reference-path points at a representative responsive canvas', () => {
    const { width: W, height: H } = computeExerciseECanvasSize(390);
    const word = 'cat';
    const guide = buildWordGuide(word);
    const boxes = buildWordLetterBoxes(word, W, H);
    const aspect = W / H;
    const aspectX = fx => (0.5 + (fx - 0.5) / aspect) * W;
    guide.strokeDescriptors.forEach(({ points, letterIndex }) => {
      const box = boxes[letterIndex];
      points.forEach(p => {
        const x = aspectX(p.fx);
        const y = p.fy * H;
        expect(x).toBeGreaterThanOrEqual(box.x - 0.5);
        expect(x).toBeLessThanOrEqual(box.x + box.width + 0.5);
        expect(y).toBeGreaterThanOrEqual(box.y - 0.5);
        expect(y).toBeLessThanOrEqual(box.y + box.height + 0.5);
      });
    });
    // Also confirm the reference path itself renders at this exact size —
    // guide path, guide boxes, and (by construction, since PanResponder's
    // locationX/locationY are already canvas-relative) touch input all
    // share this one W×H, never a separate coordinate system.
    expect(wordGuideToSvgPath(guide.strokeDescriptors, W, H).length).toBeGreaterThan(0);
  });
});
