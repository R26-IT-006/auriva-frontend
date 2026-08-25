import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { evaluationApi } from '../../../../api/evaluation';

const PLACEHOLDER_IMAGE = require('../../../../../assets/dialogue-images/placeholder.png');

const CATEGORY_LABEL = {
  greetings:    'Greetings',
  magic_words:  'Magic Words',
  abilities:    'Can You?',
};

// "Match picture" per word, keyed by asset_key — the same field the
// evaluation-build API returns. Every word folder now has its own
// Non_Verbal.jpg (uploaded 2026-08-26), so each word gets its own real photo
// instead of a shared placeholder — the matching game itself already
// supplies the "distractor" element (every other word's picture is visible
// in the same list), so no wrong1/wrong2 rotation is needed here, unlike the
// non-verbal multiple-choice screens.
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

  // Abilities (difficulty 1 and 2 both)
  // can_you/yes_i_can/no_i_cant/i_can removed 2026-08-16 — those words were
  // retired (not taught, asset folders deleted); their entries here were
  // dead the moment those words stopped existing in dialogue_words.
  cat3_yes:   require('../../../../../assets/dialogue-images/words/abilities/yes/Non_Verbal.jpg'),
  cat3_no:    require('../../../../../assets/dialogue-images/words/abilities/no/Non_Verbal.jpg'),
  clap:       require('../../../../../assets/dialogue-images/words/abilities/clap/Non_Verbal.jpg'),
  run:        require('../../../../../assets/dialogue-images/words/abilities/run/Non_Verbal.jpg'),
  walk:       require('../../../../../assets/dialogue-images/words/abilities/walk/Non_Verbal.jpg'),
  jump:       require('../../../../../assets/dialogue-images/words/abilities/jump/Non_Verbal.jpg'),
  talk:       require('../../../../../assets/dialogue-images/words/abilities/talk/Non_Verbal.jpg'),
  dance:      require('../../../../../assets/dialogue-images/words/abilities/dance/Non_Verbal.jpg'),
  sing:       require('../../../../../assets/dialogue-images/words/abilities/sing/Non_Verbal.jpg'),
  brush:      require('../../../../../assets/dialogue-images/words/abilities/brush/Non_Verbal.jpg'),
  wash:       require('../../../../../assets/dialogue-images/words/abilities/wash/Non_Verbal.jpg'),
  eat:        require('../../../../../assets/dialogue-images/words/abilities/eat/Non_Verbal.jpg'),
  drink:      require('../../../../../assets/dialogue-images/words/abilities/drink/Non_Verbal.jpg'),
  write:      require('../../../../../assets/dialogue-images/words/abilities/write/Non_Verbal.jpg'),
  play:       require('../../../../../assets/dialogue-images/words/abilities/play/Non_Verbal.jpg'),
  sleep:      require('../../../../../assets/dialogue-images/words/abilities/sleep/Non_Verbal.jpg'),
  watch:      require('../../../../../assets/dialogue-images/words/abilities/watch/Non_Verbal.jpg'),
};

// Standard word-pronunciation audio, reused from each category's Phase 2
// WORD_AUDIO maps (Phase2ProductionScreen.js / GreetingPhase2ProductionScreen.js /
// Cat3Phase2Screen.js). Only words with a REAL (non-placeholder) recording are
// included — several greetings words fall back to a borrowed "Thank you" clip
// in their own Phase 2 screen, which would be actively misleading here, so
// those are intentionally left out; tapping them just skips audio.
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

const LINE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6'];

const ROW_HEIGHT = 60;
const ROW_GAP    = 14;
const ROW_STEP   = ROW_HEIGHT + ROW_GAP;
const COL_GAP    = 36;

function rowCenterY(index) {
  return index * ROW_STEP + ROW_HEIGHT / 2;
}

