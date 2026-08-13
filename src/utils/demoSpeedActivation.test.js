// Feature 6 Step 4 — Safe Frontend Activation: end-to-end pipeline,
// Feature-3-integration, reduce-motion-integration, same-letter-retry/
// fresh-letter/spaced-repeat/collection wiring, and source-of-truth tests.
//
// This project's Jest config has no RN component-testing infrastructure
// (see jest.config.js's own comment, and every prior feature's identical
// note) — screen-level behavior (effect re-run timing, actual network call
// counts) is proven the same way every previous feature proved it: (a) pure
// end-to-end composition of the already-unit-tested pure pieces
// (getStrokeDurationForLevel, resolveActualDemoSpeedLevel,
// resolveRecommendedDemoSpeedLevel), and (b) source-scan assertions against
// the exact wiring in both screens (effect dependency arrays, collection-mode
// guards, import statements) — the same "source-scan proof" convention
// already used throughout this session (e.g.
// feature5FinalAcceptance.test.js's scheduleAdaptiveRepetitionIfEligible
// checks).

// demoSpeedRecommendation.js imports ../api/client, which transitively pulls
// in expo-secure-store (native module, unparseable under plain Jest) — mock
// it the same way demoSpeedRecommendation.test.js/repetitionRecommendation.test.js
// already do, even though this file never calls client.get directly.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import { DEMO_SPEED_LEVELS, getStrokeDurationForLevel } from '../constants/demoSpeedLevels';
import { resolveActualDemoSpeedLevel } from './demoSpeedPersistence';
import { resolveRecommendedDemoSpeedLevel } from './demoSpeedRecommendation';
import { SUPPORT_LEVELS } from '../constants/handwritingSupportLevels';

const fs = require('fs');
const path = require('path');

const SCREEN_FILES = [
  '../screens/handwriting/LetterWritingScreen.js',
  '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
];

function readScreen(file) {
  return fs.readFileSync(path.resolve(__dirname, file), 'utf8');
}

// ─── Feature 3 integration tests (spec items 26-30) — full pipeline ────────
// Backend recommendation -> resolveActualDemoSpeedLevel -> getStrokeDurationForLevel,
// exercised together exactly as both screens now chain them.

function effectiveDuration({ recommendedSpeedLevel, supportLevel, showAnimatedTracer, reduceMotion = false, collectionMode = false, len = 500 }) {
  const actual = resolveActualDemoSpeedLevel({ recommendedSpeedLevel, supportLevel, showAnimatedTracer, reduceMotion, collectionMode });
  const effective = actual ?? DEMO_SPEED_LEVELS.STANDARD;
  return { actual, effective, duration: getStrokeDurationForLevel(len, effective) };
}

describe('Test 26 — HIGH + standard -> tracer visible at standard speed', () => {
  it('backend=standard, support=high, reduceMotion=false: actual=standard, duration = legacy formula', () => {
    const { actual, duration } = effectiveDuration({
      recommendedSpeedLevel: 'standard', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true,
    });
    expect(actual).toBe('standard');
    expect(duration).toBe(Math.max(600, Math.round(500 / 0.28)));
  });
});

describe('Test 27 — HIGH + slow -> tracer visible at slow speed', () => {
  it('backend=slow, support=high, reduceMotion=false: actual=slow, duration ≈ 1.333× standard', () => {
    const slowResult = effectiveDuration({ recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true });
    const standardResult = effectiveDuration({ recommendedSpeedLevel: 'standard', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true });
    expect(slowResult.actual).toBe('slow');
    expect(slowResult.duration).toBeGreaterThan(standardResult.duration);
  });
});

describe('Test 28 — MEDIUM + slow -> tracer absent, actual=null, duration falls back to standard formula', () => {
  it('no tracer exists at MEDIUM support, regardless of the backend recommendation', () => {
    const { actual, effective, duration } = effectiveDuration({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.MEDIUM, showAnimatedTracer: false,
    });
    expect(actual).toBeNull();
    expect(effective).toBe('standard');
    expect(duration).toBe(Math.max(600, Math.round(500 / 0.28)));
  });
});

describe('Test 29 — LOW + slow -> tracer absent, actual=null', () => {
  it('no tracer exists at LOW support either', () => {
    const { actual } = effectiveDuration({ recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.LOW, showAnimatedTracer: false });
    expect(actual).toBeNull();
  });
});

