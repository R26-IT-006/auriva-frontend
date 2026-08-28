// Homework Practice UI — TeacherReport card, periodic section, PDF parity.
//
// TeacherReportScreen/PeriodicReportSection import 'react-native' and cannot be
// mounted under this repo's plain-node jest config, so they are verified by
// source-text assertion — the same technique the surrounding suites use.

import fs from 'fs';
import path from 'path';
import {
  getWorksheetStatusLabel, getReviewStatusLabel, getIntensityLabel,
  getWorksheetStatusLine, formatWorksheetDate, describeMotorPreparation,
  REVIEW_OPTIONS, INTENSITY_OPTIONS, WORKSHEET_STATUS_LABELS, REVIEW_STATUS_LABELS,
} from './worksheetLabels';

const screen = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');
const section = fs.readFileSync(
  path.resolve(__dirname, '../components/handwriting/reports/PeriodicReportSection.js'), 'utf8');
const pdf = fs.readFileSync(path.resolve(__dirname, './periodicReportPdf.js'), 'utf8');
const api = fs.readFileSync(path.resolve(__dirname, './worksheetApi.js'), 'utf8');

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── Shared labels (Phase 17 parity) ──────────────────────────────────────

describe('shared worksheet vocabulary', () => {
  it('every lifecycle status has a teacher-safe label', () => {
    for (const s of ['generated', 'assigned', 'submitted', 'reviewed', 'archived']) {
      expect(getWorksheetStatusLabel(s)).toBeTruthy();
      expect(getWorksheetStatusLabel(s)).not.toMatch(/undefined|null/);
    }
    expect(getWorksheetStatusLabel('nonsense')).toBe('Not available');
  });

  it('there is no "Failed" review outcome anywhere', () => {
    const all = JSON.stringify({ REVIEW_STATUS_LABELS, REVIEW_OPTIONS }).toLowerCase();
    expect(all).not.toContain('fail');
    expect(getReviewStatusLabel('reviewed')).toBe('Completed satisfactorily');
    expect(getReviewStatusLabel('needs_more_practice')).toBe('Continue practice');
  });

  it('offers exactly the three approved review options', () => {
    expect(REVIEW_OPTIONS.map((o) => o.label)).toEqual([
      'Completed satisfactorily', 'Continue practice', 'Discuss in next session',
    ]);
    // Every option maps to a status the backend actually accepts.
    for (const o of REVIEW_OPTIONS) {
      expect(['reviewed', 'needs_more_practice']).toContain(o.status);
    }
  });

  it('practice types are neutral support levels, never difficulty grades', () => {
    expect(INTENSITY_OPTIONS.map((o) => o.label)).toEqual(['Standard Practice', 'Extended Practice']);
    const text = JSON.stringify(INTENSITY_OPTIONS).toLowerCase();
    for (const banned of ['easy', 'hard', 'mild', 'severe', 'difficulty', 'level']) {
      expect(text).not.toContain(banned);
    }
    expect(getIntensityLabel('anything')).toBe('Standard Practice');
  });

  it('builds ONE status line per worksheet, not one per state change', () => {
    expect(getWorksheetStatusLine({ status: 'assigned', submissions: [] })).toBe('Assigned');
    expect(getWorksheetStatusLine({ status: 'submitted', submissions: [{ review_status: 'pending_review' }] }))
      .toBe('Submitted — Pending review');
    expect(getWorksheetStatusLine({ status: 'reviewed', submissions: [{ review_status: 'needs_more_practice' }] }))
      .toBe('Reviewed — Continue practice');
    expect(getWorksheetStatusLine(null)).toBe('Not available');
  });

  it('never renders null / undefined / NaN / [object Object]', () => {
    for (const bad of [null, undefined, '', 'not-a-date']) {
      expect(formatWorksheetDate(bad)).toBe('');
    }
    expect(describeMotorPreparation(null)).toBe('Not available');
    expect(describeMotorPreparation({ warmUp: [] })).toBe('Not available');
    expect(describeMotorPreparation({ warmUp: [{ label: 'Curves' }] })).toBe('Curves');
  });
});

// ─── TeacherReport card ───────────────────────────────────────────────────

