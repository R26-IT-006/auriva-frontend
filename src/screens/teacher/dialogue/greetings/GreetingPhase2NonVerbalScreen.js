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
  lily:     require('../../../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../../../assets/avatar-images/MegatronCongratulations.png'),
  boba:     require('../../../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../../../assets/avatar-images/GlitterCongratulations.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

// Every word folder now has its own Non_Verbal.jpg — `correct` is the
// tapped word's own photo; wrong1/wrong2 borrow OTHER words' own
// Non_Verbal.jpg as decoys, same cross-word-distractor pattern used in
// ProbeRetentionCheckScreen.js / Cat3Phase2NonVerbalScreen.js.
const NV_IMAGES = {
  hello: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
  },
  goodbye: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
  },
  good_morning: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
  },
  good_afternoon: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
  },
  good_night: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
  },
  happy_birthday: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
  },
  how_are_you: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
  },
  im_fine: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
  },
  happy_new_year: {
    correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/Non_Verbal.jpg'),
    wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/Non_Verbal.jpg'),
    wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/Non_Verbal.jpg'),
  },
};

const NV_CAPTIONS = {
  hello:          ['Friends greeting\neach other',                    'Waving goodbye\nat the door',       'Greeting teacher\nin the morning'],
  goodbye:        ['Waving goodbye\nat the door',                     'Greeting teacher\nin the morning',  'Afternoon greeting\nafter school'],
  good_morning:   ['Greeting teacher\nin the morning',                'Afternoon greeting\nafter school',  'Going to bed\nat night'],
  good_afternoon: ['Afternoon greeting\nafter school',                'Going to bed\nat night',            'Birthday party\nwith friends'],
  good_night:     ['Going to bed\nat night',                          'Birthday party\nwith friends',      'Asking a friend\nhow they are feeling'],
  happy_birthday: ['Birthday party\nwith friends',                    'Asking a friend\nhow they are feeling', 'Answering happily\nwhen asked "How are you?"'],
  how_are_you:    ['Asking a friend\nhow they are feeling',           'Answering happily\nwhen asked "How are you?"', 'New Year\ncelebration with family'],
  im_fine:        ['Answering happily\nwhen asked "How are you?"',    'New Year\ncelebration with family', 'Friends greeting\neach other'],
  happy_new_year: ['New Year\ncelebration with family',               'Friends greeting\neach other',      'Waving goodbye\nat the door'],
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
  // The source photos are wide (landscape), so cards are sized for 2 per row
  // (wrapping a 3rd to its own centered row) instead of squeezing 3 into one
  // row and cropping them into near-squares.
  const cardW = Math.min(Math.floor((screenWidth - 64 - Layout.spacing.md) / 2), 380);
  // Explicit pixel height (not aspectRatio) so all three cards are always
  // exactly the same size, regardless of each source photo's own proportions.
  const cardImageH = Math.round(cardW * 3 / 4);

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
  const avatarPop     = useRef(new Animated.Value(0)).current;

  function popAvatar() {
    avatarPop.setValue(0);
    Animated.spring(avatarPop, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 10,
    }).start();
  }

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
      popAvatar();
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
      goToPhase3(true);
    } else {
      const newCount = wrongCount + 1;
      setWrongCount(newCount);

      if (newCount === 1) {
        setCloudText('Try again!');
        popAvatar();
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else if (newCount === 2) {
        setCloudText('Look carefully!');
        popAvatar();
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else {
        setSettled(true);
        setCorrectRevealed(true);
        setCloudText("Let's keep going!");
        popAvatar();
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
                    <View style={[styles.imageWrap, { height: cardImageH }]}>
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
              {cloudText ? (
                <Animated.Image
                  source={avatarImg}
                  resizeMode="contain"
                  style={[
                    styles.avatarImg,
                    {
                      opacity: avatarPop,
                      transform: [
                        { scale: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                        { translateY: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                      ],
                    },
                  ]}
                />
              ) : null}
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
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },
  subtitleSinhala: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },

  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Layout.spacing.md },
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
  imageWrap:   { position: 'relative', overflow: 'hidden', width: '100%' },
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

  avatarRow: { flexDirection: 'column', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { width: 145, alignItems: 'center', alignSelf: 'flex-end', marginBottom: 2 },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  speechText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, textAlign: 'center' },
  bubbleTail: {
    alignSelf: 'center',
    marginTop: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  avatarImg: { width: 145, height: 170 },

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
