import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Phase1CompleteCelebration.js
 *
 * The dialogue "you've learnt to recognise the word" screen, laid out like
 * the other modules' activity-completion screens (Concept's
 * congratulations screen, WordPracticeResultCard): theme gradient with
 * corner blobs, the child's celebrating avatar overlapping the top of a
 * white card, a burst, the heading, the word and the raised
 * 3D button beneath.
 *
 * Presentation only — the caller decides where the button goes.
 *
 * Also used by the dialogue word-complete screen, which passes its own
 * heading / subtext / burst / note, its own `actions` (replacing the single
 * button) and a `topRight` control (the gated exit).
 */

const AVATAR_CONGRATS_IMAGES = {
  boba:     require('../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../assets/avatar-images/GlitterCongratulations.png'),
  lily:     require('../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../assets/avatar-images/MegatronCongratulations.png'),
};

export default function Phase1CompleteCelebration({
  theme,
  avatarKey,
  wordLabel,
  onContinue,
  heading = 'You did it!',
  subtext = "You've learnt to recognise",
  burst = '🌟',
  note = null,
  actions = null,
  topRight = null,
}) {
  const avatarSource = AVATAR_CONGRATS_IMAGES[String(avatarKey ?? 'lily').toLowerCase()]
    ?? AVATAR_CONGRATS_IMAGES.lily;

  const cardScale   = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const burstScale  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale,   { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.spring(burstScale,  { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [cardScale, cardOpacity, avatarScale, burstScale]);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.stack}>

          <Animated.Image
            source={avatarSource}
            style={[styles.avatar, { transform: [{ scale: avatarScale }] }]}
            resizeMode="contain"
          />

          <Animated.View
            style={[
              styles.card,
              { borderColor: theme.cardOutline, opacity: cardOpacity, transform: [{ scale: cardScale }] },
            ]}
          >
            <View style={styles.burstWrap}>
              <Animated.View
                style={[styles.burstGlow, { backgroundColor: theme.cardOutline, transform: [{ scale: burstScale }] }]}
              />
              <Animated.Text style={[styles.burst, { transform: [{ scale: burstScale }] }]}>{burst}</Animated.Text>
            </View>

            <Text style={[styles.heading, { color: theme.headingText }]}>{heading}</Text>
            <Text style={[styles.subtext, { color: theme.headingText }]}>{subtext}</Text>
            <Text style={[styles.word, { color: theme.button }]}>{wordLabel}</Text>
            {note ? (
              <View style={[styles.notePill, { borderColor: theme.cardOutline }]}>
                <Text style={[styles.noteText, { color: theme.headingText }]}>{note}</Text>
              </View>
            ) : null}
          </Animated.View>

          {actions ?? (
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              { backgroundColor: theme.button, transform: [{ scale: pressed ? 0.96 : 1 }] },
            ]}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Let's say it"
          >
            <Text style={[styles.continueText, { color: theme.buttonText }]}>Let's say it!  🎤</Text>
          </Pressable>
          )}
        </View>

        {topRight ? <View style={styles.topRight}>{topRight}</View> : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1, justifyContent: 'center' },

  topRight: {
    position: 'absolute',
    top: 12,
    right: 16,
  },

  notePill: {
    borderWidth: 1.8,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 10,
  },
  noteText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },

  // Decorative background shapes (same as the other module screens).
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight:   { width: 220, height: 220, top: -60, right: -60 },
  blobBottomLeft: { width: 260, height: 260, bottom: -80, left: -80 },

  stack: {
    width: '72%',
    maxWidth: 560,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 20,
  },

  // Overlaps the top of the card, as on the Concept completion screen.
  avatar: {
    width: 180,
    height: 180,
    marginBottom: -80,
    zIndex: 10,
  },

  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  burstWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  burstGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.25,
  },
  burst: { fontSize: 36 },

  heading: {
    fontSize: 30,
    fontFamily: 'DMSans_900Black',
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.65,
    marginTop: 2,
  },
  word: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: 0.5,
  },

  // The raised 3D button used on the other completion screens.
  continueBtn: {
    paddingHorizontal: 44,
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
  continueText: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
