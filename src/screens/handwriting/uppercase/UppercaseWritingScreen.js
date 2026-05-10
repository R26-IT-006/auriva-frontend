import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { storeLetterProgress } from '../../../utils/storage';
import { getAllLetters } from '../../../constants/letterCategories';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

const COL_L            = Math.round(SCREEN_W * 0.43);
const LETTER_CARD_SIZE = COL_L - 8;
const CANVAS_W         = SCREEN_W - COL_L - PAD * 2;
const CANVAS_H         = Math.round(SCREEN_H * 0.35);

const LINE_1 = Math.round(CANVAS_H * 0.10);
const LINE_2 = Math.round(CANVAS_H * 0.42);
const LINE_3 = Math.round(CANVAS_H * 0.72);
const LINE_4 = Math.round(CANVAS_H * 0.90);

const GHOST_FONT_UPPER = Math.round((LINE_3 - LINE_1) / 0.71);

const ATTEMPT_BADGE = {
  1: { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },
  2: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },
  3: { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },
};

const ATTEMPT_TITLES = {
  1: 'Attempt 1 · Watch & Trace',
  2: 'Attempt 2 · Follow the Guide',
  3: 'Attempt 3 · Write Freely',
};

const ATTEMPT_HINTS = {
  1: 'Watch the dot — then draw it yourself!',
  2: 'Trace the capital — ① marks where to start.',
  3: 'Write from memory — no guide this time!',
};

const START_POS = {
  I: { fx: 0.50, fy: 0.12 }, L: { fx: 0.37, fy: 0.12 }, T: { fx: 0.50, fy: 0.12 },
  E: { fx: 0.37, fy: 0.12 }, F: { fx: 0.37, fy: 0.12 }, H: { fx: 0.35, fy: 0.12 },
  O: { fx: 0.50, fy: 0.12 }, C: { fx: 0.66, fy: 0.28 }, U: { fx: 0.34, fy: 0.12 },
  J: { fx: 0.56, fy: 0.12 }, S: { fx: 0.63, fy: 0.24 }, G: { fx: 0.66, fy: 0.28 },
  Q: { fx: 0.50, fy: 0.12 }, D: { fx: 0.36, fy: 0.12 }, P: { fx: 0.36, fy: 0.12 },
  B: { fx: 0.36, fy: 0.12 }, V: { fx: 0.29, fy: 0.12 }, Y: { fx: 0.29, fy: 0.12 },
  A: { fx: 0.39, fy: 0.12 }, K: { fx: 0.36, fy: 0.12 }, M: { fx: 0.28, fy: 0.12 },
  N: { fx: 0.32, fy: 0.12 }, R: { fx: 0.36, fy: 0.12 }, W: { fx: 0.22, fy: 0.12 },
  X: { fx: 0.29, fy: 0.12 }, Z: { fx: 0.31, fy: 0.12 },
};

const DEFAULT_START = { fx: 0.36, fy: 0.12 };

const PHONETICS = {
  a:'[eɪ]', b:'[biː]', c:'[siː]', d:'[diː]', e:'[iː]',
  f:'[ɛf]',  g:'[dʒiː]', h:'[eɪtʃ]', i:'[aɪ]', j:'[dʒeɪ]',
  k:'[keɪ]', l:'[ɛl]', m:'[ɛm]', n:'[ɛn]', o:'[oʊ]',
  p:'[piː]', q:'[kjuː]', r:'[ɑːr]', s:'[ɛs]', t:'[tiː]',
  u:'[juː]', v:'[viː]', w:'[dʌbljуː]', x:'[ɛks]', y:'[waɪ]', z:'[zɛd]',
};

