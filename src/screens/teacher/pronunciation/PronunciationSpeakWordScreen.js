import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions, Animated, Easing, ScrollView, ActivityIndicator } from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { teacherApi } from "../../../api/teacher";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
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
import { useExitSessionGuard } from "./useExitSessionGuard.js";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import {
  PronunciationAlert,
  usePronunciationAlert,
} from "./PronunciationAlert.js";
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';

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
  const { width, height } = useWindowDimensions();
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
  // Same footprint as the Listen step (PronunciationLearnWordScreen): the row
  // is ~55% of the screen, and both cards share one height that leaves room
  // for the header, headline and Next (~330). The letter / picture card is a
  // square of that height; the microphone card takes the rest of the row.
  const cardWidth = isCompact
    ? width - Layout.spacing.lg * 2
    : Math.min(Math.max(width * 0.55, 640), 820);
  const panelHeight = Math.max(240, Math.min(height - 330, 340));

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
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      {/* Back — Concept's round translucent header button. Disabled while
          scoring, and goBack still goes through useExitSessionGuard. */}
      <View style={styles.topBar}>
        <ButtonFeedback
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          disabled={isScoring}
          style={[
            styles.iconBtn,
            { backgroundColor: "rgba(255,255,255,0.7)" },
            isScoring && styles.nextBtnDisabled, BACK_BUTTON]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
        </ButtonFeedback>
      </View>

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
          <View style={[styles.imageCard, isCompact && styles.imageCardCompact, !isCompact && { width: panelHeight }]}>
            <View
              style={[
                styles.imageFrame,
                { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
                // Square on a tablet, matching the Listen step's letter panel.
                !isCompact && { width: panelHeight, height: panelHeight, maxWidth: undefined },
              ]}
            >
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

          <View
            style={[
              styles.voiceCard,
              isCompact && styles.voiceCardCompact,
              { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
              // At least as tall as the letter / picture card beside it (it may
              // grow a little while recording adds the timer and wave bars);
              // fills the rest of the row.
              !isCompact && { minHeight: panelHeight, flex: 1, width: undefined },
            ]}
          >
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

        {/* Next — Concept's 3D "Ready!" button, centred under the cards.
            Disabled (dimmed) while recording or scoring, as before. */}
        <View style={styles.actionsRow}>
          <ButtonFeedback
            activeOpacity={0.9}
            disabled={!canContinue}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={isScoring ? "Scoring" : "Next"}
            accessibilityState={{ disabled: !canContinue, busy: isScoring }}
            style={[
              styles.nextBtn,
              { backgroundColor: theme.button },
              !canContinue && styles.nextBtnDisabled,
            ]}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>
              {isScoring ? "Scoring" : "Next"}
            </Text>
            {isScoring ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
            )}
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
  // Header row holding the back button (ConceptCategoriesScreen topBar/iconBtn).
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  containerCompact: {
    justifyContent: "flex-start",
  },
  // Same heading sizes as the Listen step.
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: Layout.fonts.extrabold,
    color: "#2C5878",
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 4,
  },
  titleSinhala: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: Layout.fonts.extrabold,
    color: "#2C5878",
    // Wider gap under the instruction: the page is centred vertically, so
    // this lifts the instruction away from the cards below it.
    marginBottom: 56,
    textAlign: "center",
    opacity: 0.82,
  },
  titleSinhalaCompact: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: Layout.spacing.lg,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
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
  // Both cards in the Concept/Dialogue card style: thick theme outline
  // (colour set inline), round corners, soft shadow.
  imageFrame: {
    width: "100%",
    maxWidth: 360,
    height: 220,
    borderRadius: 28,
    padding: 10,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: "#D7E1EC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
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
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#D7E1EC",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
  actionsRow: {
    width: "100%",
    marginTop: Layout.spacing.xl,
    alignItems: "center",
  },
  // Next — ConceptImageScreen's fwdBtn ("Ready!").
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0,0,0,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  // Dimmed while recording / scoring (Next) and while scoring (Back).
  nextBtnDisabled: {
    opacity: 0.48,
  },
  nextText: {
    fontSize: 17,
    fontFamily: "DMSans_800ExtraBold",
  },
});
