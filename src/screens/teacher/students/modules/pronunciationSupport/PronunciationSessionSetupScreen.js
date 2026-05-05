import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, ScrollView, Alert } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { SESSION_CATEGORIES } from "./sessionCategories.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";

const PRONUNCIATION_MODE_OPTIONS = [
  {
    id: PRONUNCIATION_MODES.WORD,
    title: "Word Pronunciation",
    subtitle: "Practise full words by category",
    icon: "chatbubble-ellipses-outline",
    panelColor: "#DCEEFE",
  },
  {
    id: PRONUNCIATION_MODES.ALPHABET,
    title: "Alphabet Pronunciation",
    subtitle: "Practise letter sounds one by one",
    icon: "text-outline",
    panelColor: "#DFF3E2",
  },
];

function Step({ label, active, done, theme }) {
  return (
    <View style={styles.stepWrap}>
      <View
        style={[
          styles.stepCircle,
          active && { backgroundColor: theme.button, borderColor: theme.button },
          done && { backgroundColor: theme.cardOutline, borderColor: theme.cardOutline },
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

function StepConnector({ theme }) {
  return <View style={[styles.stepConnector, { backgroundColor: theme.cardOutline }]} />;
}

function CategoryCard({ item, selected, onPress, cardWidth, theme }) {
  return (
    <ButtonFeedback
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.categoryCard,
        { width: cardWidth, backgroundColor: theme.cardSurface, borderColor: selected ? theme.button : theme.cardOutline },
        selected && styles.categoryCardSelected,
      ]}
    >
      <View
        style={[styles.categoryVisual, { backgroundColor: item.panelColor }]}
      >
        <Ionicons name={item.icon} size={30} color={Colors.text.primary} />
      </View>
      <View style={styles.categoryBody}>
        <Text style={styles.categoryTitle}>{item.title}</Text>
        <Text style={styles.categorySubtitle} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </View>
    </ButtonFeedback>
  );
}

export default function PronunciationSessionSetupScreen({ navigation, route }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const startSession = usePronunciationSessionStore((state) => state.startSession);
  const setSelectedStudent = usePronunciationSessionStore(
    (state) => state.setSelectedStudent,
  );
  const setSelectedCategoryInSession = usePronunciationSessionStore(
    (state) => state.setSelectedCategory,
  );
  const setSelectedModeInSession = usePronunciationSessionStore(
    (state) => state.setSelectedMode,
  );
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const { width } = useWindowDimensions();

  useEffect(() => {
    setSelectedStudent(student);
    setCurrentActivityStep(PRONUNCIATION_STEPS.SETUP);
  }, [setCurrentActivityStep, setSelectedStudent, student]);

  const cardWidth = useMemo(() => {
    if (width >= 1180) return 220;
    if (width >= 1024) return 200;
    if (width >= 840) return 180;
    return Math.min(260, width - Layout.spacing.lg * 2);
  }, [width]);

  function handleContinue() {
    if (!selectedMode) return;

    if (selectedMode === PRONUNCIATION_MODES.ALPHABET) {
      startSession({
        student,
        mode: PRONUNCIATION_MODES.ALPHABET,
        category: null,
      });
      navigation.navigate("PronunciationWordSelection", {
        student,
        mode: PRONUNCIATION_MODES.ALPHABET,
      });
      return;
    }

    if (!selectedCategory) return;

    if (selectedCategory !== "animals") {
      Alert.alert(
        "Coming Soon",
        "Word selection is currently available for Animals only.",
      );
      return;
    }

    startSession({
      student,
      mode: selectedMode,
      category: selectedCategory,
    });
    navigation.navigate("PronunciationWordSelection", {
      student,
      mode: selectedMode,
      categoryId: selectedCategory,
    });
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe}>
    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ButtonFeedback
            style={[styles.backBtn, { borderColor: theme.cardOutline }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.headingText}
            />
          </ButtonFeedback>

          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.headingText }]}>New Session Setup</Text>
            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Pronunciation Support Module
              {student?.full_name ? ` for ${student.full_name}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.stepsRow}>
          <Step label="1" done theme={theme} />
          <StepConnector theme={theme} />
          <Step label="2" active theme={theme} />
          <StepConnector theme={theme} />
          <Step label="3" theme={theme} />
        </View>

        <View style={[styles.panel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
          <Text style={[styles.panelTitle, { color: theme.headingText }]}>Select Mode</Text>

          <View style={styles.cardsRow}>
            {PRONUNCIATION_MODE_OPTIONS.map((item) => (
              <CategoryCard
                key={item.id}
                item={item}
                selected={selectedMode === item.id}
                onPress={() => {
                  setSelectedMode(item.id);
                  setSelectedModeInSession(item.id);
                  if (item.id === PRONUNCIATION_MODES.ALPHABET) {
                    setSelectedCategory(null);
                    setSelectedCategoryInSession(null);
                  }
                }}
                cardWidth={cardWidth}
                theme={theme}
              />
            ))}
          </View>

          {selectedMode === PRONUNCIATION_MODES.WORD ? (
            <>
              <Text style={[styles.panelTitle, styles.categoryPanelTitle, { color: theme.headingText }]}>
                Select Category
              </Text>

              <View style={styles.cardsRow}>
                {SESSION_CATEGORIES.map((item) => (
                  <CategoryCard
                    key={item.id}
                    item={item}
                    selected={selectedCategory === item.id}
                    onPress={() => {
                      setSelectedCategory(item.id);
                      setSelectedCategoryInSession(item.id);
                    }}
                    cardWidth={cardWidth}
                    theme={theme}
                  />
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.panelFooter}>
            <Text style={[styles.selectionText, { color: theme.headingText }]}>
              {selectedMode === PRONUNCIATION_MODES.ALPHABET
                ? "Selected: Alphabet Pronunciation"
                : selectedCategory
                  ? `Selected: ${SESSION_CATEGORIES.find((c) => c.id === selectedCategory)?.title}`
                  : selectedMode
                    ? "Choose one category to continue to word selection"
                    : "Choose word or alphabet pronunciation to continue"}
            </Text>
            <ButtonFeedback
              activeOpacity={0.85}
              style={[
                styles.continueBtn,
                { backgroundColor: theme.button },
                (!selectedMode ||
                  (selectedMode === PRONUNCIATION_MODES.WORD && !selectedCategory)) &&
                  styles.continueBtnDisabled,
              ]}
              disabled={
                !selectedMode ||
                (selectedMode === PRONUNCIATION_MODES.WORD && !selectedCategory)
              }
              onPress={handleContinue}
            >
              <Text style={styles.continueText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </ButtonFeedback>
          </View>
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
  panelTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.text.primary,
    marginBottom: Layout.spacing.md,
  },
  categoryPanelTitle: {
    marginTop: Layout.spacing.xl,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  categoryCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6ECF4",
    backgroundColor: Colors.surface,
  },
  categoryCardSelected: {
    borderWidth: 2,
  },
  categoryVisual: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 76,
  },
  categoryTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  categorySubtitle: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  panelFooter: {
    marginTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#E8EDF3",
    paddingTop: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
  },
  selectionText: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  continueBtnDisabled: {
    backgroundColor: "#AAB8CB",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
  },
});
