import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';
import { dialogueApi } from '../../../../api/dialogue';

const PROGRESS_FRACTION = 0.10;

// ── Static asset requires (React Native requires static paths) ─────────────

const ASSETS = {
  clap: { type: 'video',  source: require('../../../../../assets/avatar_actions-images/Saman_Clapping.mp4') },
  run:  { type: 'run',   source: require('../../../../../assets/avatar_actions-images/Anjalie_Running.png') },
  walk: { type: 'walk',  source: require('../../../../../assets/avatar_actions-images/Saman_Walking.png') },
  jump: { type: 'jump',  source: require('../../../../../assets/avatar_actions-images/Anjalie_Jumping.png') },
};

const WORD_LABELS = {
  cat3_yes: 'Yes',
  cat3_no:  'No',
  clap:     'Clap',
  run:      'Run',
  walk:     'Walk',
  jump:     'Jump',
  talk:     'Talk',
  dance:    'Dance',
  sing:     'Sing',
};

// Scene images for the AnimatedWord/BoldWord familiarisation screens — same
// per-word images Cat3DragToLineScreen.js uses (abilities has no entries in
// constants/dialogueAssets.js by design; the scene/context concept there
// doesn't apply to this category — confirmed 2026-07-28).
const CAT3_WORD_IMAGE = {
  cat3_yes: require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
  cat3_no:  require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
  clap:     require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
  run:      require('../../../../../assets/dialogue-images/words/abilities/run/Drag_Act.jpeg'),
  walk:     require('../../../../../assets/dialogue-images/words/abilities/walk/Drag_Act.jpeg'),
  jump:     require('../../../../../assets/dialogue-images/words/abilities/jump/Drag_Act.jpeg'),
  talk:     require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
  dance:    require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
  sing:     require('../../../../../assets/dialogue-images/words/abilities/clap/Drag_Act.jpeg'),
};

// Word audio for the familiarisation screens — mirrors Cat3Phase2Screen.js's
// WORD_AUDIO. cat3_yes/cat3_no have no audio asset yet (same gap as Phase2);
// the familiarisation screens already guard playback on wordAudio presence.
const CAT3_WORD_AUDIO = {
  clap:  require('../../../../../assets/dialogue-audios/abilities/clap.mp3'),
  run:   require('../../../../../assets/dialogue-audios/abilities/run.mp3'),
  walk:  require('../../../../../assets/dialogue-audios/abilities/walk.mp3'),
  jump:  require('../../../../../assets/dialogue-audios/abilities/jump.mp3'),
  dance: require('../../../../../assets/dialogue-audios/abilities/dance.mp3'),
  sing:  require('../../../../../assets/dialogue-audios/abilities/sing.mp3'),
  talk:  require('../../../../../assets/dialogue-audios/abilities/talk.mp3'),
};

// ── Jump animation ────────────────────────────────────────────────────────────

