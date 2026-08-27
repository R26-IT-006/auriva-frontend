// Back navigation out of the two report screens.
//
// Reported symptom: pressing back on the progress report landed the teacher
// in WRITING CHECK. Both reports used a bare navigation.goBack(), which pops
// exactly one entry and therefore goes wherever the stack happens to point —
// and WritingCheck reaches the stack from several directions (Letter Home,
// the teacher report's own "Start Writing Check" card, and the writing
// screens navigating back into it when a check batch finishes).

import fs from 'fs';
import path from 'path';

import { resolveBackTarget, goBackToOrigin } from './backToOrigin';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const progressReport = read('../screens/handwriting/ProgressReportScreen.js');
const teacherReport  = read('../screens/handwriting/reports/TeacherReportScreen.js');
const letterPractice = read('../screens/handwriting/LetterPracticeScreen.js');
const letterHome     = read('../screens/handwriting/LetterHomeScreen.js');
const wordSelect     = read('../screens/handwriting/words/WordLetterSelectScreen.js');

// ─── The reported bug, as a test ────────────────────────────────────────

describe('the reported bug', () => {
  it('back from the teacher report does NOT go to Writing Check', () => {
    // Exactly the stack that produced the report: the teacher passed through
    // Writing Check, then opened the report from Letter Home.
    const target = resolveBackTarget({
      originRoute: 'LetterHome',
      stackRouteNames: ['LetterHome', 'WritingCheck', 'TeacherReport'],
      currentIndex: 2,
    });
    expect(target).toEqual({ action: 'popTo', route: 'LetterHome' });
    expect(target.route).not.toBe('WritingCheck');
  });

  it('SENTINEL — a bare goBack() from that same stack WOULD have hit Writing Check', () => {
    // Proof the fix is load-bearing rather than cosmetic: one pop from
    // index 2 lands on index 1, which is Writing Check.
    const stack = ['LetterHome', 'WritingCheck', 'TeacherReport'];
    expect(stack[2 - 1]).toBe('WritingCheck');
  });
});

// ─── resolveBackTarget ──────────────────────────────────────────────────

describe('resolveBackTarget', () => {
  const stack = ['LetterHome', 'LetterPractice', 'WritingCheck', 'ProgressReport'];

  it('pops to an origin that sits below the current screen', () => {
    expect(resolveBackTarget({ originRoute: 'LetterPractice', stackRouteNames: stack, currentIndex: 3 }))
      .toEqual({ action: 'popTo', route: 'LetterPractice' });
  });

  it('falls back to goBack when no origin was passed', () => {
    expect(resolveBackTarget({ stackRouteNames: stack, currentIndex: 3 })).toEqual({ action: 'goBack' });
    expect(resolveBackTarget({ originRoute: null, stackRouteNames: stack, currentIndex: 3 })).toEqual({ action: 'goBack' });
    expect(resolveBackTarget({ originRoute: '', stackRouteNames: stack, currentIndex: 3 })).toEqual({ action: 'goBack' });
  });

  it('falls back to goBack for a non-string origin', () => {
    for (const bad of [42, {}, [], true]) {
      expect(resolveBackTarget({ originRoute: bad, stackRouteNames: stack, currentIndex: 3 }))
        .toEqual({ action: 'goBack' });
    }
  });

  it('falls back to goBack when the origin is no longer in the stack', () => {
    expect(resolveBackTarget({ originRoute: 'WordLetterSelect', stackRouteNames: stack, currentIndex: 3 }))
      .toEqual({ action: 'goBack' });
  });

  it('falls back to goBack when the origin IS the current screen', () => {
    expect(resolveBackTarget({ originRoute: 'ProgressReport', stackRouteNames: stack, currentIndex: 3 }))
      .toEqual({ action: 'goBack' });
  });

  it('falls back to goBack when the origin sits ABOVE the current screen', () => {
    expect(resolveBackTarget({ originRoute: 'WritingCheck', stackRouteNames: stack, currentIndex: 1 }))
      .toEqual({ action: 'goBack' });
  });

  it('picks the NEAREST occurrence when the origin appears twice', () => {
    // lastIndexOf: index 2 is below the current screen at 3, so it pops.
    const dup = ['LetterHome', 'WritingCheck', 'LetterHome', 'TeacherReport'];
    expect(resolveBackTarget({ originRoute: 'LetterHome', stackRouteNames: dup, currentIndex: 3 }))
      .toEqual({ action: 'popTo', route: 'LetterHome' });
  });

  it('handles an empty or missing stack without throwing', () => {
    expect(resolveBackTarget({ originRoute: 'LetterHome', stackRouteNames: [] })).toEqual({ action: 'goBack' });
    expect(resolveBackTarget({ originRoute: 'LetterHome' })).toEqual({ action: 'goBack' });
    expect(resolveBackTarget()).toEqual({ action: 'goBack' });
  });
});

