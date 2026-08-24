// Periodic Report redesign — teacher-facing terminology, section order, and
// the data each chart is bound to.
//
// PeriodicReportSection.js imports 'react-native' and cannot be mounted under
// this repo's plain-node jest config, so it is verified by source-text
// assertion — the same technique teacherReportFeature11.test.js uses.

import fs from 'fs';
import path from 'path';

const section = fs.readFileSync(
  path.resolve(__dirname, '../components/handwriting/reports/PeriodicReportSection.js'), 'utf8');
const charts = fs.readFileSync(
  path.resolve(__dirname, '../components/handwriting/reports/ReportCharts.js'), 'utf8');
const pdf = fs.readFileSync(path.resolve(__dirname, './periodicReportPdf.js'), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('teacher-facing labels', () => {
  it.each([
    ['Letter Learning Progress'],
    ['Lowercase Letters Mastered'],
    ['Uppercase Letters Mastered'],
    ['Total Lowercase Letters Mastered'],
    ['Total Uppercase Letters Mastered'],
    ['Current Practice Level'],
    ['Handwriting Performance'],
    ['Practice Attempts'],
    ['Average Motor Performance Score'],
    ['Average Writing Smoothness'],
    ['Initial Handwriting Skills Summary'],
    ['Initial handwriting assessment not yet available.'],
    ['Writing Pattern Summary'],
    ['Current Writing Pattern'],
    ['Pattern Updates'],
    ['Reference Status'],
    ['Word Writing Progress'],
    ['Words Practiced'],
    ['Words Completed'],
    ['Period Summary'],
  ])('renders "%s"', (label) => {
    expect(section).toContain(label);
  });

  it.each([
    ['Lowercase mastered (this period)'],
    ['Uppercase mastered (this period)'],
    ['Cumulative lowercase (as of end date)'],
    ['Cumulative uppercase (as of end date)'],
    ['Current stage'],
    ['Attempts in period'],
    ['Mean motor score'],
    ['Mean smoothness'],
    ['Initial Motor Baseline Summary'],
    ['No initial motor baseline is recorded'],
    ['Letter Motor Patterns'],
    ['Pattern as of end date'],
    ['Milestones during period'],
    ['Words attempted (this period)'],
    ['Words completed (this period)'],
  ])('no longer renders the old label "%s"', (label) => {
    expect(stripComments(section)).not.toContain(label);
  });
});

describe('section order matches the specified visual hierarchy', () => {
  it('cards appear in the required sequence', () => {
    const order = [
      'title="Letter Learning Progress"',
      'title="Handwriting Performance"',
      'title="Motor Performance Over Time"',
      'title="Practice Activity"',
      'title="Initial Handwriting Skills Summary"',
      'title="Writing Pattern Summary"',
      'title="Word Writing Progress"',
      'title="Period Summary"',
    ];
    const indices = order.map((marker) => section.indexOf(marker));
    indices.forEach((i, n) => expect(i).toBeGreaterThan(-1, `missing ${order[n]}`));
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('the period selector comes first and Export & Share PDF stays last', () => {
    expect(section.indexOf('<PeriodSelector')).toBeLessThan(section.indexOf('title="Letter Learning Progress"'));
    expect(section.indexOf('handleExportPdf')).toBeGreaterThan(-1);
    expect(section.lastIndexOf('exportBtn')).toBeGreaterThan(section.indexOf('title="Period Summary"'));
  });
});

describe('charts are bound to real report data', () => {
  it('both charts read motor_performance.daily_series', () => {
    expect(section).toMatch(/report\?\.motor_performance\?\.daily_series \?\? \[\]/);
    expect(section).toMatch(/<MotorTrendChart points=\{dailySeries\}/);
    expect(section).toMatch(/<PracticeActivityChart points=\{dailySeries\}/);
  });

  it('progress bars use the backend-supplied totals, never a hardcoded 26', () => {
    expect(section).toMatch(/total=\{report\.learning_progress\.lowercase_total\}/);
    expect(section).toMatch(/total=\{report\.learning_progress\.uppercase_total\}/);
    expect(stripComments(section)).not.toMatch(/\b26\b/);
  });

  it('charts show an explicit empty state instead of a degenerate plot', () => {
    expect(charts).toContain('Not enough session data to show a trend yet.');
    expect(charts).toContain('No practice attempts were recorded in this period.');
    expect(charts).toMatch(/usable\.length < 2/);
  });

  it('the trend chart pins its Y axis to 0-100 rather than auto-scaling', () => {
    expect(charts).toMatch(/SCORE_MIN = 0/);
    expect(charts).toMatch(/SCORE_MAX = 100/);
  });

  it('no smoothing, gradient or animation is used', () => {
    const code = stripComments(charts);
    expect(code).not.toMatch(/curve|bezier|smooth|interpolat/i);
    expect(code).not.toMatch(/LinearGradient|RadialGradient|<Defs/i);
    expect(code).not.toMatch(/Animated|withTiming|useSharedValue/);
  });

  it('charts size to the card, so the section works in portrait and landscape', () => {
    expect(section).toMatch(/onLayout=\{handleChartLayout\}/);
    expect(section).toMatch(/width=\{chartWidth\}/);
  });
});

describe('Writing Pattern Summary is descriptive only', () => {
  it('is never rendered as a chart, gauge, bar, percentage or score', () => {
    const card = section.slice(
      section.indexOf('title="Writing Pattern Summary"'),
      section.indexOf('title="Word Writing Progress"'),
    );
    expect(card).not.toMatch(/Chart|ProgressBarRow|gauge|%|score/i);
  });

  it('carries the required non-clinical caption', () => {
    expect(section).toContain('LETTER_MOTOR_PATTERN_CAPTION');
  });

  it('supports all three pattern states without forcing A/B', () => {
    expect(section).toContain("'Not yet observed'");
    expect(section).toContain("'Not reported'");
    expect(section).toContain("'Within represented reference range'");
    expect(section).toContain("'Outside represented reference range'");
    // A/B must come from the shared mapping, never be hardcoded here.
    expect(section).toMatch(/getLetterMotorPatternLabel\(patternState\.state_code\)/);
    expect(stripComments(section)).not.toMatch(/'Pattern A'|'Pattern B'/);
  });
});

describe('word completion percentage', () => {
  it('is computed from existing report values only, and skipped when nothing was practised', () => {
    expect(section).toMatch(/wordsPractised > 0/);
    expect(section).toMatch(/Math\.round\(\(wordsCompleted \/ wordsPractised\) \* 100\)/);
    expect(section).toMatch(/wordCompletionPct != null &&/);
  });
});

describe('PDF export mirrors the on-screen terminology', () => {
  it.each([
    ['Letter Learning Progress'],
    ['Handwriting Performance'],
    ['Motor Performance Over Time'],
    ['Initial Handwriting Skills Summary'],
    ['Writing Pattern Summary'],
    ['Word Writing Progress'],
    ['Practice Attempts'],
    ['Average Motor Performance Score'],
    ['Average Writing Smoothness'],
    ['Words Practiced'],
    ['Words Completed'],
    ['Reference Status'],
  ])('the PDF contains "%s"', (label) => {
    expect(pdf).toContain(label);
  });

  it('the PDF renders an inline SVG trend chart with the same empty state', () => {
    expect(pdf).toMatch(/function buildMotorTrendSvg/);
    expect(pdf).toContain('Not enough session data to show a trend yet.');
    expect(pdf).toMatch(/<polyline/);
  });

  it('the PDF pattern section is a table, never a chart', () => {
    const fn = pdf.slice(pdf.indexOf('function buildWritingPatternHtml'), pdf.indexOf('function buildWordWritingHtml'));
    expect(fn).toMatch(/table\(\[/);
    expect(fn).not.toMatch(/<svg|polyline|rect /i);
  });
});
