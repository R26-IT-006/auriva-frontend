import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { SCORE_GOOD, scoreColor } from '../../utils/scoreColor';

const PASS_BAR = 2 / 3; // the score every tier screen passes at

/**
 * Accuracy over time. `points` is the report's `timeline`:
 *   [{ date, attempts, correct, accuracy }]
 *
 * Y axis is pinned to 0-1 rather than auto-scaled to the data range. Auto-scaling
 * would make a run of 60-65% look like dramatic improvement; pinning keeps the
 * 2/3 pass line meaningful, which is drawn as a dashed reference.
 */
export function TrendSparkline({ points = [], width = 280, height = 64 }) {
  const usable = points.filter((p) => typeof p.accuracy === 'number');

  if (usable.length === 0) {
    return <Text style={styles.empty}>Not enough activity yet to show a trend.</Text>;
  }

  // A single day has no line to draw — show it as a labelled dot instead of a
  // degenerate one-point polyline.
  const padY = 6;
  const plotH = height - padY * 2;
  const x = (i) => (usable.length === 1 ? width / 2 : (i / (usable.length - 1)) * width);
  const y = (v) => padY + (1 - Math.max(0, Math.min(1, v))) * plotH;

  const coords = usable.map((p, i) => `${x(i)},${y(p.accuracy)}`).join(' ');
  const last   = usable[usable.length - 1];
  const stroke = scoreColor(last.accuracy);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* 2/3 pass reference */}
        <Line
          x1={0} y1={y(PASS_BAR)} x2={width} y2={y(PASS_BAR)}
          stroke={Colors.border} strokeWidth={1} strokeDasharray="4 4"
        />
        {usable.length > 1 && (
          <Polyline
            points={coords}
            fill="none"
            stroke={stroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {usable.map((p, i) => (
          <Circle
            key={p.date}
            cx={x(i)}
            cy={y(p.accuracy)}
            r={i === usable.length - 1 ? 4 : 2.5}
            fill={i === usable.length - 1 ? stroke : Colors.surface}
            stroke={stroke}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      <View style={styles.footer}>
        <Text style={styles.caption}>
          {usable.length === 1 ? usable[0].date : `${usable[0].date} → ${last.date}`}
        </Text>
        <Text style={[styles.caption, { color: stroke, fontFamily: 'Nunito_700Bold' }]}>
          {Math.round(last.accuracy * 100)}% latest
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    paddingVertical: Layout.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  caption: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
});

export { SCORE_GOOD };
