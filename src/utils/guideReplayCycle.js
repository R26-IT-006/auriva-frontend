/**
 * guideReplayCycle.js
 *
 * Forward-only replay for the Attempt-1 handwriting guide.
 *
 * ── Why the old guide reversed ───────────────────────────────────────────
 * The screens drove the tracer with:
 *
 *     Animated.loop(
 *       Animated.sequence([Animated.delay(350), ...strokeTimings, Animated.delay(700)]),
 *       { resetBeforeIteration: true }
 *     )
 *
 * `resetBeforeIteration` looks like it restores the progress value, but
 * `Animated.sequence`'s own reset is:
 *
 *     reset() { animations.forEach((a, idx) => { if (idx <= current) a.reset(); }); current = 0; }
 *
 * and a sequence that has just FINISHED sets `current = 0` before invoking its
 * completion callback. So by the time the loop resets it, `current === 0` and
 * exactly one child is reset: `animations[0]`.
 *
 * `animations[0]` is `Animated.delay(350)` — and `Animated.delay` is a timing on
 * its own throwaway `AnimatedValue`. The reset lands on that dummy. The tracer's
 * progress value is never touched, so it enters iteration 2 still holding the
 * LAST keyframe index, and the sequence's first real timing walks it back down
 * to the end of stroke 1 — the whole letter drawn in reverse.
 *
 * This is why the two other looped demos in this codebase are fine:
 * PreWritingActivityScreen loops a bare `Animated.timing` (reset reaches the
 * real value), and ShapeAssessmentScreen's sequence happens to put its timing
 * at index 0. A leading `Animated.delay` is the whole difference.
 *
 * ── The replacement ──────────────────────────────────────────────────────
 * No loop, no sequence-reset subtlety, no backward motion. Each pass is an
 * explicit, complete forward run of the canonical stroke order, started from a
 * progress value this module sets to 0 itself:
 *
 *     setValue(0) → 0 ➜ 1 → quiet pause → setValue(0) → 0 ➜ 1 → …
 *
 * The pause is an idle reminder rather than continuous motion, which is the
 * calmer pattern for the children this is built for.
 */

'use strict';

/**
 * Quiet gap between the end of one forward pass and the start of the next.
 * An idle reminder, not a loop: long enough to read as a deliberate pause.
 */
export const GUIDE_IDLE_REPLAY_MS = 2000;

/**
 * Play a guide animation forward, then replay it forward again after an idle
 * pause, until stopped.
 *
 * @param {object}   opts
 * @param {object}   opts.progress             the Animated.Value the guide reads.
 * @param {Function} opts.buildForwardSequence () => CompositeAnimation — a FRESH
 *   forward-only animation for the complete canonical stroke order. Called once
 *   per pass, so nothing carries state between passes.
 * @param {number}   [opts.idleMs]             pause between passes.
 * @returns {{stop: Function}} stop() cancels the pending replay AND any pass
 *   currently running. Safe to call more than once.
 */
export function startGuideReplayCycle({
  progress,
  buildForwardSequence,
  idleMs = GUIDE_IDLE_REPLAY_MS,
}) {
  let stopped = false;
  let running = null;
  let timer = null;

  const runForwardPass = () => {
    if (stopped) return;

    // Every pass starts from zero. This is the line the old `resetBeforeIteration`
    // was supposed to be — here it is unconditional and on the real value.
    progress?.setValue?.(0);

    running = buildForwardSequence();
    running?.start?.((result) => {
      running = null;
      // A pass cut short (stop, unmount, child started writing) must not queue
      // another one — only a pass that ran to completion earns a replay.
      if (stopped || result?.finished === false) return;
      timer = setTimeout(runForwardPass, idleMs);
    });
  };

  runForwardPass();

  return {
    stop() {
      stopped = true;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      if (running) {
        running.stop?.();
        running = null;
      }
    },
  };
}
