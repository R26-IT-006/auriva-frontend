import { buildReportHtml, sanitizeForFilename, buildReportFilename, exportAndSharePeriodicReportPdf } from './periodicReportPdf';

const SAMPLE_REPORT = {
  metadata: {
    student_name: 'Jane Doe', student_code: 'STU-42', teacher_name: 'Mr. Smith',
    period: { start_date: '2026-01-01', end_date: '2026-06-30' },
    generated_at: '2026-08-20T10:00:00.000Z',
  },
  learning_progress: {
    lowercase_mastered_during_period: 5, uppercase_mastered_during_period: 2,
    cumulative_lowercase_mastered_by_end_date: 18, cumulative_uppercase_mastered_by_end_date: 4,
    current_progression_stage: 'Uppercase Letters',
  },
  motor_performance: {
    attempts_in_period: 42, mean_motor_score: 78, median_motor_score: 80,
    mean_smoothness_score: 74, mean_trajectory_dtw_distance: 1.23, mean_speed_cv: 0.31, mean_duration_ms: 4200,
  },
  adaptive_support: {
    persistent_difficulty_current_status: { persistentCount: 1 },
    worksheet_recommendations_current: [{ case_type: 'lowercase', family: 'curved', title: 'Curved Movement Practice', rationale: 'x' }],
    teacher_validations_during_period: [{ case_type: 'lowercase', family: 'curved', title: 'Curved Movement Practice', decision: 'confirmed', note: null, at: '2026-03-01T00:00:00.000Z' }],
  },
  initial_shape_motor_profile: {
    available: true, is_baseline_context_predating_period: true, recorded_at: '2025-01-01T00:00:00.000Z',
    scores: { straight: 70, curved: 60, complex: 50, overall: 65 },
  },
  letter_motor_development: {
    milestones_during_period: [{ milestone: '14/20', state_code: 'LETTER_STATE_A', display_name: 'Letter Motor State A', coverage: 14, observed_at: '2026-03-01T00:00:00.000Z' }],
    state_as_of_end_date: { milestone: '14/20', state_code: 'LETTER_STATE_A', display_name: 'Letter Motor State A', coverage: 14, observed_at: '2026-03-01T00:00:00.000Z' },
  },
  word_writing: {
    words_attempted_during_period: 10, attempts_during_period: 25, words_completed_during_period: 6, mean_word_score: 72,
    size_spacing_feedback_note: 'Per-attempt size/spacing feedback is not persisted historically and is not included in this report.',
  },
  has_activity_in_period: true,
  summary_text: 'The student mastered 7 new letters during this period.',
};

