// Shared score thresholds. Extracted from DashboardScreen so the teacher dashboard
// and the concept analytics screens can never drift apart on what counts as good.
// The 0.45 band sits just below the 2/3 pass bar used by every tier screen, so an
// amber bar means "attempted but not passing" rather than "nearly there".
export const SCORE_GOOD = 0.75;
export const SCORE_FAIR = 0.45;

export const SCORE_COLORS = {
  good:    '#52C07C',
  fair:    '#F0A940',
  poor:    '#E05C48',
  unknown: '#C8CDD8',
};

export function scoreColor(score) {
  if (score == null) return SCORE_COLORS.unknown;
  if (score >= SCORE_GOOD) return SCORE_COLORS.good;
  if (score >= SCORE_FAIR) return SCORE_COLORS.fair;
  return SCORE_COLORS.poor;
}

/** Renders a 0-1 ratio as a percentage, or an em dash when there is no data. */
export function formatPct(value) {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

/** Compact duration for engagement figures: 4.2s / 3m 12s / 1h 04m. */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${String(sec).padStart(2, '0')}s`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}
