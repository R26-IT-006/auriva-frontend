import { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

// Anjalie uses Lily as placeholder for the prototype
export const ANJALIE_IMAGE = require('../../../../../assets/avatar-images/Anjali.png');

export function getAvatarImage(avatarKey) {
  return AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.Anjali;
}

// Chat bubble: animates in on mount with FadeInDown
// style prop: 'normal' | 'active' | 'independent'
export function ChatBubble({ side, text, avatarKey, active = false, independent = false, image, subLabel }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const isLeft  = side === 'left';
  const isRight = side === 'right';

  const bubbleBg = independent
    ? '#C6EFCE'
    : active
      ? '#C6EFCE'
      : isLeft
        ? '#F0F0F0'
        : '#D5E8F0';

  const bubbleBorder = (active || independent) ? '#4CAF50' : 'transparent';

  const avatarImg  = isLeft ? getAvatarImage(avatarKey) : ANJALIE_IMAGE;
  const thumbStyle = isLeft ? styles.thumbLeft : styles.thumbRight;

  return (
    <Animated.View style={[
      styles.bubbleRow,
      isLeft  ? styles.rowLeft  : styles.rowRight,
      { opacity, transform: [{ translateY }] },
    ]}>
      {isLeft && <Image source={avatarImg} style={[styles.thumb, thumbStyle]} />}

      <View style={[
        styles.bubble,
        isLeft  ? styles.bubbleLeft  : styles.bubbleRight,
        { backgroundColor: bubbleBg, borderColor: bubbleBorder, borderWidth: (active || independent) ? 1.5 : 0 },
      ]}>
        {text ? <Text style={styles.bubbleText}>{text}</Text> : null}
        {image ? (
          <Image
            source={image}
            style={styles.inlineImage}
            resizeMode="contain"
          />
        ) : null}
        {subLabel ? (
          <Text style={styles.subLabel}>{subLabel}</Text>
        ) : null}
      </View>

      {isRight && <Image source={avatarImg} style={[styles.thumb, thumbStyle]} />}
    </Animated.View>
  );
}

// Mic button with idle / listening / done states
export function MicButton({ state = 'idle', onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'listening') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [state]);

  const bg =
    state === 'listening' ? '#4CAF50' :
    state === 'done'      ? '#9E9E9E' :
    '#FF6B6B';

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        style={[styles.micBtn, { backgroundColor: bg }]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={state === 'done'}
      >
        <Ionicons
          name={state === 'listening' ? 'mic' : state === 'done' ? 'checkmark' : 'mic-outline'}
          size={36}
          color="#FFF"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Progress dots showing current turn out of 5
export function TurnProgressDots({ current, total = 5 }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < current  ? styles.dotDone :
            i === current ? styles.dotActive :
            styles.dotPending,
          ]}
        />
      ))}
    </View>
  );
}

// Pause modal (Resume / Exit)
export function PauseModal({ visible, onResume, onExit }) {
  if (!visible) return null;
  return (
    <View style={styles.pauseOverlay}>
      <View style={styles.pauseCard}>
        <Text style={styles.pauseTitle}>Paused</Text>
        <TouchableOpacity style={styles.pauseBtn} onPress={onResume}>
          <Ionicons name="play" size={20} color="#FFF" />
          <Text style={styles.pauseBtnText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pauseBtn, styles.pauseExitBtn]} onPress={onExit}>
          <Ionicons name="exit-outline" size={20} color="#333" />
          <Text style={[styles.pauseBtnText, { color: '#333' }]}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 8,
    paddingHorizontal: Layout.spacing.md,
  },
  rowLeft:  { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEE',
  },
  thumbLeft:  { marginRight: 10 },
  thumbRight: { marginLeft: 10 },

  bubble: {
    maxWidth: '78%',
    borderRadius: Layout.radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bubbleLeft:  { borderTopLeftRadius:  4 },
  bubbleRight: { borderTopRightRadius: 4 },

  bubbleText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '500',
    color: '#222',
    lineHeight: 26,
  },

  inlineImage: {
    width: 120,
    height: 120,
    marginTop: 8,
    borderRadius: Layout.radius.md,
    alignSelf: 'center',
  },

  subLabel: {
    fontSize: Layout.fontSize.md,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 8,
    fontStyle: 'italic',
  },

  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotDone:    { backgroundColor: '#4CAF50' },
  dotActive:  { backgroundColor: '#FF6B6B', width: 18, height: 18, borderRadius: 9 },
  dotPending: { backgroundColor: '#CCC' },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  pauseCard: {
    backgroundColor: '#FFF',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.xl,
    width: 260,
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  pauseTitle: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: '800',
    color: '#222',
    marginBottom: Layout.spacing.xs,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: Layout.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 28,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  pauseExitBtn: {
    backgroundColor: '#F0F0F0',
  },
  pauseBtnText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: '#FFF',
  },
});
