import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Image, LayoutAnimation, Platform, UIManager, findNodeHandle } from "react-native";
import { ButtonFeedback } from "../../../../../components/common/ButtonFeedback";
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

function MoreWordCard({ item, selected, onPress, width }) {
  return (
    <ButtonFeedback
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.moreWordCard,
        { width },
        selected && styles.moreWordCardSelected,
      ]}
    >
      <View style={[styles.moreWordBadge, { backgroundColor: item.color }]}>
        <Ionicons name="paw-outline" size={18} color="#5F6E83" />
      </View>
      <Text style={styles.moreWordText}>{item.word}</Text>
    </ButtonFeedback>
  );
}

function WordCard({
  item,
  selected,
  onToggleExpand,
  expanded,
  width,
  refCallback,
}) {
  return (
    <View
      ref={refCallback}
      style={[styles.wordCard, { width }, selected && styles.wordCardSelected]}
    >
      <ButtonFeedback
        activeOpacity={0.86}
        onPress={() => onToggleExpand && onToggleExpand(item)}
        style={styles.wordHeader}
      >
        <View style={styles.wordMetaCompact}>
          <Text style={styles.wordText}>{item.word}</Text>
          <PhonemeDots count={item.phonemeCount} />
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color="#5F6E83"
        />
      </ButtonFeedback>

      {expanded && selected && (
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
      )}
    </View>
  );
}

export default function PronunciationWordSelectionScreen({
  navigation,
  route,
}) {
  const student = route.params?.student;
  const categoryId = route.params?.categoryId;
  const [selectedWord, setSelectedWord] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expandedWordKey, setExpandedWordKey] = useState(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const scrollRef = useRef(null);
  const cardRefs = useRef({});

  const category = SESSION_CATEGORIES.find((c) => c.id === categoryId);
  const words = WORD_BANK[categoryId] || [];
  const moreWords = WORD_BANK.moreAnimals || [];

  const cardWidth = useMemo(() => {
    if (width >= 1180) return 186;
    if (width >= 980) return 170;
    if (width >= 840) return 160;
    return Math.min(240, width - Layout.spacing.lg * 2);
  }, [width]);

  const moreCardWidth = useMemo(() => {
    if (width >= 1180) return 150;
    if (width >= 980) return 140;
    if (width >= 840) return 132;
    return Math.max(
      120,
      Math.min(156, (width - Layout.spacing.lg * 2 - Layout.spacing.sm) / 2),
    );
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

  function toggleMore() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMoreOpen((v) => !v);
  }

  function handleToggleExpand(item) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const key = `${categoryId || "cat"}-${item.id}`;
    if (expandedWordKey === key) {
      setExpandedWordKey(null);
    } else {
      setExpandedWordKey(key);
      setSelectedWord(item);
      // measure and scroll expanded card into view after layout settles
      setTimeout(() => {
        try {
          const card = cardRefs.current[key];
          const scrollNode = findNodeHandle(scrollRef.current);
          if (!card || !scrollNode) return;
          UIManager.measureLayout(
            findNodeHandle(card),
            scrollNode,
            () => {},
            (left, top, widthMeasured, heightMeasured) => {
              if (
                scrollRef.current &&
                typeof scrollRef.current.scrollTo === "function"
              ) {
                scrollRef.current.scrollTo({
                  y: Math.max(0, top - 48),
                  animated: true,
                });
              }
            },
          );
        } catch (e) {
          // ignore measurement errors
        }
      }, 80);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ButtonFeedback
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.82}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.text.primary}
            />
          </ButtonFeedback>

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
            <ButtonFeedback
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
            </ButtonFeedback>
          </View>

          <Text style={styles.contextText}>
            {category ? `${category.title} category` : "Selected category"}
          </Text>

          <View style={styles.wordGrid}>
            {words.map((item) => {
              const key = `${categoryId || "cat"}-${item.id}`;
              return (
                <WordCard
                  key={key}
                  item={item}
                  width={cardWidth}
                  selected={selectedWord?.id === item.id}
                  expanded={expandedWordKey === key}
                  onToggleExpand={handleToggleExpand}
                  refCallback={(r) => (cardRefs.current[key] = r)}
                />
              );
            })}
          </View>

          <View style={styles.moreWordsSection}>
            <ButtonFeedback
              activeOpacity={0.86}
              onPress={toggleMore}
              style={styles.moreHeaderRow}
            >
              <View>
                <Text style={styles.moreWordsTitle}>More Words</Text>
                <Text style={styles.moreWordsSubtitle}>
                  Extra animal words to practise and review
                </Text>
              </View>

              <View style={styles.moreToggleBtn}>
                <Ionicons
                  name={moreOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={Colors.text.secondary}
                />
              </View>
            </ButtonFeedback>

            {moreOpen && (
              <View style={styles.moreWordGrid}>
                {moreWords.map((item) => (
                  <MoreWordCard
                    key={item.id}
                    item={item}
                    width={moreCardWidth}
                    selected={selectedWord?.id === item.id}
                    onPress={() => setSelectedWord(item)}
                  />
                ))}
              </View>
            )}
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
    alignItems: "flex-start",
    gap: Layout.spacing.sm,
  },
  moreWordsSection: {
    marginTop: Layout.spacing.xl,
    paddingTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#E3E8EF",
  },
  moreWordsTitle: {
    fontSize: Layout.fontSize.xl,
    fontWeight: "800",
    color: Colors.text.primary,
  },
  moreWordsSubtitle: {
    marginTop: 3,
    marginBottom: Layout.spacing.sm,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
  },
  moreWordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
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
  wordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E6EDF7",
  },
  wordMetaCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
  },
  moreHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Layout.spacing.sm,
  },
  moreToggleBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,140,160,0.06)",
  },
  moreWordCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C9D4E1",
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  moreWordCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  moreWordBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  moreWordText: {
    fontSize: 15,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "lowercase",
    textAlign: "center",
  },
});
