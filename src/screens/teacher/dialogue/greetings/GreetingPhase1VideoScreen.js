import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';
import { DIALOGUE_WORD_ASSETS } from '../../../../constants/dialogueAssets';

const WORD_LABELS = {
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

// All 9 greetings words now have real word-pronunciation audio (2026-08-20).
const WORD_AUDIO = {
  hello:          require('../../../../../assets/dialogue-audios/greetings/hello.mp3'),
  goodbye:        require('../../../../../assets/dialogue-audios/greetings/goodbye.mp3'),
  good_morning:   require('../../../../../assets/dialogue-audios/greetings/good_morning.mp3'),
  good_afternoon: require('../../../../../assets/dialogue-audios/greetings/good_afternoon.mp3'),
  good_night:     require('../../../../../assets/dialogue-audios/greetings/good_night.mp3'),
  happy_birthday: require('../../../../../assets/dialogue-audios/greetings/happy_birthday.mp3'),
  how_are_you:    require('../../../../../assets/dialogue-audios/greetings/how_are_you.mp3'),
  im_fine:        require('../../../../../assets/dialogue-audios/greetings/im_fine.mp3'),
  happy_new_year: require('../../../../../assets/dialogue-audios/greetings/happy_new_year.mp3'),
};

// All 9 greetings words now have real V1/V2/V3 videos (2026-08-20) — no
// placeholders left. Filenames are not uniform (case/hyphenation vary per
// word, e.g. lowercase "happy-birthday", abbreviated "happy-new-yr") —
// verified against the actual files on disk, not assumed from convention.
const WORD_VIDEOS = {
  hello: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/hello/Hello_V1.mp4'), caption: 'Saman arrives at school.\nHe sees Anjalie and says "Hello"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/hello/Hello_V2.mp4'), caption: 'Anjalie meets her neighbour.\nShe says "Hello"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/hello/Hello_V3.mp4'), caption: 'Saman waves at a friend across the road.\nHe says "Hello"' },
  ],
  goodbye: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/goodbye/Goodbye_V1.mp4'), caption: 'School is over.\nAnjalie waves at her teacher and says "Goodbye"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/goodbye/Goodbye_V2.mp4'), caption: 'Saman leaves his friend\'s house.\nHe says "Goodbye"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/goodbye/Goodbye_V3.mp4'), caption: 'Anjalie\'s mum is going to work.\nShe says "Goodbye"' },
  ],
  good_morning: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_morning/Good-morning_V1.mp4'), caption: 'Saman arrives at school.\nHe greets his teacher: "Good Morning"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_morning/Good-morning_V2.mp4'), caption: 'Anjalie sees her parents at breakfast.\nShe says "Good Morning"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_morning/Good-morning_V3.mp4'), caption: 'Saman meets his friend at the park in the morning.\nHe says "Good Morning"' },
  ],
  good_afternoon: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_afternoon/Good-afternoon_V1.mp4'), caption: 'Anjalie comes home after school.\nShe greets her mum: "Good Afternoon"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_afternoon/Good-afternoon_V2.mp4'), caption: 'Saman meets his teacher after lunch.\nHe says "Good Afternoon"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_afternoon/Good-afternoon_V3.mp4'), caption: 'Anjalie sees a neighbour in the afternoon.\nShe says "Good Afternoon"' },
  ],
  good_night: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_night/Good-night_V1.mp4'), caption: 'It is bedtime.\nSaman hugs his mum and says "Good Night"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_night/Good-night_V2.mp4'), caption: 'Anjalie turns off her lamp.\nShe says "Good Night" to her dad' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/good_night/Good-night_V3.mp4'), caption: 'Saman calls his grandma before bed.\nHe says "Good Night"' },
  ],
  happy_birthday: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_birthday/happy-birthday_V1.mp4'), caption: 'It is Anjalie\'s birthday!\nSaman gives her a card and says "Happy Birthday"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_birthday/happy-birthday_V2.mp4'), caption: 'Anjalie\'s friends surprise her.\nThey all say "Happy Birthday"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_birthday/happy-birthday_V3.mp4'), caption: 'The class sings for Saman on his birthday.\nThey say "Happy Birthday"' },
  ],
  how_are_you: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/how_are_you/how-are-you_V1.mp4'), caption: 'Saman meets Anjalie on the way to school.\nHe asks "How Are You?"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/how_are_you/how-are-you_V2.mp4'), caption: 'Anjalie calls her friend on the phone.\nShe asks "How Are You?"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/how_are_you/how-are-you_V3.mp4'), caption: 'The teacher greets the class.\nShe says "How Are You?"' },
  ],
  im_fine: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/im_fine/im-fine_V1.mp4'), caption: 'Saman asks Anjalie "How are you?".\nShe smiles and says "I\'m Fine"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/im_fine/im-fine_V2.mp4'), caption: 'Anjalie\'s teacher asks how she is.\nShe answers "I\'m Fine"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/im_fine/im-fine_V3.mp4'), caption: 'Saman is asked about his day.\nHe replies "I\'m Fine"' },
  ],
  happy_new_year: [
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_new_year/happy-new-yr_V1.mp4'), caption: 'It is the new year!\nSaman wishes his family "Happy New Year"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_new_year/happy-new-yr_V2.mp4'), caption: 'Anjalie sends cards to her friends.\nShe writes "Happy New Year"' },
    { source: require('../../../../../assets/dialogue-videos/words/greetings/happy_new_year/happy-new-yr_V3.mp4'), caption: 'Fireworks light up the sky.\nEveryone shouts "Happy New Year"' },
  ],
};

function getVideos(wordKey) {
  return WORD_VIDEOS[wordKey] ?? WORD_VIDEOS.hello;
}

