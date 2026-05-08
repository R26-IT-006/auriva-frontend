import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const AVATAR_MAP = {
  boba:     require('../../../assets/handwriting-avatars/Boba.png'),
  glitter:  require('../../../assets/handwriting-avatars/Glitter.png'),
  lily:     require('../../../assets/handwriting-avatars/Lily.png'),
  megatron: require('../../../assets/handwriting-avatars/Megatron.png'),
};

export default function StudentWelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { width, height } = useWindowDimensions();

  const avatarSize = Math.min(width, height) * 0.52;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* ── Decorative background shapes ─────────────────────────────────── */}
      <View style={[styles.bgCircleLarge, {
        backgroundColor: theme.button + '12',
        width: width * 0.55, height: width * 0.55, borderRadius: width * 0.275,
      }]} />
      <View style={[styles.bgCircleSmall, {
        backgroundColor: theme.button + '0D',
        width: width * 0.32, height: width * 0.32, borderRadius: width * 0.16,
      }]} />

      <SafeAreaView style={styles.safe}>
        <View style={[styles.center, { paddingHorizontal: width * 0.08 }]}>

          {/* ── Avatar ───────────────────────────────────────────────────── */}
          <Image
            source={AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron}
            style={[styles.avatar, { width: avatarSize, height: avatarSize }]}
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

          <View style={styles.spacer} />

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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '6%',
  },

  avatar: {
    marginBottom: '4%',
  },

  textBlock: {
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },

  spacer: { flex: 1 },

  btnWrapper: {
    width: '80%',
    maxWidth: 340,
    marginBottom: '4%',
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
