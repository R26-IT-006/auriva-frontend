import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { Layout } from '../../../constants/layout';

export default function Tier3VideoScreen({ route, navigation }) {
  const { student, category, conceptKey } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);

  const [videoEnded, setVideoEnded] = useState(false);

  const videoRef     = useRef(null);
  const sessionStart = useRef(Date.now());
  const btnScale     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    conceptApi.startTier3({ studentId: student.sid, categoryKey: category.key, conceptKey }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onPlaybackStatusUpdate(status) {
    if (!status.isLoaded) return;
    if (status.didJustFinish && !videoEnded) {
      setVideoEnded(true);
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 6 }).start();
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

        {/* Row: video box on left, continue button on right */}
        <View style={styles.contentRow}>

          {/* Square video box */}
          <View style={[styles.videoBox, { borderColor: theme.cardOutline }]}>
            {concept.tier3Video ? (
              <Video
                ref={videoRef}
                source={concept.tier3Video}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls={false}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />
            ) : (
              <View style={styles.noVideoWrap}>
                <Ionicons name="videocam-off-outline" size={48} color={theme.cardOutline} />
                <Text style={[styles.noVideoText, { color: theme.headingText }]}>No video available</Text>
              </View>
            )}

            {videoEnded && (
              <TouchableOpacity style={styles.replayBtn} onPress={handleReplay} activeOpacity={0.8}>
                <Ionicons name="refresh" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Continue button — to the right of the box, springs in when video ends */}
          <Animated.View style={[styles.continueBtnWrap, { transform: [{ scale: btnScale }] }]}>
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

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingTop: 60,
  },

  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },

  namePill: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 32,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nameText: {
    fontSize: 28,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 1.5,
  },

  videoBox: {
    width: '52%',
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

  continueBtnWrap: {},
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
