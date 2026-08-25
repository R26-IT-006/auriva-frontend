// Memory (concentration) — the game data behind ConceptMemoryScreen.
//
// A pair is a concept's photograph and its drawing, not two copies of the same
// image. Turning it over is then a recall task *and* the same generalisation
// the pair-match activity trains: this photo and this drawing are one thing.
//
// Shares its card sourcing with conceptPairMatch so a category qualifies for
// both activities on the same rule.
import { getPairableItems, drawnImageFor } from './conceptPairMatch';

// Four pairs is eight cards — a 4×2 grid of squares that fits one screen and
// stays inside what a young child can hold in mind.
export const MEMORY_PAIRS = 4;
const MIN_PAIRS = 3;

// One colour per pair, opening with the pair-match board's five so a child
// meets the same visual language in both activities.
const PAIR_COLORS = [
  '#4CAF50', '#1E88E5', '#8E24AA', '#FB8C00',
  '#00897B', '#D81B60', '#5E35B1', '#F4511E',
];

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One round: every chosen concept contributes two cards — its photo and its
 * drawing — and the whole deck is shuffled into the grid.
 *
 * `conceptKeys` — chosen by the server from the child's tier 1 and tier 2
 * performance, the same selection the mixed practice activity uses. Empty when
 * that call failed, in which case this falls back to a local shuffle: a network
 * blip should degrade to a playable game, not an error screen.
 *
 * Returns null when the category cannot field MIN_PAIRS, which is how a
 * category opts out without this file naming which ones qualify.
 */
export function buildMemoryGame(categoryKey, conceptKeys = []) {
  const pairable = getPairableItems(categoryKey);
  if (pairable.length < MIN_PAIRS) return null;

  // The server's order *is* the selection order, so it is kept rather than
  // re-sorted. Unknown keys are dropped: a concept without both a photo and a
  // drawing cannot be a card here, whatever the server picked.
  const byKey    = new Map(pairable.map((i) => [i.key, i]));
  const selected = conceptKeys.map((k) => byKey.get(k)).filter(Boolean);

  const chosen = (selected.length >= MIN_PAIRS ? selected : shuffle(pairable))
    .slice(0, MEMORY_PAIRS)
    .map((item, i) => ({ ...item, pairColor: PAIR_COLORS[i % PAIR_COLORS.length] }));

  // id is per-card, key is per-concept: two cards share a key, which is exactly
  // what "these two match" means, so they must not share an id.
  const cards = chosen.flatMap((item) => [
    { id: `${item.key}:photo`,   key: item.key, face: 'photo',   image: item.real,           label: item.label, labelSi: item.labelSi, pairColor: item.pairColor },
    { id: `${item.key}:drawing`, key: item.key, face: 'drawing', image: drawnImageFor(item), label: item.label, labelSi: item.labelSi, pairColor: item.pairColor },
  ]);

  return { cards: shuffle(cards), pairs: chosen.length };
}
