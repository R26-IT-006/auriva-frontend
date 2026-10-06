import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rs, rf } from '../../utils/responsive';

/**
 * HeaderPillButton.js
 *
 * The one text button used in module headers (beside the title), so every
 * module's header buttons share a size, shape and type:
 *   40pt tall pill · 14pt side padding · 17pt icon · 13pt DM Sans Bold.
 *
 * Variants — colour only, never size:
 *   primary   filled theme.button            (Progress, Word Progress, Activities)
 *   outline   white, theme.button outline    (How it works)
 *   soft      theme.button tint              (grown-up / gated actions: Assessment, Progress Report)
 *   subtle    translucent white, no outline  (in-activity: Skip)
 *
 * `as` lets a module keep its own touchable (e.g. Pronunciation's
 * ButtonFeedback, which adds the click sound) while sharing the look.
 */
export default function HeaderPillButton({
  label,
  icon,
  onPress,
  theme,
  variant = 'primary',
  disabled = false,
  style,
  accessibilityLabel,
  as: Touchable = TouchableOpacity,
  ...rest
}) {
  const { bg, border, fg } = colours(variant, theme);
  return (
    <Touchable
      style={[styles.pill, { backgroundColor: bg, borderColor: border }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...rest}
    >
      {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Touchable>
  );
}

function colours(variant, theme) {
  const accent = theme?.button ?? '#4A90D9';
  switch (variant) {
    case 'outline': return { bg: '#FFFFFF', border: accent, fg: accent };
    case 'soft':    return { bg: accent + '20', border: accent + '70', fg: accent };
    case 'subtle':  return { bg: 'rgba(255,255,255,0.7)', border: 'transparent', fg: theme?.headingText ?? '#1A1A2E' };
    case 'primary':
    default:        return { bg: accent, border: accent, fg: theme?.buttonText ?? '#FFFFFF' };
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6),
    minHeight: rs(40),
    paddingHorizontal: rs(14),
    paddingVertical: rs(8),
    borderRadius: rs(20),
    borderWidth: 1.5,
  },
  label: {
    fontSize: rf(13),
    fontFamily: 'DMSans_700Bold',
  },
  disabled: { opacity: 0.45 },
});
