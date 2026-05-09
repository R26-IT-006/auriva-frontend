const PHONEME_SUPPORT_CUES = {
  æ: "Open the mouth wide for the short /a/ sound.",
  ɒ: "Round the lips gently for the short /o/ sound.",
  ɪ: "Use a small smile for the short /i/ sound.",
  "ɜː": "Keep the mouth relaxed for the long middle vowel.",
  "iː": "Smile and stretch the long /ee/ sound.",
  "eɪ": "Start with /e/ and glide to /i/.",
  "ɔː": "Round the lips for the long /or/ sound.",
  "uː": "Round the lips and hold the long /oo/ sound.",
  "ʌ": "Open the mouth slightly for the short /u/ sound.",
  b: "Close both lips, then release with voice.",
  p: "Close both lips, then release with a soft pop.",
  m: "Close both lips and hum through the nose.",
  f: "Touch teeth to lower lip and blow air.",
  v: "Touch teeth to lower lip and add voice.",
  s: "Keep teeth close and send air forward.",
  z: "Keep teeth close and add a buzzing voice.",
  t: "Tap the tongue behind the teeth.",
  d: "Tap the tongue behind the teeth with voice.",
  k: "Lift the back of the tongue for the back-mouth sound.",
  g: "Lift the back of the tongue and add voice.",
  h: "Use an open mouth with gentle breath.",
  l: "Lift the tongue tip behind the teeth.",
  r: "Curl or bunch the tongue without touching the teeth.",
  w: "Round the lips first, then open.",
  "ʃ": "Round the lips slightly and push quiet air.",
  "tʃ": "Start with a tongue tap, then release air.",
  "dʒ": "Start with a tongue tap, then release with voice.",
};

const WORD_IMAGE_ASSETS = {
  bird: require("../../../../../../assets/bird.jpg"),
  dog: require("../../../../../../assets/dog.jpg"),
  fish: require("../../../../../../assets/fish.jpg"),
};

export function getWordImageSource(word) {
  if (word?.imageAsset) return word.imageAsset;
  if (word?.imageUri) return { uri: word.imageUri };
  return null;
}

