import fs from 'fs';
import path from 'path';

/**
 * Proposal FR-13, Phase 7A — screen/context-level wiring proof. These
 * screens import 'react-native' and can't be mounted under this repo's
 * plain-node jest config; verified by source-text assertion, the same
 * established technique this project already uses for screen files
 * (teacherReportLoadGuard.test.js, uppercaseProgressionFix.test.js). The
 * actual timer RULE has full behavioral coverage in
 * learningSessionTimer.test.js — this file proves the screens/context are
 * correctly WIRED to it, exactly once each, and that no forbidden
 * terminology leaked into any UI-facing string.
 */

function read(relPath) {
  return fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
}

const contextSource  = read('../context/LearningSessionContext.js');
const modalSource    = read('../components/handwriting/BreakPromptModal.js');
const policySource   = read('../constants/learningSessionPolicy.js');
const navigatorSource = read('../navigation/HandwritingNavigator.js');

const LEARNING_SCREENS = [
  { name: 'LetterWritingScreen',    path: '../screens/teacher/handwriting/LetterWritingScreen.js' },
  { name: 'UppercaseWritingScreen', path: '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js' },
  { name: 'WordWritingScreen',      path: '../screens/teacher/handwriting/words/WordWritingScreen.js' },
  { name: 'PreWritingActivityScreen', path: '../screens/teacher/handwriting/PreWritingActivityScreen.js' },
  { name: 'WordActivityScreen',     path: '../screens/teacher/handwriting/words/WordActivityScreen.js' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 1/14. Timer starts entering learning flow — exactly one central mechanism,
// never an independent per-screen timer.
// ═══════════════════════════════════════════════════════════════════════════

describe('One central session mechanism — no independent per-screen timers', () => {
  it('LearningSessionProvider wraps the entire handwriting Stack.Navigator exactly once', () => {
    const providerOpens = (navigatorSource.match(/<LearningSessionProvider>/g) || []).length;
    expect(providerOpens).toBe(1);
  });

  it('every learning screen registers activity via the shared hook — never a local setInterval/setTimeout-based duration timer', () => {
    for (const { name, path: p } of LEARNING_SCREENS) {
      const source = read(p);
      expect(source).toContain('useLearningSessionActivity');
      // No screen re-implements its own duration-tracking interval.
      expect(source).not.toMatch(/setInterval\([^)]*SESSION_MAX|setInterval\([^)]*SESSION_WARNING/);
    }
  });

  it('ExerciseE_WriteWord (nested inside WordActivityScreen) uses the base hook, not a second registration', () => {
    const source = read('../components/word/ExerciseE_WriteWord.js');
    expect(source).toContain('useLearningSession');
    expect(source).not.toContain('useLearningSessionActivity'); // registers once, at the screen level only
  });

  it('each learning screen renders BreakPromptModal exactly once', () => {
    for (const { name, path: p } of LEARNING_SCREENS) {
      const source = read(p);
      const count = (source.match(/<BreakPromptModal/g) || []).length;
      expect(count).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6/7. Stroke tracking — the prompt must never interrupt an in-progress stroke
// ═══════════════════════════════════════════════════════════════════════════

describe('Stroke-level tracking wired into every real drawing canvas', () => {
  const canvasScreens = [
    '../screens/teacher/handwriting/LetterWritingScreen.js',
    '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
    '../screens/teacher/handwriting/words/WordWritingScreen.js',
    '../screens/teacher/handwriting/PreWritingActivityScreen.js',
    '../components/word/ExerciseE_WriteWord.js',
  ];

  it('every canvas screen calls notifyStrokeStart() inside onPanResponderGrant', () => {
    for (const p of canvasScreens) {
      const source = read(p);
      const grantBlock = source.slice(source.indexOf('onPanResponderGrant'), source.indexOf('onPanResponderGrant') + 400);
      expect(grantBlock).toContain('notifyStrokeStart()');
    }
  });

  it('every canvas screen calls notifyStrokeEnd() inside onPanResponderRelease', () => {
    for (const p of canvasScreens) {
      const source = read(p);
      const releaseIdx = source.indexOf('onPanResponderRelease');
      const releaseBlock = source.slice(releaseIdx, releaseIdx + 400);
      expect(releaseBlock).toContain('notifyStrokeEnd()');
    }
  });

  it('every canvas screen that defines onPanResponderTerminate also calls notifyStrokeEnd() there (an OS-interrupted gesture must not leave isWriting stuck true)', () => {
    for (const p of canvasScreens) {
      const source = read(p);
      const idx = source.indexOf('onPanResponderTerminate');
      if (idx === -1) continue; // PreWritingActivityScreen has no terminate handler — release alone covers it
      const block = source.slice(idx, idx + 400);
      expect(block).toContain('notifyStrokeEnd()');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. Timer configuration comes from central constants — never a magic number
// ═══════════════════════════════════════════════════════════════════════════

describe('Configuration is centralized — never a magic number in a screen', () => {
  it('learningSessionPolicy.js exports the 3 named pilot constants, clearly labeled as pilot/engineering defaults', () => {
    expect(policySource).toContain('export const SESSION_WARNING_MINUTES');
    expect(policySource).toContain('export const SESSION_MAX_MINUTES');
    expect(policySource).toMatch(/PILOT \/ ENGINEERING DEFAULT/);
  });

  it('LearningSessionContext.js imports the constants rather than hardcoding minute values', () => {
    expect(contextSource).toContain("from '../constants/learningSessionPolicy'");
  });

  it('no learning screen hardcodes a session-duration number of its own', () => {
    for (const { path: p } of LEARNING_SCREENS) {
      const source = read(p);
      expect(source).not.toMatch(/SESSION_(WARNING|MAX)_MINUTES\s*=\s*\d/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18. No "fatigue detected"/diagnostic terminology anywhere user-facing
// ═══════════════════════════════════════════════════════════════════════════

// Strips comments so the terminology guard checks only what actually reaches
// the UI/TTS — not source comments that document a forbidden term in order
// to forbid it (e.g. "Deliberately NOT: ... an alarm sound").
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Terminology guard — no fatigue/diagnosis language in any FR-13 UI text', () => {
  const modalCodeOnly = stripComments(modalSource);

  it('BreakPromptModal never uses fatigue/diagnostic language in rendered text', () => {
    const lower = modalCodeOnly.toLowerCase();
    expect(lower).not.toMatch(/fatigue detected|autistic fatigue|clinical fatigue|motor fatigue diagnosis/);
  });

  it('BreakPromptModal uses the approved terms: "Take a Break" / "Finish for Now" / a session-time framing', () => {
    expect(modalSource).toContain('Take a Break');
    expect(modalSource).toContain('Finish for Now');
    expect(modalSource).toMatch(/short break/i);
  });

  it('no countdown, alarm, or red/flashing-severity styling actually rendered in the modal', () => {
    expect(modalCodeOnly).not.toMatch(/countdown|alarm|#FF0000|#EF4444|#B91C1C|flashing/i);
  });

  it('learningSessionTimer.js source itself (status values etc.) is also free of the forbidden terms outside comments', () => {
    const timerSource = stripComments(read('./learningSessionTimer.js'));
    expect(timerSource.toLowerCase()).not.toMatch(/fatigue|diagnos/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7/8. Break/Finish actions navigate to the calm hub, never freeze the canvas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 13. collection_mode — clearly excluded from FR-13's session timer/break
// prompt (a fixed, teacher-supervised research-capture protocol, not
// open-ended self-paced practice). Only LetterWritingScreen and
// UppercaseWritingScreen ever run in collection_mode.
// ═══════════════════════════════════════════════════════════════════════════

describe('collection_mode is clearly excluded from the FR-13 timer/break prompt', () => {
  const collectionCapableScreens = [
    '../screens/teacher/handwriting/LetterWritingScreen.js',
    '../screens/teacher/handwriting/uppercase/UppercaseWritingScreen.js',
  ];

  it('useLearningSessionActivity supports a suspend option, and does not register/unregister while suspended', () => {
    expect(contextSource).toContain('export function useLearningSessionActivity(options = {})');
    expect(contextSource).toContain('if (suspend) return undefined');
  });

  it('LetterWritingScreen and UppercaseWritingScreen pass suspend: collectionMode into the hook', () => {
    // Proposal FR-16, Phase 7B added studentId/activityType alongside
    // suspend on this same call (see liveSessionWiring.test.js) — this
    // check only needs to confirm suspend:collectionMode is still one of
    // the options passed, not that it's the only one.
    for (const p of collectionCapableScreens) {
      const source = read(p);
      expect(source).toMatch(/useLearningSessionActivity\(\{\s*\n?\s*suspend:\s*collectionMode,?/);
    }
  });

  it('LetterWritingScreen and UppercaseWritingScreen do not render BreakPromptModal while collectionMode is true', () => {
    for (const p of collectionCapableScreens) {
      const source = read(p);
      expect(source).toMatch(/\{!collectionMode\s*&&\s*\(\s*<BreakPromptModal/);
    }
  });

  it('screens with no collection_mode concept (WordWriting/PreWritingActivity/WordActivity) render BreakPromptModal unconditionally', () => {
    const unconditional = [
      '../screens/teacher/handwriting/words/WordWritingScreen.js',
      '../screens/teacher/handwriting/PreWritingActivityScreen.js',
      '../screens/teacher/handwriting/words/WordActivityScreen.js',
    ];
    for (const p of unconditional) {
      const source = read(p);
      expect(source).not.toMatch(/collectionMode/);
      expect(source).toMatch(/<BreakPromptModal/);
    }
  });

  it('collection protocol semantics themselves are untouched — no edits to collection_mode data-capture logic, only to whether the unrelated FR-13 clock runs', () => {
    // The suspend branch is a pure early-return before any registration call;
    // it does not read or write anything collection-protocol-related.
    const suspendBlock = contextSource.slice(
      contextSource.indexOf('export function useLearningSessionActivity'),
      contextSource.indexOf('export function useLearningSessionActivity') + 700
    );
    expect(suspendBlock).not.toMatch(/collection_session_id|DATA_COLLECTION_PROTOCOL|capture_status/);
  });
});

describe('Take a Break / Finish for Now behavior', () => {
  it('both actions navigate to LetterHome (the existing calm hub) rather than manipulating canvas state directly', () => {
    const takeBreakBlock = modalSource.slice(modalSource.indexOf('const onTakeBreak'), modalSource.indexOf('const onFinishForNow'));
    expect(takeBreakBlock).toContain('takeBreak()');
    expect(takeBreakBlock).toContain("navigation.navigate('LetterHome'");

    const finishBlock = modalSource.slice(modalSource.indexOf('const onFinishForNow'), modalSource.indexOf('const onContinue'));
    expect(finishBlock).toContain('finishForNow()');
    expect(finishBlock).toContain("navigation.navigate('LetterHome'");
  });

  it('"Continue" is gated behind the existing adult ParentGateModal, never a bare child-tappable bypass', () => {
    expect(modalSource).toContain('ParentGateModal');
    expect(modalSource).toContain('onSuccess={() => { setGateVisible(false); onContinue?.(); }}');
  });
});
