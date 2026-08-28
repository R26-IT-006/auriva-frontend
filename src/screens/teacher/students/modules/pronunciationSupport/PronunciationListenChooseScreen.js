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
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { getWordImageSource, WORD_BANK } from "./wordBank.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
import { WORD_AUDIO_ASSETS, WORD_AUDIO_IDS } from "./pronunciationAudioAssets.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import {
  getPlayableAudioSource,
  setPronunciationPlaybackMode,
  unloadSoundRef,
} from "./pronunciationAudioPlayback.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { EntranceItem, ThemedGradientFill } from "./pronunciationDesignKit.js";
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";

const MIN_FIELD_SIZE = 2;
const MAX_FIELD_SIZE = 4;

// Errorless-learning field-size progression: a target starts supported (few
// choices) and only earns a bigger field once the child shows first-try
// mastery on it, so a brand-new/struggling word never gets thrown into a
// full 4-way guess. Unknown history (still loading, or fetch failed) also
// defaults to the smallest field — safest fallback, never a regression risk.
// Only plain "listen_choose" rounds count toward this streak — sound-focus
// rounds (triggered by a repeated pronunciation mistake, not this activity)
// target whichever word contains the failing phoneme, not necessarily the
// word being progressed here, so they must not distort its mastery streak.
function computeFieldSize(history, targetWordId) {
  if (!targetWordId) return MAX_FIELD_SIZE;

  let streak = 0;
  for (const result of history) {
    const attempt = result?.listen_choose_data;
    if (!attempt || attempt.target_word_id !== targetWordId) continue;
    if (attempt.activity_type && attempt.activity_type !== "listen_choose") continue;
    if (attempt.is_correct && Number(attempt.attempts) <= 1) {
      streak += 1;
      continue;
    }
    break;
  }

  if (streak >= 4) return MAX_FIELD_SIZE;
  if (streak >= 2) return 3;
  return MIN_FIELD_SIZE;
}

function wordHasPhoneme(word, phoneme) {
  return (word?.sounds || []).some((sound) => sound.text === phoneme);
}

