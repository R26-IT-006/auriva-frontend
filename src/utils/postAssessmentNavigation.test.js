jest.mock('../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import fs from 'fs';
import path from 'path';
import {
  INITIAL_ASSESSMENT_ROUTE_NAMES,
  POST_ASSESSMENT_PRACTICE_ROUTE,
  STUDENT_MODULE_SELECTION_ROUTE,
  buildPostAssessmentPracticeState,
  resetToPostAssessmentPractice,
  returnToStudentModuleSelection,
} from './postAssessmentNavigation';

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
const complete = read('../screens/teacher/handwriting/AssessmentCompleteScreen.js');
const home = read('../screens/teacher/handwriting/LetterHomeScreen.js');
const letter = read('../screens/teacher/handwriting/LetterPracticeScreen.js');
const word = read('../screens/teacher/handwriting/words/WordLetterSelectScreen.js');

describe('post-assessment Continue stack', () => {
  const params = { student: { sid: 7 }, theme: { button: '#123' } };

  test('contains only LetterHome and no completed assessment route', () => {
    const state = buildPostAssessmentPracticeState(params);
    expect(state).toEqual({
      index: 0,
      routes: [{ name: 'LetterHome', params }],
    });
    expect(POST_ASSESSMENT_PRACTICE_ROUTE).toBe('LetterHome');
    for (const route of INITIAL_ASSESSMENT_ROUTE_NAMES) {
      expect(state.routes.map((item) => item.name)).not.toContain(route);
    }
  });

  test('Continue applies reset after finalization instead of navigate/replace', () => {
    const navigation = { reset: jest.fn() };
    resetToPostAssessmentPractice(navigation, params);
    expect(navigation.reset).toHaveBeenCalledWith(buildPostAssessmentPracticeState(params));

    const finalTransition = complete.slice(
      complete.indexOf('resetToPostAssessmentPractice(navigation'),
      complete.indexOf('activeOpacity={0.85}'),
    );
    expect(finalTransition).toMatch(/resetToPostAssessmentPractice\(navigation/);
    expect(finalTransition).not.toMatch(/navigation\.(navigate|replace)\('LetterHome'/);
  });
});

describe('LetterHome Back reaches the real module selection', () => {
  const params = { student: { sid: 7 } };

  test('pops the parent stack to StudentDashboard when it already exists', () => {
    const parent = {
      getState: () => ({
        routes: [{ name: 'StudentDashboard' }, { name: 'HandwritingModule' }],
        index: 1,
      }),
      popTo: jest.fn(),
      navigate: jest.fn(),
    };
    const navigation = { getParent: () => parent };
    returnToStudentModuleSelection(navigation, params);
    expect(STUDENT_MODULE_SELECTION_ROUTE).toBe('StudentDashboard');
    expect(parent.popTo).toHaveBeenCalledWith('StudentDashboard', params);
    expect(parent.navigate).not.toHaveBeenCalled();
  });

  test('uses the explicit StudentDashboard fallback for a replaced parent stack', () => {
    const parent = {
      getState: () => ({ routes: [{ name: 'HandwritingModule' }], index: 0 }),
      popTo: jest.fn(),
      navigate: jest.fn(),
    };
    returnToStudentModuleSelection({ getParent: () => parent }, params);
    expect(parent.navigate).toHaveBeenCalledWith('StudentDashboard', params);
    expect(parent.popTo).not.toHaveBeenCalled();
  });

  test('visible and hardware Back share the same gated action', () => {
    expect(home).toMatch(/<ScreenBackButton[\s\S]*?requestGatedAction\('back'\)/);
    expect(home).toMatch(/useGatedHardwareBack\(\(\) => requestGatedAction\('back'\), !gateVisible\)/);
    expect(home).toMatch(/pendingGateAction === 'back'[\s\S]*?returnToStudentModuleSelection\(navigation, \{ student \}\)/);
  });
});

describe('normal Letter and Word chooser Back behavior', () => {
  test('Letter chooser returns one level to LetterHome through the shared gate', () => {
    expect(letter).toMatch(/useGatedBack\(\(\) => \([\s\S]*?navigation\.canGoBack\(\) \? navigation\.goBack\(\) : navigation\.navigate\('LetterHome'/);
    expect(letter).toMatch(/<ScreenBackButton[\s\S]*?onPress=\{requestBack\}/);
  });

  test('Word chooser returns one level to LetterHome through the shared gate', () => {
    expect(word).toMatch(/useGatedBack\(\(\) => navigation\.goBack\(\)\)/);
    expect(word).toMatch(/<TouchableOpacity[\s\S]*?styles\.backBtn[\s\S]*?onPress=\{requestBack\}/);
  });

  test('neither chooser targets a completed assessment screen', () => {
    for (const source of [letter, word]) {
      for (const route of ['AssessmentComplete', 'ShapeAssessment', 'Instructions', 'StudentWelcome']) {
        expect(source).not.toMatch(new RegExp(`navigation\\.(?:navigate|replace)\\('${route}'`));
      }
    }
  });
});
