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
import Svg, { Circle, Line, Path } from 'react-native-svg';
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
//
// Presentation matches LetterHomeScreen's Assessment Summary modal: the same
// labels, colours, overall ring and 2-column shape tiles, so the summary
// shown right after the assessment looks like the one reopened later.
function getScoreBadge(score) {
  if (score == null) return { label: 'Not available', bg: '#EEEEEE', color: '#757575' };
  if (score >= 75) return { label: 'Good',           bg: '#E8F5E9', color: '#2E7D32' };
  if (score >= 50) return { label: 'Moderate',       bg: '#FFFDE7', color: '#F57F17' };
  return                   { label: 'Needs practice', bg: '#FFF3E0', color: '#E65100' };
}

// Same line drawings as the Assessment Summary modal.
function AssessmentShapeIcon({ shapeId, color }) {
  const common = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' };
  let mark;
  switch (shapeId) {
    case 'horizontal_line': mark = <Line x1="4" y1="12" x2="20" y2="12" {...common} />; break;
    case 'vertical_line':   mark = <Line x1="12" y1="4" x2="12" y2="20" {...common} />; break;
    case 'full_circle':     mark = <Circle cx="12" cy="12" r="8" {...common} />; break;
    case 'half_circle':     mark = <Path d="M4 16 A8 8 0 0 1 20 16" {...common} />; break;
    case 'zigzag':          mark = <Path d="M3 17 L7.5 7 L12 17 L16.5 7 L21 17" {...common} />; break;
    case 'curve_wave':      mark = <Path d="M3 13 C6 6 9 6 12 13 C15 20 18 20 21 13" {...common} />; break;
    default:
      return <Ionicons name={SHAPE_ICONS[shapeId] ?? 'brush-outline'} size={18} color={color} />;
  }
  return <Svg width={24} height={24} viewBox="0 0 24 24">{mark}</Svg>;
}

// The modal's overall-score ring, coloured by the result band.
function OverallScoreRing({ score, textColor, size = 104, strokeWidth = 10 }) {
  const badge = getScoreBadge(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  return (
    <View style={styles.overallCard}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={badge.bg} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={badge.color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped / 100)}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <Text style={[styles.ringPercentText, { color: textColor }]}>
          {score != null ? `${score}%` : 'N/A'}
        </Text>
      </View>
      <Text style={styles.overallLabel}>Overall Assessment Score</Text>
      <View style={[styles.overallBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.overallBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    </View>
  );
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
            { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >

          {/* ── Header — same icon circle + title as the Assessment Summary ── */}
          <View style={styles.header}>
            <View style={[styles.titleIcon, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="clipboard" size={18} color="#FFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.headingText }]}>
                Assessment Complete!
              </Text>
              <Text style={styles.headerSub}>Here is how {student?.full_name} did</Text>
            </View>
          </View>

          {/* ── Body: overall ring on top, shape tiles in 2 columns ── */}
          <View style={styles.body}>
            {assessmentData.length > 0 && (
              <View style={styles.summaryTopRow}>
                <OverallScoreRing score={overallScore} textColor={theme.headingText} />
              </View>
            )}

            <View style={styles.shapeList}>
              {assessmentData.map((shape, i) => {
                const score      = scores[i];
                const badge      = getScoreBadge(score);

                return (
                  <View key={`${shape.shapeId}-${i}`} style={styles.shapeRow}>
                    <View style={styles.shapeTileTop}>
                      <View style={[styles.shapeIconWrap, { backgroundColor: badge.bg }]}>
                        <AssessmentShapeIcon shapeId={shape.shapeId} color={badge.color} />
                      </View>
                      <Text style={styles.shapeName} numberOfLines={1}>
                        {SHAPE_LABELS[shape.shapeId] ?? shape.shapeId}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.shapeMetricColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${score ?? 0}%`, backgroundColor: badge.color },
                          ]}
                        />
                      </View>
                      <Text style={styles.shapeScoreText}>
                        {score != null ? `${score}%` : 'N/A'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
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

  // Same frame as the Assessment Summary pop-up: 28 radius, 3px theme
  // outline, theme card surface (set inline).
  card: {
    flex: 1,
    marginHorizontal: 18,
    marginVertical: 14,
    borderRadius: 28,
    borderWidth: 3,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    gap: 10,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    marginTop: 2,
  },

  // Body — ring on top, tiles below; fills the card without scrolling.
  body: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  overallCard: {
    alignItems: 'center',
    gap: 4,
  },
  ringPercentText: {
    position: 'absolute',
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
  },
  overallLabel: {
    marginTop: 2,
    fontSize: 14,
    color: '#6D7280',
    fontFamily: 'DMSans_700Bold',
  },
  overallBadge: {
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
  },
  overallBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
  },

  // Shape tiles: 2 columns x 3 rows, same tile as the Assessment Summary.
  shapeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  shapeRow: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCC7B0',
  },
  shapeTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shapeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shapeName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#333333',
  },
  badge: {
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  shapeMetricColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E7E9ED',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  shapeScoreText: {
    minWidth: 44,
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#3F4550',
    textAlign: 'right',
  },

  // Footer
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // The other modules' raised 3D button, in the theme colour.
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 180,
    paddingHorizontal: 40,
    paddingVertical: 13,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  doneButtonDisabled: {
    opacity: 0.75,
  },
  doneText: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
