import { create } from "zustand";
import { WORD_BANK } from "./wordBank";

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
    id: "m",
    letter: "M",
    word: "m",
    color: "#DFF3E2",
    difficulty: 1,
    supportType: "humming lip sound",
    sounds: [{ text: "m", type: "consonant", mouth: "closed lips" }],
  },
  {
    id: "s",
    letter: "S",
    word: "s",
    color: "#FCEFCF",
    difficulty: 2,
    supportType: "teeth airflow sound",
    sounds: [{ text: "s", type: "consonant", mouth: "teeth airflow" }],
  },
  {
    id: "t",
    letter: "T",
    word: "t",
    color: "#FDE3DF",
    difficulty: 2,
    supportType: "tongue tap sound",
    sounds: [{ text: "t", type: "consonant", mouth: "tongue tap" }],
  },
];

const EMPTY_SESSION = {
  mode: "word",
  categoryId: "animals",
  currentItem: null,
  status: "idle",
  attempts: [],
  completedWords: [],
  difficultPhonemes: {},
  lastResult: null,
  adaptiveRecommendation: null,
  currentStep: "setup",
};

export const usePronunciationSessionStore = create((set, get) => ({
  session: EMPTY_SESSION,
  startSession({ mode = "word", categoryId = "animals", item, student }) {
    set({
      session: {
        ...EMPTY_SESSION,
        mode,
        categoryId,
        currentItem: item,
        student,
        status: "active",
        currentStep: "support",
      },
    });
  },
  pauseSession() {
    set((state) => ({
      session: { ...state.session, status: "paused" },
    }));
  },
  resumeSession() {
    set((state) => ({
      session: { ...state.session, status: "active" },
    }));
  },
  endSession() {
    set((state) => ({
      session: { ...state.session, status: "ended", currentStep: "summary" },
    }));
  },
  setCurrentItem(item) {
    set((state) => ({
      session: {
        ...state.session,
        currentItem: item,
        lastResult: null,
        adaptiveRecommendation: null,
        currentStep: "support",
      },
    }));
  },
  submitAttempt({ recordingUri, durationSeconds }) {
    const session = get().session;
    const item = session.currentItem;
    const result = createMockResult({
      item,
      categoryId: session.categoryId,
      mode: session.mode,
      attempts: session.attempts,
      durationSeconds,
    });
    const attempt = {
      id: `${Date.now()}-${item?.id || "item"}`,
      itemId: item?.id,
      itemLabel: getItemLabel(item, session.mode),
      recordingUri,
      ...result,
    };
    const difficultPhonemes = { ...session.difficultPhonemes };
    if (attempt.difficultPhoneme) {
      difficultPhonemes[attempt.difficultPhoneme] =
        (difficultPhonemes[attempt.difficultPhoneme] || 0) + 1;
    }
    const completedWords = [
      ...session.completedWords.filter((entry) => entry.id !== item?.id),
      { id: item?.id, label: attempt.itemLabel, score: attempt.score },
    ];

    set({
      session: {
        ...session,
        attempts: [...session.attempts, attempt],
        completedWords,
        difficultPhonemes,
        lastResult: attempt,
        adaptiveRecommendation: attempt.recommendation,
        currentStep: "result",
      },
    });
    return attempt;
  },
  acceptRecommendation() {
    const session = get().session;
    const nextItem = session.adaptiveRecommendation?.item;
    if (!nextItem) return;
    get().setCurrentItem(nextItem);
  },
}));

export function getWordsForCategory(categoryId) {
  const primary = WORD_BANK[categoryId] || [];
  const extras = categoryId === "animals" ? WORD_BANK.moreAnimals || [] : [];
  return [...primary, ...extras];
}

export function getItemLabel(item, mode = "word") {
  if (!item) return "";
  return mode === "alphabet" ? item.letter || item.word : item.word;
}

export function getRecommendedStart(categoryId, mode = "word") {
  if (mode === "alphabet") return ALPHABET_BANK[0];
  return getWordsForCategory(categoryId)[0];
}

export function getNextPlannedItem({ categoryId, mode, currentItem }) {
  const bank = mode === "alphabet" ? ALPHABET_BANK : getWordsForCategory(categoryId);
  const index = bank.findIndex((item) => item.id === currentItem?.id);
  return bank[index + 1] || bank[0];
}

function createMockResult({ item, categoryId, mode, attempts, durationSeconds }) {
  const previousAttempts = attempts.filter((attempt) => attempt.itemId === item?.id).length;
  const soundCount = Math.max(item?.sounds?.length || 1, 1);
  const base = 54 + ((item?.word || item?.letter || "").charCodeAt(0) % 34);
  const score = Math.max(42, Math.min(96, base - previousAttempts * 7 + soundCount * 3));
  const weakIndex = Math.max(0, Math.min(soundCount - 1, score < 80 ? 1 : soundCount - 1));
  const phonemeScores = (item?.sounds || []).map((sound, index) => {
    const drop = index === weakIndex ? 28 : 6 + index * 3;
    return {
      text: sound.text,
      type: sound.type,
      mouth: sound.mouth,
      score: Math.max(35, Math.min(98, score + 8 - drop)),
    };
  });
  const difficultPhoneme = phonemeScores
    .slice()
    .sort((a, b) => a.score - b.score)[0]?.text;
  const responseDuration = Math.max(1, durationSeconds || 2);
  const hesitationTime = Number((0.7 + previousAttempts * 0.35 + (score < 65 ? 0.9 : 0.2)).toFixed(1));
  const recommendation = chooseRecommendation({
    score,
    difficultPhoneme,
    currentItem: item,
    categoryId,
    mode,
  });

  return {
    score,
    phonemeScores,
    responseDuration,
    hesitationTime,
    attemptNumber: previousAttempts + 1,
    difficultPhoneme,
    feedbackMessage:
      score >= 80
        ? "Great listening and speaking"
        : score >= 60
          ? `Good try. Let's practise ${difficultPhoneme} once more`
          : `Let's slow down and practise ${difficultPhoneme} with an easier sound`,
    recommendation,
  };
}

function chooseRecommendation({ score, difficultPhoneme, currentItem, categoryId, mode }) {
  const bank = mode === "alphabet" ? ALPHABET_BANK : getWordsForCategory(categoryId);
  if (score >= 80) {
    const item = getNextPlannedItem({ categoryId, mode, currentItem });
    return {
      type: "continue",
      label: "Continue",
      message: "Ready for the next planned item.",
      item,
    };
  }

  const related = bank.find(
    (item) =>
      item.id !== currentItem?.id &&
      item.sounds?.some((sound) => sound.text === difficultPhoneme),
  );
  const easier = bank.find(
    (item) =>
      item.id !== currentItem?.id &&
      (item.difficulty || item.phonemeCount || 4) <=
        (currentItem?.difficulty || currentItem?.phonemeCount || 4),
  );

  if (score >= 60) {
    return {
      type: "reinforce",
      label: "Reinforce",
      message: `Try another item with the ${difficultPhoneme} sound.`,
      item: related || easier || currentItem,
    };
  }

  return {
    type: "remediate",
    label: "Remediate",
    message: "Use a simpler item before moving ahead.",
    item: easier || related || currentItem,
  };
}