const LETTER_PATHS = {
  A:[{fx:0.50,fy:0.12},{fx:0.30,fy:0.72},{fx:0.50,fy:0.12},{fx:0.70,fy:0.72},{fx:0.36,fy:0.50},{fx:0.64,fy:0.50}],
  B:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.55,fy:0.14},{fx:0.63,fy:0.24},{fx:0.63,fy:0.37},{fx:0.55,fy:0.45},{fx:0.37,fy:0.46},{fx:0.57,fy:0.48},{fx:0.64,fy:0.58},{fx:0.64,fy:0.65},{fx:0.55,fy:0.72},{fx:0.37,fy:0.72}],
  C:[{fx:0.67,fy:0.28},{fx:0.50,fy:0.12},{fx:0.33,fy:0.28},{fx:0.33,fy:0.52},{fx:0.50,fy:0.72},{fx:0.67,fy:0.58}],
  D:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.55,fy:0.15},{fx:0.65,fy:0.30},{fx:0.65,fy:0.54},{fx:0.55,fy:0.68},{fx:0.37,fy:0.72}],
  E:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.65,fy:0.12},{fx:0.37,fy:0.42},{fx:0.62,fy:0.42},{fx:0.37,fy:0.72},{fx:0.65,fy:0.72}],
  F:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.65,fy:0.12},{fx:0.37,fy:0.42},{fx:0.62,fy:0.42}],
  G:[{fx:0.67,fy:0.28},{fx:0.50,fy:0.12},{fx:0.33,fy:0.28},{fx:0.33,fy:0.52},{fx:0.50,fy:0.72},{fx:0.67,fy:0.60},{fx:0.67,fy:0.42},{fx:0.50,fy:0.42}],
  H:[{fx:0.35,fy:0.12},{fx:0.35,fy:0.72},{fx:0.35,fy:0.42},{fx:0.65,fy:0.42},{fx:0.65,fy:0.12},{fx:0.65,fy:0.72}],
  I:[{fx:0.50,fy:0.12},{fx:0.50,fy:0.72}],
  J:[{fx:0.57,fy:0.12},{fx:0.57,fy:0.55},{fx:0.50,fy:0.68},{fx:0.40,fy:0.72},{fx:0.32,fy:0.68},{fx:0.29,fy:0.57}],
  K:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.44},{fx:0.64,fy:0.12},{fx:0.37,fy:0.44},{fx:0.64,fy:0.72}],
  L:[{fx:0.38,fy:0.12},{fx:0.38,fy:0.72},{fx:0.62,fy:0.72}],
  M:[{fx:0.28,fy:0.72},{fx:0.28,fy:0.12},{fx:0.50,fy:0.50},{fx:0.72,fy:0.12},{fx:0.72,fy:0.72}],
  N:[{fx:0.32,fy:0.72},{fx:0.32,fy:0.12},{fx:0.68,fy:0.72},{fx:0.68,fy:0.12}],
  O:[{fx:0.62,fy:0.32},{fx:0.50,fy:0.12},{fx:0.38,fy:0.32},{fx:0.38,fy:0.52},{fx:0.50,fy:0.72},{fx:0.62,fy:0.52},{fx:0.62,fy:0.32}],
  P:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.55,fy:0.15},{fx:0.64,fy:0.25},{fx:0.64,fy:0.38},{fx:0.55,fy:0.48},{fx:0.37,fy:0.48}],
  Q:[{fx:0.62,fy:0.32},{fx:0.50,fy:0.12},{fx:0.38,fy:0.32},{fx:0.38,fy:0.52},{fx:0.50,fy:0.72},{fx:0.62,fy:0.52},{fx:0.62,fy:0.32},{fx:0.58,fy:0.62},{fx:0.68,fy:0.76}],
  R:[{fx:0.37,fy:0.12},{fx:0.37,fy:0.72},{fx:0.37,fy:0.12},{fx:0.55,fy:0.15},{fx:0.64,fy:0.25},{fx:0.64,fy:0.38},{fx:0.55,fy:0.48},{fx:0.37,fy:0.46},{fx:0.64,fy:0.72}],
  S:[{fx:0.65,fy:0.24},{fx:0.50,fy:0.12},{fx:0.35,fy:0.24},{fx:0.50,fy:0.42},{fx:0.65,fy:0.58},{fx:0.50,fy:0.72},{fx:0.35,fy:0.62}],
  T:[{fx:0.28,fy:0.12},{fx:0.72,fy:0.12},{fx:0.50,fy:0.12},{fx:0.50,fy:0.72}],
  U:[{fx:0.34,fy:0.12},{fx:0.34,fy:0.52},{fx:0.40,fy:0.68},{fx:0.50,fy:0.72},{fx:0.60,fy:0.68},{fx:0.66,fy:0.52},{fx:0.66,fy:0.12}],
  V:[{fx:0.30,fy:0.12},{fx:0.50,fy:0.72},{fx:0.70,fy:0.12}],
  W:[{fx:0.22,fy:0.12},{fx:0.35,fy:0.72},{fx:0.50,fy:0.46},{fx:0.65,fy:0.72},{fx:0.78,fy:0.12}],
  X:[{fx:0.30,fy:0.12},{fx:0.50,fy:0.42},{fx:0.70,fy:0.72},{fx:0.70,fy:0.12},{fx:0.50,fy:0.42},{fx:0.30,fy:0.72}],
  Y:[{fx:0.30,fy:0.12},{fx:0.50,fy:0.42},{fx:0.70,fy:0.12},{fx:0.50,fy:0.42},{fx:0.50,fy:0.72}],
  Z:[{fx:0.32,fy:0.12},{fx:0.68,fy:0.12},{fx:0.32,fy:0.72},{fx:0.68,fy:0.72}],
};

