// One-time handwriting demonstrations.
//
// The two things this suite exists to prove, above everything else:
//   1. a demonstration is shown where a NEW interaction begins and NOWHERE
//      else — nine moments in the whole programme, not one per activity;
//   2. watching a demonstration cannot produce handwriting data of any kind.
//
// Uses AsyncStorage's own bundled in-memory jest mock; no device involved.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

import fs from 'fs';
import path from 'path';

const AsyncStorage = require('@react-native-async-storage/async-storage');

import {
  DEMO_KEYS, ALL_DEMO_KEYS, DEMO_TYPES, DEMO_COPY,
  makeLetterCategoryDemoKey, isValidDemoKey, shouldShowDemo, getDemoPresentation,
} from './demoPolicy';
import {
  buildLetterDemoTimeline, buildWordDemoTimeline, buildShapeDemoTimeline,
  fitStrokesToBox, sampleStraightStroke, toPolylinePoints,
  ANGULAR_LOWERCASE, ANGULAR_UPPERCASE,
} from './demoPlayback';
import {
  isDemoInFlight, claimDemoNavigation, releaseDemoNavigation, resetDemoGuard,
} from './demoGuard';
import { getShownDemos, markDemoShown, clearShownDemos } from './storage';
import { claimDemoIfDue } from './demoDetour';
import { CATEGORIES } from '../constants/letterCategories';
import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from '../constants/activityPreviewLetterPaths';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

// The data-isolation scan looks at CODE, not prose — these files explain at
// length what they deliberately do not touch, and those explanations must not
// register as violations of themselves.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const demoComponent = read('../components/handwriting/HandwritingDemo.js');
const demoScreen    = read('../screens/handwriting/HandwritingDemoScreen.js');
const letterScreen  = read('../screens/handwriting/LetterWritingScreen.js');
const upperScreen   = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');
const welcomeScreen = read('../screens/handwriting/StudentWelcomeScreen.js');
const wordWriting   = read('../screens/handwriting/words/WordWritingScreen.js');
const wordActivity  = read('../screens/handwriting/words/WordActivityScreen.js');
const navigator     = read('../navigation/HandwritingNavigator.js');
const shapeScreen   = read('../screens/handwriting/ShapeAssessmentScreen.js');
const letterStage   = read('../components/handwriting/LetterWritingStage.js');
const wordStage     = read('../components/handwriting/WordWritingStage.js');
const shapeStage    = read('../components/handwriting/ShapeAssessmentStage.js');
const exerciseD     = read('../components/word/ExerciseD_SpellWord.js');
const demoAnim      = read('../components/handwriting/useDemoPathAnimation.js');

const CANVAS = { canvasW: 520, canvasH: 300 };

beforeEach(async () => {
  resetDemoGuard();
  await AsyncStorage.clear();
});

// ─── The policy: nine demos, and no more ────────────────────────────────

describe('the demo catalogue', () => {
  it('is exactly the nine agreed keys', () => {
    expect([...ALL_DEMO_KEYS].sort()).toEqual([
      'initial_shape_assessment',
      'lowercase_curved', 'lowercase_mixed', 'lowercase_straight',
      'uppercase_curved', 'uppercase_mixed', 'uppercase_straight',
      'word_activity_spell_tiles', 'word_writing_intro',
    ].sort());
  });

  it('derives its size rather than hardcoding a count', () => {
    // The first audit tallied "8" by leaving the assessment key out. A
    // literal in the code would have carried that mistake forward.
    expect(ALL_DEMO_KEYS.length).toBe(Object.keys(DEMO_KEYS).length);
    expect(read('./demoPolicy.js')).not.toMatch(/length\s*===?\s*[89]\b/);
  });

  it('uses the REAL letter taxonomy, not an invented one', () => {
    for (const category of Object.values(CATEGORIES)) {
      expect(makeLetterCategoryDemoKey({ caseType: 'lowercase', category })).toBe(`lowercase_${category}`);
      expect(makeLetterCategoryDemoKey({ caseType: 'uppercase', category })).toBe(`uppercase_${category}`);
    }
    expect(Object.values(CATEGORIES).sort()).toEqual(['curved', 'mixed', 'straight']);
  });

  it('returns null for an unknown category or case rather than inventing a key', () => {
    expect(makeLetterCategoryDemoKey({ caseType: 'lowercase', category: 'diagonal' })).toBeNull();
    expect(makeLetterCategoryDemoKey({ caseType: 'cursive', category: 'curved' })).toBeNull();
    expect(makeLetterCategoryDemoKey({})).toBeNull();
    expect(makeLetterCategoryDemoKey()).toBeNull();
  });

  it('every key has calm, one-instruction-at-a-time wording', () => {
    for (const key of ALL_DEMO_KEYS) {
      const p = getDemoPresentation(key);
      expect(p).not.toBeNull();
      expect(p.title).toBe('Watch first.');
      expect(p.instruction.length).toBeLessThan(40);
      expect([DEMO_TYPES.PATH, DEMO_TYPES.TAP]).toContain(p.type);
    }
    expect(DEMO_COPY.NOW_YOU_TRY).toBe('Now you try.');
    expect(DEMO_COPY.READY).toBe("I'm Ready");
  });

  it('only the tile-spelling demo is a tap demo', () => {
    const tap = ALL_DEMO_KEYS.filter((k) => getDemoPresentation(k).type === DEMO_TYPES.TAP);
    expect(tap).toEqual([DEMO_KEYS.WORD_ACTIVITY_SPELL_TILES]);
  });
});

