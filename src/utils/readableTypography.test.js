// Readable-text typography alignment with the Concept module.
//
// ── What was actually wrong ─────────────────────────────────────────────
// App.js already sets a global default:
//   Text.defaultProps.style = { fontFamily: 'Nunito_400Regular' };
// so every <Text> in the app is already Nunito. The Concept screens then
// pair each weight with a real Nunito FACE. The handwriting screens never
// did — they set `fontWeight: '700'` with no matching family, and React
// Native does not synthesise a bold for a named single-weight face, so those
// styles rendered at regular weight. Same font, unresolved weight.
//
// ── The hard rule these sentinels protect ───────────────────────────────
// Typography may touch text meant to be READ. It must never touch anything
// meant to be TRACED, COPIED or used as a handwriting reference — all of
// which is SVG <Path> geometry carrying no font at all.

import fs from 'fs';
import path from 'path';

import { FONT_FAMILY, WEIGHT_TO_FAMILY, familyForWeight, TEXT_ROLE } from '../constants/typography';

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf8');

function walk(dir, acc = []) {
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, acc);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(rel);
  }
  return acc;
}

const WRITING_FILES = [
  ...walk('screens/handwriting'),
  ...walk('components/handwriting'),
  ...walk('components/word'),
];

// ─── 1 / 2. The shared source ───────────────────────────────────────────

describe('shared typography source', () => {
  it('exposes exactly the five faces App.js registers', () => {
    const app = fs.readFileSync(path.resolve(ROOT, '../App.js'), 'utf8');
    for (const face of Object.values(FONT_FAMILY)) {
      expect(app).toContain(face);
    }
    expect(Object.values(FONT_FAMILY)).toHaveLength(5);
  });

  it('maps every weight to a face that actually exists', () => {
    const faces = new Set(Object.values(FONT_FAMILY));
    for (const family of Object.values(WEIGHT_TO_FAMILY)) {
      expect(faces.has(family)).toBe(true);
    }
  });

  it('familyForWeight never returns undefined', () => {
    for (const w of ['400', '500', '600', '700', '800', '900', 'bold', 'normal',
                     undefined, null, '', 'nonsense', 123]) {
      expect(typeof familyForWeight(w)).toBe('string');
      expect(familyForWeight(w)).toMatch(/^Nunito_/);
    }
  });

  it('every semantic role pairs a weight with its matching face', () => {
    for (const [role, style] of Object.entries(TEXT_ROLE)) {
      expect(style.fontFamily).toBe(familyForWeight(style.fontWeight));
      expect(role).toBeTruthy();
    }
  });

  it('the faces match the ones Concept already uses — not a new system', () => {
    const concept = read('screens/teacher/concept/ConceptCategoriesScreen.js');
    expect(concept).toContain('Nunito_800ExtraBold');
    expect(concept).toContain('Nunito_600SemiBold');
    expect(concept).toContain('Nunito_700Bold');
  });
});

// ─── 3. Readable Writing text now resolves its weight ───────────────────