const WORD_METADATA = {
  cat: {
    ipa: "/kæt/",
    syllableCount: 1,
    difficulty: 1,
    pattern: "CVC",
    easierWords: ["ant"],
    relatedWords: ["kangaroo", "crab"],
    syllabusCategory: "animals",
  },
  dog: {
    ipa: "/dɒg/",
    syllableCount: 1,
    difficulty: 1,
    pattern: "CVC",
    easierWords: ["deer"],
    relatedWords: ["goose"],
    syllabusCategory: "animals",
  },
  fish: {
    ipa: "/fɪʃ/",
    syllableCount: 1,
    difficulty: 2,
    pattern: "CVC",
    easierWords: ["fox"],
    relatedWords: ["chick", "jellyfish"],
    syllabusCategory: "animals",
  },
  bird: {
    ipa: "/bɜːd/",
    syllableCount: 1,
    difficulty: 2,
    pattern: "CVC",
    easierWords: ["book"],
    relatedWords: ["buffalo", "butterfly"],
    syllabusCategory: "animals",
  },
  worm: { ipa: "/wɜːm/", syllableCount: 1, difficulty: 2, pattern: "CVC", relatedWords: ["whale", "walk"] },
  whale: { ipa: "/weɪl/", syllableCount: 1, difficulty: 2, pattern: "CVC", easierWords: ["worm"], relatedWords: ["walk"] },
  turtle: { ipa: "/tɜːtəl/", syllableCount: 2, difficulty: 3, pattern: "CVCVC", easierWords: ["cat", "ant"], relatedWords: ["tiger"] },
  tiger: { ipa: "/taɪgə/", syllableCount: 2, difficulty: 3, pattern: "CVCV", easierWords: ["dog"], relatedWords: ["turtle"] },
  snail: { ipa: "/sneɪl/", syllableCount: 1, difficulty: 3, pattern: "CCVC", easierWords: ["goose"], relatedWords: ["desk"] },
  pigeon: { ipa: "/pɪdʒən/", syllableCount: 2, difficulty: 3, pattern: "CVCVC", easierWords: ["hippo"], relatedWords: ["penguin"] },
  penguin: { ipa: "/peŋgwɪn/", syllableCount: 2, difficulty: 4, pattern: "CVCCVC", easierWords: ["pigeon"], relatedWords: ["mango"] },
  mosquito: { ipa: "/mɒskiːtəʊ/", syllableCount: 3, difficulty: 5, pattern: "CVCCVCV", easierWords: ["worm"], relatedWords: ["desk"] },
  leopard: { ipa: "/lepəd/", syllableCount: 2, difficulty: 3, pattern: "CVCVC", easierWords: ["apple"], relatedWords: ["hippo"] },
  kangaroo: { ipa: "/kæŋgəruː/", syllableCount: 3, difficulty: 5, pattern: "CVCCVCV", easierWords: ["cat"], relatedWords: ["crab"] },
  jellyfish: { ipa: "/dʒelifɪʃ/", syllableCount: 3, difficulty: 5, pattern: "CVCVCVC", easierWords: ["fish"], relatedWords: ["jump"] },
  horse: { ipa: "/hɔːs/", syllableCount: 1, difficulty: 2, pattern: "CVC", easierWords: ["goose"], relatedWords: ["hippo"] },
  hippo: { ipa: "/hɪpəʊ/", syllableCount: 2, difficulty: 3, pattern: "CVCV", easierWords: ["horse"], relatedWords: ["pigeon"] },
  goose: { ipa: "/guːs/", syllableCount: 1, difficulty: 2, pattern: "CVC", easierWords: ["dog"], relatedWords: ["horse"] },
  fox: { ipa: "/fɒks/", syllableCount: 1, difficulty: 2, pattern: "CVCC", easierWords: ["fish"], relatedWords: ["book"] },
  elephant: { ipa: "/eləfənt/", syllableCount: 3, difficulty: 5, pattern: "VCVCVC", easierWords: ["eagle", "ant"], relatedWords: ["buffalo"] },
  eagle: { ipa: "/iːgəl/", syllableCount: 2, difficulty: 3, pattern: "VCVC", easierWords: ["goose"], relatedWords: ["deer"] },
  deer: { ipa: "/dɪə/", syllableCount: 1, difficulty: 1, pattern: "CV", easierWords: ["dog"], relatedWords: ["desk"] },
  crab: { ipa: "/kræb/", syllableCount: 1, difficulty: 3, pattern: "CCVC", easierWords: ["cat"], relatedWords: ["kangaroo"] },
  cow: { ipa: "/kaʊ/", syllableCount: 1, difficulty: 1, pattern: "CV", easierWords: ["cat"], relatedWords: ["crab"] },
  chick: { ipa: "/tʃɪk/", syllableCount: 1, difficulty: 2, pattern: "CVC", easierWords: ["cat"], relatedWords: ["fish"] },
  butterfly: { ipa: "/bʌtəflaɪ/", syllableCount: 3, difficulty: 5, pattern: "CVCVCCV", easierWords: ["bird", "buffalo"], relatedWords: ["buffalo"] },
  buffalo: { ipa: "/bʌfələʊ/", syllableCount: 3, difficulty: 5, pattern: "CVCVCV", easierWords: ["bird"], relatedWords: ["butterfly"] },
  ant: { ipa: "/ænt/", syllableCount: 1, difficulty: 1, pattern: "VCC", easierWords: ["cat"], relatedWords: ["elephant"] },
  book: { ipa: "/bʊk/", syllableCount: 1, difficulty: 1, pattern: "CVC", easierWords: ["bird"], relatedWords: ["desk"] },
  desk: { ipa: "/desk/", syllableCount: 1, difficulty: 2, pattern: "CVCC", easierWords: ["deer"], relatedWords: ["snail"] },
  apple: { ipa: "/apəl/", syllableCount: 2, difficulty: 2, pattern: "VCVC", easierWords: ["ant"], relatedWords: ["leopard"] },
  mango: { ipa: "/mæŋgəʊ/", syllableCount: 2, difficulty: 3, pattern: "CVCCV", easierWords: ["worm"], relatedWords: ["penguin"] },
  walk: { ipa: "/wɔːk/", syllableCount: 1, difficulty: 2, pattern: "CVC", easierWords: ["worm"], relatedWords: ["whale"] },
  jump: { ipa: "/dʒʌmp/", syllableCount: 1, difficulty: 3, pattern: "CVCC", easierWords: ["jellyfish"], relatedWords: ["butterfly"] },
};

