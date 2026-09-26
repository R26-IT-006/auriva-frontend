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
 * Both hooks lock on focus. Cleanup releases only when another orientation-
 * owning screen has not taken over, so the newest focused screen wins even
 * when native lock/unlock promises complete out of order.
 *
 * ── Release semantics ──────────────────────────────────────────────────────
 * Cleanup calls `unlockAsync()` only when no newer orientation-owning screen
 * has taken over. That restores app.json (`"orientation": "default"` — free
 * rotation) without overriding the destination screen.
 *
 * ── Failure behaviour ──────────────────────────────────────────────────────
 * Orientation locking is a native call: it is a no-op on web and can reject on
 * devices/emulators that pin the activity orientation. Every call is guarded —
 * a failure leaves the screen fully usable in whatever orientation the device
 * is already in, and is never surfaced to the child or the teacher. A sideways
 * screen is a much smaller problem than a crashed one.
 *
 * The `cancelled` flag guards the async gap. If a stale lock resolves after
 * navigation, it reapplies the newest request instead of unlocking the new
 * destination. Cleanup defers release by one microtask so destination focus
 * can acquire ownership first.
 */

'use strict';

import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';

let nextRequestId = 0;
let activeRequest = null;

/**
 * Shared implementation. `lockName` is only used for the dev-log line, so a
 * failure is traceable to the screen that asked for it.
 */
function useLockTo(orientationLock, lockName) {
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const request = { id: ++nextRequestId, orientationLock };
      activeRequest = request;

      (async () => {
        try {
          await ScreenOrientation.lockAsync(orientationLock);
          if (cancelled) {
            // Blurred while the lock was in flight: restore the newest owner,
            // or release when no orientation-owning screen remains.
            if (activeRequest) {
              await ScreenOrientation.lockAsync(activeRequest.orientationLock);
            } else {
              await ScreenOrientation.unlockAsync();
            }
          }
        } catch (err) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(`[useOrientationLock] ${lockName} lock failed — leaving orientation as-is:`, err?.message ?? err);
          }
        }
      })();

      return () => {
        cancelled = true;
        if (activeRequest?.id !== request.id) return;
        activeRequest = null;
        Promise.resolve().then(() => {
          if (activeRequest) return;
          ScreenOrientation.unlockAsync().catch((err) => {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.log(`[useOrientationLock] ${lockName} unlock failed:`, err?.message ?? err);
            }
          });
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