describe('shouldShowDemo', () => {
  it('shows a demo the child has not completed', () => {
    expect(shouldShowDemo({ demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT, shownKeys: [] })).toBe(true);
  });

  it('does NOT show one they have', () => {
    expect(shouldShowDemo({
      demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT, shownKeys: ['lowercase_straight'],
    })).toBe(false);
  });

  it('treats a not-yet-loaded list as "do not show" — never as "nothing shown"', () => {
    // The dangerous direction is replaying a tutorial the child finished.
    expect(shouldShowDemo({ demoKey: DEMO_KEYS.LOWERCASE_CURVED, shownKeys: null })).toBe(false);
    expect(shouldShowDemo({ demoKey: DEMO_KEYS.LOWERCASE_CURVED, shownKeys: undefined })).toBe(false);
  });

  it('never detours the controlled-trajectory research protocol', () => {
    expect(shouldShowDemo({
      demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT, shownKeys: [], collectionMode: true,
    })).toBe(false);
  });

  it('stands down while a navigation is already in flight', () => {
    expect(shouldShowDemo({
      demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT, shownKeys: [], inFlight: true,
    })).toBe(false);
  });

  it('refuses an unknown key', () => {
    expect(shouldShowDemo({ demoKey: 'lowercase_diagonal', shownKeys: [] })).toBe(false);
    expect(shouldShowDemo({ demoKey: null, shownKeys: [] })).toBe(false);
    expect(isValidDemoKey('word_writing_intro')).toBe(true);
    expect(isValidDemoKey('word_writing')).toBe(false);
  });

  it('accepts a Set as readily as an array', () => {
    expect(shouldShowDemo({
      demoKey: DEMO_KEYS.LOWERCASE_MIXED, shownKeys: new Set(['lowercase_mixed']),
    })).toBe(false);
  });
});

// ─── Geometry: the demo animates the REAL reference path ────────────────

describe('demo geometry comes from the real activity, never from new data', () => {
  it('a letter demo uses the same waypoints the writing screen traces', () => {
    const timeline = buildLetterDemoTimeline({ letter: 'l', caseType: 'lowercase', ...CANVAS });
    expect(timeline).not.toBeNull();
    // 'l' is a single vertical stroke from cap line to baseline.
    expect(timeline.strokes).toHaveLength(1);
    const raw = LOWERCASE_LETTER_PATHS.l;
    expect(timeline.startPoint.y).toBeCloseTo(raw[0].fy * CANVAS.canvasH, 5);
  });

  it('a multi-stroke letter is played one stroke at a time', () => {
    const timeline = buildLetterDemoTimeline({ letter: 'k', caseType: 'lowercase', ...CANVAS });
    expect(timeline.strokes.length).toBe(3); // k = stem + two diagonals
    // Strokes never overlap in the shared input range, so the pointer can
    // jump between them instead of drawing a connecting line.
    for (let i = 1; i < timeline.strokes.length; i++) {
      expect(timeline.strokes[i].start).toBeGreaterThan(timeline.strokes[i - 1].end);
    }
  });

  it('uppercase and lowercase resolve to their own path tables', () => {
    const lower = buildLetterDemoTimeline({ letter: 'c', caseType: 'lowercase', ...CANVAS });
    const upper = buildLetterDemoTimeline({ letter: 'C', caseType: 'uppercase', ...CANVAS });
    expect(lower.startPoint).not.toEqual(upper.startPoint);
    expect(UPPERCASE_LETTER_PATHS.C).toBeDefined();
  });

  it('the dot on i/j is held, never silently dropped', () => {
    const timeline = buildLetterDemoTimeline({ letter: 'i', caseType: 'lowercase', ...CANVAS });
    expect(timeline.strokes).toHaveLength(2);
  });

  it('an unmapped letter yields NO demo rather than a demo of another letter', () => {
    expect(buildLetterDemoTimeline({ letter: 'ß', caseType: 'lowercase', ...CANVAS })).toBeNull();
    expect(buildLetterDemoTimeline({ letter: '', caseType: 'lowercase', ...CANVAS })).toBeNull();
    expect(buildLetterDemoTimeline({ letter: 'a', caseType: 'lowercase', canvasW: 0, canvasH: 0 })).toBeNull();
  });

  it('stroke durations come from the shared tracer-speed helper', () => {
    const timeline = buildLetterDemoTimeline({ letter: 'o', caseType: 'lowercase', ...CANVAS });
    // The 600 ms floor from constants/demoSpeedLevels.js — the SAME pace the
    // child already sees in Attempt 1, not a demo-only speed.
    for (const stroke of timeline.strokes) {
      expect(stroke.durationMs).toBeGreaterThanOrEqual(600);
    }
    expect(timeline.totalDurationMs).toBeGreaterThan(600);
    expect(read('./demoPlayback.js')).toMatch(/getStrokeDurationForLevel/);
  });

  it('a slow speed level lengthens the demo, it does not change the path', () => {
    const standard = buildLetterDemoTimeline({ letter: 'o', caseType: 'lowercase', ...CANVAS, speedLevel: 'standard' });
    const slow     = buildLetterDemoTimeline({ letter: 'o', caseType: 'lowercase', ...CANVAS, speedLevel: 'slow' });
    expect(slow.keyframes.xRange).toEqual(standard.keyframes.xRange);
    expect(slow.totalDurationMs).toBeGreaterThan(standard.totalDurationMs);
  });

  it('the angular-letter sets match the writing screens own sets', () => {
    // A demo that smoothed 'k' or 'z' would teach a different movement.
    for (const ch of ['v', 'w', 'z', 'x', 'y', 'k', 'l']) expect(ANGULAR_LOWERCASE.has(ch)).toBe(true);
    for (const ch of ['V', 'W', 'Z', 'X', 'Y', 'K', 'L', 'A', 'E', 'M', 'N', 'T', 'I', 'H', 'F']) {
      expect(ANGULAR_UPPERCASE.has(ch)).toBe(true);
    }
    expect(ANGULAR_LOWERCASE.has('o')).toBe(false);
  });

  it('a word demo animates the real composed word guide, in writing order', () => {
    const buildWordGuide = jest.fn(() => ({
      strokeDescriptors: [
        { points: [{ fx: 0.1, fy: 0.3 }, { fx: 0.2, fy: 0.6 }], angular: false },
        { points: [{ fx: 0.3, fy: 0.3 }, { fx: 0.4, fy: 0.6 }], angular: false },
      ],
    }));
    const buildWordTracerStrokes = jest.fn((descriptors, w, h) =>
      descriptors.map((d) => ({
        points: d.points.map((p) => ({ x: p.fx * w, y: p.fy * h })), totalLength: 100,
      })));

    const timeline = buildWordDemoTimeline({
      word: 'cat', ...CANVAS, buildWordGuide, buildWordTracerStrokes,
    });
    expect(buildWordGuide).toHaveBeenCalledWith('cat');
    expect(timeline.strokes).toHaveLength(2);
    expect(timeline.startPoint.x).toBeCloseTo(0.1 * CANVAS.canvasW, 5);
  });

  it('a word with no mapped letters yields no demo', () => {
    const empty = () => ({ strokeDescriptors: [] });
    expect(buildWordDemoTimeline({
      word: '???', ...CANVAS, buildWordGuide: empty, buildWordTracerStrokes: () => [],
    })).toBeNull();
    expect(buildWordDemoTimeline({ word: '', ...CANVAS })).toBeNull();
  });

  it('a shape demo uses the scoring template itself, only rescaled to fit', () => {
    const computeShapeTemplate = jest.fn(() => (
      Array.from({ length: 20 }, (_, i) => ({ x: 60 + i * 40, y: 150 }))
    ));
    const timeline = buildShapeDemoTimeline({
      shapeId: 'horizontal_line', ...CANVAS, computeShapeTemplate,
    });
    expect(computeShapeTemplate).toHaveBeenCalledWith('horizontal_line', CANVAS.canvasW, CANVAS.canvasH);
    expect(timeline.strokes).toHaveLength(1);
    // Everything drawn lands inside the demo canvas.
    for (const p of timeline.polylines[0]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(CANVAS.canvasW);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(CANVAS.canvasH);
    }
  });

  it('the assessment demo does NOT rescale the template', () => {
    // The template is already in the assessment canvas's coordinates, and the
    // pointer has to run along the very dashed guide GuideShape draws. Any
    // rescale would slide it off.
    const template = Array.from({ length: 20 }, (_, i) => ({ x: 60 + i * 40, y: 150 }));
    const timeline = buildShapeDemoTimeline({
      shapeId: 'horizontal_line', ...CANVAS,
      computeShapeTemplate: () => template, fitToCanvas: false,
    });
    expect(timeline.polylines[0][0]).toEqual({ x: 60, y: 150 });
    expect(timeline.startPoint).toEqual({ x: 60, y: 150 });
  });

  it('fitting preserves shape — it scales uniformly, never stretches', () => {
    const square = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]];
    const [fitted] = fitStrokesToBox(square, { width: 400, height: 200, padding: 20 });
    const w = Math.max(...fitted.map((p) => p.x)) - Math.min(...fitted.map((p) => p.x));
    const h = Math.max(...fitted.map((p) => p.y)) - Math.min(...fitted.map((p) => p.y));
    expect(w).toBeCloseTo(h, 5);
  });

  it('never throws on malformed geometry', () => {
    expect(() => fitStrokesToBox([], { width: 10, height: 10 })).not.toThrow();
    expect(() => fitStrokesToBox([[{ x: NaN, y: NaN }]], { width: 10, height: 10 })).not.toThrow();
    expect(sampleStraightStroke(null, 10, 100, 100)).toEqual({ points: [], totalLength: 0 });
    expect(toPolylinePoints(null)).toBe('');
    expect(toPolylinePoints([{ x: 1, y: 2 }, { x: NaN, y: 3 }])).toBe('1.0,2.0');
  });
});

