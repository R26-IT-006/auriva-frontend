// Every word speaks, in the word the child is actually looking at.
//
// ── Why only ANT spoke ──────────────────────────────────────────────────
// Two hardcoded mutes, in two screens, neither of them a stale-closure bug:
//
//   WordActivityScreen   both the auto-speech effect AND the speaker button
//                        were wrapped in `if (currentWord.word === 'ant')`.
//   WordWritingScreen    `MUTED_WRITING_WORDS = new Set(['axe','album','arrow'])`
//                        returned early for those three.
//
// The current word was resolved correctly at both sites the whole time. They
// were allow/deny lists.

jest.mock('../api/client', () => ({ get: jest.fn(), post: jest.fn() }));

import fs from 'fs';
import path from 'path';

import { spokenWord, spokenLetter, canSpeakWord } from './wordSpeech';
import WORD_DATA from '../constants/wordData';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const WORD_A = '../screens/handwriting/words/WordActivityScreen.js';
const WORD_W = '../screens/handwriting/words/WordWritingScreen.js';
const STAGE  = '../components/handwriting/WordWritingStage.js';

// ─── §11 the words themselves ───────────────────────────────────────────

describe('§11 — every word maps to its own spoken text', () => {
  it.each([['ANT', 'ant'], ['APPLE', 'apple'], ['BALL', 'ball'],
           ['CAT', 'cat'], ['DOG', 'dog']])('%s speaks %s', (display, spoken) => {
    expect(spokenWord(display)).toBe(spoken);
  });

  it('changing word changes the spoken value', () => {
    expect(spokenWord('ANT')).not.toBe(spokenWord('APPLE'));
    expect(spokenWord({ word: 'ant' })).toBe('ant');
    expect(spokenWord({ word: 'apple' })).toBe('apple');
  });

  it('§3 normalisation is lookup-side only — display casing is not touched', () => {
    expect(spokenWord('Ant')).toBe('ant');
    expect(spokenWord('  APPLE  ')).toBe('apple');
    // The screens still render their own casing.
    expect(readCode(WORD_A)).toMatch(/\{currentWord\.word\.toUpperCase\(\)\}/);
  });

  it('hyphens and spaces read as words, not spellings', () => {
    expect(spokenWord('x-ray')).toBe('x ray');
    expect(spokenWord('yo-yo')).toBe('yo yo');
    expect(spokenWord('zig-zag')).toBe('zig zag');
    expect(spokenWord('ice cream')).toBe('ice cream');
    expect(spokenWord('x-mas  tree')).toBe('x mas tree');
  });

  it('nothing sayable yields an empty string — callers must not speak it', () => {
    for (const bad of ['', '   ', '-', null, undefined, {}, 42, { word: null }]) {
      expect(spokenWord(bad)).toBe('');
      expect(canSpeakWord(bad)).toBe(false);
    }
    expect(canSpeakWord('ant')).toBe(true);
  });

  it('a spelled letter is a single letter or nothing', () => {
    expect(spokenLetter('a')).toBe('A');
    expect(spokenLetter('Z')).toBe('Z');
    for (const bad of ['-', ' ', '', 'ab', '4', null, undefined]) {
      expect(spokenLetter(bad)).toBe('');
    }
  });

  it('§10 all 154 catalogue words produce a non-empty spoken string', () => {
    expect(WORD_DATA).toHaveLength(154);
    const invalid = WORD_DATA.filter((entry) => !canSpeakWord(entry.word))
      .map((entry) => entry.word);
    expect(invalid).toEqual([]);
    for (const entry of WORD_DATA) {
      expect(spokenWord(entry.word)).toBe(spokenWord(entry.word.toUpperCase()));
    }
  });
});

// ─── §1 / §2 the mutes are gone ─────────────────────────────────────────

