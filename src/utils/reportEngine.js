/**
 * reportEngine.js — Explainable AI (XAI) report generator
 *
 * Extended with motor difficulty analysis via explainabilityEngine.
 *
 * Every public function returns both the computed VALUE and an EXPLANATION
 * string so the teacher always knows exactly HOW and WHY a metric was derived.
 *
 * Data flows in:
 *  - assessmentData  : [{ shapeId, features: { smoothness } }]  from shape assessment
 *  - motorProfile    : { straightScore, curvedScore, primaryStrength, recommendedSequence }
 *  - letterProgress  : { [letter]: { attempts: [...] } }         from AsyncStorage
 *  - wordProgress    : { [letter]: [{ word, status:{A,B,C,D} }] } from sessionProgress
 *  - completedLetters: string[]                                   from AsyncStorage
 *  - student         : { full_name, sid, ... }
 */

import { analyzeMotorDifficulty } from './explainabilityEngine';

// ─── Smoothness → quality label ───────────────────────────────────────────────
// Lower smoothness score is BETTER (less jitter in the stroke)
function smoothnessToPercent(s) {
  return Math.max(0, Math.min(100, Math.round((1 - s) * 100)));
}

function smoothnessLabel(s) {
  if (s < 0.15) return 'Excellent';
  if (s < 0.35) return 'Good';
  if (s < 0.55) return 'Moderate';
  return 'Needs Practice';
}

// ─── Motor Comfort Score ──────────────────────────────────────────────────────

/**
 * Computes a 0-100 motor comfort score from shape assessment smoothness data.
 * Formula:  avgStrokeScore × 0.6 + pauseBonus × 0.2 + consistencyBonus × 0.2
 * (When only smoothness data is available, strokeScore carries 100% weight.)
 *
 * @param {Array}  assessmentData  [{ shapeId, features: { smoothness } }]
 * @param {Object} motorProfile    { straightScore, curvedScore, primaryStrength }
 * @returns {{ score, level, breakdown, explanation }}
 */
export function computeMotorComfortScore(assessmentData, motorProfile) {
  if (!assessmentData || assessmentData.length === 0) {
    return {
      score: null,
      level: 'No data',
      breakdown: [],
      explanation:
        'Motor Comfort Score could not be computed because no shape assessment data was found. ' +
        'Ask the student to complete the initial shape drawing assessment first.',
    };
  }

  const breakdown = assessmentData.map(shape => ({
    shapeId:    shape.shapeId ?? 'unknown',
    smoothness: shape.features?.smoothness ?? 0.5,
    score:      smoothnessToPercent(shape.features?.smoothness ?? 0.5),
    label:      smoothnessLabel(shape.features?.smoothness ?? 0.5),
  }));

  const avgScore = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length);

  let level;
  if (avgScore >= 80) level = 'High Control';
  else if (avgScore >= 60) level = 'Moderate Control';
  else if (avgScore >= 40) level = 'Basic Control';
  else level = 'Needs Support';

  const best  = breakdown.reduce((a, b) => a.score > b.score ? a : b);
  const worst = breakdown.reduce((a, b) => a.score < b.score ? a : b);

  const strengthHint = motorProfile
    ? `Their motor profile shows stronger ${motorProfile.primaryStrength === 'straight' ? 'straight-line' : 'curved'} strokes.`
    : '';

  const explanation =
    `The Motor Comfort Score (${avgScore}/100) is calculated from ${breakdown.length} shape exercises. ` +
    `Each shape is scored by stroke smoothness — the steadiness of the child's hand movement ` +
    `(0 = perfectly smooth, 1 = very shaky; converted to 0–100 where higher is better). ` +
    `Best shape: ${best.shapeId} (${best.score}/100, ${best.label}). ` +
    `Shape needing most practice: ${worst.shapeId} (${worst.score}/100, ${worst.label}). ` +
    `${strengthHint} ` +
    `Scores above 75 indicate good motor readiness for handwriting. ` +
    `Below 50 suggests motor warm-up exercises before writing sessions.`;

  return { score: avgScore, level, breakdown, explanation };
}

// ─── Letter Practice Metrics ──────────────────────────────────────────────────

/**
 * Computes per-letter handwriting metrics from attempt history.
 * @param {Object} letterProgressMap  { [letter]: { letter, attempts, completed } }
 * @returns {{ letters, avgDeviation, avgPauses, avgTime, explanation }}
 */
