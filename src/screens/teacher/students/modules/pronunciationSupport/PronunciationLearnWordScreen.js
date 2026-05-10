import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Image,
  Alert,
  ScrollView,
  Animated,
  Easing,
  Modal,
  Pressable,
} from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { getWordImageSource, WORD_BANK } from "./wordBank.js";
import { WORD_AUDIO_ASSETS } from "./pronunciationAudioAssets.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";

const CAT_FLASHCARD_VIDEO = require("../../../../../../assets/pronunciation-videos/whiskers_cat.mp4");
const CAT_MEOW_AUDIO = require("../../../../../../assets/pronunciation-audios/cat_meow.wav");

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
  const flashcardWidth = isLandscape
    ? Math.min(width - 92, 820)
    : Math.min(width - 44, 680);
  const flashcardStageMaxHeight = isLandscape
    ? Math.max(240, height - 210)
    : Math.max(280, height * 0.48);
  const sounds = selectedWord?.sounds || [];
  const canShowCatFlashcard = selectedWord?.id === "cat";
  const selectedWordImageSource = getWordImageSource(selectedWord);
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

  function handleNext() {
    setCurrentActivityStep(PRONUNCIATION_STEPS.SPEAK);
    navigation.navigate("PronunciationSpeakWord", {
      student,
      mode,
      categoryId,
      wordId: selectedWord?.id,
      word: selectedWord,
    });
  }

  React.useEffect(() => {
    setCurrentActivityStep(PRONUNCIATION_STEPS.LISTEN);

    return () => {
      if (pronunciationSoundRef.current) {
        pronunciationSoundRef.current.unloadAsync().catch(() => {});
        pronunciationSoundRef.current = null;
      }
      if (catMeowSoundRef.current) {
        catMeowSoundRef.current.unloadAsync().catch(() => {});
        catMeowSoundRef.current = null;
      }
    };
  }, [setCurrentActivityStep]);

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
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    setCatVideoKey((key) => key + 1);
    setIsCatFlashcardVisible(true);
    playCatMeow();
  }

  async function handleReplayCatVideo() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (catMeowSoundRef.current) {
        await catMeowSoundRef.current.unloadAsync().catch(() => {});
        catMeowSoundRef.current = null;
      }

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
      Alert.alert(
        "Audio unavailable",
        `No pronunciation audio has been added for ${selectedWord?.word || "this word"} yet.`,
      );
      return;
    }

    try {
      setIsPlaying(true);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (pronunciationSoundRef.current) {
        await pronunciationSoundRef.current.unloadAsync().catch(() => {});
        pronunciationSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(audioAsset, {
        shouldPlay: true,
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
        }
      });
    } catch (error) {
      console.log("Pronunciation audio playback error:", error);
      setIsPlaying(false);
      Alert.alert("Playback error", "Unable to play this pronunciation audio right now.");
    }
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
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
            {isAlphabetMode ? "Listen to the letter sound" : "Listen to the sounds"}
          </Text>
          <Text style={[styles.headlineSinhala, isCompact && styles.headlineSinhalaCompact, { color: theme.headingText }]}>
            {isAlphabetMode ? "අකුරු ශබ්දයට සවන් දෙන්න" : "ශබ්ද වලට සවන් දෙන්න"}
          </Text>

          <View
            style={[
              styles.wordCard,
              !isWideTablet && styles.wordCardCompact,
              { width: cardWidth, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
            ]}
          >
            <View style={styles.soundStage}>
              {sounds.map((sound, index) => (
                <View key={`${sound.text}-${index}`} style={styles.soundBlock}>
                  <Text style={styles.soundText}>{sound.text}</Text>
                  <Text style={styles.soundType}>{sound.type}</Text>
                </View>
              ))}

              <ButtonFeedback
                activeOpacity={0.88}
                onPress={handleHearSounds}
                style={[styles.hearBtn, { backgroundColor: theme.button }, isPlaying && styles.hearBtnActive]}
              >
                <Ionicons
                  name="volume-high-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.hearBtnText}>Hear Sounds</Text>
              </ButtonFeedback>

              {sinhalaTranslation ? (
                <View style={styles.translationBox}>
                  <Text style={styles.translationLabel}>Sinhala meaning</Text>
                  <Text style={styles.translationText}>{sinhalaTranslation}</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.imagePane, !isWideTablet && styles.imagePaneCompact]}>
              {isAlphabetMode ? (
                <View style={[styles.wordImage, styles.letterPane, { backgroundColor: selectedWord?.color || theme.cardSurface }]}>
                  <Text style={styles.letterPaneText}>
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

        <View
          pointerEvents={isCompact ? "auto" : "box-none"}
          style={isCompact ? styles.actionsRow : styles.actionsOverlay}
        >
          <ButtonFeedback
            activeOpacity={0.82}
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, isCompact && styles.backBtnCompact, { borderColor: theme.cardOutline }]}
          >
            <Ionicons name="arrow-back" size={26} color={theme.headingText} />
          </ButtonFeedback>

          <ButtonFeedback
            activeOpacity={0.9}
            onPress={handleNext}
            style={[styles.nextBtn, isCompact && styles.nextBtnCompact, { backgroundColor: theme.button }]}
          >
            <Text style={styles.nextText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
                <Text style={styles.flashcardEyebrow}>Flashcard</Text>
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
    minHeight: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
  },
  containerCompact: {
    justifyContent: "flex-start",
  },
  containerLandscape: {
    paddingHorizontal: 88,
  },
  centerStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -40,
  },
  centerStageCompact: {
    marginTop: 0,
  },
  headline: {
    fontSize: 46,
    fontWeight: "800",
    color: "#1F4C66",
    letterSpacing: 0,
    marginBottom: 6,
    textAlign: "center",
  },
  headlineCompact: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 4,
  },
  headlineSinhala: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 26,
    textAlign: "center",
    opacity: 0.82,
  },
  headlineSinhalaCompact: {
    fontSize: 22,
    lineHeight: 30,
    marginBottom: Layout.spacing.lg,
  },
  wordCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7E1EC",
    padding: 18,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 18,
    minHeight: 360,
  },
  wordCardCompact: {
    flexDirection: "column",
    minHeight: 0,
  },
  soundStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 10,
    gap: 16,
  },
  soundBlock: {
    width: 72,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7EF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  soundText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#3A4A61",
    lineHeight: 38,
  },
  soundType: {
    marginTop: 4,
    fontSize: 10,
    color: "#A2A9B4",
    textTransform: "lowercase",
  },
  hearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#5E98C0",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    ...Layout.shadow.md,
  },
  hearBtnActive: {
    backgroundColor: "#4E88B4",
    transform: [{ scale: 0.98 }],
  },
  hearBtnText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  translationBox: {
    minWidth: 160,
    maxWidth: 260,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D9E5F2",
    alignItems: "center",
  },
  translationLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6C7A8E",
    textTransform: "uppercase",
  },
  translationText: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#263752",
    textAlign: "center",
  },
  imagePane: {
    width: "42%",
    minHeight: 320,
  },
  imagePaneCompact: {
    width: "100%",
    height: 260,
    minHeight: 260,
  },
  wordImageButton: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
  },
  wordImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  tapHint: {
    position: "absolute",
    right: 12,
    bottom: 12,
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 46,
    borderRadius: 23,
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
    fontSize: 116,
    lineHeight: 124,
    color: "#263752",
    fontWeight: "800",
  },
  wordPane: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  wordText: {
    fontSize: 98,
    lineHeight: 102,
    color: "#1F2C46",
    fontWeight: "800",
    textTransform: "lowercase",
  },
  studentName: {
    marginTop: 10,
    fontSize: Layout.fontSize.md,
    color: Colors.text.secondary,
  },
  backBtn: {
    position: "absolute",
    left: 22,
    top: "50%",
    marginTop: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: "#4A5D79",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  backBtnCompact: {
    position: "relative",
    left: 0,
    top: 0,
    marginTop: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  nextBtn: {
    position: "absolute",
    right: 18,
    top: "50%",
    marginTop: -30,
    minWidth: 158,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#9ACB99",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...Layout.shadow.md,
  },
  nextBtnCompact: {
    position: "relative",
    right: 0,
    top: 0,
    marginTop: 0,
    flex: 1,
  },
  actionsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  actionsRow: {
    width: "100%",
    maxWidth: 520,
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.md,
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
  },
  flashcardModal: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  flashcardBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21, 30, 46, 0.62)",
  },
  flashcardWrap: {
    width: "82%",
    maxWidth: 780,
    borderRadius: 28,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  flashcardWrapCompact: {
    width: "100%",
    padding: 14,
  },
  flashcardWrapLandscape: {
    padding: 14,
  },
  flashcardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  flashcardEyebrow: {
    color: "#2E9E78",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  flashcardTitle: {
    color: "#263752",
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
  },
  flashcardTranslation: {
    marginTop: 2,
    color: "#526276",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  flashcardClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderRadius: 20,
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
