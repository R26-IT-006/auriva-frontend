import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';
import { getRestartCount, incrementRestartCount, clearRestartCount, MAX_SAME_SITTING_RESTARTS } from '../../../../utils/sessionRetryTracker';

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

const PHASE3_PROMPT_AUDIO = {
  // hello/goodbye use the new ContextAwareness recordings (one audio for
  // every scene of that word) — 2026-08-30. Every other word is unchanged.
  hello:          require('../../../../../assets/dialogue-audios/greetings/ContextAwarenessHello.mp3'),
  goodbye:        require('../../../../../assets/dialogue-audios/greetings/ContextAwarenessGoodbye.mp3'),
  good_morning:   require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Goodmorning.mp3'),
  good_afternoon: require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Goodafternoon.mp3'),
  good_night:     require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Goodnight.mp3'),
  happy_birthday: require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Happybirthday.mp3'),
  how_are_you:    require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Howareyou.mp3'),
  im_fine:        require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Imfine.mp3'),
  happy_new_year: require('../../../../../assets/dialogue-audios/greetings/Phase3_prompt_Happynewyear.mp3'),
};

const WORD_DISPLAY = {
  hello:          'Hello',
  goodbye:        'Goodbye',
  good_morning:   'Good Morning',
  good_afternoon: 'Good Afternoon',
  good_night:     'Good Night',
  happy_birthday: 'Happy Birthday',
  how_are_you:    'How Are You?',
  im_fine:        "I'm Fine",
  happy_new_year: 'Happy New Year',
};

// The avatar is on screen for the whole scenario, matching Phase 2 where it is
// always present. It sits in the neutral pose while the child is choosing and
// switches to the celebrating pose only with the feedback message, so the
// celebration stays a response to answering rather than the default state.
const AVATAR_IDLE = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../../../assets/avatar-images/MegatronCongratulations.png'),
  boba:     require('../../../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../../../assets/avatar-images/GlitterCongratulations.png'),
};

