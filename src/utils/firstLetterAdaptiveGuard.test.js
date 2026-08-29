// The first letter of a practice session starts by writing.
//
// Three things could route a child into a warm-up before they had written
// anything. Two were already closed: LetterPracticeScreen no longer detours at
// session start, and primitiveGroupOnEntering returns null at index 0. The
// third — an ADAPTIVE_DIFFICULTY recommendation arriving for the first letter
// — is closed here.
//
// ── The trap this suite exists to guard ─────────────────────────────────
// "No pre-writing at index 0" is the WRONG rule. Cycle-3 remediation returns
// with `sequence.slice(letterIdx)`, which puts the difficult letter back at
// index 0 — and a letter that was the session's first is at index 0 the whole
// time it is failing its two cycles. A blanket index-0 block would silently
// delete remediation for exactly the children who most need it.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  resolveAdaptivePreWritingDetour, PRE_WRITING_REASON,
  hasWarmupHandled, markWarmupHandled,
  hasRemediationHandled, markRemediationHandled,
  resetPreWritingGuardStore,
} from './preWritingSessionGuard';
import { primitiveGroupOnEntering } from './preWritingTransition';
import { buildLetterRemediationActivities } from './letterRemediationPlan';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const LOWERCASE = '../screens/handwriting/LetterWritingScreen.js';
const UPPERCASE = '../screens/handwriting/uppercase/UppercaseWritingScreen.js';
const SCREENS = [LOWERCASE, UPPERCASE];

const ACTIVITY = { id: 'trace_circle' };

/** A fully eligible adaptive recommendation — everything else says "go". */
const eligible = (over = {}) => ({
  recommendation: { recommended: true, letter: 'c', caseType: 'lowercase', interactionId: 'int-1' },
  activity: ACTIVITY,
  alreadyHandled: false,
  collectionMode: false,
  currentLetter: 'c',
  currentCaseType: 'lowercase',
  currentInteractionId: 'int-1',
  currentAttempt: 1,
  hasDrawn: false,
  isSessionEntryLetter: false,
  ...over,
});

const seq = (...letters) => letters.map((letter) => ({ letter }));
const WHO = { studentId: 51, caseType: 'lowercase', letter: 'c', interactionId: 'int-1' };

beforeEach(() => resetPreWritingGuardStore());

// ─── A / B: the adaptive path ───────────────────────────────────────────

describe('A — the session’s first letter never detours adaptively', () => {
  it('a fully eligible recommendation is refused at index 0', () => {
    // Everything else says go: recommended, activity resolved, attempt 1,
    // nothing drawn, not handled, not stale, not collection mode.
    const decision = resolveAdaptivePreWritingDetour(eligible({ isSessionEntryLetter: true }));
    expect(decision.shouldNavigate).toBe(false);
    expect(decision.reason).toBe('session_entry_letter');
  });

  it('the same recommendation WOULD have navigated anywhere else', () => {
    const decision = resolveAdaptivePreWritingDetour(eligible());
    expect(decision.shouldNavigate).toBe(true);
  });
});

describe('B — later letters keep their adaptive warm-up', () => {
  it.each([[1], [2], [7]])('index %s still detours', (index) => {
    const decision = resolveAdaptivePreWritingDetour(
      eligible({ isSessionEntryLetter: index === 0 }));
    expect(decision.shouldNavigate).toBe(true);
    expect(decision.reason).toBe('adaptive_recommendation');
  });

  it('ADAPTIVE_DIFFICULTY was NOT globally disabled', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      expect(code).toMatch(/PRE_WRITING_REASON\.ADAPTIVE_DIFFICULTY/);
      expect(code).toMatch(/resolveAdaptivePreWritingDetour\(\{/);
      expect(code).toMatch(/if \(!decision\.shouldNavigate\) return;/);
    }
  });

  it('every OTHER refusal reason still behaves as before', () => {
    expect(resolveAdaptivePreWritingDetour(eligible({ collectionMode: true })).reason)
      .toBe('collection_mode');
    expect(resolveAdaptivePreWritingDetour(eligible({ alreadyHandled: true })).reason)
      .toBe('already_handled');
    expect(resolveAdaptivePreWritingDetour(eligible({ currentAttempt: 2 })).reason)
      .toBe('attempt_advanced');
    expect(resolveAdaptivePreWritingDetour(eligible({ hasDrawn: true })).reason)
      .toBe('already_drawing');
    expect(resolveAdaptivePreWritingDetour(eligible({ currentLetter: 'o' })).reason)
      .toBe('stale_letter');
    expect(resolveAdaptivePreWritingDetour(eligible({ activity: null })).reason)
      .toBe('no_activity_resolved');
  });

  it('the flag defaults to false, so an old caller is unaffected', () => {
    const { isSessionEntryLetter, ...withoutFlag } = eligible();
    expect(isSessionEntryLetter).toBe(false);
    expect(resolveAdaptivePreWritingDetour(withoutFlag).shouldNavigate).toBe(true);
  });

  it('collection mode wins over the new guard', () => {
    const decision = resolveAdaptivePreWritingDetour(
      eligible({ isSessionEntryLetter: true, collectionMode: true }));
    expect(decision.reason).toBe('collection_mode');
  });
});

