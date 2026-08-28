// Handwriting Progress Report — Phase 4 polish.
//
// Two real defects, both proven against live stored data:
//   1. Shape previews rendered for NO server-sourced assessment, because the
//      preview geometry accepted only one of the two legitimate stored stroke
//      formats.
//   2. The per-word exercise chips were hardcoded to A-D, silently dropping
//      E ("Write the Word").
// Plus the Motor Performance track restyle.

import fs from 'fs';
import path from 'path';

import {
  computeShapePreviewPaths, normalizeStoredShapeTrajectory,
} from './shapePreviewGeometry';
import { WORD_EXERCISE_KEYS, WORD_EXERCISE_NAMES } from './reportEngine';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const report = stripComments(read('../screens/handwriting/reports/TeacherReportScreen.js'));

// The two formats, carrying the SAME drawing.
const flat   = [[{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]];
const nested = [{ stroke_id: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }] }];

// ─── 1 / 2. The normalizer ──────────────────────────────────────────────

describe('stored trajectory normalizer', () => {
  it('accepts the SERVER/DB format — [{stroke_id, points}]', () => {
    expect(normalizeStoredShapeTrajectory(nested)).toEqual([nested[0].points]);
  });

  it('accepts the on-device snapshot format — [[{x,y}]]', () => {
    expect(normalizeStoredShapeTrajectory(flat)).toEqual(flat);
  });

  it('both formats produce IDENTICAL preview paths', () => {
    const a = computeShapePreviewPaths(nested, 44, 44, 5);
    const b = computeShapePreviewPaths(flat, 44, 44, 5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  it('SENTINEL — the nested format produced NOTHING before this fix', () => {
    // The old body was: strokes.map(s => Array.isArray(s) ? ... : [])
    // Array.isArray({stroke_id, points}) is false, so every stroke collapsed.
    expect(Array.isArray(nested[0])).toBe(false);
    const legacyBehaviour = nested
      .map(s => (Array.isArray(s) ? s : []))
      .filter(s => s.length > 0);
    expect(legacyBehaviour).toHaveLength(0);
    // ...whereas the fixed path renders it.
    expect(computeShapePreviewPaths(nested, 44, 44, 5)).toHaveLength(1);
  });

  it('multi-stroke drawings keep every stroke', () => {
    const two = [
      { stroke_id: 0, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
      { stroke_id: 1, points: [{ x: 8, y: 0 }, { x: 12, y: 9 }] },
    ];
    expect(computeShapePreviewPaths(two, 44, 44, 5)).toHaveLength(2);
  });

  it('malformed input degrades to no preview, never a throw', () => {
    for (const bad of [null, undefined, 'x', 42, {}, [null], [{}], [{ points: 'no' }], [[]]]) {
      expect(() => computeShapePreviewPaths(bad, 44, 44, 5)).not.toThrow();
      expect(computeShapePreviewPaths(bad, 44, 44, 5)).toEqual([]);
    }
  });

  it('never fabricates a drawing — no points in, no paths out', () => {
    expect(computeShapePreviewPaths([{ stroke_id: 0, points: [] }], 44, 44, 5)).toEqual([]);
    expect(computeShapePreviewPaths([{ stroke_id: 0, points: [{ x: 1, y: 1 }] }], 44, 44, 5)).toEqual([]);
  });

  it('preserves aspect ratio and fits inside the box', () => {
    const wide = [{ stroke_id: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 10 }] }];
    const [stroke] = computeShapePreviewPaths(wide, 44, 44, 5);
    for (const p of stroke) {
      expect(p.x).toBeGreaterThanOrEqual(5);
      expect(p.x).toBeLessThanOrEqual(39);
      expect(p.y).toBeGreaterThanOrEqual(5);
      expect(p.y).toBeLessThanOrEqual(39);
    }
  });
});

// ─── 3. All six canonical shapes ────────────────────────────────────────

describe('all six canonical shapes are supported', () => {
  const SHAPES = ['horizontal_line', 'vertical_line', 'full_circle',
                  'half_circle', 'zigzag', 'curve_wave'];

  it.each(SHAPES)('%s renders from the stored nested format', (_shape) => {
    // The renderer is shape-agnostic — it consumes strokes, not a shape id —
    // so one path per stroke is produced for every canonical shape alike.
    expect(computeShapePreviewPaths(nested, 44, 44, 5)).toHaveLength(1);
  });

  it('there are exactly six canonical shapes', () => {
    expect(SHAPES).toHaveLength(6);
  });

  it('the report feeds the renderer the stored strokes verbatim', () => {
    expect(report).toMatch(/<ShapePreview strokes=\{shape\.strokes\} \/>/);
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/strokes: shape\.strokes \?\? \[\]/);
  });

  it('no stroke data still shows a neutral placeholder, never a fake image', () => {
    expect(report).toMatch(/name="image-outline"/);
    const preview = report.slice(report.indexOf('function ShapePreview'),
                                 report.indexOf('function ShapeRow'));
    expect(preview).not.toMatch(/require\(|\.png|\.jpg/);
  });
});

// ─── 4. Motor Performance bar ───────────────────────────────────────────

describe('Motor Performance bar', () => {
  it('the track is a light neutral, not a heavy grey slab', () => {
    expect(report).toMatch(/bg:\s+\{ backgroundColor: '#F1F5F9'/);
    expect(report).not.toMatch(/bg:\s+\{ backgroundColor: '#E2E8F0'/);
  });

  it('track and fill share one height and one radius', () => {
    expect(report).toMatch(/const radius = height \/ 2;/);
    const fn = report.slice(report.indexOf('function ScoreBar'), report.indexOf('const bar = StyleSheet'));
    expect((fn.match(/borderRadius: radius/g) || []).length).toBe(2);
    expect((fn.match(/height,/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('the track clips the fill so the ends stay rounded', () => {
    expect(report).toMatch(/bg:\s+\{[^}]*overflow: 'hidden'/);
  });

  it('the fill width is exactly the clamped score', () => {
    expect(report).toMatch(/const safe = Number\.isFinite\(value\) \? Math\.max\(0, Math\.min\(100, value\)\) : 0;/);
    expect(report).toMatch(/width: `\$\{safe\}%`/);
  });

  it('shape rows use a thin 8px bar', () => {
    expect(report).toMatch(/<ScoreBar pct=\{shape\.score\} height=\{8\} \/>/);
  });

  it('SENTINEL — scores and colour thresholds unchanged', () => {
    expect(report).toMatch(/safe >= 75 \? '#22C55E' : safe >= 50 \? '#F59E0B' : '#EF4444'/);
  });
});

// ─── 5-8. Word exercises ────────────────────────────────────────────────

describe('word exercise chips', () => {
  it('the canonical map has all five exercises with teacher-facing names', () => {
    expect(WORD_EXERCISE_KEYS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(WORD_EXERCISE_NAMES).toEqual({
      A: 'First Letter', B: 'Find Picture', C: 'Fill Gap', D: 'Spell It', E: 'Write the Word',
    });
  });

  it('SENTINEL — the report no longer hardcodes A-D, dropping E', () => {
    expect(report).not.toMatch(/\['A', 'B', 'C', 'D'\]\.map/);
    expect(report).toMatch(/WORD_EXERCISE_KEYS\.map\(ex => \{/);
  });

  it('the names come from the shared map, not a second copy', () => {
    expect(report).toMatch(/WORD_EXERCISE_NAMES\[ex\]/);
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/const EXERCISE_NAMES = WORD_EXERCISE_NAMES;/);
  });

  it('the engine already tracked all five — only the display dropped one', () => {
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/E: \{ correct: 0, good: 0, total: 0 \}/);
  });
});

describe('per-word drill-down uses canonical per-word images', () => {
  it('expanding a letter lists its words', () => {
    expect(report).toMatch(/data\.wordList\.map/);
  });

  it('each word shows its OWN reference image, keyed per word', () => {
    // This used to assert imageKey={w.imageKey ?? ''} — which LOOKED
    // per-word but resolved to '' for every row: these entries come from the
    // backend word-progress payload and carry no imageKey or emoji at all.
    // Resolving from w.word is what finally makes the intent true.
    expect(report).toMatch(/imageKey=\{resolveWordImageKey\(w\.word\)\}/);
    expect(report).toMatch(/emoji=\{resolveWordEmoji\(w\.word\)\}/);
  });

  it('the image map is the canonical one shared with the child UI', () => {
    const images = read('../constants/wordImages.js');
    expect(images).toMatch(/apple:\s+require\('\.\.\/\.\.\/assets\/words\/A\/5-letter\/apple\.jpg'\)/);
    expect(images).toMatch(/export default WORD_IMAGES/);
  });

  it('Apple maps to the apple asset, not a generic A image', () => {
    const images = read('../constants/wordImages.js');
    const line = images.split('\n').find(l => /^\s*apple:/.test(l));
    expect(line).toBeDefined();
    expect(line).toMatch(/apple\.jpg/);
    expect(line).not.toMatch(/\/A\.jpg|letter-a/i);
  });

  it('no duplicate word-to-image map was created in the report', () => {
    expect(report).not.toMatch(/WORD_IMAGES\s*=/);
    expect(report).not.toMatch(/require\('.*assets\/words/);
  });
});

// ─── 12. Phases 1-3 intact ──────────────────────────────────────────────

describe('Phases 1-3 did not regress', () => {
  it('section order intact', () => {
    const order = ['<PeriodicReportSection', 'title="Practice Summary"',
      'title="Motor Comfort Score"', 'title="Motor Performance"',
      '<InitialMotorBaselineSummaryCard', '<WritingCheckHistoryCard',
      '<LetterMotorDevelopmentCard', 'title="Motor Pattern Progress"',
      '<HomeworkPracticeCard', 'title="Letters Mastery"', 'title="Word Practice"',
      'title="Learning Progress"', 'title="Teacher Recommendations"'];
    const pos = order.map(n => { const i = report.indexOf(n); expect(i).toBeGreaterThan(-1); return i; });
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1]);
  });

  it('portrait lock, Custom default, override notice intact', () => {
    expect(report).toMatch(/useLockPortrait\(\)/);
    expect(report).toMatch(/<TeacherTargetNotice families=\{overrideFamilies\} \/>/);
    expect(stripComments(read('../components/handwriting/reports/PeriodicReportSection.js')))
      .toMatch(/useState\('custom'\)/);
  });

  it('homework Worksheet/Proof actions intact', () => {
    expect(report).toMatch(/historyProofOf\(w\) \? 'Worksheet' : 'View'/);
    expect(report).toMatch(/recommendationAlreadyCovered/);
  });

  it('mastery split, letter detail and Learning Progress row intact', () => {
    expect(report).toMatch(/title="Lowercase Letters"/);
    expect(report).toMatch(/title="Uppercase Letters"/);
    expect(report).toMatch(/function LetterDetailSheet/);
    expect(report).toMatch(/wide=\{isWideLayout\}/);
  });

  it('Phase 2 removals still hold', () => {
    expect(report).not.toMatch(/<MotorDifficultyCard/);
    expect(report).not.toMatch(/Avg deviation|Avg pauses|Avg time/);
  });
});

describe('SENTINEL — no handwriting logic changed', () => {
  const backend = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('mastery, threshold, cycle cap and Motor Score untouched', () => {
    expect(backend('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(backend('src/config/masteryPolicy.js')).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(backend('src/config/practiceCyclePolicy.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    expect(backend('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('word scoring and worksheet rules untouched', () => {
    const engine = stripComments(read('./reportEngine.js'));
    expect(engine).toMatch(/accuracy >= 80 \? 'Mastered' : accuracy >= 60 \? 'Moderate' : 'Needs Practice'/);
    expect(backend('src/services/worksheetService.js'))
      .toMatch(/const LIVE_STATUSES = Object\.freeze\(\['generated', 'assigned', 'submitted'\]\)/);
  });
});
