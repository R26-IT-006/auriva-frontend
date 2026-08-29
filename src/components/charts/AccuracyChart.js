import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const PASS_BAR = 2 / 3;

// One muted sage for the series, one amber for the reference line. A single
// series needs no palette — there is nothing to tell apart — and the reference
// is deliberately a different KIND of mark (dashed, thinner) as well as a
// different hue, so it reads as a rule rather than as a second measurement.
const LINE = '#8FA99B';
const FILL = 'rgba(143, 169, 155, 0.10)';
const RULE = '#D9B441';

/**
 * How much the child is getting right, over time.
 *
 * Y stays pinned to 0–100%. The chart's job is "are they above or below the mark
 * they need", so the mark has to sit at a fixed height — auto-scaling would move
 * it between one child's report and the next, and would stretch a flat run of
 * 60–65% into a dramatic climb.
 *
 * `points` is the report's `timeline`: [{ date, attempts, correct, accuracy }].
 */
export function AccuracyChart({ points = [], width = 300, height = 190 }) {
  const usable = points.filter((p) => typeof p.accuracy === 'number');

  if (usable.length === 0) {
    return <Text style={styles.empty}>Not enough activity yet to show a trend.</Text>;
  }

  const padL = 30;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const legendH = 30;

  const plotW = Math.max(10, width - padL - padR);
  const plotH = Math.max(10, height - padT - padB - legendH);

  // Data is inset from the frame so the end markers are not clipped by it, and so
  // the line does not run into the edge as though it continued past.
  const inset = usable.length > 1 ? 14 : 0;
  const spanW = Math.max(1, plotW - inset * 2);

  const x = (i) => (usable.length === 1
    ? padL + plotW / 2
    : padL + inset + (i / (usable.length - 1)) * spanW);
  const y = (v) => padT + (1 - Math.max(0, Math.min(1, v))) * plotH;

  const pts = usable.map((p, i) => ({ x: x(i), y: y(p.accuracy) }));
  const curve = smoothPath(pts);
  const area = pts.length > 1
    ? `${curve} L ${pts[pts.length - 1].x},${padT + plotH} L ${pts[0].x},${padT + plotH} Z`
    : null;

  const passY = y(PASS_BAR);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View>
      <Svg width={width} height={height}>
        {/* A faint plate under the plot. It bounds the chart without a border, so
            the gridlines can stay almost invisible and still be readable. */}
        <Rect
          x={padL} y={padT} width={plotW} height={plotH}
          fill="#FAFBFA"
        />

        {ticks.map((v) => (
          <Line
            key={`h${v}`}
            x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)}
            stroke={Colors.borderLight} strokeWidth={1}
          />
        ))}

        {/* One vertical rule per reading, so a point can be traced down to its own
            date instead of estimated against the two labels at the ends. Dropped
            past a dozen readings, where they close into a grey wash. */}
        {usable.length > 1 && usable.length <= 12 && usable.map((p, i) => (
          <Line
            key={`v${p.date}`}
            x1={x(i)} y1={padT} x2={x(i)} y2={padT + plotH}
            stroke={Colors.borderLight} strokeWidth={1}
          />
        ))}

        {area && <Path d={area} fill={FILL} />}

        <Line
          x1={padL} y1={passY} x2={padL + plotW} y2={passY}
          stroke={RULE} strokeWidth={2} strokeDasharray="7 6" strokeLinecap="round"
        />

        {pts.length > 1 && (
          <Path
            d={curve}
            fill="none"
            stroke={LINE}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {(pts.length <= 12 || pts.length === 1) && pts.map((p, i) => (
          <Circle
            key={usable[i].date}
            cx={p.x} cy={p.y} r={5}
            fill={LINE}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        ))}

        {ticks.filter((v) => v === 0 || v === 0.5 || v === 1).map((v) => (
          <SvgText
            key={`l${v}`}
            x={padL - 8} y={y(v) + 3.5}
            fontSize="10" fill={Colors.text.muted} textAnchor="end"
          >
            {`${Math.round(v * 100)}%`}
          </SvgText>
        ))}

        {/* Every date when there are few enough to fit, otherwise just the ends —
            a label per point across a month overlaps into an unreadable band. */}
        {(usable.length <= 6 ? usable : [usable[0], usable[usable.length - 1]]).map((p) => {
          const i = usable.indexOf(p);
          const anchor = i === 0 ? 'start' : i === usable.length - 1 ? 'end' : 'middle';
          return (
            <SvgText
              key={`d${p.date}`}
              x={x(i)} y={padT + plotH + 17}
              fontSize="10" fill={Colors.text.muted}
              textAnchor={usable.length <= 6 ? anchor : anchor}
            >
              {shortDate(p.date)}
            </SvgText>
          );
        })}
      </Svg>

      {/* Below the plot and centred. Two marks, so identity is never colour alone:
          the series is a solid line with a dot, the reference a dashed segment. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Svg width={26} height={10}>
            <Line x1={0} y1={5} x2={26} y2={5} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
            <Circle cx={13} cy={5} r={4} fill={LINE} />
          </Svg>
          <Text style={styles.legendText}>Getting it right</Text>
        </View>

        <View style={styles.legendItem}>
          <Svg width={26} height={10}>
            <Line
              x1={0} y1={5} x2={26} y2={5}
              stroke={RULE} strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.legendText}>Pass mark</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A smooth path through the points, as cubic segments with Catmull-Rom tangents.
 *
 * Straight segments made every reading a corner, which reads as the value having
 * jumped on that exact day — it did not, these are daily averages and what is
 * between them is unmeasured. A curve is the honest shape for that, provided it
 * does not overshoot: the tangents here are scaled by 1/6, which keeps the curve
 * inside the range of its neighbours rather than bulging past a peak.
 */
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Layout.spacing.lg,
    marginTop: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendText: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary },

  empty: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    padding: Layout.spacing.md,
  },
});
