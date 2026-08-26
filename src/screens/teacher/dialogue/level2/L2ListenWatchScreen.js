/**
 * L2ListenWatchScreen  (TASK-18 — Step 1 of Sentence Familiarisation Ladder)
 * Shows the target sentence assembling word-by-word while its TTS audio plays.
 * After the full sentence is visible the teacher taps "Next" to advance to
 * L2SentenceBuildScreen.
 *
 * Params: { student, sessionData, sentenceIndex }
 * Output: navigate('L2SentenceBuild', { student, sessionData, sentenceIndex })
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

// Emoji keyed by sentence index (matches L2SentencePathScreen STOPS)
const SENTENCE_EMOJIS = { 1: '👤', 2: '🎂', 3: '🏠', 4: '⭐', 5: '🎨' };

// Show the matching waving character instead of the generic emoji on the
// two sentences that are actually about a person's identity:
// self_introduction sentence 1 "My name is ___" / sentence 4 "I am a
// boy/girl" (both about the child, sessionData.gender); describe_friend
// sentence 1 "My friend's name is ___" / sentence 2 "My friend is a
// boy/girl" (both about the friend, sessionData.friend_gender).
const CHARACTER_IMAGES = {
  boy:  require('../../../../../assets/avatar-images/Saman_Waving.png'),
  girl: require('../../../../../assets/avatar-images/Anjalie_Waving.png'),
};
const TOPIC_CHARACTER_SENTENCES = {
  self_introduction: { indices: [1, 4], genderField: 'gender' },
  describe_friend:   { indices: [1, 2], genderField: 'friend_gender' },
};
function getCharacterImage(sessionData, sentenceIndex) {
  const cfg = TOPIC_CHARACTER_SENTENCES[sessionData?.topic];
  if (!cfg || !cfg.indices.includes(sentenceIndex)) return null;
  return CHARACTER_IMAGES[sessionData?.[cfg.genderField]] ?? null;
}

async function playBase64Audio(base64, soundRef) {
  if (!base64) return;
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    const fileUri = FileSystem.cacheDirectory + `l2_lw_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    soundRef.current = sound;
    await sound.playAsync();
    await new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); }
      });
    });
  } catch { /* ignore */ }
}

export default function L2ListenWatchScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1 } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const sentence = (sessionData?.sentences ?? []).find((s) => s.index === sentenceIndex);
  const words    = sentence?.words ?? (sentence?.text?.split(' ') ?? []);
  const emoji    = SENTENCE_EMOJIS[sentenceIndex] ?? '📖';
  const characterImage = getCharacterImage(sessionData, sentenceIndex);

  // One Animated.Value per word for fade-in
  const wordAnims  = useRef(words.map(() => new Animated.Value(0))).current;
  const soundRef   = useRef(null);
  const activeRef  = useRef(true);
  const [allShown, setAllShown] = useState(false);

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true); // swallow
    return () => { activeRef.current = false; sub.remove(); };
  }, []));

  useEffect(() => {
    // Reset anims each time the screen mounts
    wordAnims.forEach((a) => a.setValue(0));
    setAllShown(false);
    activeRef.current = true;

    // Start audio immediately, then stagger word appearance
    playBase64Audio(sentence?.audio_base64, soundRef).catch(() => {});

    const PER_WORD_MS = Math.min(600, 3000 / Math.max(words.length, 1));
    const timers = words.map((_, i) =>
      setTimeout(() => {
        if (!activeRef.current) return;
        Animated.timing(wordAnims[i], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (i === words.length - 1 && activeRef.current) setAllShown(true);
        });
      }, i * PER_WORD_MS + 400)   // +400 ms so first word doesn't pop instantly
    );

    return () => {
      activeRef.current = false;
      timers.forEach(clearTimeout);
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [sentenceIndex]);

  function handleNext() {
    navigation.navigate('L2SentenceBuild', { student, sessionData, sentenceIndex });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <View style={styles.stepBadge}>
            <Text style={[styles.stepLabel, { color: theme.button }]}>LISTEN &amp; WATCH</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '33%', backgroundColor: theme.button }]} />
          </View>
        </View>

        {/* Sentence character/emoji + bubble */}
        <View style={styles.body}>
          {characterImage ? (
            <Image source={characterImage} style={styles.characterImg} resizeMode="contain" />
          ) : (
            <View style={styles.emojiWrap}>
              <Text style={styles.emojiLarge}>{emoji}</Text>
            </View>
          )}

          {/* Speech bubble */}
          <View style={[styles.bubble, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <View style={styles.wordsRow}>
              {words.map((word, i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.word,
                    { color: theme.headingText },
                    { opacity: wordAnims[i], transform: [{ translateY: wordAnims[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
                  ]}
                >
                  {word}{i < words.length - 1 ? ' ' : ''}
                </Animated.Text>
              ))}
            </View>
          </View>

          {/* Instruction */}
          <Text style={[styles.instruction, { color: theme.headingText }]}>
            Listen carefully and watch each word appear!
          </Text>
        </View>

        {/* Next button — visible once all words shown */}
        <View style={styles.footer}>
          {allShown ? (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              onPress={handleNext}
              activeOpacity={0.85}
              accessibilityLabel="Next activity"
            >
              <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.buttonText} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.nextBtn, styles.nextBtnDisabled, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
              <Text style={[styles.nextText, { color: theme.headingText, marginLeft: 8 }]}>Listening…</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.xs,
  },
  stepBadge: { alignItems: 'center' },
  stepLabel: { fontSize: Layout.fontSize.xs, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  progressTrack: { height: 6, width: '80%', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: Layout.spacing.xl, paddingTop: Layout.spacing.lg },

  emojiWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
    ...Layout.shadow.md,
  },
  emojiLarge: { fontSize: 52 },
  characterImg: { width: 260, height: 300, marginBottom: Layout.spacing.sm },

  bubble: {
    borderRadius: 20,
    borderWidth: 2,
    padding: Layout.spacing.lg,
    width: '100%',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Layout.spacing.lg,
    ...Layout.shadow.sm,
  },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  word: { fontSize: Layout.fontSize.xl ?? 24, fontWeight: '700', lineHeight: 36 },

  instruction: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.7, textAlign: 'center' },

  footer: { paddingHorizontal: Layout.spacing.xl, paddingBottom: Layout.spacing.xl, alignItems: 'center' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full ?? 100,
    ...Layout.shadow.md,
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