describe('every readable Writing style resolves its weight', () => {
  it('no fontWeight is left without a matching fontFamily', () => {
    const offenders = [];
    for (const rel of WRITING_FILES) {
      const src = read(rel);
      if (!src.includes('StyleSheet.create')) continue;
      for (const line of src.split('\n')) {
        const m = line.match(/fontWeight:\s*'([^']+)'/);
        if (!m) continue;
        if (!WEIGHT_TO_FAMILY[m[1]]) continue;   // a weight with no Nunito face
        if (!line.includes('fontFamily')) {
          // A standalone `fontWeight:` line is paired by the NEXT line.
          continue;
        }
        const fam = line.match(/fontFamily:\s*'([^']+)'/);
        if (fam && fam[1] !== WEIGHT_TO_FAMILY[m[1]]) {
          offenders.push(`${rel}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the Writing module now declares Nunito faces at all', () => {
    const withFaces = WRITING_FILES.filter(rel => read(rel).includes("fontFamily: 'Nunito_"));
    // Before this change the count was zero across the entire module.
    expect(withFaces.length).toBeGreaterThan(20);
  });

  it('only Nunito faces were introduced — no third-party font', () => {
    for (const rel of WRITING_FILES) {
      const src = read(rel);
      const families = [...src.matchAll(/fontFamily:\s*'([^']+)'/g)].map(m => m[1]);
      for (const f of families) expect(f).toMatch(/^Nunito_/);
    }
  });
});

// ─── 4 / 5 / 11 / 12. The protected geometry ────────────────────────────

describe('SENTINEL — handwriting geometry is untouched by typography', () => {
  const GEOMETRY_FILES = [
    'constants/activityPreviewLetterPaths.js',
    'constants/wordPaths.js',
    'constants/letterCanvasLayout.js',
    'constants/shapeCanvasLayout.js',
    'constants/wordCanvasLayout.js',
    'utils/shapePreviewGeometry.js',
  ];

  it.each(GEOMETRY_FILES)('%s carries no font styling at all', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/fontFamily/);
    expect(src).not.toMatch(/fontWeight/);
    expect(src).not.toMatch(/fontSize/);
  });

  it('reference glyphs are SVG <Path>, which cannot inherit a font', () => {
    for (const rel of ['components/handwriting/LetterWritingStage.js',
                       'components/handwriting/ShapeAssessmentStage.js',
                       'components/handwriting/WordWritingStage.js']) {
      expect(read(rel)).toMatch(/<Path/);
    }
  });

  // ── The glyph exclusion list ──────────────────────────────────────────
  // Every style whose CONTENT is a letter or word glyph is deliberately left
  // on the app's default face. The decisive one is letterCardText: it renders
  // {letter} at 60% of the card size — the writing screen's reference letter.
  // Changing its face would change the letterform a child copies, which the
  // brief forbids outright. The rest (picker tiles, exercise tiles, badges)
  // are readable UI, but they are excluded too: leaving them costs nothing
  // (they keep today's appearance) while removing any judgement call about
  // which glyph a child might treat as a model.
  const GLYPH_STYLES = [
    ['components/word/ExerciseA_WriteFirst.js',      ['tileText']],
    ['components/word/ExerciseB_CircleImage.js',     ['wordText']],
    ['components/word/ExerciseC_FillBlank.js',       ['tileText']],
    ['screens/handwriting/words/WordActivityScreen.js',    ['wordDisplay']],
    ['screens/handwriting/words/WordLetterSelectScreen.js', ['letter', 'letterLocked']],
  ];

  it.each(GLYPH_STYLES)('%s glyph styles carry no injected face', (rel, names) => {
    const src = read(rel);
    for (const name of names) {
      // Slice from the style's key to the end of its object literal. No
      // regex: escaping one inside a template literal is how this assertion
      // silently broke the first time.
      const at = src.indexOf(`  ${name}: {`);
      expect(at).toBeGreaterThan(-1);
      const body = src.slice(at, src.indexOf('},', at));
      expect(body).not.toMatch(/fontFamily/);
    }
  });

  it('SENTINEL — the reference letter card is byte-identical to before', () => {
    const src = read('components/handwriting/LetterWritingStage.js');
    expect(src).not.toMatch(/letterCardText:/);
    expect(src).toMatch(/viewBox=\{getCanonicalPreviewViewBox\(rawPath\)\}/);
    expect(src).toMatch(/d=\{isAngular \? toStraightPath\(rawPath\) : toSmoothPath\(rawPath\)\}/);
  });

  it('the canvas stroke-order numbers are SVG props, never a StyleSheet face', () => {
    for (const rel of ['components/handwriting/LetterWritingStage.js',
                       'components/handwriting/WordWritingStage.js']) {
      const src = read(rel);
      expect(src).toMatch(/<SvgText/);
      // fontWeight there is a JSX prop on SvgText — untouched by this pass.
      expect(src).toMatch(/fontWeight="bold"/);
    }
  });

  it('no writing stage renders its reference letter as <Text> with an injected face', () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const rel of ['components/handwriting/LetterWritingStage.js',
                       'components/handwriting/WordWritingStage.js']) {
      // Comments stripped: these files explain at length what they draw, and
      // that prose must not register as a violation of itself.
      const src = strip(read(rel));
      // The traced guide is a path `d=` value.
      expect(src).toMatch(/d=\{/);
    }
  });

  it('SENTINEL — no fontFamily was applied to a container, only to Text styles', () => {
    // A parent-level font can leak into children a screen does not own
    // (including any future SVG <Text>). Every face we added sits inside a
    // StyleSheet entry that also carries a text property.
    for (const rel of WRITING_FILES) {
      const src = read(rel);
      for (const line of src.split('\n')) {
        if (!line.includes("fontFamily: 'Nunito_")) continue;
        if (line.trim().startsWith("fontFamily:")) continue;  // paired with the line above
        expect(line).toMatch(/font(Size|Weight)|lineHeight|letterSpacing|textAlign|color/);
      }
    }
  });
});

// ─── Font-style-only pass: sizes must be untouched ──────────────────────

describe('every declared weight now resolves to its Nunito face', () => {
  const WRITING = [...WRITING_FILES, 'screens/teacher/students/StudentDetailScreen.js'];
  const GLYPH = {
    'ExerciseA_WriteFirst.js': ['tileText'],
    'ExerciseB_CircleImage.js': ['wordText'],
    'ExerciseC_FillBlank.js': ['tileText'],
    'WordActivityScreen.js': ['wordDisplay'],
    'WordLetterSelectScreen.js': ['letter', 'letterLocked'],
  };

  it('no readable style declares a weight without a matching face', () => {
    // Line-based on purpose. An earlier version brace-matched the style body
    // with [^{}]*, which silently skipped every style containing a nested
    // object (shadowOffset and friends) — a mutation that unpaired a real
    // style passed against it. Scanning lines cannot miss those.
    const unpaired = [];
    for (const rel of WRITING) {
      const src = read(rel);
      if (src.indexOf('StyleSheet.create') < 0) continue;
      const base = rel.split('/').pop();
      const excluded = GLYPH[base] ?? [];
      const lines = src.split(String.fromCharCode(10));
      for (let i = 0; i < lines.length; i++) {
        const w = lines[i].match(/fontWeight:\s*'([^']+)'/);
        if (!w || !WEIGHT_TO_FAMILY[w[1]]) continue;
        // The face sits either on THIS line, or on the very next line as a
        // standalone `fontFamily:` declaration (what the pairing pass emits).
        // Anything looser lets a neighbouring style's face count as this
        // one's — which made an earlier version of this check pass a
        // deliberately unpaired style.
        const sameLine = lines[i].includes('fontFamily');
        const nextLine = (lines[i + 1] ?? '').trim();
        const pairedBelow = /^fontFamily:\s*'Nunito_[A-Za-z0-9]+',$/.test(nextLine);
        if (sameLine || pairedBelow) continue;
        // Which style is this line inside? Walk back to the nearest key.
        let name = '';
        for (let j = i; j >= 0 && !name; j--) {
          const k = lines[j].match(/^\s{2}([A-Za-z0-9_]+):\s*\{/);
          if (k) name = k[1];
        }
        if (excluded.includes(name)) continue;
        if (base === 'StudentDetailScreen.js' && !name.startsWith('ws')) continue;
        unpaired.push(`${rel}:${name || '?'} -> ${lines[i].trim()}`);
      }
    }
    expect(unpaired).toEqual([]);
  });

  it('each weight maps to its own face — no blind global replacement', () => {
    const seen = new Set();
    for (const rel of WRITING) {
      for (const m of read(rel).matchAll(/fontWeight:\s*'([^']+)',\s*fontFamily:\s*'([^']+)'/g)) {
        expect(m[2]).toBe(WEIGHT_TO_FAMILY[m[1]]);
        seen.add(m[2]);
      }
    }
    // Regular, SemiBold, Bold, ExtraBold and Black all appear — one face was
    // not smeared across everything.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it.each([['700', 'Nunito_700Bold'], ['600', 'Nunito_600SemiBold'],
           ['800', 'Nunito_800ExtraBold'], ['900', 'Nunito_900Black'],
           ['400', 'Nunito_400Regular']])(
    'weight %s resolves to %s', (w, face) => {
      expect(WEIGHT_TO_FAMILY[w]).toBe(face);
      expect(familyForWeight(w)).toBe(face);
    });

  it('the Writing tab in the Student Profile is covered, Concepts is not', () => {
    const src = read('screens/teacher/students/StudentDetailScreen.js');
    expect(src).toMatch(/wsHeadlineValue:[^}]*fontFamily: 'Nunito_700Bold'/);
    expect(src).toMatch(/wsReportText:[^}]*fontFamily: 'Nunito_600SemiBold'/);
    // The Concepts branch's own styles were never in scope.
    const conceptStyles = src.match(new RegExp('\n  concept[A-Za-z]+:\s*\{([^{}]*)\}', 'g')) ?? [];
    for (const s of conceptStyles) expect(s).not.toMatch(/Nunito_/);
  });

  it('SENTINEL — the protected child-facing glyph styles stay byte-identical', () => {
    for (const [base, names] of Object.entries(GLYPH)) {
      const rel = WRITING.find(r => r.endsWith(`/${base}`));
      expect(rel).toBeDefined();
      const src = read(rel);
      for (const name of names) {
        const at = src.indexOf(`  ${name}: {`);
        expect(at).toBeGreaterThan(-1);
        expect(src.slice(at, src.indexOf('},', at))).not.toMatch(/fontFamily/);
      }
    }
  });
});

// ─── 13. Nothing behavioural moved ──────────────────────────────────────

describe('SENTINEL — no logic changed', () => {
  const backend = (rel) => fs.readFileSync(path.resolve(ROOT, '../../auriva-backend', rel), 'utf8');

  it('mastery, threshold, cycle cap and Motor Score untouched', () => {
    expect(backend('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(backend('src/config/masteryPolicy.js')).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(backend('src/config/practiceCyclePolicy.js')).toMatch(/MAX_CYCLES_PER_LETTER_PER_DATE = 3/);
    expect(backend('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('the trajectory normalizer and preview geometry still behave identically', () => {
    const { computeShapePreviewPaths } = require('./shapePreviewGeometry');
    const nested = [{ stroke_id: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }] }];
    expect(computeShapePreviewPaths(nested, 44, 44, 5)).toHaveLength(1);
  });

  it('the report section order is unchanged', () => {
    const report = read('screens/handwriting/reports/TeacherReportScreen.js');
    const order = ['<PeriodicReportSection', 'title="Practice Summary"',
      'title="Motor Comfort Score"', 'title="Motor Performance"',
      '<InitialMotorBaselineSummaryCard', '<WritingCheckHistoryCard',
      '<HomeworkPracticeCard', 'title="Letters Mastery"', 'title="Word Practice"',
      'title="Learning Progress"', 'title="Teacher Recommendations"'];
    const pos = order.map(n => { const i = report.indexOf(n); expect(i).toBeGreaterThan(-1); return i; });
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1]);
  });
});
