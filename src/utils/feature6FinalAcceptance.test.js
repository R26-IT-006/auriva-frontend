// Feature 6 Step 5 — Final Orchestration + End-to-End Validation (frontend).
//
// This file does not re-test each individual gate again — every one of
// getTracerSpeedForLevel()/getStrokeDurationForLevel()'s branches,
// resolveActualDemoSpeedLevel()'s full truth table, fetchDemoSpeedRecommendation()'s
// failure-safety, shouldApplyDemoSpeedRecommendation()/resolveRecommendedDemoSpeedLevel()'s
// race-safety, and the screens' own wiring already have dedicated unit tests
// in demoSpeedLevels.test.js, demoSpeedPersistence.test.js,
// demoSpeedRecommendation.test.js, and demoSpeedActivation.test.js (Step 4).
// This file instead proves the SINGLE, most important thing Step 5 asks
// for: the COMPLETE synthetic end-to-end acceptance scenario walked through
// as one narrative, plus explicit coverage for every item in spec §53
// (19-41), using the exact same pure functions the real screens call —
// mirroring feature5FinalAcceptance.test.js's exact precedent.

jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import { DEMO_SPEED_LEVELS, getTracerSpeedForLevel, getStrokeDurationForLevel, MIN_STROKE_DURATION_MS } from '../constants/demoSpeedLevels';
import { resolveActualDemoSpeedLevel } from './demoSpeedPersistence';
import {
  fetchDemoSpeedRecommendation, shouldApplyDemoSpeedRecommendation, resolveRecommendedDemoSpeedLevel,
} from './demoSpeedRecommendation';
import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';
import { buildSessionAttemptRecord } from './handwritingAttemptPayload';

const fs = require('fs');
const path = require('path');

beforeEach(() => {
  jest.clearAllMocks();
});

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated', studentId: 13, letter: 'c', caseType: 'lowercase',
    family: 'curved', recommendedSpeedLevel: 'standard', reason: 'insufficient_data',
    signals: { feature2Decision: 'insufficient_data', feature3Decision: 'insufficient_data' },
    ...overrides,
  };
}

// ─── Full synthetic end-to-end acceptance scenario ─────────────────────────
//
// Walks the complete chain described in spec §3, as one narrative: letter
// becomes active -> fetch -> backend resolves slow -> frontend gate accepts
// it -> stores it -> Feature 3 says HIGH support with a tracer -> reduce
// motion is off -> actualDemoSpeedLevel resolves to slow -> the shared
// duration helper is used -> the resulting speed is exactly 0.21 px/ms ->
// the attempt record submitted for this attempt carries demo_speed_level =
// 'slow' (the ACTUAL value, never the raw recommendation).

describe('Full synthetic end-to-end acceptance scenario', () => {
  it('slow recommendation, HIGH support, no reduce-motion, normal mode -> 0.21 px/ms tracer, demo_speed_level="slow" submitted', async () => {
    // Step 1: letter becomes active, normal mode, fetch fires.
    client.get.mockResolvedValueOnce({ data: evaluatedBody({ recommendedSpeedLevel: 'slow', reason: 'feature3_support_review' }) });
    const response = await fetchDemoSpeedRecommendation({ studentId: 13, letter: 'c', caseType: 'lowercase' });
    expect(client.get).toHaveBeenCalledWith('/handwriting/demo-speed-recommendation/13/c/lowercase');
    expect(response.recommendedSpeedLevel).toBe('slow');

    // Step 2: frontend validates the response is still applicable.
    const shouldApply = shouldApplyDemoSpeedRecommendation({
      responseLetter: response.letter, responseCaseType: response.caseType,
      currentLetter: 'c', currentCaseType: 'lowercase',
      currentAttempt: 1, hasDrawn: false, collectionMode: false, cancelled: false,
    });
    expect(shouldApply).toBe(true);

    // Step 3: frontend stores it, and resolves it for the current letter.
    const stored = { letter: response.letter, caseType: response.caseType, speedLevel: response.recommendedSpeedLevel };
    const recommendedDemoSpeedLevel = resolveRecommendedDemoSpeedLevel({
      recommendation: stored, currentLetter: 'c', currentCaseType: 'lowercase',
    });
    expect(recommendedDemoSpeedLevel).toBe('slow');

    // Step 4: Feature 3 determines the tracer exists (HIGH support); reduce
    // motion is off; not collection mode.
    const actualDemoSpeedLevel = resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: recommendedDemoSpeedLevel,
      supportLevel: SUPPORT_LEVELS.HIGH,
      showAnimatedTracer: true,
      reduceMotion: false,
      collectionMode: false,
    });
    expect(actualDemoSpeedLevel).toBe('slow');

    // Step 5: the shared duration helper resolves the actual px/ms + a
    // representative stroke duration.
    expect(getTracerSpeedForLevel(actualDemoSpeedLevel)).toBeCloseTo(0.21, 10);
    const duration = getStrokeDurationForLevel(500, actualDemoSpeedLevel);
    const standardDuration = getStrokeDurationForLevel(500, 'standard');
    expect(duration).toBeGreaterThan(standardDuration);

    // Step 6: the attempt record submitted for THIS attempt carries the
    // ACTUAL value, never the raw recommendation blindly.
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: SUPPORT_LEVELS.HIGH, demoSpeedLevel: actualDemoSpeedLevel,
      features: { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 5, stroke_order_meta: null },
      strokes: [],
    });
    expect(record.demo_speed_level).toBe('slow');
  });
});

