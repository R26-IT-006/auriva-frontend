/**
 * useOrientationLock.js
 *
 * Per-screen orientation locking for the handwriting module.
 *
 * The writing activities are designed for a tablet held in LANDSCAPE — the
 * canvas, the tracer and the avatar feedback all assume a wide viewport. The
 * teacher's progress report is the one exception: it is a long, dense,
 * scrolling document that reads far better in PORTRAIT.
 *
 * Both hooks lock on focus and RELEASE on blur, so a screen only ever affects
 * itself. React Navigation fires blur before the next screen's focus, so
 * moving between a landscape screen and the portrait report resolves in the
 * right order without either screen knowing about the other.
 *
 * ── Release semantics ──────────────────────────────────────────────────────
 * Cleanup calls `unlockAsync()`, which restores the app-level setting from
 * app.json (`"orientation": "default"` — free rotation). Deliberately NOT a
 * lock back to some "previous" orientation: nothing outside this module locks
 * anything, so forcing one on the way out would change screens that never
 * asked for it.
 *
 * ── Failure behaviour ──────────────────────────────────────────────────────
 * Orientation locking is a native call: it is a no-op on web and can reject on
 * devices/emulators that pin the activity orientation. Every call is guarded —
 * a failure leaves the screen fully usable in whatever orientation the device
 * is already in, and is never surfaced to the child or the teacher. A sideways
 * screen is a much smaller problem than a crashed one.
 *
 * The `cancelled` flag guards the async gap: if the screen is blurred before
 * the lock resolves, the pending lock must not land after cleanup has already
 * run, or it would leak onto the next screen.
 */

'use strict';

import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Shared implementation. `lockName` is only used for the dev-log line, so a
 * failure is traceable to the screen that asked for it.
 */
function useLockTo(orientationLock, lockName) {
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          await ScreenOrientation.lockAsync(orientationLock);
          if (cancelled) {
            // Blurred while the lock was in flight — undo it immediately so
            // it cannot leak onto the screen that is now showing.
            await ScreenOrientation.unlockAsync();
          }
        } catch (err) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[useOrientationLock] ${lockName} lock failed — leaving orientation as-is:`, err?.message ?? err);
          }
        }
      })();

      return () => {
        cancelled = true;
        ScreenOrientation.unlockAsync().catch((err) => {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[useOrientationLock] ${lockName} unlock failed:`, err?.message ?? err);
          }
        });
      };
      // orientationLock/lockName are module constants at every call site.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
}

/**
 * Locks the device to landscape while this screen is focused.
 *
 * Uses OrientationLock.LANDSCAPE (not LANDSCAPE_LEFT) so the tablet may still
 * be rotated 180° — a child or teacher turning the device end-for-end keeps
 * working, which a single-sided lock would prevent.
 */
export function useLockLandscape() {
  useLockTo(ScreenOrientation.OrientationLock.LANDSCAPE, 'landscape');
}

/** Locks the device to portrait while this screen is focused. */
export function useLockPortrait() {
  useLockTo(ScreenOrientation.OrientationLock.PORTRAIT_UP, 'portrait');
}

export default useLockLandscape;
