import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { DIALOGUE_WORD_ASSETS } from '../../constants/dialogueAssets';

// Presentational pieces for the two dialogue teacher reports. Deliberately kept
// in the dialogue module rather than components/charts/: the shared chart
// components belong to the Concept module's contributor and are read-only here.
//
// Nothing in this file interprets data — callers pass already-computed numbers
// and already-plain-language sentences, so the wording stays owned by the screen.

export const REPORT_PALETTE = {
  good:    '#3FA37A',
  goodBg:  '#E8F5EF',
  neutral: '#6E8CA8',
  neutralBg: '#EDF2F7',
  warn:    '#E0714F',
  warnBg:  '#FBEDE8',
  idle:    '#9B9FB0',
  idleBg:  '#F2F3F7',
};

/**
 * A headline number. `tone` picks the card treatment: 'plain' is a white card
 * with a coloured value (the anchor stat), the rest are filled cards.
 */
export function StatTile({ icon, label, value, sub, tone = 'plain', flex = 1 }) {
  const filled = tone !== 'plain';
  const bg = {
    plain:   Colors.surface,
    good:    REPORT_PALETTE.good,
    neutral: REPORT_PALETTE.neutral,
    warn:    REPORT_PALETTE.warn,
    idle:    REPORT_PALETTE.idle,
  }[tone];
  const fg = filled ? '#FFFFFF' : Colors.text.primary;

  return (
    <View style={[styles.tile, { backgroundColor: bg, flex }]}>
      {icon ? (
        <View style={[styles.tileIcon, { backgroundColor: filled ? 'rgba(255,255,255,0.22)' : Colors.surfaceAlt }]}>
          <Ionicons name={icon} size={15} color={filled ? '#FFFFFF' : Colors.icon.active} />
        </View>
      ) : null}
      <Text style={[styles.tileLabel, { color: filled ? 'rgba(255,255,255,0.85)' : Colors.text.muted }]}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: fg }]} numberOfLines={1}>{value}</Text>
      {sub ? (
        <Text style={[styles.tileSub, { color: filled ? 'rgba(255,255,255,0.9)' : Colors.text.muted }]}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const PASS_MARK = 2 / 3; // same reference line the concept trend uses

/** Shortens an ISO date to "26 Aug" for the x-axis. */
function axisDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * Accuracy over time, with the axes and legend a teacher needs to read it
 * unaided. The y axis is pinned to 0-100% rather than auto-scaled, so a run of
 * 60-65% cannot masquerade as dramatic improvement.
 */
export function TrendChart({ points = [], width = 300, height = 170, accentLabel = 'Getting it right' }) {
  const usable = points.filter((p) => typeof p.accuracy === 'number');

  if (usable.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Ionicons name="analytics-outline" size={22} color={Colors.text.muted} />
        <Text style={styles.chartEmptyText}>Not enough activity yet to show a trend.</Text>
      </View>
    );
  }

  const GUTTER = 34;      // room for the % labels
  const padY = 10;
  const plotW = Math.max(40, width - GUTTER);
  const plotH = height - padY * 2;

  const x = (i) => (usable.length === 1 ? plotW / 2 : (i / (usable.length - 1)) * plotW);
  const y = (v) => padY + (1 - Math.max(0, Math.min(1, v))) * plotH;

  const coords = usable.map((p, i) => `${x(i)},${y(p.accuracy)}`).join(' ');
  const last = usable[usable.length - 1];
  const stroke = last.accuracy >= PASS_MARK ? REPORT_PALETTE.good : REPORT_PALETTE.warn;

  // Show at most three x labels so they never collide on a narrow tablet.
  const labelIdx = usable.length <= 3
    ? usable.map((_, i) => i)
    : [0, Math.floor((usable.length - 1) / 2), usable.length - 1];

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: GUTTER, height, justifyContent: 'space-between', paddingVertical: padY - 6 }}>
          <Text style={styles.axisLabel}>100%</Text>
          <Text style={styles.axisLabel}>50%</Text>
          <Text style={styles.axisLabel}>0%</Text>
        </View>

        <Svg width={plotW} height={height}>
          <Rect x={0} y={padY} width={plotW} height={plotH} fill={Colors.surfaceAlt} rx={6} />
          {[0, 0.5, 1].map((v) => (
            <Line
              key={v}
              x1={0} y1={y(v)} x2={plotW} y2={y(v)}
              stroke={Colors.borderLight} strokeWidth={1}
            />
          ))}
          <Line
            x1={0} y1={y(PASS_MARK)} x2={plotW} y2={y(PASS_MARK)}
            stroke="#D9A521" strokeWidth={1.5} strokeDasharray="6 5"
          />
          {usable.length > 1 && (
            <Polyline
              points={coords}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {usable.map((p, i) => (
            <Circle
              key={p.date}
              cx={x(i)} cy={y(p.accuracy)}
              r={i === usable.length - 1 ? 5 : 3.5}
              fill={i === usable.length - 1 ? stroke : Colors.surface}
              stroke={stroke} strokeWidth={2}
            />
          ))}
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', marginLeft: GUTTER, justifyContent: 'space-between', marginTop: 4 }}>
        {labelIdx.map((i) => (
          <Text key={usable[i].date} style={styles.axisLabel}>{axisDate(usable[i].date)}</Text>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: stroke }]} />
          <Text style={styles.legendText}>{accentLabel}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDash} />
          <Text style={styles.legendText}>Pass mark</Text>
        </View>
      </View>
    </View>
  );
}

