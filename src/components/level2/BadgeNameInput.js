import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';

/**
 * Decorated identity chip — displays an already-entered name inside the
 * rosette badge frame. Reusable anywhere a child's name badge should appear
 * (e.g. the questionnaire Review step, other Level 2 screens).
 */
export function NameBadge({ name, theme }) {
  return (
    <View style={styles.badgeWrap}>
      <View style={[styles.ribbonTab, styles.ribbonTabLeft, { backgroundColor: theme.button }]} />
      <View style={[styles.ribbonTab, styles.ribbonTabRight, { backgroundColor: theme.button }]} />
      <View style={[styles.badgeFrame, { backgroundColor: theme.cardSurface, borderColor: theme.button }]}>
        <Ionicons name="ribbon" size={22} color={theme.button} />
        <Text style={[styles.badgeName, { color: theme.headingText }]} numberOfLines={1}>
          {name || '…'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Badge-making name entry — the same rosette frame as NameBadge, but with a
 * live TextInput in place of static text. Teacher types the child's name
 * while the badge decorates around it.
 */
export default function BadgeNameInput({ name, onChangeName, theme }) {
  return (
    <View style={styles.badgeWrap}>
      <View style={[styles.ribbonTab, styles.ribbonTabLeft, { backgroundColor: theme.button }]} />
      <View style={[styles.ribbonTab, styles.ribbonTabRight, { backgroundColor: theme.button }]} />
      <View style={[styles.badgeFrame, { backgroundColor: theme.cardSurface, borderColor: theme.button }]}>
        <Ionicons name="ribbon" size={26} color={theme.button} />
        <TextInput
          style={[styles.badgeInput, { color: theme.headingText }]}
          value={name}
          onChangeText={onChangeName}
          placeholder="Type name here"
          placeholderTextColor="#AAA"
          autoCapitalize="words"
          maxLength={30}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingBottom: 14 },
  ribbonTab: { position: 'absolute', bottom: 0, width: 22, height: 34, borderRadius: 4 },
  ribbonTabLeft: { left: '32%', transform: [{ rotate: '-8deg' }] },
  ribbonTabRight: { right: '32%', transform: [{ rotate: '8deg' }] },
  badgeFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderWidth: 2.5,
    borderRadius: Layout.radius.full,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    minWidth: 220,
    justifyContent: 'center',
    ...Layout.shadow.md,
  },
  badgeName: { fontSize: Layout.fontSize.xl, fontWeight: '800' },
  badgeInput: { fontSize: Layout.fontSize.xl, fontWeight: '800', minWidth: 140, textAlign: 'center', paddingVertical: 0 },
});
