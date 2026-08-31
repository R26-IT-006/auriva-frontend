import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playConceptAudio, stopConceptAudio } from '../../../../utils/audioUtils';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getConceptItem } from '../../../../data/conceptData';
import { conceptApi } from '../../../../api/concept';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { Layout } from '../../../../constants/layout';

export default function ConceptImageScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId, isRelearn, confusedKeys } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const [tapCount,    setTapCount]    = useState(0);
  const [gateVisible, setGateVisible] = useState(false);

  const fwdBtnScale  = useRef(new Animated.Value(0)).current;
  const imageScale   = useRef(new Animated.Value(1)).current;
  const handScale    = useRef(new Animated.Value(1)).current;
  const handY        = useRef(new Animated.Value(0)).current;
  const rippleScale  = useRef(new Animated.Value(0.4)).current;
  const rippleOpacity = useRef(new Animated.Value(0.7)).current;
  const sessionStart = useRef(Date.now());
  const lastTapTime  = useRef(null);
  const tapHintLoop  = useRef(null);

  const playIntro = useCallback(() => {
    // The recording is the only voice on this screen — a concept without one
    // stays silent rather than falling back to synthesised speech.
    if (concept?.t1ImageAudio) {
      playConceptAudio(concept.t1ImageAudio);
    }
  }, [concept]);

  // Tap-hint animation loop (hand press + ripple)
  useEffect(() => {
    tapHintLoop.current = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        // Press down
        Animated.parallel([
          Animated.timing(handScale, { toValue: 0.78, duration: 180, useNativeDriver: true }),
          Animated.timing(handY,     { toValue: 10,   duration: 180, useNativeDriver: true }),
          Animated.timing(rippleScale,   { toValue: 0.4, duration: 10,  useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0.7, duration: 10,  useNativeDriver: true }),
        ]),
        // Release + ripple expands
        Animated.parallel([
          Animated.timing(handScale, { toValue: 1,   duration: 260, useNativeDriver: true }),
          Animated.timing(handY,     { toValue: 0,   duration: 260, useNativeDriver: true }),
          Animated.timing(rippleScale,   { toValue: 1.8, duration: 500, useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0,   duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    );
    tapHintLoop.current.start();
    return () => tapHintLoop.current?.stop();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!concept) return;

    if (!isRelearn) {
      conceptApi.startTier1({
        studentId:   student.sid,
        categoryKey: category.key,
        conceptKey,
      }).catch(() => {});
    } else {
      conceptApi.logInteraction({
        studentId:   student.sid,
        sessionId:   sessionId || null,
        categoryKey: category.key,
        conceptKey,
        eventType:   'relearn_start',
        eventData:   {},
      }).catch(() => {});
    }

    const t = setTimeout(() => playIntro(), 800);
    return () => clearTimeout(t);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleImageTap() {
    const now      = Date.now();
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount === 1) tapHintLoop.current?.stop();

    playIntro();

    Animated.sequence([
      Animated.spring(imageScale, { toValue: 0.93, useNativeDriver: true, speed: 60 }),
      Animated.spring(imageScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();

    const interTapMs = lastTapTime.current ? now - lastTapTime.current : null;
    lastTapTime.current = now;

    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      eventType:   'image_tap',
      eventData:   { tap_index: newCount, time_ms: now - sessionStart.current, inter_tap_ms: interTapMs },
    }).catch(() => {});

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
    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      tier:        1,
      eventType:   'screen_exit',
      eventData:   { total_time_ms: Date.now() - sessionStart.current },
    }).catch(() => {});
    stopConceptAudio();
    if (isRelearn) {
      if (confusedKeys?.length > 0) {
        // Adaptive 2-card quiz targeting exactly the fruits the student confused
        navigation.navigate('ConceptAdaptiveQuiz', {
          student, category, conceptKey,
          sessionId: sessionId || null,
          confusedKeys,
        });
      } else {
        // Relearn without confusion data — fall back to standard quiz
        navigation.navigate('ConceptMatch', { student, category, conceptKey, sessionId: sessionId || null });
      }
    } else {
      navigation.navigate('ConceptDemo', { student, category, conceptKey, sessionId: sessionId || null });
    }
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

          <View />

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={playIntro}
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

        {/* Main image — tappable */}
        <View style={[styles.imageContainer, { width: imgSize, height: imgSize }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleImageTap}
            style={StyleSheet.absoluteFill}
          >
            <Animated.Image
              source={concept.real}
              style={{ width: imgSize, height: imgSize, transform: [{ scale: imageScale }] }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Tap hint — vanishes after first tap */}
          {tapCount === 0 && (
            <View style={styles.tapHint} pointerEvents="none">
              {/* Ripple ring */}
              <Animated.View
                style={[
                  styles.ripple,
                  { borderColor: theme.button, transform: [{ scale: rippleScale }], opacity: rippleOpacity },
                ]}
              />
              {/* Hand icon */}
              <Animated.View style={{ transform: [{ scale: handScale }, { translateY: handY }] }}>
                <Ionicons name="hand-left" size={52} color={theme.button} />
              </Animated.View>
            </View>
          )}
        </View>

        {/* Tap count dots */}
        <View style={styles.tapDots}>
          {[1, 2].map((n) => (
            <View
              key={n}
              style={[
                styles.tapDot,
                { backgroundColor: tapCount >= n ? theme.button : 'rgba(0,0,0,0.15)' },
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
    fontFamily: 'DMSans_700Bold',
  },
  imageContainer: {
    position: 'relative',
  },
  tapHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
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
    bottom: 80,
    alignSelf: 'center',
  },
  fwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  fwdBtnText: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