function calculateDrawingFeatures(paths) {
  const allPoints = paths.flat();
  if (allPoints.length < 2) {
    return { smoothness: 0, pauseCount: 0, completionTime: 0, strokeCount: paths.length };
  }
  const completionTime = allPoints[allPoints.length - 1].t;
  let pauseCount = 0;
  for (let i = 1; i < allPoints.length; i++) {
    if (allPoints[i].t - allPoints[i - 1].t > 300) pauseCount++;
  }
  let smoothness = 0;
  if (allPoints.length >= 3) {
    const changes = [];
    for (let i = 1; i < allPoints.length - 1; i++) {
      const v1x = allPoints[i].x - allPoints[i-1].x, v1y = allPoints[i].y - allPoints[i-1].y;
      const v2x = allPoints[i+1].x - allPoints[i].x, v2y = allPoints[i+1].y - allPoints[i].y;
      const l1 = Math.sqrt(v1x*v1x + v1y*v1y), l2 = Math.sqrt(v2x*v2x + v2y*v2y);
      if (l1 > 0 && l2 > 0) {
        changes.push(Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / (l1*l2)))));
      }
    }
    if (changes.length > 0) smoothness = changes.reduce((a, b) => a + b, 0) / changes.length;
  }
  return { smoothness, pauseCount, completionTime, strokeCount: paths.length };
}

function getAttemptBadge(smoothness) {
  if (smoothness < 0.15) return { label: 'Excellent! ✓', color: '#2E7D32', bg: '#E8F5E9' };
  if (smoothness < 0.35) return { label: 'Good effort!',      color: '#E65100', bg: '#FFF3E0' };
  return                        { label: 'Keep going!',        color: '#C62828', bg: '#FFEBEE' };
}

const CATEGORY_CELEBRATION = {
  straight: {
    icon: 'construct-outline',
    title: 'Tall Straight Capitals Done!',
    message: 'Those tall letters look amazing!\nYour lines are getting so steady.',
    color: '#1565C0',
  },
  curved: {
    icon: 'moon-outline',
    title: 'Curved Capitals Conquered!',
    message: 'Big beautiful curves!\nYour uppercase letters are shining.',
    color: '#6A1B9A',
  },
  mixed: {
    icon: 'star-outline',
    title: 'Complex Capitals Complete!',
    message: 'Those were the trickiest capitals!\nYou nailed every single one!',
    color: '#E65100',
  },
};

const ALL_DONE_CELEBRATION = {
  icon: 'trophy-outline',
  title: 'All Capitals Complete!',
  message: 'You wrote every capital letter!\nYou are a true alphabet champion!',
  color: '#2E7D32',
};

const NEXT_CATEGORY_LABEL = {
  straight: 'Straight capitals', curved: 'Curved capitals', mixed: 'Mixed capitals',
};

