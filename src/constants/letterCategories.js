/**
 * Motor-Informed Letter Categories
 *
 * The CORE NOVELTY of this research: letters are grouped by the underlying
 * motor skill they require, not alphabetically. The adaptive sequencing
 * algorithm (adaptiveSequencing.js) uses these categories to build a
 * personalised learning path from the child's initial shape assessment.
 *
 * Three categories (from proposal Section 124-127):
 *   STRAIGHT  — needs good horizontal / vertical line control
 *   CURVED    — needs good circle / curve control
 *   MIXED     — needs balanced control across all stroke types
 *
 * Complexity scale: 1 = easy, 2 = medium, 3 = hard
 *   Derived from the two-level proposal framework:
 *     Level 1 Easy → complexity 1
 *     Level 1 Mod / Level 2 Easy / Level 2 Mod → complexity 2
 *     Level 2 Hard → complexity 3
 *
 * motorRequirements: normalised 0–1 minimum performance threshold
 *   the child should reach on each shape before this letter is optimal.
 *   Score 1.0 = perfect; 0.6 = adequate; < 0.5 = not yet ready.
 *   The adaptive algorithm uses these to surface readiness warnings.
 */

// ─── Category identifiers ─────────────────────────────────────────────────────

export const CATEGORIES = {
  STRAIGHT: 'straight',
  CURVED:   'curved',
  MIXED:    'mixed',
};

// ─── Per-category motor requirement baselines ─────────────────────────────────

const STRAIGHT_REQUIREMENTS = {
  horizontal_line: 0.60,
  vertical_line:   0.60,
  full_circle:     0.15,
  half_circle:     0.15,
  zigzag:          0.10,
  curve_wave:      0.10,
};

const CURVED_REQUIREMENTS = {
  horizontal_line: 0.15,
  vertical_line:   0.15,
  full_circle:     0.60,
  half_circle:     0.60,
  zigzag:          0.25,
  curve_wave:      0.25,
};

