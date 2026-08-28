import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const PASS_BAR = 2 / 3;

// ONE hue, not a palette. This is a single series, so its job is magnitude over
// time rather than identity — there is nothing to tell apart, and a second colour
// would imply a second thing. Green is the app's "getting it right" colour, and
// #2A7146 carries 5.92:1 on white so the line survives on a printed report.
const LINE = '#2A7146';
const FILL = 'rgba(42, 113, 70, 0.13)';

/**
 * How much the child is getting right, over time.
 *
 * Replaces a 64px sparkline that had no axis, no scale and no labels — a shape
 * with nothing to read it against. A teacher could see the line wobble and could
 * not tell whether it was wobbling above or below the point where a round is
 * passed, which is the only question the chart is there to answer.
 *
 * Y is pinned to 0–100%, never auto-scaled to the data. Auto-scaling would stretch
 * a flat run of 60–65% into a dramatic climb, and would move the pass line around
 * between one child's report and the next.
 *
 * `points` is the report's `timeline`: [{ date, attempts, correct, accuracy }].
 */
export function AccuracyChart({ points = [], width = 300, height = 150 }) {
  const usable = points.filter((p) => typeof p.accuracy === 'number');

  if (usable.length === 0) {
    return <Text style={styles.empty}>Not enough activity yet to show a trend.</Text>;
  }

  // Room for the y labels on the left and the dates underneath.
  const padL = 34;
  const padR = 8;
  const padT = 10;
  const padB = 20;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = Math.max(10, height - padT - padB);

  const x = (i) => (usable.length === 1
    ? padL + plotW / 2
    : padL + (i / (usable.length - 1)) * plotW);
  const y = (v) => padT + (1 - Math.max(0, Math.min(1, v))) * plotH;

  const line = usable.map((p, i) => `${x(i)},${y(p.accuracy)}`).join(' ');

  // Area under the line, closed along the baseline. The fill is what makes a
  // single series read as a quantity rather than as a squiggle.
  const area = usable.length > 1
    ? `M ${x(0)},${y(usable[0].accuracy)} `
      + usable.slice(1).map((p, i) => `L ${x(i + 1)},${y(p.accuracy)}`).join(' ')
      + ` L ${x(usable.length - 1)},${padT + plotH} L ${x(0)},${padT + plotH} Z`
    : null;

  const passY = y(PASS_BAR);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Gridlines stay recessive — they are a ruler, not data. */}
        {[0, 0.5, 1].map((v) => (
          <Line
            key={v}
            x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)}
            stroke={Colors.borderLight} strokeWidth={1}
          />
        ))}

        {/* The pass mark, labelled. An unlabelled dashed line asks the reader to
            already know what it means; this one says so. */}
        <Line
          x1={padL} y1={passY} x2={padL + plotW} y2={passY}
          stroke="#C9A227" strokeWidth={1.5} strokeDasharray="5 4"
        />
        <SvgText
          x={padL + plotW} y={passY - 4}
          fontSize="9" fill="#8A6D06" textAnchor="end"
          fontFamily="DMSans_600SemiBold"
        >
          pass mark
        </SvgText>

        {area && <Path d={area} fill={FILL} />}

        {usable.length > 1 && (
          <Polyline
            points={line}
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Markers only when there are few enough to stay separate — a dot on every
            point of a 30-day run is noise, not information. */}
        {usable.length <= 12 && usable.map((p, i) => (
          <Circle
            key={p.date}
            cx={x(i)} cy={y(p.accuracy)} r={4}
            fill={LINE}
            stroke={Colors.surface}
            strokeWidth={2}
          />
        ))}

        {/* A lone day has no line to draw, so it is a labelled dot instead of a
            degenerate one-point polyline. */}
        {usable.length === 1 && (
          <Circle cx={x(0)} cy={y(usable[0].accuracy)} r={5} fill={LINE} />
        )}

        {[1, 0.5, 0].map((v) => (
          <SvgText
            key={v}
            x={padL - 6} y={y(v) + 3}
            fontSize="9" fill={Colors.text.muted} textAnchor="end"
          >
            {`${Math.round(v * 100)}%`}
          </SvgText>
        ))}

        {/* Only the ends are labelled: every date would collide, and the span is
            what places the shape in time. */}
        <SvgText x={padL} y={height - 6} fontSize="9" fill={Colors.text.muted}>
          {shortDate(usable[0].date)}
        </SvgText>
        {usable.length > 1 && (
          <SvgText
            x={padL + plotW} y={height - 6}
            fontSize="9" fill={Colors.text.muted} textAnchor="end"
          >
            {shortDate(usable[usable.length - 1].date)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

/** Parsed as local parts — `new Date('2026-08-12')` is UTC midnight and lands on
 *  the previous day for anyone east of Greenwich. */
function shortDate(iso) {
  const [yy, mm, dd] = (iso || '').split('-').map(Number);
  if (!yy || !mm || !dd) return '';
  return new Date(yy, mm - 1, dd)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  empty: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    padding: Layout.spacing.md,
  },
});
