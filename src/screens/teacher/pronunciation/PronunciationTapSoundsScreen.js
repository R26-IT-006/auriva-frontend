import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
  ScrollView,
  Vibration,
} from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import { WORD_AUDIO_ASSETS } from "./pronunciationAudioAssets.js";
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
import { EntranceItem, ThemedGradientFill } from "./pronunciationDesignKit.js";
import { getSoundLetters } from "./wordBank.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";

// Local Fisher-Yates, matching PronunciationListenChooseScreen's shuffle —
// duplicating a 4-line helper here rather than importing across two
// unrelated screens for it.
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A shuffle that lands back on the original order defeats the point (the
// child could tap left-to-right without listening at all) — reshuffle once
// if that happens. With 2+ sounds this converges immediately in practice.
function shuffleAvoidingIdentity(items) {
  if (items.length < 2) return items;
  let attempt = shuffle(items);
  if (attempt.every((item, index) => item.originalIndex === items[index].originalIndex)) {
    attempt = shuffle(items);
  }
  return attempt;
}

/**
 * Auditory segmentation game: the child hears the word, then taps its sound
 * chips (shown in shuffled order) in the order those sounds occur in the
 * word. No speech is required, so it works on non-verbal days, and it is
 * deliberately errorless — an out-of-order tap never shows a "wrong" mark,
 * it just doesn't advance, so there is no failure state for the child to
 * see. This is standard phonemic-segmentation practice, adapted so the only
 * signal the child gets is forward progress.
 */
export default function PronunciationTapSoundsScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const reduceStimulation = Boolean(student?.reduce_stimulation);
  const sessionMode = usePronunciationSessionStore((state) => state.selectedMode);
  const mode = route.params?.mode || sessionMode || PRONUNCIATION_MODES.WORD;
  const categoryId = route.params?.categoryId;
  const sessionSelectedWord = usePronunciationSessionStore(
    (state) => state.selectedWord,
  );
  const word = route.params?.word || sessionSelectedWord;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompact = width < 760 || !isLandscape;
  const soundRef = React.useRef(null);
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const { isExitConfirmVisible, confirmExit, cancelExit } =
    useExitSessionGuard(navigation);

  const orderedSounds = React.useMemo(() => {
    const letters = getSoundLetters(word);
    return (word?.sounds || []).map((sound, index) => ({
      ...sound,
      // Children read letters, not IPA — the chip shows the letter group for
      // this sound and keeps the phoneme only for the audio/scoring layers.
      label: letters[index] || sound.text,
      originalIndex: index,
    }));
  }, [word?.id]);
  const chips = React.useMemo(
    () => shuffleAvoidingIdentity(orderedSounds),
    [orderedSounds],
  );

  const [nextIndex, setNextIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);
  const nudgeAnims = React.useRef({}).current;
  const chipEntranceIndex = React.useRef(new Map()).current;
  // Each coaching line is spoken once per word: repeating it on every replay
  // would talk over a child who is already working.
  const hasPromptedReplayRef = React.useRef(false);
  const hasPraisedRef = React.useRef(false);

  const isComplete = orderedSounds.length > 0 && nextIndex >= orderedSounds.length;
  const audioAsset = WORD_AUDIO_ASSETS[word?.id];

  React.useEffect(() => {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);
    return () => {
      stopVoicePrompt();
      unloadSoundRef(soundRef);
    };
  }, [setCurrentActivityStep]);

  React.useEffect(() => {
    if (!isComplete || hasPraisedRef.current) return;
    hasPraisedRef.current = true;
    playVoicePrompt("goodJob", { reduceStimulation });
  }, [isComplete, reduceStimulation]);

  function getNudgeAnim(originalIndex) {
    if (!nudgeAnims[originalIndex]) {
      nudgeAnims[originalIndex] = new Animated.Value(0);
    }
    return nudgeAnims[originalIndex];
  }

  function playNudge(originalIndex) {
    if (reduceStimulation) return;
    const anim = getNudgeAnim(originalIndex);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }

  async function playWordAudio() {
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
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
          // First time through, point the child back at the button so they
          // know the word can be heard as often as they need.
          if (!hasPromptedReplayRef.current) {
            hasPromptedReplayRef.current = true;
            playVoicePrompt("listenAgain");
          }
        }
      });
      await sound.replayAsync();
      setHasPlayedOnce(true);
    } catch (error) {
      console.log("Tap Sounds word playback error:", error);
      setIsPlaying(false);
    }
  }

  function handleChipPress(chip) {
    if (isComplete) return;

    if (chip.originalIndex === nextIndex) {
      if (!reduceStimulation) Vibration.vibrate(12);
      setNextIndex((value) => value + 1);
      return;
    }

    // Out-of-order tap: no error state shown, just a gentle nudge — the
    // errorless-learning design this activity is built around.
    playNudge(chip.originalIndex);
  }

  function forwardParams() {
    return {
      student,
      mode,
      categoryId,
      wordId: word?.id,
      word,
    };
  }

  function handleSkip() {
    navigation.navigate("PronunciationSpeakWord", forwardParams());
  }

  function handleContinue() {
    navigation.navigate("PronunciationSpeakWord", forwardParams());
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <ButtonFeedback
              activeOpacity={0.82}
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { borderColor: theme.cardOutline }]}
            >
              <Ionicons name="chevron-back" size={20} color={theme.headingText} />
            </ButtonFeedback>

            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.headingText }]}>Tap the Sounds</Text>
              <Text style={[styles.subtitle, { color: theme.headingText }]}>
                Listen to the word, then tap its sounds in order
              </Text>
            </View>

            <ButtonFeedback
              activeOpacity={0.82}
              onPress={handleSkip}
              style={styles.skipBtn}
            >
              <Text style={[styles.skipText, { color: theme.headingText }]}>Skip</Text>
            </ButtonFeedback>
          </View>

          <View
            style={[
              styles.panel,
              isCompact && styles.panelCompact,
              { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
            ]}
          >
            <ButtonFeedback
              activeOpacity={0.88}
              onPress={playWordAudio}
              disabled={!audioAsset || isPlaying}
              soundEnabled={false}
              style={[styles.playBtnWrap, (!audioAsset) && styles.playBtnDisabled]}
            >
              <ThemedGradientFill theme={theme} style={styles.playBtn}>
                <Ionicons name="volume-high-outline" size={20} color="#FFFFFF" />
                <Text style={styles.playBtnText}>
                  {!audioAsset ? "Word audio unavailable" : isPlaying ? "Playing…" : "Play Word"}
                </Text>
              </ThemedGradientFill>
            </ButtonFeedback>

            {/* An ordered task has to show the order it has captured so far.
                Until now only the spent chips changed, so nothing on screen
                said which position the child was filling next. */}
            <View
              style={styles.slotRow}
              accessibilityRole="text"
              accessibilityLabel={
                isComplete
                  ? "All sounds found"
                  : `Sound ${Math.min(nextIndex + 1, orderedSounds.length)} of ${orderedSounds.length}`
              }
            >
              {orderedSounds.map((sound, index) => {
                const isFilled = index < nextIndex;
                const isActive = index === nextIndex;
                return (
                  <View
                    key={`slot-${index}`}
                    style={[
                      styles.slot,
                      isActive && styles.slotActive,
                      isFilled && styles.slotFilled,
                    ]}
                  >
                    <Text style={[styles.slotText, isFilled && styles.slotTextFilled]}>
                      {isFilled ? sound.label : ""}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.chipsRow}>
              {chips.map((chip, index) => {
                const isDone = chip.originalIndex < nextIndex;
                const isUpNext = chip.originalIndex === nextIndex;
                const nudgeAnim = getNudgeAnim(chip.originalIndex);
                const translateX = nudgeAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-6, 0, 6],
                });

                if (!chipEntranceIndex.has(chip.originalIndex)) {
                  chipEntranceIndex.set(chip.originalIndex, chipEntranceIndex.size);
                }

                return (
                  <EntranceItem key={chip.originalIndex} index={chipEntranceIndex.get(chip.originalIndex)}>
                    <Animated.View style={{ transform: [{ translateX }] }}>
                      <ButtonFeedback
                        activeOpacity={0.85}
                        onPress={() => handleChipPress(chip)}
                        disabled={isDone}
                        style={[
                          styles.soundChip,
                          isDone && styles.soundChipDone,
                          isUpNext && !isDone && styles.soundChipUpNext,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Sound ${chip.label}`}
                      >
                        <Text style={[styles.soundChipText, isDone && styles.soundChipTextDone]}>
                          {chip.label}
                        </Text>
                        {isDone ? (
                          <View style={styles.soundChipBadge}>
                            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </ButtonFeedback>
                    </Animated.View>
                  </EntranceItem>
                );
              })}
            </View>

            <View
              style={[
                styles.feedbackBar,
                isComplete ? styles.feedbackBarCorrect : styles.feedbackBarNeutral,
              ]}
            >
              <Ionicons
                name={isComplete ? "checkmark-circle" : hasPlayedOnce ? "hand-left-outline" : "ear-outline"}
                size={20}
                color={isComplete ? Colors.status.success : "#60728B"}
              />
              <Text style={styles.feedbackText}>
                {isComplete
                  ? "All sounds found, in order. Nice listening."
                  : hasPlayedOnce
                    ? "Tap the sounds in the order you heard them."
                    : "Press Play Word, then tap the sounds in order."}
              </Text>
            </View>

            <ButtonFeedback
              activeOpacity={0.9}
              onPress={handleContinue}
              disabled={!isComplete}
              style={[styles.continueBtnWrap, !isComplete && styles.continueBtnDisabled]}
            >
              <ThemedGradientFill theme={theme} style={styles.continueBtn}>
                <Text style={styles.continueText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </ThemedGradientFill>
            </ButtonFeedback>
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
  safe: { flex: 1 },
  safeInner: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  containerCompact: {
    paddingHorizontal: Layout.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Layout.spacing.md,
    marginBottom: Layout.spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Layout.fonts.extrabold,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.sm,
    opacity: 0.75,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
    opacity: 0.85,
    textDecorationLine: "underline",
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 22,
    ...Layout.shadow.sm,
  },
  panelCompact: {
    padding: 16,
    gap: 18,
  },
  playBtnWrap: {
    alignSelf: "center",
    borderRadius: 18,
    overflow: "hidden",
    ...Layout.shadow.md,
  },
  playBtnDisabled: {
    opacity: 0.5,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  playBtnText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  slot: {
    // Sized so a 6-part word ("jellyfish") still assembles on one line at
    // phone width rather than wrapping into a 5+1 that reads as two words.
    minWidth: 44,
    minHeight: 52,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#DCE4EF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F4F7FE",
  },
  slotFilled: {
    borderColor: Colors.status.success,
    backgroundColor: Colors.status.successLight,
  },
  slotText: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Layout.fonts.extrabold,
    color: "#3A4A61",
  },
  slotTextFilled: {
    // Colors.status.success on successLight is ~2:1 — legible as a border,
    // not as text. The darker green keeps the same hue above 4.5:1.
    color: "#166534",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  soundChip: {
    minWidth: 88,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E1E7EF",
    alignItems: "center",
    justifyContent: "center",
    ...Layout.shadow.sm,
  },
  soundChipUpNext: {
    borderColor: Colors.primary,
  },
  soundChipDone: {
    backgroundColor: Colors.status.successLight,
    borderColor: Colors.status.success,
  },
  soundChipText: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: Layout.fonts.extrabold,
    color: "#3A4A61",
  },
  soundChipTextDone: {
    color: "#166534",
  },
  soundChipBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.status.success,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedbackBarNeutral: {
    backgroundColor: "#F0F4F8",
  },
  feedbackBarCorrect: {
    backgroundColor: Colors.status.successLight,
  },
  feedbackText: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: "#3A4A61",
    fontFamily: Layout.fonts.semibold,
  },
  continueBtnWrap: {
    alignSelf: "center",
    borderRadius: 18,
    overflow: "hidden",
    minWidth: 200,
    ...Layout.shadow.md,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
  },
});