describe('§1 / §2 — no word is muted, and none is hardcoded', () => {
  it('WordActivityScreen no longer gates on a single word', () => {
    const code = readCode(WORD_A);
    expect(code).not.toMatch(/currentWord\.word === 'ant'/);
    expect(code).not.toMatch(/=== 'ant'/);
  });

  it('WordWritingScreen no longer keeps a mute list', () => {
    const code = readCode(WORD_W);
    expect(code).not.toMatch(/MUTED_WRITING_WORDS/);
    expect(code).not.toMatch(/'axe', 'album', 'arrow'/);
  });

  it('§2 no speech source is an index or a literal', () => {
    for (const rel of [WORD_A, WORD_W]) {
      const code = readCode(rel);
      for (const call of code.match(/Speech\.speak\([^;]*;/g) || []) {
        expect(call).not.toMatch(/selectedWords\[0\]|sequence\[0\]|letterWords\[0\]/);
        expect(call).not.toMatch(/Speech\.speak\('/);          // no literal text
        expect(call).not.toMatch(/route\.params\.word/);
      }
    }
  });

  it('every word-speech call goes through the normaliser', () => {
    const a = readCode(WORD_A);
    expect((a.match(/Speech\.speak\(spoken,/g) || [])).toHaveLength(2);
    const w = readCode(WORD_W);
    expect(w).toMatch(/Speech\.speak\(spokenLetter\(ltr\),/);
    expect(w).toMatch(/Speech\.speak\(spoken, \{ rate: 0\.82/);
  });
});

// ─── §4 / §5 when it speaks ─────────────────────────────────────────────

describe('§4 / §5 — press time, and word change only', () => {
  const code = readCode(WORD_A);

  it('§4 the speaker resolves the word inside its handler', () => {
    expect(code).toMatch(/onPress=\{\(\) => \{\s*const spoken = spokenWord\(currentWord\);/);
    expect(code).toMatch(/if \(!spoken\) return;/);
  });

  it('§9 a repeat tap stops the previous utterance first', () => {
    const at = code.indexOf('const spoken = spokenWord(currentWord);');
    const handler = code.slice(at, at + 400);
    expect(handler.indexOf('Speech.stop()')).toBeLessThan(handler.indexOf('Speech.speak('));
    // The auto-speech effect does the same, and stops on unmount.
    expect(code).toMatch(/Speech\.stop\(\);\s*Speech\.speak\(spoken,/);
    expect(code).toMatch(/return \(\) => Speech\.stop\(\);/);
  });

  it('§5 the effect depends on the current word and nothing else', () => {
    expect(code).toMatch(/\}, \[currentWord\?\.word\]\);/);
    const at = code.indexOf('const spoken = spokenWord(currentWord);');
    const effect = code.slice(at, code.indexOf('}, [currentWord?.word]);', at));
    for (const unrelated of ['hasDrawn', 'allPaths', 'currentPath', 'activityFeedback',
                             'canClearCanvas', 'exStatus', 'exIdx']) {
      expect(effect).not.toMatch(new RegExp(unrelated));
    }
  });

  it('§7 the same word keeps speaking as A→B→C→D→E advance', () => {
    // The exercise index is not a dependency, so moving between exercises
    // does not re-trigger — and does not change what would be spoken.
    expect(code).not.toMatch(/\}, \[currentWord\?\.word, exIdx\]\)/);
    expect(code).toMatch(/const \{ selectedLetter: letter, selectedWords: letterWords, currentWordIndex: wordIdx, currentWord \} = resolveWordSession\(route\.params\);/);
  });

  it('§8 Word Writing speaks the word it displays', () => {
    const w = readCode(WORD_W);
    // The stage's speaker calls back into the screen's current spellWord.
    expect(w).toMatch(/onSpeakWord=\{\(\) => spellWordRef\.current\?\.\(\)\}/);
    expect(w).toMatch(/spellWordRef\.current = spellWord;/);
    expect(w).toMatch(/const spellWord = useCallback\(\(w = word\) => \{/);
    expect(w).toMatch(/\}, \[word\]\);/);
    // And the stage renders that same word.
    expect(readCode(STAGE)).toMatch(/const targetInstruction = writeWordInstruction\(displayWord\);/);
  });
});

// ─── §6 UK English ──────────────────────────────────────────────────────

describe('§6 — UK English throughout', () => {
  it('every word-speech call uses the shared en-GB locale', () => {
    for (const rel of [WORD_A, WORD_W]) {
      const code = readCode(rel);
      for (const call of code.match(/Speech\.speak\([^;]*;/g) || []) {
        expect(call).toMatch(/SPEECH_LOCALE_EN/);
      }
      expect(code).not.toMatch(/'en-US'/);
      expect(code).not.toMatch(/voice:\s*'/);
    }
    expect(readCode('../constants/speechLocale.js')).toMatch(/SPEECH_LOCALE_EN = 'en-GB'/);
  });

  it('concept Sinhala is untouched', () => {
    expect(readCode('../screens/teacher/concept/tier1/ConceptActivityScreen.js'))
      .toMatch(/'si-LK'/);
  });

  it('the normaliser knows nothing about locales or engines', () => {
    const code = readCode('./wordSpeech.js');
    expect(code).not.toMatch(/Speech|expo-speech|en-GB|locale|voice/i);
  });
});

// ─── §12 feedback architecture regression ───────────────────────────────

describe('§12 — the feedback architecture is untouched', () => {
  it('Word Writing still shows the avatar, and only on submit', () => {
    const code = readCode(WORD_W);
    expect(code).toMatch(/<AttemptAvatarFeedback/);
    expect(code).not.toMatch(/ResultGifFeedback/);
    expect((code.match(/setFeedbackData\((?!null\))/g) || [])).toHaveLength(1);
    expect(code).toMatch(/setFeedbackData\(getFeedbackFromScore\(saved\?\.score\)\)/);
  });

  it('A–D still use the GIF and E still uses the avatar', () => {
    const code = readCode(WORD_A);
    expect(code).toMatch(/const isWriting = ex === 'E';/);
    expect(code).toMatch(/<ResultGifFeedback/);
    expect(code).toMatch(/\{activityFeedback\?\.isWriting && \(/);
  });

  it('concept still uses the shared GIF component', () => {
    for (const rel of ['../screens/teacher/concept/tier1/ConceptActivityScreen.js',
                       '../screens/teacher/concept/tier2/Tier2DragDropScreen.js']) {
      expect(readCode(rel)).toMatch(/<ResultGifFeedback/);
    }
  });

  it('audio never raises or clears a verdict', () => {
    for (const rel of [WORD_A, WORD_W]) {
      const code = readCode(rel);
      for (const call of code.match(/Speech\.speak\([^;]*;/g) || []) {
        expect(call).not.toMatch(/setFeedbackData|setActivityFeedback/);
      }
    }
  });
});

// ─── §13 regression ─────────────────────────────────────────────────────

describe('SENTINEL — §13 nothing else changed', () => {
  const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');

  it('filtering, correctness and progress semantics are unchanged', () => {
    expect(readCode('./wordCompletionHistory.js')).toMatch(/WORD_EXERCISES\.every\(/);
    expect(readCode(WORD_A)).toMatch(/saveWordActivity\(\{ student, word: currentWord\.word, activity: ex, status: result \}\)/);
    expect(readCode(WORD_A)).toMatch(/const result\s+= wasCorrect \? 'correct' : 'good';/);
  });

  it('the stored word is never rewritten', () => {
    // Speech normalises a COPY; the value saved and displayed is the original.
    expect(readCode(WORD_A)).toMatch(/word: currentWord\.word,/);
    expect((read('../constants/wordData.js').match(/\{ word: '/g) || []).length).toBe(154);
  });

  it('canvas, touch mapping and scoring are unchanged', () => {
    expect(readCode(WORD_W)).toMatch(/mapTouchToCanvas\(\{/);
    expect(readCode(WORD_W)).toMatch(/submitWordAttempt\(\{student,actionId:submitActionIdRef\.current/);
    expect(readCode('./touchPointSanitize.js'))
      .toMatch(/clampToCanvas\(lx - border, ly - border, w, h\)/);
    expect(readCode('../constants/wordCanvasLayout.js'))
      .toMatch(/export const CANVAS_W = SCREEN_W - COL_L - PAD \* 2;/);
  });

  it('UI dimensions, images, navigation and worksheets are unchanged', () => {
    const { SUPPORT_IMAGE } = require('../components/word/wordActivityLayout');
    expect(SUPPORT_IMAGE.imageSize).toBe(230);
    expect(readCode('./wordImageResolver.js')).toMatch(/export function resolveWordImageKey/);
    expect(readCode(WORD_A)).toMatch(/\?\? 'WordLetterSelect'/);
    expect(readCode('./worksheetLayoutA4.js')).toMatch(/marginMm: 13/);
  });

  it('mastery, DTW and Motor Score are unchanged', () => {
    const policy = b('src/config/masteryPolicy.js');
    expect(policy).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
    expect(policy).toMatch(/ATTEMPTS_PER_CYCLE = 3/);
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
  });
});
