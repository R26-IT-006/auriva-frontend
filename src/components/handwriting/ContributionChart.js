/**
 * ContributionChart
 *
 * Horizontal bar chart that shows how much each handwriting feature
 * contributed to a detected motor difficulty.
 *
 * Props:
 *   contributions : [{ feature, pct, severity, hint }]
 *   accentColor   : string (hex) — matches the difficulty theme colour
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rs, rf } from '../../utils/responsive';

// Severity → bar colour (calm ASD-friendly palette, no flashing)
const SEVERITY_COLORS = {
  high:   '#EF5350',
  medium: '#FF9800',
  low:    '#66BB6A',
};

function ContributionBar({ item, accentColor, index }) {
  const [showHint, setShowHint] = useState(false);

  // Staggered entrance via width animation
  const widthAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: item.pct,
      duration: 600,
      delay: index * 120,
      useNativeDriver: false,
    }).start();
  }, [item.pct, index]);

  const barColor = SEVERITY_COLORS[item.severity] ?? accentColor ?? '#7B1FA2';

  return (
    <View style={styles.barRow}>
      {/* Feature name */}
      <View style={styles.labelWrap}>
        <Text style={styles.featureLabel} numberOfLines={1}>{item.feature}</Text>
        {item.hint ? (
          <TouchableOpacity
            onPress={() => setShowHint(h => !h)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="information-circle-outline"
              size={13}
              color="#9E9E9E"
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bar track */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      {/* Percentage */}
      <Text style={[styles.pctText, { color: barColor }]}>{item.pct}%</Text>

      {/* Severity dot */}
      <View style={[styles.severityDot, { backgroundColor: barColor }]} />

      {/* Hint text (toggleable) */}
      {showHint && item.hint ? (
        <View style={styles.hintBubble}>
          <Text style={styles.hintText}>{item.hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ContributionChart({ contributions, accentColor }) {
  if (!contributions || contributions.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No significant contributing factors detected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(SEVERITY_COLORS).map(([sev, col]) => (
          <View key={sev} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: col }]} />
            <Text style={styles.legendLabel}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</Text>
          </View>
        ))}
      </View>

      {contributions.map((item, i) => (
        <ContributionBar
          key={item.feature}
          item={item}
          accentColor={accentColor}
          index={i}
        />
      ))}

      <Text style={styles.footNote}>
        Percentages show each factor's share of the detected difficulty.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: rs(10),
  },

  legend: {
    flexDirection: 'row',
    gap: rs(14),
    marginBottom: rs(4),
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  legendDot:  { width: rs(8), height: rs(8), borderRadius: rs(4) },
  legendLabel:{ fontSize: rf(10), color: '#888', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },

  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    flexWrap: 'wrap',
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: rs(130),
  },
  featureLabel: {
    fontSize: rf(12),
    color: '#333',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    flexShrink: 1,
  },
  track: {
    flex: 1,
    height: rs(10),
    borderRadius: rs(5),
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
    minWidth: rs(60),
  },
  fill: {
    height: rs(10),
    borderRadius: rs(5),
  },
  pctText: {
    fontSize: rf(12),
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    minWidth: rs(34),
    textAlign: 'right',
  },
  severityDot: {
    width: rs(7),
    height: rs(7),
    borderRadius: rs(4),
  },

  hintBubble: {
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderRadius: rs(8),
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
    borderLeftWidth: 3,
    borderLeftColor: '#BDBDBD',
    marginTop: 2,
  },
  hintText: {
    fontSize: rf(11),
    color: '#666',
    lineHeight: rf(16),
  },

  empty: { paddingVertical: rs(8) },
  emptyText: { fontSize: rf(12), color: '#BDBDBD', textAlign: 'center' },

  footNote: {
    fontSize: rf(10),
    color: '#BDBDBD',
    textAlign: 'center',
    marginTop: rs(4),
  },
});