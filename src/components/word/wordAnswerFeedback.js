'use strict';

export const ANSWER_FEEDBACK_COLORS = Object.freeze({
  wrongSurface: '#FDECEC',
  wrongBorder: '#D64545',
  wrongText: '#8B1E1E',
  correctSurface: '#E8F5E9',
  correctBorder: '#388E3C',
  correctText: '#1B5E20',
});

/** Reorders an existing set without adding, removing, or replacing an item. */
export function shuffleSameOptions(items, random = Math.random) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  if (next.length > 1 && next.every((item, index) => item === items[index])) {
    next.push(next.shift());
  }
  return next;
}

/** Keeps placed/used tile positions fixed and only shuffles available candidates. */
export function shuffleAvailableTiles(order, used, random = Math.random) {
  const positions = order
    .map((tileIndex, position) => (!used[tileIndex] ? position : -1))
    .filter(position => position >= 0);
  const available = positions.map(position => order[position]);
  const shuffled = shuffleSameOptions(available, random);
  const next = [...order];
  positions.forEach((position, index) => { next[position] = shuffled[index]; });
  return next;
}