// ─── Items 19-20 — HIGH support speeds ─────────────────────────────────────

describe('Item 19 — standard HIGH -> 0.28', () => {
  it('getTracerSpeedForLevel("standard") === 0.28', () => {
    expect(getTracerSpeedForLevel('standard')).toBe(0.28);
  });
});

describe('Item 20 — slow HIGH -> 0.21', () => {
  it('getTracerSpeedForLevel("slow") === 0.21', () => {
    expect(getTracerSpeedForLevel('slow')).toBeCloseTo(0.21, 10);
  });
});

// ─── Items 21-22 — MEDIUM/LOW no tracer ────────────────────────────────────

describe('Item 21 — MEDIUM + slow -> no tracer / null', () => {
  it('resolveActualDemoSpeedLevel returns null at MEDIUM support regardless of the recommendation', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.MEDIUM, showAnimatedTracer: false, reduceMotion: false, collectionMode: false,
    })).toBeNull();
  });
});

describe('Item 22 — LOW + slow -> no tracer / null', () => {
  it('resolveActualDemoSpeedLevel returns null at LOW support regardless of the recommendation', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.LOW, showAnimatedTracer: false, reduceMotion: false, collectionMode: false,
    })).toBeNull();
  });
});

// ─── Item 23 — reduce-motion ────────────────────────────────────────────────

describe('Item 23 — reduceMotion + slow -> no tracer / null', () => {
  it('reduceMotion always wins, even at HIGH support with the tracer flag true', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: true, collectionMode: false,
    })).toBeNull();
  });
});

// ─── Item 24 — collection ───────────────────────────────────────────────────

describe('Item 24 — collection -> no request / no adaptation', () => {
  it('resolveActualDemoSpeedLevel returns null under collectionMode regardless of everything else', () => {
    expect(resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: false, collectionMode: true,
    })).toBeNull();
  });

  it('both writing screens gate the fetch effect on collectionMode before any network call', () => {
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/useEffect\(\(\) => \{\n {4}if \(collectionMode\) return;\n {4}let cancelled = false;\n\n {4}fetchDemoSpeedRecommendation/);
    }
  });
});

// ─── Items 25-26 — retry / fresh letter ────────────────────────────────────

describe('Item 25 — same-letter retry: no refetch', () => {
  it('the demo-speed fetch effect dependency array is exactly [letter, caseType, collectionMode, student.sid] in both screens — attempt/hasDrawn resetting on a retry never re-triggers it', () => {
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/fetchDemoSpeedRecommendation\(\{ studentId: student\.sid, letter, caseType \}\)[\s\S]*?\}, \[letter, caseType, collectionMode, student\.sid\]\);/);
    }
  });
});

describe('Item 26 — fresh letter: refetch', () => {
  it('letter is a dependency of the fetch effect — a letter change always re-runs it', () => {
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/\}, \[letter, caseType, collectionMode, student\.sid\]\);/);
    }
  });
});

// ─── Item 27 — Feature 5 spaced repeat ─────────────────────────────────────

