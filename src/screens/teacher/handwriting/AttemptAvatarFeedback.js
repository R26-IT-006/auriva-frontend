import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LETTER_SCREEN_H } from '../../../constants/letterCanvasLayout';

const AVATAR_MAP = {
  boba: require('../../../../assets/avatar-images/Boba.png'),
  glitter: require('../../../../assets/avatar-images/Glitter.png'),
  lily: require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

// Letter/word-writing feedback follows the support presentation just shown.
// Pre-writing has no support-level concept, so callers without supportLevel
// use the separate short motor-warm-up messages below.
const PASS_MESSAGES_BY_SUPPORT = {
  high:   'Great tracing!',
  medium: 'Nice work!',
  low:    'Great writing!',
};

const RETRY_MESSAGES_BY_SUPPORT = {
  high:   'Try again!',
  medium: 'Follow the guide!',
  low:    'Try once more!',
};

// Motor warm-up feedback for callers without a support level.
const PASS_MESSAGES_BY_ATTEMPT = {
  1: 'Great job!',
  2: 'Great job!',
  3: 'Great job!',
};

const RETRY_MESSAGES_BY_ATTEMPT = {
  1: 'Try again!',
  2: 'Try again!',
  3: 'Try again!',
};

// `side` (optional, {width}) — instead of the bottom-right corner, show the
// feedback in a strip of that width on the RIGHT edge: bubble stacked above
// the avatar, sliding in from the side. For a screen whose content card
// leaves free space beside it (word practice), so the feedback never covers
// the card. Unset, the corner layout below is exactly as before.
export default function AttemptAvatarFeedback({ avatarKey, passed, attempt, supportLevel, theme, note, side = null }) {
  const key = String(avatarKey ?? '').toLowerCase();
  const avatar = AVATAR_MAP[key] ?? AVATAR_MAP.megatron;
  const color = passed ? '#2E7D32' : '#8A5A00';
  // White bubble (and thought dots) for both outcomes; pass vs retry still
  // reads from the text colour above and the outline.
  const backgroundColor = '#FFFFFF';
  const passMessages  = supportLevel != null ? PASS_MESSAGES_BY_SUPPORT  : PASS_MESSAGES_BY_ATTEMPT;
  const retryMessages = supportLevel != null ? RETRY_MESSAGES_BY_SUPPORT : RETRY_MESSAGES_BY_ATTEMPT;
  const lookupKey = supportLevel != null ? supportLevel : attempt;
  const generic = passed
    ? passMessages[lookupKey] ?? 'Nice work!'
    : retryMessages[lookupKey] ?? 'Try again!';
  // `note` is the one actionable thing the layout check found — "Leave a
  // little space", "Keep letters the same size". When there is one it REPLACES
  // the generic encouragement rather than sitting beside it: the child used to
  // get this in a separate pill under the canvas at the same moment as the
  // avatar said "Good try", which is two things to read at once. One avatar,
  // one sentence.
  const message = note || generic;

  // Side strip: slide in from just past the right edge. The component mounts
  // when the feedback appears, so this runs once per verdict.
  const slideX = useRef(new Animated.Value(side ? side.width + 40 : 0)).current;
  useEffect(() => {
    if (!side) return;
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 70 }).start();
  }, [side, slideX]);

  if (side) {
    const stripW = side.width;
    const avatarSize = Math.round(stripW * 0.72);
    return (
      <Animated.View
        style={[styles.sideOverlay, { width: stripW, transform: [{ translateX: slideX }] }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
        pointerEvents="none"
      >
        <View style={[styles.sideCloud, { width: stripW - 12 }]}>
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 240 100"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
          >
            <Path
              d="M45 88 C24 88 10 77 13 60 C15 46 27 36 43 35 C49 17 65 8 82 13 C94 1 116 2 129 17 C146 7 168 14 176 32 C198 30 222 43 224 61 C226 78 209 89 188 89 Z"
              fill={backgroundColor}
              stroke={theme?.button ? `${theme.button}70` : color}
              strokeWidth={3}
            />
          </Svg>
          <View style={styles.sideMessageRow}>
            <Text style={[styles.message, { color }]}>{message}</Text>
          </View>
        </View>
        <View style={[styles.sideDotLarge, { backgroundColor, borderColor: color }]} />
        <View style={[styles.sideDotSmall, { backgroundColor, borderColor: color }]} />
        <Image source={avatar} style={{ width: avatarSize, height: avatarSize }} resizeMode="contain" />
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.overlay,
      ]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      pointerEvents="none"
    >
      <View style={styles.cloudWrap}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 240 100"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Path
            d="M45 88 C24 88 10 77 13 60 C15 46 27 36 43 35 C49 17 65 8 82 13 C94 1 116 2 129 17 C146 7 168 14 176 32 C198 30 222 43 224 61 C226 78 209 89 188 89 Z"
            fill={backgroundColor}
            stroke={theme?.button ? `${theme.button}70` : color}
            strokeWidth={3}
          />
        </Svg>
        <View style={styles.messageRow}>
          <Text style={[styles.message, { color }]}>{message}</Text>
        </View>
      </View>
      <View style={[styles.thoughtDotLarge, { backgroundColor, borderColor: color }]} />
      <View style={[styles.thoughtDotSmall, { backgroundColor, borderColor: color }]} />
      <Image source={avatar} style={styles.avatar} resizeMode="contain" />
    </View>
  );
}

// ── Size: fits in the strip below the canvas ───────────────────────────────
// The canvas is half the screen's height and vertically centred, which leaves
// a strip of roughly 20% of the screen beneath it (the Clear / Next row sits
// in the middle of that strip; this sits in its right-hand corner). Every
// size below derives from FEEDBACK_H, and nothing is positioned outside the
// overlay's own box, so neither the avatar nor the bubble reaches the canvas.
const FEEDBACK_H  = Math.min(150, Math.round(LETTER_SCREEN_H * 0.18));
const AVATAR_SIZE = FEEDBACK_H;
const FEEDBACK_W  = Math.round(FEEDBACK_H * 2.6);
const CLOUD_H     = Math.round(FEEDBACK_H * 0.64);
// The bubble ends a little inside the avatar's box, beside its head.
const CLOUD_RIGHT = Math.round(AVATAR_SIZE * 0.82);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: FEEDBACK_W,
    height: FEEDBACK_H,
    zIndex: 100,
    elevation: 24,
  },
  cloudWrap: {
    position: 'absolute',
    left: 0,
    right: CLOUD_RIGHT,
    top: 0,
    height: CLOUD_H,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  messageRow: {
    position: 'absolute',
    left: 18,
    right: 14,
    top: Math.round(CLOUD_H * 0.22),
    bottom: Math.round(CLOUD_H * 0.1),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 20,
    textAlign: 'center',
  },
  // Two small "thought" dots stepping from the bubble down to the avatar.
  thoughtDotLarge: {
    position: 'absolute',
    right: CLOUD_RIGHT - 12,
    top: CLOUD_H + 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  thoughtDotSmall: {
    position: 'absolute',
    right: CLOUD_RIGHT - 24,
    top: CLOUD_H + 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  // Fully inside the overlay's box — no negative offsets reaching upward.
  avatar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  // ── Side strip (the optional `side` prop) ──────────────────────────────────
  // Pinned to the right edge, full height, contents stacked and centred:
  // bubble, two thought dots, avatar. Width comes from the caller.
  sideOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 24,
  },
  sideCloud: {
    height: 96,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  sideMessageRow: {
    position: 'absolute',
    left: 14,
    right: 10,
    top: 20,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideDotLarge: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    marginTop: 4,
  },
  sideDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 2,
  },
});
