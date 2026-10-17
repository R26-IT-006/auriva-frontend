/**
 * Motor-Informed Adaptive Letter Sequencing (proposal Section 124-127)
 *
 * Deterministic, rule-based ordering — no machine learning. Uses the child's
 * initial six-shape assessment to start letter practice with the stroke type
 * they already control best. Intended to reduce early difficulty; its effect
 * on learning outcomes has not been evaluated.
 *
 *  1. SCORE:      each shape's unified motor_score (0-100), computed by
 *                 unifiedShapeScoreMirror.js during the assessment
 *  2. AGGREGATE:  straight (lines), curved (circles/arcs), complex (zigzag/wave)
 *  3. PROFILE:    compare straight vs curved, with a 10-point buffer
 *  4. SEQUENCE:   stronger category first, mixed always last; letters within
 *                 a category are pre-sorted easy → hard in letterCategories.js
 *
 * complexScore is reported but does not change the order.
 */

import { LETTER_CATEGORIES } from '../constants/letterCategories';

// ─── Client-side score conversion ─────────────────────────────────────────────
// Input metrics (lower = better):
//   accuracy    : pixel deviation from ideal path (0 = perfect)
//   smoothness  : mean turning angle in radians    (0 = perfect, 1+ = poor)
//   dtw_distance: normalized DTW error in dtw_norm_v1 units (see
//                 dtwNormalization.js), not raw pixels. 0 = perfect, ~45+ = far off.
// featuresToScore() combines them into a 0-100 score (100 = perfect).

// DTW_CAP: ceiling for dtw_norm_v1 distance; anything beyond scores the
// maximum penalty. Placeholder calibration, not clinically validated.
const DTW_CAP = 45;

/** Scoring weights for the letter-writing formula. DTW is dominant (0.7)
 *  because it measures shape fidelity; smoothness is secondary (0.3). */
export const SCORE_WEIGHTS = { trajectory: 0.7, smoothness: 0.3 };

/**
 * Client-side DTW gate (dtw_norm_v1 units): an attempt's on-device pass check
 * requires dtw_distance strictly below this value. Used for in-session
 * feedback and local progress only — mastery is decided by the backend's
 * attempt-3 Motor Score. Placeholder calibration.
 * Shared by the writing screens and storage.js.
 */
export const DTW_CORRECT_THRESHOLD = 22;

/**
 * Converts a single shape/letter-attempt's features into a 0-100 score.
 *
 * ⚠ NON-AUTHORITATIVE: a client-side estimate for in-session feedback (the
 * number shown while writing). Mastery, pass/fail and thresholds are decided
 * by the backend's computeMotorScore() on attempt 3. The `attempt_scores`
 * sent from here are used by the backend only for a diagnostic mismatch log
 * (see backend tests/motorScoreAuthority.test.js).
 *
 * Three code paths:
 *  1. accuracy > 0          → legacy geometric path: score = 100 - accuracy.
 *                             No current caller passes accuracy; shapes now
 *                             use the unified motor_score (buildScoreMap).
 *  2. dtw_distance provided → letter path: weighted DTW + smoothness
 *  3. dtw_distance null     → smoothness only, carrying the full weight, so
 *                             missing DTW is never treated as a perfect trajectory.
 *
 * @param {{ accuracy?: number, smoothness?: number, dtw_distance?: number|null }} features
 * @returns {number} 0-100 performance score (higher = better)
 */
export function featuresToScore({ accuracy = null, smoothness = 0, dtw_distance = null }) {
  // Path 1 — legacy geometric accuracy; null means "not computed".
  if (accuracy != null && accuracy > 0) {
    return Math.min(100, Math.max(0, 100 - accuracy));
  }

  const smoothPenalty = smoothness * 100; // 0 = perfect, 100 = maximally poor

  if (dtw_distance == null) {
    // Path 3 — no DTW available: smoothness carries the full weight (0.7 + 0.3 = 1.0).
    const w = SCORE_WEIGHTS.trajectory + SCORE_WEIGHTS.smoothness;
    return Math.min(100, Math.max(0, 100 - w * smoothPenalty));
  }

  // Path 2 — letter writing with DTW, scaled to 0-100 and capped at DTW_CAP.
  const trajectoryPenalty = Math.min(dtw_distance, DTW_CAP) / DTW_CAP * 100;

  return Math.min(100, Math.max(0,
    100 - (SCORE_WEIGHTS.trajectory * trajectoryPenalty
         + SCORE_WEIGHTS.smoothness  * smoothPenalty),
  ));
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
      // Uses the unified motor_score that ShapeAssessmentScreen's
      // calculateFeatures() computed (unifiedShapeScoreMirror.js), not
      // featuresToScore(). The family averages below need a number for every
      // shape, hence the neutral 50 fallback. motor_score is always set on
      // live data, so a missing value indicates a bug and is logged.
      if (shape.features.motor_score == null) {
        console.warn(`buildScoreMap: motor_score missing for shape "${shape.shapeId}" in a live assessment — falling back to neutral 50, but this should never happen (calculateFeatures() always sets it).`);
      }
      map[shape.shapeId] = shape.features.motor_score ?? 50;
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
 * Generate the adaptive letter order (rule-based): the three categories in
 * the profile's categoryOrder, each already sorted by complexity in
 * letterCategories.js, concatenated.
 *
 * @param {Array}  assessmentData  — shape results from initial assessment
 * @param {'lowercase'|'uppercase'} caseType
 * @returns {{ letters: Object[], motorProfile: Object }}
 */
export function generateAdaptiveSequence(assessmentData, caseType = 'lowercase') {
  const motorProfile = calculateMotorProfile(assessmentData);
  const cats         = LETTER_CATEGORIES[caseType];

  const letters = motorProfile.categoryOrder.flatMap(categoryName => {
    return cats[categoryName] ?? [];
  });

  return { letters, motorProfile };
}
