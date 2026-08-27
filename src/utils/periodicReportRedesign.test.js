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
    // Comments are stripped: the card's own comments explain WHY a chart is
    // never used (Pattern A/B are nominal, so plotting them would imply an
    // ordering). What matters is that nothing chart-like is RENDERED.
    expect(stripComments(card)).not.toMatch(/Chart|ProgressBarRow|gauge|%|score/i);
  });

  it('carries the required non-clinical caption', () => {
    expect(section).toContain('LETTER_MOTOR_PATTERN_CAPTION');
  });

  // S2 — the four states, and every visible string for them, now live in the
  // shared letterMotorPatternLabels module so the screen, the PDF and the
  // dashboard card cannot drift apart. The section resolves them through
  // getLetterMotorPresentation() rather than restating any of them.
  it('supports all four evaluation states without forcing A/B', () => {
    const labels = fs.readFileSync(path.resolve(__dirname, './letterMotorPatternLabels.js'), 'utf8');
    expect(labels).toContain("'Not yet observed'");
    expect(labels).toContain("'Not reported'");
    expect(labels).toContain("'Unavailable'");
    expect(labels).toContain("'Within represented reference range'");
    expect(labels).toContain("'Outside represented reference range'");
    // A/B must come from the shared mapping, never be hardcoded anywhere.
    expect(labels).toMatch(/getLetterMotorPatternLabel\(stateCode\)/);
    for (const source of [section, pdf, labels]) {
      expect(stripComments(source)).not.toMatch(/'Pattern A'|'Pattern B'/);
    }
  });

  it('screen and PDF both resolve their wording through the shared presentation helper', () => {
    expect(stripComments(section)).toMatch(/getLetterMotorPresentation\(evaluationStatus/);
    expect(stripComments(pdf)).toMatch(/getLetterMotorPresentation\(evaluationStatus/);
  });

  it('screen and PDF branch on the server-provided evaluation_status, never on a missing pattern', () => {
    for (const source of [section, pdf]) {
      expect(stripComments(source)).toMatch(/evaluation_status/);
    }
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
    // S2 — the sentence itself is built once, in the shared module.
    const labels = fs.readFileSync(path.resolve(__dirname, './letterMotorPatternLabels.js'), 'utf8');
    expect(labels).toContain('required reference letters.');
    for (const source of [section, pdf]) {
      expect(stripComments(source)).toMatch(/buildReferenceProgressText\(/);
    }
  });

  it('the pending note is shown ONLY while no milestone has been evaluated', () => {
    // After a reference-range rejection the evidence is complete, so an
    // "N of 14" line would misdescribe why no pattern appears.
    expect(stripComments(section)).toMatch(/evaluationStatus === 'not_reached'/);
    expect(stripComments(pdf)).toMatch(/evaluationStatus === 'not_reached'/);
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

// ─── S3 — screen/PDF parity ───────────────────────────────────────────────
// Both surfaces are built from the SAME report payload. Before this, the
// on-screen periodic report rendered neither the current worksheet
// recommendations nor the teacher review actions, so a teacher reading the
// report on screen and then exporting it got materially different documents.
describe('S3 — Adaptive Practice Recommendation reaches the screen, not only the PDF', () => {
  it('the screen renders the section under its teacher-facing heading', () => {
    expect(section).toContain('Adaptive Practice Recommendation');
  });

  it('the screen renders Recommendations / Teacher Notes too', () => {
    expect(section).toContain('Recommendations / Teacher Notes');
  });

  it('the screen reads the SAME report fields the PDF does — never a second source', () => {
    for (const source of [section, pdf]) {
      expect(source).toMatch(/adaptive_support/);
      expect(source).toMatch(/worksheet_recommendations_current/);
      expect(source).toMatch(/teacher_validations_during_period/);
    }
  });

  it('screen and PDF use the identical empty-state sentences', () => {
    for (const wanted of [
      'No worksheet recommendations are currently active.',
      'No teacher review actions were recorded during this period.',
    ]) {
      expect(section).toContain(wanted);
      expect(pdf).toContain(wanted);
    }
  });

  it('the screen never fabricates a list when the server omits adaptive_support', () => {
    expect(section).toMatch(/adaptive_support \?\? null/);
    expect(section).toMatch(/worksheet_recommendations_current \?\? \[\]/);
    expect(section).toMatch(/teacher_validations_during_period \?\? \[\]/);
  });
});

describe('S3 — the baseline summary narrative reaches all three surfaces', () => {
  it('screen and PDF both render the server-built summary description', () => {
    expect(section).toMatch(/baselineSummary\?\.description/);
    expect(pdf).toMatch(/summary\?\.description/);
  });

  it('screen and PDF both render its disclosure', () => {
    expect(section).toMatch(/baselineSummary\?\.disclosure/);
    expect(pdf).toMatch(/summary\?\.disclosure/);
  });

  it('both omit it entirely on an older server rather than fabricating one', () => {
    expect(section).toMatch(/initial_shape_motor_profile\?\.summary \?\? null/);
    expect(pdf).toMatch(/profile\.summary \?\? null/);
  });

  it('neither surface recomputes the narrative — it is read, never derived', () => {
    for (const source of [stripComments(section), stripComments(pdf)]) {
      expect(source).not.toMatch(/buildInitialMotorBaselineSummary/);
    }
  });
});

// ─── C2 — the "N of the 14" sentence ──────────────────────────────────────
describe('C2 — reference progress names a specific required set', () => {
  const labels = fs.readFileSync(path.resolve(__dirname, './letterMotorPatternLabels.js'), 'utf8');

  it('the sentence says the reference letters are REQUIRED, not any N of 20', () => {
    expect(labels).toContain('required reference letters.');
  });

  it('it reads evidence_letters, the milestone-scoped count', () => {
    expect(labels).toMatch(/evidence_letters: recorded/);
    expect(labels).toMatch(/first_milestone_required: required/);
  });

  it('it never prints the all-20 total in that sentence', () => {
    expect(labels).not.toMatch(/total_reference_evidence_letters/);
    expect(labels).not.toMatch(/reference_letter_total/);
  });

  it('it is omitted rather than fabricated when the server sends no figures', () => {
    expect(labels).toMatch(/if \(!referenceProgress\) return null;/);
    expect(labels).toMatch(/typeof recorded !== 'number' \|\| typeof required !== 'number'/);
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

// ═══════════════════════════════════════════════════════════════════════════
// S2 — the four evaluation states, and screen/PDF semantic parity
// ═══════════════════════════════════════════════════════════════════════════

describe('S2 — teacher-facing wording for the four evaluation states', () => {
  const {
    getLetterMotorPresentation, buildReferenceProgressText,
  } = require('./letterMotorPatternLabels');

  it('not_reached', () => {
    const p = getLetterMotorPresentation('not_reached');
    expect(p.patternValue).toBe('Not yet observed');
    expect(p.referenceStatus).toBe('Not yet observed');
    expect(p.supportingText).toBe(
      'More eligible handwriting evidence is needed before a writing pattern can be described.'
    );
  });

  it('assigned — Pattern A', () => {
    const p = getLetterMotorPresentation('assigned', { stateCode: 'LETTER_STATE_A' });
    expect(p.patternValue).toBe('Letter Motor Pattern A');
    expect(p.referenceStatus).toBe('Within represented reference range');
    expect(p.supportingText).toMatch(/do not indicate ability, ASD severity, or improvement/);
  });

  it('assigned — Pattern B', () => {
    const p = getLetterMotorPresentation('assigned', { stateCode: 'LETTER_STATE_B' });
    expect(p.patternValue).toBe('Letter Motor Pattern B');
    expect(p.referenceStatus).toBe('Within represented reference range');
  });

  it('outside_reference_range', () => {
    const p = getLetterMotorPresentation('outside_reference_range');
    expect(p.patternValue).toBe('Not reported');
    expect(p.referenceStatus).toBe('Outside represented reference range');
    expect(p.supportingText).toBe(
      'The available handwriting evidence differs from the data represented by the current '
      + 'pattern model, so no writing pattern was assigned.'
    );
  });

  it('unavailable', () => {
    const p = getLetterMotorPresentation('unavailable');
    expect(p.patternValue).toBe('Unavailable');
    expect(p.supportingText).toBe('Writing pattern information could not be evaluated at this time.');
  });

  it('an unrecognized status degrades to not_reached, never to a pattern', () => {
    const p = getLetterMotorPresentation('something_new');
    expect(p.patternValue).toBe('Not yet observed');
  });

  it('no state ever produces a third pattern or banned vocabulary', () => {
    for (const status of ['not_reached', 'assigned', 'outside_reference_range', 'unavailable']) {
      const text = JSON.stringify(getLetterMotorPresentation(status));
      expect(text).not.toMatch(/Pattern C/i);
      expect(text).not.toMatch(/abnormal|severe|poor|failed|deficient|high difficulty/i);
    }
  });

  it('the progress sentence is built only from real server figures', () => {
    expect(buildReferenceProgressText({ evidence_letters: 4, first_milestone_required: 14 }))
      .toBe('Recorded from 4 of the 14 required reference letters.');
    expect(buildReferenceProgressText(null)).toBeNull();
    expect(buildReferenceProgressText({})).toBeNull();
    expect(buildReferenceProgressText({ evidence_letters: 4 })).toBeNull();
  });
});

describe('S2 — screen and PDF are semantically identical', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');

  it('all three surfaces import their wording from the shared module', () => {
    for (const source of [section, pdf]) {
      expect(source).toMatch(/letterMotorPatternLabels/);
      expect(stripComments(source)).toMatch(/getLetterMotorPresentation/);
    }
    // The screen renders the same approved sentences.
    expect(screen).toContain('More eligible handwriting evidence is needed before a writing pattern can be described.');
    expect(screen).toMatch(/differs from the data represented by the/);
    expect(screen).toContain('Writing pattern information could not be evaluated at this time.');
  });

  it('no surface uses banned vocabulary anywhere', () => {
    for (const source of [section, pdf, screen]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/\babnormal\b|\bdeficient\b|\bsevere\b/i);
      expect(code).not.toMatch(/Pattern C/i);
    }
  });

  it('no surface exposes a raw error or stack trace to a teacher', () => {
    for (const source of [section, pdf, screen]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/err\.stack|error\.stack/);
    }
  });

  it('the screen no longer infers rejection from evidence coverage', () => {
    expect(stripComments(screen)).not.toMatch(/fullCoverageWithoutPattern/);
    expect(stripComments(screen)).toMatch(/resolveLetterMotorEvaluationStatus\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Writing Check — teacher surfaces (screen / periodic section / PDF)
// ═══════════════════════════════════════════════════════════════════════════

describe('Writing Check UI', () => {
  const { getWritingCheckPresentation } = require('./letterMotorPatternLabels');
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../screens/handwriting/reports/TeacherReportScreen.js'), 'utf8');

  it('2/3. an assigned check renders Pattern A / Pattern B', () => {
    expect(getWritingCheckPresentation({ evaluation_status: 'assigned', state_code: 'LETTER_STATE_A' }))
      .toEqual({ patternValue: 'Letter Motor Pattern A', referenceStatus: 'Within represented reference range' });
    expect(getWritingCheckPresentation({ evaluation_status: 'assigned', state_code: 'LETTER_STATE_B' }).patternValue)
      .toBe('Letter Motor Pattern B');
  });

  it('4. an OOD check renders Not reported / Outside represented reference range', () => {
    expect(getWritingCheckPresentation({ evaluation_status: 'outside_reference_range', state_code: null }))
      .toEqual({ patternValue: 'Not reported', referenceStatus: 'Outside represented reference range' });
  });

  it('5/6. an unknown or in-progress check never reads as a completed result', () => {
    expect(getWritingCheckPresentation({ status: 'in_progress', evaluation_status: null }).patternValue)
      .toBe('Not finished');
    expect(getWritingCheckPresentation(null).patternValue).toBe('Not reported');
    expect(getWritingCheckPresentation({}).patternValue).toBe('Not reported');
  });

  it('6. only EVALUATED checks reach the history list', () => {
    expect(stripComments(screen)).toMatch(/checks\.filter\(\(c\) => c\.status === 'evaluated'\)/);
  });

  it('8. no improvement/decline wording on any Writing Check surface', () => {
    for (const source of [screen, section, pdf]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/improved|declin|worse|better than|progress(ed|ion) to/i);
      expect(code).not.toMatch(/→|->\s*Pattern/);
    }
  });

  it('no Writing Check surface renders a chart for Pattern A/B', () => {
    const card = screen.slice(screen.indexOf('function WritingCheckHistoryCard'),
                              screen.indexOf('const wc = StyleSheet.create'));
    expect(stripComments(card)).not.toMatch(/Chart|LineChart|BarChart|ProgressBar/i);
  });

  it('19. no cluster id, model version or OOD diagnostics are rendered', () => {
    const card = screen.slice(screen.indexOf('function WritingCheckHistoryCard'),
                              screen.indexOf('const wc = StyleSheet.create'));
    for (const source of [stripComments(card), stripComments(section)]) {
      expect(source).not.toMatch(/cluster_id|model_version|ood_reason|separation_margin|nearest_distance/);
    }
  });

  it('15. all three surfaces use the SAME presentation helper', () => {
    for (const source of [screen, section, pdf]) {
      expect(stripComments(source)).toMatch(/getWritingCheckPresentation/);
    }
  });

  it('7. empty states are explicit and distinct on screen and in the PDF', () => {
    for (const source of [screen, section, pdf]) {
      expect(source).toContain('Not yet available');
    }
    for (const source of [section, pdf]) {
      expect(source).toContain('No Writing Checks were completed during this period.');
    }
    expect(screen).toContain('A Writing Check has not yet been completed.');
    expect(section).toContain('A Writing Check has not yet been completed.');
  });

  it('"no check this period" is never conflated with "not yet observed"', () => {
    expect(section).toContain('No Writing Checks were completed during this period.');
    expect(section).toContain('Not yet observed');
    expect(stripComments(section)).toMatch(/writingChecksDuringPeriod\.length > 0/);
  });

  it('16/17. Start becomes Resume when a check is already in progress', () => {
    const code = stripComments(screen);
    expect(code).toMatch(/inProgress \? 'Resume Writing Check' : 'Start Writing Check'/);
    expect(code).toMatch(/checks\.find\(\(c\) => c\.status === 'in_progress'\)/);
  });

  it('16. Start Writing Check goes through the existing parent gate', () => {
    const code = stripComments(screen);
    // The gate is what this test protects; the destination is now resolved by
    // navigateToWritingCheck because this report is mounted in two navigators
    // and only one owns the WritingCheck screen.
    expect(code).toMatch(/useGatedBack\([\s\S]{0,400}?navigateToWritingCheck\(navigation/);
    expect(code).toMatch(/onPress=\{requestStartCheck\}/);
  });

  it('18. history refetches on FOCUS, not only on mount', () => {
    const code = stripComments(screen);
    expect(code).toMatch(/useFocusEffect/);
    expect(code).toMatch(/fetchWritingCheckHistory\(student\?\.sid\)/);
    expect(code).toMatch(/setWritingChecks\(checks\)/);
  });

  it('the child-facing screen exposes no model terminology', () => {
    const child = fs.readFileSync(
      path.resolve(__dirname, '../screens/handwriting/WritingCheckScreen.js'), 'utf8');
    const code = stripComments(child);
    for (const banned of [
      'Pattern A', 'Pattern B', 'cluster', 'K-Means', 'OOD',
      'reference range', 'outside_reference_range', 'model',
    ]) {
      expect(code.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
