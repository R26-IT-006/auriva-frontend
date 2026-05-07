/**
 * Motor-Informed Adaptive Letter Sequencing
 *
 * RESEARCH NOVELTY (proposal Section 124-127):
 * Instead of presenting letters alphabetically, this algorithm analyses
 * the child's initial motor assessment to determine which stroke types they
 * already control well, then sequences letters so the child begins with
 * familiar motor patterns and progressively encounters harder ones.
 *
 * This builds motor confidence early, reduces frustration, and aligns
 * letter practice with the child's current developmental readiness.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 *
 *  1. SCORE each shape:   convert raw deviation/smoothness into 0-100
 *                         performance score (100 = perfect, 0 = unable)
 *
 *  2. AGGREGATE by type:  straight shapes  → straightScore  (lines)
 *                         curved shapes    → curvedScore    (circles/arcs)
 *                         complex shapes   → complexScore   (direction changes)
 *
 *  3. PROFILE:            compare straight vs curved to find primary strength
 *                         (uses a 10-point buffer to absorb measurement noise)
 *
 *  4. SEQUENCE:           stronger category goes first within the letter list;
 *                         within every category letters are already sorted
 *                         easy(1) → medium(2) → hard(3) in letterCategories.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LETTER_CATEGORIES } from '../constants/letterCategories';

// ─── Score conversion ─────────────────────────────────────────────────────────
// Raw assessment data uses two quality metrics (lower = worse performance):
//   accuracy  : pixel-deviation from ideal path (0 = perfect, 100+ = poor)
//   smoothness: angular jerk in radians      (0 = perfect, 1+ = poor)
//
// We invert both into a 0-100 performance score where 100 = perfect.

/**
 * Converts a single shape's features into a 0-100 performance score.
 * Shapes with no meaningful accuracy (zigzag, curve_wave) are scored
 * from smoothness alone.
 *
 * @param {{ accuracy: number, smoothness: number }} features
 * @returns {number} performance score 0-100
 */
function featuresToScore({ accuracy = 0, smoothness = 0 }) {
  if (accuracy === 0) {
    // Smoothness-only shape (zigzag, curve_wave)
    // smoothness ≈ 0–1 in practice; multiply ×100 to match the accuracy scale
    return Math.min(100, Math.max(0, 100 - smoothness * 100));
  }
  return Math.min(100, Math.max(0, 100 - accuracy));
}

/**
 * Builds a map of { shapeId: score } from the assessmentData array.
 * Any shape not present in the assessment defaults to score 50 (neutral).
 *
 * @param {Array} assessmentData
 * @returns {Object}
 */
function buildScoreMap(assessmentData) {
  const map = {
    horizontal_line: 50,
    vertical_line:   50,
    full_circle:     50,
    half_circle:     50,
    zigzag:          50,
    curve_wave:      50,
  };
  if (!Array.isArray(assessmentData)) return map;

  for (const shape of assessmentData) {
    if (shape?.shapeId && shape?.features) {
      map[shape.shapeId] = featuresToScore(shape.features);
    }
  }
  return map;
}

// ─── Motor profile ────────────────────────────────────────────────────────────

/**
 * Calculates the child's motor profile from assessment data.
 *
 * Returns an object the UI can use both for adaptive sequencing AND for the
 * XAI "why this order?" explanation (proposal Section 137).
 *
 * @param {Array} assessmentData  — array from ShapeAssessmentScreen
 * @returns {{
 *   straightScore: number,
 *   curvedScore: number,
 *   complexScore: number,
 *   primaryStrength: 'straight'|'curved'|'balanced',
 *   categoryOrder: string[],
 *   recommendedSequence: string,
 *   shapeScores: Object
 * }}
 */
