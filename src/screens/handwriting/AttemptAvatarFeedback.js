import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AVATAR_MAP = {
  boba: require('../../../assets/avatar-images/Boba.png'),
  glitter: require('../../../assets/avatar-images/Glitter.png'),
  lily: require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
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

export default function AttemptAvatarFeedback({ avatarKey, passed, attempt, supportLevel, theme, note }) {
  const key = String(avatarKey ?? '').toLowerCase();
  const avatar = AVATAR_MAP[key] ?? AVATAR_MAP.megatron;
  const color = passed ? '#2E7D32' : '#8A5A00';
  const backgroundColor = passed ? '#E8F5E9' : '#FFF8E1';
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

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '55%',
    minWidth: 360,
    maxWidth: 480,
    height: 260,
    zIndex: 100,
    elevation: 24,
  },
  cloudWrap: {
    position: 'absolute',
    left: 0,
    right: 168,
    top: 14,
    height: 120,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  messageRow: {
    position: 'absolute',
    left: 28,
    right: 20,
    top: 28,
    bottom: 14,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 23,
    textAlign: 'center',
  },
  thoughtDotLarge: {
    position: 'absolute',
    right: 158,
    top: 120,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  thoughtDotSmall: {
    position: 'absolute',
    right: 143,
    top: 140,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
  },
  avatar: {
    position: 'absolute',
    right: -44,
    bottom: -42,
    width: 280,
    height: 280,
  },
});
