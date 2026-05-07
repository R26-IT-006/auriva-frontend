import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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

function getScoreBarColor(score) {
  if (score >= 80) return "#9ECC9F";
  if (score >= 60) return "#E6C47A";
  return "#E09A8F";
}

export default function PronunciationResultScreen({ navigation, route }) {
  const student = route.params?.student;
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
  const phonemeScores = mockPhonemeScores?.length
    ? mockPhonemeScores
    : null;
  const responseDuration = storedResponseDuration ?? 1.3;

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

        <View style={[styles.contentRow, isCompact && styles.contentRowCompact]}>
          <View style={[styles.leftPanel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <View style={[styles.scoreRow, isCompact && styles.scoreRowCompact]}>
              <View style={[styles.scoreCircle, { borderColor: theme.button }]}>
                <Text style={[styles.scoreText, { color: theme.headingText }]}>{displayScore} %</Text>
              </View>

              <View style={styles.summaryWrap}>
                <Text style={[styles.feedbackTitle, isCompact && styles.feedbackTitleCompact, { color: theme.headingText }]}>
                  {displayScore >= 80 ? "Great Job!" : "Good Try!"}
                </Text>
                <View style={styles.starsRow}>
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Ionicons
                      key={star}
                      name={star < 3 ? "star-outline" : "star-outline"}
                      size={24}
                      color={star < 3 ? "#E9BC63" : "#D8DEE8"}
                    />
                  ))}
                </View>
                <View style={styles.responseChip}>
                  <Ionicons name="time-outline" size={14} color="#6B7C95" />
                  <Text style={styles.responseChipText}>
                    {responseDuration} s response
                    {hesitationTime ? ` - ${hesitationTime} s pause` : ""}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.breakdownTitle}>Sound Breakdown</Text>

            {sounds.map((sound, index) => {
              const value = sound.score || [91, 40, 76][index] || displayScore;
              return (
                <ProgressRow
                  key={`${sound.text}-${index}`}
                  label={sound.text || "/-/"}
                  value={value}
                  barColor={getScoreBarColor(value)}
                />
              );
            })}
          </View>

          <View style={[styles.rightPanel, isCompact && styles.rightPanelCompact]}>
            <View style={[styles.suggestionCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              <View style={styles.suggestionTop}>
                <View style={styles.botIconWrap}>
                  <Ionicons name="happy-outline" size={16} color="#4587AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle}>
                    Adaptive Suggestion
                  </Text>
                  <Text style={styles.suggestionCopy}>
                    {recommendation?.message ||
                      (isAlphabetMode
                        ? "Let's try another letter at the same level."
                        : "Let's try another word at the same level.")}
                  </Text>
                </View>
              </View>

              <View style={styles.nextWordCard}>
                <Text style={styles.nextWordHint}>
                  {isAlphabetMode ? "Next Letter" : "Next Word"}
                </Text>
                <Text style={styles.nextWordText}>
                  {isAlphabetMode ? nextWord?.letter || "B" : nextWord?.word || "dog"}
                </Text>
              </View>
            </View>

            <FeedbackButton
              style={styles.tryAgainBtn}
              activeOpacity={0.9}
              onPress={handleTryAgain}
            >
              <Ionicons name="refresh-outline" size={26} color="#4B5B72" />
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
