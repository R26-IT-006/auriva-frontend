// Starting a Writing Check from the handwriting report.
//
// The device crash this fixes:
//   The action 'NAVIGATE' with payload {"name":"WritingCheck",...}
//   was not handled by any navigator.
//
// TeacherReportScreen is registered TWICE — as 'TeacherReport' inside
// HandwritingNavigator (which owns WritingCheck) and as
// 'StudentHandwritingReport' inside TeacherNavigator (which does not). Its
// single navigate('WritingCheck') therefore worked from one entry point and
// threw from the other. Reaching the report from Teacher -> Student Profile
// lands on the second mount, so that path crashed.
//
// Pre-existing: StudentHandwritingReport was already the Student Profile's
// destination before the Writing-tab work.

import fs from 'fs';
import path from 'path';

import {
  resolveWritingCheckNavigation, navigateToWritingCheck,
  WRITING_CHECK_ROUTE, HANDWRITING_MODULE_ROUTE,
} from './writingCheckNavigation';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const student = { sid: 51, avatar_key: 'lily' };
const theme = { button: '#3D7A6E' };

// ─── The two navigators, as they actually are ───────────────────────────

describe('the tree this fix exists for', () => {
  const handwritingNav = read('../navigation/HandwritingNavigator.js');
  const teacherNav     = read('../navigation/TeacherNavigator.js');

  it('the report really is registered in BOTH navigators', () => {
    expect(handwritingNav).toMatch(/component=\{TeacherReportScreen\}/);
    expect(teacherNav).toMatch(/component=\{TeacherReportScreen\}/);
    expect(handwritingNav).toMatch(/name="TeacherReport"/);
    expect(teacherNav).toMatch(/name="StudentHandwritingReport"/);
  });

  it('only ONE of them owns the WritingCheck screen — the whole cause', () => {
    expect(handwritingNav).toMatch(/name="WritingCheck"/);
    expect(teacherNav).not.toMatch(/name="WritingCheck"/);
  });

  it('the teacher stack hosts the handwriting stack under HandwritingModule', () => {
    expect(teacherNav).toMatch(/name="HandwritingModule"\s+component=\{HandwritingNavigator\}/);
  });
});

// ─── The resolution ─────────────────────────────────────────────────────

describe('inside the handwriting stack', () => {
  it('navigates directly, exactly as before', () => {
    const [name, params] = resolveWritingCheckNavigation({
      routeNames: ['Welcome', 'LetterHome', 'WritingCheck', 'TeacherReport'], student, theme,
    });
    expect(name).toBe(WRITING_CHECK_ROUTE);
    expect(params).toEqual({ student, theme });
    // No nesting keys leak into the direct form.
    expect(params.screen).toBeUndefined();
  });
});

describe('inside the teacher stack — the crashing path', () => {
  const routeNames = ['WorkspaceSelect', 'TeacherMain', 'StudentPicker',
                      'StudentDashboard', 'HandwritingModule', 'StudentHandwritingReport'];

  it('navigates through HandwritingModule instead of throwing', () => {
    const [name, params] = resolveWritingCheckNavigation({ routeNames, student, theme });
    expect(name).toBe(HANDWRITING_MODULE_ROUTE);
    expect(params.screen).toBe(WRITING_CHECK_ROUTE);
  });

  it('sends student/theme at BOTH levels', () => {
    // HandwritingNavigator reads route.params?.student itself (to derive the
    // avatar theme and seed initialParams); WritingCheckScreen reads its own
    // route.params. Either alone leaves one of them empty.
    const [, params] = resolveWritingCheckNavigation({ routeNames, student, theme });
    expect(params.student).toBe(student);
    expect(params.theme).toBe(theme);
    expect(params.params).toEqual({ student, theme });
  });

  it('SENTINEL — both consumers really do read what we send', () => {
    const nav = read('../navigation/HandwritingNavigator.js');
    expect(nav).toMatch(/const student = route\.params\?\.student;/);
    const screen = read('../screens/handwriting/WritingCheckScreen.js');
    expect(screen).toMatch(/const \{ student, theme \} = route\.params/);
  });
});

// ─── Defensive behaviour ────────────────────────────────────────────────

