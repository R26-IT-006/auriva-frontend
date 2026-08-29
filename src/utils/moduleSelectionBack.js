/**
 * moduleSelectionBack.js
 *
 * Where "back" goes from the module selection screen (Letter Home).
 *
 * ── Where it used to go ──────────────────────────────────────────────────
 * LetterHomeScreen's gated back action was:
 *
 *   if (navigation.canGoBack()) navigation.goBack();
 *   else navigation.navigate('TeacherMain');
 *
 * Neither branch reaches the assessment starting screen, because the two ways
 * into module selection leave completely different stacks behind them:
 *
 *   assessment just finished
 *     [Welcome, Instructions, StudentWelcome, ShapeAssessment,
 *      AssessmentComplete, LetterHome]
 *     canGoBack() is true, so goBack() pops ONE entry and lands on
 *     AssessmentComplete — the congratulations screen, not the start.
 *
 *   assessment already complete
 *     WelcomeScreen calls replace('LetterHome'), so the stack is [LetterHome].
 *     canGoBack() is false and back left the writing module entirely.
 *
 * So the destination depended on how the child happened to arrive.
 *
 * ── Where it goes now ────────────────────────────────────────────────────
 * The assessment starting screen, either way. Two mechanisms, because the two
 * stacks genuinely differ:
 *
 *   already below us  popTo  — unwinds to the existing instance, dropping
 *                              module selection and anything above it, so no
 *                              stale frame is left behind
 *   not on the stack  navigate — pushes it, since there is nothing to pop to
 *
 * ── Why not goBackToOrigin ───────────────────────────────────────────────
 * That helper answers a different question ("return to the screen this report
 * was opened from") and deliberately falls back to goBack() when the target is
 * absent — which is exactly the replace() case above. Changing its fallback
 * would alter every report screen's back behaviour, so this is its own
 * resolver rather than a modification to a shared one.
 */

'use strict';

/**
 * The screen with the "Start Assessment" button — StudentWelcomeScreen.
 * Named once so the screen and its tests cannot drift apart.
 */
export const ASSESSMENT_START_ROUTE = 'StudentWelcome';

/**
 * Pure decision function — no navigation object, fully unit-testable.
 *
 * @param {{ stackRouteNames?: string[], currentIndex?: number }} args
 * @returns {{action: 'popTo'|'navigate', route: string}} never 'goBack':
 *   popping one entry is what produced the wrong destination.
 */
export function resolveModuleSelectionBack({ stackRouteNames = [], currentIndex = -1 } = {}) {
  const push = { action: 'navigate', route: ASSESSMENT_START_ROUTE };
  if (!Array.isArray(stackRouteNames) || stackRouteNames.length === 0) return push;

  // lastIndexOf: with more than one instance, the nearest one below is the
  // one this child actually came through.
  const targetIndex = stackRouteNames.lastIndexOf(ASSESSMENT_START_ROUTE);
  if (targetIndex === -1) return push;

  // It must sit strictly BELOW the current screen. An instance at or above
  // the current index is not something to pop back to.
  const index = Number.isInteger(currentIndex) && currentIndex >= 0
    ? currentIndex
    : stackRouteNames.length - 1;
  if (targetIndex >= index) return push;

  return { action: 'popTo', route: ASSESSMENT_START_ROUTE };
}

/**
 * Applies resolveModuleSelectionBack to a real navigation object.
 *
 * `popTo` is React Navigation 7's own "pop back to this route" action; the
 * navigate() call covers both the push case and any navigator that does not
 * expose popTo, where navigate() on an existing route unwinds to it anyway.
 *
 * @param {Object} navigation
 * @param {Object} params — { student, theme }, so a pushed instance renders
 *   with the same context the rest of the module uses.
 */
export function backToAssessmentStart(navigation, params) {
  const state = navigation?.getState?.();
  const routes = state?.routes ?? [];

  const target = resolveModuleSelectionBack({
    stackRouteNames: routes.map((r) => r?.name),
    currentIndex: Number.isInteger(state?.index) ? state.index : routes.length - 1,
  });

  if (target.action === 'popTo' && typeof navigation.popTo === 'function') {
    navigation.popTo(target.route);
    return;
  }
  navigation.navigate(target.route, params);
}
