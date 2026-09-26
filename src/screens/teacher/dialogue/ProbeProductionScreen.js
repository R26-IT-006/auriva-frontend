import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';

import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { dialogueApi } from '../../../api/dialogue';
import { cat3Api } from '../../../api/cat3';
import { useGuardedRecorder } from '../../../utils/useGuardedRecorder';
import { DIALOGUE_WORD_ASSETS } from '../../../data/dialogueAssets';

// Rule 5 — periodic production probe (TASK-37 backend, TASK-39 frontend).
// Shared/category-agnostic, same precedent as AnimatedWordScreen.js/
// BoldWordScreen.js (TASK-11/TASK-38): takes `category` as a route param
// rather than being duplicated per category.

// greetings/magic_words word audio — mirrors Phase1VideoScreen.js's and
// GreetingPhase1VideoScreen.js's own WORD_AUDIO maps (this codebase's
// established per-screen duplication pattern for word assets). Combined into
// one map since the two categories' asset_key values never collide.
const PLACEHOLDER_WORD_AUDIO = require('../../../../assets/dialogue-audios/magic_words/Thankyou.mp3');
const DIALOGUE_WORD_AUDIO = {
  // magic_words
  thank_you:     require('../../../../assets/dialogue-audios/magic_words/Thankyou.mp3'),
  im_sorry:      require('../../../../assets/dialogue-audios/magic_words/Im_sorry.mp3'),
  youre_welcome: require('../../../../assets/dialogue-audios/magic_words/you_re_welcome.mp3'),
  excuse_me:     require('../../../../assets/dialogue-audios/magic_words/Excuse_me.mp3'),
  // greetings — good_afternoon/good_night/happy_birthday/how_are_you/im_fine/
  // happy_new_year have no real word-audio asset yet, same placeholder
  // GreetingPhase1VideoScreen.js uses for these words.
  hello:          require('../../../../assets/dialogue-audios/greetings/hello.mp3'),
  goodbye:        require('../../../../assets/dialogue-audios/greetings/goodbye.mp3'),
  good_morning:   require('../../../../assets/dialogue-audios/greetings/good_morning.mp3'),
  good_afternoon: PLACEHOLDER_WORD_AUDIO,
  good_night:     PLACEHOLDER_WORD_AUDIO,
  happy_birthday: PLACEHOLDER_WORD_AUDIO,
  how_are_you:    PLACEHOLDER_WORD_AUDIO,
  im_fine:        PLACEHOLDER_WORD_AUDIO,
  happy_new_year: PLACEHOLDER_WORD_AUDIO,
};

// Abilities: no entries in data/dialogueAssets.js by design (confirmed
// 2026-07-28) — mirrors Cat3Phase1Screen.js's/Cat3Phase2Screen.js's own
// CAT3_WORD_AUDIO map exactly (same keys, same asset paths). The scene media
// is Phase1And3.mp4 per word folder (every abilities word, difficulty 1 and 2).
const CAT3_WORD_VIDEO = {
  cat3_yes: require('../../../../assets/dialogue-videos/words/abilities/yes/Phase1And3.mp4'),
  cat3_no:  require('../../../../assets/dialogue-videos/words/abilities/no/Phase1And3.mp4'),
  clap:     require('../../../../assets/dialogue-videos/words/abilities/clap/Phase1And3.mp4'),
  run:      require('../../../../assets/dialogue-videos/words/abilities/run/Phase1And3.mp4'),
  walk:     require('../../../../assets/dialogue-videos/words/abilities/walk/Phase1And3.mp4'),
  jump:     require('../../../../assets/dialogue-videos/words/abilities/jump/Phase1And3.mp4'),
  talk:     require('../../../../assets/dialogue-videos/words/abilities/talk/Phase1And3.mp4'),
  dance:    require('../../../../assets/dialogue-videos/words/abilities/dance/Phase1And3.mp4'),
  sing:     require('../../../../assets/dialogue-videos/words/abilities/sing/Phase1And3.mp4'),
  brush:    require('../../../../assets/dialogue-videos/words/abilities/brush/Phase1And3.mp4'),
  wash:     require('../../../../assets/dialogue-videos/words/abilities/wash/Phase1And3.mp4'),
  eat:      require('../../../../assets/dialogue-videos/words/abilities/eat/Phase1And3.mp4'),
  drink:    require('../../../../assets/dialogue-videos/words/abilities/drink/Phase1And3.mp4'),
  write:    require('../../../../assets/dialogue-videos/words/abilities/write/Phase1And3.mp4'),
  play:     require('../../../../assets/dialogue-videos/words/abilities/play/Phase1And3.mp4'),
  sleep:    require('../../../../assets/dialogue-videos/words/abilities/sleep/Phase1And3.mp4'),
  watch:    require('../../../../assets/dialogue-videos/words/abilities/watch/Phase1And3.mp4'),
};
const CAT3_WORD_AUDIO = {
  clap:  require('../../../../assets/dialogue-audios/abilities/clap.mp3'),
  run:   require('../../../../assets/dialogue-audios/abilities/run.mp3'),
  walk:  require('../../../../assets/dialogue-audios/abilities/walk.mp3'),
  jump:  require('../../../../assets/dialogue-audios/abilities/jump.mp3'),
  dance: require('../../../../assets/dialogue-audios/abilities/dance.mp3'),
  sing:  require('../../../../assets/dialogue-audios/abilities/sing.mp3'),
  talk:  require('../../../../assets/dialogue-audios/abilities/talk.mp3'),
};

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