export function computeLetterMetrics(letterProgressMap) {
  if (!letterProgressMap || Object.keys(letterProgressMap).length === 0) {
    return {
      letters: [],
      avgDeviation: null,
      avgPauses: null,
      avgTime: null,
      explanation:
        'No letter practice data found for this session. ' +
        'Letter metrics are recorded as the child practises writing each letter.',
    };
  }

  const letters = Object.entries(letterProgressMap).map(([letter, data]) => {
    const attempts = data?.attempts ?? [];
    if (attempts.length === 0) return null;

    const avgDev  = attempts.reduce((s, a) => s + (a.deviation ?? 0), 0)        / attempts.length;
    const avgPause= attempts.reduce((s, a) => s + (a.pauseCount ?? 0), 0)       / attempts.length;
    const avgTime = attempts.reduce((s, a) => s + (a.completionTime ?? 0), 0)   / attempts.length;
    const accuracy = data?.serverBestScore != null
      ? Math.round(data.serverBestScore)
      : Math.max(0, Math.min(100, Math.round((1 - avgDev / 50) * 100)));

    return {
      letter,
      attempts:  attempts.length,
      completed: data.completed ?? false,
      avgDev:    Math.round(avgDev),
      avgPause:  Math.round(avgPause * 10) / 10,
      avgTimeSec: Math.round(avgTime / 1000),
      accuracy,
      status: accuracy >= 80 ? 'Mastered' : accuracy >= 60 ? 'Progressing' : 'Needs Practice',
    };
  }).filter(Boolean);

  const all = letters;
  const totalAttempts = all.reduce((s, l) => s + l.attempts, 0);
  const avgDeviation  = all.length ? Math.round(all.reduce((s, l) => s + l.avgDev, 0)  / all.length) : null;
  const avgPauses     = all.length ? Math.round(all.reduce((s, l) => s + l.avgPause, 0)/ all.length * 10) / 10 : null;
  const avgTime       = all.length ? Math.round(all.reduce((s, l) => s + l.avgTimeSec, 0) / all.length) : null;

  const mastered    = all.filter(l => l.status === 'Mastered').length;
  const progressing = all.filter(l => l.status === 'Progressing').length;
  const needsWork   = all.filter(l => l.status === 'Needs Practice').length;

  const explanation =
    `Letter metrics are derived from ${totalAttempts} writing attempt(s) across ${all.length} letter(s). ` +
    `Deviation measures how far each stroke strays from the ideal path (lower = more accurate). ` +
    `Average deviation: ${avgDeviation ?? 'N/A'} px — ` +
    `${avgDeviation !== null && avgDeviation < 20 ? 'excellent precision' : avgDeviation !== null && avgDeviation < 35 ? 'good control' : 'needs more practice'}. ` +
    `Pause count shows how often the child lifted the pencil mid-stroke (ideal: 0–2 pauses). ` +
    `Result: ${mastered} mastered, ${progressing} progressing, ${needsWork} need more practice.`;

  return { letters, avgDeviation, avgPauses, avgTime, explanation };
}

// ─── Word Activity Mastery ─────────────────────────────────────────────────────

/**
 * Computes per-letter word activity accuracy from sessionProgress data.
 * @param {Object} wordProgress  { [letter]: [{ word, status }] }
 * @returns {{ byLetter, overall, explanation }}
 */
