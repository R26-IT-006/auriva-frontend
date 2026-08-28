// Canvas touch → logical coordinate mapping.
//
// ── The bug ─────────────────────────────────────────────────────────────
// The canvas origin was read with measureInWindow() while touches arrive as
// nativeEvent.pageX/pageY. On Android those are different coordinate spaces
// whenever the app draws under a translucent status bar: window space excludes
// the system inset, page space includes it. Subtracting a window-space origin
// from a page-space touch leaves a CONSTANT vertical offset — and no
// horizontal one, because there is no equivalent horizontal inset. That is
// exactly the reported symptom: X fine, Y wrong.
//
// View.measure() reports the view's own pageX/pageY, so origin and touch are
// now read in one space.
//
// ── What the mapping is ─────────────────────────────────────────────────
// The responder view, the measured view and the Svg's parent are ONE element,
// and the Svg is its direct child at its FULL logical size (React Native's
// flexShrink defaults to 0, so it is not squeezed into the smaller content
// box — it overflows and is clipped). The Svg's space therefore starts exactly
// `border` px inside the view and runs 1:1. The whole transform is:
//
//     local - border
//
// An earlier attempt scaled by logical / (measured - 2*border). That was wrong
// twice over: the content box is not the size the Svg is drawn at, and where
// the two agreed it multiplied every coordinate by ~1.01 for nothing. Removed.

import fs from 'fs';
import path from 'path';

import { mapTouchToCanvas, pageToLocal, clampToCanvas } from './touchPointSanitize';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

// Source sentinels must look at CODE. Every one of these files documents the
// bug in its own comments, so an un-stripped read matches the prose describing
// what was removed and the sentinel passes (or fails) for the wrong reason.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const ORIGIN = { x: 0, y: 0 };
const map = (args) => mapTouchToCanvas({ origin: ORIGIN, ...args });

const SCREENS = [
  '../screens/handwriting/LetterWritingScreen.js',
  '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
  '../screens/handwriting/ShapeAssessmentScreen.js',
  '../screens/handwriting/PreWritingActivityScreen.js',
  '../screens/handwriting/words/WordWritingScreen.js',
  '../components/word/ExerciseE_WriteWord.js',
];

// ─── the origin is read in the touch's own space ────────────────────────

