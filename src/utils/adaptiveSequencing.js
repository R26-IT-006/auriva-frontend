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
//   accuracy    : pixel-deviation from ideal path (0 = perfect, 100+ = poor)
//   smoothness  : angular jerk in radians         (0 = perfect, 1+  = poor)
//   dtw_distance: normalised DTW trajectory error, in the dtw_norm_v1
//                 coordinate space (both child and template scaled to their
//                 own 100-unit bounding box before DTW runs — see
//                 utils/dtwNormalization.js). 0 = perfect, ~45+ = far off.
//                 NOT raw pixels — device/canvas size no longer affects it.
//
// We combine these into a 0-100 performance score where 100 = perfect.

// DTW_CAP: ceiling for normalised (dtw_norm_v1) DTW distance. Placeholder
// calibration — a genuine trace typically deviates by a small fraction of
// the 100-unit bounding box (child hand jitter), a badly wrong shape by a
// much larger fraction. Cap anything beyond this so it scores the maximum
// penalty without overflowing. Recalibrate from real collection-day data;
// this is a pipeline-safe starting point, not a clinically validated value.
const DTW_CAP = 45;

/** Scoring weights for the letter-writing formula. DTW is dominant (0.7)
 *  because it measures shape fidelity; smoothness is secondary (0.3). */
export const SCORE_WEIGHTS = { trajectory: 0.7, smoothness: 0.3 };

/**
 * Completion gate: a letter attempt passes only when its DTW distance is
 * strictly below this value, in the dtw_norm_v1 normalized coordinate
 * space (see utils/dtwNormalization.js) — NOT raw pixels, so this value is
 * comparable across every device/screen size. Placeholder calibration
 * pending real collection-day data; sits well inside the expected "good"
 * zone by the same margin the previous raw-pixel threshold did.
 * Exported so LetterWritingScreen and storage.js share one source of truth.
 */
export const DTW_CORRECT_THRESHOLD = 22;

/**
 * Converts a single shape/letter-attempt's features into a 0-100 score.
 *
 * ⚠ NON-AUTHORITATIVE for progression (Motor Score Unification, 2026-08):
 * this score is a local, client-side estimate only. It still drives
 * in-session UX (live feedback, local sequencing hints, the instant number
 * a child/teacher sees while writing) — that usage is fine and unchanged.
 * It must NEVER be treated as deciding mastery, pass/fail, threshold
 * updates, or Feature 2/3 evidence: those are decided solely by the
 * backend's computeMotorScore() (auriva-backend/src/utils/motorScore.js)
 * once an attempt reaches the server. Any `attempt_scores` this function
 * produces and sends to the backend is read there only for a diagnostic
 * mismatch check — see handwritingController.recordLetterCompletion() and
 * tests/motorScoreAuthority.test.js (backend repo) for the enforcement and
 * proof that a client-inflated/suppressed score here cannot move the
 * authoritative outcome.
 *
 * Three code paths:
 *  1. accuracy !== 0  → shape-assessment path (lines, circles): score = 100 - accuracy
 *  2. dtw_distance provided → letter-writing path: weighted DTW + smoothness
 *  3. dtw_distance null     → old client / no template: weight redistributed to
 *     smoothness so missing DTW is never treated as a perfect trajectory.
 *
 * Backward-compatible: callers that only pass {smoothness} (or {accuracy,smoothness})
 * continue to receive a valid score; they simply take path 1 or 3.
 *
 * @param {{ accuracy?: number, smoothness?: number, dtw_distance?: number|null }} features
 * @returns {number} 0-100 performance score (higher = better)
 */
export function featuresToScore({ accuracy = null, smoothness = 0, dtw_distance = null }) {
  // Path 1 — geometric accuracy (lines, circles): accuracy is a positive number.
  // null means "not computed" (zigzag, curve_wave, letters) → skip to DTW/smoothness.
  if (accuracy != null && accuracy > 0) {
    return Math.min(100, Math.max(0, 100 - accuracy));
  }

  const smoothPenalty = smoothness * 100; // 0 = perfect, 100 = maximally poor

  if (dtw_distance == null) {
    // Path 3 — no DTW available: redistribute trajectory weight to smoothness.
    // Total effective weight = 0.7 + 0.3 = 1.0 (same scale, no free pass).
    const w = SCORE_WEIGHTS.trajectory + SCORE_WEIGHTS.smoothness;
    return Math.min(100, Math.max(0, 100 - w * smoothPenalty));
  }

  // Path 2 — letter writing with DTW.
  // Normalise DTW to 0-100 scale, capped at DTW_CAP so far-off strokes
  // don't exceed the penalty budget (observed range good~27 → bad~166).
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
      // Shape-assessment scoring path: reads the unified motor_score
      // calculateFeatures() (ShapeAssessmentScreen.js) already computed via
      // utils/unifiedShapeScoreMirror.js, rather than calling
      // featuresToScore() below. featuresToScore itself is UNCHANGED and
      // still used as-is by letters/words/uppercase/pre-writing — this is
      // a narrower, shape-assessment-only substitution, not a retirement
      // of featuresToScore().
      //
      // Unlike the display-facing ?? 50 fallbacks removed elsewhere (which
      // could silently show a fabricated score to a teacher), this map
      // feeds calculateMotorProfile's family-averaging arithmetic directly
      // below — it structurally needs a number for every key, it can't
      // leave a hole the way a "Not available" badge can. This path only
      // ever runs on freshly-computed, same-session data (calculateFeatures
      // always sets motor_score), so motor_score should never actually be
      // missing here; if it is, that's a real bug, not stale historical
      // data — so this warns loudly rather than substituting silently.
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
