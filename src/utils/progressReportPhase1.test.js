// Handwriting Progress Report — Phase 1: the three proven data bugs + back
// navigation. Layout/reorder work (phases 2 and 3) is not covered here.
//
// Source assertions: RN screens do not render under the minimal jest config.

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const report  = stripComments(read('../screens/handwriting/reports/TeacherReportScreen.js'));
const profile = stripComments(read('../screens/teacher/students/StudentDetailScreen.js'));

// ─── A. Back navigation ─────────────────────────────────────────────────

describe('A — the report knows where it was opened from', () => {
  it('the teacher path now passes an origin', () => {
    expect(profile).toMatch(/navigation\.navigate\('StudentHandwritingReport', \{[\s\S]{0,200}?originRoute: route\.name,/);
  });

  it('uses route.name, which is correct for BOTH registrations of the profile', () => {
    // TeacherStudentDetailScreen is registered twice (TeacherStudentDetail and
    // StudentSession). A hardcoded name would be wrong in one of them.
    expect(profile).toMatch(/originRoute: route\.name/);
    expect(profile).not.toMatch(/originRoute: 'TeacherStudentDetail'/);
    const teacherNav = read('../navigation/TeacherNavigator.js');
    expect(teacherNav).toMatch(/name="TeacherStudentDetail"/);
    expect(teacherNav).toMatch(/name="StudentSession"/);
  });

  it('the child paths already passed one, and still do', () => {
    expect(stripComments(read('../screens/handwriting/LetterHomeScreen.js')))
      .toMatch(/originRoute: 'LetterHome'/);
    expect(stripComments(read('../screens/handwriting/words/WordLetterSelectScreen.js')))
      .toMatch(/originRoute: 'WordLetterSelect'/);
  });

  it('the report resolves back through the shared origin helper', () => {
    expect(report).toMatch(/goBackToOrigin\(navigation, route\.params\?\.originRoute\)/);
  });

  it('the on-screen back and the hardware back share one handler', () => {
    // useGatedBack registers the Android hardware back through the same
    // callback, so the two cannot diverge.
    expect(report).toMatch(/const \{ requestBack, gateModal \} = useGatedBack\(/);
    expect(report).toMatch(/onPress=\{requestBack\}/);
    expect(stripComments(read('./useGatedBack.js'))).toMatch(/hardwareBackPress/);
  });
});

// ─── B. Portrait ────────────────────────────────────────────────────────

describe('B — portrait lock', () => {
  it('the report locks portrait', () => {
    expect(report).toMatch(/useLockPortrait\(\)/);
  });

  it('the lock is scoped to focus and released on blur — not app-wide', () => {
    const lock = stripComments(read('./useOrientationLock.js'));
    expect(lock).toMatch(/useFocusEffect/);
    expect(report).not.toMatch(/lockAsync\(/);   // never locks directly
  });

  it('child handwriting screens still lock LANDSCAPE', () => {
    expect(stripComments(read('../screens/handwriting/ShapeAssessmentScreen.js')))
      .toMatch(/useLockLandscape\(\)/);
  });
});

// ─── W. Assessment vs baseline ──────────────────────────────────────────

describe('W — an assessment without a baseline is no longer called "not done"', () => {
  it('the summary card takes assessment evidence separately from the baseline', () => {
    expect(report).toMatch(/function InitialMotorBaselineSummaryCard\(\{ result, assessment \}\)/);
    expect(report).toMatch(/<InitialMotorBaselineSummaryCard result=\{motorBaseline\} assessment=\{assessmentEvidence\} \/>/);
  });

  it('a valid assessment with no baseline renders its own family results', () => {
    expect(report).toMatch(/status === 'baseline_not_found' && hasAssessmentEvidence \?/);
    expect(report).toMatch(/Movement-family results/);
  });

  it('the false empty state is now reachable ONLY with no assessment evidence', () => {
    // The generic message must sit AFTER the assessment-evidence branch.
    const evidenceBranch = report.indexOf("status === 'baseline_not_found' && hasAssessmentEvidence");
    const emptyBranch    = report.indexOf('Complete the initial motor assessment');
    expect(evidenceBranch).toBeGreaterThan(-1);
    expect(emptyBranch).toBeGreaterThan(evidenceBranch);
  });

  it('assessment evidence comes from the motor profile, never from the baseline row', () => {
    expect(report).toMatch(/const profile = assessment\?\.motorProfile \?\? null;/);
    expect(report).toMatch(/setAssessmentEvidence\(\{ motorProfile: motorProfile \?\? null \}\)/);
  });

  it('a profile with no finite family score is NOT treated as evidence', () => {
    expect(report).toMatch(/Object\.values\(profileScores\)\.some\(v => typeof v === 'number' && Number\.isFinite\(v\)\)/);
  });

  it('the captured shape drawings are already rendered from stored strokes', () => {
    // Motor Performance renders them; W does not need to duplicate.
    expect(report).toMatch(/<ShapePreview strokes=\{shape\.strokes\} \/>/);
    expect(report).toMatch(/computeShapePreviewPaths\(strokes/);
    // Never a fabricated drawing: no stroke data -> a neutral placeholder.
    expect(report).toMatch(/name="image-outline"/);
  });
});

// ─── L. Generate state ──────────────────────────────────────────────────

describe('L — Generate Worksheet is not re-offered for a covered letter', () => {
  it('the display guard covers reviewed as well as the live statuses', () => {
    expect(report).toMatch(/\['generated', 'assigned', 'submitted', 'reviewed'\]\.includes\(w\.status\)/);
  });

  it('the recommendation block is suppressed when already covered', () => {
    expect(report).toMatch(/!active && recommendation && !dismissed && !recommendationAlreadyCovered \?/);
  });

  it('the guard keys on letter AND case, so c and C stay independent', () => {
    expect(report).toMatch(/\$\{w\.target_letter\}\|\$\{w\.case_type\}/);
    expect(report).toMatch(/\$\{recommendation\.suggestedLetter\}\|\$\{recommendation\.caseType\}/);
  });

  it('SENTINEL — backend duplicate-active protection is NOT weakened', () => {
    const svc = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/worksheetService.js'), 'utf8');
    // LIVE_STATUSES is untouched: this fix is display-state only.
    expect(svc).toMatch(/const LIVE_STATUSES = Object\.freeze\(\['generated', 'assigned', 'submitted'\]\)/);
    expect(svc).toMatch(/alreadyAssigned/);
  });

  it('a recommendation with no suggested letter is never wrongly suppressed', () => {
    expect(report).toMatch(/!!recommendation\.suggestedLetter/);
  });
});

// ─── M. View proof ──────────────────────────────────────────────────────

describe('M — the submitted proof is viewable, and distinct from the worksheet', () => {
  it('history offers a separate Proof action when proof exists', () => {
    expect(report).toMatch(/historyProofOf\(w\) \?/);
    expect(report).toMatch(/setProofTarget\(\{ worksheet: w, submission: historyProofOf\(w\) \}\)/);
    expect(report).toMatch(/>Proof</);
  });

  it('the worksheet action stays, and is relabelled when both exist', () => {
    expect(report).toMatch(/historyProofOf\(w\) \? 'Worksheet' : 'View'/);
    expect(report).toMatch(/setReprintTarget\(w\)/);
  });

  it('proof comes from the SUBMISSION column, never the worksheet file', () => {
    const helper = report.slice(report.indexOf('function historyProofOf'),
                                report.indexOf('function HomeworkPracticeCard'));
    expect(helper).toMatch(/s\?\.file_reference/);
    expect(helper).not.toMatch(/worksheet_file_url/);
  });

  it('no proof -> null, so no proof action and no fallback to the worksheet', () => {
    const helper = report.slice(report.indexOf('function historyProofOf'),
                                report.indexOf('function HomeworkPracticeCard'));
    expect(helper).toMatch(/if \(withFile\.length === 0\) return null;/);
    // ...and it must never hand back the WORKSHEET as if it were a proof,
    // which is precisely the bug being fixed. Every return is either null or
    // drawn from the filtered submission list.
    const returns = helper.match(/return [^;]+;/g) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) {
      expect(r).toMatch(/return (null|\[\.\.\.withFile\])/);
    }
  });

  it('the viewer shows the uploaded image itself', () => {
    expect(report).toMatch(/source=\{\{ uri: proofTarget\.submission\.file_reference \}\}/);
    expect(report).toMatch(/Submitted proof ·/);
  });

  it('a missing image degrades to a message, never a broken box', () => {
    expect(report).toMatch(/This proof image is no longer available\./);
  });

  it('the viewer is read-only — it triggers no review or status change', () => {
    const modal = report.slice(report.indexOf('visible={!!proofTarget}'),
                               report.indexOf('{gGenerate.gateModal}'));
    expect(modal).not.toMatch(/apiReviewSubmission|doReview|setReviewChoice|markAssigned/);
  });

  it('the image is bounded so a tall photo cannot overflow a tablet sheet', () => {
    expect(report).toMatch(/maxHeight: 460/);
    expect(report).toMatch(/resizeMode="contain"/);
  });
});

// ─── Regression ─────────────────────────────────────────────────────────

describe('SENTINEL — no handwriting logic changed', () => {
  it('mastery, threshold and cycle policy are untouched', () => {
    const policy = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/masteryPolicy.js'), 'utf8');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    const cap = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/config/practiceCyclePolicy.js'), 'utf8');
    expect(cap).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
  });

  it('Motor Score and the initial-assessment scoring are untouched', () => {
    const ms = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/utils/motorScore.js'), 'utf8');
    expect(ms).toMatch(/accuracy:\s+0\.35/);
    expect(ms).toMatch(/DTW_MAX_NORM\s+= 45/);
    expect(ms).toMatch(/SMOOTHNESS_MAX_RAD\s+= 1\.0/);
  });

  it('worksheet generation itself is untouched', () => {
    expect(report).toMatch(/apiGenerateWorksheet\(/);
    expect(report).toMatch(/recommendationFingerprint: recommendation\.recommendationFingerprint/);
  });

  it('the Student Profile Writing summary is unchanged by this phase', () => {
    expect(profile).toMatch(/<WritingSummaryCard/);
    expect(profile).not.toMatch(/ThresholdCard|Writing Standard/);
  });
});
