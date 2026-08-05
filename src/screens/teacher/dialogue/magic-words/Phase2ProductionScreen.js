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
import { Audio, Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';
import { useGuardedRecorder } from '../../../../utils/useGuardedRecorder';

// Progress: Phase 2 sits at ~85% through Level 1
const PROGRESS_FRACTION = 0.85;

const WORD_DISPLAY = {
  thank_you:        'Thank You',
  im_sorry:         "I'm Sorry",
  youre_welcome:    "You're Welcome",
  excuse_me: 'Excuse Me',
};

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

// Only Lily has a production video; other avatars fall back to static image
const PRODUCTION_VIDEOS = {
  lily: require('../../../../../assets/avatar-videos/Lily_Production.mp4'),
  boba: require('../../../../../assets/avatar-videos/Boba_Dancing.mp4'),
  megatron: require('../../../../../assets/avatar-videos/MegatronDancing.mp4'),
  glitter: require('../../../../../assets/avatar-videos/GlitterDancing.mp4'),
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
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;
  const prodVideo = PRODUCTION_VIDEOS[avatarKey] ?? null;

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
    timerRef.current = setTimeout(enterNoResponse, 15_000);
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
    timerRef.current = setTimeout(enterReprompt1, 10_000);
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
    timerRef.current = setTimeout(enterReprompt1, 10_000);
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
    timerRef.current = setTimeout(enterReprompt2, 20_000);
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
    timerRef.current = setTimeout(enterNonverbal, 20_000);
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
      navigation.navigate('DialogueCategory', { student });
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

  const WORD_UPPER   = wordLabel.toUpperCase();
  const isRecording  = recorderState === 'recording';
  const isDimmed     = [P.INTRO, P.PROCESSING, P.DONE, P.NONVERBAL].includes(phase)
    || recorderState === 'starting' || recorderState === 'stopping';
  const showProdVideo = phase === P.INTRO && prodVideo !== null;

  return (
    <View style={styles.root}>

      {/* ── Header ──────────────────────────────────────────── */}
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

      {/* ── Body ────────────────────────────────────────────── */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            {/* Title */}
            <Text style={[styles.title, { color: theme.headingText }]}>
              {'Can you say '}
              <Text style={[styles.titleEmphasis, { color: theme.headingText }]}>
                {`"${WORD_UPPER}"`}
              </Text>
              {'?'}
            </Text>
            <Text style={[styles.titleSinhala, { color: theme.headingText }]}>
              {`"${wordLabel}" කිව හැකිද?`}
            </Text>

            {/* Word tile — tap to hear audio */}
            <TouchableOpacity
              style={[
                styles.wordTile,
                { backgroundColor: theme.cardSurface },
                tileGlow && { borderColor: theme.button, borderWidth: 3 },
              ]}
              onPress={handleTileTap}
              activeOpacity={0.85}
            >
              <View style={[styles.speakerCircle, { backgroundColor: theme.button + '22' }]}>
                <Ionicons name="volume-high" size={36} color={theme.button} />
              </View>
              {showCue ? (() => {
                const [pre, cue, suf] = splitWordByCue(wordLabel, cueGrapheme);
                return (
                  <Text style={[styles.wordText, { color: theme.button }]}>
                    {pre}
                    <Text style={styles.wordTextCue}>{cue}</Text>
                    {suf.replace(' ', '\n')}
                  </Text>
                );
              })() : (
                <Text style={[styles.wordText, { color: theme.button }]}>
                  {wordLabel.replace(' ', '\n')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Hint */}
            <View style={styles.hintRow}>
              <Ionicons name="hand-left-outline" size={15} color={theme.headingText} style={{ opacity: 0.45 }} />
              <Text style={[styles.hintText, { color: theme.headingText }]}>
                Click on the card to hear the audio  ·  ශ්‍රව්‍ය ඇසීමට කාඩ්පත ස්පර්ශ කරන්න
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* Bottom row: record section + avatar */}
            <View style={styles.bottomRow}>

              {/* Record Audio button */}
              <View style={styles.recordSection}>
                <TouchableOpacity
                  style={[
                    styles.recordBtn,
                    isRecording
                      ? styles.recordBtnStop
                      : { backgroundColor: '#2DC98E' },
                    btnGlow && styles.recordBtnGlow,
                    isDimmed && styles.recordBtnDimmed,
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
                <Text style={[styles.tapSpeak, { color: theme.headingText }]}>TAP AND SPEAK  ·  ස්පර්ශ කර කතා කරන්න</Text>
              </View>

              {/* Avatar + speech bubble */}
              <View style={styles.avatarWrap}>
                <View style={[styles.speechBubble, { backgroundColor: theme.cardSurface }]}>
                  <Text style={[styles.speechText, { color: theme.headingText }]} numberOfLines={3}>
                    {cloudText}
                  </Text>
                  <View style={[styles.bubbleTail, { borderTopColor: theme.cardSurface }]} />
                </View>

                {showProdVideo ? (
                  <Video
                    source={prodVideo}
                    style={styles.avatarMedia}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping
                    isMuted
                  />
                ) : (
                  <Image source={avatarImg} style={styles.avatarMedia} resizeMode="contain" />
                )}
              </View>

            </View>

            {/* Next button — teacher gate protected */}
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextPress} activeOpacity={0.75}>
              <Text style={[styles.nextBtnText, { color: theme.button }]}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.button} />
            </TouchableOpacity>

          </View>
        </SafeAreaView>
      </View>

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
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  levelLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    opacity: 0.7,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  /* Content */
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },

  /* Title */
  title: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  titleEmphasis: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '900',
  },
  titleSinhala: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.65,
    marginBottom: Layout.spacing.lg,
  },

  /* Word tile */
  wordTile: {
    minWidth: 240,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.xl,
    alignItems: 'center',
    gap: Layout.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#6478C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  speakerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordText: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
  },
  wordTextCue: {
    fontWeight: '900',
    textDecorationLine: 'underline',
    color: '#E05C2A',   // warm orange — contrasts with theme.button on all avatar themes
  },

  /* Hint */
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Layout.spacing.sm,
    opacity: 0.6,
  },
  hintText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '500',
  },

  /* Bottom row */
  bottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: Layout.spacing.sm,
  },

  /* Record section */
  recordSection: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingBottom: Layout.spacing.md,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  recordBtnStop: {
    backgroundColor: '#FF4D6D',
  },
  recordBtnGlow: {
    borderWidth: 3,
    borderColor: '#2DC98E',
    shadowColor: '#2DC98E',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  recordBtnDimmed: { opacity: 0.4 },
  recordBtnText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: '#FFF',
  },
  tapSpeak: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.45,
  },

  /* Avatar + bubble */
  avatarWrap: {
    alignItems: 'center',
    width: 130,
  },
  speechBubble: {
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm,
    maxWidth: 140,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  speechText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    left: '50%',
    marginLeft: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  avatarMedia: {
    width: 115,
    height: 135,
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

  /* Next button */
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
  },
  nextBtnText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
  },
});
