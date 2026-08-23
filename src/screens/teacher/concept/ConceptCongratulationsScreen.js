import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItem } from '../../../data/conceptData';
import { conceptApi } from '../../../api/concept';
import { Layout } from '../../../constants/layout';

const AVATAR_CONGRATS_IMAGES = {
  boba:     require('../../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../../assets/avatar-images/GlitterCongratulations.png'),
  lily:     require('../../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../../assets/avatar-images/MegatronCongratulations.png'),
};

const STAR_COUNT = 8;
const CONFETTI_GLYPHS = ['⭐', '✨', '🎉'];
const AUTO_ADVANCE_MS = 4500;
const STAR_CAP = 5;   // most score stars we'll draw, however many rounds there were

// Proportional, so it reads correctly for a 6-round activity as well as a 3-round tier.
function getEncouragement(correctCount, totalCount) {
  const ratio = totalCount > 0 ? correctCount / totalCount : 0;
  if (ratio >= 1)    return 'Perfect score! You really know these.';
  if (ratio >= 2 / 3) return 'So close — great effort!';
  return "Nice try — let's practice these some more.";
}

function FallingStar({ delay, startX, glyph, size, fallDistance, duration }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const rotate     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: fallDistance, duration, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 1,            duration: 300, useNativeDriver: true }),
            Animated.timing(rotate,     { toValue: 1,            duration, useNativeDriver: true }),
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.Text
      style={[
        styles.fallingStar,
        { left: startX, top: 0, fontSize: size, transform: [{ translateY }, { rotate: spin }], opacity },
      ]}
    >
      {glyph}
    </Animated.Text>
  );
}

