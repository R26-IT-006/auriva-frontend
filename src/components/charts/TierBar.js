import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

// Tier 1 → 3 reads as a progression, so the segments deepen rather than switching
// hue. Tier 3 is exposure (a video with no assessment), which is why it is the
// palest of the three despite being furthest along.
export const TIER_COLORS = {
  tier1: '#5B7EE0',
  tier2: '#52C07C',
  tier3: '#9BC9E8',
};

/**
 * Nested horizontal bar for one category's tier progress.
 *
 * The three tiers are subsets of each other (you cannot pass tier 2 without
 * tier 1), so they are drawn as overlapping layers widest-first rather than as a
 * stack — stacking would sum to more than the total and overflow the track.
 */
export function TierBar({ total, tier1 = 0, tier2 = 0, tier3 = 0, label, right, height = 10 }) {
  const pct = (n) => (total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0);

  return (
    <View style={styles.row}>
      {label ? (
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      ) : null}

      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        {/* Widest first so narrower tiers paint on top. */}
        <View style={[styles.fill, { width: `${pct(tier1)}%`, backgroundColor: TIER_COLORS.tier1 }]} />
        <View style={[styles.fill, { width: `${pct(tier2)}%`, backgroundColor: TIER_COLORS.tier2 }]} />
        <View style={[styles.fill, { width: `${pct(tier3)}%`, backgroundColor: TIER_COLORS.tier3, opacity: 0.9 }]} />
      </View>

      {right ? <Text style={styles.right}>{right}</Text> : null}
    </View>
  );
}

/** Colour key. Rendered once per screen, not per bar. */
export function TierLegend() {
  const items = [
    ['Identify', TIER_COLORS.tier1],
    ['Name',     TIER_COLORS.tier2],
    ['Watched',  TIER_COLORS.tier3],
  ];
  return (
    <View style={styles.legend}>
      {items.map(([text, color]) => (
        <View key={text} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.legendText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  label: {
    width: 104,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    fontFamily: 'DMSans_600SemiBold',
  },
  track: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  right: {
    minWidth: 44,
    textAlign: 'right',
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'DMSans_600SemiBold',
  },

  legend:     { flexDirection: 'row', gap: Layout.spacing.md, marginTop: Layout.spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
});
