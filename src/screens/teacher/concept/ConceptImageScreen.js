import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

export default function ConceptImageScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId, isRelearn } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const [tapCount,     setTapCount]     = useState(0);
  const [gateVisible,  setGateVisible]  = useState(false);

  const fwdBtnScale  = useRef(new Animated.Value(0)).current;
  const imageScale   = useRef(new Animated.Value(1)).current;
  const sessionStart = useRef(Date.now());

  const speak = useCallback((text) => {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 0.75, pitch: 1.0 });
  }, []);

  useEffect(() => {
    if (!concept) return;

    // Start tier1 (only if not a relearn attempt — already in_progress)
    if (!isRelearn) {
      conceptApi.startTier1({
        studentId:   student.sid,
        categoryKey: category.key,
        conceptKey,
      }).catch(() => {});
    } else {
      // Log relearn start
      conceptApi.logInteraction({
        studentId:   student.sid,
        sessionId:   sessionId || null,
        categoryKey: category.key,
        conceptKey,
        eventType:   'relearn_start',
        eventData:   {},
      }).catch(() => {});
    }

    // Auto-speak after short delay
    const t = setTimeout(() => speak(concept.label), 800);
    return () => clearTimeout(t);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleImageTap() {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    speak(concept.label);

    // Tap bounce animation
    Animated.sequence([
      Animated.spring(imageScale, { toValue: 0.93, useNativeDriver: true, speed: 60 }),
      Animated.spring(imageScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();

    // Log tap event
    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      eventType:   'image_tap',
      eventData:   { tap_index: newCount, time_ms: Date.now() - sessionStart.current },
    }).catch(() => {});

    // Reveal forward button after 2 taps
    if (newCount === 2) {
      Animated.spring(fwdBtnScale, {
        toValue:    1,
        useNativeDriver: true,
        bounciness: 14,
        speed:      6,
      }).start();
    }
  }

  function handleForward() {
    Speech.stop();
    navigation.navigate('ConceptMatch', {
      student,
      category,
      conceptKey,
      sessionId: sessionId || null,
    });
  }

  if (!concept) return null;

  const imgSize = Math.min(width, height) * 0.58;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <Text style={[styles.conceptTitle, { color: theme.headingText }]}>
            {concept.label}
          </Text>

          {/* Audio replay */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => speak(concept.label)}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {isRelearn && (
          <View style={[styles.relearnBanner, { backgroundColor: theme.button + '22', borderColor: theme.cardOutline }]}>
            <Ionicons name="refresh-circle-outline" size={16} color={theme.button} />
            <Text style={[styles.relearnText, { color: theme.button }]}>Let's look again!</Text>
          </View>
        )}

        {/* Instruction */}
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Tap the picture to hear its name
        </Text>

        {/* Main image — tappable */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleImageTap}
          style={styles.imageWrap}
        >
          <Animated.Image
            source={concept.real}
            style={[styles.conceptImage, { width: imgSize, height: imgSize, transform: [{ scale: imageScale }] }]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Tap count dots */}
        <View style={styles.tapDots}>
          {[1, 2].map((n) => (
            <View
              key={n}
              style={[
                styles.tapDot,
                {
                  backgroundColor: tapCount >= n ? theme.button : 'rgba(0,0,0,0.15)',
                },
              ]}
            />
          ))}
        </View>

        {/* Forward button — appears after 2 taps */}
        <Animated.View style={[styles.fwdBtnWrap, { transform: [{ scale: fwdBtnScale }] }]}>
          <TouchableOpacity
            style={[styles.fwdBtn, { backgroundColor: theme.button }]}
            onPress={handleForward}
            activeOpacity={0.85}
          >
            <Text style={[styles.fwdBtnText, { color: theme.buttonText }]}>Ready!</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.goBack(); }}
        onCancel={() => setGateVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1, alignItems: 'center' },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  relearnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  relearnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  instruction: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.55,
    marginTop: 4,
    marginBottom: 16,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  conceptImage: {
    borderRadius: 16,
  },
  tapDots: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  tapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fwdBtnWrap: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
  },
  fwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  fwdBtnText: {
    fontSize: 17,
    fontWeight: '800',
  },
});
