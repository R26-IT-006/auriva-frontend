// Period Summary wording.
//
// The summary is generated only from values already present in the report.
// These tests pin the counts/averages it states and, just as importantly, the
// vocabulary it must never use.

import { buildPeriodSummaryText } from './periodSummaryText';

const base = (over = {}) => ({
  motor_performance: { attempts_in_period: 35, mean_motor_score: 74.8, mean_smoothness_score: 87.8 },
  learning_progress: { lowercase_mastered_during_period: 0, uppercase_mastered_during_period: 0 },
  word_writing: { words_attempted_during_period: 0, words_completed_during_period: 0 },
  ...over,
});

describe('buildPeriodSummaryText', () => {
  it('states attempts, both averages, and the no-new-letters case', () => {
    expect(buildPeriodSummaryText(base())).toBe(
      '35 handwriting attempts were completed during this period. '
      + 'Average motor performance was 74.8 and average writing smoothness was 87.8. '
      + 'No new letters were mastered during this period.',
    );
  });

  it('reports a no-activity period without inventing averages', () => {
    const text = buildPeriodSummaryText(base({
      motor_performance: { attempts_in_period: 0, mean_motor_score: null, mean_smoothness_score: null },
    }));
    expect(text).toBe('No handwriting practice attempts were recorded during this period.');
    expect(text).not.toMatch(/\b0\b(?!.*attempts)/);
  });

  it('omits an average that is not available rather than substituting zero', () => {
    const text = buildPeriodSummaryText(base({
      motor_performance: { attempts_in_period: 4, mean_motor_score: 61, mean_smoothness_score: null },
    }));
    expect(text).toContain('Average motor performance was 61.');
    expect(text).not.toMatch(/smoothness/);
    expect(text).not.toMatch(/was 0\b/);
  });

  it('counts letters mastered across both cases', () => {
    const text = buildPeriodSummaryText(base({
      learning_progress: { lowercase_mastered_during_period: 5, uppercase_mastered_during_period: 2 },
    }));
    expect(text).toContain('7 new letters were mastered during this period.');
  });

  it('uses singular grammar for a single attempt and a single letter', () => {
    const text = buildPeriodSummaryText(base({
      motor_performance: { attempts_in_period: 1, mean_motor_score: 70, mean_smoothness_score: 80 },
      learning_progress: { lowercase_mastered_during_period: 1, uppercase_mastered_during_period: 0 },
    }));
    expect(text).toContain('1 handwriting attempt was completed');
    expect(text).toContain('1 new letter was mastered');
  });

  it('mentions completed words when there are any', () => {
    const text = buildPeriodSummaryText(base({
      word_writing: { words_attempted_during_period: 10, words_completed_during_period: 6 },
    }));
    expect(text).toContain('6 words were completed');
  });

  it('is never longer than three sentences', () => {
    for (const report of [
      base(),
      base({ learning_progress: { lowercase_mastered_during_period: 3, uppercase_mastered_during_period: 1 } }),
      base({ word_writing: { words_attempted_during_period: 9, words_completed_during_period: 4 } }),
    ]) {
      const sentences = buildPeriodSummaryText(report).split('. ').filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('summary vocabulary is neutral and non-clinical', () => {
  const BANNED = /\b(poor|good|bad|severe|severity|normal|abnormal|improved|improving|declined|declining|better|worse|progress(ing)?ed|impaired|delay(ed)?|risk|concern|diagnos\w*|autis\w*|ASD|likely|expect(ed)?|will)\b/i;

  const reports = [];
  for (const attempts of [0, 1, 35]) {
    for (const mastered of [0, 1, 7]) {
      for (const completed of [0, 6]) {
        reports.push(base({
          motor_performance: {
            attempts_in_period: attempts,
            mean_motor_score: attempts ? 74.8 : null,
            mean_smoothness_score: attempts ? 87.8 : null,
          },
          learning_progress: { lowercase_mastered_during_period: mastered, uppercase_mastered_during_period: 0 },
          word_writing: { words_attempted_during_period: completed ? 10 : 0, words_completed_during_period: completed },
        }));
      }
    }
  }

  it('never uses evaluative, directional, or clinical vocabulary', () => {
    for (const report of reports) {
      expect(buildPeriodSummaryText(report)).not.toMatch(BANNED);
    }
  });

  it('never compares writing patterns or mentions Pattern A/B at all', () => {
    for (const report of reports) {
      expect(buildPeriodSummaryText(report)).not.toMatch(/pattern/i);
    }
  });

  it('never predicts future performance', () => {
    for (const report of reports) {
      expect(buildPeriodSummaryText(report)).not.toMatch(/\b(next|future|should|predict|forecast|continue to)\b/i);
    }
  });

  it('handles a malformed/empty report without throwing', () => {
    expect(() => buildPeriodSummaryText(undefined)).not.toThrow();
    expect(() => buildPeriodSummaryText({})).not.toThrow();
    expect(buildPeriodSummaryText({})).toContain('No handwriting practice attempts');
  });
});
