import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useLearningSessionActivity } from '../../context/LearningSessionContext';
import BreakPromptModal from '../../components/handwriting/BreakPromptModal';
import { LIVE_ACTIVITY_TYPES } from '../../constants/liveSessionPolicy';
import { buildProgressPatch } from '../../utils/liveSessionSnapshot';
import { computeDTW } from '../../utils/dtw';
import { clampToCanvas, isImplausibleJump, pageToLocal, mapTouchToCanvas } from '../../utils/touchPointSanitize';
import { normalizeStrokesForDTW } from '../../utils/dtwNormalization';
import { featuresToScore, DTW_CORRECT_THRESHOLD } from '../../utils/adaptiveSequencing';
import { DEFAULT_N_POINTS, selectPreWritingActivities } from '../../constants/preWritingActivities';
import AttemptAvatarFeedback from './AttemptAvatarFeedback';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { useLockLandscape } from '../../utils/useOrientationLock';

// The canvas view's own borderWidth. measure() reports the BORDER box while
// the Svg starts inside the border, so this removes that systematic offset.
// Kept next to the import so one file has one value.
const CANVAS_BORDER_WIDTH = 2;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Same canvas scale as ShapeAssessmentScreen — preWritingActivities.js
// geometry was authored against this size.
const CANVAS_WIDTH  = SCREEN_WIDTH  * 0.6;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.55;
const CANVAS_CX     = CANVAS_WIDTH  / 2;
const CANVAS_CY     = CANVAS_HEIGHT / 2;

const POINTER_SIZE = 14;
const POINTER_HALF = POINTER_SIZE / 2;

const ATTEMPT_FEEDBACK_MS = 2200;

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

// ─── Feature calculation (smoothness formula matches ShapeAssessmentScreen's
//     calculateFeatures exactly, DTW path matches its zigzag/curve_wave path)
// ─────────────────────────────────────────────────────────────────────────────