describe('when the navigator state cannot be read', () => {
  it('falls back to the NESTED form, which resolves from either stack', () => {
    for (const routeNames of [undefined, null, [], 'nope', 42, {}]) {
      const [name] = resolveWritingCheckNavigation({ routeNames, student, theme });
      expect(name).toBe(HANDWRITING_MODULE_ROUTE);
    }
  });

  it('a navigation object with no getState still navigates rather than throwing', () => {
    const navigation = { navigate: jest.fn() };
    expect(() => navigateToWritingCheck(navigation, { student, theme })).not.toThrow();
    expect(navigation.navigate).toHaveBeenCalledWith(HANDWRITING_MODULE_ROUTE, expect.objectContaining({
      screen: WRITING_CHECK_ROUTE,
    }));
  });

  it('a getState that throws is caught, not propagated to the teacher', () => {
    const navigation = { getState: () => { throw new Error('detached'); }, navigate: jest.fn() };
    expect(() => navigateToWritingCheck(navigation, { student, theme })).not.toThrow();
    expect(navigation.navigate).toHaveBeenCalled();
  });

  it('called with no args at all still produces a usable payload', () => {
    const [name, params] = resolveWritingCheckNavigation();
    expect(name).toBe(HANDWRITING_MODULE_ROUTE);
    expect(params.screen).toBe(WRITING_CHECK_ROUTE);
  });
});

// ─── Applied to a real navigation object ────────────────────────────────

describe('navigateToWritingCheck', () => {
  it('direct from the handwriting stack', () => {
    const navigation = {
      getState: () => ({ routeNames: ['Welcome', 'WritingCheck', 'TeacherReport'] }),
      navigate: jest.fn(),
    };
    navigateToWritingCheck(navigation, { student, theme });
    expect(navigation.navigate).toHaveBeenCalledWith('WritingCheck', { student, theme });
  });

  it('nested from the teacher stack', () => {
    const navigation = {
      getState: () => ({ routeNames: ['TeacherMain', 'HandwritingModule', 'StudentHandwritingReport'] }),
      navigate: jest.fn(),
    };
    navigateToWritingCheck(navigation, { student, theme });
    const [name, params] = navigation.navigate.mock.calls[0];
    expect(name).toBe('HandwritingModule');
    expect(params.screen).toBe('WritingCheck');
    expect(params.params).toEqual({ student, theme });
  });
});

// ─── The report uses it ─────────────────────────────────────────────────

describe('the report', () => {
  const report = stripComments(read('../screens/handwriting/reports/TeacherReportScreen.js'));

  it('no longer calls navigate("WritingCheck") directly', () => {
    expect(report).not.toMatch(/navigation\.navigate\('WritingCheck'/);
  });

  it('routes through the helper instead', () => {
    expect(report).toMatch(/navigateToWritingCheck\(navigation, \{ student, theme \}\)/);
  });

  it('still goes through the parent gate before leaving for a child activity', () => {
    // Starting a Writing Check leaves the report for a child screen, so the
    // existing ParentGateModal must still fire — this fix changed only the
    // destination resolution, never the gate.
    expect(report).toMatch(/useGatedBack\(\s*[\s\S]{0,400}?navigateToWritingCheck/);
  });
});

// ─── Nothing about Writing Check itself moved ───────────────────────────

describe('SENTINEL — Writing Check logic is untouched', () => {
  const screen = stripComments(read('../screens/handwriting/WritingCheckScreen.js'));

  it('still runs in collection mode with its own session identity', () => {
    expect(screen).toMatch(/collectionMode: true/);
    expect(screen).toMatch(/collection_session_id/);
  });

  it('still batches by case and returns to itself when a batch completes', () => {
    expect(screen).toMatch(/function nextBatch\(\)/);
    expect(screen).toMatch(/writingCheckId/);
  });

  it('the helper contains no Writing Check logic of its own', () => {
    const helper = stripComments(read('./writingCheckNavigation.js'));
    expect(helper).not.toMatch(/collection_mode|collectionMode|cluster|pattern|attempt/i);
    expect(helper).not.toMatch(/client\.|ENDPOINTS/);
  });
});
