import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';
import { LinearGradient } from 'expo-linear-gradient';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

import { clearRestartCount } from '../../../../utils/sessionRetryTracker';
import {
  abilityLabel, ABILITY_LABELS, ABILITY_WATCH_VIDEOS, ABILITY_PHASE3_PROMPT_AUDIO,
} from '../../../../data/abilitiesWords';

// "Can you…?" Phase 3 — ONE question (not the A/B/C scenarios Magic Words and
// Greetings use): the word's video plays and the child taps the word that
// matches it. A wrong first answer gets "Try again!"; a wrong second answer
// ends the question with the child's choice marked red and the right word
// marked green. The result goes to the abilities /complete endpoint (which
// decides mastery) and then to the shared Word Complete screen.
const PHASE3_PROMPT_AUDIO = ABILITY_PHASE3_PROMPT_AUDIO;

const PROGRESS_FRACTION = 0.90;

// How long the final green / red marking stays up before Word Complete.
const RESULT_HOLD_MS = 1800;

const ALL_CAT3_LABELS = Object.values(ABILITY_LABELS);

function getSceneVideo(wordKey) {
  return ABILITY_WATCH_VIDEOS[wordKey] ?? null;
}

function pickDistractors(correctLabel, count = 2) {
  const pool = ALL_CAT3_LABELS.filter(l => l !== correctLabel);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function AbilityPhase3ContextualScreen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? abilityLabel(wordKey);
  const sceneVideo = getSceneVideo(wordKey);

  const distractors = useMemo(() => pickDistractors(wordLabel), [wordLabel]);
  const tiles = useMemo(() => {
    const all = [
      { label: wordLabel, isCorrect: true },
      ...distractors.map(d => ({ label: d, isCorrect: false })),
    ];
    // shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, []);

  const [attempt,      setAttempt]      = useState(1);
  const [selectedId,   setSelectedId]   = useState(null);
  const [settled,      setSettled]      = useState(false);
  const [feedbackMsg,  setFeedbackMsg]  = useState('');
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

  const activeRef     = useRef(true);
  const submittedRef  = useRef(false);
  const settingsFade  = useRef(new Animated.Value(0)).current;
  const feedbackOp    = useRef(new Animated.Value(0)).current;
  const correctIdxRef = useRef(null);

  // ── NEW — audio playback (this screen had none before) ─────────────
  const soundRef = useRef(null);
  const videoRef = useRef(null);

  // ── RC2 feature capture refs ──────────────────────────────────────────
  const attemptRenderRef                = useRef(Date.now());
  const attempt1LatencyRef              = useRef(null);
  const attempt2LatencyRef              = useRef(null);
  const firstTapCorrectAttempt1Ref      = useRef(null);
  const firstTapCorrectAttempt2Ref      = useRef(null);
  const selectionChangeCountAttempt1Ref = useRef(0);
  const selectionChangeCountAttempt2Ref = useRef(0);
  const promptCountAttempt1Ref          = useRef(1);
  const promptCountAttempt2Ref          = useRef(1);

  useEffect(() => {
    attemptRenderRef.current = Date.now();
    if (attempt === 1) promptCountAttempt1Ref.current = 1;
    else               promptCountAttempt2Ref.current = 1;
    playSound(PHASE3_PROMPT_AUDIO).catch(() => {});
  }, [attempt]);

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

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setGatePurpose('back');
      setShowGate(true);
      return true;
    });
    return () => {
      activeRef.current = false;
      sub.remove();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      // Stop the scene video on blur — otherwise its audio keeps playing in
      // the background after the student navigates away.
      videoRef.current?.pauseAsync().catch(() => {});
    };
  }, []));

  function showToast(msg, color) {
    setFeedbackMsg(msg);
    Animated.sequence([
      Animated.timing(feedbackOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(feedbackOp, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function advance(phase3Passed, correctOnFirst, secondAttemptCorrect) {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const hadSecondAttempt = secondAttemptCorrect !== undefined;

    cat3Api.recordPhase3Check(student?.sid, wordId, {
      correctOnFirst,
      secondAttemptCorrect,
      sessionId,
      attempt1LatencyMs:           attempt1LatencyRef.current,
      attempt2LatencyMs:           hadSecondAttempt ? attempt2LatencyRef.current : undefined,
      attempt1FirstTapCorrect:     firstTapCorrectAttempt1Ref.current,
      attempt2FirstTapCorrect:     hadSecondAttempt ? firstTapCorrectAttempt2Ref.current : undefined,
      attempt1SelectionChangeCount: Math.min(selectionChangeCountAttempt1Ref.current, 2),
      attempt2SelectionChangeCount: hadSecondAttempt
        ? Math.min(selectionChangeCountAttempt2Ref.current, 2) : undefined,
      attempt1PromptCount:         promptCountAttempt1Ref.current,
      attempt2PromptCount:         hadSecondAttempt ? promptCountAttempt2Ref.current : undefined,
    }).catch(() => {});

    const completion = cat3Api.completeWordSession(student?.sid, wordId, phase3Passed, sessionId)
      .catch(() => null);
    const hold = new Promise(r => setTimeout(r, RESULT_HOLD_MS));

    Promise.all([completion, hold]).then(([result]) => {
      if (!activeRef.current) return;
      clearRestartCount(student?.sid, wordId);
      navigation.navigate('WordComplete', {
        student,
        wordKey,
        wordId,
        wordLabel,
        category:      'abilities',
        mastered:      result?.mastered       ?? false,
        sessionPassed: result?.session_passed ?? false,
        status:        result?.status         ?? 'in_progress',
      });
    });
  }

  function handleTileTap(tile, idx) {
    if (settled) return;

    if (selectedId === null) {
      const latency = Date.now() - attemptRenderRef.current;
      if (attempt === 1) {
        attempt1LatencyRef.current         = latency;
        firstTapCorrectAttempt1Ref.current = tile.isCorrect;
      } else {
        attempt2LatencyRef.current         = latency;
        firstTapCorrectAttempt2Ref.current = tile.isCorrect;
      }
    } else if (selectedId !== idx) {
      if (attempt === 1) selectionChangeCountAttempt1Ref.current += 1;
      else               selectionChangeCountAttempt2Ref.current += 1;
    }

    setSelectedId(idx);
  }

  function handleConfirmTile() {
    if (settled || selectedId === null) return;
    const tile = tiles[selectedId];

    if (tile.isCorrect) {
      setSettled(true);
      if (attempt === 1) { advance(true, true, undefined); }
      else               { advance(true, false, true); }
    } else {
      if (attempt === 1) {
        setAttempt(2);
        showToast('Try again! 😊');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1100);
      } else {
        setSettled(true);
        correctIdxRef.current = tiles.findIndex(t => t.isCorrect);
        advance(false, false, false);
      }
    }
  }

  function handleHearAgain() {
    if (settled) return;
    if (attempt === 1) promptCountAttempt1Ref.current += 1;
    else               promptCountAttempt2Ref.current += 1;
    playSound(PHASE3_PROMPT_AUDIO).catch(() => {});
  }

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('DialogueCategory', { student });
      }
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

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => { setGatePurpose('back'); setShowGate(true); }} activeOpacity={0.7} style={[styles.headerBtn, BACK_BUTTON]}>
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.levelLabel, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.body}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            <Text style={[styles.title, { color: theme.headingText }]}>
              What is the avatar doing?
            </Text>
            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Tap the correct word!
            </Text>

            {/* Scene video */}
            {sceneVideo ? (
              <View style={[styles.sceneWrap, { backgroundColor: theme.cardSurface }]}>
                <Video
                  ref={videoRef}
                  source={sceneVideo}
                  style={styles.sceneImg}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                  shouldPlay
                  isLooping
                />
              </View>
            ) : (
              <View style={[styles.sceneWrap, { backgroundColor: theme.button + '33', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[styles.wordFallback, { color: theme.button }]}>{wordLabel}</Text>
              </View>
            )}

            {/* Word tiles */}
            <View style={styles.tilesWrap}>
              {tiles.map((tile, idx) => {
                const isSelected      = selectedId === idx;
                const showProvisional = isSelected && !settled;
                const revealedCorrect = settled && tile.isCorrect && correctIdxRef.current !== null;
                const showGreen       = (isSelected && settled && tile.isCorrect) || revealedCorrect;
                const showRed         = isSelected && settled && !tile.isCorrect;

                return (
                  <TouchableOpacity
                    key={tile.label}
                    onPress={() => handleTileTap(tile, idx)}
                    activeOpacity={settled ? 1 : 0.82}
                    style={[
                      styles.tile,
                      { borderColor: theme.cardOutline },
                      showProvisional && [styles.tileSelected, { borderColor: theme.button, shadowColor: theme.button }],
                      showGreen && styles.tileCorrect,
                      showRed   && styles.tileWrong,
                    ]}
                  >
                    <Text style={[styles.tileText, { color: theme.headingText }]}>
                      {tile.label}
                    </Text>
                    {showGreen && <Ionicons name="checkmark-circle" size={24} color="#22C55E" />}
                    {showRed   && <Ionicons name="close-circle"     size={24} color="#FF4D6D" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleHearAgain}
                disabled={settled}
                style={[styles.hearAgainButton, { borderColor: theme.cardOutline }, settled && { opacity: 0.5 }]}
              >
                <Ionicons name="volume-high" size={20} color={theme.button} />
                <Text style={[styles.hearAgainText, { color: theme.button }]}>Hear it again</Text>
              </TouchableOpacity>
              {selectedId !== null && !settled && (
                <TouchableOpacity
                  onPress={handleConfirmTile}
                  style={[styles.confirmButton, { backgroundColor: theme.button }]}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Feedback toast ── */}
      <Animated.View style={[styles.feedbackBanner, { opacity: feedbackOp }]} pointerEvents="none">
        <Text style={styles.feedbackText}>{feedbackMsg}</Text>
      </Animated.View>

      {/* ── Parent Gate ── */}
      <ParentGateModal visible={showGate} onSuccess={onGateSuccess} onCancel={() => setShowGate(false)} />

      {/* ── Settings Sheet ── */}
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
  root: { flex: 1 },
  body: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {},
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(12), paddingVertical: rs(12), gap: rs(8) },
  headerSide:    { width: rs(40), alignItems: 'center', justifyContent: 'center' },
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
  levelLabel:    { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', opacity: 0.7 },
  progressTrack: { flex: 1, height: rs(8), backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: rs(4), overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: rs(4) },

  content: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.lg,
    paddingBottom:     Layout.spacing.lg,
  },

  title:    { fontSize: Layout.fontSize.xl, fontFamily: 'DMSans_700Bold', textAlign: 'center' },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.6, marginTop: rs(4), marginBottom: Layout.spacing.lg },

  sceneWrap: {
    width:        '85%',
    flex:         1,
    minHeight:    rs(150),
    maxHeight:    rs(320),
    borderRadius: Layout.radius.xl,
    overflow:     'hidden',
    marginBottom: Layout.spacing.xl,
    ...Layout.shadow.md,
  },
  sceneImg:    { width: '100%', height: '100%' },
  wordFallback: { fontSize: rf(52), fontFamily: 'DMSans_900Black' },

  tilesWrap: {
    width:          '100%',
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            Layout.spacing.md,
  },

  // Word options as the raised white answer cards the other dialogue screens
  // use: theme outline (set inline), thick bottom edge, lifted when chosen.
  tile: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               rs(8),
    backgroundColor:   '#FFFFFF',
    paddingVertical:   rs(14),
    paddingHorizontal: rs(28),
    borderRadius:      rs(16),
    borderWidth:       3,
    borderBottomWidth: 6,
    minWidth:          rs(130),
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: rs(4) },
    shadowOpacity:     0.1,
    shadowRadius:      10,
    elevation:         4,
  },
  // Chosen but not yet confirmed: lifted, thicker theme border, glow.
  tileSelected: {
    borderWidth:       4,
    borderBottomWidth: 6,
    transform:         [{ translateY: -4 }],
    shadowOpacity:     0.35,
    shadowRadius:      14,
    elevation:         10,
  },
  tileCorrect: { borderColor: '#22C55E', borderWidth: 4, borderBottomWidth: 6 },
  tileWrong:   { borderColor: '#FF4D6D', borderWidth: 3, borderBottomWidth: 6, opacity: 0.55 },
  tileText:    { fontSize: rf(22), fontFamily: 'DMSans_800ExtraBold' },

  feedbackBanner: { position: 'absolute', bottom: rs(60), left: 0, right: 0, alignItems: 'center', zIndex: 60 },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)', color: '#FFF',
    fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold',
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full, overflow: 'hidden',
  },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl },
  settingsTitle:   { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold', color: '#333' },
  settingsDivider:    { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: rs(4) },

  actionRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            rs(20),
    marginTop:      rs(20),
  },
  // Raised 3D buttons, the same as Magic Words / Greetings Phase 3.
  hearAgainButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               rs(8),
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: rs(26),
    paddingVertical:   rs(13),
    borderRadius:      rs(16),
    borderWidth:       2,
    borderBottomWidth: 5,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: rs(3) },
    shadowOpacity:     0.1,
    shadowRadius:      8,
    elevation:         4,
  },
  hearAgainText: { fontSize: rf(17), fontFamily: 'DMSans_800ExtraBold' },
  confirmButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               rs(8),
    paddingHorizontal: rs(34),
    paddingVertical:   rs(14),
    borderRadius:      rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: rs(4) },
    shadowOpacity:     0.18,
    shadowRadius:      10,
    elevation:         6,
  },
  confirmButtonText: { fontSize: rf(18), fontFamily: 'DMSans_800ExtraBold', color: '#FFFFFF' },
});
