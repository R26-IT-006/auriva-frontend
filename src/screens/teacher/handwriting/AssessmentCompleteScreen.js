import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateAdaptiveSequence, calculateMotorProfile } from '../../../utils/adaptiveSequencing';
import { storeLetterSequence, storeMotorProfile } from '../../../utils/storage';
import client from '../../../api/client';
import { computeMotorComfortScore } from '../../../utils/reportEngine';
import { attemptFinalization } from '../../../utils/finalizeSync';
import { DATA_COLLECTION_PROTOCOL } from '../../../constants/dataCollectionProtocol';
import { useToast } from '../../../context/ToastContext';
import { useLockLandscape } from '../../../utils/useOrientationLock';
import { resetToPostAssessmentPractice } from '../../../utils/postAssessmentNavigation';
import useGatedBack from '../../../utils/useGatedBack';

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
//
// Screen-consistency fix (Initial Motor Assessment scoring audit): both the
// per-shape difficulty badge and the "Accuracy" percentage bar below now
// derive from the SAME per-shape score — motor_score, the unified
// direction-/start-point-invariant-DTW + smoothness score
// calculateFeatures() (ShapeAssessmentScreen.js) already computes per shape
// via utils/unifiedShapeScoreMirror.js. This is the same score
// buildScoreMap() (adaptiveSequencing.js) reads for
// motor_profile.shapeScores and, via generateAdaptiveSequence() below,
// what gets persisted as this student's Feature 1 baseline — previously
// featuresToScore() served this role; that function is unchanged and still
// used by letters/words/uppercase/pre-writing, just no longer here. This
// screen no longer computes its own separate score formula (the old local
// getAccuracyScore has been removed), and the difficulty badge is now
// bucketed from that SAME score rather than raw accuracy/smoothness
// thresholds that could previously disagree with the bar shown right next
// to it.

// score === null (motor_score genuinely unavailable) renders as its own
// explicit, visually distinct "Not available" grey state — never silently
// treated as a real score. See the ?? 50 fallback removal pass: a missing
// score must never render as a plausible-looking mid-range number.
function getDifficulty(score) {
  if (score == null) return { label: 'Not available', bg: '#EEEEEE', color: '#757575' };
  if (score >= 75) return { label: 'Easy',           bg: '#E8F5E9', color: '#2E7D32' };
  if (score >= 50) return { label: 'Moderate',       bg: '#FFF8E1', color: '#F57F17' };
  return             { label: 'Needs Practice', bg: '#FFEBEE', color: '#C62828' };
}

