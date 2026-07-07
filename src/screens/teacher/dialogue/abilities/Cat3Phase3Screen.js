import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';

// Scene images for Phase 3 — use Phase3 where available
const CAT3_CONTEXT_CORRECT = {
  cat3_yes: require('../../../../../assets/dialogue-images/words/abilities/yes_i_can/context_correct.png'),
  cat3_no:  require('../../../../../assets/dialogue-images/words/abilities/no_i_cant/context_correct.png'),
  clap:     require('../../../../../assets/dialogue-images/words/abilities/clap/Phase3.jpeg'),
  run:      require('../../../../../assets/dialogue-images/words/abilities/run/Phase3.jpeg'),
  walk:     require('../../../../../assets/dialogue-images/words/abilities/walk/Phase3.jpeg'),
  jump:     require('../../../../../assets/dialogue-images/words/abilities/jump/Phase3.jpeg'),
  talk:     require('../../../../../assets/dialogue-images/words/abilities/talk/context_correct.png'),
  dance:    require('../../../../../assets/dialogue-images/words/abilities/dance/context_correct.png'),
  sing:     require('../../../../../assets/dialogue-images/words/abilities/sing/context_correct.png'),
};

const PHASE3_PROMPT_AUDIO = require('../../../../../assets/dialogue-audios/abilities/Phase3_prompt_generic.mp3');

const PROGRESS_FRACTION = 0.90;

// All Cat3 word labels for picking distractors
const ALL_CAT3_LABELS = ['Yes', 'No', 'Clap', 'Run', 'Walk', 'Jump', 'Talk', 'Dance', 'Sing'];

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

function getSceneImage(wordKey) {
  return CAT3_CONTEXT_CORRECT[wordKey] ?? null;
}

function pickDistractors(correctLabel, count = 2) {
  const pool = ALL_CAT3_LABELS.filter(l => l !== correctLabel);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function Cat3Phase3Screen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? WORD_LABELS[wordKey] ?? wordKey;
  const sceneImg  = getSceneImage(wordKey);

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

    setTimeout(() => {
      if (activeRef.current) {
        navigation.navigate('Cat3WordComplete', {
          student, wordId, wordKey, wordLabel, sessionId, phase3Passed,
        });
      }
    }, 1400);
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

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => { setGatePurpose('back'); setShowGate(true); }} activeOpacity={0.7} style={styles.headerSide}>
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
              What is the avatar doing?
            </Text>
            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Tap the correct word!
            </Text>

            {/* Scene image */}
            {sceneImg ? (
              <View style={[styles.sceneWrap, { backgroundColor: theme.cardSurface }]}>
                <Image source={sceneImg} style={styles.sceneImg} resizeMode="contain" />
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
                      { backgroundColor: theme.cardSurface },
                      showProvisional && { borderColor: theme.button, borderWidth: 2.5 },
                      showGreen && styles.tileCorrect,
                      showRed   && styles.tileWrong,
                    ]}
                  >
                    <Text style={[styles.tileText, { color: theme.button }]}>
                      {tile.label}
                    </Text>
                    {showGreen && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
                    {showRed   && <Ionicons name="close-circle"     size={20} color="#FF4D6D" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleHearAgain}
                disabled={settled}
                style={[styles.hearAgainButton, { borderColor: theme.button }]}
              >
                <Ionicons name="volume-high-outline" size={16} color={theme.button} />
                <Text style={[styles.hearAgainText, { color: theme.button }]}>Hear it again</Text>
              </TouchableOpacity>
              {selectedId !== null && !settled && (
                <TouchableOpacity
                  onPress={handleConfirmTile}
                  style={[styles.confirmButton, { backgroundColor: theme.button }]}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </SafeAreaView>
      </View>

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

  content: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.lg,
    paddingBottom:     Layout.spacing.lg,
  },

  title:    { fontSize: Layout.fontSize.xl, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.6, marginTop: 4, marginBottom: Layout.spacing.lg },

  sceneWrap: {
    width:        '85%',
    flex:         1,
    minHeight:    150,
    maxHeight:    320,
    borderRadius: Layout.radius.xl,
    overflow:     'hidden',
    marginBottom: Layout.spacing.xl,
    ...Layout.shadow.md,
  },
  sceneImg:    { width: '100%', height: '100%' },
  wordFallback: { fontSize: 52, fontWeight: '900' },

  tilesWrap: {
    width:          '100%',
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            Layout.spacing.md,
  },

  tile: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingVertical:   Layout.spacing.md,
    paddingHorizontal: Layout.spacing.xl,
    borderRadius:      Layout.radius.xl,
    borderWidth:       2,
    borderColor:       'transparent',
    minWidth:          100,
    ...Layout.shadow.md,
  },
  tileCorrect: { borderColor: '#22C55E', borderWidth: 2.5 },
  tileWrong:   { borderColor: '#FF4D6D', opacity: 0.7 },
  tileText:    { fontSize: Layout.fontSize.lg, fontWeight: '800' },

  feedbackBanner: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 60 },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)', color: '#FFF',
    fontSize: Layout.fontSize.md, fontWeight: '700',
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full, overflow: 'hidden',
  },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl },
  settingsTitle:   { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },

  actionRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            Layout.spacing.md,
    marginTop:      Layout.spacing.md,
  },
  hearAgainButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   8,
    borderRadius:      Layout.radius.full,
    borderWidth:       1.5,
  },
  hearAgainText: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.bold },
  confirmButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   8,
    borderRadius:      Layout.radius.full,
  },
  confirmButtonText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, color: '#FFFFFF' },
});
