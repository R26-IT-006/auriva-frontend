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

const PROGRESS_FRACTION = 0.85;

const WORD_DISPLAY = {
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

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const PRODUCTION_VIDEOS = {
  lily:     require('../../../../../assets/avatar-videos/Lily_Production.mp4'),
  boba:     require('../../../../../assets/avatar-videos/Boba_Dancing.mp4'),
  megatron: require('../../../../../assets/avatar-videos/MegatronDancing.mp4'),
  glitter:  require('../../../../../assets/avatar-videos/GlitterDancing.mp4'),
};

const AUDIO = {
  tapToListen:   require('../../../../../assets/dialogue-audios/Tap_on_the_button_to_listen_again.mp3'),
  tapRecordBtn:  require('../../../../../assets/dialogue-audios/Tap_the_record_button_and_speak.mp3'),
  youCanDoIt:    require('../../../../../assets/dialogue-audios/You_can_do_it.mp3'),
  repeatAfterMe: require('../../../../../assets/dialogue-audios/Repeat_after_me.mp3'),
  goodJob:       require('../../../../../assets/dialogue-audios/Good_job.mp3'),
};

const PLACEHOLDER_WORD    = require('../../../../../assets/dialogue-audios/magic_words/Thankyou.mp3');
const PLACEHOLDER_CAN_SAY = require('../../../../../assets/dialogue-audios/magic_words/Can_you_say_Thankyou.mp3');

const WORD_AUDIO = {
  hello: {
    word:      require('../../../../../assets/dialogue-audios/greetings/hello.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/greetings/can_you_say_hello.mp3'),
  },
  goodbye: {
    word:      require('../../../../../assets/dialogue-audios/greetings/goodbye.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/greetings/can_you_say_goodbye.mp3'),
  },
  good_morning: {
    word:      require('../../../../../assets/dialogue-audios/greetings/good_morning.mp3'),
    canYouSay: require('../../../../../assets/dialogue-audios/greetings/can_you_say_goodmorning.mp3'),
  },
  good_afternoon: { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
  good_night:     { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
  happy_birthday: { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
  how_are_you:    { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
  im_fine:        { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
  happy_new_year: { word: PLACEHOLDER_WORD, canYouSay: PLACEHOLDER_CAN_SAY },
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

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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

export default function GreetingPhase2ProductionScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const wordAudio = WORD_AUDIO[wordKey] ?? WORD_AUDIO.hello;
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;
  const prodVideo = PRODUCTION_VIDEOS[avatarKey] ?? null;

  const [phase, _setPhase]         = useState(P.INTRO);
  const [cloudText, setCloudText]  = useState(wordLabel);
  const [tileGlow, setTileGlow]    = useState(false);
  const [btnGlow, setBtnGlow]      = useState(false);
  const [showGate, setShowGate]    = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose, setGatePurpose]   = useState('settings');

  const phaseRef      = useRef(P.INTRO);
  const activeRef     = useRef(true);
  const soundRef      = useRef(null);
  const timerRef      = useRef(null);
  const tileTapTimer  = useRef(null);
  const attemptRef    = useRef(0);
  const tileTapRef    = useRef(0);
  const sessionIdRef  = useRef(null);
  const avatarAudioEndRef = useRef(null); // RC3
  const recordingStartRef = useRef(null); // RC3
  const micDelayRef       = useRef(0);    // RC3
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
    onStart: () => { setPhase(P.RECORDING); say('Listening...'); },
    onStop: uri => submitRecording(uri),
    onError: () => startListening(),
  });

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

  useEffect(() => {
    let cancelled = false;
    async function runIntro() {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      if (cancelled) return;
      say(wordLabel);
      await playSound(wordAudio.word);
      if (cancelled) return;
      await delay(600);
      if (cancelled) return;
      await playSound(wordAudio.word);
      if (cancelled) return;
      await delay(400);
      if (cancelled) return;
      say(`Can you say "${wordLabel}"?`);
      await playSound(wordAudio.canYouSay);
      avatarAudioEndRef.current = Date.now(); // RC3
      if (cancelled) return;
      startListening();
    }
    runIntro();
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
      if (tileTapTimer.current) clearTimeout(tileTapTimer.current);
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      resetRecorder();
    };
  }, []));

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
    if (activeRef.current) {
      navigation.navigate('GreetingPhase2NonVerbal', {
        student, wordKey, wordId,
        sessionId: sessionIdRef.current,
      });
    }
  }

  async function handleTileTap() {
    await playSound(wordAudio.word);
    tileTapRef.current += 1;
    if (phaseRef.current === P.NO_RESPONSE) {
      clearTimer();
      enterRecordHint();
      return;
    }
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

      if (res.session_id && !sessionIdRef.current) {
        sessionIdRef.current = res.session_id;
      }

      micDelayRef.current = res.mic_delay_ms ?? 0; // RC3

      if (!activeRef.current) return;

      if (res.advance_to_phase3) {
        setPhase(P.DONE);
        say('Great job!');
        await delay(1500);
        if (activeRef.current) {
          navigation.navigate('GreetingPhase3Contextual', {
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
        if (n >= 3) {
          setPhase(P.DONE);
          say('Good job!');
          await playSound(AUDIO.goodJob);
          await delay(800);
          if (activeRef.current) {
            navigation.navigate('GreetingPhase3Contextual', {
              student, wordKey, wordId,
              sessionId: sessionIdRef.current,
            });
          }
        } else if (n === 2) {
          setPhase(P.PARTIAL_2);
          say(`Repeat after me, ${wordLabel}`);
          await playSound(AUDIO.repeatAfterMe);
          await delay(2000);
          if (!activeRef.current) return;
          await playSound(wordAudio.word);
          avatarAudioEndRef.current = Date.now(); // RC3
        } else {
          setPhase(P.PARTIAL_1);
          say(`Can you say "${wordLabel}"?`);
          await playSound(wordAudio.canYouSay);
          avatarAudioEndRef.current = Date.now(); // RC3
        }
      } else {
        await enterReprompt1();
      }
    } catch {
      startListening();
    }
  }

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }
  function handleNextPress() { setGatePurpose('next'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      navigation.navigate('DialogueCategory', { student });
      return;
    }
    if (gatePurpose === 'next') {
      navigation.navigate('GreetingPhase3Contextual', { student, wordKey, wordId, sessionId: sessionIdRef.current });
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

  const WORD_UPPER   = wordLabel.toUpperCase();
  const isRecording  = recorderState === 'recording';
  const isDimmed     = [P.INTRO, P.PROCESSING, P.DONE, P.NONVERBAL].includes(phase)
    || recorderState === 'starting' || recorderState === 'stopping';
  const showProdVideo = phase === P.INTRO && prodVideo !== null;

  return (
    <View style={styles.root}>
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

      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

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
              <Text style={[styles.wordText, { color: theme.button }]}>
                {wordLabel.replace(' ', '\n')}
              </Text>
            </TouchableOpacity>

            <View style={styles.hintRow}>
              <Ionicons name="hand-left-outline" size={15} color={theme.headingText} style={{ opacity: 0.45 }} />
              <Text style={[styles.hintText, { color: theme.headingText }]}>
                Click on the card to hear the audio  ·  ශ්‍රව්‍ය ඇසීමට කාඩ්පත ස්පර්ශ කරන්න
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.bottomRow}>
              <View style={styles.recordSection}>
                <TouchableOpacity
                  style={[
                    styles.recordBtn,
                    isRecording ? styles.recordBtnStop : { backgroundColor: '#2DC98E' },
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

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextPress} activeOpacity={0.75}>
              <Text style={[styles.nextBtnText, { color: theme.button }]}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.button} />
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
  root: { flex: 1 },
  body: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  levelLabel: { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
  },

  title: { fontSize: Layout.fontSize.xl, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  titleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '600', textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.lg },
  titleEmphasis: { fontSize: Layout.fontSize.xl, fontWeight: '900' },

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
  wordText: { fontSize: Layout.fontSize.xl, fontWeight: '900', textAlign: 'center', lineHeight: 28 },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Layout.spacing.sm, opacity: 0.6 },
  hintText: { fontSize: Layout.fontSize.xs, fontWeight: '500' },

  bottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: Layout.spacing.sm,
  },

  recordSection: { flex: 1, alignItems: 'center', gap: 8, paddingBottom: Layout.spacing.md },
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
  recordBtnStop: { backgroundColor: '#FF4D6D' },
  recordBtnGlow: { borderWidth: 3, borderColor: '#2DC98E', shadowColor: '#2DC98E', shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 },
  recordBtnDimmed: { opacity: 0.4 },
  recordBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#FFF' },
  tapSpeak: { fontSize: Layout.fontSize.xs, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },

  avatarWrap: { alignItems: 'center', width: 130 },
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
  speechText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
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
  avatarMedia: { width: 115, height: 135 },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: 4 },

  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
  },
  nextBtnText: { fontSize: Layout.fontSize.sm, fontWeight: '700' },
});
