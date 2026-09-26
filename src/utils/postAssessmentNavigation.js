/**
 * Navigation boundary between the completed initial assessment and normal
 * handwriting practice.
 *
 * The assessment lives inside HandwritingNavigator. Resetting that inner
 * navigator to LetterHome removes every completed assessment screen while
 * preserving StudentDashboard below HandwritingModule in the parent stack.
 */

'use strict';

export const POST_ASSESSMENT_PRACTICE_ROUTE = 'LetterHome';
export const STUDENT_MODULE_SELECTION_ROUTE = 'StudentDashboard';

export const INITIAL_ASSESSMENT_ROUTE_NAMES = Object.freeze([
  'Welcome',
  'Instructions',
  'StudentWelcome',
  'ShapeAssessment',
  'AssessmentComplete',
]);

export function buildPostAssessmentPracticeState(params) {
  return {
    index: 0,
    routes: [{ name: POST_ASSESSMENT_PRACTICE_ROUTE, params }],
  };
}

export function resetToPostAssessmentPractice(navigation, params) {
  navigation?.reset?.(buildPostAssessmentPracticeState(params));
}

/**
 * Leave the nested handwriting navigator for the real student module chooser.
 * Prefer popTo when StudentDashboard already exists below HandwritingModule;
 * navigate is the safe explicit fallback for unusual/replaced parent stacks.
 */
export function returnToStudentModuleSelection(navigation, params) {
  const targetNavigation = navigation?.getParent?.() ?? navigation;
  const state = targetNavigation?.getState?.();
  const routes = state?.routes ?? [];
  const currentIndex = Number.isInteger(state?.index) ? state.index : routes.length - 1;
  const targetIndex = routes
    .map((route) => route?.name)
    .lastIndexOf(STUDENT_MODULE_SELECTION_ROUTE, currentIndex - 1);

  if (targetIndex >= 0 && typeof targetNavigation?.popTo === 'function') {
    targetNavigation.popTo(STUDENT_MODULE_SELECTION_ROUTE, params);
    return;
  }

  targetNavigation?.navigate?.(STUDENT_MODULE_SELECTION_ROUTE, params);
}
