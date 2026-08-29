// British English pronunciation across the writing module.
//
// Standard Southern British (RP/SSB), non-rhotic. Two things had to be true
// and neither was: the transcription shown under a letter had to be British,
// and the voice reading it aloud had to be the same accent. The table was
// partly American and every Speech.speak asked for en-US.

import fs from 'fs';
import path from 'path';

import {
  LETTER_NAMES, PRIMARY_SOUND, ALSO_SOUNDS,
  letterName, letterSound, letterNameDisplay,
} from '../constants/letterPhonetics';
import {
  SPEECH_LOCALE_EN, SPEECH_LOCALE_SI, ukSpeechOptions, ukLetterSpeechOptions,
} from '../constants/speechLocale';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

const LOWERCASE = '../screens/handwriting/LetterWritingScreen.js';
const UPPERCASE = '../screens/handwriting/uppercase/UppercaseWritingScreen.js';
const SPEAKING = [
  LOWERCASE, UPPERCASE,
  '../screens/handwriting/words/WordWritingScreen.js',
  '../screens/handwriting/words/WordActivityScreen.js',
  '../context/LearningSessionContext.js',
];

// ─── non-rhotic, and no American vowels ─────────────────────────────────

describe('the letter names are Standard Southern British', () => {
  it('r is /ɑː/ — non-rhotic, no American /r/', () => {
    expect(letterName('r')).toBe('ɑː');
    expect(letterName('r')).not.toBe('ɑːr');
  });

  it('o is /əʊ/ — the British GOAT vowel, not American /oʊ/', () => {
    expect(letterName('o')).toBe('əʊ');
    expect(letterName('o')).not.toBe('oʊ');
  });

  it('the DRESS letters use /e/, the British convention, not /ɛ/', () => {
    expect(letterName('f')).toBe('ef');
    expect(letterName('l')).toBe('el');
    expect(letterName('m')).toBe('em');
    expect(letterName('n')).toBe('en');
    expect(letterName('s')).toBe('es');
    expect(letterName('x')).toBe('eks');
    expect(letterName('z')).toBe('zed');
  });

  it('z is "zed", never the American "zee"', () => {
    expect(letterName('z')).toBe('zed');
    expect(letterName('z')).not.toMatch(/ziː/);
  });

  it('NO name contains a rhotic /r/ before a consonant or at the end', () => {
    for (const ch of ALPHABET) {
      expect(letterName(ch)).not.toMatch(/r$/);
    }
  });

  it('no American phoneme appears anywhere in the table', () => {
    // /oʊ/ GOAT and /ɛ/ DRESS are the GA conventions this replaced.
    for (const ch of ALPHABET) {
      const name = letterName(ch);
      expect(name).not.toMatch(/oʊ/);
      expect(name).not.toMatch(/ɛ/);
    }
  });

  it('every letter has a name, and it is pure IPA', () => {
    expect(Object.keys(LETTER_NAMES).sort()).toEqual([...ALPHABET].sort());
    for (const ch of ALPHABET) {
      expect(letterName(ch).length).toBeGreaterThan(0);
      expect(letterName(ch)).not.toMatch(/[[\]/]/);   // brackets are added at display time
    }
  });
});

// ─── the two screens must agree ─────────────────────────────────────────

describe('lowercase and uppercase share one source', () => {
  it('neither screen keeps a private table any more', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      expect(readCode(rel)).not.toMatch(/const PHONETICS = \{/);
    }
  });

  it('the same letter in either case gives the identical name', () => {
    for (const ch of ALPHABET) {
      expect(letterName(ch)).toBe(letterName(ch.toUpperCase()));
      expect(letterSound(ch)).toBe(letterSound(ch.toUpperCase()));
      expect(letterNameDisplay(ch)).toBe(letterNameDisplay(ch.toUpperCase()));
    }
  });

  it('THE DRIFT — w is Latin throughout, no Cyrillic lookalike', () => {
    // The uppercase copy had U+0443 CYRILLIC SMALL LETTER U inside 'dʌbljуː'.
    expect(letterName('w')).toBe('ˈdʌbljuː');
    for (const ch of ALPHABET) {
      for (const cp of [...letterName(ch)]) {
        expect(cp.codePointAt(0)).toBeLessThan(0x0400);   // no Cyrillic block
      }
    }
  });

  it('display wraps the name in brackets exactly as before', () => {
    expect(letterNameDisplay('b')).toBe('[biː]');
    expect(letterNameDisplay('z')).toBe('[zed]');
    expect(letterNameDisplay('?')).toBe('');
    expect(letterNameDisplay(undefined)).toBe('');
  });
});

// ─── name vs sound, and no schwa ────────────────────────────────────────

