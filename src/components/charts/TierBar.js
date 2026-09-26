import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { ROUND } from '../../constants/teacherWording';

// A sequential ramp — ONE hue, stepped by lightness — not three separate colours.
//
// The comment here used to say the segments "deepen rather than switching hue",
// but the values were blue / green / pale-blue: three hues pretending to be a
// progression. Two of them also failed outright as a palette — #9BC9E8 sat at
// chroma 0.065, which reads as grey rather than as a colour, and carried 1.76:1
// against white, so the segment was nearly invisible on the track.
//
// These are nested subsets (you cannot know the word without finding the picture),
// which is the textbook case for sequential: same hue, more-is-darker. Lightness
// falls 0.705 → 0.351 → 0.118, strictly monotonic, so the three read in order even
// in greyscale or print.
//
// Darkness tracks how much the round demonstrates, NOT how far along it is. The
// word round is the strongest evidence so it is darkest; the video is exposure with
// no assessment, so it stays palest despite being last.
export const TIER_COLORS = {
  tier1: '#57B183',   // finds the picture — 2.62:1
  tier2: '#1B6E45',   // knows the word — 6.24:1, the strongest evidence
  tier3: '#BFE3CE',   // watched the video — palest: exposure, not mastery
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
  // Wording comes from constants/teacherWording so the legend, the report and the
  // profile cannot drift into three different names for the same round.
  const items = [
    [ROUND.tier1.label, TIER_COLORS.tier1],
    [ROUND.tier2.label, TIER_COLORS.tier2],
    [ROUND.tier3.label, TIER_COLORS.tier3],
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
