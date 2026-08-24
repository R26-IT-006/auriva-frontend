import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import PairMatchBoard from '../../../../components/concept/PairMatchBoard';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { buildPairMatchGame } from '../../../../data/conceptPairMatch';
import { conceptApi } from '../../../../api/concept';
import { Layout } from '../../../../constants/layout';

const PROMPT_EN = 'Match each photo to its picture!';
const PROMPT_SI = 'ඡායාරූපයට ගැළපෙන චිත්‍රය සොයමු!';

const FINISH_DELAY_MS    = 1600;

/**
 * Photo ↔ drawing pair match.
 *
 * The child sees the same concepts twice — photographed down one column, drawn
 * down the other — and pairs them up. Generalisation practice: a concept the
 * child only ever met as one picture is a picture they have learned, not a
 * concept, and this asks them to recognise it across two very different images.
 *
 * No-fail, like the basket sort: a wrong pair shakes and clears, nothing is
 * lost. First-try matches are logged so the teacher still sees a real signal.
 */
export default function ConceptPairMatchScreen({ route, navigation }) {
  const { student, category, masteredKeys } = route.params;

  const theme = getAvatarTheme(student?.avatar_key);

  // Built once per mount — rebuilding on render would reshuffle both columns
  // under the child's finger on every tap.
  const gameRef = useRef(null);
  if (gameRef.current === null) {
    gameRef.current = buildPairMatchGame(category.key, masteredKeys ?? []);
  }
  const game = gameRef.current;

  const [matched,    setMatched]    = useState([]);
  const [selected,   setSelected]   = useState(null);   // { side, key }
  const [wrongToken, setWrongToken] = useState(null);   // { photoKey, drawingKey, n }
  const [locked,     setLocked]     = useState(false);

  const sessionStart  = useRef(Date.now());
  const missed        = useRef(new Set());   // concepts that took more than one try
  const attempts      = useRef(0);
  const wrongCount    = useRef(0);

  const speakPrompt = useCallback(() => {
    Speech.stop();
    Speech.speak(PROMPT_EN, { language: 'en-US', rate: 0.8 });
    setTimeout(() => Speech.speak(PROMPT_SI, { language: 'si-LK', rate: 0.7 }), 1800);
  }, []);

  useEffect(() => {
    const t = setTimeout(speakPrompt, 500);
    // Without this the prompt keeps talking after the child leaves the screen.
    return () => { clearTimeout(t); Speech.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish(finalMatched) {
    setLocked(true);

    Speech.stop();
    Speech.speak('You matched them all! Well done!', { language: 'en-US', rate: 0.8 });

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   null,
      categoryKey: category.key,
      conceptKey:  finalMatched[0] ?? category.key,
      tier:        4,
      eventType:   'pair_match_complete',
      eventData: {
        pairs:            finalMatched.length,
        correct_first_try: finalMatched.length - missed.current.size,
        attempts:          attempts.current,
        time_spent_ms:     Date.now() - sessionStart.current,
      },
    }).catch(() => {});

    setTimeout(() => {
      navigation.replace('ConceptItems', { student, category });
    }, FINISH_DELAY_MS);
  }

  function handleSelect(side, item) {
    if (locked) return;

    // First card of a pair, or a change of mind on the same side.
    if (!selected || selected.side === side) {
      setSelected({ side, key: item.key });
      return;
    }

    // Second card — one from each column, so this is an answer.
    const photoKey   = side === 'photo' ? item.key : selected.key;
    const drawingKey = side === 'photo' ? selected.key : item.key;
    const correct    = photoKey === drawingKey;

    attempts.current += 1;
    setSelected(null);

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   null,
      categoryKey: category.key,
      conceptKey:  photoKey,
      tier:        4,
      eventType:   'pair_match_attempt',
      eventData:   { photo_key: photoKey, drawing_key: drawingKey, correct },
    }).catch(() => {});

    if (!correct) {
      missed.current.add(photoKey);
      missed.current.add(drawingKey);
      wrongCount.current += 1;
      setWrongToken({ photoKey, drawingKey, n: wrongCount.current });
      Speech.stop();
      Speech.speak('Not quite. Try again.', { language: 'en-US', rate: 0.8 });
      return;
    }

    const next = [...matched, item.key];
    setMatched(next);

    Speech.stop();
    Speech.speak(`Yes! That is the ${item.label.toLowerCase()}.`, { language: 'en-US', rate: 0.8 });
    if (item.labelSi) {
      setTimeout(() => Speech.speak(item.labelSi, { language: 'si-LK', rate: 0.7 }), 1200);
    }

    if (next.length === game.total) finish(next);
  }

  // A category without enough photo/drawing pairs never reaches here — the
  // activity picker hides it — but a deep link could, so fail visibly rather
  // than rendering an empty board.
  if (!game) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.centered]} edges={['top', 'bottom']}>
          <Ionicons name="images-outline" size={40} color={theme.headingText} />
          <Text style={[styles.emptyText, { color: theme.headingText }]}>
            This category doesn't have enough pictures for matching yet.
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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={[styles.pill, { backgroundColor: theme.cardSurface }]}>
            <Text style={[styles.pillText, { color: theme.headingText }]}>{PROMPT_EN}</Text>
            <Text style={[styles.pillTextSi, { color: theme.headingText }]}>{PROMPT_SI}</Text>
          </View>

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

        {/* One dot per pair, filling in its own pair colour as it is matched —
            the same colour the two cards take, so the row reads as a tally of
            what is done rather than an abstract counter. */}
        <View style={styles.progressRow}>
          {game.photos.map((item) => {
            const done = matched.includes(item.key);
            return (
              <View
                key={item.key}
                style={[
                  styles.progressDot,
                  done
                    ? { backgroundColor: item.pairColor, transform: [{ scale: 1.15 }] }
                    : { backgroundColor: 'rgba(0,0,0,0.14)' },
                ]}
              />
            );
          })}
          <Text style={[styles.progress, { color: theme.headingText }]}>
            {matched.length} / {game.total}
          </Text>
        </View>

        <PairMatchBoard
          photos={game.photos}
          drawings={game.drawings}
          matched={matched}
          selected={selected}
          wrongToken={wrongToken}
          theme={theme}
          locked={locked}
          onSelect={handleSelect}
        />

        {/* One celebration at the end, not after each pair — the same choice the
            basket sort makes, so the flow is not interrupted five times. */}
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
