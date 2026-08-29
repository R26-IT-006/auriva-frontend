import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
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
import { playConceptAudio, stopConceptAudio } from '../../../../utils/audioUtils';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getConceptItem, getConceptItemsForCategory, getConceptQuestion, getConceptQuestionSi } from '../../../../data/conceptData';
import { conceptApi } from '../../../../api/concept';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { Layout } from '../../../../constants/layout';

const CORRECT_GIF = require('../../../../../assets/feedback/correct.gif');
const WRONG_GIF   = require('../../../../../assets/feedback/wrong.gif');

function OptionCard({ option, cardW, cardH, imgSize, locked, isCorrect, isWrong, cardSurface, cardOutline, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (locked) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View
      style={[
        styles.optionCard,
        {
          width:  cardW,
          height: cardH,
          backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : cardSurface,
          borderColor:      isCorrect ? '#4CAF50' : isWrong ? '#F44336' : cardOutline,
          transform: [{ scale }],
        },
        isCorrect && styles.optionCardCorrect,
        isWrong   && styles.optionCardWrong,
      ]}
    >
      <Pressable
        disabled={locked}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.optionTouchable}
      >
        <View style={{ width: imgSize, height: imgSize }}>
          <Image source={option.real} style={styles.optionImage} resizeMode="contain" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ConceptMatchScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept    = getConceptItem(category.key, conceptKey);
  const allItems   = getConceptItemsForCategory(category.key);
  const theme      = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  // Stable options list (set once after distractor fetch; reshuffled between attempts)
  const optionsRef = useRef(null);
  // Which fallback tier chose the distractors — logged with each attempt so the
  // offline evaluation can tell a real confusion from an artefact of the policy.
  const distractorSource = useRef(null);

  function buildSequentialOptions() {
    const idx  = allItems.findIndex((it) => it.key === conceptKey);
    const next1 = allItems[(idx + 1) % allItems.length];
    const next2 = allItems[(idx + 2) % allItems.length];
    return [concept, next1, next2];
  }

  const [currentAttempt,  setCurrentAttempt]  = useState(1);
  const [displayOrder,    setDisplayOrder]    = useState(null); // null = loading
  const [locked,          setLocked]          = useState(false);
  const [feedbackKey,     setFeedbackKey]     = useState(null);
  const [feedbackResult,  setFeedbackResult]  = useState(null); // 'correct' | 'wrong'
  const [attempts,        setAttempts]        = useState([]);
  const feedbackSlide = useRef(new Animated.Value(250)).current;
  const [gateVisible,     setGateVisible]     = useState(false);

  const attemptStart = useRef(Date.now());

  function showFeedback() {
    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }

  function hideFeedbackThen(cb) {
    Animated.timing(feedbackSlide, { toValue: 250, useNativeDriver: true, duration: 250 }).start(() => cb());
  }

  const CARD_GAP = 28;
  const H_PAD    = Layout.spacing.md;
  const CARD_W   = ((width - H_PAD * 2 - CARD_GAP * 2) / 3) * 0.60;
  const CARD_H   = CARD_W;
  const IMG_SIZE = Math.floor(Math.min(CARD_W * 0.78, CARD_H * 0.68));

  const speakPrompt = useCallback(() => {
    if (!concept) return;
    if (concept.t1Audio) {
      playConceptAudio(concept.t1Audio);
    } else {
      Speech.stop();
      Speech.speak(getConceptQuestion(concept), { language: 'en-US', rate: 0.8 });
      setTimeout(() => {
        Speech.speak(concept.labelSi || concept.label, { language: 'si-LK', rate: 0.7 });
      }, 1500);
    }
  }, [concept]);

  // Load adaptive distractors from GKB; fall back to sequential neighbours
  useEffect(() => {
    let cancelled = false;
    conceptApi.getDistractors({ studentId: student.sid, categoryKey: category.key, conceptKey, tier: 1 })
      .then((res) => {
        if (cancelled) return;
        const keys = res?.distractors || [];
        const d1 = keys[0] ? allItems.find((it) => it.key === keys[0]) : null;
        const d2 = keys[1] ? allItems.find((it) => it.key === keys[1]) : null;
        const usedServerKeys = !!(d1 && d2 && d1.key !== conceptKey && d2.key !== conceptKey);
        const opts = usedServerKeys ? [concept, d1, d2] : buildSequentialOptions();
        optionsRef.current = opts;
        // Which source actually chose these, for the attempt log. When the server
        // keys are unusable we fall back locally, so the server's own label would
        // be wrong.
        distractorSource.current = usedServerKeys
          ? (res?.distractor_source || 'gkb')
          : 'client_sequential';
        setDisplayOrder(shuffle(opts));
      })
      .catch(() => {
        if (cancelled) return;
        const opts = buildSequentialOptions();
        optionsRef.current = opts;
        distractorSource.current = 'client_sequential';
        setDisplayOrder(shuffle(opts));
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!displayOrder) return;
    const t = setTimeout(speakPrompt, 400);
    return () => clearTimeout(t);
  }, [currentAttempt, displayOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOptionTap(option) {
    if (locked) return;
    setLocked(true);
    Speech.stop();
    stopConceptAudio();

    const wasCorrect  = option.key === conceptKey;
    const timeTakenMs = Date.now() - attemptStart.current;
    const newAttempt  = { attemptNumber: currentAttempt, selectedKey: option.key, correctKey: conceptKey, wasCorrect, timeTakenMs };

    setFeedbackKey(option.key);
    setFeedbackResult(wasCorrect ? 'correct' : 'wrong');
    showFeedback();

    const updatedAttempts = [...attempts, newAttempt];
    setAttempts(updatedAttempts);

    conceptApi.logMatchAttempt({
      studentId:     student.sid,
      sessionId:     sessionId || null,
      categoryKey:   category.key,
      conceptKey,
      attemptNumber: currentAttempt,
      selectedKey:   option.key,
      correctKey:    conceptKey,
      timeTakenMs,
      wasCorrect,
      // Everything the child could have picked, not just what they did pick.
      optionKeys:       (optionsRef.current || []).map((o) => o.key),
      distractorSource: distractorSource.current,
    }).catch(() => {});

    if (currentAttempt < 3) {
      setTimeout(() => {
        hideFeedbackThen(() => {
          setFeedbackKey(null);
          setFeedbackResult(null);
          setDisplayOrder(prev => {
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
      // Final attempt — complete after GIF display
      setTimeout(() => {
        hideFeedbackThen(async () => {
        const correctCount = updatedAttempts.filter((a) => a.wasCorrect).length;
        const score        = correctCount / 3;
        const passed       = score >= 2 / 3;
        const confusedWith = updatedAttempts
          .filter((a) => !a.wasCorrect)
          .map((a) => ({ selected_key: a.selectedKey, correct_key: a.correctKey }));

        // Unique confused concept keys for adaptive quiz
        const confusedKeys = [...new Set(
          updatedAttempts.filter((a) => !a.wasCorrect).map((a) => a.selectedKey)
        )];

        try {
          await conceptApi.completeTier1({
            studentId:    student.sid,
            categoryKey:  category.key,
            conceptKey,
            passed,
            score,
            attemptCount: updatedAttempts.length,
            confusedWith,
          });
        } catch { /* progress saved locally */ }

        Speech.stop();
        stopConceptAudio();

        if (passed) {
          navigation.replace('ConceptCongrats', { student, category, conceptKey, correctCount });
        } else {
          navigation.replace('ConceptImage', {
            student, category, conceptKey, sessionId,
            isRelearn: true, confusedKeys,
          });
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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={speakPrompt}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Bilingual question */}
        <View style={styles.questionBlock}>
          <Text style={[styles.questionEn, { color: theme.headingText }]}>
            {getConceptQuestion(concept)}
          </Text>
          {concept.labelSi && (
            <Text style={[styles.questionSi, { color: theme.headingText }]}>
              {getConceptQuestionSi(concept)}
            </Text>
          )}
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

        {/* Options — show spinner until distractors are loaded */}
        <View style={styles.optionsContainer}>
          {!displayOrder ? (
            <ActivityIndicator size="large" color={theme.button} style={{ marginTop: 40 }} />
          ) : (
          <View style={[styles.optionsRow, { paddingHorizontal: H_PAD, gap: CARD_GAP }]}>
            {displayOrder.map((option) => {
              const isTapped  = feedbackKey === option.key;
              const isCorrect = isTapped && feedbackResult === 'correct';
              const isWrong   = isTapped && feedbackResult === 'wrong';

              return (
                <OptionCard
                  key={option.key}
                  option={option}
                  cardW={CARD_W}
                  cardH={CARD_H}
                  imgSize={IMG_SIZE}
                  locked={locked}
                  isCorrect={isCorrect}
                  isWrong={isWrong}
                  cardSurface={theme.cardSurface}
                  cardOutline={theme.cardOutline}
                  onPress={() => handleOptionTap(option)}
                />
              );
            })}
          </View>
          )}
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

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.goBack(); }}
        onCancel={() => setGateVisible(false)}
      />
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

  questionBlock: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: Layout.spacing.lg,
    gap: 4,
  },
  questionEn: {
    fontSize: 26,
    fontFamily: 'DMSans_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  questionSi: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    opacity: 0.65,
    textAlign: 'center',
  },

  attemptRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  attemptDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  optionsContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  optionCard: {
    borderRadius: 36,
    borderWidth: 3.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  optionCardCorrect: {
    shadowColor: '#4CAF50',
    shadowOpacity: 0.25,
    elevation: 6,
  },
  optionCardWrong: {
    shadowColor: '#F44336',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  optionTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