describe('letter SOUND is separate from letter NAME', () => {
  it('the two are genuinely different values', () => {
    expect(letterName('b')).toBe('biː');
    expect(letterSound('b')).toBe('b');
    expect(letterName('m')).toBe('em');
    expect(letterSound('m')).toBe('m');
  });

  it('consonant sounds carry NO trailing schwa — /b/, not "buh"', () => {
    for (const ch of 'bdfhjklmnprstvwz'.split('')) {
      const sound = letterSound(ch);
      expect(sound).not.toMatch(/ə$/);
      expect(sound).not.toMatch(/uh|əh/);
    }
    expect(letterSound('b')).toBe('b');
    expect(letterSound('t')).toBe('t');
    expect(letterSound('m')).toBe('m');
  });

  it('short vowels use the British values', () => {
    expect(letterSound('a')).toBe('æ');   // apple
    expect(letterSound('e')).toBe('e');   // egg
    expect(letterSound('i')).toBe('ɪ');   // ink
    expect(letterSound('o')).toBe('ɒ');   // orange — /ɒ/, not American /ɔː/
    expect(letterSound('u')).toBe('ʌ');   // up
  });

  it('every letter has a sound', () => {
    expect(Object.keys(PRIMARY_SOUND).sort()).toEqual([...ALPHABET].sort());
    for (const ch of ALPHABET) expect(letterSound(ch).length).toBeGreaterThan(0);
  });
});

// ─── context-sensitive letters ──────────────────────────────────────────

describe('a letter does not have exactly one sound', () => {
  it('c, g, q, x and y all carry alternates', () => {
    for (const ch of ['c', 'g', 'q', 'x', 'y']) {
      expect(ALSO_SOUNDS[ch]).toBeDefined();
      expect(ALSO_SOUNDS[ch].length).toBeGreaterThan(0);
    }
  });

  it('the primary values are the ones taught first', () => {
    expect(letterSound('c')).toBe('k');    // cat
    expect(letterSound('g')).toBe('ɡ');    // goat
    expect(letterSound('q')).toBe('kw');   // queen
    expect(letterSound('x')).toBe('ks');   // box
    expect(letterSound('y')).toBe('j');    // yak
  });

  it('the alternates are the real ones', () => {
    const sounds = (ch) => ALSO_SOUNDS[ch].map((a) => a.sound);
    expect(sounds('c')).toContain('s');     // city
    expect(sounds('g')).toContain('dʒ');    // engine
    expect(sounds('q')).toContain('kj');    // queue
    expect(sounds('x')).toContain('z');     // xylophone
    expect(sounds('y')).toContain('ɪ');     // happy
  });

  it('every worked example is a word this app actually teaches', () => {
    const wordData = read('../constants/wordData.js');
    for (const [, alts] of Object.entries(ALSO_SOUNDS)) {
      for (const alt of alts) {
        if (alt.example === null) continue;   // deliberately flagged as absent
        expect(wordData).toContain(`word: '${alt.example}'`);
      }
    }
  });

  it('an alternate with no example in the word list says so rather than inventing one', () => {
    expect(ALSO_SOUNDS.c[0].example).toBeNull();
    expect(ALSO_SOUNDS.c[0].note).toMatch(/city/);
  });

  it('the BATH split is recorded — /ɑː/ in British where American has /æ/', () => {
    expect(ALSO_SOUNDS.a.map((x) => x.sound)).toContain('ɑː');
    expect(ALSO_SOUNDS.a[0].example).toBe('grass');
  });
});

// ─── the voice ──────────────────────────────────────────────────────────

