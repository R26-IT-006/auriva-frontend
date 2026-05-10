import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, Alert, useWindowDimensions, Animated, Easing, ScrollView, ActivityIndicator } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
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

function arrayBufferToBase64(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array(buffer);
  let output = "";
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    const triplet = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += alphabet[(triplet >> 6) & 63];
    output += alphabet[triplet & 63];
  }

  if (index < bytes.length) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const triplet = (first << 16) | (second << 8);
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += "=";
  }

  return output;
}

function getAudioMimeType(uri) {
  const lowerUri = String(uri || "").toLowerCase();
  if (lowerUri.endsWith(".m4a")) return "audio/mp4";
  if (lowerUri.endsWith(".caf")) return "audio/x-caf";
  if (lowerUri.endsWith(".wav")) return "audio/wav";
  if (lowerUri.endsWith(".3gp")) return "audio/3gpp";
  return "audio/mp4";
}

async function readAudioClip(uri) {
  if (!uri) return null;

  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const rawAudioBase64 = arrayBufferToBase64(buffer);
  const rawAudioSize = buffer.byteLength || null;

  if (!rawAudioBase64 || !rawAudioSize) {
    throw new Error("Recorded audio file was empty.");
  }

  return {
    rawAudioBase64,
    rawAudioMimeType: getAudioMimeType(uri),
    rawAudioSize,
  };
}

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
  const wordImageSource = getWordImageSource(word);
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
  const recordingRef = useRef(null);
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
    if (word) {
      setSelectedWord(word);
    }
    setCurrentActivityStep(PRONUNCIATION_STEPS.SPEAK);
  }, [setCurrentActivityStep, setSelectedWord, word]);

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
    };
  }, []);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Please allow microphone access to record pronunciation.",
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error) {
      Alert.alert(
        "Recording error",
        error.message || "Unable to start recording.",
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
        Alert.alert(
          "Audio save error",
          "The recording finished, but the audio file could not be prepared for saving. Please record again.",
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
      Alert.alert(
        "Recording saved",
        uri
          ? "Your pronunciation clip has been recorded."
          : "Recording finished.",
      );
    } catch (error) {
      Alert.alert(
        "Recording error",
        error.message || "Unable to stop recording.",
      );
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
    }
  }

  async function handleNext() {
    if (!studentId) {
      Alert.alert("Student unavailable", "Unable to score without a selected student.");
      return;
    }

    if (!savedAudioData?.rawAudioBase64 || !savedRecordingUri) {
      Alert.alert(
        "Record first",
        "Please record the pronunciation before moving to the result.",
      );
      return;
    }

    const responseDuration = lastRecordingDuration || recordingSeconds || 2;

    try {
      setIsScoring(true);
      const scoringResult = await teacherApi.scorePronunciationAttempt(studentId, {
        mode,
        category_id: isAlphabetMode ? null : categoryId,
        word_id: word?.id || "cat",
        word_label: word?.letter || word?.word || word?.id || "cat",
        difficulty: word?.difficulty || null,
        target_phonemes: word?.sounds || [],
        response_duration: responseDuration,
        attempt_number: numberOfAttempts + 1,
        raw_audio_base64: savedAudioData.rawAudioBase64,
        raw_audio_mime_type: savedAudioData.rawAudioMimeType,
        raw_audio_size: savedAudioData.rawAudioSize,
      });

      submitScoredAttempt(scoringResult, {
        recordingUri: savedRecordingUri,
        responseDuration,
      });
    } catch (error) {
      Alert.alert(
        "Scoring error",
        error.response?.data?.message ||
          error.message ||
          "Unable to score this pronunciation right now.",
      );
      return;
    } finally {
      setIsScoring(false);
    }

    if (!isAlphabetMode) {
      navigation.navigate("PronunciationListenChoose", {
        student,
        mode,
        categoryId,
        wordId: word?.id || "cat",
        word,
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
                  <Text style={styles.letterImageText}>
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
            style={[styles.backBtn, isCompact && styles.backBtnCompact, { borderColor: theme.cardOutline }]}
          >
            <Ionicons name="arrow-back" size={26} color={theme.headingText} />
          </ButtonFeedback>

          <ButtonFeedback
            activeOpacity={0.9}
            disabled={!canContinue}
            onPress={handleNext}
            style={[
              styles.nextBtn,
              isCompact && styles.nextBtnCompact,
              { backgroundColor: theme.button },
              !canContinue && styles.nextBtnDisabled,
            ]}
          >
            <Text style={styles.nextText}>
              {isScoring ? "Scoring" : "Next"}
            </Text>
            {isScoring ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            )}
          </ButtonFeedback>
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
    fontWeight: "800",
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
    fontWeight: "800",
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
    fontWeight: "800",
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
    fontWeight: Layout.fontWeight.bold,
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
    fontWeight: Layout.fontWeight.semibold,
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
  nextBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -29,
    minWidth: 146,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#A8D79A",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Layout.shadow.md,
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
    fontWeight: "800",
  },
});
