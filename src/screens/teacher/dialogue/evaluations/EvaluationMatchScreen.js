import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { evaluationApi } from '../../../../api/evaluation';

const PLACEHOLDER_IMAGE = require('../../../../../assets/dialogue-images/placeholder.png');

// Same feedback GIFs the Concept module's activity screen uses
// (ConceptActivityScreen.js) — reused here for a consistent right/wrong
// feel across modules.
const CORRECT_GIF = require('../../../../../assets/feedback/correct.gif');
const WRONG_GIF   = require('../../../../../assets/feedback/wrong.gif');
const FEEDBACK_MS = 1200;
// Distance the feedback GIF travels in from the right edge.
const FEEDBACK_OFFSCREEN = 280;

const CATEGORY_LABEL = {
  greetings:    'Greetings',
  magic_words:  'Magic Words',
  abilities:    'Can You?',
};

// "Scene" image per word, keyed by asset_key — the same field the
// evaluation-build API returns. Every word folder has its own Non_Verbal.jpg.
// Abilities uses a video instead (EVAL_ABILITIES_VIDEO below), not this map.
const EVAL_WORD_IMAGE = {
  // Greetings
  hello:           require('../../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
  goodbye:         require('../../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
  good_morning:    require('../../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
  good_afternoon:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
  good_night:      require('../../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
  happy_birthday:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
  how_are_you:     require('../../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
  im_fine:         require('../../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
  happy_new_year:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),

  // Magic Words
  thank_you:       require('../../../../../assets/dialogue-images/words/magic_words/thank_you/Non_Verbal.jpg'),
  youre_welcome:   require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/Non_Verbal.jpg'),
  im_sorry:        require('../../../../../assets/dialogue-images/words/magic_words/im_sorry/Non_Verbal.jpg'),
  excuse_me:       require('../../../../../assets/dialogue-images/words/magic_words/excuse_me/Non_Verbal.jpg'),
};

// Abilities scene per word — Drag_Activity.mp4, the same video wired into
// Cat3DragToLineScreen.js (difficulty 1 and 2 both).
const EVAL_ABILITIES_VIDEO = {
  cat3_yes: require('../../../../../assets/dialogue-videos/words/abilities/yes/Drag_Activity.mp4'),
  cat3_no:  require('../../../../../assets/dialogue-videos/words/abilities/no/Drag_Activity.mp4'),
  clap:     require('../../../../../assets/dialogue-videos/words/abilities/clap/Drag_Activity.mp4'),
  run:      require('../../../../../assets/dialogue-videos/words/abilities/run/Drag_Activity.mp4'),
  walk:     require('../../../../../assets/dialogue-videos/words/abilities/walk/Drag_Activity.mp4'),
  jump:     require('../../../../../assets/dialogue-videos/words/abilities/jump/Drag_Activity.mp4'),
  talk:     require('../../../../../assets/dialogue-videos/words/abilities/talk/Drag_Activity.mp4'),
  dance:    require('../../../../../assets/dialogue-videos/words/abilities/dance/Drag_Activity.mp4'),
  sing:     require('../../../../../assets/dialogue-videos/words/abilities/sing/Drag_Activity.mp4'),
  brush:    require('../../../../../assets/dialogue-videos/words/abilities/brush/Drag_Activity.mp4'),
  wash:     require('../../../../../assets/dialogue-videos/words/abilities/wash/Drag_Activity.mp4'),
  eat:      require('../../../../../assets/dialogue-videos/words/abilities/eat/Drag_Activity.mp4'),
  drink:    require('../../../../../assets/dialogue-videos/words/abilities/drink/Drag_Activity.mp4'),
  write:    require('../../../../../assets/dialogue-videos/words/abilities/write/Drag_Activity.mp4'),
  play:     require('../../../../../assets/dialogue-videos/words/abilities/play/Drag_Activity.mp4'),
  sleep:    require('../../../../../assets/dialogue-videos/words/abilities/sleep/Drag_Activity.mp4'),
  watch:    require('../../../../../assets/dialogue-videos/words/abilities/watch/Drag_Activity.mp4'),
};

// Standard word-pronunciation audio, reused from each category's Phase 2
// WORD_AUDIO maps. Only words with a REAL (non-placeholder) recording are
// included — tapping a tile without one just skips audio.
const WORD_AUDIO_BY_KEY = {
  hello:         require('../../../../../assets/dialogue-audios/greetings/hello.mp3'),
  goodbye:       require('../../../../../assets/dialogue-audios/greetings/goodbye.mp3'),
  good_morning:  require('../../../../../assets/dialogue-audios/greetings/good_morning.mp3'),

  thank_you:     require('../../../../../assets/dialogue-audios/magic_words/Thankyou.mp3'),
  im_sorry:      require('../../../../../assets/dialogue-audios/magic_words/Im_sorry.mp3'),
  youre_welcome: require('../../../../../assets/dialogue-audios/magic_words/you_re_welcome.mp3'),
  excuse_me:     require('../../../../../assets/dialogue-audios/magic_words/Excuse_me.mp3'),

  clap:  require('../../../../../assets/dialogue-audios/abilities/clap.mp3'),
  run:   require('../../../../../assets/dialogue-audios/abilities/run.mp3'),
  walk:  require('../../../../../assets/dialogue-audios/abilities/walk.mp3'),
  jump:  require('../../../../../assets/dialogue-audios/abilities/jump.mp3'),
  dance: require('../../../../../assets/dialogue-audios/abilities/dance.mp3'),
  sing:  require('../../../../../assets/dialogue-audios/abilities/sing.mp3'),
  talk:  require('../../../../../assets/dialogue-audios/abilities/talk.mp3'),
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EvaluationMatchScreen({ route, navigation }) {
  const { student, category } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const { width: screenWidth } = useWindowDimensions();

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [rounds,     setRounds]     = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [settled,    setSettled]    = useState(false); // locked while a GIF is showing
  const [wrongCount, setWrongCount] = useState(0);      // wrong taps on the CURRENT round
  const [feedback,   setFeedback]   = useState(null);   // 'correct' | 'wrong' | null
  const [completed,  setCompleted]  = useState(false);
  const [showGate,   setShowGate]   = useState(false);
  // Abilities videos report their own aspect ratio asynchronously (see
  // onReadyForDisplay below); 4:3 is just the default before that arrives.
  const [videoAspectRatio, setVideoAspectRatio] = useState(4 / 3);

  const soundRef        = useRef(null);
  const videoRef        = useRef(null);
  const activeRef        = useRef(true);
  const feedbackSlide    = useRef(new Animated.Value(FEEDBACK_OFFSCREEN)).current;
  const starScale        = useRef(new Animated.Value(0)).current;
  // One { word_id, chosen_word_id_for_image } per round, built from each
  // round's FIRST tap — evaluation scoring reflects first-attempt accuracy
  // even though the child can keep retrying afterwards to learn the answer.
  const pairsRef          = useRef([]);
  const firstAttemptRef   = useRef(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data  = await evaluationApi.build(student.sid, category);
        const words  = data.words ?? [];
        const images = data.images ?? [];
        const assetKeyByWordId = Object.fromEntries(images.map((im) => [im.word_id, im.asset_key]));

        const isVideo = category === 'abilities';
        const built = shuffle(words).map((w) => {
          const others      = words.filter((o) => o.word_id !== w.word_id);
          const distractors = shuffle(others).slice(0, 2);
          const assetKey     = assetKeyByWordId[w.word_id];
          return {
            word_id: w.word_id,
            isVideo,
            media: isVideo
              ? (EVAL_ABILITIES_VIDEO[assetKey] ?? null)
              : (EVAL_WORD_IMAGE[assetKey] ?? PLACEHOLDER_IMAGE),
            audio: WORD_AUDIO_BY_KEY[assetKey],
            tiles: shuffle([w, ...distractors]).map((t) => ({ word_id: t.word_id, text: t.text })),
          };
        });

        if (!active) return;
        if (built.length === 0) {
          setError('Could not load this evaluation. Please try again.');
        } else {
          setRounds(built);
        }
      } catch {
        if (active) setError('Could not load this evaluation. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [student?.sid, category]);

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowGate(true);
      return true;
    });
    return () => {
      activeRef.current = false;
      sub.remove();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      // Abilities scenes are a looping video — stop it on blur, otherwise
      // its audio keeps playing after the student navigates away.
      videoRef.current?.pauseAsync().catch(() => {});
    };
  }, []));

  useEffect(() => {
    if (completed) {
      Animated.spring(starScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }).start();
    }
  }, [completed]);

  // Reset per-round state whenever a new round begins
  useEffect(() => {
    setSelectedId(null);
    setSettled(false);
    setWrongCount(0);
    firstAttemptRef.current = null;
    setVideoAspectRatio(4 / 3); // reset the video default; the real ratio arrives via onReadyForDisplay below
  }, [roundIndex]);

  const round = rounds[roundIndex] ?? null;

  // Size the scene box to match the actual media's own aspect ratio, so
  // `contain` never has to letterbox with visible bars above/below. Local
  // require()'d images resolve their real dimensions synchronously; videos
  // report theirs asynchronously via onReadyForDisplay (tracked in state).
  const resolvedImageSize = (round && !round.isVideo && round.media) ? Image.resolveAssetSource(round.media) : null;
  const sceneAspectRatio = round?.isVideo
    ? videoAspectRatio
    : (resolvedImageSize?.width && resolvedImageSize?.height ? resolvedImageSize.width / resolvedImageSize.height : 4 / 3);
  const sceneWidth  = Math.min(screenWidth * 0.85, 460);
  const sceneHeight = Math.round(sceneWidth / sceneAspectRatio);

  async function playSound(source) {
    if (!source) return;
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
    } catch { /* ignore */ }
  }

  function showFeedbackGif(result) {
    setFeedback(result);
    Animated.spring(feedbackSlide, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }
  function hideFeedbackGifThen(cb) {
    Animated.timing(feedbackSlide, { toValue: FEEDBACK_OFFSCREEN, useNativeDriver: true, duration: 250 }).start(() => {
      setFeedback(null);
      cb();
    });
  }

  function handleTileTap(tile) {
    if (!round || settled) return;
    setSelectedId(tile.word_id);
    playSound(round.audio);
    if (firstAttemptRef.current === null) firstAttemptRef.current = tile.word_id;

    const isCorrect = tile.word_id === round.word_id;
    setSettled(true);
    showFeedbackGif(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      pairsRef.current.push({ word_id: round.word_id, chosen_word_id_for_image: firstAttemptRef.current });
      setTimeout(() => {
        hideFeedbackGifThen(() => {
          if (!activeRef.current) return;
          const isLast = roundIndex === rounds.length - 1;
          if (isLast) finish();
          else setRoundIndex((n) => n + 1);
        });
      }, FEEDBACK_MS);
    } else {
      setWrongCount((n) => n + 1);
      setTimeout(() => {
        hideFeedbackGifThen(() => {
          if (!activeRef.current) return;
          setSettled(false);
          setSelectedId(null);
        });
      }, FEEDBACK_MS);
    }
  }

  async function finish() {
    try {
      await evaluationApi.record(student.sid, category, pairsRef.current);
    } catch {
      // Never show a fail state to the child — the score lives only in the
      // API record for the teacher; if the POST fails the child still gets
      // the celebration, they just won't have a record of this attempt.
    }
    if (!activeRef.current) return;
    setCompleted(true);
  }

  function onGateSuccess() {
    setShowGate(false);
    navigation.navigate('EvaluationMenu', { student });
  }

  // Once a round has taken 2+ wrong taps, softly highlight the correct
  // tile so the child can find it themselves rather than getting stuck.
  const showHint = wrongCount >= 2;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: theme.headerBackground }} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => setShowGate(true)} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]} numberOfLines={1}>
            {categoryLabel} Evaluation
          </Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.button} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && !completed && round && (
            <View style={styles.content}>
              <Text style={[styles.progressLabel, { color: theme.headingText }]}>
                Word {roundIndex + 1} of {rounds.length}
              </Text>
              <Text style={[styles.title, { color: theme.headingText }]}>What word can be used in this scenario ?</Text>

              <View style={[styles.sceneWrap, { width: sceneWidth, height: sceneHeight, backgroundColor: theme.cardSurface }]}>
                {round.isVideo ? (
                  round.media && (
                    <Video
                      key={round.word_id}
                      ref={videoRef}
                      source={round.media}
                      style={styles.sceneImg}
                      resizeMode={ResizeMode.CONTAIN}
                      useNativeControls={false}
                      shouldPlay
                      isLooping
                      onReadyForDisplay={(e) => {
                        const { width, height } = e.naturalSize ?? {};
                        if (width && height) setVideoAspectRatio(width / height);
                      }}
                    />
                  )
                ) : (
                  <Image source={round.media} style={styles.sceneImg} resizeMode="contain" />
                )}
              </View>

              <View style={styles.tilesRow}>
                {round.tiles.map((tile) => {
                  const isSelected      = selectedId === tile.word_id;
                  const isCorrectTile   = tile.word_id === round.word_id;
                  const showGreen       = isSelected && feedback === 'correct';
                  const showRed         = isSelected && feedback === 'wrong';
                  const showHintOnTile  = showHint && isCorrectTile && !isSelected;
                  return (
                    <TouchableOpacity
                      key={tile.word_id}
                      activeOpacity={settled ? 1 : 0.82}
                      disabled={settled}
                      onPress={() => handleTileTap(tile)}
                      style={[
                        styles.tile,
                        { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                        showGreen      && styles.tileCorrect,
                        showRed        && styles.tileWrong,
                        showHintOnTile && styles.tileHint,
                      ]}
                    >
                      <Text style={[styles.tileText, { color: theme.headingText }]}>{tile.text}</Text>
                      {showGreen && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
                      {showRed   && <Ionicons name="close-circle"     size={20} color="#FF4D6D" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {!loading && !error && completed && (
            <View style={styles.content}>
              <Animated.Text style={[styles.stars, { transform: [{ scale: starScale }] }]}>
                ⭐⭐⭐
              </Animated.Text>

              <View style={[styles.completeCard, { backgroundColor: theme.cardSurface }]}>
                <View style={[styles.iconCircle, { backgroundColor: '#22C55E' }]}>
                  <Ionicons name="trophy" size={32} color="#FFF" />
                </View>
                <Text style={[styles.completeHeading, { color: theme.headingText }]}>
                  Great Job! 🎉
                </Text>
                <Text style={[styles.completeSubtext, { color: theme.headingText }]}>
                  You finished the {categoryLabel.toLowerCase()} evaluation!
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.button }]}
                onPress={() => navigation.navigate('EvaluationMenu', { student })}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: theme.buttonText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </View>

      {/* GIF feedback popup — same slide-in-from-right pattern as
          ConceptActivityScreen.js */}
      <Animated.View
        pointerEvents="none"
        style={[styles.gifPopup, { transform: [{ translateX: feedbackSlide }] }]}
      >
        {feedback && (
          <ExpoImage
            source={feedback === 'correct' ? CORRECT_GIF : WRONG_GIF}
            style={styles.gifImage}
            contentFit="contain"
          />
        )}
      </Animated.View>

      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onDismiss={() => setShowGate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  body: { flex: 1 },
  safe: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: '#FF4D6D',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Layout.spacing.lg,
  },

  sceneWrap: {
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    marginBottom: Layout.spacing.xl,
    ...Layout.shadow.md,
  },
  sceneImg: { width: '100%', height: '100%' },

  tilesRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Layout.spacing.md,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.xl,
    borderRadius: Layout.radius.xl,
    borderWidth: 2,
    minWidth: 110,
    justifyContent: 'center',
    ...Layout.shadow.sm,
  },
  tileCorrect: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  tileWrong:   { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  // Soft-yellow hint after a second wrong tap — points at the correct tile
  // without giving it away as loudly as the green "correct" state.
  tileHint:    { backgroundColor: '#FEF9C3', borderColor: '#EAB308' },
  tileText:    { fontSize: Layout.fontSize.lg, fontWeight: '800' },

  stars: {
    fontSize: 48,
    letterSpacing: 4,
    marginTop: Layout.spacing.xxl,
  },
  completeCard: {
    width: '100%',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.xl,
    alignItems: 'center',
    gap: Layout.spacing.md,
    marginTop: Layout.spacing.lg,
    ...Layout.shadow.lg,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeHeading: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: '900',
    textAlign: 'center',
  },
  completeSubtext: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.75,
  },
  primaryBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    marginTop: Layout.spacing.xl,
    ...Layout.shadow.md,
  },
  primaryBtnText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
  },

  // Slides in from the right edge, vertically centred (same technique as
  // ConceptActivityScreen.js's gifPopup).
  gifPopup: {
    position: 'absolute',
    right: 24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  gifImage: {
    width: 200,
    height: 200,
  },
});
