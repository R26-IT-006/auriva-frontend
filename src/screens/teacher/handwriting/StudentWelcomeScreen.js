import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const AVATAR_MAP = {
  boba:     require('../../../../assets/handwriting-avatars/Boba.png'),
  glitter:  require('../../../../assets/handwriting-avatars/Glitter.png'),
  lily:     require('../../../../assets/handwriting-avatars/Lily.png'),
  megatron: require('../../../../assets/handwriting-avatars/Megatron.png'),
};

export default function StudentWelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { width, height } = useWindowDimensions();

  const avatarSize = Math.min(width, height) * 0.50;
  const [reduceMotion, setReduceMotion] = useState(false);
  const avatarFloat = useRef(new Animated.Value(0)).current;
  const bubbleFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      avatarFloat.setValue(0);
      bubbleFloat.setValue(0);
      return undefined;
    }

    const avatarAnimation = Animated.loop(Animated.sequence([
      Animated.timing(avatarFloat, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.timing(avatarFloat, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }),
    ]));

    const bubbleAnimation = Animated.loop(Animated.sequence([
      Animated.timing(bubbleFloat, {
        toValue: 1,
        duration: 4800,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleFloat, {
        toValue: 0,
        duration: 4800,
        useNativeDriver: true,
      }),
    ]));

    avatarAnimation.start();
    bubbleAnimation.start();

    return () => {
      avatarAnimation.stop();
      bubbleAnimation.stop();
    };
  }, [avatarFloat, bubbleFloat, reduceMotion]);

  const avatarTranslateY = avatarFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const avatarScale = avatarFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });
  const bubbleUp = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const bubbleDown = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const bubbleRight = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const bubbleLeft = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* ── Decorative background shapes ─────────────────────────────────── */}
      <Animated.View style={[styles.bgCircleLarge, {
        backgroundColor: theme.button + '12',
        width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275,
        transform: [{ translateY: bubbleUp }],
      }]} />
      <Animated.View style={[styles.bgCircleSmall, {
        backgroundColor: theme.button + '0D',
        width: width * 0.32, height: width * 0.32, borderRadius: width * 0.16,
        transform: [{ translateX: bubbleRight }],
      }]} />
      <Animated.View style={[styles.bgCircleMedium, {
        backgroundColor: theme.button + '0A',
        width: width * 0.22, height: width * 0.22, borderRadius: width * 0.11,
        transform: [{ translateY: bubbleDown }, { translateX: bubbleLeft }],
      }]} />
      <Animated.View style={[styles.bgCircleTinyTop, {
        backgroundColor: theme.button + '10',
        width: width * 0.10, height: width * 0.10, borderRadius: width * 0.05,
        transform: [{ translateY: bubbleDown }],
      }]} />
      <Animated.View style={[styles.bgCircleTinyBottom, {
        backgroundColor: theme.button + '0E',
        width: width * 0.14, height: width * 0.14, borderRadius: width * 0.07,
        transform: [{ translateX: bubbleLeft }],
      }]} />

      <SafeAreaView style={styles.safe}>
        <View style={[styles.center, { paddingHorizontal: width * 0.08 }]}>

          {/* ── Avatar ───────────────────────────────────────────────────── */}
          <Animated.Image
            source={AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron}
            style={[
              styles.avatar,
              {
                width: avatarSize,
                height: avatarSize,
                transform: [
                  { translateY: avatarTranslateY },
                  { scale: avatarScale },
                ],
              },
            ]}
            resizeMode="contain"
          />

          {/* ── Greeting ─────────────────────────────────────────────────── */}
          <View style={styles.textBlock}>
            <Text style={[styles.greeting, { color: theme.headingText }]}>
              Hello, {student?.full_name}!
            </Text>
            <Text style={[styles.subtitle, { color: theme.button }]}>
              Let's practice handwriting!
            </Text>
          </View>

          {/* ── Start button ─────────────────────────────────────────────── */}
          <View style={styles.btnWrapper}>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('ShapeAssessment', { student, theme })}
              activeOpacity={0.85}
            >
              <Text style={[styles.startText, { color: theme.buttonText }]}>
                Start Assessment
              </Text>
            </TouchableOpacity>

          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  bgCircleLarge: {
    position: 'absolute',
    top: '-10%',
    right: '-12%',
  },
  bgCircleSmall: {
    position: 'absolute',
    bottom: '8%',
    left: '-8%',
  },
  bgCircleMedium: {
    position: 'absolute',
    top: '22%',
    left: '7%',
  },
  bgCircleTinyTop: {
    position: 'absolute',
    top: '11%',
    right: '18%',
  },
  bgCircleTinyBottom: {
    position: 'absolute',
    bottom: '22%',
    right: '12%',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '5%',
    gap: 28,
  },

  avatar: {},

  textBlock: {
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },

  btnWrapper: {
    width: '80%',
    maxWidth: 360,
  },
  startButton: {
    width: '100%',
    paddingVertical: 20,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  startText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
