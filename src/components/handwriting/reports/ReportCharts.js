/**
 * ReportCharts.js
 *
 * Small, deliberately plain SVG charts for the teacher-facing Periodic Report.
 *
 * Built on react-native-svg, which this project already depends on and already
 * hand-builds charts with (components/charts/TrendSparkline.js, MasteryRing.js,
 * TierBar.js) — no charting library is introduced.
 *
 * Design constraints, all deliberate:
 *   - one line / one bar series, no dual axes;
 *   - straight segments between real points — NO smoothing or interpolation,
 *     which would invent values between sessions;
 *   - no gradients, no 3D, no animation;
 *   - the motor-score Y axis is pinned to 0-100 rather than auto-scaled to the
 *     data range, so a run of 70-75 cannot be made to look like a dramatic
 *     climb by rescaling;
 *   - days with no practice are ABSENT from the data rather than plotted as
 *     zero, so an empty day never reads as a score of 0.
 *
 * Both charts render an explicit empty state instead of a degenerate plot.
 */

'use strict';

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

const AXIS = '#CBD5E1';
const GRID = '#E8EBF3';
const TEXT_2 = '#475569';
const TEXT_3 = '#94A3B8';

const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** A short 'MM-DD' tick from a 'YYYY-MM-DD' date, for a compact axis. */
function shortDate(dateStr) {
  return typeof dateStr === 'string' && dateStr.length >= 10 ? dateStr.slice(5) : String(dateStr ?? '');
}

/**
 * Picks at most `max` evenly-spaced indices so tablet axes stay readable
 * without dropping the first or last point.
 */
function tickIndices(count, max = 5) {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

function EmptyState({ message }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

/**
 * Motor Performance Over Time — one line, real points only.
 *
 * @param {Array<{date: string, mean_motor_score: number|null}>} points
 *   The report's `motor_performance.daily_series`. Points with no usable
 *   score are dropped rather than zero-filled.
 */
export function MotorTrendChart({ points = [], width = 320, height = 160, color = '#6366F1' }) {
  const usable = points.filter((p) => typeof p?.mean_motor_score === 'number' && Number.isFinite(p.mean_motor_score));

  // A single point cannot show a trend — say so rather than drawing a lone dot
  // that a reader could mistake for a flat line.
  if (usable.length < 2) {
    return <EmptyState message="Not enough session data to show a trend yet." />;
  }

  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  const x = (i) => padL + (i / (usable.length - 1)) * plotW;
  const y = (v) => padT + (1 - (Math.max(SCORE_MIN, Math.min(SCORE_MAX, v)) - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * plotH;

  const coords = usable.map((p, i) => `${x(i)},${y(p.mean_motor_score)}`).join(' ');
  const ticks = tickIndices(usable.length);

  return (
    <View accessible accessibilityLabel={`Motor performance over time, ${usable.length} days plotted, scale 0 to 100`}>
      <Svg width={width} height={height}>
        {[0, 50, 100].map((value) => (
          <React.Fragment key={value}>
            <Line x1={padL} y1={y(value)} x2={padL + plotW} y2={y(value)} stroke={GRID} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(value) + 3.5} fill={TEXT_3} fontSize={9} textAnchor="end">
              {value}
            </SvgText>
          </React.Fragment>
        ))}

        <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={AXIS} strokeWidth={1} />

        <Polyline
          points={coords}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {usable.map((p, i) => (
          <Circle key={p.date} cx={x(i)} cy={y(p.mean_motor_score)} r={3} fill="#FFFFFF" stroke={color} strokeWidth={2} />
        ))}

        {ticks.map((i) => (
          <SvgText key={usable[i].date} x={x(i)} y={height - 8} fill={TEXT_3} fontSize={9} textAnchor="middle">
            {shortDate(usable[i].date)}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.axisNote}>Motor performance score (0–100) per practice day</Text>
    </View>
  );
}

/**
 * Practice Activity — attempts per day.
 *
 * @param {Array<{date: string, attempts: number}>} points
 *   The report's `motor_performance.daily_series`.
 */
export function PracticeActivityChart({ points = [], width = 320, height = 130, color = '#0891B2' }) {
  const usable = points.filter((p) => typeof p?.attempts === 'number' && p.attempts > 0);

  if (usable.length === 0) {
    return <EmptyState message="No practice attempts were recorded in this period." />;
  }

  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  const maxAttempts = Math.max(...usable.map((p) => p.attempts));
  const slot = plotW / usable.length;
  // Cap the bar width so a two-day period does not render two huge slabs.
  const barW = Math.max(4, Math.min(28, slot * 0.6));

  const barX = (i) => padL + i * slot + (slot - barW) / 2;
  const barH = (v) => Math.max(1, (v / maxAttempts) * plotH);
  const ticks = tickIndices(usable.length);

  return (
    <View accessible accessibilityLabel={`Practice activity, ${usable.length} days, highest ${maxAttempts} attempts in a day`}>
      <Svg width={width} height={height}>
        <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={AXIS} strokeWidth={1} />
        <Line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={AXIS} strokeWidth={1} />

        <SvgText x={padL - 6} y={padT + 4} fill={TEXT_3} fontSize={9} textAnchor="end">{maxAttempts}</SvgText>
        <SvgText x={padL - 6} y={padT + plotH + 3} fill={TEXT_3} fontSize={9} textAnchor="end">0</SvgText>

        {usable.map((p, i) => (
          <Rect
            key={p.date}
            x={barX(i)}
            y={padT + plotH - barH(p.attempts)}
            width={barW}
            height={barH(p.attempts)}
            rx={2}
            fill={color}
          />
        ))}

        {ticks.map((i) => (
          <SvgText key={usable[i].date} x={barX(i) + barW / 2} y={height - 8} fill={TEXT_3} fontSize={9} textAnchor="middle">
            {shortDate(usable[i].date)}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.axisNote}>Practice attempts per day</Text>
    </View>
  );
}

/**
 * A labelled horizontal progress bar — "Lowercase Letters   16 / 26".
 *
 * Purely a count against a known total. It carries no evaluative colouring:
 * the same accent is used at every level, so a low bar is never rendered as a
 * warning.
 */
export function ProgressBarRow({ label, value, total, color = '#6366F1' }) {
  const safeTotal = typeof total === 'number' && total > 0 ? total : null;
  const safeValue = typeof value === 'number' && value >= 0 ? value : 0;
  const ratio = safeTotal ? Math.max(0, Math.min(1, safeValue / safeTotal)) : 0;
  const pct = safeTotal ? Math.round(ratio * 100) : null;

  return (
    <View
      style={styles.progressRow}
      accessible
      accessibilityLabel={safeTotal ? `${label}: ${safeValue} of ${safeTotal} mastered` : `${label}: ${safeValue} mastered`}
    >
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {safeValue}{safeTotal ? ` / ${safeTotal}` : ''}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      {pct != null && <Text style={styles.progressPct}>{pct}%</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 10,
  },
  emptyText: { fontSize: 12.5, color: TEXT_3, textAlign: 'center', lineHeight: 18 },
  axisNote: { fontSize: 10, color: TEXT_3, marginTop: 4, textAlign: 'center' },

  progressRow: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  progressLabel: { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#0F172A' },
  progressValue: { fontSize: 13, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold', color: TEXT_2 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: '#EDF0F7', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressPct: { fontSize: 10.5, color: TEXT_3, marginTop: 3, textAlign: 'right' },
});