describe('buildReportHtml — pure content (spec §16/§17/§19)', () => {
  const html = buildReportHtml(SAMPLE_REPORT);

  it('is a complete, self-contained HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the title, student, teacher, period, and generated date', () => {
    expect(html).toContain('AURIVA');
    expect(html).toContain('Handwriting Progress Report');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Mr. Smith');
    expect(html).toContain('2026-01-01 to 2026-06-30');
  });

  it('includes all required sections, in the teacher-facing order', () => {
    const idx = (needle) => html.indexOf(needle);
    const order = [
      '1. Letter Learning Progress',
      '2. Handwriting Performance',
      '3. Motor Performance Over Time',
      '4. Initial Handwriting Skills Summary',
      '5. Writing Pattern Summary',
      '6. Word Writing Progress',
      '7. Recommendations',
    ];
    order.forEach((heading) => expect(idx(heading)).toBeGreaterThan(-1));
    for (let i = 1; i < order.length; i += 1) {
      expect(idx(order[i])).toBeGreaterThan(idx(order[i - 1]));
    }
  });

  it('uses teacher-friendly terminology, not the old internal labels', () => {
    for (const legacy of [
      'Initial Motor Baseline Summary', 'Letter Motor Patterns',
      'Attempts in period', 'Mean motor score', 'Mean smoothness score',
      'Words attempted during period', 'Current progression stage',
    ]) {
      expect(html).not.toContain(legacy);
    }
    for (const wanted of [
      'Practice Attempts', 'Average Motor Performance Score',
      'Average Writing Smoothness', 'Words Practiced', 'Words Completed',
      'Current Practice Level', 'Current Writing Pattern', 'Reference Status',
    ]) {
      expect(html).toContain(wanted);
    }
  });

  it('never dumps raw API JSON', () => {
    expect(html).not.toMatch(/JSON\.stringify/);
    expect(html).not.toContain('"metadata":');
    expect(html).not.toContain('{"student_name"');
  });

  it('never includes an internal database id (student_id/sid) anywhere', () => {
    expect(html).not.toMatch(/\bsid\b/i);
    expect(html).not.toMatch(/student_id/i);
  });

  it('never includes raw stroke points or model-debug metadata', () => {
    expect(html).not.toMatch(/stroke_points|centroid|cluster_id|nearest_distance|dtw_debug/i);
  });

  it('flags the Initial Motor Baseline Summary as baseline context, not period-computed', () => {
    expect(html).toMatch(/baseline\/initial context/i);
    expect(html).toMatch(/may predate the selected reporting period/i);
  });

  it('never uses improvement/decline language for the letter motor pattern', () => {
    expect(html).not.toMatch(/\bimproved\b|\bworsened\b|\bdeclined\b/i);
    expect(html).toContain('Letter Motor Pattern A');
    expect(html).not.toContain('Letter Motor State A');
  });

  it('escapes HTML-significant characters in free-text fields (teacher note / student name)', () => {
    const withHtmlInName = { ...SAMPLE_REPORT, metadata: { ...SAMPLE_REPORT.metadata, student_name: '<script>alert(1)</script>' } };
    const escaped = buildReportHtml(withHtmlInName);
    expect(escaped).not.toContain('<script>alert(1)</script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('renders a valid document even for an empty/no-activity period report', () => {
    const empty = {
      metadata: { student_name: 'Empty Case', teacher_name: 'T', period: { start_date: '2026-01-01', end_date: '2026-01-07' }, generated_at: '2026-01-08T00:00:00.000Z' },
      learning_progress: { lowercase_mastered_during_period: 0, uppercase_mastered_during_period: 0, cumulative_lowercase_mastered_by_end_date: 0, cumulative_uppercase_mastered_by_end_date: 0, current_progression_stage: 'Lowercase Letters' },
      motor_performance: { attempts_in_period: 0, mean_motor_score: null, median_motor_score: null, mean_smoothness_score: null, mean_trajectory_dtw_distance: null, mean_speed_cv: null, mean_duration_ms: null },
      adaptive_support: { persistent_difficulty_current_status: null, worksheet_recommendations_current: [], teacher_validations_during_period: [] },
      initial_shape_motor_profile: { available: false, note: 'No initial motor baseline is recorded for this student.' },
      letter_motor_development: { milestones_during_period: [], state_as_of_end_date: null },
      word_writing: { words_attempted_during_period: 0, attempts_during_period: 0, words_completed_during_period: 0, mean_word_score: null, size_spacing_feedback_note: 'note' },
      has_activity_in_period: false,
      summary_text: 'No handwriting activity was recorded during this period.',
    };
    expect(() => buildReportHtml(empty)).not.toThrow();
    expect(buildReportHtml(empty)).toContain('No handwriting activity was recorded during this period.');
  });
});

describe('sanitizeForFilename (spec §20 — no path traversal)', () => {
  it('strips path-traversal and special characters', () => {
    expect(sanitizeForFilename('../../etc/passwd')).not.toContain('/');
    expect(sanitizeForFilename('../../etc/passwd')).not.toContain('..');
  });
  it('collapses spaces to underscores', () => {
    expect(sanitizeForFilename('Jane Doe')).toBe('Jane_Doe');
  });
  it('falls back to "Student" for empty/garbage input', () => {
    expect(sanitizeForFilename('')).toBe('Student');
    expect(sanitizeForFilename('!!!///')).toBe('Student');
    expect(sanitizeForFilename(null)).toBe('Student');
  });
  it('bounds the length', () => {
    expect(sanitizeForFilename('a'.repeat(500)).length).toBeLessThanOrEqual(60);
  });
});

describe('buildReportFilename', () => {
  it('follows the documented predictable naming convention', () => {
    expect(buildReportFilename({ studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' }))
      .toBe('Auriva_Handwriting_Report_Jane_Doe_2026-01-01_2026-06-30.pdf');
  });
});

describe('exportAndSharePeriodicReportPdf — export/share safety (spec §21/§22)', () => {
  const originalRequire = module.require;
  let mockPrintToFileAsync, mockCopy, mockDelete, mockIsAvailableAsync, mockShareAsync;
  let targetExists;

  beforeEach(() => {
    jest.resetModules();
    mockPrintToFileAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/random123.pdf' });
    mockCopy = jest.fn();
    mockDelete = jest.fn();
    targetExists = false;
    mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
    mockShareAsync = jest.fn().mockResolvedValue(undefined);

    jest.doMock('expo-print', () => ({ printToFileAsync: (...a) => mockPrintToFileAsync(...a) }), { virtual: true });
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: (...a) => mockIsAvailableAsync(...a),
      shareAsync: (...a) => mockShareAsync(...a),
    }), { virtual: true });
    // Mirrors the REAL expo-file-system v19 (SDK 54) surface: the File/Paths
    // classes, NOT the removed cacheDirectory/copyAsync pair. The previous
    // mock described an API the installed package no longer exports, so this
    // suite passed while the feature was broken on device — the mock must
    // track the dependency, not the code's assumptions about it.
    class MockFile {
      constructor(...parts) {
        this.uri = parts
          .map((p) => (typeof p === 'string' ? p : p.uri))
          .join('');
      }
      get exists() { return this.uri.endsWith('.pdf') && targetExists; }
      delete(...a) { mockDelete(this.uri, ...a); }
      copy(dest) { mockCopy(this.uri, dest.uri); }
    }
    jest.doMock('expo-file-system', () => ({
      File: MockFile,
      Paths: { cache: { uri: 'file:///cache/' } },
    }), { virtual: true });
  });

  function freshModule() {
    return require('./periodicReportPdf');
  }

  it('a successful export copies to the predictable filename and shares it', async () => {
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    const result = await run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' });
    expect(result.status).toBe('shared');
    expect(mockCopy).toHaveBeenCalledWith(
      'file:///cache/random123.pdf',
      'file:///cache/Auriva_Handwriting_Report_Jane_Doe_2026-01-01_2026-06-30.pdf',
    );
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/Auriva_Handwriting_Report_Jane_Doe_2026-01-01_2026-06-30.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
  });

  it('re-exporting the same report clears the stale file first (File.copy throws on an existing destination)', async () => {
    // The removed copyAsync overwrote silently; File.copy() does not. Exporting
    // the same student+range twice in one session is normal, so a stale copy
    // must be deleted rather than surfacing as "Could not generate the PDF".
    targetExists = true;
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    const result = await run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' });

    expect(result.status).toBe('shared');
    expect(mockDelete).toHaveBeenCalledWith(
      'file:///cache/Auriva_Handwriting_Report_Jane_Doe_2026-01-01_2026-06-30.pdf',
    );
    expect(mockCopy).toHaveBeenCalled();
  });

  it('does not delete anything when no stale file exists', async () => {
    targetExists = false;
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    const result = await run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' });

    expect(result.status).toBe('shared');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('uses the supported File/Paths API, never the removed cacheDirectory/copyAsync pair', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.resolve(__dirname, './periodicReportPdf.js'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/FileSystem\.cacheDirectory|FileSystem\.copyAsync|copyAsync\(/);
    expect(code).not.toMatch(/expo-file-system\/legacy/); // deprecated entry, slated for removal
    expect(code).toMatch(/require\('expo-file-system'\)/);
    expect(code).toMatch(/Paths\.cache/);
  });

  it('sharing unavailable is reported distinctly, never as a crash or a fake success', async () => {
    mockIsAvailableAsync.mockResolvedValueOnce(false);
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    const result = await run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' });
    expect(result.status).toBe('sharing_unavailable');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('a user-cancelled share is reported as "cancelled", never as a failure', async () => {
    mockShareAsync.mockRejectedValueOnce(new Error('User cancelled the share sheet'));
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    const result = await run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' });
    expect(result.status).toBe('cancelled');
  });

  it('a genuine PDF-generation failure resolves safely (never throws) with status "failed"', async () => {
    mockPrintToFileAsync.mockRejectedValueOnce(new Error('rendering engine crashed'));
    const { exportAndSharePeriodicReportPdf: run } = freshModule();
    await expect(run({ report: SAMPLE_REPORT, studentName: 'Jane Doe', startDate: '2026-01-01', endDate: '2026-06-30' }))
      .resolves.toMatchObject({ status: 'failed' });
  });
});