describe('Test 30 — Feature 3 support recommendation untouched', () => {
  it('neither writing screen\'s Feature 3 fetch effect block was modified by this step', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/fetchRecommendedStartSupport\(\{ studentId: student\.sid, letter, caseType \}\)/);
      expect(source).toMatch(/shouldApplyRecommendation\(\{ currentAttempt: attemptRef\.current, hasDrawnCurrentAttempt: hasDrawnRef\.current \}\)/);
    }
  });

  it('constants/handwritingSupportLevels.js is untouched by this step (no demo-speed references)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../constants/handwritingSupportLevels.js'), 'utf8');
    expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
  });
});

// ─── Reduce-motion tests (spec items 31-33) ─────────────────────────────────

describe('Test 31 — HIGH + slow + reduceMotion -> no tracer', () => {
  it('reduceMotion always wins, even with a qualifying slow recommendation', () => {
    const { actual } = effectiveDuration({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: true,
    });
    expect(actual).toBeNull();
  });
});

describe('Test 32 — actualDemoSpeedLevel null under reduce-motion', () => {
  it('the effective level still falls back to standard (never null reaching the duration calculation)', () => {
    const { effective, duration } = effectiveDuration({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, reduceMotion: true,
    });
    expect(effective).toBe('standard');
    expect(Number.isFinite(duration)).toBe(true);
  });
});

describe('Test 33 — endpoint result cannot override reduce-motion', () => {
  it('both screens\' tracer effects still gate on reduceMotion BEFORE anything Feature 6 adds', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/if \(reduceMotion \|\| !supportPresentation\?\.showAnimatedTracer \|\| hasDrawn \|\| !rawPath \|\| rawPath\.length < 1\)/);
    }
  });
});

// ─── Same-letter retry tests (spec items 34-37) ─────────────────────────────

describe('Test 34/35/36 — the demo-speed fetch effect has the exact same dependency array as the Feature 3 fetch effect', () => {
  it('both screens\' demo-speed fetch effects depend on exactly [letter, caseType, collectionMode, student.sid] — no attempt, no hasDrawn', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      const match = source.match(/fetchDemoSpeedRecommendation\(\{[\s\S]*?\n {2}\}, \[letter, caseType, collectionMode, student\.sid\]\);/);
      expect(match).not.toBeNull();
    }
  });

  it('reads attempt/hasDrawn only via the stable attemptRef/hasDrawnRef mirrors — never the reactive state itself — inside the effect body, so React never re-runs this effect on their change', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      const match = source.match(/fetchDemoSpeedRecommendation\(\{ studentId: student\.sid, letter, caseType \}\)\.then\(\(response\) => \{[\s\S]*?\}\);\n\n {4}return \(\) => \{ cancelled = true; \};\n {2}\}, \[letter, caseType, collectionMode, student\.sid\]\);/);
      expect(match).not.toBeNull();
      // The gate call reads currentAttempt/hasDrawn from the refs, not from
      // reactive `attempt`/`hasDrawn` state directly — confirms the effect
      // itself has no live dependency on either.
      expect(match[0]).toMatch(/currentAttempt: attemptRef\.current/);
      expect(match[0]).toMatch(/hasDrawn: hasDrawnRef\.current/);
    }
  });
});

describe('Test 37 — support-level rendering still controls tracer visibility, independent of demo-speed state', () => {
  it('showAnimatedTracer is still driven solely by supportPresentation, not by demoSpeedRecommendation state', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/supportPresentation\?\.showAnimatedTracer/);
    }
  });
});

// ─── Fresh-letter tests (spec items 38-39) ─────────────────────────────────

describe('Test 38 — letter change triggers a fresh request (letter is a dependency)', () => {
  it('the demo-speed fetch effect dependency array includes letter', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/fetchDemoSpeedRecommendation\(\{ studentId: student\.sid, letter, caseType \}\)[\s\S]*?\}, \[letter, caseType, collectionMode, student\.sid\]\);/);
    }
  });
});

