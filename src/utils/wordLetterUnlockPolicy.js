/**
 * Sequential access for the word-letter chooser.
 *
 * Completion comes from the existing authoritative WordActivityProgress
 * evidence: every catalogue word for the letter must satisfy the established
 * all-of-A-E completion predicate.
 */
import { getSelectedWords } from './wordWorkflow';
import { completedWordsForLetter } from './wordCompletionHistory';

export const WORD_LETTERS = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
export const INITIAL_WORD_LETTERS = Object.freeze(['A', 'B', 'C']);

export function isWordPracticeLetterCompleted(progress, letter) {
  const key = String(letter ?? '').trim().toLowerCase();
  if (key.length !== 1) return false;
  const requiredWords = getSelectedWords(key);
  if (requiredWords.length === 0) return false;
  const completed = completedWordsForLetter(progress, key);
  return requiredWords.every(({ word }) => completed.has(String(word).trim().toLowerCase()));
}

export function computeWordLetterUnlocks(progress) {
  const completed = new Set(
    WORD_LETTERS.filter((letter) => isWordPracticeLetterCompleted(progress, letter)),
  );
  const initialGateComplete = INITIAL_WORD_LETTERS.every((letter) => completed.has(letter));

  return Object.fromEntries(WORD_LETTERS.map((letter, index) => {
    if (index < INITIAL_WORD_LETTERS.length) return [letter, true];
    if (!initialGateComplete) return [letter, false];
    // D opens once A/B/C are complete. Every later letter opens only after
    // every preceding sequential letter from D onward is complete.
    const priorSequentialLetters = WORD_LETTERS.slice(INITIAL_WORD_LETTERS.length, index);
    return [letter, priorSequentialLetters.every((prior) => completed.has(prior))];
  }));
}