export function calculateMotorProfile(assessmentData) {
  const scores = buildScoreMap(assessmentData);

  // ── Step 1: aggregate by motor category ───────────────────────────────────
  // Straight letters need line precision → average line scores
  const straightScore = Math.round(
    (scores.horizontal_line + scores.vertical_line) / 2
  );

  // Curved letters need circle/arc precision → average circle scores
  const curvedScore = Math.round(
    (scores.full_circle + scores.half_circle) / 2
  );

  // Mixed letters need direction-change control → average direction scores
  const complexScore = Math.round(
    (scores.zigzag + scores.curve_wave) / 2
  );

  // ── Step 2: determine primary strength ────────────────────────────────────
  // 10-point buffer prevents noise from flipping the profile on near-equal scores
  let primaryStrength;
  let categoryOrder;
  let recommendedSequence;

  if (straightScore >= curvedScore + 10) {
    // Child is meaningfully better at straight strokes
    // → start with straight letters, then curved, finish with mixed
    primaryStrength      = 'straight';
    categoryOrder        = ['straight', 'curved', 'mixed'];
    recommendedSequence  = 'STRAIGHT → CURVED → MIXED';

  } else if (curvedScore >= straightScore + 10) {
    // Child is meaningfully better at curves
    // → start with curved letters, then straight, finish with mixed
    primaryStrength      = 'curved';
    categoryOrder        = ['curved', 'straight', 'mixed'];
    recommendedSequence  = 'CURVED → STRAIGHT → MIXED';

  } else {
    // Scores are close — treat as balanced, use the standard default order
    primaryStrength      = 'balanced';
    categoryOrder        = ['straight', 'curved', 'mixed'];
    recommendedSequence  = 'STRAIGHT → CURVED → MIXED';
  }

  return {
    straightScore,
    curvedScore,
    complexScore,
    primaryStrength,
    categoryOrder,
    recommendedSequence,
    shapeScores: { ...scores },
  };
}

// ─── Strength / weakness helpers ─────────────────────────────────────────────

/**
 * Returns an array of shape IDs where the child performs well (score ≥ 70).
 * Used for positive reinforcement messaging in the UI.
 *
 * @param {Array} assessmentData
 * @returns {string[]}
 */
export function getMotorStrengths(assessmentData) {
  const scores = buildScoreMap(assessmentData);
  return Object.entries(scores)
    .filter(([, score]) => score >= 70)
    .map(([shapeId]) => shapeId);
}

/**
 * Returns an array of shape IDs where the child needs more practice (score < 50).
 * Used to generate the "reason" message and targeted practice suggestions.
 *
 * @param {Array} assessmentData
 * @returns {string[]}
 */
export function getMotorWeaknesses(assessmentData) {
  const scores = buildScoreMap(assessmentData);
  return Object.entries(scores)
    .filter(([, score]) => score < 50)
    .map(([shapeId]) => shapeId);
}

// ─── Main sequence generator ──────────────────────────────────────────────────

/**
 * CORE ALGORITHM — generates the child's personalised letter sequence.
 *
 * Steps:
 *   1. Calculate motor profile from assessment data
 *   2. Order the three letter categories by the child's primary strength
 *   3. Within each category letters are already sorted by complexity (1→2→3)
 *      in letterCategories.js — no additional sort is needed
 *   4. Concatenate and return the full ordered sequence
 *
 * @param {Array}  assessmentData  — shape results from initial assessment
 * @param {'lowercase'|'uppercase'} caseType
 * @returns {{ letters: Object[], motorProfile: Object }}
 */
export function generateAdaptiveSequence(assessmentData, caseType = 'lowercase') {
  const motorProfile = calculateMotorProfile(assessmentData);
  const cats         = LETTER_CATEGORIES[caseType];

  // Build the ordered sequence: stronger motor category first,
  // complexity 1 → 2 → 3 within each category (already ordered in the constant)
  const letters = motorProfile.categoryOrder.flatMap(categoryName => {
    return cats[categoryName] ?? [];
  });

  return { letters, motorProfile };
}
