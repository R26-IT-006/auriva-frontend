import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, ScrollView, Switch, Image, Modal, Pressable, Animated } from "react-native";
import { ButtonFeedback, playClickSound } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { teacherApi } from "../../../api/teacher";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import { SESSION_CATEGORIES } from "./sessionCategories.js";
import {
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { PronunciationStepIndicator } from "./PronunciationStepIndicator.js";
import { IMAGE_STYLES } from "./wordImageStyles.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { beginTeachingSession } from "./pronunciationSessionLifecycle.js";
import {
  PronunciationAlert,
  usePronunciationAlert,
} from "./PronunciationAlert.js";
import {
  EntranceItem,
  SelectionCheck,
} from "./pronunciationDesignKit.js";
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import FlowOverviewModal from "../../../components/common/FlowOverviewModal";
import HeaderPillButton from "../../../components/common/HeaderPillButton";
import { buildPronunciationFlow } from "../../../data/pronunciationFlow";

// "How it works" stages — static, so built once.
const PRONUNCIATION_FLOW = buildPronunciationFlow();

// Grid spacing, as ConceptCategoriesScreen: wider between columns than rows.
const H_PAD = Layout.spacing.xl;
// Space between the two mode boxes, as DialogueLandingScreen's GAP.
const MODE_GAP = 48;

// The category dialog shows the same pictures as Concept Learning's category
// cards (src/data/conceptData.js); Daily Actions has no Concept counterpart,
// so it uses the pronunciation-mode training picture. Only this dialog uses
// these — other pronunciation screens keep sessionCategories.js's own icons.
const DIALOG_CATEGORY_IMAGES = {
  animals: require("../../../../assets/concepts/category-images/Animals.png"),
  classroom: require("../../../../assets/concepts/category-images/Classroom Objects.png"),
  fruits: require("../../../../assets/concepts/category-images/Fruits.png"),
  "daily-actions": require("../../../../assets/pronunciation-mode/training.png"),
};
// Gap between the category cards in the dialog.
const ROW_GAP = 22;

// Shown left to right in this order: Alphabet first, then Words.
const PRONUNCIATION_MODE_OPTIONS = [
  {
    id: PRONUNCIATION_MODES.ALPHABET,
    label: "Alphabet",
    title: "Alphabet Pronunciation",
    subtitle: "Practise spoken letter names one by one",
    iconImage: require("../../../../assets/pronunciation-mode/letters.png"),
    icon: "text-outline",
    panelColor: "#DFF3E2",
  },
  {
    id: PRONUNCIATION_MODES.WORD,
    label: "Words",
    title: "Word Pronunciation",
    subtitle: "Practise full words by category",
    iconImage: require("../../../../assets/pronunciation-mode/words.png"),
    icon: "chatbubble-ellipses-outline",
    panelColor: "#DCEEFE",
  },
];

// Mode box — the same card as DialogueLandingScreen's LevelCard (size, shape,
// picture, title + subtitle, press bounce), plus this module's click sound.
function ModeCard({ item, cardW, cardH, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          playClickSound();
          onPress();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        style={[
          styles.modeCard,
          { width: cardW, height: cardH, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
        ]}
      >
        <Image source={item.iconImage} style={styles.modeCardImage} resizeMode="contain" />
        {/* Just the mode name on the card; the full description stays in the
            accessibility label for screen readers. */}
        <Text style={styles.modeCardLabel} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Concept Learning card (ConceptCategoriesScreen's CategoryCard): rounded
// card on the theme surface, picture over a bold label. The chosen card gets
// a thicker outline in the avatar's button colour plus the kit's check badge,
// so the selection never depends on colour alone.
function CategoryCard({ item, index, selected, onPress, cardWidth, cardHeight, theme }) {
  return (
    <EntranceItem index={index}>
      <ButtonFeedback
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected, checked: selected }}
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        style={[
          styles.card,
          {
            width: cardWidth,
            height: cardHeight,
            backgroundColor: theme.cardSurface,
            borderColor: selected ? theme.button : theme.cardOutline,
          },
          selected && styles.cardSelected,
        ]}
      >
        {item.iconImage ? (
          <Image source={item.iconImage} resizeMode="contain" style={styles.cardImage} />
        ) : (
          <View style={styles.cardIconWrap}>
            <Ionicons name={item.icon} size={Math.round(cardWidth * 0.3)} color={theme.headingText} />
          </View>
        )}
        <Text style={styles.cardLabel} numberOfLines={2}>
          {item.title}
        </Text>

        <SelectionCheck selected={selected} theme={theme} />
      </ButtonFeedback>
    </EntranceItem>
  );
}

export default function PronunciationSessionSetupScreen({ navigation, route }) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const theme = getAvatarTheme(student?.avatar_key);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reduceStimulation, setReduceStimulation] = useState(
    Boolean(student?.reduce_stimulation),
  );
  const [savingSensorySetting, setSavingSensorySetting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const { showAlert, alertProps } = usePronunciationAlert();
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
  const { width, height } = useWindowDimensions();
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
      showAlert(
        "Couldn't save setting",
        error.response?.data?.error || error.message || "Please try again.",
        { tone: "error" },
      );
    } finally {
      setSavingSensorySetting(false);
    }
  }

  // Mode boxes: DialogueLandingScreen's card, a bit smaller — two side by side
  // at 72% of the available half-width, capped at 275, slightly taller than wide.
  const modeCardW = Math.min(((width - Layout.spacing.lg * 2 - MODE_GAP) / 2) * 0.72, 275);
  const modeCardH = modeCardW * 0.95;

  // Category dialog: always a 2×2 grid. Each card is as large as fits —
  // across the screen width, and down the screen height for two rows plus
  // the dialog's title and padding (≈160) — capped at 200. The dialog is then
  // sized to the grid, so it hugs the cards instead of leaving empty space.
  const PICKER_COLUMNS = 2;
  const pickerCardWidth = Math.max(
    0,
    Math.min(
      (width - H_PAD * 2 - Layout.spacing.lg * 2 - ROW_GAP) / PICKER_COLUMNS,
      (height * 0.85 - 160 - ROW_GAP) / (2 * 0.85),
      200,
    ),
  );
  const pickerCardHeight = pickerCardWidth * 0.85;
  // + 4 for the dialog's 2px border on each side (pickerCard borderWidth), or
  // the two cards would no longer fit side by side and would wrap to one column.
  const pickerWidth =
    pickerCardWidth * PICKER_COLUMNS + ROW_GAP * (PICKER_COLUMNS - 1) + Layout.spacing.lg * 2 + 4;

  // No Continue button: choosing Alphabet, or a category for Word, starts the
  // session straight away. Takes the choice as arguments because the state
  // set in the same tap has not re-rendered yet.
  function beginPractice(mode, categoryId = null) {
    // Opens the backend session row that feeds the teacher dashboard's
    // Recent Activity list. Fire-and-forget: the flow must not wait on it.
    beginTeachingSession(activeStudent);

    if (mode === PRONUNCIATION_MODES.ALPHABET) {
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

    if (!categoryId) return;

    startSession({
      student: activeStudent,
      mode,
      category: categoryId,
    });
    navigation.navigate("PronunciationWordSelection", {
      student: activeStudent,
      mode,
      categoryId,
    });
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative floating shapes — same treatment as ConceptCategoriesScreen */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

    <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
      {/* ── Header — same layout as ConceptCategoriesScreen ─────────── */}
      {/* Top bar: back | title | header pills — equal-width side groups keep
          the title centred, same layout as the other module headers. */}
      <View style={styles.topBar}>
        <View style={styles.sideGroup}>
          <ButtonFeedback
            style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.7)" }, BACK_BUTTON]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </ButtonFeedback>
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
            <Ionicons name="mic" size={18} color="#FFF" />
          </View>
          <Text style={[styles.title, { color: theme.headingText }]}>Pronunciation Module</Text>
        </View>

        <View style={[styles.sideGroup, styles.topBtnGroup]}>
          {/* "How it works" — teacher-facing flow overview (FlowOverviewModal).
              Uses ButtonFeedback so it keeps this module's click sound. */}
          <HeaderPillButton
            as={ButtonFeedback}
            variant="outline"
            icon="map"
            label="How it works"
            theme={theme}
            onPress={() => setShowFlow(true)}
          />

          {/* Teacher settings live behind this button, out of the child's way.
              Same round header button as Back. */}
          <ButtonFeedback
            style={[styles.iconBtn, BACK_BUTTON]}
            onPress={() => setSettingsOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Teacher settings"
          >
            <Ionicons name="settings-outline" size={BACK_ICON_SIZE} color={theme.headingText} />
          </ButtonFeedback>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: theme.headingText }]}>
        Choose a mode to begin
      </Text>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: H_PAD }]}
        showsVerticalScrollIndicator={false}
      >
        <PronunciationStepIndicator currentStep={2} theme={theme} />

        {/* ── Mode ─────────────────────────────────────────────────────── */}
        <View style={[styles.cardsRow, styles.modeRow, { gap: MODE_GAP }]}>
          {PRONUNCIATION_MODE_OPTIONS.map((item) => (
            <ModeCard
              key={item.id}
              item={item}
              onPress={() => {
                setSelectedModeInSession(item.id);
                if (item.id === PRONUNCIATION_MODES.ALPHABET) {
                  setSelectedCategory(null);
                  setSelectedCategoryInSession(null);
                  // Alphabet needs no further choice — go straight in.
                  beginPractice(PRONUNCIATION_MODES.ALPHABET);
                } else {
                  // Word mode needs a category: ask for it in a dialog; picking
                  // one there goes straight to that category's word list.
                  setCategoryPickerOpen(true);
                }
              }}
              cardW={modeCardW}
              cardH={modeCardH}
              theme={theme}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Category dialog — opened by choosing Word Pronunciation ──── */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryPickerOpen(false)}>
          <Pressable
            style={[styles.pickerCard, { width: pickerWidth, borderColor: theme.cardOutline }]}
            onPress={() => {}}
          >
            <View style={styles.settingsHeader}>
              <Ionicons name="grid-outline" size={18} color={theme.headingText} />
              <Text style={[styles.settingsHeading, { color: theme.headingText }]}>Pick a category</Text>
              <ButtonFeedback
                style={styles.modalClose}
                onPress={() => setCategoryPickerOpen(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close categories"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#8A959C" />
              </ButtonFeedback>
            </View>

            <View style={[styles.cardsRow, styles.pickerGrid, { columnGap: ROW_GAP, rowGap: ROW_GAP }]}>
              {SESSION_CATEGORIES.map((item, index) => (
                <CategoryCard
                  key={item.id}
                  item={{ ...item, iconImage: DIALOG_CATEGORY_IMAGES[item.id] ?? item.iconImage }}
                  index={index}
                  selected={selectedCategory === item.id}
                  onPress={() => {
                    setSelectedCategory(item.id);
                    setSelectedCategoryInSession(item.id);
                    setCategoryPickerOpen(false);
                    beginPractice(PRONUNCIATION_MODES.WORD, item.id);
                  }}
                  cardWidth={pickerCardWidth}
                  cardHeight={pickerCardHeight}
                  theme={theme}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Teacher settings — opened from the ⚙ button in the header ──── */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        {/* Tapping the dimmed backdrop closes it; taps on the card do not. */}
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)}>
        <Pressable style={[styles.settingsCard, { borderColor: theme.cardOutline }]} onPress={() => {}}>
          <View style={styles.settingsHeader}>
            <Ionicons name="settings-outline" size={18} color={theme.headingText} />
            <Text style={[styles.settingsHeading, { color: theme.headingText }]}>Teacher settings</Text>
            <ButtonFeedback
              style={styles.modalClose}
              onPress={() => setSettingsOpen(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#8A959C" />
            </ButtonFeedback>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="pulse-outline" size={20} color={theme.button} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Reduce celebration effects</Text>
              <Text style={styles.settingSubtitle}>
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

          <View style={[styles.settingRow, styles.settingRowDivided, { borderTopColor: theme.cardOutline }]}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="color-palette-outline" size={20} color={theme.button} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Cartoon pictures</Text>
              <Text style={styles.settingSubtitle}>
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

          <ButtonFeedback
            style={[styles.modalDone, { backgroundColor: theme.button }]}
            onPress={() => setSettingsOpen(false)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[styles.modalDoneText, { color: theme.buttonText }]}>Done</Text>
          </ButtonFeedback>
        </Pressable>
        </Pressable>
      </Modal>

      <PronunciationAlert {...alertProps} theme={theme} />
    </SafeAreaView>
      <FlowOverviewModal
        visible={showFlow}
        onClose={() => setShowFlow(false)}
        theme={theme}
        stages={PRONUNCIATION_FLOW}
        subtitle="How the Pronunciation module works"
      />
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
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xl,
    alignItems: "center",
  },

  // ── Decorative background shapes (ConceptCategoriesScreen) ───────────────
  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  // ── Header (ConceptCategoriesScreen) ─────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  // Equal-width side groups keep the title centred (same as the other module headers).
  sideGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  topBtnGroup: {
    justifyContent: "flex-end",
    gap: 10,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 70,
  },
  titleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 34,
    fontFamily: "DMSans_800ExtraBold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "DMSans_600SemiBold",
    opacity: 0.6,
    textAlign: "center",
    marginTop: 2,
    marginBottom: Layout.spacing.sm,
  },

  // Space above the mode boxes, below the step indicator.
  modeRow: {
    marginTop: 80,
  },

  // ── Mode boxes (DialogueLandingScreen card / cardImage / cardLabel / cardSubtitle)
  modeCard: {
    borderRadius: 28,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  modeCardImage: {
    width: "62%",
    height: "50%",
    marginBottom: 16,
  },
  modeCardLabel: {
    fontSize: 24,
    fontFamily: "DMSans_800ExtraBold",
    textAlign: "center",
    color: "#1A1A1A",
  },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  // ── Cards (ConceptCategoriesScreen CategoryCard) ─────────────────────────
  card: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSelected: {
    borderWidth: 3,
  },
  cardImage: {
    width: "70%",
    height: "58%",
    marginBottom: 16,
  },
  cardIconWrap: {
    height: "58%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 16,
    fontFamily: "DMSans_800ExtraBold",
    textAlign: "center",
    lineHeight: 21,
    color: "#1A1A1A",
  },

  // ── Teacher settings modal ───────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.xl,
  },
  settingsCard: {
    width: "100%",
    maxWidth: 560,
    borderWidth: 2,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: Layout.spacing.sm,
    marginBottom: Layout.spacing.xs,
  },
  settingsHeading: {
    flex: 1,
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.extrabold,
  },
  // Category dialog: same white card as the settings dialog, wide enough for
  // a row of category cards (width is set inline from the screen size).
  pickerCard: {
    borderWidth: 2,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 16,
  },
  pickerGrid: {
    marginTop: Layout.spacing.sm,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F5F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDone: {
    alignSelf: "center",
    marginTop: Layout.spacing.md,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0,0,0,0.22)",
  },
  modalDoneText: {
    fontSize: 16,
    fontFamily: "DMSans_800ExtraBold",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
  },
  settingRowDivided: {
    borderTopWidth: 1,
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F5F8",
    alignItems: "center",
    justifyContent: "center",
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
  },
  settingSubtitle: {
    marginTop: 2,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.regular,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
});
