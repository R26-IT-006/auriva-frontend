// Student Profile -> Module Progress -> WRITING tab summary.
//
// The tab is an OVERVIEW that links to the existing Writing Progress Report.
// These tests pin the counting/locking rules directly (the module is pure)
// and pin the screen's composition by source assertion, since RN screens do
// not render under this project's minimal jest config.

import fs from 'fs';
import path from 'path';

import {
  buildWritingSummary, toWritingPatternLabel, latestEvaluatedCheck,
  TOTAL_LOWERCASE, TOTAL_UPPERCASE, TOTAL_LETTER_FORMS, WRITING_PATTERN_LABEL,
} from './writingModuleSummary';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const screen = read('../screens/teacher/students/StudentDetailScreen.js');
const code   = stripComments(screen);

const progress = (lc, uc) => ({ lowercase_completed: lc, uppercase_completed: uc });

// ─── Totals ─────────────────────────────────────────────────────────────

describe('letter totals', () => {
  it('26 lowercase + 26 uppercase = 52 letter forms', () => {
    expect(TOTAL_LOWERCASE).toBe(26);
    expect(TOTAL_UPPERCASE).toBe(26);
    expect(TOTAL_LETTER_FORMS).toBe(52);
  });

  it('the headline is out of 52, never out of 26', () => {
    const s = buildWritingSummary({ progress: progress(18, 0) });
    expect(s.totalMastered).toBe(18);
    expect(s.totalLetterForms).toBe(52);
    expect(s.masteredPercent).toBe(35);          // 18/52
    expect(s.masteredPercent).not.toBe(69);      // 18/26 would be 69%
  });

  it('SENTINEL — the screen renders the total from the shared constant', () => {
    expect(code).toMatch(/\{s\.totalMastered\}/);
    expect(code).toMatch(/\{s\.totalLetterForms\}/);
    // Never a hand-typed 52 / 26 in the summary card.
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    expect(card).not.toMatch(/\/ 52/);
    expect(card).not.toMatch(/\/ 26/);
  });

  it('each case row is out of 26', () => {
    const s = buildWritingSummary({ progress: progress(13, 7) });
    expect(s.lowercaseMastered).toBe(13);
    expect(s.uppercaseMastered).toBe(7);
    expect(s.lowercasePercent).toBe(50);
    expect(s.uppercasePercent).toBe(27);
  });

  it('words are never folded into the 52-letter percentage', () => {
    const a = buildWritingSummary({ progress: progress(26, 26) });
    expect(a.masteredPercent).toBe(100);
    expect(a.totalLetterForms).toBe(52);
  });
});

// ─── Mastery semantics ──────────────────────────────────────────────────

describe('mastery semantics', () => {
  it('reads only the backend counts, which already filter mastered_at != null', () => {
    // A practised-but-failed letter never reaches these counts, so a summary
    // built from them cannot over-report. Proven at the source:
    const backend = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/controllers/handwritingController.js'), 'utf8');
    expect(backend).toMatch(/case_type: 'lowercase', mastered_at: \{ \[Op\.ne\]: null \}/);
    expect(backend).toMatch(/case_type: 'uppercase', mastered_at: \{ \[Op\.ne\]: null \}/);
  });

  it('SENTINEL — the summary module never counts rows itself', () => {
    const mod = stripComments(read('./writingModuleSummary.js'));
    expect(mod).not.toMatch(/LetterProgress/);
    expect(mod).not.toMatch(/mastered_at/);
  });

  it('a failed-only child reads 0, not the number of attempted letters', () => {
    // The endpoint returns 0 for a child with rows but no mastery.
    const s = buildWritingSummary({ progress: progress(0, 0) });
    expect(s.totalMastered).toBe(0);
    expect(s.masteredPercent).toBe(0);
  });
});

// ─── Empty / malformed states ───────────────────────────────────────────

describe('a brand-new child', () => {
  it('reads 0/52, 0/26, 0/26, Locked, Not checked yet — never an error', () => {
    const s = buildWritingSummary({});
    expect(s.totalMastered).toBe(0);
    expect(s.totalLetterForms).toBe(52);
    expect(s.lowercaseMastered).toBe(0);
    expect(s.uppercaseMastered).toBe(0);
    expect(s.wordsUnlocked).toBe(false);
    expect(s.writingPatternLabel).toBe('Not checked yet');
    expect(s.homePracticeCount).toBeNull();
  });

  it('malformed or hostile counts fail closed to 0, never above the total', () => {
    for (const bad of [null, undefined, -5, 'x', NaN, Infinity, {}]) {
      const s = buildWritingSummary({ progress: { lowercase_completed: bad, uppercase_completed: bad } });
      expect(s.lowercaseMastered).toBe(0);
      expect(s.uppercaseMastered).toBe(0);
    }
  });

  it('a count above the total is clamped, so the bar can never exceed 100%', () => {
    const s = buildWritingSummary({ progress: progress(99, 99) });
    expect(s.lowercaseMastered).toBe(26);
    expect(s.uppercaseMastered).toBe(26);
    expect(s.masteredPercent).toBe(100);
  });
});

