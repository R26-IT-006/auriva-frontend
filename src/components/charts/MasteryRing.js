import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { scoreColor, formatPct } from '../../utils/scoreColor';

/**
 * Donut gauge for a 0-1 ratio.
 *
 * Drawn with a stroke-dasharray arc rather than a filled wedge so the track stays
 * visible behind the progress — a teacher needs to read "11 of 93", not just a
 * blob. `value == null` renders an empty grey ring and an em dash, never 0%,
 * which would otherwise read as a real (bad) score.
 */
export function MasteryRing({
  value,
  size = 96,
  strokeWidth = 10,
  label,
  sublabel,
  color,
}) {
  const radius        = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safe          = value == null ? 0 : Math.max(0, Math.min(1, value));
  const stroke        = color || scoreColor(value);

  return (
    <View style={[styles.wrap, { width: size }]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * safe} ${circumference}`}
            // Start the arc at 12 o'clock instead of 3 o'clock.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.value, { color: stroke, fontSize: size * 0.24 }]}>
            {formatPct(value)}
          </Text>
          {label ? <Text style={styles.label}>{label}</Text> : null}
        </View>
      </View>

      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  value:  { fontFamily: 'DMSans_800ExtraBold' },
  label:  {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'DMSans_600SemiBold',
    marginTop: 1,
  },
  sublabel: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: Layout.spacing.xs,
    textAlign: 'center',
  },
});
