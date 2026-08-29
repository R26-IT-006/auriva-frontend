import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions, Animated, Easing, ScrollView, ActivityIndicator } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { getWordImageSource } from "./wordBank.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import {
  createRecordingWithRecovery,
  PLAYBACK_AUDIO_MODE,
  readAudioClip,
} from "./pronunciationRecording.js";
import {
  buildPronunciationScoringPayload,
  getPronunciationWordLabel,
} from "./pronunciationPayloads.js";
import { playVoicePrompt, stopVoicePrompt } from "./pronunciationVoicePrompts.js";
import { ThemedGradientFill } from "./pronunciationDesignKit.js";
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";
import {
  PronunciationAlert,
  usePronunciationAlert,
} from "./PronunciationAlert.js";

export default function PronunciationSpeakWordScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const theme = getAvatarTheme(student?.avatar_key);
  const sessionMode = usePronunciationSessionStore((state) => state.selectedMode);
  const mode = route.params?.mode || sessionMode || PRONUNCIATION_MODES.WORD;
  const isAlphabetMode = mode === PRONUNCIATION_MODES.ALPHABET;
  const categoryId = route.params?.categoryId;
  const sessionSelectedWord = usePronunciationSessionStore(
    (state) => state.selectedWord,
  );
  const word = route.params?.word || sessionSelectedWord;
  const imageStyle = usePronunciationSessionStore((state) => state.imageStyle);
  const wordImageSource = getWordImageSource(word, imageStyle);
  const { width } = useWindowDimensions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [savedRecordingUri, setSavedRecordingUri] = useState(null);
  const [savedAudioData, setSavedAudioData] = useState(null);
  const [lastRecordingDuration, setLastRecordingDuration] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const setSelectedWord = usePronunciationSessionStore((state) => state.setSelectedWord);
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const setRecordingUri = usePronunciationSessionStore((state) => state.setRecordingUri);
  const numberOfAttempts = usePronunciationSessionStore(
    (state) => state.numberOfAttempts,
  );
  const submitScoredAttempt = usePronunciationSessionStore(
    (state) => state.submitScoredAttempt,
  );
  const heardReferenceAudio = usePronunciationSessionStore(
    (state) => state.heardReferenceAudio,
  );
  const { isExitConfirmVisible, confirmExit, cancelExit } =
    useExitSessionGuard(navigation);
  const { showAlert, alertProps } = usePronunciationAlert();
  const recordingRef = useRef(null);
  const scoringAbortControllerRef = useRef(null);
  const isScoringRef = useRef(false);
  const lastScoringResultRef = useRef(null);
  const promptShownAtRef = useRef(Date.now());
  const preRecordDelayRef = useRef(null);
  const pulseLoopRef = useRef(null);
  const waveLoopRef = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const barAnimA = useRef(new Animated.Value(0.25)).current;
  const barAnimB = useRef(new Animated.Value(0.4)).current;
  const barAnimC = useRef(new Animated.Value(0.3)).current;

  const isCompact = width < 760;
  const cardWidth = isCompact
    ? width - Layout.spacing.lg * 2
    : Math.min(Math.max(width * 0.62, 700), 940);

  const barAnimations = useMemo(
    () => [barAnimA, barAnimB, barAnimC],
    [barAnimA, barAnimB, barAnimC],
  );

  useEffect(() => {
    // The word is normally already selected before this screen mounts. Do
    // not select the same word again: setSelectedWord intentionally resets
    // per-attempt evidence, including whether reference audio was heard.
    if (word && sessionSelectedWord?.id !== word.id) {
      setSelectedWord(word);
    }
    setCurrentActivityStep(PRONUNCIATION_STEPS.SPEAK);
  }, [sessionSelectedWord?.id, setCurrentActivityStep, setSelectedWord, word]);

  // Spoken instruction for the recording step — a child who cannot yet read
  // the on-screen helper text still knows what the microphone is for. Held
  // back a beat so it does not collide with the screen transition.
  useEffect(() => {
    const promptTimer = setTimeout(() => {
      playVoicePrompt("tapRecordAndSpeak");
    }, 600);

    return () => {
      clearTimeout(promptTimer);
      stopVoicePrompt();
    };
  }, [word?.id]);

  useEffect(() => {
    if (isRecording) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      pulseLoopRef.current.start();

      waveLoopRef.current = Animated.loop(
        Animated.stagger(
          140,
          barAnimations.map((anim, index) =>
            Animated.sequence([
              Animated.timing(anim, {
                toValue: 1,
                duration: 240 + index * 40,
                useNativeDriver: false,
              }),
              Animated.timing(anim, {
                toValue: 0.22 + index * 0.08,
                duration: 240 + index * 30,
                useNativeDriver: false,
              }),
            ]),
          ),
        ),
      );
      waveLoopRef.current.start();

      timerRef.current = setInterval(() => {
        setRecordingSeconds((value) => value + 1);
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      };
    }

    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }
    if (waveLoopRef.current) {
      waveLoopRef.current.stop();
      waveLoopRef.current = null;
    }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    setRecordingSeconds(0);
    barAnimations.forEach((anim, index) => anim.setValue(0.25 + index * 0.08));

    return undefined;
  }, [barAnimations, isRecording, pulseAnim]);

  useEffect(() => {
    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
      if (waveLoopRef.current) waveLoopRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      scoringAbortControllerRef.current?.abort();
    };
  }, []);

  async function startRecording() {
    await stopVoicePrompt();
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showAlert(
          "Microphone permission needed",
          "Please allow microphone access to record pronunciation.",
          { tone: "warning" },
        );
        return;
      }

      const { recording } = await createRecordingWithRecovery();

      recordingRef.current = recording;
      preRecordDelayRef.current = Math.max(
        0,
        (Date.now() - promptShownAtRef.current) / 1000,
      );
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error) {
      Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
      showAlert(
        "Recording error",
        error.message || "Unable to start recording.",
        { tone: "error" },
      );
    }
  }

  async function stopRecording() {
    const currentRecording = recordingRef.current;
    if (!currentRecording) return;
    const durationSeconds = Math.max(recordingSeconds, 1);

    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      let audioData = null;
      try {
        audioData = await readAudioClip(uri);
      } catch (error) {
        console.log("Unable to read raw pronunciation audio:", error.message);
      }

      if (!audioData?.rawAudioBase64) {
        showAlert(
          "Audio save error",
          "The recording finished, but the audio file could not be prepared for saving. Please record again.",
          { tone: "error", confirmLabel: "Record Again" },
        );
        setSavedRecordingUri(null);
        setSavedAudioData(null);
        setRecordingUri(null, null, {});
        return;
      }

      setSavedRecordingUri(uri);
      setSavedAudioData(audioData);
      setLastRecordingDuration(durationSeconds);
      setRecordingUri(uri, durationSeconds, audioData);
      showAlert(
        "Recording saved",
        uri
          ? "Your pronunciation clip has been recorded."
          : "Recording finished.",
        { tone: "success" },
      );
    } catch (error) {
      showAlert(
        "Recording error",
        error.message || "Unable to stop recording.",
        { tone: "error" },
      );
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
      promptShownAtRef.current = Date.now();
      Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
    }
  }

  async function handleNext() {
    if (isScoringRef.current) return;

    if (!studentId) {
      showAlert(
        "Student unavailable",
        "Unable to score without a selected student.",
        { tone: "error" },
      );
      return;
    }

    if (!savedAudioData?.rawAudioBase64 || !savedRecordingUri) {
      showAlert(
        "Record first",
        "Please record the pronunciation before moving to the result.",
        { tone: "info", confirmLabel: "Got It" },
      );
      return;
    }

    const responseDuration = lastRecordingDuration || recordingSeconds || 2;

    try {
      isScoringRef.current = true;
      setIsScoring(true);
      const scoringAbortController = new AbortController();
      scoringAbortControllerRef.current = scoringAbortController;
      const scoringResult = await teacherApi.scorePronunciationAttempt(
        studentId,
        buildPronunciationScoringPayload({
          mode,
          categoryId,
          isAlphabetMode,
          word,
          responseDuration,
          attemptNumber: numberOfAttempts + 1,
          audioData: savedAudioData,
          preRecordDelaySeconds: preRecordDelayRef.current,
          heardReferenceAudio,
        }),
        { signal: scoringAbortController.signal },
      );

      lastScoringResultRef.current = scoringResult;
      submitScoredAttempt(scoringResult, {
        recordingUri: savedRecordingUri,
        responseDuration,
      });
    } catch (error) {
      if (error.code === "REQUEST_CANCELLED") return;

      const errorCode = error.code;
      const isQualityError = errorCode === "AUDIO_QUALITY_FAILED";
      const isWordMismatch = errorCode === "WORD_MISMATCH";
      showAlert(
        isWordMismatch
          ? "That sounded different"
          : isQualityError
            ? "Recording quality issue"
            : "Scoring error",
        error.message ||
          "Unable to score this pronunciation right now.",
        {
          tone: isWordMismatch ? "mismatch" : isQualityError ? "quality" : "error",
          // The backend names what it heard in `details`; showing it beside
          // the target word tells the teacher at a glance what went wrong.
          heardWord: isWordMismatch ? error.details?.recognized_text ?? null : null,
          targetWord: isWordMismatch ? getPronunciationWordLabel(word, null) : null,
        },
      );
      return;
    } finally {
      isScoringRef.current = false;
      scoringAbortControllerRef.current = null;
      setIsScoring(false);
    }

    if (!isAlphabetMode) {
      // Same sound has now been the weakest one across 2+ saved attempts:
      // insert a listening-discrimination round on that exact sound before
      // the next speaking attempt, instead of the normal listen-and-choose
      // round. Reuses the backend's own repeat-failure count rather than
      // recomputing it here, so this can never disagree with the teacher's
      // "recurring weakness" evidence shown elsewhere.
      const targetPhoneme =
        lastScoringResultRef.current?.weak_phoneme &&
        Number(lastScoringResultRef.current?.recurring_weak_phoneme_count) >= 2
          ? lastScoringResultRef.current.weak_phoneme
          : null;

      navigation.navigate("PronunciationListenChoose", {
        student,
        mode,
        categoryId,
        wordId: word?.id || "cat",
        word,
        targetPhoneme,
      });
      return;
    }

    navigation.navigate("PronunciationResult", {
      student,
      mode,
      categoryId,
      wordId: word?.id || "cat",
      word,
    });
  }

  function handleTapToSpeak() {
    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
  }

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const micBackground = isRecording ? "#E89C8E" : theme.button;
  const statusText = isScoring
    ? "Scoring..."
    : isRecording
      ? "Recording..."
      : savedRecordingUri
        ? "Recording saved"
        : "Tap to speak";
  const canContinue = !isRecording && !isScoring;

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, isCompact && styles.titleCompact, { color: theme.headingText }]}>
          {isAlphabetMode ? "Say this letter" : "What is this?"}
        </Text>
        <Text style={[styles.titleSinhala, isCompact && styles.titleSinhalaCompact, { color: theme.headingText }]}>
          {isAlphabetMode ? "මේ අකුර කියන්න" : "මේ මොකක්ද?"}
        </Text>

        <View style={[styles.contentRow, isCompact && styles.contentRowCompact, { width: cardWidth }]}>
          <View style={[styles.imageCard, isCompact && styles.imageCardCompact]}>
            <View style={[styles.imageFrame, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              {isAlphabetMode ? (
                <View style={[styles.image, styles.letterImage, { backgroundColor: word?.color || theme.cardSurface }]}>
                  <Text style={[styles.letterImageText, { color: theme.headingText }]}>
                    {word?.letter || word?.word || "A"}
                  </Text>
                </View>
              ) : wordImageSource ? (
                <Image
                  source={wordImageSource}
                  resizeMode="cover"
                  style={styles.image}
                />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons name="image-outline" size={42} color="#76839A" />
                </View>
              )}
            </View>
          </View>

          <View style={[styles.voiceCard, isCompact && styles.voiceCardCompact, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <ButtonFeedback
              activeOpacity={0.88}
              onPress={handleTapToSpeak}
              disabled={isScoring}
              soundEnabled={false}
              style={styles.micHitArea}
            >
              <Animated.View
                style={[
                  styles.micBtn,
                  {
                    backgroundColor: micBackground,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              >
                <Ionicons
                  name={isRecording ? "stop-outline" : "mic-outline"}
                  size={30}
                  color="#FFFFFF"
                />
              </Animated.View>
            </ButtonFeedback>
            <Text style={styles.micLabel}>{statusText}</Text>
            {isScoring ? (
              <ActivityIndicator
                size="small"
                color={theme.button}
                style={styles.scoringIndicator}
              />
            ) : null}
            {isRecording ? (
              <Text style={styles.recordingTimer}>
                00:{String(recordingSeconds).padStart(2, "0")}
              </Text>
            ) : null}

            {isRecording ? (
              <View style={styles.waveRow}>
                {barAnimations.map((anim, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.waveBar,
                      {
                        height: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 42],
                        }),
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}

            <Text style={styles.helperText}>
              {savedRecordingUri
                ? "Press Next to score the pronunciation."
                : "Press the microphone and say the word clearly."}
            </Text>
          </View>
        </View>

        <View
          pointerEvents={isCompact ? "auto" : "box-none"}
          style={isCompact ? styles.actionsRow : styles.actionsOverlay}
        >
          <ButtonFeedback
            activeOpacity={0.82}
            onPress={() => navigation.goBack()}
            disabled={isScoring}
            style={[
              styles.backBtn,
              isCompact && styles.backBtnCompact,
              { borderColor: theme.cardOutline },
              isScoring && styles.nextBtnDisabled,
            ]}
          >
            <Ionicons name="arrow-back" size={26} color={theme.headingText} />
          </ButtonFeedback>

          <ButtonFeedback
            activeOpacity={0.9}
            disabled={!canContinue}
            onPress={handleNext}
            style={[
              styles.nextBtnWrap,
              isCompact && styles.nextBtnCompact,
              !canContinue && styles.nextBtnDisabled,
            ]}
          >
            <ThemedGradientFill theme={theme} style={styles.nextBtn}>
              <Text style={styles.nextText}>
                {isScoring ? "Scoring" : "Next"}
              </Text>
              {isScoring ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              )}
            </ThemedGradientFill>
          </ButtonFeedback>
        </View>
      </ScrollView>

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
  container: {
    flexGrow: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
  },
  containerCompact: {
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 28,
    fontFamily: Layout.fonts.extrabold,
    color: "#2C5878",
    marginBottom: 4,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 4,
  },
  titleSinhala: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Layout.fonts.extrabold,
    color: "#2C5878",
    marginBottom: 26,
    textAlign: "center",
    opacity: 0.82,
  },
  titleSinhalaCompact: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: Layout.spacing.lg,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  contentRowCompact: {
    flexDirection: "column",
    gap: Layout.spacing.md,
  },
  imageCard: {
    width: "46%",
    alignItems: "center",
  },
  imageCardCompact: {
    width: "100%",
  },
  imageFrame: {
    width: "100%",
    maxWidth: 360,
    height: 220,
    borderRadius: 18,
    padding: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "#D7E1EC",
    ...Layout.shadow.sm,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  placeholder: {
    backgroundColor: "#E8EDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  letterImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  letterImageText: {
    fontSize: 112,
    lineHeight: 120,
    color: "#263752",
    fontFamily: Layout.fonts.extrabold,
  },
  voiceCard: {
    width: "44%",
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7E1EC",
    padding: 24,
    ...Layout.shadow.sm,
  },
  voiceCardCompact: {
    width: "100%",
    minHeight: 240,
  },
  micHitArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    ...Layout.shadow.md,
  },
  micLabel: {
    marginTop: 18,
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontFamily: Layout.fonts.bold,
  },
  helperText: {
    marginTop: 18,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  recordingTimer: {
    marginTop: 6,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.link,
    fontFamily: Layout.fonts.semibold,
  },
  scoringIndicator: {
    marginTop: 8,
  },
  waveRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 44,
  },
  waveBar: {
    width: 7,
    borderRadius: 4,
    backgroundColor: "#F29B8E",
    borderWidth: 1.2,
    borderColor: "#3E4D62",
  },
  backBtn: {
    position: "absolute",
    left: 12,
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#4A5D79",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.34)",
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
  nextBtnWrap: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -29,
    minWidth: 146,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    ...Layout.shadow.md,
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnCompact: {
    position: "relative",
    right: 0,
    top: 0,
    marginTop: 0,
    flex: 1,
  },
  nextBtnDisabled: {
    opacity: 0.48,
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
    fontSize: 18,
    fontFamily: Layout.fonts.extrabold,
  },
});
