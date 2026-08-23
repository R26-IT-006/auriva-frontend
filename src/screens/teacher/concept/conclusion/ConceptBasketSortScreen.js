import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import BasketSortBoard from '../../../../components/concept/BasketSortBoard';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getConceptItem } from '../../../../data/conceptData';
import { buildBasketSortGame, getConclusionForCategory } from '../../../../data/conceptConclusions';
import { conceptApi } from '../../../../api/concept';
import { Layout } from '../../../../constants/layout';

const CORRECT_GIF = require('../../../../../assets/feedback/correct.gif');

const FEEDBACK_OFFSCREEN = 280;
const FINISH_DELAY_MS    = 1600;

/**
 * Fruit Basket Sort — the Fruits category's conclusion activity.
 *
 * Runs once a category is fully mastered, and sorts its concepts by colour, so
 * it exercises this category and Colours at the same time. That cross-category
 * pull is the point: it asks the child to use what they know rather than
 * re-testing a single concept for the fourth time.
 *
 * Deliberately no-fail. A wrong basket costs nothing but a shake and a retry —
 * the score that reaches the congratulations screen counts first-try placements
 * so the teacher still sees a real signal, but the child cannot lose here.
 */
export default function ConceptBasketSortScreen({ route, navigation }) {
  const { student, category } = route.params;

  const theme      = getAvatarTheme(student?.avatar_key);
  const conclusion = getConclusionForCategory(category.key);

  // Built once per mount: rebuilding on render would reshuffle the tray under
  // the child's finger on every state change. Assigned lazily rather than passed
  // to useRef(), which would evaluate the builder on every render and discard
  // the result.
  const gameRef = useRef(null);
  if (gameRef.current === null) gameRef.current = buildBasketSortGame(category.key);
  const game = gameRef.current;

  const [remaining, setRemaining] = useState(() => game?.items ?? []);
  const [placed,    setPlaced]    = useState({});
  const [locked,    setLocked]    = useState(false);
  const [finished,  setFinished]  = useState(false);

  const feedbackSlide = useRef(new Animated.Value(FEEDBACK_OFFSCREEN)).current;
  const sessionStart  = useRef(Date.now());
  const missed        = useRef(new Set());   // concepts that took more than one try
  const attempts      = useRef(0);

  const speakPrompt = useCallback(() => {
    Speech.stop();
    Speech.speak(conclusion?.subtitle ?? 'Sort them by their colour!', {
      language: 'en-US',
      rate: 0.8,
    });
    if (conclusion?.subtitleSi) {
      setTimeout(() => {
        Speech.speak(conclusion.subtitleSi, { language: 'si-LK', rate: 0.7 });
      }, 1500);
    }
  }, [conclusion]);

  useEffect(() => {
    const t = setTimeout(speakPrompt, 500);
    // Without this the prompt keeps talking after the child leaves the screen.
    return () => { clearTimeout(t); Speech.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish(finalPlaced) {
    setLocked(true);
    setFinished(true);

    const total          = game.items.length;
    const correctFirstTry = total - missed.current.size;

    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();

    Speech.stop();
    Speech.speak('You sorted them all! Well done!', { language: 'en-US', rate: 0.8 });

    conceptApi.logInteraction({
      studentId: student.sid,
      sessionId: null,
      categoryKey: category.key,
      // Category-level event, but concept_key is NOT NULL on the log table, so it
      // carries the last concept placed rather than a sentinel the analytics
      // queries would then have to know to skip.
      conceptKey: game.items[game.items.length - 1].key,
      tier: 4,
      eventType: 'conclusion_complete',
      eventData: {
        activity:          'basket_sort',
        total,
        correct_first_try: correctFirstTry,
        attempts:          attempts.current,
        baskets:           game.baskets.map((b) => b.colorKey),
        placements:        Object.fromEntries(
          Object.entries(finalPlaced).map(([k, v]) => [k, v.map((c) => c.key)]),
        ),
        time_spent_ms:     Date.now() - sessionStart.current,
      },
    }).catch(() => {});

    setTimeout(() => {
      Speech.stop();
      navigation.replace('ConceptCongrats', {
        student,
        category,
        correctCount: correctFirstTry,
        totalCount:   total,
        mode:         'conclusion',
      });
    }, FINISH_DELAY_MS);
  }

  // Returns whether the drop was right, which is what the board animates from.
  const handleDrop = useCallback((item, colorKey) => {
    if (locked) return false;

    const correct = item.sortColor === colorKey;
    attempts.current += 1;

    conceptApi.logInteraction({
      studentId: student.sid,
      sessionId: null,
      categoryKey: category.key,
      conceptKey: item.key,
      tier: 4,
      eventType: 'basket_sort_attempt',
      eventData: {
        chosen_color:  colorKey,
        correct_color: item.sortColor,
        correct,
      },
    }).catch(() => {});

    if (!correct) {
      missed.current.add(item.key);
      Speech.stop();
      Speech.speak('Try another basket.', { language: 'en-US', rate: 0.8 });
      return false;
    }

    const colorConcept = getConceptItem('colors', colorKey);
    Speech.stop();
    Speech.speak(
      `Yes! ${item.plural ? `${item.label} are` : `The ${item.label.toLowerCase()} is`} ${(colorConcept?.label ?? colorKey).toLowerCase()}.`,
      { language: 'en-US', rate: 0.8 },
    );
    // Just the colour word in Sinhala, not a built sentence — reinforces the
    // vocabulary without this screen inventing Sinhala grammar it cannot check.
    if (colorConcept?.labelSi) {
      setTimeout(() => {
        Speech.speak(colorConcept.labelSi, { language: 'si-LK', rate: 0.7 });
      }, 1200);
    }

    const nextPlaced = { ...placed, [colorKey]: [...(placed[colorKey] ?? []), item] };
    const nextRemaining = remaining.filter((r) => r.key !== item.key);

    setPlaced(nextPlaced);
    setRemaining(nextRemaining);
    if (nextRemaining.length === 0) finish(nextPlaced);

    return true;
  }, [locked, placed, remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  // A category with fewer than two usable colour groups cannot make a fair game.
  // Fruits has three, but the registry is open to categories that may not.
  if (!game) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.root}>
        <SafeAreaView style={styles.emptySafe} edges={['top', 'bottom']}>
          <Text style={[styles.emptyText, { color: theme.headingText }]}>
            This activity isn&apos;t ready for {category.label} yet.
          </Text>
          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => { Speech.stop(); navigation.goBack(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={[styles.pill, { backgroundColor: theme.cardSurface }]}>
            <Text style={[styles.pillText, { color: theme.headingText }]}>
              {conclusion?.subtitle ?? 'Sort them by their colour!'}
            </Text>
            {conclusion?.subtitleSi && (
              <Text style={[styles.pillTextSi, { color: theme.headingText }]}>
                {conclusion.subtitleSi}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={speakPrompt}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <Text style={[styles.progress, { color: theme.headingText }]}>
          {game.items.length - remaining.length} / {game.items.length}
        </Text>

        <BasketSortBoard
          baskets={game.baskets}
          items={remaining}
          placed={placed}
          theme={theme}
          locked={locked}
          onDrop={handleDrop}
        />

        {/* One celebration at the end rather than a full-screen GIF after each of
            six drops, which would interrupt the flow the sorting depends on. */}
        {finished && (
          <Animated.View
            style={[styles.feedback, { transform: [{ translateX: feedbackSlide }] }]}
            pointerEvents="none"
          >
            <ExpoImage source={CORRECT_GIF} style={styles.feedbackGif} contentFit="contain" />
          </Animated.View>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingVertical: 10 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: {
    flexShrink: 1,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pillText: {
    fontSize: 21,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  pillTextSi: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.65,
    textAlign: 'center',
    marginTop: 2,
  },

  progress: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
  },

  feedback: {
    position: 'absolute',
    right: 18,
    top: '38%',
  },
  feedbackGif: {
    width: 190,
    height: 190,
  },

  emptySafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: Layout.spacing.lg,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 44,
    paddingVertical: 16,
    borderRadius: 36,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
  },
});
