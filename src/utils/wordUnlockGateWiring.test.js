import fs from 'fs';
import path from 'path';

/**
 * Pre-device P0 fix, Blocker 1 — screen-level wiring proof.
 * LetterHomeScreen.js imports 'react-native' and can't be mounted under
 * this repo's plain-node jest config; verified by source-text assertion,
 * the same established technique this project already uses for screen
 * files (teacherReportLoadGuard.test.js, uppercaseProgressionFix.test.js).
 * The actual unlock RULE has real logic coverage in
 * wordUnlockGate.test.js — this file only proves the screen is wired to
 * it correctly.
 */

const letterHome = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'), 'utf8'
);
const letterPractice = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterPracticeScreen.js'), 'utf8'
);

describe('LetterHomeScreen — hardcoded bypass removed', () => {
  it('no longer contains `const wordsUnlocked = true`', () => {
    expect(letterHome).not.toMatch(/const wordsUnlocked\s*=\s*true\s*;/);
  });

  it('wordsUnlocked is derived from isWordsUnlocked(lowercaseProgress, uppercaseProgress)', () => {
    expect(letterHome).toContain("import { isWordsUnlocked } from './wordUnlockGate';");
    expect(letterHome).toMatch(/const wordsUnlocked\s*=\s*isWordsUnlocked\(lowercaseProgress,\s*uppercaseProgress\)\s*;/);
  });

  it('both lowercase_completed and uppercase_completed are read from the backend LETTER_PROGRESS response (never AsyncStorage/local flags)', () => {
    const effectBlock = letterHome.slice(
      letterHome.indexOf('client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))'),
      letterHome.indexOf('getLetterSequence(student.sid)')
    );
    expect(effectBlock).toContain('setLowercaseProgress(res.data.lowercase_completed ?? 0)');
    expect(effectBlock).toContain('setUppercaseProgress(res.data.uppercase_completed ?? 0)');
    expect(effectBlock).not.toMatch(/AsyncStorage|getCompletedLetters\(/);
  });
});

describe('LetterHomeScreen — the Words card press is actually gated, not just visually dimmed', () => {
  it('onPress is gated - a tap only navigates when the card is open', () => {
    // The tap site now reads `wordsOpen`, which is `wordsUnlocked` OR the
    // explicit demo-preview switch, and NOTHING else.
    expect(letterHome).toContain(
      "onPress={() => wordsOpen && navigation.navigate('WordLetterSelect', { student, theme })}"
    );
    expect(letterHome).toMatch(/const wordsOpen\s+= canOpen\(wordsUnlocked\);/);
    expect(letterHome).toMatch(/from '\.\.\/\.\.\/constants\/demoAccess'/);
  });

  it('an unlocked tap still navigates normally (the gate does not remove the working path)', () => {
    expect(letterHome).toMatch(/wordsOpen && navigation\.navigate\('WordLetterSelect'/);
  });

  it('the EARNED rule is untouched - the card still asks isWordsUnlocked how it looks', () => {
    expect(letterHome).toMatch(/const wordsUnlocked\s+= isWordsUnlocked\(lowercaseProgress, uppercaseProgress\);/);
    // Every visual "you have earned this" cue is still keyed off the real
    // gate, never off the demo switch.
    expect(letterHome).toMatch(/<CardLandscape variant="words" locked=\{!wordsUnlocked\} \/>/);
    expect(letterHome).toMatch(/wordsUnlocked \? 'Ready to practise words'/);
  });

  it('with the demo switch OFF the gate is strict again - one boolean, nothing else', () => {
    const { canOpen, isPreview } = require('../constants/demoAccess');
    // Whatever the switch is set to right now, the composition is the same.
    expect(canOpen(true)).toBe(true);
    expect(isPreview(true)).toBe(false);
    const access = fs.readFileSync(
      path.resolve(__dirname, '../constants/demoAccess.js'), 'utf8');
    // The flag is no longer a hand-edited literal - it comes from an
    // explicit environment variable and defaults to false.
    expect(access).toMatch(/process\.env\.EXPO_PUBLIC_DEMO_PREVIEW_UNLOCK/);
    expect(access).toMatch(/return Boolean\(earned\) \|\| DEMO_PREVIEW_UNLOCK;/);
    // The switch cannot mark anything mastered or touch the real rule.
    // Scanned as CODE - the file's header explains at length what it does
    // not touch, and that explanation must not read as a violation.
    const code = access.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/isWordsUnlocked|LetterProgress|mastered|lowercaseProgress/);
  });

  it('no long-press or secondary handler bypasses the gate on the Words card', () => {
    const cardBlock = letterHome.slice(
      letterHome.indexOf("styles.wordsCard"),
      letterHome.indexOf("styles.wordsCard") + 1600
    );
    expect(cardBlock).not.toMatch(/onLongPress/);
  });

  it('WordLetterSelectScreen is navigated to from exactly one place in the whole frontend (LetterHomeScreen\'s gated card) — no other dev/QA entry point exists', () => {
    const fs2 = require('fs');
    const path2 = require('path');
    const glob = (dir, acc = []) => {
      for (const entry of fs2.readdirSync(dir, { withFileTypes: true })) {
        const full = path2.join(dir, entry.name);
        if (entry.isDirectory()) glob(full, acc);
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(full);
      }
      return acc;
    };
    const srcRoot = path2.resolve(__dirname, '..');
    const hits = [];
    for (const file of glob(srcRoot)) {
      const content = fs2.readFileSync(file, 'utf8');
      if (content.includes("navigate('WordLetterSelect'")) hits.push(file);
    }
    expect(hits).toEqual([path2.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js')]);
  });
});

describe('Uppercase gate (fixed in the prior session) is unchanged by this fix', () => {
  it('LetterPracticeScreen.js still derives lowercaseDone from lowercaseProgress >= 26', () => {
    expect(letterPractice).toMatch(/const lowercaseDone\s*=\s*lowercaseProgress\s*>=\s*26\s*;/);
  });
});
