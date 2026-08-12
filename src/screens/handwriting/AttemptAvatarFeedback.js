import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AVATAR_MAP = {
  boba: require('../../../assets/avatar-images/Boba.png'),
  glitter: require('../../../assets/avatar-images/Glitter.png'),
  lily: require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

// Feature 3 Step 6 audit finding: these messages were keyed by raw attempt
// number, but their WORDING describes the support PRESENTATION just shown
// ("tracing" = the high-support animated tracer, "guide work"/"follow the
// guide" = medium's static guide, "wrote it yourself" = low/independent) —
// not merely the child's progression position. Once a session can start at
// medium/low (adaptive recommendation, Step 6), attempt=1 no longer
// guarantees high support in LetterWritingScreen.js/UppercaseWritingScreen.js,
// so keying by attempt there would make these factually wrong (e.g. "Great
// tracing!" after an attempt that showed no tracer at all).
//
// PreWritingActivityScreen.js also renders this component, for its own
// unrelated warm-up-activity attempt counter that has no support-level
// concept at all and never passes `supportLevel` — its behavior must stay
// completely untouched by this step. So BOTH keyings are kept: `supportLevel`
// (when provided — the letter-writing screens, post-Step-6) takes priority;
// `attempt` (legacy — PreWritingActivityScreen, unchanged) is the fallback
// only when `supportLevel` is absent. Wording is identical either way —
// only the selection key differs (see the Step 6 report's
// AttemptAvatarFeedback section for the full audit decision).
//
// Feature 3 Step 7 re-audit: RETRY_MESSAGES_BY_SUPPORT.low originally read
// "Keep going. Try with the guide." — Step 6 flagged this as a nuance but
// left it unchanged. Step 7 traced every adaptive sequence a LOW-support
// failure can occur in (getAdaptiveSupportSequence) and found the promise
// is no longer reliably true:
//   - high-started  [high, medium, low]:   a low (attempt 3) failure resets
//     the letter to attempt 1 = high, which DOES show a guide. Correct.
//   - medium-started [medium, low, low]:   a low (attempt 2) failure just
//     advances to attempt 3, which is ALSO low — no guide. Wrong.
//   - low-started    [low, low, low]:      any low failure resets to
//     attempt 1 = low again (same-letter retries keep the same sequence,
//     Step 7 spec §15) — no guide, ever. Wrong.
// Since this component only receives the support level for the attempt
// that JUST happened (not which sequence is active or what comes next), it
// cannot know which of these three cases applies — corrected to neutral
// wording that makes no claim about the next attempt's presentation,
// matching Step 7 spec §26's own suggested phrasing. Old/new text recorded
// here for the record:
//   old: 'Keep going. Try with the guide.'
//   new: 'Keep going. Try again carefully.'
const PASS_MESSAGES_BY_SUPPORT = {
  high:   'Great tracing!',
  medium: 'Nice guide work!',
  low:    'You wrote it yourself!',
};

const RETRY_MESSAGES_BY_SUPPORT = {
  high:   'Good start. Watch once more.',
  medium: 'Good try. Follow the guide.',
  low:    'Keep going. Try again carefully.',
};

// Legacy keying — byte-identical to this file's pre-Step-6 PASS_MESSAGES/
// RETRY_MESSAGES — preserved ONLY for callers that don't pass supportLevel
// (PreWritingActivityScreen.js today).
const PASS_MESSAGES_BY_ATTEMPT = {
  1: 'Great tracing!',
  2: 'Nice guide work!',
  3: 'You wrote it yourself!',
};

const RETRY_MESSAGES_BY_ATTEMPT = {
  1: 'Good start. Watch once more.',
  2: 'Good try. Follow the guide.',
  3: 'Keep going. Try with the guide.',
};

export default function AttemptAvatarFeedback({ avatarKey, passed, attempt, supportLevel, theme }) {
  const key = String(avatarKey ?? '').toLowerCase();
  const avatar = AVATAR_MAP[key] ?? AVATAR_MAP.megatron;
  const color = passed ? '#2E7D32' : '#8A5A00';
  const backgroundColor = passed ? '#E8F5E9' : '#FFF8E1';
  const passMessages  = supportLevel != null ? PASS_MESSAGES_BY_SUPPORT  : PASS_MESSAGES_BY_ATTEMPT;
  const retryMessages = supportLevel != null ? RETRY_MESSAGES_BY_SUPPORT : RETRY_MESSAGES_BY_ATTEMPT;
  const lookupKey = supportLevel != null ? supportLevel : attempt;
  const message = passed
    ? passMessages[lookupKey] ?? 'Nice work!'
    : retryMessages[lookupKey] ?? 'Good try. Try again.';

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
