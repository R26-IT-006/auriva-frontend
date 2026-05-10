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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Circle, Polyline, Path, G, Defs, Marker } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CANVAS_WIDTH  = SCREEN_WIDTH  * 0.6;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.55;
const CANVAS_CX     = CANVAS_WIDTH  / 2;
const CANVAS_CY     = CANVAS_HEIGHT / 2;

const POINTER_SIZE = 14;
const POINTER_HALF = POINTER_SIZE / 2;
const N_POINTS     = 100;

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

const SHAPES = [
  {
    id: 'horizontal_line',
    label: 'Draw a straight line',
    instruction:   'Follow the dotted line from left to right',
    instructionSi: 'වමේ සිට දකුණට තිත් රේඛාව අනුගමනය කරන්න',
    pageLabel: 'Assessment 1 of 6',
  },
  {
    id: 'vertical_line',
    label: 'Draw a straight line down',
    instruction:   'Follow the dotted line from top to bottom',
    instructionSi: 'ඉහළ සිට පහළට තිත් රේඛාව අනුගමනය කරන්න',
    pageLabel: 'Assessment 2 of 6',
  },
  {
    id: 'full_circle',
    label: 'Draw a full circle',
    instruction:   'Trace around the full dotted circle',
    instructionSi: 'තිත් වෘත්තය වටා ඉර අඳින්න',
    pageLabel: 'Assessment 3 of 6',
  },
  {
    id: 'half_circle',
    label: 'Draw a half circle',
    instruction:   'Trace the curved line from left to right',
    instructionSi: 'වමේ සිට දකුණට වක්‍ර රේඛාව අනුගමනය කරන්න',
    pageLabel: 'Assessment 4 of 6',
  },
  {
    id: 'zigzag',
    label: 'Draw the zigzag pattern',
    instruction:   'Follow the zigzag line from left to right',
    instructionSi: 'වමේ සිට දකුණට සිග්සැග් රේඛාව අනුගමනය කරන්න',
    pageLabel: 'Assessment 5 of 6',
  },
  {
    id: 'curve_wave',
    label: 'Draw the wave',
    instruction:   'Follow the wavy line from left to right',
    instructionSi: 'වමේ සිට දකුණට රැළි රේඛාව අනුගමනය කරන්න',
    pageLabel: 'Assessment 6 of 6',
  },
];

// Starting coordinates (SVG space) for pulsing ring — matches GuideShape start dots
const SHAPE_STARTS = {
  horizontal_line: { x: CANVAS_CX - 200,  y: CANVAS_CY        },
  vertical_line:   { x: CANVAS_CX,         y: CANVAS_CY - 150  },
  full_circle:     { x: CANVAS_CX,         y: CANVAS_CY - 120  },
  half_circle:     { x: CANVAS_CX - 150,   y: CANVAS_CY        },
  zigzag:          { x: CANVAS_CX - 180,   y: CANVAS_CY + 40   },
  curve_wave:      { x: CANVAS_CX - 180,   y: CANVAS_CY        },
};

const SHAPE_AUDIO = {
  horizontal_line: require('../../../assets/handwriting_instructions/horizontal_line.mp3'),
  vertical_line:   require('../../../assets/handwriting_instructions/vertical_line.mp3'),
  full_circle:     require('../../../assets/handwriting_instructions/circle.mp3'),
  half_circle:     require('../../../assets/handwriting_instructions/curved.mp3'),
  zigzag:          require('../../../assets/handwriting_instructions/zig_zag.mp3'),
  curve_wave:      require('../../../assets/handwriting_instructions/wave.mp3'),
};

// ─── Animated pointer path sampling ───────────────────────────────────────────

