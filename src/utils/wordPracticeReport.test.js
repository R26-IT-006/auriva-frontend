// One word, one entry, all of its evidence.
//
// Word Practice listed the same words twice: "Word activities" grouped by
// letter with the A–E chips, and "Word writing" as a flat list far below with
// the score and the size/spacing labels. A teacher reading ANT's chips had to
// scroll past every other letter to find ANT's handwriting result.

jest.mock('../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import fs from 'fs';
import path from 'path';

import {
  mergeWordPracticeByLetter,
  indexWritingByWord,
  initialLetterOf,
  hasWritingResult,
} from './wordPracticeReport';
import { WORD_EXERCISE_KEYS, WORD_EXERCISE_NAMES } from './reportEngine';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const REPORT = '../screens/handwriting/reports/TeacherReportScreen.js';

const allFive = (s = 'correct') => Object.fromEntries(WORD_EXERCISE_KEYS.map((k) => [k, s]));

const writing = (word, over = {}) => ({
  word, latest_score: 80, best_score: 85, attempt_count: 2, passed: true,
  letter_size: 'Consistent', letter_spacing: 'Consistent', ...over,
});

const letterA = () => ({
  letter: 'a', words: 2, correct: 8, good: 2, total: 10,
  accuracy: 80, withHelp: 20, masteryStatus: 'Mastered',
  wordList: [
    { word: 'ant', status: { ...allFive(), C: 'good' }, stars: 4 },
    { word: 'axe', status: { A: 'good', B: 'good', C: 'good', D: 'correct', E: 'correct' }, stars: 2 },
  ],
});

const letterB = () => ({
  letter: 'b', words: 1, correct: 5, good: 0, total: 5,
  accuracy: 100, withHelp: 0, masteryStatus: 'Mastered',
  wordList: [{ word: 'ball', status: allFive(), stars: 5 }],
});

// ─── §3 / §4 the merge ──────────────────────────────────────────────────

describe('§3 / §4 — each word appears once, with everything known about it', () => {
  it('Ant and Axe each carry their own writing result', () => {
    const merged = mergeWordPracticeByLetter(
      [letterA()], [writing('ant'), writing('axe', { latest_score: 72, letter_size: 'Some variation', letter_spacing: 'High variation' })]);

    const [ant, axe] = merged[0].wordList;
    expect(ant.word).toBe('ant');
    expect(ant.writing.latest_score).toBe(80);
    expect(ant.writing.letter_spacing).toBe('Consistent');
    expect(axe.word).toBe('axe');
    expect(axe.writing.latest_score).toBe(72);
    expect(axe.writing.letter_spacing).toBe('High variation');
  });

  it('the activity statuses ride along untouched', () => {
    const merged = mergeWordPracticeByLetter([letterA()], [writing('ant')]);
    const ant = merged[0].wordList[0];
    expect(ant.status).toEqual({ A: 'correct', B: 'correct', C: 'good', D: 'correct', E: 'correct' });
    expect(ant.stars).toBe(4);
  });

  it('§4 no word is listed twice', () => {
    const merged = mergeWordPracticeByLetter([letterA()], [writing('ant'), writing('axe')]);
    const words = merged.flatMap((l) => l.wordList.map((w) => w.word));
    expect(words).toEqual(['ant', 'axe']);
    expect(new Set(words).size).toBe(words.length);
  });

  it('a longer word that merely starts the same is not a match', () => {
    // 'ant' has no writing record; only 'anthill' does. A prefix or
    // startsWith join would hand ANT the ANTHILL score.
    const merged = mergeWordPracticeByLetter([letterA()], [writing('anthill', { latest_score: 55 })]);
    expect(merged[0].wordList[0].word).toBe('ant');
    expect(merged[0].wordList[0].writing).toBeNull();
    // ...and anthill keeps its own row with its own score.
    const anthill = merged[0].wordList.find((w) => w.word === 'anthill');
    expect(anthill.writing.latest_score).toBe(55);
  });

  it('the match is exact on the normalised word, never fuzzy', () => {
    const merged = mergeWordPracticeByLetter([letterA()], [writing('  ANT  '), writing('anthill')]);
    expect(merged[0].wordList[0].writing.word).toBe('  ANT  ');
    // 'anthill' is a different word — it never lands on 'ant'.
    expect(merged[0].wordList[1].writing).toBeNull();
    const all = merged.flatMap((l) => l.wordList.map((w) => w.word));
    expect(all).toContain('anthill');
  });
});

// ─── §7 no writing data ─────────────────────────────────────────────────

describe('§7 — a word with no writing attempt says so', () => {
  it('writing is null rather than an empty metric set', () => {
    const merged = mergeWordPracticeByLetter([letterA()], []);
    for (const entry of merged[0].wordList) {
      expect(entry.writing).toBeNull();
      expect(hasWritingResult(entry)).toBe(false);
    }
  });

  it('a record without a usable score is not a result', () => {
    for (const bad of [null, undefined, {}, { latest_score: null }, { latest_score: 'x' }]) {
      expect(hasWritingResult({ writing: bad })).toBe(false);
    }
    expect(hasWritingResult({ writing: writing('ant') })).toBe(true);
    expect(hasWritingResult({ writing: writing('ant', { latest_score: 0 }) })).toBe(true);
  });

  it('the panel prints the message instead of blank metrics', () => {
    const code = readCode(REPORT);
    expect(code).toMatch(/if \(!hasWritingResult\(entry\)\) \{/);
    expect(code).toMatch(/No writing attempt/);
  });
});

// ─── writing-only words ─────────────────────────────────────────────────

describe('a word written but not yet recorded in activities is not lost', () => {
  it('it joins its own letter group', () => {
    const merged = mergeWordPracticeByLetter([letterA()], [writing('apple')]);
    const words = merged[0].wordList.map((w) => w.word);
    expect(words).toEqual(['ant', 'axe', 'apple']);
    const apple = merged[0].wordList[2];
    expect(apple.status).toEqual({});
    expect(apple.stars).toBe(0);
    expect(apple.writing.latest_score).toBe(80);
  });

  it('§8 it does not move the letter summary', () => {
    const before = letterA();
    const merged = mergeWordPracticeByLetter([before], [writing('apple')]);
    expect(merged[0].words).toBe(before.words);
    expect(merged[0].accuracy).toBe(before.accuracy);
    expect(merged[0].masteryStatus).toBe(before.masteryStatus);
    expect(merged[0].correct).toBe(before.correct);
    expect(merged[0].total).toBe(before.total);
  });

  it('a letter with writing but no activity group still gets a row', () => {
    const merged = mergeWordPracticeByLetter([letterA()], [writing('zebra')]);
    const z = merged.find((l) => l.letter === 'z');
    expect(z).toBeTruthy();
    expect(z.wordList.map((w) => w.word)).toEqual(['zebra']);
    expect(z.words).toBe(0);
    expect(z.accuracy).toBe(0);
  });

  it('the letter comes from the word itself', () => {
    expect(initialLetterOf('Ant')).toBe('a');
    expect(initialLetterOf('  ZEBRA ')).toBe('z');
    for (const bad of ['', '   ', null, undefined, 7]) {
      expect(initialLetterOf(bad)).toBe('');
    }
  });
});

// ─── robustness ─────────────────────────────────────────────────────────

describe('it never throws on a payload it did not expect', () => {
  it('missing or malformed inputs produce an empty, usable result', () => {
    for (const bad of [null, undefined, 'nope', 42, {}]) {
      expect(mergeWordPracticeByLetter(bad, null)).toEqual([]);
      expect(() => mergeWordPracticeByLetter([letterA()], bad)).not.toThrow();
    }
    expect(mergeWordPracticeByLetter([{ letter: 'a' }], [])[0].wordList).toEqual([]);
  });

  it('the writing index ignores unusable records and keeps the first of a duplicate', () => {
    const index = indexWritingByWord([
      writing('ant', { latest_score: 10 }),
      writing('ant', { latest_score: 99 }),
      { word: '' }, null, undefined, { nope: true },
    ]);
    expect(index.size).toBe(1);
    expect(index.get('ant').latest_score).toBe(10);
    expect(indexWritingByWord(null).size).toBe(0);
  });

  it('the input groups are not mutated', () => {
    const original = letterA();
    const snapshot = JSON.parse(JSON.stringify(original));
    mergeWordPracticeByLetter([original], [writing('ant'), writing('apple')]);
    expect(original).toEqual(snapshot);
  });
});

// ─── §1 / §10 one section ───────────────────────────────────────────────

describe('§1 / §10 — one Word Practice section, no standalone writing list', () => {
  const code = readCode(REPORT);

  it('Word Practice is still the only top-level word section', () => {
    expect((code.match(/<SectionCard title="Word Practice"/g) || [])).toHaveLength(1);
    expect(code).not.toMatch(/<SectionCard title="Word Activities"/);
    expect(code).not.toMatch(/<SectionCard title="Word Writing/);
  });

  it('the standalone writing list and its row component are gone', () => {
    expect(code).not.toMatch(/function WordWritingRow/);
    expect(code).not.toMatch(/<WordWritingRow/);
    expect(code).not.toMatch(/sectionLabel}>Word writing</);
    expect(code).not.toMatch(/sectionLabel}>Word activities</);
  });

  it('the letter groups come from the merged list', () => {
    expect(code).toMatch(/mergedWordPractice\.map\(l => \(\s*<WordLetterRow key=\{l\.letter\} data=\{l\} \/>/);
    expect(code).toMatch(/const mergedWordPractice = useMemo\(/);
    expect(code).toMatch(/mergeWordPracticeByLetter\(\s*report\?\.wordMastery\?\.byLetter, report\?\.wordWritingHistory\?\.words\)/);
  });

  it('§10 both payloads are still fetched', () => {
    expect(code).toMatch(/computed\.wordWritingHistory = serverWordReport;/);
    expect(code).toMatch(/serverWordReport = await fetchWordReport\(student\)/);
  });

  it('the writing summary sits inside the word card', () => {
    const at = code.indexOf('function WordLetterRow');
    const body = code.slice(at, code.indexOf('const wl = StyleSheet', at));
    expect(body).toMatch(/<WordWritingSummary entry=\{w\} \/>/);
    expect(body).toMatch(/<WordImageDisplay/);
    expect(body).toMatch(/WORD_EXERCISE_KEYS\.map/);
  });
});

// ─── §5 / §6 / §9 / §11 presentation ────────────────────────────────────

describe('§5 / §6 / §9 / §11 — labels, images, expansion, semantics', () => {
  const code = readCode(REPORT);

  it('§5 the canonical A–E keys and names are unchanged', () => {
    expect(WORD_EXERCISE_KEYS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(WORD_EXERCISE_NAMES).toEqual({
      A: 'First Letter', B: 'Find Picture', C: 'Fill Gap', D: 'Spell It', E: 'Write the Word',
    });
    expect(code).toMatch(/accessibilityLabel=\{`\$\{WORD_EXERCISE_NAMES\[ex\]\}: \$\{s \?\? 'not attempted'\}`\}/);
  });

  it('§11 with help stays its own outcome, not a failure', () => {
    expect(code).toMatch(/s === 'correct' \? '#15803D' : s === 'good' \? '#B45309' : '#CBD5E1'/);
    expect(code).toMatch(/s === 'correct' \? 'checkmark' : s === 'good' \? 'remove' : 'ellipse-outline'/);
  });

  it('§6 images come from the one canonical resolver', () => {
    expect(code).toMatch(/imageKey=\{resolveWordImageKey\(w\.word\)\}/);
    expect(code).toMatch(/emoji=\{resolveWordEmoji\(w\.word\)\}/);
    expect(code).not.toMatch(/require\(['"][^'"]*assets\/words/);
  });

  it('§9 detail rows render only while the group is open', () => {
    const at = code.indexOf('function WordLetterRow');
    const body = code.slice(at, code.indexOf('const wl = StyleSheet', at));
    expect(body).toMatch(/const \[open, setOpen\] = useState\(false\);/);
    expect(body).toMatch(/\{open && \(/);
    expect(body.indexOf('{open && (')).toBeLessThan(body.indexOf('data.wordList.map'));
  });

  it('§8 the collapsed summary still shows count, percent and status', () => {
    expect(code).toMatch(/\{data\.words\} word\{data\.words !== 1 \? 's' : ''\}/);
    expect(code).toMatch(/\{data\.accuracy\}% correct/);
    expect(code).toMatch(/<Pill label=\{data\.masteryStatus\}/);
  });
});

// ─── §13 regression ─────────────────────────────────────────────────────

describe('§13 — nothing outside Word Practice moved', () => {
  it('the letter-summary calculation is unchanged', () => {
    expect(readCode('./reportEngine.js'))
      .toMatch(/const masteryStatus = accuracy >= 80 \? 'Mastered' : accuracy >= 60 \? 'Moderate' : 'Needs Practice';/);
    expect(readCode('./reportEngine.js'))
      .toMatch(/stars:\s+Object\.values\(w\.status\)\.filter\(s => s === 'correct'\)\.length,/);
  });

  it('report ordering outside Word Practice is unchanged', () => {
    const code = readCode(REPORT);
    const order = ['Word Practice', 'Learning Progress', 'Teacher Recommendations'];
    let last = -1;
    for (const title of order) {
      const at = code.indexOf(`<SectionCard title="${title}"`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it('word completion filtering, catalogue and child Word Progress are unchanged', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect((read('../constants/wordData.js').match(/\{ word: '/g) || [])).toHaveLength(154);
    expect(readCode('../screens/handwriting/words/WordProgressScreen.js'))
      .toMatch(/imageKey=\{resolveWordImageKey\(item\.word\)\}/);
  });

  it('mastery, worksheets and homework are unchanged', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
  });

  it('word writing scores are displayed, never recomputed', () => {
    const code = readCode(REPORT);
    const at = code.indexOf('function WordWritingSummary');
    const body = code.slice(at, code.indexOf('const wwp = StyleSheet', at));
    expect(body).toMatch(/data\.latest_score/);
    expect(body).not.toMatch(/Math\.round|Math\.max|\/ 100|\* 100/);
  });
});
