import { featuresToScore } from './adaptiveSequencing';
import { computeWordDTW } from '../data/wordPaths';

export const WORD_PASS_SCORE = 50;

function finitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function smoothness(strokes) {
  const points = strokes.flat();
  if (points.length < 3) return 0;
  const changes = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const v1x = b.x - a.x, v1y = b.y - a.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 > 0 && l2 > 0) {
      const cosine = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
      changes.push(Math.acos(cosine));
    }
  }
  return changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;
}

function letterRegions(strokeDescriptors, canvasW, canvasH) {
  const aspect = canvasW / canvasH;
  const byLetter = new Map();
  strokeDescriptors.forEach(descriptor => {
    const xs = descriptor.points.map(point => (0.5 + (point.fx - 0.5) / aspect) * canvasW);
    const current = byLetter.get(descriptor.letterIndex) ?? { minX: Infinity, maxX: -Infinity };
    current.minX = Math.min(current.minX, ...xs);
    current.maxX = Math.max(current.maxX, ...xs);
    byLetter.set(descriptor.letterIndex, current);
  });
  const regions = [...byLetter.values()];
  return regions.map((region, index) => ({
    minX: index === 0 ? -Infinity : (regions[index - 1].maxX + region.minX) / 2,
    maxX: index === regions.length - 1 ? Infinity : (region.maxX + regions[index + 1].minX) / 2,
  }));
}

/**
 * Scores a complete word trajectory and separately proves that every expected
 * letter region contains meaningful ink. A missing letter therefore scores
 * zero regardless of how accurately the remaining substring was traced.
 */
export function evaluateWordAttempt({ wordGuide, childStrokes, canvasW, canvasH }) {
  const cleanStrokes = Array.isArray(childStrokes)
    ? childStrokes.map(stroke => Array.isArray(stroke) ? stroke.filter(finitePoint) : []).filter(stroke => stroke.length >= 2)
    : [];
  const letterCount = new Set((wordGuide?.strokeDescriptors ?? []).map(item => item.letterIndex)).size;
  if (!wordGuide?.rawPath?.length || letterCount === 0 || cleanStrokes.length === 0 ||
      !Number.isFinite(canvasW) || !Number.isFinite(canvasH) || canvasW <= 0 || canvasH <= 0) {
    return { score: 0, passed: false, completed: false, coveredLetters: 0, letterCount, dtwDistance: null };
  }

  const regions = letterRegions(wordGuide.strokeDescriptors, canvasW, canvasH);
  const coveredLetters = regions.filter(region => {
    const points = cleanStrokes.flat().filter(point => point.x >= region.minX && point.x < region.maxX);
    if (points.length < 2) return false;
    const width = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
    const height = Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y));
    return Math.hypot(width, height) >= Math.max(6, Math.min(canvasW, canvasH) * 0.025);
  }).length;
  const completed = coveredLetters === letterCount;
  const dtwDistance = computeWordDTW(wordGuide.rawPath, cleanStrokes, canvasW, canvasH);
  const rawScore = featuresToScore({ smoothness: smoothness(cleanStrokes), dtw_distance: dtwDistance });
  const score = Number.isFinite(rawScore) ? Math.round(Math.max(0, Math.min(100, rawScore))) : 0;
  return {
    score: completed ? score : 0,
    passed: completed && score >= WORD_PASS_SCORE,
    completed,
    coveredLetters,
    letterCount,
    dtwDistance: Number.isFinite(dtwDistance) ? dtwDistance : null,
  };
}
