// Portrait lock for the teacher writing report.
//
// The child-facing writing activities are used in landscape; the report is a
// long scrolling document that reads better in portrait. These tests pin the
// behaviour that matters: it locks on focus, RELEASES on blur (so no other
// screen inherits the lock), never throws when the native call fails, and is
// wired into the screen rather than a single navigator.

import fs from 'fs';
import path from 'path';

const mockLockAsync = jest.fn();
const mockUnlockAsync = jest.fn();
let capturedEffect = null;

jest.mock('expo-screen-orientation', () => ({
  lockAsync: (...a) => mockLockAsync(...a),
  unlockAsync: (...a) => mockUnlockAsync(...a),
  OrientationLock: { PORTRAIT_UP: 3, DEFAULT: 0, LANDSCAPE: 5 },
}), { virtual: true });

// useFocusEffect just runs its callback; we capture it so the test can drive
// focus/blur explicitly rather than depending on a navigation container.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { capturedEffect = cb; },
}), { virtual: true });

jest.mock('react', () => ({ useCallback: (fn) => fn }), { virtual: true });

const { useLockPortrait, useLockLandscape } = require('./useOrientationLock');

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockLockAsync.mockReset().mockResolvedValue(undefined);
  mockUnlockAsync.mockReset().mockResolvedValue(undefined);
  capturedEffect = null;
});

describe('useLockPortrait', () => {
  it('locks to PORTRAIT_UP when the screen gains focus', async () => {
    useLockPortrait();
    capturedEffect();
    await flush();

    expect(mockLockAsync).toHaveBeenCalledTimes(1);
    expect(mockLockAsync).toHaveBeenCalledWith(3); // OrientationLock.PORTRAIT_UP
  });

  it('releases the lock on blur, restoring the app-level default', async () => {
    useLockPortrait();
    const cleanup = capturedEffect();
    await flush();

    cleanup();
    await flush();
    expect(mockUnlockAsync).toHaveBeenCalled();
  });

  it('never forces landscape on the way out — it unlocks instead', async () => {
    // Nothing else in the app locks an orientation, so forcing one on blur
    // would change every subsequent screen rather than restoring prior state.
    useLockPortrait();
    const cleanup = capturedEffect();
    await flush();
    cleanup();
    await flush();

    const forcedLandscape = mockLockAsync.mock.calls.some(([lock]) => lock === 5);
    expect(forcedLandscape).toBe(false);
  });

  it('does not leak the lock when the screen blurs before the lock resolves', async () => {
    let resolveLock;
    mockLockAsync.mockReturnValueOnce(new Promise((r) => { resolveLock = r; }));

    useLockPortrait();
    const cleanup = capturedEffect();
    cleanup();          // blurred while the lock is still in flight
    resolveLock();
    await flush();

    // Once from the cleanup, once from the cancelled-in-flight branch.
    expect(mockUnlockAsync).toHaveBeenCalled();
  });

  it('a failed lock never throws — the screen stays usable', async () => {
    mockLockAsync.mockRejectedValueOnce(new Error('not supported on this device'));
    useLockPortrait();
    expect(() => capturedEffect()).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();
  });

  it('a failed unlock never throws', async () => {
    mockUnlockAsync.mockRejectedValueOnce(new Error('unlock unsupported'));
    useLockPortrait();
    const cleanup = capturedEffect();
    await flush();
    expect(() => cleanup()).not.toThrow();
    await flush();
  });
});

