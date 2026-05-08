import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { generateAdaptiveSequence, calculateMotorProfile } from '../../utils/adaptiveSequencing';
import { storeLetterSequence, storeMotorProfile } from '../../utils/storage';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { computeMotorComfortScore } from '../../utils/reportEngine';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

const SHAPE_LABELS = {
  horizontal_line: 'Horizontal Line',
  vertical_line:   'Vertical Line',
  full_circle:     'Full Circle',
  half_circle:     'Half Circle',
  zigzag:          'Zigzag Pattern',
  curve_wave:      'Wave Curve',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    // zigzag / curve_wave — derive score from smoothness (lower = better)
    return Math.min(100, Math.max(0, Math.round(100 - smoothness * 100)));
  }
  return Math.min(100, Math.max(0, Math.round(100 - accuracy)));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AssessmentCompleteScreen({ route, navigation }) {
  const { student, theme, assessmentData = [], assessmentId } = route.params;

  const scores       = assessmentData.map(s => getAccuracyScore(s.features));
  const overallScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

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
              <Text style={[styles.checkMark, { color: theme.buttonText }]}>✓</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.headingText }]}>
                Assessment Complete!
              </Text>
              <Text style={styles.headerSub}>Here's how it went</Text>
            </View>
          </View>

          {/* ── Results list ── */}
          <ScrollView
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsContent}
          >
            {assessmentData.map((shape, i) => {
              const difficulty = getDifficulty(shape.features);
              const score      = scores[i];
              const barWidth   = `${score}%`;

              return (
                <View
                  key={shape.shapeId}
                  style={[styles.resultCard, { backgroundColor: theme.background }]}
                >
                  {/* Left */}
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

                  {/* Right */}
                  <View style={styles.resultRight}>
                    <Text style={styles.metaLabel}>Accuracy</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: barWidth, backgroundColor: theme.button },
                        ]}
                      />
                    </View>
                    <Text style={[styles.metaLabel, { marginTop: 6 }]}>
                      {shape.strokes.length} stroke{shape.strokes.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.summaryText}>
              {student.full_name} completed all {assessmentData.length} assessments.
              {'  '}Overall score: {overallScore}%
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.button }]}
              onPress={async () => {
                // ── Core novelty: build motor-informed adaptive sequence ──────
                const { letters, motorProfile } = generateAdaptiveSequence(
                  assessmentData, 'lowercase'
                );

                // Persist both for LetterHomeScreen and future sessions
                await storeLetterSequence(student.sid, letters);
                await storeMotorProfile(student.sid, motorProfile);

                // Persist motor profile + run analysis on the server (fire-and-forget)
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
            </TouchableOpacity>
          </View>

        </View>

        {/* Avatar */}
        <Image
          source={AVATAR_MAP[student?.avatar_key]}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  card: {
    flex: 1,
    marginHorizontal: 24,
    marginVertical: 32,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 32,
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
    marginBottom: 24,
  },
  checkBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 28,
    fontWeight: '900',
  },
  headerText: {
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
  },

  // Results list
  resultsList: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 8,
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Result left
  resultLeft: {
    flex: 1,
  },
  shapeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  diffBadge: {
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Result right
  resultRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#999999',
  },
  barTrack: {
    width: 120,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 50,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Avatar
  avatarImage: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    width: 100,
    height: 130,
  },
});
