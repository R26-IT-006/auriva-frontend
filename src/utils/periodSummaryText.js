/**
 * periodSummaryText.js
 *
 * Builds the Periodic Report's short teacher-facing summary from values the
 * report already contains. Pure and dependency-free so it is directly
 * unit-testable.
 *
 * ── Wording rules (enforced by tests) ─────────────────────────────────────
 * Every sentence states a COUNT or an AVERAGE that is present in the report.
 * The generator never:
 *   - evaluates ("good", "poor", "severe", "normal", "abnormal");
 *   - claims a direction ("improved", "declined") — the report contains no
 *     comparison against a previous period, so no such claim is supported;
 *   - infers ability or ASD severity;
 *   - compares Pattern A and Pattern B, or implies either is better;
 *   - predicts future performance.
 *
 * The backend produces its own `summary_text` for the PDF/API; this is the
 * on-screen equivalent and is deliberately kept to 2-3 short sentences.
 */

'use strict';

function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * @param {Object} report — the object GET /handwriting/report returns.
 * @returns {string} 2-3 plain sentences, or a single neutral no-activity line.
 */
export function buildPeriodSummaryText(report) {
  const motor = report?.motor_performance ?? {};
  const learning = report?.learning_progress ?? {};
  const words = report?.word_writing ?? {};

  const attempts = isNum(motor.attempts_in_period) ? motor.attempts_in_period : 0;

  if (attempts === 0) {
    return 'No handwriting practice attempts were recorded during this period.';
  }

  const sentences = [];

  sentences.push(`${plural(attempts, 'handwriting attempt was', 'handwriting attempts were')} completed during this period.`);

  // Averages are reported only when they exist — never substituted with 0,
  // which would read as a real measurement.
  const parts = [];
  if (isNum(motor.mean_motor_score)) parts.push(`average motor performance was ${motor.mean_motor_score}`);
  if (isNum(motor.mean_smoothness_score)) parts.push(`average writing smoothness was ${motor.mean_smoothness_score}`);
  if (parts.length > 0) {
    const joined = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];
    sentences.push(`${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`);
  }

  const lowercase = isNum(learning.lowercase_mastered_during_period) ? learning.lowercase_mastered_during_period : 0;
  const uppercase = isNum(learning.uppercase_mastered_during_period) ? learning.uppercase_mastered_during_period : 0;
  const mastered = lowercase + uppercase;

  const wordsCompleted = isNum(words.words_completed_during_period) ? words.words_completed_during_period : 0;

  if (mastered > 0 && wordsCompleted > 0) {
    sentences.push(
      `${plural(mastered, 'new letter was', 'new letters were')} mastered and `
      + `${plural(wordsCompleted, 'word was', 'words were')} completed during this period.`,
    );
  } else if (mastered > 0) {
    sentences.push(`${plural(mastered, 'new letter was', 'new letters were')} mastered during this period.`);
  } else if (wordsCompleted > 0) {
    sentences.push(`No new letters were mastered during this period, and ${plural(wordsCompleted, 'word was', 'words were')} completed.`);
  } else {
    sentences.push('No new letters were mastered during this period.');
  }

  return sentences.join(' ');
}

export default buildPeriodSummaryText;
