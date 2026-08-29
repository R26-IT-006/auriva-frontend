import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import {
  EntranceItem,
  SelectionCheck,
  selectionElevation,
  selectionSurface,
  selectionTextColor,
  ThemedGradientFill,
} from "./pronunciationDesignKit.js";

const MOUTH_SHAPES = [
  { id: "k", ipa: "/k/", label: "open", variant: "open" },
  { id: "ae", ipa: "/æ/", label: "open wide", variant: "wide" },
  { id: "t", ipa: "/t/", label: "teeth lip", variant: "teeth" },
];

// A drawn mouth shape per phoneme (open / open-wide / teeth-together) rather
// than a generic placeholder — lip/teeth tones stay fixed regardless of
// avatar theme, same as a real mouth never changes color with the outfit.
function MouthShapeGlyph({ variant }) {
  if (variant === "teeth") {
    return (
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Path
          d="M8 32c6 6 16 9 24 9s18-3 24-9c-6-3-16-5-24-5s-18 2-24 5Z"
          fill="#D6716A"
          stroke="#8C3E38"
          strokeWidth={2}
        />
        <Path d="M14 31.5c6 2.5 12 3.5 18 3.5s12-1 18-3.5" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      </Svg>
    );
  }

  const rx = variant === "wide" ? 24 : 17;
  const ry = variant === "wide" ? 17 : 20;
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Ellipse cx={32} cy={32} rx={rx} ry={ry} fill="#5B2A24" stroke="#8C3E38" strokeWidth={2} />
      <Ellipse cx={32} cy={32 - ry * 0.35} rx={rx * 0.82} ry={ry * 0.28} fill="#FFFFFF" opacity={0.92} />
      <Ellipse cx={32} cy={32 + ry * 0.55} rx={rx * 0.6} ry={ry * 0.3} fill="#E7847C" opacity={0.85} />
    </Svg>
  );
}

function MouthShapeIcon({ variant, theme }) {
  return (
    <View style={[styles.mouthIconWrap, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
      <MouthShapeGlyph variant={variant} />
    </View>
  );
}

function MouthCard({ item, index, selected, onPress, theme }) {
  return (
    <EntranceItem index={index} style={selectionElevation(theme, selected, 12)}>
      <ButtonFeedback
        activeOpacity={0.86}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected, checked: selected }}
        accessibilityLabel={`${item.ipa}, ${item.label}`}
        style={[styles.card, selectionSurface(theme, selected)]}
      >
        <SelectionCheck selected={selected} theme={theme} size={24} />

        <MouthShapeIcon variant={item.variant} theme={theme} />
        <Text
          style={[
            styles.ipa,
            { color: selectionTextColor(theme, selected, theme.headingText) },
          ]}
        >
          {item.ipa}
        </Text>
        <Text style={styles.label}>{item.label}</Text>
      </ButtonFeedback>
    </EntranceItem>
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
            {MOUTH_SHAPES.map((item, index) => (
              <MouthCard
                key={item.id}
                item={item}
                index={index}
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
            style={[styles.readyBtnWrap, isCompact && styles.readyBtnCompact]}
          >
            <ThemedGradientFill theme={theme} style={styles.readyBtn}>
              <Text style={styles.readyText}>I&apos;m Ready!</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </ThemedGradientFill>
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
    fontFamily: Layout.fonts.extrabold,
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
    fontFamily: Layout.fonts.extrabold,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  mouthIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...Layout.shadow.sm,
  },
  ipa: {
    fontSize: 28,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    color: Colors.text.muted,
    fontFamily: Layout.fonts.semibold,
    marginTop: 4,
    textTransform: "lowercase",
  },
  readyBtnWrap: {
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
  readyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
    fontFamily: Layout.fonts.extrabold,
  },
});
