import { useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getAvatarImage } from './_components';

export default function FeedbackScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const avatarKey  = student?.avatar_key ?? 'lily';
  const avatarName = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  // Bounce animation for avatar
  const bounce = useRef(new Animated.Value(0)).current;
  // Fade in for whole screen
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -14, duration: 400, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0,   duration: 350, useNativeDriver: true }),
        Animated.delay(900),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Confetti dots (simple animated coloured circles)
  const confettiColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BC5', '#FF9F1C'];

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.body, { opacity: fadeIn }]}>

          {/* Confetti row */}
          <View style={styles.confettiRow}>
            {confettiColors.map((c, i) => (
              <View key={i} style={[styles.confettiDot, { backgroundColor: c, transform: [{ rotate: `${i * 30}deg` }] }]} />
            ))}
          </View>

          {/* Feedback text */}
          <View style={[styles.speechBubble, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={[styles.feedbackHeading, { color: theme.headingText }]}>Good Job!</Text>
            <Text style={[styles.feedbackSub, { color: theme.headingText }]}>
              Shall we practice the conversation again?
            </Text>
            <Text style={[styles.feedbackSinhala, { color: theme.headingText }]}>
              අපි නැවත සංවාදය පුහුණු කරමුද?
            </Text>
          </View>

          {/* Avatar with bounce */}
          <Animated.Image
            source={getAvatarImage(avatarKey)}
            style={[styles.avatarImg, { transform: [{ translateY: bounce }] }]}
            resizeMode="contain"
          />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.goAgainBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('L3RepeatAudio', { student, pass: 2 })}
            activeOpacity={0.85}
          >
            <Text style={[styles.goAgainText, { color: theme.buttonText }]}>Let's go again!</Text>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },

  confettiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Layout.spacing.sm,
  },
  confettiDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },

  speechBubble: {
    borderRadius: Layout.radius.xl,
    borderWidth: 2,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 340,
    width: '100%',
  },
  feedbackHeading: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  feedbackSub: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: Layout.spacing.xs,
    lineHeight: 22,
  },
  feedbackSinhala: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.65,
    marginTop: Layout.spacing.xs,
    lineHeight: 20,
  },

  avatarImg: {
    width: 160,
    height: 160,
  },

  goAgainBtn: {
    borderRadius: Layout.radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  goAgainText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '800',
  },
});
