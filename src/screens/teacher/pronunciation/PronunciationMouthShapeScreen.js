import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";

const MOUTH_SHAPES = [
  { id: "k", ipa: "/k/", label: "open", icon: "ellipse-outline" },
  { id: "ae", ipa: "/æ/", label: "open", icon: "ellipse-outline" },
  { id: "t", ipa: "/t/", label: "teeth lip", icon: "ellipse-outline" },
];

function MouthShapeIcon({ index, theme }) {
  const variant = index === 2 ? styles.mouthTeeth : styles.mouthOpen;
  return (
    <View style={styles.mouthIconWrap}>
      <View style={[styles.mouthIconOuter, { borderColor: theme.cardOutline }, variant]}>
        <View style={styles.mouthIconInner} />
      </View>
    </View>
  );
}

function MouthCard({ item, selected, onPress, theme }) {
  return (
    <ButtonFeedback
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.cardSurface, borderColor: selected ? theme.button : theme.cardOutline },
        selected && styles.cardSelected,
      ]}
    >
      <MouthShapeIcon index={item.id === "t" ? 2 : item.id === "ae" ? 1 : 0} theme={theme} />
      <Text style={[styles.ipa, { color: theme.headingText }]}>{item.ipa}</Text>
      <Text style={styles.label}>{item.label}</Text>
    </ButtonFeedback>
  );
}

export default function PronunciationMouthShapeScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryId = route.params?.categoryId;
  const word = route.params?.word;
  const [selectedId, setSelectedId] = useState("ae");
  const { width } = useWindowDimensions();
  const isCompact = width < 720;

  const selectedItem = useMemo(
    () => MOUTH_SHAPES.find((item) => item.id === selectedId),
    [selectedId],
  );

  function handleReady() {
    navigation.navigate("PronunciationSpeakWord", {
      student,
      categoryId,
      selectedMouthShape: selectedItem,
      word,
    });
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <ButtonFeedback
          activeOpacity={0.82}
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isCompact && styles.backBtnCompact, { borderColor: theme.cardOutline }]}
        >
          <Ionicons name="arrow-back" size={26} color={theme.headingText} />
        </ButtonFeedback>

        <View style={[styles.centerWrap, isCompact && styles.centerWrapCompact]}>
          <Text style={[styles.title, isCompact && styles.titleCompact, { color: theme.headingText }]}>Watch the mouth shapes</Text>
          <Text style={[styles.titleSinhala, isCompact && styles.titleSinhalaCompact, { color: theme.headingText }]}>
            මුඛ හැඩ බලන්න
          </Text>

          <View style={styles.cardsRow}>
            {MOUTH_SHAPES.map((item) => (
              <MouthCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onPress={() => setSelectedId(item.id)}
                theme={theme}
              />
            ))}
          </View>
        </View>

        <View
          pointerEvents={isCompact ? "auto" : "box-none"}
          style={isCompact ? styles.actionsRow : styles.actionsOverlay}
        >
          <ButtonFeedback
            activeOpacity={0.9}
            onPress={handleReady}
            style={[styles.readyBtn, isCompact && styles.readyBtnCompact, { backgroundColor: theme.button }]}
          >
            <Text style={styles.readyText}>I&apos;m Ready!</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </ButtonFeedback>
        </View>
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
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
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
    left: Layout.spacing.lg,
    top: Layout.spacing.lg,
    marginTop: 0,
  },
  centerWrap: {
    width: "100%",
    maxWidth: 620,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
  },
  centerWrapCompact: {
    marginTop: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    color: "#2C5878",
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  titleSinhala: {
    fontSize: 23,
    lineHeight: 30,
    color: "#2C5878",
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.82,
  },
  titleSinhalaCompact: {
    fontSize: 21,
    lineHeight: 28,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  card: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "#E4EAF1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  cardSelected: {
    borderWidth: 2,
  },
  mouthIconWrap: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mouthIconOuter: {
    width: 44,
    height: 28,
    borderWidth: 2,
    borderColor: "#7EB1E0",
    borderRadius: 22,
    backgroundColor: "#F5C0B6",
    alignItems: "center",
    justifyContent: "center",
  },
  mouthIconInner: {
    width: 28,
    height: 12,
    borderRadius: 10,
    backgroundColor: "#373D4A",
  },
  mouthOpen: {
    transform: [{ scaleX: 1.08 }],
  },
  mouthTeeth: {
    width: 46,
    height: 26,
    borderRadius: 18,
  },
  ipa: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text.primary,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 4,
    textTransform: "lowercase",
  },
  readyBtn: {
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
  readyBtnCompact: {
    position: "relative",
    right: 0,
    top: 0,
    marginTop: 0,
    width: "100%",
  },
  actionsOverlay: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  actionsRow: {
    width: "100%",
    maxWidth: 360,
    marginTop: Layout.spacing.lg,
  },
  readyText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