// ─── Persistence + the in-flight latch ──────────────────────────────────

describe('demo completion state', () => {
  it('starts empty and records a completed demo', async () => {
    expect(await getShownDemos(7)).toEqual([]);
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    expect(await getShownDemos(7)).toEqual(['lowercase_straight']);
  });

  it('is per-student — one child never consumes another child\'s demo', async () => {
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_CURVED);
    expect(await getShownDemos(7)).toEqual(['lowercase_curved']);
    expect(await getShownDemos(8)).toEqual([]);
  });

  it('lives in persistent storage, so it survives an app restart', async () => {
    await markDemoShown(7, DEMO_KEYS.WORD_WRITING_INTRO);
    // The record is on disk under the student-scoped key, not in module
    // memory — which is exactly what a restart preserves. (The in-flight
    // latch, which must NOT survive, is asserted separately below.)
    expect(JSON.parse(await AsyncStorage.getItem('student_7_demosShown')))
      .toEqual(['word_writing_intro']);
    expect(await getShownDemos(7)).toEqual(['word_writing_intro']);
  });

  it('is idempotent and additive — two screens cannot erase each other', async () => {
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    await markDemoShown(7, DEMO_KEYS.UPPERCASE_CURVED);
    expect(await getShownDemos(7)).toEqual(['lowercase_straight', 'uppercase_curved']);
  });

  it('a corrupt stored value reads as "none completed", so the child still gets the demo', async () => {
    await AsyncStorage.setItem('student_7_demosShown', '{"not":"an array"}');
    expect(await getShownDemos(7)).toEqual([]);
  });

  it('ignores an empty key rather than storing a nameless entry', async () => {
    await markDemoShown(7, '');
    expect(await getShownDemos(7)).toEqual([]);
  });
});

