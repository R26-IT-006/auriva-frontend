// The Attempt-1 guide plays forward, pauses, and plays forward again — never
// backward.
//
// ── Why it used to reverse ──────────────────────────────────────────────
// `Animated.loop(Animated.sequence([...]), { resetBeforeIteration: true })`.
// A sequence that finishes sets its internal `current = 0` BEFORE calling back,
// and its reset is `if (idx <= current) a.reset()` — so the loop's reset
// touched exactly `animations[0]`. That was `Animated.delay(350)`, a timing on
// its own throwaway value. tracerProgress was never reset, so pass 2 began at
// the LAST keyframe and the first real timing walked it back down.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { startGuideReplayCycle, GUIDE_IDLE_REPLAY_MS } from './guideReplayCycle';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const LETTER = '../screens/teacher/handwriting/LetterWritingScreen.js';
const UPPER  = '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js';
const WORD   = '../screens/teacher/handwriting/words/WordWritingScreen.js';
const SCREENS = [['LetterWriting', LETTER], ['UppercaseWriting', UPPER], ['WordWriting', WORD]];

// A stand-in for Animated.Value + a forward sequence, recording every move.
function harness() {
  const trace = [];
  const progress = { setValue: (v) => trace.push({ set: v }) };
  let pending = null;
  const buildForwardSequence = jest.fn(() => {
    const seq = {
      start: (cb) => { trace.push({ run: 'forward 0->1' }); pending = cb; },
      stop: jest.fn(() => trace.push({ stopped: true })),
    };
    seq.finish = () => { const cb = pending; pending = null; if (cb) cb({ finished: true }); };
    seq.interrupt = () => { const cb = pending; pending = null; if (cb) cb({ finished: false }); };
    return seq;
  });
  return {
    trace,
    progress,
    buildForwardSequence,
    last: () => buildForwardSequence.mock.results.slice(-1)[0].value,
  };
}

describe('§13 A-F — forward-only lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('A. the first pass sets progress to 0, then runs forward', () => {
    const h = harness();
    startGuideReplayCycle(h);
    expect(h.trace).toEqual([{ set: 0 }, { run: 'forward 0->1' }]);
  });

  it('B/C. after completing, it resets to 0 and runs forward again', () => {
    const h = harness();
    startGuideReplayCycle(h);
    h.last().finish();
    jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS);
    expect(h.trace).toEqual([
      { set: 0 }, { run: 'forward 0->1' },
      { set: 0 }, { run: 'forward 0->1' },
    ]);
  });

  it('D. no pass ever runs 1 -> 0 — every pass begins at 0', () => {
    const h = harness();
    startGuideReplayCycle(h);
    for (let i = 0; i < 5; i++) {
      h.last().finish();
      jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS);
    }
    expect(h.trace.filter((e) => e.run)).toHaveLength(6);
    h.trace.forEach((entry, i) => {
      if (entry.run) expect(h.trace[i - 1]).toEqual({ set: 0 });
    });
    // A fresh animation per pass: nothing is reused or played in reverse.
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(6);
  });

  it('F. the replay waits out the idle pause first', () => {
    const h = harness();
    startGuideReplayCycle(h);
    h.last().finish();
    jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS - 1);
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(1);   // still quiet
    jest.advanceTimersByTime(1);
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(2);
  });

  it('the idle pause is a calm reminder, not continuous motion', () => {
    expect(GUIDE_IDLE_REPLAY_MS).toBe(2000);
    expect(GUIDE_IDLE_REPLAY_MS).toBeGreaterThanOrEqual(1500);
    expect(GUIDE_IDLE_REPLAY_MS).toBeLessThanOrEqual(2500);
  });
});

describe('§13 G-I — stopping', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('G/I. stop() during a pass cancels the animation and queues nothing', () => {
    const h = harness();
    const cycle = startGuideReplayCycle(h);
    const running = h.last();
    cycle.stop();
    expect(running.stop).toHaveBeenCalled();
    jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS * 5);
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(1);
  });

  it('G/I. stop() during the idle pause cancels the pending replay', () => {
    const h = harness();
    const cycle = startGuideReplayCycle(h);
    h.last().finish();
    expect(jest.getTimerCount()).toBe(1);      // replay is queued
    cycle.stop();
    // The timer is CLEARED, not merely made inert by the stopped flag: a
    // screen that unmounts must not leave a live timeout behind.
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS * 5);
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(1);
  });

  it('an interrupted pass never schedules a replay', () => {
    const h = harness();
    startGuideReplayCycle(h);
    h.last().interrupt();
    jest.advanceTimersByTime(GUIDE_IDLE_REPLAY_MS * 5);
    expect(h.buildForwardSequence).toHaveBeenCalledTimes(1);
  });

  it('stop() is safe to call repeatedly and after completion', () => {
    const h = harness();
    const cycle = startGuideReplayCycle(h);
    h.last().finish();
    expect(() => { cycle.stop(); cycle.stop(); }).not.toThrow();
  });
});