describe('Test 39 — a stale letter\'s recommendation cannot leak into a new letter', () => {
  it('resolveRecommendedDemoSpeedLevel rejects a recommendation stored for a previous letter', () => {
    const stale = resolveRecommendedDemoSpeedLevel({
      recommendation: { letter: 'c', caseType: 'lowercase', speedLevel: 'slow' },
      currentLetter: 'o', currentCaseType: 'lowercase',
    });
    expect(stale).toBe('standard');
  });
});

// ─── Feature 5 spaced-repeat tests (spec items 40-42) ──────────────────────

describe('Test 40/41 — a repeated letter (Feature 5 spaced reinsertion) gets its own fresh fetch and may receive a different recommendation', () => {
  it('the effect keys only on letter identity, not on sequence position — a later re-occurrence of the same letter string re-triggers the same effect the first occurrence did', () => {
    // Proven structurally: the effect's dependency array is [letter, caseType,
    // collectionMode, student.sid] — none of which distinguish "first c" from
    // "later spaced-repeat c" beyond the letter value itself, which is
    // identical either time. React re-runs an effect whenever any dependency
    // differs from the previous render; since `letter` transitions away to
    // 'o' and back to 'c' between the two occurrences, the effect reruns both
    // times, fetching independently each time (no caching/memoization of
    // demoSpeedRecommendation across letters — see resolveRecommendedDemoSpeedLevel's
    // letter/caseType match requirement, Test 39 above).
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).not.toMatch(/demoSpeedCache|cachedDemoSpeed|previousDemoSpeed/);
    }
  });
});

describe('Test 42 — no Feature 5 counter/insertion behavior changes', () => {
  it('controlledRepetition.js (Feature 5\'s spaced-insertion logic) is untouched — no demo-speed references', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './controlledRepetition.js'), 'utf8');
    expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
  });

  it('repetitionSessionGuard.js is untouched — no demo-speed references', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './repetitionSessionGuard.js'), 'utf8');
    expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
  });
});

// ─── Collection tests (spec items 43-46) ────────────────────────────────────

describe('Test 43 — collection makes zero demo-speed endpoint calls', () => {
  it('the demo-speed fetch effect returns immediately when collectionMode is true, before fetchDemoSpeedRecommendation is ever called', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      const match = source.match(/useEffect\(\(\) => \{\n {4}if \(collectionMode\) return;\n {4}let cancelled = false;\n\n {4}fetchDemoSpeedRecommendation/);
      expect(match).not.toBeNull();
    }
  });
});

describe('Test 44 — collection retains standard duration', () => {
  it('resolveActualDemoSpeedLevel is null under collectionMode regardless of everything else, so effectiveDemoSpeedLevel is always standard', () => {
    const { actual, effective, duration } = effectiveDuration({
      recommendedSpeedLevel: 'slow', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, collectionMode: true,
    });
    expect(actual).toBeNull();
    expect(effective).toBe('standard');
    expect(duration).toBe(Math.max(600, Math.round(500 / 0.28)));
  });
});

describe('Test 45 — collection actualDemoSpeedLevel null', () => {
  it('is exactly the case proven by Test 44 above — restated for the spec\'s own numbering', () => {
    const { actual } = effectiveDuration({
      recommendedSpeedLevel: 'standard', supportLevel: SUPPORT_LEVELS.HIGH, showAnimatedTracer: true, collectionMode: true,
    });
    expect(actual).toBeNull();
  });
});

describe('Test 46 — no collection payload changes', () => {
  it('neither screen\'s collection_mode attempt-submission payload references demo-speed state', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      const match = source.match(/collection_mode: collectionMode,[\s\S]{0,400}/);
      expect(match).not.toBeNull();
      expect(match[0]).not.toMatch(/demoSpeed|DEMO_SPEED/);
    }
  });
});

// ─── Source-of-truth tests (spec items 50-53) ───────────────────────────────

describe('Test 50 — writing screens import the shared Feature 6 speed helper', () => {
  it('both screens import getStrokeDurationForLevel from constants/demoSpeedLevels', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/import \{ DEMO_SPEED_LEVELS, getStrokeDurationForLevel \} from '.*constants\/demoSpeedLevels';/);
    }
  });

  it('both screens import resolveActualDemoSpeedLevel from utils/demoSpeedPersistence', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/import \{ resolveActualDemoSpeedLevel \} from '.*utils\/demoSpeedPersistence';/);
    }
  });
});

