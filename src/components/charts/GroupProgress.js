import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { TIER_COLORS } from './TierBar';

// A face per group. The icon names the subject rather than the app — a paw for
// animals, a palette for colours — so a teacher finds the row they want by shape
// before reading a single label.
//
// Keyed on the category, never assigned by position. A group filtered out of the
// list would otherwise repaint every group below it, and a teacher who has learned
// "animals is the pink one" would be misled by their own screen.
const GROUP_FACE = {
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

const FALLBACK_FACE = { icon: 'albums-outline', bg: Colors.surfaceAlt, fg: Colors.text.muted };

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
export function GroupProgress({ categories = [], selectedKey, onSelect, renderDetail }) {
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

  const shown  = showAll ? sorted : sorted.slice(0, INITIAL_GROUPS);
  const hidden = sorted.length - shown.length;

  return (
    <View style={styles.wrap}>
      {shown.map((c) => {
        const face = GROUP_FACE[c.category_key] || FALLBACK_FACE;
        const open = c.category_key === selectedKey;

        // Nested, not stacked: knowing the word implies finding the picture, so
        // stacking them would sum past the group's size and overflow the track.
        const learnedPct = c.total ? (c.mastered / c.total) * 100 : 0;
        const pictPct    = c.total ? (c.tier1_passed / c.total) * 100 : 0;

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

              <View style={styles.track}>
                <View style={[styles.seg, { width: `${pictPct}%`, backgroundColor: TIER_COLORS.tier1 }]} />
                {/* Drawn over the wider layer, so the darker step reads as the
                    stronger evidence sitting inside the weaker one. */}
                <View style={[styles.seg, styles.segOver, { width: `${learnedPct}%`, backgroundColor: TIER_COLORS.tier2 }]} />
              </View>
            </TouchableOpacity>

            {open && renderDetail ? (
              <View style={styles.detail}>{renderDetail(c)}</View>
            ) : null}
          </View>
        );
      })}

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

const styles = StyleSheet.create({
  wrap: { gap: Layout.spacing.lg },

  row:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  face: {
    width: 40, height: 40, borderRadius: 20,
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
  },

  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: Layout.spacing.sm,
  },
  seg: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  segOver: { borderRightWidth: 2, borderRightColor: Colors.surface },

  // Indented past the face, so the concepts read as belonging to the group whose
  // row they opened rather than as a new list starting at the card's edge.
  detail: {
    marginTop: Layout.spacing.sm,
    marginLeft: 52,
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

  empty: { fontSize: 12, color: Colors.text.muted },
});
