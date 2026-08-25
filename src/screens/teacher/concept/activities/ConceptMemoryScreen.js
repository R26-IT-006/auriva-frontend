import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import MemoryFlipBoard from '../../../../components/concept/MemoryFlipBoard';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { buildMemoryGame, MEMORY_PAIRS } from '../../../../data/conceptMemoryGame';
import { conceptApi } from '../../../../api/concept';
import { Layout } from '../../../../constants/layout';

const PROMPT_EN = 'Find the matching pairs!';
const PROMPT_SI = 'ගැළපෙන යුගල් සොයමු!';

const FINISH_DELAY_MS    = 1600;

// How long a mismatched pair stays visible before turning back. Long enough to
// actually look at both cards — the memory is the point, so hiding them the
// instant they are seen would defeat the activity.
const PEEK_MS = 1100;

/**
 * Memory — turn cards over two at a time and find the pairs.
 *
 * A pair is a concept's photo and its drawing rather than two identical images,
 * so remembering where a card was and recognising the concept across two very
 * different pictures are trained together.
 *
 * No-fail: a wrong turn simply flips back. Pairs found without a prior miss are
 * logged so the teacher still sees a real signal.
 */
export default function ConceptMemoryScreen({ route, navigation }) {
  const { student, category } = route.params;

  const theme = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  // Concepts come from the server, chosen from this child's tier 1 and tier 2
  // results. Held in state rather than built at first render because the grid
  // cannot exist until that call returns.
  const [game,     setGame]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [faceUp,   setFaceUp]   = useState([]);   // card ids currently turned over
  const [matched,  setMatched]  = useState([]);   // concept keys already found
  const [locked,   setLocked]   = useState(false);

  const activityId    = useRef(null);
  const sessionStart  = useRef(Date.now());
  const seen          = useRef(new Set());   // concepts turned over at least once
  const missed        = useRef(new Set());   // concepts that took more than one try
  // concept -> Set(concepts it was wrongly turned over with), for the GKB edges.
  const confusions    = useRef(new Map());
  const turns         = useRef(0);
  const peekTimer     = useRef(null);

  useEffect(() => {
    let active = true;

    conceptApi.startGameActivity({
      studentId:    student.sid,
      categoryKey:  category.key,
      activityType: 'memory',
      conceptCount: MEMORY_PAIRS,
    })
      .then((res) => {
        if (!active) return;
        activityId.current = res.activity_id;
        setGame(buildMemoryGame(category.key, res.concept_keys || []));
      })
      .catch(() => {
        // Unreachable server: fall back to a local deal rather than stranding
        // the child on a spinner. The run simply is not recorded.
        if (active) setGame(buildMemoryGame(category.key, []));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function noteConfusion(a, b) {
    if (!confusions.current.has(a)) confusions.current.set(a, new Set());
    confusions.current.get(a).add(b);
  }

  // Four cards across; the row count follows the deal, so a full eight pairs is
  // 4×4 and a small category's four pairs is 4×2. Sized from whichever axis runs
  // out first, so the grid never scrolls and the cards stay square.
  const COLS = 4;
  const GRID_GAP = 26;
  const rows = Math.max(1, Math.ceil((game?.cards.length ?? 0) / COLS));
  const cardSize = Math.min(
    (width - 48 - GRID_GAP * (COLS - 1)) / COLS,
    (height * 0.60 - GRID_GAP * (rows - 1)) / rows,
    178,
  );

  const speakPrompt = useCallback(() => {
    Speech.stop();
    Speech.speak(PROMPT_EN, { language: 'en-US', rate: 0.8 });
    setTimeout(() => Speech.speak(PROMPT_SI, { language: 'si-LK', rate: 0.7 }), 1600);
  }, []);

  useEffect(() => {
    const t = setTimeout(speakPrompt, 500);
    // Without these the prompt keeps talking, and a pending flip-back fires into
    // an unmounted screen, after the child leaves.
    return () => {
      clearTimeout(t);
      if (peekTimer.current) clearTimeout(peekTimer.current);
      Speech.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish(finalMatched) {
    setLocked(true);

    Speech.stop();
    Speech.speak('You found them all! Well done!', { language: 'en-US', rate: 0.8 });

    // The activity row replaces the old ad-hoc completion log — it carries the
    // score, the concepts covered and the confusion edges in one place.
    if (activityId.current) {
      conceptApi.completeGameActivity({
        studentId:   student.sid,
        sessionId:   null,
        activityId:  activityId.current,
        pairResults: finalMatched.map((key) => ({
          concept_key:           key,
          was_correct_first_try: !missed.current.has(key),
          confused_with:         [...(confusions.current.get(key) ?? [])],
        })),
      }).catch(() => {});
    }

    setTimeout(() => {
      navigation.replace('ConceptItems', { student, category });
    }, FINISH_DELAY_MS);
  }

  function handleFlip(card) {
    if (locked) return;
    if (faceUp.includes(card.id) || matched.includes(card.key)) return;

    // First of the two.
    if (faceUp.length === 0) {
      setFaceUp([card.id]);
      return;
    }

    // Second of the two — this is the guess.
    const firstId   = faceUp[0];
    const firstCard = game.cards.find((c) => c.id === firstId);
    const isPair    = firstCard.key === card.key;

    turns.current += 1;
    setFaceUp([firstId, card.id]);

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   null,
      categoryKey: category.key,
      conceptKey:  card.key,
      tier:        4,
      eventType:   'memory_turn',
      eventData:   { first: firstCard.key, second: card.key, matched: isPair, turn: turns.current },
    }).catch(() => {});

    if (isPair) {
      const next = [...matched, card.key];
      setMatched(next);
      setFaceUp([]);

      Speech.stop();
      Speech.speak(`Yes! Two ${card.label.toLowerCase()}.`, { language: 'en-US', rate: 0.8 });
      if (card.labelSi) {
        setTimeout(() => Speech.speak(card.labelSi, { language: 'si-LK', rate: 0.7 }), 1100);
      }

      if (next.length === game.pairs) finish(next);
      return;
    }

    // A miss only counts against a concept the child had already been shown —
    // turning over a card for the first time cannot be a memory failure.
    [firstCard.key, card.key].forEach((key) => {
      if (seen.current.has(key)) missed.current.add(key);
      seen.current.add(key);
    });

    // Only a photo-against-drawing turn says anything about linking the two
    // formats. Two photos, or two drawings, is a memory miss and nothing more,
    // so it must not become a format-confusion edge.
    if (firstCard.face !== card.face) {
      noteConfusion(firstCard.key, card.key);
      noteConfusion(card.key, firstCard.key);
    }

    // Hold both visible, then turn them back. Locked meanwhile so a third tap
    // cannot land while the child is still looking at the pair.
    setLocked(true);
    peekTimer.current = setTimeout(() => {
      setFaceUp([]);
      setLocked(false);
    }, PEEK_MS);
  }

  if (loading) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.centered]} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={theme.button} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // A category without enough photo/drawing pairs never reaches here — the
  // activity picker hides it — but a deep link could, so fail visibly rather
  // than rendering an empty grid.
  if (!game) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.centered]} edges={['top', 'bottom']}>
          <Ionicons name="images-outline" size={40} color={theme.headingText} />
          <Text style={[styles.emptyText, { color: theme.headingText }]}>
            This category doesn't have enough pictures for a memory game yet.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={[styles.backBtnText, { color: theme.buttonText }]}>Go back</Text>
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
          <View style={styles.topBarSide}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={20} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          <View style={[styles.pill, { backgroundColor: theme.cardSurface }]}>
            <Text style={[styles.pillText, { color: theme.headingText }]}>{PROMPT_EN}</Text>
            <Text style={[styles.pillTextSi, { color: theme.headingText }]}>{PROMPT_SI}</Text>
          </View>

          <View style={[styles.topBarSide, styles.topBarRight]}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
              onPress={speakPrompt}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Hear the instructions"
            >
              <Ionicons name="volume-high" size={20} color={theme.headingText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* One dot per pair, filling in its pair colour as it is found. */}
        <View style={styles.progressRow}>
          {game.cards.filter((c) => c.face === 'photo').map((card) => (
            <View
              key={card.key}
              style={[
                styles.progressDot,
                matched.includes(card.key)
                  ? { backgroundColor: card.pairColor, transform: [{ scale: 1.15 }] }
                  : { backgroundColor: 'rgba(0,0,0,0.14)' },
              ]}
            />
          ))}
          <Text style={[styles.progress, { color: theme.headingText }]}>
            {matched.length} / {game.pairs}
          </Text>
        </View>

        <MemoryFlipBoard
          cards={game.cards}
          faceUp={faceUp}
          matched={matched}
          locked={locked}
          cardSize={cardSize}
          gap={GRID_GAP}
          columns={COLS}
          theme={theme}
          onFlip={handleFlip}
        />


      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingVertical: 10 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  // Equal flanks keep the prompt on the screen's centre line.
  topBarSide: { flex: 1, alignItems: 'flex-start' },
  topBarRight: { alignItems: 'flex-end' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: {
    flexShrink: 1,
    marginTop: 22,
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
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
  },
  pillTextSi: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    opacity: 0.65,
    textAlign: 'center',
    marginTop: 2,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progress: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    opacity: 0.6,
    marginLeft: 4,
  },

  emptyText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    lineHeight: 24,
  },
  backBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