describe('TeacherReport Homework Practice card', () => {
  const card = screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));

  it('renders the section under its teacher-facing heading', () => {
    expect(screen).toContain('title="Homework Practice"');
  });

  it('shows the recommendation with target, reason and practice sequence', () => {
    expect(card).toContain('Homework Recommendation');
    // The summary card is Letter / Case / Status / Generated. 'Target Letter'
    // was its old label, before the workflow moved behind View.
    expect(card).toContain('Letter');
    expect(card).toContain('Case');
    expect(card).toContain('Reason');
    expect(card).toMatch(/recommendation\.rationale/);
    expect(card).toMatch(/PRACTICE_SEQUENCE_TEXT/);
  });

  it('offers a target override limited to the recommendation\'s OWN letters', () => {
    expect(card).toMatch(/recommendation\.candidateLetters/);
    expect(card).toMatch(/setSelectedLetter\(c\.letter\)/);
    // The suggestion is the default; an unrelated letter is never auto-picked.
    expect(card).toMatch(/selectedLetter \?\? recommendation\?\.suggestedLetter/);
  });

  it('offers practice type and a teacher note', () => {
    expect(card).toMatch(/INTENSITY_OPTIONS/);
    expect(card).toMatch(/setIntensity\(o\.key\)/);
    expect(card).toContain('Teacher Note (optional)');
  });

  it('handles created / already_assigned / unmapped / error from generate', () => {
    expect(card).toMatch(/res\.status === 'created'/);
    expect(card).toMatch(/res\.status === 'already_assigned'/);
    expect(card).toMatch(/res\.status === 'unmapped_letter'/);
    expect(card).toMatch(/ALREADY_ASSIGNED_TEXT/);
    expect(card).toMatch(/UNMAPPED_LETTER_TEXT/);
  });

  it('shows the active worksheet with target, practice type, date and status', () => {
    expect(card).toContain('Active Homework Worksheet');
    // Practice Type moved into the detail sheet behind View, where `active`
    // is read optionally because the modal renders alongside the summary.
    expect(card).toMatch(/getIntensityLabel\(active\?\.worksheet_intensity\)/);
    expect(card).toMatch(/getWorksheetStatusLine\(active\)/);
    expect(card).toMatch(/formatWorksheetDate\(active\.assigned_at \?\? active\.generated_at\)/);
  });

  it('offers upload only while not yet submitted, and shows pending afterwards', () => {
    // Optional-chained since the workflow moved into a modal, whose children
    // React builds regardless of `visible`.
    expect(card).toMatch(/active\?\.status === 'submitted' && latestSubmission/);
    expect(card).toMatch(/PENDING_REVIEW_TEXT/);
    expect(card).toContain('Take Photo');
    expect(card).toContain('Choose from Gallery');
  });

  it('shows the three review options and a comment field', () => {
    expect(card).toContain('Teacher Review');
    expect(card).toMatch(/REVIEW_OPTIONS\.map/);
    expect(card).toContain('Teacher comment (optional)');
    expect(card).toContain('Save Review');
  });

  it('renders ONE history row per worksheet', () => {
    expect(card).toMatch(/worksheets\.map\(\(w\) =>/);
    expect(card).toMatch(/getWorksheetStatusLine\(w\)/);
  });

  it('handles every empty state explicitly', () => {
    for (const token of ['EMPTY_NO_RECOMMENDATION', 'EMPTY_NO_HISTORY', 'EMPTY_NO_SUBMISSION']) {
      expect(card).toMatch(new RegExp(token));
    }
  });
});

// ─── Gating (Phase 19) ────────────────────────────────────────────────────