export default function ProbeProductionScreen({ route, navigation }) {
  const { student, category, wordId, word, assetKey } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = word ?? '';

  const isAbilities = category === 'abilities';
  const wordImage = isAbilities ? null : DIALOGUE_WORD_ASSETS[assetKey]?.scene;
  const wordVideo = isAbilities ? CAT3_WORD_VIDEO[assetKey] : null;
  const wordAudio = isAbilities ? CAT3_WORD_AUDIO[assetKey] : DIALOGUE_WORD_AUDIO[assetKey];

  const soundRef  = useRef(null);
  const videoRef  = useRef(null);
  const activeRef = useRef(true);
  const [cloudText, setCloudText] = useState(`Can you say "${wordLabel}"?`);
  const [phase, setPhase] = useState('idle'); // idle | processing | done

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      // Stop the scene video on blur — otherwise its audio keeps playing in
      // the background after the student navigates away.
      videoRef.current?.pauseAsync().catch(() => {});
    };
  }, []));

  async function playAudio() {
    if (!wordAudio) return;
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(wordAudio);
      soundRef.current = sound;
      await sound.playAsync();
    } catch { /* ignore */ }
  }

  useEffect(() => { playAudio(); }, []);

  async function submitRecording(uri) {
    setPhase('processing');
    setCloudText('...');
    try {
      const b64 = await uriToBase64(uri);
      const result = isAbilities
        ? await cat3Api.recordProbeResult(student?.sid, wordId, b64, 'audio/m4a')
        : await dialogueApi.recordProbeResult(student?.sid, wordId, { audioBase64: b64, mimeType: 'audio/m4a' });

      if (!activeRef.current) return;

      if (result?.speech_emerged) {
        setPhase('done');
        setCloudText('You said it!');
      } else {
        navigation.navigate('ProbeRetentionCheck', { student, category, wordId, word, assetKey });
      }
    } catch {
      if (activeRef.current) {
        setPhase('idle');
        setCloudText(`Can you say "${wordLabel}"?`);
      }
    }
  }

  const { state: recorderState, toggleRecording } = useGuardedRecorder({
    onStop:  (uri) => submitRecording(uri),
    onError: () => { if (activeRef.current) setPhase('idle'); },
  });
  const isRecording = recorderState === 'recording';

  function exitToOverview() {
    navigation.navigate('Level1Overview', { student, categoryKey: category });
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          {/* "Not now" exit — ungated, no hardware-back interception; a probe is optional and low-stakes */}
          <TouchableOpacity onPress={exitToOverview} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="close" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Quick check-in</Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {wordVideo && (
              <View style={[styles.imageWrap, { backgroundColor: theme.cardSurface }]}>
                <Video
                  ref={videoRef}
                  source={wordVideo}
                  style={styles.image}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls={false}
                  shouldPlay
                  isLooping
                />
              </View>
            )}
            {wordImage && (
              <View style={[styles.imageWrap, { backgroundColor: theme.cardSurface }]}>
                <Image source={wordImage} style={styles.image} resizeMode="cover" />
              </View>
            )}

            <Text style={[styles.wordText, { color: theme.button }]}>{wordLabel}</Text>

            <View style={[styles.speechBubble, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.speechText, { color: theme.headingText }]}>{cloudText}</Text>
            </View>

            <TouchableOpacity
              style={[styles.replayBtn, { backgroundColor: theme.cardSurface }]}
              onPress={playAudio}
              activeOpacity={0.8}
              disabled={!wordAudio}
            >
              <Ionicons name="volume-high" size={20} color={theme.button} />
              <Text style={[styles.replayBtnText, { color: theme.button }]}>Listen again</Text>
            </TouchableOpacity>

            <View style={styles.spacer} />

            {phase === 'done' ? (
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: theme.button }]}
                onPress={exitToOverview}
                activeOpacity={0.85}
              >
                <Text style={[styles.doneBtnText, { color: theme.buttonText }]}>Great!</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.recordBtn, isRecording ? styles.recordBtnStop : styles.recordBtnGo]}
                onPress={toggleRecording}
                activeOpacity={0.85}
                disabled={phase === 'processing'}
              >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={20} color="#FFF" />
                <Text style={styles.recordBtnText}>
                  {isRecording ? 'Stop' : phase === 'processing' ? 'Listening…' : 'Record'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  headerSide:  { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Layout.fontSize.md, fontWeight: '700' },

  body: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.lg,
    gap:               16,
  },

  imageWrap: {
    width:  '100%',
    height: '28%',
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    ...Layout.shadow.md,
  },
  image: { width: '100%', height: '100%' },

  wordText: { fontSize: 32, fontWeight: '900', textAlign: 'center' },

  speechBubble: {
    borderRadius:      Layout.radius.lg,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   Layout.spacing.sm,
    ...Layout.shadow.sm,
  },
  speechText: { fontSize: Layout.fontSize.md, fontWeight: '600', textAlign: 'center' },

  replayBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   Layout.spacing.sm,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.sm,
  },
  replayBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700' },

  spacer: { flex: 1 },

  recordBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  recordBtnGo:   { backgroundColor: '#2DC98E' },
  recordBtnStop: { backgroundColor: '#FF4D6D' },
  recordBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#FFF' },

  doneBtn: {
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  doneBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
