import { useEffect, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../constants/conceptData';
import { Layout } from '../../../constants/layout';

const AVATAR_IMAGES = {
  boba:     require('../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

const STAR_COUNT = 8;

function Star({ delay, startX, style }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const rotate     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: 120, duration: 1800, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 1,   duration: 300,  useNativeDriver: true }),
            Animated.timing(rotate,     { toValue: 1,   duration: 1800, useNativeDriver: true }),
          ]),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(translateY, { toValue: -20, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0,   duration: 0, useNativeDriver: true }),
            Animated.timing(rotate,     { toValue: 0,   duration: 0, useNativeDriver: true }),
          ]),
        ]),
      ).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.Text
      style={[
        styles.star,
        style,
        { transform: [{ translateY }, { rotate: spin }], opacity },
      ]}
    >
      ⭐
    </Animated.Text>
  );
}

export default function ConceptCongratulationsScreen({ route, navigation }) {
  const { student, category, conceptKey } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const avatarBounce = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.7)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(contentScale,   { toValue: 1, useNativeDriver: true, bounciness: 10, speed: 5 }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Avatar continuous bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(avatarBounce, { toValue: -18, duration: 400, useNativeDriver: true }),
        Animated.timing(avatarBounce, { toValue: 0,   duration: 350, useNativeDriver: true }),
        Animated.delay(200),
      ]),
    ).start();

    // TTS celebration
    setTimeout(() => {
      Speech.speak(`Well done! You found the ${concept?.label}!`, { language: 'en-US', rate: 0.8 });
    }, 600);

    // Auto-navigate after 3.5s
    const t = setTimeout(() => handleContinue(), 3500);
    return () => clearTimeout(t);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue() {
    Speech.stop();
    navigation.navigate('ConceptItems', { student, category });
  }

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    delay:  i * 250,
    startX: (width / STAR_COUNT) * i + Math.random() * 20,
  }));

  const avatarSource = student?.avatar_key ? AVATAR_IMAGES[student.avatar_key] : null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Falling stars */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {stars.map((s, i) => (
            <Star key={i} delay={s.delay} startX={s.startX} style={{ left: s.startX, top: 0 }} />
          ))}
        </View>

        <Animated.View
          style={[
            styles.content,
            { transform: [{ scale: contentScale }], opacity: contentOpacity },
          ]}
        >
          {/* Avatar */}
          {avatarSource && (
            <Animated.Image
              source={avatarSource}
              style={[styles.avatar, { transform: [{ translateY: avatarBounce }] }]}
              resizeMode="contain"
            />
          )}

          {/* Well done card */}
          <View style={[styles.card, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={styles.emoji}>🌟</Text>
            <Text style={[styles.heading, { color: theme.headingText }]}>Well Done!</Text>
            {concept && (
              <Text style={[styles.conceptName, { color: theme.button }]}>{concept.label}</Text>
            )}
            <Text style={[styles.sub, { color: theme.headingText }]}>
              You passed Tier 1!
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: theme.button }]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>
              Keep Going!
            </Text>
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: {
    alignItems: 'center',
    gap: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.xl,
  },

  avatar: {
    width: 180,
    height: 180,
  },

  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 2.5,
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
  },
  emoji: {
    fontSize: 48,
  },
  heading: {
    fontSize: 32,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.8,
  },
  conceptName: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
  },
  sub: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.6,
    marginTop: 4,
  },

  continueBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  continueBtnText: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
  },

  star: {
    position: 'absolute',
    fontSize: 22,
  },
});
