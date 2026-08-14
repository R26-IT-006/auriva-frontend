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
import * as Speech from 'expo-speech';
import { playConceptAudio, stopConceptAudio } from '../../../utils/audioUtils';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../data/conceptData';
import { conceptApi } from '../../../api/concept';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { Layout } from '../../../constants/layout';

function LetterBubble({ char, index, color }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 16, speed: 8 }).start();
    }, 200 + index * 90);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.letterBubble, { borderColor: color, transform: [{ scale }] }]}>
      <Text style={[styles.letterText, { color }]}>{char}</Text>
    </Animated.View>
  );
}

export default function Tier2ImageScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width, height } = useWindowDimensions();

  const [tapCount,    setTapCount]    = useState(0);
  const [gateVisible, setGateVisible] = useState(false);

  const fwdBtnScale   = useRef(new Animated.Value(0)).current;
  const imageScale    = useRef(new Animated.Value(1)).current;
  const handScale     = useRef(new Animated.Value(1)).current;
  const handY         = useRef(new Animated.Value(0)).current;
  const rippleScale   = useRef(new Animated.Value(0.4)).current;
  const rippleOpacity = useRef(new Animated.Value(0.7)).current;
  const sessionStart  = useRef(Date.now());
  const lastTapTime   = useRef(null);
  const tapHintLoop   = useRef(null);

  const playAudio = useCallback(() => {
    if (concept?.introAudio) {
      playConceptAudio(concept.introAudio);
    } else {
      Speech.stop();
      Speech.speak(concept?.label || '', { language: 'en-US', rate: 0.75, pitch: 1.0 });
      setTimeout(() => {
        if (concept?.labelSi) Speech.speak(concept.labelSi, { language: 'si-LK', rate: 0.7 });
      }, 1200);
    }
  }, [concept]);

  useEffect(() => {
    tapHintLoop.current = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(handScale,    { toValue: 0.78, duration: 180, useNativeDriver: true }),
          Animated.timing(handY,        { toValue: 10,   duration: 180, useNativeDriver: true }),
          Animated.timing(rippleScale,   { toValue: 0.4,  duration: 10,  useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0.7,  duration: 10,  useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(handScale,    { toValue: 1,   duration: 260, useNativeDriver: true }),
          Animated.timing(handY,        { toValue: 0,   duration: 260, useNativeDriver: true }),
          Animated.timing(rippleScale,   { toValue: 1.8, duration: 500, useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0,   duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    );
    tapHintLoop.current.start();
    return () => tapHintLoop.current?.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!concept) return;
    conceptApi.startTier2({ studentId: student.sid, categoryKey: category.key, conceptKey }).catch(() => {});
    const t = setTimeout(() => playAudio(), 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImageTap() {
    const now      = Date.now();
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount === 1) tapHintLoop.current?.stop();

    playAudio();

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
      tier:        2,
      eventType:   'image_tap',
      eventData:   { tap_index: newCount, time_ms: now - sessionStart.current, inter_tap_ms: interTapMs },
    }).catch(() => {});

    if (newCount === 2) {
      Animated.spring(fwdBtnScale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 6 }).start();
    }
  }

  function handleForward() {
    conceptApi.logInteraction({
      studentId:   student.sid,
      sessionId:   sessionId || null,
      categoryKey: category.key,
      conceptKey,
      tier:        2,
      eventType:   'screen_exit',
      eventData:   { total_time_ms: Date.now() - sessionStart.current },
    }).catch(() => {});
    Speech.stop();
    stopConceptAudio();
    // Demo first, mirroring tier 1's ConceptImage → ConceptDemo → ConceptMatch flow.
    navigation.navigate('Tier2Demo', { student, category, conceptKey, sessionId: sessionId || null });
  }

  if (!concept) return null;

  const imgSize = Math.min(width, height) * 0.48;

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
            onPress={playAudio}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-high-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* Letter bubbles */}
        <View style={styles.letterRow}>
          {concept.label.toUpperCase().split('').map((char, i) => (
            <LetterBubble key={i} char={char} index={i} color={theme.button} />
          ))}
        </View>

        {/* Sinhala label — the screen already speaks labelSi, but never showed it */}
        {concept.labelSi && (
          <Text style={[styles.labelSi, { color: theme.headingText }]}>
            {concept.labelSi}
          </Text>
        )}

        {/* Main image — tappable */}
        <View style={[styles.imageContainer, { width: imgSize, height: imgSize }]}>
          <TouchableOpacity activeOpacity={1} onPress={handleImageTap} style={StyleSheet.absoluteFill}>
            <Animated.Image
              source={concept.real}
              style={{ width: imgSize, height: imgSize, transform: [{ scale: imageScale }] }}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {tapCount === 0 && (
            <View style={styles.tapHint} pointerEvents="none">
              <Animated.View
                style={[styles.ripple, { borderColor: theme.button, transform: [{ scale: rippleScale }], opacity: rippleOpacity }]}
              />
              <Animated.View style={{ transform: [{ scale: handScale }, { translateY: handY }] }}>
                <Ionicons name="hand-left" size={52} color={theme.button} />
              </Animated.View>
            </View>
          )}
        </View>

        {/* Tap count dots */}
        <View style={styles.tapDots}>
          {[1, 2].map((n) => (
            <View key={n} style={[styles.tapDot, { backgroundColor: tapCount >= n ? theme.button : 'rgba(0,0,0,0.15)' }]} />
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

  labelSi: {
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 22,
  },
  letterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    // Was 30 — the Sinhala label now carries the gap down to the image.
    marginBottom: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  letterBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  letterText: {
    fontSize: 32,
    fontFamily: 'Nunito_900Black',
  },

  imageContainer: { position: 'relative' },

  tapHint: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },

  tapDots: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  tapDot: {
    width: 10, height: 10,
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
    fontFamily: 'Nunito_800ExtraBold',
  },
});
