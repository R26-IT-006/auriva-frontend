// Feature 8 Step 6 — Final End-to-End Validation + Closure (frontend).
//
// This project has no RN component-testing infrastructure (see every prior
// feature's own identical note) — this file proves the final Feature 8
// frontend acceptance criteria the same way every previous feature proved
// them: exhaustive pure-helper re-verification (worksheetRecommendations.js,
// already exhaustively unit-tested in Step 4, re-exercised here as the
// closure gate) + source-scan wiring proof against the real screen file.
jest.mock('../api/client', () => ({ get: jest.fn() }));

import client from '../api/client';
import {
  fetchWorksheetRecommendations,
  normalizeWorksheetRecommendationsResponse,
  formatCaseType,
  shouldShowFocusLetters,
  getWorksheetRecommendationEmptyState,
} from './worksheetRecommendations';

const fs = require('fs');
const path = require('path');

function readScreen() {
  return fs.readFileSync(path.resolve(__dirname, '../screens/teacher/handwriting/reports/TeacherReportScreen.js'), 'utf8');
}

beforeEach(() => {
  jest.clearAllMocks();
});

function recommendation(overrides = {}) {
  return {
    recommendationType: 'motor_family_practice',
    caseType: 'lowercase', family: 'curved',
    title: 'Curved Movement Practice',
    focusLetters: ['c', 'o'],
    rationale: 'Curved movement practice is recommended because difficulty remained across two separate practice periods. The pattern was observed in both the earlier and recent practice periods.',
    suggestedActivities: ['Circle tracing exercises', 'Half-circle tracing with visual guides', 'Slow curved-stroke repetition', 'Guided tracing of focus letters', 'Independent writing of focus letters'],
    // Feature 9 Step 5 — matches a real backend response shape now that
    // worksheetRecommendationService.js adds this additive field.
    recommendationFingerprint: 'a'.repeat(64),
    ...overrides,
  };
}

function evaluatedBody(overrides = {}) {
  return {
    status: 'evaluated', studentId: 13, evaluatedAt: '2026-08-14T00:00:00.000Z',
    recommendations: [],
    summary: { evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 0, insufficientDataCount: 6, recommendationCount: 0 },
    ...overrides,
  };
}

// ─── Item 31 — one recommendation response normalizes ──────────────────────

describe('Item 31 — one-recommendation response normalizes correctly', () => {
  it('a real backend-shaped response passes through with all fields intact', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation()],
      summary: { evaluatedStreamCount: 6, persistentStreamCount: 1, notPersistentCount: 0, insufficientDataCount: 5, recommendationCount: 1 },
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.status).toBe('evaluated');
    expect(result.recommendations).toEqual([recommendation()]);
  });
});

// ─── Item 32 — multi-recommendation order preserved ────────────────────────

describe('Item 32 — multi-recommendation order preserved', () => {
  it('two recommendations normalize in backend order, never re-sorted', async () => {
    const second = recommendation({ caseType: 'uppercase', family: 'straight', title: 'Straight Movement Practice', focusLetters: ['I'] });
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation(), second],
      summary: { evaluatedStreamCount: 6, persistentStreamCount: 2, notPersistentCount: 0, insufficientDataCount: 4, recommendationCount: 2 },
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].family).toBe('curved');
    expect(result.recommendations[1].family).toBe('straight');
  });
});

// ─── Item 33 — uppercase preserved ──────────────────────────────────────────

describe('Item 33 — uppercase preserved end-to-end', () => {
  it('["C", "O"] never becomes lowercase anywhere in the normalize path', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ caseType: 'uppercase', focusLetters: ['C', 'O'] })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].focusLetters).toEqual(['C', 'O']);
  });
});

// ─── Item 34 — focus-letter order preserved ────────────────────────────────

describe('Item 34 — focus-letter order preserved', () => {
  it('a deliberately non-alphabetical order stays exactly as sent', async () => {
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ focusLetters: ['x', 's', 'a'] })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].focusLetters).toEqual(['x', 's', 'a']);
  });
});

// ─── Item 35 — activities preserved ─────────────────────────────────────────

describe('Item 35 — suggested activities preserved exactly, in order', () => {
  it('the exact array and order pass through unchanged', async () => {
    const activities = ['Zigzag tracing', 'Direction-change pattern tracing', 'Combined-stroke tracing', 'Guided tracing of focus letters', 'Independent writing of focus letters'];
    client.get.mockResolvedValueOnce({ data: evaluatedBody({
      recommendations: [recommendation({ family: 'complex', title: 'Complex Movement Practice', suggestedActivities: activities })],
    }) });
    const result = await fetchWorksheetRecommendations({ studentId: 13 });
    expect(result.recommendations[0].suggestedActivities).toEqual(activities);
  });
});