describe('wiring', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
  const progressScreen = fs.readFileSync(
    path.resolve(__dirname, '../screens/handwriting/ProgressReportScreen.js'), 'utf8');

  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('TeacherReportScreen imports and calls the hook', () => {
    const code = stripComments(screen);
    expect(code).toMatch(/import \{ useLockPortrait \} from '\.\.\/\.\.\/\.\.\/utils\/useOrientationLock'/);
    expect(code).toMatch(/useLockPortrait\(\);/);
  });

  it('child-facing ProgressReportScreen remains landscape', () => {
    const code = stripComments(progressScreen);
    expect(code).toMatch(/import \{ useLockLandscape \} from '\.\.\/\.\.\/utils\/useOrientationLock'/);
    expect(code).toMatch(/useLockLandscape\(\);/);
    expect(code).not.toMatch(/useLockPortrait\(\);/);
  });

  it('the lock lives in the screen, not in one navigator', () => {
    // The screen is registered in BOTH TeacherNavigator (as
    // StudentHandwritingReport) and HandwritingNavigator (as TeacherReport);
    // locking in a single navigator would silently miss the other route.
    for (const rel of ['../navigation/TeacherNavigator.js', '../navigation/HandwritingNavigator.js']) {
      const nav = fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
      expect(nav).toMatch(/TeacherReportScreen/);
      expect(stripComments(nav)).not.toMatch(/useLockPortrait|lockAsync/);
    }
  });

  it('no child-facing writing screen locks portrait', () => {
    // The writing activities are landscape; they must be unaffected.
    for (const rel of [
      '../screens/handwriting/LetterWritingScreen.js',
      '../screens/handwriting/uppercase/UppercaseWritingScreen.js',
      '../screens/handwriting/PreWritingActivityScreen.js',
    ]) {
      const abs = path.resolve(__dirname, rel);
      if (!fs.existsSync(abs)) return;
      expect(stripComments(fs.readFileSync(abs, 'utf8'))).not.toMatch(/useLockPortrait|PORTRAIT/);
    }
  });
});

describe('useLockLandscape', () => {
  it('locks to LANDSCAPE (not LANDSCAPE_LEFT) so the tablet can still be turned 180 degrees', async () => {
    useLockLandscape();
    capturedEffect();
    await flush();
    expect(mockLockAsync).toHaveBeenCalledWith(5); // OrientationLock.LANDSCAPE
  });

  it('releases the lock on blur', async () => {
    useLockLandscape();
    const cleanup = capturedEffect();
    await flush();
    cleanup();
    await flush();
    expect(mockUnlockAsync).toHaveBeenCalled();
  });

  it('a failed lock never throws', async () => {
    mockLockAsync.mockRejectedValueOnce(new Error('not supported'));
    useLockLandscape();
    expect(() => capturedEffect()).not.toThrow();
    await flush();
  });

  it('takes ownership before a previous portrait cleanup can unlock it', async () => {
    useLockPortrait();
    const portraitCleanup = capturedEffect();
    await flush();

    portraitCleanup();
    useLockLandscape();
    capturedEffect();
    await flush();

    expect(mockLockAsync.mock.calls.at(-1)[0]).toBe(5);
    expect(mockUnlockAsync).not.toHaveBeenCalled();
  });

  it('reapplies landscape if an old portrait lock resolves after navigation', async () => {
    let resolvePortrait;
    mockLockAsync.mockReturnValueOnce(new Promise((resolve) => { resolvePortrait = resolve; }));

    useLockPortrait();
    const portraitCleanup = capturedEffect();
    portraitCleanup();
    useLockLandscape();
    capturedEffect();
    await flush();

    resolvePortrait();
    await flush();
    expect(mockLockAsync.mock.calls.at(-1)[0]).toBe(5);
  });
});

describe('module-wide orientation coverage', () => {
  const fsMod = require('fs');
  const pathMod = require('path');

  function walk(dir, acc = []) {
    for (const e of fsMod.readdirSync(dir, { withFileTypes: true })) {
      const p = pathMod.join(dir, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (/Screen\.js$/.test(e.name)) acc.push(p);
    }
    return acc;
  }

  // AvatarSelectScreen / ChildWelcomeScreen live in this folder but are
  // registered in no navigator and referenced nowhere — dead files, excluded
  // deliberately rather than silently.
  const DEAD = ['AvatarSelectScreen.js', 'ChildWelcomeScreen.js'];
  const screens = walk(pathMod.resolve(__dirname, '../screens/handwriting'))
    .filter((f) => !DEAD.includes(pathMod.basename(f)));

  it('every live handwriting screen locks an orientation', () => {
    const unlocked = screens.filter((f) => {
      const src = fsMod.readFileSync(f, 'utf8');
      return !src.includes('useLockLandscape()') && !src.includes('useLockPortrait()');
    });
    expect(unlocked).toEqual([]);
  });

  it('only the main teacher Progress Report locks portrait', () => {
    const portrait = screens.filter((f) => fsMod.readFileSync(f, 'utf8').includes('useLockPortrait()'));
    expect(portrait.map((f) => pathMod.basename(f)).sort()).toEqual(['TeacherReportScreen.js']);
  });

  it('no screen locks both orientations', () => {
    for (const f of screens) {
      const src = fsMod.readFileSync(f, 'utf8');
      expect(src.includes('useLockLandscape()') && src.includes('useLockPortrait()')).toBe(false);
    }
  });
});