describe('§13 D/E — no loop, no yoyo, no reverse, in any screen', () => {
  it.each(SCREENS)('%s drives the tracer with the forward-only cycle', (_name, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const cycle = startGuideReplayCycle\(\{\s*progress: tracerProgress,\s*buildForwardSequence,\s*\}\);/);
    expect(code).toMatch(/const buildForwardSequence = \(\) => \{/);
    expect(code).toMatch(/return Animated\.sequence\(\[Animated\.delay\(\d+\), \.\.\.strokeAnim/);
  });

  it.each(SCREENS)('%s no longer loops or resets per iteration', (_name, rel) => {
    const code = readCode(rel);
    expect(code).not.toMatch(/resetBeforeIteration/);
    expect(code).not.toMatch(/Animated\.loop\([\s\S]{0,200}tracerProgress/);
    expect(code).not.toMatch(/iterations:/);
  });

  it.each(SCREENS)('%s never animates the tracer toward a lower bound', (_name, rel) => {
    const code = readCode(rel);
    const targets = code.match(/Animated\.timing\(tracerProgress, \{\s*toValue: [^,\n]+/g) || [];
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      // Only canonical stroke bounds — never a literal 0, never a reversal.
      expect(t).toMatch(/toValue: strokeBounds\[\w+\]\.(start|end)/);
    }
    expect(code).not.toMatch(/yoyo|\.reverse\(\)|direction: *-1/i);
  });
});

describe('§3 / §9 — canonical geometry and full multi-stroke replay', () => {
  it.each(SCREENS)('%s builds strokes in ascending canonical order', (_name, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/for \(let \w+ = 0; \w+ < strokeBounds\.length; \w+\+\+\)/);
    expect(code).not.toMatch(/strokeBounds\.length - 1; \w+ >= 0/);
    expect(code).toMatch(/strokeBounds\.push\(\{ start, end: offset - 1 \}\)/);
  });

  it.each(SCREENS)('%s rebuilds the whole sequence per pass', (_name, rel) => {
    const code = readCode(rel);
    const at = code.indexOf('const buildForwardSequence');
    const body = code.slice(at, code.indexOf('const cycle = startGuideReplayCycle', at));
    expect(body).toMatch(/const strokeAnim\w* = \[\];/);   // built inside the factory
  });
});

describe('§4 / §6 / §8 — when the guide runs and when it stops', () => {
  it.each(SCREENS)('%s stops the cycle at the first touch, not at stroke end', (_name, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/stopGuideRef\.current = \(\) => cycle\.stop\(\);/);
    const at = code.indexOf('onPanResponderGrant');
    expect(code.slice(at, at + 200)).toMatch(/stopGuideRef\.current\?\.\(\);/);
    // Not deferred to release/terminate, and not to scoring.
    const onRelease = code.indexOf('onPanResponderRelease');
    expect(code.slice(onRelease, onRelease + 400)).not.toMatch(/stopGuideRef/);
  });

  it.each(SCREENS)('%s cancels on unmount, attempt and letter/word change', (_name, rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/cycle\.stop\(\);\s*stopGuideRef\.current = null;/);
    const after = code.slice(code.indexOf('const cycle = startGuideReplayCycle'));
    expect(after).toMatch(/\}, \[[^\]]*\battempt\b[^\]]*\bhasDrawn\b[^\]]*\]\)/);
  });

  it('Attempt-1 gating is untouched — Attempts 2 and 3 gain nothing', () => {
    for (const rel of [LETTER, UPPER]) {
      expect(readCode(rel)).toMatch(/!supportPresentation\?\.showAnimatedTracer \|\| hasDrawn/);
    }
    expect(readCode(WORD)).toMatch(/if \(reduceMotion \|\| attempt !== 1 \|\| hasDrawn/);
  });

  it('§12 no bounce, shake, pulse or flash was added to the guide', () => {
    for (const [, rel] of SCREENS) {
      const code = readCode(rel);
      const at = code.indexOf('const buildForwardSequence');
      const body = code.slice(at, code.indexOf('stopGuideRef.current = () =>', at));
      expect(body).not.toMatch(/spring|bounce|shake|pulse|flash|Easing\.elastic/i);
    }
  });
});

describe('§14 — nothing outside the animation controller changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('reference paths, stroke points and canvas geometry are unchanged', () => {
    expect(readCode('../constants/letterCanvasLayout.js')).toMatch(/export const CANVAS_W/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    for (const [, rel] of SCREENS) {
      expect(readCode(rel)).toMatch(/mapTouchToCanvas\(\{/);
    }
  });

  it('scoring, mastery, DTW and Motor Score are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('§13 L — Word Writing feedback is still submit-only', () => {
    const code = readCode(WORD);
    expect((code.match(/setFeedbackData\((?!null\))/g) || [])).toHaveLength(1);
    expect(code).toMatch(/setFeedbackData\(getFeedbackFromScore\(saved\?\.score\)\)/);
    expect(code).toMatch(/<AttemptAvatarFeedback/);
  });

  it('word audio and completion filtering are unchanged', () => {
    expect(readCode(WORD)).toMatch(/Speech\.speak\(spoken, \{ rate: 0\.82/);
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
  });

  it('the other looped demos were left alone', () => {
    // Both already reset correctly: a bare timing, and a sequence whose timing
    // sits at index 0. Neither is the broken shape.
    expect(readCode('../screens/teacher/handwriting/PreWritingActivityScreen.js'))
      .toMatch(/Animated\.loop\(\s*Animated\.timing\(animValue, \{ toValue: 1/);
    expect(readCode('../screens/teacher/handwriting/ShapeAssessmentScreen.js'))
      .toMatch(/Animated\.loop\(\s*Animated\.sequence\(\[\s*Animated\.timing\(animValue/);
  });
});
