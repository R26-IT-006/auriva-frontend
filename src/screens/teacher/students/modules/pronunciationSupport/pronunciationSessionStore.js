import { create } from "zustand";

import { WORD_BANK } from "./wordBank";

export const PRONUNCIATION_STEPS = {
  SETUP: "setup",
  WORD_SELECTION: "wordSelection",
  LISTEN: "listen",
  SPEAK: "speak",
  RESULT: "result",
  SUMMARY: "summary",
};

export const PRONUNCIATION_MODES = {
  WORD: "word",
  ALPHABET: "alphabet",
};

const initialSessionState = {
  selectedStudent: null,
  selectedMode: PRONUNCIATION_MODES.WORD,
  selectedCategory: null,
  selectedWord: null,
  currentActivityStep: PRONUNCIATION_STEPS.SETUP,
  numberOfAttempts: 0,
  recordingUri: null,
  mockWordScore: null,
  mockPhonemeScores: [],
  responseDuration: null,
  hesitationTime: null,
  adaptiveRecommendation: null,
  completedWords: [],
  difficultPhonemes: {},
};

function getCategoryWords(categoryId) {
  const primaryWords = WORD_BANK[categoryId] || [];
  const extraWords = categoryId === "animals" ? WORD_BANK.moreAnimals || [] : [];
  return [...primaryWords, ...extraWords];
}

function getWordLabel(word) {
  return word?.word || word?.letter || "";
}

function createMockAttemptResult({
  selectedCategory,
  selectedMode,
  selectedWord,
  numberOfAttempts,
  responseDuration,
}) {
  const sounds = selectedWord?.sounds || [];
  const soundCount = Math.max(sounds.length, 1);
  const label = getWordLabel(selectedWord);
  const baseScore = 54 + ((label || "word").charCodeAt(0) % 34);
  const mockWordScore = Math.max(
    42,
    Math.min(96, baseScore - numberOfAttempts * 6 + soundCount * 3),
  );
  const weakSoundIndex = Math.max(
    0,
    Math.min(soundCount - 1, mockWordScore < 80 ? 1 : soundCount - 1),
  );
  const mockPhonemeScores = sounds.map((sound, index) => {
    const drop = index === weakSoundIndex ? 28 : 6 + index * 3;
    return {
      text: sound.text,
      type: sound.type,
      score: Math.max(35, Math.min(98, mockWordScore + 8 - drop)),
    };
  });
  const difficultPhoneme = mockPhonemeScores
    .slice()
    .sort((a, b) => a.score - b.score)[0]?.text || null;
  const hesitationTime = Number(
    (0.7 + numberOfAttempts * 0.35 + (mockWordScore < 65 ? 0.9 : 0.2)).toFixed(1),
  );
  const adaptiveRecommendation = createAdaptiveRecommendation({
    selectedCategory,
    selectedMode,
    selectedWord,
    mockWordScore,
    difficultPhoneme,
  });

  return {
    mockWordScore,
    mockPhonemeScores,
    responseDuration: Math.max(1, responseDuration || 2),
    hesitationTime,
    adaptiveRecommendation,
    difficultPhoneme,
  };
}

function createAdaptiveRecommendation({
  selectedCategory,
  selectedMode,
  selectedWord,
  mockWordScore,
  difficultPhoneme,
}) {
  const words = selectedMode === PRONUNCIATION_MODES.WORD
    ? getCategoryWords(selectedCategory)
    : [];
  const currentIndex = words.findIndex((word) => word.id === selectedWord?.id);
  const nextWord = words[currentIndex + 1] || words[0] || null;

  if (mockWordScore >= 80) {
    return {
      type: "continue",
      label: "Continue",
      message: "Ready for the next planned word.",
      word: nextWord,
    };
  }

  const relatedWord = words.find(
    (word) =>
      word.id !== selectedWord?.id &&
      word.sounds?.some((sound) => sound.text === difficultPhoneme),
  );
  const easierWord = words.find(
    (word) =>
      word.id !== selectedWord?.id &&
      (word.phonemeCount || 4) <= (selectedWord?.phonemeCount || 4),
  );

  if (mockWordScore >= 60) {
    return {
      type: "reinforce",
      label: "Reinforce",
      message: `Try another word with the ${difficultPhoneme || "target"} sound.`,
      word: relatedWord || easierWord || selectedWord || nextWord,
    };
  }

  return {
    type: "remediate",
    label: "Remediate",
    message: "Use a simpler word before moving ahead.",
    word: easierWord || relatedWord || selectedWord || nextWord,
  };
}

export const usePronunciationSessionStore = create((set, get) => ({
  ...initialSessionState,

  resetSession() {
    set(initialSessionState);
  },

  startSession({
    student,
    mode = PRONUNCIATION_MODES.WORD,
    category = null,
    word = null,
  }) {
    set({
      ...initialSessionState,
      selectedStudent: student || null,
      selectedMode: mode,
      selectedCategory: category,
      selectedWord: word,
      currentActivityStep: word
        ? PRONUNCIATION_STEPS.LISTEN
        : PRONUNCIATION_STEPS.WORD_SELECTION,
    });
  },

  setSelectedStudent(student) {
    set({ selectedStudent: student || null });
  },

  setSelectedMode(mode) {
    set({ selectedMode: mode || PRONUNCIATION_MODES.WORD });
  },

  setSelectedCategory(category) {
    set({ selectedCategory: category });
  },

  setSelectedWord(word) {
    set({
      selectedWord: word || null,
      recordingUri: null,
      mockWordScore: null,
      mockPhonemeScores: [],
      responseDuration: null,
      hesitationTime: null,
      adaptiveRecommendation: null,
      currentActivityStep: PRONUNCIATION_STEPS.LISTEN,
    });
  },

  setCurrentActivityStep(step) {
    set({ currentActivityStep: step });
  },

  setRecordingUri(recordingUri, responseDuration = null) {
    set({
      recordingUri: recordingUri || null,
      responseDuration,
    });
  },

  submitMockAttempt({ recordingUri, responseDuration } = {}) {
    const state = get();
    const result = createMockAttemptResult({
      selectedCategory: state.selectedCategory,
      selectedMode: state.selectedMode,
      selectedWord: state.selectedWord,
      numberOfAttempts: state.numberOfAttempts,
      responseDuration,
    });
    const completedWord = state.selectedWord
      ? {
          id: state.selectedWord.id,
          label: getWordLabel(state.selectedWord),
          score: result.mockWordScore,
        }
      : null;
    const difficultPhonemes = { ...state.difficultPhonemes };

    if (result.difficultPhoneme) {
      difficultPhonemes[result.difficultPhoneme] =
        (difficultPhonemes[result.difficultPhoneme] || 0) + 1;
    }

    set({
      numberOfAttempts: state.numberOfAttempts + 1,
      recordingUri: recordingUri || state.recordingUri,
      mockWordScore: result.mockWordScore,
      mockPhonemeScores: result.mockPhonemeScores,
      responseDuration: result.responseDuration,
      hesitationTime: result.hesitationTime,
      adaptiveRecommendation: result.adaptiveRecommendation,
      completedWords: completedWord
        ? [
            ...state.completedWords.filter((entry) => entry.id !== completedWord.id),
            completedWord,
          ]
        : state.completedWords,
      difficultPhonemes,
      currentActivityStep: PRONUNCIATION_STEPS.RESULT,
    });

    return result;
  },
}));
