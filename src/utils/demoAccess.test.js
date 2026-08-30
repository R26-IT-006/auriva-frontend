// The demo preview switch.
//
// It exists so a full lowercase -> uppercase -> words flow can be walked
// through in a demonstration without a child having first mastered 52
// letters. The thing this suite has to hold is that it opens a DOOR and
// changes nothing else: the two real unlock rules keep answering exactly what
// they answered before, and a card opened early is visibly a preview rather
// than silently pretending to be earned.

import fs from 'fs';
import path from 'path';

import {
  DEMO_PREVIEW_UNLOCK, parseDemoPreviewFlag, canOpen, isPreview,
  PREVIEW_BADGE, UPPERCASE_ORDER_CAPTION, WORDS_ORDER_CAPTION,
} from '../constants/demoAccess';
import { isWordsUnlocked, REQUIRED_LOWERCASE_COUNT, REQUIRED_UPPERCASE_COUNT } from './wordUnlockGate';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const access        = read('../constants/demoAccess.js');
const letterHome    = read('../screens/teacher/handwriting/LetterHomeScreen.js');
const letterPractice = read('../screens/teacher/handwriting/LetterPracticeScreen.js');

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ─── The switch ─────────────────────────────────────────────────────────

// Loads the module fresh with a chosen environment. Each call is isolated:
// the flag is read once at module load, which is the behaviour under test.
function loadWith(value) {
  let restore;
  jest.resetModules();
  if (value === undefined) {
    restore = process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK;
    delete process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK;
  } else {
    restore = process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK;
    process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK = value;
  }
  const mod = require('../constants/demoAccess');
  if (restore === undefined) delete process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK;
  else process.env.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK = restore;
  return mod;
}

describe('the switch comes from the environment, and defaults OFF', () => {
  it('PRODUCTION DEFAULT: no variable set means preview access is off', () => {
    const mod = loadWith(undefined);
    expect(mod.DEMO_PREVIEW_UNLOCK).toBe(false);
    expect(mod.canOpen(false)).toBe(false);
    expect(mod.isPreview(false)).toBe(false);
  });

  it('an explicit demo configuration enables it', () => {
    expect(loadWith('true').DEMO_PREVIEW_UNLOCK).toBe(true);
    expect(loadWith('TRUE').DEMO_PREVIEW_UNLOCK).toBe(true);
    expect(loadWith('  true  ').DEMO_PREVIEW_UNLOCK).toBe(true);
  });

  it('every malformed or near-miss value fails CLOSED', () => {
    for (const value of ['', ' ', 'false', 'FALSE', '1', '0', 'yes', 'no', 'on',
      'True!', 'truthy', 'undefined', 'null', '{}']) {
      expect(loadWith(value).DEMO_PREVIEW_UNLOCK).toBe(false);
    }
  });

  it('the parser itself accepts nothing but the word true', () => {
    // Exported separately so the rule is testable without depending on how
    // any particular bundler substitutes environment variables.
    expect(parseDemoPreviewFlag('true')).toBe(true);
    expect(parseDemoPreviewFlag('True')).toBe(true);
    for (const junk of [undefined, null, 0, 1, true, false, {}, [], 'yes', '1', 'TRUE1']) {
      expect(parseDemoPreviewFlag(junk)).toBe(false);
    }
  });

  it('is read from EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK, in the form Metro inlines', () => {
    // A direct member access - assigning process.env to a variable first
    // would silently defeat the bundle-time substitution.
    expect(access).toMatch(/process\.env\.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK/);
    expect(access).not.toMatch(/const env = process\.env/);
    // No hand-edited literal remains.
    expect(access).not.toMatch(/export const DEMO_PREVIEW_UNLOCK = (true|false);/);
  });

  it('the local .env is gitignored, so it cannot be committed by accident', () => {
    const ignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
    expect(ignore.split(/\r?\n/).map((l) => l.trim())).toContain('.env');
    // ...and the tracked example documents it as demonstration-only.
    const example = fs.readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8');
    expect(example).toMatch(/EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK/);
    expect(example).toMatch(/Leave this OUT of any build a child will use/);
  });
});

