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
import { getConceptItem, getConceptItemsForCategory, getConceptQuestion, getConceptQuestionSi } from '../../../../data/conceptData';
import { Layout } from '../../../../constants/layout';

export default function ConceptDemoScreen({ route, navigation }) {
  const { student, category, conceptKey, sessionId } = route.params;

  const concept  = getConceptItem(category.key, conceptKey);
  const allItems = getConceptItemsForCategory(category.key);
  const theme    = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const [showGreen, setShowGreen] = useState(false);

  const CARD_GAP = 12;
  const H_PAD    = Layout.spacing.md;
  const CARD_W   = ((width - H_PAD * 2 - CARD_GAP * 2) / 3) * 0.72;
  const CARD_H   = CARD_W;
  const IMG_SIZE = Math.floor(Math.min(CARD_W * 0.78, CARD_H * 0.68));

  // Correct answer always in center for demo — [distractor, correct, distractor]
  const demoOptions = (() => {
    const idx = allItems.findIndex((it) => it.key === conceptKey);
    const d1  = allItems[(idx + 1) % allItems.length];
    const d2  = allItems[(idx + 2) % allItems.length];
    return [d1, concept, d2];
  })();

  const handY        = useRef(new Animated.Value(0)).current;
  const handOpacity  = useRef(new Animated.Value(0)).current;
  const handScale    = useRef(new Animated.Value(1)).current;
  const rippleScale  = useRef(new Animated.Value(0.3)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const cardScale    = useRef(new Animated.Value(1)).current;
  const thumbsAnim   = useRef(new Animated.Value(0)).current;
  const thumbsOffset = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    const handYTarget = -(CARD_H * 0.5 + 80);

    // Hand fades in
    setTimeout(() => {
      Animated.timing(handOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 1300);

    // Hand rises up to center card
    setTimeout(() => {
      Animated.timing(handY, { toValue: handYTarget, duration: 650, useNativeDriver: true }).start();
    }, 1700);

    // Hand presses + card squishes + ripple fires
    setTimeout(() => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(handScale, { toValue: 0.70, duration: 140, useNativeDriver: true }),
          Animated.timing(handScale, { toValue: 1,    duration: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(cardScale, { toValue: 0.88, duration: 140, useNativeDriver: true }),
          Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, bounciness: 16, speed: 22 }),
        ]),
        Animated.sequence([
          Animated.timing(rippleOpacity, { toValue: 0.6, duration: 60,  useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(rippleScale,   { toValue: 1.8, duration: 480, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0,   duration: 480, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    }, 2550);

    // Card turns green, hand fades out, thumbs up appears
    setTimeout(() => {
      setShowGreen(true);
      Animated.timing(handOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      Animated.parallel([
        Animated.spring(thumbsAnim,   { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 8 }),
        Animated.spring(thumbsOffset, { toValue: 0, useNativeDriver: true, bounciness: 8,  speed: 10 }),
      ]).start();
    }, 2950);

    const t = setTimeout(() => goToMatch(), 5200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function goToMatch() {
    navigation.replace('ConceptMatch', { student, category, conceptKey, sessionId });
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
            onPress={goToMatch}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: theme.headingText }]}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Body — flex:1 so it fills remaining space and centres content */}
        <View style={styles.body}>

          <View style={styles.questionBlock}>
            <Text style={[styles.questionEn, { color: theme.headingText }]}>
              {getConceptQuestion(concept)}
            </Text>
            {concept.labelSi && (
              <Text style={[styles.questionSi, { color: theme.headingText }]}>
                {getConceptQuestionSi(concept)}
              </Text>
            )}
          </View>

          {/* Cards + animated hand */}
          <View style={styles.cardsArea}>
            <View style={[styles.optionsRow, { paddingHorizontal: H_PAD, gap: CARD_GAP }]}>
              {demoOptions.map((option) => {
                const isCorrect = option.key === conceptKey;
                return (
                  <Animated.View
                    key={option.key}
                    style={[
                      styles.optionCard,
                      {
                        width:           CARD_W,
                        height:          CARD_H,
                        backgroundColor: isCorrect && showGreen ? '#C8F0CC' : theme.cardSurface,
                        borderColor:     isCorrect && showGreen ? '#4CAF50' : theme.cardOutline,
                        transform:       isCorrect ? [{ scale: cardScale }] : [{ scale: 1 }],
                      },
                      isCorrect && showGreen && styles.optionCardCorrect,
                    ]}
                  >
                    {/* Ripple on correct card */}
                    {isCorrect && (
                      <Animated.View
                        style={[
                          styles.ripple,
                          { borderColor: theme.button, transform: [{ scale: rippleScale }], opacity: rippleOpacity },
                        ]}
                        pointerEvents="none"
                      />
                    )}
                    <View style={{ width: IMG_SIZE, height: IMG_SIZE }}>
                      <Image source={option.real} style={styles.optionImage} resizeMode="contain" />
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {/* Hand — rises from below into the center card */}
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

        </View>{/* end body */}

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
  body: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },

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
    marginBottom: 22,
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

  cardsArea: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  optionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'visible',
  },
  optionCardCorrect: {
    shadowColor: '#4CAF50',
    shadowOpacity: 0.25,
    elevation: 6,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },

  handAnchor: {
    position: 'absolute',
    bottom: -80,
    left: 0,
    right: 0,
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