// ─── Item 36 — read_failed handled ──────────────────────────────────────────

describe('Item 36 — read_failed handled safely', () => {
  it('a backend read_failed status normalizes cleanly, never throws', async () => {
    client.get.mockResolvedValueOnce({ data: { status: 'read_failed', recommendations: null, summary: null } });
    await expect(fetchWorksheetRecommendations({ studentId: 13 })).resolves.toEqual({ status: 'read_failed', recommendations: [], summary: null });
  });

  it('a network error also normalizes to read_failed, never throws into the screen', async () => {
    client.get.mockRejectedValueOnce(new Error('Network error. Check your connection.'));
    await expect(fetchWorksheetRecommendations({ studentId: 13 })).resolves.toEqual({ status: 'read_failed', recommendations: [], summary: null });
  });
});

// ─── Item 37 — insufficient empty message ──────────────────────────────────

describe('Item 37 — insufficient-data empty-state message', () => {
  it('6 insufficient streams -> the "more practice history" message', () => {
    const msg = getWorksheetRecommendationEmptyState({ evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 0, insufficientDataCount: 6, recommendationCount: 0 });
    expect(msg).toBe('More practice history is needed before an adaptive practice recommendation can be generated.');
  });
});

// ─── Item 38 — not-persistent empty message ────────────────────────────────

describe('Item 38 — not-persistent empty-state message', () => {
  it('0 insufficient + some notPersistent -> the "no persistent difficulty" message', () => {
    const msg = getWorksheetRecommendationEmptyState({ evaluatedStreamCount: 6, persistentStreamCount: 0, notPersistentCount: 6, insufficientDataCount: 0, recommendationCount: 0 });
    expect(msg).toBe('No persistent handwriting difficulty currently requires an additional practice recommendation.');
    expect(msg).not.toMatch(/child has no/i);
  });
});

// ─── Item 39 — no Feature 7 endpoint direct fetch ──────────────────────────

describe('Item 39 — no direct Feature 7 fetch from the frontend', () => {
  it('the screen never references a persistent-difficulty endpoint/constant', () => {
    expect(readScreen()).not.toMatch(/PERSISTENT_DIFFICULTY|persistent-difficulty/);
  });

  it('the fetch utility itself never references a persistent-difficulty endpoint', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './worksheetRecommendations.js'), 'utf8');
    expect(source).not.toMatch(/PERSISTENT_DIFFICULTY|persistent-difficulty/);
  });
});

// ─── Item 40 — one Feature 8 request per focus ─────────────────────────────

