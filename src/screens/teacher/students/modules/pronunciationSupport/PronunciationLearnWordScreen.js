import React from "react";
import { View, Text, StyleSheet, useWindowDimensions, Image, Alert, Linking } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { WORD_BANK } from "./wordBank.js";

export default function PronunciationLearnWordScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryId = route.params?.categoryId;
  const selectedWordId = route.params?.wordId;
  const { width } = useWindowDimensions();

  const words = WORD_BANK[categoryId] || [];
  const selectedWord =
    words.find((word) => word.id === selectedWordId) || route.params?.word;
  const [isPlaying, setIsPlaying] = React.useState(false);

  const cardWidth = Math.min(Math.max(width * 0.56, 640), 980);
  const sounds = selectedWord?.sounds || [];

  function handleNext() {
    navigation.navigate("PronunciationMouthShape", {
      student,
      categoryId,
      wordId: selectedWord?.id,
      word: selectedWord,
    });
  }

  function handleHearSounds() {
    setIsPlaying(true);
    const label = selectedWord?.word || "word";
    setTimeout(() => setIsPlaying(false), 900);
    Alert.alert("Hear Sounds", `Practise the sounds for ${label}.`);
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.centerStage}>
          <Text style={[styles.headline, { color: theme.headingText }]}>Listen to the sounds</Text>

          <View style={[styles.wordCard, { width: cardWidth, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
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
            </View>

            <View style={styles.imagePane}>
              {selectedWord?.imageUri ? (
                <Image
                  source={{ uri: selectedWord.imageUri }}
                  resizeMode="cover"
                  style={styles.wordImage}
                />
              ) : (
                <View style={[styles.wordImage, styles.placeholderPane]}>
                  <Ionicons name="image-outline" size={42} color="#76839A" />
                </View>
              )}
            </View>
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.lg,
  },
  centerStage: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -40,
  },
  headline: {
    fontSize: 46,
    fontWeight: "800",
    color: "#1F4C66",
    letterSpacing: -0.6,
    marginBottom: 26,
    textAlign: "center",
  },
  wordCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7E1EC",
    padding: 16,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
  },
  soundStage: {
    width: "100%",
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
  imagePane: {
    width: "34%",
    minHeight: 280,
  },
  wordImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  placeholderPane: {
    backgroundColor: "#E8EDF4",
    alignItems: "center",
    justifyContent: "center",
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
  nextText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
  },
});
