// Word Progress shows the same picture the child saw.
//
// ── Why it showed nothing ───────────────────────────────────────────────
// The same defect the Progress Report had, in a second place. These rows come
// from the backend's word-progress payload — `{ word, status }` and nothing
// else — but the row rendered `imageKey={item.imageKey} emoji={item.emoji}`.
// Both are undefined on that payload, so every word fell through to the emoji
// branch with no emoji: an empty box, once per word.
//
// The child activities work because they are handed a catalogue entry, which
// carries imageKey and emoji. Word Progress is not, so it must resolve from
// the one field it does have.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  resolveWordImageKey,
  resolveWordEmoji,
  resolveWordImageSource,
  resolveWordImage,
} from './wordImageResolver';
import WORD_DATA from '../constants/wordData';
import WORD_IMAGES from '../constants/wordImages';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const PROGRESS = '../screens/handwriting/words/WordProgressScreen.js';
const REPORT   = '../screens/handwriting/reports/TeacherReportScreen.js';
const ACTIVITY = '../components/word/ExerciseA_WriteFirst.js';

// ─── §8 the same picture, everywhere ────────────────────────────────────

describe('§2 / §8 — Word Progress resolves what the child activity resolves', () => {
  it.each(['ant', 'axe', 'apple', 'ball', 'cat'])('%s resolves to one source', (word) => {
    const fromCatalogue = WORD_DATA.find((e) => e.word === word);
    // What the child activity is handed, and what Word Progress now derives,
    // are the same key into the same map.
    expect(resolveWordImageKey(word)).toBe(fromCatalogue.imageKey);
    expect(resolveWordImageSource(word)).toBe(WORD_IMAGES[fromCatalogue.imageKey]);
    expect(resolveWordImageSource(word)).toBeTruthy();
  });

  it('§3 the lookup is case-insensitive and tolerant of stray space', () => {
    for (const spelling of ['Ant', 'ANT', 'ant', '  Ant  ', 'aNt']) {
      expect(resolveWordImageKey(spelling)).toBe('ant');
      expect(resolveWordImageSource(spelling)).toBe(WORD_IMAGES.ant);
    }
    expect(resolveWordImageKey('Axe')).toBe(resolveWordImageKey('AXE'));
  });

  it('§3 resolving never changes how the word is displayed', () => {
    // The row still capitalises the stored word itself; nothing about the
    // lookup touches the rendered text.
    expect(readCode(PROGRESS))
      .toMatch(/\{item\.word\.charAt\(0\)\.toUpperCase\(\) \+ item\.word\.slice\(1\)\}/);
  });

  it('§5 an unknown word yields nothing rather than a broken image', () => {
    for (const unknown of ['', '   ', 'zzzz', 'not-a-word', null, undefined, 42, {}]) {
      expect(resolveWordImageKey(unknown)).toBe('');
      expect(resolveWordEmoji(unknown)).toBe('');
      expect(resolveWordImageSource(unknown)).toBeNull();
      expect(resolveWordImage(unknown).hasImage).toBe(false);
    }
  });

  it('§5 a local asset is never wrapped as a uri', () => {
    const code = readCode('./wordImageResolver.js');
    expect(code).not.toMatch(/\{ uri:/);
    expect(readCode('../components/word/WordImageDisplay.js')).not.toMatch(/\{ uri:/);
    // WordImageDisplay hands the asset straight to <Image source=…>.
    expect(readCode('../components/word/WordImageDisplay.js'))
      .toMatch(/source=\{source\}/);
  });
});

// ─── §1 / §2 one map, not two ───────────────────────────────────────────

describe('§1 / §2 — no second image map was introduced', () => {
  it('Word Progress owns no requires of its own', () => {
    const code = readCode(PROGRESS);
    expect(code).not.toMatch(/require\(['"]\.\..*assets\/words/);
    expect(code).not.toMatch(/WORD_IMAGES/);
    expect(code).toMatch(/import \{ resolveWordImageKey, resolveWordEmoji \} from '\.\.\/\.\.\/\.\.\/utils\/wordImageResolver'/);
  });

  it('the catalogue and the require map are the only sources', () => {
    const resolver = readCode('./wordImageResolver.js');
    expect(resolver).toMatch(/from '\.\.\/constants\/wordData'/);
    expect(resolver).toMatch(/from '\.\.\/constants\/wordImages'/);
    // Every screen that shows a word picture goes through the one component.
    for (const rel of [PROGRESS, REPORT, ACTIVITY]) {
      expect(readCode(rel)).toMatch(/WordImageDisplay/);
    }
  });

  it('only wordImages.js requires word assets', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) { walk(full); continue; }
        if (!name.endsWith('.js') || name.endsWith('.test.js')) continue;
        if (name === 'wordImages.js') continue;
        if (/require\(['"][^'"]*assets\/words\//.test(stripComments(fs.readFileSync(full, 'utf8')))) {
          offenders.push(path.relative(path.resolve(__dirname, '..'), full));
        }
      }
    };
    walk(path.resolve(__dirname, '..'));
    expect(offenders).toEqual([]);
  });
});

// ─── §4 the row ─────────────────────────────────────────────────────────

describe('§4 — the row renders it compactly', () => {
  const code = readCode(PROGRESS);

  it('the image is resolved from the word, in the row', () => {
    expect(code).toMatch(/imageKey=\{resolveWordImageKey\(item\.word\)\}/);
    expect(code).toMatch(/emoji=\{resolveWordEmoji\(item\.word\)\}/);
    // The fields that were never on this payload are gone.
    expect(code).not.toMatch(/imageKey=\{item\.imageKey\}/);
    expect(code).not.toMatch(/emoji=\{item\.emoji\}/);
  });

  it('it is teacher-sized, not huge', () => {
    expect(code).toMatch(/const WORD_ROW_IMAGE_SIZE = 48;/);
    expect(code).toMatch(/size=\{WORD_ROW_IMAGE_SIZE\}/);
    const size = Number(code.match(/const WORD_ROW_IMAGE_SIZE = (\d+);/)[1]);
    expect(size).toBeGreaterThanOrEqual(48);
    expect(size).toBeLessThanOrEqual(64);
  });

  it('it fits with contain, via the shared component', () => {
    expect(readCode('../components/word/WordImageDisplay.js'))
      .toMatch(/resizeMode="contain"/);
  });

  it('the row keeps its order: image, word, A-E, stars', () => {
    const at = code.indexOf('function WordRow');
    const row = code.slice(at, code.indexOf('const wordRowStyles', at));
    expect(row.indexOf('WordImageDisplay')).toBeLessThan(row.indexOf('wordRowStyles.word'));
    expect(row.indexOf('wordRowStyles.word')).toBeLessThan(row.indexOf('EXERCISES.map'));
    expect(row.indexOf('EXERCISES.map')).toBeLessThan(row.indexOf('wordRowStyles.stars'));
  });
});

// ─── §6 coverage ────────────────────────────────────────────────────────

describe('§6 — coverage across the whole catalogue', () => {
  it('every one of the 154 words resolves without throwing', () => {
    expect(WORD_DATA).toHaveLength(154);
    for (const entry of WORD_DATA) {
      expect(() => resolveWordImage(entry.word)).not.toThrow();
      expect(resolveWordImageKey(entry.word)).toBe(entry.imageKey);
    }
  });

  it('153 have a picture; quarter is the one deliberate emoji fallback', () => {
    const withImage = WORD_DATA.filter((e) => resolveWordImage(e.word).hasImage);
    const withoutImage = WORD_DATA.filter((e) => !resolveWordImage(e.word).hasImage);
    expect(withImage).toHaveLength(153);
    expect(withoutImage.map((e) => e.word)).toEqual(['quarter']);
    // It is not a broken lookup — the catalogue gives it an emoji, and the
    // map records the absence on purpose.
    expect(resolveWordEmoji('quarter')).toBe('🪙');
    expect(read('../constants/wordImages.js')).toMatch(/quarter — no image yet/);
  });

  it('every word resolves to a real asset or to an emoji — never to neither', () => {
    for (const entry of WORD_DATA) {
      const { hasImage, emoji } = resolveWordImage(entry.word);
      expect(hasImage || emoji.length > 0).toBe(true);
    }
  });

  it('the case-insensitive path covers the catalogue too', () => {
    for (const entry of WORD_DATA) {
      expect(resolveWordImageKey(entry.word.toUpperCase())).toBe(entry.imageKey);
    }
  });
});

// ─── §7 regression ──────────────────────────────────────────────────────

describe('§7 — nothing but the picture changed', () => {
  const code = readCode(PROGRESS);

  it('accuracy, status icons, stars and the accordion are untouched', () => {
    expect(code).toMatch(/const correct = Object\.values\(item\.status\)\.filter\(s => s === 'correct'\)\.length;/);
    expect(code).toMatch(/const stars\s+= correct === 4 \? 3 : correct >= 2 \? 2 : correct >= 1 \? 1 : 0;/);
    expect(code).toMatch(/const cfg = STATUS\[item\.status\[ex\]\] \?\? STATUS\.pending;/);
    expect(code).toMatch(/name=\{i < stars \? 'star' : 'star-outline'\}/);
    expect(code).toMatch(/function calcLetterScore\(wordResults\)/);
  });

  it('the main Progress Report is unchanged', () => {
    const report = readCode(REPORT);
    expect(report).toMatch(/const REPORT_WORD_IMAGE_SIZE = 46;/);
    expect(report).toMatch(/imageKey=\{resolveWordImageKey\(w\.word\)\}/);
    expect(report).toMatch(/emoji=\{resolveWordEmoji\(w\.word\)\}/);
  });

  it('unlock logic, word selection and scoring are unchanged', () => {
    expect(readCode('./wordLetterUnlockPolicy.js')).toMatch(/INITIAL_WORD_LETTERS = Object\.freeze\(\['A', 'B', 'C'\]\)/);
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('the catalogue itself was not edited', () => {
    expect((read('../constants/wordData.js').match(/\{ word: '/g) || [])).toHaveLength(154);
    expect((readCode('../constants/wordImages.js').match(/require\(/g) || [])).toHaveLength(154);
  });
});
