import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { rs, rf } from '../../utils/responsive';

/**
 * The shared pieces of the two dialogue reports (Level 1 Trajectory and Level 2):
 * the summary tiles, the section heading and the practice-trend card. Both
 * screens read the same `{ date, attempts, correct, accuracy }` timeline, so the
 * trend is drawn — and summarised in words — the same way on each.
 */

export const REPORT_GREEN = '#1E8A55';
export const REPORT_BLUE  = '#3F7DB8';
export const REPORT_RED   = '#D9534F';
export const REPORT_SLATE = '#8E99AD';

const LINE_GREEN = '#1E6B47';
const PASS_AMBER = '#D9A441';
const PASS_MARK  = 2 / 3; // the score every tier screen passes at

function parts(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** "2026-08-05" → "Aug 5, 2026", read as a local date so it never shifts a day. */
export function prettyDate(iso) {
  const date = parts(iso);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (iso || '');
}

function shortDate(iso) {
  const date = parts(iso);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (iso || '');
}

/** "a", "a and b", "a, b and 2 more" — for the insight lines. */
export function shortList(items) {
  if (items.length > 3) return `${items.slice(0, 3).join(', ')} and ${items.length - 3} more`;
  if (items.length === 3) return `${items[0]}, ${items[1]} and ${items[2]}`;
  return items.join(' and ');
}

/** One sentence over the whole practice trend, from the same points the chart draws. */
export function trendSentence(points, firstName, unit = 'try') {
  if (points.length === 0) return null;
  const tries = points.reduce((n, p) => n + (p.attempts || 0), 0);
  const triesText = tries ? `, across ${tries} ${tries === 1 ? unit : `${unit === 'try' ? 'tries' : `${unit}s`}`}` : '';
  const last = points[points.length - 1];
  const lastPct = Math.round(last.accuracy * 100);
  if (points.length === 1) {
    return `${firstName} has one day of practice so far — ${lastPct}%${triesText}.`;
  }
  const delta = lastPct - Math.round(points[0].accuracy * 100);
  if (Math.abs(delta) < 5) {
    return `${firstName} is holding steady — ${lastPct}% on the latest day${triesText}.`;
  }
  return delta > 0
    ? `${firstName} is trending up — ${lastPct}% on the latest day, ${delta} points above the first${triesText}.`
    : `${firstName} is trending down — ${lastPct}% on the latest day, ${-delta} points below the first${triesText}.`;
}

/**
 * A section heading over its content. With `icon` it takes the Concept report's
 * heading: a tinted circle holding the filled icon beside a heavier title.
 * `iconTint` is { bg, fg }.
 */
export function ReportSection({ title, subtitle, right, children, icon, iconTint, inside = false }) {
  // `inside` puts the heading in the white card with its content, as the
  // Concept report's paired cards do; the content then sits bare in that card.
  const Wrap = inside ? View : React.Fragment;
  const wrapProps = inside ? { style: styles.card } : {};
  return (
    <View style={styles.section}>
      <Wrap {...wrapProps}>
      <View style={[styles.sectionHead, icon && styles.sectionHeadIcon, inside && styles.sectionHeadInside]}>
        {icon ? (
          <View style={[styles.sectionIcon, { backgroundColor: iconTint?.bg ?? '#E4F4EC' }]}>
            <Ionicons name={icon.replace(/-outline$/, '')} size={20} color={iconTint?.fg ?? Colors.brandDeep} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, icon && styles.sectionTitleIcon]}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
      </Wrap>
    </View>
  );
}

/**
 * One of the four summary tiles. Solid tiles carry a status colour.
 *
 * With `accent` instead, it is the Concept report's summary card: white, a
 * border in the accent's tint, a solid accent icon circle, the label in the
 * accent, a large value with a small grey denominator (`of`), and an optional
 * `progress` bar (0-1).
 */
export function SummaryTile({ icon, label, value, sub, color, accent, of, progress = null, compact = false }) {
  if (accent) {
    // `compact`: four to a row, so the label goes under the icon rather than
    // beside it, where a quarter of the width cannot hold both.
    return (
      <View style={[styles.tile, styles.cardTile, compact && styles.cardTileCompact, { borderColor: accent + '33' }]}>
        <View style={[styles.cardTop, compact && styles.cardTopCompact]}>
          <View style={[styles.cardBadge, compact && styles.cardBadgeCompact, { backgroundColor: accent }]}>
            <Ionicons name={icon} size={compact ? 18 : 22} color="#FFFFFF" />
          </View>
          <Text style={[styles.cardLabel, { color: accent }]} numberOfLines={compact ? 2 : 1}>{label}</Text>
        </View>
        <View style={styles.cardValueRow}>
          <Text style={[styles.cardValue, compact && styles.cardValueCompact]}>{value}</Text>
          {of != null ? <Text style={styles.cardOf}>/ {of}</Text> : null}
        </View>
        {progress != null ? (
          <View style={[styles.cardBarTrack, { backgroundColor: accent + '33' }]}>
            <View
              style={[
                styles.cardBarFill,
                { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: accent },
              ]}
            />
          </View>
        ) : null}
        {sub ? <Text style={[styles.cardSub, { color: accent }]}>{sub}</Text> : null}
      </View>
    );
  }
  const solid = !!color;
  return (
    <View style={[styles.tile, solid ? { backgroundColor: color } : styles.tilePlain]}>
      <View style={[styles.tileIcon, solid && styles.tileIconSolid]}>
        <Ionicons name={icon} size={15} color={solid ? '#FFFFFF' : Colors.text.muted} />
      </View>
      <Text style={[styles.tileLabel, solid && styles.onSolid]}>{label}</Text>
      <Text style={[styles.tileValue, solid && styles.onSolid]}>{value}</Text>
      {sub ? <Text style={[styles.tileSub, solid && styles.onSolidSoft]}>{sub}</Text> : null}
    </View>
  );
}

export function SummaryTiles({ children, oneRow = false }) {
  return <View style={[styles.tiles, oneRow && styles.tilesOneRow]}>{children}</View>;
}

/** Accuracy per day, pinned 0-100% so the pass mark keeps its meaning. */
function TrendChart({ points, width }) {
  const height = 190;
  const left = 34;
  const top = 10;
  const bottom = 24;
  const plotW = Math.max(40, width - left - 8);
  const plotH = height - top - bottom;
  const x = (i) => left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => top + (1 - Math.max(0, Math.min(1, v))) * plotH;
  const coords = points.map((p, i) => `${x(i)},${y(p.accuracy)}`).join(' ');
  const mid = Math.floor((points.length - 1) / 2);
  const ticks = [0, mid, points.length - 1].filter((i, k, arr) => arr.indexOf(i) === k);

  return (
    <View>
      <Svg width={width} height={height}>
        {[1, 0.5, 0].map((v) => (
          <Line key={v} x1={left} y1={y(v)} x2={left + plotW} y2={y(v)} stroke="#EEF1F4" strokeWidth={1} />
        ))}
        {[1, 0.5, 0].map((v) => (
          <SvgText key={`l${v}`} x={0} y={y(v) + 4} fontSize={10} fill={Colors.text.muted}>
            {`${Math.round(v * 100)}%`}
          </SvgText>
        ))}
        <Line
          x1={left} y1={y(PASS_MARK)} x2={left + plotW} y2={y(PASS_MARK)}
          stroke={PASS_AMBER} strokeWidth={1.2} strokeDasharray="5 4"
        />
        {points.length > 1 ? (
          <Polyline points={coords} fill="none" stroke={LINE_GREEN} strokeWidth={2} strokeLinejoin="round" />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={p.date}
            cx={x(i)}
            cy={y(p.accuracy)}
            r={i === points.length - 1 ? 4.5 : 3.5}
            fill={i === points.length - 1 ? LINE_GREEN : '#FFFFFF'}
            stroke={LINE_GREEN}
            strokeWidth={1.5}
          />
        ))}
        {ticks.map((i) => (
          <SvgText
            key={`d${i}`}
            x={x(i)}
            y={height - 6}
            fontSize={10}
            fill={Colors.text.muted}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          >
            {shortDate(points[i].date)}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: LINE_GREEN }]} />
          <Text style={styles.legendText}>Getting it right</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDash}>
            <View style={[styles.legendDashBit, { backgroundColor: PASS_AMBER }]} />
            <View style={[styles.legendDashBit, { backgroundColor: PASS_AMBER }]} />
          </View>
          <Text style={styles.legendText}>Pass mark</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The "Practice trend" section: date range, one-line summary, chart, and an
 * insights box. `insights` is a list of finished sentences from the screen.
 */
export function PracticeTrendCard({ points, firstName, subtitle, insights = [], unit, icon, iconTint, inside = false }) {
  const [width, setWidth] = useState(0);
  const usable = (points || []).filter((p) => typeof p.accuracy === 'number');
  const best = usable.reduce((b, p) => (!b || p.accuracy > b.accuracy ? p : b), null);
  const lines = [
    ...insights,
    ...(best ? [`Best day so far was ${prettyDate(best.date)} at ${Math.round(best.accuracy * 100)}%.`] : []),
  ];
  const sentence = trendSentence(usable, firstName, unit);

  return (
    <ReportSection
      title="Practice trend"
      subtitle={subtitle}
      icon={icon}
      iconTint={iconTint}
      inside={inside}
      right={usable.length > 0 ? (
        <Text style={styles.sectionRight}>
          {usable.length === 1
            ? prettyDate(usable[0].date)
            : `${prettyDate(usable[0].date)} — ${prettyDate(usable[usable.length - 1].date)}`}
        </Text>
      ) : null}
    >
      <View style={inside ? null : styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width - (inside ? 0 : 32))}>
        {usable.length === 0 ? (
          <Text style={styles.empty}>Not enough activity yet to show a trend.</Text>
        ) : (
          <>
            {sentence ? <Text style={styles.trendSentence}>{sentence}</Text> : null}
            {width > 0 ? <TrendChart points={usable} width={width} /> : null}
            {lines.length > 0 ? (
              <View style={styles.insights}>
                <Ionicons name="bulb-outline" size={16} color={REPORT_BLUE} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.insightsTitle}>Activity insights</Text>
                  {lines.map((l) => <Text key={l} style={styles.insightsText}>{l}</Text>)}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ReportSection>
  );
}

export const reportCardStyle = {
  backgroundColor: Colors.surface,
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: Colors.borderLight,
};

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12) },
  tilesOneRow: { flexWrap: 'nowrap', gap: rs(10) },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: rs(132),
    padding: rs(16),
    borderRadius: rs(18),
    gap: rs(4),
  },
  tilePlain: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight },
  tileIcon: {
    width: rs(28), height: rs(28), borderRadius: rs(8),
    alignItems: 'center', justifyContent: 'center',
    marginBottom: rs(6),
  },
  tileIconSolid: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tileLabel: {
    fontSize: rf(12), fontFamily: 'DMSans_700Bold', color: Colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  tileValue: { fontSize: rf(30), fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  tileSub:   { fontSize: rf(12), color: Colors.text.muted },
  onSolid:     { color: '#FFFFFF' },

  // The Concept report's summary card (accent variant).
  cardTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: rs(22),
    borderWidth: 1.5,
    paddingTop: rs(20),
    gap: 0,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: rs(10), marginBottom: rs(14) },
  // Four to a row.
  cardTileCompact:  { flexBasis: 0, minWidth: 0, minHeight: 0, padding: rs(14), paddingTop: rs(16) },
  cardTopCompact:   { flexDirection: 'column', alignItems: 'flex-start', gap: rs(8), marginBottom: rs(8) },
  cardBadgeCompact: { width: rs(36), height: rs(36), borderRadius: rs(18) },
  cardValueCompact: { fontSize: rf(28) },
  cardBadge:    { width: rs(44), height: rs(44), borderRadius: rs(22), alignItems: 'center', justifyContent: 'center' },
  cardLabel:    {
    flexShrink: 1, fontSize: rf(12), fontFamily: 'DMSans_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  cardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: rs(6) },
  cardValue:    { fontSize: rf(32), fontFamily: 'DMSans_600SemiBold', letterSpacing: -1, color: Colors.text.primary },
  cardOf:       { fontSize: rf(13), fontFamily: 'DMSans_600SemiBold', color: Colors.text.muted },
  cardBarTrack: { height: rs(8), borderRadius: rs(4), overflow: 'hidden', marginTop: rs(10) },
  cardBarFill:  { height: '100%', borderRadius: rs(4) },
  cardSub:      { fontSize: rf(12), fontFamily: 'DMSans_600SemiBold', marginTop: rs(8) },
  onSolidSoft: { color: 'rgba(255,255,255,0.85)' },

  section:      { marginTop: rs(26) },
  sectionHead:  { flexDirection: 'row', alignItems: 'flex-end', marginBottom: rs(10), gap: rs(8) },
  sectionTitle: { fontSize: rf(18), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  // Concept-report heading (with an icon).
  sectionHeadIcon:  { alignItems: 'center' },
  sectionHeadInside: { marginBottom: rs(14) },
  sectionIcon:      { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center' },
  sectionTitleIcon: { fontFamily: 'DMSans_900Black', letterSpacing: -0.4 },
  sectionSub:   { fontSize: rf(12), color: Colors.text.muted, marginTop: 2 },
  sectionRight: { fontSize: rf(12), color: Colors.text.secondary },

  card: reportCardStyle,
  empty: { fontSize: rf(13), color: Colors.text.muted, paddingVertical: rs(8) },

  trendSentence: {
    fontSize: rf(14), lineHeight: rf(20), fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.primary, marginBottom: rs(10),
  },
  legend:        { flexDirection: 'row', justifyContent: 'center', gap: rs(22), marginTop: rs(4) },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  legendLine:    { width: rs(16), height: rs(2.5), borderRadius: 2 },
  legendDash:    { flexDirection: 'row', gap: rs(3) },
  legendDashBit: { width: rs(5), height: 2, borderRadius: 1 },
  legendText:    { fontSize: rf(12), color: Colors.text.secondary },

  insights: {
    flexDirection: 'row', gap: rs(10),
    marginTop: rs(14), padding: rs(12),
    borderRadius: rs(12),
    backgroundColor: '#F4F7FB',
  },
  insightsTitle: { fontSize: rf(14), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  insightsText:  { fontSize: rf(12), lineHeight: rf(17), color: Colors.text.secondary },
});
