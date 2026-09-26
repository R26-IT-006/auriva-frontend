import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ROUND } from '../../constants/teacherWording';
import { DEPTH, GROUP_FACE, FALLBACK_FACE } from './GroupProgress';

const INITIAL_GROUPS = 6;

const GRID_GAP = 8;
// Three across only while each card still clears ~140pt. Below that the icon, the
// count and a two-line group name stop fitting and the row is three cramped cards
// instead of two readable ones — so a portrait phone gets two.
const THREE_COL_MIN = 140 * 3 + GRID_GAP * 2;

/**
 * The same group breakdown as `GroupProgress`, packed two to a row.
 *
 * The full-width row is the right shape on the report, where a group can be
 * opened to reveal the concepts inside it and needs the horizontal room for that
 * detail. On the profile panel nothing opens — the breakdown is a glance on the
 * way to the full report — and nine stacked rows made the module panel the
 * tallest thing on the screen for information nobody acts on there.
 *
 * Deliberately shares `DEPTH` and `GROUP_FACE` with that component rather than
 * restating them: a teacher moving between the two screens should find animals
 * the same pink and the bands meaning the same three rounds.
 */
export function GroupGrid({ categories = [], showLegend = false, initialCount = INITIAL_GROUPS, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const [gridW, setGridW] = useState(0);

  const active = categories.filter((c) => c.started > 0);
  if (active.length === 0) {
    return <Text style={styles.empty}>No group started yet.</Text>;
  }

  // Most progress first, so "where is this child furthest along" is answered by
  // position — and so the groups that survive the initial cut are the ones worth
  // seeing without expanding.
  const sorted = [...active].sort((a, b) => {
    const pa = a.total ? a.mastered / a.total : 0;
    const pb = b.total ? b.mastered / b.total : 0;
    return pb - pa || b.mastered - a.mastered;
  });

  const shown  = showAll ? sorted : sorted.slice(0, initialCount);
  const hidden = sorted.length - shown.length;

  // Measured rather than a percentage basis, for two reasons that percentages
  // cannot solve. A basis of '31%' plus a fixed 8px gap never adds to 100, so the
  // row ends short and the grid has a ragged right edge; and letting the cards
  // flexGrow to close that gap makes a lone card on the last row stretch to the
  // full width, which at three columns looks like a mistake rather than a
  // remainder. An exact width does neither.
  const cols  = gridW >= THREE_COL_MIN ? 3 : 2;
  const cardW = gridW ? Math.floor((gridW - GRID_GAP * (cols - 1)) / cols) : null;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.grid}
        onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
      >
        {shown.map((c) => (
          <GroupCard
            key={c.category_key}
            category={c}
            width={cardW}
            onPress={onSelect ? () => onSelect(c) : null}
          />
        ))}
      </View>

      {showLegend && (
        <View style={styles.legend}>
          <LegendDot color={DEPTH[0]} label={ROUND.tier1.label} />
          <LegendDot color={DEPTH[1]} label={ROUND.tier2.label} />
          <LegendDot color={DEPTH[2]} label={ROUND.tier3.label} />
        </View>
      )}

      {/* Dashed, so it reads as "the list continues" rather than as a filled
          control that does something to the cards above it. */}
      {(hidden > 0 || showAll) && (
        <TouchableOpacity
          style={styles.moreBtn}
          activeOpacity={0.7}
          onPress={() => setShowAll((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>
            {showAll ? 'Show fewer groups' : `Show ${hidden} more group${hidden === 1 ? '' : 's'}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function GroupCard({ category: c, width, onPress }) {
  const face = GROUP_FACE[c.category_key] || FALLBACK_FACE;

  // Three nested layers, widest first. They are subsets of one another — you
  // cannot know the word without finding the picture — so they overlay rather
  // than stack, which would sum past the group's size.
  const pictPct  = c.total ? (c.tier1_passed / c.total) * 100 : 0;
  const wordPct  = c.total ? (c.tier2_passed / c.total) * 100 : 0;
  const videoPct = c.total ? (c.tier3_passed / c.total) * 100 : 0;

  // Falls back to a plain View when no handler is passed, so the grid stays
  // usable as a read-only chart wherever it is dropped in without one.
  const Wrap = onPress ? TouchableOpacity : View;

  return (
    <Wrap
      // `width` is null for the one frame before onLayout reports; the flex
      // fallback in `card` covers it so nothing pops in from zero.
      style={[styles.card, width ? { width, flexGrow: 0, flexBasis: 'auto' } : null]}
      onPress={onPress || undefined}
      activeOpacity={0.75}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        `${c.label}, ${c.mastered} of ${c.total} learned` +
        (onPress ? '. Opens the things in this group' : '')
      }
    >
      <View style={styles.cardHead}>
        <View style={[styles.face, { backgroundColor: face.bg }]}>
          <Ionicons name={face.icon} size={15} color={face.fg} />
        </View>
        <Text style={styles.count}>
          <Text style={styles.countNum}>{c.mastered}</Text>
          <Text style={styles.countOf}> / {c.total}</Text>
        </Text>
      </View>

      {/* Height reserved for two lines whether or not the name needs them, so the
          bars in a row line up instead of stepping with the labels above them. */}
      <Text style={styles.label} numberOfLines={2}>{c.label}</Text>

      <View style={styles.track}>
        <View style={[styles.seg, { width: `${pictPct}%`,  backgroundColor: DEPTH[0] }]} />
        <View style={[styles.seg, styles.segOver, { width: `${wordPct}%`,  backgroundColor: DEPTH[1] }]} />
        <View style={[styles.seg, styles.segOver, { width: `${videoPct}%`, backgroundColor: DEPTH[2] }]} />
      </View>
    </Wrap>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Layout.spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  // First-frame fallback only — the measured width above replaces both of these
  // as soon as onLayout fires.
  card: {
    flexGrow: 1,
    flexBasis: '31%',
    gap: 7,
    padding: Layout.spacing.md - 4,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  face: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  count:    { fontSize: Layout.fontSize.sm },
  countNum: { fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  countOf:  { fontFamily: 'DMSans_600SemiBold',  color: Colors.text.muted },

  label: {
    height: 34,
    fontSize: Layout.fontSize.sm,
    lineHeight: 17,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
  },

  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  seg:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  segOver: { borderRightWidth: 2, borderRightColor: Colors.surface },

  moreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.sm + 2,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  moreText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.secondary,
  },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.md, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.text.secondary, fontFamily: 'DMSans_600SemiBold' },

  empty: { fontSize: 12, color: Colors.text.muted },
});
