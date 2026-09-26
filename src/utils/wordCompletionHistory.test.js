// A finished word is not offered again.
//
// ── The bug ─────────────────────────────────────────────────────────────
// getSelectedWords(letter) filters the catalogue by initial letter and sorts
// by length. It never consulted what the child had done, so tapping `a` on any
// day produced the same five words — a child who finished ANT on Monday met
// ANT again on Tuesday. The evidence to prevent it was already being fetched:
// WordLetterSelect loads authoritative progress on focus and used it only to
// colour the letter cards.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import {
  COMPLETED_STATUSES, isWordCompleted, completedWordsForLetter,
  filterUnfinishedWords, completedPracticeDate,
} from './wordCompletionHistory';
import { WORD_EXERCISES, getSelectedWords } from './wordWorkflow';
import { currentPracticeDate, PRACTICE_TIMEZONE } from './letterCycleGuard';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const SELECT = '../screens/teacher/handwriting/words/WordLetterSelectScreen.js';

const done = (over = {}) => ({ A: 'correct', B: 'correct', C: 'correct', D: 'good', E: 'correct', ...over });
const entry = (word, status, updated_at = '2026-08-27T04:00:00.000Z') => ({ word, status, updated_at });

// ─── the completion rule ────────────────────────────────────────────────

describe('a word is complete only when all five exercises are', () => {
  it('all of A-E recorded is complete', () => {
    expect(isWordCompleted(done())).toBe(true);
  });

  it.each(WORD_EXERCISES)('missing %s is NOT complete', (missing) => {
    const partial = { ...done() };
    delete partial[missing];
    expect(isWordCompleted(partial)).toBe(false);
  });

  it('the rule follows the flow’s own exercise list, not a copied count', () => {
    expect(WORD_EXERCISES).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(readCode('./wordCompletionHistory.js'))
      .toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode('./wordCompletionHistory.js')).not.toMatch(/length === 5|\.length >= 5/);
  });

  it('only the outcomes the backend actually persists count', () => {
    expect(COMPLETED_STATUSES).toEqual(['correct', 'good']);
    expect(isWordCompleted(done({ C: 'attempted' }))).toBe(false);
    expect(isWordCompleted(done({ C: 'opened' }))).toBe(false);
    expect(isWordCompleted(done({ C: true }))).toBe(false);
    expect(isWordCompleted(done({ C: null }))).toBe(false);
  });

  it('nothing about opening a screen or advancing the UI counts', () => {
    expect(isWordCompleted({})).toBe(false);
    expect(isWordCompleted({ A: 'correct' })).toBe(false);           // activity A alone
    expect(isWordCompleted(null)).toBe(false);
    expect(isWordCompleted(undefined)).toBe(false);
    expect(isWordCompleted('correct')).toBe(false);
  });
});

// ─── §6 A / B / D / E ───────────────────────────────────────────────────