// hello — 4 correct context images + 4 wrong images
const PHASE3_SCENARIOS = {
  hello: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
      },
      captions: { correct: 'Friends greeting\neach other', wrong1: 'A child saying\nGoodbye', wrong2: 'A child eating\nlunch' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong4.png'),
      },
      captions: { correct: 'Meeting a teacher\nat school', wrong1: 'Playing \nin the garden', wrong2: 'Singing with your\nfriend' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong3.png'),
      },
      captions: { correct: 'Waving hello\nto a neighbour', wrong1: 'A child waving\nGoodbye', wrong2: 'Playing \nin the garden' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context4.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong4.png'),
      },
      captions: { correct: 'Greeting a friend\nfor the first time', wrong1: 'A child studying\nat home', wrong2: 'Reading a book\nin the library' },
    },
  },

  goodbye: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong2.png'),
      },
      captions: { correct: 'Waving goodbye\nat the door', wrong1: 'Playing at\nthe park together', wrong2: 'Eating dinner\nas a family' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong4.png'),
      },
      captions: { correct: 'Leaving school\nat the end of the day', wrong1: 'Drawing pictures\ntogether', wrong2: 'Having breakfast\nin the morning' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong3.png'),
      },
      captions: { correct: 'Saying goodbye\nto grandma', wrong1: 'Playing at\nthe park together', wrong2: 'Drawing pictures\ntogether' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context4.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/context_wrong4.png'),
      },
      captions: { correct: 'A friend leaving\nafter a visit', wrong1: 'Eating dinner\nas a family', wrong2: 'Having breakfast\nin the morning' },
    },
  },

  good_morning: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong2.png'),
      },
      captions: { correct: 'Greeting teacher\nin the morning', wrong1: 'Playing in\nthe afternoon', wrong2: 'Going to bed\nat night' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong4.png'),
      },
      captions: { correct: 'Greeting parents\nat breakfast', wrong1: 'Watching TV\nat night', wrong2: 'Playing football\nin the evening' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong3.png'),
      },
      captions: { correct: 'Morning greeting\nat the park', wrong1: 'Playing in\nthe afternoon', wrong2: 'Watching TV\nat night' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context4.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/context_wrong4.png'),
      },
      captions: { correct: 'Greeting classmates\nin the morning', wrong1: 'Going to bed\nat night', wrong2: 'Playing football\nin the evening' },
    },
  },

  // good_afternoon — real assets uploaded 2026-08-24. No dedicated
  // context_wrong images exist for this word, so the two wrong tiles borrow
  // OTHER greetings words' own correct_context photos as decoys instead —
  // a different pair of words per scene (A/B/C/checkpoint), so a scene never
  // reuses the same distractor word twice across a single word's 4 scenes.
  // The correct-image cycles through this word's own 4 correct_context
  // photos (one per scene), same convention as hello/goodbye/good_morning.
  good_afternoon: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context1.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context1.jpg'),
      },
      captions: { correct: 'Afternoon greeting\nafter school', wrong1: 'Going to bed\nat night', wrong2: 'Birthday party\nwith friends' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context2.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context2.jpg'),
      },
      captions: { correct: 'Meeting teacher\nafter lunch', wrong1: 'Teacher asking\nthe class "How are you?"', wrong2: 'Telling teacher\nyou\'re feeling well' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context3.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context3.png'),
      },
      captions: { correct: 'Greeting a neighbour\nin the afternoon', wrong1: 'Sending New Year\nwishes to friends', wrong2: 'Waving hello\nto a neighbour' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context4.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context4.png'),
      },
      captions: { correct: 'Someone returns\nhome in the afternoon', wrong1: 'A friend leaving\nafter a visit', wrong2: 'Greeting classmates\nin the morning' },
    },
  },

  // good_night — same treatment as good_afternoon above.
  good_night: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context1.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context1.jpg'),
      },
      captions: { correct: 'Going to bed\nat night', wrong1: 'Birthday party\nwith friends', wrong2: 'Asking a friend\nhow they are feeling' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context2.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context2.jpg'),
      },
      captions: { correct: 'Saying goodnight\nto parents', wrong1: 'Telling teacher\nyou\'re feeling well', wrong2: 'Fireworks on\nNew Year\'s Eve' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context3.png'),
      },
      captions: { correct: 'Turning off the light\nbefore sleeping', wrong1: 'Waving hello\nto a neighbour', wrong2: 'Saying goodbye\nto grandma' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context4.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context4.jpg'),
      },
      captions: { correct: 'Hugging parents\nbefore bed', wrong1: 'Greeting classmates\nin the morning', wrong2: 'Someone returns\nhome in the afternoon' },
    },
  },

  // happy_birthday — same treatment as good_afternoon above.
  happy_birthday: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context1.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context1.jpg'),
      },
      captions: { correct: 'Birthday party\nwith friends', wrong1: 'Asking a friend\nhow they are feeling', wrong2: 'Answering happily\nwhen asked "How are you?"' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context2.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context2.png'),
      },
      captions: { correct: 'Giving a birthday\ncard to a friend', wrong1: 'Fireworks on\nNew Year\'s Eve', wrong2: 'Meeting a teacher\nat school' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context3.png'),
      },
      captions: { correct: 'Everyone singing\nfor the birthday person', wrong1: 'Saying goodbye\nto grandma', wrong2: 'Morning greeting\nat the park' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context4.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context4.jpg'),
      },
      captions: { correct: 'Blowing out\nbirthday candles', wrong1: 'Someone returns\nhome in the afternoon', wrong2: 'Hugging parents\nbefore bed' },
    },
  },

  // how_are_you — same treatment as good_afternoon above.
  how_are_you: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context1.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context1.jpg'),
      },
      captions: { correct: 'Asking a friend\nhow they are feeling', wrong1: 'Answering happily\nwhen asked "How are you?"', wrong2: 'New Year\ncelebration with family' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context2.png'),
      },
      captions: { correct: 'Teacher asking\nthe class "How are you?"', wrong1: 'Meeting a teacher\nat school', wrong2: 'Leaving school\nat the end of the day' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context3.jpg'),
      },
      captions: { correct: 'Calling a friend\non the phone', wrong1: 'Morning greeting\nat the park', wrong2: 'Greeting a neighbour\nin the afternoon' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context4.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context4.jpg'),
      },
      captions: { correct: 'Greeting someone\nyou haven\'t seen in a while', wrong1: 'Hugging parents\nbefore bed', wrong2: 'Blowing out\nbirthday candles' },
    },
  },

  // im_fine — same treatment as good_afternoon above.
  im_fine: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context1.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      },
      captions: { correct: 'Answering happily\nwhen asked "How are you?"', wrong1: 'New Year\ncelebration with family', wrong2: 'Friends greeting\neach other' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context2.png'),
      },
      captions: { correct: 'Telling teacher\nyou\'re feeling well', wrong1: 'Leaving school\nat the end of the day', wrong2: 'Greeting parents\nat breakfast' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context3.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context3.jpg'),
      },
      captions: { correct: 'Smiling and saying\n"I\'m Fine" to a friend', wrong1: 'Greeting a neighbour\nin the afternoon', wrong2: 'Turning off the light\nbefore sleeping' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context4.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context4.jpg'),
      },
      captions: { correct: 'Responding to\n"How are you?" politely', wrong1: 'Blowing out\nbirthday candles', wrong2: 'Greeting someone\nyou haven\'t seen in a while' },
    },
  },

  // happy_new_year — same treatment as good_afternoon above.
  happy_new_year: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
      },
      captions: { correct: 'New Year\ncelebration with family', wrong1: 'Friends greeting\neach other', wrong2: 'Waving goodbye\nat the door' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/correct_context2.jpg'),
      },
      captions: { correct: 'Fireworks on\nNew Year\'s Eve', wrong1: 'Greeting parents\nat breakfast', wrong2: 'Meeting teacher\nafter lunch' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/correct_context3.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/correct_context3.jpg'),
      },
      captions: { correct: 'Sending New Year\nwishes to friends', wrong1: 'Turning off the light\nbefore sleeping', wrong2: 'Everyone singing\nfor the birthday person' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/correct_context4.jpg'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/correct_context4.jpg'),
      },
      captions: { correct: 'Everyone celebrating\nthe new year together', wrong1: 'Greeting someone\nyou haven\'t seen in a while', wrong2: 'Responding to\n"How are you?" politely' },
    },
  },
};

