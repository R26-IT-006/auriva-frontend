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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { VideoView, useVideoPlayer } from 'expo-video';
import WORD_DATA from '../../../constants/wordData';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import WORD_VIDEOS from '../../../constants/wordVideos';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

// Two-column split — all sizes relative to screen, zero hardcoded pixels
const COL_L    = Math.round(SCREEN_W * 0.43);           // left column (image)
const IMG_SIZE = COL_L - 8;                              // image fills the column
const CANVAS_W = SCREEN_W - COL_L - PAD * 2;            // canvas = right column width
const CANVAS_H = Math.round(SCREEN_H * 0.35);           // 35 % of screen height

// 4-line handwriting ruling
const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
const LINE_3 = Math.round(CANVAS_H * 0.70);  // baseline     — red dashed
const LINE_4 = Math.round(CANVAS_H * 0.90);  // descender    — blue solid

// ─── Attempt colours ──────────────────────────────────────────────────────────
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

// ─── Length-group celebrations ────────────────────────────────────────────────
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

// Uppercase words (capital first letter): cap-height fills LINE_1 → LINE_3.
// Lowercase-only words: x-height fills LINE_2 → LINE_3.
const GHOST_FONT_UPPER = Math.round((LINE_3 - LINE_1) / 0.71);
const GHOST_FONT_LOWER = Math.round((LINE_3 - LINE_2) / 0.52);

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function getFeedback(sm) {
  if (sm < 0.15) return { label: 'Excellent! ✓',   color: '#2E7D32', bg: '#E8F5E9' };
  if (sm < 0.35) return { label: 'Good effort! ✓', color: '#E65100', bg: '#FFF3E0' };
  return                 { label: 'Keep going!',    color: '#C62828', bg: '#FFEBEE' };
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const ghostFontSize = /[A-Z]/.test(displayWord[0]) ? GHOST_FONT_UPPER : GHOST_FONT_LOWER;
  const spelling      = getSpelling(word);

  // ── Speech ─────────────────────────────────────────────────────────────────
  const spellWord = useCallback((w = word) => {
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
    Animated.spring(imageScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
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
      setFeedbackData(getFeedback(calculateSmoothness(allPathsRef.current)));
    }
  }, [hasDrawn]);

  // ── PanResponder ───────────────────────────────────────────────────────────
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

  // ── Canvas helpers ─────────────────────────────────────────────────────────
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
      Animated.spring(celebScale,   { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(celebOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
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

  const startDotX = CANVAS_W * 0.07;
  const startDotY = LINE_2;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* ── Compact header ── */}
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

        {/* ── Main area: image LEFT · content RIGHT ── */}
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

            {/* Writing canvas */}
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

                {/* Ghost word — uppercase uses cap zone (LINE_1→LINE_3),
                    lowercase uses x-height zone (LINE_2→LINE_3);
                    textLength compresses wide words to fit canvas width */}
                {guideOpacity > 0 && (
                  <SvgText
                    x={CANVAS_W / 2}
                    y={LINE_3}
                    textAnchor="middle"
                    fontSize={ghostFontSize}
                    textLength={CANVAS_W * 0.88}
                    lengthAdjust="spacingAndGlyphs"
                    fill={`rgba(80,80,200,${guideOpacity})`}
                    fontWeight="bold"
                  >
                    {displayWord}
                  </SvgText>
                )}

                {/* Start dot (attempt 2) */}
                {attempt === 2 && (
                  <>
                    <Circle cx={startDotX} cy={startDotY} r={8} fill={theme.button} opacity={0.80} />
                    <SvgText x={startDotX + 14} y={startDotY + 5} fontSize={12} fill={theme.button} fontWeight="bold">
                      1
                    </SvgText>
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

          </View>
        </View>

        {/* ── Feedback pill ── */}
        {feedbackData && (
          <View style={[styles.feedbackPill, { backgroundColor: feedbackData.bg }]}>
            <Text style={[styles.feedbackText, { color: feedbackData.color }]}>
              {feedbackData.label}
            </Text>
          </View>
        )}

        {/* ── Buttons ── */}
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

        {/* ── Attempt dots ── */}
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

      {/* ── Celebration overlay ── */}
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

      {/* ── Word video modal ── */}
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

// ─── Word video modal ─────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Header ───────────────────────────────────────────────────────────────────
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

  // ── Main two-column layout ────────────────────────────────────────────────────
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

  // ── Feedback pill ─────────────────────────────────────────────────────────────
  feedbackPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 50,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  // ── Buttons ───────────────────────────────────────────────────────────────────
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

  // ── Attempt dots (bottom) ─────────────────────────────────────────────────────
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

  // ── Celebration overlay ───────────────────────────────────────────────────────
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
