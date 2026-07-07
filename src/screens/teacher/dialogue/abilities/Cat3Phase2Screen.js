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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';
import { useGuardedRecorder } from '../../../../utils/useGuardedRecorder';

const PROGRESS_FRACTION = 0.70;

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO = {
  goodJob:      require('../../../../../assets/dialogue-audios/Good_job.mp3'),
  youCanDoIt:   require('../../../../../assets/dialogue-audios/You_can_do_it.mp3'),
  tapRecordBtn: require('../../../../../assets/dialogue-audios/Tap_the_record_button_and_speak.mp3'),
};

const WORD_AUDIO = {
  clap:  require('../../../../../assets/dialogue-audios/abilities/clap.mp3'),
  run:   require('../../../../../assets/dialogue-audios/abilities/run.mp3'),
  walk:  require('../../../../../assets/dialogue-audios/abilities/walk.mp3'),
  jump:  require('../../../../../assets/dialogue-audios/abilities/jump.mp3'),
  dance: require('../../../../../assets/dialogue-audios/abilities/dance.mp3'),
  sing:  require('../../../../../assets/dialogue-audios/abilities/sing.mp3'),
  talk:  require('../../../../../assets/dialogue-audios/abilities/talk.mp3'),
};

const CAN_YOU_SAY_AUDIO = {
  clap: require('../../../../../assets/dialogue-audios/abilities/can_you_say_clap.mp3'),
  jump: require('../../../../../assets/dialogue-audios/abilities/can_you_say_jump.mp3'),
  run:  require('../../../../../assets/dialogue-audios/abilities/can_you_say_run.mp3'),
  walk: require('../../../../../assets/dialogue-audios/abilities/can_you_say_walk.mp3'),
};