describe('A / B — a finished word drops out, an unfinished one stays', () => {
  const words = [{ word: 'ant' }, { word: 'axe' }, { word: 'apple' }];

  it('A — ANT completed is excluded from a newly built sequence', () => {
    const progress = { a: [entry('ant', done())] };
    expect(filterUnfinishedWords(words, progress, 'a').map((w) => w.word))
      .toEqual(['axe', 'apple']);
  });

  it('B — ANT unfinished stays eligible', () => {
    const progress = { a: [entry('ant', { A: 'correct', B: 'correct' })] };
    expect(filterUnfinishedWords(words, progress, 'a').map((w) => w.word))
      .toEqual(['ant', 'axe', 'apple']);
  });

  it('D — every word done leaves an empty pool, not a repeat', () => {
    const progress = { a: [entry('ant', done()), entry('axe', done()), entry('apple', done())] };
    expect(filterUnfinishedWords(words, progress, 'a')).toEqual([]);
  });

  it('E — another child’s history never leaks in', () => {
    // The payload is per student; a letter this student has no rows for is
    // simply unfiltered.
    expect(filterUnfinishedWords(words, {}, 'a').map((w) => w.word))
      .toEqual(['ant', 'axe', 'apple']);
    expect(filterUnfinishedWords(words, { b: [entry('bee', done())] }, 'a').map((w) => w.word))
      .toEqual(['ant', 'axe', 'apple']);
    expect(readCode('./wordCompletionHistory.js')).not.toMatch(/studentId|student\b/);
  });

  it('removes only — never reorders, substitutes or repeats', () => {
    const progress = { a: [entry('axe', done())] };
    const out = filterUnfinishedWords(words, progress, 'a');
    expect(out.map((w) => w.word)).toEqual(['ant', 'apple']);
    // Same entry objects, catalogue order preserved.
    expect(out[0]).toBe(words[0]);
    expect(out[1]).toBe(words[2]);
    expect(new Set(out.map((w) => w.word)).size).toBe(out.length);
  });

  it('case and whitespace in stored words do not defeat the match', () => {
    const progress = { a: [entry(' ANT ', done())] };
    expect(filterUnfinishedWords(words, progress, 'a').map((w) => w.word)).toEqual(['axe', 'apple']);
    expect(filterUnfinishedWords(words, { A: [entry('ant', done())] }, 'A').map((w) => w.word))
      .toEqual(['axe', 'apple']);
  });

  it('malformed progress never throws and never over-filters', () => {
    for (const bad of [null, undefined, 'x', { a: null }, { a: 'x' }, { a: [null, {}] }]) {
      expect(() => filterUnfinishedWords(words, bad, 'a')).not.toThrow();
      expect(filterUnfinishedWords(words, bad, 'a')).toHaveLength(3);
    }
    expect(filterUnfinishedWords(null, {}, 'a')).toEqual([]);
    expect(completedWordsForLetter(undefined, 'a').size).toBe(0);
  });

  it('works against the real catalogue', () => {
    const real = getSelectedWords('a');
    expect(real.length).toBeGreaterThan(1);
    const first = real[0].word;
    const out = filterUnfinishedWords(real, { a: [entry(first, done())] }, 'a');
    expect(out).toHaveLength(real.length - 1);
    expect(out.map((w) => w.word)).not.toContain(first);
  });
});

// ─── §6 C — an active flow is never interrupted ─────────────────────────

