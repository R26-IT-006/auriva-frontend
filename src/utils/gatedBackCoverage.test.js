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