function getSoundPosition(index, total) {
  if (total <= 1) return "single";
  if (index === 0) return "initial";
  if (index === total - 1) return "final";
  return "medial";
}

function getFallbackPattern(sounds = []) {
  return sounds
    .map((sound) => (sound.type === "vowel" ? "V" : "C"))
    .join("");
}

function getFallbackDifficulty(word) {
  const phonemeCount = word.phonemeCount || word.sounds?.length || 1;
  if (phonemeCount <= 3) return 1;
  if (phonemeCount <= 5) return 2;
  if (phonemeCount <= 7) return 3;
  return 4;
}

function enrichWord(word, categoryId) {
  const metadata = WORD_METADATA[word.id] || {};
  const sounds = (word.sounds || []).map((sound, index, source) => ({
    ...sound,
    position: sound.position || getSoundPosition(index, source.length),
    cue: sound.cue || PHONEME_SUPPORT_CUES[sound.text] || null,
  }));
  const targetPhonemes = sounds.map((sound) => sound.text);

  return {
    ...word,
    ipa: metadata.ipa || `/${targetPhonemes.join("")}/`,
    syllableCount: metadata.syllableCount || 1,
    difficulty: metadata.difficulty || getFallbackDifficulty(word),
    pattern: metadata.pattern || getFallbackPattern(sounds),
    syllabusCategory: metadata.syllabusCategory || categoryId,
    easierWords: metadata.easierWords || [],
    relatedWords: metadata.relatedWords || [],
    targetPhonemes,
    supportCue:
      metadata.supportCue ||
      sounds.find((sound) => sound.type === "vowel")?.cue ||
      sounds[0]?.cue ||
      null,
    sounds,
  };
}

function enrichWordBank(rawWordBank) {
  return Object.entries(rawWordBank).reduce((bank, [categoryId, words]) => {
    bank[categoryId] = words.map((word) => enrichWord(word, categoryId));
    return bank;
  }, {});
}

