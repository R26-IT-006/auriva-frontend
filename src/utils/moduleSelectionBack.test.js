// Back from module selection returns to the assessment starting screen.
//
// It used to depend on how the child arrived. After an assessment the stack
// was [Welcome, Instructions, StudentWelcome, ShapeAssessment,
// AssessmentComplete, LetterHome], so goBack() popped one entry onto the
// congratulations screen. On the already-complete path WelcomeScreen calls
// replace('LetterHome'), leaving [LetterHome] — canGoBack() was false and back
// left the writing module entirely.

jest.mock('../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import fs from 'fs';
import path from 'path';

import {
  ASSESSMENT_START_ROUTE,
  resolveModuleSelectionBack,
  backToAssessmentStart,
} from './moduleSelectionBack';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const HOME = '../screens/handwriting/LetterHomeScreen.js';

// The stack as it really is after finishing the assessment.
const AFTER_ASSESSMENT = [
  'Welcome', 'Instructions', 'StudentWelcome', 'ShapeAssessment',
  'AssessmentComplete', 'LetterHome',
];
// ...and as it really is when the assessment was already complete.
const ALREADY_COMPLETE = ['LetterHome'];

const navStub = (routeNames) => ({
  getState: () => ({ routes: routeNames.map((name) => ({ name })), index: routeNames.length - 1 }),
  popTo: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
});

describe('the target is the assessment starting screen', () => {
  it('is the screen with the Start Assessment button', () => {
    expect(ASSESSMENT_START_ROUTE).toBe('StudentWelcome');
    expect(readCode('../screens/handwriting/StudentWelcomeScreen.js'))
      .toMatch(/Start Assessment/);
  });
});

describe('after the assessment — it unwinds to the start, not to the last screen', () => {
  it('pops back to StudentWelcome rather than AssessmentComplete', () => {
    expect(resolveModuleSelectionBack({
      stackRouteNames: AFTER_ASSESSMENT, currentIndex: 5,
    })).toEqual({ action: 'popTo', route: 'StudentWelcome' });
  });

  it('popTo drops module selection and everything above it', () => {
    const nav = navStub(AFTER_ASSESSMENT);
    backToAssessmentStart(nav, { student: { sid: 1 }, theme: {} });
    expect(nav.popTo).toHaveBeenCalledWith('StudentWelcome');
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('never lands on the congratulations screen', () => {
    const nav = navStub(AFTER_ASSESSMENT);
    backToAssessmentStart(nav, {});
    const targets = [...nav.popTo.mock.calls, ...nav.navigate.mock.calls].map((c) => c[0]);
    expect(targets).not.toContain('AssessmentComplete');
    expect(targets).toEqual(['StudentWelcome']);
  });
});

describe('assessment already complete — replace() left nothing to pop to', () => {
  it('pushes the start screen instead of leaving the module', () => {
    expect(resolveModuleSelectionBack({
      stackRouteNames: ALREADY_COMPLETE, currentIndex: 0,
    })).toEqual({ action: 'navigate', route: 'StudentWelcome' });
  });

  it('navigates with the student and theme so it renders in context', () => {
    const nav = navStub(ALREADY_COMPLETE);
    const params = { student: { sid: 51 }, theme: { button: '#000' } };
    backToAssessmentStart(nav, params);
    expect(nav.navigate).toHaveBeenCalledWith('StudentWelcome', params);
    expect(nav.popTo).not.toHaveBeenCalled();
  });

  it('never exits to the teacher dashboard', () => {
    const nav = navStub(ALREADY_COMPLETE);
    backToAssessmentStart(nav, {});
    const targets = [...nav.popTo.mock.calls, ...nav.navigate.mock.calls].map((c) => c[0]);
    expect(targets).not.toContain('TeacherMain');
  });
});

describe('it never pops one entry and hopes', () => {
  it('goBack is not an outcome, on any stack', () => {
    for (const names of [AFTER_ASSESSMENT, ALREADY_COMPLETE, [], ['A', 'B'], ['StudentWelcome']]) {
      const nav = navStub(names);
      backToAssessmentStart(nav, {});
      expect(nav.goBack).not.toHaveBeenCalled();
    }
    for (const names of [AFTER_ASSESSMENT, ALREADY_COMPLETE, []]) {
      expect(resolveModuleSelectionBack({ stackRouteNames: names }).action).not.toBe('goBack');
    }
  });

  it('an instance at or above the current screen is not popped to', () => {
    // Standing ON the start screen: there is nothing below to unwind to.
    expect(resolveModuleSelectionBack({
      stackRouteNames: ['StudentWelcome'], currentIndex: 0,
    })).toEqual({ action: 'navigate', route: 'StudentWelcome' });
  });

  it('with two instances it takes the nearest one below', () => {
    const names = ['StudentWelcome', 'Instructions', 'StudentWelcome', 'LetterHome'];
    expect(resolveModuleSelectionBack({ stackRouteNames: names, currentIndex: 3 }))
      .toEqual({ action: 'popTo', route: 'StudentWelcome' });
  });

  it('malformed or missing state never throws', () => {
    for (const bad of [undefined, {}, { stackRouteNames: null }, { stackRouteNames: 'x' }]) {
      expect(() => resolveModuleSelectionBack(bad)).not.toThrow();
      expect(resolveModuleSelectionBack(bad).route).toBe('StudentWelcome');
    }
    // Malformed STATE is realistic — a navigator mid-reset, or one whose
    // getState() returns nothing. A navigator with no navigate() is not, and
    // swallowing that would hide a wiring mistake rather than survive one.
    for (const nav of [
      { navigate: jest.fn() },
      { getState: () => null, navigate: jest.fn() },
      { getState: () => ({}), navigate: jest.fn() },
    ]) {
      expect(() => backToAssessmentStart(nav, {})).not.toThrow();
      expect(nav.navigate).toHaveBeenCalledWith('StudentWelcome', {});
    }
  });

  it('a navigator without popTo still reaches the start screen', () => {
    const nav = { ...navStub(AFTER_ASSESSMENT), popTo: undefined };
    backToAssessmentStart(nav, { student: 1 });
    expect(nav.navigate).toHaveBeenCalledWith('StudentWelcome', { student: 1 });
  });
});

describe('the screen is wired to it, once, behind the existing gate', () => {
  const code = readCode(HOME);

  it('the gated back action calls it', () => {
    expect(code).toMatch(/else if \(pendingGateAction === 'back'\) \{\s*backToAssessmentStart\(navigation, \{ student, theme \}\);\s*\}/);
  });

  it('the old conditional is gone', () => {
    expect(code).not.toMatch(/if \(navigation\.canGoBack\(\)\) navigation\.goBack\(\);/);
    expect(code).not.toMatch(/pendingGateAction === 'back'[\s\S]{0,200}navigate\('TeacherMain'\)/);
  });

  it('header back and hardware back run the SAME action', () => {
    expect(code).toMatch(/onPress=\{\(\) => requestGatedAction\('back'\)\}/);
    expect(code).toMatch(/useGatedHardwareBack\(\(\) => requestGatedAction\('back'\), !gateVisible\)/);
    // One handler, so the two cannot diverge.
    expect((code.match(/backToAssessmentStart\(/g) || [])).toHaveLength(1);
  });

  it('the parent gate is unchanged — back still asks first', () => {
    expect(code).toMatch(/function requestGatedAction/);
    expect(code).toMatch(/<ParentGateModal/);
    // Never navigated straight from a tap.
    expect(code).not.toMatch(/onPress=\{\(\) => backToAssessmentStart/);
  });

  it('the teacher dashboard keeps its own route out', () => {
    expect(code).toMatch(/pendingGateAction === 'dashboard'\) navigation\.navigate\('TeacherMain'\)/);
  });
});

describe('no other navigation flow moved', () => {
  it('the shared report helper is untouched', () => {
    const origin = readCode('./backToOrigin.js');
    expect(origin).toMatch(/export function resolveBackTarget/);
    expect(origin).toMatch(/navigation\.goBack\(\);\n\}/);   // its goBack fallback stays
    expect(origin).not.toMatch(/ASSESSMENT_START_ROUTE|backToAssessmentStart/);
  });

  it('the report screens still return to their own origin', () => {
    expect(readCode('../screens/handwriting/ProgressReportScreen.js'))
      .toMatch(/goBackToOrigin\(navigation, route\.params\?\.originRoute\)/);
    expect(readCode('../screens/handwriting/reports/TeacherReportScreen.js'))
      .toMatch(/goBackToOrigin\(navigation, /);
  });

  it('the other back handlers in the module are unchanged', () => {
    expect(readCode('../screens/handwriting/LetterPracticeScreen.js'))
      .toMatch(/navigation\.canGoBack\(\) \? navigation\.goBack\(\) : navigation\.navigate\('LetterHome', \{ student, theme \}\)/);
    expect(readCode('../screens/handwriting/AssessmentCompleteScreen.js'))
      .toMatch(/useGatedBack\(\(\) => navigation\.navigate\('StudentWelcome', \{ student, theme \}\)\)/);
    expect(readCode('../screens/handwriting/words/WordLetterSelectScreen.js'))
      .toMatch(/useGatedBack\(\(\) => navigation\.goBack\(\)\)/);
  });

  it('the routes into module selection are unchanged', () => {
    expect(readCode('../screens/handwriting/WelcomeScreen.js'))
      .toMatch(/navigation\.replace\('LetterHome', \{ student, theme \}\)/);
    expect(readCode('../screens/handwriting/AssessmentCompleteScreen.js'))
      .toMatch(/navigation\.navigate\('LetterHome', \{/);
  });

  it('no screen was added or duplicated', () => {
    const nav = readCode('../navigation/HandwritingNavigator.js');
    expect((nav.match(/name="StudentWelcome"/g) || [])).toHaveLength(1);
    expect((nav.match(/name="LetterHome"/g) || [])).toHaveLength(1);
    const names = nav.match(/name="(\w+)"/g) || [];
    expect(new Set(names).size).toBe(names.length);
  });

  it('the Initial Assessment screen itself was not touched', () => {
    const start = readCode('../screens/handwriting/StudentWelcomeScreen.js');
    expect(start).toMatch(/navigation\.navigate\('ShapeAssessment', assessmentParams\)/);
    expect(start).not.toMatch(/moduleSelectionBack|backToAssessmentStart/);
  });
});
