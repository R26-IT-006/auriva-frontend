/**
 * useGatedBack.js
 *
 * Puts the parent-verification gate in front of a screen's back button.
 *
 * Leaving a learning activity is an ADULT decision: a child tapping back
 * mid-task would abandon captured work or wander into teacher-facing screens.
 * The Concept Learning section already gates its back buttons this way
 * (Tier2ActivityScreen.js, ConceptItemsScreen.js), and LetterHomeScreen gates
 * its own — this hook is that same pattern, extracted so the remaining
 * handwriting screens do not each grow a private copy of the gate state.
 *
 * ── Why a hook and not a component ─────────────────────────────────────────
 * Every screen's back button already has its own look — `arrow-back` vs
 * `chevron-back`, different sizes, different themed containers. A wrapper
 * component would have forced them all into one appearance. Returning
 * `requestBack` + `gateModal` instead lets each screen keep its existing
 * button exactly as-is and change only what the tap DOES:
 *
 *   const { requestBack, gateModal } = useGatedBack(() => navigation.goBack());
 *   …
 *   <TouchableOpacity onPress={requestBack}>   // unchanged styling
 *   …
 *   {gateModal}                                 // rendered once, anywhere
 *
 * ── Correctness notes ──────────────────────────────────────────────────────
 * `onConfirm` is held in a ref and refreshed on every render, so the action
 * that finally runs is the current one — a screen whose back target depends on
 * changing state (a letter index, a loaded student) can never fire a stale
 * closure captured when the gate first opened.
 *
 * The gate is closed BEFORE `onConfirm()` runs, so the modal is never left
 * mounted over the screen being navigated away from.
 *
 * Cancelling performs no navigation at all — the child stays exactly where
 * they were, which is the entire point of the gate.
 */

'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ParentGateModal } from '../components/common/ParentGateModal';

/**
 * Routes the ANDROID HARDWARE BACK BUTTON through the same gate as the
 * on-screen back button, while the screen is focused.
 *
 * Without this the gate is trivially bypassable on the target device: the
 * on-screen button opens the gate, but the hardware button below the screen
 * calls navigation.goBack() directly, so a child could leave a captured
 * activity — or reach the teacher area — without ever seeing the gate.
 *
 * Returning `true` from a hardwareBackPress handler tells React Native the
 * event is fully handled, which suppresses React Navigation's own default
 * back. `onRequest` is held in a ref so the handler always runs the current
 * callback, matching useGatedBack's own stale-closure discipline.
 *
 * Exported so a screen that owns its ParentGateModal directly (LetterHomeScreen
 * has three gated actions and cannot use useGatedBack's single-action shape)
 * can reuse this without duplicating the listener.
 *
 * @param {() => void} onRequest — opens the screen's gate. Never navigates.
 * @param {boolean} [enabled=true] — set false to leave the hardware button
 *   alone (e.g. while a gate is already open, so the child can dismiss it).
 */
export function useGatedHardwareBack(onRequest, enabled = true) {
  const onRequestRef = useRef(onRequest);
  useEffect(() => { onRequestRef.current = onRequest; });

  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; });

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!enabledRef.current) return false; // let the default back happen
        onRequestRef.current?.();
        return true;                            // handled — suppress default back
      });
      return () => subscription.remove();
    }, [])
  );
}

export default function useGatedBack(onConfirm) {
  const [gateVisible, setGateVisible] = useState(false);

  // Keeps the latest callback without re-creating requestBack on every render.
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => { onConfirmRef.current = onConfirm; });

  const requestBack = useCallback(() => setGateVisible(true), []);

  const handleSuccess = useCallback(() => {
    setGateVisible(false);
    onConfirmRef.current?.();
  }, []);

  const handleCancel = useCallback(() => setGateVisible(false), []);

  // The Android hardware back button opens this same gate rather than
  // navigating. Disabled while the gate is already showing, so the hardware
  // button can dismiss the modal (ParentGateModal's own onRequestClose)
  // instead of re-opening it.
  useGatedHardwareBack(requestBack, !gateVisible);

  const gateModal = (
    <ParentGateModal
      visible={gateVisible}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );

  return { requestBack, gateModal, gateVisible };
}