function computePathPoints(shapeId) {
  const cx = CANVAS_CX;
  const cy = CANVAS_CY;
  const pts = [];

  if (shapeId === 'horizontal_line') {
    for (let i = 0; i <= N_POINTS; i++) {
      const t = i / N_POINTS;
      pts.push({ x: cx - 200 + t * 400, y: cy });
    }

  } else if (shapeId === 'vertical_line') {
    for (let i = 0; i <= N_POINTS; i++) {
      const t = i / N_POINTS;
      pts.push({ x: cx, y: cy - 150 + t * 300 });
    }

  } else if (shapeId === 'full_circle') {
    const r = 120;
    for (let i = 0; i <= N_POINTS; i++) {
      const angle = -Math.PI / 2 + (i / N_POINTS) * 2 * Math.PI;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }

  } else if (shapeId === 'half_circle') {
    const r = 150;
    for (let i = 0; i <= N_POINTS; i++) {
      const angle = Math.PI + (i / N_POINTS) * Math.PI;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }

  } else if (shapeId === 'zigzag') {
    const nodes = [
      { x: cx - 180, y: cy + 40 },
      { x: cx - 120, y: cy - 40 },
      { x: cx - 60,  y: cy + 40 },
      { x: cx,       y: cy - 40 },
      { x: cx + 60,  y: cy + 40 },
      { x: cx + 120, y: cy - 40 },
      { x: cx + 180, y: cy + 40 },
    ];
    const segs   = nodes.length - 1;
    const perSeg = Math.floor(N_POINTS / segs);
    for (let s = 0; s < segs; s++) {
      const from  = nodes[s];
      const to    = nodes[s + 1];
      const count = s === segs - 1 ? N_POINTS - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) {
        const t = i / (count > 1 ? count - 1 : 1);
        pts.push({ x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) });
      }
    }

  } else if (shapeId === 'curve_wave') {
    const segs = [
      { p0: { x: cx - 180, y: cy }, p1: { x: cx - 120, y: cy - 60 }, p2: { x: cx - 60, y: cy } },
      { p0: { x: cx - 60,  y: cy }, p1: { x: cx,       y: cy + 60 }, p2: { x: cx + 60, y: cy } },
      { p0: { x: cx + 60,  y: cy }, p1: { x: cx + 120, y: cy - 60 }, p2: { x: cx + 180, y: cy } },
    ];
    const perSeg = Math.floor(N_POINTS / 3);
    for (let s = 0; s < 3; s++) {
      const { p0, p1, p2 } = segs[s];
      const count = s === 2 ? N_POINTS - s * perSeg + 1 : perSeg;
      for (let i = 0; i < count; i++) {
        const t = i / (count > 1 ? count - 1 : 1);
        pts.push({
          x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
          y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
        });
      }
    }
  }

  return pts;
}

// ─── Feature calculation ───────────────────────────────────────────────────────

function calculateFeatures(paths, shapeId) {
  const allPoints = paths.flat();
  if (allPoints.length < 2) {
    return { duration_ms: 0, total_distance: 0, avg_speed: 0, smoothness: 0, pause_count: 0, accuracy: 0 };
  }

  const duration_ms = allPoints[allPoints.length - 1].t;

  let total_distance = 0;
  for (let i = 1; i < allPoints.length; i++) {
    const dx = allPoints[i].x - allPoints[i - 1].x;
    const dy = allPoints[i].y - allPoints[i - 1].y;
    total_distance += Math.sqrt(dx * dx + dy * dy);
  }

  const avg_speed = duration_ms > 0 ? total_distance / duration_ms : 0;

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

  let pause_count = 0;
  for (let i = 1; i < allPoints.length; i++) {
    if (allPoints[i].t - allPoints[i - 1].t > 300) pause_count++;
  }

  const cx = CANVAS_CX;
  const cy = CANVAS_CY;
  let accuracy = 0;

  if (shapeId === 'horizontal_line') {
    accuracy = allPoints.reduce((s, p) => s + Math.abs(p.y - cy), 0) / allPoints.length;
  } else if (shapeId === 'vertical_line') {
    accuracy = allPoints.reduce((s, p) => s + Math.abs(p.x - cx), 0) / allPoints.length;
  } else if (shapeId === 'full_circle') {
    const r = 120;
    accuracy = allPoints.reduce((s, p) => {
      return s + Math.abs(Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) - r);
    }, 0) / allPoints.length;
  } else if (shapeId === 'half_circle') {
    const r = 150;
    accuracy = allPoints.reduce((s, p) => {
      return s + Math.abs(Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) - r);
    }, 0) / allPoints.length;
  }

  return { duration_ms, total_distance, avg_speed, smoothness, pause_count, accuracy };
}

// ─── Guide shape SVG ──────────────────────────────────────────────────────────

