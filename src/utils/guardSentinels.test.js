// Sentinel tests: proof that the guards can detect the bugs they claim to.
//
// WHY: a test in this repo already claimed to catch runtime missing
// identifiers and did not — it consulted `scope.hasGlobal`, which is true for
// exactly the unresolved identifiers, so it skipped every real finding and
// passed on a file that crashed on the device.
//
// A guard that cannot be shown to fire is not a guard; it is a claim. So each
// important rule below is exercised against a DELIBERATELY BROKEN input, and
// the assertion is that the guard REJECTS it. If someone weakens a guard,
// these go red — not the guard's own happy-path test.

import fs from 'fs';
import path from 'path';

import {
  recordCycleCompleted, canStartAnotherCycle, resetLetterCycleGuard,
  MAX_CYCLES_PER_LETTER_PER_DATE, currentPracticeDate,
} from './letterCycleGuard';
import { shouldShowDemo, makeLetterCategoryDemoKey } from './demoPolicy';
import { canOpen, isPreview, parseDemoPreviewFlag } from '../constants/demoAccess';
import { isWordsUnlocked } from './wordUnlockGate';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const C = { studentId: 7, letter: 'c', caseType: 'lowercase', interactionId: 'i1' };

beforeEach(() => resetLetterCycleGuard());

// ─── Sentinel 1: a FOURTH same-date cycle must be refused ───────────────
//
// The ceiling moved from two to three alongside the attempt-3-only mastery
// rule (backend config/masteryPolicy.js): mastery is now judged on the
// unguided attempt, which is materially harder, so a third cycle restores
// some of the room the stricter gate removes. The sentinel below fired on
// that change, exactly as intended — the number is a decision, not a knob.

describe('SENTINEL — the cycle ceiling refuses a fourth cycle', () => {
  it('rejects cycle 4 no matter how it is asked for', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    recordCycleCompleted({ ...C, serverCyclesToday: null });

    // Every way a fourth cycle could be attempted, all refused:
    expect(canStartAnotherCycle(C)).toBe(false);                       // same interaction
    expect(canStartAnotherCycle({ ...C, interactionId: 'i2' })).toBe(false); // fresh tap
    expect(canStartAnotherCycle({ ...C, interactionId: undefined })).toBe(false);
  });

  it('would FAIL if the ceiling were changed — the constant is load-bearing', () => {
    // Any edit to MAX_CYCLES_PER_LETTER_PER_DATE breaks this, which is the
    // point: the number is a product decision, not an implementation detail
    // to tune quietly.
    expect(MAX_CYCLES_PER_LETTER_PER_DATE).toBe(3);
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(true);   // two left
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(true);   // exactly one left
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    expect(canStartAnotherCycle(C)).toBe(false);  // and then none
  });

  it('a server count claiming MORE cycles closes the door immediately', () => {
    // The restart case: local memory empty, server has already seen three.
    expect(recordCycleCompleted({ ...C, serverCyclesToday: 3 })).toBe(3);
    expect(canStartAnotherCycle(C)).toBe(false);
  });

  it('a server count claiming FEWER cycles cannot reopen it', () => {
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    recordCycleCompleted({ ...C, serverCyclesToday: null });
    // A stale or wrong server answer must never lower the count.
    recordCycleCompleted({ ...C, serverCyclesToday: 0 });
    expect(canStartAnotherCycle(C)).toBe(false);
  });
});

// ─── Sentinel 2: advancing must not be confused with mastering ──────────

