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
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import {
  getConceptItem,
  getConceptItemsForCategory,
  NAMING_QUESTION_EN,
  NAMING_QUESTION_SI,
} from '../../../../data/conceptData';
import { Layout } from '../../../../constants/layout';

// Mirrors ConceptDemoScreen (tier 1), but demonstrates the tier 2 task: the child
// picks the correct *name* for the picture rather than the correct picture.
export default function Tier2DemoScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept  = getConceptItem(category.key, conceptKey);
  const allItems = getConceptItemsForCategory(category.key);
  const theme    = getAvatarTheme(student?.avatar_key);

  const { width, height } = useWindowDimensions();
  const imgSize = Math.min(width, height) * 0.42;

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

          <TouchableOpacity
            style={[styles.skipBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={goToActivity}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: theme.headingText }]}>Skip</Text>
          </TouchableOpacity>
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

        {/* Thumbs-up feedback bubble */}
        <Animated.View
          style={[
            styles.feedbackBubble,
            {
              opacity:         thumbsAnim,
              transform:       [{ translateY: thumbsOffset }],
              backgroundColor: '#4CAF50',
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.feedbackEmoji}>👍</Text>
          <Text style={styles.feedbackText}>That's it!</Text>
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
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  watchEmoji: { fontSize: 15 },
  watchText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.7,
  },

  questionBlock: {
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: Layout.spacing.lg,
    gap: 4,
  },
  questionEn: {
    fontSize: 26,
    fontFamily: 'Nunito_900Black',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  questionSi: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    opacity: 0.65,
    textAlign: 'center',
  },

  contentRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 130,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 130,
  },
  labelsContainer: {
    width: 320,
    justifyContent: 'center',
    gap: 24,
    marginRight: 60,
  },
  labelPill: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  labelText: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 0.2,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },

  // Centred on the middle pill; the hand animates up from +150 to rest here.
  handAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -20,
    alignItems: 'center',
  },

  feedbackBubble: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  feedbackEmoji: { fontSize: 26 },
  feedbackText: {
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFF',
  },
});