function calculateActivityFeatures(paths, activity) {
  const allPoints = paths.flat();
  if (allPoints.length < 2) {
    return { duration_ms: 0, smoothness: 0, dtw_distance: null };
  }

  const duration_ms = allPoints[allPoints.length - 1].t;

  let smoothness = 0;
  if (allPoints.length >= 3) {
    const changes = [];
    for (let i = 1; i < allPoints.length - 1; i++) {
      const v1x = allPoints[i].x     - allPoints[i - 1].x;
      const v1y = allPoints[i].y     - allPoints[i - 1].y;
      const v2x = allPoints[i + 1].x - allPoints[i].x;
      const v2y = allPoints[i + 1].y - allPoints[i].y;
      const l1  = Math.sqrt(v1x * v1x + v1y * v1y);
      const l2  = Math.sqrt(v2x * v2x + v2y * v2y);
      if (l1 > 0 && l2 > 0) {
        const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
        changes.push(Math.acos(Math.max(-1, Math.min(1, dot))));
      }
    }
    if (changes.length > 0) smoothness = changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  // dtw_norm_v1 — same normalization ShapeAssessmentScreen's zigzag/curve_wave
  // path uses, so this score is comparable to every other DTW-scored shape.
  const templateStrokes = activity.target_shape.generatePoints(CANVAS_CX, CANVAS_CY, DEFAULT_N_POINTS);
  const normTemplatePts = normalizeStrokesForDTW(templateStrokes).flat().map(p => ({ x: p.x, y: p.y }));
  const normChildPts    = normalizeStrokesForDTW(paths).flat().map(p => ({ x: p.x, y: p.y }));
  const result = computeDTW(normChildPts, normTemplatePts);

  return { duration_ms, smoothness, dtw_distance: result.normalizedDistance };
}

// Same shape (bounding box + drawn length) LetterWritingScreen's
// getDrawingBounds/didPassAttempt uses, scaled to this screen's canvas —
// keeps a trivial scribble from passing on DTW distance alone.
function getDrawingBounds(paths) {
  const all = paths.flat();
  if (all.length === 0) return { length: 0, width: 0, height: 0 };
  let minX = all[0].x, maxX = all[0].x;
  let minY = all[0].y, maxY = all[0].y;
  let length = 0;
  for (let i = 1; i < all.length; i++) {
    if (all[i].x < minX) minX = all[i].x;
    if (all[i].x > maxX) maxX = all[i].x;
    if (all[i].y < minY) minY = all[i].y;
    if (all[i].y > maxY) maxY = all[i].y;
    const dx = all[i].x - all[i - 1].x;
    const dy = all[i].y - all[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return { length, width: maxX - minX, height: maxY - minY };
}

function didPassActivity(features, paths) {
  const { length, width, height } = getDrawingBounds(paths);
  return features.smoothness < 0.35
    && length >= CANVAS_HEIGHT * 0.25
    && (width >= CANVAS_WIDTH * 0.10 || height >= CANVAS_HEIGHT * 0.15)
    && features.dtw_distance != null
    && features.dtw_distance < DTW_CORRECT_THRESHOLD;
}

// ─── Generic guide renderer — draws whatever target_shape.generatePoints
//     returns, no per-shape branching needed ─────────────────────────────────

function GuideActivity({ activity, theme }) {
  const strokes = useMemo(
    () => activity.target_shape.generatePoints(CANVAS_CX, CANVAS_CY, DEFAULT_N_POINTS),
    [activity]
  );
  const dash = { stroke: '#B8C8E8', strokeWidth: 3, strokeDasharray: '10,6' };
  const first = strokes[0]?.[0];

  return (
    <>
      {strokes.map((stroke, i) => (
        <Polyline
          key={i}
          points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          {...dash}
        />
      ))}
      {first && <Circle cx={first.x} cy={first.y} r={12} fill={theme.button} />}
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PreWritingActivityScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const {
    student, theme,
    activities:    activitiesParam,
    primitiveGroup,
    selectionOptions,
    nextRoute, nextParams,
    onComplete,
  } = route.params;

  const activities = useMemo(() => {
    if (Array.isArray(activitiesParam)) return activitiesParam;
    if (primitiveGroup) return selectPreWritingActivities(primitiveGroup, selectionOptions);
    return [];
  }, [activitiesParam, primitiveGroup, selectionOptions]);

  // Proposal FR-13, Phase 7A / FR-16, Phase 7B — see LetterWritingScreen.js's
  // identical block. No collection_mode concept on this screen.
  const { notifyStrokeStart, notifyStrokeEnd, notifyLiveSessionUpdate } = useLearningSessionActivity({
    studentId: student.sid,
    activityType: LIVE_ACTIVITY_TYPES.PREWRITING,
  });

  const [activityIndex, setActivityIndex] = useState(0);
  const [attempt,        setAttempt]        = useState(1);
  const [currentPath,    setCurrentPath]    = useState([]);
  const [allPaths,       setAllPaths]       = useState([]);
  const [showDone,       setShowDone]       = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null); // { passed, attempt }
  const [reduceMotion,   setReduceMotion]   = useState(false);

  const startTimeRef      = useRef(null);
  const allPathsRef       = useRef([]);
  // Border-touch bug fix — see touchPointSanitize.js.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  // ORIGIN — View.measure() reports this view's own pageX/pageY, the SAME
  // space nativeEvent.pageX/pageY uses. measureInWindow() reports WINDOW
  // space, which on Android excludes the system inset the touch includes;
  // mixing the two left a constant vertical offset on Y and none on X.
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
        canvasOriginRef.current = { x: pageX, y: pageY };
      }
    });
  }, []);
  const strokeIdCounter   = useRef(0);
  const resultsRef        = useRef([]); // accumulated across all activities this session
  const animValue         = useRef(new Animated.Value(0)).current;
  const pulseAnim         = useRef(new Animated.Value(0)).current;
  const pulseLoopRef      = useRef(null);

  const activity     = activities[activityIndex];
  const isLastActivity = activityIndex === activities.length - 1;

  // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical block.
  // Prewriting has no case_type/support_level concept, so only current_item
  // (the activity's id) and attempt_number are ever sent (spec §3's "where
  // relevant" qualifier).
  useEffect(() => {
    if (!activity) return;
    notifyLiveSessionUpdate(buildProgressPatch({ currentItem: activity.id, attemptNumber: attempt }));
  }, [activity, attempt, notifyLiveSessionUpdate]);

  const finish = useCallback(async () => {
    onComplete?.(resultsRef.current);

    // Best-effort save — never blocks the child from moving on to letters,
    // same "non-fatal" convention ShapeFeature/StudentMotorFeature saves use
    // in submitAssessment.
    if (resultsRef.current.length > 0) {
      try {
        await client.post(ENDPOINTS.PRE_WRITING_ACTIVITY, {
          student_id: student.sid,
          results:    resultsRef.current,
          canvas_width:  CANVAS_WIDTH,
          canvas_height: CANVAS_HEIGHT,
        });
      } catch (err) {
        console.error('Failed to save pre-writing activity results:', err);
      }
    }

    navigation.replace(nextRoute, nextParams);
  }, [navigation, nextRoute, nextParams, onComplete, student]);

  // No activities selected (group disabled/empty/mixed) — skip straight
  // through to the letters, exactly as if this screen didn't exist.
  useEffect(() => {
    if (activities.length === 0) {
      navigation.replace(nextRoute, nextParams);
    }
  }, [activities, navigation, nextRoute, nextParams]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const resetCanvas = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setShowDone(false);
    strokeIdCounter.current = 0;
  }, []);

  // Precompute animated pointer path (flattened across strokes — a brief
  // jump between disconnected strokes like cross/X is an acceptable visual
  // trade-off for reusing one interpolation technique for every shape).
  const pathPoints = useMemo(
    () => (activity ? activity.target_shape.generatePoints(CANVAS_CX, CANVAS_CY, DEFAULT_N_POINTS).flat() : []),
    [activity]
  );
  // Animated.interpolate requires at least two keyframes. pathPoints is empty
  // on any frame without an activity — including the one frame that renders
  // before the `activities.length === 0` effect navigates away — and the
  // outputRange fallback below only ever covered half of that: inputRange was
  // left as [], which is what threw "inputRange must have at least 2 elements".
  // Both ranges now fall back together to an inert 2-point identity.
  const hasPointerPath = pathPoints.length > 1;
  const inputRange = hasPointerPath
    ? pathPoints.map((_, i) => i / (pathPoints.length - 1))
    : [0, 1];
  const pointerLeft = animValue.interpolate({
    inputRange,
    outputRange: hasPointerPath ? pathPoints.map(p => p.x - POINTER_HALF) : [0, 0],
  });
  const pointerTop = animValue.interpolate({
    inputRange,
    outputRange: hasPointerPath ? pathPoints.map(p => p.y - POINTER_HALF) : [0, 0],
  });

  useEffect(() => {
    if (!activity) return undefined;

    animValue.setValue(0);
    pulseAnim.setValue(0);

    const pointerLoop = Animated.loop(
      Animated.timing(animValue, { toValue: 1, duration: 2500, useNativeDriver: false })
    );
    pointerLoop.start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    pulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    const t = setTimeout(() => { Speech.speak(activity.prompt_text); }, 300);

    return () => {
      pointerLoop.stop();
      pulseLoop.stop();
      clearTimeout(t);
      Speech.stop();
    };
  }, [activity, animValue, pulseAnim]);

  const pulseScale = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }),
    [pulseAnim],
  );
  const pulseOpacity = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
    [pulseAnim],
  );

  // ── PanResponder ────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        const { x: locationX, y: locationY } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          inset: CANVAS_BORDER_WIDTH,
        });
        const now = Date.now();
        startTimeRef.current = now;
        strokeIdCounter.current += 1;
        setCurrentPath([{ x: locationX, y: locationY, t: 0, tAbs: now, stroke_id: strokeIdCounter.current }]);
      },

      onPanResponderMove: (evt) => {
        const { x: locationX, y: locationY } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          inset: CANVAS_BORDER_WIDTH,
        });
        const now = Date.now();
        setCurrentPath(prev => {
          const last = prev[prev.length - 1];
          // Border-touch bug fix — see touchPointSanitize.js.
          if (last && isImplausibleJump(last, { x: locationX, y: locationY }, CANVAS_WIDTH, CANVAS_HEIGHT)) return prev;
          return [...prev, {
            x: locationX, y: locationY, t: now - startTimeRef.current, tAbs: now, stroke_id: strokeIdCounter.current,
          }];
        });
      },

      onPanResponderRelease: () => {
        notifyStrokeEnd(); // FR-13 — stroke finished; the break prompt may now be shown if eligible
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setShowDone(true);
          }
          return [];
        });
      },
    })
  ).current;

  const handleClear = useCallback(() => {
    if (attemptFeedback) return; // ignore while a feedback bubble is showing
    resetCanvas();
  }, [attemptFeedback, resetCanvas]);

  // ── Score current attempt, then either retry (errorless) or advance ────────
  const submitAttempt = useCallback(async () => {
    if (allPathsRef.current.length === 0 || !activity) return;

    const features = calculateActivityFeatures(allPathsRef.current, activity);
    const score    = Math.round(featuresToScore({ smoothness: features.smoothness, dtw_distance: features.dtw_distance }));
    const passed   = didPassActivity(features, allPathsRef.current);

    setAttemptFeedback({ passed, attempt });

    await new Promise(resolve => setTimeout(resolve, ATTEMPT_FEEDBACK_MS));
    setAttemptFeedback(null);

    if (!passed) {
      // Errorless: no fail state, just clear and let them try the same
      // activity again — never advances, never blocks, no red anywhere.
      setAttempt(a => a + 1);
      resetCanvas();
      return;
    }

    resultsRef.current = [...resultsRef.current, {
      activity_id:  activity.id,
      attempt_count: attempt,
      score,
      dtw_distance: features.dtw_distance,
      passed:       true,
      strokes: allPathsRef.current.map((pts, i) => ({ stroke_id: i + 1, points: pts })),
      timestamp: Date.now(),
    }];

    if (isLastActivity) {
      finish();
    } else {
      setActivityIndex(i => i + 1);
      setAttempt(1);
      resetCanvas();
    }
  }, [activity, attempt, isLastActivity, finish, resetCanvas]);

  // Teacher override — always available, bypasses scoring entirely.
  const handleTeacherSkip = useCallback(() => {
    resultsRef.current = [...resultsRef.current, {
      activity_id:   activity?.id ?? null,
      attempt_count: attempt,
      score:         null,
      dtw_distance:  null,
      passed:        null,
      skipped:       true,
      strokes:       [],
      timestamp:     Date.now(),
    }];

    if (isLastActivity) {
      finish();
    } else {
      setActivityIndex(i => i + 1);
      setAttempt(1);
      resetCanvas();
    }
  }, [activity, attempt, isLastActivity, finish, resetCanvas]);

  if (!activity) return null;

  const first = pathPoints[0];

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        <View style={styles.container}>

          {/* ── TOP: warm-up badge + title + skip + instruction ── */}
          <View style={styles.topArea}>

            <View style={styles.topRow}>
              <View style={[styles.assessBadge, { backgroundColor: theme.button + '18', borderColor: theme.button + '40' }]}>
                <Ionicons name="body-outline" size={13} color={theme.button} />
                <Text style={[styles.assessBadgeText, { color: theme.button }]}>
                  Warm-up {activityIndex + 1} of {activities.length}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleTeacherSkip}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.skipButton}
                activeOpacity={0.6}
              >
                <Text style={styles.skipText}>Skip</Text>
                <Ionicons name="play-skip-forward-outline" size={15} color="#8A8AA0" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.shapeTitle, { color: theme.headingText }]}>
              {activity.name}
            </Text>

            <View style={[styles.instructionCard, { borderLeftColor: theme.button }]}>
              <View style={styles.instructionInner}>
                <Text style={styles.instructionEn}>{activity.prompt_text}</Text>
                <TouchableOpacity
                  onPress={() => Speech.speak(activity.prompt_text)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[styles.speakerBtn, { backgroundColor: theme.button + '18' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high" size={24} color={theme.button} />
                </TouchableOpacity>
              </View>
            </View>

          </View>

          {/* ── MIDDLE: drawing canvas ── */}
          <View style={styles.canvasArea}>
            <View
              style={[styles.canvasCard, { borderColor: theme.button + '30' }]}
              ref={canvasRef}
              onLayout={measureCanvasOrigin}
              {...panResponder.panHandlers}
            >
              <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <GuideActivity activity={activity} theme={theme} />

                {allPaths.map((stroke, i) => (
                  <Polyline
                    key={i}
                    points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                    stroke={theme.button}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}

                {currentPath.length > 1 && (
                  <Polyline
                    points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                    stroke={theme.button}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.7}
                  />
                )}
              </Svg>

              {allPaths.length === 0 && first && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pulseDot,
                    {
                      left:            first.x - 18,
                      top:             first.y - 18,
                      borderColor:     theme.button,
                      backgroundColor: theme.button + '20',
                      transform:       [{ scale: pulseScale }],
                      opacity:         pulseOpacity,
                    },
                  ]}
                />
              )}

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pointer,
                  { backgroundColor: theme.button, left: pointerLeft, top: pointerTop },
                ]}
              />
            </View>
          </View>

          {/* ── BOTTOM: progress dots + clear button ── */}
          <View style={styles.bottomArea}>
            <View style={styles.progressDots}>
              {activities.map((_, i) => {
                const done   = i < activityIndex;
                const active = i === activityIndex;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      done   && { backgroundColor: theme.button,    borderColor: theme.button   },
                      active && { backgroundColor: 'transparent',   borderColor: theme.button   },
                      !done && !active && { backgroundColor: 'transparent', borderColor: '#CCCCCC' },
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.clearButton, { borderColor: theme.button + '60', backgroundColor: theme.button + '10' }]}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={theme.button} />
                <Text style={[styles.clearText, { color: theme.button }]}>Clear</Text>
              </TouchableOpacity>

              {showDone && !attemptFeedback && (
                <TouchableOpacity
                  style={[styles.nextButton, { backgroundColor: theme.button }]}
                  onPress={submitAttempt}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.nextText, { color: theme.buttonText }]}>Done</Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>

        {attemptFeedback && (
          <AttemptAvatarFeedback
            avatarKey={student?.avatar_key}
            passed={attemptFeedback.passed}
            attempt={attemptFeedback.attempt}
            theme={theme}
          />
        )}

        {!attemptFeedback && (
          <Image
            source={AVATAR_MAP[student?.avatar_key]}
            style={styles.avatarImage}
            resizeMode="contain"
          />
        )}

        <BreakPromptModal navigation={navigation} student={student} theme={theme} />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  topArea: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    flexShrink: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },

  assessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  assessBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.3,
  },

  skipButton: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A8AA0',
  },

  shapeTitle: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    textAlign: 'center',
    marginBottom: 4,
  },

  instructionCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  instructionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instructionEn: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    color: '#444444',
    textAlign: 'center',
  },
  speakerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  canvasArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  canvasCard: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: 'rgba(248,250,255,0.96)',
    borderRadius: 26,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  pointer: {
    position: 'absolute',
    width: POINTER_SIZE,
    height: POINTER_SIZE,
    borderRadius: POINTER_HALF,
    opacity: 0.8,
  },
  pulseDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },

  bottomArea: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 50,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 50,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },

  avatarImage: {
    position: 'absolute',
    bottom: -10,
    right: 8,
    width: 250,
    height: 320,
    zIndex: 10,
  },
});
