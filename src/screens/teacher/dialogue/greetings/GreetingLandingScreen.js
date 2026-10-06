import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import ProbeBanner from '../../../../components/common/ProbeBanner';
import { dialogueApi } from '../../../../api/dialogue';
import { clearRestartCount } from '../../../../utils/sessionRetryTracker';
import { LinearGradient } from 'expo-linear-gradient';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

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

// Same per-avatar photos as Magic Words and the handwriting screens. A still
// image rather than a video: nothing moves or plays sound while the child
// takes in the word.
const AVATAR_IMAGES = {
  boba:     require('../../../../../assets/handwriting-avatars/Boba.png'),
  glitter:  require('../../../../../assets/handwriting-avatars/Glitter.png'),
  lily:     require('../../../../../assets/handwriting-avatars/Lily.png'),
  megatron: require('../../../../../assets/handwriting-avatars/Megatron.png'),
};

const PROGRESS_FRACTION = 0.08;

export default function GreetingLandingScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' ').toUpperCase();

  const avatarKey   = student?.avatar_key ?? 'lily';
  const avatarImage = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // The avatar photos are square, so the frame is square too. It fills the
  // measured space between the word and the button, capped so it stays a
  // companion to the word rather than dominating the screen.
  const [avatarAreaHeight, setAvatarAreaHeight] = useState(0);
  const avatarSize = Math.max(
    0,
    Math.min(avatarAreaHeight - 24, screenWidth * 0.52, screenHeight * 0.45),
  );
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
    clearRestartCount(student?.sid, wordId);
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  function handleExitSession() {
    clearRestartCount(student?.sid, wordId);
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
            style={[styles.headerBtn, BACK_BUTTON]}
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>

          <TouchableOpacity
            onPress={openSettings}
            activeOpacity={0.7}
            style={styles.headerBtn}
          >
            <Ionicons name="settings-outline" size={20} color={theme.headingText} />
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

      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          {/* One column, one path — the same layout as MagicWordLandingScreen:
              the word in its card, the avatar filling the middle, then Next
              in a fixed spot. */}
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.headingText }]}>
              {"Let's learn the word"}
            </Text>
            <View style={[styles.wordCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              <Text
                style={[styles.wordHighlight, { color: theme.headingText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {wordLabel}
              </Text>
            </View>

            <View
              style={styles.avatarArea}
              onLayout={(e) => setAvatarAreaHeight(e.nativeEvent.layout.height)}
            >
              {avatarSize > 0 && (
                <Image
                  source={avatarImage}
                  style={{ width: avatarSize, height: avatarSize }}
                  resizeMode="contain"
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              activeOpacity={0.85}
              onPress={() => {
                clearRestartCount(student?.sid, wordId);
                navigation.navigate('GreetingPhase1Video', { student, wordKey, wordId, startIndex: 0 });
              }}
            >
              <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
            </TouchableOpacity>
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
  headerSide: {
    width: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  progressFill: {
    height: '100%',
    borderRadius: rs(4),
  },

  // Top → bottom: word, avatar (fills the middle), Next. paddingBottom puts
  // Next where the concept screens' "Ready!" button sits — as Magic Words.
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: rs(80),
  },
  title: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Layout.spacing.sm,
  },
  // The word is the one thing this screen teaches, so it is the largest,
  // highest-contrast element: dark heading text on the light card surface.
  wordCard: {
    maxWidth: '90%',
    paddingHorizontal: rs(36),
    paddingVertical: rs(10),
    borderRadius: rs(24),
    borderWidth: 2,
  },
  wordHighlight: {
    fontSize: rf(52),
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  avatarArea: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
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
  nextBtnText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },

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
  settingsOptionText: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_600SemiBold',
    color: '#333',
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: rs(4),
  },
});