describe('C — filtering happens when a sequence is BUILT, never mid-flow', () => {
  const code = readCode(SELECT);

  it('the only filter call is at the moment the sequence is constructed', () => {
    expect((code.match(/filterUnfinishedWords\(/g) || []).length).toBe(1);
    expect(code).toMatch(/const selectedWords = filterUnfinishedWords\(\s*getSelectedWords\(selectedLetter\), wordProgress, selectedLetter,\s*\)/);
  });

  it('no screen in the A-E flow re-filters its own list', () => {
    for (const rel of ['../screens/teacher/handwriting/words/WordWritingScreen.js',
                       '../screens/teacher/handwriting/words/WordActivityScreen.js',
                       '../screens/teacher/handwriting/words/WordProgressScreen.js']) {
      expect(readCode(rel)).not.toMatch(/filterUnfinishedWords|isWordCompleted|completedWordsForLetter/);
    }
  });

  it('the running sequence still advances by index, untouched', () => {
    expect(readCode('./wordWorkflow.js'))
      .toMatch(/export function afterExerciseESuccess\(currentWordIndex, selectedWordCount\)/);
    expect(readCode('./wordWorkflow.js')).not.toMatch(/wordCompletionHistory|isWordCompleted/);
  });
});

// ─── §5 pool exhausted ──────────────────────────────────────────────────

describe('§5 — every word done is a safe state, not a crash or a loop', () => {
  const code = readCode(SELECT);

  it('an empty pool stays on the chooser', () => {
    expect(code).toMatch(/if \(selectedWords\.length === 0\) \{/);
    expect(code).toMatch(/show\(ALL_WORDS_COMPLETED, 'success'\);/);
    expect(code).toMatch(/return;/);
  });

  it('it never navigates into an empty flow', () => {
    const handler = code.slice(code.indexOf('if (!isUnlocked) return;'),
                               code.indexOf('}}', code.indexOf('if (!isUnlocked) return;')));
    expect(handler.indexOf('selectedWords.length === 0'))
      .toBeLessThan(handler.indexOf("navigation.navigate('WordWriting'"));
  });

  it('the message is neutral — an achievement, not an error', () => {
    expect(code).toMatch(/const ALL_WORDS_COMPLETED = 'All words completed!';/);
    expect(code).not.toMatch(/ALL_WORDS_COMPLETED[^;]*error/i);
  });

  it('no spaced repetition was introduced', () => {
    expect(readCode('./wordCompletionHistory.js')).not.toMatch(/interval|repeat|due|schedule|revisit/i);
  });
});

// ─── §4 dates ───────────────────────────────────────────────────────────

describe('§4 / F — dates use the project’s own practice-date rule', () => {
  it('a completion date is Asia/Colombo, never a raw UTC day', () => {
    expect(PRACTICE_TIMEZONE).toBe('Asia/Colombo');
    // 20:00 UTC is already the NEXT practice day in Colombo (+5:30).
    const late = entry('ant', done(), '2026-08-27T20:00:00.000Z');
    expect(completedPracticeDate(late)).toBe(currentPracticeDate(new Date('2026-08-27T20:00:00.000Z')));
    expect(completedPracticeDate(late)).toBe('2026-08-28');
    expect(completedPracticeDate(late)).not.toBe('2026-08-27');   // the UTC day
  });

  it('an unknown or unusable timestamp is null, never a guessed day', () => {
    for (const bad of [{}, { updated_at: null }, { updated_at: '' }, { updated_at: 'nope' }, null]) {
      expect(completedPracticeDate(bad)).toBeNull();
    }
  });

  it('the module introduces no UTC day arithmetic of its own', () => {
    const code = readCode('./wordCompletionHistory.js');
    expect(code).toMatch(/import \{ currentPracticeDate \} from '\.\/letterCycleGuard'/);
    expect(code).not.toMatch(/toISOString\(\)\.s(lice|ubstring)|getUTCDate|setUTCHours/);
  });

  it('the filter itself needs no date — a completion does not expire', () => {
    const code = readCode('./wordCompletionHistory.js');
    // Bounded to THIS function — completedPracticeDate follows it and
    // legitimately mentions Date.
    const at = code.indexOf('export function filterUnfinishedWords');
    const fn = code.slice(at, code.indexOf('\n}', at));
    expect(fn).not.toMatch(/Date|practiceDate|updated_at/);
  });

  it('the backend surfaces updated_at so the client can express that date', () => {
    const svc = fs.readFileSync(
      path.resolve(__dirname, '../../../auriva-backend/src/services/wordWritingService.js'), 'utf8');
    expect(svc).toMatch(/word: progress\.word, status: progress\.activity_status, updated_at: progress\.updated_at,/);
  });
});

// ─── §7 regression ──────────────────────────────────────────────────────

describe('SENTINEL — §7 nothing else changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('what MARKS a word done is untouched', () => {
    const svc = b('src/services/wordWritingService.js');
    expect(svc).toMatch(/if \(!ACTIVITIES\.has\(activity\) \|\| !\['correct', 'good'\]\.includes\(status\)\) return \{ status: 'invalid_input' \};/);
    expect(svc).toMatch(/if \(input\.stage === 'practice_exercise_e' && result\.passed\) \{/);
  });

  it('word scoring and A-E correctness are untouched', () => {
    expect(b('src/services/wordScoringService.js')).toBeTruthy();
    expect(readCode('./wordCompletionHistory.js')).not.toMatch(/score|passed|threshold|dtw/i);
    for (const ex of ['A_WriteFirst', 'B_CircleImage', 'C_FillBlank', 'D_SpellWord', 'E_WriteWord']) {
      expect(readCode(`../components/word/Exercise${ex}.js`))
        .not.toMatch(/wordCompletionHistory|filterUnfinishedWords/);
    }
  });

  it('letter mastery, thresholds and Motor Score are untouched', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/MASTERY_ATTEMPT_NUMBER = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });

  it('pre-writing, remediation and worksheets are untouched', () => {
    expect(readCode('./preWritingTransition.js')).toMatch(/index <= 0 \|\| index >= sequence\.length\) return null;/);
    expect(readCode('./letterRemediationPlan.js')).toMatch(/MAX_REMEDIATION_ACTIVITIES = 2/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
  });

  it('the word catalogue and its ordering are untouched', () => {
    expect(readCode('./wordWorkflow.js'))
      .toMatch(/\.sort\(\(a, b\) => getLengthGroup\(a\.word\) - getLengthGroup\(b\.word\)\)/);
    expect((read('../data/wordData.js').match(/\{ word: '/g) || []).length).toBe(154);
  });

  it('the new module is pure — no I/O, no navigation, no UI', () => {
    const code = readCode('./wordCompletionHistory.js');
    expect(code).not.toMatch(/client\.|ENDPOINTS|navigation|useState|StyleSheet/);
  });
});
