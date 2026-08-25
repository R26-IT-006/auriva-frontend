import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';

// Non-verbal context images — every abilities word folder has its own
// Non_Verbal.jpg (difficulty 1 and 2 both). `correct` is the tapped word's
// own photo; wrong1/wrong2 borrow OTHER words' own Non_Verbal.jpg as decoys,
// rotated through the full word order so no word repeats its distractor pair.
function cat3NvFolder(wordKey) {
  if (wordKey === 'cat3_yes') return 'yes';
  if (wordKey === 'cat3_no')  return 'no';
  return wordKey;
}
function cat3NvImage(wordKey) {
  const folder = cat3NvFolder(wordKey);
  const images = {
    yes:   require('../../../../../assets/dialogue-images/words/abilities/yes/Non_Verbal.jpg'),
    no:    require('../../../../../assets/dialogue-images/words/abilities/no/Non_Verbal.jpg'),
    clap:  require('../../../../../assets/dialogue-images/words/abilities/clap/Non_Verbal.jpg'),
    run:   require('../../../../../assets/dialogue-images/words/abilities/run/Non_Verbal.jpg'),
    walk:  require('../../../../../assets/dialogue-images/words/abilities/walk/Non_Verbal.jpg'),
    jump:  require('../../../../../assets/dialogue-images/words/abilities/jump/Non_Verbal.jpg'),
    talk:  require('../../../../../assets/dialogue-images/words/abilities/talk/Non_Verbal.jpg'),
    dance: require('../../../../../assets/dialogue-images/words/abilities/dance/Non_Verbal.jpg'),
    sing:  require('../../../../../assets/dialogue-images/words/abilities/sing/Non_Verbal.jpg'),
    brush: require('../../../../../assets/dialogue-images/words/abilities/brush/Non_Verbal.jpg'),
    wash:  require('../../../../../assets/dialogue-images/words/abilities/wash/Non_Verbal.jpg'),
    eat:   require('../../../../../assets/dialogue-images/words/abilities/eat/Non_Verbal.jpg'),
    drink: require('../../../../../assets/dialogue-images/words/abilities/drink/Non_Verbal.jpg'),
    write: require('../../../../../assets/dialogue-images/words/abilities/write/Non_Verbal.jpg'),
    play:  require('../../../../../assets/dialogue-images/words/abilities/play/Non_Verbal.jpg'),
    sleep: require('../../../../../assets/dialogue-images/words/abilities/sleep/Non_Verbal.jpg'),
    watch: require('../../../../../assets/dialogue-images/words/abilities/watch/Non_Verbal.jpg'),
  };
  return images[folder];
}
const CAT3_NV_ORDER = [
  'cat3_yes', 'cat3_no', 'clap', 'run', 'walk', 'jump', 'talk', 'dance', 'sing',
  'brush', 'wash', 'eat', 'drink', 'write', 'play', 'sleep', 'watch',
];
const CAT3_NV = Object.fromEntries(CAT3_NV_ORDER.map((key, i) => {
  const wrong1Key = CAT3_NV_ORDER[(i + 1) % CAT3_NV_ORDER.length];
  const wrong2Key = CAT3_NV_ORDER[(i + 2) % CAT3_NV_ORDER.length];
  return [key, {
    correct: cat3NvImage(key),
    wrong1:  cat3NvImage(wrong1Key),
    wrong2:  cat3NvImage(wrong2Key),
  }];
}));

const PROGRESS_FRACTION = 0.82;

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

function getNVImages(wordKey) {
  return CAT3_NV[wordKey] ?? null;
}

