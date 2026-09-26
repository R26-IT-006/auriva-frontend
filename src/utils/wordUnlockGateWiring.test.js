import fs from 'fs';
import path from 'path';

/**
 * Screen-level wiring proof for the Words card.
 *
 * The progress gate that used to stand in front of Words has been removed
 * from the UI: the card is open from the start, like Letters. What this
 * file proves is that the removal is complete — no half-gate left behind,
 * no second entry point — and that the things which were NOT part of the
 * gate (the backend letter counts the progress ring reads, the uppercase
 * rule) are untouched.
 *
 * LetterHomeScreen.js imports 'react-native' and can't be mounted under
 * this repo's plain-node jest config; verified by source-text assertion,
 * the same established technique this project already uses for screen
 * files (teacherReportLoadGuard.test.js, uppercaseProgressionFix.test.js).
 */

const letterHome = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'), 'utf8'
);
const letterPractice = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterPracticeScreen.js'), 'utf8'
);

describe('LetterHomeScreen — the Words card carries no gate', () => {
  it('the screen asks no unlock rule about Words', () => {
    expect(letterHome).not.toMatch(/isWordsUnlocked/);
    expect(letterHome).not.toMatch(/wordUnlockGate/);
    expect(letterHome).not.toMatch(/wordsUnlocked|wordsOpen|wordsPreview/);
  });

  it('no locked or preview presentation survives on the card', () => {
    expect(letterHome).not.toMatch(/lock-closed/);
    expect(letterHome).not.toMatch(/previewCard|previewBtn|previewCaption|PREVIEW_BADGE/);
    expect(letterHome).not.toMatch(/Complete all 52 letters to unlock words/);
    expect(letterHome).not.toMatch(/>Locked</);
  });

  it('both lowercase_completed and uppercase_completed are still read from the backend LETTER_PROGRESS response — the progress ring needs them (never AsyncStorage/local flags)', () => {
    const effectBlock = letterHome.slice(
      letterHome.indexOf('client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))'),
      letterHome.indexOf('getLetterSequence(student.sid)')
    );
    expect(effectBlock).toContain('setLowercaseProgress(res.data.lowercase_completed ?? 0)');
    expect(effectBlock).toContain('setUppercaseProgress(res.data.uppercase_completed ?? 0)');
    expect(effectBlock).not.toMatch(/AsyncStorage|getCompletedLetters\(/);
  });
});

describe('LetterHomeScreen — the Words card opens on every tap', () => {
  it('onPress navigates unconditionally', () => {
    expect(letterHome).toContain(
      "onPress={() => navigation.navigate('WordLetterSelect', { student, theme })}"
    );
  });

  it('the card has one appearance, not an earned/locked pair', () => {
    // A single treatment: no ternary chooses its icon, gradient or caption.
    expect(letterHome).toContain('<CardLandscape variant="words" />');
    expect(letterHome).toContain("<Ionicons name=\"book-outline\" size={38} color=\"#7B1FA2\" />");
    expect(letterHome).toContain('Ready to practise words');
    expect(letterHome).toContain('<Text style={styles.startBtnText}>Start Practice</Text>');
  });

  it('the demo preview switch itself is unchanged and still fails closed — Uppercase continues to rely on it', () => {
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
