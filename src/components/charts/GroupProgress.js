import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
// A ramp ordered by NESTING DEPTH, palest outermost.
//
// This is not TIER_COLORS, and the difference is the bug it fixes. That ramp is
// ordered by how much each round proves — the word round darkest, the video
// palest, since a video is exposure and not mastery. Drawn as nested bands that
// inverts: the layers go widest to narrowest, so the palest ends up painted last
// and on top, and a child who has watched a video for everything they have learned
// gets a bar that is one flat pale colour with the darker bands hidden underneath.
//
// Here the widest band is palest and each nested band is darker, so every layer
// stays visible and the bar reads as depth — how far into a group the child has
// actually got.
export const DEPTH = ['#BFE3CE', '#57B183', '#1B6E45'];
import { ROUND } from '../../constants/teacherWording';

// A face per group. The icon names the subject rather than the app — a paw for
// animals, a palette for colours — so a teacher finds the row they want by shape
// before reading a single label.
//
// Keyed on the category, never assigned by position. A group filtered out of the
// list would otherwise repaint every group below it, and a teacher who has learned
// "animals is the pink one" would be misled by their own screen.
export const GROUP_FACE = {
  fruits:        { icon: 'nutrition-outline',     bg: '#FAF0DF', fg: '#945D08' },
  animals:       { icon: 'paw-outline',           bg: '#FAE9F0', fg: '#A5366A' },
  household:     { icon: 'bed-outline',           bg: '#E5EEF9', fg: '#27609F' },
  classroom:     { icon: 'school-outline',        bg: '#EDE9FA', fg: '#6438BE' },
  colors:        { icon: 'color-palette-outline', bg: '#FBE7E2', fg: '#C4674F' },
  shapes:        { icon: 'shapes-outline',        bg: '#E6F4EA', fg: '#2A7146' },
  numbers:       { icon: 'calculator-outline',    bg: '#E5EEF9', fg: '#27609F' },
  house:         { icon: 'home-outline',          bg: '#FAF0DF', fg: '#945D08' },
  professionals: { icon: 'people-outline',        bg: '#EDE9FA', fg: '#6438BE' },
};

export const FALLBACK_FACE = { icon: 'albums-outline', bg: Colors.surfaceAlt, fg: Colors.text.muted };

const INITIAL_GROUPS = 3;

/**
 * How far through each group the child is.
 *
 * One row per group: the group's face, its name, the count, and a bar underneath.
 * The name and the count have the line to themselves, so neither squeezes the
 * other — with the bar inline, "Household Items" and "Fruits" drew tracks of
 * different lengths purely because their names differ in width.
 *
 * Sorted most-progress first, so "where is this child furthest along" and "where
 * have they barely started" are both answered by position alone.
 *
 * NOTE the trade this makes. Every track is full width now, so a group at 4 of 4
 * and one at 4 of 21 draw the same-length track with different fills — the bars
 * no longer compare group SIZES against each other, only progress within each.
 * The count beside each name is what carries the size, which is why it stays.
 */
export function GroupProgress({ categories = [], selectedKey, onSelect, renderDetail, showLegend = false, initialCount = INITIAL_GROUPS }) {
  const [showAll, setShowAll] = useState(false);

  const active = categories.filter((c) => c.started > 0);
  if (active.length === 0) {
    return <Text style={styles.empty}>No group started yet.</Text>;
  }

  const sorted = [...active].sort((a, b) => {
    const pa = a.total ? a.mastered / a.total : 0;
    const pb = b.total ? b.mastered / b.total : 0;
    return pb - pa || b.mastered - a.mastered;
  });

  const shown  = showAll ? sorted : sorted.slice(0, initialCount);
  const hidden = sorted.length - shown.length;

  return (
    <View style={styles.wrap}>
      {shown.map((c) => {
        const face = GROUP_FACE[c.category_key] || FALLBACK_FACE;
        const open = c.category_key === selectedKey;

        // Three nested layers, widest first. They are subsets of one another —
        // you cannot know the word without finding the picture — so they overlay
        // rather than stack, which would sum past the group's size.
        const pictPct  = c.total ? (c.tier1_passed / c.total) * 100 : 0;
        const wordPct  = c.total ? (c.tier2_passed / c.total) * 100 : 0;
        const videoPct = c.total ? (c.tier3_passed / c.total) * 100 : 0;

        return (
          <View key={c.category_key}>
            <TouchableOpacity
              activeOpacity={onSelect ? 0.7 : 1}
              disabled={!onSelect}
              onPress={() => onSelect?.(open ? null : c.category_key)}
              accessibilityRole={onSelect ? 'button' : undefined}
              accessibilityState={onSelect ? { expanded: open } : undefined}
              accessibilityLabel={`${c.label}, ${c.mastered} of ${c.total} learned`}
            >
              <View style={styles.row}>
                <View style={[styles.face, { backgroundColor: face.bg }]}>
                  <Ionicons name={face.icon} size={18} color={face.fg} />
                </View>

                <Text style={styles.label} numberOfLines={1}>{c.label}</Text>

                <Text style={styles.value}>{c.mastered} / {c.total} learned</Text>

                {onSelect ? (
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.icon.muted}
                  />
                ) : null}
              </View>

              <View style={styles.trackInset}>
              <View style={styles.track}>
                <View style={[styles.seg, { width: `${pictPct}%`,  backgroundColor: DEPTH[0] }]} />
                <View style={[styles.seg, styles.segOver, { width: `${wordPct}%`,  backgroundColor: DEPTH[1] }]} />
                <View style={[styles.seg, styles.segOver, { width: `${videoPct}%`, backgroundColor: DEPTH[2] }]} />
              </View>
              </View>
            </TouchableOpacity>

            {open && renderDetail ? (
              <View style={styles.detail}>{renderDetail(c)}</View>
            ) : null}
          </View>
        );
      })}

      {/* Only where the three layers are not already explained by a heading. The
          bar is three shades of one hue, which is unreadable without being told
          what the shades mean. */}
      {showLegend && (
        <View style={styles.legend}>
          <LegendDot color={DEPTH[0]} label={ROUND.tier1.label} />
          <LegendDot color={DEPTH[1]} label={ROUND.tier2.label} />
          <LegendDot color={DEPTH[2]} label={ROUND.tier3.label} />
        </View>
      )}

      {/* Dashed, so it reads as "the list continues" rather than as a filled
          control that does something to the rows above it. */}
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

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Layout.spacing.lg },

  row:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  face: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
  },
  value: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: '#8FA9BC',
    marginLeft: Layout.spacing.md,
  },

  // Tucked close under its row. At 8px of clearance the bar read as a divider
  // between two groups rather than as the measure belonging to the one above it.
  // Indented to sit under the name rather than under the icon. Starting at the
  // card's edge made the bar read as a divider between two categories; starting
  // where the name starts makes it the measure of the row above it.
  trackInset: { paddingLeft: 36 + Layout.spacing.sm },
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 6,
  },
  seg: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  segOver: { borderRightWidth: 2, borderRightColor: Colors.surface },

  // Indented past the face, so the concepts read as belonging to the group whose
  // row they opened rather than as a new list starting at the card's edge.
  detail: {
    marginTop: Layout.spacing.sm,
    marginLeft: 36 + Layout.spacing.sm,
    paddingLeft: Layout.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
  },

  moreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.md,
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

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.md,
    rowGap: 6,
    paddingLeft: 36 + Layout.spacing.sm,
    paddingTop: Layout.spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.text.secondary, fontFamily: 'DMSans_600SemiBold' },

  empty: { fontSize: 12, color: Colors.text.muted },
});
