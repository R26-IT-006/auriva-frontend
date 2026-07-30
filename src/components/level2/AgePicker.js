import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Layout } from '../../constants/layout';

const AGES = [5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Horizontal row of large tappable age characters (5–12). Tapping selects
 * the age and echoes it via the caller's playInstruction indirection using
 * ids `l2_age_5` … `l2_age_12`.
 */
export default function AgePicker({ age, onSelect, theme, playInstruction }) {
  function handlePress(value) {
    onSelect(value);
    playInstruction?.(`l2_age_${value}`);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {AGES.map(value => {
        const selected = age === value;
        return (
          <TouchableOpacity
            key={value}
            style={[
              styles.card,
              { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
              selected && { backgroundColor: theme.button, borderColor: theme.button },
            ]}
            onPress={() => handlePress(value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.num, { color: selected ? theme.buttonText : theme.headingText }]}>{value}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Layout.spacing.md, paddingHorizontal: Layout.spacing.sm, paddingVertical: Layout.spacing.sm },
  card: { width: 64, height: 64, borderRadius: Layout.radius.full, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', ...Layout.shadow.sm },
  num: { fontSize: Layout.fontSize.xxxl, fontWeight: '800' },
});