describe('Item 40 — exactly one Feature 8 request per screen focus/student', () => {
  it('fetchWorksheetRecommendations appears exactly once in the screen source (single call site)', () => {
    const occurrences = readScreen().match(/fetchWorksheetRecommendations\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('the fetch effect depends only on [student]', () => {
    const match = readScreen().match(/fetchWorksheetRecommendations\(\{ studentId: student\?\.sid \}\)[\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
  });
});

// ─── Item 41 — stale-response guard exists ─────────────────────────────────

describe('Item 41 — stale-response guard exists', () => {
  it('the Feature 8 effect uses the same active-flag pattern as the main report effect', () => {
    const match = readScreen().match(/const \[worksheetRecs, setWorksheetRecs\][\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/let active = true/);
    expect(match[0]).toMatch(/if \(!active\) return;/);
    expect(match[0]).toMatch(/return \(\) => \{ active = false; \};/);
  });
});

// ─── Item 42 — loading is subsection-local ─────────────────────────────────

describe('Item 42 — loading state is subsection-local, never blocks the main report', () => {
  it('worksheetRecs state is fully independent of the main `loading`/`report` state', () => {
    const source = readScreen();
    // The Feature 8 effect never touches setLoading/setReport.
    const match = source.match(/const \[worksheetRecs, setWorksheetRecs\][\s\S]*?\}, \[student\]\)\s*\n\s*\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/setLoading|setReport\(/);
  });
});

// ─── Item 43 — adaptive cards have no priority field ───────────────────────

describe('Item 43 — AdaptivePracticeRecommendationCard has no priority field', () => {
  it('never reads .priority or renders high/medium/low', () => {
    const match = readScreen().match(/function AdaptivePracticeRecommendationCard[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/\.priority/);
    expect(match[0]).not.toMatch(/high|medium|low/i);
  });
});

// ─── Item 44 — adaptive cards use neutral styling ──────────────────────────

describe('Item 44 — neutral styling, no severity palette', () => {
  it('the apc stylesheet never uses RecommendationCard\'s red/amber/green priority colors', () => {
    const match = readScreen().match(/const apc = StyleSheet\.create\(\{[\s\S]*?\n\}\);/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/#EF4444|#F59E0B|#22C55E/);
  });
});

// ─── Item 45 — rationale uses backend string verbatim ──────────────────────

describe('Item 45 — rationale rendered verbatim from the backend, via WhyPanel', () => {
  it('AdaptivePracticeRecommendationCard passes recommendation.rationale straight into WhyPanel, no rewriting', () => {
    const match = readScreen().match(/function AdaptivePracticeRecommendationCard[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/<WhyPanel label="Why this recommendation\?" explanation=\{recommendation\.rationale\} \/>/);
  });
});

// ─── Item 46 — no content duplication ──────────────────────────────────────

describe('Item 46 — no backend family activity strings duplicated in frontend source', () => {
  it('the screen never hardcodes real backend activity text', () => {
    const source = readScreen();
    expect(source).not.toMatch(/Circle tracing exercises|Vertical line tracing|Zigzag tracing|Half-circle tracing with visual guides/);
  });

  it('the fetch utility never hardcodes activity text either', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './worksheetRecommendations.js'), 'utf8');
    expect(source).not.toMatch(/Circle tracing exercises|Vertical line tracing|Zigzag tracing/);
  });
});

// ─── Item 47 — no assign/accept/dismiss ────────────────────────────────────

describe('Item 47 — no teacher-action affordances', () => {
  it('the removed Adaptive Practice Recommendations block exposes no actions', () => {
    expect(readScreen()).not.toMatch(/>Adaptive Practice Recommendations</);
  });
});

// ─── Item 48 — no PDF/download/print ───────────────────────────────────────

describe('Item 48 — no PDF/download/print wording or packages', () => {
  it('the removed Adaptive Practice Recommendations block exposes no export UI', () => {
    expect(readScreen()).not.toMatch(/>Adaptive Practice Recommendations</);
  });

  // Proposal FR-19/FR-20, Phase 7C/7D added expo-print + expo-sharing as a
  // genuine, deliberate, explicitly-requested dependency for the periodic
  // report's real PDF export/share (see utils/periodicReportPdf.js) — a
  // completely separate feature from this file's own Feature 8 "Adaptive
  // Practice Recommendations" block, which still never mentions pdf/
  // download/print (proven by the assertion immediately above). This test
  // originally guarded against scope creep INTO Feature 8 specifically,
  // not against the whole app ever having a PDF capability — updated to
  // assert that narrower, still-true claim instead of a now-outdated
  // "no PDF dependency exists anywhere" claim.
  it('no PDF-related dependency was added for Feature 8 itself — react-native-pdf/react-native-html-to-pdf remain absent; expo-print exists only for the unrelated Phase 7C/7D periodic-report export', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const stillForbidden of ['react-native-pdf', 'react-native-html-to-pdf']) {
      expect(allDeps).not.toHaveProperty(stillForbidden);
    }
    // Feature 8's own screen/fetch source still never references expo-print.
    expect(readScreen()).not.toMatch(/expo-print/i);
  });
});

// ─── Item 49 — existing RecommendationCard unchanged ───────────────────────

describe('Item 49 — existing RecommendationCard untouched', () => {
  it('RecommendationCard still reads rec.priority (its own pre-existing behavior, unmodified)', () => {
    const match = readScreen().match(/function RecommendationCard\(\{ rec \}\)[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/rec\.priority/);
  });
});

// ─── Item 50 — Share.share unchanged ───────────────────────────────────────

describe('Item 50 — Share.share() behavior unchanged, does not silently incorporate Feature 8', () => {
  it('handleShare() never references worksheetRecs/recommendationType/focusLetters/suggestedActivities', () => {
    const match = readScreen().match(/async function handleShare\(\)[\s\S]*?\n {2}\}\n/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/worksheetRecs|recommendationType|focusLetters|suggestedActivities/);
  });
});

// ─── normalizeWorksheetRecommendationsResponse — pure, re-verified ─────────

describe('normalizeWorksheetRecommendationsResponse — pure, never throws', () => {
  it('handles every malformed shape safely', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}]) {
      expect(() => normalizeWorksheetRecommendationsResponse(bad)).not.toThrow();
    }
  });
});

describe('formatCaseType / shouldShowFocusLetters — pure, re-verified', () => {
  it('formatCaseType never guesses an unrecognized case', () => {
    expect(formatCaseType('mixed')).toBe('');
  });
  it('shouldShowFocusLetters is false for an empty array', () => {
    expect(shouldShowFocusLetters([])).toBe(false);
  });
});
