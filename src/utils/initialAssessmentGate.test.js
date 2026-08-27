// WelcomeScreen's initial-assessment routing gate (Phase 11 scenario J).
//
// The screen used to route on `hasData`, which means "an assessment ROW
// exists". A row whose motor_profile never arrived therefore skipped the
// assessment forever, with no route back through the real product UI.
// It now routes on `assessmentStatus`.

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const welcome = stripComments(read('../screens/handwriting/WelcomeScreen.js'));

// The exact resolution the screen performs, extracted so the routing table
// below is executable rather than merely asserted about.
const isComplete = (data) => {
  const status = data?.assessmentStatus;
  return status != null ? status === 'complete' : Boolean(data?.hasData);
};

describe('J — routing', () => {
  it.each([
    ['not_started', { assessmentStatus: 'not_started', hasData: false }, false],
    ['incomplete',  { assessmentStatus: 'incomplete',  hasData: true  }, false],
    ['complete',    { assessmentStatus: 'complete',    hasData: true  }, true ],
  ])('%s -> proceeds to LetterHome: %s', (_label, data, expected) => {
    expect(isComplete(data)).toBe(expected);
  });

  it('the student-41 shape (row exists, unusable) shows the assessment', () => {
    // hasData:true is CORRECT for this payload — the teacher report should
    // still show the attempt. It just must not route the child past it.
    expect(isComplete({ hasData: true, assessmentStatus: 'incomplete' })).toBe(false);
  });

  it('SENTINEL — routing on hasData alone would have skipped it', () => {
    // Proof the change is load-bearing rather than cosmetic.
    const data = { hasData: true, assessmentStatus: 'incomplete' };
    expect(Boolean(data.hasData)).toBe(true);      // the old gate
    expect(isComplete(data)).toBe(false);          // the new one
  });

  it('falls back to hasData when the field is absent (older backend)', () => {
    expect(isComplete({ hasData: true })).toBe(true);
    expect(isComplete({ hasData: false })).toBe(false);
    expect(isComplete({})).toBe(false);
    expect(isComplete(undefined)).toBe(false);
  });

  it('an unknown future status is treated as NOT complete', () => {
    expect(isComplete({ assessmentStatus: 'something_new', hasData: true })).toBe(false);
  });
});

describe('the screen actually implements that resolution', () => {
  it('reads assessmentStatus', () => {
    expect(welcome).toMatch(/const status = res\.data\?\.assessmentStatus;/);
  });

  it('compares it to complete, with a hasData fallback', () => {
    expect(welcome).toMatch(
      /status != null \? status === 'complete' : Boolean\(res\.data\?\.hasData\)/);
  });

  it('SENTINEL — no longer routes on hasData alone', () => {
    expect(welcome).not.toMatch(/if \(res\.data\?\.hasData\) \{\s*navigation\.replace\('LetterHome'/);
  });

  it('still replaces (not pushes) so the child cannot swipe back into limbo', () => {
    expect(welcome).toMatch(/navigation\.replace\('LetterHome'/);
  });

  it('a network error still defaults to SHOWING the assessment, never skipping it', () => {
    expect(welcome).toMatch(/catch \(netErr\)/);
    const catchAt = welcome.indexOf('catch (netErr)');
    const after = welcome.slice(catchAt, catchAt + 500);
    expect(after).not.toMatch(/navigation\.replace\('LetterHome'/);
  });

  it('no infinite loop: an incomplete status falls through to the assessment screen', () => {
    // The only early return is the complete branch; everything else reaches
    // setCheckingReturningStudent(false), which renders the assessment.
    expect(welcome).toMatch(/setCheckingReturningStudent\(false\)/);
    const completeAt = welcome.indexOf("if (isComplete) {");
    const setFalseAt = welcome.indexOf('setCheckingReturningStudent(false)', completeAt);
    expect(completeAt).toBeGreaterThan(-1);
    expect(setFalseAt).toBeGreaterThan(completeAt);
  });
});

describe('the other two consumers of hasData are untouched', () => {
  it('the teacher report still gates its section on hasData', () => {
    const teacher = stripComments(read('../screens/handwriting/reports/TeacherReportScreen.js'));
    expect(teacher).toMatch(/if \(res\.data\?\.hasData\) serverData = res\.data;/);
  });

  it('the shape-preview loader still gates on hasData', () => {
    const shapes = stripComments(read('./initialAssessmentShapes.js'));
    expect(shapes).toMatch(/if \(!data\.hasData\) return \{ status: 'not_found'/);
  });
});