describe('every worksheet action is gated', () => {
  const card = screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));

  it('generate, preview, camera, gallery and review each go through the parent gate', () => {
    for (const g of ['gGenerate', 'gPreview', 'gCamera', 'gGallery', 'gReview']) {
      expect(card).toMatch(new RegExp(`const ${g}\\s+= useGatedBack\\(`));
      expect(card).toMatch(new RegExp(`onPress=\\{${g}\\.requestBack\\}`));
      expect(card).toMatch(new RegExp(`\\{${g}\\.gateModal\\}`));
    }
  });

  it('no worksheet action is reachable from a raw onPress that calls the API', () => {
    const code = stripComments(card);
    expect(code).not.toMatch(/onPress=\{\(\) => apiGenerateWorksheet/);
    expect(code).not.toMatch(/onPress=\{\(\) => apiSubmitWorksheet/);
    expect(code).not.toMatch(/onPress=\{\(\) => apiReviewSubmission/);
  });

  it('no child-facing screen imports the worksheet API', () => {
    const dir = path.resolve(__dirname, '../screens/handwriting');
    const offenders = [];
    const walk = (p) => {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!e.name.endsWith('Screen.js')) continue;
        if (full.includes(`reports${path.sep}`)) continue; // teacher surface
        if (fs.readFileSync(full, 'utf8').includes('worksheetApi')) offenders.push(e.name);
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });
});

// ─── Upload robustness (Phase 10) ─────────────────────────────────────────

describe('upload handles every failure without crashing the report', () => {
  const card = screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));

  it('requests permission and reports a denial instead of throwing', () => {
    expect(card).toMatch(/requestCameraPermissionsAsync/);
    expect(card).toMatch(/requestMediaLibraryPermissionsAsync/);
    expect(card).toMatch(/if \(!perm\?\.granted\)/);
  });

  it('a cancelled picker is a no-op, never an error', () => {
    expect(card).toMatch(/if \(result\?\.canceled\) return;/);
  });

  it('wraps the whole flow so a picker or upload failure cannot crash the screen', () => {
    expect(card).toMatch(/catch \(err\) \{/);
    expect(card).toMatch(/could not be uploaded/);
  });

  it('the API client never throws — it degrades to unavailable', () => {
    const code = stripComments(api);
    expect((code.match(/catch \(err\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(code).toMatch(/status: 'unavailable'/);
  });

  it('reuses expo-image-picker rather than adding a new dependency', () => {
    expect(screen).toMatch(/import \* as ImagePicker from 'expo-image-picker'/);
  });
});

// ─── Refresh (Phase 13) ───────────────────────────────────────────────────

describe('the card refreshes after every teacher action', () => {
  it('worksheet data has its own focus effect keyed on a reload token', () => {
    const code = stripComments(screen);
    expect(code).toMatch(/worksheetReloadToken/);
    expect(code).toMatch(/fetchWorksheetHistory\(student\?\.sid\)/);
    expect(code).toMatch(/fetchWorksheetCandidates\(student\?\.sid\)/);
  });

  it('generate, preview, upload and review all trigger a refresh', () => {
    const card = screen.slice(
      screen.indexOf('function HomeworkPracticeCard'),
      screen.indexOf('const hw = StyleSheet.create'));
    expect((card.match(/onChanged\(\);/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Periodic report + PDF parity (Phases 15-17) ──────────────────────────

describe('periodic report and PDF', () => {
  it('the periodic section renders Home Practice with the three counts', () => {
    expect(section).toContain('title="Home Practice"');
    expect(section).toContain('Worksheets Assigned');
    expect(section).toContain('Worksheets Submitted');
    expect(section).toContain('Worksheets Reviewed');
  });

  it('the PDF renders a Home Practice section with an activity table', () => {
    expect(pdf).toContain("'Home Practice'");
    expect(pdf).toMatch(/buildHomePracticeHtml/);
    expect(pdf).toContain('Letter');
    expect(pdf).toContain('Activity');
  });

  it('both use the ACTIVE-as-of-end-date worksheet, never a later one', () => {
    for (const source of [section, pdf]) {
      expect(source).toMatch(/active_worksheet_as_of_end_date/);
    }
  });

  it('screen and PDF share the same label helpers — no drift', () => {
    for (const source of [section, pdf]) {
      expect(stripComments(source)).toMatch(/getWorksheetStatusLabel/);
      expect(stripComments(source)).toMatch(/getReviewStatusLabel/);
      expect(stripComments(source)).toMatch(/getIntensityLabel/);
    }
  });

  it('both show the same empty-period sentence', () => {
    for (const source of [section, pdf]) {
      expect(stripComments(source)).toMatch(/EMPTY_NO_PERIOD_ACTIVITY/);
    }
  });

  it('the PDF never embeds a scanned worksheet image', () => {
    const fn = pdf.slice(pdf.indexOf('function buildHomePracticeHtml'), pdf.indexOf('function buildReportHtml'));
    expect(fn).not.toMatch(/file_reference|<img|base64|data:image/);
  });

  it('the PDF carries a short review outcome, not full teacher comments', () => {
    const fn = pdf.slice(pdf.indexOf('function buildHomePracticeHtml'), pdf.indexOf('function buildReportHtml'));
    expect(fn).not.toMatch(/teacher_comment/);
    expect(fn).toMatch(/getReviewStatusLabel/);
  });
});

// ─── Isolation + no auto-scoring (Phases 18-20) ───────────────────────────

describe('isolation and honesty', () => {
  const card = stripComments(screen.slice(
    screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create')));

  it('the card never touches mastery, scores, thresholds or sequencing', () => {
    // Precise identifiers, not loose substrings: the card legitimately names
    // the PRACTICE sequence (warm-up -> tracing -> copying -> independent),
    // which is unrelated to adaptive sequencing.
    for (const forbidden of [
      'mastered_at', 'LetterProgress', 'motor_score', 'motorScore',
      'threshold', 'adaptiveSequenc', 'generateAdaptiveSequence', 'letterSequence',
      'wordUnlock', 'isWordsUnlocked', 'state_code', 'cluster_id',
    ]) {
      expect(card.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('no surface claims a scan is analysed or scored', () => {
    for (const source of [screen, section, pdf, api]) {
      const code = stripComments(source).toLowerCase();
      for (const banned of ['ocr', 'handwriting recognition', 'auto-score', 'autoscore', 'analysis_result']) {
        expect(code).not.toContain(banned);
      }
    }
  });

  it('no technical recommendation internals reach the teacher', () => {
    for (const banned of ['WINDOW_SIZE', 'MIN_USABLE_CYCLES', 'failedCycles', 'separationMs']) {
      expect(card).not.toContain(banned);
    }
  });

  it('the supporting note states worksheets do not change progression', () => {
    expect(screen).toMatch(/WORKSHEET_SUPPORTING_TEXT/);
  });
});