// Sound-focus mode: the preferred word is the one that just failed
// pronunciation on the target phoneme, so keep it as the round's target
// whenever it actually contains that sound; otherwise fall back to the
// first audio-available word in the category that does.
function buildActivityWords(categoryId, preferredWord, targetPhoneme = null) {
  const categoryWords = WORD_BANK[categoryId] || WORD_BANK.animals || [];

  if (targetPhoneme) {
    if (preferredWord?.id && WORD_AUDIO_ASSETS[preferredWord.id] && wordHasPhoneme(preferredWord, targetPhoneme)) {
      return [preferredWord];
    }

    const phonemeMatch = WORD_AUDIO_IDS
      .map((id) => categoryWords.find((word) => word.id === id))
      .filter(Boolean)
      .find((word) => wordHasPhoneme(word, targetPhoneme));

    if (phonemeMatch) return [phonemeMatch];
    // No word in this category contains the failing phoneme with audio
    // available — fall through to the normal (non-sound-focus) selection
    // rather than showing a discrimination round that can't target the sound.
  }

  if (preferredWord?.id && WORD_AUDIO_ASSETS[preferredWord.id]) {
    return [preferredWord];
  }

  const targets = WORD_AUDIO_IDS
    .map((id) => categoryWords.find((word) => word.id === id))
    .filter(Boolean);

  return targets.length ? targets : categoryWords.slice(0, 1);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function phonemeOverlapCount(wordA, wordB) {
  const soundsA = new Set((wordA?.sounds || []).map((sound) => sound.text));
  return (wordB?.sounds || []).filter((sound) => soundsA.has(sound.text)).length;
}

// Sort candidates by phoneme overlap with the target, shuffling within each
// overlap tier so equally (dis)similar words still rotate across rounds.
function sortByOverlap(pool, targetWord, direction) {
  const scored = pool.map((word) => ({ word, overlap: phonemeOverlapCount(targetWord, word) }));
  scored.sort((a, b) => (direction === "near" ? b.overlap - a.overlap : a.overlap - b.overlap));

  const tiers = [];
  let start = 0;
  while (start < scored.length) {
    let end = start;
    while (end < scored.length && scored[end].overlap === scored[start].overlap) end += 1;
    tiers.push(...shuffle(scored.slice(start, end)));
    start = end;
  }
  return tiers.map((entry) => entry.word);
}

// Distractor similarity is the actual difficulty lever for discrimination
// tasks: a beginner should see an obviously different picture (far — shares
// no sounds with the target), while a child who has already mastered a word
// should be tested against a near-confusable one (shares sounds with it,
// e.g. "cat" vs "hat") — that's a real listening discrimination challenge,
// not just an easy "spot the odd one out."
function pickDistractors(pool, targetWord, count, mode) {
  if (count <= 0) return [];

  if (mode === "mixed") {
    const near = sortByOverlap(pool, targetWord, "near").slice(0, 1);
    const nearIds = new Set(near.map((word) => word.id));
    const far = sortByOverlap(pool.filter((word) => !nearIds.has(word.id)), targetWord, "far");
    return [...near, ...far].slice(0, count);
  }

  return sortByOverlap(pool, targetWord, mode).slice(0, count);
}

function getDistractorMode(fieldSize) {
  if (fieldSize >= MAX_FIELD_SIZE) return "near";
  if (fieldSize <= MIN_FIELD_SIZE) return "far";
  return "mixed";
}

function buildChoices(categoryId, targetWord, fieldSize = MAX_FIELD_SIZE, targetPhoneme = null) {
  const categoryWords = WORD_BANK[categoryId] || WORD_BANK.animals || [];
  let distractors = categoryWords.filter((word) => word.id !== targetWord?.id);
  let mode = getDistractorMode(fieldSize);

  if (targetPhoneme) {
    // The discrimination challenge is specifically "does this word have the
    // failing sound or not" — distractors that share it would defeat the
    // point, so exclude them and force "near" mode on everything else so the
    // pictures are otherwise as confusable as possible.
    const withoutPhoneme = distractors.filter((word) => !wordHasPhoneme(word, targetPhoneme));
    if (withoutPhoneme.length) distractors = withoutPhoneme;
    mode = "near";
  }

  const distractorCount = Math.max(0, fieldSize - 1);
  const picked = [
    targetWord,
    ...pickDistractors(distractors, targetWord, distractorCount, mode),
  ].filter(Boolean);
  // Target must not always land in the same slot — otherwise a child learns
  // "tap the first picture" instead of actually listening, which silently
  // invalidates the comprehension data this activity is meant to produce.
  return shuffle(picked);
}

function ChoiceCard({ item, index, state, onPress, width, disabled }) {
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";
  const imageStyle = usePronunciationSessionStore((store) => store.imageStyle);
  const imageSource = getWordImageSource(item, imageStyle);

  return (
    <EntranceItem index={index}>
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
    </EntranceItem>
  );
}

export default function PronunciationListenChooseScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const categoryId = route.params?.categoryId || "animals";
  const routeWord = route.params?.word;
  const assessedWordId = route.params?.wordId || routeWord?.id;
  const targetPhoneme = route.params?.targetPhoneme || null;
  const theme = getAvatarTheme(student?.avatar_key);
  const reduceStimulation = Boolean(student?.reduce_stimulation);
  const { isExitConfirmVisible, confirmExit, cancelExit } =
    useExitSessionGuard(navigation);
  const { width } = useWindowDimensions();
  const soundRef = React.useRef(null);
  const [resultsHistory, setResultsHistory] = React.useState([]);
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const setListenChooseData = usePronunciationSessionStore(
    (state) => state.setListenChooseData,
  );
  const activityWords = React.useMemo(
    () => buildActivityWords(categoryId, routeWord, targetPhoneme),
    [categoryId, routeWord, targetPhoneme],
  );
  const [roundIndex, setRoundIndex] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState(null);
  const [attempts, setAttempts] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasHeardTarget, setHasHeardTarget] = React.useState(false);
  const choiceAttemptsRef = React.useRef([]);

  const targetWord = activityWords[roundIndex] || activityWords[0];
  const fieldSize = React.useMemo(
    () => computeFieldSize(resultsHistory, targetWord?.id),
    [resultsHistory, targetWord?.id],
  );
  // buildActivityWords falls back to a non-phoneme word when nothing in the
  // category contains targetPhoneme with audio available — only actually
  // run sound-focus distractor logic (and tag the saved record as such) when
  // the resolved target word really does contain that sound.
  const isSoundFocusRound = Boolean(targetPhoneme) && wordHasPhoneme(targetWord, targetPhoneme);
  const choices = React.useMemo(
    () => buildChoices(categoryId, targetWord, fieldSize, isSoundFocusRound ? targetPhoneme : null),
    [categoryId, targetWord, fieldSize, isSoundFocusRound, targetPhoneme],
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
      stopVoicePrompt();
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

  React.useEffect(() => {
    if (!studentId) return;

    let cancelled = false;

    teacherApi
      .getPronunciationResults(studentId)
      .then((data) => {
        if (!cancelled) setResultsHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Leave resultsHistory empty — field size just stays at the safe
        // minimum, which is never a worse outcome than not scaffolding.
      });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  async function playTargetWord() {
    const audioAsset = WORD_AUDIO_ASSETS[targetWord?.id];
    if (!audioAsset) return;

    try {
      setIsPlaying(true);
      await setPronunciationPlaybackMode();
      await unloadSoundRef(soundRef);

      const playableSource = await getPlayableAudioSource(audioAsset);
      const { sound } = await Audio.Sound.createAsync(playableSource, {
        shouldPlay: false,
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
      await sound.replayAsync();
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

    // Spoken feedback the moment the card is tapped — praise for the right
    // picture, an invitation to retry for the wrong one. Never the word
    // "wrong": the child can keep choosing until the round is right.
    if (item.id === targetWord?.id) {
      playVoicePrompt("goodJob", { reduceStimulation });
    } else {
      playVoicePrompt("tryOneMoreTime");
    }
  }

  function handleNext() {
    if (!targetWord) return;
    const assessedWord = routeWord || targetWord;
    const resultWordId = assessedWordId || assessedWord?.id || targetWord.id;
    const totalAttempts = Math.max(choiceAttemptsRef.current.length, selectedId ? attempts : 1);
    const nextListenChooseData = {
      activity_type: isSoundFocusRound ? "sound_focus_listen_choose" : "listen_choose",
      ...(isSoundFocusRound ? { target_phoneme: targetPhoneme } : {}),
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
              <Text style={[styles.titleSinhala, { color: theme.headingText }]}>අසා තෝරන්න</Text>
              <Text style={[styles.subtitle, { color: theme.headingText }]}>
                {student?.full_name ? `${student.full_name}'s listening activity` : "Listening activity"}
              </Text>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            {isSoundFocusRound ? (
              <View style={styles.soundFocusBanner}>
                <Ionicons name="ear-outline" size={16} color={Colors.status.review} />
                <Text style={styles.soundFocusBannerText}>
                  Listening practice for the /{targetPhoneme}/ sound
                </Text>
              </View>
            ) : null}
            <View style={[styles.promptRow, isCompact && styles.promptRowCompact]}>
              <View style={styles.promptCopy}>
                <Text style={[styles.promptTitle, { color: theme.headingText }]}>Tap the picture you hear</Text>
                <Text style={[styles.promptTitleSinhala, { color: theme.headingText }]}>
                  ඇසෙන පින්තූරය තට්ටු කරන්න
                </Text>
                <Text style={[styles.roundText, { color: theme.headingText }]}>
                  Round {roundIndex + 1} of {activityWords.length}
                </Text>
              </View>

              <ButtonFeedback
                activeOpacity={0.88}
                onPress={playTargetWord}
                soundEnabled={false}
                style={[styles.playBtn, { backgroundColor: theme.button }, isPlaying && styles.playBtnActive]}
              >
                <Ionicons name="volume-high-outline" size={22} color="#FFFFFF" />
                <Text style={styles.playBtnText}>{isPlaying ? "Playing" : "Play Word"}</Text>
              </ButtonFeedback>
            </View>

            <View style={styles.choicesGrid}>
              {choices.map((item, index) => {
                const state = selectedId === item.id
                  ? item.id === targetWord?.id
                    ? "correct"
                    : "wrong"
                  : "idle";

                return (
                  <ChoiceCard
                    key={item.id}
                    item={item}
                    index={index}
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
                soundEnabled={false}
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
                  styles.primaryBtnWrap,
                  !selectedId && styles.primaryBtnDisabled,
                ]}
              >
                <ThemedGradientFill theme={theme} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </ThemedGradientFill>
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

      <ConfirmDialog
        visible={isExitConfirmVisible}
        title="Leave this activity?"
        message="This word's progress hasn't been saved yet. Are you sure you want to go back?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        icon="log-out-outline"
        danger
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
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
    fontFamily: Layout.fonts.bold,
    letterSpacing: 0,
  },
  titleSinhala: {
    marginTop: 2,
    fontSize: Layout.fontSize.xl,
    lineHeight: 28,
    fontFamily: Layout.fonts.extrabold,
    letterSpacing: 0,
    opacity: 0.82,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
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
  soundFocusBanner: {
    alignSelf: "flex-start",
    marginBottom: Layout.spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.status.reviewLight,
    borderWidth: 1,
    borderColor: Colors.status.reviewBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  soundFocusBannerText: {
    color: Colors.status.review,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.extrabold,
    letterSpacing: 0,
  },
  promptTitleSinhala: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: Layout.fonts.extrabold,
    letterSpacing: 0,
    opacity: 0.82,
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
    fontFamily: Layout.fonts.extrabold,
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
    fontFamily: Layout.fonts.extrabold,
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
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.extrabold,
  },
  primaryBtnWrap: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    overflow: "hidden",
  },
  primaryBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: "#DDE5EF",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.extrabold,
  },
});
