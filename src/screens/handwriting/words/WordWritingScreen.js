import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Animated,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Polygon, Path, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { VideoView, useVideoPlayer } from 'expo-video';
import WORD_DATA from '../../../constants/wordData';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import WORD_VIDEOS from '../../../constants/wordVideos';
import {
  buildWordGuide,
  wordGuideToSvgPath,
  wordGuideGhostDots,
  buildWordTracerStrokes,
  getWordStrokeDirectionHint,
  computeWordDTW,
} from '../../../constants/wordPaths';
import { featuresToScore } from '../../../utils/adaptiveSequencing';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

// Two-column split — all sizes relative to screen, zero hardcoded pixels.
// Image column is deliberately narrow (vs. the 0.43 letter-tracing screens
// use for one big letter) so the canvas gets most of the width — a whole
// word needs far more horizontal room than a single letter does.
const COL_L    = Math.round(SCREEN_W * 0.28);           // left column (image)
const IMG_SIZE = COL_L - 8;                              // image fills the column
const CANVAS_W = SCREEN_W - COL_L - PAD * 2;            // canvas = right column width
const CANVAS_H = Math.round(SCREEN_H * 0.46);           // 46 % of screen height

// 4-line handwriting ruling — baseline/descender match the LETTER_PATHS
// fy=0.64/0.92 convention so the word guide sits exactly on these lines.
const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
const LINE_3 = Math.round(CANVAS_H * 0.64);  // baseline     — red dashed
const LINE_4 = Math.round(CANVAS_H * 0.92);  // descender    — blue solid

// â”€â”€â”€ Attempt colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  1: 'Listen to the letters — then trace the word!',
  2: 'Trace the word — ① marks where to start.',
  3: 'Write the word from memory — no guide this time!',
};

// â”€â”€â”€ Length-group celebrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LENGTH_CELEBRATIONS = {
  3: {
    emoji: '⭐', title: 'Short Words Done!',
    message: 'Great job writing the short words!\nReady for longer ones?',
    gradient: ['#E3F2FD', '#BBDEFB'], color: '#1565C0',
  },
  4: {
    emoji: '🌟', title: '4-Letter Words Done!',
    message: "You're getting stronger!\nTime for the longer words.",
    gradient: ['#F3E5F5', '#E1BEE7'], color: '#6A1B9A',
  },
  5: {
    emoji: '🏆', title: 'Long Words Done!',
    message: 'You nailed all the long words!\nAmazing work!',
    gradient: ['#FFF8E1', '#FFE082'], color: '#E65100',
  },
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getLengthGroup(word) {
  const l = word.length;
  if (l <= 3) return 3;
  if (l <= 4) return 4;
  return 5;
}

function getSpelling(word) {
  return word.replace(/[^a-z]/gi, '').split('').join(' · ');
}

function calculateSmoothness(paths) {
  const all = paths.flat();
  if (all.length < 3) return 0;
  const changes = [];
  for (let i = 1; i < all.length - 1; i++) {
    const v1x = all[i].x - all[i-1].x, v1y = all[i].y - all[i-1].y;
    const v2x = all[i+1].x - all[i].x, v2y = all[i+1].y - all[i].y;
    const l1 = Math.sqrt(v1x*v1x + v1y*v1y);
    const l2 = Math.sqrt(v2x*v2x + v2y*v2y);
    if (l1 > 0 && l2 > 0) {
      changes.push(Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / (l1*l2)))));
    }
  }
  return changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
}

// Score comes from featuresToScore({ smoothness, dtw_distance }) — the same
// weighting letter tracing uses, so word feedback is on the same 0-100 scale.
function getFeedbackFromScore(score) {
  if (score >= 75) return { label: 'Excellent! ✓',   color: '#2E7D32', bg: '#E8F5E9' };
  if (score >= 50) return { label: 'Good effort! ✓', color: '#E65100', bg: '#FFF3E0' };
  return                   { label: 'Keep going!',    color: '#C62828', bg: '#FFEBEE' };
}