// ─── goBackToOrigin ─────────────────────────────────────────────────────

describe('goBackToOrigin', () => {
  const makeNav = (routeNames, index, { withPopTo = true } = {}) => {
    const nav = {
      getState: () => ({ routes: routeNames.map(name => ({ name })), index }),
      goBack:   jest.fn(),
      navigate: jest.fn(),
    };
    if (withPopTo) nav.popTo = jest.fn();
    return nav;
  };

  it('uses popTo when the navigator provides it', () => {
    const nav = makeNav(['LetterHome', 'WritingCheck', 'TeacherReport'], 2);
    goBackToOrigin(nav, 'LetterHome');
    expect(nav.popTo).toHaveBeenCalledWith('LetterHome');
    expect(nav.goBack).not.toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('falls back to navigate when popTo is unavailable', () => {
    const nav = makeNav(['LetterHome', 'WritingCheck', 'TeacherReport'], 2, { withPopTo: false });
    goBackToOrigin(nav, 'LetterHome');
    expect(nav.navigate).toHaveBeenCalledWith('LetterHome');
    expect(nav.goBack).not.toHaveBeenCalled();
  });

  it('falls back to goBack when there is no usable origin', () => {
    const nav = makeNav(['LetterHome', 'TeacherReport'], 1);
    goBackToOrigin(nav, undefined);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(nav.popTo).not.toHaveBeenCalled();
  });

  it('survives a navigator that exposes no state at all', () => {
    const nav = { goBack: jest.fn(), navigate: jest.fn() };
    expect(() => goBackToOrigin(nav, 'LetterHome')).not.toThrow();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('derives the current index from the stack when state.index is missing', () => {
    const nav = {
      getState: () => ({ routes: [{ name: 'LetterHome' }, { name: 'TeacherReport' }] }),
      goBack: jest.fn(), popTo: jest.fn(), navigate: jest.fn(),
    };
    goBackToOrigin(nav, 'LetterHome');
    expect(nav.popTo).toHaveBeenCalledWith('LetterHome');
  });
});

// ─── The screens are actually wired up ──────────────────────────────────

describe('the report screens use it', () => {
  it('neither report screen still gates a bare goBack()', () => {
    for (const src of [progressReport, teacherReport]) {
      expect(stripComments(src)).not.toMatch(/useGatedBack\(\(\)\s*=>\s*navigation\.goBack\(\)\)/);
    }
  });

  it('both report screens route back through goBackToOrigin', () => {
    for (const src of [progressReport, teacherReport]) {
      const code = stripComments(src);
      expect(code).toMatch(/import \{ goBackToOrigin \} from/);
      expect(code).toMatch(/goBackToOrigin\(navigation, route\.params\?\.originRoute\)/);
    }
  });

  it('every screen that opens a report passes an originRoute', () => {
    expect(stripComments(letterPractice)).toMatch(/originRoute:\s*'LetterPractice'/);
    expect(stripComments(letterHome)).toMatch(/originRoute:\s*'LetterHome'/);
    expect(stripComments(wordSelect)).toMatch(/originRoute:\s*'WordLetterSelect'/);
  });

  it('the teacher report retry no longer hardcodes its own route name', () => {
    // The same component is registered as BOTH 'TeacherReport' (handwriting
    // stack) and 'StudentHandwritingReport' (teacher stack), so a literal
    // name in replace() is wrong in one of the two.
    const code = stripComments(teacherReport);
    expect(code).not.toMatch(/navigation\.replace\('TeacherReport'/);
    expect(code).toMatch(/navigation\.replace\(route\.name/);
  });
});
