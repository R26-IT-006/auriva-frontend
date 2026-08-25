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
    expect(section.indexOf('handleGeneratePdf')).toBeGreaterThan(-1);
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

// A section that renders "0", "Not yet observed" and nothing else is
// indistinguishable from a broken section. Each of the three data-dependent
// cards must say WHY it is empty, on screen and in the PDF alike.
describe('empty sections explain themselves rather than rendering blank values', () => {
  it('the baseline card reports all four shape scores, not just the overall figure', () => {
    for (const label of ['Straight Line Shapes', 'Curved Shapes', 'Complex Shapes', 'Overall Score']) {
      expect(section).toContain(label);
      expect(pdf).toContain(label);
    }
  });

  it('a missing baseline tells the teacher what produces it', () => {
    // The screen wraps the sentence across JSX lines, so match the fragment
    // that survives wrapping; the PDF builds it as one string.
    expect(section).toContain('It appears here once the');
    expect(section).toContain('completes the shape assessment.');
    expect(pdf).toContain('It appears here once the student completes the shape assessment.');
  });

  it('a not-yet-observed pattern reports progress toward the first milestone', () => {
    expect(section).toMatch(/report\?\.letter_motor_development\?\.reference_progress/);
    expect(section).toContain('reference letters needed before a');
    expect(pdf).toContain('reference letters needed before a');
  });

  it('the pending note is suppressed when a pattern exists or was rejected', () => {
    expect(section).toMatch(/!patternState && !patternRejected && referenceProgress/);
    expect(pdf).toMatch(/!asOf && !rejected && refProgress/);
  });

  it('the pending note is omitted entirely rather than fabricated when the server omits the field', () => {
    // `?? null` then a truthiness guard - an older server yields no note,
    // never a "0 of null" string.
    expect(section).toMatch(/reference_progress \?\? null/);
    expect(pdf).toMatch(/reference_progress \?\? null/);
  });

  it('a period with no word practice says so', () => {
    const wanted = 'No word writing was practised during this period.';
    expect(section).toContain(wanted);
    expect(pdf).toContain(wanted);
  });

  it('the word empty note is shown only when nothing was practised', () => {
    expect(section).toMatch(/wordsPractised === 0 &&/);
  });
});

// Phase 3 parity: the printed report and the preview render the SAME html
// string, so anything asserted on `pdf` is by construction what the teacher
// reviews before sharing. These pin the sections the teacher reported as
// blank.
describe('Recommendations / Teacher Notes are present and honest in the PDF', () => {
  it('the section exists under its teacher-facing heading', () => {
    expect(pdf).toContain('Recommendations / Teacher Notes');
  });

  it('states plainly when there is nothing to show, rather than rendering an empty table', () => {
    expect(pdf).toContain('No worksheet recommendations are currently active.');
    expect(pdf).toContain('No teacher review actions were recorded during this period.');
  });

  it('reads recommendations from adaptive_support, the same field the screen uses', () => {
    expect(pdf).toMatch(/report\.adaptive_support/);
    expect(pdf).toMatch(/worksheet_recommendations_current/);
    expect(pdf).toMatch(/teacher_validations_during_period/);
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