const MIXED_REQUIREMENTS = {
  horizontal_line: 0.40,
  vertical_line:   0.40,
  full_circle:     0.40,
  half_circle:     0.40,
  zigzag:          0.30,
  curve_wave:      0.30,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOWERCASE LETTERS  (26 total — 3 straight | 6 curved | 17 mixed)
// Each array is pre-sorted by complexity so the adaptive sequence can simply
// concatenate them in category-priority order without additional sorting.
// ─────────────────────────────────────────────────────────────────────────────

const LOWERCASE_STRAIGHT = [
  // Pure vertical strokes — the easiest starting point for straight-stroke learners
  { letter: 'l', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['vertical_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'i', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['vertical_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  // Vertical + crossing horizontal — one step up from pure-vertical
  { letter: 't', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },
];

const LOWERCASE_CURVED = [
  // Perfect closed circle — entry point for curved learners
  { letter: 'o', category: CATEGORIES.CURVED, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['full_circle'],
    motorRequirements: CURVED_REQUIREMENTS },

  // Open arc — simpler than full circle
  { letter: 'c', category: CATEGORIES.CURVED, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['half_circle'],
    strokeVariants: { half_circle: 'cap' },
    motorRequirements: CURVED_REQUIREMENTS },

  // Half circle with implied horizontal midline
  { letter: 'e', category: CATEGORIES.CURVED, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['half_circle', 'horizontal_line'],
    strokeVariants: { half_circle: 'cap' },
    motorRequirements: CURVED_REQUIREMENTS },

  // Simple symmetric curve (u-shape)
  { letter: 'u', category: CATEGORIES.CURVED, complexity: 1, caseType: 'lowercase',
    strokeTypes: ['curve_wave'],
    motorRequirements: CURVED_REQUIREMENTS },

  // Circle + attached vertical — Level 1 Hard (curve + line combined)
  { letter: 'a', category: CATEGORIES.CURVED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['full_circle', 'vertical_line'],
    motorRequirements: CURVED_REQUIREMENTS },

  // Complex double-wave — Level 2 Hard; demands the most curve control
  { letter: 's', category: CATEGORIES.CURVED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['curve_wave'],
    motorRequirements: CURVED_REQUIREMENTS },
];

const LOWERCASE_MIXED = [
  // ── complexity 2  (Level 1 Hard + Level 2 Easy/Mod) ──────────────────────

  // Level 1 Hard: curve + short straight extension
  { letter: 'd', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['full_circle', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'g', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['full_circle', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  // Level 2 Easy: simple vertical + small outward extension
  { letter: 'n', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'curve_wave'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'r', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'half_circle'],
    strokeVariants: { half_circle: 'cap' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'h', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'curve_wave'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'f', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['curve_wave', 'horizontal_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  // Level 2 Mod: diagonal strokes introduced
  { letter: 'k', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'v', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'w', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['zigzag', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'y', category: CATEGORIES.MIXED, complexity: 2, caseType: 'lowercase',
    strokeTypes: ['zigzag', 'curve_wave'],
    motorRequirements: MIXED_REQUIREMENTS },

  // ── complexity 3  (Level 2 Hard) ─────────────────────────────────────────

  { letter: 'b', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'half_circle'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'j', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'curve_wave'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'm', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'curve_wave', 'curve_wave'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'p', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['vertical_line', 'half_circle'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'q', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['full_circle', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'x', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['zigzag', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'z', category: CATEGORIES.MIXED, complexity: 3, caseType: 'lowercase',
    strokeTypes: ['horizontal_line', 'zigzag', 'horizontal_line'],
    motorRequirements: MIXED_REQUIREMENTS },
];

// ─────────────────────────────────────────────────────────────────────────────
// UPPERCASE LETTERS  (26 total — 6 straight | 7 curved | 13 mixed)
// Unlocked only after all 26 lowercase letters are mastered.
// ─────────────────────────────────────────────────────────────────────────────

const UPPERCASE_STRAIGHT = [
  // Single vertical stroke — absolute entry point
  { letter: 'I', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'L', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'T', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'F', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'E', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'horizontal_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },

  { letter: 'H', category: CATEGORIES.STRAIGHT, complexity: 1, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'vertical_line', 'horizontal_line'],
    motorRequirements: STRAIGHT_REQUIREMENTS },
];

const UPPERCASE_CURVED = [
  // complexity 2 — simple curves, moderate precision needed
  { letter: 'O', category: CATEGORIES.CURVED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['full_circle'],
    motorRequirements: CURVED_REQUIREMENTS },

  { letter: 'C', category: CATEGORIES.CURVED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['half_circle'],
    strokeVariants: { half_circle: 'cap' },
    motorRequirements: CURVED_REQUIREMENTS },

  { letter: 'U', category: CATEGORIES.CURVED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['curve_wave'],
    motorRequirements: CURVED_REQUIREMENTS },

  { letter: 'J', category: CATEGORIES.CURVED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'curve_wave'],
    motorRequirements: CURVED_REQUIREMENTS },

  // complexity 3 — complex curves; proposal Level 2 Hard equivalent
  { letter: 'S', category: CATEGORIES.CURVED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['curve_wave'],
    motorRequirements: CURVED_REQUIREMENTS },

  // G requires C-shape + inward horizontal — precision-demanding
  { letter: 'G', category: CATEGORIES.CURVED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['half_circle', 'horizontal_line'],
    strokeVariants: { half_circle: 'cap' },
    motorRequirements: CURVED_REQUIREMENTS },

  // Q = O with a crossing exit stroke
  { letter: 'Q', category: CATEGORIES.CURVED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['full_circle', 'zigzag'],
    motorRequirements: CURVED_REQUIREMENTS },
];

const UPPERCASE_MIXED = [
  // ── complexity 2 ──────────────────────────────────────────────────────────
  { letter: 'D', category: CATEGORIES.MIXED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'half_circle'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'P', category: CATEGORIES.MIXED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'half_circle'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'B', category: CATEGORIES.MIXED, complexity: 2, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'half_circle', 'half_circle'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  // ── complexity 3 ──────────────────────────────────────────────────────────
  // Multiple diagonals, crossing strokes, direction reversals (proposal Hard)
  { letter: 'V', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'Y', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['zigzag', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'A', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['zigzag', 'horizontal_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'K', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'M', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'zigzag', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'N', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'zigzag', 'vertical_line'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'R', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['vertical_line', 'half_circle', 'zigzag'],
    strokeVariants: { half_circle: 'cup' },
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'W', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['zigzag', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'X', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['zigzag', 'zigzag'],
    motorRequirements: MIXED_REQUIREMENTS },

  { letter: 'Z', category: CATEGORIES.MIXED, complexity: 3, caseType: 'uppercase',
    strokeTypes: ['horizontal_line', 'zigzag', 'horizontal_line'],
    motorRequirements: MIXED_REQUIREMENTS },
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * ── strokeVariants ────────────────────────────────────────────────────────
 * A stroke id says WHICH primitive a letter is written with; for a curve it
 * does not say which way that curve bows, and `c` and `b` bow opposite ways.
 * `strokeVariants` carries that one missing fact, next to the strokeTypes it
 * qualifies, so it stays exact-letter metadata rather than a second map.
 *
 *   cap  the curve bows LEFT of a downward stroke — the c / C family
 *   cup  it bows RIGHT — the b / p / D bowl family
 *
 * Every value is READ OFF the letter's own reference waypoints in
 * LETTER_PATHS: the sign of the curve's maximum perpendicular offset from its
 * own chord. Nothing here is a visual guess, and no reference geometry was
 * touched to produce it. letterRemediation.test.js recomputes the sign from
 * those waypoints and fails if a value here disagrees.
 *
 * Optional and additive: a letter without it is simply undirected, and
 * consumers must treat it that way rather than assuming a default. Only the
 * interactive warm-up uses it — printed worksheets render an undirected row
 * of curves and have no concept of bow direction, which is why the backend
 * mirror does not carry it.
 */
export const LETTER_CATEGORIES = {
  lowercase: {
    straight: LOWERCASE_STRAIGHT,
    curved:   LOWERCASE_CURVED,
    mixed:    LOWERCASE_MIXED,
  },
  uppercase: {
    straight: UPPERCASE_STRAIGHT,
    curved:   UPPERCASE_CURVED,
    mixed:    UPPERCASE_MIXED,
  },
};

/**
 * Returns all letters for a given case type in default
 * (straight → curved → mixed, easy → hard) order.
 */
export function getAllLetters(caseType = 'lowercase') {
  const cats = LETTER_CATEGORIES[caseType];
  return [...cats.straight, ...cats.curved, ...cats.mixed];
}

/**
 * Returns letters for a specific motor category.
 * @param {'straight'|'curved'|'mixed'} category
 * @param {'lowercase'|'uppercase'} caseType
 */
export function getLettersByCategory(category, caseType = 'lowercase') {
  return LETTER_CATEGORIES[caseType][category] ?? [];
}

/**
 * Returns the complexity level (1|2|3) for a specific letter character,
 * or null if the letter is not found.
 */
export function getLetterComplexity(letter) {
  const all = [...getAllLetters('lowercase'), ...getAllLetters('uppercase')];
  return all.find(l => l.letter === letter)?.complexity ?? null;
}

/**
 * Returns the motor category ('straight'|'curved'|'mixed') for a letter,
 * or null if not found.
 */
export function getLetterCategory(letter) {
  const all = [...getAllLetters('lowercase'), ...getAllLetters('uppercase')];
  return all.find(l => l.letter === letter)?.category ?? null;
}

/**
 * Returns the ORDERED stroke ids this letter form is written with — its own
 * `strokeTypes`, in source order, copied so a caller cannot mutate the
 * catalogue.
 *
 * This is the single frontend source for letter decomposition. The backend's
 * worksheetMotorMap.LETTER_STROKE_TYPES is a hand-kept mirror of these very
 * arrays with a CI drift test; nothing else may hold a third copy.
 *
 * Case is significant and never assumed symmetric: 'a' is
 * ['full_circle', 'vertical_line'] while 'A' is ['zigzag', 'horizontal_line'].
 *
 * @param {string} letter
 * @returns {string[]|null} null for an unknown letter — never a guessed default.
 */
/**
 * The optional per-stroke direction metadata for a letter — currently only
 * `half_circle: 'cap' | 'cup'`. See the strokeVariants note above
 * LETTER_CATEGORIES.
 *
 * @returns {Object|null} a copy, or null when this letter has none. Callers
 *   must treat null as "undirected", never as a default direction.
 */
export function getLetterStrokeVariants(letter) {
  if (typeof letter !== 'string' || letter.length !== 1) return null;
  const all = [...getAllLetters('lowercase'), ...getAllLetters('uppercase')];
  const variants = all.find(l => l.letter === letter)?.strokeVariants;
  return variants ? { ...variants } : null;
}

export function getLetterStrokeTypes(letter) {
  if (typeof letter !== 'string' || letter.length !== 1) return null;
  const all = [...getAllLetters('lowercase'), ...getAllLetters('uppercase')];
  const entry = all.find(l => l.letter === letter);
  return Array.isArray(entry?.strokeTypes) ? [...entry.strokeTypes] : null;
}
