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
    gap: 10,
  },

  legend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: 10, color: '#888', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },

  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 130,
  },
  featureLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    flexShrink: 1,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
    minWidth: 60,
  },
  fill: {
    height: 10,
    borderRadius: 5,
  },
  pctText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    minWidth: 34,
    textAlign: 'right',
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  hintBubble: {
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#BDBDBD',
    marginTop: 2,
  },
  hintText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },

  empty: { paddingVertical: 8 },
  emptyText: { fontSize: 12, color: '#BDBDBD', textAlign: 'center' },

  footNote: {
    fontSize: 10,
    color: '#BDBDBD',
    textAlign: 'center',
    marginTop: 4,
  },
});