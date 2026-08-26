// Worksheet-specific PDF sharing.
//
// A worksheet and a periodic report are different documents sent to different
// people. They share the share-sheet MECHANICS (pdfShare.js) and nothing else:
// wording, filename and preview title must each stay in their own vocabulary.

import fs from 'fs';
import path from 'path';
import {
  buildWorksheetFilename, buildWorksheetShareTitle, WORKSHEET_SHARE_TITLE,
} from './worksheetPdf';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const screen = read('../screens/handwriting/reports/TeacherReportScreen.js');
const modal  = read('../components/handwriting/reports/ReportPreviewModal.js');

const STUDENT = { full_name: 'Hiran' };
const WORKSHEET = {
  id: 12, worksheet_code: 'HW-2026-0004', target_letter: 'c', case_type: 'lowercase',
  generated_at: '2026-08-26T09:30:00.000Z',
};

// --- Filename -------------------------------------------------------------

describe('worksheet filename', () => {
  it('is the worksheet form, never the report form', () => {
    const name = buildWorksheetFilename({ student: STUDENT, worksheet: WORKSHEET });
    expect(name).toBe('Auriva_Writing_Practice_Hiran_c_2026-08-26.pdf');
    expect(name).not.toContain('Handwriting_Report');
  });

  it('includes the target letter, cased the way the child practises it', () => {
    expect(buildWorksheetFilename({ student: STUDENT, worksheet: WORKSHEET })).toContain('_c_');
    expect(buildWorksheetFilename({
      student: STUDENT, worksheet: { ...WORKSHEET, target_letter: 'C', case_type: 'uppercase' },
    })).toBe('Auriva_Writing_Practice_Hiran_C_2026-08-26.pdf');
  });

  it('OMITS the name segment when no student name is available', () => {
    for (const student of [null, undefined, {}, { full_name: '' }, { full_name: '   ' }]) {
      expect(buildWorksheetFilename({ student, worksheet: WORKSHEET }))
        .toBe('Auriva_Writing_Practice_c_2026-08-26.pdf');
    }
  });

  it('sanitizes the student name - no path traversal, no separators', () => {
    const evil = buildWorksheetFilename({
      student: { full_name: '../../etc/passwd' }, worksheet: WORKSHEET,
    });
    expect(evil).not.toContain('/');
    expect(evil).not.toContain('..');
    expect(buildWorksheetFilename({ student: { full_name: 'Jane Doe' }, worksheet: WORKSHEET }))
      .toBe('Auriva_Writing_Practice_Jane_Doe_c_2026-08-26.pdf');
  });

  it('a name that sanitizes to nothing is treated as unavailable, not padded', () => {
    expect(buildWorksheetFilename({ student: { full_name: '!!!///' }, worksheet: WORKSHEET }))
      .toBe('Auriva_Writing_Practice_c_2026-08-26.pdf');
  });

  it('stays bounded in length', () => {
    const long = buildWorksheetFilename({ student: { full_name: 'a'.repeat(500) }, worksheet: WORKSHEET });
    expect(long.length).toBeLessThan(120);
  });

  it('falls back to today when the worksheet has no or a broken generated_at', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(buildWorksheetFilename({ student: STUDENT, worksheet: { target_letter: 'c' } }))
      .toBe('Auriva_Writing_Practice_Hiran_c_' + today + '.pdf');
    expect(buildWorksheetFilename({ student: STUDENT, worksheet: { target_letter: 'c', generated_at: 'not-a-date' } }))
      .toBe('Auriva_Writing_Practice_Hiran_c_' + today + '.pdf');
  });

  it('never throws on missing input', () => {
    expect(() => buildWorksheetFilename({})).not.toThrow();
    expect(() => buildWorksheetFilename({ student: null, worksheet: null })).not.toThrow();
  });
});

// --- Privacy: nothing internal in a name that leaves the device -----------

describe('no internal identifiers leak into the filename or share title', () => {
  const worksheet = {
    ...WORKSHEET, id: 12, student_id: 4, recommendation_id: 88,
    worksheet_plan: { worksheet_plan_version: 'worksheet-plan-v1' },
  };
  const student = { id: 4, full_name: 'Hiran', student_code: 'STU-0004' };

  const outputs = [
    buildWorksheetFilename({ student, worksheet }),
    buildWorksheetShareTitle({ student, worksheet }),
  ];

  it('carries no database, worksheet, recommendation or model information', () => {
    for (const out of outputs) {
      for (const leak of ['HW-2026-0004', 'STU-0004', 'student_id', 'recommendation',
        'worksheet_plan', 'cluster', 'motor_cluster', 'letter_motor_cluster']) {
        expect(out).not.toContain(leak);
      }
      // No bare row ids either.
      expect(out).not.toMatch(/\b(id|sid)[=_-]?\d+/i);
      expect(out).not.toMatch(/\b88\b/);
    }
  });
});

