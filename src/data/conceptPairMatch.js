// Photo ↔ animated-picture pair match — the game data behind
// ConceptPairMatchScreen.
//
// Every concept ships a photograph (`real`) and a drawn version. Fruits and
// classroom carry a proper `animated` frame; the rest carry an illustrated
// `icon`. The drawn side prefers `animated` and falls back to `icon`, so the
// activity works in every category rather than only the two with animated art.
import { getConceptItemsForCategory } from './conceptData';

// Four pairs is eight cards — enough to be a game, few enough that each card
// stays large and the board never scrolls.
export const MAX_PAIRS = 4;
const MIN_PAIRS = 3;

// One colour per pair. A matched photo and its drawing both take their pair's
// colour, so the board becomes a readable record of what has been paired — with
// ten near-identical green ticks the child cannot see which went with which.
const PAIR_COLORS = ['#4CAF50', '#1E88E5', '#8E24AA', '#FB8C00', '#00897B'];

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The drawn counterpart of a concept's photo, or null if it has neither. */
export function drawnImageFor(item) {
  return item?.animated ?? item?.icon ?? null;
}

/** Concepts in a category that can appear in this game at all. */
export function getPairableItems(categoryKey) {
  return getConceptItemsForCategory(categoryKey)
    .filter((item) => item.real && drawnImageFor(item));
}

/**
 * One round: the same concepts down both columns, each column shuffled
 * separately so the answer is never "the one across from it".
 *
 * `preferKeys` — concepts the child has already mastered. They are drawn from
 * first so the game reinforces known material, then topped up from the rest of
 * the category rather than refusing to start.
 *
 * Returns null when the category cannot field MIN_PAIRS, which is how a
 * category opts out without this file listing which ones qualify.
 */
export function buildPairMatchGame(categoryKey, preferKeys = []) {
  const pairable = getPairableItems(categoryKey);
  if (pairable.length < MIN_PAIRS) return null;

  const preferred = new Set(preferKeys);
  const known     = shuffle(pairable.filter((i) => preferred.has(i.key)));
  const rest      = shuffle(pairable.filter((i) => !preferred.has(i.key)));

  const chosen = [...known, ...rest]
    .slice(0, MAX_PAIRS)
    .map((item, i) => ({ ...item, pairColor: PAIR_COLORS[i % PAIR_COLORS.length] }));

  return {
    photos:   shuffle(chosen).map((item) => ({ ...item, image: item.real })),
    drawings: shuffle(chosen).map((item) => ({ ...item, image: drawnImageFor(item) })),
    total:    chosen.length,
  };
}