function getScoreColor(score) {
  if (score == null) return { color: '#757575', bg: '#EEEEEE' };
  if (score >= 75) return { color: '#2E7D32', bg: '#E8F5E9' };
  if (score >= 50) return { color: '#F57F17', bg: '#FFF8E1' };
  return { color: '#C62828', bg: '#FFEBEE' };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AssessmentCompleteScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  const { requestBack, gateModal } = useGatedBack(() => navigation.navigate('StudentWelcome', { student, theme }));

  const { student, theme, assessmentData = [], assessmentId, collectionMode = false, collectionSessionId = null } = route.params;
  const { width } = useWindowDimensions();
  const { show } = useToast();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  // null (not 50) when a shape's motor_score is genuinely unavailable —
  // this screen only ever shows freshly-computed, same-session data, so in
  // practice every shape should have one, but a missing value must never
  // render as a fabricated mid-range score if it somehow doesn't.
  const scores = assessmentData.map(s => {
    const v = s.features?.motor_score;
    return v == null ? null : Math.round(v);
  });
  const realScores   = scores.filter(s => s != null);
  const overallScore = realScores.length
    ? Math.round(realScores.reduce((a, b) => a + b, 0) / realScores.length)
    : null;

  const scoreTheme = getScoreColor(overallScore);
  const bgMoveUp = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });
  const bgMoveRight = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const cardOpacity = entrance.interpolate({
    inputRange: [0, 0.45],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const cardTranslateY = entrance.interpolate({
    inputRange: [0, 0.45],
    outputRange: [18, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      bgAnim.setValue(0);
      return undefined;
    }

    const entranceAnimation = Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    });

    const bgLoop = Animated.loop(Animated.sequence([
      Animated.timing(bgAnim, {
        toValue: 1,
        duration: 5200,
        useNativeDriver: true,
      }),
      Animated.timing(bgAnim, {
        toValue: 0,
        duration: 5200,
        useNativeDriver: true,
      }),
    ]));

    entranceAnimation.start();
    bgLoop.start();

    return () => {
      entranceAnimation.stop();
      bgLoop.stop();
    };
  }, [bgAnim, entrance, reduceMotion]);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgBubbleLarge,
          {
            backgroundColor: theme.button + '10',
            width: width * 0.38,
            height: width * 0.38,
            borderRadius: width * 0.19,
            transform: [{ translateY: bgMoveUp }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bgBubbleSmall,
          {
            backgroundColor: theme.button + '0D',
            width: width * 0.22,
            height: width * 0.22,
            borderRadius: width * 0.11,
            transform: [{ translateX: bgMoveRight }],
          },
        ]}
      />
      <SafeAreaView style={styles.safe}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >

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
                {overallScore != null ? `${overallScore}%` : 'N/A'}
              </Text>
              <Text style={[styles.scoreBadgeLabel, { color: scoreTheme.color }]}>Overall</Text>
            </View>
          </View>

          {/* ── Results list — flat View, all 6 distributed evenly ── */}
          <View style={styles.resultsList}>
            {assessmentData.map((shape, i) => {
              const score      = scores[i];
              const difficulty = getDifficulty(score);

              return (
                <Animated.View
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
                    <View style={styles.accuracyHeader}>
                      <Text style={styles.metaLabel}>Accuracy</Text>
                      <Text style={[styles.accuracyValue, { color: difficulty.color }]}>
                        {score != null ? `${score}%` : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${score ?? 0}%`, backgroundColor: theme.button },
                        ]}
                      />
                    </View>
                    <Text style={styles.metaLabel}>
                      {shape.strokes.length} stroke{shape.strokes.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.summaryText}>
              {student.full_name} completed all {assessmentData.length} shape assessments.
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.button }, isSaving && styles.doneButtonDisabled]}
              onPress={async () => {
                if (isSaving) return; // double-tap protection — one logical attempt at a time

                if (collectionMode) {
                  // Research/collection-mode workflow is untouched — it never
                  // called finalize before, and still doesn't.
                  navigation.navigate('LetterWriting', {
                    student,
                    theme,
                    caseType:       'lowercase',
                    letterSequence: DATA_COLLECTION_PROTOCOL.lowercase,
                    collectionMode: true,
                    collectionSessionId,
                  });
                  return;
                }

                setIsSaving(true);

                // Unchanged: same scoring/sequencing calls, same inputs/outputs.
                const { letters, motorProfile } = generateAdaptiveSequence(
                  assessmentData, 'lowercase'
                );

                // Uppercase progression fix — generate a REAL personalized
                // uppercase sequence from the SAME assessmentData/motor-profile
                // logic used for lowercase above (adaptiveSequencing.js itself
                // is untouched — this just calls it a second time with
                // caseType='uppercase'). calculateMotorProfile() is a pure,
                // deterministic function of assessmentData alone, so this call
                // produces the byte-identical categoryOrder/motorProfile as the
                // lowercase call above — only `letters` differs (the uppercase
                // taxonomy's own letters, in that same category order). Both
                // sequences are concatenated into ONE stored array; each
                // writing screen's own `letterSequence.filter(l => l.caseType
                // === caseType)` (LetterWritingScreen.js / UppercaseWritingScreen.js)
                // already separates them back out — that filtering logic
                // pre-dates this fix and needed no change.
                const { letters: uppercaseLetters } = generateAdaptiveSequence(
                  assessmentData, 'uppercase'
                );

                await storeLetterSequence(student.sid, [...letters, ...uppercaseLetters]);
                await storeMotorProfile(student.sid, motorProfile);

                // Consolidation (shape-assessment scoring unification): this
                // used to be computeMotorComfortScore(assessmentData,
                // motorProfile)'s smoothness-only score. It now averages the
                // same unified motor_score (invariant DTW + smoothness) each
                // shape's features already carry — the SAME per-shape number
                // the "Overall %" above and buildScoreMap() use, so this is
                // no longer a fourth, independently-drifting formula. This
                // is the value that gets persisted server-side as this
                // student's Feature 1 baseline motor_score — real scores
                // only, never a fabricated 50 blended in for a shape that's
                // missing one (attemptFinalization already treats an overall
                // null motorScore as "nothing to persist", see finalizeSync.js).
                const realMotorScores = assessmentData
                  .map(item => item.features?.motor_score)
                  .filter(v => v != null);
                const motor_score = realMotorScores.length
                  ? Math.round(realMotorScores.reduce((s, v) => s + v, 0) / realMotorScores.length)
                  : null;

                // Reliability Step 2: persist a pending-finalization record
                // locally BEFORE attempting the PATCH, then actually await
                // it — replaces the old fire-and-forget
                // client.patch(...).catch(...) pattern. Never blocks
                // navigation: every branch below still proceeds to LetterHome.
                const { status } = await attemptFinalization({
                  studentId:    student.sid,
                  assessmentId, // may be null — attemptFinalization() handles that explicitly
                  motorScore:   motor_score,
                  motorProfile,
                });

                if (status === 'pending' || status === 'conflict') {
                  // Calm, child-appropriate message only — never raw
                  // networking/HTTP/database detail. Teacher/admin tooling
                  // can surface the 'conflict' distinction later.
                  show('Progress saved on this device.\nIt will sync when connection is available.', 'info');
                }

                setIsSaving(false);

                resetToPostAssessmentPractice(navigation, {
                  student,
                  theme,
                  assessmentData,
                  motorProfile,
                });
              }}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <ActivityIndicator size="small" color={theme.buttonText} />
                  <Text style={[styles.doneText, { color: theme.buttonText }]}>Saving assessment...</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.doneText, { color: theme.buttonText }]}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.buttonText} />
                </>
              )}
            </TouchableOpacity>
          </View>

        </Animated.View>

      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  bgBubbleLarge: {
    position: 'absolute',
    top: '-10%',
    right: '-9%',
  },
  bgBubbleSmall: {
    position: 'absolute',
    bottom: '7%',
    left: '-7%',
  },

  card: {
    flex: 1,
    marginHorizontal: 18,
    marginVertical: 14,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.94)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 5,
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
    fontFamily: 'Nunito_900Black',
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
    fontFamily: 'Nunito_900Black',
    lineHeight: 24,
  },
  scoreBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.5,
  },

  // Results list — flat View, distributes 6 cards evenly without scrolling
  resultsList: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  resultCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EDF7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
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
    fontFamily: 'Nunito_700Bold',
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
    fontFamily: 'Nunito_700Bold',
  },

  // Result right
  resultRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  accuracyHeader: {
    width: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accuracyValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
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
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  summaryText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 180,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 50,
  },
  doneButtonDisabled: {
    opacity: 0.75,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },

});
