import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { playConceptAudio, stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem, getConceptQuestion } from '../../../data/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

import ImageChoiceRound from '../../../components/concept/ImageChoiceRound';
import NameChoiceRound  from '../../../components/concept/NameChoiceRound';
import DragDropRound    from '../../../components/concept/DragDropRound';

const CORRECT_GIF = require('../../../../assets/feedback/correct.gif');
const WRONG_GIF   = require('../../../../assets/feedback/wrong.gif');

const FEEDBACK_MS = 1200;
// Distance the feedback GIF travels in from the right edge.
const FEEDBACK_OFFSCREEN = 280;

const ROUND_COMPONENTS = {
  image_choice: ImageChoiceRound,
  name_choice:  NameChoiceRound,
  drag_drop:    DragDropRound,
};

/**
 * Sequences the rounds of one generated activity.
 *
 * Everything structural here is deliberately identical on every run — same intro
 * card, same round badge, same dot row, same feedback timing, same result screen.
 * Only the concepts, distractors and round types vary. That is the whole point:
 * the children using this rely on the routine being predictable.
 */
export default function ConceptActivityScreen({ route, navigation }) {
  const { student, category, sessionId } = route.params;

  const theme = getAvatarTheme(student?.avatar_key);

  const [activity,       setActivity]       = useState(null);   // null = loading
  const [error,          setError]          = useState(false);
  const [started,        setStarted]        = useState(false);  // intro overlay dismissed
  const [currentRound,   setCurrentRound]   = useState(0);
  const [locked,         setLocked]         = useState(false);
  const [feedback,       setFeedback]       = useState(null);   // { selectedKey, result }
  const [gateVisible,    setGateVisible]    = useState(false);

  const feedbackSlide  = useRef(new Animated.Value(FEEDBACK_OFFSCREEN)).current;
  const roundResults   = useRef([]);
  const roundStart     = useRef(Date.now());
  const completing     = useRef(false);

  // ── Load + resolve the plan ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    conceptApi.startActivity({ studentId: student.sid, categoryKey: category.key, sessionId })
      .then((res) => {
        if (cancelled) return;

        // A stored plan can outlive a conceptData.js edit that removed a key, so
        // drop any round we can't fully resolve rather than render a broken card.
        const rounds = (res.rounds || [])
          .map((round) => {
            const concept = getConceptItem(category.key, round.concept_key);
            const options = (round.option_keys || [])
              .map((k) => getConceptItem(category.key, k))
              .filter(Boolean);
            if (!concept || options.length < 2) return null;
            if (!options.some((o) => o.key === round.concept_key)) return null;
            return { ...round, concept, options };
          })
          .filter(Boolean);

        if (rounds.length < 2) { setError(true); return; }
        setActivity({ ...res, rounds });
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Unresolvable plan — leave quietly rather than showing a child a broken screen.
  useEffect(() => {
    if (error) navigation.replace('ConceptItems', { student, category });
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const round = activity?.rounds[currentRound] ?? null;

  // ── Prompt audio ───────────────────────────────────────────────────────────
  const speakPrompt = useCallback(() => {
    if (!round) return;
    const { concept, question_type } = round;

    if (question_type === 'image_choice' && concept.t1Audio) {
      playConceptAudio(concept.t1Audio);
      return;
    }

    const en =
      question_type === 'image_choice' ? getConceptQuestion(concept)
      : question_type === 'name_choice' ? 'What is this called?'
      : `Drag the ${concept.label} into the box`;

    Speech.stop();
    Speech.speak(en, { language: 'en-US', rate: 0.8 });
    if (concept.labelSi) {
      setTimeout(() => {
        Speech.speak(concept.labelSi, { language: 'si-LK', rate: 0.7 });
      }, 1500);
    }
  }, [round]);

  useEffect(() => {
    if (!started || !round) return;
    roundStart.current = Date.now();
    const t = setTimeout(speakPrompt, 400);
    return () => clearTimeout(t);
  }, [started, currentRound, round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { Speech.stop(); stopConceptAudio(); }, []);

  // ── Feedback animation ─────────────────────────────────────────────────────
  function showFeedback() {
    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }
  function hideFeedbackThen(cb) {
    Animated.timing(feedbackSlide, { toValue: FEEDBACK_OFFSCREEN, useNativeDriver: true, duration: 250 }).start(() => cb());
  }

  // ── Answering ──────────────────────────────────────────────────────────────
  const handleAnswer = useCallback((selectedKey) => {
    if (locked || !round) return;
    setLocked(true);
    Speech.stop();
    stopConceptAudio();

    const wasCorrect  = selectedKey === round.concept_key;
    const timeTakenMs = Date.now() - roundStart.current;

    roundResults.current.push({
      round_number:  round.round_number,
      concept_key:   round.concept_key,
      question_type: round.question_type,
      selected_key:  selectedKey,
      was_correct:   wasCorrect,
      time_taken_ms: timeTakenMs,
    });

    conceptApi.logActivityAttempt({
      studentId:    student.sid,
      sessionId:    sessionId || null,
      activityId:   activity.activity_id,
      categoryKey:  category.key,
      conceptKey:   round.concept_key,
      roundNumber:  round.round_number,
      questionType: round.question_type,
      selectedKey,
      wasCorrect,
      timeTakenMs,
      optionKeys:   round.options.map((o) => o.key),
    }).catch(() => {});

    setFeedback({ selectedKey, result: wasCorrect ? 'correct' : 'wrong' });
    showFeedback();

    setTimeout(() => {
      hideFeedbackThen(() => {
        setFeedback(null);

        const isLast = currentRound === activity.rounds.length - 1;
        if (!isLast) {
          setCurrentRound((n) => n + 1);
          setLocked(false);
          return;
        }
        finish();
      });
    }, FEEDBACK_MS);
  }, [locked, round, activity, currentRound]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    if (completing.current) return;
    completing.current = true;

    const results = roundResults.current;
    const correctCount = results.filter((r) => r.was_correct).length;

    try {
      await conceptApi.completeActivity({
        studentId:    student.sid,
        sessionId:    sessionId || null,
        activityId:   activity.activity_id,
        roundResults: results,
      });
    } catch { /* progress is recorded server-side on the next attempt */ }

    Speech.stop();
    stopConceptAudio();

    navigation.replace('ConceptCongrats', {
      student,
      category,
      conceptKey: activity.concept_keys?.[0],
      mode:       'activity',
      correctCount,
      totalCount: results.length,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!activity) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.safe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <SafeAreaView style={[styles.safeInner, styles.center]} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={theme.button} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const RoundComponent = ROUND_COMPONENTS[round?.question_type] ?? ImageChoiceRound;
  const totalRounds    = activity.rounds.length;

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
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
        <View style={styles.roundDots}>
          {activity.rounds.map((_, i) => {
            const result = roundResults.current[i];
            const color =
              i < currentRound ? (result?.was_correct ? '#4CAF50' : '#F44336')
              : i === currentRound ? theme.button
              : 'rgba(0,0,0,0.15)';
            return (
              <View
                key={i}
                style={[
                  styles.roundDot,
                  {
                    backgroundColor: color,
                    opacity: i <= currentRound ? 1 : 0.4,
                    transform: [{ scale: i === currentRound ? 1.3 : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Body */}
        <View style={styles.body}>
          {round && (
            <RoundComponent
              key={round.round_number}
              round={round}
              concept={round.concept}
              options={round.options}
              theme={theme}
              locked={locked}
              feedback={feedback}
              onAnswer={handleAnswer}
            />
          )}
        </View>

        {/* Intro overlay — identical every activity, so the child knows what's coming */}
        {!started && (
          <View style={styles.introOverlay}>
            <View style={[styles.introCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              <View style={[styles.introIconCircle, { backgroundColor: theme.button }]}>
                <Ionicons name="ribbon" size={30} color="#FFF" />
              </View>
              <Text style={[styles.introTitle, { color: theme.headingText }]}>Let's practise!</Text>
              <Text style={[styles.introSub, { color: theme.headingText }]}>
                {totalRounds} questions about things you already know.
              </Text>
              <Pressable
                onPress={() => setStarted(true)}
                style={[styles.introBtn, { backgroundColor: theme.button }]}
              >
                <Text style={[styles.introBtnText, { color: theme.buttonText }]}>Start</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* GIF feedback popup */}
        <Animated.View
          pointerEvents="none"
          style={[styles.gifPopup, { transform: [{ translateX: feedbackSlide }] }]}
        >
          {feedback && (
            <ExpoImage
              source={feedback.result === 'correct' ? CORRECT_GIF : WRONG_GIF}
              style={styles.gifImage}
              contentFit="contain"
            />
          )}
        </Animated.View>

      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.replace('ConceptItems', { student, category }); }}
        onCancel={() => setGateVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1, alignItems: 'center' },
  center:    { justifyContent: 'center' },

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
    paddingBottom: 40,
  },

  // ── Intro overlay ──────────────────────────────────────────────────────────
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  introCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  introIconCircle: {
    width: 60, height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introTitle: {
    fontSize: 26,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
  },
  introSub: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 8,
  },
  introBtn: {
    paddingHorizontal: 44,
    paddingVertical: 14,
    borderRadius: 30,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
  },
  introBtnText: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
  },

  // Slides in from the right edge, vertically centred, so it never sits on top of
  // the answer cards the way a bottom-anchored popup did.
  gifPopup: {
    position: 'absolute',
    right: 24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  gifImage: {
    width: 200,
    height: 200,
  },
});