// ─── Words lock ─────────────────────────────────────────────────────────

describe('word practice lock', () => {
  it.each([
    [0, 0, false], [26, 0, false], [0, 26, false], [25, 26, false], [26, 25, false],
    [26, 26, true],
  ])('lowercase %i / uppercase %i -> unlocked: %s', (lc, uc, expected) => {
    expect(buildWritingSummary({ progress: progress(lc, uc) }).wordsUnlocked).toBe(expected);
  });

  it('SENTINEL — the demo/preview unlock can never fake a teacher-facing unlock', () => {
    const mod = stripComments(read('./writingModuleSummary.js'));
    expect(mod).not.toMatch(/DEMO_PREVIEW_UNLOCK/);
    expect(mod).not.toMatch(/demoAccess/);
    expect(mod).not.toMatch(/canOpen|isPreview/);
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    expect(card).not.toMatch(/DEMO_PREVIEW_UNLOCK|isPreview/);
  });

  it('the locked state carries the explanatory hint', () => {
    expect(code).toMatch(/Complete all lowercase and uppercase letters first\./);
  });
});

// ─── Writing pattern ────────────────────────────────────────────────────

describe('writing pattern', () => {
  it.each([
    ['A', 'Pattern A'], ['pattern_a', 'Pattern A'],
    ['B', 'Pattern B'], ['PATTERN B', 'Pattern B'],
    ['OOD', 'Outside reference range'],
    ['out_of_distribution', 'Outside reference range'],
  ])('%s -> %s', (raw, expected) => {
    expect(toWritingPatternLabel({ pattern_label: raw })).toBe(expected);
  });

  it('no check at all -> Not checked yet', () => {
    expect(toWritingPatternLabel(null)).toBe(WRITING_PATTERN_LABEL.UNKNOWN);
    expect(buildWritingSummary({ checks: [] }).writingPatternLabel).toBe('Not checked yet');
    expect(buildWritingSummary({ checks: null }).writingPatternLabel).toBe('Not checked yet');
  });

  it('an unrecognised value degrades rather than leaking a model label', () => {
    expect(toWritingPatternLabel({ pattern_label: 'cluster_7' })).toBe('Not checked yet');
    expect(toWritingPatternLabel({ pattern_label: 'centroid-3' })).toBe('Not checked yet');
  });

  it('uses the most recent EVALUATED check', () => {
    const checks = [
      { status: 'evaluated', pattern_label: 'A', evaluated_at: '2026-08-01T00:00:00Z' },
      { status: 'evaluated', pattern_label: 'B', evaluated_at: '2026-08-20T00:00:00Z' },
      { status: 'in_progress', created_at: '2026-08-25T00:00:00Z' },
    ];
    expect(latestEvaluatedCheck(checks).pattern_label).toBe('B');
    expect(buildWritingSummary({ checks }).writingPatternLabel).toBe('Pattern B');
  });

  it('an in-progress check alone is not a result', () => {
    expect(buildWritingSummary({ checks: [{ status: 'in_progress' }] }).writingPatternLabel)
      .toBe('Not checked yet');
  });

  it('SENTINEL — no cluster id, chart or good/bad framing anywhere in the card', () => {
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    for (const banned of [/cluster/i, /centroid/i, /dtw/i, /motor_score/i, /threshold/i,
                          /cycle/i, /good|bad|poor/i, /Chart|chart/]) {
      expect(card).not.toMatch(banned);
    }
  });
});

// ─── Home practice ──────────────────────────────────────────────────────

describe('home practice', () => {
  it('one candidate names the letter', () => {
    const s = buildWritingSummary({ candidates: [{ suggestedLetter: 'c' }] });
    expect(s.homePracticeCount).toBe(1);
    expect(s.homePracticeLetters).toEqual(['c']);
  });

  it('several candidates are counted, never listed', () => {
    const s = buildWritingSummary({ candidates: [{ suggestedLetter: 'c' }, { suggestedLetter: 'm' }, { suggestedLetter: 'x' }] });
    expect(s.homePracticeCount).toBe(3);
    expect(code).toMatch(/letters recommended/);
  });

  it('no candidates -> the row is omitted rather than showing zero', () => {
    expect(buildWritingSummary({ candidates: [] }).homePracticeCount).toBe(0);
    expect(code).toMatch(/s\.homePracticeCount != null && s\.homePracticeCount > 0/);
  });
});

