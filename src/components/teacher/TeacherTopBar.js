import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../constants/backButton';

/**
 * The teacher workspace's in-page header: the round back button, the heading
 * beside it, and an optional action on the right — the same bar the Student
 * Profile, the Concept report and the Writing report draw. Screens that use it
 * hide the navigator's own header so there is only ever one.
 *
 * @param {string}   title
 * @param {string}   [subtitle]  one muted line under the title (e.g. a date)
 * @param {Function} onBack
 * @param {node}     [right]     usually a HeaderPillButton
 */
export default function TeacherTopBar({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={BACK_BUTTON}
        onPress={onBack}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={Colors.text.primary} />
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: 28,
    paddingBottom: 8,
  },
  titleWrap: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.text.secondary, marginTop: 1 },
});