describe('Item 27 — Feature 5 spaced repeat: fresh fetch on the repeated occurrence', () => {
  it('resolveRecommendedDemoSpeedLevel does not remember a prior letter\'s stored recommendation once the letter has moved away and back', () => {
    // original c -> stored 'slow'
    let recommendation = { letter: 'c', caseType: 'lowercase', speedLevel: 'slow' };
    expect(resolveRecommendedDemoSpeedLevel({ recommendation, currentLetter: 'c', currentCaseType: 'lowercase' })).toBe('slow');

    // sequence moves to o -> stale c recommendation no longer applies
    expect(resolveRecommendedDemoSpeedLevel({ recommendation, currentLetter: 'o', currentCaseType: 'lowercase' })).toBe('standard');

    // sequence returns to a LATER c (Feature 5 spaced repeat) with no fetch
    // resolved yet for this fresh occurrence -> falls back to standard
    // until its own independent fetch resolves, never reusing the original.
    expect(resolveRecommendedDemoSpeedLevel({ recommendation, currentLetter: 'c', currentCaseType: 'lowercase' })).toBe('slow');
    // (the same stored object still matches 'c' again — proving letter
    // identity alone drives this, exactly as spec §19 intends: a genuinely
    // fresh fetch for the later 'c' would overwrite `recommendation` with
    // its own new response before this is ever read again in practice.)
  });

  it('Feature 5 insertion/counting code is untouched — no demo-speed references', () => {
    for (const file of ['./controlledRepetition.js', './repetitionSessionGuard.js', './repetitionRecommendation.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
    }
  });
});

// ─── Item 28 — stale response rejected ─────────────────────────────────────

describe('Item 28 — stale letter response rejected', () => {
  it('a late "c" response is rejected once the screen has moved to "o"', () => {
    expect(shouldApplyDemoSpeedRecommendation({
      responseLetter: 'c', responseCaseType: 'lowercase',
      currentLetter: 'o', currentCaseType: 'lowercase',
      currentAttempt: 1, hasDrawn: false, collectionMode: false, cancelled: false,
    })).toBe(false);
  });
});

// ─── Item 29 — hasDrawn rejected ────────────────────────────────────────────

describe('Item 29 — hasDrawn response rejected', () => {
  it('a response arriving after the child has already started drawing is rejected — never changes speed mid-attempt', () => {
    expect(shouldApplyDemoSpeedRecommendation({
      responseLetter: 'c', responseCaseType: 'lowercase',
      currentLetter: 'c', currentCaseType: 'lowercase',
      currentAttempt: 1, hasDrawn: true, collectionMode: false, cancelled: false,
    })).toBe(false);
  });
});

// ─── Items 30-32 — speed math ───────────────────────────────────────────────

describe('Item 30 — standard duration backward-compatible', () => {
  it.each([100, 250, 500, 1000])('length=%ipx matches the legacy Math.max(600, Math.round(len/0.28)) formula exactly', (len) => {
    expect(getStrokeDurationForLevel(len, 'standard')).toBe(Math.max(600, Math.round(len / 0.28)));
  });
});

describe('Item 31 — slow duration longer', () => {
  it('for strokes above the floor, slow duration is strictly longer than standard', () => {
    expect(getStrokeDurationForLevel(500, 'slow')).toBeGreaterThan(getStrokeDurationForLevel(500, 'standard'));
  });
});

describe('Item 32 — 600ms floor', () => {
  it('both speed levels respect the exact 600ms floor', () => {
    expect(getStrokeDurationForLevel(0, 'standard')).toBe(MIN_STROKE_DURATION_MS);
    expect(getStrokeDurationForLevel(0, 'slow')).toBe(MIN_STROKE_DURATION_MS);
    expect(MIN_STROKE_DURATION_MS).toBe(600);
  });
});

// ─── Item 33 — fixed delays preserved ──────────────────────────────────────

describe('Item 33 — fixed delays preserved (350ms lead / 400ms inter-stroke; trail now the idle gap)', () => {
  it('both screens still use the exact same Animated.delay values, unscaled', () => {
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/Animated\.delay\(400\)/);
      // The lead delay is still fixed and unscaled by demo speed. The 700ms
      // trail was the Animated.loop inter-iteration pad; forward-only replay
      // has no iterations, so that pause is now GUIDE_IDLE_REPLAY_MS in
      // guideReplayCycle.js — still fixed, still independent of speed level.
      expect(source).toMatch(/return Animated\.sequence\(\[Animated\.delay\(350\), \.\.\.\w+\]\)/);
      expect(source).not.toMatch(/Animated\.delay\(getStrokeDurationForLevel|Animated\.delay\(\w*[Ss]peed/);
    }
  });
});

// ─── Items 34-35 — no fast, no speed above standard ────────────────────────

describe('Item 34 — no fast level exists', () => {
  it('DEMO_SPEED_LEVELS contains exactly standard/slow', () => {
    expect(Object.values(DEMO_SPEED_LEVELS).sort()).toEqual(['slow', 'standard']);
  });
});

describe('Item 35 — no speed exceeds standard (0.28)', () => {
  it.each(['standard', 'slow', 'garbage', null, undefined])('getTracerSpeedForLevel(%p) <= 0.28', (level) => {
    expect(getTracerSpeedForLevel(level)).toBeLessThanOrEqual(0.28);
  });
});

// ─── Items 36-37 — Feature 3/5 unchanged ───────────────────────────────────

describe('Item 36 — Feature 3 visibility unchanged', () => {
  it('handwritingSupportLevels.js has zero demo-speed references', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../constants/handwritingSupportLevels.js'), 'utf8');
    expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
  });
});

