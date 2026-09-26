/**
 * Stack-safe reverse navigation for the initial-assessment flow.
 *
 * These screens can be reached through different histories. A newly completed
 * assessment leaves the full flow below LetterHome, while a returning learner
 * can reach LetterHome through Welcome.replace(). A one-entry goBack() is
 * therefore not a reliable destination.
 */

'use strict';

export const ASSESSMENT_FLOW_ROUTES = Object.freeze({
  START: 'StudentWelcome',
  INSTRUCTIONS: 'Instructions',
  PRESS_AND_DRAG: 'Welcome',
  MODULE_SELECTION: 'LetterHome',
});

export function resolveAssessmentFlowBack({
  stackRouteNames = [], currentIndex = -1, targetRoute,
} = {}) {
  const navigate = { action: 'navigate', route: targetRoute };
  if (!targetRoute || !Array.isArray(stackRouteNames) || stackRouteNames.length === 0) {
    return navigate;
  }

  const index = Number.isInteger(currentIndex) && currentIndex >= 0
    ? currentIndex
    : stackRouteNames.length - 1;
  const targetIndex = stackRouteNames.lastIndexOf(targetRoute, index - 1);

  return targetIndex >= 0
    ? { action: 'popTo', route: targetRoute }
    : navigate;
}

export function returnToAssessmentFlowRoute(navigation, targetRoute, params) {
  const state = navigation?.getState?.();
  const routes = state?.routes ?? [];
  const target = resolveAssessmentFlowBack({
    stackRouteNames: routes.map((route) => route?.name),
    currentIndex: Number.isInteger(state?.index) ? state.index : routes.length - 1,
    targetRoute,
  });

  if (target.action === 'popTo' && typeof navigation?.popTo === 'function') {
    navigation.popTo(target.route);
    return;
  }
  navigation?.navigate?.(target.route, params);
}
