// Photo ↔ animated-picture pair match — the game data behind
// ConceptPairMatchScreen.
//
// Every concept ships a photograph (`real`) and a drawn version. Fruits and
// classroom carry a proper `animated` frame; the rest carry an illustrated
// `icon`. The drawn side prefers `animated` and falls back to `icon`, so the
// activity works in every category rather than only the two with animated art.
import { getConceptItemsForCategory, categoryHasPairMatch } from './conceptData';

// Four pairs is eight cards — enough to be a game, few enough that each card
// stays large and the board never scrolls.
export const MAX_PAIRS = 4;

// The floor for both card games, and the number the activity picker unlocks on.
// Exported because three places have to agree on it — this builder, the memory
// builder, and ConceptItemsScreen's picker — and when they disagreed the picker
// offered games that could not be dealt from what the child had been taught.
// Mirrored by MIN_GAME_CONCEPTS in the backend's activityService.js, which
// carries the reasoning for why the floor is three and not two.
export const MIN_PAIRS = 3;

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
 * `conceptKeys` — chosen by the server from the child's tier 1 and tier 2
 * performance, the same selection the mixed practice activity uses. Empty when
 * that call failed, in which case this falls back to a local shuffle: a network
 * blip should degrade to a playable game, not an error screen.
 *
 * Returns null when the category cannot field MIN_PAIRS, which is how a
 * category opts out without this file listing which ones qualify.
 */
export function buildPairMatchGame(categoryKey, conceptKeys = []) {
  // Categories where a photo and a drawing are the same picture opt out entirely,
  // however many pairs they could technically field. The activity picker already
  // hides the row for them; this is the backstop for any other way in.
  if (!categoryHasPairMatch(categoryKey)) return null;

  const pairable = getPairableItems(categoryKey);
  if (pairable.length < MIN_PAIRS) return null;

  // The server's order *is* the selection order, so it is kept rather than
  // re-sorted. Unknown keys are dropped: a concept without both a photo and a
  // drawing cannot be a card here, whatever the server picked.
  const byKey    = new Map(pairable.map((i) => [i.key, i]));
  const selected = conceptKeys.map((k) => byKey.get(k)).filter(Boolean);

  // Too few usable keys means the caller could not tell us what this child has
  // been taught — the activity row was never opened, or the request failed. Return
  // null so the screen can say so, rather than dealing a game.
  //
  // This used to fall back to `shuffle(pairable)`: the WHOLE category, chosen at
  // random. The server's selection was discarded wholesale and the child was dealt
  // concepts they had never been shown, inside an activity whose entire purpose is
  // consolidating what they already know. Worse, the result was still recorded —
  // ACTIVITY_FORMAT_CONFUSION edges and a score, written about concepts that were
  // never taught, indistinguishable downstream from real evidence.
  //
  // The picker now gates this activity on MIN_PAIRS mastered concepts, so a short
  // list here is an error condition and not the ordinary small-pool case.
  if (selected.length < MIN_PAIRS) return null;

  const chosen = selected
    .slice(0, MAX_PAIRS)
    .map((item, i) => ({ ...item, pairColor: PAIR_COLORS[i % PAIR_COLORS.length] }));

  return {
    photos:   shuffle(chosen).map((item) => ({ ...item, image: item.real })),
    drawings: shuffle(chosen).map((item) => ({ ...item, image: drawnImageFor(item) })),
    total:    chosen.length,
  };
}
