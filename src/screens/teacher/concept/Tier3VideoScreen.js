import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

export default function Tier3VideoScreen({ route, navigation }) {
  const { student, category, conceptKey, needsReplay = false } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);

  const [videoEnded,  setVideoEnded]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [gateVisible, setGateVisible] = useState(false);

  const videoRef     = useRef(null);
  const sessionStart = useRef(Date.now());
  const btnScale     = useRef(new Animated.Value(0)).current;

  const hasVideo = Boolean(concept?.tier3Video);

  useEffect(() => {
    conceptApi.startTier3({ studentId: student.sid, categoryKey: category.key, conceptKey }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => Speech.stop(), []);

  const revealContinue = useCallback(() => {
    setVideoEnded(true);
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 6 }).start();
  }, [btnScale]);

  // No video for this concept — don't strand the child behind a button that can
  // never appear; let them move on immediately.
  useEffect(() => {
    if (!hasVideo) { setLoading(false); revealContinue(); }
  }, [hasVideo, revealContinue]);

  const speakName = useCallback(() => {
    if (!concept) return;
    Speech.stop();
    Speech.speak(concept.label, { language: 'en-US', rate: 0.8 });
    if (concept.labelSi) {
      setTimeout(() => Speech.speak(concept.labelSi, { language: 'si-LK', rate: 0.7 }), 1100);
    }
  }, [concept]);

  function onPlaybackStatusUpdate(status) {
    if (!status.isLoaded) {
      // A load error would otherwise leave Continue hidden forever.
      if (status.error) { setLoading(false); revealContinue(); }
      return;
    }

    if (loading) setLoading(false);

    if (status.didJustFinish && !videoEnded) {
      revealContinue();
      setTimeout(() => {
        Speech.speak('Great job! You watched the video!', { language: 'en-US', rate: 0.8 });
      }, 300);
    }
  }

  async function handleContinue() {
    Speech.stop();
    const timeSpentMs = Date.now() - sessionStart.current;
    try {
      await conceptApi.completeTier3({
        studentId:   student.sid,
        categoryKey: category.key,
        conceptKey,
        timeSpentMs,
      });
    } catch { /* continue anyway */ }
    if (concept?.coloring) {
      navigation.replace('ConceptColoring', { student, category, conceptKey });
    } else {
      navigation.replace('ConceptItems', { student, category });
    }
  }

  async function handleReplay() {
    Speech.stop();
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(0);
      await videoRef.current.playAsync();
    }
    setVideoEnded(false);
    btnScale.setValue(0);
  }

  if (!concept) return null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar — matches the other concept screens, and means the child is
            never stuck here if the video misbehaves. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={speakName}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Video on the left, concept name + controls on the right */}
        <View style={styles.contentRow}>

          <View style={[styles.videoBox, { borderColor: theme.cardOutline }]}>
            {hasVideo ? (
              <>
                <Video
                  ref={videoRef}
                  source={concept.tier3Video}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  useNativeControls={false}
                  onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                />

                {loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                  </View>
                )}

                {videoEnded && (
                  <TouchableOpacity style={styles.replayBtn} onPress={handleReplay} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.noVideoWrap}>
                <Ionicons name="videocam-off-outline" size={48} color={theme.cardOutline} />
                <Text style={[styles.noVideoText, { color: '#FFF' }]}>No video available</Text>
              </View>
            )}
          </View>

          <View style={styles.sideColumn}>
            {/* Shown from the start, so the child always knows what they're watching
                and the column isn't empty until the video ends. */}
            <View style={[styles.namePill, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
              <Text style={[styles.nameText, { color: theme.headingText }]}>{concept.label}</Text>
              {concept.labelSi && (
                <Text style={[styles.nameTextSi, { color: theme.headingText }]}>{concept.labelSi}</Text>
              )}
            </View>

            <Animated.View style={[styles.continueBtnWrap, { transform: [{ scale: btnScale }] }]}>
              {needsReplay && (
                <TouchableOpacity
                  style={[styles.watchAgainBtn, { borderColor: theme.button }]}
                  onPress={handleReplay}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={18} color={theme.button} />
                  <Text style={[styles.watchAgainText, { color: theme.button }]}>Watch Again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.continueBtn, { backgroundColor: theme.button }]}
                onPress={handleContinue}
                activeOpacity={0.85}
              >
                <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
              </TouchableOpacity>
            </Animated.View>
          </View>

        </View>

      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.replace('ConceptItems', { student, category }); }}
        onCancel={() => setGateVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
  },

  sideColumn: {
    alignItems: 'center',
    gap: 24,
  },

  namePill: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 2.5,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  nameText: {
    fontSize: 30,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 0.5,
  },
  nameTextSi: {
    fontSize: 17,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.6,
  },

  videoBox: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  video: {
    width: '100%',
    height: '100%',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  noVideoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noVideoText: {
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.6,
  },

  replayBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueBtnWrap: { alignItems: 'center', gap: 12 },
  watchAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 36,
    borderWidth: 2.5,
  },
  watchAgainText: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 36,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  continueBtnText: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
  },
});
