import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playConceptAudio, stopConceptAudio } from '../../../../utils/audioUtils';
import PairMatchBoard from '../../../../components/concept/PairMatchBoard';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { buildPairMatchGame, MAX_PAIRS, MIN_PAIRS, getPairableItems } from '../../../../data/conceptPairMatch';
import { conceptApi } from '../../../../api/concept';
import { Layout } from '../../../../constants/layout';

const PROMPT_EN = 'Match each photo to its picture!';
const PROMPT_SI = 'ඡායාරූපයට ගැළපෙන චිත්‍රය සොයමු!';

// The spoken form of the pill above the board. One recording for the activity,
// not per concept, so it needs no TTS fallback — the per-pair replies below are
// still spoken, since they name whichever concept was just matched.
const MATCHING_AUDIO = require('../../../../../assets/concepts/audio/MatchingActivity.m4a');

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
  // masteredKeys comes from ConceptItemsScreen, which already knows what this
  // child has been taught. Only used if startGameActivity fails.
  const { student, category, masteredKeys = [] } = route.params;

  const theme = getAvatarTheme(student?.avatar_key);

  // Concepts come from the server, chosen from this child's tier 1 and tier 2
  // results. Held in state rather than built at first render because the board
  // cannot exist until that call returns.
  const [game,       setGame]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [matched,    setMatched]    = useState([]);
  const [selected,   setSelected]   = useState(null);   // { side, key }
  const [wrongToken, setWrongToken] = useState(null);   // { photoKey, drawingKey, n }
  const [locked,     setLocked]     = useState(false);

  const activityId    = useRef(null);
  const sessionStart  = useRef(Date.now());
  const missed        = useRef(new Set());   // concepts that took more than one try
  // concept -> Set(concepts it was wrongly paired with), for the GKB edges.
  const confusions    = useRef(new Map());
  const attempts      = useRef(0);
  const wrongCount    = useRef(0);

  useEffect(() => {
    let active = true;

    conceptApi.startGameActivity({
      studentId:    student.sid,
      categoryKey:  category.key,
      activityType: 'pair_match',
      conceptCount: MAX_PAIRS,
    })
      .then((res) => {
        if (!active) return;
        activityId.current = res.activity_id;
        setGame(buildPairMatchGame(category.key, res.concept_keys || []));
      })
      .catch(() => {
        // Unreachable server: deal from the concepts this screen was handed as
        // mastered rather than stranding the child on a spinner. The run is not
        // recorded, but it is still played on concepts they have been taught.
        //
        // This used to pass [], which sent the builder down a `shuffle(the whole
        // category)` path — a game of concepts the child had never seen.
        if (active) setGame(buildPairMatchGame(category.key, masteredKeys));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function noteConfusion(a, b) {
    if (!confusions.current.has(a)) confusions.current.set(a, new Set());
    confusions.current.get(a).add(b);
  }

  const speakPrompt = useCallback(() => {
    playConceptAudio(MATCHING_AUDIO);
  }, []);

  useEffect(() => {
    const t = setTimeout(speakPrompt, 500);
    // Without this the prompt keeps talking after the child leaves the screen.
    return () => { clearTimeout(t); stopConceptAudio(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish(finalMatched) {
    setLocked(true);

    stopConceptAudio();

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
      // Recorded both ways: the child could not tell these two apart, and which
      // of them the game happens to call "correct" here is arbitrary.
      noteConfusion(photoKey, drawingKey);
      noteConfusion(drawingKey, photoKey);
      wrongCount.current += 1;
      setWrongToken({ photoKey, drawingKey, n: wrongCount.current });
      stopConceptAudio();
      return;
    }

    const next = [...matched, item.key];
    setMatched(next);

    stopConceptAudio();

    if (next.length === game.total) finish(next);
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
  // than rendering an empty board.
  if (!game) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.centered]} edges={['top', 'bottom']}>
          <Ionicons name="images-outline" size={40} color={theme.headingText} />
          <Text style={[styles.emptyText, { color: theme.headingText }]}>
            {/* Two different reasons the builder returns null — missing artwork,
                or too few concepts taught to this child yet. The second is the
                ordinary one and resolves itself as they learn. */}
            {getPairableItems(category.key).length < MIN_PAIRS
              ? "This category doesn't have enough pictures for matching yet."
              : `Master ${MIN_PAIRS} ${category.label.toLowerCase()} concepts to unlock this game.`}
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
