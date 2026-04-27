import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

const WORD_LABELS = {
  thank_you:        'Thank You',
  please:           'Please',
  sorry:            "I'm Sorry",
  youre_welcome:    "You're Welcome",
  please_excuse_me: 'Please Excuse Me',
};

export default function Phase1CompleteScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you' } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_LABELS[wordKey] ?? wordKey.replace(/_/g, ' ');

  const starScale  = useRef(new Animated.Value(0)).current;
  const cardSlide  = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(starScale,  { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardSlide,   { toValue: 0, useNativeDriver: true, bounciness: 10 }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>

          {/* Stars animation */}
          <Animated.Text style={[styles.stars, { transform: [{ scale: starScale }] }]}>
            ⭐⭐⭐
          </Animated.Text>

          {/* Result card */}
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.cardSurface },
              { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
            ]}
          >
            <View style={[styles.checkCircle, { backgroundColor: theme.button }]}>
              <Ionicons name="checkmark" size={32} color="#FFF" />
            </View>

            <Text style={[styles.heading, { color: theme.headingText }]}>
              You did it! 🎉
            </Text>

            <Text style={[styles.subtext, { color: theme.headingText }]}>
              You've learnt to recognise{'\n'}
              <Text style={[styles.wordAccent, { color: theme.button }]}>"{wordLabel}"</Text>
            </Text>

            <Text style={[styles.nextLabel, { color: theme.headingText }]}>
              Next up: Say the word!
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: cardOpacity }}>
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: theme.button }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Phase2Production', { student, wordKey, wordId: route.params?.wordId })}
            >
              <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>
                Let's say it!
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl,
    gap: Layout.spacing.lg,
  },

  stars: {
    fontSize: 48,
    letterSpacing: 4,
  },

  card: {
    width: '100%',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.xl,
    alignItems: 'center',
    gap: Layout.spacing.md,
    ...Layout.shadow.lg,
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heading: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtext: {
    fontSize: Layout.fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 24,
  },
  wordAccent: {
    fontWeight: '900',
    opacity: 1,
  },
  nextLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    opacity: 0.5,
    marginTop: 4,
  },

  continueBtn: {
    paddingHorizontal: Layout.spacing.xxl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    ...Layout.shadow.md,
  },
  continueBtnText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
  },
});
