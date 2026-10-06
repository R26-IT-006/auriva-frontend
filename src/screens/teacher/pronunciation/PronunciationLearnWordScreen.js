import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  ScrollView,
  Animated,
  Easing,
  Modal,
  Pressable,
} from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import { getSoundLetters, getWordImageSource, WORD_BANK } from "./wordBank.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
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
import { AvatarIdentityBadge } from "./pronunciationDesignKit.js";
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import {
  PronunciationAlert,
  usePronunciationAlert,
} from "./PronunciationAlert.js";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import { rs, rf } from '../../../utils/responsive';

const CAT_FLASHCARD_VIDEO = require("../../../../assets/pronunciation-videos/whiskers_cat.mp4");
const CAT_MEOW_AUDIO = require("../../../../assets/pronunciation-audios/cat_meow.wav");

export default function PronunciationLearnWordScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const sessionMode = usePronunciationSessionStore((state) => state.selectedMode);
  const mode = route.params?.mode || sessionMode || PRONUNCIATION_MODES.WORD;
  const isAlphabetMode = mode === PRONUNCIATION_MODES.ALPHABET;
  const categoryId = route.params?.categoryId;
  const selectedWordId = route.params?.wordId;
  const { width, height } = useWindowDimensions();
  const pronunciationSoundRef = React.useRef(null);
  const catMeowSoundRef = React.useRef(null);
  const catVideoRef = React.useRef(null);
  const flashcardOverlayOpacity = React.useRef(new Animated.Value(0)).current;
  const flashcardScale = React.useRef(new Animated.Value(0.88)).current;
  const flashcardTranslateY = React.useRef(new Animated.Value(32)).current;
  const sessionSelectedWord = usePronunciationSessionStore(
    (state) => state.selectedWord,
  );
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const setHeardReferenceAudio = usePronunciationSessionStore(
    (state) => state.setHeardReferenceAudio,
  );
  const { isExitConfirmVisible, confirmExit, cancelExit } =
    useExitSessionGuard(navigation);
  const { showAlert, alertProps } = usePronunciationAlert();

  const words = WORD_BANK[categoryId] || [];
  const selectedWord =
    words.find((word) => word.id === selectedWordId) ||
    route.params?.word ||
    sessionSelectedWord;
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isCatFlashcardVisible, setIsCatFlashcardVisible] = React.useState(false);
  const [catVideoKey, setCatVideoKey] = React.useState(0);

  const isLandscape = width > height;
  const isWideTablet = width >= 900 && isLandscape;
  const isCompact = width < 760 || !isLandscape;
  const cardWidth = isCompact
    ? width - Layout.spacing.lg * 2
    : Math.min(Math.max(width * 0.7, 760), 1060);
  // Landscape tablet: the card gets a fixed height that leaves room for the
  // header, the headline and the Next button below it (~330), so it can never
  // run off the bottom of the screen. The picture / letter panel is a square
  // of the card's inner height (card padding 20 on each side).
  const cardHeight = Math.max(260, Math.min(height - 330, 440));
  const paneSize = cardHeight - 40;
  const flashcardWidth = isLandscape
    ? Math.min(width - 92, 820)
    : Math.min(width - 44, 680);
  const flashcardStageMaxHeight = isLandscape
    ? Math.max(240, height - 210)
    : Math.max(280, height * 0.48);
  const sounds = selectedWord?.sounds || [];
  // Words run 2-6 parts ("jellyfish" is the ceiling). Past four, the full-size
  // tile wraps into a lopsided 5+1 on a tablet, so the tile steps down instead.
  const isDenseWord = sounds.length >= 5;
  // Letter groups, not IPA symbols — /əl/ means nothing to a child, "le" is
  // the part of the written word they can find.
  const soundLetters = getSoundLetters(selectedWord);
  const canShowCatFlashcard = selectedWord?.id === "cat";
  const imageStyle = usePronunciationSessionStore((state) => state.imageStyle);
  const selectedWordImageSource = getWordImageSource(selectedWord, imageStyle);
  const sinhalaTranslation =
    !isAlphabetMode && selectedWord?.sinhalaTranslation
      ? selectedWord.sinhalaTranslation
      : null;

  const floatingCardStyle = {
    opacity: flashcardOverlayOpacity,
    transform: [
      { translateY: flashcardTranslateY },
      { scale: flashcardScale },
    ],
  };

  async function releaseLearningAudio() {
    await unloadSoundRef(pronunciationSoundRef);
    await unloadSoundRef(catMeowSoundRef);
    if (catVideoRef.current) {
      await catVideoRef.current.pauseAsync().catch(() => {});
    }
    setIsPlaying(false);
    setIsCatFlashcardVisible(false);
  }

  async function handleNext() {
    await releaseLearningAudio();

    const nextParams = {
      student,
      mode,
      categoryId,
      wordId: selectedWord?.id,
      word: selectedWord,
    };

    // Tap the Sounds is a segmentation warm-up: hear the word, then tap its
    // sounds in the order they occur. Needs 2+ sounds to be a real ordering
    // task and full-word audio to listen to first, so it only applies to
    // word mode (alphabet mode practises whole spoken letter names) with a
    // reference clip.
    if (
      !isAlphabetMode &&
      (selectedWord?.sounds?.length || 0) >= 2 &&
      WORD_AUDIO_ASSETS[selectedWord?.id]
    ) {
      navigation.navigate("PronunciationTapSounds", nextParams);
      return;
    }

    setCurrentActivityStep(PRONUNCIATION_STEPS.SPEAK);
    navigation.navigate("PronunciationSpeakWord", nextParams);
  }

  React.useEffect(() => {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);
    // Every visit to the Listen step (including a "Try Again" retry) starts
    // a fresh attempt: whether the child replays the reference audio this
    // time is what determines imitation vs. independent speech, not whether
    // they did on a previous attempt.
    setHeardReferenceAudio(false);

    return () => {
      stopVoicePrompt();
      if (pronunciationSoundRef.current) {
        pronunciationSoundRef.current.unloadAsync().catch(() => {});
        pronunciationSoundRef.current = null;
      }
      if (catMeowSoundRef.current) {
        catMeowSoundRef.current.unloadAsync().catch(() => {});
        catMeowSoundRef.current = null;
      }
    };
  }, [setCurrentActivityStep, setHeardReferenceAudio]);

  React.useEffect(() => {
    if (!isCatFlashcardVisible) return undefined;

    flashcardOverlayOpacity.setValue(0);
    flashcardScale.setValue(0.88);
    flashcardTranslateY.setValue(32);

    Animated.parallel([
      Animated.timing(flashcardOverlayOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(flashcardScale, {
        toValue: 1,
        speed: 16,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.spring(flashcardTranslateY, {
        toValue: 0,
        speed: 15,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flashcardOverlayOpacity, flashcardScale, flashcardTranslateY, isCatFlashcardVisible]);

  function handleOpenCatFlashcard() {
    if (!canShowCatFlashcard) return;
    setPronunciationPlaybackMode().catch(() => {});
    setCatVideoKey((key) => key + 1);
    setIsCatFlashcardVisible(true);
    playCatMeow();
  }

  async function handleReplayCatVideo() {
    try {
      await setPronunciationPlaybackMode();

      if (catVideoRef.current) {
        await catVideoRef.current.setPositionAsync(0);
        await catVideoRef.current.playAsync();
      } else {
        setCatVideoKey((key) => key + 1);
      }

      await playCatMeow();
    } catch (error) {
      console.log("Cat video playback error:", error);
    }
  }

  function handleCloseCatFlashcard() {
    Animated.parallel([
      Animated.timing(flashcardOverlayOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flashcardScale, {
        toValue: 0.94,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsCatFlashcardVisible(false);
    });
  }

  async function playCatMeow() {
    try {
      await setPronunciationPlaybackMode();
      await unloadSoundRef(catMeowSoundRef);

      const { sound } = await Audio.Sound.createAsync(CAT_MEOW_AUDIO, {
        shouldPlay: true,
        volume: 1,
      });

      catMeowSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (catMeowSoundRef.current === sound) {
            catMeowSoundRef.current = null;
          }
        }
      });
    } catch (error) {
      console.log("Cat meow playback error:", error);
    }
  }

  async function handleHearSounds() {
    const audioAsset = WORD_AUDIO_ASSETS[selectedWord?.id];

    if (!audioAsset) {
      showAlert(
        "Audio unavailable",
        `No pronunciation audio has been added for ${selectedWord?.word || "this word"} yet.`,
        { tone: "warning" },
      );
      return;
    }

    try {
      setIsPlaying(true);
      await setPronunciationPlaybackMode();
      await unloadSoundRef(pronunciationSoundRef);

      const playableSource = await getPlayableAudioSource(audioAsset);
      const { sound } = await Audio.Sound.createAsync(playableSource, {
        shouldPlay: false,
        volume: 1,
      });

      pronunciationSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync().catch(() => {});
          if (pronunciationSoundRef.current === sound) {
            pronunciationSoundRef.current = null;
          }
          // The model word has just played — invite the child to copy it.
          playVoicePrompt("repeatAfterMe");
        }
      });
      await sound.replayAsync();
      setHeardReferenceAudio(true);
    } catch (error) {
      console.log("Pronunciation audio playback error:", error);
      setIsPlaying(false);
      showAlert(
        "Playback error",
        "Unable to play this pronunciation audio right now.",
        { tone: "error" },
      );
    }
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      {/* Back — Concept's round translucent header button. goBack still goes
          through useExitSessionGuard's "Leave this activity?" check. */}
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
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact,
          isWideTablet && styles.containerLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.centerStage, isCompact && styles.centerStageCompact]}>
          <Text style={[styles.headline, isCompact && styles.headlineCompact, { color: theme.headingText }]}>
            {isAlphabetMode ? "Listen to the letter name" : "Listen to the sounds"}
          </Text>
          <Text style={[styles.headlineSinhala, isCompact && styles.headlineSinhalaCompact, { color: theme.headingText }]}>
            {isAlphabetMode ? "අකුරේ නමට සවන් දෙන්න" : "ශබ්ද වලට සවන් දෙන්න"}
          </Text>

          <View
            style={[
              styles.wordCard,
              !isWideTablet && styles.wordCardCompact,
              { width: cardWidth, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
              isWideTablet && { height: cardHeight, minHeight: 0 },
            ]}
          >
            <View style={styles.soundStage}>
              {/* The parts spell the word left to right, the direction the
                  child will read it in. Stacked vertically they taught the
                  opposite mapping and pushed the word image off-screen. */}
              <View
                style={styles.soundRow}
                accessibilityRole="text"
                accessibilityLabel={`Sound parts: ${sounds
                  .map((sound, index) => soundLetters[index] || sound.text)
                  .join(", ")}`}
              >
                {sounds.map((sound, index) => {
                  const isVowel = sound.type === "vowel";
                  return (
                    <View
                      key={`${sound.text}-${index}`}
                      style={[
                        styles.soundBlock,
                        isDenseWord && styles.soundBlockDense,
                        isAlphabetMode && styles.soundBlockLetter,
                        isVowel && styles.soundBlockVowel,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[
                          styles.soundText,
                          isDenseWord && styles.soundTextDense,
                          isAlphabetMode && styles.soundTextLetter,
                          { color: theme.headingText },
                        ]}
                      >
                        {soundLetters[index] || sound.text}
                      </Text>
                      <Text style={[styles.soundType, isAlphabetMode && styles.soundTypeLetter, isVowel && styles.soundTypeVowel]}>
                        {sound.type}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Concept's raised 3D button, in the avatar's button colour. */}
              <ButtonFeedback
                activeOpacity={0.88}
                onPress={handleHearSounds}
                soundEnabled={false}
                accessibilityRole="button"
                accessibilityLabel="Hear sounds"
                style={[
                  styles.hearBtn,
                  { backgroundColor: theme.button },
                  isPlaying && styles.hearBtnActive,
                ]}
              >
                <Ionicons name="volume-high" size={20} color={theme.buttonText} />
                <Text style={[styles.hearBtnText, { color: theme.buttonText }]}>Hear Sounds</Text>
              </ButtonFeedback>

              {sinhalaTranslation ? (
                <View style={styles.translationBox}>
                  <Text style={styles.translationLabel}>Sinhala meaning</Text>
                  <Text style={[styles.translationText, { color: theme.headingText }]}>{sinhalaTranslation}</Text>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.imagePane,
                !isWideTablet && styles.imagePaneCompact,
                // Square panel on a landscape tablet (see cardHeight).
                isWideTablet && { width: paneSize, height: paneSize, minHeight: 0 },
              ]}
            >
              {isAlphabetMode ? (
                <View style={[styles.wordImage, styles.letterPane, { backgroundColor: selectedWord?.color || theme.cardSurface }]}>
                  <Text style={[styles.letterPaneText, { color: theme.headingText }]}>
                    {selectedWord?.letter || selectedWord?.word || "A"}
                  </Text>
                </View>
              ) : selectedWordImageSource ? (
                <ButtonFeedback
                  activeOpacity={0.9}
                  disabled={!canShowCatFlashcard}
                  onPress={handleOpenCatFlashcard}
                  style={styles.wordImageButton}
                >
                  <Image
                    source={selectedWordImageSource}
                    resizeMode="cover"
                    style={styles.wordImage}
                  />
                  {canShowCatFlashcard && (
                    <View style={styles.tapHint}>
                      <Ionicons name="play" size={22} color="#FFFFFF" />
                    </View>
                  )}
                </ButtonFeedback>
              ) : (
                <View style={[styles.wordImage, styles.placeholderPane]}>
                  <Ionicons name="image-outline" size={42} color="#76839A" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Next — Concept's 3D "Ready!" button, centred under the card. */}
        <View style={styles.actionsRow}>
          <ButtonFeedback
            activeOpacity={0.9}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={[styles.nextBtn, { backgroundColor: theme.button }]}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
          </ButtonFeedback>
        </View>
      </ScrollView>

      <Modal
        visible={isCatFlashcardVisible}
        transparent
        animationType="none"
        supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
        onRequestClose={handleCloseCatFlashcard}
      >
        <View style={styles.flashcardModal}>
          <Animated.View style={[styles.flashcardBackdrop, { opacity: flashcardOverlayOpacity }]} />
          <Animated.View
            style={[
              styles.flashcardWrap,
              isCompact && styles.flashcardWrapCompact,
              isLandscape && styles.flashcardWrapLandscape,
              { width: flashcardWidth },
              floatingCardStyle,
            ]}
          >
            <View style={styles.flashcardHeader}>
              <View>
                <Text style={styles.flashcardTitle}>cat</Text>
                {sinhalaTranslation ? (
                  <Text style={styles.flashcardTranslation}>{sinhalaTranslation}</Text>
                ) : null}
              </View>
              <ButtonFeedback
                activeOpacity={0.82}
                onPress={handleCloseCatFlashcard}
                style={styles.flashcardClose}
              >
                <Ionicons name="close" size={24} color="#35445D" />
              </ButtonFeedback>
            </View>

            <View
              style={[
                styles.flashcardVideoStage,
                isLandscape && styles.flashcardVideoStageLandscape,
                { maxHeight: flashcardStageMaxHeight },
              ]}
            >
              <Pressable onPress={handleReplayCatVideo} style={styles.flashcardVideoPressable}>
                <Video
                  key={catVideoKey}
                  ref={catVideoRef}
                  source={CAT_FLASHCARD_VIDEO}
                  style={styles.flashcardVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={isCatFlashcardVisible}
                  isLooping
                  isMuted={false}
                  volume={1}
                  useNativeControls={false}
                />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

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

      <PronunciationAlert {...alertProps} theme={theme} />
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
  // Header row holding the back button (ConceptCategoriesScreen topBar/iconBtn).
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
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
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  containerCompact: {
    justifyContent: "flex-start",
  },
  // The side buttons used to float here, so landscape kept 88px clear for
  // them; with Back in the header and Next under the card, normal padding.
  containerLandscape: {
    paddingHorizontal: Layout.spacing.xl,
  },
  centerStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  centerStageCompact: {
    marginTop: 0,
  },
  // Same size as the module titles (Concept / Dialogue / Pronunciation
  // Learning, 34) rather than the old 46.
  headline: {
    fontSize: rf(34),
    lineHeight: rf(40),
    fontFamily: Layout.fonts.extrabold,
    color: "#1F4C66",
    letterSpacing: -0.3,
    marginBottom: rs(4),
    textAlign: "center",
  },
  headlineCompact: {
    fontSize: rf(26),
    lineHeight: rf(32),
    marginBottom: rs(4),
  },
  headlineSinhala: {
    fontSize: rf(20),
    lineHeight: rf(28),
    fontFamily: Layout.fonts.extrabold,
    letterSpacing: 0,
    marginBottom: rs(20),
    textAlign: "center",
    opacity: 0.82,
  },
  headlineSinhalaCompact: {
    fontSize: rf(18),
    lineHeight: rf(26),
    marginBottom: Layout.spacing.lg,
  },
  // Card styling as the Concept/Dialogue cards: thick theme outline (colour
  // set inline), round corners, soft shadow. On a landscape tablet the height
  // is fixed inline (cardHeight); the panes centre inside it.
  wordCard: {
    backgroundColor: Colors.surface,
    borderRadius: rs(28),
    borderWidth: 3,
    borderColor: "#D7E1EC",
    padding: rs(20),
    // Reversed: the letter / picture panel sits on the left and the sound
    // parts + Hear Sounds on the right. (Narrow screens stack them instead —
    // see wordCardCompact.)
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: rs(18),
    minHeight: rs(360),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  wordCardCompact: {
    flexDirection: "column",
    minHeight: 0,
  },
  soundStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: rs(18),
    paddingHorizontal: rs(10),
    gap: rs(16),
  },
  soundRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "center",
    maxWidth: "100%",
    gap: rs(10),
  },
  soundBlock: {
    minWidth: rs(76),
    flexShrink: 1,
    paddingHorizontal: rs(14),
    paddingVertical: rs(12),
    minHeight: rs(92),
    borderRadius: rs(14),
    // Flat, not raised: these parts are read, not tapped. The shadowed white
    // card read as a button next to the identically-shaped chips on Tap Sounds.
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E1E7EF",
    alignItems: "center",
    justifyContent: "center",
  },
  soundBlockDense: {
    minWidth: rs(62),
    paddingHorizontal: rs(8),
    minHeight: rs(82),
  },
  // Alphabet mode has a single sound part — show it big, so it fills its
  // half of the card instead of sitting small in empty space.
  soundBlockLetter: {
    minWidth: rs(150),
    minHeight: rs(160),
    paddingHorizontal: rs(24),
    paddingVertical: rs(18),
    borderRadius: rs(22),
    borderWidth: 2,
  },
  soundBlockVowel: {
    backgroundColor: "#FFF6EA",
    borderColor: "#F1DAC0",
  },
  soundText: {
    fontSize: rf(34),
    fontFamily: Layout.fonts.extrabold,
    color: "#3A4A61",
    lineHeight: rf(40),
  },
  soundTextLetter: {
    fontSize: rf(72),
    lineHeight: rf(82),
  },
  soundTextDense: {
    fontSize: rf(26),
    lineHeight: rf(32),
  },
  soundType: {
    marginTop: rs(6),
    fontSize: rf(11),
    fontFamily: Layout.fonts.bold,
    color: "#5C6A7E",
    textTransform: "lowercase",
  },
  soundTypeLetter: {
    marginTop: rs(8),
    fontSize: rf(15),
  },
  soundTypeVowel: {
    color: "#96610F",
  },
  // Concept's raised 3D button (ConceptImageScreen fwdBtn), a little smaller
  // than Next so the primary action stays the one under the card.
  hearBtn: {
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
  // While the clip plays: dimmed slightly so the tap visibly registered.
  hearBtnActive: {
    opacity: 0.8,
  },
  hearBtnText: {
    fontSize: rf(16),
    fontFamily: "DMSans_800ExtraBold",
  },
  translationBox: {
    minWidth: rs(160),
    maxWidth: rs(260),
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderRadius: rs(14),
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D9E5F2",
    alignItems: "center",
  },
  translationLabel: {
    fontSize: rf(11),
    fontFamily: Layout.fonts.extrabold,
    color: "#6C7A8E",
    textTransform: "uppercase",
  },
  translationText: {
    marginTop: rs(4),
    fontSize: rf(28),
    lineHeight: rf(34),
    fontFamily: Layout.fonts.extrabold,
    color: "#263752",
    textAlign: "center",
  },
  imagePane: {
    width: "42%",
    minHeight: rs(320),
  },
  imagePaneCompact: {
    width: "100%",
    height: rs(260),
    minHeight: rs(260),
  },
  wordImageButton: {
    width: "100%",
    height: "100%",
    borderRadius: rs(18),
    overflow: "hidden",
  },
  wordImage: {
    width: "100%",
    height: "100%",
    borderRadius: rs(18),
  },
  tapHint: {
    position: "absolute",
    right: rs(12),
    bottom: rs(12),
    alignItems: "center",
    justifyContent: "center",
    width: rs(58),
    height: rs(46),
    borderRadius: rs(23),
    backgroundColor: "rgba(31,44,70,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  placeholderPane: {
    backgroundColor: "#E8EDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  letterPane: {
    alignItems: "center",
    justifyContent: "center",
  },
  letterPaneText: {
    fontSize: rf(116),
    lineHeight: rf(124),
    color: "#263752",
    fontFamily: Layout.fonts.extrabold,
  },
  wordPane: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(12),
  },
  wordText: {
    fontSize: rf(98),
    lineHeight: rf(102),
    color: "#1F2C46",
    fontFamily: Layout.fonts.extrabold,
    textTransform: "lowercase",
  },
  studentName: {
    marginTop: rs(10),
    fontSize: Layout.fontSize.md,
    color: Colors.text.secondary,
  },
  actionsRow: {
    width: "100%",
    marginTop: Layout.spacing.xl,
    alignItems: "center",
  },
  // Next — ConceptImageScreen's fwdBtn ("Ready!").
  nextBtn: {
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
  nextText: {
    fontSize: rf(17),
    fontFamily: "DMSans_800ExtraBold",
  },
  flashcardModal: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(28),
  },
  flashcardBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21, 30, 46, 0.62)",
  },
  flashcardWrap: {
    width: "82%",
    maxWidth: rs(780),
    borderRadius: rs(28),
    backgroundColor: "#FFFDF8",
    padding: rs(18),
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#6478C8",
    shadowOffset: { width: 0, height: rs(18) },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  flashcardWrapCompact: {
    width: "100%",
    padding: rs(14),
  },
  flashcardWrapLandscape: {
    padding: rs(14),
  },
  flashcardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rs(12),
  },
  flashcardTitle: {
    color: "#263752",
    fontSize: rf(42),
    lineHeight: rf(46),
    fontFamily: Layout.fonts.black,
  },
  flashcardTranslation: {
    marginTop: 2,
    color: "#526276",
    fontSize: rf(24),
    lineHeight: rf(30),
    fontFamily: Layout.fonts.extrabold,
  },
  flashcardClose: {
    width: rs(48),
    height: rs(48),
    borderRadius: rs(24),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4F8",
    borderWidth: 1,
    borderColor: "#DDE6EF",
  },
  flashcardVideoStage: {
    width: "100%",
    aspectRatio: 690 / 490,
    overflow: "hidden",
    borderRadius: rs(20),
    backgroundColor: "#FFF8EE",
    borderWidth: 1,
    borderColor: "#F3DEC9",
  },
  flashcardVideoStageLandscape: {
    aspectRatio: 690 / 405,
  },
  flashcardVideoPressable: {
    width: "100%",
    height: "100%",
  },
  flashcardVideo: {
    width: "100%",
    height: "100%",
  },
});
