import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AVATAR_MAP = {
  boba: require('../../../../assets/avatar-images/Boba.png'),
  glitter: require('../../../../assets/avatar-images/Glitter.png'),
  lily: require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

const PASS_MESSAGES = {
  1: 'Great tracing!',
  2: 'Nice guide work!',
  3: 'You wrote it yourself!',
};

const RETRY_MESSAGES = {
  1: 'Good start. Watch once more.',
  2: 'Good try. Follow the guide.',
  3: 'Keep going. Try with the guide.',
};

export default function AttemptAvatarFeedback({ avatarKey, passed, attempt, theme }) {
  const key = String(avatarKey ?? '').toLowerCase();
  const avatar = AVATAR_MAP[key] ?? AVATAR_MAP.megatron;
  const color = passed ? '#2E7D32' : '#8A5A00';
  const backgroundColor = passed ? '#E8F5E9' : '#FFF8E1';
  const message = passed
    ? PASS_MESSAGES[attempt] ?? 'Nice work!'
    : RETRY_MESSAGES[attempt] ?? 'Good try. Try again.';

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
