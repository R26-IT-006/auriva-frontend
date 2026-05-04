import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { playConceptAudio, stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptItemsForCategory, getConceptQuestion, getConceptQuestionSi } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

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
  const { width, height } = useWindowDimensions();

  // 3 options: target + next 2 in sequence (wrapping)
  const options = useRef(() => {
    const idx = allItems.findIndex((it) => it.key === conceptKey);
    const next1 = allItems[(idx + 1) % allItems.length];
    const next2 = allItems[(idx + 2) % allItems.length];
    return [concept, next1, next2];
  });

  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [displayOrder,   setDisplayOrder]   = useState(() => shuffle(options.current()));
  const [locked,         setLocked]         = useState(false);
  const [feedbackKey,    setFeedbackKey]     = useState(null); // key of tapped option
  const [feedbackResult, setFeedbackResult] = useState(null); // 'correct' | 'wrong'
  const [attempts,       setAttempts]       = useState([]);
  const [gateVisible,    setGateVisible]    = useState(false);

  const thumbsAnim   = useRef(new Animated.Value(0)).current;
  const thumbsOffset = useRef(new Animated.Value(60)).current;
  const attemptStart = useRef(Date.now());

  const CARD_GAP = 12;
  const H_PAD    = Layout.spacing.md;
  const CARD_W   = ((width  - H_PAD * 2 - CARD_GAP * 2) / 3) * 0.72;
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

  // Speak on each attempt
  useEffect(() => {
    const t = setTimeout(speakPrompt, 400);
    return () => clearTimeout(t);
  }, [currentAttempt]);  // eslint-disable-line react-hooks/exhaustive-deps

  function showFeedback(correct) {
    thumbsAnim.setValue(0);
    thumbsOffset.setValue(60);
    Animated.parallel([
      Animated.spring(thumbsAnim,   { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 8 }),
      Animated.spring(thumbsOffset, { toValue: 0, useNativeDriver: true, bounciness: 8,  speed: 10 }),
    ]).start();
  }

  function hideFeedback(cb) {
    Animated.parallel([
      Animated.timing(thumbsAnim,   { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(thumbsOffset, { toValue: 60, duration: 200, useNativeDriver: true }),
    ]).start(cb);
  }

  async function handleOptionTap(option) {
    if (locked) return;
    setLocked(true);
    Speech.stop();

    const wasCorrect    = option.key === conceptKey;
    const timeTakenMs   = Date.now() - attemptStart.current;
    const newAttempt    = { attemptNumber: currentAttempt, selectedKey: option.key, correctKey: conceptKey, wasCorrect, timeTakenMs };

    setFeedbackKey(option.key);
    setFeedbackResult(wasCorrect ? 'correct' : 'wrong');
    showFeedback(wasCorrect);

    const updatedAttempts = [...attempts, newAttempt];
    setAttempts(updatedAttempts);

    // Log attempt (fire-and-forget)
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
    }).catch(() => {});

    if (currentAttempt < 3) {
      // Advance to next attempt after feedback
      hideFeedback(() => {
        setFeedbackKey(null);
        setFeedbackResult(null);
        setDisplayOrder(prev => {
          const base = options.current();
          let next;
          do { next = shuffle(base); }
          while (next.every((item, i) => item.key === prev[i].key));
          return next;
        });
        attemptStart.current = Date.now();
        setCurrentAttempt((n) => n + 1);
        setLocked(false);
      });
    } else {
      // Final attempt — complete after brief feedback display
      setTimeout(() => {
        hideFeedback(async () => {
          const correctCount  = updatedAttempts.filter((a) => a.wasCorrect).length;
          const score         = correctCount / 3;
          const passed        = score >= 2 / 3;
          const confusedWith  = updatedAttempts
            .filter((a) => !a.wasCorrect)
            .map((a) => ({ selected_key: a.selectedKey, correct_key: a.correctKey }));

          try {
            await conceptApi.completeTier1({
              studentId:    student.sid,
              categoryKey:  category.key,
              conceptKey,
              passed,
              score,
              attemptCount: 3,
              confusedWith,
            });
          } catch { /* progress saved locally anyway */ }

          Speech.stop();
          stopConceptAudio();
          if (passed) {
            navigation.replace('ConceptCongrats', { student, category, conceptKey, correctCount });
          } else {
            navigation.replace('ConceptImage', { student, category, conceptKey, sessionId, isRelearn: true });
          }
        });
      }, 800);
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

          {/* Replay TTS */}
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

        {/* Attempt indicator */}
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

        {/* Options */}
        <View style={styles.optionsContainer}>
        <View style={[styles.optionsRow, { paddingHorizontal: H_PAD, gap: CARD_GAP }]}>
          {displayOrder.map((option) => {
            const isTapped   = feedbackKey === option.key;
            const isCorrect  = isTapped && feedbackResult === 'correct';
            const isWrong    = isTapped && feedbackResult === 'wrong';

            let borderColor  = theme.cardOutline;
            if (isCorrect)   borderColor = '#4CAF50';
            if (isWrong)     borderColor = '#F44336';

            return (
              <Animated.View
                key={option.key}
                style={[
                  styles.optionCard,
                  {
                    width:           CARD_W,
                    height:          CARD_H,
                    backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : theme.cardSurface,
                    borderColor,
                    transform: [{ scale: 1 }],
                  },
                  isCorrect && styles.optionCardCorrect,
                  isWrong   && styles.optionCardWrong,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={locked ? 1 : 0.8}
                  disabled={locked}
                  onPress={() => handleOptionTap(option)}
                  style={styles.optionTouchable}
                >
                  <View style={{ width: IMG_SIZE, height: IMG_SIZE, marginBottom: 10 }}>
                    <Image
                      source={option.real}
                      style={styles.optionImage}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
        </View>

        {/* Thumbs feedback popup */}
        <Animated.View
          style={[
            styles.feedbackBubble,
            {
              opacity:   thumbsAnim,
              transform: [{ translateY: thumbsOffset }],
              backgroundColor: feedbackResult === 'correct' ? '#4CAF50' : '#F44336',
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.feedbackEmoji}>
            {feedbackResult === 'correct' ? '👍' : '👎'}
          </Text>
          <Text style={styles.feedbackText}>
            {feedbackResult === 'correct' ? 'Great job!' : 'Try again!'}
          </Text>
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
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  questionSi: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
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
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 2.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  optionLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  hintBadge: {
    position: 'absolute',
    top: -4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedbackBubble: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  feedbackEmoji: {
    fontSize: 26,
  },
  feedbackText: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFF',
  },
});