const SCENARIO_PROGRESS = { A: 0.92, B: 0.95, C: 0.97, checkpoint: 0.98 };

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildScenarioImages(label, wordKey) {
  const wordData  = PHASE3_SCENARIOS[wordKey] ?? PHASE3_SCENARIOS.hello;
  const scenData  = wordData[label] ?? wordData.A;
  const { images, captions } = scenData;
  return shuffleArray([
    { id: 'correct', image: images.correct, caption: captions.correct, isCorrect: true  },
    { id: 'wrong1',  image: images.wrong1,  caption: captions.wrong1,  isCorrect: false },
    { id: 'wrong2',  image: images.wrong2,  caption: captions.wrong2,  isCorrect: false },
  ]);
}

export default function GreetingPhase3ContextualScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg     = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;
  const avatarIdleImg = AVATAR_IDLE[avatarKey] ?? AVATAR_IDLE.lily;

  const { width: screenWidth } = useWindowDimensions();
  // The source photos are wide (landscape), so cards are sized for 2 per row
  // (wrapping a 3rd to its own centered row) instead of squeezing 3 into one
  // row and cropping them into near-squares.
  const cardW = Math.min(Math.floor((screenWidth - 64 - Layout.spacing.md) / 2), 380);

  const [scenario,     setScenario]     = useState('A');
  const [cloudText,    setCloudText]    = useState('');
  const [selectedId,   setSelectedId]   = useState(null);
  const [settled,      setSettled]      = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

  const resultsRef   = useRef({ A: null, B: null, C: null, checkpoint: null });
  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const settingsFade = useRef(new Animated.Value(0)).current;
  const avatarPop    = useRef(new Animated.Value(0)).current;

  // ── RC2 feature capture refs ──────────────────────────────────────────
  const renderTimestampRef      = useRef(Date.now());
  const responseLatencyRef      = useRef(null);
  const firstTapCorrectRef      = useRef(null);
  const selectionChangeCountRef = useRef(0);
  const promptCountRef          = useRef(1);

  useEffect(() => {
    renderTimestampRef.current      = Date.now();
    responseLatencyRef.current      = null;
    firstTapCorrectRef.current      = null;
    selectionChangeCountRef.current = 0;
    promptCountRef.current          = 1;
    playSound(PHASE3_PROMPT_AUDIO[wordKey]).catch(() => {});
  }, [scenario]);

  const imageItems = useMemo(
    () => buildScenarioImages(scenario, wordKey),
    [scenario]
  );

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setGatePurpose('back');
      setShowGate(true);
      return true;
    });
    return () => {
      activeRef.current = false;
      sub.remove();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []));

  async function playSound(source) {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
      await new Promise(resolve => {
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            sound.setOnPlaybackStatusUpdate(null);
            resolve();
          }
        });
      });
    } catch { /* ignore */ }
  }

  async function finalize() {
    const { A, B, C, checkpoint } = resultsRef.current;
    const phase3Passed = (A && B && C) || (checkpoint === true);
    const allWrong     = A === false && B === false && C === false;

    let result = { session_passed: false, mastered: false, status: 'in_progress' };
    try {
      result = await dialogueApi.submitPhase3(
        student?.sid, wordId,
        { phase3Passed: !!phase3Passed, sessionId }
      );
    } catch { /* ignore */ }

    await new Promise(r => setTimeout(r, 1800));
    if (!activeRef.current) return;

    // TASK-44 — same-sitting loop cap: only rewatch once. A second
    // consecutive all-wrong result on this word, this sitting, breaks out
    // to WordComplete (using the result already computed above) instead of
    // looping back to the video again.
    const alreadyRestarted = getRestartCount(student?.sid, wordId) >= MAX_SAME_SITTING_RESTARTS;

    if (allWrong && !alreadyRestarted) {
      incrementRestartCount(student?.sid, wordId);
      navigation.navigate('GreetingPhase1Video', { student, wordKey, wordId });
      return;
    }

    clearRestartCount(student?.sid, wordId);
    navigation.navigate('WordComplete', {
      student,
      wordKey,
      wordId,
      wordLabel,
      category:      'greetings',
      mastered:      result.mastered      ?? false,
      sessionPassed: result.session_passed ?? false,
      status:        result.status         ?? 'in_progress',
    });
  }

  function advanceFromScenario(
    label, wasCorrect, responseLatencyMs, selectionChangeCount, promptCount, firstTapCorrect,
  ) {
    resultsRef.current[label] = wasCorrect;

    dialogueApi.submitPhase3Scenario(
      student?.sid, wordId,
      { scenarioLabel: label, selectedCorrect: wasCorrect, sessionId,
        responseLatencyMs, selectionChangeCount, promptCount, firstTapCorrect }
    ).catch((err) => {
      // Was previously a silent no-op — this call's real-world failure rate turned out
      // to be ~100% (zero scenario rows ever landed for real pilot data), with no way
      // to tell why. Logging here so the next round of real usage actually surfaces
      // the cause instead of staying a black box.
      console.warn('[Phase3Scenario] submitPhase3Scenario failed:', label, err?.response?.status, err?.response?.data ?? err?.message);
    });

    if (label === 'A') {
      moveToScenario('B');
      return;
    }

    if (label === 'B') {
      const aCorrect = resultsRef.current.A;
      if (aCorrect && !wasCorrect) {
        moveToScenario('checkpoint');
      } else {
        moveToScenario('C');
      }
      return;
    }

    if (label === 'C') {
      const { A, B } = resultsRef.current;
      if (!A && B && wasCorrect) {
        moveToScenario('checkpoint');
      } else {
        finalize();
      }
      return;
    }

    if (label === 'checkpoint') {
      finalize();
    }
  }

  function moveToScenario(next) {
    setTimeout(() => {
      if (!activeRef.current) return;
      setScenario(next);
      setSelectedId(null);
      setSettled(false);
      setCloudText('');
      avatarPop.setValue(0);
    }, 1600);
  }

  function popAvatar() {
    avatarPop.setValue(0);
    Animated.spring(avatarPop, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 10,
    }).start();
  }

  function handleImageTap(item) {
    if (settled) return;

    if (selectedId === null) {
      responseLatencyRef.current = Date.now() - renderTimestampRef.current;
      firstTapCorrectRef.current = item.isCorrect;
    } else if (selectedId !== item.id) {
      selectionChangeCountRef.current += 1;
    }

    setSelectedId(item.id);
  }

  async function handleConfirmSelection() {
    if (settled || selectedId === null) return;
    setSettled(true);

    const chosen = imageItems.find(i => i.id === selectedId);
    if (chosen?.isCorrect) {
      setCloudText('Great job!');
      popAvatar();
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
    } else {
      setCloudText("Let's try the next one!");
      popAvatar();
    }

    const selectionChangeCount = Math.min(selectionChangeCountRef.current, 2);
    advanceFromScenario(
      scenario, !!chosen?.isCorrect,
      responseLatencyRef.current, selectionChangeCount,
      promptCountRef.current, firstTapCorrectRef.current,
    );
  }

  function handleHearAgain() {
    if (settled) return;
    promptCountRef.current += 1;
    playSound(PHASE3_PROMPT_AUDIO[wordKey]).catch(() => {});
  }

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('DialogueCategory', { student });
      }
      return;
    }
    setShowSettings(true);
    Animated.timing(settingsFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function closeSettings() {
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setShowSettings(false)
    );
  }

  function handleSkipWord() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  const progressFraction = SCENARIO_PROGRESS[scenario] ?? 0.92;
  const scenarioLabel    = scenario === 'checkpoint' ? 'Checkpoint' : `Scenario ${scenario}`;

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => { setGatePurpose('back'); setShowGate(true); }} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.levelLabel, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressFraction * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            <Text style={[styles.scenarioBadge, { color: theme.button, borderColor: theme.button + '44', backgroundColor: theme.button + '18' }]}>
              {scenarioLabel}
            </Text>

            <Text style={[styles.title, { color: theme.headingText }]}>
              {"When do we say '"}
              <Text style={{ color: theme.button, fontWeight: Layout.fontWeight.extrabold }}>
                {wordLabel}
              </Text>
              {"'?"}
            </Text>

            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              {`Select the image where we can use the word '${wordLabel}'`}
            </Text>

            <View style={styles.cardsRow}>
              {imageItems.map(item => {
                const isSelected      = selectedId === item.id;
                const showProvisional = isSelected && !settled;
                const showGreenBorder = isSelected && settled && item.isCorrect;
                const showRedDim      = isSelected && settled && !item.isCorrect;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleImageTap(item)}
                    activeOpacity={settled ? 1 : 0.82}
                    style={[
                      styles.imageCard,
                      { width: cardW, backgroundColor: theme.cardSurface },
                      showProvisional && { borderColor: theme.button, borderWidth: 3 },
                      showGreenBorder && styles.cardCorrect,
                      showRedDim      && styles.cardWrong,
                    ]}
                  >
                    <View style={styles.imageWrap}>
                      <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
                      {showGreenBorder && (
                        <View style={styles.correctBadge}>
                          <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardCaption, { color: theme.headingText }]} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleHearAgain}
                disabled={settled}
                style={[styles.hearAgainButton, { borderColor: theme.button }]}
              >
                <Ionicons name="volume-high-outline" size={16} color={theme.button} />
                <Text style={[styles.hearAgainText, { color: theme.button }]}>Hear it again</Text>
              </TouchableOpacity>
              {selectedId !== null && !settled && (
                <TouchableOpacity
                  onPress={handleConfirmSelection}
                  style={[styles.confirmButton, { backgroundColor: theme.button }]}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={styles.speechBubble}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={[styles.bubbleTail, { borderTopColor: '#FFFFFF' }]} />
                </View>
              ) : null}
              {/* Always on screen, like Phase 2. Only the pose changes, and the
                  pop is a gentle scale rather than a fade-in from nothing —
                  fading from 0 would make the avatar vanish between scenarios. */}
              <Animated.Image
                source={cloudText ? avatarImg : avatarIdleImg}
                resizeMode="contain"
                style={[
                  styles.avatarImg,
                  cloudText
                    ? {
                      transform: [
                        { scale: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
                      ],
                    }
                    : null,
                ]}
              />
            </View>

          </View>
        </SafeAreaView>
      </View>

      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onDismiss={() => setShowGate(false)}
      />

      {showSettings && (
        <Animated.View style={[styles.settingsOverlay, { opacity: settingsFade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSettings} />
          <View style={styles.settingsSheet}>
            <Text style={styles.settingsTitle}>Session Options</Text>
            <TouchableOpacity style={styles.settingsOption} onPress={handleSkipWord}>
              <Ionicons name="play-skip-forward-outline" size={22} color="#333" />
              <Text style={styles.settingsOptionText}>Skip this word</Text>
            </TouchableOpacity>
            <View style={styles.settingsDivider} />
            <TouchableOpacity style={styles.settingsOption} onPress={handleExitSession}>
              <Ionicons name="exit-outline" size={22} color="#E53E3E" />
              <Text style={[styles.settingsOptionText, { color: '#E53E3E' }]}>Exit session</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerWrap: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    gap: Layout.spacing.sm,
  },
  headerSide: { width: 32, alignItems: 'center' },
  levelLabel: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: Layout.radius.full },

  body: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
  },

  scenarioBadge: {
    alignSelf: 'center',
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.bold,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 4,
    borderRadius: Layout.radius.full,
    borderWidth: 1,
    marginBottom: Layout.spacing.sm,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.bold, textAlign: 'center', marginBottom: Layout.spacing.xs },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },
  subtitleSinhala: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },

  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Layout.spacing.md },
  imageCard: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCorrect: { borderColor: '#22C55E', borderWidth: 3 },
  cardWrong:   { borderColor: '#FF4D6D', borderWidth: 2, opacity: 0.55 },
  imageWrap:   { position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: 4 / 3 },
  cardImage:   { width: '100%', height: '100%' },
  correctBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  cardCaption: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: Layout.spacing.xs,
    paddingVertical: Layout.spacing.sm,
  },

  avatarRow: { flexDirection: 'column', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { width: 145, alignItems: 'center', alignSelf: 'flex-end', marginBottom: 2 },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  speechText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, textAlign: 'center' },
  bubbleTail: {
    alignSelf: 'center',
    marginTop: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  // Square on purpose. The idle art is 500x500 and the celebration art is
  // ~1024x1024 (Lily's is 975x1104), so a 145x170 box made `contain` render the
  // square poses at 145x145 but Lily's celebration at 145x164 — the avatar
  // visibly grew on feedback. A square box renders every pose at one size.
  avatarImg: { width: 150, height: 150 },

  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: 4 },

  actionRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            Layout.spacing.md,
    marginTop:      Layout.spacing.md,
  },
  hearAgainButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   8,
    borderRadius:      Layout.radius.full,
    borderWidth:       1.5,
  },
  hearAgainText: { fontSize: Layout.fontSize.xs, fontWeight: Layout.fontWeight.bold },
  confirmButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   8,
    borderRadius:      Layout.radius.full,
  },
  confirmButtonText: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, color: '#FFFFFF' },
});
