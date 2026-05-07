import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { playConceptAudio, stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptQuestion, getConceptQuestionSi } from '../../../constants/conceptData';
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

export default function ConceptAdaptiveQuizScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId, confusedKeys } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  // Build one round per confused concept: { confusedConceptKey, pair: [correct, confused] shuffled }
  const rounds = confusedKeys
    .map((key) => ({ key, item: getConceptItem(category.key, key) }))
    .filter(({ item }) => Boolean(item))
    .map(({ key, item }) => ({ confusedConceptKey: key, pair: shuffle([concept, item]) }));

  const [currentRound,    setCurrentRound]    = useState(0);
  const [displayPair,     setDisplayPair]     = useState(rounds[0]?.pair ?? []);
  const [locked,          setLocked]          = useState(false);
  const [feedbackResult,  setFeedbackResult]  = useState(null); // 'correct' | 'wrong'
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [tappedKey,       setTappedKey]       = useState(null);
  const allCorrectRef    = useRef(true);
  const roundResultsRef  = useRef([]);
  const roundStartRef    = useRef(Date.now());

  const CARD_GAP = 24;
  const H_PAD    = Layout.spacing.md;
  const CARD_W   = ((width - H_PAD * 2 - CARD_GAP) / 2) * 0.88;
  const CARD_H   = CARD_W;
  const IMG_SIZE = Math.floor(CARD_W * 0.70);

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

  useEffect(() => {
    roundStartRef.current = Date.now();
    const t = setTimeout(speakPrompt, 400);
    return () => clearTimeout(t);
  }, [currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTap(option) {
    if (locked) return;
    setLocked(true);
    Speech.stop();
    stopConceptAudio();

    const wasCorrect          = option.key === conceptKey;
    const timeTakenMs         = Date.now() - roundStartRef.current;
    const confusedConceptKey  = rounds[currentRound]?.confusedConceptKey;

    if (!wasCorrect) allCorrectRef.current = false;

    roundResultsRef.current.push({ round: currentRound + 1, confused_concept_key: confusedConceptKey, was_correct: wasCorrect });

    // Log this round to backend (fire-and-forget)
    conceptApi.logAdaptiveAttempt({
      studentId:          student.sid,
      sessionId:          sessionId || null,
      categoryKey:        category.key,
      conceptKey,
      confusedConceptKey,
      roundNumber:        currentRound + 1,
      wasCorrect,
      timeTakenMs,
    }).catch(() => {});

    setTappedKey(option.key);
    setFeedbackResult(wasCorrect ? 'correct' : 'wrong');
    setFeedbackVisible(true);

    setTimeout(() => {
      setFeedbackVisible(false);
      setTappedKey(null);
      setFeedbackResult(null);

      const isLastRound = currentRound === rounds.length - 1;

      if (isLastRound) {
        Speech.stop();
        stopConceptAudio();
        const passed = allCorrectRef.current;

        // Log completion to backend (fire-and-forget)
        conceptApi.completeAdaptive({
          studentId:    student.sid,
          sessionId:    sessionId || null,
          categoryKey:  category.key,
          conceptKey,
          confusedKeys,
          roundResults: roundResultsRef.current,
          allPassed:    passed,
        }).catch(() => {});

        if (passed) {
          navigation.replace('ConceptCongrats', { student, category, conceptKey, correctCount: 2 });
        } else {
          navigation.replace('ConceptImage', {
            student, category, conceptKey, sessionId,
            isRelearn: true, confusedKeys,
          });
        }
      } else {
        const next = currentRound + 1;
        setDisplayPair(rounds[next].pair);
        setCurrentRound(next);
        setLocked(false);
      }
    }, 1500);
  }

  if (!concept || rounds.length === 0) return null;

  const totalRounds   = rounds.length;

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

          <View style={[styles.roundBadge, { backgroundColor: theme.button + '22', borderColor: theme.cardOutline }]}>
            <Text style={[styles.roundText, { color: theme.headingText }]}>
              Round {currentRound + 1} of {totalRounds}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={speakPrompt}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Round progress dots */}
        {totalRounds > 1 && (
          <View style={styles.roundDots}>
            {rounds.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.roundDot,
                  {
                    backgroundColor:
                      i < currentRound
                        ? theme.button
                        : i === currentRound
                        ? theme.button
                        : 'rgba(0,0,0,0.15)',
                    opacity: i <= currentRound ? 1 : 0.4,
                    transform: [{ scale: i === currentRound ? 1.3 : 1 }],
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Body */}
        <View style={styles.body}>

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

          {/* 2-card row */}
          <View style={[styles.cardsRow, { paddingHorizontal: H_PAD, gap: CARD_GAP }]}>
            {displayPair.map((option) => {
              const isTapped  = tappedKey === option.key;
              const isCorrect = isTapped && feedbackResult === 'correct';
              const isWrong   = isTapped && feedbackResult === 'wrong';

              return (
                <View
                  key={option.key}
                  style={[
                    styles.card,
                    {
                      width:           CARD_W,
                      height:          CARD_H,
                      backgroundColor: isCorrect ? '#C8F0CC' : isWrong ? '#FFD6D6' : theme.cardSurface,
                      borderColor:     isCorrect ? '#4CAF50' : isWrong ? '#F44336' : theme.cardOutline,
                    },
                    isCorrect && styles.cardCorrect,
                    isWrong   && styles.cardWrong,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={locked ? 1 : 0.8}
                    disabled={locked}
                    onPress={() => handleTap(option)}
                    style={styles.cardTouchable}
                  >
                    <View style={{ width: IMG_SIZE, height: IMG_SIZE }}>
                      <Image source={option.real} style={styles.cardImage} resizeMode="contain" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

        </View>

        {/* GIF feedback overlay */}
        {feedbackVisible && (
          <View style={styles.gifOverlay} pointerEvents="none">
            <ExpoImage
              source={feedbackResult === 'correct' ? CORRECT_GIF : WRONG_GIF}
              style={styles.gifImage}
              contentFit="contain"
            />
          </View>
        )}

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
  roundBadge: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  roundText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },

  roundDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  roundDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  body: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  questionBlock: {
    alignItems: 'center',
    marginBottom: 32,
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

  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCorrect: {
    shadowColor: '#4CAF50',
    shadowOpacity: 0.3,
    elevation: 7,
  },
  cardWrong: {
    shadowColor: '#F44336',
    shadowOpacity: 0.25,
    elevation: 5,
  },
  cardTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },

  gifOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gifImage: {
    width: 320,
    height: 320,
  },
});