describe('origin and touch must share one coordinate space', () => {
  it.each(SCREENS)('%s takes its origin from measure() pageX/pageY', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(
      /canvasRef\.current\?\.measure\?\.\(\(_x, _y, _w, _h, pageX, pageY\) => \{[\s\S]*?canvasOriginRef\.current = \{ x: pageX, y: pageY \};/,
    );
  });

  it.each(SCREENS)('%s no longer sets the origin from measureInWindow', (rel) => {
    const code = readCode(rel);
    // It may still be READ for the dev ORIGIN DELTA line, but must never be
    // what canvasOriginRef is set from.
    expect(code).not.toMatch(/measureInWindow\(\(x, y\) => \{ canvasOriginRef/);
    const assigns = code.match(/canvasOriginRef\.current = [^;]+;/g) || [];
    expect(assigns).toHaveLength(1);
    expect(assigns[0]).toBe('canvasOriginRef.current = { x: pageX, y: pageY };');
  });

  it.each(SCREENS)('%s guards against measure() handing back non-numbers', (rel) => {
    expect(readCode(rel)).toMatch(/if \(Number\.isFinite\(pageX\) && Number\.isFinite\(pageY\)\)/);
  });

  it('a page-space origin makes the local coordinate exact', () => {
    // Card at page (220, 169), 1.5px border, finger 200px below the card top.
    const r = mapTouchToCanvas({
      pageX: 220 + 1.5, pageY: 169 + 1.5 + 200,
      origin: { x: 220, y: 169 },
      logical: { width: 791, height: 427 },
      inset: 1.5,
    });
    expect(r).toEqual({ x: 0, y: 200 });
  });

  it('a window-space origin would have offset Y by exactly the system inset', () => {
    // The old behaviour, reproduced: origin 24px higher than the touch space.
    const SYSTEM_INSET = 24;
    const wrong = mapTouchToCanvas({
      pageX: 220, pageY: 169 + 200,
      origin: { x: 220, y: 169 - SYSTEM_INSET },
      logical: { width: 791, height: 427 },
    });
    const right = mapTouchToCanvas({
      pageX: 220, pageY: 169 + 200,
      origin: { x: 220, y: 169 },
      logical: { width: 791, height: 427 },
    });
    expect(wrong.y - right.y).toBe(SYSTEM_INSET);
    expect(wrong.x).toBe(right.x);   // X was never affected
  });
});

// ─── the mapping itself: subtract, clamp, nothing else ──────────────────

describe('the mapping is a subtraction', () => {
  const logical = { width: 800, height: 600 };

  it('a touch at the content origin maps to 0,0', () => {
    expect(map({ pageX: 1.5, pageY: 1.5, logical, inset: 1.5 })).toEqual({ x: 0, y: 0 });
  });

  it('is 1:1 down the whole canvas — 10% / 50% / 90%', () => {
    for (const f of [0.1, 0.5, 0.9]) {
      const y = 600 * f;
      expect(map({ pageX: 0, pageY: y, logical }).y).toBe(y);
    }
  });

  it('is 1:1 across the whole canvas', () => {
    for (const px of [0, 1, 137, 400, 799, 800]) {
      expect(map({ pageX: px, pageY: 0, logical }).x).toBe(px);
    }
  });

  it('the last content pixel maps to the logical bottom-right', () => {
    const r = map({ pageX: 800 + 1.5, pageY: 600 + 1.5, logical, inset: 1.5 });
    expect(r).toEqual({ x: 800, y: 600 });
  });

  it('X and Y are treated identically — no axis is special-cased', () => {
    const square = { width: 500, height: 500 };
    for (const v of [0, 33, 250, 499]) {
      const r = map({ pageX: v, pageY: v, logical: square });
      expect(r.x).toBe(r.y);
    }
  });
});

// ─── the scale step is gone ─────────────────────────────────────────────

describe('no content-box scaling remains', () => {
  it('the mapper does not divide by a measured size', () => {
    const code = readCode('./touchPointSanitize.js');
    expect(code).not.toMatch(/measured/);
    expect(code).not.toMatch(/contentW|contentH/);
    expect(code).not.toMatch(/logicalW \/|logicalH \//);
  });

  it('the mapper no longer accepts a measured size at all', () => {
    const code = readCode('./touchPointSanitize.js');
    expect(code).toMatch(
      /export function mapTouchToCanvas\(\{ pageX, pageY, origin, logical, inset = 0 \}\)/,
    );
  });

  it.each(SCREENS)('%s stops passing measured into the mapper', (rel) => {
    const code = readCode(rel);
    const calls = code.match(/mapTouchToCanvas\(\{[\s\S]*?\n {8}\}\);/g) || [];
    expect(calls).toHaveLength(2);
    for (const c of calls) expect(c).not.toMatch(/measured/);
  });

  it('the old scaled result is NOT produced — a compressed measurement is irrelevant now', () => {
    // Under the removed scale this returned 300. The Svg is drawn at the full
    // logical height regardless of the content box, so 150 is correct.
    expect(map({ pageX: 0, pageY: 150, logical: { width: 800, height: 600 } }).y).toBe(150);
  });
});

// ─── border / content inset ─────────────────────────────────────────────

describe('the border inset', () => {
  const logical = { width: 800, height: 600 };

  it.each([[1.5], [2]])('a border of %s shifts the origin by exactly that much', (b) => {
    expect(map({ pageX: b, pageY: b, logical, inset: b })).toEqual({ x: 0, y: 0 });
    expect(map({ pageX: b + 100, pageY: b + 100, logical, inset: b })).toEqual({ x: 100, y: 100 });
  });

  it('a touch on the border itself clamps to 0, never negative', () => {
    expect(map({ pageX: 0, pageY: 0, logical, inset: 1.5 })).toEqual({ x: 0, y: 0 });
  });

  it('inset defaults to 0 so an un-bordered canvas is unaffected', () => {
    expect(map({ pageX: 10, pageY: 10, logical })).toEqual({ x: 10, y: 10 });
  });

  it.each([[NaN], [-3], ['x'], [undefined], [null]])('a bad inset (%s) is treated as 0', (bad) => {
    expect(map({ pageX: 10, pageY: 10, logical, inset: bad })).toEqual({ x: 10, y: 10 });
  });
});

// ─── robustness ─────────────────────────────────────────────────────────

describe('robustness', () => {
  const logical = { width: 800, height: 600 };

  it('never produces NaN or Infinity', () => {
    for (const args of [
      { pageX: NaN, pageY: NaN, logical },
      { pageX: 50, pageY: 50, logical: null },
      { pageX: 50, pageY: 50, logical: { width: 0, height: 0 } },
      { pageX: Infinity, pageY: -Infinity, logical },
    ]) {
      const r = map(args);
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.y)).toBe(true);
    }
  });

  it('a missing origin cannot throw — before layout the touch is its own local', () => {
    expect(() => mapTouchToCanvas({ pageX: 1, pageY: 1, logical })).not.toThrow();
    expect(mapTouchToCanvas({ pageX: 40, pageY: 40, logical })).toEqual({ x: 40, y: 40 });
  });

  it('the result is always inside the logical canvas', () => {
    for (const [px, py] of [[-50, -50], [9999, 9999], [0, 9999]]) {
      const r = map({ pageX: px, pageY: py, logical });
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThanOrEqual(800);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThanOrEqual(600);
    }
  });

  it('the existing helpers still behave exactly as before', () => {
    expect(pageToLocal(100, 200, { x: 30, y: 50 })).toEqual({ x: 70, y: 150 });
    expect(clampToCanvas(-5, 700, 800, 600)).toEqual({ x: 0, y: 600 });
  });

  it('the mapper is pure — no cached layout, no Dimensions', () => {
    const code = readCode('./touchPointSanitize.js');
    expect(code).not.toMatch(/Dimensions\.get/);
    expect(code).not.toMatch(/useState|useRef|let\s+cached/);
  });
});

// ─── all six canvases ───────────────────────────────────────────────────

describe('every canvas uses the shared mapper', () => {
  it.each(SCREENS)('%s maps both touch sites', (rel) => {
    expect((readCode(rel).match(/mapTouchToCanvas\(\{/g) || []).length).toBe(2);
  });

  it.each(SCREENS)('%s passes its own border as the inset', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const CANVAS_BORDER_WIDTH = [0-9.]+;/);
    expect((code.match(/inset: CANVAS_BORDER_WIDTH/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it.each(SCREENS)('%s uses pageX/pageY, never locationX/locationY', (rel) => {
    const code = readCode(rel);
    expect(code).not.toMatch(/nativeEvent\.location[XY]/);
    expect(code).toMatch(/pageX: evt\.nativeEvent\.pageX, pageY: evt\.nativeEvent\.pageY/);
  });

  it('no canvas is left on the old two-step conversion', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel)).not.toMatch(/clampToCanvas\(local\.x, local\.y/);
    }
  });

  it("the border each canvas declares matches its own canvasCard borderWidth", () => {
    const declared = {
      '../screens/handwriting/LetterWritingScreen.js': 1.5,
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js': 1.5,
      '../screens/handwriting/ShapeAssessmentScreen.js': 2,
      '../screens/handwriting/PreWritingActivityScreen.js': 2,
      '../screens/handwriting/words/WordWritingScreen.js': 1.5,
      '../components/word/ExerciseE_WriteWord.js': 2,
    };
    for (const [rel, width] of Object.entries(declared)) {
      expect(readCode(rel)).toMatch(new RegExp(`const CANVAS_BORDER_WIDTH = ${width};`));
    }
  });
});

// ─── nothing else moved ─────────────────────────────────────────────────

describe('SENTINEL — geometry, storage and scoring untouched', () => {
  it('the logical canvas constants are unchanged', () => {
    const letter = readCode('../constants/letterCanvasLayout.js');
    expect(letter).toMatch(/export const CANVAS_W\s+= SCREEN_W - COL_L - PAD \* 2;/);
    expect(letter).toMatch(/export const CANVAS_H\s+= Math\.round\(SCREEN_H \* 0\.50\);/);
    expect(letter).toMatch(/LINE_1 = Math\.round\(CANVAS_H \* 0\.08\)/);
  });

  it('the Svg is still rendered at the FULL logical size — the premise of the fix', () => {
    expect(readCode('../components/handwriting/LetterWritingStage.js'))
      .toMatch(/<Svg width=\{CANVAS_W\} height=\{CANVAS_H\}/);
    expect(readCode('../components/handwriting/ShapeAssessmentStage.js'))
      .toMatch(/<Svg width=\{CANVAS_WIDTH\} height=\{CANVAS_HEIGHT\}/);
    expect(readCode('../components/handwriting/WordWritingStage.js'))
      .toMatch(/<Svg width=\{CANVAS_W\} height=\{CANVAS_H\}/);
  });

  it('nothing transforms a point between state and the rendered stroke', () => {
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    expect(stage).toMatch(/points=\{stroke\.map\(p => `\$\{p\.x\},\$\{p\.y\}`\)\.join\(' '\)\}/);
    expect(stage).not.toMatch(/viewBox|preserveAspectRatio/);
  });

  it('reference path constants are untouched', () => {
    for (const rel of ['../constants/wordPaths.js', '../constants/activityPreviewLetterPaths.js']) {
      const code = readCode(rel);
      expect(code).not.toMatch(/mapTouchToCanvas|canvasSizeRef|measureInWindow/);
    }
  });

  it('the stored point schema is unchanged', () => {
    expect(readCode('../screens/handwriting/LetterWritingScreen.js'))
      .toMatch(/x: locationX, y: locationY, t: now - startTimeRef\.current, tAbs: now, stroke_id:/);
  });

  it('scoring and mastery are untouched', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });
});

// ─── Animated.interpolate keyframe minimum ──────────────────────────────
//
// Reported from a device as:
//   ERROR [Invariant Violation: inputRange must have at least 2 elements]
//
// Both pointer-guide screens build inputRange from a generated point array.
// PreWritingActivityScreen renders one frame with no activity (the frame
// before the `activities.length === 0` effect calls navigation.replace), and
// there pathPoints is []. The outputRange already had a [0, 0] fallback; the
// inputRange did not, so interpolate() got an empty array.

describe('pointer-guide interpolation needs two keyframes', () => {
  const POINTER_SCREENS = [
    ['../screens/handwriting/PreWritingActivityScreen.js', 'pathPoints'],
    ['../screens/handwriting/ShapeAssessmentScreen.js',    'pathPoints'],
  ];

  // The runtime rule Animated enforces, reproduced so the assertions below
  // are checking against real behaviour rather than a remembered one.
  const interpolateIsLegal = (inputRange, outputRange) =>
    Array.isArray(inputRange) && inputRange.length >= 2
    && inputRange.length === outputRange.length
    && inputRange.every(Number.isFinite);

  // The shape both screens now use.
  const buildRanges = (pathPoints) => {
    const has = pathPoints.length > 1;
    return {
      inputRange:  has ? pathPoints.map((_, i) => i / (pathPoints.length - 1)) : [0, 1],
      outputRange: has ? pathPoints.map((p) => p.x - 12) : [0, 0],
    };
  };

  it.each([
    ['no activity yet',      []],
    ['a single point',       [{ x: 5, y: 5 }]],
    ['a normal 101-point template',
      Array.from({ length: 101 }, (_, i) => ({ x: i, y: i }))],
  ])('%s produces a legal interpolation', (_label, pts) => {
    const { inputRange, outputRange } = buildRanges(pts);
    expect(interpolateIsLegal(inputRange, outputRange)).toBe(true);
  });

  it('the OLD expression was illegal for the empty and single-point cases', () => {
    for (const pts of [[], [{ x: 5, y: 5 }]]) {
      const inputRange = pts.map((_, i) => i / Math.max(1, pts.length - 1));
      expect(inputRange.length).toBeLessThan(2);
    }
  });

  it('a real path is mapped exactly as before — 0..1 inclusive, one point each', () => {
    const pts = Array.from({ length: 101 }, (_, i) => ({ x: i, y: i }));
    const { inputRange, outputRange } = buildRanges(pts);
    expect(inputRange).toHaveLength(101);
    expect(outputRange).toHaveLength(101);
    expect(inputRange[0]).toBe(0);
    expect(inputRange[100]).toBe(1);
    expect(inputRange[50]).toBeCloseTo(0.5, 10);
  });

  it.each(POINTER_SCREENS)('%s guards both ranges together', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/const hasPointerPath = pathPoints\.length > 1;/);
    expect(code).toMatch(/\? pathPoints\.map\(\(_, i\) => i \/ \(pathPoints\.length - 1\)\)\s*\n?\s*: \[0, 1\]/);
    // Neither ternary may be left one-sided again.
    expect((code.match(/hasPointerPath \? pathPoints\.map/g) || []).length).toBe(2);
    expect(code).not.toMatch(/pathPoints\.length \? pathPoints\.map/);
    expect(code).not.toMatch(/i \/ Math\.max\(1, pathPoints\.length - 1\)/);
  });

  it('the tracer screens were NOT touched — demoPlayback already returns null below 2', () => {
    expect(readCode('../utils/demoPlayback.js')).toMatch(/if \(inputRange\.length < 2\) return null;/);
    for (const rel of ['../screens/handwriting/LetterWritingScreen.js',
                       '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
                       '../screens/handwriting/words/WordWritingScreen.js']) {
      expect(readCode(rel)).not.toMatch(/hasPointerPath/);
    }
  });
});

// ─── the diagnostics are gone ───────────────────────────────────────────
//
// The instrumentation that found this bug (canvasTouchDiagnostics.js, the
// [canvas:*]/[touch:*] logs and the two on-screen fingertip markers) was
// deleted once the fix was confirmed on device. These assertions stop any of
// it drifting back in.

describe('no diagnostic instrumentation remains', () => {
  const SURFACES = [
    ...SCREENS,
    '../components/handwriting/LetterWritingStage.js',
    '../components/handwriting/ShapeAssessmentStage.js',
    '../components/handwriting/WordWritingStage.js',
  ];

  it('the diagnostics module is deleted', () => {
    expect(fs.existsSync(path.resolve(__dirname, './canvasTouchDiagnostics.js'))).toBe(false);
  });

  it.each(SURFACES)('%s has no diagnostic identifier left', (rel) => {
    const src = read(rel);   // raw, comments included — the strings must be gone entirely
    for (const leftover of [
      'canvasTouchDiagnostics', 'recordSvgLayout', 'logCanvasLayout', 'logTouchSample',
      'SHOW_TOUCH_MARKERS', 'debugRawTouch', 'debugMappedTouch', 'diagTag',
      'canvasSizeRef', 'loggedCanvasSizeRef', 'ORIGIN DELTA', 'fracDown',
      'measuredOuter', 'svgSurface', 'originWindow', '[touch:', '[canvas:',
    ]) {
      expect(src).not.toContain(leftover);
    }
  });

  it.each(SURFACES)('%s renders no debug marker', (rel) => {
    const code = readCode(rel);
    expect(code).not.toMatch(/#FF00AA|#00C8C8/);         // the magenta cross / teal ring
    expect(code).not.toMatch(/MARKER [AB]/);
  });

  it('the genuine tracer dot — which predates all of this — is untouched', () => {
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    expect(stage).toMatch(/styles\.tracerDot/);
    expect(stage).toMatch(/translateX: tracerXInterp/);
    expect(stage).toMatch(/translateY: tracerYInterp/);
    // and the ghost letter, start marker and 4-line ruling
    expect(stage).toMatch(/getGhostDots\(rawPath\)/);
    expect(stage).toMatch(/supportPresentation\?\.showStartMarker/);
  });

  it('the shared stage takes no diagnostic props', () => {
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    const sig = stage.slice(stage.indexOf('export default function LetterWritingStage('),
                            stage.indexOf('}) {'));
    expect(sig).not.toMatch(/debug|diag/i);
  });

  it('measureCanvasOrigin does nothing but capture the origin', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      const fn = code.slice(code.indexOf('const measureCanvasOrigin'),
                            code.indexOf('}, []);', code.indexOf('const measureCanvasOrigin')));
      expect(fn).toMatch(/canvasOriginRef\.current = \{ x: pageX, y: pageY \};/);
      expect(fn).not.toMatch(/console\.|log[A-Z]|nativeEvent/);
    }
  });

  it('no canvas or stage logs on layout or on touch', () => {
    for (const rel of SURFACES) {
      const code = readCode(rel);
      // Pre-existing product logging ([DTW debug], [NORMAL_LETTER_CYCLE], ...)
      // is untouched; nothing may log from the layout or responder path.
      const responder = code.slice(code.indexOf('PanResponder.create('),
                                   code.indexOf('onPanResponderRelease'));
      expect(responder).not.toMatch(/console\./);
    }
  });
});