/** The soft "here is what stands out" panel. */
export function InsightBox({ title = 'Activity insights', lines = [], tone = 'info' }) {
  if (lines.length === 0) return null;
  const warn = tone === 'warn';
  return (
    <View style={[styles.insight, warn ? styles.insightWarn : null]}>
      <View style={[styles.insightIcon, { backgroundColor: warn ? '#FDF3E2' : '#EEF3FF' }]}>
        <Ionicons
          name={warn ? 'information-circle-outline' : 'bulb-outline'}
          size={15}
          color={warn ? '#B4780A' : Colors.text.link}
        />
      </View>
      <View style={{ flex: 1 }}>
        {title ? <Text style={styles.insightTitle}>{title}</Text> : null}
        {lines.map((l, i) => (
          <Text key={i} style={styles.insightText}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

/** A labelled progress bar with a right-aligned fraction. */
export function ProgressRow({ icon, iconBg, label, done, total, right, color }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHead}>
        {icon ? (
          <View style={[styles.progressIcon, { backgroundColor: iconBg || Colors.surfaceAlt }]}>
            <Ionicons name={icon} size={14} color={color || Colors.icon.active} />
          </View>
        ) : null}
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressRight}>{right ?? `${done} / ${total}`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color || REPORT_PALETTE.good }]} />
      </View>
    </View>
  );
}

/** Normalises a word's display text to the asset map's key convention. */
function assetKeyFor(word) {
  return String(word ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * The word's own artwork where it exists, otherwise a tinted initial. Only
 * greetings and magic words have scene images in DIALOGUE_WORD_ASSETS, so the
 * fallback is the common case for abilities rather than an error path.
 */
export function WordAvatar({ word, size = 40, tint = Colors.icon.active, bg = Colors.surfaceAlt }) {
  const source = DIALOGUE_WORD_ASSETS[assetKeyFor(word)]?.scene;
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: 10, backgroundColor: bg }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 10, backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontFamily: 'Nunito_800ExtraBold', color: tint }}>
        {String(word ?? '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * One signal in a word's breakdown: name and its readable value on one line,
 * the bar on the next. Two lines rather than one so nothing is ever truncated —
 * the previous single-row layout squeezed the detail into ~108px and cut it off
 * mid-word, which made it useless.
 *
 * `fill` is 0-1 and drives both width and colour, so a weak signal reads as
 * weak at a glance instead of having to be inferred from a number.
 */
export function SignalBar({ label, value, fill = 0, meta, negative = false }) {
  const pct = Math.max(0, Math.min(1, fill));
  const color = negative
    ? REPORT_PALETTE.idle
    : pct >= 0.75 ? REPORT_PALETTE.good
      : pct >= 0.45 ? '#E8A33D'
        : REPORT_PALETTE.warn;

  return (
    <View style={styles.signal}>
      {/* Every cell is single-line on purpose: the meta column is narrow, and a
          value that wraps splits a word across two lines. */}
      <View style={styles.signalHead}>
        <Text style={styles.signalLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.signalValue, { color }]} numberOfLines={1}>{value}</Text>
        {meta ? <Text style={styles.signalMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <View style={styles.signalTrack}>
        <View style={[styles.signalFill, { width: `${Math.max(3, Math.round(pct * 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Small rounded status/label chip. */
export function Pill({ label, fg, bg, icon }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    minWidth: 128,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  tileIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  tileLabel: {
    fontSize: 10, fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  tileValue: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', marginTop: 2 },
  tileSub:   { fontSize: Layout.fontSize.xs, marginTop: 2 },

  axisLabel: { fontSize: 10, color: Colors.text.muted },

  chartEmpty: { alignItems: 'center', gap: 6, paddingVertical: Layout.spacing.lg },
  chartEmptyText: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },

  legend: {
    flexDirection: 'row', justifyContent: 'center',
    gap: Layout.spacing.lg, marginTop: Layout.spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 3, borderRadius: 2 },
  legendDash: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#D9A521' },
  legendText: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary },

  insight: {
    flexDirection: 'row', gap: Layout.spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Layout.radius.md,
    padding: Layout.spacing.md,
    marginTop: Layout.spacing.md,
  },
  insightWarn: { backgroundColor: '#FFFBEB' },
  insightIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary, marginBottom: 2 },
  insightText: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, lineHeight: 18 },

  progressRow: { gap: 6 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  progressIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  progressLabel: { flex: 1, fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  progressRight: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, fontFamily: 'Nunito_600SemiBold' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  signal:      { gap: 4 },
  signalHead:  { flexDirection: 'row', alignItems: 'baseline', gap: Layout.spacing.sm },
  signalLabel: { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  signalValue: { fontSize: Layout.fontSize.xs, fontFamily: 'Nunito_800ExtraBold', maxWidth: '45%' },
  signalMeta:  { fontSize: 10, color: Colors.text.muted, width: 38, textAlign: 'right' },
  signalTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  signalFill:  { height: 6, borderRadius: 3 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: Layout.radius.full,
  },
  pillText: { fontSize: 10, fontFamily: 'Nunito_700Bold' },
});