// ─── The tab composition ────────────────────────────────────────────────

describe('the Writing tab', () => {
  it('renders the summary card', () => {
    expect(code).toMatch(/<WritingSummaryCard/);
    expect(code).toMatch(/title="Writing Progress"/);
  });

  it('offers exactly one report action, with the requested label', () => {
    expect(code).toMatch(/View Writing Progress Report/);
    expect((code.match(/View Writing Progress Report/g) || []).length).toBe(2); // label + a11y
  });

  it('navigates to the EXISTING report route with the same params', () => {
    expect(code).toMatch(/navigation\.navigate\('StudentHandwritingReport', \{\s*student,\s*theme: getAvatarTheme\(student\.avatar_key\),/);
    // No second report screen was created.
    expect(code).not.toMatch(/navigate\('WritingProgressReport'/);
  });

  it('SENTINEL — no detailed report section leaked into the profile', () => {
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    for (const banned of [/MotorPerformance/, /InitialShapeAssessment/, /DifficultyAnalysis/,
                          /WritingCheckHistory/, /WorksheetHistory/, /PeriodicReport/,
                          /ThresholdCard/, /MasteryRing/, /TierBar/]) {
      expect(card).not.toMatch(banned);
    }
  });

  it('does not add nested scrolling or fixed heights inside Module Progress', () => {
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    expect(card).not.toMatch(/ScrollView|FlatList/);
    // The card itself must not be a fixed box — that is what would clip
    // content or force an inner scroll. Small fixed heights on decorations
    // (the 6px progress bar, a hairline divider) are fine and intended, so
    // this targets the CONTAINER, not every height in the block.
    const cardStyle = code.slice(code.indexOf('wsCard:'), code.indexOf('wsLoading:'));
    expect(cardStyle).not.toMatch(/height/);
    // ...and nothing in the summary block sets a large fixed height.
    const block = code.slice(code.indexOf('wsCard:'), code.indexOf('wsReportText:'));
    const heights = [...block.matchAll(/height:\s*(\d+)/g)].map(m => Number(m[1]));
    for (const h of heights) expect(h).toBeLessThan(20);
  });

  it('loads its data lazily, only when the Writing tab is open', () => {
    // The threshold fetch was removed with its card, so the Writing effect
    // now loads exactly one thing.
    expect(code).toMatch(/if \(activeModule === 'writing'\) loadWritingSummary\(\);/);
  });
});

// ─── Final cleanup: what must NOT be on this tab any more ──────────────

describe('the old Writing Standard threshold card is gone', () => {
  it('no threshold UI renders in the Student Profile', () => {
    expect(code).not.toMatch(/Writing Standard/);
    expect(code).not.toMatch(/Current Learning Targets/);
    expect(code).not.toMatch(/<ThresholdCard/);
    expect(code).not.toMatch(/ThresholdWhyPanel/);
    expect(code).not.toMatch(/Why this target\?/);
  });

  it('the screen makes no threshold request at all', () => {
    expect(code).not.toMatch(/fetchFamilyThresholds/);
    expect(code).not.toMatch(/fetchThresholdTrace/);
    expect(code).not.toMatch(/familyThresholds/);
    expect(code).not.toMatch(/thresholdTrace/);
  });

  it('the Writing effect now loads ONLY the summary', () => {
    expect(code).toMatch(/if \(activeModule === 'writing'\) loadWritingSummary\(\);/);
    expect(code).toMatch(/\}, \[activeModule, loadWritingSummary\]\);/);
  });

  it('SENTINEL — threshold BACKEND logic is untouched', () => {
    // The reusable utils and the whole resolver stack still exist; only this
    // screen stopped rendering and requesting them.
    expect(fs.existsSync(path.resolve(__dirname, './familyThresholds.js'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, './thresholdTrace.js'))).toBe(true);
    const resolver = fs.readFileSync(path.resolve(
      __dirname, '../../../auriva-backend/src/services/progressionThresholdResolver.js'), 'utf8');
    expect(resolver).toMatch(/resolveProgressionThreshold/);
    expect(resolver).toMatch(/SOURCE_REQUEST_OVERRIDE/);   // teacher overrides intact
  });

  it('no orphaned threshold or why-panel styles were left behind', () => {
    const stylesBlock = code.slice(code.indexOf('const styles = StyleSheet.create({'));
    expect(stylesBlock).not.toMatch(/threshold[A-Z]/);
    expect(stylesBlock).not.toMatch(/why[A-Z]/);
  });
});

describe('the old report card is gone', () => {
  it('the XAI / End-of-Day badges are not in the Student Profile', () => {
    expect(code).not.toMatch(/XAI Powered/);
    expect(code).not.toMatch(/End-of-Day/);
    expect(code).not.toMatch(/Motor analysis · Letter mastery/);
  });

  it('its styles are gone too', () => {
    const stylesBlock = code.slice(code.indexOf('const styles = StyleSheet.create({'));
    expect(stylesBlock).not.toMatch(/reportCard:|reportIconWrap:|reportTagText:/);
  });

  it('one compact footer action remains', () => {
    expect(code).toMatch(/View Writing Progress Report/);
  });
});

describe('technical source strings are never shown', () => {
  it.each(['two_cycle_failure', 'three_cycle_failure', 'persistent_difficulty',
           'KMeans', 'read_failed', 'undefined', 'NaN'])('%s never appears in the card', (banned) => {
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    expect(card).not.toMatch(new RegExp(banned));
  });
});

describe('Live Session is compact when inactive', () => {
  const live = stripComments(read('../components/teacher/LiveSessionCard.js'));

  it('the Writing tab opts into the compact inactive state', () => {
    expect(code).toMatch(/<LiveSessionCard studentId=\{initialStudent\?\.sid\} compactWhenInactive \/>/);
  });

  it('inactive renders a one-line row, not a full Card', () => {
    expect(live).toMatch(/if \(compactWhenInactive && !display\.active\)/);
    const start = live.indexOf('if (compactWhenInactive && !display.active)');
    expect(start).toBeGreaterThan(-1);
    const compact = live.slice(start, start + 700);
    expect(compact).toMatch(/Not Active/);
  });

  it('the ACTIVE rendering is untouched — every stat row still present', () => {
    for (const label of ['Activity', 'Attempt', 'Support', 'Session duration',
                         'Latest saved result', 'Status']) {
      expect(live).toMatch(new RegExp(`label="${label}"`));
    }
    expect(live).toMatch(/describeLiveSession\(snapshot\)/);
  });

  it('polling and functionality are unchanged — compact is opt-in and defaults off', () => {
    expect(live).toMatch(/compactWhenInactive = false/);
    expect(live).toMatch(/useFocusEffect/);
  });

  it('the full empty-state card is still available when not opted in', () => {
    expect(live).toMatch(/No active handwriting session right now\./);
  });
});

describe('core data failure', () => {
  it('shows a teacher-friendly unavailable state, never a status code', () => {
    expect(code).toMatch(/state\.status === 'partial'/);
    expect(code).toMatch(/Writing progress isn&apos;t available right now\./);
  });

  it('offers a retry rather than a dead end', () => {
    expect(code).toMatch(/onRetry=\{loadWritingSummary\}/);
  });
});

describe('wide/tablet layout', () => {
  it('uses a single breakpoint and never horizontal scrolling', () => {
    expect(code).toMatch(/const wide = width >= 720;/);
    const card = code.slice(code.indexOf('function WritingSummaryCard'), code.indexOf('export default function'));
    expect(card).not.toMatch(/horizontal/);
    expect(card).not.toMatch(/ScrollView/);
  });
});

// ─── The other tabs ─────────────────────────────────────────────────────

describe('the other modules are untouched', () => {
  it('the module list and tab selector are unchanged', () => {
    expect(code).toMatch(/\{ key: 'concept',\s+tab: 'Concepts',/);
    expect(code).toMatch(/\{ key: 'writing',\s+tab: 'Writing',/);
    expect(code).toMatch(/\{ key: 'pronunciation', tab: 'Pronunciation',/);
    expect(code).toMatch(/\{ key: 'dialogue',\s+tab: 'Dialogue',/);
  });

  it('the Concepts branch still renders its own content', () => {
    expect(code).toMatch(/conceptsLoading/);
    expect(code).toMatch(/fetchConcepts/);
    expect(code).toMatch(/concepts\.totals\.started === 0/);
  });

  it('the not-yet-available branch for Pronunciation and Dialogue is intact', () => {
    expect(code).toMatch(/isn't available yet/);
  });

  it('the Student Profile header and its report shortcut are unchanged', () => {
    expect(code).toMatch(/const reportAction =/);
    expect(code).toMatch(/activeModule === 'writing' \? 'Report'/);
  });
});
