import { useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import { conceptApi } from '../../../api/concept';
import { Layout } from '../../../constants/layout';

const AVATAR_CONGRATS_IMAGES = {
  boba:     require('../../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../../assets/avatar-images/GlitterCongratulations.png'),
  lily:     require('../../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../../assets/avatar-images/MegatronCongratulations.png'),
};

const STAR_COUNT = 8;

function FallingStar({ delay, startX }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const rotate     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: 140, duration: 1900, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 1,   duration: 300,  useNativeDriver: true }),
            Animated.timing(rotate,     { toValue: 1,   duration: 1900, useNativeDriver: true }),
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
        { left: startX, top: 0, transform: [{ translateY }, { rotate: spin }], opacity },
      ]}
    >
      ⭐
    </Animated.Text>
  );
}

export default function ConceptCongratulationsScreen({ route, navigation }) {
  const { student, category, conceptKey, correctCount = 3, completedTier = 1 } = route.params;

  const concept = getConceptItem(category.key, conceptKey);
  const theme   = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const avatarScale  = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(0.82)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const burstScale   = useRef(new Animated.Value(0)).current;

  const starScales = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

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

    starScales.forEach((s, i) => {
      setTimeout(() => {
        Animated.spring(s, { toValue: 1, useNativeDriver: true, bounciness: 20, speed: 7 }).start();
      }, 450 + i * 200);
    });

    setTimeout(() => {
      Speech.speak(
        `Well done! You got ${correctCount} out of 3!`,
        { language: 'en-US', rate: 0.8 },
      );
    }, 600);

    const t = setTimeout(() => handleContinue(), 4500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue() {
    Speech.stop();
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
    delay:  i * 260,
    startX: (width / STAR_COUNT) * i + Math.random() * 18,
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
            <FallingStar key={i} delay={s.delay} startX={s.startX} />
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
            <Animated.Text style={[styles.burst, { transform: [{ scale: burstScale }] }]}>
              🌟
            </Animated.Text>

            <Text style={[styles.heading, { color: theme.headingText }]}>
              {correctCount >= 3 ? 'Well Done!' : 'Good Job!'}
            </Text>

            {concept && (
              <Text style={[styles.conceptName, { color: theme.button }]}>{concept.label}</Text>
            )}

            <View style={[styles.scorePill, { borderColor: theme.button }]}>
              {[0, 1, 2].map((i) => (
                <Animated.Text
                  key={i}
                  style={[
                    styles.pillStar,
                    {
                      opacity:   i < correctCount ? 1 : 0.2,
                      transform: [{ scale: starScales[i] }],
                    },
                  ]}
                >
                  ⭐
                </Animated.Text>
              ))}
              <Text style={[styles.pillCount, { color: theme.headingText }]}>
                {correctCount} / 3
              </Text>
              <Text style={[styles.pillLabel, { color: theme.headingText }]}>
                Correct!
              </Text>
            </View>
          </Animated.View>

        </View>

        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: theme.button }]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={[styles.continueBtnText, { color: theme.buttonText }]}>
            Keep Going!  🎊
          </Text>
        </TouchableOpacity>

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

  burst: {
    fontSize: 44,
    marginBottom: 4,
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
