import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import ProbeBanner from '../../../../components/common/ProbeBanner';
import { dialogueApi } from '../../../../api/dialogue';

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

const AVATAR_DANCING_VIDEOS = {
  lily:     require('../../../../../assets/avatar-videos/LilyDancing.mp4'),
  megatron: require('../../../../../assets/avatar-videos/MegatronDancing.mp4'),
  boba:     require('../../../../../assets/avatar-videos/Boba_Dancing.mp4'),
  glitter:  require('../../../../../assets/avatar-videos/GlitterDancing.mp4'),
};

const PROGRESS_FRACTION = 0.08;

export default function GreetingLandingScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' ').toUpperCase();

  const avatarKey   = student?.avatar_key ?? 'lily';
  const videoSource = AVATAR_DANCING_VIDEOS[avatarKey] ?? AVATAR_DANCING_VIDEOS.lily;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const videoWidth  = Math.min(screenWidth * 0.6, screenHeight * 0.45 * (3 / 4));
  const videoHeight = videoWidth * (4 / 3);

  const videoRef = useRef(null);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');
  const settingsFade = useRef(new Animated.Value(0)).current;

  // Rule 5 — periodic production probe (TASK-39). Purely additive: failure
  // or "nothing due" both just mean no banner, never an error state — this
  // never touches the screen's existing word/video/next-button behaviour.
  const [probeCandidate, setProbeCandidate] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!student?.sid) return undefined;
    dialogueApi.getProbeCandidate(student.sid, 'greetings')
      .then((res) => { if (!cancelled && res?.word_id) setProbeCandidate(res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [student?.sid]);

  function goToProbe() {
    navigation.navigate('ProbeProduction', {
      student,
      category: 'greetings',
      wordId:   probeCandidate.word_id,
      word:     probeCandidate.word,
      assetKey: probeCandidate.asset_key,
    });
  }

  function goBackSmart() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  // Stop audio when navigating away; also intercept Android hardware back
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackSmart();
        return true;
      });
      return () => {
        sub.remove();
        videoRef.current?.pauseAsync().catch(() => {});
      };
    }, [])
  );

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

  return (
    <View style={styles.root}>
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            onPress={goBackSmart}
            activeOpacity={0.7}
            style={styles.headerSide}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>

          <TouchableOpacity
            onPress={openSettings}
            activeOpacity={0.7}
            style={styles.headerSide}
          >
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Probe banner (Rule 5 check-in, TASK-39) ─────────── */}
      {probeCandidate && (
        <ProbeBanner
          wordLabel={WORD_LABELS[probeCandidate.asset_key] ?? probeCandidate.word}
          theme={theme}
          onPress={goToProbe}
          onDismiss={() => setProbeCandidate(null)}
        />
      )}

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.headingText }]}>
              {"Let's learn the word"}
            </Text>
            <Text style={[styles.titleSinhala, { color: theme.headingText }]}>
              වචනය ඉගෙනගනිමු!
            </Text>
            <Text style={[styles.wordHighlight, { color: theme.button }]}>
              "{wordLabel}"
            </Text>

            <View style={[styles.videoWrapper, { width: videoWidth, height: videoHeight }]}>
              <Video
                ref={videoRef}
                source={videoSource}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('GreetingPhase1Video', { student, wordKey, wordId, startIndex: 0 })
              }
            >
              <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
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

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
    gap: 8,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.75,
  },
  titleSinhala: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.65,
  },
  wordHighlight: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: Layout.spacing.md,
  },
  videoWrapper: {
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    marginBottom: Layout.spacing.xl,
    ...Layout.shadow.sm,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
  },

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
