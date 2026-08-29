// Visible, stack-safe reverse navigation through the initial-assessment flow.

jest.mock('../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import fs from 'fs';
import path from 'path';
import {
  ASSESSMENT_FLOW_ROUTES,
  resolveAssessmentFlowBack,
  returnToAssessmentFlowRoute,
} from './moduleSelectionBack';

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (relativePath) => stripComments(read(relativePath));

const HOME = '../screens/handwriting/LetterHomeScreen.js';
const PRESS_AND_DRAG = '../screens/handwriting/WelcomeScreen.js';
const INSTRUCTIONS = '../screens/handwriting/InstructionScreen.js';
const START = '../screens/handwriting/StudentWelcomeScreen.js';

const navStub = (routeNames) => ({
  getState: () => ({ routes: routeNames.map((name) => ({ name })), index: routeNames.length - 1 }),
  popTo: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
});

describe('actual registered assessment-flow routes', () => {
  test('uses the existing route names and their real screen copy', () => {
    expect(ASSESSMENT_FLOW_ROUTES).toEqual({
      START: 'StudentWelcome',
      INSTRUCTIONS: 'Instructions',
      PRESS_AND_DRAG: 'Welcome',
      MODULE_SELECTION: 'LetterHome',
    });
    expect(readCode(START)).toMatch(/Start Assessment/);
    expect(readCode(INSTRUCTIONS)).toMatch(/FOR TEACHER/);
    expect(readCode(PRESS_AND_DRAG)).toMatch(/Press and drag right/);
    expect(readCode(HOME)).toMatch(/Letter Writing/);
  });

  test('each route is registered exactly once', () => {
    const navigator = readCode('../navigation/HandwritingNavigator.js');
    for (const route of Object.values(ASSESSMENT_FLOW_ROUTES)) {
      expect((navigator.match(new RegExp(`name="${route}"`, 'g')) ?? [])).toHaveLength(1);
    }
  });
});

describe('stack-safe route application', () => {
  test('pops to an existing earlier target instead of adding a duplicate', () => {
    const routes = ['Welcome', 'Instructions', 'StudentWelcome', 'ShapeAssessment', 'LetterHome'];
    expect(resolveAssessmentFlowBack({
      stackRouteNames: routes,
      currentIndex: 4,
      targetRoute: 'Welcome',
    })).toEqual({ action: 'popTo', route: 'Welcome' });

    const navigation = navStub(routes);
    returnToAssessmentFlowRoute(navigation, 'Welcome', { student: 1 });
    expect(navigation.popTo).toHaveBeenCalledWith('Welcome');
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('navigates with context when the target is not below the screen', () => {
    const navigation = navStub(['LetterHome']);
    const params = { student: { sid: 7 }, theme: { button: '#123' } };
    returnToAssessmentFlowRoute(navigation, 'Welcome', params);
    expect(navigation.navigate).toHaveBeenCalledWith('Welcome', params);
    expect(navigation.popTo).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('malformed stacks safely use the explicit target', () => {
    expect(resolveAssessmentFlowBack({ targetRoute: 'Instructions' }))
      .toEqual({ action: 'navigate', route: 'Instructions' });
    const navigation = { getState: () => null, navigate: jest.fn() };
    expect(() => returnToAssessmentFlowRoute(navigation, 'Instructions', {})).not.toThrow();
    expect(navigation.navigate).toHaveBeenCalledWith('Instructions', {});
  });
});

describe('StudentWelcome -> Teacher Instruction', () => {
  const code = readCode(START);

  test('visible Back uses the shared chooser component and explicit Instructions target', () => {
    expect(code).toMatch(/<ScreenBackButton[\s\S]*?onPress=\{requestBack\}[\s\S]*?gated[\s\S]*?accessibilityLabel="Back"/);
    expect(code).toMatch(/returnToAssessmentFlowRoute\([\s\S]*?ASSESSMENT_FLOW_ROUTES\.INSTRUCTIONS[\s\S]*?\{ student, theme \}/);
    expect(code).not.toMatch(/ASSESSMENT_FLOW_ROUTES\.(PRESS_AND_DRAG|MODULE_SELECTION)/);
  });

  test('visible and hardware Back share the same gated function', () => {
    expect(code).toMatch(/useGatedBack\(returnToTeacherInstructions\)/);
    expect(code).toMatch(/\{gateModal\}/);
  });

  test('pops to Instructions in a normal stack and navigates there in a replaced stack', () => {
    const normal = navStub(['Welcome', 'Instructions', 'StudentWelcome']);
    returnToAssessmentFlowRoute(normal, ASSESSMENT_FLOW_ROUTES.INSTRUCTIONS, {});
    expect(normal.popTo).toHaveBeenCalledWith('Instructions');

    const replaced = navStub(['StudentWelcome']);
    const params = { student: 1, theme: 2 };
    returnToAssessmentFlowRoute(replaced, ASSESSMENT_FLOW_ROUTES.INSTRUCTIONS, params);
    expect(replaced.navigate).toHaveBeenCalledWith('Instructions', params);
  });
});

describe('Teacher Instruction -> Press and drag right', () => {
  const code = readCode(INSTRUCTIONS);

  test('visible Back uses the shared chooser component and explicit Welcome target', () => {
    expect(code).toMatch(/<ScreenBackButton[\s\S]*?onPress=\{requestBack\}[\s\S]*?gated[\s\S]*?accessibilityLabel="Back"/);
    expect(code).toMatch(/returnToAssessmentFlowRoute\([\s\S]*?ASSESSMENT_FLOW_ROUTES\.PRESS_AND_DRAG[\s\S]*?\{ student, theme \}/);
    expect(code).not.toMatch(/ASSESSMENT_FLOW_ROUTES\.START/);
  });

  test('visible and hardware Back share the same gated function', () => {
    expect(code).toMatch(/useGatedBack\(returnToPressAndDrag\)/);
    expect(code).toMatch(/\{gateModal\}/);
  });

  test('pops to Welcome when the forward-flow stack is present', () => {
    const navigation = navStub(['Welcome', 'Instructions']);
    returnToAssessmentFlowRoute(navigation, ASSESSMENT_FLOW_ROUTES.PRESS_AND_DRAG, {});
    expect(navigation.popTo).toHaveBeenCalledWith('Welcome');
  });
});

describe('Press and drag right -> Module Selection', () => {
  const code = readCode(PRESS_AND_DRAG);

  test('visible Back uses the shared chooser component and explicit LetterHome target', () => {
    expect(code).toMatch(/<ScreenBackButton[\s\S]*?onPress=\{requestBack\}[\s\S]*?gated[\s\S]*?accessibilityLabel="Back"/);
    expect(code).toMatch(/returnToAssessmentFlowRoute\([\s\S]*?ASSESSMENT_FLOW_ROUTES\.MODULE_SELECTION[\s\S]*?\{ student, theme \}/);
    expect(code).not.toMatch(/ASSESSMENT_FLOW_ROUTES\.INSTRUCTIONS/);
  });

  test('visible and hardware Back share the same gated function', () => {
    expect(code).toMatch(/useGatedBack\(returnToModuleSelection\)/);
    expect(code).toMatch(/\{gateModal\}/);
  });

  test('uses an earlier LetterHome or explicitly navigates there when absent', () => {
    const existing = navStub(['LetterHome', 'Welcome']);
    returnToAssessmentFlowRoute(existing, ASSESSMENT_FLOW_ROUTES.MODULE_SELECTION, {});
    expect(existing.popTo).toHaveBeenCalledWith('LetterHome');

    const absent = navStub(['Welcome']);
    const params = { student: 1, theme: 2 };
    returnToAssessmentFlowRoute(absent, ASSESSMENT_FLOW_ROUTES.MODULE_SELECTION, params);
    expect(absent.navigate).toHaveBeenCalledWith('LetterHome', params);
  });
});

describe('LetterHome exits to the parent student module selection', () => {
  const code = readCode(HOME);

  test('its own gated Back uses the explicit parent-module helper', () => {
    expect(code).toMatch(/<ScreenBackButton[\s\S]*?onPress=\{\(\) => requestGatedAction\('back'\)\}/);
    expect(code).toMatch(/useGatedHardwareBack\(\(\) => requestGatedAction\('back'\), !gateVisible\)/);
    expect(code).toMatch(/pendingGateAction === 'back'[\s\S]*?returnToStudentModuleSelection\(navigation, \{ student \}\)/);
    expect(code).not.toMatch(/backToPressAndDrag/);
  });
});

describe('shared visible control and flow safety', () => {
  test('all four screens use ScreenBackButton with the Back label', () => {
    for (const file of [HOME, PRESS_AND_DRAG, INSTRUCTIONS, START]) {
      const code = readCode(file);
      expect(code).toMatch(/import ScreenBackButton/);
      expect(code).toMatch(/accessibilityLabel="Back"/);
    }
    const shared = readCode('../components/handwriting/ScreenBackButton.js');
    expect(shared).toMatch(/accessibilityRole="button"/);
    expect(shared).toMatch(/Ionicons name="arrow-back" size=\{20\}/);
    expect(shared).toMatch(/width: 40,[\s\S]*?height: 40,[\s\S]*?borderRadius: 20/);
  });

  test('forward assessment destinations remain present', () => {
    expect(readCode(PRESS_AND_DRAG)).toMatch(/navigation\.navigate\('Instructions', \{ student, theme \}\)/);
    expect(readCode(INSTRUCTIONS)).toMatch(/navigation\.navigate\('StudentWelcome', \{ student, theme \}\)/);
    expect(readCode(START)).toMatch(/navigation\.navigate\('ShapeAssessment', assessmentParams\)/);
    expect(readCode('../screens/handwriting/AssessmentCompleteScreen.js'))
      .toMatch(/resetToPostAssessmentPractice\(navigation, \{/);
  });
});
