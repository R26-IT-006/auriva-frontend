import WORD_DATA from '../constants/wordData';

export const WORD_EXERCISES = ['A', 'B', 'C', 'D', 'E'];
export const GUIDED_SUPPORT = { 1: 'high', 2: 'medium', 3: 'low' };

export function getLengthGroup(word) {
  const length = String(word || '').length;
  if (length <= 3) return 3;
  if (length <= 4) return 4;
  return 5;
}

export function getSelectedWords(selectedLetter) {
  return WORD_DATA
    .filter(entry => entry.letter === selectedLetter)
    .sort((a, b) => getLengthGroup(a.word) - getLengthGroup(b.word));
}

export function resolveWordSession(params = {}) {
  const selectedLetter = params.selectedLetter ?? params.letter ?? 'a';
  const selectedWords = Array.isArray(params.selectedWords) && params.selectedWords.length
    ? params.selectedWords
    : getSelectedWords(selectedLetter);
  const requestedIndex = Number(params.currentWordIndex ?? 0);
  const currentWordIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0
    ? requestedIndex
    : 0;

  return {
    selectedLetter,
    selectedWords,
    currentWordIndex,
    currentWord: selectedWords[currentWordIndex] ?? null,
  };
}

export function buildWordRouteParams({ student, theme, selectedLetter, selectedWords, currentWordIndex }) {
  return {
    student,
    studentId: Number(student?.sid),
    theme,
    selectedLetter,
    selectedWords,
    currentWordIndex,
  };
}

export function afterGuidedAttempt(attemptNumber) {
  if (attemptNumber < 3) return { type: 'attempt', attemptNumber: attemptNumber + 1 };
  return { type: 'route', route: 'WordPractice' };
}

export function afterExerciseESuccess(currentWordIndex, selectedWordCount) {
  if (currentWordIndex < selectedWordCount - 1) {
    return { route: 'WordWriting', currentWordIndex: currentWordIndex + 1 };
  }
  return { route: 'WordProgress', currentWordIndex };
}
