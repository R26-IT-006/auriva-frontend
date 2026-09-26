import React, { useEffect, useRef, useState } from 'react';
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
import { useLockLandscape } from '../../../utils/useOrientationLock';
import useGatedBack from '../../../utils/useGatedBack';
import { ASSESSMENT_FLOW_ROUTES, returnToAssessmentFlowRoute } from '../../../utils/moduleSelectionBack';
import ScreenBackButton from '../../../components/handwriting/ScreenBackButton';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: 'pencil-outline',
    title: 'Comfortable grip',
    desc: 'Let the child use a stylus or finger.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Trace each shape',
    desc: 'Ask the child to follow the shape on screen.',
  },
  {
    icon: 'hand-left-outline',
    title: 'Let the child lead',
    desc: 'Only guide their hand if they need help starting.',
  },
  {
    icon: 'time-outline',
    title: 'Take your time',
    desc: 'Let the child draw without rushing.',
  },
  {
    icon: 'desktop-outline',
    title: 'Recording is automatic',
    desc: 'The app records movement, speed, pauses, and stroke steadiness.',
  },
];

const AVATAR_MAP = {
  boba:     require('../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

// ─────────────────────────────────────────────────────────────────────────────

export default function InstructionScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const { student, theme } = route.params;
  const returnToPressAndDrag = () => returnToAssessmentFlowRoute(
    navigation,
    ASSESSMENT_FLOW_ROUTES.PRESS_AND_DRAG,
    { student, theme },
  );
  const { requestBack, gateModal } = useGatedBack(returnToPressAndDrag);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const avatar = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron;
  const [reduceMotion, setReduceMotion] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const bubbleFloat = useRef(new Animated.Value(0)).current;

  // Responsive sizing helpers
  const cardPad   = Math.min(width * 0.035, 34);
  const avatarH   = height * 0.32;

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
        duration: 4200,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleFloat, {
        toValue: 0,
        duration: 4200,
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

  const headerOpacity = entrance.interpolate({
    inputRange: [0, 0.35],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const headerTranslateY = entrance.interpolate({
    inputRange: [0, 0.35],
    outputRange: [14, 0],
    extrapolate: 'clamp',
  });
  const actionOpacity = entrance.interpolate({
    inputRange: [0.55, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const actionTranslateY = entrance.interpolate({
    inputRange: [0.55, 1],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });
  const bubbleTranslateY = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });
  const bubbleTranslateX = bubbleFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* ── Decorative background bubbles (same style as StudentWelcomeScreen) ── */}
      <Animated.View style={[styles.bgBubbleLarge, {
        backgroundColor: theme.button + '12',
        width: width * 0.42, height: width * 0.42, borderRadius: width * 0.21,
        transform: [{ translateY: bubbleTranslateY }],
      }]} />
      <Animated.View style={[styles.bgBubbleMedium, {
        backgroundColor: theme.button + '0D',
        width: width * 0.26, height: width * 0.26, borderRadius: width * 0.13,
        transform: [{ translateX: bubbleTranslateX }],
      }]} />
      <Animated.View style={[styles.bgBubbleSmall, {
        backgroundColor: theme.button + '09',
        width: width * 0.15, height: width * 0.15, borderRadius: width * 0.075,
        transform: [{ translateY: bubbleTranslateY }],
      }]} />

      <SafeAreaView style={styles.safe}>
        <ScreenBackButton
          onPress={requestBack}
          gated
          tint={theme.button}
          color={theme.button}
          accessibilityLabel="Back"
          style={styles.flowBackButton}
        />

        <View style={[styles.root, isLandscape && styles.rootLandscape]}>

          {/* ══ Main content column ══════════════════════════════════════════ */}
          <View style={[styles.contentCol, { padding: cardPad }]}>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: headerOpacity,
                  transform: [{ translateY: headerTranslateY }],
                },
              ]}
            >
              <View style={[styles.teacherBadge, { backgroundColor: theme.button + '22', borderColor: theme.button }]}>
                <Ionicons name="person-outline" size={13} color={theme.button} />
                <Text style={[styles.teacherBadgeText, { color: theme.button }]}>FOR TEACHER</Text>
              </View>

              <Text style={[styles.title, { color: theme.headingText }]}>
                Before the child starts
              </Text>
              <Text style={[styles.subtitle, { color: theme.button }]}>
                Initial Motor Assessment
              </Text>
              <Text style={styles.intro}>
                Help {student?.full_name ?? 'the child'} get comfortable, then follow these five steps.
              </Text>
            </Animated.View>

            {/* ── Steps ──────────────────────────────────────────────────── */}
            <View
              style={[
                styles.stepsContainer,
                { backgroundColor: theme.button + '0B' },
              ]}
            >
              {STEPS.map((step, index) => (
                <StepCard
                  key={index}
                  step={step}
                  index={index}
                  theme={theme}
                  progress={entrance}
                />
              ))}
            </View>

            {/* ── Action buttons ─────────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.actionRow,
                {
                  opacity: actionOpacity,
                  transform: [{ translateY: actionTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.beginBtn, { backgroundColor: theme.button }]}
                onPress={() => navigation.navigate('StudentWelcome', { student, theme })}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={18} color={theme.buttonText} />
                <Text style={[styles.beginBtnText, { color: theme.buttonText }]}>
                  Begin Assessment
                </Text>
              </TouchableOpacity>
            </Animated.View>

          </View>

          {/* ══ Avatar column (landscape: side, portrait: hidden or shown bottom-right) ══ */}
          {isLandscape ? (
            <Animated.View
              style={[
                styles.avatarCol,
                {
                  opacity: actionOpacity,
                  transform: [{ translateY: actionTranslateY }],
                },
              ]}
            >
              <Image
                source={avatar}
                style={[styles.avatarLandscape, { height: avatarH }]}
                resizeMode="contain"
              />
              <View style={[styles.speechBubble, { borderColor: theme.button + '33' }]}>
                <Text style={styles.speechText}>
                  Every small step is progress toward{'\n'}something great.
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.Image
              source={avatar}
              style={[
                styles.avatarPortrait,
                {
                  opacity: actionOpacity,
                  transform: [{ translateY: actionTranslateY }],
                },
              ]}
              resizeMode="contain"
              pointerEvents="none"
            />
          )}

        </View>
        {gateModal}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Step card component ──────────────────────────────────────────────────────

function StepCard({ step, index, theme, progress }) {
  const start = 0.16 + index * 0.08;
  const end = Math.min(start + 0.26, 1);
  const opacity = progress.interpolate({
    inputRange: [start, end],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const translateY = progress.interpolate({
    inputRange: [start, end],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.stepCard,
        {
          borderLeftColor: theme.button,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Number circle + icon */}
      <View style={[styles.stepCircle, { backgroundColor: theme.button + '18' }]}>
        <Text style={[styles.stepNumber, { color: theme.button }]}>{index + 1}</Text>
      </View>

      {/* Text block */}
      <View style={styles.stepBody}>
        <View style={styles.stepTitleRow}>
          <Ionicons name={step.icon} size={20} color={theme.button} />
          <Text style={[styles.stepTitle, { color: theme.headingText }]}>{step.title}</Text>
        </View>
        <Text style={styles.stepDesc}>{step.desc}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },
  flowBackButton: {
    position: 'absolute',
    top: 16,
    left: 22,
    zIndex: 10,
  },

  // Decorative background bubbles
  bgBubbleLarge: {
    position: 'absolute',
    top: '-8%',
    right: '-10%',
  },
  bgBubbleMedium: {
    position: 'absolute',
    bottom: '6%',
    left: '-8%',
  },
  bgBubbleSmall: {
    position: 'absolute',
    top: '48%',
    right: '-4%',
  },

  // Root layout switches between portrait (column) and landscape (row)
  root: {
    flex: 1,
  },
  rootLandscape: {
    flexDirection: 'row',
  },

  // ── Content column ────────────────────────────────────────────────────────
  contentCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    marginBottom: 4,
  },

  teacherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    marginBottom: '2%',
  },
  teacherBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.8,
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    lineHeight: 36,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  intro: {
    fontSize: 16,
    color: '#555555',
    lineHeight: 23,
  },

  // ── Steps ─────────────────────────────────────────────────────────────────
  stepsContainer: {
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: 24,
    padding: 10,
    gap: 10,
  },

  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 12,
  },

  stepCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
  },

  stepBody: {
    flex: 1,
    gap: 4,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    flexShrink: 1,
  },
  stepDesc: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  // ── Action buttons ────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 10,
  },
  beginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  beginBtnText: {
    fontSize: 19,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.2,
  },
  // ── Avatar — landscape (side column) ─────────────────────────────────────
  avatarCol: {
    width: '36%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: '4%',
    paddingRight: '2%',
    gap: 12,
  },
  avatarLandscape: {
    width: '100%',
    flex: 1,
    resizeMode: 'contain',
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  speechText: {
    fontSize: 17,
    color: '#333333',
    fontWeight: '500',
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 25,
    textAlign: 'center',
  },

  // ── Avatar — portrait (bottom-right overlay) ──────────────────────────────
  avatarPortrait: {
    position: 'absolute',
    bottom: 80,
    right: 12,
    width: '18%',
    height: '20%',
    opacity: 0.85,
  },
});
