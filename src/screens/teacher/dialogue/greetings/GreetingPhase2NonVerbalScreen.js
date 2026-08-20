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
  hello:          'Hello',
  goodbye:        'Goodbye',
  good_morning:   'Good Morning',
  good_afternoon: 'Good Afternoon',
  good_night:     'Good Night',
  happy_birthday: 'Happy Birthday',
  how_are_you:    'How Are You?',
  im_fine:        "I'm Fine",
  happy_new_year: 'Happy New Year',
};

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

// Non-verbal pathway images are not yet available.
// Using context images as placeholders until dedicated NV assets arrive.
const NV_IMAGES = {
  hello: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  goodbye: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong2.png'),
  },
  good_morning: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong2.png'),
  },
  good_afternoon: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  good_night: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  happy_birthday: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  how_are_you: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  im_fine: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
  happy_new_year: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
  },
};

const NV_CAPTIONS = {
  hello:          ['Friends greeting\neach other',        'A child saying\nGoodbye',            'A child eating\nlunch'],
  goodbye:        ['Waving goodbye\nat the door',         'Playing at\nthe park',               'Eating dinner\ntogether'],
  good_morning:   ['Morning greeting\nat school',         'Playing in\nthe evening',            'Reading a book\nat night'],
  good_afternoon: ['Afternoon greeting\nafter school',    'Having breakfast\nin the morning',   'Playing outside\nat night'],
  good_night:     ['Going to bed\nat night',              'Playing in\nthe morning',            'Having lunch\ntogether'],
  happy_birthday: ['Birthday party\nwith friends',        'Eating lunch\ntogether',             'Playing football\noutside'],
  how_are_you:    ['Asking a friend\nhow they are',       'Playing alone\noutside',             'Eating dinner\nquietly'],
  im_fine:        ['Answering happily\n"I\'m Fine"',      'Running outside\nalone',             'Reading a\nstorybook'],
  happy_new_year: ['New Year\ncelebration',               'Playing in\nthe garden',             'Eating breakfast\nalone'],
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GreetingPhase2NonVerbalScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth } = useWindowDimensions();
  const cardW = Math.min(Math.floor((screenWidth - 64) / 3), 200);

  const nvImages = NV_IMAGES[wordKey] ?? NV_IMAGES.hello;
  const captions = NV_CAPTIONS[wordKey] ?? NV_CAPTIONS.hello;

  const imageItems = useMemo(() => shuffleArray([
    { id: 'correct', image: nvImages.correct, caption: captions[0], isCorrect: true  },
    { id: 'wrong1',  image: nvImages.wrong1,  caption: captions[1], isCorrect: false },
    { id: 'wrong2',  image: nvImages.wrong2,  caption: captions[2], isCorrect: false },
  ]), []);

  const [cloudText,       setCloudText]       = useState('');
  const [selectedId,      setSelectedId]      = useState(null);
  const [wrongCount,      setWrongCount]      = useState(0);
  const [correctRevealed, setCorrectRevealed] = useState(false);
  const [settled,         setSettled]         = useState(false);
  const [showGate,        setShowGate]        = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [gatePurpose,     setGatePurpose]     = useState('settings');

  const soundRef      = useRef(null);
  const activeRef     = useRef(true);
  const apiCalledRef  = useRef(false);
  const settingsFade  = useRef(new Animated.Value(0)).current;

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
        navigation.navigate('GreetingPhase3Contextual', {
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
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else if (newCount === 2) {
        setCloudText('Look carefully!');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else {
        setSettled(true);
        setCorrectRevealed(true);
        setCloudText("Let's keep going!");
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

  return (
    <View style={styles.root}>
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

            <View style={{ flex: 1 }} />

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

      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onDismiss={() => setShowGate(false)}
      />

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
  root: { flex: 1 },

  headerWrap: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  headerSide: { width: 32, alignItems: 'center' },
  levelLabel: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: Layout.radius.full },

  body: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },

  title: { fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.bold, textAlign: 'center', marginBottom: Layout.spacing.xs },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xs },
  subtitleSinhala: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },

  cardsRow: { flexDirection: 'row', justifyContent: 'center', gap: Layout.spacing.sm },
  imageCard: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCorrect: { borderColor: '#22C55E', borderWidth: 3 },
  cardWrong:   { borderColor: '#FF4D6D', borderWidth: 2, opacity: 0.65 },
  imageWrap:   { position: 'relative', overflow: 'hidden' },
  cardImage:   { width: '100%', height: '100%' },
  correctBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  cardCaption: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.xs,
    paddingVertical: Layout.spacing.sm,
  },

  avatarRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 6, marginRight: -4 },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  speechText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, textAlign: 'center' },
  bubbleTail: {
    alignSelf: 'flex-end',
    marginRight: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  avatarImg: { width: 115, height: 135 },

  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: 4 },
});
