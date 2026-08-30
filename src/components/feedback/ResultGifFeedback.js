/**
 * ResultGifFeedback.js
 *
 * The right/wrong animation for CHOICE activities — one tap, one verdict.
 *
 * ── Which activities, and which not ──────────────────────────────────────
 * This is for activities a child ANSWERS: word practice A–D, and the concept
 * right/wrong rounds. Handwriting keeps the child's own themed avatar
 * (AttemptAvatarFeedback): a written attempt is judged on how it was formed,
 * not on being right or wrong, and swapping in a tick would say something the
 * activity does not mean. Word activity E is handwriting and keeps the avatar
 * despite living beside A–D.
 *
 * ── Extracted, not invented ──────────────────────────────────────────────
 * Five concept screens already each held their own copy of this: the same two
 * requires, the same Animated.Value slide, the same absolutely-positioned
 * popup, the same 200x200 contain-fit image. This is that pattern, once —
 * so word practice gains it without a sixth copy.
 *
 * ── Why it cannot move the page ──────────────────────────────────────────
 * `position: absolute` with `pointerEvents="none"`, sliding on translateX with
 * the native driver. It takes no layout space and receives no touches, so it
 * cannot reflow the activity or intercept a tap — which matters directly:
 * Phase 1 removed a screen jump caused by a conditional child changing a row's
 * height, and this must not reintroduce one.
 */

'use strict';

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const CORRECT_GIF = require('../../../assets/feedback/correct.gif');
const WRONG_GIF   = require('../../../assets/feedback/wrong.gif');

import { RESULT_GIF_MS, RESULT_GIF_OFFSCREEN } from '../../constants/resultGifFeedback';

// Timing lives in constants/resultGifFeedback so a caller (or a test) can read
// it without loading react-native.
export { RESULT_GIF_MS, RESULT_GIF_OFFSCREEN };

/**
 * @param {{
 *   visible: boolean,   // driven by the caller's own result state
 *   correct: boolean,   // the activity's OWN verdict — never computed here
 * }} props
 */
export default function ResultGifFeedback({ visible, correct }) {
  const slide = useRef(new Animated.Value(RESULT_GIF_OFFSCREEN)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slide, {
        toValue: 0, useNativeDriver: true, friction: 6, tension: 80,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: RESULT_GIF_OFFSCREEN, useNativeDriver: true, duration: 250,
      }).start();
    }
  }, [visible, slide]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={visible}
      accessibilityLiveRegion="polite"
      accessibilityLabel={correct ? 'Correct' : 'Try again'}
      style={[styles.popup, { transform: [{ translateX: slide }] }]}
    >
      {visible && (
        <ExpoImage
          source={correct ? CORRECT_GIF : WRONG_GIF}
          style={styles.image}
          contentFit="contain"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    right: 24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  image: {
    width: 200,
    height: 200,
  },
});
