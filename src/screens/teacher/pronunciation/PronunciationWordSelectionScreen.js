import React, { useCallback, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Image, Pressable, Animated } from "react-native";
import { ButtonFeedback, playClickSound } from "../../../components/common/ButtonFeedback";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { teacherApi } from "../../../api/teacher";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import { SESSION_CATEGORIES } from "./sessionCategories.js";
import { getWordImageSource, WORD_BANK } from "./wordBank.js";
import {
  ALPHABET_BANK,
  PRONUNCIATION_MODES,
  PRONUNCIATION_STEPS,
  usePronunciationSessionStore,
} from "./pronunciationSessionStore.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { IMAGE_STYLES } from "./wordImageStyles.js";
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../constants/backButton';
import { rs, rf } from '../../../utils/responsive';

// Alphabet page spacing: side padding and the gap between letter tiles.
const ALPHA_PAD = Layout.spacing.xl;
const ALPHA_GAP = rs(16);
// Gap between the word picture cards.
const WORD_GAP = rs(20);

// Alphabet mode: one big pastel tile per letter (the letter's own colour from
// ALPHABET_BANK). Same press bounce as the Concept/Dialogue cards, plus this
// module's click sound. Tapping starts the session from that letter.
function LetterTile({ item, size, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          playClickSound();
          onPress(item);
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`Letter ${item.letter}${item.completed ? ", completed" : ""}`}
        style={[
          styles.letterTile,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.22),
            backgroundColor: item.color,
            borderColor: theme.cardOutline,
          },
        ]}
      >
        <Text style={[styles.letterTileText, { fontSize: Math.round(size * 0.5) }]}>
          {item.letter}
        </Text>
        {item.completed ? (
          <View style={styles.letterDoneBadge}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// "ice cream" -> "Ice Cream". Only the first letter of each space-separated
// part changes, so words like "don't" are left intact.
function capitalizeWords(text) {
  if (!text) return text;
  return String(text)
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// Word mode: a picture card per word (photo, or cartoon when the teacher has
// switched pictures to cartoons), the word underneath — the Concept category
// card style. Same press bounce and click sound as LetterTile; tapping starts
// the session with that word.
function WordPictureCard({ item, size, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const imageStyle = usePronunciationSessionStore((state) => state.imageStyle);
  const imageSource = getWordImageSource(item, imageStyle);
  // Photos fill their frame; cartoon drawings are shown whole.
  const isCartoon = imageStyle === IMAGE_STYLES.CARTOON;

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
          onPress(item);
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`${item.word}${item.completed ? ", completed" : ""}`}
        style={[
          styles.wordPicCard,
          { width: size, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
        ]}
      >
        <View style={[styles.wordPicFrame, { height: size * 0.72, backgroundColor: item.color || "#F3F5F8" }]}>
          {imageSource ? (
            <Image
              source={imageSource}
              resizeMode={isCartoon ? "contain" : "cover"}
              style={styles.wordPicImage}
            />
          ) : (
            <Ionicons name="image-outline" size={Math.round(size * 0.25)} color="#7B8798" />
          )}
        </View>
        {/* Capitalised in code, not with textTransform — Android measures
            before transforming, which clips the last letter ("Fis"). */}
        <Text style={styles.wordPicLabel} numberOfLines={1} adjustsFontSizeToFit>
          {capitalizeWords(item.word)}
        </Text>
        {item.completed ? (
          <View style={styles.letterDoneBadge}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export default function PronunciationWordSelectionScreen({
  navigation,
  route,
}) {
  const student = route.params?.student;
  const studentId = getStudentIdentifier(student);
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryId = route.params?.categoryId;
  const mode = route.params?.mode || PRONUNCIATION_MODES.WORD;
  const isAlphabetMode = mode === PRONUNCIATION_MODES.ALPHABET;
  const setSelectedWordInSession = usePronunciationSessionStore(
    (state) => state.setSelectedWord,
  );
  const setCurrentActivityStep = usePronunciationSessionStore(
    (state) => state.setCurrentActivityStep,
  );
  const [completedIds, setCompletedIds] = useState(() => new Set());
  // "More words" (Animals) starts collapsed.
  const [moreOpen, setMoreOpen] = useState(false);
  const imageStyle = usePronunciationSessionStore((state) => state.imageStyle);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    setCurrentActivityStep(PRONUNCIATION_STEPS.WORD_SELECTION);
  }, [setCurrentActivityStep]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadCompletedItems() {
        if (!studentId) {
          setCompletedIds(new Set());
          return;
        }

        try {
          // Completion badges span the whole available recent history; the
          // four-item default is only appropriate for the history display.
          const results = await teacherApi.getPronunciationResults(studentId, 50);
          if (!isMounted) return;

          const nextCompletedIds = new Set(
            results
              .filter((result) => {
                if (!result.workflow_completed) return false;
                if (result.mode !== mode) return false;
                if (isAlphabetMode) return true;
                return result.category_id === categoryId;
              })
              .map((result) => result.word_id),
          );
          setCompletedIds(nextCompletedIds);
        } catch {
          if (isMounted) setCompletedIds(new Set());
        }
      }

      loadCompletedItems();

      return () => {
        isMounted = false;
      };
    }, [categoryId, isAlphabetMode, mode, studentId]),
  );

  const category = SESSION_CATEGORIES.find((c) => c.id === categoryId);
  const words = (isAlphabetMode ? ALPHABET_BANK : WORD_BANK[categoryId] || []).map((item) => ({
    ...item,
    completed: completedIds.has(item.id),
  }));
  const extraAnimalWords = (isAlphabetMode || categoryId !== "animals" ? [] : WORD_BANK.moreAnimals || []).map((item) => ({
    ...item,
    completed: completedIds.has(item.id),
  }));

  // Word mode: words with no picture (no photo, and no cartoon when cartoons
  // are on) go to the collapsible "More words" section instead of the main
  // grid, ahead of the Animals extra list. Uses the same lookup as the cards.
  const hasPicture = (item) => Boolean(getWordImageSource(item, imageStyle));
  const mainWords = isAlphabetMode ? words : words.filter(hasPicture);
  const moreWords = isAlphabetMode
    ? []
    : [...words.filter((item) => !hasPicture(item)), ...extraAnimalWords];

// Tapping a letter / word starts straight away (no separate Start button):
  // remember it as the selected item and open its Listen step.
  const startFromItem = (item) => {
    setSelectedWordInSession(item);
    navigation.navigate("PronunciationLearnWord", {
      student,
      mode,
      categoryId,
      wordId: item.id,
      word: item,
    });
  };

  // ── Alphabet mode: Concept-style page, letters as a tile grid ──────────────
  if (isAlphabetMode) {

    // 7 tiles per row in landscape (26 letters → 7/7/7/5), 5 in portrait.
    // A tile is as big as fits across the width and — for the rows below the
    // header and the grid's top margin (~320) — down the height, capped at 130.
    const columns = width > height ? 7 : 5;
    const rows = Math.ceil(words.length / columns);
    const tileSize = Math.max(
      48,
      Math.min(
        (width - ALPHA_PAD * 2 - ALPHA_GAP * (columns - 1)) / columns,
        (height - 320 - ALPHA_GAP * (rows - 1)) / rows,
        130,
      ),
    );

    return (
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.safe}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View pointerEvents="none" style={[styles.alphaBlob, styles.alphaBlobTopRight, { backgroundColor: theme.cardOutline }]} />
        <View pointerEvents="none" style={[styles.alphaBlob, styles.alphaBlobBottomLeft, { backgroundColor: theme.cardOutline }]} />

        <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
          {/* Header — same as the Pronunciation setup / Concept screens */}
          <View style={styles.alphaTopBar}>
            <ButtonFeedback
              style={[styles.alphaIconBtn, { backgroundColor: "rgba(255,255,255,0.7)" }, BACK_BUTTON]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
            </ButtonFeedback>

            <View style={styles.alphaTitleRow}>
              <View style={[styles.alphaTitleIconCircle, { backgroundColor: theme.cardOutline }]}>
                <Ionicons name="text" size={18} color="#FFF" />
              </View>
              <Text style={[styles.alphaTitle, { color: theme.headingText }]}>Alphabet</Text>
            </View>

            {/* Keeps the title centred, as Concept's empty right-hand slot. */}
            <View style={styles.alphaIconBtnSpacer} />
          </View>

          <Text style={[styles.alphaSubtitle, { color: theme.headingText }]}>
            Pick a letter to start
          </Text>

          <ScrollView
            contentContainerStyle={[styles.alphaScroll, { paddingHorizontal: ALPHA_PAD }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.alphaGrid, { gap: ALPHA_GAP }]}>
              {words.map((item) => (
                <LetterTile
                  key={item.id}
                  item={item}
                  size={tileSize}
                  theme={theme}
                  onPress={startFromItem}
                />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Word mode: same Concept-style page, words as picture cards ─────────────
  // 5 cards per row in landscape, 3 in portrait; each as big as fits, capped.
  const wordColumns = width > height ? 5 : 3;
  const wordCardSize = Math.max(
    100,
    Math.min((width - ALPHA_PAD * 2 - WORD_GAP * (wordColumns - 1)) / wordColumns, 230),
  );

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View pointerEvents="none" style={[styles.alphaBlob, styles.alphaBlobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.alphaBlob, styles.alphaBlobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safeInner} edges={["top", "bottom"]}>
        {/* Header — same as the alphabet page: category name as the title */}
        <View style={styles.alphaTopBar}>
          <ButtonFeedback
            style={[styles.alphaIconBtn, { backgroundColor: "rgba(255,255,255,0.7)" }, BACK_BUTTON]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </ButtonFeedback>

          <View style={styles.alphaTitleRow}>
            <View style={[styles.alphaTitleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name={category?.icon?.replace(/-outline$/, "") || "chatbubble-ellipses"} size={18} color="#FFF" />
            </View>
            <Text style={[styles.alphaTitle, { color: theme.headingText }]}>
              {category?.title || "Words"}
            </Text>
          </View>

          <View style={styles.alphaIconBtnSpacer} />
        </View>

        <Text style={[styles.alphaSubtitle, { color: theme.headingText }]}>
          Pick a word to start
        </Text>

        <ScrollView
          contentContainerStyle={[styles.alphaScroll, { paddingHorizontal: ALPHA_PAD }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.wordPicGrid, { gap: WORD_GAP }]}>
            {mainWords.map((item) => (
              <WordPictureCard
                key={item.id}
                item={item}
                size={wordCardSize}
                theme={theme}
                onPress={startFromItem}
              />
            ))}
          </View>

          {/* "More words": this category's words without a picture, plus the
              Animals extra list — a collapsible group of the same cards,
              closed until the heading is tapped. Shown only when non-empty. */}
          {moreWords.length > 0 ? (
            <>
              <ButtonFeedback
                onPress={() => setMoreOpen((open) => !open)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ expanded: moreOpen }}
                accessibilityLabel={moreOpen ? "Hide more words" : "Show more words"}
                style={[styles.moreToggle, { borderColor: theme.cardOutline }]}
              >
                <Text style={[styles.moreToggleText, { color: theme.headingText }]}>
                  More words ({moreWords.length})
                </Text>
                <Ionicons
                  name={moreOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.headingText}
                />
              </ButtonFeedback>

              {moreOpen ? (
                <View style={[styles.wordPicGrid, styles.wordPicGridMore, { gap: WORD_GAP }]}>
                  {moreWords.map((item) => (
                    <WordPictureCard
                      key={item.id}
                      item={item}
                      size={wordCardSize}
                      theme={theme}
                      onPress={startFromItem}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ── Alphabet page (Concept-style; see PronunciationSessionSetupScreen) ───
  alphaBlob: {
    position: "absolute",
    borderRadius: rs(999),
    opacity: 0.08,
  },
  alphaBlobTopRight: {
    width: rs(220),
    height: rs(220),
    top: rs(-60),
    right: rs(-60),
  },
  alphaBlobBottomLeft: {
    width: rs(260),
    height: rs(260),
    bottom: rs(-80),
    left: rs(-80),
  },
  alphaTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  alphaIconBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  alphaIconBtnSpacer: {
    width: rs(40),
    height: rs(40),
  },
  alphaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(10),
    marginTop: rs(70),
  },
  alphaTitleIconCircle: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  alphaTitle: {
    fontSize: rf(34),
    fontFamily: "DMSans_800ExtraBold",
    letterSpacing: -0.3,
  },
  alphaSubtitle: {
    fontSize: rf(15),
    fontFamily: "DMSans_600SemiBold",
    opacity: 0.6,
    textAlign: "center",
    marginTop: 2,
    marginBottom: Layout.spacing.sm,
  },
  alphaScroll: {
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.xl,
    alignItems: "center",
  },
  alphaGrid: {
    marginTop: rs(64),
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  letterTile: {
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  letterTileText: {
    fontFamily: "DMSans_900Black",
    color: "#1A1A1A",
  },
  // Completed letters: small green tick in the corner — the tile itself stays
  // the same so the grid reads as one calm set.
  // ── Word page: picture cards (Concept category-card style) ──────────────
  wordPicGrid: {
    marginTop: rs(64),
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  wordPicGridMore: {
    marginTop: 0,
  },
  // "More words" heading that opens / closes the extra cards: a translucent
  // pill like the header buttons, with a chevron showing its state.
  moreToggle: {
    marginTop: Layout.spacing.xl,
    marginBottom: Layout.spacing.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: rs(8),
    paddingHorizontal: rs(20),
    paddingVertical: rs(10),
    borderRadius: rs(22),
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  moreToggleText: {
    fontSize: rf(17),
    fontFamily: "DMSans_800ExtraBold",
  },
  wordPicCard: {
    borderRadius: rs(20),
    borderWidth: 3,
    padding: rs(8),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  // The picture sits in a rounded frame tinted with the word's own colour.
  wordPicFrame: {
    width: "100%",
    borderRadius: rs(14),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  wordPicImage: {
    width: "100%",
    height: "100%",
  },
  wordPicLabel: {
    marginTop: rs(8),
    marginBottom: 2,
    fontSize: rf(18),
    fontFamily: "DMSans_800ExtraBold",
    color: "#1A1A1A",
    textAlign: "center",
  },
  letterDoneBadge: {
    position: "absolute",
    top: rs(6),
    right: rs(6),
    width: rs(22),
    height: rs(22),
    borderRadius: rs(11),
    backgroundColor: Colors.status.success,
    alignItems: "center",
    justifyContent: "center",
  },

  safe: {
    flex: 1,
  },
  safeInner: {
    flex: 1,
  },
});
