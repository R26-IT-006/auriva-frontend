import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

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

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
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
      captions: { correct: 'Friends greeting\neach other', wrong1: 'A child eating\nlunch alone', wrong2: 'A child studying\nat home' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong4.png'),
      },
      captions: { correct: 'Meeting a teacher\nat school', wrong1: 'Playing alone\nin the garden', wrong2: 'Reading a book\nin the library' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/hello/context_wrong3.png'),
      },
      captions: { correct: 'Waving hello\nto a neighbour', wrong1: 'A child eating\nlunch alone', wrong2: 'Playing alone\nin the garden' },
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

  good_afternoon: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong_2.png'),
      },
      captions: { correct: 'Afternoon greeting\nafter school', wrong1: 'Having breakfast\nwith family', wrong2: 'Playing outside\nat night' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong.png'),
      },
      captions: { correct: 'Meeting teacher\nafter lunch', wrong1: 'Playing outside\nat night', wrong2: 'Having breakfast\nwith family' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong_2.png'),
      },
      captions: { correct: 'Greeting a neighbour\nin the afternoon', wrong1: 'Having breakfast\nwith family', wrong2: 'Playing outside\nat night' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_afternoon/context_wrong.png'),
      },
      captions: { correct: 'Someone returns\nhome in the afternoon', wrong1: 'Playing outside\nat night', wrong2: 'Having breakfast\nwith family' },
    },
  },

  good_night: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong_2.png'),
      },
      captions: { correct: 'Going to bed\nat night', wrong1: 'Playing outside\nin the morning', wrong2: 'Having lunch\ntogether' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong.png'),
      },
      captions: { correct: 'Saying goodnight\nto parents', wrong1: 'Having lunch\ntogether', wrong2: 'Playing outside\nin the morning' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong_2.png'),
      },
      captions: { correct: 'Turning off the light\nbefore sleeping', wrong1: 'Playing outside\nin the morning', wrong2: 'Having lunch\ntogether' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/good_night/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/good_night/context_wrong.png'),
      },
      captions: { correct: 'Hugging parents\nbefore bed', wrong1: 'Having lunch\ntogether', wrong2: 'Playing outside\nin the morning' },
    },
  },

  happy_birthday: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong_2.png'),
      },
      captions: { correct: 'Birthday party\nwith friends', wrong1: 'Eating lunch\ntogether', wrong2: 'Playing football\noutside' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong.png'),
      },
      captions: { correct: 'Giving a birthday\ncard to a friend', wrong1: 'Playing football\noutside', wrong2: 'Eating lunch\ntogether' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong_2.png'),
      },
      captions: { correct: 'Everyone singing\nfor the birthday person', wrong1: 'Eating lunch\ntogether', wrong2: 'Playing football\noutside' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_birthday/context_wrong.png'),
      },
      captions: { correct: 'Blowing out\nbirthday candles', wrong1: 'Playing football\noutside', wrong2: 'Eating lunch\ntogether' },
    },
  },

  how_are_you: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong_2.png'),
      },
      captions: { correct: 'Asking a friend\nhow they are feeling', wrong1: 'Playing alone\noutside', wrong2: 'Eating dinner\nquietly' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong.png'),
      },
      captions: { correct: 'Teacher asking\nthe class "How are you?"', wrong1: 'Eating dinner\nquietly', wrong2: 'Playing alone\noutside' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong_2.png'),
      },
      captions: { correct: 'Calling a friend\non the phone', wrong1: 'Playing alone\noutside', wrong2: 'Eating dinner\nquietly' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/how_are_you/context_wrong.png'),
      },
      captions: { correct: 'Greeting someone\nyou haven\'t seen in a while', wrong1: 'Eating dinner\nquietly', wrong2: 'Playing alone\noutside' },
    },
  },

  im_fine: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong_2.png'),
      },
      captions: { correct: 'Answering happily\nwhen asked "How are you?"', wrong1: 'Running outside\nalone', wrong2: 'Reading a\nstorybook quietly' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong.png'),
      },
      captions: { correct: 'Telling teacher\nyou\'re feeling well', wrong1: 'Reading a\nstorybook quietly', wrong2: 'Running outside\nalone' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong_2.png'),
      },
      captions: { correct: 'Smiling and saying\n"I\'m Fine" to a friend', wrong1: 'Running outside\nalone', wrong2: 'Reading a\nstorybook quietly' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/im_fine/context_wrong.png'),
      },
      captions: { correct: 'Responding to\n"How are you?" politely', wrong1: 'Reading a\nstorybook quietly', wrong2: 'Running outside\nalone' },
    },
  },

  happy_new_year: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong_2.png'),
      },
      captions: { correct: 'New Year\ncelebration with family', wrong1: 'Playing in\nthe garden', wrong2: 'Eating breakfast\nalone' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong.png'),
      },
      captions: { correct: 'Fireworks on\nNew Year\'s Eve', wrong1: 'Eating breakfast\nalone', wrong2: 'Playing in\nthe garden' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong_2.png'),
      },
      captions: { correct: 'Sending New Year\nwishes to friends', wrong1: 'Playing in\nthe garden', wrong2: 'Eating breakfast\nalone' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_correct.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong_2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/greetings/happy_new_year/context_wrong.png'),
      },
      captions: { correct: 'Everyone celebrating\nthe new year together', wrong1: 'Eating breakfast\nalone', wrong2: 'Playing in\nthe garden' },
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
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth } = useWindowDimensions();
  const cardW = Math.min(Math.floor((screenWidth - 64) / 3), 220);

  const [scenario,     setScenario]     = useState('A');
  const [cloudText,    setCloudText]    = useState('');
  const [selectedId,   setSelectedId]   = useState(null);
  const [settled,      setSettled]      = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const resultsRef   = useRef({ A: null, B: null, C: null, checkpoint: null });
  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const settingsFade = useRef(new Animated.Value(0)).current;

  const imageItems = useMemo(
    () => buildScenarioImages(scenario, wordKey),
    [scenario]
  );

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
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

    if (allWrong) {
      navigation.navigate('GreetingPhase1Video', { student, wordKey, wordId });
    } else {
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
  }

  function advanceFromScenario(label, wasCorrect) {
    resultsRef.current[label] = wasCorrect;

    dialogueApi.submitPhase3Scenario(
      student?.sid, wordId,
      { scenarioLabel: label, selectedCorrect: wasCorrect, sessionId }
    ).catch(() => {});

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
    }, 1600);
  }

  async function handleImageTap(item) {
    if (settled) return;
    setSelectedId(item.id);
    setSettled(true);

    if (item.isCorrect) {
      setCloudText('Great job!');
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
    } else {
      setCloudText("Let's try the next one!");
    }

    advanceFromScenario(scenario, item.isCorrect);
  }

  function openSettings() { setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
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
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerSide}>
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
                const showGreenBorder = isSelected && item.isCorrect;
                const showRedDim      = isSelected && !item.isCorrect;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleImageTap(item)}
                    activeOpacity={settled ? 1 : 0.82}
                    style={[
                      styles.imageCard,
                      { width: cardW, backgroundColor: theme.cardSurface },
                      showGreenBorder && styles.cardCorrect,
                      showRedDim      && styles.cardWrong,
                    ]}
                  >
                    <View style={[styles.imageWrap, { height: cardW }]}>
                      <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
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
              <Image source={avatarImg} style={styles.avatarImg} resizeMode="contain" />
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

  cardsRow: { flexDirection: 'row', justifyContent: 'center', gap: Layout.spacing.sm },
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
  imageWrap:   { position: 'relative', overflow: 'hidden' },
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

  avatarRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 6, marginRight: -4 },
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
    alignSelf: 'flex-end',
    marginRight: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  avatarImg: { width: 115, height: 135 },

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
});