describe('the development warning', () => {
  it('is printed once, at module load, only when preview is active', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      loadWith('true');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatch(/^\[DEMO\] Progression preview access is enabled\./);

      spy.mockClear();
      loadWith(undefined);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('lives at module scope, so it cannot fire per render', () => {
    const warnLines = access.split('\n').filter((l) => l.includes('console.warn'));
    expect(warnLines).toHaveLength(1);
    // Not inside any function - module top level, which runs once per launch.
    const beforeWarn = access.slice(0, access.indexOf('console.warn'));
    const opens = (beforeWarn.match(/\bfunction\b/g) ?? []).length;
    expect(access).toMatch(/if \(DEMO_PREVIEW_UNLOCK && typeof console !== 'undefined'\) \{\n\s*console\.warn/);
    expect(opens).toBeGreaterThanOrEqual(1); // parseDemoPreviewFlag is declared above it
  });

  it('says nothing a child could see - it is a console line, not UI', () => {
    for (const src of [letterHome, letterPractice]) {
      expect(src).not.toMatch(/\[DEMO\]/);
    }
  });
});

describe('the switch', () => {
  it('is documented as something to turn off', () => {
    expect(access).toMatch(/TURN THIS OFF BEFORE THE APP GOES TO A REAL CHILD|Leave this OUT|explicit act/);
    expect(typeof DEMO_PREVIEW_UNLOCK).toBe('boolean');
  });

  it('an earned card is open whichever way the switch is set', () => {
    expect(canOpen(true)).toBe(true);
    expect(isPreview(true)).toBe(false);
  });

  it('an unearned card is open ONLY because of the switch, and says so', () => {
    expect(canOpen(false)).toBe(DEMO_PREVIEW_UNLOCK);
    expect(isPreview(false)).toBe(DEMO_PREVIEW_UNLOCK);
  });

  it('fails closed on junk input rather than treating it as earned', () => {
    for (const junk of [undefined, null, 0, '', NaN]) {
      expect(isPreview(junk)).toBe(DEMO_PREVIEW_UNLOCK);
      expect(canOpen(junk)).toBe(DEMO_PREVIEW_UNLOCK);
    }
  });

  it('touches no progress, mastery or unlock logic of its own', () => {
    const code = stripComments(access);
    expect(code).not.toMatch(/isWordsUnlocked|LetterProgress|mastered|Progress\b/);
    expect(code).not.toMatch(/import .* from/);
    expect(code).not.toMatch(/AsyncStorage|client|fetch\(/);
  });
});

// ─── The real rules are untouched ───────────────────────────────────────

describe('the real unlock rules still decide what is EARNED', () => {
  it('isWordsUnlocked is unchanged and still needs both full counts', () => {
    expect(isWordsUnlocked(26, 26)).toBe(true);
    expect(isWordsUnlocked(26, 25)).toBe(false);
    expect(isWordsUnlocked(25, 26)).toBe(false);
    expect(isWordsUnlocked(0, 0)).toBe(false);
    expect(REQUIRED_LOWERCASE_COUNT).toBe(26);
    expect(REQUIRED_UPPERCASE_COUNT).toBe(26);
  });

  it('LetterHome still derives the earned state from the backend counts', () => {
    expect(letterHome).toMatch(/const wordsUnlocked\s+= isWordsUnlocked\(lowercaseProgress, uppercaseProgress\);/);
    expect(letterHome).toMatch(/const wordsOpen\s+= canOpen\(wordsUnlocked\);/);
    expect(letterHome).toMatch(/const wordsPreview\s+= isPreview\(wordsUnlocked\);/);
  });

  it('LetterPractice still derives the earned state from lowercaseProgress >= 26', () => {
    expect(letterPractice).toMatch(/const lowercaseDone\s+= lowercaseProgress >= 26;/);
    expect(letterPractice).toMatch(/const uppercaseOpen\s+= canOpen\(lowercaseDone\);/);
    expect(letterPractice).toMatch(/const uppercasePreview\s+= isPreview\(lowercaseDone\);/);
  });

  it('nothing in either screen marks progress as complete to open a card', () => {
    for (const src of [letterHome, letterPractice]) {
      expect(src).not.toMatch(/setLowercaseProgress\(26\)|setUppercaseProgress\(26\)/);
    }
  });
});

// ─── The preview state is honest in both directions ─────────────────────

describe('a preview card is neither dressed up as earned nor left looking dead', () => {
  it('says what comes first, in one short present-tense line', () => {
    expect(UPPERCASE_ORDER_CAPTION).toBe('Finish all lowercase letters first.');
    expect(WORDS_ORDER_CAPTION).toBe('Finish all letters first.');
    for (const caption of [UPPERCASE_ORDER_CAPTION, WORDS_ORDER_CAPTION]) {
      // Short enough to read at a glance, and never a "you can't".
      expect(caption.length).toBeLessThan(40);
      expect(caption.split(' ').length).toBeLessThanOrEqual(6);
      expect(caption).not.toMatch(/can't|cannot|not allowed|locked|error|sorry|!/i);
    }
    expect(PREVIEW_BADGE).toBe('Preview');
  });

  it('the earned cues stay keyed to the REAL gate, never to the switch', () => {
    expect(letterHome).toMatch(/wordsUnlocked \? 'Ready to practise words'/);
    expect(letterHome).toMatch(/<CardLandscape variant="words" locked=\{!wordsUnlocked\} \/>/);
    expect(letterPractice).toMatch(/<Text style=\{styles\.pillSubLabel\}>Ready to go!/);
  });

  it('a preview card keeps the locked guidance and shows the Preview badge', () => {
    expect(letterHome).toContain('Complete all 52 letters to unlock words');
    expect(letterHome).toMatch(/\{PREVIEW_BADGE\}/);
    expect(letterPractice).toMatch(/\{UPPERCASE_ORDER_CAPTION\}/);
    expect(letterPractice).toMatch(/\{PREVIEW_BADGE\}/);
  });

  it('a not-yet-earned Words card keeps a visible padlock even when preview is available', () => {
    expect(letterHome).toMatch(/name=\{wordsUnlocked \? 'book-outline' : 'lock-closed'\}/);
    expect(letterPractice).toMatch(/name=\{uppercaseOpen \? 'arrow-up-circle-outline' : 'lock-closed'\}/);
    // The grey "locked" styling is still there — for the switch-off build.
    expect(letterHome).toMatch(/'#F2F2F2', '#E6E6E6'/);
    expect(letterPractice).toMatch(/styles\.uppercaseLocked/);
  });

  it('the preview styling keeps the card the same size, so nothing reflows', () => {
    // A layout that jumps between states is exactly what an ASD-friendly
    // screen must not do: preview adds a border and colours, never a size.
    const previewCard = letterHome.slice(letterHome.indexOf('  previewCard: {'),
      letterHome.indexOf('  wordsCard: {'));
    expect(previewCard).not.toMatch(/width|height|padding|margin|flex/);
    const previewPill = letterPractice.slice(letterPractice.indexOf('  previewPill: {'),
      letterPractice.indexOf('  previewTitle:'));
    expect(previewPill).not.toMatch(/width|height|padding|margin|flex/);
  });

  it('a screen reader hears the same thing the caption says', () => {
    expect(letterHome).toContain("Words, locked. Complete all 52 letters to unlock words.${wordsPreview ? ' Preview available.' : ''}");
    expect(letterPractice).toMatch(/Uppercase, preview\. \$\{UPPERCASE_ORDER_CAPTION\}/);
  });
});

// ─── One flag, and no way around it ────────────────────────────────────

describe('there is exactly one switch, and no alternate bypass', () => {
  it('both preview entry points read the SAME central flag', () => {
    for (const src of [letterHome, letterPractice]) {
      expect(src).toMatch(/from '\.\.\/\.\.\/constants\/demoAccess'/);
      // Neither screen defines a preview flag of its own...
      expect(src).not.toMatch(/const \w*(PREVIEW|Preview|preview)\w*\s*=\s*(true|false)/);
      // ...nor reads the environment directly.
      expect(src).not.toMatch(/process\.env/);
    }
  });

  it('no second demo/dev flag exists anywhere in the app', () => {
    const walk = (dir, acc = []) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(full);
      }
      return acc;
    };
    const files = walk(path.resolve(__dirname, '..'));
    const owners = files.filter((f) =>
      /DEMO_PREVIEW_UNLOCK|EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK/.test(fs.readFileSync(f, 'utf8')));
    // Only the module itself declares it; the screens use canOpen/isPreview.
    expect(owners.map((f) => path.basename(f))).toEqual(['demoAccess.js']);
  });

  it('the tap sites are the ONLY thing the flag reaches', () => {
    for (const [src, open] of [[letterHome, 'wordsOpen'], [letterPractice, 'uppercaseOpen']]) {
      // Used to permit the tap...
      expect(src).toMatch(new RegExp(`${open} &&`));
      // ...and nowhere else that could change state.
      expect(src).not.toMatch(new RegExp(`set\\w+\\(${open}`));
    }
  });

  it('turning the flag off restores strict gating at both entry points', () => {
    const off = loadWith(undefined);
    // Words: only the real rule can open it.
    expect(off.canOpen(isWordsUnlocked(26, 26))).toBe(true);
    expect(off.canOpen(isWordsUnlocked(26, 25))).toBe(false);
    expect(off.canOpen(isWordsUnlocked(0, 0))).toBe(false);
    // Uppercase: only lowercaseProgress >= 26 can open it.
    expect(off.canOpen(26 >= 26)).toBe(true);
    expect(off.canOpen(25 >= 26)).toBe(false);
    // And nothing wears the preview state, so the UI is the pre-feature UI.
    expect(off.isPreview(false)).toBe(false);
    expect(off.isPreview(true)).toBe(false);
  });
});

// ─── The demo flow it exists to enable ──────────────────────────────────

describe('the full demo flow is reachable', () => {
  it('Uppercase opens from LetterPractice with the same params as an earned tap', () => {
    expect(letterPractice).toMatch(
      /uppercaseOpen && goToLetterScreen\('uppercase',\s*\n\s*\{ student, theme, letterSequence, motorProfile \},/);
  });

  it('Words opens from LetterHome to the same screen an earned tap opens', () => {
    expect(letterHome).toMatch(/wordsOpen && navigation\.navigate\('WordLetterSelect', \{ student, theme \}\)/);
  });

  it('no second entry point was added — the cards are still the only way in', () => {
    expect((letterHome.match(/navigate\('WordLetterSelect'/g) ?? []).length).toBe(1);
    expect((letterPractice.match(/goToLetterScreen\('uppercase'/g) ?? []).length).toBe(1);
  });
});
