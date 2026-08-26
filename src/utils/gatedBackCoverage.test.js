// Every back button in the handwriting module must be behind the parent gate.
//
// Leaving a learning activity is an adult decision: a child tapping back
// mid-task abandons captured work, or lands on teacher-facing screens. The
// Concept section already gates its back buttons; this suite pins the same
// guarantee across the handwriting module and, crucially, FAILS if a future
// screen adds an ungated one.

import fs from 'fs';
import path from 'path';

const SCREENS_DIR = path.resolve(__dirname, '../screens/handwriting');

// Registered in no navigator and referenced nowhere — dead files, excluded
// deliberately rather than silently skipped.
const DEAD_FILES = ['AvatarSelectScreen.js', 'ChildWelcomeScreen.js'];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/Screen\.js$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const screens = walk(SCREENS_DIR).filter((f) => !DEAD_FILES.includes(path.basename(f)));

function read(f) { return fs.readFileSync(f, 'utf8'); }
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** A screen "has a back control" if it renders a back arrow or uses the shared button. */
function hasBackControl(src) {
  return /arrow-back|chevron-back/.test(src) || src.includes('ScreenBackButton');
}

/** Gated either via the shared hook or LetterHomeScreen's own gate-action mechanism. */
function isGated(src) {
  return src.includes('useGatedBack') || src.includes("requestGatedAction('back')");
}

function rendersGate(src) {
  return src.includes('{gateModal}') || src.includes('<ParentGateModal');
}

describe('the shared gate hook', () => {
  const hook = read(path.resolve(__dirname, './useGatedBack.js'));

  it('routes through ParentGateModal, not a bespoke prompt', () => {
    expect(hook).toMatch(/import \{ ParentGateModal \}/);
  });

  it('closes the gate before running the confirmed action', () => {
    const body = hook.slice(hook.indexOf('const handleSuccess'), hook.indexOf('const handleCancel'));
    expect(body.indexOf('setGateVisible(false)')).toBeLessThan(body.indexOf('onConfirmRef.current'));
  });

  it('cancelling never navigates', () => {
    const body = hook.slice(hook.indexOf('const handleCancel'), hook.indexOf('const gateModal'));
    expect(body).not.toMatch(/navigation\.|onConfirm/);
  });

  it('holds the callback in a ref so a stale closure can never fire', () => {
    expect(hook).toMatch(/onConfirmRef = useRef\(onConfirm\)/);
    expect(hook).toMatch(/onConfirmRef\.current = onConfirm/);
  });
});

describe('every handwriting back button is gated', () => {
  const withBack = screens.filter((f) => hasBackControl(read(f)));

  it('finds the expected set of screens with a back control', () => {
    // Guards the walk itself: if this drops to 0 the suite would pass vacuously.
    expect(withBack.length).toBeGreaterThanOrEqual(10);
  });

  it.each(withBack.map((f) => [path.basename(f), f]))('%s gates its back button', (_name, file) => {
    const src = read(file);
    expect(isGated(src)).toBe(true);
    expect(rendersGate(src)).toBe(true);
  });

  it.each(withBack.map((f) => [path.basename(f), f]))(
    '%s has no back button that navigates without the gate',
    (_name, file) => {
      const code = stripComments(read(file));
      // The shared hook is the only thing allowed to trigger back navigation,
      // so no back-arrow button may carry a direct navigation onPress.
      const directBackNav = /onPress=\{\(\) => navigation\.goBack\(\)\}/.test(code);
      expect(directBackNav).toBe(false);
    },
  );
});