// ─── C / D: the category path, unchanged ────────────────────────────────

describe('C / D — category transitions are untouched', () => {
  it('C index 0 never transitions, whatever the first category', () => {
    for (const first of ['l', 'c', 'x', 'o']) {
      expect(primitiveGroupOnEntering(seq(first, 'c', 'o'), 0)).toBeNull();
    }
  });

  it('D a later transition still warms up', () => {
    expect(primitiveGroupOnEntering(seq('l', 'i', 'c'), 2)).toBe('curved');
    expect(primitiveGroupOnEntering(seq('l', 'i', 'c'), 1)).toBeNull();
  });

  it('preWritingTransition.js was not modified', () => {
    const code = readCode('./preWritingTransition.js');
    expect(code).toMatch(/index <= 0 \|\| index >= sequence\.length\) return null;/);
    expect(code).toMatch(/return previousGroup === currentGroup \? null : currentGroup;/);
    expect(code).not.toMatch(/isSessionEntryLetter|adaptive/i);
  });
});

// ─── E / F: remediation must still run ──────────────────────────────────

describe('E / F — cycle-3 remediation survives the guard', () => {
  it('E the first letter still earns remediation after two failed cycles', () => {
    // c is the session's first letter — index 0 the entire time it fails.
    expect(hasRemediationHandled({ ...WHO, cycleNumber: 3 })).toBe(false);
    expect(markRemediationHandled({ ...WHO, cycleNumber: 3 })).toBe(true);
    expect(buildLetterRemediationActivities('c')).toHaveLength(1);
  });

  it('E the trigger does NOT route through the adaptive decision helper', () => {
    // This is what makes the guard safe: two separate code paths.
    for (const rel of SCREENS) {
      const code = readCode(rel);
      const start = code.indexOf('const handleFailedCycle');
      let i = code.indexOf('{', code.indexOf('=>', start));
      let depth = 0;
      for (;; i += 1) {
        if (code[i] === '{') depth += 1;
        else if (code[i] === '}') { depth -= 1; if (depth === 0) break; }
      }
      const body = code.slice(start, i + 1);
      expect(body).toMatch(/PRE_WRITING_REASON\.CYCLE_3_REMEDIATION/);
      expect(body).not.toMatch(/resolveAdaptivePreWritingDetour|isSessionEntryLetter/);
    }
  });

  it('E the guard is NOT a blanket index-0 block', () => {
    for (const rel of SCREENS) {
      const code = readCode(rel);
      // The only place letterIdx === 0 gates navigation is the adaptive call.
      const gates = code.match(/letterIdx === 0/g) || [];
      expect(gates).toHaveLength(1);
      expect(code).toMatch(/isSessionEntryLetter: letterIdx === 0,/);
      expect(code).not.toMatch(/if \(letterIdx === 0\) return;/);
    }
  });

  it('F the sliced return sequence puts the letter at index 0 — remediation already ran', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel)).toMatch(/letterSequence: sequence\.slice\(letterIdx\),/);
    }
    // Marked, so a replay is refused — but it DID run once.
    markRemediationHandled({ ...WHO, cycleNumber: 3 });
    expect(hasRemediationHandled({ ...WHO, cycleNumber: 3 })).toBe(true);
  });

  it('F returning from remediation suppresses a redundant adaptive detour', () => {
    markRemediationHandled({ ...WHO, cycleNumber: 3 });
    // markRemediationHandled also marks the SHARED key, so the adaptive
    // effect that runs on the remount stands down on alreadyHandled — a
    // second warm-up back-to-back would be the redundancy §7 forbids.
    expect(hasWarmupHandled(WHO)).toBe(true);
    const decision = resolveAdaptivePreWritingDetour(
      eligible({ alreadyHandled: true, isSessionEntryLetter: true }));
    expect(decision.shouldNavigate).toBe(false);
  });

  it('a CATEGORY warm-up still never suppresses later remediation', () => {
    markWarmupHandled({ ...WHO, reason: PRE_WRITING_REASON.CATEGORY_TRANSITION });
    expect(hasWarmupHandled(WHO)).toBe(true);
    expect(hasRemediationHandled({ ...WHO, cycleNumber: 3 })).toBe(false);
  });

  it('the two maps are still separate', () => {
    const guard = readCode('./preWritingSessionGuard.js');
    expect(guard).toMatch(/const handledWarmups = new Map\(\);/);
    expect(guard).toMatch(/const handledRemediations = new Map\(\);/);
  });
});