export default function GreetingPhase1VideoScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId, startIndex = 0 } = route.params ?? {};
  const theme  = getAvatarTheme(student?.avatar_key);
  const videos = getVideos(wordKey);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const maxByWidth  = screenWidth * 0.75;
  const maxByHeight = screenHeight * 0.55 * (4 / 3);
  const videoWidth  = Math.min(maxByWidth, maxByHeight);
  const videoHeight = videoWidth * (3 / 4);

  const [videoIndex,   setVideoIndex]   = useState(startIndex);
  const [hasFinished,  setHasFinished]  = useState(false);
  const [isPlaying,    setIsPlaying]    = useState(true);
  const [showReplay,   setShowReplay]   = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');
  const settingsFade = useRef(new Animated.Value(0)).current;
  const videoRef     = useRef(null);
  const current      = videos[videoIndex];

  useEffect(() => {
    setHasFinished(false);
    setIsPlaying(true);
    setShowReplay(false);
    if (wordId && student?.sid) {
      dialogueApi.recordPhase1Exposure(student.sid, wordId).catch(() => {});
    }
  }, [videoIndex]);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => { sub.remove(); };
  }, []));

  function onPlaybackStatusUpdate(status) {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setHasFinished(true);
      setIsPlaying(false);
      setShowReplay(true);
    }
  }

  async function togglePlayback() {
    if (!videoRef.current) return;
    if (showReplay || !isPlaying) {
      await videoRef.current.replayAsync();
      setShowReplay(false);
      setIsPlaying(true);
    } else {
      await videoRef.current.pauseAsync();
    }
  }

  function goBackSmart() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  function goBack() {
    if (videoIndex > startIndex) {
      setVideoIndex(videoIndex - 1);
    } else {
      goBackSmart();
    }
  }

  function goNext() {
    if (videoIndex < videos.length - 1) {
      setVideoIndex(videoIndex + 1);
    } else {
      navigation.navigate('AnimatedWord', {
        student,
        wordText: WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' '),
        wordImage: DIALOGUE_WORD_ASSETS[wordKey]?.scene,
        boldWordImage: DIALOGUE_WORD_ASSETS[wordKey]?.boldScene,
        wordAudio: WORD_AUDIO[wordKey],
        wordId,
        trackExposure: true,
        nextScreen: 'GreetingDragToLine',
        nextParams: { student, wordKey, wordId, attempt: 1 },
      });
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
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
      setShowSettings(false)
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

  const progressFraction = ((videoIndex + 1) / videos.length) * 0.6;
  const isLastVideo = videoIndex === videos.length - 1;

  return (
    <View style={styles.root}>
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressFraction * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            <View style={[styles.captionBox, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.caption, { color: theme.headingText }]}>
                {current.caption}
              </Text>
            </View>

            <View style={[styles.videoContainer, { width: videoWidth, height: videoHeight }]}>
              <Video
                ref={videoRef}
                source={current.source}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />
              <TouchableOpacity style={styles.videoOverlay} onPress={togglePlayback} activeOpacity={0.8}>
                {(showReplay || !isPlaying) && (
                  <View style={styles.overlayIcon}>
                    <Ionicons
                      name={showReplay ? 'refresh-circle' : 'play-circle'}
                      size={64}
                      color="rgba(255,255,255,0.92)"
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.dots}>
              {videos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === videoIndex
                      ? [styles.dotActive, { backgroundColor: theme.button }]
                      : [styles.dotInactive, { backgroundColor: theme.cardOutline }],
                  ]}
                />
              ))}
            </View>

            <View style={styles.spacer} />

            <View style={styles.btnRow}>
              {!hasFinished && (
                <Text style={[styles.watchHint, { color: theme.headingText }]}>
                  Watch the video to continue
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.nextBtn,
                  { backgroundColor: theme.button },
                  !hasFinished && styles.nextBtnDisabled,
                ]}
                activeOpacity={hasFinished ? 0.85 : 1}
                onPress={hasFinished ? goNext : undefined}
              >
                <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>
                  {isLastVideo ? "Let's try!" : 'Next'}
                </Text>
                <Ionicons
                  name={isLastVideo ? 'checkmark-circle-outline' : 'arrow-forward'}
                  size={18}
                  color={theme.buttonText}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </View>

      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onCancel={() => setShowGate(false)}
      />

      <Modal visible={showSettings} transparent animationType="none" onRequestClose={closeSettings}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={closeSettings}>
          <Animated.View style={[styles.settingsSheet, { opacity: settingsFade }]}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.settingsTitle}>Session Options</Text>
              <TouchableOpacity style={styles.settingsOption} onPress={handleSkipWord} activeOpacity={0.7}>
                <Ionicons name="play-skip-forward-outline" size={20} color="#555" />
                <Text style={styles.settingsOptionText}>Skip this word</Text>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
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
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    gap: 20,
  },

  captionBox: {
    width: '100%',
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    ...Layout.shadow.sm,
  },
  caption: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },

  videoContainer: {
    alignSelf: 'center',
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    position: 'relative',
    ...Layout.shadow.md,
  },
  video: { width: '100%', height: '100%' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayIcon: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 50,
  },

  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot:  { borderRadius: 10 },
  dotActive:   { width: 20, height: 8 },
  dotInactive: { width: 8, height: 8, opacity: 0.35 },

  spacer: { flex: 1 },

  btnRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Layout.spacing.md,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
  watchHint: { fontSize: Layout.fontSize.xs, opacity: 0.5, fontWeight: '500' },

  settingsOverlay: {
    flex: 1,
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
  settingsTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: '#333',
    marginBottom: Layout.spacing.lg,
    textAlign: 'center',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: 4,
  },
});
