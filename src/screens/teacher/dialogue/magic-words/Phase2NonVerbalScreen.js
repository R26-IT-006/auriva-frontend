import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';

const PROGRESS_FRACTION = 0.90;

const WORD_DISPLAY = {
  thank_you:        'Thank You',
  im_sorry:         "I'm Sorry",
  youre_welcome:    "You're Welcome",
  excuse_me: 'Excuse Me',
};

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

const NV_IMAGES = {
  thank_you: {
    correct: require('../../../../../assets/dialogue-images/Non-verbal/thankyou_NV_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-images/Non-verbal/thankyou_NV_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/Non-verbal/thankyou_NV_wrong2.png'),
  },
  im_sorry: {
    correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
  // youre_welcome uses comic-strip images stacked vertically
  youre_welcome: {
    correct: require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong2.png'),
  },
  excuse_me: {
    correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
  },
};

// Image captions per word — update once artwork filenames are confirmed
const NV_CAPTIONS = {
  thank_you:        ['Anjalie receives\na present',  'Saman is reading\na book',  'Anjalie and Saman are\nplaying'],
  im_sorry:         ['Saman bumps into\nAnjalie',    'They are drawing\ntogether',  'Anjalie is eating\nher lunch'],
  youre_welcome:    ["Anjalie says\n'Thank you'",    'Anjalie is sleeping',         'They are running\noutside'],
  excuse_me:        ['Saman needs to\npass by',     'Anjalie is drawing',          'Saman is playing\nwith toys'],
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Phase2NonVerbalScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you', wordId, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth } = useWindowDimensions();
  // comic-strip words use a full-width vertical layout
  const isVerticalLayout = wordKey === 'youre_welcome';
  // horizontal: 3 equal cards; vertical: full content width
  const cardW = isVerticalLayout
    ? screenWidth - 2 * Layout.spacing.lg
    : Math.min(Math.floor((screenWidth - 64) / 3), 200);

  const nvImages = NV_IMAGES[wordKey] ?? NV_IMAGES.thank_you;
  const captions = NV_CAPTIONS[wordKey] ?? NV_CAPTIONS.thank_you;

  // Build and shuffle the 3 image items once on mount
  const imageItems = useMemo(() => shuffleArray([
    { id: 'correct', image: nvImages.correct, caption: captions[0], isCorrect: true  },
    { id: 'wrong1',  image: nvImages.wrong1,  caption: captions[1], isCorrect: false },
    { id: 'wrong2',  image: nvImages.wrong2,  caption: captions[2], isCorrect: false },
  ]), []);

  const [cloudText,        setCloudText]        = useState('');
  const [selectedId,       setSelectedId]       = useState(null);
  const [wrongCount,       setWrongCount]       = useState(0);
  const [correctRevealed,  setCorrectRevealed]  = useState(false);
  const [settled,          setSettled]          = useState(false);
  const [showGate,         setShowGate]         = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);

  const soundRef      = useRef(null);
  const activeRef     = useRef(true);
  const apiCalledRef  = useRef(false);
  const settingsFade  = useRef(new Animated.Value(0)).current;
  const [gatePurpose, setGatePurpose] = useState('settings');

  function goBackSmart() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackSmart();
      return true;
    });
    return () => {
      activeRef.current = false;
      sub.remove();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []));

  async function playSound(source) {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
      await new Promise(resolve => {
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            sound.setOnPlaybackStatusUpdate(null);
            resolve();
          }
        });
      });
    } catch { /* ignore */ }
  }

  function goToPhase3(imageSelectedCorrect) {
    if (!apiCalledRef.current) {
      apiCalledRef.current = true;
      dialogueApi.recordPhase2Nonverbal(
        student?.sid, wordId,
        { imageSelectedCorrect, sessionId }
      ).catch(() => {});
    }
    setTimeout(() => {
      if (activeRef.current) {
        navigation.navigate('Phase3Contextual', {
          student, wordKey, wordId, wordLabel, sessionId,
        });
      }
    }, 1800);
  }

  async function handleImageTap(item) {
    if (settled) return;
    setSelectedId(item.id);

    if (item.isCorrect) {
      setSettled(true);
      setCloudText('Good job!');
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
      goToPhase3(true);
    } else {
      const newCount = wrongCount + 1;
      setWrongCount(newCount);

      if (newCount === 1) {
        setCloudText('Try again!');
        setTimeout(() => {
          if (activeRef.current) setSelectedId(null);
        }, 1200);
      } else if (newCount === 2) {
        setCloudText('Look carefully!');
        setTimeout(() => {
          if (activeRef.current) setSelectedId(null);
        }, 1200);
      } else {
        // 3rd wrong — reveal correct answer then proceed
        setSettled(true);
        setCorrectRevealed(true);
        setCloudText("Let's keep going!");
        goToPhase3(false);
      }
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      navigation.navigate('DialogueCategory', { student });
      return;
    }
    setShowSettings(true);
    Animated.timing(settingsFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function closeSettings() {
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setShowSettings(false)
    );
  }

  function handleSkipWord() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={goBackSmart} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.levelLabel, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            <Text style={[styles.title, { color: theme.headingText }]}>
              {"Where do we say '"}
              <Text style={{ color: theme.button, fontWeight: Layout.fontWeight.extrabold }}>
                {wordLabel}
              </Text>
              {"'?"}
            </Text>

            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Look at the pictures and tap the correct scene
            </Text>

            {/* ── 3 image cards ── */}
            {isVerticalLayout ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.cardsColumn}
                showsVerticalScrollIndicator={false}
              >
                {imageItems.map(item => {
                  const isSelected        = selectedId === item.id;
                  const isRevealedCorrect = correctRevealed && item.isCorrect;
                  const showGreenBorder   = (isSelected && item.isCorrect) || isRevealedCorrect;
                  const showRedDim        = isSelected && !item.isCorrect && !settled;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleImageTap(item)}
                      activeOpacity={settled ? 1 : 0.82}
                      style={[
                        styles.imageCard,
                        { width: cardW, backgroundColor: theme.cardSurface },
                        showGreenBorder && styles.cardCorrect,
                        showRedDim      && styles.cardWrong,
                      ]}
                    >
                      <View style={styles.imageWrapVertical}>
                        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
                        {showGreenBorder && (
                          <View style={styles.correctBadge}>
                            <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardCaption, { color: theme.headingText }]} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.cardsRow}>
                {imageItems.map(item => {
                  const isSelected        = selectedId === item.id;
                  const isRevealedCorrect = correctRevealed && item.isCorrect;
                  const showGreenBorder   = (isSelected && item.isCorrect) || isRevealedCorrect;
                  const showRedDim        = isSelected && !item.isCorrect && !settled;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleImageTap(item)}
                      activeOpacity={settled ? 1 : 0.82}
                      style={[
                        styles.imageCard,
                        { width: cardW, backgroundColor: theme.cardSurface },
                        showGreenBorder && styles.cardCorrect,
                        showRedDim      && styles.cardWrong,
                      ]}
                    >
                      <View style={[styles.imageWrap, { height: cardW }]}>
                        <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
                        {showGreenBorder && (
                          <View style={styles.correctBadge}>
                            <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardCaption, { color: theme.headingText }]} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!isVerticalLayout && <View style={{ flex: 1 }} />}

            {/* ── Avatar row ── */}
            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={styles.speechBubble}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={[styles.bubbleTail, { borderTopColor: '#FFFFFF' }]} />
                </View>
              ) : null}
              <Image source={avatarImg} style={styles.avatarImg} resizeMode="contain" />
            </View>

          </View>
        </SafeAreaView>
      </View>

      {/* ── Parent Gate ── */}
      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onDismiss={() => setShowGate(false)}
      />

      {/* ── Settings Sheet ── */}
      {showSettings && (
        <Animated.View style={[styles.settingsOverlay, { opacity: settingsFade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSettings} />
          <View style={styles.settingsSheet}>
            <Text style={styles.settingsTitle}>Session Options</Text>
            <TouchableOpacity style={styles.settingsOption} onPress={handleSkipWord}>
              <Ionicons name="play-skip-forward-outline" size={22} color="#333" />
              <Text style={styles.settingsOptionText}>Skip this word</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsOption} onPress={handleExitSession}>
              <Ionicons name="exit-outline" size={22} color="#E53E3E" />
              <Text style={[styles.settingsOptionText, { color: '#E53E3E' }]}>Exit session</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },

  /* Header */
  headerWrap: { zIndex: 10 },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  headerSide:   { width: 32, alignItems: 'center' },
  levelLabel: {
    fontSize:   Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  progressTrack: {
    flex:            1,
    height:          6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius:    Layout.radius.full,
    overflow:        'hidden',
  },
  progressFill: {
    height:       6,
    borderRadius: Layout.radius.full,
  },

  /* Body */
  body:    { flex: 1 },
  safe:    { flex: 1 },
  content: {
    flex:              1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.lg,
    paddingBottom:     Layout.spacing.md,
  },

  title: {
    fontSize:   Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    textAlign:  'center',
    marginBottom: Layout.spacing.xs,
  },
  subtitle: {
    fontSize:    Layout.fontSize.sm,
    textAlign:   'center',
    opacity:     0.65,
    marginBottom: Layout.spacing.xs,
  },
  subtitleSinhala: {
    fontSize:     Layout.fontSize.sm,
    textAlign:    'center',
    opacity:      0.65,
    marginBottom: Layout.spacing.xl,
  },

  /* Cards */
  cardsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            Layout.spacing.sm,
  },
  cardsColumn: {
    gap:         Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
  },
  imageCard: {
    borderRadius:  Layout.radius.lg,
    overflow:      'hidden',
    borderWidth:   2,
    borderColor:   'transparent',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     3,
  },
  cardCorrect: {
    borderColor: '#22C55E',
    borderWidth: 3,
  },
  cardWrong: {
    borderColor: '#FF4D6D',
    borderWidth: 2,
    opacity:     0.65,
  },
  imageWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  imageWrapVertical: {
    position:  'relative',
    overflow:  'hidden',
    width:     '100%',
    aspectRatio: 16 / 9,
  },
  cardImage: {
    width:  '100%',
    height: '100%',
  },
  correctBadge: {
    position:        'absolute',
    top:             6,
    right:           6,
    backgroundColor: '#FFF',
    borderRadius:    12,
  },
  cardCaption: {
    fontSize:   Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textAlign:  'center',
    paddingHorizontal: Layout.spacing.xs,
    paddingVertical:   Layout.spacing.sm,
  },

  /* Avatar */
  avatarRow: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'flex-end',
    marginTop:      Layout.spacing.md,
  },
  bubbleWrap: {
    alignItems:    'flex-end',
    marginBottom:  6,
    marginRight:   -4,
  },
  speechBubble: {
    backgroundColor:  '#FFFFFF',
    borderRadius:     Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    maxWidth:         160,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.10,
    shadowRadius:     4,
    elevation:        2,
  },
  speechText: {
    fontSize:   Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    textAlign:  'center',
  },
  bubbleTail: {
    alignSelf:   'flex-end',
    marginRight: 24,
    width:       0,
    height:      0,
    borderLeftWidth:  8,
    borderRightWidth: 8,
    borderTopWidth:   10,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    borderTopColor:   '#FFFFFF',
  },
  avatarImg: {
    width:  115,
    height: 135,
  },

  /* Settings */
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  settingsSheet: {
    backgroundColor:   '#FFF',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:           Layout.spacing.xl,
    paddingBottom:     Layout.spacing.xxl,
  },
  settingsTitle: {
    fontSize:    Layout.fontSize.md,
    fontWeight:  '700',
    color:       '#333',
    marginBottom: Layout.spacing.lg,
    textAlign:   'center',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  settingsOptionText: {
    fontSize:   Layout.fontSize.md,
    fontWeight: '600',
    color:      '#333',
  },
  settingsDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical:  4,
  },
});