describe('the in-flight latch', () => {
  it('lets the first claim through and blocks the second', () => {
    expect(claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(true);
    expect(claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(false);
    expect(isDemoInFlight(7, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(true);
  });

  it('is scoped per student and per key', () => {
    claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    expect(isDemoInFlight(8, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(false);
    expect(isDemoInFlight(7, DEMO_KEYS.LOWERCASE_CURVED)).toBe(false);
    expect(claimDemoNavigation(8, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(true);
  });

  it('does NOT survive a restart — a crash mid-demo must re-offer it', () => {
    claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    jest.resetModules();
    const fresh = require('./demoGuard');
    expect(fresh.isDemoInFlight(7, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(false);
  });

  it('refuses invalid input instead of latching a nonsense key', () => {
    expect(claimDemoNavigation(null, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(false);
    expect(claimDemoNavigation(7, 'not_a_demo')).toBe(false);
    expect(isDemoInFlight(undefined, undefined)).toBe(false);
  });

  it('can be released for a deliberate re-offer', () => {
    claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    releaseDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    expect(claimDemoNavigation(7, DEMO_KEYS.LOWERCASE_STRAIGHT)).toBe(true);
  });
});

describe('claimDemoIfDue — read, decide, claim, in that order', () => {
  it('is due once, then never again for that child', async () => {
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT })).toBe(true);

    // The child completes it.
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    resetDemoGuard();
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT })).toBe(false);
  });

  it('a second concurrent check does not produce a second demo', async () => {
    const [a, b] = await Promise.all([
      claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_CURVED }),
      claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_CURVED }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('a crash before "I\'m Ready" leaves it due again next launch', async () => {
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_MIXED })).toBe(true);
    // Nothing was persisted — the child never pressed the button.
    expect(await getShownDemos(7)).toEqual([]);
    resetDemoGuard(); // process restart
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_MIXED })).toBe(true);
  });

  it('categories are independent — completing one does not consume another', async () => {
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT })).toBe(false);
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_CURVED })).toBe(true);
    expect(await claimDemoIfDue({ studentId: 7, demoKey: DEMO_KEYS.UPPERCASE_STRAIGHT })).toBe(true);
  });

  it('never runs in collection mode', async () => {
    expect(await claimDemoIfDue({
      studentId: 7, demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT, collectionMode: true,
    })).toBe(false);
  });

  it('resolves false rather than throwing when there is no student', async () => {
    await expect(claimDemoIfDue({ studentId: null, demoKey: DEMO_KEYS.LOWERCASE_STRAIGHT }))
      .resolves.toBe(false);
    await expect(claimDemoIfDue({ studentId: 7, demoKey: null })).resolves.toBe(false);
  });
});

// ─── Where the demos are wired in ───────────────────────────────────────