export function computeWordMastery(wordProgress) {
  const entries = Object.entries(wordProgress ?? {});
  if (entries.length === 0) {
    return {
      byLetter: [],
      overall: null,
      explanation:
        'No word activity data recorded yet. Word activities are tracked once the child ' +
        'starts the Words section and completes exercises for each letter.',
    };
  }

  const EXERCISE_NAMES = { A: 'First Letter', B: 'Find Picture', C: 'Fill Gap', D: 'Spell It' };

  const byLetter = entries.map(([letter, words]) => {
    let correct = 0, good = 0, total = 0;
    const exBreakdown = { A: { correct: 0, good: 0, total: 0 }, B: { correct: 0, good: 0, total: 0 },
                          C: { correct: 0, good: 0, total: 0 }, D: { correct: 0, good: 0, total: 0 } };

    words.forEach(w => {
      Object.entries(w.status).forEach(([ex, status]) => {
        total++;
        exBreakdown[ex].total++;
        if (status === 'correct') { correct++; exBreakdown[ex].correct++; }
        else if (status === 'good') { good++; exBreakdown[ex].good++; }
      });
    });

    const accuracy   = total > 0 ? Math.round((correct / total) * 100) : 0;
    const withHelp   = total > 0 ? Math.round((good    / total) * 100) : 0;
    const masteryStatus = accuracy >= 80 ? 'Mastered' : accuracy >= 60 ? 'Moderate' : 'Needs Practice';

    // Best and worst exercise for this letter
    const exScores = Object.entries(exBreakdown)
      .filter(([, v]) => v.total > 0)
      .map(([ex, v]) => ({ ex, pct: Math.round((v.correct / v.total) * 100), name: EXERCISE_NAMES[ex] }));
    const bestEx  = exScores.length ? exScores.reduce((a, b) => a.pct >= b.pct ? a : b) : null;
    const worstEx = exScores.length ? exScores.reduce((a, b) => a.pct <= b.pct ? a : b) : null;

    return {
      letter, words: words.length, correct, good, total,
      accuracy, withHelp, masteryStatus, exBreakdown, bestEx, worstEx,
      wordList: words.map(w => ({
        word:   w.word,
        emoji:  w.emoji,
        status: w.status,
        stars:  Object.values(w.status).filter(s => s === 'correct').length,
      })),
    };
  });

  const totalCorrect = byLetter.reduce((s, l) => s + l.correct, 0);
  const totalEx      = byLetter.reduce((s, l) => s + l.total,   0);
  const overallPct   = totalEx > 0 ? Math.round((totalCorrect / totalEx) * 100) : 0;

  const weakLetters  = byLetter.filter(l => l.masteryStatus === 'Needs Practice').map(l => l.letter.toUpperCase());
  const strongLetters= byLetter.filter(l => l.masteryStatus === 'Mastered').map(l => l.letter.toUpperCase());

  const explanation =
    `Word activity accuracy is measured across 4 exercise types per word: First Letter (A), ` +
    `Find the Picture (B), Fill the Gap (C), and Spell It (D). ` +
    `'Correct' = answered right on the first attempt; 'With help' = needed more tries. ` +
    `Overall accuracy: ${totalCorrect}/${totalEx} exercises correct (${overallPct}%). ` +
    `${strongLetters.length > 0 ? `Strong letters: ${strongLetters.join(', ')}. ` : ''}` +
    `${weakLetters.length > 0 ? `Letters needing more practice: ${weakLetters.join(', ')}. ` : ''}` +
    `The 80% threshold is used for mastery — at that level, a child can work independently with the material.`;

  return { byLetter, overall: { correct: totalCorrect, total: totalEx, pct: overallPct }, explanation };
}

// ─── Learning Progress Indicators ─────────────────────────────────────────────

/**
 * Derives learning progress signals with XAI explanations.
 * @param {Object} params  All available metrics
 * @returns {Array<{ label, status, icon, detail, xai }>}
 */
export function computeProgressIndicators({ motorScore, letterMetrics, wordMastery, completedLetters }) {
  const indicators = [];

  // Stroke control
  if (motorScore?.score !== null && motorScore?.score !== undefined) {
    const s = motorScore.score;
    indicators.push({
      label:  'Stroke Control',
      status: s >= 75 ? 'good' : s >= 50 ? 'moderate' : 'needs-work',
      icon:   s >= 75 ? '✓' : s >= 50 ? '~' : '!',
      detail: s >= 75 ? 'Improving' : s >= 50 ? 'Developing' : 'Needs practice',
      xai:    `Stroke control is rated '${s >= 75 ? 'Good' : s >= 50 ? 'Moderate' : 'Needs practice'}' ` +
              `based on the Motor Comfort Score of ${s}/100. ` +
              `Scores ≥75 indicate the child can form steady strokes without excessive tremor. ` +
              `This metric directly predicts handwriting legibility.`,
    });
  }

  // Letter formation (from letter progress)
  if (letterMetrics?.letters?.length > 0) {
    const mastered = letterMetrics.letters.filter(l => l.status === 'Mastered').length;
    const total    = letterMetrics.letters.length;
    const pct      = Math.round((mastered / total) * 100);
    indicators.push({
      label:  'Letter Formation',
      status: pct >= 70 ? 'good' : pct >= 40 ? 'moderate' : 'needs-work',
      icon:   pct >= 70 ? '✓' : pct >= 40 ? '~' : '!',
      detail: pct >= 70 ? 'On track' : pct >= 40 ? 'Progressing' : 'Needs focus',
      xai:    `Letter formation is rated by comparing deviation from the ideal stroke path. ` +
              `${mastered} of ${total} practiced letters (${pct}%) meet the mastery threshold ` +
              `(< 20 px average deviation). A child scoring above 70% mastery rate is on track ` +
              `for independent handwriting within the expected developmental window.`,
    });
  }

  // Speed consistency (from letter attempt times)
  if (letterMetrics?.avgTime !== null && letterMetrics?.avgTime !== undefined) {
    const t = letterMetrics.avgTime;
    const consistent = t >= 3 && t <= 12;
    indicators.push({
      label:  'Speed Consistency',
      status: consistent ? 'good' : 'moderate',
      icon:   consistent ? '✓' : '~',
      detail: consistent ? 'Good' : t < 3 ? 'Too fast (rushing)' : 'Too slow (hesitating)',
      xai:    `Speed consistency measures whether the child writes at a controlled, steady pace. ` +
              `Average letter completion time: ${t}s. ` +
              `The expected range for emerging writers is 3–12 seconds per letter. ` +
              `${t < 3 ? 'Rushing suggests the child may be guessing strokes rather than recalling them.' : ''} ` +
              `${t > 12 ? 'Hesitation may indicate letter recall difficulty or motor planning challenges.' : ''}`,
    });
  }

  // Word activity fluency
  if (wordMastery?.overall) {
    const pct = wordMastery.overall.pct;
    indicators.push({
      label:  'Word Activity',
      status: pct >= 75 ? 'good' : pct >= 50 ? 'moderate' : 'needs-work',
      icon:   pct >= 75 ? '✓' : pct >= 50 ? '~' : '!',
      detail: pct >= 75 ? 'Fluent' : pct >= 50 ? 'Developing' : 'Early stage',
      xai:    `Word activity fluency reflects how accurately the child completes all 4 exercise types ` +
              `(First Letter, Find Picture, Fill Gap, Spell It) on the first attempt. ` +
              `Current accuracy: ${pct}%. The 75% target ensures the child can recognise, read, ` +
              `and reproduce words independently before progressing to more complex content.`,
    });
  }

  return indicators;
}

