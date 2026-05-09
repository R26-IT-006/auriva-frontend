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

export const ALPHABET_BANK = [
  {
    id: "a",
    letter: "A",
    word: "a",
    color: "#F8D7DA",
    difficulty: 1,
    supportType: "open mouth sound",
    sounds: [{ text: "æ", type: "vowel", mouth: "wide open" }],
  },
  {
    id: "b",
    letter: "B",
    word: "b",
    color: "#D7E8FA",
    difficulty: 1,
    supportType: "lip closing sound",
    sounds: [{ text: "b", type: "consonant", mouth: "closed lips" }],
  },
  {
    id: "c",
    letter: "C",
    word: "c",
    color: "#DFF3E2",
    difficulty: 1,
    supportType: "back of mouth sound",
    sounds: [{ text: "k", type: "consonant", mouth: "back tongue" }],
  },
  {
    id: "d",
    letter: "D",
    word: "d",
    color: "#FCEFCF",
    difficulty: 1,
    supportType: "tongue tap sound",
    sounds: [{ text: "d", type: "consonant", mouth: "tongue tap" }],
  },
  {
    id: "e",
    letter: "E",
    word: "e",
    color: "#FDE3DF",
    difficulty: 1,
    supportType: "smiling vowel sound",
    sounds: [{ text: "e", type: "vowel", mouth: "smile" }],
  },
  {
    id: "f",
    letter: "F",
    word: "f",
    color: "#E8E0FA",
    difficulty: 2,
    supportType: "teeth lip airflow",
    sounds: [{ text: "f", type: "consonant", mouth: "teeth lip" }],
  },
  {
    id: "g",
    letter: "G",
    word: "g",
    color: "#E9F2D7",
    difficulty: 2,
    supportType: "back of mouth sound",
    sounds: [{ text: "g", type: "consonant", mouth: "back tongue" }],
  },
  {
    id: "h",
    letter: "H",
    word: "h",
    color: "#F6E0D6",
    difficulty: 1,
    supportType: "breathy sound",
    sounds: [{ text: "h", type: "consonant", mouth: "open airflow" }],
  },
  {
    id: "i",
    letter: "I",
    word: "i",
    color: "#D8EAF7",
    difficulty: 1,
    supportType: "short vowel sound",
    sounds: [{ text: "i", type: "vowel", mouth: "small smile" }],
  },
  {
    id: "j",
    letter: "J",
    word: "j",
    color: "#F4D8E8",
    difficulty: 2,
    supportType: "soft tongue sound",
    sounds: [{ text: "j", type: "consonant", mouth: "soft tongue" }],
  },
  {
    id: "k",
    letter: "K",
    word: "k",
    color: "#D8F0EA",
    difficulty: 1,
    supportType: "back of mouth sound",
    sounds: [{ text: "k", type: "consonant", mouth: "back tongue" }],
  },
  {
    id: "l",
    letter: "L",
    word: "l",
    color: "#F7E8C8",
    difficulty: 1,
    supportType: "tongue lift sound",
    sounds: [{ text: "l", type: "consonant", mouth: "tongue lift" }],
  },
  {
    id: "m",
    letter: "M",
    word: "m",
    color: "#E4F1F7",
    difficulty: 1,
    supportType: "humming lip sound",
    sounds: [{ text: "m", type: "consonant", mouth: "closed lips" }],
  },
  {
    id: "n",
    letter: "N",
    word: "n",
    color: "#E0E9F8",
    difficulty: 1,
    supportType: "nose sound",
    sounds: [{ text: "n", type: "consonant", mouth: "tongue up" }],
  },
  {
    id: "o",
    letter: "O",
    word: "o",
    color: "#F9E2D2",
    difficulty: 1,
    supportType: "round vowel sound",
    sounds: [{ text: "o", type: "vowel", mouth: "round lips" }],
  },
  {
    id: "p",
    letter: "P",
    word: "p",
    color: "#DCEFE0",
    difficulty: 1,
    supportType: "lip pop sound",
    sounds: [{ text: "p", type: "consonant", mouth: "closed lips" }],
  },
  {
    id: "q",
    letter: "Q",
    word: "q",
    color: "#E8DDF4",
    difficulty: 2,
    supportType: "back tongue sound",
    sounds: [{ text: "kw", type: "consonant", mouth: "back tongue" }],
  },
  {
    id: "r",
    letter: "R",
    word: "r",
    color: "#D9EEF7",
    difficulty: 2,
    supportType: "curled tongue sound",
    sounds: [{ text: "r", type: "consonant", mouth: "tongue curl" }],
  },
  {
    id: "s",
    letter: "S",
    word: "s",
    color: "#F7E7C6",
    difficulty: 2,
    supportType: "teeth airflow sound",
    sounds: [{ text: "s", type: "consonant", mouth: "teeth airflow" }],
  },
  {
    id: "t",
    letter: "T",
    word: "t",
    color: "#DDEED7",
    difficulty: 2,
    supportType: "tongue tap sound",
    sounds: [{ text: "t", type: "consonant", mouth: "tongue tap" }],
  },
  {
    id: "u",
    letter: "U",
    word: "u",
    color: "#F3D9D4",
    difficulty: 1,
    supportType: "round vowel sound",
    sounds: [{ text: "u", type: "vowel", mouth: "round lips" }],
  },
  {
    id: "v",
    letter: "V",
    word: "v",
    color: "#D9EBD7",
    difficulty: 2,
    supportType: "voice airflow sound",
    sounds: [{ text: "v", type: "consonant", mouth: "teeth lip" }],
  },
  {
    id: "w",
    letter: "W",
    word: "w",
    color: "#D9EAF8",
    difficulty: 1,
    supportType: "rounded lip sound",
    sounds: [{ text: "w", type: "consonant", mouth: "round lips" }],
  },
  {
    id: "x",
    letter: "X",
    word: "x",
    color: "#F4E0C8",
    difficulty: 2,
    supportType: "two-part sound",
    sounds: [{ text: "ks", type: "consonant", mouth: "back tongue" }],
  },
  {
    id: "y",
    letter: "Y",
    word: "y",
    color: "#E2DDF6",
    difficulty: 1,
    supportType: "smiling glide sound",
    sounds: [{ text: "y", type: "consonant", mouth: "small smile" }],
  },
  {
    id: "z",
    letter: "Z",
    word: "z",
    color: "#D8EFE9",
    difficulty: 2,
    supportType: "buzzing airflow sound",
    sounds: [{ text: "z", type: "consonant", mouth: "teeth airflow" }],
  },
];

