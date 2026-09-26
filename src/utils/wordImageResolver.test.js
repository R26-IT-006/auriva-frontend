// Word pictures resolve in the Progress Report, from the same catalogue the
// child activities use.
//
// ── Why the report showed nothing ───────────────────────────────────────
// The activities are handed a catalogue entry — { word, letter, emoji,
// imageKey } — so `imageKey` reaches WordImageDisplay and the picture renders.
// The report's rows are built in reportEngine from the BACKEND's word-progress
// payload, which stores only { word, status, updated_at }. It rendered
// `imageKey={w.imageKey ?? ''}` (a lookup of '', always undefined) and
// `emoji={w.emoji}` (also undefined) — so every word fell to the emoji branch
// with no emoji. It was reading fields it was never given.

import fs from 'fs';
import path from 'path';

import {
  findWordEntry, resolveWordImageKey, resolveWordEmoji,
  resolveWordImageSource, resolveWordImage,
} from './wordImageResolver';
import WORD_DATA from '../data/wordData';
import WORD_IMAGES from '../data/wordImages';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const REPORT = '../screens/teacher/handwriting/reports/TeacherReportScreen.js';
const ENGINE = './reportEngine.js';

// The one catalogue word with no picture asset — see §7.
const UNMAPPED = 'quarter';

// ─── §12 A / B / C / D — the same picture, whatever the casing ──────────

describe('A / B / C — one word, one picture, any casing', () => {
  it.each([['ant'], ['ANT'], ['Ant'], ['  aNt  ']])('%s resolves', (input) => {
    expect(resolveWordImageKey(input)).toBe('ant');
    expect(resolveWordImageSource(input)).toBe(WORD_IMAGES.ant);
    expect(resolveWordEmoji(input)).toBe('🐜');
  });

  it('D — the report and the activity land on the SAME source', () => {
    // The activity path: catalogue entry -> imageKey -> WORD_IMAGES.
    const entry = WORD_DATA.find((w) => w.word === 'ant');
    const activitySource = WORD_IMAGES[entry.imageKey];
    // The report path: word -> resolver -> WORD_IMAGES.
    expect(resolveWordImageSource('ANT')).toBe(activitySource);
    expect(resolveWordImageKey('ANT')).toBe(entry.imageKey);
  });

  it('every catalogue word resolves to its own entry, in any casing', () => {
    for (const entry of WORD_DATA) {
      expect(findWordEntry(entry.word)).toBe(entry);
      expect(findWordEntry(entry.word.toUpperCase())).toBe(entry);
      expect(resolveWordImageKey(entry.word.toUpperCase())).toBe(entry.imageKey);
    }
  });

  it('multi-word entries resolve too', () => {
    expect(resolveWordImageKey('ICE CREAM')).toBe(resolveWordImageKey('ice cream'));
    expect(resolveWordImageKey('X-RAY')).toBe(resolveWordImageKey('x-ray'));
  });

  it('normalisation is for LOOKUP only — nothing displayed is altered', () => {
    const code = readCode('./wordImageResolver.js');
    expect(code).toMatch(/String\(value \?\? ''\)\.trim\(\)\.toLowerCase\(\)/);
    // The resolver returns keys/emoji/sources — never a rewritten word.
    expect(code).not.toMatch(/return .*\.toLowerCase\(\)\s*;?\s*}\s*$/m);
    expect(readCode(REPORT)).toMatch(/\{w\.word\}/);   // the label is untouched
  });
});

// ─── §12 E — the asset shape ────────────────────────────────────────────

