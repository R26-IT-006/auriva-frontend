import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
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

function ProgressRow({ label, value, barColor }) {
  return (
    <View style={styles.progressRow}>
      <View style={styles.soundTag}>
        <Text style={styles.soundTagText}>{label}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${value}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={styles.progressValue}>{value}%</Text>
    </View>
  );
}

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
              opacity: piece.opacity,
              transform: [
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

function getScoreBarColor(score) {
  if (score >= 80) return "#9ECC9F";
  if (score >= 60) return "#E6C47A";
  return "#E09A8F";
}

export default function PronunciationResultScreen({ navigation, route }) {
  const student = route.params?.student;
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
  const recommendation = usePronunciationSessionStore(
    (state) => state.adaptiveRecommendation,
  );
  const recordingUri = usePronunciationSessionStore(
    (state) => state.recordingUri,
  );
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
  const wordId = route.params?.wordId || sessionWord?.id || "cat";

  const words = isAlphabetMode ? ALPHABET_BANK : WORD_BANK[categoryId] || [];
  const currentWord =
    words.find((item) => item.id === wordId) || sessionWord || words[0];
  const displayScore = mockWordScore ?? 69;
  const isHighScore = displayScore >= 80;
  const phonemeScores = mockPhonemeScores?.length
    ? mockPhonemeScores
    : null;
  const responseDuration = storedResponseDuration ?? 1.3;
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => {
        const progress = new Animated.Value(0);
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 120 + (index % 4) * 18],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${180 + index * 24}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.2, 0.82, 1],
          outputRange: [0, 1, 1, 0],
        });
        const scale = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.08],
        });

        return {
          id: index,
          progress,
          translateY,
          rotate,
          opacity,
          scale,
          left: `${8 + ((index * 17) % 84)}%`,
          top: 12 + (index % 3) * 10,
          color: ["#F7C948", "#5CC9A7", "#7FA8F8", "#F28B82", "#B794F4"][
            index % 5
          ],
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

  const sounds = phonemeScores || currentWord?.sounds || [
    { text: "/k/", score: 91 },
    { text: "/æ/", score: 40 },
    { text: "/t/", score: 76 },
  ];

  useEffect(() => {
    if (hasSavedResultRef.current || !student?.sid || !currentWord?.id) return;

    hasSavedResultRef.current = true;

    const payload = {
      mode,
      category_id: isAlphabetMode ? null : categoryId,
      word_id: currentWord.id,
      word_label: currentWord.letter || currentWord.word || currentWord.id,
      overall_score: displayScore,
      phoneme_scores: sounds.map((sound, index) => ({
        text: sound.text || "",
        type: sound.type || null,
        score: sound.score ?? [91, 40, 76][index] ?? displayScore,
      })),
      response_duration: responseDuration,
      hesitation_time: hesitationTime ?? null,
      recommendation_type: recommendation?.type || null,
      recommendation_message: recommendation?.message || null,
      next_word_id: nextWord?.id || null,
      attempt_number: Math.max(1, numberOfAttempts || 1),
      recording_uri: recordingUri || null,
    };

    teacherApi.savePronunciationResult(student.sid, payload).catch((error) => {
      hasSavedResultRef.current = false;
      console.log("Unable to save pronunciation result:", error.message);
    });
  }, [
    categoryId,
    currentWord?.id,
    currentWord?.letter,
    currentWord?.word,
    displayScore,
    hesitationTime,
    isAlphabetMode,
    mode,
    nextWord?.id,
    numberOfAttempts,
    recommendation?.message,
    recommendation?.type,
    recordingUri,
    responseDuration,
    sounds,
    student?.sid,
  ]);

  useEffect(() => {
    if (isHighScore) {
      const animations = confettiPieces.map((piece, index) => {
        piece.progress.setValue(0);
        return Animated.timing(piece.progress, {
          toValue: 1,
          duration: 1700 + (index % 4) * 120,
          delay: index * 28,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
      });

      Animated.stagger(8, animations).start();
      return;
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
  }, [confettiPieces, isHighScore, lowScorePulse, lowScoreShake]);

  function handleGoDashboard() {
    navigation.navigate("PronunciationSessionSetup", { student });
  }

  function handleGoHome() {
    navigation.navigate("StudentSession", { student });
  }

  function handleTryAgain() {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);
    navigation.navigate("PronunciationLearnWord", {
      student,
      mode,
      categoryId: navigationCategoryId,
      wordId: currentWord?.id,
      word: currentWord,
    });
  }

  function handleNextWord() {
    setSelectedWord(nextWord);
    navigation.navigate("PronunciationLearnWord", {
      student,
      mode,
      categoryId: navigationCategoryId,
      wordId: nextWord?.id,
      word: nextWord,
    });
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
            <View style={[styles.avatarDot, { backgroundColor: theme.background, borderColor: theme.cardOutline }]} />
            <Text style={[styles.studentText, isCompact && styles.studentTextCompact, { color: theme.headingText }]}>
              {student?.full_name || "Leo M."}'s Result
            </Text>
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
                borderColor: isHighScore ? theme.cardOutline : "#FFB7C4",
              },
            ]}
          >
            {isHighScore && <ConfettiBurst pieces={confettiPieces} />}

            {isHighScore ? (
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
                  <Ionicons name="refresh-circle" size={52} color="#FF4D6D" />
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
              style={[styles.nextWordBtn, { backgroundColor: theme.button }]}
              activeOpacity={0.9}
              onPress={handleNextWord}
            >
              <Text style={styles.nextWordBtnText}>
                {isAlphabetMode ? "Next Letter" : "Next Word"}
              </Text>
              <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
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
  avatarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#AFC4DA",
    backgroundColor: "#E8F0F9",
  },
  studentText: {
    flex: 1,
    fontSize: 34,
    color: "#1F2F49",
    fontWeight: "700",
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
    fontWeight: "700",
    fontSize: 14,
  },
  dashboardText: {
    color: "#5D6D87",
    fontWeight: "700",
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
    fontWeight: "800",
    textAlign: "center",
  },
  studentResultTitleCompact: {
    fontSize: 38,
    lineHeight: 46,
  },
  lowScoreTitle: {
    color: "#FF4D6D",
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
    fontWeight: "700",
    color: "#3A4A63",
  },
  summaryWrap: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 43,
    fontWeight: "800",
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
    fontWeight: "600",
  },
  breakdownTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    color: "#2E3E56",
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  soundTag: {
    width: 38,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F1F5FA",
    alignItems: "center",
    justifyContent: "center",
  },
  soundTagText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3A4A63",
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 8,
    backgroundColor: "#E8EDF4",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
  },
  progressValue: {
    width: 42,
    textAlign: "right",
    color: "#4A5B73",
    fontWeight: "700",
    fontSize: 16,
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
    fontWeight: "800",
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
    fontWeight: "700",
  },
  nextWordText: {
    fontSize: 18,
    color: "#1E2E47",
    fontWeight: "700",
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
    fontWeight: "700",
  },
  nextWordBtn: {
    backgroundColor: "#4A99C8",
    borderRadius: 24,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    ...Layout.shadow.md,
  },
  nextWordBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