describe('speech asks for British English', () => {
  it('the locale is a BCP-47 tag, not a named voice', () => {
    expect(SPEECH_LOCALE_EN).toBe('en-GB');
    expect(SPEECH_LOCALE_SI).toBe('si-LK');
  });

  it('rate and pitch are preserved — only the language is set', () => {
    expect(ukSpeechOptions({ rate: 0.8, pitch: 1.0 }))
      .toEqual({ rate: 0.8, pitch: 1.0, language: 'en-GB' });
    expect(ukSpeechOptions()).toEqual({ language: 'en-GB' });
  });

  it('target-letter speech uses one calm UK configuration', () => {
    expect(ukLetterSpeechOptions())
      .toEqual({ rate: 0.75, pitch: 0.9, language: 'en-GB' });
  });

  it('no named voice id is hardcoded anywhere — a missing id speaks nothing', () => {
    const code = readCode('../constants/speechLocale.js');
    expect(code).not.toMatch(/voice:/);
    for (const rel of SPEAKING) expect(readCode(rel)).not.toMatch(/voice:\s*'/);
  });

  it.each(SPEAKING)('%s no longer asks for en-US', (rel) => {
    expect(readCode(rel)).not.toMatch(/'en-US'/);
  });

  it.each(SPEAKING)('%s routes English speech through the shared locale', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/import \{ [^}]*(?:SPEECH_LOCALE_EN|ukLetterSpeechOptions)[^}]*\} from '[^']*speechLocale'/);
    // Every English Speech.speak names the locale — none silently inherits
    // whatever the device happens to be set to.
    for (const call of code.match(/Speech\.speak\([\s\S]*?\);/g) || []) {
      expect(call).toMatch(/SPEECH_LOCALE_EN|ukSpeechOptions\(|ukLetterSpeechOptions\(/);
    }
  });

  it('the pre-writing recording fallback still uses British English', () => {
    const screen = readCode('../screens/handwriting/PreWritingActivityScreen.js');
    const hook = readCode('./useInstructionAudio.js');
    expect(screen).not.toMatch(/Speech\.speak\(PRE_WRITING_INSTRUCTION/);
    expect(screen).toMatch(/fallbackText:\s*PRE_WRITING_INSTRUCTION\.en/);
    expect(hook).toMatch(/Speech\.speak\(fallbackText, \{/);
    expect(hook).toMatch(/\.\.\.ukSpeechOptions\(\)/);
  });

  it('Sinhala speech is untouched', () => {
    // The concept module speaks si-LK; nothing here changed that.
    const concept = readCode('../screens/teacher/concept/tier1/ConceptActivityScreen.js');
    expect(concept).toMatch(/'si-LK'/);
  });
});

// ─── nothing else moved ─────────────────────────────────────────────────

describe('SENTINEL — pronunciation only', () => {
  it('the phonetics module holds no geometry, scoring or copy', () => {
    const code = readCode('../constants/letterPhonetics.js');
    expect(code).not.toMatch(/CANVAS|fx:|fy:|score|mastery|threshold/i);
    expect(code).not.toMatch(/CHILD_INSTRUCTIONS|Speech/);
  });

  it('the displayed instruction copy is unchanged', () => {
    const { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } = require('../constants/childInstructions');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.WATCH_TRACE].en).toBe('Watch and trace');
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.WRITE_WORD].si).toBe('වචනය ලියන්න');
  });

  it('letter paths are untouched', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      expect(readCode(rel)).toMatch(/const LETTER_PATHS = \{/);
    }
  });

  it('NO phonetic/IPA line is rendered to the child on either screen', () => {
    // The handwriting screens are for writing practice, not phonics. The
    // pronunciation DATA stays in letterPhonetics.js for a future activity;
    // it is simply not shown here, and was NOT swapped for letterSound.
    for (const rel of [LOWERCASE, UPPERCASE, '../components/handwriting/LetterWritingStage.js']) {
      const code = readCode(rel);
      expect(code).not.toMatch(/phonetic/i);
      expect(code).not.toMatch(/letterNameDisplay|letterSound|letterName\(/);
      expect(code).not.toMatch(/PRIMARY_SOUND|ALSO_SOUNDS|LETTER_NAMES/);
      // no IPA character reaches a rendered string
      expect(code).not.toMatch(/[ɑɒæɪʊʌəʒʃŋθðːˈ]/);
    }
  });

  it('the child sees the target and ONE support instruction, nothing else', () => {
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    const texts = stage.match(/\{(targetInstruction|instruction)\??\.(en|si)\}/g) || [];
    expect(texts.sort()).toEqual([
      '{instruction?.en}', '{instruction?.si}',
      '{targetInstruction.en}', '{targetInstruction.si}',
    ]);
  });

  it('the removed row was not backfilled with another technical label', () => {
    const stage = readCode('../components/handwriting/LetterWritingStage.js');
    expect(stage).not.toMatch(/styles\.phoneticText/);
    expect(stage).not.toMatch(/phoneticText: \{/);
    // The badge still holds exactly two lines — EN then SI.
    const badge = stage.slice(stage.indexOf('styles.attemptBadge'));
    expect((badge.slice(0, 400).match(/<Text /g) || []).length).toBe(2);
  });

  it('the pronunciation data is RETAINED in full', () => {
    expect(Object.keys(LETTER_NAMES)).toHaveLength(26);
    expect(Object.keys(PRIMARY_SOUND)).toHaveLength(26);
    expect(letterName('c')).toBe('siː');
    expect(letterSound('c')).toBe('k');
    expect(ALSO_SOUNDS.g[0].sound).toBe('dʒ');
    expect(typeof letterNameDisplay).toBe('function');
  });

  it('what gets SPOKEN for a letter is still the letter, not its transcription', () => {
    for (const rel of [LOWERCASE, UPPERCASE]) {
      const code = readCode(rel);
      expect(code).toMatch(/Speech\.speak\(spoken\.toUpperCase\(\)/);
      expect(code).not.toMatch(/Speech\.speak\(phonetic/);
    }
  });

  it('scoring, mastery and thresholds are untouched', () => {
    const b = (rel) => fs.readFileSync(path.resolve(__dirname, '../../../auriva-backend', rel), 'utf8');
    expect(b('src/utils/motorScore.js')).toMatch(/accuracy:\s+0\.35/);
    expect(b('src/config/masteryPolicy.js')).toMatch(/NORMAL_PRACTICE_MASTERY_THRESHOLD = 70/);
  });

  it('the practice word list itself was not edited', () => {
    const wordData = read('../constants/wordData.js');
    // 154, not 152: two entries contain a space ('ice cream', 'x-mas tree')
    // and are missed by a [a-z-]+ pattern.
    expect((wordData.match(/\{ word: '/g) || []).length).toBe(154);
    expect(wordData).not.toMatch(/ipa|phonetic/i);
  });
});
