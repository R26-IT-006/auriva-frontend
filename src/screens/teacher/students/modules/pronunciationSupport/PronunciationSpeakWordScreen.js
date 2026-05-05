import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, Alert, useWindowDimensions, Animated, Easing } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import {
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";

export default function PronunciationSpeakWordScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryId = route.params?.categoryId || "animals";
  const sessionSelectedWord = usePronunciationSessionStore(
    (state) => state.selectedWord,
  );
  const word = route.params?.word || sessionSelectedWord;
  const { width } = useWindowDimensions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [savedRecordingUri, setSavedRecordingUri] = useState(null);
  const [lastRecordingDuration, setLastRecordingDuration] = useState(null);
  const setSelectedWord = usePronunciationSessionStore((state) => state.setSelectedWord);
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const setRecordingUri = usePronunciationSessionStore((state) => state.setRecordingUri);
  const submitMockAttempt = usePronunciationSessionStore(
    (state) => state.submitMockAttempt,
  );
  const recordingRef = useRef(null);
  const pulseLoopRef = useRef(null);
  const waveLoopRef = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const barAnimA = useRef(new Animated.Value(0.25)).current;
  const barAnimB = useRef(new Animated.Value(0.4)).current;
  const barAnimC = useRef(new Animated.Value(0.3)).current;

  const cardWidth = Math.min(Math.max(width * 0.62, 700), 940);

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
      setSavedRecordingUri(uri);
      setLastRecordingDuration(durationSeconds);
      setRecordingUri(uri, durationSeconds);
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

  function handleNext() {
    submitMockAttempt({
      recordingUri: savedRecordingUri,
      responseDuration: lastRecordingDuration || recordingSeconds || 2,
    });
    navigation.navigate("PronunciationResult", {
      student,
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
  const statusText = isRecording ? "Recording..." : "Tap to speak";

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.headingText }]}>What is this?</Text>

        <View style={[styles.contentRow, { width: cardWidth }]}>
          <View style={styles.imageCard}>
            <View style={[styles.imageFrame, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              {word?.imageUri ? (
                <Image
                  source={{ uri: word.imageUri }}
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

          <View style={[styles.voiceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <ButtonFeedback
              activeOpacity={0.88}
              onPress={handleTapToSpeak}
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
              Press the microphone and say the word clearly.
            </Text>
          </View>
        </View>

        <ButtonFeedback
          activeOpacity={0.82}
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: theme.cardOutline }]}
        >
          <Ionicons name="arrow-back" size={26} color={theme.headingText} />
        </ButtonFeedback>

        <ButtonFeedback
          activeOpacity={0.9}
          onPress={handleNext}
          style={[styles.nextBtn, { backgroundColor: theme.button }]}
        >
          <Text style={styles.nextText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </ButtonFeedback>
      </View>
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2C5878",
    marginBottom: 26,
    textAlign: "center",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  imageCard: {
    width: "46%",
    alignItems: "center",
  },
  imageFrame: {
    width: 280,
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
  nextText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