describe('Test 51 — writing screens no longer use local TRACER_PX_PER_MS as the runtime tracer-duration source', () => {
  it('the live tracer-duration call site uses getStrokeDurationForLevel, not TRACER_PX_PER_MS, in both screens', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/getStrokeDurationForLevel\([^)]*effectiveDemoSpeedLevel\)/);
    }
  });

  it('LetterWritingScreen.js retains TRACER_PX_PER_MS only inside the pre-existing dead getSegmentDuration() function (documented, not runtime-live)', () => {
    const source = readScreen('../screens/handwriting/LetterWritingScreen.js');
    const liveDurationLine = source.match(/const dur = .*;/);
    expect(liveDurationLine[0]).not.toMatch(/TRACER_PX_PER_MS/);
  });

  it('UppercaseWritingScreen.js has no TRACER_PX_PER_MS reference left at all (it had no other user of the constant)', () => {
    const source = readScreen('../screens/handwriting/uppercase/UppercaseWritingScreen.js');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/TRACER_PX_PER_MS/);
  });
});

describe('Test 52 — no duplicate 0.21 literal in either writing screen', () => {
  it('neither screen hardcodes the slow px/ms value — it only ever comes from the shared helper', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).not.toMatch(/0\.21/);
    }
  });
});

describe('Test 53 — no fast branch', () => {
  it('neither screen nor the shared helpers reference a "fast" speed level in actual code', () => {
    // Comment-stripped before matching: demoSpeedRecommendation.js's own
    // JSDoc legitimately DISCUSSES 'fast' by name (documenting that it's an
    // excluded/invalid value) — a bare substring match on that comment would
    // be the same false-positive source-scan pitfall caught repeatedly
    // throughout this session; scoping to code only avoids it.
    for (const file of [...SCREEN_FILES, '../constants/demoSpeedLevels.js', './demoSpeedRecommendation.js', './demoSpeedPersistence.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(codeOnly.toLowerCase()).not.toMatch(/['"]fast['"]/);
    }
  });

  it('DEMO_SPEED_LEVELS still contains exactly standard/slow (unchanged from Step 2)', () => {
    expect(Object.values(DEMO_SPEED_LEVELS).sort()).toEqual(['slow', 'standard']);
  });
});

// ─── Framing-delay preservation (spec item 25) ─────────────────────────────

describe('Framing delays (350ms lead / 400ms inter-stroke / 700ms trail) unchanged', () => {
  it('both screens still use Animated.delay(350)/Animated.delay(400)/Animated.delay(700) around the tracer sequence', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/Animated\.delay\(400\)/);
      expect(source).toMatch(/Animated\.sequence\(\[Animated\.delay\(350\), \.\.\.\w+, Animated\.delay\(700\)\]\)/);
    }
  });
});

// ─── Scope guard (spec §2/§3) ───────────────────────────────────────────────

describe('Scope guard — WordWritingScreen.js and PreWritingActivityScreen.js untouched', () => {
  it('neither file references demo-speed anything', () => {
    for (const file of ['../screens/handwriting/words/WordWritingScreen.js', '../screens/handwriting/PreWritingActivityScreen.js']) {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/demoSpeed|DEMO_SPEED/);
    }
  });
});

// ─── Persistence (Feature 6 Step 5 UPDATE) ─────────────────────────────────
//
// Step 4 originally asserted "no demo_speed_level persistence yet" here —
// that guarantee was intentionally retired in Step 5, which adds the actual
// persistence path per its own explicit scope (migration, model column,
// controller validation, and submitting `actualDemoSpeedLevel` as
// `demo_speed_level` from both screens). This test now asserts the Step 5
// shape instead: the field is submitted, and it is always the ACTUAL
// resolved value, never the raw backend recommendation. See
// src/utils/feature6FinalAcceptance.test.js (items 38-41) for the full
// persistence-submission test suite.

describe('demo_speed_level IS submitted as of Step 5, and only the actual value — never the raw recommendation', () => {
  it('both screens pass demoSpeedLevel: actualDemoSpeedLevel into buildSessionAttemptRecord', () => {
    for (const file of SCREEN_FILES) {
      const source = readScreen(file);
      expect(source).toMatch(/demoSpeedLevel: actualDemoSpeedLevel,/);
      expect(source).not.toMatch(/demoSpeedLevel: recommendedDemoSpeedLevel/);
    }
  });
});
