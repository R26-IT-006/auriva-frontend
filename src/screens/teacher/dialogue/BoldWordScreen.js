import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, BackHandler, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';

import { Layout } from '../../../constants/layout';
import { Colors } from '../../../constants/colors';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../api/dialogue';

const PROGRESS_FRACTION = 0.72;

// Scope Amendment A2 — this screen has no animation (confirmed by reading it
// fresh: static Text only, no AnimatedWord.js dependency), so 'struggling'
// gets a minimum display-time delay instead of "one additional loop". Same
// duration as AnimatedWordScreen.js's STRUGGLING_EXTRA_LOOP_MS, for
// consistency between the two screens, per this amendment's instruction.
const STRUGGLING_MIN_DISPLAY_MS = 1800;

// Shared, category-agnostic familiarisation screen (Phase 1, Screen B) —
// the animation-to-static fade: same word/image, static bold high-contrast
// text, no animation. Same param contract as AnimatedWordScreen.
export default function BoldWordScreen({ route, navigation }) {
  const {
    student, wordText, wordImage, wordAudio, wordId,
    trackExposure = false, nextScreen, nextParams, adaptiveDwell,
  } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Local require()'d images resolve synchronously to their real bundled
  // dimensions (no waiting on onLoad, which is unreliable for local assets
  // on some platforms and was causing the box to fall back to the 4:3
  // default — visible as letterbox bars). The box is then bounded by BOTH a
  // width budget and a height budget, whichever is stricter, so a near-
  // square photo can't blow past a sensible height and push the Next button
  // down off-comfortable.
  const resolvedSize = wordImage ? Image.resolveAssetSource(wordImage) : null;
  const imageAspectRatio = resolvedSize?.width && resolvedSize?.height
    ? resolvedSize.width / resolvedSize.height
    : 4 / 3;
  const maxImageWidth  = Math.min(screenWidth * 0.58, 480);
  const maxImageHeight = screenHeight * 0.42;
  const imageWidth  = Math.min(maxImageWidth, maxImageHeight * imageAspectRatio);
  const imageHeight = Math.round(imageWidth / imageAspectRatio);

  const [showGate, setShowGate] = useState(false);
  const soundRef = useRef(null);

  // Scope Amendment A2 — same shape as AnimatedWordScreen.js: only
  // 'struggling' gates Next; 'typical'/undefined/'fast' keep today's literal
  // behaviour (Next always immediately tappable — no pre-existing gating
  // here either, confirmed by reading this file fresh before this
  // amendment).
  const isStruggling = adaptiveDwell === 'struggling';
  const [struggleAudioDone, setStruggleAudioDone] = useState(false);
  const [struggleDelayDone, setStruggleDelayDone] = useState(false);
  const nextReady = !isStruggling || (struggleAudioDone && struggleDelayDone);

  useEffect(() => {
    if (!isStruggling) return undefined;
    if (!wordAudio) setStruggleAudioDone(true); // nothing to wait for

    const delayTimer = setTimeout(() => setStruggleDelayDone(true), STRUGGLING_MIN_DISPLAY_MS);
    return () => clearTimeout(delayTimer);
  }, [isStruggling, wordAudio]);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]));

  useEffect(() => {
    if (trackExposure && wordId && student?.sid) {
      dialogueApi.recordPhase1Exposure(student.sid, wordId).catch(() => {});
    }
  }, []);

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
      // Scope Amendment A2 — only tracked for the 'struggling' dwell gate;
      // 'typical'/undefined/'fast' never read struggleAudioDone at all.
      if (isStruggling) {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.setOnPlaybackStatusUpdate(null);
            setStruggleAudioDone(true);
          }
        });
      }
      await sound.playAsync();
    } catch { /* ignore */ }
  }

  useEffect(() => {
    playAudio();
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [wordAudio]);

  function goNext() {
    if (nextScreen) {
      navigation.navigate(nextScreen, nextParams);
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={() => setShowGate(true)} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="exit-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {wordImage && (
              <View style={[styles.imageWrap, { width: imageWidth, height: imageHeight, backgroundColor: theme.cardSurface }]}>
                <Image source={wordImage} style={styles.image} resizeMode="contain" />
              </View>
            )}

            <View style={styles.wordArea}>
              <Text style={styles.wordText}>{wordText ?? ''}</Text>
            </View>

            <TouchableOpacity
              style={[styles.replayBtn, { backgroundColor: theme.cardSurface }]}
              onPress={playAudio}
              activeOpacity={0.8}
              disabled={!wordAudio}
            >
              <Ionicons name="volume-high" size={22} color={theme.button} />
              <Text style={[styles.replayBtnText, { color: theme.button }]}>Listen again</Text>
            </TouchableOpacity>

            <View style={styles.spacer} />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.button }, !nextReady && styles.nextBtnDisabled]}
                activeOpacity={nextReady ? 0.85 : 1}
                onPress={nextReady ? goNext : undefined}
              >
                <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Let's try!</Text>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </View>

      <ParentGateModal
        visible={showGate}
        onSuccess={() => { setShowGate(false); navigation.navigate('DialogueCategory', { student }); }}
        onCancel={() => setShowGate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },
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
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xxl,
    paddingBottom: Layout.spacing.lg,
    gap: 20,
  },

  imageWrap: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    ...Layout.shadow.md,
  },
  image: { width: '100%', height: '100%' },

  wordArea: {
    width: '100%',
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordText: {
    fontSize: 85,
    fontWeight: '900',
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: 1,
  },

  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.sm,
  },
  replayBtnText: { fontSize: Layout.fontSize.md, fontWeight: '700' },

  spacer: { flex: 1 },

  btnRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