const RAW_WORD_BANK = {
  animals: [
    {
      id: "cat",
      word: "cat",
      color: "#9AD8C0",
      phonemeCount: 5,
      sounds: [
        { text: "k", type: "consonant" },
        { text: "æ", type: "vowel" },
        { text: "t", type: "consonant" },
      ],
      imageUri:
        "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "dog",
      word: "dog",
      color: "#F4C11A",
      imageAsset: WORD_IMAGE_ASSETS.dog,
      phonemeCount: 5,
      sounds: [
        { text: "d", type: "consonant" },
        { text: "ɒ", type: "vowel" },
        { text: "g", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "fish",
      word: "fish",
      color: "#2A4BD8",
      imageAsset: WORD_IMAGE_ASSETS.fish,
      phonemeCount: 5,
      sounds: [
        { text: "f", type: "consonant" },
        { text: "ɪ", type: "vowel" },
        { text: "ʃ", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "bird",
      word: "bird",
      color: "#E5E9EF",
      imageAsset: WORD_IMAGE_ASSETS.bird,
      phonemeCount: 5,
      sounds: [
        { text: "b", type: "consonant" },
        { text: "ɜː", type: "vowel" },
        { text: "d", type: "consonant" },
      ],
      imageUri: null,
    },
  ],
  moreAnimals: [
    {
      id: "worm",
      word: "worm",
      color: "#D8E8C7",
      phonemeCount: 4,
      sounds: [
        { text: "w", type: "consonant" },
        { text: "ɜː", type: "vowel" },
        { text: "m", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "whale",
      word: "whale",
      color: "#DDEBFA",
      phonemeCount: 5,
      sounds: [
        { text: "w", type: "consonant" },
        { text: "eɪ", type: "vowel" },
        { text: "l", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "turtle",
      word: "turtle",
      color: "#D8EFD7",
      phonemeCount: 6,
      sounds: [
        { text: "t", type: "consonant" },
        { text: "ɜː", type: "vowel" },
        { text: "t", type: "consonant" },
        { text: "əl", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "tiger",
      word: "tiger",
      color: "#F7D8B9",
      phonemeCount: 5,
      sounds: [
        { text: "t", type: "consonant" },
        { text: "aɪ", type: "vowel" },
        { text: "gə", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "snail",
      word: "snail",
      color: "#E9E2D8",
      phonemeCount: 5,
      sounds: [
        { text: "s", type: "consonant" },
        { text: "n", type: "consonant" },
        { text: "eɪ", type: "vowel" },
        { text: "l", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "pigeon",
      word: "pigeon",
      color: "#E0E7EF",
      phonemeCount: 6,
      sounds: [
        { text: "p", type: "consonant" },
        { text: "ɪ", type: "vowel" },
        { text: "dʒ", type: "consonant" },
        { text: "ən", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "penguin",
      word: "penguin",
      color: "#DDE6F5",
      phonemeCount: 7,
      sounds: [
        { text: "p", type: "consonant" },
        { text: "e", type: "vowel" },
        { text: "ŋ", type: "consonant" },
        { text: "gwɪn", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "mosquito",
      word: "mosquito",
      color: "#F8E4B8",
      phonemeCount: 8,
      sounds: [
        { text: "m", type: "consonant" },
        { text: "ɒ", type: "vowel" },
        { text: "sk", type: "consonant" },
        { text: "iː", type: "vowel" },
        { text: "təʊ", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "leopard",
      word: "leopard",
      color: "#F3D6A1",
      phonemeCount: 7,
      sounds: [
        { text: "l", type: "consonant" },
        { text: "e", type: "vowel" },
        { text: "p", type: "consonant" },
        { text: "əd", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "kangaroo",
      word: "kangaroo",
      color: "#EAD8C6",
      phonemeCount: 8,
      sounds: [
        { text: "k", type: "consonant" },
        { text: "æ", type: "vowel" },
        { text: "ŋg", type: "consonant" },
        { text: "ə", type: "vowel" },
        { text: "ruː", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "jellyfish",
      word: "jellyfish",
      color: "#DCEFFE",
      phonemeCount: 9,
      sounds: [
        { text: "dʒ", type: "consonant" },
        { text: "e", type: "vowel" },
        { text: "l", type: "consonant" },
        { text: "i", type: "vowel" },
        { text: "f", type: "consonant" },
        { text: "ɪʃ", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "horse",
      word: "horse",
      color: "#E7E1D7",
      phonemeCount: 5,
      sounds: [
        { text: "h", type: "consonant" },
        { text: "ɔː", type: "vowel" },
        { text: "s", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "hippo",
      word: "hippo",
      color: "#DDE6EE",
      phonemeCount: 5,
      sounds: [
        { text: "h", type: "consonant" },
        { text: "ɪ", type: "vowel" },
        { text: "p", type: "consonant" },
        { text: "əʊ", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "goose",
      word: "goose",
      color: "#E7F1D9",
      phonemeCount: 5,
      sounds: [
        { text: "g", type: "consonant" },
        { text: "uː", type: "vowel" },
        { text: "s", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "fox",
      word: "fox",
      color: "#F7D7C5",
      phonemeCount: 3,
      sounds: [
        { text: "f", type: "consonant" },
        { text: "ɒ", type: "vowel" },
        { text: "ks", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "elephant",
      word: "elephant",
      color: "#E4E4E4",
      phonemeCount: 8,
      sounds: [
        { text: "e", type: "vowel" },
        { text: "l", type: "consonant" },
        { text: "ə", type: "vowel" },
        { text: "f", type: "consonant" },
        { text: "ənt", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "eagle",
      word: "eagle",
      color: "#DDE4F2",
      phonemeCount: 5,
      sounds: [
        { text: "iː", type: "vowel" },
        { text: "g", type: "consonant" },
        { text: "əl", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "deer",
      word: "deer",
      color: "#E7EFE0",
      phonemeCount: 4,
      sounds: [
        { text: "d", type: "consonant" },
        { text: "ɪə", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "crab",
      word: "crab",
      color: "#F8E0DA",
      phonemeCount: 4,
      sounds: [
        { text: "k", type: "consonant" },
        { text: "r", type: "consonant" },
        { text: "æ", type: "vowel" },
        { text: "b", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "cow",
      word: "cow",
      color: "#F4EFD8",
      phonemeCount: 3,
      sounds: [
        { text: "k", type: "consonant" },
        { text: "aʊ", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "chick",
      word: "chick",
      color: "#F8F0C9",
      phonemeCount: 5,
      sounds: [
        { text: "tʃ", type: "consonant" },
        { text: "ɪ", type: "vowel" },
        { text: "k", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "butterfly",
      word: "butterfly",
      color: "#E7DFF8",
      phonemeCount: 9,
      sounds: [
        { text: "b", type: "consonant" },
        { text: "ʌ", type: "vowel" },
        { text: "t", type: "consonant" },
        { text: "ə", type: "vowel" },
        { text: "flaɪ", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "buffalo",
      word: "buffalo",
      color: "#E6D7C1",
      phonemeCount: 7,
      sounds: [
        { text: "b", type: "consonant" },
        { text: "ʌ", type: "vowel" },
        { text: "f", type: "consonant" },
        { text: "ə", type: "vowel" },
        { text: "ləʊ", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "ant",
      word: "ant",
      color: "#E0E8D7",
      phonemeCount: 3,
      sounds: [
        { text: "æ", type: "vowel" },
        { text: "n", type: "consonant" },
        { text: "t", type: "consonant" },
      ],
      imageUri: null,
    },
  ],
  classroom: [
    {
      id: "book",
      word: "book",
      color: "#DFF3E2",
      phonemeCount: 4,
      sounds: [
        { text: "b", type: "consonant" },
        { text: "ʊ", type: "vowel" },
        { text: "k", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "desk",
      word: "desk",
      color: "#E8F2FF",
      phonemeCount: 4,
      sounds: [
        { text: "d", type: "consonant" },
        { text: "e", type: "vowel" },
        { text: "sk", type: "consonant" },
      ],
      imageUri: null,
    },
  ],
  fruits: [
    {
      id: "apple",
      word: "apple",
      color: "#FCEFCF",
      phonemeCount: 5,
      sounds: [
        { text: "a", type: "vowel" },
        { text: "p", type: "consonant" },
        { text: "əl", type: "vowel" },
      ],
      imageUri: null,
    },
    {
      id: "mango",
      word: "mango",
      color: "#FFE4B8",
      phonemeCount: 5,
      sounds: [
        { text: "m", type: "consonant" },
        { text: "æ", type: "vowel" },
        { text: "ŋgəʊ", type: "consonant" },
      ],
      imageUri: null,
    },
  ],
  "daily-actions": [
    {
      id: "walk",
      word: "walk",
      color: "#FDE3DF",
      phonemeCount: 4,
      sounds: [
        { text: "w", type: "consonant" },
        { text: "ɔː", type: "vowel" },
        { text: "k", type: "consonant" },
      ],
      imageUri: null,
    },
    {
      id: "jump",
      word: "jump",
      color: "#F8D9D4",
      phonemeCount: 4,
      sounds: [
        { text: "dʒ", type: "consonant" },
        { text: "ʌ", type: "vowel" },
        { text: "mp", type: "consonant" },
      ],
      imageUri: null,
    },
  ],
};

export const WORD_BANK = enrichWordBank(RAW_WORD_BANK);
