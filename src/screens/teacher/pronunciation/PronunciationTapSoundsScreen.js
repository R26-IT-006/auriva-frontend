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
import { EntranceItem } from "./pronunciationDesignKit.js";
import { getSoundLetters } from "./wordBank.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import HeaderPillButton from '../../../components/common/HeaderPillButton';
import { rs, rf } from '../../../utils/responsive';

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
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
        {/* Header — round Back (top-left) and a Skip pill (top-right), as the
            other pronunciation steps. goBack still goes through
            useExitSessionGuard's "Leave this activity?" check. */}
        <View style={styles.topBar}>
          <ButtonFeedback
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.7)" }, BACK_BUTTON]}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </ButtonFeedback>

          {/* Shared header pill (HeaderPillButton), subtle variant — keeps this
            module's click sound via ButtonFeedback. */}
          <HeaderPillButton
            as={ButtonFeedback}
            variant="subtle"
            icon="play-skip-forward"
            label="Skip"
            accessibilityLabel="Skip this activity"
            theme={theme}
            onPress={handleSkip}
          />
        </View>

        <ScrollView
          contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: theme.headingText }]}>Tap the Sounds</Text>
          <Text style={[styles.subtitle, { color: theme.headingText }]}>
            Listen to the word, then tap its sounds in order
          </Text>

          <View
            style={[
              styles.panel,
              isCompact && styles.panelCompact,
              { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
            ]}
          >
            {/* Concept's raised 3D button, as Hear Sounds on the Listen step. */}
            <ButtonFeedback
              activeOpacity={0.88}
              onPress={playWordAudio}
              disabled={!audioAsset || isPlaying}
              soundEnabled={false}
              accessibilityRole="button"
              style={[
                styles.playBtn,
                { backgroundColor: theme.button },
                (!audioAsset || isPlaying) && styles.playBtnDisabled,
              ]}
            >
              <Ionicons name="volume-high" size={20} color={theme.buttonText} />
              <Text style={[styles.playBtnText, { color: theme.buttonText }]}>
                {!audioAsset ? "Word audio unavailable" : isPlaying ? "Playing…" : "Play Word"}
              </Text>
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
                      // The slot being filled next is outlined in the avatar
                      // colour, so it reads as part of this child's theme.
                      isActive && [styles.slotActive, { borderColor: theme.button }],
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
                          isUpNext && !isDone && [styles.soundChipUpNext, { borderColor: theme.button }],
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

          </View>

          {/* Continue — Concept's 3D "Ready!" button, centred under the panel;
              dimmed and disabled until every sound has been found. */}
          <ButtonFeedback
            activeOpacity={0.9}
            onPress={handleContinue}
            disabled={!isComplete}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isComplete }}
            style={[
              styles.continueBtn,
              { backgroundColor: theme.button },
              !isComplete && styles.continueBtnDisabled,
            ]}
          >
            <Text style={[styles.continueText, { color: theme.buttonText }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
          </ButtonFeedback>
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

  // ── Header: round Back (left) + Skip pill (right) ─────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  // ConceptCategoriesScreen iconBtn.
  iconBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // Same translucent wash as the icon button, as a small pill.

  container: {
    flexGrow: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xl,
    maxWidth: rs(820),
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
  },
  containerCompact: {
    paddingHorizontal: Layout.spacing.md,
  },
  // Same heading sizes as the Listen / Speak steps.
  title: {
    fontSize: rf(34),
    lineHeight: rf(40),
    fontFamily: Layout.fonts.extrabold,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    // Wider gap so the panel sits a little lower under the heading.
    marginBottom: rs(56),
    fontSize: rf(15),
    fontFamily: Layout.fonts.semibold,
    opacity: 0.6,
    textAlign: "center",
  },

  // Concept/Dialogue card style: thick theme outline (colour set inline),
  // round corners, soft shadow.
  panel: {
    width: "100%",
    borderRadius: rs(28),
    borderWidth: 3,
    padding: rs(24),
    gap: rs(22),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  panelCompact: {
    padding: rs(16),
    gap: rs(18),
  },

  // Concept's raised 3D button (ConceptImageScreen fwdBtn), Hear Sounds size.
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    paddingHorizontal: rs(24),
    paddingVertical: rs(12),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0,0,0,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  // No audio for this word, or the clip is already playing.
  playBtnDisabled: {
    opacity: 0.55,
  },
  playBtnText: {
    fontSize: rf(16),
    fontFamily: "DMSans_800ExtraBold",
  },

  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: rs(8),
  },
  slot: {
    // Sized so a 6-part word ("jellyfish") still assembles on one line at
    // phone width rather than wrapping into a 5+1 that reads as two words.
    minWidth: rs(48),
    minHeight: rs(56),
    paddingHorizontal: rs(6),
    paddingVertical: rs(8),
    borderRadius: rs(14),
    borderWidth: 2,
    borderColor: "#DCE4EF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Border colour set inline from the avatar theme.
  slotActive: {
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
  },
  slotFilled: {
    borderColor: Colors.status.success,
    backgroundColor: Colors.status.successLight,
  },
  slotText: {
    fontSize: rf(22),
    lineHeight: rf(28),
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
    gap: rs(14),
  },
  // Raised tile (darker bottom edge, as the 3D buttons) — these are tapped.
  soundChip: {
    minWidth: rs(96),
    minHeight: rs(96),
    paddingHorizontal: rs(18),
    paddingVertical: rs(12),
    borderRadius: rs(20),
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: "#E1E7EF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  // Border colour set inline from the avatar theme.
  soundChipUpNext: {
    borderWidth: 3,
    borderBottomWidth: 5,
  },
  soundChipDone: {
    backgroundColor: Colors.status.successLight,
    borderColor: Colors.status.success,
  },
  soundChipText: {
    fontSize: rf(36),
    lineHeight: rf(44),
    fontFamily: Layout.fonts.extrabold,
    color: "#3A4A61",
  },
  soundChipTextDone: {
    color: "#166534",
  },
  soundChipBadge: {
    position: "absolute",
    top: rs(6),
    right: rs(6),
    width: rs(20),
    height: rs(20),
    borderRadius: rs(10),
    backgroundColor: Colors.status.success,
    alignItems: "center",
    justifyContent: "center",
  },

  feedbackBar: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: rs(10),
    borderRadius: rs(16),
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
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

  // Continue — ConceptImageScreen's fwdBtn ("Ready!"), under the panel.
  continueBtn: {
    marginTop: Layout.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0,0,0,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueText: {
    fontSize: rf(17),
    fontFamily: "DMSans_800ExtraBold",
  },
});
