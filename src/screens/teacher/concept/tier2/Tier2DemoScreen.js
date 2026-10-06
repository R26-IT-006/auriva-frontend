import { useState, useRef, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import {
  getConceptItem,
  getConceptItemsForCategory,
  NAMING_QUESTION_EN,
  NAMING_QUESTION_SI,
} from '../../../../data/conceptData';
import { Layout } from '../../../../constants/layout';
import HeaderPillButton from '../../../../components/common/HeaderPillButton';
import { rs, rf } from '../../../../utils/responsive';

// The same celebration the real rounds play, so the demo rehearses exactly what
// the child will see when they answer correctly.
const CORRECT_GIF = require('../../../../../assets/feedback/correct.gif');

// Mirrors ConceptDemoScreen (tier 1), but demonstrates the tier 2 task: the child
// picks the correct *name* for the picture rather than the correct picture.
export default function Tier2DemoScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept  = getConceptItem(category.key, conceptKey);
  const allItems = getConceptItemsForCategory(category.key);
  const theme    = getAvatarTheme(student?.avatar_key);

  const { width, height } = useWindowDimensions();
  const imgSize = Math.min(width, height) * 0.54;

  const [showGreen, setShowGreen] = useState(false);

  // Correct answer sits in the middle so the hand always travels to centre.
  // Filtering by key first avoids the duplicate-key crash when a category has
  // fewer than three items.
  const demoOptions = (() => {
    const others = allItems.filter((it) => it.key !== conceptKey);
    return [others[0], concept, others[1]].filter(Boolean);
  })();

  const handY         = useRef(new Animated.Value(150)).current;
  const handOpacity   = useRef(new Animated.Value(0)).current;
  const handScale     = useRef(new Animated.Value(1)).current;
  const rippleScale   = useRef(new Animated.Value(0.3)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const pillScale     = useRef(new Animated.Value(1)).current;
  const thumbsAnim    = useRef(new Animated.Value(0)).current;
  const thumbsOffset  = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    // Every timer is tracked so leaving mid-demo can't fire an animation or a
    // navigation on an unmounted screen.
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));

    at(1300, () => {
      Animated.timing(handOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    at(1700, () => {
      Animated.timing(handY, { toValue: 0, duration: 650, useNativeDriver: true }).start();
    });

    at(2550, () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(handScale, { toValue: 0.70, duration: 140, useNativeDriver: true }),
          Animated.timing(handScale, { toValue: 1,    duration: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pillScale, { toValue: 0.90, duration: 140, useNativeDriver: true }),
          Animated.spring(pillScale, { toValue: 1, useNativeDriver: true, bounciness: 16, speed: 22 }),
        ]),
        Animated.sequence([
          Animated.timing(rippleOpacity, { toValue: 0.6, duration: 60, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(rippleScale,   { toValue: 1.8, duration: 480, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0,   duration: 480, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });

    at(2950, () => {
      setShowGreen(true);
      Animated.timing(handOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      Animated.parallel([
        Animated.spring(thumbsAnim,   { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 8 }),
        Animated.spring(thumbsOffset, { toValue: 0, useNativeDriver: true, bounciness: 8,  speed: 10 }),
      ]).start();
    });

    at(5200, goToActivity);

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function goToActivity() {
    navigation.replace('Tier2Activity', { student, category, conceptKey, sessionId });
  }

  if (!concept) return null;

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
          <View style={{ width: 60 }} />

          <View style={[styles.watchBanner, { backgroundColor: theme.button + '22', borderColor: theme.cardOutline }]}>
            <Text style={styles.watchEmoji}>👀</Text>
            <Text style={[styles.watchText, { color: theme.headingText }]}>Watch first!</Text>
          </View>

          {/* Shared header pill (HeaderPillButton), subtle variant. */}
          <HeaderPillButton
            variant="subtle"
            icon="play-skip-forward"
            label="Skip"
            accessibilityLabel="Skip the demo"
            theme={theme}
            onPress={goToActivity}
          />
        </View>

        {/* Bilingual question — same wording the real activity asks */}
        <View style={styles.questionBlock}>
          <Text style={[styles.questionEn, { color: theme.headingText }]}>
            {NAMING_QUESTION_EN}
          </Text>
          {concept.labelSi && (
            <Text style={[styles.questionSi, { color: theme.headingText }]}>
              {NAMING_QUESTION_SI}
            </Text>
          )}
        </View>

        {/* Image left, name options right — matches Tier2ActivityScreen's layout */}
        <View style={styles.contentRow}>

          <View style={styles.imageContainer}>
            <Image source={concept.real} style={{ width: imgSize, height: imgSize }} resizeMode="contain" />
          </View>

          <View style={styles.labelsContainer}>
            {demoOptions.map((option) => {
              const isCorrect = option.key === conceptKey;
              return (
                <Animated.View
                  key={option.key}
                  style={[
                    styles.labelPill,
                    {
                      backgroundColor: isCorrect && showGreen ? '#C8F0CC' : '#FFFFFF',
                      borderColor:     isCorrect && showGreen ? '#4CAF50' : theme.cardOutline,
                      transform:       isCorrect ? [{ scale: pillScale }] : [{ scale: 1 }],
                    },
                  ]}
                >
                  {isCorrect && (
                    <Animated.View
                      style={[
                        styles.ripple,
                        { borderColor: theme.button, transform: [{ scale: rippleScale }], opacity: rippleOpacity },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  <Text
                    style={[
                      styles.labelText,
                      { color: isCorrect && showGreen ? '#2E7D32' : theme.headingText },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Animated.View>
              );
            })}

            {/* Hand rises from below onto the middle pill */}
            <View style={styles.handAnchor} pointerEvents="none">
              <Animated.View
                style={{
                  opacity:   handOpacity,
                  transform: [{ translateY: handY }, { scale: handScale }],
                }}
              >
                <Ionicons name="hand-left" size={58} color={theme.button} />
              </Animated.View>
            </View>
          </View>

        </View>

        {/* Correct-answer celebration */}
        <Animated.View
          style={[
            styles.feedbackGif,
            {
              opacity:   thumbsAnim,
              transform: [{ translateY: thumbsOffset }],
            },
          ]}
          pointerEvents="none"
        >
          <ExpoImage source={CORRECT_GIF} style={styles.feedbackGifImage} contentFit="contain" />
        </Animated.View>

      </SafeAreaView>
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
  watchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    paddingHorizontal: rs(16),
    paddingVertical: rs(7),
    borderRadius: rs(20),
    borderWidth: 1.5,
  },
  watchEmoji: { fontSize: rf(15) },
  watchText: {
    fontSize: rf(14),
    fontFamily: 'DMSans_700Bold',
  },

  questionBlock: {
    alignItems: 'center',
    marginTop: rs(6),
    paddingHorizontal: Layout.spacing.lg,
    gap: rs(4),
  },
  questionEn: {
    fontSize: rf(28),
    fontFamily: 'DMSans_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  questionSi: {
    fontSize: rf(20),
    fontFamily: 'DMSans_700Bold',
    opacity: 0.65,
    textAlign: 'center',
  },

  contentRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: rs(16),
    paddingVertical: rs(20),
    paddingBottom: rs(130),
  },
  imageContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: rs(130),
  },
  labelsContainer: {
    width: rs(320),
    justifyContent: 'center',
    gap: rs(24),
    marginRight: rs(60),
  },
  labelPill: {
    paddingHorizontal: rs(28),
    paddingVertical: rs(20),
    borderRadius: rs(28),
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(5) },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  labelText: {
    fontSize: rf(27),
    fontFamily: 'DMSans_900Black',
    letterSpacing: 0.2,
  },
  ripple: {
    position: 'absolute',
    width: rs(80),
    height: rs(80),
    borderRadius: rs(40),
    borderWidth: 3,
  },

  // Centred on the middle pill; the hand animates up from +150 to rest here.
  handAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: rs(-20),
    alignItems: 'center',
  },

  // Matches the popup the real round uses, so the celebration lands in the same
  // place and at the same size the child will see it during play.
  feedbackGif: {
    position: 'absolute',
    bottom: rs(20),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  feedbackGifImage: {
    width: rs(200),
    height: rs(200),
  },
});