export default function UppercaseWritingScreen({ route, navigation }) {
  const {
    student,
    theme,
    letterSequence = [],
  } = route.params;

  const caseType = 'uppercase';

  const sequence = useMemo(() => {
    const filtered = letterSequence.filter(l => l.caseType === caseType);
    return filtered.length > 0 ? filtered : getAllLetters(caseType);
  }, [letterSequence]);

  const [letterIdx,    setLetterIdx]    = useState(0);
  const [attempt,      setAttempt]      = useState(1);
  const [currentPath,  setCurrentPath]  = useState([]);
  const [allPaths,     setAllPaths]     = useState([]);
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [celebration,  setCelebration]  = useState(null);

  const startTimeRef = useRef(null);
  const allPathsRef  = useRef([]);

  const tracerX         = useRef(new Animated.Value(0)).current;
  const tracerY         = useRef(new Animated.Value(0)).current;
  const [tracerVisible, setTracerVisible] = useState(false);

  const celebScale   = useRef(new Animated.Value(0.5)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;

  const letterObj     = sequence[letterIdx];
  const letter        = letterObj?.letter ?? 'A';
  const isLastLetter  = letterIdx >= sequence.length - 1;
  const isLastAttempt = attempt === 3;
  const startPos      = START_POS[letter] ?? DEFAULT_START;
  const guideOpacity  = attempt === 3 ? 0 : attempt === 1 ? 0.14 : 0.26;
  const phonetic      = PHONETICS[letter.toLowerCase()] ?? '';
  const badge         = ATTEMPT_BADGE[attempt];

  const playLetterSound = useCallback((l = letter) => {
    Speech.stop();
    Speech.speak(l.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
  }, [letter]);

  const playLetterSoundRef = useRef(playLetterSound);
  playLetterSoundRef.current = playLetterSound;

  useEffect(() => {
    Speech.speak(letter.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
    return () => Speech.stop();
  }, [letter]);

  useEffect(() => {
    const path = LETTER_PATHS[letter];
    if (attempt !== 1 || hasDrawn || !path || path.length < 2) {
      setTracerVisible(false);
      return;
    }

    const startX = path[0].fx * CANVAS_W;
    const startY = path[0].fy * CANVAS_H;
    tracerX.setValue(startX);
    tracerY.setValue(startY);
    setTracerVisible(true);

    const steps = path.slice(1).map(pt =>
      Animated.parallel([
        Animated.timing(tracerX, { toValue: pt.fx * CANVAS_W, duration: 420, useNativeDriver: false }),
        Animated.timing(tracerY, { toValue: pt.fy * CANVAS_H, duration: 420, useNativeDriver: false }),
      ])
    );

    const anim = Animated.loop(
      Animated.sequence([Animated.delay(350), ...steps, Animated.delay(700)]),
      { resetBeforeIteration: true }
    );
    anim.start();

    return () => { setTracerVisible(false); anim.stop(); };
  }, [attempt, hasDrawn, letter, tracerX, tracerY]);

  useEffect(() => {
    if (hasDrawn && allPathsRef.current.length > 0) {
      const { smoothness } = calculateDrawingFeatures(allPathsRef.current);
      setFeedbackData(getAttemptBadge(smoothness));
    }
  }, [hasDrawn]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        startTimeRef.current = Date.now();
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY, t: 0 }]);
        if (allPathsRef.current.length === 0) {
          playLetterSoundRef.current?.();
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => [...prev, {
          x: locationX, y: locationY, t: Date.now() - startTimeRef.current,
        }]);
      },
      onPanResponderRelease: () => {
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setHasDrawn(true);
          }
          return [];
        });
      },
    })
  ).current;

  const resetCanvas = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setHasDrawn(false);
    setFeedbackData(null);
  }, []);

  const handleClear = useCallback(() => resetCanvas(), [resetCanvas]);

  const showCelebrationFor = useCallback((data, nextCategory, isAllDone) => {
    setCelebration({ data, nextCategory, isAllDone });
    celebScale.setValue(0.5);
    celebOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(celebScale,   { toValue: 1, friction: 6, useNativeDriver: false }),
      Animated.timing(celebOpacity, { toValue: 1, duration: 260, useNativeDriver: false }),
    ]).start();
  }, [celebOpacity, celebScale]);

  const handleNext = useCallback(async () => {
    const features = calculateDrawingFeatures(allPathsRef.current);
    await storeLetterProgress(student.sid, letter, {
      attempt,
      deviation:      0,
      pauseCount:     features.pauseCount,
      completionTime: features.completionTime,
      strokeCount:    features.strokeCount,
      smoothness:     features.smoothness,
    });

    if (isLastAttempt) {
      client.post(ENDPOINTS.LETTER_COMPLETE, {
        student_id: student.sid,
        letter,
        case_type: caseType,
      }).catch(() => {});
    }

    if (!isLastAttempt) {
      setAttempt(a => a + 1);
      resetCanvas();
      return;
    }

    if (isLastLetter) {
      showCelebrationFor(ALL_DONE_CELEBRATION, null, true);
      resetCanvas();
      return;
    }

    const currentCat = sequence[letterIdx]?.category;
    const nextCat    = sequence[letterIdx + 1]?.category;

    if (currentCat !== nextCat) {
      showCelebrationFor(
        CATEGORY_CELEBRATION[currentCat] ?? CATEGORY_CELEBRATION.mixed,
        nextCat,
        false
      );
      resetCanvas();
    } else {
      setLetterIdx(i => i + 1);
      setAttempt(1);
      resetCanvas();
    }
  }, [attempt, isLastAttempt, isLastLetter, letter, letterIdx,
      resetCanvas, sequence, showCelebrationFor, student.sid]);

  const handleDismissCelebration = useCallback(() => {
    const isAllDone = celebration?.isAllDone;
    setCelebration(null);
    if (isAllDone) {
      navigation.goBack();
    } else {
      setLetterIdx(i => i + 1);
      setAttempt(1);
    }
  }, [celebration, navigation]);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={theme.headingText} />
          </TouchableOpacity>

          <Text style={[styles.counterText, { color: theme.headingText }]}>
            {letterIdx + 1} / {sequence.length}
          </Text>

          <View style={styles.attemptDots}>
            {[1, 2, 3].map(n => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n < attempt   && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { backgroundColor: 'transparent', borderColor: theme.button },
                  n > attempt   && { backgroundColor: 'transparent', borderColor: theme.button + '40' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main area: letter card LEFT · content RIGHT */}
        <View style={styles.mainRow}>

          {/* Left column — large letter card */}
          <View style={styles.letterCol}>
            <View style={[styles.letterCard, { backgroundColor: theme.button }]}>
              <Text style={[styles.letterCardText, { color: theme.buttonText }]}>
                {letter}
              </Text>
            </View>
          </View>

          {/* Right column — title + phonetic + badge + canvas */}
          <View style={styles.contentCol}>

            {/* Title card */}
            <View style={[styles.titleCard, {
              backgroundColor: theme.button + '14',
              borderColor:     theme.button + '35',
            }]}>
              <Text style={[styles.writeLabel, { color: theme.headingText }]}>
                Write '{letter.toUpperCase()}'
              </Text>
              <TouchableOpacity
                style={[styles.soundBtn, { backgroundColor: theme.button }]}
                onPress={() => playLetterSound()}
                activeOpacity={0.75}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="volume-high" size={18} color={theme.buttonText} />
              </TouchableOpacity>
            </View>

            {/* Phonetic */}
            <Text style={[styles.phoneticText, { color: theme.headingText }]}>
              {phonetic}
            </Text>

            {/* Attempt badge */}
            <View style={[styles.attemptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.attemptTitle, { color: badge.text }]}>
                {ATTEMPT_TITLES[attempt]}
              </Text>
              <Text style={[styles.attemptHint, { color: badge.text }]}>
                {ATTEMPT_HINTS[attempt]}
              </Text>
            </View>

            {/* Writing canvas */}
            <View style={styles.canvasOuter}>
              <View
                style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
                {...panResponder.panHandlers}
              >
                <Svg width={CANVAS_W} height={CANVAS_H}>

                  <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
                  <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
                  <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
                  <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

                  {guideOpacity > 0 && (
                    <SvgText
                      x={CANVAS_W / 2}
                      y={LINE_3}
                      textAnchor="middle"
                      fontSize={GHOST_FONT_UPPER}
                      fill={`rgba(60,60,180,${guideOpacity})`}
                      fontWeight="bold"
                    >
                      {letter}
                    </SvgText>
                  )}

                  {attempt === 2 && (
                    <>
                      <Circle
                        cx={startPos.fx * CANVAS_W}
                        cy={startPos.fy * CANVAS_H}
                        r={9} fill={theme.button} opacity={0.80}
                      />
                      <SvgText
                        x={startPos.fx * CANVAS_W + 17}
                        y={startPos.fy * CANVAS_H + 5}
                        fontSize={14} fill={theme.button} fontWeight="bold"
                      >
                        1
                      </SvgText>
                    </>
                  )}

                  {allPaths.map((stroke, i) => (
                    <Polyline
                      key={i}
                      points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}

                  {currentPath.length > 1 && (
                    <Polyline
                      points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={0.75}
                    />
                  )}

                </Svg>
              </View>

              {attempt === 1 && !hasDrawn && tracerVisible && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Animated.View
                    style={[
                      styles.tracerDot,
                      {
                        backgroundColor: theme.button,
                        transform: [
                          { translateX: tracerX },
                          { translateY: tracerY },
                        ],
                      },
                    ]}
                  />
                </View>
              )}
            </View>

          </View>
        </View>

        {/* Feedback pill */}
        {feedbackData && (
          <View style={[styles.feedbackBadge, { backgroundColor: feedbackData.bg }]}>
            <Text style={[styles.feedbackText, { color: feedbackData.color }]}>
              {feedbackData.label}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.headingText} />
            <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
          </TouchableOpacity>

          {hasDrawn && (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextText, { color: theme.buttonText }]}>
                {isLastAttempt
                  ? (isLastLetter ? 'Finish ✓' : 'Next Letter →')
                  : `Attempt ${attempt + 1} →`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom attempt dots */}
        <View style={styles.bottomDots}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n < attempt   && { backgroundColor: theme.button, borderColor: theme.button },
                n === attempt && { borderColor: theme.button },
                n > attempt   && { borderColor: theme.button + '40' },
              ]}
            />
          ))}
        </View>

        {/* Celebration overlay */}
        {celebration && (
          <View style={styles.celebOverlay}>
            <LinearGradient
              colors={theme.backgroundGradient}
              style={styles.celebGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Animated.View
                style={[styles.celebCard, {
                  opacity:   celebOpacity,
                  transform: [{ scale: celebScale }],
                }]}
              >
                <View style={[styles.celebIconWrap, { backgroundColor: celebration.data.color + '18' }]}>
                  <Ionicons name={celebration.data.icon} size={52} color={celebration.data.color} />
                </View>
                <Text style={[styles.celebTitle, { color: celebration.data.color }]}>
                  {celebration.data.title}
                </Text>
                <Text style={styles.celebMessage}>{celebration.data.message}</Text>

                {!celebration.isAllDone && celebration.nextCategory && (
                  <View style={[styles.celebNextBadge, { backgroundColor: celebration.data.color + '12', borderColor: celebration.data.color + '30' }]}>
                    <Text style={styles.celebNextLabel}>Up next: </Text>
                    <Text style={[styles.celebNextValue, { color: celebration.data.color }]}>
                      {NEXT_CATEGORY_LABEL[celebration.nextCategory]}
                    </Text>
                  </View>
                )}

                <View style={styles.celebStars}>
                  {[1, 2, 3].map(i => (
                    <Ionicons key={i} name="star" size={30} color="#FFCA28" />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.celebBtn, { backgroundColor: theme.button }]}
                  onPress={handleDismissCelebration}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.celebBtnText, { color: theme.buttonText }]}>
                    {celebration.isAllDone ? 'All done!' : 'Keep going!'}
                  </Text>
                  <Ionicons
                    name={celebration.isAllDone ? 'checkmark-circle-outline' : 'arrow-forward'}
                    size={18}
                    color={theme.buttonText}
                  />
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>
          </View>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontSize: 13, fontWeight: '700' },
  attemptDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },

  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },
  letterCol: {
    width: COL_L,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  letterCard: {
    width: LETTER_CARD_SIZE,
    height: LETTER_CARD_SIZE,
    borderRadius: Math.round(LETTER_CARD_SIZE * 0.22),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  letterCardText: {
    fontSize: Math.round(LETTER_CARD_SIZE * 0.60),
    fontWeight: '900',
    lineHeight: Math.round(LETTER_CARD_SIZE * 0.75),
  },
  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  writeLabel: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  soundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  phoneticText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    opacity: 0.65,
    paddingLeft: 2,
  },

  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  attemptTitle: { fontSize: 12, fontWeight: '800' },
  attemptHint:  { fontSize: 10, marginTop: 2, textAlign: 'center', opacity: 0.85 },

  canvasOuter: {
    width:  CANVAS_W,
    height: CANVAS_H,
  },
  canvasCard: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  tracerDot: {
    position: 'absolute',
    left: -15,
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
  },

  feedbackBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },

  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAD,
    paddingVertical: 6,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  clearText: { fontSize: 14, fontWeight: '600' },
  nextBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: { fontSize: 14, fontWeight: '800' },

  celebOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
  },
  celebGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  celebCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  celebIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  celebTitle:     { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  celebMessage:   { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebNextBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
  },
  celebNextLabel: { fontSize: 13, color: '#777777' },
  celebNextValue: { fontSize: 13, fontWeight: '800' },
  celebStars:     { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 40, paddingVertical: 14, borderRadius: 50, width: '100%',
  },
  celebBtnText: { fontSize: 17, fontWeight: '800' },
});
