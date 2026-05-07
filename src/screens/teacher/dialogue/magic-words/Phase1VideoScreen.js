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

const THANK_YOU_VIDEOS = [
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V1.mp4'),
    caption: 'Saman receives a present from Anjali.\nHe says "Thank you"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V2.mp4'),
    caption: 'Anjalie receives an apple from Saman.\nShe says "Thank you"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V3.mp4'),
    caption: 'Anjalie asks to borrow a pencil from Saman.\nHe gives her a pencil. She says "Thank you"',
  },
];

// Placeholders — swap source for the real video files when assets arrive
const IM_SORRY_VIDEOS = [
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V1.mp4'),
    caption: 'Saman bumps into Anjalie by accident.\nHe says "I\'m sorry"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V2.mp4'),
    caption: 'Anjalie spills Saman\'s juice.\nShe says "I\'m sorry"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V3.mp4'),
    caption: 'Saman breaks Anjalie\'s pencil by mistake.\nHe says "I\'m sorry"',
  },
];

const YOURE_WELCOME_VIDEOS = [
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V1.mp4'),
    caption: 'Anjalie says "Thank you" to Saman.\nHe says "You\'re welcome"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V2.mp4'),
    caption: 'Saman helps Anjalie carry her bag.\nShe says "Thank you". He says "You\'re welcome"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V3.mp4'),
    caption: 'Anjalie gives Saman a pencil.\nHe says "Thank you". She says "You\'re welcome"',
  },
];

const EXCUSE_ME_VIDEOS = [
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V1.mp4'),
    caption: 'Saman needs to pass by Anjalie.\nHe says "Excuse me"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V2.mp4'),
    caption: 'Anjalie is walking through a crowd.\nShe says "Excuse me"',
  },
  {
    source:  require('../../../../../assets/dialogue-videos/words/magic_words/thank_you/Thankyou_V3.mp4'),
    caption: 'Saman needs to reach something behind Anjalie.\nHe says "Excuse me"',
  },
];

function getVideos(wordKey) {
  if (wordKey === 'im_sorry')      return IM_SORRY_VIDEOS;
  if (wordKey === 'youre_welcome') return YOURE_WELCOME_VIDEOS;
  if (wordKey === 'excuse_me')     return EXCUSE_ME_VIDEOS;
  return THANK_YOU_VIDEOS;
}

export default function Phase1VideoScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you', wordId, startIndex = 0 } = route.params ?? {};
  const theme  = getAvatarTheme(student?.avatar_key);
  const videos = getVideos(wordKey);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  // 75% of screen width, but never taller than 55% of screen height
  const maxByWidth  = screenWidth * 0.75;
  const maxByHeight = screenHeight * 0.55 * (4 / 3); // convert height limit to width
  const videoWidth  = Math.min(maxByWidth, maxByHeight);
  const videoHeight = videoWidth * (3 / 4);

  const [videoIndex, setVideoIndex] = useState(startIndex);
  const [hasFinished, setHasFinished] = useState(false);
  const [isPlaying,   setIsPlaying]   = useState(true);
  const [showReplay,  setShowReplay]  = useState(false);
  const [showGate,    setShowGate]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');
  const settingsFade = useRef(new Animated.Value(0)).current;

  const videoRef = useRef(null);
  const current  = videos[videoIndex];

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setGatePurpose('back');
      setShowGate(true);
      return true;
    });
    return () => sub.remove();
  }, []));

  // Reset play state and record exposure whenever the video index changes
  useEffect(() => {
    setHasFinished(false);
    setIsPlaying(true);
    setShowReplay(false);
    if (wordId && student?.sid) {
      dialogueApi.recordPhase1Exposure(student.sid, wordId).catch(() => {});
    }
  }, [videoIndex]);

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

  function goBack() {
    if (videoIndex > startIndex) {
      setVideoIndex(videoIndex - 1);
    } else {
      setGatePurpose('back');
      setShowGate(true);
    }
  }

  function goNext() {
    if (videoIndex < videos.length - 1) {
      setVideoIndex(videoIndex + 1);
    } else {
      navigation.navigate('DragToLine', { student, wordKey, wordId, attempt: 1 });
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

  // Progress: video 0 = 20%, video 1 = 40%, video 2 = 60%
  const progressFraction = ((videoIndex + 1) / videos.length) * 0.6;

  const isLastVideo = videoIndex === videos.length - 1;

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────── */}
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressFraction * 100}%`, backgroundColor: theme.button },
              ]}
            />
          </View>

          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ────────────────────────────────────────────── */}
      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {/* Caption */}
            <View style={[styles.captionBox, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.caption, { color: theme.headingText }]}>
                {current.caption}
              </Text>
            </View>

            {/* Video — centered box, 4:3 ratio, width-driven sizing */}
            <View style={[styles.videoContainer, { width: videoWidth, height: videoHeight }]}>
              <Video
                ref={videoRef}
                source={current.source}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />

              <TouchableOpacity
                style={styles.videoOverlay}
                onPress={togglePlayback}
                activeOpacity={0.8}
              >
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

            {/* Dot progress indicator */}
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

            {/* Spacer pushes Next to the bottom */}
            <View style={styles.spacer} />

            {/* Next button — bottom right, matching wireframe */}
            <View style={styles.btnRow}>
              {!hasFinished && (
                <Text style={[styles.watchHint, { color: theme.headingText }]}>
                  Watch the video to continue
                </Text>
              )}
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.button }, !hasFinished && styles.nextBtnDisabled]}
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

      {/* ── Parent Gate ─────────────────────────────────────── */}
      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onCancel={() => setShowGate(false)}
      />

      {/* ── Settings Sheet ──────────────────────────────────── */}
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

  /* Header */
  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headerSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  /* Body */
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
    backgroundColor: 'transparent',
    position: 'relative',
    ...Layout.shadow.md,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayIcon: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 50,
  },

  /* Dots */
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    borderRadius: 10,
  },
  dotActive: {
    width: 20,
    height: 8,
  },
  dotInactive: {
    width: 8,
    height: 8,
    opacity: 0.35,
  },

  spacer: { flex: 1 },

  /* Next button — right-aligned, matching wireframe */
  btnRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Layout.spacing.md,
    alignItems: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextBtnText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
  },
  watchHint: {
    fontSize: Layout.fontSize.xs,
    opacity: 0.5,
    fontWeight: '500',
  },

  /* Settings */
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
  settingsOptionText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    color: '#333',
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: 4,
  },
});