export default function ConceptCongratulationsScreen({ route, navigation }) {
  const {
    student, category, conceptKey,
    correctCount = 3,
    totalCount   = 3,
    completedTier = 1,
    mode = 'tier',        // 'tier' | 'activity' | 'conclusion'
  } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const avatarScale  = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.82)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const burstScale   = useRef(new Animated.Value(0)).current;

  // Activities can have up to 6 rounds, so the star row is no longer fixed at 3.
  // One ref holding an array — a loop of useRef calls would break the rules of hooks.
  const starScalesRef = useRef(null);
  if (starScalesRef.current === null) {
    starScalesRef.current = Array.from({ length: STAR_CAP }, () => new Animated.Value(0));
  }
  const starCount  = Math.min(Math.max(totalCount, 1), STAR_CAP);
  const starScales = starScalesRef.current;

  const btnScale     = useRef(new Animated.Value(1)).current;
  const autoProgress = useRef(new Animated.Value(0)).current;

  function btnPressIn() {
    Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function btnPressOut() {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale,   { toValue: 1, useNativeDriver: true, bounciness: 10, speed: 5 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, bounciness: 24, speed: 5 }).start();
    }, 200);

    Animated.spring(avatarScale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 24,
      speed: 4,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(avatarBounce, { toValue: -18, duration: 420, useNativeDriver: true }),
          Animated.timing(avatarBounce, { toValue: 0,   duration: 360, useNativeDriver: true }),
          Animated.delay(280),
        ]),
      ).start();
    });

    starScales.slice(0, starCount).forEach((s, i) => {
      setTimeout(() => {
        Animated.spring(s, { toValue: 1, useNativeDriver: true, bounciness: 20, speed: 7 }).start();
      }, 450 + i * 200);
    });

    setTimeout(() => {
      Speech.speak(
        // A conclusion is the end of a whole category, so it gets a line about
        // finishing rather than a score read-out — the number here counts
        // first-try placements, which isn't what the child was playing for.
        mode === 'conclusion'
          ? `You finished all the ${category.label.toLowerCase()}! Amazing work!`
          : `Well done! You got ${correctCount} out of ${totalCount}!`,
        { language: 'en-US', rate: 0.8 },
      );
    }, 600);

    Animated.timing(autoProgress, {
      toValue: 1,
      duration: AUTO_ADVANCE_MS,
      useNativeDriver: false,
    }).start();

    const t = setTimeout(() => handleContinue(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue() {
    Speech.stop();
    // Activities and conclusions are no-fail and don't feed the tier ladder —
    // always back to the grid.
    if (mode === 'activity' || mode === 'conclusion') {
      navigation.navigate('ConceptItems', { student, category });
      return;
    }
    if (completedTier === 1) {
      if (correctCount === 3) {
        // Perfect T1 pass — skip image re-show, jump straight to name-match
        conceptApi.startTier2({ studentId: student.sid, categoryKey: category.key, conceptKey }).catch(() => {});
        navigation.navigate('Tier2Activity', { student, category, conceptKey, sessionId: null });
      } else {
        navigation.navigate('Tier2Image', { student, category, conceptKey, sessionId: null });
      }
    } else if (completedTier === 2) {
      navigation.navigate('Tier3Video', { student, category, conceptKey, needsReplay: correctCount < 3 });
    } else {
      navigation.navigate('ConceptItems', { student, category });
    }
  }

  const fallingStars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    delay:        i * 260,
    startX:       (width / STAR_COUNT) * i + Math.random() * 18,
    glyph:        CONFETTI_GLYPHS[i % CONFETTI_GLYPHS.length],
    size:         18 + Math.random() * 14,
    fallDistance: 120 + Math.random() * 60,
    duration:     1600 + Math.random() * 700,
  }));

  const avatarSource = student?.avatar_key ? AVATAR_CONGRATS_IMAGES[student.avatar_key] : null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {fallingStars.map((s, i) => (
            <FallingStar
              key={i}
              delay={s.delay}
              startX={s.startX}
              glyph={s.glyph}
              size={s.size}
              fallDistance={s.fallDistance}
              duration={s.duration}
            />
          ))}
        </View>

        <View style={styles.stack}>

          {avatarSource && (
            <Animated.Image
              source={avatarSource}
              style={[
                styles.avatar,
                { transform: [{ scale: avatarScale }, { translateY: avatarBounce }] },
              ]}
              resizeMode="contain"
            />
          )}

          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.cardSurface, transform: [{ scale: cardScale }], opacity: cardOpacity },
            ]}
          >
            <View style={styles.burstWrap}>
              <Animated.View
                style={[
                  styles.burstGlow,
                  { backgroundColor: theme.cardOutline, transform: [{ scale: burstScale }] },
                ]}
              />
              <Animated.Text style={[styles.burst, { transform: [{ scale: burstScale }] }]}>
                🌟
              </Animated.Text>
            </View>

            <Text style={[styles.heading, { color: theme.headingText }]}>
              {correctCount >= totalCount ? 'Well Done!' : 'Good Job!'}
            </Text>

            {mode === 'activity' ? (
              <Text style={[styles.conceptName, { color: theme.button }]}>Practice Activity</Text>
            ) : mode === 'conclusion' ? (
              // No conceptKey is passed for a conclusion — it closes out the whole
              // category, so the category is what gets named here.
              <Text style={[styles.conceptName, { color: theme.button }]}>
                {category.label} Complete!
              </Text>
            ) : concept ? (
              <Text style={[styles.conceptName, { color: theme.button }]}>{concept.label}</Text>
            ) : null}

            <View style={[styles.scorePill, { borderColor: theme.button }]}>
              {Array.from({ length: starCount }, (_, i) => {
                // Stars are capped, so on a 6-round activity each one stands for
                // more than a single correct answer.
                const filled = (i + 1) / starCount <= correctCount / totalCount;
                return (
                  <Animated.Text
                    key={i}
                    style={[
                      styles.pillStar,
                      {
                        opacity:   filled ? 1 : 0.2,
                        transform: [{ scale: starScales[i] }],
                      },
                    ]}
                  >
                    ⭐
                  </Animated.Text>
                );
              })}
              <Text style={[styles.pillCount, { color: theme.headingText }]}>
                {correctCount} / {totalCount}
              </Text>
              <Text style={[styles.pillLabel, { color: theme.headingText }]}>
                Correct!
              </Text>
            </View>

            <Text style={[styles.encouragement, { color: theme.headingText }]}>
              {getEncouragement(correctCount, totalCount)}
            </Text>
          </Animated.View>

        </View>

        <View style={styles.btnStack}>
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              style={[styles.continueBtn, { backgroundColor: theme.button }]}
              onPress={handleContinue}
              onPressIn={btnPressIn}
              onPressOut={btnPressOut}
            >
              <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>
                Keep Going!  🎊
              </Text>
            </Pressable>
          </Animated.View>

          <View style={styles.autoTrack}>
            <Animated.View
              style={[
                styles.autoFill,
                {
                  backgroundColor: theme.button,
                  width: autoProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },

  stack: {
    alignItems: 'center',
    width: '80%',
  },

  avatar: {
    width: 220,
    height: 220,
    marginBottom: -75,
    zIndex: 10,
  },

  card: {
    width: '100%',
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: 90,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  burstWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  burstGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.25,
  },
  burst: {
    fontSize: 44,
  },

  heading: {
    fontSize: 30,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.5,
  },
  conceptName: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
  },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.8,
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingVertical: 9,
    gap: 5,
    marginTop: 10,
  },
  pillStar: {
    fontSize: 20,
  },
  pillCount: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
    marginLeft: 4,
  },
  pillLabel: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.65,
  },

  encouragement: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },

  btnStack: {
    alignItems: 'center',
    gap: 10,
  },

  autoTrack: {
    width: 120,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  autoFill: {
    height: '100%',
    borderRadius: 3,
  },

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
  continueBtnText: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
  },

  fallingStar: {
    position: 'absolute',
    fontSize: 22,
  },
});