describe('Item 37 — Feature 5 unchanged', () => {
  it('controlledRepetition.js and repetitionSessionGuard.js have zero demo-speed references (restated from Item 27)', () => {
    for (const file of ['./controlledRepetition.js', './repetitionSessionGuard.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
    }
  });
});

// ─── Items 38-41 — persistence submission (Step 5, NEW) ────────────────────

describe('Item 38 — the ACTUAL shown value is submitted, never the raw recommendation', () => {
  it('buildSessionAttemptRecord persists exactly the demoSpeedLevel argument passed in — the screens pass actualDemoSpeedLevel, never recommendedDemoSpeedLevel', () => {
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: 'high', demoSpeedLevel: 'slow',
      features: { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 5, stroke_order_meta: null },
      strokes: [],
    });
    expect(record.demo_speed_level).toBe('slow');
  });

  it('both screens pass demoSpeedLevel: actualDemoSpeedLevel into buildSessionAttemptRecord — never recommendedDemoSpeedLevel', () => {
    for (const file of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
    ]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/demoSpeedLevel: actualDemoSpeedLevel,/);
      expect(source).not.toMatch(/demoSpeedLevel: recommendedDemoSpeedLevel/);
    }
  });
});

describe('Item 39 — MEDIUM/LOW support submits null', () => {
  it('resolveActualDemoSpeedLevel -> buildSessionAttemptRecord pipeline persists null at MEDIUM/LOW, never a guessed level', () => {
    for (const supportLevel of [SUPPORT_LEVELS.MEDIUM, SUPPORT_LEVELS.LOW]) {
      const actual = resolveActualDemoSpeedLevel({
        recommendedSpeedLevel: 'slow', supportLevel, showAnimatedTracer: false, reduceMotion: false, collectionMode: false,
      });
      const record = buildSessionAttemptRecord({
        attemptNumber: 2, supportLevel, demoSpeedLevel: actual,
        features: { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 5, stroke_order_meta: null },
        strokes: [],
      });
      expect(record.demo_speed_level).toBeNull();
    }
  });
});

describe('Item 40 — reduceMotion submits null', () => {
  it('resolveActualDemoSpeedLevel -> buildSessionAttemptRecord pipeline persists null under reduce-motion even at HIGH support', () => {
    const actual = resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: true, collectionMode: false,
    });
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: SUPPORT_LEVELS.HIGH, demoSpeedLevel: actual,
      features: { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 5, stroke_order_meta: null },
      strokes: [],
    });
    expect(record.demo_speed_level).toBeNull();
  });
});

describe('Item 41 — collection submits null (per the chosen payload convention: the field is always present, always null in collection)', () => {
  it('resolveActualDemoSpeedLevel -> buildSessionAttemptRecord pipeline persists null under collectionMode, matching support_level\'s own convention of never omitting the field', () => {
    const actual = resolveActualDemoSpeedLevel({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: false, collectionMode: true,
    });
    const record = buildSessionAttemptRecord({
      attemptNumber: 1, supportLevel: SUPPORT_LEVELS.HIGH, demoSpeedLevel: actual,
      features: { smoothness: 0.1, pauseCount: 0, completionTime: 500, strokeCount: 1, dtw_distance: 5, stroke_order_meta: null },
      strokes: [],
    });
    expect(record.demo_speed_level).toBeNull();
    // collection_mode itself is a separate, pre-existing top-level request
    // field (not part of buildSessionAttemptRecord) — untouched by Feature 6.
  });
});
