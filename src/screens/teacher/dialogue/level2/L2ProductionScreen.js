import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
// expo-file-system v19 (SDK 54) moved cacheDirectory/writeAsStringAsync/
// EncodingType behind the `/legacy` entry point; on the main entry
// cacheDirectory is undefined. Same migration as src/utils/reportPdf.js.
import * as FileSystem from 'expo-file-system/legacy';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { useGuardedRecorder } from '../../../../utils/useGuardedRecorder';
import { rs, rf } from '../../../../utils/responsive';

const P = { IDLE: 'idle', PLAYING: 'playing', PROCESSING: 'processing', DONE: 'done' };

async function playBase64Audio(base64, soundRef) {
  if (!base64) return;
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    const fileUri = FileSystem.cacheDirectory + `l2_prod_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    soundRef.current = sound;
    await sound.playAsync();
    await new Promise(resolve => {
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); } });
    });
  } catch { /* ignore */ }
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

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

// Phase: 'full' (8.1) → 'sxs' (8.2 sentence-by-sentence) → done
export default function L2ProductionScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarImg  = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;
  const sentences  = sessionData?.sentences ?? [];
  const paragraph  = sessionData?.full_paragraph?.text ?? '';
  const sessionId  = sessionData?.session_id;

  const [section,  setSection]  = useState('full');  // 'full' | 'sxs'
  const [sxsIdx,   setSxsIdx]   = useState(0);
  const [recPhase, setRecPhase] = useState(P.IDLE);
  const [feedback, setFeedback] = useState('');

  const soundRef  = useRef(null);

  const currentAudio = section === 'full'
    ? sessionData?.full_paragraph?.audio_base64 ?? null
    : sentences[sxsIdx]?.audio_base64 ?? null;

  const { state: recorderState, toggleRecording, reset: resetRecorder } = useGuardedRecorder({
    onStart: () => setFeedback(''),
    onStop: uri => submitRecording(uri),
    onError: () => setRecPhase(P.IDLE),
  });

  // Reset recorder state when moving to next sentence / section
  useEffect(() => {
    setRecPhase(P.IDLE);
    setFeedback('');
    if (currentAudio) {
      handlePlayAudio();
    }
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      resetRecorder();
    };
  }, [section, sxsIdx]);

  async function handlePlayAudio() {
    setRecPhase(P.PLAYING);
    await playBase64Audio(currentAudio, soundRef);
    setRecPhase(P.IDLE);
  }

  function handleRecordBtn() {
    if (recorderState === 'idle' && recPhase !== P.IDLE) return;
    toggleRecording();
  }

  async function submitRecording(uri) {
    setRecPhase(P.PROCESSING);
    try {
      const b64 = await uriToBase64(uri);
      if (student?.sid && sessionId) {
        if (section === 'full') {
          const res = await level2Api.assessParagraph(student.sid, sessionId, { audioBase64: b64, mimeType: 'audio/m4a' });
          const score = Object.values(res?.data?.elements_detected ?? {}).filter(Boolean).length;
          setFeedback(score >= 4 ? 'Excellent! 🌟' : score >= 2 ? 'Good try! 👍' : 'Keep practising! 💪');
        } else {
          const res = await level2Api.assessSentenceBySentence(student.sid, sessionId, sentences[sxsIdx]?.index ?? sxsIdx + 1, { audioBase64: b64, mimeType: 'audio/m4a' });
          setFeedback(res?.data?.score >= 2 ? 'Great! 🌟' : res?.data?.score === 1 ? 'Good try! 👍' : 'Keep going! 💪');
        }
      }
      setRecPhase(P.DONE);
    } catch { setRecPhase(P.IDLE); }
  }

  function handleNext() {
    if (section === 'full') { setSection('sxs'); setSxsIdx(0); }
    else if (sxsIdx < sentences.length - 1) { setSxsIdx(sxsIdx + 1); }
    else { navigation.replace('L2SessionComplete', { student, sessionData }); }
  }

  const progress = section === 'full' ? 0.1 : 0.1 + (sxsIdx + 1) / sentences.length * 0.9;
  const isRecording  = recorderState === 'recording';
  const isProcessing = recPhase === P.PROCESSING || recorderState === 'starting' || recorderState === 'stopping';
  const isPlaying    = recPhase === P.PLAYING;

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            {section === 'full' ? 'Say the Whole Paragraph! 🌟' : `Sentence ${sxsIdx + 1} of ${sentences.length}`}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.button }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarRow}>
            <View style={[styles.bubble, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.bubbleText, { color: theme.headingText }]}>
                {section === 'full' ? 'Can you say the whole paragraph?' : 'Now say this sentence!'}
              </Text>
              <View style={[styles.bubbleTail, { borderLeftColor: theme.cardSurface }]} />
            </View>
            <Image source={avatarImg} style={styles.avatar} resizeMode="contain" />
          </View>

          <View style={[styles.textCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={[styles.textLabel, { color: theme.headingText, opacity: 0.5 }]}>
              {section === 'full' ? 'Full Paragraph' : `Sentence ${sxsIdx + 1}`}
            </Text>
            <Text style={[styles.targetText, { color: theme.headingText }]}>
              {section === 'full' ? paragraph : sentences[sxsIdx]?.text ?? ''}
            </Text>
          </View>

          {section === 'sxs' && (
            <View style={[styles.promptCard, { backgroundColor: theme.headerBackground }]}>
              <Ionicons name="help-circle-outline" size={18} color={theme.headingText} style={{ opacity: 0.6 }} />
              <Text style={[styles.promptText, { color: theme.headingText }]}>{sentences[sxsIdx]?.prompt ?? ''}</Text>
            </View>
          )}

          {/* TTS listen button */}
          {currentAudio && (
            <TouchableOpacity style={[styles.listenBtn, { borderColor: theme.button }]} onPress={handlePlayAudio} disabled={isPlaying || isRecording || isProcessing} activeOpacity={0.8}>
              <Ionicons name={isPlaying ? 'volume-high' : 'volume-medium-outline'} size={20} color={theme.button} />
              <Text style={[styles.listenBtnText, { color: theme.button }]}>{isPlaying ? 'Playing…' : 'Listen'}</Text>
            </TouchableOpacity>
          )}

          {/* Mic area */}
          <View style={styles.micArea}>
            <TouchableOpacity
              style={[styles.micBtn, { backgroundColor: isRecording ? '#FF4D6D' : isProcessing ? '#CCC' : theme.button }]}
              onPress={handleRecordBtn}
              disabled={isProcessing || isPlaying}
              activeOpacity={0.85}
            >
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color="#FFF" />
            </TouchableOpacity>
            <Text style={[styles.micNote, { color: theme.headingText }]}>
              {isRecording ? 'Recording… tap to stop' : isProcessing ? 'Processing…' : recPhase === P.DONE ? feedback : 'Tap to record'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.button }]}
            onPress={handleNext}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextText, { color: theme.buttonText }]}>
              {section === 'full' ? 'Next: Say each sentence' : sxsIdx < sentences.length - 1 ? 'Next Sentence' : 'Finish!'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md, alignItems: 'center', gap: rs(8) },
  headerTitle: { fontSize: Layout.fontSize.xl, fontFamily: 'DMSans_900Black', textAlign: 'center' },
  headerSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', textAlign: 'center', opacity: 0.65, marginTop: 2 },
  progressTrack: { width: '100%', height: rs(8), backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: rs(4), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: rs(4) },
  // Capped + centred so the cards don't stretch edge to edge on a tablet.
  scroll: { width: '100%', maxWidth: rs(720), alignSelf: 'center', paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.md, gap: Layout.spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(8) },
  bubble: { flex: 1, borderRadius: rs(16), paddingHorizontal: rs(16), paddingVertical: rs(10), ...Layout.shadow.sm, position: 'relative' },
  bubbleText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold' },
  bubbleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.7, marginTop: 2 },
  bubbleTail: { position: 'absolute', right: rs(-10), bottom: rs(12), width: 0, height: 0, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent', borderLeftWidth: 10 },
  avatar: { width: rs(90), height: rs(110) },
  textCard: { borderRadius: Layout.radius.xl, borderWidth: 2, padding: Layout.spacing.lg, gap: rs(8), ...Layout.shadow.sm },
  textLabel: { fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  targetText: { fontSize: Layout.fontSize.xl, fontFamily: 'DMSans_700Bold', lineHeight: rf(28) },
  promptCard: { flexDirection: 'row', alignItems: 'center', gap: rs(8), borderRadius: Layout.radius.lg, padding: Layout.spacing.md },
  promptText: { flex: 1, fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold', opacity: 0.75 },
  listenBtn: { flexDirection: 'row', alignItems: 'center', gap: rs(8), borderWidth: 1.5, borderRadius: Layout.radius.full, paddingHorizontal: Layout.spacing.md, paddingVertical: rs(8), alignSelf: 'center' },
  listenBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold' },
  micArea: { alignItems: 'center', gap: Layout.spacing.sm },
  micBtn: { width: rs(72), height: rs(72), borderRadius: rs(36), alignItems: 'center', justifyContent: 'center', ...Layout.shadow.sm },
  micNote: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_600SemiBold' },
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
    justifyContent: 'center',
  },
  nextText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
});
