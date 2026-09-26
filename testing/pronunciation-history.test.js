import {
  buildGopPhonemeComparison,
  buildMfccDtwPhonemeComparison,
  buildPronunciationHistorySummary,
  buildSelectedSessionComparison,
  getScoringEvidence,
  getScoringMethodLabel,
  getVerificationSummary,
} from '../src/screens/teacher/students/modules/pronunciationSupport/pronunciationHistory';

describe('pronunciation history audit helpers', () => {
  test('finds scoring evidence in current and legacy response shapes', () => {
    const evidence = { method: 'mfcc_dtw_v2' };
    expect(getScoringEvidence({ recommendation_details: { scoring_evidence: evidence } })).toBe(evidence);
    expect(getScoringEvidence({ details: { scoring_evidence: evidence } })).toBe(evidence);
    expect(getScoringEvidence({ scoring_evidence: evidence })).toBe(evidence);
    expect(getScoringEvidence({})).toBeNull();
  });

  test('labels known methods and preserves future unknown method names', () => {
    expect(getScoringMethodLabel('mfcc_dtw_v2')).toBe('Acoustic pattern match');
    expect(getScoringMethodLabel('future_engine_v3')).toBe('future_engine_v3');
    expect(getScoringMethodLabel()).toBe('Unknown method');
  });

  test('builds verification summary from promoted columns', () => {
    expect(getVerificationSummary({
      recognized_text: 'cat', scoring_method: 'mfcc_dtw_v2', confidence_level: 'high',
      needs_teacher_review: true, speech_verification: { status: 'verified' },
    })).toEqual({
      recognizedText: 'cat', verificationStatus: 'verified', scoringMethod: 'mfcc_dtw_v2',
      scoringMethodLabel: 'Acoustic pattern match', confidenceLevel: 'high', needsReview: true,
    });
    expect(getVerificationSummary({})).toBeNull();
  });

  test('GOP comparison flags only low-scoring, genuinely different realizations', () => {
    const result = buildGopPhonemeComparison({
      phonemeScores: [{ text: 'g', score: 60 }, { text: 't', score: 90 }],
      evidence: { method: 'wav2vec2_gop_v1', gop_assessment: {
        overall_gop_score: 72, decoded_phonemes: ['k', 'd'],
        per_sound: [{ sound: 'g', realized: 'k', score: 60 }, { sound: 't', realized: 'd', score: 90 }],
      } },
    });
    expect(result.rows[0].mismatchedRealization).toBe(true);
    expect(result.rows[1].mismatchedRealization).toBe(false);
    expect(buildGopPhonemeComparison({ evidence: {} })).toBeNull();
  });

  test('ASCII g and IPA ɡ are treated as equivalent realizations', () => {
    const result = buildGopPhonemeComparison({
      phonemeScores: [{ text: '/g/', score: 40 }],
      evidence: { method: 'gop', gop_assessment: { per_sound: [{ realized: 'ɡ', score: 40 }] } },
    });
    expect(result.rows[0].mismatchedRealization).toBe(false);
  });

  test('MFCC comparison merges boundary evidence with phoneme metadata', () => {
    const result = buildMfccDtwPhonemeComparison({
      phonemeScores: [{ text: 'k', position: 'initial', score: 66 }],
      evidence: { method: 'mfcc_dtw_v2', dtw_distance: 0.25,
        phoneme_boundary_alignment: [{ score: 70, similarity_score: 80, student_start: 0.1 }],
      },
    });
    expect(result.dtwDistance).toBe(0.25);
    expect(result.rows[0]).toEqual(expect.objectContaining({
      text: 'k', position: 'initial', studentScore: 66, segmentScore: 70,
      similarityScore: 80, studentStart: 0.1,
    }));
    expect(buildMfccDtwPhonemeComparison({ evidence: { method: 'gop' } })).toBeNull();
  });

  test('history summary calculates averages, mastery, audio, trend, weaknesses, and recommendation', () => {
    const results = [
      { id: 2, overall_score: 90, has_raw_audio: true, recommendation_message: 'Move ahead',
        phoneme_scores: [{ text: 'k', score: 60, position: 'initial' }] },
      { id: 1, overall_score: 70, has_raw_audio: false,
        phoneme_scores: [{ text: 'k', score: 50, position: 'initial' }, { text: 't', score: 64 }] },
    ];
    expect(buildPronunciationHistorySummary(results)).toEqual({
      averageScore: 80,
      trendText: '+20% from first',
      masteredCount: 1,
      audioCount: 1,
      weakPhonemes: [
        { text: 'k', count: 2, averageScore: 55, positions: ['initial'] },
        { text: 't', count: 1, averageScore: 64, positions: [] },
      ],
      latestRecommendation: 'Move ahead',
    });
  });

  test('history summary handles an empty corpus', () => {
    expect(buildPronunciationHistorySummary([])).toEqual(expect.objectContaining({
      averageScore: 0, trendText: 'Need more sessions', masteredCount: 0, weakPhonemes: [],
    }));
  });

  test('selected-session comparison uses the prior attempt for the same word', () => {
    const previous = { id: 1, word_id: 'Cat', overall_score: 60, phoneme_scores: [{ text: 'g', score: 40 }] };
    const unrelated = { id: 2, word_id: 'dog', overall_score: 50, phoneme_scores: [] };
    const selected = { id: 3, word_id: 'cat', overall_score: 82, phoneme_scores: [{ text: 'ɡ', score: 75 }] };
    const comparison = buildSelectedSessionComparison([selected, unrelated, previous], selected);
    expect(comparison.previousResult).toBe(previous);
    expect(comparison.scoreDelta).toBe(22);
    expect(comparison.phonemeDeltas).toEqual([{ text: 'ɡ', previousScore: 40, currentScore: 75, delta: 35 }]);
  });

  test('selected-session comparison returns null without enough matching history', () => {
    const selected = { id: 1, word_id: 'cat' };
    expect(buildSelectedSessionComparison([selected], selected)).toBeNull();
    expect(buildSelectedSessionComparison([{ id: 2, word_id: 'dog' }, selected], selected)).toBeNull();
    expect(buildSelectedSessionComparison([], null)).toBeNull();
  });
});