const initialSessionState = {
  selectedStudent: null,
  selectedMode: PRONUNCIATION_MODES.WORD,
  selectedCategory: null,
  selectedWord: null,
  currentActivityStep: PRONUNCIATION_STEPS.SETUP,
  numberOfAttempts: 0,
  recordingUri: null,
  rawAudioBase64: null,
  rawAudioMimeType: null,
  rawAudioSize: null,
  mockWordScore: null,
  mockPhonemeScores: [],
  responseDuration: null,
  hesitationTime: null,
  adaptiveRecommendation: null,
  listenChooseData: null,
  completedWords: [],
  difficultPhonemes: {},
};

function getCategoryWords(categoryId) {
  const primaryWords = WORD_BANK[categoryId] || [];
  const extraWords = categoryId === "animals" ? WORD_BANK.moreAnimals || [] : [];
  return [...primaryWords, ...extraWords];
}

function getWordLabel(word) {
  return word?.letter || word?.word || "";
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
    : ALPHABET_BANK;
  const currentIndex = words.findIndex((word) => word.id === selectedWord?.id);
  const nextWord = words[currentIndex + 1] || words[0] || null;

  if (mockWordScore >= 80) {
    return {
      type: "continue",
      label: "Continue",
      message: selectedMode === PRONUNCIATION_MODES.WORD
        ? "Ready for the next planned word."
        : "Ready for the next planned letter.",
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
      message: selectedMode === PRONUNCIATION_MODES.WORD
        ? `Try another word with the ${difficultPhoneme || "target"} sound.`
        : `Try another letter with the ${difficultPhoneme || "target"} sound.`,
      word: relatedWord || easierWord || selectedWord || nextWord,
    };
  }

  return {
    type: "remediate",
    label: "Remediate",
    message: selectedMode === PRONUNCIATION_MODES.WORD
      ? "Use a simpler word before moving ahead."
      : "Use a simpler letter before moving ahead.",
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
      rawAudioBase64: null,
      rawAudioMimeType: null,
      rawAudioSize: null,
      mockWordScore: null,
      mockPhonemeScores: [],
      responseDuration: null,
      hesitationTime: null,
      adaptiveRecommendation: null,
      listenChooseData: null,
      currentActivityStep: PRONUNCIATION_STEPS.LISTEN,
    });
  },

  setCurrentActivityStep(step) {
    set({ currentActivityStep: step });
  },

  setRecordingUri(recordingUri, responseDuration = null, audioData = {}) {
    set({
      recordingUri: recordingUri || null,
      rawAudioBase64: audioData.rawAudioBase64 || null,
      rawAudioMimeType: audioData.rawAudioMimeType || null,
      rawAudioSize: audioData.rawAudioSize || null,
      responseDuration,
    });
  },

  setListenChooseData(data) {
    set({
      listenChooseData: data || null,
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
