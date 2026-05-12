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