function GuideShape({ shapeId, theme }) {
  const cx = CANVAS_CX;
  const cy = CANVAS_CY;
  const dash = { stroke: '#B8C8E8', strokeWidth: 3, strokeDasharray: '10,6' };

  if (shapeId === 'horizontal_line') return (
    <>
      <Line x1={cx - 200} y1={cy} x2={cx + 200} y2={cy} {...dash} />
      <Circle cx={cx - 200} cy={cy} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'vertical_line') return (
    <>
      <Line x1={cx} y1={cy - 150} x2={cx} y2={cy + 150} {...dash} />
      <Circle cx={cx} cy={cy - 150} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'full_circle') return (
    <>
      <Circle cx={cx} cy={cy} r={120} fill="none" {...dash} />
      <Circle cx={cx} cy={cy - 120} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'half_circle') return (
    <>
      <Path
        d={`M ${cx - 150} ${cy} A 150 150 0 0 1 ${cx + 150} ${cy}`}
        fill="none" {...dash}
      />
      <Circle cx={cx - 150} cy={cy} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'zigzag') {
    const pts = [
      { x: cx - 180, y: cy + 40 }, { x: cx - 120, y: cy - 40 },
      { x: cx - 60,  y: cy + 40 }, { x: cx,       y: cy - 40 },
      { x: cx + 60,  y: cy + 40 }, { x: cx + 120, y: cy - 40 },
      { x: cx + 180, y: cy + 40 },
    ];
    return (
      <>
        <Polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" {...dash} />
        <Circle cx={cx - 180} cy={cy + 40} r={12} fill={theme.button} />
      </>
    );
  }

  if (shapeId === 'curve_wave') return (
    <>
      <Path
        d={`M ${cx - 180} ${cy} Q ${cx - 120} ${cy - 60},${cx - 60} ${cy} Q ${cx} ${cy + 60},${cx + 60} ${cy} Q ${cx + 120} ${cy - 60},${cx + 180} ${cy}`}
        fill="none" {...dash}
      />
      <Circle cx={cx - 180} cy={cy} r={12} fill={theme.button} />
    </>
  );

  return null;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ShapeAssessmentScreen({ route, navigation }) {
  const { student, theme } = route.params;

  const [currentShapeIndex, setCurrentShapeIndex] = useState(0);
  const [completedShapes,   setCompletedShapes]   = useState([]);
  const [currentPath,       setCurrentPath]       = useState([]);
  const [allPaths,          setAllPaths]          = useState([]);
  const [showNext,          setShowNext]          = useState(false);

  const startTime            = useRef(null);
  const sessionStartTime     = useRef(Date.now());
  const currentShapeIndexRef = useRef(0);
  const allPathsRef          = useRef([]);
  const completedShapesRef   = useRef([]);
  const animValue            = useRef(new Animated.Value(0)).current;
  const pulseAnim            = useRef(new Animated.Value(0)).current;
  const pulseLoopRef         = useRef(null);
  const soundRef             = useRef(null);

  const currentShape = SHAPES[currentShapeIndex];

  const pulseScale = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }),
    [pulseAnim],
  );
  const pulseOpacity = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
    [pulseAnim],
  );

  const playShapeAudio = useCallback(async (shapeId) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(SHAPE_AUDIO[shapeId]);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (_) {}
  }, []);

  // Precompute interpolation ranges for animated pointer
  const pathPoints = computePathPoints(currentShape.id);
  const inputRange = pathPoints.map((_, i) => i / (pathPoints.length - 1));
  const pointerLeft = animValue.interpolate({
    inputRange,
    outputRange: pathPoints.map(p => p.x - POINTER_HALF),
  });
  const pointerTop = animValue.interpolate({
    inputRange,
    outputRange: pathPoints.map(p => p.y - POINTER_HALF),
  });

  // Restart animations and speak on shape change
  useEffect(() => {
    animValue.setValue(0);
    pulseAnim.setValue(0);

    const pointerLoop = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: false,
      })
    );
    pointerLoop.start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    pulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    const shape = SHAPES[currentShapeIndex];
    const t = setTimeout(() => { playShapeAudio(shape.id); }, 300);

    return () => {
      pointerLoop.stop();
      pulseLoop.stop();
      clearTimeout(t);
      if (soundRef.current) { soundRef.current.unloadAsync(); soundRef.current = null; }
    };
  }, [currentShapeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PanResponder ────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startTime.current = Date.now();
        setCurrentPath([{ x: locationX, y: locationY, t: 0 }]);
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const t = Date.now() - startTime.current;
        setCurrentPath(prev => [...prev, { x: locationX, y: locationY, t }]);
      },

      onPanResponderRelease: () => {
        setCurrentPath(prev => {
          if (prev.length > 2) {
            setAllPaths(paths => {
              const updated = [...paths, prev];
              allPathsRef.current = updated;
              return updated;
            });
            setShowNext(true);
          }
          return [];
        });
      },
    })
  ).current;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const submitAssessment = useCallback(async (assessmentData) => {
    try {
      const response = await client.post(ENDPOINTS.HANDWRITING_ASSESSMENT, {
        student_id:    student.sid,
        session_start: sessionStartTime.current,
        session_end:   Date.now(),
        shapes: assessmentData.map(shape => ({
          shape_id:     shape.shapeId,
          stroke_count: shape.strokes.length,
          strokes:      shape.strokes,
          features:     shape.features,
        })),
      });
      return response.data?.id ?? null;
    } catch (err) {
      console.error('Failed to submit assessment data:', err);
      return null;
    }
  }, [student.sid]);

  const handleClear = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setShowNext(false);
  }, []);

  const handleNext = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
    }
    const idx = currentShapeIndexRef.current;
    const shapeData = {
      shapeId:   SHAPES[idx].id,
      strokes:   allPathsRef.current,
      features:  calculateFeatures(allPathsRef.current, SHAPES[idx].id),
      timestamp: Date.now(),
    };

    const updated = [...completedShapesRef.current, shapeData];
    completedShapesRef.current = updated;
    setCompletedShapes(updated);

    if (idx < SHAPES.length - 1) {
      currentShapeIndexRef.current = idx + 1;
      setCurrentShapeIndex(idx + 1);
      setAllPaths([]);
      allPathsRef.current = [];
      setCurrentPath([]);
      setShowNext(false);
    } else {
      const assessmentId = await submitAssessment(updated);
      navigation.navigate('AssessmentComplete', {
        student,
        theme,
        assessmentData: updated,
        assessmentId,
      });
    }
  }, [navigation, student, theme, submitAssessment]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const startDot = SHAPE_STARTS[currentShape.id];

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        <View style={styles.container}>

          {/* ── TOP: assessment badge + shape title + success badge + instruction ── */}
          <View style={styles.topArea}>

            <View style={[styles.assessBadge, { backgroundColor: theme.button + '18', borderColor: theme.button + '40' }]}>
              <Ionicons name="pencil-outline" size={13} color={theme.button} />
              <Text style={[styles.assessBadgeText, { color: theme.button }]}>
                {currentShape.pageLabel}
              </Text>
            </View>

            <Text style={[styles.shapeTitle, { color: theme.headingText }]}>
              {currentShape.label}
            </Text>

            <View style={[styles.instructionCard, { borderLeftColor: theme.button }]}>
              <View style={styles.instructionInner}>
                <View style={styles.instructionTexts}>
                  <Text style={styles.instructionEn}>{currentShape.instruction}</Text>
                  <Text style={styles.instructionSi}>{currentShape.instructionSi}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => playShapeAudio(currentShape.id)}
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
              {...panResponder.panHandlers}
            >
              <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <GuideShape shapeId={currentShape.id} theme={theme} />

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

              {/* Pulsing ring — guides child to start position */}
              {!showNext && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pulseDot,
                    {
                      left:            startDot.x - 18,
                      top:             startDot.y - 18,
                      borderColor:     theme.button,
                      backgroundColor: theme.button + '20',
                      transform:       [{ scale: pulseScale }],
                      opacity:         pulseOpacity,
                    },
                  ]}
                />
              )}

              {/* Animated guide pointer */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pointer,
                  { backgroundColor: theme.button, left: pointerLeft, top: pointerTop },
                ]}
              />
            </View>
          </View>

          {/* ── BOTTOM: progress dots + action buttons ── */}
          <View style={styles.bottomArea}>
            <View style={styles.progressDots}>
              {SHAPES.map((_, i) => {
                const done   = i < currentShapeIndex;
                const active = i === currentShapeIndex;
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

              {showNext && (
                <TouchableOpacity
                  style={[styles.nextButton, { backgroundColor: theme.button }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>

        {/* Feedback bubble — speech bubble above avatar's head */}
        {showNext && (
          <>
            <View style={[styles.avatarBubble, { borderColor: theme.button + '40' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={{ marginBottom: 2 }} />
              <Text style={styles.avatarBubbleText}>Great drawing!</Text>
            </View>
            {/* Tail pointing right toward avatar's head */}
            <View style={styles.avatarBubbleTailBorder} />
            <View style={styles.avatarBubbleTail} />
          </>
        )}

        {/* Avatar — screen-level absolute */}
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

  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Top area
  topArea: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    flexShrink: 0,
  },

  assessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  assessBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  shapeTitle: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },

  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 6,
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },

  instructionCard: {
    backgroundColor: '#FFFFFF',
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
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  instructionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instructionTexts: {
    flex: 1,
    gap: 4,
  },
  instructionEn: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444444',
    textAlign: 'center',
  },
  instructionSi: {
    fontSize: 15,
    color: '#7B7B9E',
    textAlign: 'center',
    lineHeight: 22,
  },
  speakerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Canvas area
  canvasArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  canvasCard: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#F8FAFF',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
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

  // Bottom area
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
  },

  // Avatar
  avatarImage: {
    position: 'absolute',
    bottom: -10,
    right: 8,
    width: 250,
    height: 320,
    zIndex: 10,
  },

  // Feedback speech bubble above avatar's head
  avatarBubble: {
    position: 'absolute',
    bottom: 258,
    right: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 11,
  },
  avatarBubbleText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '800',
    textAlign: 'center',
  },
  // Border layer of tail (slightly larger triangle in border color)
  avatarBubbleTailBorder: {
    position: 'absolute',
    bottom: 268,
    right: 93,
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#00000026',
    zIndex: 11,
  },
  // White fill of tail
  avatarBubbleTail: {
    position: 'absolute',
    bottom: 270,
    right: 95,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
    zIndex: 12,
  },
});