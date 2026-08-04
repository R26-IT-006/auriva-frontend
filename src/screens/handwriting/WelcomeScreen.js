import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  Animated,
  AccessibilityInfo,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import {
  generateCollectionSessionId, getDeviceMetadata, PROTOCOL_VERSION,
} from '../../utils/collectionSession';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function WelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { width, height } = useWindowDimensions();
  const mascot = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron;

  const themeColor  = theme?.button     ?? '#312E81';
  const textOnBtn   = theme?.buttonText ?? '#FFFFFF';

  const panelW = width * 0.55;
  const bubbleSize = panelW * 0.62;
  const mediumBubbleSize = panelW * 0.38;
  const smallBubbleSize = panelW * 0.22;

  const [reduceMotion, setReduceMotion] = useState(false);
  const floatLarge = useRef(new Animated.Value(0)).current;
  const floatMedium = useRef(new Animated.Value(0)).current;
  const floatSmall = useRef(new Animated.Value(0)).current;
  const buttonEntrance = useRef(new Animated.Value(-36)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const sliderX = useRef(new Animated.Value(0)).current;
  const sliderPosition = useRef(0);
  const knobScale = useRef(new Animated.Value(1)).current;
  const knobPulse = useRef(new Animated.Value(0)).current;
  const chevronPulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      floatLarge.setValue(0);
      floatMedium.setValue(0);
      floatSmall.setValue(0);
      buttonEntrance.setValue(0);
      buttonOpacity.setValue(1);
      knobPulse.setValue(0);
      chevronPulse.setValue(0);
      shine.setValue(0);
      return undefined;
    }

    const floating = Animated.parallel([
      Animated.loop(Animated.sequence([
        Animated.timing(floatLarge, { toValue: -10, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatLarge, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(floatMedium, { toValue: 12, duration: 3400, useNativeDriver: true }),
        Animated.timing(floatMedium, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(floatSmall, { toValue: -8, duration: 2300, useNativeDriver: true }),
        Animated.timing(floatSmall, { toValue: 0, duration: 2300, useNativeDriver: true }),
      ])),
    ]);

    const entrance = Animated.parallel([
      Animated.spring(buttonEntrance, {
        toValue: 0,
        speed: 12,
        bounciness: 5,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    const shineLoop = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(shine, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(shine, { toValue: 0, duration: 1, useNativeDriver: true }),
      Animated.delay(1400),
    ]));

    const knobPulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(knobPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(knobPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      Animated.delay(550),
    ]));

    const chevronPulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(chevronPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(chevronPulse, { toValue: 0, duration: 850, useNativeDriver: true }),
    ]));

    floating.start();
    entrance.start();
    shineLoop.start();
    knobPulseLoop.start();
    chevronPulseLoop.start();
    return () => {
      floating.stop();
      entrance.stop();
      shineLoop.stop();
      knobPulseLoop.stop();
      chevronPulseLoop.stop();
    };
  }, [
    buttonEntrance,
    buttonOpacity,
    floatLarge,
    floatMedium,
    floatSmall,
    chevronPulse,
    knobPulse,
    reduceMotion,
    shine,
  ]);

  const shineX = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 360],
  });

  const maxSlide = Math.max(0, trackWidth - 66);
  const knobPulseScale = knobPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });
  const knobPulseOpacity = knobPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0],
  });
  const chevronTranslate = chevronPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });
  const sliderTextOpacity = sliderX.interpolate({
    inputRange: [0, Math.max(1, maxSlide * 0.7)],
    outputRange: [1, 0.28],
    extrapolate: 'clamp',
  });

  const sliderPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      knobPulse.setValue(0);
      if (!reduceMotion) {
        Animated.spring(knobScale, {
          toValue: 1.12,
          speed: 28,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderMove: (_, gestureState) => {
      const next = Math.max(0, Math.min(maxSlide, gestureState.dx));
      sliderPosition.current = next;
      sliderX.setValue(next);
    },
    onPanResponderRelease: () => {
      const completed = maxSlide > 0 && sliderPosition.current >= maxSlide * 0.78;
      if (completed) {
        Animated.parallel([
          Animated.timing(sliderX, {
            toValue: maxSlide,
            duration: reduceMotion ? 1 : 180,
            useNativeDriver: true,
          }),
          Animated.spring(knobScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start(() => {
          sliderPosition.current = 0;
          sliderX.setValue(0);
          navigation.navigate('Instructions', { student, theme });
        });
      } else {
        sliderPosition.current = 0;
        Animated.parallel([
          Animated.spring(sliderX, {
            toValue: 0,
            speed: 20,
            bounciness: 7,
            useNativeDriver: true,
          }),
          Animated.spring(knobScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    onPanResponderTerminate: () => {
      sliderPosition.current = 0;
      Animated.spring(sliderX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      Animated.spring(knobScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    },
  }), [
    knobScale,
    maxSlide,
    navigation,
    reduceMotion,
    sliderX,
    student,
    theme,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <View style={styles.left}>

          {/* ── Decorative bubbles (theme-tinted, matching StudentWelcomeScreen) */}
          <Animated.View style={[styles.bubbleLarge, {
            backgroundColor: themeColor + '14',
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: bubbleSize / 2,
            transform: [{ translateY: floatLarge }],
          }]} />
          <Animated.View style={[styles.bubbleMedium, {
            backgroundColor: themeColor + '0E',
            width: mediumBubbleSize,
            height: mediumBubbleSize,
            borderRadius: mediumBubbleSize / 2,
            transform: [{ translateY: floatMedium }],
          }]} />
          <Animated.View style={[styles.bubbleSmall, {
            backgroundColor: themeColor + '09',
            width: smallBubbleSize,
            height: smallBubbleSize,
            borderRadius: smallBubbleSize / 2,
            transform: [{ translateY: floatSmall }],
          }]} />

          {/* Brand block — no logo, large name fills the space */}
          <View style={styles.brandBlock}>
            <Text style={[styles.eyebrow, { color: themeColor }]}>LETTER WRITING</Text>
            <Text style={[styles.appName, { color: themeColor }]}>Auriva</Text>
            <Text style={[styles.headline, { color: theme?.headingText ?? '#202124' }]}>
              Let&apos;s write together
            </Text>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Practice letters one step at a time.
          </Text>

          {/* Start button */}
          <Animated.View
            style={[
              styles.sliderWrap,
              {
                shadowColor: themeColor,
                opacity: buttonOpacity,
                transform: [{ translateX: buttonEntrance }],
              },
            ]}
          >
            <View
              style={[
                styles.sliderTrack,
                {
                  backgroundColor: themeColor + '20',
                  borderColor: themeColor + '55',
                },
              ]}
              onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Slide right to start letter writing"
              accessibilityHint="Swipe the circular handle from left to right"
              onAccessibilityTap={() => navigation.navigate('Instructions', { student, theme })}
            >
              {!reduceMotion && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.buttonShine,
                    { transform: [{ translateX: shineX }, { rotate: '18deg' }] },
                  ]}
                />
              )}
              <View style={[styles.startZone, { borderColor: themeColor + '26' }]} pointerEvents="none" />
              <Animated.Text style={[styles.sliderText, { color: themeColor, opacity: sliderTextOpacity }]}>
                Press and drag right
              </Animated.Text>
              <Animated.View
                style={[
                  styles.sliderChevrons,
                  { transform: [{ translateX: chevronTranslate }] },
                ]}
                pointerEvents="none"
              >
                <Ionicons name="chevron-forward" size={17} color={themeColor + '70'} />
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={themeColor + 'A0'}
                  style={{ marginLeft: -7 }}
                />
              </Animated.View>
              <Animated.View
                {...sliderPanResponder.panHandlers}
                style={[
                  styles.sliderKnob,
                  {
                    backgroundColor: themeColor,
                    transform: [
                      { translateX: sliderX },
                      { scale: knobScale },
                    ],
                  },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.knobPulse,
                    {
                      borderColor: themeColor,
                      opacity: knobPulseOpacity,
                      transform: [{ scale: knobPulseScale }],
                    },
                  ]}
                />
                <Ionicons name="arrow-forward" size={26} color={textOnBtn} />
              </Animated.View>
            </View>
          </Animated.View>

          {/* ── Data Collection (research protocol) — secondary action ── */}
          <TouchableOpacity
            style={[styles.dataCollectionBtn, { borderColor: themeColor + '80' }]}
            onPress={() => {
              const collectionSessionId = generateCollectionSessionId();
              // Best-effort — a failed "start" ping never blocks the teacher
              // from running the protocol (matches the non-fatal-save
              // convention used throughout the backend controller).
              client.post(ENDPOINTS.COLLECTION_SESSION_START, {
                id:               collectionSessionId,
                student_id:       student.sid,
                protocol_version: PROTOCOL_VERSION,
                ...getDeviceMetadata(),
              }).catch(err => console.warn('Collection session start failed (non-fatal):', err?.message));

              navigation.navigate('ShapeAssessment', {
                student, theme, collectionMode: true, collectionSessionId,
              });
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="flask-outline" size={14} color={themeColor} />
            <Text style={[styles.dataCollectionText, { color: themeColor }]}>
              Data Collection
            </Text>
          </TouchableOpacity>

        </View>

        {/* ── Right panel — unchanged ─────────────────────────────────────── */}
        <View style={styles.right}>

          <Image
            source={mascot}
            style={[styles.mascot, { height: height * 0.72 }]}
            resizeMode="contain"
          />

          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Ready to write?</Text>
          </View>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E8EEF8' },
  root: { flex: 1, flexDirection: 'row' },

  // ── Left panel ──────────────────────────────────────────────────────────────
  left: {
    flex: 1.1,
    backgroundColor: '#E8EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 24,
    overflow: 'hidden',   // clips decorative bubbles at the panel edge
  },

  // Decorative bubbles — same pattern as StudentWelcomeScreen
  bubbleLarge: {
    position: 'absolute',
    top: '-8%',
    right: '-18%',
  },
  bubbleMedium: {
    position: 'absolute',
    bottom: '4%',
    left: '-12%',
  },
  bubbleSmall: {
    position: 'absolute',
    top: '44%',
    left: '-6%',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 7,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  appName: {
    fontSize: 60,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },

  tagline: {
    fontSize: 17,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: '500',
  },

  sliderWrap: {
    width: '78%',
    maxWidth: 330,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  sliderTrack: {
    width: '100%',
    height: 66,
    borderWidth: 1.5,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  startZone: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  buttonShine: {
    position: 'absolute',
    top: -18,
    bottom: -18,
    width: 52,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  sliderText: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sliderChevrons: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderKnob: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 7,
  },
  knobPulse: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },

  // ── Right panel — pixel-identical to original ────────────────────────────────
  right: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderBottomLeftRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  mascot: { width: '92%' },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  bubbleText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },

  dataCollectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dataCollectionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
