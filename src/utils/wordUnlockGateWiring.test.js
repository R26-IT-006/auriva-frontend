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
  path.resolve(__dirname, '../screens/handwriting/LetterHomeScreen.js'), 'utf8'
);
const letterPractice = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterPracticeScreen.js'), 'utf8'
);

describe('LetterHomeScreen — hardcoded bypass removed', () => {
  it('no longer contains `const wordsUnlocked = true`', () => {
    expect(letterHome).not.toMatch(/const wordsUnlocked\s*=\s*true\s*;/);
  });

  it('wordsUnlocked is derived from isWordsUnlocked(lowercaseProgress, uppercaseProgress)', () => {
    expect(letterHome).toContain("import { isWordsUnlocked } from '../../utils/wordUnlockGate';");
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
  it('onPress checks wordsUnlocked before navigating (a locked tap does nothing)', () => {
    expect(letterHome).toContain(
      "onPress={() => wordsUnlocked && navigation.navigate('WordLetterSelect', { student, theme })}"
    );
  });

  it('an unlocked tap still navigates normally (the gate does not remove the working path)', () => {
    // Same line proves both: `wordsUnlocked && navigate(...)` evaluates to
    // the navigate call whenever wordsUnlocked is truthy.
    expect(letterHome).toMatch(/wordsUnlocked && navigation\.navigate\('WordLetterSelect'/);
  });

  it('no long-press or secondary handler bypasses the gate on the Words card', () => {
    const cardBlock = letterHome.slice(
      letterHome.indexOf("style={styles.wordsCard}"),
      letterHome.indexOf("style={styles.wordsCard}") + 1200
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
    expect(hits).toEqual([path2.resolve(__dirname, '../screens/handwriting/LetterHomeScreen.js')]);
  });
});

describe('Uppercase gate (fixed in the prior session) is unchanged by this fix', () => {
  it('LetterPracticeScreen.js still derives lowercaseDone from lowercaseProgress >= 26', () => {
    expect(letterPractice).toMatch(/const lowercaseDone\s*=\s*lowercaseProgress\s*>=\s*26\s*;/);
  });
});
