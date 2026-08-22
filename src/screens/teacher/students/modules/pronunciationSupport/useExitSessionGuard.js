import { useEffect, useRef, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";

// Intercepts every way off a mid-session screen — the screen's own back
// button, the hardware Android back button, and the iOS swipe-back gesture
// all resolve to the same navigation action, so a single guard catches all
// three without special-casing any of them. A child tapping back mid-attempt
// would otherwise silently discard whatever the teacher just recorded/scored
// for this word.
//
// Built on `usePreventRemove` rather than a raw `beforeRemove` listener +
// preventDefault(): native-stack pops a screen at the native layer
// (interactive swipe-back, header back button) before the JS side can react,
// so a plain `beforeRemove` veto can lose that race and leave the screen
// "removed natively but not removed from JS state" — the exact crash this
// hook used to produce. `usePreventRemove` also disables the native dismiss
// gesture/back button up front (`preventNativeDismiss` on iOS) instead of
// only reacting after the fact, which is the documented fix for native-stack.
//
// Usage: const { isExitConfirmVisible, confirmExit, cancelExit } =
//   useExitSessionGuard(navigation);
// Render <ConfirmDialog visible={isExitConfirmVisible} onConfirm={confirmExit}
//   onCancel={cancelExit} .../> alongside it. No change needed to the
// screen's existing back button — it already calls navigation.goBack().
export function useExitSessionGuard(navigation, { enabled = true } = {}) {
  const [isExitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [guardActive, setGuardActive] = useState(enabled);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    setGuardActive(enabled);
  }, [enabled]);

  usePreventRemove(guardActive, ({ data }) => {
    const actionType = data?.action?.type;

    // Only the user's own back gesture (hardware back, iOS swipe-back, the
    // header back button) should ask for confirmation — those dispatch
    // GO_BACK or POP. Any other removal of this screen (e.g. a later screen
    // in the flow popping back past it) isn't the user trying to leave from
    // here, so drop the guard and let it proceed instead of surfacing a
    // confusing prompt on a screen the user isn't even looking at.
    if (actionType !== "GO_BACK" && actionType !== "POP") {
      pendingActionRef.current = data.action;
      setGuardActive(false);
      return;
    }

    pendingActionRef.current = data.action;
    setExitConfirmVisible(true);
  });

  // Runs the action that was held back, once the guard has actually been
  // turned off (and the native side has had a render to catch up) — doing
  // this in an effect rather than inline avoids re-dispatching into a guard
  // that's still active on this same render.
  useEffect(() => {
    if (guardActive || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    navigation.dispatch(action);
  }, [guardActive, navigation]);

  function confirmExit() {
    setExitConfirmVisible(false);
    setGuardActive(false);
  }

  function cancelExit() {
    setExitConfirmVisible(false);
    pendingActionRef.current = null;
  }

  return { isExitConfirmVisible, confirmExit, cancelExit };
}
