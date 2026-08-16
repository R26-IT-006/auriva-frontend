import { useWindowDimensions, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';
import { SRI_LANKA_DISTRICTS } from '../../data/sriLankaDistricts';

/**
 * Step 1 implementation: scrollable grid of the 25 district names as large
 * tappable cards. Structured so the grid can be swapped for a tappable SVG
 * map (deferred to TASK-17) without changing this component's API —
 * `onSelect(districtName: string)` is the only contract callers rely on.
 */
export default function HometownPicker({ hometown, onSelect, theme }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardW = Math.min(Math.floor((screenWidth - 64 - 16) / 3), 150);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapHeader}>
        <Ionicons name="map-outline" size={28} color={theme.button} />
        <Text style={[styles.mapHeaderText, { color: theme.headingText }]}>Sri Lanka</Text>
      </View>
      <View style={styles.grid}>
        {SRI_LANKA_DISTRICTS.map(district => {
          const selected = hometown === district;
          return (
            <TouchableOpacity
              key={district}
              style={[
                styles.card,
                { width: cardW, borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                selected && { backgroundColor: theme.button, borderColor: theme.button },
              ]}
              onPress={() => onSelect(district)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardText, { color: selected ? theme.buttonText : theme.headingText }]} numberOfLines={2}>
                {district}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Layout.spacing.sm },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm },
  mapHeaderText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm, justifyContent: 'center', paddingBottom: Layout.spacing.sm },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.xs,
    minHeight: 56,
  },
  cardText: { fontSize: Layout.fontSize.xs, fontWeight: '700', textAlign: 'center' },
});
