/**
 * useDemoPathAnimation.js
 *
 * Drives a demonstration's pointer along a prepared timeline and hands back
 * the same two `Animated.interpolate` nodes the real activities feed their
 * own tracer.
 *
 * That last part is the point: because this returns `x`/`y` in exactly the
 * shape `LetterWritingStage`/`WordWritingStage` already expect for
 * `tracerXInterp`/`tracerYInterp`, a demonstration lights up the REAL
 * screen's own tracer rather than drawing a second, demo-only dot on top of
 * a mock canvas. Same dot, same size, same shadow, same colour — it is the
 * same JSX.
 *
 * The playback construction (per-stroke `Animated.sequence`, a 1 ms jump to
 * each stroke's first sample so the pointer never draws between strokes,
 * lead-in and tail pauses) is the same one LetterWritingScreen's Attempt-1
 * tracer uses; the durations come from the same shared speed helper.
 *
 * ── Why this animation is JS-driven (useNativeDriver: false) ─────────────
 * `progress` feeds `x`/`y`, and the three stages consume those two nodes in
 * two different ways:
 *
 *   LetterWritingStage / WordWritingStage -> transform: translateX/translateY
 *   ShapeAssessmentStage                  -> left / top
 *
 * The native animated module supports transforms but NOT the layout props
 * `left`/`top`. Driving `progress` natively therefore worked for the letter
 * and word demos while the shape demo logged
 *   "Style property 'left' is not supported by native animated module"
 * and its pointer never moved.
 *
 * One `Animated.Value` cannot mix drivers, so the driver has to satisfy the
 * strictest consumer, which is the `left`/`top` one. This mirrors what the
 * real screens already do: ShapeAssessmentScreen and PreWritingActivityScreen
 * drive their own `left`/`top` pointer with `useNativeDriver: false`, while
 * LetterWritingScreen drives its transform-based tracer natively. Only
 * demonstration playback is affected — HandwritingDemoScreen is this hook's
 * only consumer, and every real practice/assessment animation is untouched.
 */

'use strict';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import {
  INTER_STROKE_DELAY_MS, LEAD_IN_DELAY_MS, TAIL_DELAY_MS,
} from '../../utils/demoPlayback';

/**
 * @param {{
 *   timeline: object|null,     // from utils/demoPlayback.js
 *   reduceMotion?: boolean,
 *   playToken: number,         // bump to replay
 *   onPassComplete?: () => void,
 * }} args
 * @returns {{x: any, y: any, visible: boolean}}
 */
export default function useDemoPathAnimation({
  timeline, reduceMotion = false, playToken = 0, onPassComplete,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const inputRange = timeline?.keyframes?.inputRange ?? null;
  const xRange = timeline?.keyframes?.xRange ?? null;
  const yRange = timeline?.keyframes?.yRange ?? null;

  const x = useMemo(
    () => (inputRange && inputRange.length > 1
      ? progress.interpolate({ inputRange, outputRange: xRange, extrapolate: 'clamp' })
      : null),
    [progress, inputRange, xRange],
  );
  const y = useMemo(
    () => (inputRange && inputRange.length > 1
      ? progress.interpolate({ inputRange, outputRange: yRange, extrapolate: 'clamp' })
      : null),
    [progress, inputRange, yRange],
  );

  useEffect(() => {
    if (!timeline) { setVisible(false); return undefined; }

    // Honours the OS "reduce motion" setting exactly as the writing screens'
    // tracer does: the reference guide stays, the movement does not.
    if (reduceMotion) {
      setVisible(false);
      onPassComplete?.();
      return undefined;
    }

    progress.setValue(0);
    setVisible(true);

    const steps = [Animated.delay(LEAD_IN_DELAY_MS)];
    timeline.strokes.forEach((stroke, i) => {
      if (i > 0) {
        steps.push(Animated.delay(INTER_STROKE_DELAY_MS));
        // Jump (not slide) to the next stroke's first point, so the pointer
        // never traces a line that is not part of the letter.
        steps.push(Animated.timing(progress, {
          // JS-driven — see the header note on left/top vs transform.
          toValue: stroke.start, duration: 1, easing: Easing.linear, useNativeDriver: false,
        }));
      }
      steps.push(Animated.timing(progress, {
        toValue: stroke.end,
        duration: stroke.durationMs,
        easing: Easing.linear,
        // JS-driven — see the header note on left/top vs transform.
        useNativeDriver: false,
      }));
    });
    steps.push(Animated.delay(TAIL_DELAY_MS));

    const anim = Animated.sequence(steps);
    anim.start(({ finished }) => { if (finished) onPassComplete?.(); });

    return () => anim.stop();
    // playToken changes on every Replay press — that is what restarts it.
  }, [timeline, playToken, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { x, y, visible };
}
