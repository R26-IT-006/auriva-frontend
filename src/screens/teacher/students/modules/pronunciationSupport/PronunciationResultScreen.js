import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Vibration,
} from "react-native";
import { Audio } from "expo-av";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { WORD_BANK } from "./wordBank.js";
import {
  ALPHABET_BANK,
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { buildPronunciationResultPayload } from "./pronunciationPayloads.js";
import { AvatarIdentityBadge, ThemedGradientFill } from "./pronunciationDesignKit.js";

const EXPECTED_PRONUNCIATION_SCORE = 80;
const WELL_DONE_AUDIO_ASSET = require("../../../../../../assets/pronounciation-audios/well-done-female.mp3");
const HOORAY_AUDIO_ASSET = require("../../../../../../assets/pronounciation-audios/hooray-female.mp3");

function FeedbackButton({ onPress, style, activeOpacity = 0.92, children }) {
  return (
    <ButtonFeedback style={style} activeOpacity={activeOpacity} onPress={onPress}>
      {children}
    </ButtonFeedback>
  );
}

function ConfettiBurst({ pieces }) {
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.color,
              left: piece.left,
              top: piece.top,
              width: piece.width,
              height: piece.height,
              opacity: piece.opacity,
              transform: [
                { translateX: piece.translateX },
                { translateY: piece.translateY },
                { rotate: piece.rotate },
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function PronunciationResultScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const hasSavedResultRef = useRef(false);
  const theme = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  const sessionCategory = usePronunciationSessionStore(
    (state) => state.selectedCategory,
  );
  const sessionMode = usePronunciationSessionStore((state) => state.selectedMode);
  const sessionWord = usePronunciationSessionStore((state) => state.selectedWord);
  const mockWordScore = usePronunciationSessionStore(
    (state) => state.mockWordScore,
  );
  const mockPhonemeScores = usePronunciationSessionStore(
    (state) => state.mockPhonemeScores,
  );
  const storedResponseDuration = usePronunciationSessionStore(
    (state) => state.responseDuration,
  );
  const hesitationTime = usePronunciationSessionStore(
    (state) => state.hesitationTime,
  );
  const needsTeacherReview = usePronunciationSessionStore(
    (state) => state.needsTeacherReview,
  );
  const scoringMethod = usePronunciationSessionStore(
    (state) => state.scoringMethod,
  );
  const recognizedText = usePronunciationSessionStore(
    (state) => state.recognizedText,
  );
  const speechVerification = usePronunciationSessionStore(
    (state) => state.speechVerification,
  );
  const confidenceLevel = usePronunciationSessionStore(
    (state) => state.confidenceLevel,
  );
  const heardReferenceAudio = usePronunciationSessionStore(
    (state) => state.heardReferenceAudio,
  );
  const recommendation = usePronunciationSessionStore(
    (state) => state.adaptiveRecommendation,
  );
  const recordingUri = usePronunciationSessionStore(
    (state) => state.recordingUri,
  );
  const rawAudioBase64 = usePronunciationSessionStore(
    (state) => state.rawAudioBase64,
  );
  const rawAudioMimeType = usePronunciationSessionStore(
    (state) => state.rawAudioMimeType,
  );
  const rawAudioSize = usePronunciationSessionStore(
    (state) => state.rawAudioSize,
  );
  const listenChooseData = usePronunciationSessionStore(
    (state) => state.listenChooseData,
  );
  const scoredResultId = usePronunciationSessionStore(
    (state) => state.scoredResultId,
  );
  const routeListenChooseData = route.params?.listenChooseData;
  const savedListenChooseData = routeListenChooseData || listenChooseData || null;
  const celebrationSoundsRef = useRef([]);
  const hasPlayedCelebrationAudioRef = useRef(false);
  const numberOfAttempts = usePronunciationSessionStore(
    (state) => state.numberOfAttempts,
  );
  const lowScorePulse = useRef(new Animated.Value(1)).current;
  const lowScoreShake = useRef(new Animated.Value(0)).current;
  const setSelectedWord = usePronunciationSessionStore(
    (state) => state.setSelectedWord,
  );
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const mode = route.params?.mode || sessionMode || PRONUNCIATION_MODES.WORD;
  const isAlphabetMode = mode === PRONUNCIATION_MODES.ALPHABET;
  const categoryId = route.params?.categoryId || sessionCategory || "animals";
  const navigationCategoryId = isAlphabetMode ? undefined : categoryId;
  const routeWord = route.params?.word;
  const wordId = route.params?.wordId || routeWord?.id || sessionWord?.id || "cat";

  const words = isAlphabetMode ? ALPHABET_BANK : WORD_BANK[categoryId] || [];
  const currentWord =
    words.find((item) => item.id === wordId) || routeWord || sessionWord || words[0];
  const displayScore = mockWordScore ?? 69;
  // Low scoring confidence suppresses evaluative feedback entirely: the child
  // sees a calm neutral screen instead of praise or "keep practicing".
  // Neutral only when the model itself is unsure of the score. An attempt can
  // be flagged needs_teacher_review for other reasons (e.g. ASR could not
  // verify the word) while the phoneme evidence is strong — the child still
  // earned the celebration; the flag lives on in the teacher's review queue.
  const isNeutralFeedback = confidenceLevel === "low";
  const isHighScore = !isNeutralFeedback && displayScore >= EXPECTED_PRONUNCIATION_SCORE;
  // Sensory sensitivity varies hugely per ASD child — confetti/vibration/
  // sound that motivates one kid can overwhelm another. Teacher-set per
  // student on the session setup screen; text-based praise stays either way.
  const reduceStimulation = Boolean(student?.reduce_stimulation);
  const phonemeScores = mockPhonemeScores?.length
    ? mockPhonemeScores
    : null;
  const responseDuration = storedResponseDuration ?? 1.3;
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const isLeftSide = index % 2 === 0;
        const lane = Math.floor(index / 2);
        const progress = new Animated.Value(0);
        const translateX = progress.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [isLeftSide ? -220 : 220, isLeftSide ? 10 : -10, 0],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 0.55, 1],
          outputRange: [0, lane % 2 === 0 ? -18 : 18, 76 + (lane % 4) * 14],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            isLeftSide ? "-18deg" : "18deg",
            `${isLeftSide ? 130 + index * 7 : -130 - index * 7}deg`,
          ],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.12, 0.84, 1],
          outputRange: [0, 0.95, 0.95, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.72, 1.08, 0.92],
        });

        return {
          id: index,
          progress,
          translateX,
          translateY,
          rotate,
          opacity,
          scale,
          left: isLeftSide
            ? `${10 + ((lane * 9) % 32)}%`
            : `${58 + ((lane * 9) % 32)}%`,
          top: 28 + (lane % 5) * 28,
          color: ["#F7C948", "#5CC9A7", "#7FA8F8", "#F28B82", "#B794F4"][
            index % 5
          ],
          width: index % 3 === 0 ? 12 : 9,
          height: index % 4 === 0 ? 12 : 18,
        };
      }),
    [],
  );

  const lowScoreTranslateX = lowScoreShake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-8, 8],
  });

  const nextWord = useMemo(() => {
    const currentIndex = words.findIndex((item) => item.id === currentWord?.id);
    if (recommendation?.word) return recommendation.word;
    if (currentIndex >= 0 && words[currentIndex + 1]) {
      return words[currentIndex + 1];
    }
    return words.find((item) => item.id === "dog") || words[0];
  }, [currentWord?.id, recommendation?.word, words]);

  const sounds = phonemeScores || currentWord?.sounds || [];
  const weakSoundText = recommendation?.weakPhoneme
    ? `/${recommendation.weakPhoneme}/`
    : null;
  const weakSoundCue = recommendation?.weakPhonemeCue || null;

  async function unloadCelebrationSounds() {
    const soundsToUnload = celebrationSoundsRef.current;
    celebrationSoundsRef.current = [];

    await Promise.all(
      soundsToUnload.map((sound) => sound.unloadAsync().catch(() => {})),
    );
  }

  async function playCelebrationAudio() {
    if (hasPlayedCelebrationAudioRef.current) return;
    hasPlayedCelebrationAudioRef.current = true;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      await unloadCelebrationSounds();

      const { sound: wellDoneSound } = await Audio.Sound.createAsync(
        WELL_DONE_AUDIO_ASSET,
        { shouldPlay: true, volume: 1 },
      );
      celebrationSoundsRef.current = [wellDoneSound];

      wellDoneSound.setOnPlaybackStatusUpdate(async (status) => {
        if (!status.isLoaded || !status.didJustFinish) return;

        wellDoneSound.setOnPlaybackStatusUpdate(null);

        try {
          const { sound: hooraySound } = await Audio.Sound.createAsync(
            HOORAY_AUDIO_ASSET,
            { shouldPlay: true, volume: 0.95 },
          );
          celebrationSoundsRef.current = [
            ...celebrationSoundsRef.current,
            hooraySound,
          ];
          hooraySound.setOnPlaybackStatusUpdate((hoorayStatus) => {
            if (!hoorayStatus.isLoaded || !hoorayStatus.didJustFinish) return;
            hooraySound.unloadAsync().catch(() => {});
            celebrationSoundsRef.current = celebrationSoundsRef.current.filter(
              (sound) => sound !== hooraySound,
            );
          });
        } catch (error) {
          console.log("Hooray audio playback error:", error.message);
        } finally {
          wellDoneSound.unloadAsync().catch(() => {});
          celebrationSoundsRef.current = celebrationSoundsRef.current.filter(
            (sound) => sound !== wellDoneSound,
          );
        }
      });
    } catch (error) {
      hasPlayedCelebrationAudioRef.current = false;
      console.log("Celebration audio playback error:", error.message);
    }
  }

  useEffect(() => {
    if (hasSavedResultRef.current || !studentId || !currentWord?.id) return;

    hasSavedResultRef.current = true;

    // Scoring already persisted the attempt server-side; finish that row with
    // the client-only workflow fields instead of re-uploading audio and
    // echoing scores back (the server ignores scoring fields on this path).
    const payload = scoredResultId
      ? {
          result_id: scoredResultId,
          listen_choose_data: savedListenChooseData,
          recording_uri: recordingUri || null,
          workflow_completed: true,
        }
      : buildPronunciationResultPayload({
      mode,
      categoryId,
      isAlphabetMode,
      currentWord,
      displayScore,
      sounds,
      responseDuration,
      hesitationTime,
      recommendation,
      nextWord,
      numberOfAttempts,
      recordingUri,
      rawAudioBase64,
      rawAudioMimeType,
      rawAudioSize,
      listenChooseData: savedListenChooseData,
      scoringMethod,
      recognizedText,
      speechVerification,
      confidenceLevel,
      needsTeacherReview,
      heardReferenceAudio,
    });

    teacherApi.savePronunciationResult(studentId, payload).catch((error) => {
      hasSavedResultRef.current = false;
      console.log("Unable to save pronunciation result:", error.message);
    });
  }, [
    categoryId,
    currentWord?.id,
    currentWord?.letter,
    currentWord?.word,
    displayScore,
    heardReferenceAudio,
    hesitationTime,
    isAlphabetMode,
    savedListenChooseData,
    mode,
    nextWord?.id,
    numberOfAttempts,
    recommendation?.message,
    recommendation?.type,
    recommendation?.details,
    rawAudioBase64,
    rawAudioMimeType,
    rawAudioSize,
    recordingUri,
    responseDuration,
    scoredResultId,
    sounds,
    studentId,
  ]);

  useEffect(() => {
    if (isNeutralFeedback) return undefined;

    if (isHighScore) {
      if (reduceStimulation) return undefined;

      Vibration.vibrate(35);
      playCelebrationAudio();

      const animations = confettiPieces.map((piece, index) => {
        piece.progress.setValue(0);
        return Animated.timing(piece.progress, {
          toValue: 1,
          duration: 1550 + (index % 4) * 110,
          delay: Math.floor(index / 2) * 34,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
      });

      Animated.stagger(8, animations).start();
      return () => {
        hasPlayedCelebrationAudioRef.current = false;
        unloadCelebrationSounds();
      };
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lowScorePulse, {
          toValue: 1.08,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lowScorePulse, {
          toValue: 1,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const shakeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lowScoreShake, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(lowScoreShake, {
          toValue: -1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(lowScoreShake, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.delay(850),
      ]),
    );

    pulseLoop.start();
    shakeLoop.start();

    return () => {
      pulseLoop.stop();
      shakeLoop.stop();
    };
  }, [confettiPieces, isHighScore, isNeutralFeedback, lowScorePulse, lowScoreShake, reduceStimulation]);

  function handleGoDashboard() {
    navigation.navigate("PronunciationSessionSetup", { student });
  }

  function handleGoHome() {
    navigation.reset({
      index: 0,
      routes: [{ name: "WorkspaceSelect" }],
    });
  }

  function handleTryAgain() {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);
    // { pop: true } collapses the stack back to the existing LearnWord entry
    // instead of just moving it to the top — without it, this word's Tap
    // Sounds/Speak/Result screens were left behind as a hidden back-stack
    // instead of being discarded, which is what produced the "screen was
    // removed natively but didn't get removed from JS state" error: those
    // stale guarded screens could still get force-removed later (e.g. by
    // Home's reset) while genuinely mid-transition.
    navigation.navigate(
      "PronunciationLearnWord",
      {
        student,
        mode,
        categoryId: navigationCategoryId,
        wordId: currentWord?.id,
        word: currentWord,
      },
      { pop: true }
    );
  }

  function handleNextWord() {
    setSelectedWord(nextWord);
    navigation.navigate(
      "PronunciationLearnWord",
      {
        student,
        mode,
        categoryId: navigationCategoryId,
        wordId: nextWord?.id,
        word: nextWord,
      },
      { pop: true }
    );
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topBar, isCompact && styles.topBarCompact, { borderColor: theme.cardOutline }]}>
          <View style={styles.studentWrap}>
            <AvatarIdentityBadge
              avatarKey={student?.avatar_key}
              theme={theme}
              size={40}
              style={styles.avatarDot}
            />
            <View style={styles.studentTitleWrap}>
              <Text style={[styles.studentText, isCompact && styles.studentTextCompact, { color: theme.headingText }]}>
                {student?.full_name || "Leo M."}'s Result
              </Text>
              <View style={styles.completedPill}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={Colors.status.success}
                />
                <Text style={styles.completedPillText}>Completed</Text>
              </View>
            </View>
          </View>
          <View style={[styles.buttonsGroup, isCompact && styles.buttonsGroupCompact]}>
            <FeedbackButton
              style={[styles.homeBtn, isCompact && styles.navBtnCompact]}
              activeOpacity={0.88}
              onPress={handleGoHome}
            >
              <Ionicons name="home" size={16} color="#5C6C85" />
              <Text style={styles.btnText}>Home</Text>
            </FeedbackButton>
            <FeedbackButton
              style={[styles.dashboardBtn, isCompact && styles.navBtnCompact]}
              activeOpacity={0.88}
              onPress={handleGoDashboard}
            >
              <Ionicons name="home-outline" size={16} color="#5C6C85" />
              <Text style={styles.btnText}>Dashboard</Text>
            </FeedbackButton>
          </View>
        </View>

        <View style={styles.studentResultWrap}>
          <View
            style={[
              styles.studentResultCard,
              {
                backgroundColor: theme.cardSurface,
                borderColor: isHighScore || isNeutralFeedback ? theme.cardOutline : "#FFB7C4",
              },
            ]}
          >
            {isHighScore && !reduceStimulation && <ConfettiBurst pieces={confettiPieces} />}

            {isNeutralFeedback ? (
              <View style={styles.celebrationContent}>
                <View
                  style={[
                    styles.resultIconWrap,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Ionicons name="people" size={44} color={theme.button} />
                </View>
                <Text
                  style={[
                    styles.studentResultTitle,
                    isCompact && styles.studentResultTitleCompact,
                    { color: theme.headingText },
                  ]}
                >
                  Let's Try Together
                </Text>
                <Text
                  style={[
                    styles.studentResultTitleSinhala,
                    isCompact && styles.studentResultTitleSinhalaCompact,
                    { color: theme.headingText },
                  ]}
                >
                  එකට උත්සාහ කරමු
                </Text>
                <View style={styles.reviewPill}>
                  <Ionicons name="eye-outline" size={13} color={Colors.status.review} />
                  <Text style={styles.reviewPillText}>Flagged for teacher review</Text>
                </View>
              </View>
            ) : isHighScore ? (
              <View style={styles.celebrationContent}>
                <View
                  style={[
                    styles.resultIconWrap,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Ionicons name="sparkles" size={44} color={theme.button} />
                </View>
                <Text
                  style={[
                    styles.studentResultTitle,
                    isCompact && styles.studentResultTitleCompact,
                    { color: theme.headingText },
                  ]}
                >
                  Great Job
                </Text>
                <Text
                  style={[
                    styles.studentResultTitleSinhala,
                    isCompact && styles.studentResultTitleSinhalaCompact,
                    { color: theme.headingText },
                  ]}
                >
                  හරිම හොඳයි
                </Text>
              </View>
            ) : (
              <Animated.View
                style={[
                  styles.lowScoreContent,
                  {
                    transform: [
                      { translateX: lowScoreTranslateX },
                      { scale: lowScorePulse },
                    ],
                  },
                ]}
              >
                <View style={styles.lowScoreIconWrap}>
                  <Ionicons name="refresh-circle" size={52} color={Colors.status.error} />
                </View>
                <Text
                  style={[
                    styles.studentResultTitle,
                    styles.lowScoreTitle,
                    isCompact && styles.studentResultTitleCompact,
                  ]}
                >
                  Keep Practicing
                </Text>
                <Text
                  style={[
                    styles.studentResultTitleSinhala,
                    styles.lowScoreTitle,
                    isCompact && styles.studentResultTitleSinhalaCompact,
                  ]}
                >
                  තව පුහුණු වෙමු
                </Text>
                {weakSoundText ? (
                  <View style={styles.soundFocusCard}>
                    <Text style={styles.soundFocusLabel}>Sound to practice</Text>
                    <Text style={styles.soundFocusSound}>{weakSoundText}</Text>
                    {weakSoundCue ? (
                      <Text style={styles.soundFocusCue}>{weakSoundCue}</Text>
                    ) : null}
                  </View>
                ) : null}
              </Animated.View>
            )}
          </View>

          <View style={[styles.studentActions, isCompact && styles.studentActionsCompact]}>
            <FeedbackButton
              style={styles.tryAgainBtn}
              activeOpacity={0.9}
              onPress={handleTryAgain}
            >
              <Ionicons name="refresh-outline" size={24} color="#4B5B72" />
              <Text style={styles.tryAgainText}>Try Again</Text>
            </FeedbackButton>

            <FeedbackButton
              style={styles.nextWordBtnWrap}
              activeOpacity={0.9}
              onPress={handleNextWord}
            >
              <ThemedGradientFill theme={theme} style={styles.nextWordBtn}>
                <Text style={styles.nextWordBtnText}>
                  {isAlphabetMode ? "Next Letter" : "Next Word"}
                </Text>
                <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
              </ThemedGradientFill>
            </FeedbackButton>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  safeInner: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Layout.spacing.lg,
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    maxWidth: 1040,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 2,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarCompact: {
    height: "auto",
    minHeight: 60,
    alignItems: "stretch",
    flexDirection: "column",
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
  },
  studentWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  studentTitleWrap: {
    flex: 1,
  },
  avatarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#AFC4DA",
    backgroundColor: "#E8F0F9",
  },
  studentText: {
    fontSize: 34,
    color: "#1F2F49",
    fontFamily: Layout.fonts.bold,
  },
  studentTextCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  buttonsGroup: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  buttonsGroupCompact: {
    width: "100%",
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F3F5F8",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 42,
  },
  dashboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F3F5F8",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 42,
  },
  navBtnCompact: {
    flex: 1,
  },
  btnText: {
    color: "#5D6D87",
    fontFamily: Layout.fonts.bold,
    fontSize: 14,
  },
  completedPill: {
    alignSelf: "flex-start",
    marginTop: 3,
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: Colors.status.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  completedPillText: {
    color: Colors.status.success,
    fontSize: 11,
    fontFamily: Layout.fonts.bold,
  },
  reviewPill: {
    alignSelf: "center",
    marginTop: 10,
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: Colors.status.reviewLight,
    borderWidth: 1,
    borderColor: Colors.status.reviewBorder,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reviewPillText: {
    color: Colors.status.review,
    fontSize: 11,
    fontFamily: Layout.fonts.bold,
  },
  dashboardText: {
    color: "#5D6D87",
    fontFamily: Layout.fonts.bold,
    fontSize: 14,
  },
  contentRow: {
    width: "100%",
    maxWidth: 1040,
    marginTop: 16,
    flexDirection: "row",
    gap: 18,
  },
  contentRowCompact: {
    flexDirection: "column",
  },
  studentResultWrap: {
    width: "100%",
    maxWidth: 760,
    marginTop: 22,
    alignItems: "center",
  },
  studentResultCard: {
    width: "100%",
    minHeight: 360,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: Layout.spacing.lg,
  },
  celebrationContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: Layout.spacing.lg,
  },
  lowScoreContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: Layout.spacing.lg,
  },
  resultIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  lowScoreIconWrap: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: "#FFF0F3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFB7C4",
  },
  studentResultTitle: {
    fontSize: 58,
    lineHeight: 68,
    fontFamily: Layout.fonts.extrabold,
    textAlign: "center",
  },
  studentResultTitleSinhala: {
    marginTop: -8,
    fontSize: 34,
    lineHeight: 42,
    fontFamily: Layout.fonts.extrabold,
    textAlign: "center",
    opacity: 0.82,
  },
  studentResultTitleCompact: {
    fontSize: 38,
    lineHeight: 46,
  },
  studentResultTitleSinhalaCompact: {
    marginTop: -4,
    fontSize: 26,
    lineHeight: 34,
  },
  lowScoreTitle: {
    color: Colors.status.error,
  },
  soundFocusCard: {
    marginTop: 4,
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFD3DC",
    backgroundColor: "#FFF5F7",
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  soundFocusLabel: {
    fontSize: 12,
    fontFamily: Layout.fonts.bold,
    color: "#B23A57",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  soundFocusSound: {
    marginTop: 4,
    fontSize: 30,
    fontFamily: Layout.fonts.extrabold,
    color: "#7A1F35",
  },
  soundFocusCue: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Layout.fonts.semibold,
    color: "#5C3541",
    textAlign: "center",
  },
  studentActions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  studentActionsCompact: {
    flexDirection: "column",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiPiece: {
    position: "absolute",
    width: 10,
    height: 18,
    borderRadius: 3,
  },
  leftPanel: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D6E2EF",
    padding: 18,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  scoreRowCompact: {
    alignItems: "flex-start",
  },
  scoreCircle: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 2,
    borderColor: "#4B5B72",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 38,
    fontFamily: Layout.fonts.bold,
    color: "#3A4A63",
  },
  summaryWrap: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 43,
    fontFamily: Layout.fonts.extrabold,
    color: "#27354D",
  },
  feedbackTitleCompact: {
    fontSize: 30,
    lineHeight: 36,
  },
  starsRow: {
    flexDirection: "row",
    marginTop: 4,
    gap: 2,
  },
  responseChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#F3F6FA",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  responseChipText: {
    color: "#667A95",
    fontSize: 12,
    fontFamily: Layout.fonts.semibold,
  },
  breakdownTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    color: "#2E3E56",
    fontFamily: Layout.fonts.bold,
  },
  rightPanel: {
    width: 260,
    gap: 10,
  },
  rightPanelCompact: {
    width: "100%",
  },
  suggestionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E2EF",
    padding: 12,
  },
  suggestionTop: {
    flexDirection: "row",
    gap: 10,
  },
  botIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ECF5FD",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: Layout.fonts.extrabold,
    color: "#2F3F58",
  },
  suggestionCopy: {
    marginTop: 3,
    fontSize: 12,
    color: "#697D97",
    lineHeight: 16,
  },
  nextWordCard: {
    marginTop: 10,
    backgroundColor: "#F6F7F9",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  nextWordHint: {
    fontSize: 11,
    color: "#8C9AB0",
    fontFamily: Layout.fonts.bold,
  },
  nextWordText: {
    fontSize: 18,
    color: "#1E2E47",
    fontFamily: Layout.fonts.bold,
    marginTop: 2,
    textTransform: "lowercase",
  },
  tryAgainBtn: {
    backgroundColor: "#F5F7FA",
    borderRadius: 22,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tryAgainText: {
    color: "#37475F",
    fontSize: 17,
    fontFamily: Layout.fonts.bold,
  },
  nextWordBtnWrap: {
    borderRadius: 24,
    height: 50,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    ...Layout.shadow.md,
  },
  nextWordBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  nextWordBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: Layout.fonts.extrabold,
  },
});
