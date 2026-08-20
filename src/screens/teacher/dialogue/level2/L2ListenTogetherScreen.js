import { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

async function playBase64Audio(base64, soundRef) {
  if (!base64) return;
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    const fileUri = FileSystem.cacheDirectory + `l2_para_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    soundRef.current = sound;
    await sound.playAsync();
    await new Promise(resolve => {
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); } });
    });
  } catch { /* ignore */ }
}

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

export default function L2ListenTogetherScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarImg  = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;
  const paragraph  = sessionData?.full_paragraph?.text ?? '';
  const sentences  = sessionData?.sentences ?? [];
  const paraAudio  = sessionData?.full_paragraph?.audio_base64 ?? null;

  const soundRef   = useRef(null);
  const [playing, setPlaying] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0,  duration: 1000, useNativeDriver: true }),
    ])).start();
    // Auto-play paragraph audio on screen entry
    if (paraAudio) { handlePlay(); }
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handlePlay() {
    setPlaying(true);
    await playBase64Audio(paraAudio, soundRef);
    setPlaying(false);
  }

  function goToProduction() {
    navigation.replace('L2Production', { student, sessionData });
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Listen Together 🎧</Text>
          <Text style={[styles.headerSub, { color: theme.headingText }]}>Section 7 · Hear the full paragraph</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={[styles.bubble, { backgroundColor: theme.cardSurface }]}>
              <Text style={[styles.bubbleText, { color: theme.headingText }]}>Let's listen together!</Text>
              <View style={[styles.bubbleTail, { borderLeftColor: theme.cardSurface }]} />
            </View>
            <Animated.Image source={avatarImg} style={[styles.avatar, { transform: [{ scale: pulse }] }]} resizeMode="contain" />
          </View>

          {/* Paragraph audio player */}
          {paraAudio ? (
            <TouchableOpacity
              style={[styles.audioBox, { backgroundColor: theme.cardSurface, borderColor: theme.button }]}
              onPress={handlePlay}
              disabled={playing}
              activeOpacity={0.85}
            >
              <Ionicons name={playing ? 'volume-high' : 'play-circle'} size={32} color={theme.button} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.audioTitle, { color: theme.headingText }]}>{playing ? 'Playing…' : 'Play the paragraph'}</Text>
                <Text style={[styles.audioSub, { color: theme.headingText, opacity: 0.5 }]}>Tap to listen together</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.audioBox, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              <Ionicons name="volume-mute-outline" size={28} color="#AAA" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.audioTitle, { color: theme.headingText }]}>Read aloud together</Text>
                <Text style={styles.audioSub}>Read the paragraph below with the child</Text>
              </View>
            </View>
          )}

          {/* Sentence-by-sentence display */}
          <View style={styles.sentencesBox}>
            {sentences.map((s, i) => (
              <View key={s.index} style={[styles.sentRow, { borderColor: theme.cardOutline }]}>
                <View style={[styles.sentNum, { backgroundColor: theme.button }]}>
                  <Text style={[styles.sentNumText, { color: theme.buttonText }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.sentText, { color: theme.headingText }]}>{s.text}</Text>
              </View>
            ))}
          </View>

          {/* Full paragraph card */}
          <View style={[styles.paragraphCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={[styles.paragraphLabel, { color: theme.headingText, opacity: 0.5 }]}>Full Paragraph</Text>
            <Text style={[styles.paragraphText, { color: theme.headingText }]}>{paragraph}</Text>
          </View>

          {/* CTA */}
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.button }]} onPress={goToProduction} activeOpacity={0.85}>
            <Text style={[styles.nextText, { color: theme.buttonText }]}>Now it's your turn!</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
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
  header: { paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md, alignItems: 'center' },
  headerTitle: { fontSize: Layout.fontSize.xxl, fontWeight: '900' },
  headerSub: { fontSize: Layout.fontSize.sm, opacity: 0.55, fontWeight: '500', marginTop: 2 },
  scroll: { paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.md, gap: Layout.spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8 },
  bubble: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, ...Layout.shadow.sm, position: 'relative', flex: 1 },
  bubbleText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  bubbleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.7, marginTop: 2 },
  bubbleTail: { position: 'absolute', right: -10, bottom: 12, width: 0, height: 0, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent', borderLeftWidth: 10 },
  avatar: { width: 90, height: 110 },
  audioBox: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, borderRadius: Layout.radius.xl, borderWidth: 2, borderStyle: 'dashed', padding: Layout.spacing.md },
  audioTitle: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  audioSub: { fontSize: Layout.fontSize.xs, color: '#AAA', fontWeight: '500', marginTop: 2 },
  sentencesBox: { gap: 10 },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, borderRadius: Layout.radius.lg, borderWidth: 1.5, padding: Layout.spacing.md, backgroundColor: 'rgba(255,255,255,0.6)' },
  sentNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sentNumText: { fontSize: Layout.fontSize.sm, fontWeight: '800' },
  sentText: { flex: 1, fontSize: Layout.fontSize.md, fontWeight: '600', lineHeight: 22 },
  paragraphCard: { borderRadius: Layout.radius.xl, borderWidth: 2, padding: Layout.spacing.lg, gap: 8, ...Layout.shadow.sm },
  paragraphLabel: { fontSize: Layout.fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  paragraphText: { fontSize: Layout.fontSize.md, fontWeight: '500', lineHeight: 24 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Layout.radius.full, paddingVertical: Layout.spacing.md, ...Layout.shadow.md },
  nextText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