describe('the gate cannot be sidestepped', () => {
  it.each(screens.map((f) => [path.basename(f), f]))(
    '%s adds no hardware/gesture back path that skips the gate',
    (_name, file) => {
      const code = stripComments(read(file));
      expect(code).not.toMatch(/BackHandler/);
      expect(code).not.toMatch(/gestureEnabled/);
    },
  );

  it('no screen defines a second, private gate implementation', () => {
    for (const f of screens) {
      const src = read(f);
      if (!hasBackControl(src)) continue;
      // LetterHomeScreen legitimately renders ParentGateModal directly (it
      // gates four different actions, not just back); every other screen must
      // go through the shared hook.
      if (path.basename(f) === 'LetterHomeScreen.js') continue;
      if (src.includes('<ParentGateModal')) {
        expect(src).toContain('useGatedBack');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Teacher-destination routes must ALL be gated, not just back buttons
//
// A gate on the back button is worthless if an ungated button beside it
// reaches the same place. These pin the two bypasses the completion audit
// found: LetterHomeScreen's Dashboard button and WordLetterSelectScreen's
// Teacher button both opened teacher-facing destinations that the very same
// screens already gated by another route.
// ═══════════════════════════════════════════════════════════════════════════

describe('every navigation to a teacher-facing destination is gated', () => {
  const TEACHER_DESTINATIONS = ['TeacherReport', 'TeacherMain'];

  it('no handwriting screen navigates to a teacher destination from a raw onPress', () => {
    const offenders = [];
    for (const file of screens) {
      const code = stripComments(read(file));
      for (const dest of TEACHER_DESTINATIONS) {
        // An onPress that navigates straight to a teacher screen, with no
        // gate between the tap and the navigation.
        const collapsed = code.replace(/\s+/g, '');
        for (const quote of ["'", '"']) {
          if (collapsed.includes(`onPress={()=>navigation.navigate(${quote}${dest}${quote}`)) {
            offenders.push(`${path.basename(file)} -> ${dest}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('LetterHomeScreen routes Dashboard through its gate, like every other exit', () => {
    const code = stripComments(read(path.join(SCREENS_DIR, 'LetterHomeScreen.js')));
    expect(code).toMatch(/requestGatedAction\('dashboard'\)/);
    expect(code).toMatch(/pendingGateAction === 'dashboard'\) navigation\.navigate\('TeacherMain'\)/);
    // And never straight from a tap.
    expect(code).not.toMatch(/onPress=\{\(\) => navigation\.navigate\('TeacherMain'\)\}/);
  });

  it('WordLetterSelectScreen routes the Teacher button through the SAME gate mechanism', () => {
    const code = stripComments(read(path.join(SCREENS_DIR, 'words/WordLetterSelectScreen.js')));
    // Reuses the existing hook — no new authentication concept.
    expect(code).toMatch(/useGatedBack\(\(\) => navigation\.navigate\('TeacherReport'/);
    expect(code).toMatch(/onPress=\{requestTeacherReport\}/);
    expect(code).toMatch(/\{teacherReportGateModal\}/);
    expect(code).not.toMatch(/onPress=\{\(\) => navigation\.navigate\('TeacherReport'/);
  });

  it('the child-facing Rewards/progress routes stay ungated — they are not teacher screens', () => {
    const code = stripComments(read(path.join(SCREENS_DIR, 'words/WordLetterSelectScreen.js')));
    expect(code).toMatch(/onPress=\{\(\) => navigation\.navigate\('WordProgress'/);
  });
});

describe('the Android hardware back button cannot bypass the gate', () => {
  const hookSrc = read(path.resolve(__dirname, './useGatedBack.js'));

  it('useGatedBack intercepts hardwareBackPress while focused', () => {
    const code = stripComments(hookSrc);
    expect(code).toMatch(/BackHandler\.addEventListener\('hardwareBackPress'/);
    expect(code).toMatch(/useFocusEffect/);
    // Returning true suppresses React Navigation's own default back.
    expect(code).toMatch(/return true;/);
    // And the listener is removed on blur, so it never leaks to another screen.
    expect(code).toMatch(/subscription\.remove\(\)/);
  });

  it('the hardware handler opens the gate and never navigates itself', () => {
    const fn = hookSrc.slice(
      hookSrc.indexOf('export function useGatedHardwareBack'),
      hookSrc.indexOf('export default function useGatedBack'),
    );
    expect(stripComments(fn)).not.toMatch(/navigation\.|goBack|navigate\(/);
    expect(stripComments(fn)).toMatch(/onRequestRef\.current\?\.\(\)/);
  });

  it('it is disabled while the gate is already open, so the modal stays dismissible', () => {
    expect(stripComments(hookSrc)).toMatch(/useGatedHardwareBack\(requestBack, !gateVisible\)/);
  });

  it('LetterHomeScreen wires the same hook for its own gate', () => {
    const code = stripComments(read(path.join(SCREENS_DIR, 'LetterHomeScreen.js')));
    expect(code).toMatch(/useGatedHardwareBack\(\(\) => requestGatedAction\('back'\), !gateVisible\)/);
  });

  it('every handwriting screen with a gated back control gets hardware-back protection', () => {
    // Either through the shared hook (which wires it internally) or explicitly.
    const unprotected = screens.filter((f) => {
      const src = read(f);
      if (!hasBackControl(src) || !isGated(src)) return false;
      return !src.includes('useGatedBack') && !src.includes('useGatedHardwareBack');
    });
    expect(unprotected).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Completion POST must not be double-submittable
//
// The Next button is only disabled while attempt feedback is showing, and
// that flag clears BEFORE the completion POST is sent. Without an in-flight
// guard a second tap in that window sends a whole second completion, which
// live data shows happening: attempt-3 rows for the same student and letter
// under different session_keys, seconds apart.
// ═══════════════════════════════════════════════════════════════════════════

describe('letter completion cannot be submitted twice', () => {
  const writing = read(path.join(SCREENS_DIR, 'LetterWritingScreen.js'));
  const code = stripComments(writing);

  it('handleNext is guarded by a synchronous in-flight ref', () => {
    expect(code).toMatch(/const submitInFlightRef = useRef\(false\)/);
    expect(code).toMatch(/if \(submitInFlightRef\.current\) return;/);
    expect(code).toMatch(/submitInFlightRef\.current = true;/);
  });

  it('the guard is released in finally, so a failed cycle can be retried', () => {
    const fn = code.slice(code.indexOf('const handleNext = useCallback'));
    expect(fn.slice(0, 400)).toMatch(/finally\s*\{\s*submitInFlightRef\.current = false;/);
  });

  it('the real cycle body runs under the guard, not beside it', () => {
    expect(code).toMatch(/await runNextCycle\(\);/);
    // Declaration order matters — a const referenced before its declaration
    // would throw at render time.
    expect(code.indexOf('const runNextCycle')).toBeGreaterThan(-1);
    expect(code.indexOf('const runNextCycle')).toBeLessThan(code.indexOf('const handleNext'));
  });

  it('the button still calls handleNext, not the unguarded body', () => {
    expect(writing).toMatch(/onPress=\{handleNext\}/);
    expect(writing).not.toMatch(/onPress=\{runNextCycle\}/);
  });
});
