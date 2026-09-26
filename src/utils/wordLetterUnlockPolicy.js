'use strict';

import { completedWordsForLetter } from './wordCompletionHistory';
import { getSelectedWords } from './wordWorkflow';

export const WORD_LETTERS = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
export const INITIAL_WORD_LETTERS = Object.freeze(['A', 'B', 'C']);

export function isWordPracticeLetterCompleted(progress, letter) {
  const key = typeof letter === 'string' ? letter.trim().toLowerCase() : '';
  if (!/^[a-z]$/.test(key)) return false;

  const catalogueWords = getSelectedWords(key);
  if (catalogueWords.length === 0) return false;

  const completed = completedWordsForLetter(progress, key);
  return catalogueWords.every(({ word }) => completed.has(String(word).toLowerCase()));
}

export function computeWordLetterUnlocks(progress) {
  const unlocked = Object.fromEntries(WORD_LETTERS.map((letter) => [letter, false]));
  INITIAL_WORD_LETTERS.forEach((letter) => { unlocked[letter] = true; });

  unlocked.D = INITIAL_WORD_LETTERS.every((letter) =>
    isWordPracticeLetterCompleted(progress, letter)
  );

  for (let index = 4; index < WORD_LETTERS.length; index += 1) {
    const previous = WORD_LETTERS[index - 1];
    unlocked[WORD_LETTERS[index]] =
      unlocked[previous] && isWordPracticeLetterCompleted(progress, previous);
  }

  return unlocked;
}
