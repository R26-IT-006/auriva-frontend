import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptItemsForCategory } from '../../../data/conceptData';
import { conceptApi } from '../../../api/concept';
import { Layout } from '../../../constants/layout';

const CORRECT_GIF = require('../../../../assets/feedback/correct.gif');
const WRONG_GIF   = require('../../../../assets/feedback/wrong.gif');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(allItems, conceptKey) {
  const idx   = allItems.findIndex((it) => it.key === conceptKey);
  const next1 = allItems[(idx + 1) % allItems.length];
  const next2 = allItems[(idx + 2) % allItems.length];
  return [allItems[idx], next1, next2];
}

export default function Tier2DragDropScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept  = getConceptItem(category.key, conceptKey);
  const allItems = getConceptItemsForCategory(category.key);
  const theme    = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const H_PAD    = Layout.spacing.md;
  const CARD_GAP = 12;
  const CARD_W   = ((width - H_PAD * 2 - CARD_GAP * 2) / 3) * 0.48;
  const CARD_H   = CARD_W;
  const IMG_SIZE = Math.floor(Math.min(CARD_W * 0.78, CARD_H * 0.68));
  const ZONE_SIZE = Math.min(width, height) * 0.28;

  const baseOptions = useRef(buildOptions(allItems, conceptKey));

  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [displayOptions, setDisplayOptions] = useState(() => shuffle(baseOptions.current));
  const [attempts,       setAttempts]       = useState([]);
  const [locked,         setLocked]         = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [hintKey,        setHintKey]        = useState(null);
  const [zoneContent,    setZoneContent]    = useState(null); // { source, isCorrect }
  const [droppedKey,     setDroppedKey]     = useState(null); // card left in the box

  const feedbackSlide  = useRef(new Animated.Value(250)).current;
  const dropZoneLayout = useRef(null);
  const dropZoneRef    = useRef(null);
  const attemptStart   = useRef(Date.now());

  const pans = useRef([
    new Animated.ValueXY(),
    new Animated.ValueXY(),
    new Animated.ValueXY(),
  ]);
  const hintPulse = useRef(new Animated.Value(1)).current;
  const hintLoop  = useRef(null);

  function showFeedback() {
    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }

  function hideFeedbackThen(cb) {
    Animated.timing(feedbackSlide, { toValue: 250, useNativeDriver: true, duration: 250 }).start(() => cb());
  }

  useEffect(() => {
    if (hintKey) {
      hintLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(hintPulse, { toValue: 1.1, duration: 380, useNativeDriver: false }),
          Animated.timing(hintPulse, { toValue: 1.0, duration: 380, useNativeDriver: false }),
        ])
      );
      hintLoop.current.start();
    } else {
      hintLoop.current?.stop();
      hintPulse.setValue(1);
    }
    return () => hintLoop.current?.stop();
  }, [hintKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakInstruction = useCallback(() => {
    Speech.stop();
    Speech.speak(`Drag the ${concept?.label || ''}!`, { language: 'en-US', rate: 0.8 });
  }, [concept]);

  useEffect(() => {
    conceptApi.startTier2({ studentId: student.sid, categoryKey: category.key, conceptKey }).catch(() => {});
    const t = setTimeout(speakInstruction, 500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetPans() {
    pans.current.forEach((pan) => pan.setValue({ x: 0, y: 0 }));
  }

  function snapBack(pan) {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
      tension: 80,
    }).start();
  }

  function measureDropZone() {
    // measureInWindow gives page coordinates directly, and re-running it on every
    // layout keeps the hit box correct after rotation.
    dropZoneRef.current?.measureInWindow((x, y, dzWidth, dzHeight) => {
      if (dzWidth && dzHeight) dropZoneLayout.current = { x, y, width: dzWidth, height: dzHeight };
    });
  }

  function isOverDropZone(gestureState) {
    const dz = dropZoneLayout.current;
    if (!dz) return false;
    // Forgiving by a third of the zone on each side: these children are often still
    // developing fine motor control, and a near-miss shouldn't read as a wrong answer.
    const padX = dz.width  * 0.33;
    const padY = dz.height * 0.33;
    return (
      gestureState.moveX >= dz.x - padX &&
      gestureState.moveX <= dz.x + dz.width + padX &&
      gestureState.moveY >= dz.y - padY &&
      gestureState.moveY <= dz.y + dz.height + padY
    );
  }

  function handleDrop(option, pan, gestureState) {
    if (locked) { snapBack(pan); return; }

    if (!isOverDropZone(gestureState)) {
      snapBack(pan);
      return;
    }

    setLocked(true);
    const wasCorrect  = option.key === conceptKey;
    const timeTakenMs = Date.now() - attemptStart.current;

    const updatedAttempts = [...attempts, { attemptNumber: currentAttempt, selectedKey: option.key, wasCorrect, timeTakenMs }];
    setAttempts(updatedAttempts);

    // The image stays in the drop zone, and the card is left where it was released
    // rather than springing home — so the drop reads as "it went in the box".
    setZoneContent({ source: option.real, isCorrect: wasCorrect });
    setDroppedKey(option.key);

    setFeedbackResult(wasCorrect ? 'correct' : 'wrong');
    showFeedback();

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      tier:        2,
      eventType:   'drag_drop_attempt',
      eventData: {
        attempt_number: currentAttempt,
        selected_key:   option.key,
        was_correct:    wasCorrect,
        time_taken_ms:  timeTakenMs,
        hint_shown:     hintKey !== null,
      },
    }).catch(() => {});

    if (currentAttempt < 3) {
      setTimeout(() => {
        hideFeedbackThen(() => {
          setFeedbackResult(null);
          setZoneContent(null);
          setDroppedKey(null);
          if (wasCorrect) {
            setHintKey(null);
            setDisplayOptions(prev => {
              const base = baseOptions.current;
              let next;
              do { next = shuffle(base); }
              while (next.every((item, i) => item.key === prev[i].key));
              return next;
            });
          } else {
            setHintKey(conceptKey);
          }
          resetPans();
          attemptStart.current = Date.now();
          setCurrentAttempt((n) => n + 1);
          setLocked(false);
        });
      }, 1200);
    } else {
      setTimeout(() => {
        hideFeedbackThen(async () => {
          const correctCount = updatedAttempts.filter((a) => a.wasCorrect).length;
          const score        = correctCount / 3;
          const passed       = score >= 2 / 3;
          const confusedWith = updatedAttempts
            .filter((a) => !a.wasCorrect)
            .map((a) => ({ selected_key: a.selectedKey, correct_key: conceptKey }));

          try {
            await conceptApi.completeTier2({
              studentId:    student.sid,
              categoryKey:  category.key,
              conceptKey,
              passed,
              score,
              attemptCount: updatedAttempts.length,
              confusedWith,
            });
          } catch { /* continue */ }

          Speech.stop();
          stopConceptAudio();

          if (passed) {
            navigation.replace('ConceptCongrats', { student, category, conceptKey, correctCount, completedTier: 2 });
          } else {
            navigation.replace('Tier2Image', { student, category, conceptKey, sessionId });
          }
        });
      }, 1200);
    }
  }

  const panResponders = displayOptions.map((option, i) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !locked,
      onMoveShouldSetPanResponder:  () => !locked,
      onPanResponderMove: Animated.event(
        [null, { dx: pans.current[i].x, dy: pans.current[i].y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease:   (_, g) => handleDrop(option, pans.current[i], g),
      onPanResponderTerminate: (_, g) => snapBack(pans.current[i]),
    })
  );

  if (!concept) return null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={speakInstruction}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Attempt dots */}
        <View style={styles.attemptRow}>
          {[1, 2, 3].map((n) => (
            <View
              key={n}
              style={[
                styles.attemptDot,
                {
                  backgroundColor:
                    n < currentAttempt
                      ? (attempts[n - 1]?.wasCorrect ? '#4CAF50' : '#F44336')
                      : n === currentAttempt
                      ? theme.button
                      : 'rgba(0,0,0,0.15)',
                  transform: [{ scale: n === currentAttempt ? 1.2 : 1 }],
                },
              ]}
            />
          ))}
        </View>

        {/* Concept name pill */}
        <View style={[styles.namePill, { backgroundColor: '#FFFDE7', borderColor: theme.cardOutline }]}>
          <Text style={[styles.nameText, { color: '#2C2C2C' }]}>{concept.label}</Text>
        </View>

        {/* Drop zone */}
        <View
          ref={dropZoneRef}
          onLayout={measureDropZone}
          style={[
            styles.dropZone,
            {
              width:           ZONE_SIZE,
              height:          ZONE_SIZE,
              borderColor:     zoneContent ? (zoneContent.isCorrect ? '#4CAF50' : '#F44336') : theme.cardOutline,
              borderStyle:     zoneContent ? 'solid' : 'dashed',
              backgroundColor: zoneContent
                ? (zoneContent.isCorrect ? '#C8F0CC' : '#FFD6D6')
                : 'rgba(255,255,255,0.35)',
            },
          ]}
        >
          {zoneContent ? (
            <Image
              source={zoneContent.source}
              style={{ width: ZONE_SIZE * 0.78, height: ZONE_SIZE * 0.78 }}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="arrow-down-circle-outline" size={40} color={theme.cardOutline} style={{ opacity: 0.4 }} />
          )}
        </View>

        {/* Draggable image cards */}
        <View style={[styles.cardsRow, { gap: CARD_GAP, paddingHorizontal: H_PAD }]}>
          {displayOptions.map((option, i) => {
            const isHint = hintKey === option.key;
            return (
              <Animated.View
                key={`${option.key}-${currentAttempt}`}
                style={[
                  styles.optionCard,
                  {
                    width:  CARD_W,
                    height: CARD_H,
                    backgroundColor: isHint ? '#FFFDE7' : theme.cardSurface,
                    borderColor:     isHint ? '#FFD700' : theme.cardOutline,
                    shadowColor:     isHint ? '#FFD700' : '#000',
                    shadowOpacity:   isHint ? 0.55 : 0.08,
                    shadowRadius:    isHint ? 14 : 8,
                    elevation:       isHint ? 10 : 3,
                    // The dropped card fades out: its image is now sitting in the box.
                    opacity: droppedKey === option.key ? 0 : 1,
                    transform: [
                      { translateX: pans.current[i].x },
                      { translateY: pans.current[i].y },
                      { scale: isHint ? hintPulse : 1 },
                    ],
                  },
                ]}
                {...panResponders[i].panHandlers}
              >
                <View style={{ width: IMG_SIZE, height: IMG_SIZE }}>
                  <Image source={option.real} style={styles.optionImage} resizeMode="contain" />
                </View>
              </Animated.View>
            );
          })}
        </View>

      </SafeAreaView>

      {/* GIF feedback popup */}
      <Animated.View
        pointerEvents="none"
        style={[styles.gifPopup, { transform: [{ translateY: feedbackSlide }] }]}
      >
        {feedbackResult && (
          <ExpoImage
            source={feedbackResult === 'correct' ? CORRECT_GIF : WRONG_GIF}
            style={styles.gifImage}
            contentFit="contain"
          />
        )}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1, alignItems: 'center' },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  attemptRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  attemptDot: {
    width: 12, height: 12,
    borderRadius: 6,
  },

  namePill: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 32,
    borderWidth: 2,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nameText: {
    fontSize: 28,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 1.5,
  },

  dropZone: {
    borderRadius: 28,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 28,
  },

  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  optionCard: {
    borderRadius: 36,
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    overflow: 'visible',
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },

  gifPopup: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gifImage: {
    width: 200,
    height: 200,
  },
});
