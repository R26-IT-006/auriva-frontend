import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, ScrollView, Alert, Switch, Image } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { getAvatarTheme } from "../../../../../constants/avatarThemes";
import { SESSION_CATEGORIES } from "./sessionCategories.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { PronunciationStepIndicator } from "./PronunciationStepIndicator.js";
import { IMAGE_STYLES } from "./wordImageStyles.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { AvatarIdentityBadge, EntranceItem, ThemedGradientFill } from "./pronunciationDesignKit.js";

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
    subtitle: "Practise spoken letter names one by one",
    icon: "text-outline",
    panelColor: "#DFF3E2",
  },
];

function CategoryCard({ item, index, selected, onPress, cardWidth, theme }) {
  return (
    <EntranceItem index={index}>
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
          {item.iconImage ? (
            <Image source={item.iconImage} resizeMode="contain" style={styles.categoryIconImage} />
          ) : (
            <Ionicons name={item.icon} size={30} color={Colors.text.primary} />
          )}
        </View>
        <View style={styles.categoryBody}>
          <Text style={styles.categoryTitle}>{item.title}</Text>
          <Text style={styles.categorySubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>
      </ButtonFeedback>
    </EntranceItem>
  );
}

export default function PronunciationSessionSetupScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const theme = getAvatarTheme(student?.avatar_key);
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reduceStimulation, setReduceStimulation] = useState(
    Boolean(student?.reduce_stimulation),
  );
  const [savingSensorySetting, setSavingSensorySetting] = useState(false);
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
  const imageStyle = usePronunciationSessionStore((state) => state.imageStyle);
  const loadImageStyle = usePronunciationSessionStore((state) => state.loadImageStyle);
  const setImageStyle = usePronunciationSessionStore((state) => state.setImageStyle);
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  // Downstream screens read `student` from navigation params, not the store,
  // so a sensory-setting change made on this screen has to travel forward
  // through that same object — otherwise the celebration screen at the end
  // of the session would still see the stale pre-toggle value.
  const activeStudent = useMemo(
    () => (student ? { ...student, reduce_stimulation: reduceStimulation } : student),
    [student, reduceStimulation],
  );

  useEffect(() => {
    setSelectedStudent(activeStudent);
    setCurrentActivityStep(PRONUNCIATION_STEPS.SETUP);
  }, [activeStudent, setCurrentActivityStep, setSelectedStudent]);

  // Picture style is remembered per student on this device, so the teacher
  // sets it once and every later session for that child starts the same way.
  useEffect(() => {
    loadImageStyle(studentId);
  }, [loadImageStyle, studentId]);

  async function handleToggleReduceStimulation(value) {
    if (!studentId || savingSensorySetting) return;

    const previous = reduceStimulation;
    setReduceStimulation(value);
    setSavingSensorySetting(true);

    try {
      await teacherApi.setSensorySettings(studentId, value);
    } catch (error) {
      setReduceStimulation(previous);
      Alert.alert(
        "Couldn't save setting",
        error.response?.data?.error || error.message || "Please try again.",
      );
    } finally {
      setSavingSensorySetting(false);
    }
  }

  const cardWidth = useMemo(() => {
    if (width < 560) return width - Layout.spacing.lg * 2;
    if (width >= 1180) return 220;
    if (width >= 1024) return 200;
    if (width >= 840) return 180;
    return Math.min(260, (width - Layout.spacing.lg * 2 - Layout.spacing.sm) / 2);
  }, [width]);

  function handleContinue() {
    if (!selectedMode) return;

    if (selectedMode === PRONUNCIATION_MODES.ALPHABET) {
      startSession({
        student: activeStudent,
        mode: PRONUNCIATION_MODES.ALPHABET,
        category: null,
      });
      navigation.navigate("PronunciationWordSelection", {
        student: activeStudent,
        mode: PRONUNCIATION_MODES.ALPHABET,
      });
      return;
    }

    if (!selectedCategory) return;

    startSession({
      student: activeStudent,
      mode: selectedMode,
      category: selectedCategory,
    });
    navigation.navigate("PronunciationWordSelection", {
      student: activeStudent,
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

          <AvatarIdentityBadge avatarKey={student?.avatar_key} theme={theme} size={44} style={styles.headerAvatar} />
        </View>

        <PronunciationStepIndicator currentStep={2} theme={theme} />

        <View style={[styles.panel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
          <Text style={[styles.panelTitle, { color: theme.headingText }]}>Select Mode</Text>

          <View style={styles.cardsRow}>
            {PRONUNCIATION_MODE_OPTIONS.map((item, index) => (
              <CategoryCard
                key={item.id}
                item={item}
                index={index}
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
                {SESSION_CATEGORIES.map((item, index) => (
                  <CategoryCard
                    key={item.id}
                    item={item}
                    index={index}
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

          <View style={[styles.sensoryRow, { borderColor: theme.cardOutline }]}>
            <View style={styles.sensoryIconWrap}>
              <Ionicons name="pulse-outline" size={20} color={theme.button} />
            </View>
            <View style={styles.sensoryCopy}>
              <Text style={styles.sensoryTitle}>Reduce celebration effects</Text>
              <Text style={styles.sensorySubtitle}>
                Turns off confetti, vibration, and triumphant sounds after a strong score —
                keeps praise calm and text-based instead.
              </Text>
            </View>
            <Switch
              value={reduceStimulation}
              onValueChange={handleToggleReduceStimulation}
              disabled={savingSensorySetting}
              trackColor={{ true: theme.button }}
            />
          </View>

          <View style={[styles.sensoryRow, styles.pictureStyleRow, { borderColor: theme.cardOutline }]}>
            <View style={styles.sensoryIconWrap}>
              <Ionicons name="color-palette-outline" size={20} color={theme.button} />
            </View>
            <View style={styles.sensoryCopy}>
              <Text style={styles.sensoryTitle}>Cartoon pictures</Text>
              <Text style={styles.sensorySubtitle}>
                Swaps the photo on every word card for a simple cartoon drawing — easier to read
                for a child who finds busy photos hard to follow. Words with no cartoon keep
                their photo.
              </Text>
            </View>
            <Switch
              value={imageStyle === IMAGE_STYLES.CARTOON}
              onValueChange={(value) =>
                setImageStyle(value ? IMAGE_STYLES.CARTOON : IMAGE_STYLES.REAL, studentId)
              }
              trackColor={{ true: theme.button }}
            />
          </View>

          <View style={[styles.panelFooter, isCompact && styles.panelFooterCompact]}>
            <Text style={[styles.selectionText, { color: theme.headingText }]}>
              {selectedMode === PRONUNCIATION_MODES.ALPHABET
                ? "Selected: Alphabet Pronunciation"
                : selectedCategory
                  ? `Selected: ${SESSION_CATEGORIES.find((c) => c.id === selectedCategory)?.title}`
                  : selectedMode
                    ? "Choose one category to continue"
                    : "Choose word or alphabet pronunciation to continue"}
            </Text>
            <ButtonFeedback
              activeOpacity={0.85}
              style={[
                styles.continueBtnWrap,
                isCompact && styles.continueBtnCompact,
              ]}
              disabled={
                !selectedMode ||
                (selectedMode === PRONUNCIATION_MODES.WORD && !selectedCategory)
              }
              onPress={handleContinue}
            >
              {!selectedMode ||
              (selectedMode === PRONUNCIATION_MODES.WORD && !selectedCategory) ? (
                <View style={[styles.continueBtn, styles.continueBtnDisabled]}>
                  <Text style={styles.continueText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
              ) : (
                <ThemedGradientFill theme={theme} style={styles.continueBtn}>
                  <Text style={styles.continueText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </ThemedGradientFill>
              )}
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
    alignItems: "center",
  },
  headerRow: {
    width: "100%",
    maxWidth: 1040,
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
  headerAvatar: {
    marginTop: 2,
  },
  title: {
    fontSize: Layout.fontSize.xxxl,
    color: Colors.text.primary,
    fontFamily: Layout.fonts.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    fontFamily: Layout.fonts.semibold,
  },
  panel: {
    width: "100%",
    maxWidth: 1040,
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
    fontFamily: Layout.fonts.extrabold,
    color: Colors.text.primary,
    marginBottom: Layout.spacing.md,
  },
  categoryPanelTitle: {
    marginTop: Layout.spacing.xl,
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: Layout.spacing.sm,
  },
  categoryCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6ECF4",
    backgroundColor: Colors.surface,
    minHeight: 172,
  },
  categoryCardSelected: {
    borderWidth: 2,
  },
  categoryVisual: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconImage: {
    width: 64,
    height: 64,
  },
  categoryBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 76,
  },
  categoryTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
  },
  categorySubtitle: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  sensoryRow: {
    marginTop: Layout.spacing.xl,
    borderWidth: 1,
    borderRadius: 16,
    padding: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  pictureStyleRow: {
    marginTop: Layout.spacing.sm,
  },
  sensoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F5F8",
    alignItems: "center",
    justifyContent: "center",
  },
  sensoryCopy: {
    flex: 1,
  },
  sensoryTitle: {
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
  },
  sensorySubtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
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
  panelFooterCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  selectionText: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
  },
  continueBtnWrap: {
    borderRadius: 10,
    overflow: "hidden",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  continueBtnCompact: {
    justifyContent: "center",
  },
  continueBtnDisabled: {
    backgroundColor: "#AAB8CB",
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
  },
});
