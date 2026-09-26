// Conclusion activities — one signature send-off per category, unlocked once the
// whole category is mastered (tier 1 and tier 2 on every concept).
//
// A category absent from CATEGORY_CONCLUSIONS simply shows no banner, which is
// how the icon-only categories (colours, shapes, numbers, house parts) opt out
// until they have artwork to build an activity from. Adding one is a matter of
// registering a screen here and in TeacherNavigator — ConceptItemsScreen needs
// no change per category.
import { getConceptItem, getConceptItemsForCategory } from './conceptData';

export const CATEGORY_CONCLUSIONS = {
  fruits: {
    screen:     'ConceptBasketSort',
    title:      'Fruit Basket Sort',
    subtitle:   'Sort the fruits by their colour!',
    subtitleSi: 'පලතුරු වර්ණ අනුව වර්ග කරමු!',
    icon:       'basket',
  },
};

export function getConclusionForCategory(categoryKey) {
  return CATEGORY_CONCLUSIONS[categoryKey] ?? null;
}

// ─── Basket sort ─────────────────────────────────────────────────────────────

// Rim and label colour for each basket. Same hexes as the coloring palette in
// ConceptColoringScreen, so a colour a child paints with matches the basket
// wearing its name.
export const COLOR_HEX = {
  red:    '#E53935',
  orange: '#FB8C00',
  yellow: '#FDD835',
  green:  '#43A047',
  blue:   '#1E88E5',
  purple: '#8E24AA',
  brown:  '#6D4C41',
  pink:   '#F48FB1',
  black:  '#212121',
  white:  '#FFFFFF',
};

// Yellow, pink and white are far too light to carry white label text at the size
// a basket header renders, so they take dark ink instead.
const LIGHT_SWATCHES = new Set(['yellow', 'pink', 'white']);

export function labelInkFor(colorKey) {
  return LIGHT_SWATCHES.has(colorKey) ? '#212121' : '#FFFFFF';
}

// Three baskets fills a landscape tablet without shrinking the drop targets to
// the point where a child with unsteady aim keeps missing them.
const MAX_BASKETS = 3;
const GAME_SIZE   = 6;

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Groups a category's concepts by `sortColor`, keeping only colours with enough
 * members to be a fair basket.
 *
 * A colour with a single member is excluded deliberately: with one basket
 * holding exactly one fruit, that fruit is solvable by elimination rather than
 * by looking at it, which is the opposite of what the activity tests. In the
 * fruits catalogue this drops `orange` (the orange is our only orange fruit).
 * Concepts with no `sortColor` at all — mango and papaya, whose photographed
 * skins are two-colour gradients — never enter the pool.
 */
export function getSortableColorGroups(categoryKey) {
  const groups = new Map();
  getConceptItemsForCategory(categoryKey).forEach((item) => {
    if (!item.sortColor) return;
    if (!groups.has(item.sortColor)) groups.set(item.sortColor, []);
    groups.get(item.sortColor).push(item);
  });

  return [...groups.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([colorKey, items]) => ({ colorKey, items }));
}

/**
 * Builds one round of basket sort: the baskets to show and the tray of concepts
 * to sort into them.
 *
 * The tray is drawn to guarantee at least one concept per basket and is
 * otherwise random, so the per-basket counts come out uneven. That is
 * intentional — a fixed "two in each" would let a child finish the last basket
 * by counting instead of by recognising the colour.
 *
 * Returns null when the category cannot produce a fair game, so the caller can
 * decline to offer it rather than rendering a broken board.
 */
export function buildBasketSortGame(categoryKey) {
  const groups = shuffle(getSortableColorGroups(categoryKey)).slice(0, MAX_BASKETS);
  if (groups.length < 2) return null;

  const baskets = groups.map(({ colorKey }) => {
    const color = getConceptItem('colors', colorKey);
    return {
      colorKey,
      label:   color?.label   ?? colorKey,
      labelSi: color?.labelSi ?? null,
      icon:    color?.icon    ?? null,
    };
  });

  // One guaranteed pick per basket first, then fill the rest from what is left.
  const pools     = groups.map(({ items }) => shuffle(items));
  const guaranteed = pools.map((pool) => pool[0]);
  const remainder  = shuffle(pools.flatMap((pool) => pool.slice(1)));

  const items = shuffle([
    ...guaranteed,
    ...remainder.slice(0, Math.max(0, GAME_SIZE - guaranteed.length)),
  ]);

  return { baskets, items };
}
