// Handwriting Progress Report — Phase 3: new report UI.
//
// Letter mastery split by case, a provable-fields-only letter detail sheet,
// the merged Word Practice section, and the four-across Learning Progress row.
// Phases 1 and 2 have their own suites; this one also re-asserts that neither
// regressed.

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const report = stripComments(read('../screens/handwriting/reports/TeacherReportScreen.js'));

/** One function's body, brace-matched, skipping the parameter list. */
function fnBody(source, marker) {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  let i = source.indexOf('(', start);
  let paren = 0;
  for (; i < source.length; i++) {
    if (source[i] === '(') paren += 1;
    else if (source[i] === ')') { paren -= 1; if (paren === 0) { i += 1; break; } }
  }
  i = source.indexOf('{', i);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

// ─── 1 / 12. Letter mastery split ───────────────────────────────────────

describe('letter mastery is split by case', () => {
  it('both subsections exist', () => {
    expect(report).toMatch(/title="Lowercase Letters"/);
    expect(report).toMatch(/title="Uppercase Letters"/);
  });

  it('each grid is driven by a 26-letter alphabet', () => {
    expect(report).toMatch(/const LOWERCASE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'\.split\(''\)/);
    expect(report).toMatch(/const UPPERCASE_ALPHABET = LOWERCASE_ALPHABET\.map\(\(c\) => c\.toUpperCase\(\)\)/);
    expect('abcdefghijklmnopqrstuvwxyz'.split('')).toHaveLength(26);
  });

  it('the header count is out of the alphabet length, not a hardcoded number', () => {
    expect(report).toMatch(/\{mastered\} \/ \{alphabet\.length\} mastered/);
  });

  it('the count reflects the SAME status the tiles show — one source, no drift', () => {
    const body = fnBody(report, 'function LetterCaseGrid(');
    expect(body).toMatch(/practised\.filter\(\(l\) => l\.status === 'Mastered'\)\.length/);
  });

  it('SENTINEL — tiles no longer uppercase every letter', () => {
    // The old grid called .toUpperCase() on each tile, so 'c' and 'C' were
    // indistinguishable. The stored letter is now rendered verbatim.
    const body = fnBody(report, 'function LetterCaseGrid(');
    expect(body).toMatch(/\{l\.letter\}/);
    expect(body).not.toMatch(/l\.letter\.toUpperCase\(\)/);
  });

  it('an unpractised form renders a neutral placeholder, never a fabricated score', () => {
    const body = fnBody(report, 'function LetterCaseGrid(');
    expect(body).toMatch(/if \(!l\) \{/);
    expect(body).toMatch(/lg\.chipEmpty/);
    expect(body).toMatch(/—/);
  });

  it('the alphabet stays complete, so the grid never misaligns', () => {
    const body = fnBody(report, 'function LetterCaseGrid(');
    // Maps over the ALPHABET (always 26), not over practised letters only.
    expect(body).toMatch(/\{alphabet\.map\(\(ch\) => \{/);
  });

  it('the status legend is preserved', () => {
    expect(report).toMatch(/\$\{mastered\} Mastered/);
    expect(report).toMatch(/\$\{progressing\} Progressing/);
    expect(report).toMatch(/\$\{needs\} Needs Practice/);
  });

  it('SENTINEL — the mastery/accuracy calculation itself is untouched', () => {
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/accuracy >= 80 \? 'Mastered' : accuracy >= 60 \? 'Progressing' : 'Needs Practice'/);
  });

  it('tiles are a fixed size, so neither grid clips or reflows oddly', () => {
    expect(report).toMatch(/chip: \{[\s\S]{0,120}?width: 52, height: 56/);
    expect(report).toMatch(/grid:\s+\{ flexDirection: 'row', flexWrap: 'wrap'/);
  });
});

// ─── 2 / 3 / 4 / 13. Letter detail ──────────────────────────────────────

describe('letter detail sheet', () => {
  const body = () => fnBody(report, 'function LetterDetailSheet(');

  it('tiles are tappable and open it', () => {
    const grid = fnBody(report, 'function LetterCaseGrid(');
    expect(grid).toMatch(/<TouchableOpacity/);
    expect(grid).toMatch(/onPress=\{\(\) => onSelect\(l\)\}/);
    expect(report).toMatch(/<LetterDetailSheet letter=\{letterDetail\} onClose=/);
  });

  it('renders ONLY provable fields', () => {
    const b = body();
    expect(b).toMatch(/label="Letter"/);
    expect(b).toMatch(/label="Status"/);
    expect(b).toMatch(/label="Score"/);
    expect(b).toMatch(/label="Practice attempts"/);
  });

  it('SENTINEL — never invents cycle or attempt attribution', () => {
    const b = body();
    expect(b).not.toMatch(/Cycle/i);
    expect(b).not.toMatch(/Attempt \d|attempt_number|Mastered on Attempt/);
    expect(b).not.toMatch(/session_key|sessionKey/);
  });

  it('labels evidence neutrally where policy provenance is unknown', () => {
    expect(body()).toMatch(/Recorded practice evidence/);
  });

  it('a value that is not provable omits its row rather than showing a blank', () => {
    const row = fnBody(report, 'function DetailRow(');
    expect(row).toMatch(/if \(value === null \|\| value === undefined \|\| value === ''\) return null;/);
  });

  it('a non-finite score is not rendered as NaN', () => {
    expect(body()).toMatch(/Number\.isFinite\(letter\.accuracy\) \? `\$\{letter\.accuracy\}%` : null/);
  });

  it('shows a neutral empty state instead of a fabricated drawing', () => {
    expect(body()).toMatch(/No writing evidence available yet\./);
    expect(body()).not.toMatch(/require\(|\.png|\.jpg/);
  });

  it('exposes no technical internals', () => {
    const b = body();
    for (const banned of [/score_version/, /source_type/, /capture_status/,
                          /retry_session_key/, /cluster/i, /mappingConfidence/,
                          /threshold source/i]) {
      expect(b).not.toMatch(banned);
    }
  });

  it('fits a tablet: bounded height, internal scroll, clear close', () => {
    expect(report).toMatch(/maxHeight: '80%'/);
    expect(body()).toMatch(/<ScrollView style=\{ld\.body\}/);
    expect(body()).toMatch(/accessibilityLabel="Close letter details"/);
  });

  it('does not change orientation', () => {
    expect(body()).not.toMatch(/lockAsync|useLockLandscape|OrientationLock/);
  });
});

// ─── 5 / 6 / 8 / 14 / 15. Word Practice merge ───────────────────────────

describe('Word Practice is one merged section', () => {
  it('the two old sections are gone', () => {
    expect(report).not.toMatch(/title="Word Activities"/);
    expect(report).not.toMatch(/title="Word Writing Performance"/);
  });

  it('exactly one Word Practice section exists', () => {
    expect((report.match(/title="Word Practice"/g) || []).length).toBe(1);
  });

  it('overall progress sits at the top', () => {
    const i = report.indexOf('title="Word Practice"');
    const overall = report.indexOf('Overall accuracy', i);
    const rows = report.indexOf('<WordLetterRow', i);
    expect(overall).toBeGreaterThan(i);
    expect(rows).toBeGreaterThan(overall);
  });

  it('both data sources are still read, unchanged and separately', () => {
    expect(report).toMatch(/report\.wordMastery\.byLetter\.map/);
    expect(report).toMatch(/report\.wordWritingHistory\.words\.map/);
  });

  it('each source renders its own rows once — no duplicated word cards', () => {
    expect((report.match(/<WordLetterRow/g) || []).length).toBe(1);
    expect((report.match(/<WordWritingRow/g) || []).length).toBe(1);
  });

  it('each sub-list is omitted entirely when it has no data', () => {
    expect(report).toMatch(/report\.wordMastery\.byLetter\.length > 0 \? \(/);
    expect(report).toMatch(/report\.wordWritingHistory\?\.words\?\.length > 0 \? \(/);
  });

  it('the empty state is teacher-facing, with no DB terminology', () => {
    expect(report).toMatch(/No word practice recorded yet\./);
  });

  it('SENTINEL — word status vocabulary was not invented', () => {
    // Nothing here introduces a "mastered" concept the word system does not
    // itself track; the existing row components are reused verbatim.
    const i = report.indexOf('title="Word Practice"');
    const section = report.slice(i, report.indexOf('title="Learning Progress"'));
    expect(section).not.toMatch(/Mastered/);
  });

  it('SENTINEL — no backend word model or service was touched', () => {
    const svc = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/wordWritingService.js'), 'utf8');
    expect(svc).toMatch(/attributes: \{ exclude: \['strokes'\] \}/);
  });
});

// ─── 9 / 20. Learning Progress row ──────────────────────────────────────

describe('Learning Progress fits four cards in one row', () => {
  it('a wide layout flag is passed to each tile', () => {
    expect(report).toMatch(/<ProgressTile key=\{i\} item=\{ind\} wide=\{isWideLayout\} \/>/);
  });

  it('the breakpoint is tablet portrait', () => {
    expect(report).toMatch(/const isWideLayout = viewportWidth >= 600;/);
  });

  it('wide tiles are sized for four equal columns', () => {
    expect(report).toMatch(/tileWide: \{ minWidth: '22%', maxWidth: '25%'/);
  });

  it('narrow screens keep the two-up fallback', () => {
    expect(report).toMatch(/tile: \{[\s\S]{0,160}?minWidth: '47%'/);
  });

  it('the grid wraps rather than scrolling horizontally', () => {
    expect(report).toMatch(/progressGrid: \{ flexDirection: 'row', flexWrap: 'wrap'/);
    expect(report).not.toMatch(/<ScrollView horizontal/);
  });

  it('padding tightens on wide rather than the text shrinking away', () => {
    expect(report).toMatch(/tileWide: \{[\s\S]{0,90}?padding: 10/);
  });
});

// ─── 11 / 21. Regression ────────────────────────────────────────────────

describe('Phase 1 and Phase 2 did not regress', () => {
  it('the Phase-2 section order still holds, with Word Practice in place', () => {
    const order = ['<PeriodicReportSection', 'title="Practice Summary"',
      'title="Motor Comfort Score"', 'title="Motor Performance"',
      '<InitialMotorBaselineSummaryCard', '<WritingCheckHistoryCard',
      '<LetterMotorDevelopmentCard', 'title="Motor Pattern Progress"',
      '<HomeworkPracticeCard', 'title="Letters Mastery"', 'title="Word Practice"',
      'title="Learning Progress"', 'title="Teacher Recommendations"'];
    const pos = order.map(n => { const i = report.indexOf(n); expect(i).toBeGreaterThan(-1); return i; });
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1]);
  });

  it('Phase 1 homework fixes intact', () => {
    expect(report).toMatch(/recommendationAlreadyCovered/);
    expect(report).toMatch(/historyProofOf\(w\) \? 'Worksheet' : 'View'/);
    expect(report).toMatch(/source=\{\{ uri: proofTarget\.submission\.file_reference \}\}/);
  });

  it('Phase 1 assessment-vs-baseline fix intact', () => {
    expect(report).toMatch(/hasAssessmentEvidence/);
  });

  it('Phase 2 removals still hold', () => {
    expect(report).not.toMatch(/<MotorDifficultyCard/);
    expect(report).not.toMatch(/Avg deviation|Avg pauses|Avg time/);
  });

  it('Phase 2 wording and portrait lock intact', () => {
    expect(report).toMatch(/Source: \{currentState\.milestoneLabel\}/);
    expect(report).toMatch(/useLockPortrait\(\)/);
  });

  it('the teacher-override notice intact', () => {
    expect(report).toMatch(/<TeacherTargetNotice families=\{overrideFamilies\} \/>/);
  });

  it('Periodic Custom default intact', () => {
    expect(stripComments(read('../components/handwriting/reports/PeriodicReportSection.js')))
      .toMatch(/useState\('custom'\)/);
  });
});

describe('SENTINEL — no handwriting logic changed', () => {
  const backend = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('mastery, threshold and cycle policy untouched', () => {
    expect(backend('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(backend('src/config/masteryPolicy.js')).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(backend('src/config/practiceCyclePolicy.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
  });

  it('Motor Score untouched', () => {
    const ms = backend('src/utils/motorScore.js');
    expect(ms).toMatch(/accuracy:\s+0\.35/);
    expect(ms).toMatch(/DTW_MAX_NORM\s+= 45/);
  });

  it('worksheet and Writing Check rules untouched', () => {
    expect(backend('src/services/worksheetService.js'))
      .toMatch(/const LIVE_STATUSES = Object\.freeze\(\['generated', 'assigned', 'submitted'\]\)/);
  });
});
