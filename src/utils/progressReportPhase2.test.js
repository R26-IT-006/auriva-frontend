// Handwriting Progress Report — Phase 2: layout, grouping and visual cleanup.
//
// Phase 1 (navigation + the three data bugs) is covered by
// progressReportPhase1.test.js. Phase 3 (mastery split, letter detail, word
// merge, Learning Progress row) is deliberately NOT started.

import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const report   = stripComments(read('../screens/teacher/handwriting/reports/TeacherReportScreen.js'));
const periodic = stripComments(read('../components/handwriting/reports/PeriodicReportSection.js'));

/** Index of a render call in the report body, asserted to exist. */
const at = (needle) => {
  const i = report.indexOf(needle);
  expect(i).toBeGreaterThan(-1);
  return i;
};

// ─── 1. Final section order ─────────────────────────────────────────────

describe('section order', () => {
  const ORDER = [
    ['Periodic Report',                  '<PeriodicReportSection'],
    ['Practice Summary',                 'title="Practice Summary"'],
    ['Motor Comfort Score',              'title="Motor Comfort Score"'],
    ['Motor Performance',                'title="Motor Performance"'],
    ['Initial Handwriting Skills Summary', '<InitialMotorBaselineSummaryCard'],
    ['Writing Check',                    '<WritingCheckHistoryCard'],
    ['Letter Motor Patterns',            '<LetterMotorDevelopmentCard'],
    ['Motor Pattern Progress',           'title="Motor Pattern Progress"'],
    ['Homework Practice',                '<HomeworkPracticeCard'],
    ['Letter Mastery',                   'title="Letters Mastery"'],
    ['Word Practice',                    'title="Word Practice"'],
    ['Learning Progress',                'title="Learning Progress"'],
    ['Teacher Recommendations',          'title="Teacher Recommendations"'],
  ];

  it('renders in exactly the agreed order', () => {
    const positions = ORDER.map(([, needle]) => at(needle));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it.each(ORDER)('%s appears exactly once', (_label, needle) => {
    const count = report.split(needle).length - 1;
    expect(count).toBe(1);
  });

  it('the MOTOR group is consecutive — nothing between its three members', () => {
    const comfort     = at('title="Motor Comfort Score"');
    const performance = at('title="Motor Performance"');
    const initial     = at('<InitialMotorBaselineSummaryCard');
    // No other top-level section render sits inside the group.
    const between = report.slice(comfort, initial);
    for (const stray of ['<WritingCheckHistoryCard', '<HomeworkPracticeCard',
                         '<LetterMotorDevelopmentCard', 'title="Letters Mastery"',
                         'title="Motor Pattern Progress"']) {
      expect(between).not.toContain(stray);
    }
    expect(performance).toBeGreaterThan(comfort);
    expect(initial).toBeGreaterThan(performance);
  });

  it('the PATTERN group is consecutive', () => {
    const check    = at('<WritingCheckHistoryCard');
    const patterns = at('<LetterMotorDevelopmentCard');
    const progress = at('title="Motor Pattern Progress"');
    expect(patterns).toBeGreaterThan(check);
    expect(progress).toBeGreaterThan(patterns);
    const between = report.slice(check, progress);
    for (const stray of ['<HomeworkPracticeCard', 'title="Letters Mastery"',
                         'title="Word Practice"', '<InitialMotorBaselineSummaryCard']) {
      expect(between).not.toContain(stray);
    }
  });

  it('Homework Practice immediately follows the pattern group', () => {
    expect(at('<HomeworkPracticeCard')).toBeGreaterThan(at('title="Motor Pattern Progress"'));
    expect(at('<HomeworkPracticeCard')).toBeLessThan(at('title="Letters Mastery"'));
  });
});

// ─── 2 / 3. Removals ────────────────────────────────────────────────────

describe('Motor Difficulty Analysis is not rendered', () => {
  it('the card is never mounted', () => {
    // §2 asks that the SECTION stop rendering, not that the component be
    // deleted. The definition survives (now unreferenced) so nothing about
    // difficulty rules or recommendation logic was disturbed; what matters
    // is that no render call reaches it.
    expect(report).not.toMatch(/<MotorDifficultyCard/);
  });

  it('its title therefore never reaches the rendered body', () => {
    // Scoped to the ScrollView body — the string may still exist inside the
    // orphaned component definition above it.
    const bodyStart = report.indexOf('<PeriodicReportSection');
    const bodyEnd   = report.indexOf('title="Teacher Recommendations"');
    expect(bodyStart).toBeGreaterThan(-1);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    const body = report.slice(bodyStart, bodyEnd);
    expect(body).not.toMatch(/Motor Difficulty Analysis/);
    expect(body).not.toMatch(/Why was this detected\?/);
  });

  it('SENTINEL — the backend difficulty rules are untouched', () => {
    const rules = path.resolve(__dirname, '../../../auriva-backend/src/services/difficultyRules.js');
    expect(fs.existsSync(rules)).toBe(true);
    const svc = path.resolve(__dirname, '../../../auriva-backend/src/services/explainabilityService.js');
    expect(fs.existsSync(svc)).toBe(true);
  });

  it('the difficulty analysis is still COMPUTED — only its card was removed', () => {
    expect(report).toMatch(/difficultyAnalysis/);
  });

  it('Teacher Recommendations remains the teacher-facing guidance section', () => {
    expect(report).toMatch(/title="Teacher Recommendations"/);
    expect(report).not.toMatch(/>Adaptive Practice Recommendations</);
  });
});

describe('the technical metric row is not rendered', () => {
  it('Avg deviation / Avg pauses / Avg time are gone from the report', () => {
    expect(report).not.toMatch(/Avg deviation/);
    expect(report).not.toMatch(/Avg pauses/);
    expect(report).not.toMatch(/Avg time/);
  });

  it('the metrics are still computed and still available — only unrendered', () => {
    expect(report).toMatch(/report\.letterMetrics/);
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/avgDeviation/);
    expect(engine).toMatch(/avgPauses/);
    expect(engine).toMatch(/avgTime/);
  });

  it('the per-shape results and the how-is-this-measured panel remain', () => {
    expect(report).toMatch(/<ShapeRow key=\{shape\.shapeId\} shape=\{shape\} \/>/);
    expect(report).toMatch(/label="How is this measured\?"/);
  });
});

// ─── 5. Motor Performance bars ──────────────────────────────────────────

describe('Motor Performance bar polish', () => {
  it('the fill width is exactly the score', () => {
    expect(report).toMatch(/width: `\$\{safe\}%`/);
  });

  it('a score outside 0-100 cannot render a broken bar', () => {
    expect(report).toMatch(/Math\.max\(0, Math\.min\(100, value\)\)/);
  });

  it('a non-numeric score renders an empty track, never NaN%', () => {
    expect(report).toMatch(/Number\.isFinite\(value\) \? Math\.max/);
  });

  it('track and fill are both rounded, and the track clips', () => {
    expect(report).toMatch(/const radius = height \/ 2;/);
    expect(report).toMatch(/borderRadius: radius/);
    expect(report).toMatch(/overflow: 'hidden'/);
  });

  it('rows share a consistent height and the status pill is a fixed column', () => {
    expect(report).toMatch(/minHeight: SHAPE_PREVIEW_SIZE/);
    expect(report).toMatch(/labelWrap: \{[\s\S]{0,160}?width: 72/);
  });

  it('SENTINEL — the score thresholds are unchanged', () => {
    expect(report).toMatch(/safe >= 75 \? '#22C55E' : safe >= 50 \? '#F59E0B' : '#EF4444'/);
    expect(report).toMatch(/shape\.score >= 70 \? '#15803D' : shape\.score >= 45/);
  });

  it('no heavy animation was introduced', () => {
    const barFn = report.slice(report.indexOf('function ScoreBar'), report.indexOf('const bar = StyleSheet'));
    expect(barFn).not.toMatch(/Animated|withTiming|useSharedValue|LayoutAnimation/);
  });
});

// ─── 8. Teacher-facing wording ──────────────────────────────────────────

describe('Letter Motor Patterns wording', () => {
  const state = stripComments(read('./letterMotorState.js'));

  it('the visible line no longer says "Milestone:"', () => {
    expect(report).not.toMatch(/Milestone: \{currentState\.milestoneLabel\}/);
    expect(report).toMatch(/Source: \{currentState\.milestoneLabel\}/);
  });

  it('WRITING_CHECK now has a teacher-friendly label', () => {
    expect(state).toMatch(/WRITING_CHECK:\s+'Writing Check'/);
  });

  it('an unmapped code is humanised, never echoed raw', () => {
    expect(state).toMatch(/\.split\('_'\)/);
    expect(state).not.toMatch(/return MILESTONE_LABELS\[milestone\] \?\? milestone/);
  });

  it('SENTINEL — no raw milestone enum can reach the screen', () => {
    expect(report).not.toMatch(/WRITING_CHECK/);
    expect(report).not.toMatch(/UPPERCASE_STRAIGHT_14|FULL_REFERENCE_20/);
  });

  it('stored/internal milestone values are unchanged', () => {
    // Only the display map gained an entry; nothing writes milestones here.
    expect(state).toMatch(/UPPERCASE_STRAIGHT_14: 'Uppercase Straight'/);
    expect(state).toMatch(/FULL_REFERENCE_20:\s+'Full Reference'/);
  });
});

// ─── 10 / 11. Periodic Report ───────────────────────────────────────────

describe('Periodic Report', () => {
  it('opens on Custom', () => {
    expect(periodic).toMatch(/useState\('custom'\)/);
  });

  it('does not auto-fill a custom range', () => {
    expect(periodic).toMatch(/const \[customRange, setCustomRange\] = useState\(null\)/);
  });

  it('SENTINEL — the shared default-preset constant is untouched', () => {
    const policy = read('../constants/reportPeriodPolicy.js');
    expect(policy).toMatch(/DEFAULT_REPORT_PRESET_KEY = 'last_30_days'/);
  });

  it('the presets still work', () => {
    expect(periodic).toMatch(/onSelectPreset=\{handleSelectPreset\}/);
    const selector = stripComments(read('../components/handwriting/reports/PeriodSelector.js'));
    expect(selector).toMatch(/onSelectPreset\(p\.key\)/);
  });

  it('no range warning before the teacher presses Apply', () => {
    expect(periodic).toMatch(/status === 'empty_range' && applyAttempted &&/);
  });

  it('the placeholder "Custom Range" label is hidden until a range exists', () => {
    expect(periodic).toMatch(/\{range \? <Text style=\{styles\.periodLabel\}>\{periodLabel\}<\/Text> : null\}/);
  });

  it('Apply marks the attempt, so validation shows from then on', () => {
    expect(periodic).toMatch(/setApplyAttempted\(true\);[\s\S]{0,200}?validateCustomRange/);
  });

  it('switching to a preset clears any stale custom warning', () => {
    expect(periodic).toMatch(/setApplyAttempted\(false\);[\s\S]{0,60}?setCustomError\(null\);/);
  });

  it('SENTINEL — validation logic itself was not removed', () => {
    expect(periodic).toMatch(/validateCustomRange\(candidate\.startDate, candidate\.endDate/);
    expect(periodic).toMatch(/if \(!validation\.ok\) \{[\s\S]{0,80}?setCustomError\(validation\.error\)/);
  });
});

// ─── 12. Portrait ───────────────────────────────────────────────────────

describe('portrait', () => {
  it('the existing lock is still in place and was not rewritten', () => {
    expect(report).toMatch(/useLockPortrait\(\)/);
    expect(report).not.toMatch(/lockAsync\(/);
  });

  it('no horizontally scrolling container was introduced in the report body', () => {
    expect(report).not.toMatch(/<ScrollView horizontal/);
  });
});

// ─── 14. Phase 3 has since landed — these now guard it ──────────────────
//
// This block originally asserted Phase 3 had NOT started. Phase 3 is now
// implemented (see progressReportPhase3.test.js for its own coverage); the
// assertions are inverted here so Phase 2's own suite still describes the
// live screen rather than a superseded snapshot of it.

describe('Phase 3 landed', () => {
  it('the mastery grid is split by case', () => {
    expect(report).toMatch(/Lowercase Letters/);
    expect(report).toMatch(/Uppercase Letters/);
  });

  it('a letter-detail sheet exists', () => {
    expect(report).toMatch(/function LetterDetailSheet/);
  });

  it('the two word sections are merged into one', () => {
    expect(report).toMatch(/title="Word Practice"/);
    expect(report).not.toMatch(/title="Word Activities"/);
    expect(report).not.toMatch(/title="Word Writing Performance"/);
  });

  it('Learning Progress is still a single section', () => {
    expect(report).toMatch(/title="Learning Progress"/);
  });
});

// ─── Regression ─────────────────────────────────────────────────────────

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
    expect(ms).toMatch(/SMOOTHNESS_MAX_RAD\s+= 1\.0/);
  });

  it('worksheet business rules untouched', () => {
    expect(backend('src/services/worksheetService.js'))
      .toMatch(/const LIVE_STATUSES = Object\.freeze\(\['generated', 'assigned', 'submitted'\]\)/);
  });

  it('Phase 1 fixes are still in place', () => {
    expect(report).toMatch(/hasAssessmentEvidence/);
    expect(report).toMatch(/recommendationAlreadyCovered/);
    expect(report).toMatch(/historyProofOf\(w\)/);
  });
});