// ─── G / H: a single-letter session ─────────────────────────────────────

describe('G / H — a single-letter session', () => {
  it('G starts directly, even with an adaptive recommendation waiting', () => {
    expect(primitiveGroupOnEntering(seq('o'), 0)).toBeNull();
    const decision = resolveAdaptivePreWritingDetour(eligible({
      recommendation: { recommended: true, letter: 'o', caseType: 'lowercase', interactionId: 'int-1' },
      currentLetter: 'o', isSessionEntryLetter: true,
    }));
    expect(decision.shouldNavigate).toBe(false);
    expect(decision.reason).toBe('session_entry_letter');
  });

  it('H the same letter still gets remediation after two failed cycles', () => {
    const who = { ...WHO, letter: 'o' };
    expect(buildLetterRemediationActivities('o').map((a) => a.id)).toEqual(['trace_circle']);
    expect(markRemediationHandled({ ...who, cycleNumber: 3 })).toBe(true);
    expect(hasRemediationHandled({ ...who, cycleNumber: 3 })).toBe(true);
  });
});

// ─── I: collection mode ─────────────────────────────────────────────────

describe('I — collection mode is untouched', () => {
  it('never remediates and never adapts', () => {
    markRemediationHandled({ ...WHO, cycleNumber: 3 });
    expect(hasRemediationHandled({ ...WHO, cycleNumber: 3, collectionMode: true })).toBe(false);
    expect(hasWarmupHandled({ ...WHO, collectionMode: true })).toBe(false);
    expect(resolveAdaptivePreWritingDetour(eligible({ collectionMode: true })).shouldNavigate)
      .toBe(false);
  });

  it('the remediation trigger is gated on !collectionMode', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel))
        .toMatch(/if \(used === MAX_CYCLES_PER_LETTER_PER_DATE - 1 && !collectionMode\) \{/);
    }
  });

  it('the fixed research protocol still advances in place', () => {
    for (const rel of SCREENS) {
      expect(readCode(rel)).toMatch(/\} else if \(collectionMode\) \{/);
    }
  });
});

// ─── §11 regression ─────────────────────────────────────────────────────

describe('SENTINEL — §11 nothing else changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('remediation recipes and curve directions are untouched', () => {
    expect(buildLetterRemediationActivities('b').map((a) => a.id))
      .toEqual(['connect_vertical_dots', 'trace_half_circle_ccw']);
    expect(buildLetterRemediationActivities('c').map((a) => a.id))
      .toEqual(['trace_half_circle_cw']);
    expect((readCode('../constants/letterCategories.js')
      .match(/strokeVariants: \{ half_circle: '(cap|cup)' \}/g) || [])).toHaveLength(11);
  });

  it('Cycle-3 omits PRACTISE_FIRST while keeping FOLLOW_PATH', () => {
    const screen = readCode('../screens/handwriting/PreWritingActivityScreen.js');
    expect(screen).not.toMatch(/PRACTISE_FIRST|REMEDIATION_LEAD_IN/);
    expect(screen).toMatch(/CHILD_INSTRUCTIONS\[INSTRUCTION_KEYS\.FOLLOW_PATH\]/);
    expect(screen).toMatch(/useInstructionAudio\(INSTRUCTION_KEYS\.FOLLOW_PATH/);
    expect(screen).not.toMatch(/isSessionEntryLetter/);
  });

  it('geometry, canvas and speech are untouched', () => {
    expect((read('../constants/preWritingActivities.js').match(/generatePoints:/g) || []).length).toBe(18);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
  });

  it('child instruction wording is untouched', () => {
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.PRACTISE_FIRST].en).toBe("Let's practise first");
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH].en).toBe('Follow the path');
  });

  it('the caps, threshold and mastery rule are untouched', () => {
    expect(readCode('./letterCycleGuard.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('the guard module gained a reason and a flag, nothing else', () => {
    const guard = readCode('./preWritingSessionGuard.js');
    expect(guard).toMatch(/SESSION_ENTRY_LETTER:\s+'session_entry_letter',/);
    expect(guard).not.toMatch(/AsyncStorage|client\.|ENDPOINTS/);
    expect(Object.keys(PRE_WRITING_REASON)).toHaveLength(4);
  });
});