describe('E — a static require is passed through, never wrapped', () => {
  it('the resolver returns the asset exactly as the map holds it', () => {
    expect(resolveWordImageSource('ant')).toBe(WORD_IMAGES.ant);
  });

  it('it never constructs a uri object around a local asset', () => {
    const code = readCode('./wordImageResolver.js');
    expect(code).not.toMatch(/\{\s*uri:/);
    expect(code).not.toMatch(/uri:\s*(asset|source|WORD_IMAGES)/);
  });

  it('the renderer hands it to <Image source={...}> directly', () => {
    const display = readCode('../components/word/WordImageDisplay.js');
    expect(display).toMatch(/const source = WORD_IMAGES\[imageKey\];/);
    expect(display).toMatch(/<Image\s+source=\{source\}/);
    expect(display).not.toMatch(/source=\{\{\s*uri/);
    expect(display).toMatch(/resizeMode="contain"/);
  });

  it('§7 no local asset is serialized through the backend', () => {
    const code = readCode('./wordImageResolver.js');
    expect(code).not.toMatch(/client\.|ENDPOINTS|fetch|http|localhost/);
    const engine = readCode(ENGINE);
    expect(engine).not.toMatch(/WORD_IMAGES|require\(/);
  });
});

// ─── §12 F — unknown words ──────────────────────────────────────────────

describe('F — an unknown word degrades cleanly', () => {
  it.each([[''], ['   '], ['zzzz'], ['not-a-word'], [null], [undefined], [42], [{}]])(
    '%s yields no picture and no crash', (bad) => {
      expect(() => resolveWordImage(bad)).not.toThrow();
      expect(resolveWordImageKey(bad)).toBe('');
      expect(resolveWordImageSource(bad)).toBeNull();
      expect(resolveWordEmoji(bad)).toBe('');
      expect(findWordEntry(bad)).toBeNull();
    });

  it('a key is never guessed for a word the catalogue does not have', () => {
    expect(resolveWordImageKey('antelope')).toBe('');
    expect(resolveWordImageSource('antelope')).toBeNull();
  });

  it('a catalogue word with no asset returns null, not a broken source', () => {
    expect(resolveWordImageKey(UNMAPPED)).toBe(UNMAPPED);      // it HAS a key
    expect(WORD_IMAGES[UNMAPPED]).toBeUndefined();             // but no asset
    expect(resolveWordImageSource(UNMAPPED)).toBeNull();
    expect(resolveWordImage(UNMAPPED).hasImage).toBe(false);
    // The emoji fallback is still available for it.
    expect(resolveWordEmoji(UNMAPPED).length).toBeGreaterThan(0);
  });
});

// ─── §11 coverage ───────────────────────────────────────────────────────

describe('§11 — image coverage across the whole catalogue', () => {
  it('every word has an imageKey', () => {
    expect(WORD_DATA).toHaveLength(154);
    for (const entry of WORD_DATA) {
      expect(typeof entry.imageKey).toBe('string');
      expect(entry.imageKey.length).toBeGreaterThan(0);
    }
  });

  it('153 of 154 have a picture; the gap is exactly the known one', () => {
    const missing = WORD_DATA
      .filter((entry) => !WORD_IMAGES[entry.imageKey])
      .map((entry) => entry.word);
    expect(missing).toEqual([UNMAPPED]);
    expect(WORD_DATA.length - missing.length).toBe(153);
  });

  it('the gap is documented where the map is, not silently absent', () => {
    expect(read('../data/wordImages.js')).toMatch(/quarter — no image yet/);
  });

  it('every word has an emoji, so the fallback always has something', () => {
    for (const entry of WORD_DATA) {
      expect(typeof entry.emoji).toBe('string');
      expect(entry.emoji.length).toBeGreaterThan(0);
    }
  });
});

// ─── §12 G / H — the report ─────────────────────────────────────────────

describe('G / H — the report uses the shared resolver, in one section', () => {
  const code = readCode(REPORT);

  it('G — it resolves from the word, not from fields it never receives', () => {
    expect(code).toMatch(/imageKey=\{resolveWordImageKey\(w\.word\)\}/);
    expect(code).toMatch(/emoji=\{resolveWordEmoji\(w\.word\)\}/);
    expect(code).not.toMatch(/imageKey=\{w\.imageKey/);
    expect(code).not.toMatch(/emoji=\{w\.emoji\}/);
  });

  it('G — no second image map exists in the report', () => {
    expect(code).not.toMatch(/require\('.*\/words\//);
    expect(code).not.toMatch(/WORD_IMAGES\s*=/);
    for (const word of ['ant', 'apple', 'bee', 'cat']) {
      expect(code).not.toMatch(new RegExp(`${word}\\s*:\\s*require`));
    }
    expect(code).toMatch(/import \{ resolveWordImageKey, resolveWordEmoji \} from '[^']*wordImageResolver'/);
  });

  it('the engine no longer claims to carry an emoji it never had', () => {
    const engine = readCode(ENGINE);
    expect(engine).toMatch(/wordList: words\.map\(w => \(\{\s*word:\s+w\.word,\s*status: w\.status,/);
    expect(engine).not.toMatch(/emoji:\s+w\.emoji,/);
  });

  it('§9 the preview is modest, consistent and unframed', () => {
    expect(code).toMatch(/const REPORT_WORD_IMAGE_SIZE = 46;/);
    expect(code).toMatch(/size=\{REPORT_WORD_IMAGE_SIZE\}/);
    // One size for every word, and far smaller than the activity picture.
    const { SUPPORT_IMAGE } = require('../components/word/wordActivityLayout');
    expect(46).toBeLessThan(SUPPORT_IMAGE.imageSize);
    // Big enough to actually read — it was 30.
    expect(46).toBeGreaterThan(30);
  });

  it('H — Word Practice is still ONE merged section', () => {
    expect((code.match(/title="Word Practice"/g) || []).length).toBe(1);
    expect(code).not.toMatch(/title="Word Activities"/);
    expect(code).not.toMatch(/title="Word Writing Performance"/);
  });

  it('report ordering and the drill-down are unchanged', () => {
    expect(code).toMatch(/data\.wordList\.map/);
    expect(code).toMatch(/WORD_EXERCISE_KEYS\.map\(ex => \{/);
  });
});

// ─── §12 I / J / K + §14 regression ─────────────────────────────────────

describe('SENTINEL — earlier phases and the rest of the app', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('I — Phase 1 completed-word filtering is unchanged', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode('../screens/teacher/handwriting/words/WordLetterSelectScreen.js'))
      .toMatch(/const selectedWords = filterUnfinishedWords\(/);
    expect(b('src/services/wordWritingService.js'))
      .toMatch(/if \(input\.stage === 'practice_exercise_e' && result\.passed\) \{/);
  });

  it('J — Phase 2 avatar feedback is unchanged', () => {
    const avatar = readCode('../screens/teacher/handwriting/AttemptAvatarFeedback.js');
    expect(avatar).toMatch(/PASS_MESSAGES_BY_SUPPORT/);
    expect(avatar).not.toMatch(/wordImageResolver|WORD_IMAGES/);
    expect(readCode('../screens/teacher/handwriting/words/WordActivityScreen.js'))
      .toMatch(/<AttemptAvatarFeedback/);
  });

  it('K — Phase 3 A–E image sizes and layout are unchanged', () => {
    const { SUPPORT_IMAGE, SUPPORT_IMAGE_COMPACT, ANSWER_IMAGE } =
      require('../components/word/wordActivityLayout');
    expect(SUPPORT_IMAGE.imageSize).toBe(230);
    expect(SUPPORT_IMAGE_COMPACT.paneWidth).toBe(170);
    expect(ANSWER_IMAGE.imageSize).toBe(150);
    for (const rel of ['../components/word/ExerciseA_WriteFirst.js',
                       '../components/word/ExerciseC_FillBlank.js',
                       '../components/word/ExerciseD_SpellWord.js']) {
      expect(readCode(rel)).toMatch(/size=\{SUPPORT_IMAGE\.imageSize\}/);
    }
    // The activities still pass their catalogue imageKey directly.
    expect(readCode('../components/word/ExerciseB_CircleImage.js'))
      .toMatch(/imageKey=\{opt\.imageKey\}/);
  });

  it('the shared display component was not changed by this phase', () => {
    const display = readCode('../components/word/WordImageDisplay.js');
    expect(display).toMatch(/emojiBg: \{\s*backgroundColor: 'transparent',/);
    expect(display).not.toMatch(/wordImageResolver/);
  });

  it('mastery, scoring, geometry and speech are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
  });

  it('Homework Practice, worksheets and navigation are unchanged', () => {
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
    // The report pops to its origin directly; only the writing screens keep
    // a defaulted backOrigin.
    expect(readCode(REPORT)).toMatch(/goBackToOrigin\(navigation, route\.params\?\.originRoute\)/);
    expect(readCode('../screens/teacher/handwriting/words/WordActivityScreen.js'))
      .toMatch(/\?\? 'WordLetterSelect'/);
  });

  it('the resolver is pure — lookup only', () => {
    const code = readCode('./wordImageResolver.js');
    expect(code).not.toMatch(/navigation|useState|StyleSheet|client\.|score|mastery/i);
  });
});
