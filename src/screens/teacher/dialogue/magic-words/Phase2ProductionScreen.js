import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { dialogueApi } from '../../../../api/dialogue';
import { useGuardedRecorder } from '../../../../utils/useGuardedRecorder';
import { LinearGradient } from 'expo-linear-gradient';
import ProductionStage from '../../../../components/dialogue/ProductionStage';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs } from '../../../../utils/responsive';

// Progress: Phase 2 sits at ~85% through Level 1
const PROGRESS_FRACTION = 0.85;

const WORD_DISPLAY = {
  thank_you:        'Thank You',
  im_sorry:         "I'm Sorry",
  youre_welcome:    "You're Welcome",
  excuse_me: 'Excuse Me',
};

// Shared audio clips used for all words
const AUDIO = {
  tapToListen:   require('../../../../../assets/dialogue-audios/Tap_on_the_button_to_listen_again.mp3'),
  tapRecordBtn:  require('../../../../../assets/dialogue-audios/Tap_the_record_button_and_speak.mp3'),
  youCanDoIt:    require('../../../../../assets/dialogue-audios/You_can_do_it.mp3'),
  repeatAfterMe: require('../../../../../assets/dialogue-audios/Repeat_after_me.mp3'),
  goodJob:       require('../../../../../assets/dialogue-audios/Good_job.mp3'),
};

const WORD_AUDIO = {
  thank_you: {
    word:      require('../../../../../assets/dialogue-audios/magic_words/Thankyou.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/magic_words/Can_you_say_Thankyou.mp3'),
  },
  im_sorry: {
    word:      require('../../../../../assets/dialogue-audios/magic_words/Im_sorry.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/magic_words/Can_you_say_Im_sorry.mp3'),
  },
  youre_welcome: {
    word:      require('../../../../../assets/dialogue-audios/magic_words/you_re_welcome.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/magic_words/Can_you_say_You_re_welcome.mp3'),
  },
  excuse_me: {
    word:      require('../../../../../assets/dialogue-audios/magic_words/Excuse_me.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/magic_words/Can_you_say_Excuse_me.mp3'),
  },
};

const P = {
  INTRO:       'intro',
  LISTENING:   'listening',
  NO_RESPONSE: 'noResponse',
  REC_HINT:    'recHint',
  REPROMPT_1:  'reprompt1',
  REPROMPT_2:  'reprompt2',
  NONVERBAL:   'nonverbal',
  RECORDING:   'recording',
  PROCESSING:  'processing',
  PARTIAL_1:   'partial1',
  PARTIAL_2:   'partial2',
  DONE:        'done',
};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * RC-PROMPT: Split a word label into [prefix, cue, suffix] for grapheme highlight.
 * cueGrapheme is case-insensitive. Returns ['', '', wordLabel] if no match found.
 * Example: splitWordByCue('Thank you', 'TH') → ['', 'Th', 'ank you']
 */
function splitWordByCue(wordLabel, cueGrapheme) {
  if (!cueGrapheme) return ['', '', wordLabel];
  const idx = wordLabel.toUpperCase().indexOf(cueGrapheme.toUpperCase());
  if (idx === -1) return ['', '', wordLabel];
  return [
    wordLabel.slice(0, idx),
    wordLabel.slice(idx, idx + cueGrapheme.length),
    wordLabel.slice(idx + cueGrapheme.length),
  ];
}