describe('SENTINEL — moving on is not mastering', () => {
  const letterScreen = read('../screens/handwriting/LetterWritingScreen.js');
  const upperScreen  = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');

  /** Just the handleFailedCycle body — brace-matched, not a wide slice. */
  function capBranch(src) {
    const start = src.indexOf('const handleFailedCycle');
    let i = src.indexOf('{', src.indexOf('=>', start));
    let depth = 0;
    for (;; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
  }

  it('the cap branch contains no mastery write of any kind', () => {
    for (const src of [letterScreen, upperScreen]) {
      const branch = capBranch(src);
      // Sanity: the slice really is just that function.
      expect(branch).toMatch(/if \(used >= MAX_CYCLES_PER_LETTER_PER_DATE\)/);
      expect(branch.split('\n').length).toBeLessThan(40);
      for (const forbidden of ['mastered', 'mastery', 'LetterProgress',
        'storeLetterProgress', 'completed: true', 'wroteCorrectly = true']) {
        expect(branch).not.toContain(forbidden);
      }
    }
  });

  it('mastery is still set ONLY by the backend pass path', () => {
    const controller = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/controllers/handwritingController.js'), 'utf8');
    // One place sets mastered_at, and it sits after the threshold check.
    const setters = (controller.match(/mastered_at:\s*masteredAt/g) ?? []).length;
    expect(setters).toBeGreaterThan(0);
    expect(controller).toMatch(/if \(masteryScore == null \|\| masteryScore < threshold\) \{/);
    // The blocked branch returns before ever reaching it.
    expect(controller.indexOf('completed: false, bestScore, threshold'))
      .toBeLessThan(controller.indexOf('const masteredAt = new Date()'));
  });

  it('the worksheet path cannot master anything', () => {
    const worksheet = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/worksheetService.js'), 'utf8');
    const code = worksheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/mastered_at/);
    expect(code).not.toMatch(/LetterProgress/);
  });
});

// ─── Sentinel 3: Feature 5 cannot produce a cycle past the cap ──────────

describe('SENTINEL — the spaced repetition obeys the ceiling', () => {
  const service = fs.readFileSync(path.resolve(
    __dirname, '../../../auriva-backend/src/services/repetitionRecommendationService.js'), 'utf8');

  it('checks the practice-date cap, and does it before the expensive reads', () => {
    expect(service).toMatch(/const cycleUsage = await getCycleUsageForDate/);
    expect(service).toMatch(/if \(cycleUsage\.status === 'ok' && cycleUsage\.capReached\) \{/);
    expect(service).toMatch(/shouldRepeat: false, reason: CYCLE_CAP_REASON\.CAP_REACHED/);
    expect(service.indexOf('cycleUsage.capReached'))
      .toBeLessThan(service.indexOf('evaluateDynamicThresholds({ studentId })'));
  });

  it('would FAIL if the cap check were removed — it is the only thing between', () => {
    // Between "family resolved" and "ask Feature 2/3" there must be a cap
    // gate. Deleting it is exactly the regression this sentinel exists for.
    const between = service.slice(
      service.indexOf('const family = getBaselineFamily'),
      service.indexOf('evaluateDynamicThresholds({ studentId })'));
    expect(between).toMatch(/capReached/);
  });

  it('Feature 5 is still alive for letters under the ceiling', () => {
    const policy = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/repetitionPolicy.js'), 'utf8');
    expect(policy).toMatch(/MAX_ADAPTIVE_REPETITIONS_PER_LETTER_PER_INTERACTION = 1/);
    expect(service).toMatch(/REPETITION_REASON\.FEATURE3_SUPPORT_REVIEW/);
  });
});

// ─── Sentinel 4: demos cannot touch cycles or mastery ───────────────────

describe('SENTINEL — a demo changes no practice state', () => {
  it('refuses to run in collection mode, so Writing Check is never interrupted', () => {
    expect(shouldShowDemo({
      demoKey: 'lowercase_straight', shownKeys: [], collectionMode: true,
    })).toBe(false);
    expect(read('./demoDetour.js')).toMatch(/if \(collectionMode\) return false;/);
  });

  it('a Writing Check batch cannot even form a demo key', () => {
    // Its pairs are {letter, caseType} only — no category.
    expect(makeLetterCategoryDemoKey({ caseType: 'lowercase', category: undefined })).toBeNull();
  });

  it('the demo modules touch no attempt, cycle or mastery concept', () => {
    for (const rel of ['./demoPolicy.js', './demoGuard.js', './demoDetour.js',
      './demoPlayback.js', '../components/handwriting/HandwritingDemo.js']) {
      const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const forbidden of ['recordCycleCompleted', 'setAttempt', 'session_key',
        'cycle_usage', 'mastered', 'LetterProgress']) {
        expect(code).not.toContain(forbidden);
      }
    }
  });
});

// ─── Sentinel 5: preview access changes no real progress ────────────────

describe('SENTINEL — demo preview opens a door and nothing else', () => {
  it('cannot make an unearned card look earned', () => {
    expect(isPreview(true)).toBe(false);           // earned is never "preview"
    expect(canOpen(true)).toBe(true);
  });

  it('the real unlock rules are unmoved', () => {
    expect(isWordsUnlocked(26, 26)).toBe(true);
    expect(isWordsUnlocked(25, 26)).toBe(false);
    expect(isWordsUnlocked(26, 25)).toBe(false);
  });

  it('would FAIL if the switch defaulted ON', () => {
    // Only the exact string 'true' may enable it; everything else is closed.
    for (const junk of [undefined, null, '', 'yes', '1', 'TRUE1', 0, true]) {
      expect(parseDemoPreviewFlag(junk)).toBe(false);
    }
    expect(parseDemoPreviewFlag('true')).toBe(true);
  });
});

// ─── Sentinel 6: the date rule agrees across both repos ─────────────────

describe('SENTINEL — one practice-date rule, two repos', () => {
  it('rolls at LOCAL midnight on both sides', () => {
    const backend = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/practiceCyclePolicy.js'), 'utf8');
    expect(backend).toMatch(/const PRACTICE_TIMEZONE = 'Asia\/Colombo';/);
    expect(backend).toMatch(/const MAX_CYCLES_PER_LETTER_PER_DATE = 3;/);
    // ...and the frontend agrees on both numbers. Two repos, one ceiling —
    // a drift here is what would silently grant an extra cycle.
    expect(MAX_CYCLES_PER_LETTER_PER_DATE).toBe(3);
    expect(currentPracticeDate(new Date('2026-08-26T18:29:00Z'))).toBe('2026-08-26');
    expect(currentPracticeDate(new Date('2026-08-26T18:31:00Z'))).toBe('2026-08-27');
  });

  it('a late-evening session stays on ONE date, not split across two', () => {
    // 23:50 and 00:10 Colombo are different dates; 22:00 and 23:50 are not.
    expect(currentPracticeDate(new Date('2026-08-26T16:30:00Z')))   // 22:00 local
      .toBe(currentPracticeDate(new Date('2026-08-26T18:20:00Z'))); // 23:50 local
    expect(currentPracticeDate(new Date('2026-08-26T18:40:00Z')))   // 00:10 local
      .not.toBe(currentPracticeDate(new Date('2026-08-26T18:20:00Z')));
  });
});

// ─── Sentinel 7: normal practice must never inherit collection semantics ─

describe('SENTINEL — Writing Check cannot contaminate normal practice', () => {
  const letterScreen = read('../screens/handwriting/LetterWritingScreen.js');
  const upperScreen  = read('../screens/handwriting/uppercase/UppercaseWritingScreen.js');

  it('collection flags DEFAULT to off/null, so an omitted param is normal', () => {
    for (const src of [letterScreen, upperScreen]) {
      expect(src).toMatch(/collectionMode\s*=\s*false,/);
      expect(src).toMatch(/collectionSessionId\s*=\s*null,/);
      expect(src).toMatch(/writingCheckId\s*=\s*null,/);
    }
  });

  it('a normal entry point passes NO collection params at all', () => {
    // LetterPracticeScreen is the only normal entry to the writing screens.
    const practice = read('../screens/handwriting/LetterPracticeScreen.js');
    const nav = practice.slice(practice.indexOf('const navigateToWriting'),
      practice.indexOf('const navigateToWriting') + 600);
    expect(nav).not.toMatch(/collectionMode|collectionSessionId|writingCheckId/);
  });

  it('only the Writing Check screen sets writingCheckId', () => {
    const walk = (dir, acc = []) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, acc);
        else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) acc.push(full);
      }
      return acc;
    };
    const setters = walk(path.resolve(__dirname, '..'))
      .filter(f => /writingCheckId:\s*state\.check\.id|writingCheckId:\s*\w/.test(
        fs.readFileSync(f, 'utf8')))
      .map(f => path.basename(f));
    expect(setters).toEqual(['WritingCheckScreen.js']);
  });

  it('the cycle counter excludes every collection row', () => {
    const svc = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/letterCycleService.js'), 'utf8');
    expect(svc).toMatch(/collection_mode: false/);
    expect(svc).toMatch(/source_type: null/);
    expect(svc).toMatch(/capture_status: COMPLETE/);
  });

  it('collection mode returns BEFORE any mastery or threshold work', () => {
    const controller = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/controllers/handwritingController.js'), 'utf8');
    const collectionReturn = controller.indexOf("completed: true, collection_mode: true");
    const bestScoreCalc = controller.indexOf('computeAuthoritativeBestScore({');
    expect(collectionReturn).toBeGreaterThan(-1);
    expect(collectionReturn).toBeLessThan(bestScoreCalc);
  });
});

