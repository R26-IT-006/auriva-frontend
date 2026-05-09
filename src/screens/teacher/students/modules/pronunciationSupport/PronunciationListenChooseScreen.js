import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { getWordImageSource, WORD_BANK } from "./wordBank.js";
import { WORD_AUDIO_ASSETS, WORD_AUDIO_IDS } from "./pronunciationAudioAssets.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";

function buildActivityWords(categoryId, preferredWord) {
  const categoryWords = WORD_BANK[categoryId] || WORD_BANK.animals || [];
  if (preferredWord?.id && WORD_AUDIO_ASSETS[preferredWord.id]) {
    return [preferredWord];
  }

  const targets = WORD_AUDIO_IDS
    .map((id) => categoryWords.find((word) => word.id === id))
    .filter(Boolean);

  return targets.length ? targets : categoryWords.slice(0, 1);
}

function buildChoices(categoryId, targetWord) {
  const categoryWords = WORD_BANK[categoryId] || WORD_BANK.animals || [];
  const distractors = categoryWords.filter((word) => word.id !== targetWord?.id);
  return [targetWord, ...distractors].filter(Boolean).slice(0, 4);
}

function ChoiceCard({ item, state, onPress, width, disabled }) {
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";
  const imageSource = getWordImageSource(item);

  return (
    <ButtonFeedback
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.choiceCard,
        { width },
        disabled && styles.choiceCardDisabled,
        isCorrect && styles.choiceCardCorrect,
        isWrong && styles.choiceCardWrong,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${item.word}`}
    >
      <View style={[styles.choiceImageWrap, { backgroundColor: item.color || "#E8EDF4" }]}>
        {imageSource ? (
          <Image source={imageSource} resizeMode="cover" style={styles.choiceImage} />
        ) : (
          <Ionicons name="image-outline" size={36} color="#6D7890" />
        )}
      </View>
      <Text style={styles.choiceLabel}>{item.word}</Text>
      {isCorrect ? (
        <View style={styles.resultBadge}>
          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
        </View>
      ) : null}
      {isWrong ? (
        <View style={[styles.resultBadge, styles.resultBadgeWrong]}>
          <Ionicons name="close" size={15} color="#FFFFFF" />
        </View>
      ) : null}
    </ButtonFeedback>
  );
}

export default function PronunciationListenChooseScreen({ navigation, route }) {
  const student = route.params?.student;
  const categoryId = route.params?.categoryId || "animals";
  const routeWord = route.params?.word;
  const assessedWordId = route.params?.wordId || routeWord?.id;
  const theme = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();
  const soundRef = React.useRef(null);
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const setListenChooseData = usePronunciationSessionStore(
    (state) => state.setListenChooseData,
  );
  const activityWords = React.useMemo(
    () => buildActivityWords(categoryId, routeWord),
    [categoryId, routeWord],
  );
  const [roundIndex, setRoundIndex] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState(null);
  const [attempts, setAttempts] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasHeardTarget, setHasHeardTarget] = React.useState(false);
  const choiceAttemptsRef = React.useRef([]);

  const targetWord = activityWords[roundIndex] || activityWords[0];
  const choices = React.useMemo(
    () => buildChoices(categoryId, targetWord),
    [categoryId, targetWord],
  );
  const isCompact = width < 720;
  const cardWidth = React.useMemo(() => {
    if (width < 520) return width - Layout.spacing.lg * 2;
    if (width >= 980) return 210;
    return Math.min(230, (width - Layout.spacing.lg * 2 - Layout.spacing.md) / 2);
  }, [width]);
  const didChooseCorrect = selectedId === targetWord?.id;

  React.useEffect(() => {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [setCurrentActivityStep]);

  React.useEffect(() => {
    setSelectedId(null);
    setAttempts(0);
    setHasHeardTarget(false);
    choiceAttemptsRef.current = [];
  }, [roundIndex]);

  async function playTargetWord() {
    const audioAsset = WORD_AUDIO_ASSETS[targetWord?.id];
    if (!audioAsset) return;

    try {
      setIsPlaying(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(audioAsset, {
        shouldPlay: true,
        volume: 1,
      });

      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setHasHeardTarget(true);
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        }
      });
    } catch (error) {
      console.log("Listen and choose playback error:", error);
      setIsPlaying(false);
    }
  }

  function handleSelectChoice(item) {
    if (!hasHeardTarget || isPlaying) return;

    choiceAttemptsRef.current = [...choiceAttemptsRef.current, item.id];
    setSelectedId(item.id);
    setAttempts(choiceAttemptsRef.current.length);
  }

  function handleNext() {
    if (!targetWord) return;
    const assessedWord = routeWord || targetWord;
    const resultWordId = assessedWordId || assessedWord?.id || targetWord.id;
    const totalAttempts = Math.max(choiceAttemptsRef.current.length, selectedId ? attempts : 1);
    const nextListenChooseData = {
      activity_type: "listen_choose",
      target_word_id: targetWord.id,
      target_word_label: targetWord.word,
      selected_choice_id: selectedId,
      selected_choice_label:
        choices.find((item) => item.id === selectedId)?.word || null,
      is_correct: didChooseCorrect,
      attempts: totalAttempts,
      attempted_choice_ids: choiceAttemptsRef.current,
      choice_ids: choices.map((item) => item.id),
    };

    setListenChooseData(nextListenChooseData);
    navigation.navigate("PronunciationResult", {
      student,
      mode: PRONUNCIATION_MODES.WORD,
      categoryId,
      wordId: resultWordId,
      word: assessedWord,
      listenChooseData: nextListenChooseData,
    });
  }

  function handleNextRound() {
    if (roundIndex < activityWords.length - 1) {
      setRoundIndex((value) => value + 1);
      return;
    }

    navigation.goBack();
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <ButtonFeedback
              style={[styles.backBtn, { borderColor: theme.cardOutline }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.82}
            >
              <Ionicons name="chevron-back" size={20} color={theme.headingText} />
            </ButtonFeedback>

            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.headingText }]}>Listen and Choose</Text>
              <Text style={[styles.subtitle, { color: theme.headingText }]}>
                {student?.full_name ? `${student.full_name}'s listening activity` : "Listening activity"}
              </Text>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <View style={[styles.promptRow, isCompact && styles.promptRowCompact]}>
              <View style={styles.promptCopy}>
                <Text style={[styles.promptTitle, { color: theme.headingText }]}>Tap the picture you hear</Text>
                <Text style={[styles.roundText, { color: theme.headingText }]}>
                  Round {roundIndex + 1} of {activityWords.length}
                </Text>
              </View>

              <ButtonFeedback
                activeOpacity={0.88}
                onPress={playTargetWord}
                style={[styles.playBtn, { backgroundColor: theme.button }, isPlaying && styles.playBtnActive]}
              >
                <Ionicons name="volume-high-outline" size={22} color="#FFFFFF" />
                <Text style={styles.playBtnText}>{isPlaying ? "Playing" : "Play Word"}</Text>
              </ButtonFeedback>
            </View>

            <View style={styles.choicesGrid}>
              {choices.map((item) => {
                const state = selectedId === item.id
                  ? item.id === targetWord?.id
                    ? "correct"
                    : "wrong"
                  : "idle";

                return (
                  <ChoiceCard
                    key={item.id}
                    item={item}
                    state={state}
                    width={cardWidth}
                    disabled={!hasHeardTarget || isPlaying}
                    onPress={() => handleSelectChoice(item)}
                  />
                );
              })}
            </View>

            <View style={[styles.feedbackBar, didChooseCorrect ? styles.feedbackBarCorrect : styles.feedbackBarNeutral]}>
              <Ionicons
                name={didChooseCorrect ? "checkmark-circle" : selectedId ? "refresh-circle" : "ear-outline"}
                size={22}
                color={didChooseCorrect ? Colors.status.success : "#60728B"}
              />
              <Text style={styles.feedbackText}>
                {!hasHeardTarget
                  ? "Press play first. Choices unlock after the word finishes."
                  : didChooseCorrect
                  ? attempts <= 1
                    ? "Great listening. That was the right picture."
                    : "Nice correction. You found the right picture."
                  : selectedId
                    ? "Choice saved. You can continue or tap another picture."
                    : "Now choose the picture that matches the word."}
              </Text>
            </View>

            <View style={[styles.actionsRow, isCompact && styles.actionsRowCompact]}>
              <ButtonFeedback
                activeOpacity={0.86}
                onPress={playTargetWord}
                style={[styles.secondaryBtn, { borderColor: theme.cardOutline }]}
              >
                <Ionicons name="refresh" size={18} color={theme.headingText} />
                <Text style={[styles.secondaryBtnText, { color: theme.headingText }]}>Replay</Text>
              </ButtonFeedback>

              <ButtonFeedback
                activeOpacity={0.9}
                disabled={!selectedId}
                onPress={handleNext}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.button },
                  !selectedId && styles.primaryBtnDisabled,
                ]}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </ButtonFeedback>

              {activityWords.length > 1 ? (
                <ButtonFeedback
                  activeOpacity={0.86}
                  disabled={!selectedId}
                  onPress={handleNextRound}
                  style={[
                    styles.secondaryBtn,
                    { borderColor: theme.cardOutline },
                    !selectedId && styles.secondaryBtnDisabled,
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.headingText }]}>Next</Text>
                </ButtonFeedback>
              ) : null}
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
  scroll: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
    alignItems: "center",
  },
  headerRow: {
    width: "100%",
    maxWidth: 1040,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Layout.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.32)",
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: Layout.fontSize.xxxl,
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.sm,
  },
  panel: {
    width: "100%",
    maxWidth: 1040,
    marginTop: Layout.spacing.lg,
    borderRadius: 22,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    minHeight: 520,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.lg,
  },
  promptRowCompact: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  promptCopy: {
    flex: 1,
  },
  promptTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: 0,
  },
  roundText: {
    marginTop: 4,
    fontSize: Layout.fontSize.sm,
    opacity: 0.78,
  },
  playBtn: {
    minWidth: 170,
    minHeight: 58,
    borderRadius: 29,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.86)",
    ...Layout.shadow.md,
  },
  playBtnActive: {
    transform: [{ scale: 0.98 }],
  },
  playBtnText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.lg,
    fontWeight: "800",
  },
  choicesGrid: {
    marginTop: Layout.spacing.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Layout.spacing.md,
  },
  choiceCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#DCE4EF",
    backgroundColor: "#FFFFFF",
    padding: 10,
    ...Layout.shadow.sm,
  },
  choiceCardDisabled: {
    opacity: 0.48,
  },
  choiceCardCorrect: {
    borderColor: Colors.status.success,
    backgroundColor: Colors.status.successLight,
  },
  choiceCardWrong: {
    borderColor: Colors.status.error,
    backgroundColor: Colors.status.errorLight,
  },
  choiceImageWrap: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  choiceImage: {
    width: "100%",
    height: "100%",
  },
  choiceLabel: {
    marginTop: 10,
    fontSize: Layout.fontSize.xl,
    lineHeight: 26,
    color: Colors.text.primary,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "lowercase",
  },
  resultBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.status.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  resultBadgeWrong: {
    backgroundColor: Colors.status.error,
  },
  feedbackBar: {
    marginTop: Layout.spacing.xl,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  feedbackBarNeutral: {
    backgroundColor: "#F4F7FB",
    borderColor: "#DCE4EF",
  },
  feedbackBarCorrect: {
    backgroundColor: Colors.status.successLight,
    borderColor: "#BFE8CE",
  },
  feedbackText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    lineHeight: 21,
    fontWeight: Layout.fontWeight.semibold,
  },
  actionsRow: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  actionsRowCompact: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.42)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnDisabled: {
    opacity: 0.42,
  },
  secondaryBtnText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: "800",
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  primaryBtnDisabled: {
    backgroundColor: "#DDE5EF",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.md,
    fontWeight: "800",
  },
});
