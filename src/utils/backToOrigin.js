/**
 * backToOrigin.js
 *
 * Returns a report screen to the screen it was actually OPENED FROM, instead
 * of to whatever happens to sit directly beneath it in the stack.
 *
 * ── The bug this exists to fix ────────────────────────────────────────────
 * Both report screens used a bare `navigation.goBack()`:
 *
 *   ProgressReportScreen  — useGatedBack(() => navigation.goBack())
 *   TeacherReportScreen   — useGatedBack(() => navigation.goBack())
 *
 * `goBack()` pops exactly ONE entry, so the destination is whatever the stack
 * happens to hold underneath — not where the teacher came from. `WritingCheck`
 * ends up there easily, because it is reachable from Letter Home, from the
 * teacher report's own "Start Writing Check" card, and because the writing
 * screens navigate BACK into it when a check batch finishes. A teacher who
 * opened the report from Letter Home could therefore land in Writing Check.
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 * The screen that opens a report passes `originRoute`, and back pops straight
 * to that route. Stack order stops mattering: the answer is recorded at the
 * moment of navigation rather than inferred afterwards.
 *
 * Deliberately conservative — when there is no usable origin (an older
 * navigation with no param, a route no longer in the stack, or an origin that
 * IS the current screen) it falls back to the previous `goBack()` behaviour
 * rather than inventing a destination. Nothing about the parent gate changes;
 * this only replaces what runs after the gate is passed.
 */

'use strict';

/**
 * Pure decision function — no navigation object, fully unit-testable.
 *
 * @param {{
 *   originRoute?: string|null,
 *   stackRouteNames?: string[],
 *   currentIndex?: number,
 * }} args
 * @returns {{action: 'popTo', route: string} | {action: 'goBack'}}
 */
export function resolveBackTarget({ originRoute, stackRouteNames = [], currentIndex = -1 } = {}) {
  const goBack = { action: 'goBack' };

  if (typeof originRoute !== 'string' || originRoute.length === 0) return goBack;
  if (!Array.isArray(stackRouteNames) || stackRouteNames.length === 0) return goBack;

  // lastIndexOf, not indexOf: if the same screen appears more than once, the
  // one the teacher most recently came through is the nearest one below.
  const originIndex = stackRouteNames.lastIndexOf(originRoute);
  if (originIndex === -1) return goBack;

  // The origin must sit strictly BELOW the current screen. An origin that is
  // the current screen (or somehow above it) is not something to pop to.
  if (Number.isInteger(currentIndex) && currentIndex >= 0 && originIndex >= currentIndex) {
    return goBack;
  }

  return { action: 'popTo', route: originRoute };
}

/**
 * Applies resolveBackTarget to a real navigation object.
 *
 * `popTo` is React Navigation 7's own "pop back to this route" action; the
 * `navigate` branch is a defensive fallback for any navigator that does not
 * expose it, where navigate() on an existing stack route unwinds to it.
 */
export function goBackToOrigin(navigation, originRoute) {
  const state  = navigation?.getState?.();
  const routes = state?.routes ?? [];

  const target = resolveBackTarget({
    originRoute,
    stackRouteNames: routes.map(r => r?.name),
    currentIndex: Number.isInteger(state?.index) ? state.index : routes.length - 1,
  });

  if (target.action === 'popTo') {
    if (typeof navigation.popTo === 'function') navigation.popTo(target.route);
    else navigation.navigate(target.route);
    return;
  }

  navigation.goBack();
}
