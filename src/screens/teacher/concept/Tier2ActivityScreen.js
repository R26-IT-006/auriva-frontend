import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptItemsForCategory } from '../../../constants/conceptData';
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

export default function Tier2ActivityScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept  = getConceptItem(category.key, conceptKey);
  const allItems = getConceptItemsForCategory(category.key);
  const theme    = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const optionsRef = useRef(null);

  function buildSequentialOptions() {
    const idx   = allItems.findIndex((it) => it.key === conceptKey);
    const next1 = allItems[(idx + 1) % allItems.length];
    const next2 = allItems[(idx + 2) % allItems.length];
    return [concept, next1, next2];
  }

  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [displayLabels,  setDisplayLabels]  = useState(null);
  const [locked,         setLocked]         = useState(false);
  const [feedbackKey,    setFeedbackKey]    = useState(null);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [attempts,       setAttempts]       = useState([]);
  const feedbackSlide  = useRef(new Animated.Value(250)).current;
  const attemptStart   = useRef(Date.now());

  const imgSize = Math.min(width, height) * 0.42;

  function showFeedback() {
    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }

  function hideFeedbackThen(cb) {
    Animated.timing(feedbackSlide, { toValue: 250, useNativeDriver: true, duration: 250 }).start(() => cb());
  }

  const speakQuestion = useCallback(() => {
    Speech.stop();
    Speech.speak('What is this called?', { language: 'en-US', rate: 0.8 });
  }, []);

  // Load adaptive distractors from GKB; fall back to sequential neighbours
  useEffect(() => {
    let cancelled = false;
    conceptApi.getDistractors({ studentId: student.sid, categoryKey: category.key, conceptKey, tier: 2 })
      .then((res) => {
        if (cancelled) return;
        const keys = res?.distractors || [];
        const d1 = keys[0] ? allItems.find((it) => it.key === keys[0]) : null;
        const d2 = keys[1] ? allItems.find((it) => it.key === keys[1]) : null;
        const opts = (d1 && d2 && d1.key !== conceptKey && d2.key !== conceptKey)
          ? [concept, d1, d2]
          : buildSequentialOptions();
        optionsRef.current = opts;
        setDisplayLabels(shuffle(opts));
      })
      .catch(() => {
        if (cancelled) return;
        const opts = buildSequentialOptions();
        optionsRef.current = opts;
        setDisplayLabels(shuffle(opts));
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!displayLabels) return;
    const t = setTimeout(speakQuestion, 400);
    return () => clearTimeout(t);
  }, [currentAttempt, displayLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLabelTap(option) {
    if (locked) return;
    setLocked(true);
    Speech.stop();

    const wasCorrect  = option.key === conceptKey;
    const timeTakenMs = Date.now() - attemptStart.current;

    setFeedbackKey(option.key);
    setFeedbackResult(wasCorrect ? 'correct' : 'wrong');
    showFeedback();

    const updatedAttempts = [...attempts, { attemptNumber: currentAttempt, selectedKey: option.key, wasCorrect, timeTakenMs }];
    setAttempts(updatedAttempts);

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      tier:        2,
      eventType:   'name_match_attempt',
      eventData:   { attempt_number: currentAttempt, selected_key: option.key, was_correct: wasCorrect, time_taken_ms: timeTakenMs },
    }).catch(() => {});

    if (currentAttempt < 3) {
      setTimeout(() => {
        hideFeedbackThen(() => {
          setFeedbackKey(null);
          setFeedbackResult(null);
          setDisplayLabels(prev => {
            const base = optionsRef.current || buildSequentialOptions();
            let next;
            do { next = shuffle(base); }
            while (next.every((item, i) => item.key === prev[i].key));
            return next;
          });
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
              attemptCount: 3,
              confusedWith,
            });
          } catch { /* continue */ }

          Speech.stop();
          stopConceptAudio();

          if (passed) {
            navigation.replace('ConceptCongrats', { student, category, conceptKey, correctCount, completedTier: 2 });
          } else {
            navigation.replace('Tier2DragDrop', { student, category, conceptKey, sessionId });
          }
        });
      }, 1200);
    }
  }

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
            onPress={speakQuestion}
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

        {/* Side-by-side: image left, labels right */}
        <View style={styles.contentRow}>

          {/* Concept image */}
          <View style={styles.imageContainer}>
            <Image source={concept.real} style={{ width: imgSize, height: imgSize }} resizeMode="contain" />
          </View>

          {/* Name label options — vertical stack */}
          <View style={styles.labelsContainer}>
            {!displayLabels ? (
              <ActivityIndicator size="large" color={theme.button} />
            ) : displayLabels.map((option) => {
              const isTapped  = feedbackKey === option.key;
              const isCorrect = isTapped && feedbackResult === 'correct';
              const isWrong   = isTapped && feedbackResult === 'wrong';

              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={locked ? 1 : 0.8}
                  disabled={locked}
                  onPress={() => handleLabelTap(option)}
                  style={[
                    styles.labelPill,
                    {
                      backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : '#FFFDE7',
                      borderColor:     isCorrect ? '#4CAF50' : isWrong ? '#F44336' : theme.cardOutline,
                    },
                  ]}
                >
                  <Text style={[styles.labelText, { color: isCorrect ? '#2E7D32' : isWrong ? '#C62828' : '#2C2C2C' }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>

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

      </SafeAreaView>
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

  contentRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 130,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 130,
  },
  labelsContainer: {
    width: 320,
    justifyContent: 'center',
    gap: 24,
    marginRight: 60,
  },
  labelPill: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  labelText: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 0.2,
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
