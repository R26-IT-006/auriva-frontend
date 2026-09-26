/**
 * demoDetour.js
 *
 * The one place a screen asks "does this child need the demonstration
 * first?", so all four call sites behave identically.
 *
 * ── The ordering that makes this safe ───────────────────────────────────
 *   1. read the child's completed demos (async, AsyncStorage)
 *   2. decide (demoPolicy.shouldShowDemo — pure)
 *   3. CLAIM the in-memory latch synchronously (demoGuard)
 *   4. only then navigate
 *
 * Step 3 before step 4 is the whole point. The decision starts in a mount
 * effect and finishes after an `await`; in that gap the screen can
 * re-render, or remount after the demo's own `navigation.replace`, and run
 * the same decision a second time. The latch is taken synchronously between
 * deciding and navigating, so the second run finds it held and stands down.
 * This is the same "mark before navigating" discipline
 * preWritingSessionGuard.js already uses for warm-ups.
 *
 * Nothing PERSISTENT is written here. Completion is recorded only when the
 * child presses "I'm Ready" on the demo screen itself, so a crash mid-demo
 * re-offers it rather than silently swallowing it forever.
 */

'use strict';

import { useEffect, useRef } from 'react';
import { getShownDemos } from './storage';
import { shouldShowDemo } from './demoPolicy';
import { claimDemoNavigation } from './demoGuard';

/**
 * Decides, claims, and reports back — for callers that trigger a demo from
 * a button press rather than on mount.
 *
 * @param {{studentId: number|string, demoKey: string|null, collectionMode?: boolean}} args
 * @returns {Promise<boolean>} true if the caller should navigate to the
 *   demo now (the claim is already taken). Never throws: a storage failure
 *   resolves false, so the child goes straight to the real activity rather
 *   than being blocked by a tutorial that cannot load.
 */
export async function claimDemoIfDue({ studentId, demoKey, collectionMode = false }) {
  try {
    if (studentId == null || !demoKey) return false;
    if (collectionMode) return false;

    const shownKeys = await getShownDemos(studentId);
    if (!shouldShowDemo({ demoKey, shownKeys, collectionMode })) return false;

    // Synchronous, and immediately before the caller navigates.
    return claimDemoNavigation(studentId, demoKey);
  } catch {
    return false;
  }
}

/**
 * The mount-time form. Runs the same decision once per (student, demoKey)
 * and calls `navigate()` if the demo is due.
 *
 * @param {{
 *   studentId: number|string,
 *   demoKey: string|null,
 *   enabled?: boolean,          // extra caller conditions (e.g. attempt === 1)
 *   collectionMode?: boolean,
 *   navigate: () => void,       // performs the actual navigation
 * }} args
 */
export function useDemoDetour({ studentId, demoKey, enabled = true, collectionMode = false, navigate }) {
  // Held in a ref so a new inline closure on every render cannot re-trigger
  // the effect — the effect must depend on the DECISION inputs only.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    claimDemoIfDue({ studentId, demoKey, collectionMode }).then((due) => {
      // `cancelled` covers the screen unmounting mid-read; the latch is
      // already claimed in that case, which is correct — the demo is still
      // due next time the persistent record says so.
      if (!cancelled && due) navigateRef.current?.();
    });

    return () => { cancelled = true; };
  }, [studentId, demoKey, enabled, collectionMode]);
}
