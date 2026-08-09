import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { SESSION_CATEGORIES } from "./sessionCategories.js";
import { WORD_BANK } from "./wordBank.js";

function Step({ label, active, done }) {
  return (
    <View style={styles.stepWrap}>
      <View
        style={[
          styles.stepCircle,
          active && styles.stepCircleActive,
          done && styles.stepCircleDone,
        ]}
      >
        {done ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : (
          <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

function StepConnector() {
  return <View style={styles.stepConnector} />;
}

function PhonemeDots({ count = 5 }) {
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    dots.push(<View key={i} style={styles.dot} />);
  }
  return <View style={styles.dotRow}>{dots}</View>;
}

function WordCard({ item, selected, onPress, width }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.wordCard, { width }, selected && styles.wordCardSelected]}
    >
      <View style={[styles.wordVisual, { backgroundColor: item.color }]}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            resizeMode="cover"
            style={styles.wordImage}
          />
        ) : (
          <Ionicons name="image-outline" size={28} color="#7B8798" />
        )}
      </View>
      <View style={styles.wordMeta}>
        <Text style={styles.wordText}>{item.word}</Text>
        <PhonemeDots count={item.phonemeCount} />
      </View>
    </TouchableOpacity>
  );
}

export default function PronunciationWordSelectionScreen({
  navigation,
  route,
}) {
  const student = route.params?.student;
  const categoryId = route.params?.categoryId;
  const [selectedWord, setSelectedWord] = useState(null);
  const { width } = useWindowDimensions();

  const category = SESSION_CATEGORIES.find((c) => c.id === categoryId);
  const words = WORD_BANK[categoryId] || [];

  const cardWidth = useMemo(() => {
    if (width >= 1180) return 186;
    if (width >= 980) return 170;
    if (width >= 840) return 160;
    return Math.min(240, width - Layout.spacing.lg * 2);
  }, [width]);

  function handleStartSession() {
    if (!selectedWord) return;
    navigation.navigate("PronunciationLearnWord", {
      student,
      categoryId,
      wordId: selectedWord.id,
      word: selectedWord,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.82}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.text.primary}
            />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>New Session Setup</Text>
            <Text style={styles.subtitle}>
              Configure the learning environment
            </Text>
          </View>
        </View>

        <View style={styles.stepsRow}>
          <Step label="1" done />
          <StepConnector />
          <Step label="2" done />
          <StepConnector />
          <Step label="3" active />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelTopRow}>
            <Text style={styles.panelTitle}>Select Starting Word</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleStartSession}
              disabled={!selectedWord}
              style={[
                styles.startBtn,
                !selectedWord && styles.startBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.startBtnText,
                  !selectedWord && styles.startBtnTextDisabled,
                ]}
              >
                Start Session
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.contextText}>
            {category ? `${category.title} category` : "Selected category"}
          </Text>

          <View style={styles.wordGrid}>
            {words.map((item) => (
              <WordCard
                key={item.id}
                item={item}
                width={cardWidth}
                selected={selectedWord?.id === item.id}
                onPress={() => setSelectedWord(item)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#DCE9F5",
  },
  scroll: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Layout.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#7E93AE",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.32)",
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: Layout.fontSize.xxxl,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
  },
  stepsRow: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#98A8BC",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepCircleDone: {
    backgroundColor: "#4F9CCC",
    borderColor: "#4F9CCC",
  },
  stepNumber: {
    fontSize: Layout.fontSize.xs,
    color: "#6E7D92",
    fontWeight: Layout.fontWeight.bold,
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepConnector: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#6DA5C8",
    marginHorizontal: 8,
  },
  panel: {
    marginTop: Layout.spacing.lg,
    backgroundColor: "#F7F8FA",
    borderRadius: 22,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    minHeight: 420,
  },
  panelTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
  },
  panelTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.text.primary,
    flexShrink: 1,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnDisabled: {
    backgroundColor: "#DFE5ED",
  },
  startBtnText: {
    fontSize: Layout.fontSize.sm,
    color: "#FFFFFF",
    fontWeight: Layout.fontWeight.bold,
  },
  startBtnTextDisabled: {
    color: "#90A0B5",
  },
  contextText: {
    marginTop: 6,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
    marginBottom: Layout.spacing.sm,
  },
  wordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  wordCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#B8C4D6",
    backgroundColor: Colors.surface,
  },
  wordCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  wordVisual: {
    height: 165,
    alignItems: "center",
    justifyContent: "center",
  },
  wordImage: {
    width: "100%",
    height: "100%",
  },
  wordMeta: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderTopWidth: 2,
    borderTopColor: "#4F607A",
    alignItems: "center",
    justifyContent: "center",
  },
  wordText: {
    fontSize: 31,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "lowercase",
    lineHeight: 36,
  },
  dotRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#4C5E79",
    backgroundColor: "#DCE7F8",
  },
});
