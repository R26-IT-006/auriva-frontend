import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

/** apple_pie / passion-fruit → Apple Pie / Passion Fruit */
export function formatConceptLabel(key) {
  if (!key) return '';
  return key
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Ranked "mistook X for Y" rows.
 *
 * Deliberately not a confusion matrix: with 93 concepts a matrix is 8,649 cells,
 * unreadable on a tablet and mostly empty. A teacher needs the handful of pairs
 * worth re-teaching, so this shows the top pairs ordered by frequency with a bar
 * proportional to the most frequent one.
 */
export function ConfusionList({ items = [], max = 6 }) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="checkmark-circle-outline" size={18} color={Colors.status.success} />
        <Text style={styles.empty}>No repeated mix-ups recorded.</Text>
      </View>
    );
  }

  const shown = items.slice(0, max);
  const peak  = Math.max(...shown.map((i) => i.count), 1);

  return (
    <View style={styles.list}>
      {shown.map((item, idx) => (
        <View key={`${item.correct_key}-${item.selected_key}-${item.tier}-${idx}`} style={styles.row}>
          <View style={styles.pairLine}>
            <Text style={styles.correct} numberOfLines={1}>
              {formatConceptLabel(item.correct_key)}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={Colors.text.muted} style={styles.arrow} />
            <Text style={styles.selected} numberOfLines={1}>
              {formatConceptLabel(item.selected_key)}
            </Text>
            <View style={styles.tierChip}>
              <Text style={styles.tierChipText}>T{item.tier}</Text>
            </View>
            <Text style={styles.count}>{item.count}×</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(item.count / peak) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Layout.spacing.md },
  row:  { gap: 5 },

  pairLine: { flexDirection: 'row', alignItems: 'center' },
  correct: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    maxWidth: '34%',
  },
  arrow:   { marginHorizontal: 5 },
  selected: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.status.error,
    maxWidth: '34%',
  },
  tierChip: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  tierChipText: { fontSize: 10, color: Colors.text.muted, fontFamily: 'DMSans_700Bold' },
  count: {
    marginLeft: 'auto',
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    fontFamily: 'DMSans_700Bold',
  },

  track: { height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3, backgroundColor: Colors.status.error, opacity: 0.75 },

  emptyWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Layout.spacing.sm },
  empty:     { fontSize: Layout.fontSize.sm, color: Colors.text.secondary },
});