// --- Share title ----------------------------------------------------------

describe('worksheet share title', () => {
  it('is worksheet wording, never "Auriva Handwriting Report"', () => {
    const title = buildWorksheetShareTitle({ student: STUDENT, worksheet: WORKSHEET });
    expect(title).toContain('Auriva Handwriting Practice Worksheet');
    expect(title).not.toContain('Handwriting Report');
    expect(WORKSHEET_SHARE_TITLE).toBe('Auriva Handwriting Practice Worksheet');
  });

  it('names the child and the letter when both are known', () => {
    expect(buildWorksheetShareTitle({ student: STUDENT, worksheet: WORKSHEET }))
      .toBe('Auriva Handwriting Practice Worksheet — Hiran, letter c');
  });

  it('degrades to the bare title rather than printing an empty detail', () => {
    expect(buildWorksheetShareTitle({ student: null, worksheet: {} })).toBe(WORKSHEET_SHARE_TITLE);
    expect(buildWorksheetShareTitle({})).toBe(WORKSHEET_SHARE_TITLE);
  });
});

// --- The shared low-level helper -----------------------------------------

describe('sharePdfFile (shared by both documents)', () => {
  let mockIsAvailableAsync, mockShareAsync;

  beforeEach(() => {
    jest.resetModules();
    mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
    mockShareAsync = jest.fn().mockResolvedValue(undefined);
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: (...a) => mockIsAvailableAsync(...a),
      shareAsync: (...a) => mockShareAsync(...a),
    }), { virtual: true });
  });

  const fresh = () => require('./worksheetPdf');
  const URI = 'file:///cache/Auriva_Writing_Practice_Hiran_c_2026-08-26.pdf';

  it('sends the already-generated file with the WORKSHEET dialog title', async () => {
    const { shareWorksheetPdf } = fresh();
    const res = await shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT });

    expect(res.status).toBe('shared');
    expect(mockShareAsync).toHaveBeenCalledWith(URI, expect.objectContaining({
      mimeType: 'application/pdf',
      dialogTitle: 'Auriva Handwriting Practice Worksheet — Hiran, letter c',
    }));
  });

  it('the report keeps its OWN wording - report sharing is unchanged', async () => {
    const { sharePeriodicReportPdf } = require('./periodicReportPdf');
    const res = await sharePeriodicReportPdf({ fileUri: 'file:///r.pdf', studentName: 'Jane Doe' });

    expect(res.status).toBe('shared');
    expect(mockShareAsync).toHaveBeenCalledWith('file:///r.pdf', expect.objectContaining({
      dialogTitle: 'Auriva Handwriting Report — Jane Doe',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    }));
  });

  it('the report still refuses to share with nothing generated, in report wording', async () => {
    const { sharePeriodicReportPdf } = require('./periodicReportPdf');
    await expect(sharePeriodicReportPdf({ fileUri: null, studentName: 'Jane Doe' }))
      .resolves.toEqual({ status: 'failed', error: 'No generated report to share.' });
  });

  it('sharing a worksheet RENDERS NOTHING and creates no worksheet', async () => {
    const mockPrint = jest.fn();
    jest.doMock('expo-print', () => ({ printToFileAsync: (...a) => mockPrint(...a) }), { virtual: true });
    const { shareWorksheetPdf } = fresh();
    await shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT });
    // The reviewed sheet is the one that is sent - no second render, and no
    // api module is reachable from this file at all.
    expect(mockPrint).not.toHaveBeenCalled();
    expect(read('./worksheetPdf.js')).not.toMatch(/worksheetApi/);
  });

  it('refuses to share when nothing was generated, in worksheet wording', async () => {
    const { shareWorksheetPdf } = fresh();
    const res = await shareWorksheetPdf({ fileUri: null, worksheet: WORKSHEET, student: STUDENT });
    expect(res).toEqual({ status: 'failed', error: 'There is no worksheet to share.' });
    expect(res.error).not.toMatch(/report/i);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('a cancelled share is not a failure', async () => {
    mockShareAsync.mockRejectedValueOnce(new Error('User cancelled the share sheet'));
    const { shareWorksheetPdf } = fresh();
    await expect(shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT }))
      .resolves.toMatchObject({ status: 'cancelled' });
  });

  it('an unavailable share sheet is distinct from a failure', async () => {
    mockIsAvailableAsync.mockResolvedValueOnce(false);
    const { shareWorksheetPdf } = fresh();
    const res = await shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT });
    expect(res.status).toBe('sharing_unavailable');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('a share failure resolves - it never throws at the caller', async () => {
    mockShareAsync.mockRejectedValueOnce(new Error('native share bridge exploded'));
    const { shareWorksheetPdf } = fresh();
    await expect(shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT }))
      .resolves.toMatchObject({ status: 'failed' });
  });

  it('survives a missing expo-sharing module entirely', async () => {
    jest.resetModules();
    jest.doMock('expo-sharing', () => { throw new Error('module not found'); }, { virtual: true });
    const { shareWorksheetPdf } = require('./worksheetPdf');
    await expect(shareWorksheetPdf({ fileUri: URI, worksheet: WORKSHEET, student: STUDENT }))
      .resolves.toMatchObject({ status: 'failed' });
  });
});

