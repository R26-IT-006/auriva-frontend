import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { TIER_COLORS } from './TierBar';

/**
 * How far through each group the child is, as bars on ONE shared scale.
 *
 * The bars previously each filled their own track, so a group with 4 of 4 and a
 * group with 4 of 21 drew the same width — the reader had to read the fraction to
 * find out they were nothing alike, which is the chart failing at its only job.
 * Every bar here is measured against the largest group, so length means the same
 * thing in every row and the groups are actually comparable.
 *
 * Sorted most-progress first, so "where is this child furthest along" and "where
 * have they barely started" are both answered by position alone.
 *
 * One hue for every bar, deliberately. The groups are nominal — fruits, animals and
 * colours have no order — and shading each bar by its own value would burn the
 * colour channel re-encoding the length the bar already shows.
 */
export function GroupProgress({ categories = [] }) {
  const active = categories.filter((c) => c.started > 0);
  if (active.length === 0) {
    return <Text style={styles.empty}>No group started yet.</Text>;
  }

  // The common denominator. Bars are drawn against the biggest group's size, not
  // against their own total, which is what makes the rows comparable.
  const widest = Math.max(...active.map((c) => c.total), 1);

  const sorted = [...active].sort((a, b) => {
    const pa = a.total ? a.mastered / a.total : 0;
    const pb = b.total ? b.mastered / b.total : 0;
    return pb - pa || b.mastered - a.mastered;
  });

  return (
    <View style={styles.wrap}>
      {sorted.map((c) => {
        const trackPct = (c.total / widest) * 100;
        // Nested, not stacked: knowing the word implies finding the picture, so
        // stacking them would sum past the group's size and overflow the track.
        const learnedPct = c.total ? (c.mastered / c.total) * 100 : 0;
        const pictPct    = c.total ? (c.tier1_passed / c.total) * 100 : 0;

        return (
          <View key={c.category_key} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{c.label}</Text>

            <View style={styles.trackArea}>
              <View style={[styles.track, { width: `${trackPct}%` }]}>
                <View style={[styles.seg, { width: `${pictPct}%`, backgroundColor: TIER_COLORS.tier1 }]} />
                {/* Drawn over the wider layer, so the darker step reads as the
                    stronger evidence sitting inside the weaker one. */}
                <View style={[styles.seg, styles.segOver, { width: `${learnedPct}%`, backgroundColor: TIER_COLORS.tier2 }]} />
              </View>
            </View>

            <Text style={styles.value}>{c.mastered}/{c.total}</Text>
          </View>
        );
      })}

      <View style={styles.legend}>
        <LegendDot color={TIER_COLORS.tier2} label="Learned" />
        <LegendDot color={TIER_COLORS.tier1} label="Finds the picture" />
        <Text style={styles.scaleNote}>Bars share one scale — longer means a bigger group</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },

  label: { width: 96, fontSize: Layout.fontSize.xs, color: Colors.text.secondary, fontFamily: 'DMSans_600SemiBold' },

  trackArea: { flex: 1 },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  seg:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7 },
  // A surface-coloured hairline so the darker layer reads as sitting on the paler
  // one rather than merging into a single ambiguous bar.
  segOver: { borderRightWidth: 2, borderRightColor: Colors.surface },

  value: { width: 44, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Layout.spacing.md, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10, color: Colors.text.secondary },
  scaleNote:  { fontSize: 10, color: Colors.text.muted, flexBasis: '100%' },

  empty: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
});
