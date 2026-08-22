import { useEffect, useRef, useState } from "react";

// Intercepts every way off a mid-session screen — the screen's own back
// button, the hardware Android back button, and the iOS swipe-back gesture
// all resolve to the same navigation action, so a single `beforeRemove`
// listener catches all three without special-casing any of them. A child
// tapping back mid-attempt would otherwise silently discard whatever the
// teacher just recorded/scored for this word.
//
// Usage: const { isExitConfirmVisible, confirmExit, cancelExit } =
//   useExitSessionGuard(navigation);
// Render <ConfirmDialog visible={isExitConfirmVisible} onConfirm={confirmExit}
//   onCancel={cancelExit} .../> alongside it. No change needed to the
// screen's existing back button — it already calls navigation.goBack().
export function useExitSessionGuard(navigation, { enabled = true } = {}) {
  const [isExitConfirmVisible, setExitConfirmVisible] = useState(false);
  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    return navigation.addListener("beforeRemove", (e) => {
      if (allowLeaveRef.current) return;
      e.preventDefault();
      pendingActionRef.current = e.data.action;
      setExitConfirmVisible(true);
    });
  }, [navigation, enabled]);

  function confirmExit() {
    allowLeaveRef.current = true;
    setExitConfirmVisible(false);
    if (pendingActionRef.current) {
      navigation.dispatch(pendingActionRef.current);
    }
  }

  function cancelExit() {
    setExitConfirmVisible(false);
    pendingActionRef.current = null;
  }

  return { isExitConfirmVisible, confirmExit, cancelExit };
}