function JumpAvatar({ source }) {
  const jumpY  = useRef(new Animated.Value(0)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  function doJump() {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(jumpY,  { toValue: -160, duration: 220, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1.08,  duration: 220, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(jumpY,  { toValue: 0, bounciness: 10, speed: 14, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleY, { toValue: 0.82, duration: 80,  useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1,    bounciness: 14, speed: 18, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }

  return (
    <TouchableOpacity onPress={doJump} activeOpacity={0.9} style={styles.avatarTouchable}>
      <Animated.Image
        source={source}
        style={[styles.avatarImg, { transform: [{ translateY: jumpY }, { scaleY }] }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

// ── Run animation ─────────────────────────────────────────────────────────────

function RunAvatar({ source }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const isRunning  = useRef(false);

  function doRun() {
    if (isRunning.current) return;
    isRunning.current = true;
    translateX.setValue(-220);
    translateY.setValue(0);

    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -14, duration: 120, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,   duration: 120, useNativeDriver: true }),
      ]),
      { iterations: 20 },
    );
    bounce.start();

    Animated.timing(translateX, { toValue: 220, duration: 1400, useNativeDriver: true }).start(() => {
      bounce.stop();
      setTimeout(() => {
        translateX.setValue(0);
        translateY.setValue(0);
        isRunning.current = false;
      }, 300);
    });
  }

  return (
    <TouchableOpacity onPress={doRun} activeOpacity={0.9} style={[styles.avatarTouchable, { overflow: 'hidden', width: '100%' }]}>
      <Animated.Image
        source={source}
        style={[styles.avatarImg, { transform: [{ translateX }, { translateY }] }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

// ── Walk animation ────────────────────────────────────────────────────────────

function WalkAvatar({ source }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const isWalking  = useRef(false);

  function doWalk() {
    if (isWalking.current) return;
    isWalking.current = true;
    translateX.setValue(-130);
    translateY.setValue(0);

    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,   duration: 250, useNativeDriver: true }),
      ]),
      { iterations: 8 },
    );
    bob.start();

    Animated.timing(translateX, { toValue: 130, duration: 4000, useNativeDriver: true }).start(() => {
      bob.stop();
      translateX.setValue(0);
      translateY.setValue(0);
      isWalking.current = false;
    });
  }

  return (
    <TouchableOpacity onPress={doWalk} activeOpacity={0.9} style={[styles.avatarTouchable, { overflow: 'hidden', width: '100%' }]}>
      <Animated.Image
        source={source}
        style={[styles.avatarImg, { transform: [{ translateX }, { translateY }] }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

// ── Clap video ────────────────────────────────────────────────────────────────

function ClapAvatar({ source }) {
  const videoRef  = useRef(null);
  const [playing, setPlaying] = useState(false);

  async function doPlay() {
    if (!videoRef.current || playing) return;
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
    setPlaying(true);
  }

  return (
    <TouchableOpacity onPress={doPlay} activeOpacity={1} style={styles.avatarTouchable}>
      <Video
        ref={videoRef}
        source={source}
        style={styles.avatarImg}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={false}
        shouldPlay={false}
        isLooping={false}
        onPlaybackStatusUpdate={s => { if (s.didJustFinish) setPlaying(false); }}
      />
    </TouchableOpacity>
  );
}

// ── Word card (for words without animation assets) ────────────────────────────

function WordCard({ label, theme }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pulse() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, bounciness: 20 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, bounciness: 20 }),
    ]).start();
  }

  return (
    <TouchableOpacity onPress={pulse} activeOpacity={0.85} style={styles.avatarTouchable}>
      <Animated.View style={[styles.wordCard, { backgroundColor: theme.button, transform: [{ scale }] }]}>
        <Text style={[styles.wordCardText, { color: theme.buttonText }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Cat3Phase1Screen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? WORD_LABELS[wordKey] ?? wordKey;

  const hasTappedRef  = useRef(false);
  const activeRef     = useRef(true);
  const settingsFade  = useRef(new Animated.Value(0)).current;
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

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
    return () => { activeRef.current = false; sub.remove(); };
  }, []));

  function onAvatarTap() {
    if (!hasTappedRef.current) {
      hasTappedRef.current = true;
      cat3Api.recordPhase1Tap(student?.sid, wordId, sessionId).catch(() => {});
    }
  }

  async function goNext() {
    // Trajectory fetch is an enhancement, not a requirement — never block
    // navigation on it failing.
    let adaptiveDwell = 'typical';
    try {
      const { trajectory } = await dialogueApi.getTrajectory(student?.sid, wordId);
      if (trajectory) adaptiveDwell = trajectory;
    } catch { /* ignore — fall back to 'typical' */ }

    navigation.navigate('AnimatedWord', {
      student,
      wordText: wordLabel,
      wordImage: CAT3_WORD_IMAGE[wordKey],
      wordAudio: CAT3_WORD_AUDIO[wordKey],
      wordId,
      trackExposure: false, // abilities uses cat3Api.recordPhase1Tap (tap-gated), not dialogueApi.recordPhase1Exposure — see STATE.md
      nextScreen: 'Cat3DragToLine',
      nextParams: { student, wordId, wordKey, wordLabel, sessionId },
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
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setShowSettings(false),
    );
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  const asset = ASSETS[wordKey];

  function renderAnimation() {
    if (!asset) {
      return <WordCard label={wordLabel} theme={theme} />;
    }
    const src = asset.source;
    if (asset.type === 'video') return <ClapAvatar source={src} />;
    if (asset.type === 'jump')  return <JumpAvatar source={src} />;
    if (asset.type === 'run')   return <RunAvatar  source={src} />;
    if (asset.type === 'walk')  return <WalkAvatar source={src} />;
    return <WordCard label={wordLabel} theme={theme} />;
  }

  const isStandalone = wordKey === 'cat3_yes' || wordKey === 'cat3_no';
  const subtitle = isStandalone
    ? 'Tap the card to see the word!'
    : `Tap to see ${wordLabel}!`;

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
              {'Can you '}
              <Text style={{ color: theme.button, fontWeight: '900' }}>{wordLabel}</Text>
              {'?'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.headingText }]}>{subtitle}</Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={onAvatarTap}
              style={styles.avatarArea}
            >
              {renderAnimation()}
            </TouchableOpacity>

            <View style={styles.hintRow}>
              <Ionicons name="hand-left-outline" size={15} color={theme.headingText} style={{ opacity: 0.4 }} />
              <Text style={[styles.hintText, { color: theme.headingText }]}>Tap the avatar to watch</Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.button }]}
                onPress={goNext}
                activeOpacity={0.85}
              >
                <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.buttonText} />
              </TouchableOpacity>
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
  root:     { flex: 1 },
  body:     { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   12,
    gap:               8,
  },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  levelLabel:    { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  progressTrack: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },

  content: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingTop:        Layout.spacing.lg,
    paddingBottom:     Layout.spacing.lg,
  },

  title: {
    fontSize:   Layout.fontSize.xxl,
    fontWeight: '700',
    textAlign:  'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize:    Layout.fontSize.sm,
    textAlign:   'center',
    opacity:     0.6,
    marginTop:   Layout.spacing.xs,
    marginBottom: Layout.spacing.lg,
  },

  avatarArea: {
    flex:           1,
    width:          '100%',
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarTouchable: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width:  Math.min(Layout.window.width * 0.38, 420),
    height: Math.min(Layout.window.height * 0.58, 520),
  },

  wordCard: {
    width:          240,
    height:         200,
    borderRadius:   Layout.radius.xl,
    alignItems:     'center',
    justifyContent: 'center',
    ...Layout.shadow.lg,
  },
  wordCardText: {
    fontSize:   72,
    fontWeight: '900',
    letterSpacing: 2,
  },

  hintRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    opacity:       0.5,
    marginBottom:  Layout.spacing.md,
  },
  hintText: { fontSize: Layout.fontSize.xs, fontWeight: '500' },

  footer:  { width: '100%', alignItems: 'flex-end' },
  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet: {
    backgroundColor:      '#FFF',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              Layout.spacing.xl,
    paddingBottom:        Layout.spacing.xxl,
  },
  settingsTitle:      { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:     { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
});
