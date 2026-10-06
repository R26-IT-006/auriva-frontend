import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Vibration,
} from "react-native";
import { Audio } from "expo-av";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { teacherApi } from "../../../api/teacher";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import { WORD_BANK } from "./wordBank.js";
import {
  ALPHABET_BANK,
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { buildPronunciationResultPayload } from "./pronunciationPayloads.js";
import { getCongratulationsImage } from "./pronunciationCelebrationAssets.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
import { rs, rf } from "../../../utils/responsive";

const EXPECTED_PRONUNCIATION_SCORE = 80;
const WELL_DONE_AUDIO_ASSET = require("../../../../assets/pronunciation-audios/well-done-female.mp3");
const HOORAY_AUDIO_ASSET = require("../../../../assets/pronunciation-audios/hooray-female.mp3");

function FeedbackButton({ onPress, style, activeOpacity = 0.92, children }) {
  return (
    <ButtonFeedback style={style} activeOpacity={activeOpacity} onPress={onPress}>
      {children}
    </ButtonFeedback>
  );
}

// "ice cream" -> "Ice Cream". Only the first letter of each space-separated
// part changes, so words like "don't" are left intact.
function capitalizeWords(text) {
  if (!text) return text;
  return String(text)
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// The child's buddy, shown on every result (Great Job uses the celebrating
// picture from pronunciationCelebrationAssets instead, when there is one).
const AVATAR_IMAGES = {
  boba: require("../../../../assets/avatar-images/Boba.png"),
  glitter: require("../../../../assets/avatar-images/Glitter.png"),
  lily: require("../../../../assets/avatar-images/Lily.png"),
  megatron: require("../../../../assets/avatar-images/Megatron.png"),
};

// Falling stars behind a Great Job — the same effect as Concept Learning's
// celebration screen (ConceptCongratulationsScreen's FallingStar).
const STAR_COUNT = 8;
const STAR_GLYPHS = ["⭐", "✨", "🎉"];

function FallingStar({ delay, startX, glyph, size, fallDistance, duration }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop = null;
    const t = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: fallDistance, duration, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: 1, duration, useNativeDriver: true }),
          ]),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(translateY, { toValue: -20, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ]),
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(t);
      loop?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.Text
      style={[
        styles.fallingStar,
        { left: startX, top: 0, fontSize: size, transform: [{ translateY }, { rotate: spin }], opacity },
      ]}
    >
      {glyph}
    </Animated.Text>
  );
}