// ─── Sentinel 8: the pass decision is the SERVER's, not the client's ─────

describe('SENTINEL — the client cannot influence pass/fail', () => {
  const controller = fs.readFileSync(path.resolve(
    __dirname, '../../../auriva-backend/src/controllers/handwritingController.js'), 'utf8');

  it('bestScore comes from the captured strokes, server-side', () => {
    expect(controller).toMatch(/bestScore = authoritativeResult\.bestScore;/);
    expect(controller).toMatch(/computeAuthoritativeBestScore\(\{\s*\n?\s*attempts, canvasWidth/);
  });

  it('client attempt_scores is diagnostic only — never assigned to bestScore', () => {
    // The only use of attempt_scores near the gate is a length-mismatch warn.
    const gate = controller.slice(controller.indexOf('let bestScore = null;'),
      controller.indexOf('if (bestScore == null || bestScore < threshold)'));
    expect(gate).not.toMatch(/bestScore\s*=\s*Math\.max\(\.\.\.attempt_scores/);
    expect(gate).toMatch(/attempt_scores is diagnostic-only/);
  });

  it('an all-coverage-invalid cycle scores null, which the gate treats as FAIL', () => {
    const scoring = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/utils/authoritativeAttemptScoring.js'), 'utf8');
    expect(scoring).toMatch(/if \(coverageValid === false\) return null;/);
    expect(scoring).toMatch(/bestScore: eligible\.length > 0 \? Math\.max\(\.\.\.eligible\) : null/);
    // ...and null is a fail, never a free pass.
    expect(controller).toMatch(/if \(masteryScore == null \|\| masteryScore < threshold\) \{/);
  });
});
