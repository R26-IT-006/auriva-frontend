import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateAdaptiveSequence, calculateMotorProfile } from '../../utils/adaptiveSequencing';
import { storeLetterSequence, storeMotorProfile } from '../../utils/storage';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { computeMotorComfortScore } from '../../utils/reportEngine';

const SHAPE_LABELS = {
  horizontal_line: 'Horizontal Line',
  vertical_line:   'Vertical Line',
  full_circle:     'Full Circle',
  half_circle:     'Half Circle',
  zigzag:          'Zigzag Pattern',
  curve_wave:      'Wave Curve',
};

const SHAPE_ICONS = {
  horizontal_line: 'remove-outline',
  vertical_line:   'remove-outline',
  full_circle:     'ellipse-outline',
  half_circle:     'radio-button-off-outline',
  zigzag:          'pulse-outline',
  curve_wave:      'analytics-outline',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDifficulty({ accuracy, smoothness }) {
  if (accuracy < 20 && smoothness < 0.15) {
    return { label: 'Easy',           bg: '#E8F5E9', color: '#2E7D32' };
  }
  if (accuracy < 40 || smoothness < 0.3) {
    return { label: 'Moderate',       bg: '#FFF8E1', color: '#F57F17' };
  }
  return   { label: 'Needs Practice', bg: '#FFEBEE', color: '#C62828' };
}

function getAccuracyScore({ accuracy, smoothness }) {
  if (accuracy === 0) {
    return Math.min(100, Math.max(0, Math.round(100 - smoothness * 100)));
  }
  return Math.min(100, Math.max(0, Math.round(100 - accuracy)));
}

function getScoreColor(score) {
  if (score >= 75) return { color: '#2E7D32', bg: '#E8F5E9' };
  if (score >= 50) return { color: '#F57F17', bg: '#FFF8E1' };
  return { color: '#C62828', bg: '#FFEBEE' };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AssessmentCompleteScreen({ route, navigation }) {
  const { student, theme, assessmentData = [], assessmentId } = route.params;

  const scores       = assessmentData.map(s => getAccuracyScore(s.features));
  const overallScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const scoreTheme = getScoreColor(overallScore);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={[styles.checkBadge, { backgroundColor: theme.button }]}>
              <Ionicons name="checkmark" size={26} color={theme.buttonText} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.headingText }]}>
                Assessment Complete!
              </Text>
              <Text style={styles.headerSub}>Here is how {student?.full_name} did</Text>
            </View>

            {/* Overall score badge */}
            <View style={[styles.scoreBadge, { backgroundColor: scoreTheme.bg }]}>
              <Text style={[styles.scoreBadgeValue, { color: scoreTheme.color }]}>
                {overallScore}%
              </Text>
              <Text style={[styles.scoreBadgeLabel, { color: scoreTheme.color }]}>Overall</Text>
            </View>
          </View>

          {/* ── Results list — flat View, all 6 distributed evenly ── */}
          <View style={styles.resultsList}>
            {assessmentData.map((shape, i) => {
              const difficulty = getDifficulty(shape.features);
              const score      = scores[i];

              return (
                <View
                  key={`${shape.shapeId}-${i}`}
                  style={[styles.resultCard, { backgroundColor: theme.background }]}
                >
                  {/* Icon + label */}
                  <View style={[styles.shapeIconWrap, { backgroundColor: difficulty.bg }]}>
                    <Ionicons
                      name={SHAPE_ICONS[shape.shapeId] ?? 'brush-outline'}
                      size={18}
                      color={difficulty.color}
                    />
                  </View>

                  {/* Left: name + badge */}
                  <View style={styles.resultLeft}>
                    <Text style={[styles.shapeName, { color: theme.headingText }]}>
                      {SHAPE_LABELS[shape.shapeId] ?? shape.shapeId}
                    </Text>
                    <View style={[styles.diffBadge, { backgroundColor: difficulty.bg }]}>
                      <Text style={[styles.diffText, { color: difficulty.color }]}>
                        {difficulty.label}
                      </Text>
                    </View>
                  </View>

                  {/* Right: accuracy bar + strokes */}
                  <View style={styles.resultRight}>
                    <Text style={styles.metaLabel}>Accuracy</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${score}%`, backgroundColor: theme.button },
                        ]}
                      />
                    </View>
                    <Text style={styles.metaLabel}>
                      {shape.strokes.length} stroke{shape.strokes.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.summaryText}>
              {student.full_name} completed all {assessmentData.length} shape assessments.
            </Text>
            <TouchableOpacity
              style={[styles.retakeButton, { borderColor: theme.button }]}
              onPress={() => navigation.navigate('StudentWelcome', { student, theme })}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={16} color={theme.button} />
              <Text style={[styles.retakeText, { color: theme.button }]}>Back to Assessment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.button }]}
              onPress={async () => {
                const { letters, motorProfile } = generateAdaptiveSequence(
                  assessmentData, 'lowercase'
                );

                await storeLetterSequence(student.sid, letters);
                await storeMotorProfile(student.sid, motorProfile);

                if (assessmentId) {
                  const { score: motor_score } = computeMotorComfortScore(assessmentData, motorProfile);
                  if (motor_score !== null) {
                    client.patch(ENDPOINTS.HANDWRITING_FINALIZE(assessmentId), {
                      motor_score,
                      motor_profile: motorProfile,
                    }).catch(err => console.warn('Assessment finalize failed (non-fatal):', err?.message));
                  }
                }

                navigation.navigate('LetterHome', {
                  student,
                  theme,
                  assessmentData,
                  motorProfile,
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.doneText, { color: theme.buttonText }]}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.buttonText} />
            </TouchableOpacity>
          </View>

        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  card: {
    flex: 1,
    marginHorizontal: 18,
    marginVertical: 14,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  checkBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  scoreBadgeValue: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  scoreBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Results list — flat View, distributes 6 cards evenly without scrolling
  resultsList: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  resultCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shapeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Result left
  resultLeft: {
    flex: 1,
  },
  shapeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffBadge: {
    borderRadius: 50,
    paddingHorizontal: 9,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Result right
  resultRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  metaLabel: {
    fontSize: 11,
    color: '#999999',
  },
  barTrack: {
    width: 110,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
  },
  barFill: {
    height: 7,
    borderRadius: 4,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  summaryText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 11,
    borderRadius: 50,
    borderWidth: 1.5,
  },
  retakeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 50,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
  },

});