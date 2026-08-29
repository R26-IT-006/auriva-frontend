import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { useLockLandscape } from '../../utils/useOrientationLock';
import useGatedBack from '../../utils/useGatedBack';
import { goBackToOrigin } from '../../utils/backToOrigin';
import { fetchMasteredLetters, filterUnmasteredSequence } from '../../utils/masteredLetterFiltering';
import { getAllLetters } from '../../constants/letterCategories';

/**
 * The next letter to write — the first entry of the student's own sequence
 * that is not yet mastered.
 *
 * This is deliberately NOT `alphabet[completedCount]`, which is what this
 * screen and the backend's next_*_letter fields both did. That is only ever
 * right when the child works straight down the alphabet with no gaps, and
 * neither assumption holds: the sequence is adaptive (generateAdaptiveSequence
 * orders by motor category, not A-Z), and a letter can be left unmastered
 * while later ones are completed, so the count says nothing about WHICH letter
 * comes next. A child resuming at, say, 'c' would be told to write 'e' simply
 * because four letters happened to be done.
 *
 * Same two helpers, same order of operations, as LetterWritingScreen and
 * UppercaseWritingScreen — so the letter shown here is the letter that screen
 * will actually present.
 */
function deriveNextLetter(letterSequence, caseType, masteredPairs) {
  const forCase = Array.isArray(letterSequence)
    ? letterSequence.filter(l => l?.caseType === caseType)
    : [];
  // Same fallback the writing screens use when no adaptive sequence was
  // stored (a student assessed before sequences were saved).
  const base = forCase.length > 0 ? forCase : getAllLetters(caseType);
  return filterUnmasteredSequence(base, masteredPairs)[0]?.letter ?? null;
}

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function ProgressReportScreen({ route, navigation }) {
  // This child-facing completion/progress surface remains part of the
  // handwriting flow. Only the main teacher Progress Report is portrait.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Returns to the screen this report was OPENED FROM (route param
  // `originRoute`), not to whatever sits directly below it in the stack —
  // see utils/backToOrigin.js. Falls back to goBack() when no origin was
  // passed, so an older navigation behaves exactly as before.
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, route.params?.originRoute)
  );

  const {
    student,
    theme,
    lowercaseProgress: initLow = 0,
    uppercaseProgress: initUp  = 0,
    letterSequence = [],
  } = route.params;

  const { width } = useWindowDimensions();
  const [report, setReport] = useState(null);
  // Authoritative mastered (letter, caseType) pairs — the same backend read
  // the writing screens gate on. null until it resolves; fetchMasteredLetters
  // never throws, so a failure resolves to an empty list and the next letter
  // falls back to the first of the sequence rather than showing nothing.
  const [masteredPairs, setMasteredPairs] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const bubbleFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
      .then(res => setReport(res.data))
      .catch(() => setReport({
        lowercase_completed: initLow,
        uppercase_completed: initUp,
        reason:              'Continue regular letter practice.',
      }));
  }, [student.sid]);

  useEffect(() => {
    let cancelled = false;
    fetchMasteredLetters(student.sid).then(({ pairs }) => {
      if (!cancelled) setMasteredPairs(pairs);
    });
    return () => { cancelled = true; };
  }, [student.sid]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      bubbleFloat.setValue(0);
      return undefined;
    }

    const entranceAnimation = Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    });

    const bubbleAnimation = Animated.loop(Animated.sequence([
      Animated.timing(bubbleFloat, {
        toValue: 1,
        duration: 5200,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleFloat, {
        toValue: 0,
        duration: 5200,
        useNativeDriver: true,
      }),
    ]));

    entranceAnimation.start();
    bubbleAnimation.start();

    return () => {
      entranceAnimation.stop();
      bubbleAnimation.stop();
    };
  }, [bubbleFloat, entrance, reduceMotion]);

  const lowercase = report?.lowercase_completed ?? initLow;
  const uppercase = report?.uppercase_completed ?? initUp;
  const reason    = report?.reason              ?? 'Continue regular letter practice.';

  // Held back until the mastered read resolves — a letter derived from an
  // empty pair list would name the first of the sequence, which is wrong for
  // any child mid-way through. The counts and bars render immediately as
  // before; only this one value waits.
  const nextLetter = masteredPairs === null
    ? null
    : deriveNextLetter(letterSequence, 'lowercase', masteredPairs);
  const nextUppercaseLetter = masteredPairs === null
    ? null
    : deriveNextLetter(letterSequence, 'uppercase', masteredPairs);

  const lowercasePercent = Math.min(100, Math.round((lowercase / 26) * 100));
  const uppercasePercent = Math.min(100, Math.round((uppercase / 26) * 100));
  const lowercaseDone    = lowercase >= 26;
  const totalCompleted = lowercase + uppercase;
  const totalPercent = Math.min(100, Math.round((totalCompleted / 52) * 100));
  const nextDisplayLetter = nextLetter && !lowercaseDone
    ? nextLetter
    : (lowercaseDone && nextUppercaseLetter) || '-';
  const bubbleTranslateY = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });
  const bubbleTranslateX = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const cardOpacity = entrance.interpolate({
    inputRange: [0, 0.45],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const cardTranslateY = entrance.interpolate({
    inputRange: [0, 0.45],
    outputRange: [18, 0],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative background bubbles */}
      <Animated.View style={[styles.bgBubbleLarge, {
        backgroundColor: theme.button + '0E',
        width: width * 0.45, height: width * 0.45, borderRadius: width * 0.225,
        transform: [{ translateY: bubbleTranslateY }],
      }]} />
      <Animated.View style={[styles.bgBubbleMedium, {
        backgroundColor: theme.button + '09',
        width: width * 0.28, height: width * 0.28, borderRadius: width * 0.14,
        transform: [{ translateX: bubbleTranslateX }],
      }]} />
      <Animated.View style={[styles.bgBubbleSmall, {
        backgroundColor: theme.button + '07',
        width: width * 0.16, height: width * 0.16, borderRadius: width * 0.08,
        transform: [{ translateY: bubbleTranslateY }],
      }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.button + '18' }]}
            onPress={requestBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            Letter Progress
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Main card ── */}
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >

            {/* Student banner */}
            <View style={[styles.studentBanner, { backgroundColor: theme.button + '10' }]}>
              <View style={[styles.avatarFrame, { backgroundColor: theme.button + '14' }]}>
                <Image
                  source={AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron}
                  style={styles.bannerAvatar}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.bannerText}>
                <Text style={[styles.bannerName, { color: theme.headingText }]}>
                  {student?.full_name}
                </Text>
                <Text style={styles.bannerSub}>Handwriting progress</Text>
                <View style={styles.summaryPills}>
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillLabel}>Done</Text>
                    <Text style={[styles.summaryPillValue, { color: theme.button }]}>
                      {totalCompleted}/52
                    </Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryPillLabel}>Next</Text>
                    <Text style={[styles.summaryPillValue, { color: theme.button }]}>
                      {nextDisplayLetter}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.overallBadge, { backgroundColor: theme.button }]}>
                <Text style={[styles.overallBadgeValue, { color: theme.buttonText }]}>
                  {totalPercent}%
                </Text>
                <Text style={[styles.overallBadgeLabel, { color: theme.buttonText }]}>
                  Total
                </Text>
              </View>
            </View>

            {/* ── Lowercase section ── */}
            <View style={[styles.sectionCard, { borderColor: '#A5D6A7', backgroundColor: '#F6FBF1' }]}>

              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#E6F4D7' }]}>
                  <Ionicons name="text-outline" size={20} color="#2E7D32" />
                </View>
                <View style={styles.sectionTitleCol}>
                  <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Lowercase Letters</Text>
                  <Text style={styles.sectionSub}>{lowercase} / 26 letters completed</Text>
                </View>
                {lowercaseDone ? (
                  <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                ) : (
                  <Text style={[styles.sectionPercent, { color: '#2E7D32' }]}>{lowercasePercent}%</Text>
                )}
              </View>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${lowercasePercent}%`, backgroundColor: '#4CAF50' }]} />
              </View>

              <View style={styles.detailRow}>
                {nextLetter && !lowercaseDone && (
                  <View style={styles.nextLetterBadge}>
                    <Text style={styles.nextLetterLabel}>Next Letter</Text>
                    <Text style={[styles.nextLetterValue, { color: '#2E7D32' }]}>{nextLetter}</Text>
                  </View>
                )}
                <View style={styles.reasonRow}>
                  <Ionicons name="information-circle-outline" size={15} color="#66BB6A" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              </View>

            </View>

            {/* ── Uppercase section ── */}
            <View style={[styles.sectionCard, { borderColor: '#CE93D8', backgroundColor: '#FBF4FC' }]}>

              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#E1BEE7' }]}>
                  <Ionicons name="arrow-up-circle-outline" size={20} color="#7B1FA2" />
                </View>
                <View style={styles.sectionTitleCol}>
                  <Text style={[styles.sectionTitle, { color: '#7B1FA2' }]}>
                    Uppercase Letters
                  </Text>
                  <Text style={styles.sectionSub}>
                    {uppercase} / 26 letters completed
                  </Text>
                </View>
                <Text style={[styles.sectionPercent, { color: '#7B1FA2' }]}>
                  {uppercasePercent}%
                </Text>
              </View>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${uppercasePercent}%`, backgroundColor: '#AB47BC' }]} />
              </View>

              {/* Same badge as the lowercase section. nextUppercaseLetter is
                  null once every uppercase letter is mastered, so this hides
                  itself without needing a separate "done" condition. */}
              {nextUppercaseLetter && (
                <View style={styles.detailRow}>
                  <View style={styles.nextLetterBadge}>
                    <Text style={styles.nextLetterLabel}>Next Letter</Text>
                    <Text style={[styles.nextLetterValue, { color: '#7B1FA2' }]}>
                      {nextUppercaseLetter}
                    </Text>
                  </View>
                </View>
              )}

            </View>

          </Animated.View>
        </View>

      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // Decorative background bubbles
  bgBubbleLarge: {
    position: 'absolute',
    top: '-6%',
    right: '-14%',
  },
  bgBubbleMedium: {
    position: 'absolute',
    bottom: '4%',
    left: '-10%',
  },
  bgBubbleSmall: {
    position: 'absolute',
    top: '42%',
    right: '-5%',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 30,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 5,
  },

  // Student banner
  studentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 14,
  },
  avatarFrame: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerAvatar: {
    width: 68,
    height: 68,
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
  },
  bannerSub: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  summaryPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  summaryPill: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 72,
  },
  summaryPillLabel: {
    fontSize: 10,
    color: '#7B8190',
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryPillValue: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    marginTop: 1,
  },
  overallBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 0,
  },
  overallBadgeValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    lineHeight: 24,
  },
  overallBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.5,
  },

  // Section cards
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitleCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
  sectionSub: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  sectionPercent: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    flexShrink: 0,
  },

  // Progress bar
  barTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },

  // Detail row (next letter + reason)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nextLetterBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  nextLetterLabel: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  nextLetterValue: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    lineHeight: 34,
  },
  reasonRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
  },
});