// Slower than letter tracing's tracer (0.28 px/ms) — a whole word is a lot
// more path for a child to visually follow than one letter.
const TRACER_PX_PER_MS = 0.16;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WordWritingScreen({ route, navigation }) {
  const { student, theme, letter = 'a' } = route.params;

  const letterWords = useMemo(() =>
    WORD_DATA
      .filter(e => e.letter === letter)
      .sort((a, b) => getLengthGroup(a.word) - getLengthGroup(b.word)),
    [letter]
  );

  const letterDoneCelebration = useMemo(() => ({
    emoji: '🎯',
    title: `Letter ${letter.toUpperCase()} Complete!`,
    message: `You practised all '${letter.toUpperCase()}' words!\nTime to test your skills!`,
    gradient: ['#E8F5E9', '#C8E6C9'],
    color: '#2E7D32',
  }), [letter]);

  const [wordIdx,       setWordIdx]       = useState(0);
  const [attempt,       setAttempt]       = useState(1);
  const [currentPath,   setCurrentPath]   = useState([]);
  const [allPaths,      setAllPaths]      = useState([]);
  const [hasDrawn,      setHasDrawn]      = useState(false);
  const [feedbackData,  setFeedbackData]  = useState(null);
  const [celebration,   setCelebration]   = useState(null);
  const [showWordVideo, setShowWordVideo] = useState(() => {
    const entry = letterWords[0];
    return !!(entry && WORD_VIDEOS[entry.word]);
  });
  const [reduceMotion,    setReduceMotion]    = useState(false);
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);
  const tracerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const src = WORD_VIDEOS[letterWords[wordIdx]?.word] ?? null;
    if (src) setShowWordVideo(true);
  }, [wordIdx, letterWords]);

  const allPathsRef    = useRef([]);
  const startTimeRef   = useRef(null);
  const spellCancelRef = useRef(false);
  const spellTimersRef = useRef([]);

  const celebScale   = useRef(new Animated.Value(0.5)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;
  const imageScale   = useRef(new Animated.Value(0.85)).current;

  const wordEntry     = letterWords[wordIdx];
  const word          = wordEntry?.word  ?? letter;
  const emoji         = wordEntry?.emoji ?? '📝';
  const imageKey      = wordEntry?.imageKey ?? '';
  const isLastWord    = wordIdx >= letterWords.length - 1;
  const isLastAttempt = attempt === 3;
  const guideOpacity  = attempt === 3 ? 0 : attempt === 1 ? 0.15 : 0.28;
  const badge         = ATTEMPT_BADGE[attempt];
  const displayWord   = word.charAt(0).toUpperCase() + word.slice(1);
  const spelling      = getSpelling(word);

  // â”€â”€ Reference-path guide (same LETTER_PATHS-based system as letter tracing) â”€â”€
  const wordGuide = useMemo(() => buildWordGuide(word), [word]);
  const guidePathD = useMemo(
    () => wordGuideToSvgPath(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );
  const guideDots = useMemo(
    () => wordGuideGhostDots(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );

  // Attempt-2 stroke-order marker — advances through the word's strokes as
  // each one is completed, exactly like letter tracing's activeGuideStroke.
  const activeGuideStroke = Math.min(allPaths.length, wordGuide.strokeDescriptors.length - 1);
  const activeStrokeDesc  = wordGuide.strokeDescriptors[activeGuideStroke] ?? null;
  const activeDirectionHint = useMemo(
    () => activeStrokeDesc
      ? getWordStrokeDirectionHint(activeStrokeDesc.points, CANVAS_W, CANVAS_H, activeStrokeDesc.angular)
      : null,
    [activeStrokeDesc]
  );

  const tracerXInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.xRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  const tracerYInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.yRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  // â”€â”€ Tracer dot animation for Attempt 1 ("Watch & Trace") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (reduceMotion || attempt !== 1 || hasDrawn || wordGuide.strokeDescriptors.length === 0) {
      setTracerVisible(false);
      return undefined;
    }

    const perStroke = buildWordTracerStrokes(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H);

    const inputRange = [];
    const xRange = [];
    const yRange = [];
    const strokeBounds = [];
    let offset = 0;
    for (const { points } of perStroke) {
      if (points.length === 0) continue;
      const start = offset;
      for (let k = 0; k < points.length; k++) {
        inputRange.push(offset + k);
        xRange.push(points[k].x);
        yRange.push(points[k].y);
      }
      offset += points.length;
      strokeBounds.push({ start, end: offset - 1 });
    }

    if (inputRange.length < 2) { setTracerVisible(false); return undefined; }

    setTracerKeyframes({ inputRange, xRange, yRange });
    tracerProgress.setValue(0);
    setTracerVisible(true);

    const strokeAnims = [];
    for (let s = 0; s < strokeBounds.length; s++) {
      if (s > 0) {
        strokeAnims.push(Animated.delay(320));
        strokeAnims.push(Animated.timing(tracerProgress, {
          toValue: strokeBounds[s].start, duration: 1, useNativeDriver: true,
        }));
      }
      const len = perStroke[s].totalLength;
      const dur = Math.max(400, Math.round(len / TRACER_PX_PER_MS));
      strokeAnims.push(Animated.timing(tracerProgress, {
        toValue: strokeBounds[s].end, duration: dur, useNativeDriver: true,
      }));
    }

    const anim = Animated.loop(
      Animated.sequence([Animated.delay(500), ...strokeAnims, Animated.delay(1200)]),
      { resetBeforeIteration: true }
    );
    anim.start();

    return () => {
      setTracerVisible(false);
      anim.stop();
    };
  }, [attempt, hasDrawn, wordGuide, reduceMotion, tracerProgress]);

  // â”€â”€ Speech â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const MUTED_WRITING_WORDS = new Set(['axe', 'album', 'arrow']);

  const spellWord = useCallback((w = word) => {
    if (MUTED_WRITING_WORDS.has(w)) return;
    spellCancelRef.current = true;
    spellTimersRef.current.forEach(clearTimeout);
    spellTimersRef.current = [];
    Speech.stop();

    spellCancelRef.current = false;
    const letters = w.replace(/[^a-z]/gi, '').split('');
    let delay = 200;
    letters.forEach(ltr => {
      const t = setTimeout(() => {
        if (!spellCancelRef.current)
          Speech.speak(ltr.toUpperCase(), { rate: 0.8, language: 'en-US' });
      }, delay);
      spellTimersRef.current.push(t);
      delay += 750;
    });
    const ft = setTimeout(() => {
      if (!spellCancelRef.current)
        Speech.speak(w.replace(/-/g, ' '), { rate: 0.82, language: 'en-US' });
    }, delay + 350);
    spellTimersRef.current.push(ft);
  }, [word]);

  const spellWordRef = useRef(spellWord);
  spellWordRef.current = spellWord;

  // Bounce image in on each new word
  useEffect(() => {
    imageScale.setValue(0.85);
    Animated.spring(imageScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: false }).start();
  }, [wordIdx, imageScale]);

  // Stop speech when leaving the screen
  useEffect(() => {
    return () => {
      spellCancelRef.current = true;
      spellTimersRef.current.forEach(clearTimeout);
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (hasDrawn && allPathsRef.current.length > 0) {
      const smoothness   = calculateSmoothness(allPathsRef.current);
      const dtw_distance = computeWordDTW(wordGuide.rawPath, allPathsRef.current, CANVAS_W, CANVAS_H);
      const score = featuresToScore({ smoothness, dtw_distance });
      setFeedbackData(getFeedbackFromScore(score));
    }
  }, [hasDrawn, wordGuide]);

  // â”€â”€ PanResponder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        startTimeRef.current = Date.now();
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY, t: 0 }]);
        if (allPathsRef.current.length === 0) spellWordRef.current?.();
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => [
          ...prev, { x: locationX, y: locationY, t: Date.now() - startTimeRef.current },
        ]);
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

  // â”€â”€ Canvas helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetCanvas = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setHasDrawn(false);
    setFeedbackData(null);
    spellCancelRef.current = true;
    spellTimersRef.current.forEach(clearTimeout);
    Speech.stop();
  }, []);

  const showCelebration = useCallback((data, isAllDone) => {
    setCelebration({ data, isAllDone });
    celebScale.setValue(0.5);
    celebOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(celebScale,   { toValue: 1, friction: 6, useNativeDriver: false }),
      Animated.timing(celebOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
    ]).start();
  }, [celebScale, celebOpacity]);

  const handleNext = useCallback(() => {
    if (!isLastAttempt) {
      setAttempt(a => a + 1);
      resetCanvas();
      return;
    }
    if (isLastWord) {
      showCelebration(letterDoneCelebration, true);
      resetCanvas();
      return;
    }
    const currentGroup = getLengthGroup(letterWords[wordIdx].word);
    const nextGroup    = getLengthGroup(letterWords[wordIdx + 1].word);
    if (nextGroup > currentGroup) {
      showCelebration(LENGTH_CELEBRATIONS[currentGroup] ?? LENGTH_CELEBRATIONS[5], false);
      resetCanvas();
    } else {
      setWordIdx(i => i + 1);
      setAttempt(1);
      resetCanvas();
    }
  }, [isLastAttempt, isLastWord, wordIdx, letterWords, letterDoneCelebration, resetCanvas, showCelebration]);

  const handleDismissCelebration = useCallback(() => {
    const done = celebration?.isAllDone;
    setCelebration(null);
    if (done) {
      navigation.replace('WordPractice', { student, theme, letter });
    } else {
      setWordIdx(i => i + 1);
      setAttempt(1);
    }
  }, [celebration, navigation, student, theme, letter]);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* â”€â”€ Compact header â”€â”€ */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.letterBadge, { backgroundColor: theme.button }]}>
              <Text style={[styles.letterBadgeText, { color: theme.buttonText }]}>
                {letter.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.counterText, { color: theme.headingText }]}>
              {wordIdx + 1} / {letterWords.length}
            </Text>
          </View>

          <View style={styles.headerDots}>
            {[1, 2, 3].map(n => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { borderColor: theme.button },
                  n > attempt  && { borderColor: theme.button + '40' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* â”€â”€ Main area: image LEFT · content RIGHT â”€â”€ */}
        <View style={styles.mainRow}>

          {/* Left column — large image */}
          <View style={styles.imageCol}>
            <Animated.View style={{ transform: [{ scale: imageScale }] }}>
              <WordImageDisplay imageKey={imageKey} emoji={emoji} size={IMG_SIZE} />
            </Animated.View>
          </View>

          {/* Right column — word card + spelling + badge + canvas */}
          <View style={styles.contentCol}>

            {/* Word title card */}
            <View style={[styles.wordCard, {
              backgroundColor: theme.button + '14',
              borderColor:     theme.button + '35',
            }]}>
              <Text
                style={[styles.wordTitle, { color: theme.headingText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {displayWord}
              </Text>
              <TouchableOpacity
                style={[styles.soundBtn, { backgroundColor: theme.button }]}
                onPress={() => spellWordRef.current?.()}
                activeOpacity={0.75}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="volume-high" size={18} color={theme.buttonText} />
              </TouchableOpacity>
            </View>

            {/* Spelling */}
            <Text style={[styles.spellingText, { color: theme.headingText }]}>
              {spelling}
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

            {/* Writing canvas — canvasOuter wraps the card so the tracer dot
                is never clipped by the card's overflow:hidden */}
            <View style={styles.canvasOuter}>
              <View
                style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
                {...panResponder.panHandlers}
              >
                <Svg width={CANVAS_W} height={CANVAS_H}>

                  {/* 4-line ruling */}
                  <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
                  <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
                  <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
                  <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

                  {/* Reference-path guide — built from the same per-letter
                      LETTER_PATHS waypoints letter tracing uses, laid out
                      left-to-right across the word. Ghost dots mark single-
                      point strokes (the 'i' / 'j' dots). */}
                  {guideOpacity > 0 && guidePathD && (
                    <>
                      <Path
                        d={guidePathD}
                        stroke={`rgba(80,80,80,${guideOpacity})`}
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      {guideDots.map((dot, idx) => (
                        <Circle
                          key={`ghost-dot-${idx}`}
                          cx={dot.cx}
                          cy={dot.cy}
                          r={3.5}
                          fill={`rgba(80,80,80,${guideOpacity})`}
                        />
                      ))}
                    </>
                  )}

                  {/* Stroke-order marker (attempt 2) — same system as letter
                      tracing: numbered start dot + direction arrow(s) for
                      the current stroke, advancing letter by letter as each
                      stroke is completed. Number resets per letter (1, 2, 3…),
                      matching what single-letter tracing shows. */}
                  {attempt === 2 && activeStrokeDesc && activeDirectionHint && (
                    <>
                      <Circle
                        cx={activeDirectionHint.start.x}
                        cy={activeDirectionHint.start.y}
                        r={11}
                        fill="none"
                        stroke={theme.button}
                        strokeWidth={2}
                        opacity={0.72}
                      />
                      <Circle
                        cx={activeDirectionHint.start.x}
                        cy={activeDirectionHint.start.y}
                        r={8}
                        fill={theme.button}
                        opacity={0.80}
                      />
                      <SvgText
                        x={activeDirectionHint.start.x}
                        y={activeDirectionHint.start.y + 4}
                        fontSize={11}
                        fill={theme.buttonText ?? '#FFFFFF'}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {activeStrokeDesc.localStrokeIndex + 1}
                      </SvgText>
                      {activeDirectionHint.endGuides.map((guide, index) => (
                        <Circle
                          key={`stroke-end-${index}`}
                          cx={guide.x}
                          cy={guide.y}
                          r={index === activeDirectionHint.endGuides.length - 1 ? 6 : 4.5}
                          fill="none"
                          stroke={theme.button}
                          strokeWidth={2}
                          opacity={0.72}
                        />
                      ))}
                      {activeDirectionHint.arrows.map((arrow, index) => (
                        <React.Fragment key={`stroke-arrow-${index}`}>
                          <Line
                            x1={arrow.shaftStart.x}
                            y1={arrow.shaftStart.y}
                            x2={arrow.tip.x}
                            y2={arrow.tip.y}
                            stroke={theme.button}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                          />
                          <Polygon points={arrow.arrowHead} fill={theme.button} />
                        </React.Fragment>
                      ))}
                    </>
                  )}

                  {/* Completed strokes */}
                  {allPaths.map((stroke, i) => (
                    <Polyline
                      key={i}
                      points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}

                  {/* Live stroke */}
                  {currentPath.length > 1 && (
                    <Polyline
                      points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                      stroke={theme.button}
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={0.75}
                    />
                  )}

                </Svg>
              </View>

              {/* Tracer dot — traces the whole word guide during Attempt 1 */}
              {attempt === 1 && !hasDrawn && tracerVisible && tracerXInterp && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Animated.View
                    style={[
                      styles.tracerDot,
                      {
                        backgroundColor: theme.button,
                        transform: [
                          { translateX: tracerXInterp },
                          { translateY: tracerYInterp },
                        ],
                      },
                    ]}
                  />
                </View>
              )}
            </View>

          </View>
        </View>

        {/* â”€â”€ Feedback pill â”€â”€ */}
        {feedbackData && (
          <View style={[styles.feedbackPill, { backgroundColor: feedbackData.bg }]}>
            <Text style={[styles.feedbackText, { color: feedbackData.color }]}>
              {feedbackData.label}
            </Text>
          </View>
        )}

        {/* â”€â”€ Buttons â”€â”€ */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={resetCanvas}
            activeOpacity={0.7}
          >
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
                  ? (isLastWord ? 'Finish! 🎯' : 'Next Word →')
                  : `Attempt ${attempt + 1} →`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* â”€â”€ Attempt dots â”€â”€ */}
        <View style={styles.bottomDots}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                n === attempt && { borderColor: theme.button },
                n > attempt  && { borderColor: theme.button + '40' },
              ]}
            />
          ))}
        </View>

      </SafeAreaView>

      {/* â”€â”€ Celebration overlay â”€â”€ */}
      {celebration && (
        <View style={styles.celebOverlay}>
          <LinearGradient
            colors={celebration.data.gradient}
            style={styles.celebGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Animated.View style={[styles.celebCard, {
              opacity:   celebOpacity,
              transform: [{ scale: celebScale }],
            }]}>
              <Text style={styles.celebEmoji}>{celebration.data.emoji}</Text>
              <Text style={[styles.celebTitle, { color: celebration.data.color }]}>
                {celebration.data.title}
              </Text>
              <Text style={styles.celebMessage}>{celebration.data.message}</Text>
              <View style={styles.celebStars}>
                {['⭐','⭐','⭐'].map((s, i) => (
                  <Text key={i} style={styles.celebStar}>{s}</Text>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.celebBtn, { backgroundColor: celebration.data.color }]}
                onPress={handleDismissCelebration}
                activeOpacity={0.85}
              >
                <Text style={styles.celebBtnText}>
                  {celebration.isAllDone ? 'Start Activities! 🎯' : 'Keep Going! →'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>
        </View>
      )}

      {/* â”€â”€ Word video modal â”€â”€ */}
      {showWordVideo && wordEntry && WORD_VIDEOS[wordEntry.word] && (
        <WordVideoModal
          videoSource={WORD_VIDEOS[wordEntry.word]}
          theme={theme}
          onDismiss={() => setShowWordVideo(false)}
        />
      )}

    </LinearGradient>
  );
}

// â”€â”€â”€ Word video modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WordVideoModal({ videoSource, theme, onDismiss }) {
  const player = useVideoPlayer(videoSource, p => { p.loop = false; p.play(); });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onDismiss);
    return () => sub.remove();
  }, [player]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onDismiss}>
        <LinearGradient
          colors={theme.backgroundGradient}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <VideoView
            player={player}
            style={{ width: SCREEN_W, flex: 1 }}
            contentFit="contain"
            nativeControls={false}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Modal>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  letterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBadgeText: { fontSize: 14, fontWeight: '900' },
  counterText:     { fontSize: 13, fontWeight: '700' },
  headerDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  // â”€â”€ Main two-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },

  // Left: large image, centered vertically
  imageCol: {
    width: COL_L,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },

  // Right: stacked content
  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  // Word title card (rounded box with light theme tint)
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wordTitle: {
    fontSize: 30,
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

  // Spelling  (a · p · p · l · e)
  spellingText: {
    fontSize: 12,
    fontStyle: 'italic',
    letterSpacing: 1.5,
    opacity: 0.65,
    paddingLeft: 2,
  },

  // Attempt badge
  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  attemptTitle: { fontSize: 12, fontWeight: '800' },
  attemptHint:  { fontSize: 10, marginTop: 2, textAlign: 'center', opacity: 0.85 },

  // Canvas
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

  // â”€â”€ Tracer dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tracerDot: {
    position: 'absolute',
    left: -13,
    top: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
  },

  // â”€â”€ Feedback pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  feedbackPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 50,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAD,
    paddingVertical: 6,
  },
  clearBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 50,
  },
  clearText: { fontSize: 13, fontWeight: '600' },
  nextBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: { fontSize: 13, fontWeight: '800' },

  // â”€â”€ Attempt dots (bottom) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },

  // â”€â”€ Celebration overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  celebEmoji:   { fontSize: 64, marginBottom: 16 },
  celebTitle:   { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  celebMessage: { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebStars:   { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebStar:    { fontSize: 28 },
  celebBtn:     { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 50, width: '100%', alignItems: 'center' },
  celebBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
});

