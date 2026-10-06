import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { rs, rf } from '../../utils/responsive';

/**
 * WordPracticeResultCard.js
 *
 * The end-of-word celebration, laid out like the Concept module's activity
 * completion screen (ConceptCongratulationsScreen): the child's celebrating
 * avatar overlapping the top of a card, a burst, "Well done!", the word, a
 * star pill (one star per activity, filled when done on their own), a short
 * encouragement, and the raised 3D "Keep Going" button beneath.
 *
 * Same data and behaviour as before: the A–E statuses decide which stars are
 * filled, and Keep Going calls onContinue. No scoring is computed here.
 */

const ACTIVITIES = ['A', 'B', 'C', 'D', 'E'];

const AVATAR_CONGRATS_IMAGES = {
  boba:     require('../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../assets/avatar-images/GlitterCongratulations.png'),
  lily:     require('../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../assets/avatar-images/MegatronCongratulations.png'),
};

function encouragement(independentCount) {
  if (independentCount >= ACTIVITIES.length) return 'You did every activity on your own!';
  if (independentCount >= 3) return 'Great effort — nearly all on your own!';
  return 'You finished all 5 activities. Keep practising!';
}

export default function WordPracticeResultCard({ word, statuses, theme, onContinue, avatarKey }) {
  const independentCount = ACTIVITIES.filter(key => statuses?.[key] === 'correct').length;
  const avatarSource = avatarKey ? AVATAR_CONGRATS_IMAGES[String(avatarKey).toLowerCase()] : null;

  // Entrance: the card scales/fades in, the avatar pops and bounces, the
  // stars fill one after another — the Concept completion screen's motion.
  const cardScale   = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const burstScale  = useRef(new Animated.Value(0)).current;
  const starScales  = useRef(ACTIVITIES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale,   { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.spring(burstScale,  { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.stagger(140, starScales.map(v =>
      Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    )).start();
  }, [cardScale, cardOpacity, avatarScale, burstScale, starScales]);

  return (
    <View style={styles.stack} accessibilityLabel="Word practice result">

      {avatarSource && (
        <Animated.Image
          source={avatarSource}
          style={[styles.avatar, { transform: [{ scale: avatarScale }] }]}
          resizeMode="contain"
        />
      )}

      <Animated.View
        style={[
          styles.card,
          !avatarSource && styles.cardNoAvatar,
          {
            backgroundColor: theme.cardSurface ?? '#FFFFFF',
            borderColor: theme.cardOutline,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <View style={styles.burstWrap}>
          <Animated.View
            style={[styles.burstGlow, { backgroundColor: theme.cardOutline, transform: [{ scale: burstScale }] }]}
          />
          <Animated.Text style={[styles.burst, { transform: [{ scale: burstScale }] }]}>🌟</Animated.Text>
        </View>

        <Text style={[styles.heading, { color: theme.headingText }]}>Well done!</Text>
        <Text style={[styles.word, { color: theme.button }]}>{word.toUpperCase()}</Text>

        {/* One star per activity, filled when it was done on the child's own. */}
        <View style={[styles.scorePill, { borderColor: theme.cardOutline }]}>
          {ACTIVITIES.map((key, i) => {
            const independent = statuses?.[key] === 'correct';
            return (
              <Animated.Text
                key={key}
                style={[styles.pillStar, { opacity: independent ? 1 : 0.2, transform: [{ scale: starScales[i] }] }]}
                accessibilityLabel={`Activity ${key}: ${independent ? 'completed independently' : 'completed with help'}`}
              >
                ⭐
              </Animated.Text>
            );
          })}
          <Text style={[styles.pillCount, { color: theme.headingText }]}>
            {independentCount} / 5
          </Text>
          <Text style={[styles.pillLabel, { color: theme.headingText }]}>on your own</Text>
        </View>

        <Text
          style={[styles.encouragement, { color: theme.headingText }]}
          accessibilityLabel={`${independentCount} / 5 completed independently`}
        >
          {encouragement(independentCount)}
        </Text>
      </Animated.View>

      <Pressable
        style={({ pressed }) => [
          styles.continueBtn,
          { backgroundColor: theme.button, transform: [{ scale: pressed ? 0.96 : 1 }] },
        ]}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="Keep Going"
      >
        <Text style={[styles.continueText, { color: theme.buttonText }]}>Keep Going!  🎊</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '72%',
    maxWidth: rs(560),
    alignSelf: 'center',
    alignItems: 'center',
    gap: rs(20),
  },

  // Overlaps the top of the card, as on the Concept completion screen.
  avatar: {
    width: rs(200),
    height: rs(200),
    marginBottom: rs(-88),
    zIndex: 10,
  },

  card: {
    width: '100%',
    borderRadius: rs(28),
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: rs(76),
    paddingBottom: rs(26),
    paddingHorizontal: rs(24),
    gap: rs(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(8) },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardNoAvatar: {
    paddingTop: rs(26),
  },

  burstWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  burstGlow: {
    position: 'absolute',
    width: rs(64),
    height: rs(64),
    borderRadius: rs(32),
    opacity: 0.25,
  },
  burst: {
    fontSize: rf(40),
  },

  heading: {
    fontSize: rf(30),
    fontFamily: 'DMSans_900Black',
    letterSpacing: -0.5,
  },
  word: {
    fontSize: rf(22),
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: 3,
  },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.8,
    borderRadius: rs(32),
    paddingHorizontal: rs(18),
    paddingVertical: rs(9),
    gap: rs(5),
    marginTop: rs(10),
  },
  pillStar: {
    fontSize: rf(20),
  },
  pillCount: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
    marginLeft: rs(4),
  },
  pillLabel: {
    fontSize: rf(14),
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.65,
  },

  encouragement: {
    fontSize: rf(14),
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: rs(8),
    paddingHorizontal: rs(8),
  },

  // The Concept completion screen's raised 3D Keep Going button.
  continueBtn: {
    paddingHorizontal: rs(44),
    paddingVertical: rs(16),
    borderRadius: rs(36),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  continueText: {
    fontSize: rf(18),
    fontFamily: 'DMSans_800ExtraBold',
  },
});