export default function EvaluationMatchScreen({ route, navigation }) {
  const { student, category } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const categoryLabel = CATEGORY_LABEL[category] ?? category;

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [words,     setWords]     = useState([]);
  const [images,    setImages]    = useState([]);
  const [selectedWordId, setSelectedWordId] = useState(null);
  const [pairs,      setPairs]      = useState({}); // { [word_id]: chosen_word_id_for_image }
  const [confirming, setConfirming] = useState(false);
  const [completed,  setCompleted]  = useState(false);
  const [rowsWidth,  setRowsWidth]  = useState(0);
  const [showGate,   setShowGate]   = useState(false);

  const soundRef = useRef(null);
  const activeRef = useRef(true);
  const starScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await evaluationApi.build(student.sid, category);
        if (!active) return;
        setWords(data.words ?? []);
        setImages(data.images ?? []);
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
    };
  }, []));

  useEffect(() => {
    if (completed) {
      Animated.spring(starScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }).start();
    }
  }, [completed]);

  const assetKeyByWordId = useMemo(
    () => Object.fromEntries(images.map((im) => [im.word_id, im.asset_key])),
    [images]
  );

  function imageSourceFor(wordId) {
    const assetKey = assetKeyByWordId[wordId];
    return EVAL_WORD_IMAGE[assetKey] ?? PLACEHOLDER_IMAGE;
  }

  const allMatched = words.length > 0 && Object.keys(pairs).length === words.length;

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

  function handleWordTap(wordId) {
    if (pairs[wordId] != null) {
      // Tapping a matched word unmatches it — self-correction, mirrors the
      // Phase 3 provisional-select philosophy.
      setPairs((prev) => {
        const next = { ...prev };
        delete next[wordId];
        return next;
      });
      if (selectedWordId === wordId) setSelectedWordId(null);
    } else {
      setSelectedWordId(wordId);
    }
    const assetKey = assetKeyByWordId[wordId];
    playSound(WORD_AUDIO_BY_KEY[assetKey]);
  }

  function handleImageTap(imgWordId) {
    if (selectedWordId == null) return;
    // Each picture can only be used once; if it's already claimed by a
    // different word, this tap is a no-op — unmatch that word first.
    const alreadyUsed = Object.values(pairs).includes(imgWordId);
    if (alreadyUsed) return;

    setPairs((prev) => ({ ...prev, [selectedWordId]: imgWordId }));
    setSelectedWordId(null);
  }

  async function handleConfirm() {
    if (!allMatched || confirming) return;
    setConfirming(true);

    const payload = Object.entries(pairs).map(([wordId, imgWordId]) => ({
      word_id: Number(wordId),
      chosen_word_id_for_image: imgWordId,
    }));

    try {
      await evaluationApi.record(student.sid, category, payload);
    } catch {
      // Never show a fail state to the child — the score lives only in the
      // API record for the teacher; if the POST fails the child still gets
      // the celebration, they just won't have a record of this attempt.
    }

    if (!activeRef.current) return;
    setConfirming(false);
    setCompleted(true);
  }

  function onGateSuccess() {
    setShowGate(false);
    navigation.navigate('EvaluationMenu', { student });
  }

  const leftColWidth  = rowsWidth > 0 ? (rowsWidth - COL_GAP) / 2 : 0;
  const rightColLeftX = leftColWidth + COL_GAP;

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

          {!loading && !error && !completed && (
            <View style={styles.content}>
              <Text style={[styles.title, { color: theme.headingText }]}>Match the Pictures</Text>
              <Text style={[styles.subtitle, { color: theme.headingText }]}>
                Tap a word, then tap its picture!
              </Text>

              <View
                style={styles.rowsArea}
                onLayout={(e) => setRowsWidth(e.nativeEvent.layout.width)}
              >
                {/* Connecting lines */}
                {rowsWidth > 0 && (
                  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                    {Object.entries(pairs).map(([wordId, imgWordId]) => {
                      const wIdx = words.findIndex((w) => w.word_id === Number(wordId));
                      const iIdx = images.findIndex((im) => im.word_id === imgWordId);
                      if (wIdx === -1 || iIdx === -1) return null;
                      const color = LINE_COLORS[wIdx % LINE_COLORS.length];
                      return (
                        <Line
                          key={wordId}
                          x1={leftColWidth}
                          y1={rowCenterY(wIdx)}
                          x2={rightColLeftX}
                          y2={rowCenterY(iIdx)}
                          stroke={color}
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </Svg>
                )}

                <View style={styles.rowsRow}>
                  {/* Words column */}
                  <View style={[styles.col, { width: leftColWidth || undefined }]}>
                    {words.map((w, idx) => {
                      const matched  = pairs[w.word_id] != null;
                      const selected = selectedWordId === w.word_id;
                      const color    = LINE_COLORS[idx % LINE_COLORS.length];
                      return (
                        <TouchableOpacity
                          key={w.word_id}
                          activeOpacity={0.8}
                          onPress={() => handleWordTap(w.word_id)}
                          style={[
                            styles.wordCard,
                            { height: ROW_HEIGHT, backgroundColor: theme.cardSurface },
                            selected && { borderColor: theme.button, borderWidth: 3 },
                            matched  && { borderColor: color, borderWidth: 3 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.wordText,
                              { color: theme.headingText },
                              (selected || matched) && styles.wordTextBold,
                            ]}
                            numberOfLines={2}
                          >
                            {w.text}
                          </Text>
                          {matched && (
                            <Ionicons name="checkmark-circle" size={18} color={color} style={styles.checkIcon} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ width: COL_GAP }} />

                  {/* Images column */}
                  <View style={[styles.col, { width: leftColWidth || undefined }]}>
                    {images.map((im, idx) => {
                      const pairedWordEntry = Object.entries(pairs).find(([, iw]) => iw === im.word_id);
                      const matched = !!pairedWordEntry;
                      const color = matched
                        ? LINE_COLORS[words.findIndex((w) => w.word_id === Number(pairedWordEntry[0])) % LINE_COLORS.length]
                        : null;
                      return (
                        <TouchableOpacity
                          key={im.word_id}
                          activeOpacity={0.8}
                          onPress={() => handleImageTap(im.word_id)}
                          style={[
                            styles.imageCard,
                            { height: ROW_HEIGHT, backgroundColor: theme.cardSurface },
                            matched && { borderColor: color, borderWidth: 3 },
                          ]}
                        >
                          <Image source={imageSourceFor(im.word_id)} style={styles.cardImage} resizeMode="contain" />
                          {matched && (
                            <Ionicons name="checkmark-circle" size={18} color={color} style={styles.checkIcon} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.actionRow}>
                {confirming ? (
                  <ActivityIndicator color={theme.button} />
                ) : allMatched ? (
                  <TouchableOpacity
                    style={[styles.confirmButton, { backgroundColor: theme.button }]}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark" size={18} color={theme.buttonText} />
                    <Text style={[styles.confirmButtonText, { color: theme.buttonText }]}>Confirm</Text>
                  </TouchableOpacity>
                ) : null}
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
                  You matched all the {categoryLabel.toLowerCase()} words!
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

  title: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Layout.fontSize.sm,
    textAlign: 'center',
    opacity: 0.65,
    marginBottom: Layout.spacing.lg,
  },

  rowsArea: {
    width: '100%',
    position: 'relative',
  },
  rowsRow: {
    flexDirection: 'row',
  },
  col: {
    gap: ROW_GAP,
  },

  wordCard: {
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.sm,
    ...Layout.shadow.sm,
  },
  wordText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  wordTextBold: {
    fontWeight: '900',
  },

  imageCard: {
    borderRadius: Layout.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Layout.shadow.sm,
  },
  cardImage: {
    width: '85%',
    height: '85%',
  },

  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },

  actionRow: {
    marginTop: Layout.spacing.xl,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  confirmButtonText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
  },

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
});