describe('initial assessment', () => {
  it('the demo sits between the welcome screen and the real assessment', () => {
    expect(welcomeScreen).toMatch(/claimDemoIfDue\(\{[\s\S]*?DEMO_KEYS\.INITIAL_SHAPE_ASSESSMENT/);
    expect(welcomeScreen).toMatch(/nextRoute: 'ShapeAssessment'/);
    expect(welcomeScreen).toMatch(/if \(!due\) \{\s*\n\s*navigation\.navigate\('ShapeAssessment'/);
  });

  it('demonstrates ONE representative shape, not six', () => {
    expect(welcomeScreen).toMatch(/shapeId: 'horizontal_line'/);
    expect((welcomeScreen.match(/HandwritingDemo/g) ?? []).length).toBe(1);
    // ShapeAssessmentScreen itself was not given per-shape demo navigation.
    expect(read('../screens/handwriting/ShapeAssessmentScreen.js')).not.toMatch(/HandwritingDemo|demoPolicy|demoDetour/);
  });
});

describe('letter categories', () => {
  for (const [label, source, route] of [
    ['lowercase', letterScreen, 'LetterWriting'],
    ['uppercase', upperScreen, 'UppercaseWriting'],
  ]) {
    describe(label, () => {
      const block = source.slice(source.indexOf('const categoryDemoKey'),
        source.indexOf('const categoryDemoKey') + 2200);

      it('keys the demo off the real category of the current letter', () => {
        expect(block).toMatch(/makeLetterCategoryDemoKey\(\{\s*\n?\s*caseType, category: letterObj\?\.category,/);
      });

      it('fires BEFORE Attempt 1 and never mid-work', () => {
        expect(block).toMatch(/enabled: attempt === 1 && !hasDrawn/);
      });

      it('demonstrates the REAL target letter, not a stand-in', () => {
        expect(block).toMatch(/letter, caseType,/);
        expect(block).not.toMatch(/letter: '[a-z]'/i);
      });

      it('returns to the same activity with the same target letter still active', () => {
        expect(block).toMatch(new RegExp(`nextRoute: '${route}'`));
        expect(block).toMatch(/letterSequence: sequence\.slice\(letterIdx\)/);
        expect(block).toMatch(/collectionMode, collectionSessionId, interactionId/);
      });

      it('never runs in collection mode', () => {
        expect(block).toMatch(/collectionMode,/);
      });

      it('leaves the three real attempts and the Attempt-1 tracer untouched', () => {
        // The demo added no attempt arithmetic and removed no support.
        expect(block).not.toMatch(/setAttempt|attempt \+ 1|isLastAttempt/);
        expect(source).toMatch(/showAnimatedTracer/);
        expect(source).toMatch(/const \[attempt,\s+setAttempt\]\s+= useState\(1\)/);
      });
    });
  }

  it('the second letter of a category gets no demo — the key is already spent', async () => {
    // Letter 1 of lowercase straight.
    expect(await claimDemoIfDue({
      studentId: 7, demoKey: makeLetterCategoryDemoKey({ caseType: 'lowercase', category: CATEGORIES.STRAIGHT }),
    })).toBe(true);
    await markDemoShown(7, 'lowercase_straight');
    resetDemoGuard();

    // Letter 2 of the SAME category.
    expect(await claimDemoIfDue({
      studentId: 7, demoKey: makeLetterCategoryDemoKey({ caseType: 'lowercase', category: CATEGORIES.STRAIGHT }),
    })).toBe(false);

    // A NEW category still gets its own.
    expect(await claimDemoIfDue({
      studentId: 7, demoKey: makeLetterCategoryDemoKey({ caseType: 'lowercase', category: CATEGORIES.CURVED }),
    })).toBe(true);
  });
});

describe('word writing', () => {
  const block = wordWriting.slice(wordWriting.indexOf('const hasIntroVideo'),
    wordWriting.indexOf('const hasIntroVideo') + 1400);

  it('introduces word writing once, with the whole word', () => {
    expect(block).toMatch(/DEMO_KEYS\.WORD_WRITING_INTRO/);
    expect(block).toMatch(/word: wordEntry\.word/);
    expect(block).toMatch(/nextRoute: 'WordWriting'/);
  });

  it('stands down when the word already has an intro video — no stacked tutorials', () => {
    expect(block).toMatch(/const hasIntroVideo = !!\(wordEntry && WORD_VIDEOS\[wordEntry\.word\]\)/);
    expect(block).toMatch(/enabled: .*!hasIntroVideo/);
  });

  it('fires before the first attempt only', () => {
    expect(block).toMatch(/attempt === 1 && !hasDrawn/);
  });

  it('resumes the same word at the same index', () => {
    expect(block).toMatch(/buildWordRouteParams\(\{[\s\S]*?currentWordIndex,/);
  });
});

describe('word activities', () => {
  const demoStart = wordActivity.indexOf('useDemoDetour({');
  const block = wordActivity.slice(demoStart, demoStart + 1400);

  it('only Exercise D gets a demo', () => {
    expect(block).toMatch(/enabled: currentExercise === 'D'/);
    expect(block).toMatch(/DEMO_KEYS\.WORD_ACTIVITY_SPELL_TILES/);
    // Exactly one demo detour in the whole screen — A, B, C and E get none.
    expect((wordActivity.match(/useDemoDetour\(/g) ?? []).length).toBe(1);
    for (const other of ["=== 'A'", "=== 'B'", "=== 'C'", "=== 'E'"]) {
      expect(block).not.toContain(other);
    }
  });

  it('is a tap demo built from the child\'s own current word', () => {
    expect(block).toMatch(/tapLetters: spellDemoLetters/);
    expect(getDemoPresentation(DEMO_KEYS.WORD_ACTIVITY_SPELL_TILES).type).toBe(DEMO_TYPES.TAP);
  });

  it('calls no scoring or evaluation function with the example', () => {
    expect(block).not.toMatch(/evaluate|score|saveWordActivity|submitWord|onComplete/i);
  });

  it('returns the child to Exercise D, not back to Exercise A', () => {
    expect(block).toMatch(/initialExerciseIndex: exIdx/);
    expect(wordActivity).toMatch(/route\.params\?\.initialExerciseIndex/);
    // And the seed is bounded, so a bad param cannot skip past the registry.
    expect(wordActivity).toMatch(/requested < WORD_EXERCISE_COUNT/);
  });

  it('Exercise E is left alone — the same canvas word writing already introduced', () => {
    expect(read('../components/word/ExerciseE_WriteWord.js')).not.toMatch(/HandwritingDemo|demoPolicy|demoDetour/);
  });

  for (const ex of ['A_WriteFirst', 'B_CircleImage', 'C_FillBlank', 'D_SpellWord']) {
    it(`Exercise ${ex[0]} itself is unmodified`, () => {
      expect(read(`../components/word/Exercise${ex}.js`)).not.toMatch(/HandwritingDemo|demoPolicy|demoDetour/);
    });
  }
});

// ─── Navigation, orientation, hardware back ─────────────────────────────

describe('navigation contract', () => {
  it('the demo is a registered route in the handwriting stack', () => {
    expect(navigator).toMatch(/name="HandwritingDemo"/);
    expect(navigator).toMatch(/component=\{HandwritingDemoScreen\}/);
  });

  it('the only exit forwards the caller\'s params verbatim', () => {
    expect(demoScreen).toMatch(/navigation\.replace\(nextRoute, nextParams\)/);
    // Never rebuilt, so nothing the origin screen needs can be lost.
    expect(demoScreen).not.toMatch(/nextParams = \{|\.\.\.nextParams,/);
  });

  it('completion is recorded on "I\'m Ready" and nowhere else', () => {
    const ready = demoScreen.slice(demoScreen.indexOf('const handleReady'),
      demoScreen.indexOf('return (', demoScreen.indexOf('const handleReady')));
    expect(ready).toMatch(/markDemoShown\(student\.sid, demoKey\)/);
    expect((demoScreen.match(/markDemoShown/g) ?? []).length).toBe(2); // import + the one call
  });

  it('is locked landscape, like every other child-facing handwriting screen', () => {
    expect(demoScreen).toMatch(/useLockLandscape\(\)/);
    // Every origin and destination screen keeps its own lock, so a demo
    // cannot hand back a portrait screen.
    for (const src of [letterScreen, upperScreen, wordWriting, wordActivity, welcomeScreen]) {
      expect(src).toMatch(/useLockLandscape\(\)/);
    }
  });

  it('hardware back out of the demo is safe: no persistent mark, no loop', () => {
    // Nothing was written, so the demo is still due; and the in-memory latch
    // stops the origin screen re-navigating on its remount this session.
    expect(demoScreen).not.toMatch(/BackHandler|hardwareBackPress/);
    expect(read('./demoDetour.js')).toMatch(/claimDemoNavigation/);
  });

  it('goes back rather than crashing if a caller forgot nextRoute', () => {
    expect(demoScreen).toMatch(/else navigation\.goBack\(\)/);
  });
});

// ─── Data isolation — the mandatory part ────────────────────────────────

describe('a demonstration cannot produce handwriting data', () => {
  const demoFiles = {
    'HandwritingDemo.js': demoComponent,
    'HandwritingDemoScreen.js': demoScreen,
    'demoPlayback.js': read('./demoPlayback.js'),
    'demoPolicy.js': read('./demoPolicy.js'),
    'demoGuard.js': read('./demoGuard.js'),
    'demoDetour.js': read('./demoDetour.js'),
  };

  const FORBIDDEN = [
    // Attempt / trajectory / assessment writes
    'handwritingApi', 'wordApi', 'submitAttempt', 'submitWordAttempt',
    'saveWordActivity', 'LetterAttempt', 'ShapeFeature', 'trajectory',
    'collectionSession', 'buildSessionAttemptRecord',
    // Scores and progression
    // `computeShapeTemplate` from unifiedShapeScoreMirror.js is deliberately
    // ALLOWED: it is pure geometry — the same template the assessment's own
    // pointer follows — and computes nothing. The SCORING functions that
    // share that module are what must never be reachable from here.
    'motorScore', 'motor_score', 'computeUnifiedShapeScore', 'computeInvariantDtwDistance',
    'storeLetterProgress', 'LetterProgress', 'mastery', 'mastered',
    // Adaptivity / models / reporting
    'adaptiveSequencing', 'recommendation', 'letterMotorState', 'motorCluster',
    'writingCheck', 'WritingCheck', 'familyThresholds', 'explainability',
  ];

  for (const [name, source] of Object.entries(demoFiles)) {
    it(`${name} touches none of the handwriting data path`, () => {
      const code = stripComments(source);
      for (const forbidden of FORBIDDEN) {
        expect(code).not.toContain(forbidden);
      }
    });
  }

  it('no demo file imports the api layer at all', () => {
    for (const [name, source] of Object.entries(demoFiles)) {
      expect(source).not.toMatch(/from '.*\/api(\/|')/);
      expect(source).not.toMatch(/fetch\(|axios/);
    }
  });

  it('the demo component has no writable canvas and no touch capture', () => {
    expect(stripComments(demoComponent)).not.toMatch(/PanResponder|onStartShouldSetResponder|onTouchMove/);
    expect(stripComments(demoScreen)).not.toMatch(/PanResponder/);
  });

  it('the demo shows no score, attempt, mastery, cluster or model information', () => {
    // What the child SEES — the rendered source, with the explanatory
    // comments stripped out.
    const code = [stripComments(demoComponent), stripComments(demoScreen)];
    for (const banned of [/Attempt \d/, /Score/, /Motor Score/, /Pattern [AB]/, /cluster/i]) {
      for (const source of code) expect(source).not.toMatch(banned);
    }
  });

  it('the ONLY thing a completed demo writes is its own key', async () => {
    await markDemoShown(7, DEMO_KEYS.LOWERCASE_STRAIGHT);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toEqual(['student_7_demosShown']);
    // Not the letter sequence, not progress, not completed letters.
    expect(keys.some((k) => /progress|Sequence|completed|motorProfile/i.test(k))).toBe(false);
  });
});

// ─── Replay ─────────────────────────────────────────────────────────────

describe('Replay', () => {
  const replayHandler = demoScreen.slice(demoScreen.indexOf('const handleReplay'),
    demoScreen.indexOf('function renderActivity'));

  it('restarts the animation and nothing else', () => {
    expect(replayHandler).toMatch(/setPlayToken\(\(t\) => t \+ 1\)/);
    // No navigation, no completion mark, no attempt reset, no network.
    expect(replayHandler).not.toMatch(/navigation|markDemoShown|setAttempt|replace\(/);
  });

  it('is driven purely by a local counter the animation depends on', () => {
    expect(demoScreen).toMatch(/const \[playToken, setPlayToken\] = useState\(0\)/);
    expect(demoAnim).toMatch(/\[timeline, playToken, reduceMotion\]/);
    expect(exerciseD).toMatch(/\[demoMode, demoPlayToken\]/);
  });

  it('does not mark the demo complete - only "I\'m Ready" does', () => {
    expect(demoComponent).not.toMatch(/markDemoShown/);
    expect(demoComponent).toMatch(/onPress=\{onReady\}/);
    expect(demoComponent).toMatch(/onPress=\{onReplay\}/);
  });

  it('respects the OS reduce-motion setting', () => {
    expect(demoAnim).toMatch(/if \(reduceMotion\) \{/);
    expect(demoScreen).toMatch(/reduceMotion/);
  });
});

// ─── Visual parity: the demo IS the activity ────────────────────────────

describe('the demo renders the real activity, not a substitute', () => {
  it('the overlay component draws no activity interface of its own', () => {
    // Its whole job is the frame: a title, an instruction, and two buttons.
    const code = stripComments(demoComponent);
    expect(code).not.toMatch(/<Svg|Polyline|Circle |Animated\.Value|interpolate/);
    expect(code).toMatch(/\{children\}/);
  });

  it('every demo type mounts the activity\'s OWN component', () => {
    expect(demoScreen).toMatch(/<LetterWritingStage\s*\n\s*mode="demo"/);
    expect(demoScreen).toMatch(/<WordWritingStage\s*\n\s*mode="demo"/);
    expect(demoScreen).toMatch(/<ShapeAssessmentStage\s*\n\s*mode="demo"/);
    expect(demoScreen).toMatch(/<ExerciseD_SpellWord/);
    expect(demoScreen).toMatch(/demoMode/);
  });

  it('LETTER: the real screens render the same stage, in practice mode', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/<LetterWritingStage\s*\n\s*mode="practice"/);
      expect(src).toMatch(/import LetterWritingStage from/);
    }
  });

  it('LETTER: canvas dimensions and ruling come from ONE shared module', () => {
    const layout = read('../constants/letterCanvasLayout.js');
    expect(layout).toMatch(/export const CANVAS_W/);
    expect(layout).toMatch(/export const LINE_1/);
    // No screen or stage redeclares them.
    for (const src of [letterScreen, upperScreen, letterStage, demoScreen]) {
      expect(stripComments(src)).not.toMatch(/^const CANVAS_[WH]\s*=/m);
      expect(stripComments(src)).not.toMatch(/^const LINE_[1-4]\s*=/m);
    }
    expect(letterStage).toMatch(/from '\.\.\/\.\.\/constants\/letterCanvasLayout'/);
    expect(demoScreen).toMatch(/constants\/letterCanvasLayout/);
  });

  it('LETTER: the demo builds its timeline at the REAL canvas size', () => {
    expect(demoScreen).toMatch(/canvasW: LETTER_CANVAS_W, canvasH: LETTER_CANVAS_H/);
  });

  it('LETTER: guide opacity and badge come from the real support presentation', () => {
    // Not a demo-only 0.14 literal - the value Attempt 1 itself resolves to.
    expect(demoScreen).toMatch(/getSupportPresentation\(\{/);
    expect(demoScreen).toMatch(/supportLevel: SUPPORT_LEVELS\.HIGH/);
    expect(demoScreen).toMatch(/guideOpacity=\{DEMO_SUPPORT\.guideOpacity\}/);
    expect(demoScreen).toMatch(/SUPPORT_BADGE\[SUPPORT_LEVELS\.HIGH\]/);
    expect(stripComments(demoScreen)).not.toMatch(/0\.14/);
  });

  it('LETTER: the ghost path builders exist once, in the shared stage', () => {
    for (const fn of ['toSmoothPath', 'toStraightPath', 'getGhostDots']) {
      expect(letterStage).toContain(`function ${fn}(`);
      expect(letterScreen).not.toContain(`function ${fn}(`);
      expect(upperScreen).not.toContain(`function ${fn}(`);
    }
  });

  it('LETTER: the badge vocabulary is defined once', () => {
    // Colours still belong to the stage; the WORDS moved to the shared
    // bilingual instruction source, so the demo, lowercase, uppercase and word
    // writing all say the same sentence for the same support level.
    expect(letterStage).toMatch(/export const SUPPORT_BADGE/);
    expect(letterStage).not.toMatch(/export const SUPPORT_(INSTRUCTIONS|HINTS)/);
    for (const src of [letterScreen, upperScreen]) {
      expect(src).not.toMatch(/^const SUPPORT_BADGE = \{/m);
      expect(src).toMatch(/SUPPORT_BADGE,/);
      expect(src).toMatch(/import \{[^}]*instructionForSupport[^}]*\} from '[^']*childInstructions'/);
      expect(src).not.toMatch(/SUPPORT_INSTRUCTIONS|SUPPORT_HINTS/);
    }
  });

  it('WORD: the real screen and the demo share one stage and one layout module', () => {
    expect(wordWriting).toMatch(/<WordWritingStage\s*\n\s*mode="practice"/);
    const layout = read('../constants/wordCanvasLayout.js');
    expect(layout).toMatch(/export const CANVAS_W/);
    for (const src of [wordWriting, wordStage, demoScreen]) {
      expect(stripComments(src)).not.toMatch(/^const CANVAS_[WH]\s*=/m);
    }
    expect(demoScreen).toMatch(/canvasW: WORD_CANVAS_W, canvasH: WORD_CANVAS_H/);
  });

  it('WORD: the demo uses the real guide, ghost dots and letter boxes', () => {
    expect(demoScreen).toMatch(/buildWordGuide/);
    expect(demoScreen).toMatch(/buildWordTracerStrokes/);
    expect(demoScreen).toMatch(/wordGuideToSvgPath/);
    expect(demoScreen).toMatch(/wordGuideGhostDots/);
    expect(demoScreen).toMatch(/buildWordLetterBoxes/);
    // ...the same helpers the real screen renders from.
    for (const helper of ['wordGuideToSvgPath', 'buildWordLetterBoxes']) {
      expect(wordWriting).toContain(helper);
    }
  });

  it('SHAPE: the real screen and the demo share one stage, one geometry, one template', () => {
    expect(shapeScreen).toMatch(/<ShapeAssessmentStage\s*\n\s*mode="practice"/);
    const layout = read('../constants/shapeCanvasLayout.js');
    expect(layout).toMatch(/export const CANVAS_WIDTH/);
    expect(layout).toMatch(/export const SHAPE_STARTS/);
    for (const src of [shapeScreen, shapeStage, demoScreen]) {
      expect(stripComments(src)).not.toMatch(/^const CANVAS_(WIDTH|HEIGHT)\s*=/m);
    }
    // GuideShape is defined once, in the stage.
    expect(shapeStage).toMatch(/export function GuideShape/);
    expect(shapeScreen).not.toMatch(/function GuideShape/);
    // The template is used as-is, so the pointer runs along GuideShape's own
    // dashed line rather than a rescaled copy of it.
    expect(demoScreen).toMatch(/fitToCanvas: false/);
    expect(demoScreen).toMatch(/Animated\.subtract\(tracerX, POINTER_HALF\)/);
    // Both the demo and the assessment measure against the same template.
    expect(demoScreen).toMatch(/computeShapeTemplate/);
    expect(shapeScreen).toMatch(/computeShapeTemplate/);
    expect(demoScreen).toMatch(/canvasW: SHAPE_CANVAS_W, canvasH: SHAPE_CANVAS_H/);
  });

  it('ACTIVITY D: the demo is the real component, not an imitation of it', () => {
    // Same file, same tiles, same sizes, same fill animation.
    expect(demoScreen).toMatch(/import ExerciseD_SpellWord from '\.\.\/\.\.\/components\/word\/ExerciseD_SpellWord'/);
    expect(exerciseD).toMatch(/demoMode = false, demoPlayToken = 0, onDemoPassComplete,/);
    // The demonstration taps through the activity's OWN handler.
    expect(exerciseD).toMatch(/handleTile\(tileIdx\);/);
    // No second set of tile dimensions anywhere.
    const others = [demoScreen, demoComponent];
    for (const src of others) expect(src).not.toMatch(/tileRow|tileText|width: 62/);
  });
});

// ─── Interaction is off in demo mode, on in practice ────────────────────

describe('demo mode disables interaction; practice mode is untouched', () => {
  for (const [name, stage] of [
    ['LetterWritingStage', letterStage],
    ['WordWritingStage', wordStage],
    ['ShapeAssessmentStage', shapeStage],
  ]) {
    it(`${name} attaches NO pan handlers in demo mode`, () => {
      // Not "attached but ignored" - never attached at all.
      expect(stage).toMatch(/const canvasTouchProps = isDemo\s*\n\s*\? \{ pointerEvents: 'none' \}/);
      expect(stage).toMatch(/\.\.\.\(panHandlers \?\? \{\}\)/);
    });

    it(`${name} draws no child strokes in demo mode`, () => {
      expect(stage).toMatch(/const drawnPaths = isDemo \? \[\] : allPaths;/);
      expect(stage).toMatch(/const livePath\s+= isDemo \? \[\] : currentPath;/);
    });

    it(`${name} still renders the practice interaction exactly as before`, () => {
      expect(stage).toMatch(/mode = [A-Z_]+_MODES\.PRACTICE/);
      expect(stage).toMatch(/ref: canvasRef, onLayout: onCanvasLayout/);
    });
  }

  it('Activity D refuses taps in demo mode and never completes the real activity', () => {
    expect(exerciseD).toMatch(/disabled=\{demoMode\}/);
    expect(exerciseD).toMatch(/if \(demoMode\) onDemoPassComplete\?\.\(\);/);
    expect(exerciseD).toMatch(/else onComplete\(true\);/);
    expect(exerciseD).toMatch(/pointerEvents=\{demoMode \? 'none' : 'auto'\}/);
  });

  it('the demo screen never passes a real completion handler to Activity D', () => {
    expect(demoScreen).toMatch(/onComplete=\{undefined\}/);
    expect(demoScreen).toMatch(/onDemoPassComplete=\{\(\) => setPlayed\(true\)\}/);
  });

  it('the demo tracer feeds the REAL screens tracer props', () => {
    // Same dot, same size, same shadow - it is the same JSX.
    expect(demoScreen).toMatch(/tracerXInterp=\{tracerX\}/);
    expect(demoScreen).toMatch(/tracerYInterp=\{tracerY\}/);
    expect(letterStage).toMatch(/styles\.tracerDot/);
  });
});

// ─── The real activities were not changed to suit the demo ──────────────

describe('the real activities are unchanged', () => {
  it('the three real attempts, and their numbers, are untouched', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/const \[attempt,\s+setAttempt\]\s+= useState\(1\)/);
      expect(src).toMatch(/\[1, 2, 3\]\.map/);
    }
  });

  it('Attempt 1 keeps HIGH support and its own animated tracer', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/showAnimatedTracer/);
    }
    // The stage still gates the practice tracer on the support presentation,
    // exactly as the screens did inline before the move.
    expect(letterStage).toMatch(/supportPresentation\?\.showAnimatedTracer && !hasDrawn/);
  });

  it('the practice screens still own their scoring, submission and progression', () => {
    for (const src of [letterScreen, upperScreen, wordWriting, shapeScreen]) {
      expect(src).toMatch(/PanResponder/);
    }
  });

  it('no real screen imports the demo overlay component', () => {
    for (const src of [letterScreen, upperScreen, wordWriting, wordActivity, shapeScreen]) {
      expect(src).not.toMatch(/HandwritingDemo from/);
    }
  });
});

// ─── Animation driver: left/top can never be native-driven ──────────────
//
// Regression. The device logged, on the initial-shape-assessment demo:
//   ERROR  Style property 'left' is not supported by native animated module
//   ERROR  Style property 'top' is not supported by native animated module
// useDemoPathAnimation drove `progress` with useNativeDriver: true, and
// HandwritingDemoScreen feeds the resulting x/y into ShapeAssessmentStage's
// `left`/`top`. The native module has no layout-prop support, so the shape
// demo's pointer silently never moved. One Animated.Value cannot mix drivers,
// so the shared hook must satisfy its strictest consumer.

describe('demo pointer animation driver', () => {
  const animCode = stripComments(demoAnim);

  it('useDemoPathAnimation never drives its progress value natively', () => {
    expect(animCode).not.toMatch(/useNativeDriver:\s*true/);
  });

  it('every useNativeDriver in the hook is explicitly false', () => {
    const drivers = animCode.match(/useNativeDriver:\s*(true|false)/g) ?? [];
    expect(drivers.length).toBeGreaterThan(0);
    for (const d of drivers) expect(d).toMatch(/false/);
  });

  it('SENTINEL — the strict consumer really does use left/top, not transform', () => {
    // If this ever fails, ShapeAssessmentStage moved to transform and the
    // hook could go back to the native driver. Until then it must not.
    const stageCode = stripComments(shapeStage);
    expect(stageCode).toMatch(/left:\s*pointerLeft/);
    expect(stageCode).toMatch(/top:\s*pointerTop/);
  });

  it('SENTINEL — the demo screen still feeds those nodes into left/top', () => {
    const screenCode = stripComments(demoScreen);
    expect(screenCode).toMatch(/pointerLeft=\{/);
    expect(screenCode).toMatch(/pointerTop=\{/);
  });

  it('the REAL shape assessment screen is untouched and still JS-drives its pointer', () => {
    // Proof the fix was contained to demo playback: the real screen's own
    // pointer animation was already correct and must stay that way.
    const realCode = stripComments(shapeScreen);
    expect(realCode).toMatch(/pointerLeft/);
    expect(realCode).toMatch(/useNativeDriver:\s*false/);
  });
});