// --- Preview title --------------------------------------------------------

describe('preview modal title', () => {
  it('is an optional prop that DEFAULTS to the report title', () => {
    expect(modal).toMatch(/title = 'Report preview'/);
    expect(modal).toMatch(/<Text style=\{styles\.title\} numberOfLines=\{1\}>\{title\}<\/Text>/);
    // No second preview component was created.
    expect(fs.existsSync(path.resolve(__dirname, '../components/handwriting/reports/WorksheetPreviewModal.js')))
      .toBe(false);
  });

  it('the periodic report section passes no title, so its wording is unchanged', () => {
    const section = read('../components/handwriting/reports/PeriodicReportSection.js');
    const usage = section.slice(section.indexOf('<ReportPreviewModal'),
      section.indexOf('/>', section.indexOf('<ReportPreviewModal')));
    expect(usage).not.toMatch(/title=/);
  });

  it('the worksheet preview says "Writing Practice Worksheet"', () => {
    const card = screen.slice(screen.indexOf('function HomeworkPracticeCard'),
      screen.indexOf('const hw = StyleSheet.create'));
    expect(card).toMatch(/<ReportPreviewModal\s*\n\s*title="Writing Practice Worksheet"/);
  });
});

// --- Teacher-facing wording + read-only reprint ---------------------------

describe('the teacher screen speaks worksheet, not report', () => {
  const card = screen.slice(screen.indexOf('function HomeworkPracticeCard'),
    screen.indexOf('const hw = StyleSheet.create'));
  const shareFn = card.slice(card.indexOf('const doSharePreview'), card.indexOf('const closePreview'));

  it('calls the worksheet share helper with the previewed sheet', () => {
    expect(shareFn).toMatch(/shareWorksheetPdf\(\{/);
    expect(shareFn).toMatch(/fileUri: preview\.uri, worksheet: preview\.worksheet, student/);
    expect(shareFn).not.toMatch(/sharePeriodicReportPdf/);
  });

  it('the previewed worksheet is carried on the preview state, so a REPRINT shares itself', () => {
    expect(card).toMatch(/setPreview\(\{ uri: res\.fileUri, filename: res\.filename, html: res\.html, worksheet \}\)/);
  });

  it('shows teacher-friendly worksheet errors, never a raw native message', () => {
    expect(shareFn).toMatch(/The worksheet could not be shared\./);
    expect(shareFn).not.toMatch(/res\.error/);
    expect(shareFn).not.toMatch(/report/i);
  });

  it('a cancelled share reports nothing at all', () => {
    expect(shareFn).toMatch(/res\.status === 'sharing_unavailable'/);
    expect(shareFn).toMatch(/res\.status === 'failed'/);
    expect(shareFn).not.toMatch(/res\.status !== 'shared'/);
  });

  it('a share failure is caught - the preview never crashes the report screen', () => {
    expect(shareFn).toMatch(/catch \(err\)/);
    expect(shareFn).toMatch(/finally \{\s*setSharing\(false\);/);
  });

  it('sharing changes no worksheet state - it is send-only', () => {
    expect(shareFn).not.toMatch(/apiGenerateWorksheet|apiAssignWorksheet|apiSubmitWorksheet|apiReviewSubmission/);
    for (const field of ['assigned_at', 'submitted_at', 'reviewed_at', 'status:']) {
      expect(shareFn).not.toContain(field);
    }
    expect(shareFn).not.toMatch(/onChanged\(\)/);
  });
});
