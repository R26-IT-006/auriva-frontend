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
import { Audio, Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';
import { cat3Api } from '../../../../api/cat3';
import { LinearGradient } from 'expo-linear-gradient';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';
import {
  abilityLabel, isAbilityAnswerWord, ABILITY_CAPTIONS, ABILITY_WATCH_VIDEOS,
  ABILITY_WATCH_NARRATION, ABILITY_PHOTOS, ABILITY_WORD_AUDIO,
} from '../../../../data/abilitiesWords';

// "Can you…?" watch step — the same screen as GreetingPhase1VideoScreen.
// Each abilities word has one watch video (Greetings has three), so the dots
// show a single step and "Let's try!" appears after it.
function getVideos(wordKey) {
  const label = abilityLabel(wordKey);
  const caption = isAbilityAnswerWord(wordKey)
    ? `${ABILITY_CAPTIONS[wordKey] ?? ''}\nWe say "${label}"`
    : `${ABILITY_CAPTIONS[wordKey] ?? label}\nCan you ${label.toLowerCase()}?`;
  const source = ABILITY_WATCH_VIDEOS[wordKey];
  return source
    ? [{ source, caption, audio: ABILITY_WATCH_NARRATION[wordKey] ?? null }]
    : [];
}

export default function AbilityPhase1VideoScreen({ route, navigation }) {
  const { student, wordKey = 'clap', wordId, startIndex: requestedStart = 0 } = route.params ?? {};
  const theme  = getAvatarTheme(student?.avatar_key);
  const videos = getVideos(wordKey);
  // A rewatch asks to start from the 2nd video; with one video that is the 1st.
  const startIndex = Math.min(requestedStart, Math.max(0, videos.length - 1));
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
  const soundRef  = useRef(null);
  const current      = videos[videoIndex];

  // Narration audio (only some videos have one — see the per-word constants
  // above) — kept in sync with the video: (re)starts whenever the video
  // (re)starts, pauses when the video is paused.
  async function playCurrentAudio(source) {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (!source) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setHasFinished(false);
    setIsPlaying(true);
    setShowReplay(false);
    if (wordId && student?.sid) {
      cat3Api.recordPhase1Tap(student.sid, wordId).catch(() => {});
    }
    playCurrentAudio(current?.audio);
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [videoIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
      playCurrentAudio(current?.audio);
    } else {
      await videoRef.current.pauseAsync();
      soundRef.current?.pauseAsync().catch(() => {});
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

  async function goNext() {
    if (videoIndex < videos.length - 1) {
      setVideoIndex(videoIndex + 1);
      return;
    }
    // The word's trajectory sets how long the word intro lingers. An
    // enhancement only — a failed fetch falls back to 'typical'.
    let adaptiveDwell = 'typical';
    try {
      const { trajectory } = await dialogueApi.getTrajectory(student?.sid, wordId);
      if (trajectory) adaptiveDwell = trajectory;
    } catch { /* ignore */ }
    navigation.navigate('AnimatedWord', {
      student,
      wordText: abilityLabel(wordKey),
      wordImage: ABILITY_PHOTOS[wordKey],
      wordAudio: ABILITY_WORD_AUDIO[wordKey],
      wordId,
      // Exposure is recorded above through cat3Api, not dialogueApi.
      trackExposure: false,
      nextScreen: 'AbilityDragToLine',
      nextParams: { student, wordKey, wordId, attempt: 1 },
      adaptiveDwell,
    });
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
          <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={[styles.headerBtn, BACK_BUTTON]}>
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressFraction * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}>
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
                  size={20}
                  color={theme.buttonText}
                />
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </LinearGradient>

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
    paddingHorizontal: rs(12),
    paddingVertical: rs(12),
    gap: rs(8),
  },
  headerSide: { width: rs(40), alignItems: 'center', justifyContent: 'center' },
  // Concept's round translucent header button (spacers keep headerSide).
  headerBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  progressTrack: {
    flex: 1,
    height: rs(8),
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: rs(4),
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: rs(4) },

  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    gap: rs(20),
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
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    lineHeight: rf(26),
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
    borderRadius: rs(50),
  },

  dots: { flexDirection: 'row', gap: rs(8), alignItems: 'center' },
  dot:  { borderRadius: rs(10) },
  dotActive:   { width: rs(20), height: rs(8) },
  dotInactive: { width: rs(8), height: rs(8), opacity: 0.35 },

  spacer: { flex: 1 },

  btnRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Layout.spacing.md,
  },
  nextBtn: {
    gap: rs(8),
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
  watchHint: { fontSize: Layout.fontSize.xs, opacity: 0.5, fontFamily: 'DMSans_600SemiBold' },

  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    padding: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
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
  settingsOptionText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold', color: '#333' },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: rs(4),
  },
});