const P = {
  INTRO:      'intro',
  LISTENING:  'listening',
  NO_RESP:    'noResponse',
  REPROMPT:   'reprompt',
  RECORDING:  'recording',
  PROCESSING: 'processing',
  PARTIAL:    'partial',
  NONVERBAL:  'nonverbal',
  DONE:       'done',
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uriToBase64(uri) {
  const response = await fetch(uri);
  const blob     = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Cat3Phase2Screen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? wordKey ?? '';
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const [phase, _setPhase]      = useState(P.INTRO);
  const [cloudText, setCloud]   = useState(`Can you say "${wordLabel}"?`);
  const [btnGlow,   setBtnGlow] = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

  const phaseRef      = useRef(P.INTRO);
  const activeRef     = useRef(true);
  const soundRef      = useRef(null);
  const timerRef      = useRef(null);
  const attemptRef    = useRef(0);
  const sessionIdRef  = useRef(sessionId ?? null);
  const avatarAudioEndRef = useRef(null); // RC3
  const recordingStartRef = useRef(null); // RC3
  const micDelayRef       = useRef(0);    // RC3
  const settingsFade  = useRef(new Animated.Value(0)).current;

  function setPhase(p) {
    phaseRef.current = p;
    if (activeRef.current) _setPhase(p);
  }

  function say(text) {
    if (activeRef.current) setCloud(text);
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  const { state: recorderState, toggleRecording, reset: resetRecorder } = useGuardedRecorder({
    rc3Refs: { recordingStartRef, micDelayRef },
    onGetReady: () => say('Get ready...'),
    onStart: () => { setPhase(P.RECORDING); say('Listening...'); },
    onStop: uri => submitRecording(uri),
    onError: () => startListening(),
  });

  async function playSound(source) {
    if (!source) return;
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
        sound.setOnPlaybackStatusUpdate(s => {
          if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); }
        });
      });
    } catch { /* ignore */ }
  }

  // ── Boot into listening on mount ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      if (cancelled) return;
      startListening();
    }
    init();
    return () => { cancelled = true; };
  }, []);

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
      clearTimer();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      resetRecorder();
    };
  }, []));

  // ── State machine ─────────────────────────────────────────────────────────

  function startListening() {
    if (!activeRef.current) return;
    setPhase(P.LISTENING);
    say(`Can you say "${wordLabel}"?`);
    setBtnGlow(false);
    clearTimer();
    const promptAudio = CAN_YOU_SAY_AUDIO[wordKey];
    if (promptAudio) {
      // RC3 — captured via .then() rather than await, since this call is
      // intentionally fire-and-forget and must not block the 15s timer below.
      playSound(promptAudio)
        .then(() => { avatarAudioEndRef.current = Date.now(); })
        .catch(() => {});
    }
    timerRef.current = setTimeout(enterNoResponse, 15_000);
  }

  async function enterNoResponse() {
    if (!activeRef.current) return;
    setPhase(P.NO_RESP);
    say('Tap the record button and speak!');
    setBtnGlow(true);
    clearTimer();
    await playSound(AUDIO.tapRecordBtn);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    timerRef.current = setTimeout(enterReprompt, 10_000);
  }

  async function enterReprompt() {
    if (!activeRef.current) return;
    setPhase(P.REPROMPT);
    say('You can do it!');
    setBtnGlow(false);
    clearTimer();
    await playSound(AUDIO.youCanDoIt);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    timerRef.current = setTimeout(goNonverbal, 20_000);
  }

  async function goNonverbal() {
    if (!activeRef.current) return;
    setPhase(P.NONVERBAL);
    say('Good job!');
    setBtnGlow(false);
    clearTimer();
    await playSound(AUDIO.goodJob);
    if (!activeRef.current) return;
    await delay(800);
    if (activeRef.current) {
      navigation.navigate('Cat3Phase2NonVerbal', {
        student, wordId, wordKey, wordLabel, sessionId: sessionIdRef.current,
      });
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  function handleRecordBtn() {
    if (recorderState === 'idle') {
      const recordable = [P.LISTENING, P.NO_RESP, P.REPROMPT, P.PARTIAL];
      if (!recordable.includes(phaseRef.current)) return;

      clearTimer();
      setBtnGlow(false);
    }
    toggleRecording();
  }

  async function submitRecording(uri) {
    setPhase(P.PROCESSING);
    say('...');

    try {
      const b64 = await uriToBase64(uri);
      attemptRef.current += 1;

      const res = await cat3Api.assessPhase2Speech(
        student?.sid, wordId, b64, 'audio/m4a', sessionIdRef.current,
        avatarAudioEndRef.current, recordingStartRef.current,
      );

      micDelayRef.current = res.mic_delay_ms ?? 0; // RC3

      if (res.session_id && !sessionIdRef.current) {
        sessionIdRef.current = res.session_id;
      }

      if (!activeRef.current) return;

      if (res.trigger_nonverbal) {
        await goNonverbal();
        return;
      }

      if (res.advance_to_phase3) {
        setPhase(P.DONE);
        say('Great job!');
        await delay(1200);
        if (activeRef.current) {
          navigation.navigate('Cat3Phase3', {
            student, wordId, wordKey, wordLabel, sessionId: sessionIdRef.current,
          });
        }
        return;
      }

      if (res.score >= 1) {
        if (attemptRef.current >= 3) {
          setPhase(P.DONE);
          say('Good job!');
          await playSound(AUDIO.goodJob);
          await delay(800);
          if (activeRef.current) {
            navigation.navigate('Cat3Phase3', {
              student, wordId, wordKey, wordLabel, sessionId: sessionIdRef.current,
            });
          }
        } else {
          setPhase(P.PARTIAL);
          say(`Try again! Can you say "${wordLabel}"?`);
          timerRef.current = setTimeout(enterReprompt, 20_000);
        }
      } else {
        await enterReprompt();
      }
    } catch {
      startListening();
    }
  }

  // ── Settings / gate ───────────────────────────────────────────────────────

  function openSettings()   { setGatePurpose('settings'); setShowGate(true); }
  function handleNextPress() { setGatePurpose('next');    setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      navigation.navigate('DialogueCategory', { student });
      return;
    }
    if (gatePurpose === 'next') {
      navigation.navigate('Cat3Phase3', { student, wordId, wordKey, wordLabel, sessionId: sessionIdRef.current });
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

  const isRecording = recorderState === 'recording';
  const isDimmed    = [P.INTRO, P.PROCESSING, P.DONE, P.NONVERBAL].includes(phase)
    || recorderState === 'starting' || recorderState === 'stopping';
  const WORD_UPPER  = wordLabel.toUpperCase();

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
              {'Can you say '}
              <Text style={{ fontWeight: '900', color: theme.button }}>{`"${WORD_UPPER}"`}</Text>
              {'?'}
            </Text>

            {/* Word tile — tap to hear the word */}
            <TouchableOpacity
              style={[styles.wordTile, { backgroundColor: theme.cardSurface }]}
              onPress={() => { const a = WORD_AUDIO[wordKey]; if (a) playSound(a).catch(() => {}); }}
              activeOpacity={0.82}
            >
              <View style={[styles.speakerCircle, { backgroundColor: theme.button + '22' }]}>
                <Ionicons name="volume-high" size={36} color={theme.button} />
              </View>
              <Text style={[styles.wordText, { color: theme.button }]}>{wordLabel}</Text>
            </TouchableOpacity>

            <View style={styles.hintRow}>
              <Ionicons name="hand-left-outline" size={14} color={theme.headingText} style={{ opacity: 0.4 }} />
              <Text style={[styles.hintText, { color: theme.headingText }]}>Tap card to hear the word</Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* Bottom: record + avatar */}
            <View style={styles.bottomRow}>

              <View style={styles.recordSection}>
                <TouchableOpacity
                  style={[
                    styles.recordBtn,
                    isRecording ? styles.recordBtnStop : { backgroundColor: '#2DC98E' },
                    btnGlow      && styles.recordBtnGlow,
                    isDimmed     && styles.recordBtnDimmed,
                  ]}
                  onPress={handleRecordBtn}
                  activeOpacity={0.85}
                  disabled={isDimmed}
                >
                  <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={20} color="#FFF" />
                  <Text style={styles.recordBtnText}>
                    {isRecording ? 'Stop Recording' : 'Record Audio'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.tapSpeak, { color: theme.headingText }]}>TAP AND SPEAK</Text>
              </View>

              <View style={styles.avatarWrap}>
                <View style={[styles.speechBubble, { backgroundColor: theme.cardSurface }]}>
                  <Text style={[styles.speechText, { color: theme.headingText }]} numberOfLines={3}>
                    {cloudText}
                  </Text>
                  <View style={[styles.bubbleTail, { borderTopColor: theme.cardSurface }]} />
                </View>
                <Image source={avatarImg} style={styles.avatarMedia} resizeMode="contain" />
              </View>

            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextPress} activeOpacity={0.75}>
              <Text style={[styles.nextBtnText, { color: theme.button }]}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.button} />
            </TouchableOpacity>

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
    paddingBottom:     Layout.spacing.md,
  },

  title: { fontSize: Layout.fontSize.xl, fontWeight: '600', textAlign: 'center', marginBottom: Layout.spacing.lg },

  wordTile: {
    minWidth:     200,
    borderRadius: Layout.radius.xl,
    padding:      Layout.spacing.xl,
    alignItems:   'center',
    gap:          Layout.spacing.md,
    borderWidth:  2,
    borderColor:  'transparent',
    ...Layout.shadow.md,
  },
  speakerCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  wordText:      { fontSize: Layout.fontSize.xl, fontWeight: '900', textAlign: 'center' },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Layout.spacing.sm, opacity: 0.55 },
  hintText: { fontSize: Layout.fontSize.xs, fontWeight: '500' },

  bottomRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: Layout.spacing.sm },

  recordSection: { flex: 1, alignItems: 'center', gap: 8, paddingBottom: Layout.spacing.md },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full, ...Layout.shadow.md,
  },
  recordBtnStop:   { backgroundColor: '#FF4D6D' },
  recordBtnGlow:   { borderWidth: 3, borderColor: '#2DC98E', shadowColor: '#2DC98E', shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 },
  recordBtnDimmed: { opacity: 0.4 },
  recordBtnText:   { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#FFF' },
  tapSpeak:        { fontSize: Layout.fontSize.xs, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },

  avatarWrap:  { alignItems: 'center', width: 130 },
  speechBubble: {
    borderRadius: Layout.radius.lg, paddingHorizontal: Layout.spacing.sm, paddingVertical: Layout.spacing.sm,
    maxWidth: 140, marginBottom: 6, position: 'relative', ...Layout.shadow.sm,
  },
  speechText:  { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  bubbleTail:  { position: 'absolute', bottom: -7, left: '50%', marginLeft: -7, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  avatarMedia: { width: 115, height: 135 },

  nextBtn:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md, marginBottom: Layout.spacing.sm },
  nextBtnText: { fontSize: Layout.fontSize.sm, fontWeight: '700' },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet:   { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl },
  settingsTitle:   { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
});