// Caption text mirrors the CAT3_NV_ORDER rotation above, so a word's caption
// list always describes the same three photos as its images list.
const NV_CAPTION_TEXT = {
  cat3_yes: 'Saying yes!',
  cat3_no:  'Saying no!',
  clap:     'Clapping hands',
  run:      'Running fast',
  walk:     'Walking along',
  jump:     'Jumping up high',
  talk:     'Talking to someone',
  dance:    'Dancing around',
  sing:     'Singing a song',
  brush:    'Brushing your teeth',
  wash:     'Washing your hands',
  eat:      'Eating your food',
  drink:    'Drinking some water',
  write:    'Writing a letter',
  play:     'Playing with toys',
  sleep:    'Sleeping soundly',
  watch:    'Watching TV',
};
const NV_CAPTIONS = Object.fromEntries(CAT3_NV_ORDER.map((key, i) => {
  const wrong1Key = CAT3_NV_ORDER[(i + 1) % CAT3_NV_ORDER.length];
  const wrong2Key = CAT3_NV_ORDER[(i + 2) % CAT3_NV_ORDER.length];
  return [key, [NV_CAPTION_TEXT[key], NV_CAPTION_TEXT[wrong1Key], NV_CAPTION_TEXT[wrong2Key]]];
}));

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Cat3Phase2NonVerbalScreen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? wordKey ?? '';
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const nvImages = getNVImages(wordKey);
  const captions = NV_CAPTIONS[wordKey] ?? ['Correct scene', 'Wrong scene 1', 'Wrong scene 2'];

  const imageItems = useMemo(() => {
    if (!nvImages?.correct) return [];
    return shuffleArray([
      { id: 'correct', image: nvImages.correct, caption: captions[0], isCorrect: true  },
      { id: 'wrong1',  image: nvImages.wrong1,  caption: captions[1], isCorrect: false },
      { id: 'wrong2',  image: nvImages.wrong2,  caption: captions[2], isCorrect: false },
    ]);
  }, []);

  const [cloudText,       setCloud]       = useState('');
  const [selectedId,      setSelectedId]  = useState(null);
  const [wrongCount,      setWrongCount]  = useState(0);
  const [correctRevealed, setCorrectRev]  = useState(false);
  const [settled,         setSettled]     = useState(false);
  const [showGate,        setShowGate]    = useState(false);
  const [showSettings,    setShowSettings]= useState(false);

  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const apiCalledRef = useRef(false);
  const settingsFade = useRef(new Animated.Value(0)).current;
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
      await new Promise(resolve => {
        sound.setOnPlaybackStatusUpdate(s => {
          if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); }
        });
      });
    } catch { /* ignore */ }
  }

  function goToPhase3(tapCorrect) {
    if (!apiCalledRef.current) {
      apiCalledRef.current = true;
      cat3Api.recordPhase2NonVerbal(student?.sid, wordId, tapCorrect, sessionId).catch(() => {});
    }
    setTimeout(() => {
      if (activeRef.current) {
        navigation.navigate('Cat3Phase3', { student, wordId, wordKey, wordLabel, sessionId });
      }
    }, 1600);
  }

  async function handleImageTap(item) {
    if (settled) return;
    setSelectedId(item.id);

    if (item.isCorrect) {
      setSettled(true);
      setCloud('Good job!');
      await playSound(AUDIO_GOOD_JOB);
      goToPhase3(true);
    } else {
      const n = wrongCount + 1;
      setWrongCount(n);
      if (n === 1) {
        setCloud('Try again!');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else if (n === 2) {
        setCloud('Look carefully!');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else {
        setSettled(true);
        setCorrectRev(true);
        setCloud("Let's keep going!");
        goToPhase3(false);
      }
    }
  }

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
      () => setShowSettings(false),
    );
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  // Fallback if no images available — auto-advance to Phase 3
  if (imageItems.length === 0) {
    cat3Api.recordPhase2NonVerbal(student?.sid, wordId, false, sessionId).catch(() => {});
    navigation.navigate('Cat3Phase3', { student, wordId, wordKey, wordLabel, sessionId });
    return null;
  }

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
              {'Show me '}
              <Text style={{ color: theme.button, fontWeight: '900' }}>{wordLabel}</Text>
              {'!'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Tap the picture that matches
            </Text>

            <View style={styles.cardsRow}>
              {imageItems.map(item => {
                const isSelected        = selectedId === item.id;
                const isRevealedCorrect = correctRevealed && item.isCorrect;
                const showGreen         = (isSelected && item.isCorrect) || isRevealedCorrect;
                const showRed           = isSelected && !item.isCorrect && !settled;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleImageTap(item)}
                    activeOpacity={settled ? 1 : 0.82}
                    style={[
                      styles.imageCard,
                      { backgroundColor: theme.cardSurface },
                      showGreen && styles.cardCorrect,
                      showRed   && styles.cardWrong,
                    ]}
                  >
                    <View style={styles.imageWrap}>
                      <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
                      {showGreen && (
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

            <View style={{ flex: 1 }} />

            {/* Avatar + bubble */}
            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={styles.speechBubble}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={styles.bubbleTail} />
                </View>
              ) : null}
              <Image source={avatarImg} style={styles.avatarImg} resizeMode="contain" />
            </View>

          </View>
        </SafeAreaView>
      </View>

      {/* ── Parent Gate ── */}
      <ParentGateModal visible={showGate} onSuccess={onGateSuccess} onCancel={() => setShowGate(false)} />

      {/* ── Settings Sheet ── */}
      <Modal visible={showSettings} transparent animationType="none" onRequestClose={closeSettings}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={closeSettings}>
          <Animated.View style={[styles.settingsSheet, { opacity: settingsFade }]}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.settingsTitle}>Session Options</Text>
              <TouchableOpacity style={styles.settingsOption} onPress={handleExitSession} activeOpacity={0.7}>
                <Ionicons name="exit-outline" size={20} color="#FF4D6D" />
                <Text style={[styles.settingsOptionText, { color: '#FF4D6D' }]}>Exit session</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {},
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  levelLabel:    { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  progressTrack: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },

  content: { flex: 1, paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.lg, paddingBottom: Layout.spacing.md },

  title:    { fontSize: Layout.fontSize.xl, fontWeight: '700', textAlign: 'center', marginBottom: Layout.spacing.xs },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },

  cardsRow: { flexDirection: 'row', justifyContent: 'center', gap: Layout.spacing.md },

  imageCard: {
    flex:         1,
    borderRadius: Layout.radius.xl,
    overflow:     'hidden',
    borderWidth:  2,
    borderColor:  'transparent',
    ...Layout.shadow.md,
  },
  cardCorrect: { borderColor: '#22C55E', borderWidth: 3 },
  cardWrong:   { borderColor: '#FF4D6D', borderWidth: 2, opacity: 0.65 },

  imageWrap: { position: 'relative', width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  correctBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFF', borderRadius: 14 },

  cardCaption: {
    fontSize:    Layout.fontSize.md,
    fontWeight:  '700',
    textAlign:   'center',
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical:   Layout.spacing.md,
  },

  avatarRow:  { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 6, marginRight: -4 },
  speechBubble: {
    backgroundColor:   '#FFFFFF',
    borderRadius:      Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    maxWidth:          160,
    ...Layout.shadow.sm,
  },
  speechText: { fontSize: Layout.fontSize.sm, fontWeight: '700', textAlign: 'center' },
  bubbleTail: {
    alignSelf:       'flex-end',
    marginRight:     24,
    width:           0,
    height:          0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },
  avatarImg: { width: 115, height: 135 },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl },
  settingsTitle:   { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
});
