import { Colors } from "../../../../../constants/colors";

export const HISTORY_REFRESH_INTERVAL_MS = 60 * 1000;

export function getScoreColor(score) {
  if (score >= 80) return Colors.status.success;
  if (score >= 60) return Colors.status.warning;
  return Colors.status.error;
}

export function formatDateTime(value) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeWordId(result) {
  return String(result?.word_id || result?.word_label || "").toLowerCase();
}

function normalizePhonemeText(value) {
  return String(value || "").replace(/\//g, "").trim();
}

export function getScoringEvidence(resultOrDetails) {
  return (
    resultOrDetails?.recommendation_details?.scoring_evidence ||
    resultOrDetails?.details?.scoring_evidence ||
    resultOrDetails?.scoring_evidence ||
    null
  );
}

export function buildMfccDtwPhonemeComparison({ phonemeScores = [], evidence }) {
  if (!evidence || evidence.method !== "mfcc_dtw_v1") return null;
  const boundaryAlignment = evidence.phoneme_boundary_alignment || [];

  return {
    method: evidence.method,
    dtwDistance: evidence.dtw_distance,
    mfccConfig: evidence.mfcc_config || null,
    audioQuality: evidence.audio_quality || null,
    rows: phonemeScores.map((phoneme, index) => ({
      ...(boundaryAlignment[index] || {}),
      text: phoneme?.text || `segment ${index + 1}`,
      position: phoneme?.position || null,
      cue: phoneme?.cue || null,
      studentScore:
        phoneme?.score ?? boundaryAlignment[index]?.score ?? evidence.segment_scores?.[index] ?? 0,
      segmentScore:
        boundaryAlignment[index]?.score ?? evidence.segment_scores?.[index] ?? phoneme?.score ?? 0,
      similarityScore:
        boundaryAlignment[index]?.similarity_score ?? phoneme?.similarity_score ?? null,
      timingScore:
        boundaryAlignment[index]?.timing_score ?? phoneme?.timing_score ?? null,
      referenceStart:
        boundaryAlignment[index]?.reference_start ?? phoneme?.reference_start ?? null,
      referenceEnd:
        boundaryAlignment[index]?.reference_end ?? phoneme?.reference_end ?? null,
      studentStart:
        boundaryAlignment[index]?.student_start ?? phoneme?.student_start ?? null,
      studentEnd:
        boundaryAlignment[index]?.student_end ?? phoneme?.student_end ?? null,
      durationRatio:
        boundaryAlignment[index]?.duration_ratio ?? phoneme?.duration_ratio ?? null,
    })),
  };
}

function getAverageScore(items) {
  if (!items.length) return 0;
  return Math.round(
    items.reduce((total, item) => total + Number(item.overall_score || 0), 0) /
      items.length,
  );
}

function getTrendText(results) {
  if (results.length < 2) return "Need more sessions";

  const chronological = [...results].reverse();
  const firstScore = Number(chronological[0]?.overall_score || 0);
  const latestScore = Number(
    chronological[chronological.length - 1]?.overall_score || 0,
  );
  const difference = latestScore - firstScore;

  if (difference > 0) return `+${difference}% from first`;
  if (difference < 0) return `${difference}% from first`;
  return "No score change";
}

export function buildPronunciationHistorySummary(results) {
  const phonemeMap = new Map();

  results.forEach((result) => {
    (result.phoneme_scores || []).forEach((entry) => {
      if (!entry?.text || Number(entry.score) >= 65) return;

      const current = phonemeMap.get(entry.text) || {
        text: entry.text,
        count: 0,
        totalScore: 0,
        positions: new Set(),
      };
      current.count += 1;
      current.totalScore += Number(entry.score || 0);
      if (entry.position) current.positions.add(entry.position);
      phonemeMap.set(entry.text, current);
    });
  });

  const weakPhonemes = [...phonemeMap.values()]
    .map((item) => ({
      text: item.text,
      count: item.count,
      averageScore: Math.round(item.totalScore / item.count),
      positions: [...item.positions],
    }))
    .sort((a, b) => b.count - a.count || a.averageScore - b.averageScore)
    .slice(0, 4);

  return {
    averageScore: getAverageScore(results),
    trendText: getTrendText(results),
    masteredCount: results.filter((result) => Number(result.overall_score) >= 80)
      .length,
    audioCount: results.filter((result) => result.has_raw_audio).length,
    weakPhonemes,
    latestRecommendation:
      results.find((result) => result.recommendation_message)
        ?.recommendation_message || "No recommendation saved yet.",
  };
}

export function buildSelectedSessionComparison(results, selectedResult) {
  if (!selectedResult || results.length < 2) return null;

  const chronologicalResults = [...results].reverse();
  const selectedIndex = chronologicalResults.findIndex(
    (result) => result.id === selectedResult.id,
  );
  if (selectedIndex <= 0) return null;

  const selectedWordId = normalizeWordId(selectedResult);
  const previousResult = chronologicalResults
    .slice(0, selectedIndex)
    .reverse()
    .find((result) => normalizeWordId(result) === selectedWordId);

  if (!previousResult) return null;

  const previousPhonemes = new Map(
    (previousResult.phoneme_scores || []).map((entry) => [
      normalizePhonemeText(entry?.text),
      Number(entry?.score || 0),
    ]),
  );
  const phonemeDeltas = (selectedResult.phoneme_scores || [])
    .map((entry) => {
      const text = normalizePhonemeText(entry?.text);
      if (!text || !previousPhonemes.has(text)) return null;

      return {
        text: entry.text,
        previousScore: previousPhonemes.get(text),
        currentScore: Number(entry?.score || 0),
        delta: Number(entry?.score || 0) - previousPhonemes.get(text),
      };
    })
    .filter(Boolean);

  return {
    previousResult,
    scoreDelta:
      Number(selectedResult.overall_score || 0) -
      Number(previousResult.overall_score || 0),
    phonemeDeltas,
  };
}
