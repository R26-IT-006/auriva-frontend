/**
 * writingCheckNavigation.js
 *
 * Starting a Writing Check from the handwriting report, from EITHER of the
 * two navigators that report is registered in.
 *
 * ── The bug ──────────────────────────────────────────────────────────────
 * TeacherReportScreen is mounted twice, under two names:
 *
 *   HandwritingNavigator -> 'TeacherReport'              (has WritingCheck)
 *   TeacherNavigator     -> 'StudentHandwritingReport'   (has NOT)
 *
 * Its "Start Writing Check" action called navigate('WritingCheck') directly,
 * which resolves in the first navigator and throws in the second:
 *
 *   The action 'NAVIGATE' with payload {"name":"WritingCheck",...}
 *   was not handled by any navigator.
 *
 * Reaching the report from Teacher -> Student Profile lands on the second
 * mount, so that path crashed. Pre-existing, and independent of any Writing
 * Check logic — this is purely where the screen lives in the tree.
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 * Ask the CURRENT navigator whether it owns the screen. If it does, navigate
 * as before. If it does not, go through the parent's `HandwritingModule`
 * screen, which hosts HandwritingNavigator, using React Navigation's nested
 * `{ screen, params }` form.
 *
 * `student`/`theme` are sent at BOTH levels deliberately: HandwritingNavigator
 * reads `route.params?.student` itself (to derive the avatar theme and seed
 * every screen's initialParams), while WritingCheckScreen reads its own
 * `route.params`. Sending them only nested would leave the navigator without
 * a student; only flat would leave the screen without one.
 *
 * Nothing about the Writing Check protocol, its session identity, its
 * collection_mode handling or its evaluation changes here. This module only
 * decides which navigate() call to make.
 */

'use strict';

export const WRITING_CHECK_ROUTE = 'WritingCheck';
export const HANDWRITING_MODULE_ROUTE = 'HandwritingModule';

/**
 * Pure: given the route names the current navigator owns, returns the exact
 * navigate() arguments to use. No navigation object, fully unit-testable.
 *
 * @param {{ routeNames?: string[], student?: object, theme?: object }} args
 * @returns {[string, object]} tuple of (routeName, params) for navigate(...)
 */
export function resolveWritingCheckNavigation({ routeNames, student, theme } = {}) {
  const names = Array.isArray(routeNames) ? routeNames : [];

  // Direct: this navigator owns the screen.
  if (names.includes(WRITING_CHECK_ROUTE)) {
    return [WRITING_CHECK_ROUTE, { student, theme }];
  }

  // Nested: go via the module that hosts the handwriting stack.
  return [HANDWRITING_MODULE_ROUTE, {
    // For HandwritingNavigator itself.
    student,
    theme,
    // For the screen inside it.
    screen: WRITING_CHECK_ROUTE,
    params: { student, theme },
  }];
}

/**
 * Applies the resolution to a real navigation object.
 *
 * Defensive about `getState`: if it is unavailable or throws, `routeNames`
 * is empty, which resolves to the NESTED form. That is the safer default —
 * the nested form works from the teacher stack, and from inside the
 * handwriting stack it still resolves through the parent rather than
 * throwing, whereas guessing "direct" would reproduce the original crash.
 */
export function navigateToWritingCheck(navigation, { student, theme } = {}) {
  let routeNames = [];
  try {
    routeNames = navigation?.getState?.()?.routeNames ?? [];
  } catch {
    routeNames = [];
  }

  const [routeName, params] = resolveWritingCheckNavigation({ routeNames, student, theme });
  navigation.navigate(routeName, params);
}