export default function PronunciationResultScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const hasSavedResultRef = useRef(false);
  const theme = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();
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
  // Teacher-only status, kept out of the child's view behind the eye button
  // on the result card. Flagged covers both the neutral (low-confidence)
  // result and any other needs_teacher_review reason.
  const [teacherInfoOpen, setTeacherInfoOpen] = useState(false);
  const isFlaggedForReview = isNeutralFeedback || Boolean(needsTeacherReview);
  // Sensory sensitivity varies hugely per ASD child — confetti/vibration/
  // sound that motivates one kid can overwhelm another. Teacher-set per
  // student on the session setup screen; text-based praise stays either way.
  const reduceStimulation = Boolean(student?.reduce_stimulation);
  const congratulationsImage = getCongratulationsImage(student?.avatar_key);

  // ── Concept-style celebration layout (ConceptCongratulationsScreen) ─────
  // Buddy above the card on Great Job only (the celebrating picture, or the
  // plain one if there is no celebrating version). Keep Practicing and Let's
  // Try Together show no buddy.
  const buddyImage = isHighScore
    ? congratulationsImage || AVATAR_IMAGES[student?.avatar_key] || null
    : null;
  // Capitalised here rather than with textTransform: "capitalize" — on
  // Android that style measures the text before transforming it, so the wider
  // capital pushes the last letter out ("Fish" rendered as "Fis").
  const practisedLabel = isAlphabetMode
    ? currentWord?.letter
      ? `Letter ${currentWord.letter}`
      : null
    : capitalizeWords(currentWord?.word) || null;
  const encouragement = isHighScore
    ? "That sounded great!"
    : isNeutralFeedback
      ? "Let's listen and say it again together."
      : "Listen once more, then have another go.";
  // Falling stars only celebrate a Great Job, and never for a student set to
  // reduced celebration effects. Positions fixed once per screen.
  const showFallingStars = isHighScore && !reduceStimulation;
  const fallingStars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        delay: i * 260,
        startX: (width / STAR_COUNT) * i + Math.random() * 18,
        glyph: STAR_GLYPHS[i % STAR_GLYPHS.length],
        size: 18 + Math.random() * 14,
        fallDistance: 120 + Math.random() * 60,
        duration: 1600 + Math.random() * 700,
      })),
    [width],
  );

  const buddyScale = useRef(new Animated.Value(0)).current;
  const buddyBounce = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0)).current;

  // Entrance, as Concept: the card pops in, the burst springs after a beat,
  // the buddy springs in — and keeps gently bouncing only on a Great Job
  // (still for a reduced-stimulation student).
  useEffect(() => {
    let bounceLoop = null;
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, bounciness: 10, speed: 5 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    const burstTimer = setTimeout(() => {
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, bounciness: 24, speed: 5 }).start();
    }, 200);
    Animated.spring(buddyScale, { toValue: 1, useNativeDriver: true, bounciness: 24, speed: 4 }).start(() => {
      if (!isHighScore || reduceStimulation) return;
      bounceLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(buddyBounce, { toValue: -18, duration: 420, useNativeDriver: true }),
          Animated.timing(buddyBounce, { toValue: 0, duration: 360, useNativeDriver: true }),
          Animated.delay(280),
        ]),
      );
      bounceLoop.start();
    });
    return () => {
      clearTimeout(burstTimer);
      bounceLoop?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

    // Gentle pulse only — the left-right "no" shake was removed.
    pulseLoop.start();
    // Says out loud what the pulsing retry card means, for a child who does
    // not read the "Keep Practicing" heading.
    playVoicePrompt("tryOneMoreTime");

    return () => {
      pulseLoop.stop();
      stopVoicePrompt();
    };
  }, [confettiPieces, isHighScore, isNeutralFeedback, lowScorePulse, reduceStimulation]);

  // Back to the letter list (alphabet) / this category's word list (words).
  // { pop: true } returns to the list screen already in the stack, dropping
  // this word's Learn/Speak/Result screens — same reasoning as Try Again.
  function handleBackToList() {
    navigation.navigate(
      "PronunciationWordSelection",
      {
        student,
        mode,
        categoryId: navigationCategoryId,
      },
      { pop: true }
    );
  }

  function handleTryAgain() {
    // Encouragement on the way into the retry, not praise for the attempt
    // just made — a calm student setting suppresses it.
    playVoicePrompt("youCanDoIt", { reduceStimulation });
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
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      {/* Back to the letter / word list — a translucent pill in the top-left,
          like the round header buttons on the other screens. */}
      <View style={styles.topBar}>
        <FeedbackButton
          style={styles.navPill}
          activeOpacity={0.8}
          onPress={handleBackToList}
        >
          <Ionicons name="arrow-back" size={18} color={theme.headingText} />
          <Text style={[styles.navPillText, { color: theme.headingText }]}>
            {isAlphabetMode ? "Letters" : "Words"}
          </Text>
        </FeedbackButton>
      </View>

      {/* Falling stars behind a Great Job (not for reduced stimulation). */}
      {showFallingStars ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {fallingStars.map((s, i) => (
            <FallingStar key={i} {...s} />
          ))}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.studentResultWrap}>
          {/* The child's buddy pops in on top of the card (Concept layout). */}
          {buddyImage ? (
            <Animated.Image
              source={buddyImage}
              resizeMode="contain"
              accessibilityLabel={isHighScore ? "Your buddy is celebrating with you" : "Your buddy"}
              style={[
                styles.buddy,
                { transform: [{ scale: buddyScale }, { translateY: buddyBounce }] },
              ]}
            />
          ) : null}

          <Animated.View
            style={[
              styles.studentResultCard,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >

            {/* Teacher-only: small, quiet eye button in the card's corner that
                opens the attempt's status (completed / review flag). Tinted in
                the review colour when this attempt is flagged. */}
            <Pressable
              onPress={() => setTeacherInfoOpen(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Teacher info for this attempt"
              style={styles.teacherInfoBtn}
            >
              <Ionicons
                name="eye-outline"
                size={16}
                color={isFlaggedForReview ? Colors.status.review : "#9AA5B5"}
              />
            </Pressable>

            {/* Concept order: glowing burst → heading → what was practised →
                encouragement. Keep Practicing keeps its gentle pulse and the
                "sound to practice" tip. */}
            <Animated.View
              style={[
                styles.celebrationContent,
                !isHighScore && !isNeutralFeedback && {
                  transform: [{ scale: lowScorePulse }],
                },
              ]}
            >
              {/* Icon burst for Let's Try Together / Keep Practicing. Great
                  Job has none — the celebrating buddy says it. */}
              {!isHighScore ? (
                <View style={styles.burstWrap}>
                  <Animated.View
                    style={[
                      styles.burstGlow,
                      {
                        backgroundColor: isNeutralFeedback ? theme.cardOutline : "#FFB7C4",
                        transform: [{ scale: burstScale }],
                      },
                    ]}
                  />
                  <Animated.View style={{ transform: [{ scale: burstScale }] }}>
                    {isNeutralFeedback ? (
                      <Ionicons name="people" size={40} color={theme.button} />
                    ) : (
                      <Ionicons name="refresh-circle" size={44} color={Colors.status.error} />
                    )}
                  </Animated.View>
                </View>
              ) : null}

              <Text
                style={[
                  styles.studentResultTitle,
                  !isHighScore && !isNeutralFeedback
                    ? styles.lowScoreTitle
                    : { color: theme.headingText },
                ]}
              >
                {isHighScore ? "Great Job!" : isNeutralFeedback ? "Let's Try Together" : "Keep Practicing"}
              </Text>

              {practisedLabel ? (
                <Text style={[styles.practisedLabel, { color: theme.button }]}>{practisedLabel}</Text>
              ) : null}

              <Text style={[styles.encouragement, { color: theme.headingText }]}>{encouragement}</Text>

              {!isHighScore && !isNeutralFeedback && weakSoundText ? (
                <View style={styles.soundFocusCard}>
                  <Text style={styles.soundFocusLabel}>Sound to practice</Text>
                  <Text style={styles.soundFocusSound}>{weakSoundText}</Text>
                  {weakSoundCue ? (
                    <Text style={styles.soundFocusCue}>{weakSoundCue}</Text>
                  ) : null}
                </View>
              ) : null}
            </Animated.View>
          </Animated.View>

          {/* Both as Concept's raised 3D buttons, centred under the card:
              Next is the main action (avatar colour), Try Again the quieter
              white one. Sized by padding, so the label can never overflow. */}
          <View style={styles.studentActions}>
            <FeedbackButton
              style={[styles.tryAgainBtn, { borderColor: theme.cardOutline }]}
              activeOpacity={0.9}
              onPress={handleTryAgain}
            >
              <Ionicons name="refresh" size={20} color={theme.headingText} />
              <Text style={[styles.tryAgainText, { color: theme.headingText }]}>Try Again</Text>
            </FeedbackButton>

            <FeedbackButton
              style={[styles.nextWordBtn, { backgroundColor: theme.button }]}
              activeOpacity={0.9}
              onPress={handleNextWord}
            >
              <Text style={[styles.nextWordBtnText, { color: theme.buttonText }]}>
                {isAlphabetMode ? "Next Letter" : "Next Word"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
            </FeedbackButton>
          </View>
        </View>
      </ScrollView>

      {/* ── Teacher info — opened from the eye button on the result card ── */}
      <Modal
        visible={teacherInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTeacherInfoOpen(false)}
      >
        <Pressable style={styles.teacherInfoBackdrop} onPress={() => setTeacherInfoOpen(false)}>
          <Pressable
            style={[styles.teacherInfoCard, { borderColor: theme.cardOutline }]}
            onPress={() => {}}
          >
            <View style={styles.teacherInfoHeader}>
              <Ionicons name="eye-outline" size={18} color={theme.headingText} />
              <Text style={[styles.teacherInfoTitle, { color: theme.headingText }]}>For the teacher</Text>
              <Pressable
                onPress={() => setTeacherInfoOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.teacherInfoClose}
              >
                <Ionicons name="close" size={20} color="#8A959C" />
              </Pressable>
            </View>

            <View style={styles.completedPill}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
              <Text style={styles.completedPillText}>Completed</Text>
            </View>

            {isFlaggedForReview ? (
              <View style={styles.reviewPill}>
                <Ionicons name="eye-outline" size={13} color={Colors.status.review} />
                <Text style={styles.reviewPillText}>Flagged for teacher review</Text>
              </View>
            ) : (
              <Text style={styles.teacherInfoNote}>No review needed for this attempt.</Text>
            )}
          </Pressable>
        </Pressable>
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
  // Buddy + card + buttons centred vertically in the space under the header;
  // the extra bottom padding lifts the group a little above centre.
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: rs(18),
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xl + 120,
    alignItems: "center",
  },
  // ── Header: back to the letter / word list ───────────────────────────────
  // Full width with the button pinned to the left; lowered by its top
  // padding (40 more than the bottom).
  topBar: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    // Button sits a little in from the left edge.
    paddingLeft: rs(40),
    paddingRight: Layout.spacing.md,
    paddingTop: Layout.spacing.sm + 40,
    paddingBottom: Layout.spacing.sm,
  },
  // Translucent pill, the same white wash and shadow as the round header
  // buttons on the other screens (ConceptCategoriesScreen iconBtn).
  navPill: {
    height: rs(40),
    borderRadius: rs(20),
    paddingHorizontal: rs(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: rs(6),
    backgroundColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  navPillText: {
    fontFamily: Layout.fonts.bold,
    fontSize: rf(14),
  },
  completedPill: {
    alignSelf: "center",
    marginTop: rs(3),
    minHeight: rs(24),
    borderRadius: rs(12),
    backgroundColor: Colors.status.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: rs(8),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: rs(4),
  },
  completedPillText: {
    color: Colors.status.success,
    fontSize: rf(11),
    fontFamily: Layout.fonts.bold,
  },
  reviewPill: {
    alignSelf: "center",
    marginTop: rs(10),
    minHeight: rs(24),
    borderRadius: rs(12),
    backgroundColor: Colors.status.reviewLight,
    borderWidth: 1,
    borderColor: Colors.status.reviewBorder,
    paddingHorizontal: rs(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: rs(4),
  },
  reviewPillText: {
    color: Colors.status.review,
    fontSize: rf(11),
    fontFamily: Layout.fonts.bold,
  },
  // ── Teacher-only info (eye button + popup) ──────────────────────────────
  // Deliberately small and grey: easy for the teacher to find, easy for the
  // child to ignore.
  teacherInfoBtn: {
    position: "absolute",
    top: rs(12),
    right: rs(12),
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  teacherInfoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.xl,
  },
  teacherInfoCard: {
    width: "100%",
    maxWidth: rs(360),
    backgroundColor: "#FFFFFF",
    borderRadius: rs(24),
    borderWidth: 2,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(12) },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  teacherInfoHeader: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    marginBottom: Layout.spacing.md,
  },
  teacherInfoTitle: {
    flex: 1,
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.extrabold,
  },
  teacherInfoClose: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    backgroundColor: "#F2F5F6",
    alignItems: "center",
    justifyContent: "center",
  },
  teacherInfoNote: {
    marginTop: rs(10),
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
    color: Colors.text.secondary,
    textAlign: "center",
  },
  dashboardText: {
    color: "#5D6D87",
    fontFamily: Layout.fonts.bold,
    fontSize: rf(14),
  },
  contentRow: {
    width: "100%",
    maxWidth: rs(1040),
    marginTop: rs(16),
    flexDirection: "row",
    gap: rs(18),
  },
  contentRowCompact: {
    flexDirection: "column",
  },
  // ── Celebration card (ConceptCongratulationsScreen layout) ───────────────
  studentResultWrap: {
    width: "100%",
    maxWidth: rs(440),
    alignItems: "center",
  },
  // The buddy stands on its own above the card, with a small gap — not
  // overlapping it (Concept overlaps; here they are kept separate).
  // 280px buddy. The negative bottom margin lets the picture's lower edge
  // extend into the (now invisible) card's top padding, so the buddy grew
  // without pushing the text below down: 280 - 36 = the old 240 + 4.
  buddy: {
    width: rs(280),
    height: rs(280),
    marginBottom: rs(-36),
  },
  // No visible box: the result content sits directly on the gradient. The
  // view stays (transparent, no shadow — a shadow on a transparent view
  // draws a stray outline on Android) so the content keeps its spacing, the
  // pop-in animation, and the eye button's top-right position.
  studentResultCard: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Layout.spacing.xl,
    paddingBottom: rs(28),
    paddingHorizontal: rs(24),
  },
  celebrationContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: rs(6),
  },
  burstWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: rs(70),
    height: rs(70),
    marginBottom: rs(4),
  },
  burstGlow: {
    position: "absolute",
    width: rs(70),
    height: rs(70),
    borderRadius: rs(35),
    opacity: 0.25,
  },
  studentResultTitle: {
    fontSize: rf(30),
    lineHeight: rf(38),
    fontFamily: "DMSans_900Black",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  // What was just practised ("Letter A" / "cat"), in the avatar colour —
  // where Concept names the concept.
  practisedLabel: {
    fontSize: rf(20),
    fontFamily: "DMSans_800ExtraBold",
    textAlign: "center",
  },
  encouragement: {
    fontSize: rf(14),
    fontFamily: "DMSans_600SemiBold",
    opacity: 0.6,
    textAlign: "center",
    marginTop: rs(8),
    paddingHorizontal: rs(8),
  },
  fallingStar: {
    position: "absolute",
    fontSize: rf(22),
  },
  lowScoreTitle: {
    color: Colors.status.error,
  },
  soundFocusCard: {
    marginTop: rs(4),
    maxWidth: rs(420),
    borderRadius: rs(16),
    borderWidth: 1,
    borderColor: "#FFD3DC",
    backgroundColor: "#FFF5F7",
    paddingVertical: rs(14),
    paddingHorizontal: rs(18),
    alignItems: "center",
  },
  soundFocusLabel: {
    fontSize: rf(12),
    fontFamily: Layout.fonts.bold,
    color: "#B23A57",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  soundFocusSound: {
    marginTop: rs(4),
    fontSize: rf(30),
    fontFamily: Layout.fonts.extrabold,
    color: "#7A1F35",
  },
  soundFocusCue: {
    marginTop: rs(6),
    fontSize: rf(14),
    lineHeight: rf(20),
    fontFamily: Layout.fonts.semibold,
    color: "#5C3541",
    textAlign: "center",
  },
  studentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: rs(20),
    marginTop: rs(20),
  },
  leftPanel: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: rs(24),
    borderWidth: 1,
    borderColor: "#D6E2EF",
    padding: rs(18),
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(18),
  },
  scoreRowCompact: {
    alignItems: "flex-start",
  },
  scoreCircle: {
    width: rs(106),
    height: rs(106),
    borderRadius: rs(53),
    borderWidth: 2,
    borderColor: "#4B5B72",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: rf(38),
    fontFamily: Layout.fonts.bold,
    color: "#3A4A63",
  },
  summaryWrap: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: rf(43),
    fontFamily: Layout.fonts.extrabold,
    color: "#27354D",
  },
  feedbackTitleCompact: {
    fontSize: rf(30),
    lineHeight: rf(36),
  },
  starsRow: {
    flexDirection: "row",
    marginTop: rs(4),
    gap: 2,
  },
  responseChip: {
    marginTop: rs(10),
    alignSelf: "flex-start",
    backgroundColor: "#F3F6FA",
    borderRadius: rs(10),
    paddingHorizontal: rs(10),
    height: rs(30),
    flexDirection: "row",
    alignItems: "center",
    gap: rs(6),
  },
  responseChipText: {
    color: "#667A95",
    fontSize: rf(12),
    fontFamily: Layout.fonts.semibold,
  },
  breakdownTitle: {
    marginTop: rs(16),
    marginBottom: rs(10),
    fontSize: rf(16),
    color: "#2E3E56",
    fontFamily: Layout.fonts.bold,
  },
  rightPanel: {
    width: rs(260),
    gap: rs(10),
  },
  rightPanelCompact: {
    width: "100%",
  },
  suggestionCard: {
    backgroundColor: Colors.surface,
    borderRadius: rs(18),
    borderWidth: 1,
    borderColor: "#D6E2EF",
    padding: rs(12),
  },
  suggestionTop: {
    flexDirection: "row",
    gap: rs(10),
  },
  botIconWrap: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    backgroundColor: "#ECF5FD",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: {
    fontSize: rf(14),
    fontFamily: Layout.fonts.extrabold,
    color: "#2F3F58",
  },
  suggestionCopy: {
    marginTop: rs(3),
    fontSize: rf(12),
    color: "#697D97",
    lineHeight: rf(16),
  },
  nextWordCard: {
    marginTop: rs(10),
    backgroundColor: "#F6F7F9",
    borderRadius: rs(12),
    paddingVertical: rs(10),
    alignItems: "center",
  },
  nextWordHint: {
    fontSize: rf(11),
    color: "#8C9AB0",
    fontFamily: Layout.fonts.bold,
  },
  nextWordText: {
    fontSize: rf(18),
    color: "#1E2E47",
    fontFamily: Layout.fonts.bold,
    marginTop: 2,
    textTransform: "lowercase",
  },
  // ── Actions: Concept's raised 3D button (ConceptImageScreen fwdBtn) ──────
  // Try Again: the quieter white version, outlined in the theme colour.
  tryAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    paddingHorizontal: rs(28),
    paddingVertical: rs(14),
    borderRadius: rs(16),
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderBottomWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  tryAgainText: {
    fontSize: rf(17),
    fontFamily: "DMSans_800ExtraBold",
  },
  // Next Letter / Next Word: the main action, in the avatar's button colour.
  nextWordBtn: {
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
  nextWordBtnText: {
    fontSize: rf(17),
    fontFamily: "DMSans_800ExtraBold",
  },
});