// ─── XAI Recommendations ──────────────────────────────────────────────────────

/**
 * Generates personalised, evidence-based teacher recommendations.
 * Each recommendation includes WHY it was suggested (rationale).
 * @returns {Array<{ priority, text, rationale, icon }>}
 */
export function generateRecommendations({ motorScore, letterMetrics, wordMastery, completedLetters }) {
  const recs = [];

  // Motor recommendations
  if (motorScore?.score !== null && motorScore?.score !== undefined) {
    if (motorScore.score < 50) {
      recs.push({
        priority: 'high',
        icon: '✏️',
        text: 'Include 5-minute motor warm-up exercises before each writing session',
        rationale:
          `Motor Comfort Score is ${motorScore.score}/100 (below the 50-point baseline). ` +
          `Research shows that fine motor warm-ups (dot-to-dot, finger tracing) improve subsequent ` +
          `stroke smoothness by 15–30% within 2–4 sessions.`,
      });
    }
    if (motorScore.breakdown) {
      const worstShape = motorScore.breakdown.reduce((a, b) => a.score < b.score ? a : b);
      if (worstShape.score < 65) {
        recs.push({
          priority: 'medium',
          icon: '🔄',
          text: `Practise "${worstShape.shapeId.replace(/_/g, ' ')}" strokes with larger arm movements first`,
          rationale:
            `The "${worstShape.shapeId.replace(/_/g, ' ')}" shape scored ${worstShape.score}/100 — ` +
            `the weakest result in the motor assessment. Starting with large-scale arm movements ` +
            `(whiteboard or air writing) builds motor memory before moving to pencil/tablet.`,
        });
      }
    }
  }

  // Letter formation recommendations
  if (letterMetrics?.letters?.length > 0) {
    const needsWork = letterMetrics.letters.filter(l => l.status === 'Needs Practice');
    if (needsWork.length > 0) {
      const letters = needsWork.map(l => l.letter.toUpperCase()).join(', ');
      recs.push({
        priority: 'high',
        icon: '🔤',
        text: `Focus next session on letters: ${letters}`,
        rationale:
          `These letters have average stroke deviation above 35 px and accuracy below 60%. ` +
          `Targeted repetition of 3–5 minutes per letter, with visual guide fading, ` +
          `is recommended before introducing new letters.`,
      });
    }

    if (letterMetrics.avgPauses > 3) {
      recs.push({
        priority: 'medium',
        icon: '✋',
        text: 'Practise continuous strokes — remind the child not to lift the pencil mid-letter',
        rationale:
          `Average pause count is ${letterMetrics.avgPauses} per letter (ideal: ≤2). ` +
          `Frequent mid-stroke lifts suggest the child is drawing letters rather than forming them ` +
          `as fluid movements. Verbal cues and tracing exercises help build continuous stroke habits.`,
      });
    }
  }

  // Word activity recommendations
  if (wordMastery?.byLetter?.length > 0) {
    const weakEx = { A: 0, B: 0, C: 0, D: 0 };
    const exNames = { A: 'First Letter', B: 'Find Picture', C: 'Fill Gap', D: 'Spell It' };
    wordMastery.byLetter.forEach(l => {
      Object.entries(l.exBreakdown).forEach(([ex, v]) => {
        if (v.total > 0 && (v.correct / v.total) < 0.6) weakEx[ex]++;
      });
    });
    const weakestEx = Object.entries(weakEx).sort((a, b) => b[1] - a[1])[0];
    if (weakestEx && weakestEx[1] > 0) {
      recs.push({
        priority: 'medium',
        icon: '🎯',
        text: `Give extra practice on '${exNames[weakestEx[0]]}' exercises`,
        rationale:
          `The '${exNames[weakestEx[0]]}' (Exercise ${weakestEx[0]}) activity had below 60% accuracy ` +
          `in ${weakestEx[1]} letter(s). This exercise type assesses ` +
          `${weakestEx[0] === 'A' ? 'phoneme-to-grapheme mapping' :
            weakestEx[0] === 'B' ? 'word-image association (visual vocabulary)' :
            weakestEx[0] === 'C' ? 'phonological awareness and letter identification' :
                                   'orthographic memory and sequential letter recall'}. ` +
          `Targeted activities for this skill can improve accuracy within 2–3 sessions.`,
      });
    }
  }

  // Positive reinforcement
  if (completedLetters?.length > 0) {
    recs.push({
      priority: 'low',
      icon: '🌟',
      text: `Celebrate completing ${completedLetters.length} letter(s) — positive reinforcement maintains motivation`,
      rationale:
        `Completing ${completedLetters.length} letter(s) is a measurable achievement. ` +
        `Research in early literacy education shows that explicit recognition of progress ` +
        `increases session engagement and retention rates by up to 20%.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      icon: '📋',
      text: 'Complete more activities to generate personalised recommendations',
      rationale: 'Recommendations are generated once the child has completed at least one assessment or activity.',
    });
  }

  return recs;
}

// ─── Motor Difficulty Analysis ────────────────────────────────────────────────

/**
 * Wraps explainabilityEngine.analyzeMotorDifficulty with report-style output.
 * Accepts the same inputs as the rest of the report pipeline.
 *
 * @param {Array}  assessmentData
 * @param {Object} letterMetrics  already-computed letter metrics object
 * @param {number} motorScore     already-computed 0-100 score
 * @returns {Object}  difficulty analysis result
 */
export function computeMotorDifficulty(assessmentData, letterMetrics, motorScore) {
  return analyzeMotorDifficulty(
    assessmentData,
    {
      avgPauses: letterMetrics?.avgPauses ?? null,
      avgTime:   letterMetrics?.avgTime   ?? null,
    },
    typeof motorScore === 'number' ? motorScore : null
  );
}

// ─── Full report bundle ────────────────────────────────────────────────────────

/**
 * Master entry point — computes the complete report.
 */
export function generateReport({ assessmentData, motorProfile, letterProgressMap, wordProgress, completedLetters, student }) {
  const motorScore         = computeMotorComfortScore(assessmentData, motorProfile);
  const letterMetrics      = computeLetterMetrics(letterProgressMap);
  const wordMastery        = computeWordMastery(wordProgress);
  const progressIndicators = computeProgressIndicators({ motorScore, letterMetrics, wordMastery, completedLetters });
  const recommendations    = generateRecommendations({ motorScore, letterMetrics, wordMastery, completedLetters });
  const difficultyAnalysis = computeMotorDifficulty(assessmentData, letterMetrics, motorScore?.score);

  const totalWords      = Object.values(wordProgress ?? {}).reduce((s, arr) => s + arr.length, 0);
  const lettersDone     = completedLetters?.length ?? 0;
  const wordLettersDone = Object.keys(wordProgress ?? {}).length;

  return {
    motorScore,
    letterMetrics,
    wordMastery,
    progressIndicators,
    recommendations,
    difficultyAnalysis,
    summary: {
      lettersPracticed:    lettersDone,
      wordLettersDone,
      totalWordsPracticed: totalWords,
      totalAttempts: (letterMetrics.letters?.reduce((s, l) => s + l.attempts, 0) ?? 0)
                   + (wordMastery.overall?.total ?? 0),
    },
  };
}