async function uriToBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Phase2ProductionScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you', wordId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const wordAudio = WORD_AUDIO[wordKey] ?? WORD_AUDIO.thank_you;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [phase, _setPhase]         = useState(P.INTRO);
  const [cloudText, setCloudText]  = useState(wordLabel);
  const [tileGlow, setTileGlow]    = useState(false);
  const [btnGlow, setBtnGlow]      = useState(false);
  const [showCue, setShowCue]      = useState(false);   // RC-PROMPT: grapheme highlight active
  const [cueGrapheme, setCueGrapheme] = useState(null);  // RC-PROMPT: fetched by wordId at mount (TASK-06 A1) — not relied on via route.params
  const [showGate, setShowGate]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose, setGatePurpose]   = useState('settings');

  // ── Refs ──────────────────────────────────────────────────────────────────
  const phaseRef      = useRef(P.INTRO);
  const activeRef     = useRef(true);
  const soundRef      = useRef(null);
  const slowSoundRef  = useRef(null);  // RC-PROMPT: separate ref for slowed playback
  const timerRef      = useRef(null);
  const tileTapTimer  = useRef(null);
  const attemptRef    = useRef(0);   // # of recording submissions
  const tileTapRef    = useRef(0);   // # of word-tile taps without recording
  const sessionIdRef  = useRef(null); // session_id returned by first Phase 2 assess call
  const avatarAudioEndRef = useRef(null); // RC3 — when the last avatar prompt finished
  const recordingStartRef = useRef(null); // RC3 — when the current recording started
  const micDelayRef       = useRef(0);    // RC3 — delay (ms) to apply before the next recording
  // TASK-12: Non-Verbal Adaptive Wait-Time Escalation. Populated on mount by
  // getSpeechState(); at streak 0 multiplier is 1.0 — behaviour unchanged.
  const waitMultiplierRef    = useRef(1.0);
  const autoNonverbalRef     = useRef(false);
  const settingsFade  = useRef(new Animated.Value(0)).current;

  function setPhase(p) {
    phaseRef.current = p;
    if (activeRef.current) _setPhase(p);
  }

  function say(text) {
    if (activeRef.current) setCloudText(text);
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  // TASK-12: scale a wait duration by today's speech-escalation multiplier.
  // At multiplier 1.0 (streak 0) this is a no-op — byte-identical to pre-TASK-12.
  function w(ms) { return Math.round(ms * waitMultiplierRef.current); }

  const { state: recorderState, toggleRecording, reset: resetRecorder } = useGuardedRecorder({
    rc3Refs: { recordingStartRef, micDelayRef },
    onGetReady: () => say('Get ready...'),
    onStart: async () => {
      setPhase(P.RECORDING);
      await delay(300); // let mic warm up before cueing the child — avoids clipping short-word onsets
      say('Listening...');
    },
    onStop: uri => submitRecording(uri),
    onError: () => startListening(),
  });

  // ── Audio ─────────────────────────────────────────────────────────────────

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

  /**
   * RC-PROMPT Tier 2: play the word audio at 60% speed with pitch correction.
   * Uses a separate soundRef so it never cancels the main playSound() chain.
   */
  async function playSlowWord() {
    try {
      if (slowSoundRef.current) {
        await slowSoundRef.current.stopAsync().catch(() => {});
        await slowSoundRef.current.unloadAsync().catch(() => {});
        slowSoundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(wordAudio.word);
      slowSoundRef.current = sound;
      // 0.6 = 60% speed; true = correct pitch so it doesn't sound distorted
      await sound.setRateAsync(0.6, true);
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

  // ── RC-PROMPT: fetch cue_grapheme by wordId (TASK-06 A1) ────────────────────
  // Degrades gracefully — a failed fetch or a word with no cue_grapheme just
  // leaves cueGrapheme null, so splitWordByCue() never highlights anything.

  useEffect(() => {
    let cancelled = false;
    if (!wordId) return undefined;
    dialogueApi.getWordById(wordId)
      .then(word => { if (!cancelled) setCueGrapheme(word?.cue_grapheme ?? null); })
      .catch(() => { if (!cancelled) setCueGrapheme(null); });
    return () => { cancelled = true; };
  }, [wordId]);

  // ── Intro sequence ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function runIntro() {
      // TASK-12: fetch today's speech escalation state before any timer fires.
      // Must happen first so waitMultiplierRef is set when startListening() runs.
      // Failure is silent — multiplier defaults to 1.0 (normal behaviour).
      if (student?.sid) {
        try {
          const state = await dialogueApi.getSpeechState(student.sid);
          waitMultiplierRef.current = state?.wait_multiplier ?? 1.0;
          autoNonverbalRef.current  = state?.auto_nonverbal_today ?? false;
        } catch { /* degrade gracefully to multiplier 1.0 */ }
      }
      if (cancelled) return;

      // TASK-12: ≥3 consecutive refusals today → skip production entirely;
      // route straight to the existing non-verbal pathway (no production UI shown).
      if (autoNonverbalRef.current) {
        await delay(50); // yield so component finishes mounting before navigating
        if (activeRef.current) {
          navigation.navigate('Phase2NonVerbal', {
            student, wordKey, wordId,
            sessionId: sessionIdRef.current,
          });
        }
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      if (cancelled) return;

      // Play word audio twice with speech bubble showing the word
      say(wordLabel);
      await playSound(wordAudio.word);
      if (cancelled) return;

      await delay(600);
      if (cancelled) return;

      await playSound(wordAudio.word);
      if (cancelled) return;

      await delay(400);
      if (cancelled) return;

      // "Can you say [word]?" — bubble updates, then mic auto-starts
      say(`Can you say "${wordLabel}"?`);
      await playSound(wordAudio.canYouSay);
      avatarAudioEndRef.current = Date.now(); // RC3
      if (cancelled) return;

      startListening();
    }
    runIntro();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup on blur ───────────────────────────────────────────────────────

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
      if (tileTapTimer.current) clearTimeout(tileTapTimer.current);
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      slowSoundRef.current?.stopAsync().catch(() => {});
      slowSoundRef.current?.unloadAsync().catch(() => {});
      resetRecorder();
    };
  }, []));

  // ── State machine ─────────────────────────────────────────────────────────

  function startListening() {
    if (!activeRef.current) return;
    setPhase(P.LISTENING);
    say(`Can you say "${wordLabel}"?`);
    setTileGlow(false);
    setBtnGlow(false);
    clearTimer();
    // TASK-12: w() scales the duration by today's wait_multiplier (1.0 at streak 0 → no-op)
    timerRef.current = setTimeout(enterNoResponse, w(15_000));
  }

  async function enterNoResponse() {
    if (!activeRef.current) return;
    setPhase(P.NO_RESPONSE);
    say('Tap on the button to listen again!');
    setTileGlow(true);
    setBtnGlow(false);
    clearTimer();
    await playSound(AUDIO.tapToListen);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    // 10-second window to tap the word tile before progressing
    timerRef.current = setTimeout(enterReprompt1, w(10_000)); // TASK-12
  }

  async function enterRecordHint() {
    if (!activeRef.current) return;
    setPhase(P.REC_HINT);
    say('Tap the record audio button and speak');
    setTileGlow(false);
    setBtnGlow(true);
    clearTimer();
    await playSound(AUDIO.tapRecordBtn);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    timerRef.current = setTimeout(enterReprompt1, w(10_000)); // TASK-12
  }

  async function enterReprompt1() {
    if (!activeRef.current) return;
    setPhase(P.REPROMPT_1);
    say(`Can you say "${wordLabel}"?`);
    setTileGlow(false);
    setBtnGlow(false);
    clearTimer();
    await playSound(wordAudio.canYouSay);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    timerRef.current = setTimeout(enterReprompt2, w(20_000)); // TASK-12
  }

  async function enterReprompt2() {
    if (!activeRef.current) return;
    setPhase(P.REPROMPT_2);
    say('You can do it!');
    setTileGlow(false);
    setBtnGlow(false);
    clearTimer();
    await playSound(AUDIO.youCanDoIt);
    avatarAudioEndRef.current = Date.now(); // RC3
    if (!activeRef.current) return;
    timerRef.current = setTimeout(enterNonverbal, w(20_000)); // TASK-12
  }

  async function enterNonverbal() {
    if (!activeRef.current) return;
    setPhase(P.NONVERBAL);
    say('Good job!');
    setTileGlow(false);
    setBtnGlow(false);
    clearTimer();
    await playSound(AUDIO.goodJob);
    if (!activeRef.current) return;
    await delay(800);
    // Non-verbal pathway — go to image-selection activity
    if (activeRef.current) {
      navigation.navigate('Phase2NonVerbal', {
        student, wordKey, wordId,
        sessionId: sessionIdRef.current,
      });
    }
  }

  // ── Word tile tap ─────────────────────────────────────────────────────────

  async function handleTileTap() {
    await playSound(wordAudio.word);

    tileTapRef.current += 1;

    if (phaseRef.current === P.NO_RESPONSE) {
      clearTimer();
      enterRecordHint();
      return;
    }

    // 5-tap scenario: child keeps tapping word instead of recording
    if (phaseRef.current === P.LISTENING && tileTapRef.current === 5) {
      clearTimer();
      if (tileTapTimer.current) clearTimeout(tileTapTimer.current);
      tileTapTimer.current = setTimeout(() => {
        if (activeRef.current && phaseRef.current === P.LISTENING) {
          tileTapRef.current = 0;
          enterNoResponse();
        }
      }, 30_000);
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  function handleRecordBtn() {
    if (recorderState === 'idle') {
      const recordable = [P.LISTENING, P.NO_RESPONSE, P.REC_HINT, P.REPROMPT_1, P.REPROMPT_2, P.PARTIAL_1, P.PARTIAL_2];
      if (!recordable.includes(phaseRef.current)) return;

      clearTimer();
      if (tileTapTimer.current) { clearTimeout(tileTapTimer.current); tileTapTimer.current = null; }
      setTileGlow(false);
      setBtnGlow(false);
      tileTapRef.current = 0;
    }
    toggleRecording();
  }

  async function submitRecording(uri) {
    setPhase(P.PROCESSING);
    say('...');

    try {
      const b64 = await uriToBase64(uri);
      attemptRef.current += 1;

      const res = await dialogueApi.assessPhase2Speech(
        student?.sid, wordId,
        {
          audioBase64: b64, mimeType: 'audio/m4a', sessionId: sessionIdRef.current,
          avatarAudioEndTs: avatarAudioEndRef.current, recordingStartTs: recordingStartRef.current,
        }
      );

      // Capture session_id from the first response for continuity
      if (res.session_id && !sessionIdRef.current) {
        sessionIdRef.current = res.session_id;
      }

      micDelayRef.current = res.mic_delay_ms ?? 0; // RC3

      if (!activeRef.current) return;

      if (res.advance_to_phase3) {
        setShowCue(false);
        setPhase(P.DONE);
        say('Great job!');
        await delay(1500);
        if (activeRef.current) {
          navigation.navigate('Phase3Contextual', {
            student, wordKey, wordId,
            sessionId: sessionIdRef.current,
          });
        }
        return;
      }

      if (res.trigger_nonverbal) {
        await enterNonverbal();
        return;
      }

      const n = attemptRef.current;
      if (res.score === 1) {
        // Partial attempt — child said at least one word
        if (n >= 3) {
          setPhase(P.DONE);
          say('Good job!');
          await playSound(AUDIO.goodJob);
          await delay(800);
          if (activeRef.current) {
            navigation.navigate('Phase3Contextual', {
              student, wordKey, wordId,
              sessionId: sessionIdRef.current,
            });
          }
        } else if (n === 2) {
          // ── RC-PROMPT Tier 3: simultaneous production ───────────────────
          setPhase(P.PARTIAL_2);
          setShowCue(true);
          say(`Say it with me! ${wordLabel}`);
          await playSound(AUDIO.repeatAfterMe);
          await delay(500);
          if (!activeRef.current) return;
          await playSound(wordAudio.word);
          avatarAudioEndRef.current = Date.now(); // RC3
        } else {
          // ── RC-PROMPT Tier 2: grapheme highlight + slow audio ───────────
          setPhase(P.PARTIAL_1);
          setShowCue(true);
          say(`Listen carefully... "${wordLabel}"`);
          await playSlowWord();
          avatarAudioEndRef.current = Date.now(); // RC3
        }
      } else {
        // score = 0: no recognisable speech — re-prompt
        setShowCue(false);
        await enterReprompt1();
      }
    } catch {
      startListening();
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function handleNextPress() { setGatePurpose('next'); setShowGate(true); }

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
    if (gatePurpose === 'next') {
      navigation.navigate('Phase3Contextual', { student, wordKey, wordId, sessionId: sessionIdRef.current });
      return;
    }
    setShowSettings(true);
    Animated.timing(settingsFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function closeSettings() {
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setShowSettings(false));
  }

  function handleSkipWord() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  // ── Derived render state ──────────────────────────────────────────────────

  const isRecording  = recorderState === 'recording';
  const isDimmed     = [P.INTRO, P.PROCESSING, P.DONE, P.NONVERBAL].includes(phase)
    || recorderState === 'starting' || recorderState === 'stopping';

  return (
    <View style={styles.root}>

      {/* ── Header ──────────────────────────────────────────── */}
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

      {/* ── Body ────────────────────────────────────────────── */}
      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.body}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <ProductionStage
            theme={theme}
            wordLabel={wordLabel}
            wordParts={showCue ? splitWordByCue(wordLabel, cueGrapheme) : null}
            tileGlow={tileGlow}
            onTileTap={handleTileTap}
            isRecording={isRecording}
            btnGlow={btnGlow}
            isDimmed={isDimmed}
            onRecord={handleRecordBtn}
            onNext={handleNextPress}
          />
        </SafeAreaView>
      </LinearGradient>

      {/* ── Parent Gate ─────────────────────────────────────── */}
      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onCancel={() => setShowGate(false)}
      />

      {/* ── Settings sheet ───────────────────────────────────── */}
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

  /* Header */
  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(12),
    paddingVertical: rs(12),
    gap: rs(8),
  },
  // Concept's round translucent header button.
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
  levelLabel: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    opacity: 0.7,
  },
  progressTrack: {
    flex: 1,
    height: rs(8),
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: rs(4),
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: rs(4) },

  /* Settings */
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
