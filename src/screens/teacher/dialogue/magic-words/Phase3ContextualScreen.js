import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
  thank_you:     require('../../../../../assets/dialogue-audios/magic_words/ContextAwarenessThankYou.mp3'),
  im_sorry:      require('../../../../../assets/dialogue-audios/magic_words/Phase3_prompt_Imsorry.mp3'),
  youre_welcome: require('../../../../../assets/dialogue-audios/magic_words/ContextAwarenessYouWelcome.mp3'),
  excuse_me:     require('../../../../../assets/dialogue-audios/magic_words/Phase3_prompt_Excuseme.mp3'),
};

const WORD_DISPLAY = {
  thank_you:        'Thank You',
  im_sorry:         "I'm Sorry",
  youre_welcome:    "You're Welcome",
  excuse_me: 'Excuse Me',
};

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/LilyCongratulations.png'),
  megatron: require('../../../../../assets/avatar-images/MegatronCongratulations.png'),
  boba:     require('../../../../../assets/avatar-images/BobaCongratulations.png'),
  glitter:  require('../../../../../assets/avatar-images/GlitterCongratulations.png'),
};

// Per-scenario images and captions (static require — React Native bundle constraint)
const PHASE3_SCENARIOS = {
  thank_you: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
      },
      captions: { correct: 'Anjalie receives\na present', wrong1: 'Saman is eating\nbreakfast', wrong2: 'Saman is crying\nafter he fell' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong4.png'),
      },
      captions: { correct: 'Anjalie helps to pick up\nyour crayons', wrong1: 'They are playing\ntogether', wrong2: 'Anjalie and Saman are\nsinging' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong3.png'),
      },
      captions: { correct: 'Anjalie receives\na present', wrong1: 'Saman is eating\nbreakfast', wrong2: 'They are playing\ntogether' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong4.png'),
      },
      captions: { correct: 'Someone receives\na kind gift', wrong1: 'Saman is crying\nafter he fell', wrong2: 'Anjalie is reading\na book' },
    },
  },

  // im_sorry — real assets uploaded 2026-08-24: `correct` now uses im_sorry's
  // own correct_context1-4 (one per scene, matching thank_you's convention).
  // wrong1/wrong2 stay on thank_you's context_wrong images — those are
  // generic decoy photos (not tied to thank_you's own correct scenario), so
  // reusing them here is intentional, not a placeholder leftover.
  im_sorry: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/im_sorry/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
      },
      captions: { correct: 'Saman bumps into\nAnjalie', wrong1: 'They are laughing\ntogether', wrong2: 'Anjalie is reading\na book' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/im_sorry/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
      },
      captions: { correct: 'Anjalie knocks over\nSaman\'s cup', wrong1: 'Saman is eating\nlunch', wrong2: 'They are playing\noutside' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/im_sorry/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
      },
      captions: { correct: 'Saman breaks\nAnjalie\'s toy', wrong1: 'They are singing\ntogether', wrong2: 'Anjalie is drawing' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/im_sorry/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
      },
      captions: { correct: 'Someone steps on\nanother\'s foot', wrong1: 'They are playing\na game', wrong2: 'Saman is reading\na book' },
    },
  },

  // youre_welcome has 4 distinct correct and wrong images (comic strips)
  youre_welcome: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context1.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong2.png'),
      },
      captions: { correct: 'Anjalie says\n"Thank you"', wrong1: 'Anjalie is sleeping', wrong2: 'They are running\noutside' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context2.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong3.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong4.png'),
      },
      captions: { correct: 'Saman says\n"Thank you"', wrong1: 'They are drawing\ntogether', wrong2: 'Anjalie is eating\nbreakfast' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context3.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong3.png'),
      },
      captions: { correct: 'Anjalie thanks Saman\nfor his help', wrong1: 'Anjalie is sleeping', wrong2: 'They are drawing\ntogether' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/correct_context4.png'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/youre_welcome/context_wrong4.png'),
      },
      captions: { correct: 'Someone receives\na kind thank you', wrong1: 'They are running\noutside', wrong2: 'Anjalie is eating\nbreakfast' },
    },
  },

  // excuse_me — same treatment as im_sorry above.
  excuse_me: {
    A: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/excuse_me/correct_context1.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
      },
      captions: { correct: 'Saman needs to\npass by Anjalie', wrong1: 'They are laughing\ntogether', wrong2: 'Saman is eating\nlunch' },
    },
    B: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/excuse_me/correct_context2.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
      },
      captions: { correct: 'Anjalie walks through\na crowd', wrong1: 'Saman is reading\na book', wrong2: 'They are drawing\ntogether' },
    },
    C: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/excuse_me/correct_context3.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
      },
      captions: { correct: 'Saman needs to reach\nsomething behind Anjalie', wrong1: 'They are laughing\ntogether', wrong2: 'They are drawing\ntogether' },
    },
    checkpoint: {
      images: {
        correct: require('../../../../../assets/dialogue-images/words/magic_words/excuse_me/correct_context4.jpg'),
        wrong1:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong2.png'),
        wrong2:  require('../../../../../assets/dialogue-images/words/magic_words/thank_you/context_wrong1.png'),
      },
      captions: { correct: 'Someone politely\npasses through a group', wrong1: 'Saman is eating\nlunch', wrong2: 'Saman is reading\na book' },
    },
  },
};

// Progress fractions for each scenario step
const SCENARIO_PROGRESS = { A: 0.92, B: 0.95, C: 0.97, checkpoint: 0.98 };

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build the shuffled 3-image list for a given scenario using per-scenario assets
function buildScenarioImages(label, wordKey) {
  const wordData  = PHASE3_SCENARIOS[wordKey] ?? PHASE3_SCENARIOS.thank_you;
  const scenData  = wordData[label] ?? wordData.A;
  const { images, captions } = scenData;
  return shuffleArray([
    { id: 'correct', image: images.correct, caption: captions.correct, isCorrect: true  },
    { id: 'wrong1',  image: images.wrong1,  caption: captions.wrong1,  isCorrect: false },
    { id: 'wrong2',  image: images.wrong2,  caption: captions.wrong2,  isCorrect: false },
  ]);
}

export default function Phase3ContextualScreen({ route, navigation }) {
  const { student, wordKey = 'thank_you', wordId, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = WORD_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ');
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth } = useWindowDimensions();
  const isVerticalLayout = wordKey === 'youre_welcome';

  // ── Scenario state ────────────────────────────────────────────────────────
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
  const avatarPop    = useRef(new Animated.Value(0)).current;
  const [gatePurpose, setGatePurpose] = useState('settings');

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

  // Rebuild image list whenever the scenario changes
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

  // ── Scenario completion logic ─────────────────────────────────────────────

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
      navigation.navigate('Phase1Video', { student, wordKey, wordId });
      return;
    }

    clearRestartCount(student?.sid, wordId);
    navigation.navigate('WordComplete', {
      student,
      wordKey,
      wordId,
      wordLabel,
      category:      'magic_words',
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

    // Determine next step
    if (label === 'A') {
      moveToScenario('B');
      return;
    }

    if (label === 'B') {
      const aCorrect = resultsRef.current.A;
      if (aCorrect && !wasCorrect) {
        // A correct, B wrong → Checkpoint (skip C)
        moveToScenario('checkpoint');
      } else {
        moveToScenario('C');
      }
      return;
    }

    if (label === 'C') {
      const { A, B } = resultsRef.current;
      if (!A && B && wasCorrect) {
        // A wrong, B correct, C correct → Checkpoint
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

  // ── Image tap handler ─────────────────────────────────────────────────────

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

  // ── Settings ──────────────────────────────────────────────────────────────

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

  // ── Derived render values ─────────────────────────────────────────────────

  const progressFraction = SCENARIO_PROGRESS[scenario] ?? 0.92;
  const scenarioLabel    = scenario === 'checkpoint' ? 'Checkpoint' : `Scenario ${scenario}`;
  // Non-vertical layout: the source photos are wide (landscape), so cards
  // are sized for 2 per row (wrapping a 3rd to its own centered row) instead
  // of squeezing 3 into one row and cropping them into near-squares.
  const cardW = isVerticalLayout
    ? screenWidth - 2 * Layout.spacing.lg
    : Math.min(Math.floor((screenWidth - 64 - Layout.spacing.md) / 2), 380);

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
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

      {/* ── Body ── */}
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

            {/* ── Image cards ── */}
            {isVerticalLayout ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.cardsColumn}
                showsVerticalScrollIndicator={false}
              >
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
                      <View style={styles.imageWrapVertical}>
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
              </ScrollView>
            ) : (
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
            )}

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

            {!isVerticalLayout && <View style={{ flex: 1 }} />}

            {/* ── Avatar row ── */}
            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={styles.speechBubble}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={[styles.bubbleTail, { borderTopColor: '#FFFFFF' }]} />
                </View>
              ) : null}
              {cloudText ? (
                <Animated.Image
                  source={avatarImg}
                  resizeMode="contain"
                  style={[
                    styles.avatarImg,
                    {
                      opacity: avatarPop,
                      transform: [
                        { scale: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                        { translateY: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                      ],
                    },
                  ]}
                />
              ) : null}
            </View>

          </View>
        </SafeAreaView>
      </View>

      {/* ── Parent Gate ── */}
      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onDismiss={() => setShowGate(false)}
      />

      {/* ── Settings Sheet ── */}
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

  /* Header */
  headerWrap: { zIndex: 10 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    gap:               Layout.spacing.sm,
  },
  headerSide:    { width: 32, alignItems: 'center' },
  levelLabel: {
    fontSize:   Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  progressTrack: {
    flex:            1,
    height:          6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius:    Layout.radius.full,
    overflow:        'hidden',
  },
  progressFill: {
    height:       6,
    borderRadius: Layout.radius.full,
  },

  /* Body */
  body:    { flex: 1 },
  safe:    { flex: 1 },
  content: {
    flex:              1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.md,
  },

  scenarioBadge: {
    alignSelf:         'center',
    fontSize:          Layout.fontSize.xs,
    fontWeight:        Layout.fontWeight.bold,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   4,
    borderRadius:      Layout.radius.full,
    borderWidth:       1,
    marginBottom:      Layout.spacing.sm,
    overflow:          'hidden',
    textTransform:     'uppercase',
    letterSpacing:     0.8,
  },
  title: {
    fontSize:     Layout.fontSize.xl,
    fontWeight:   Layout.fontWeight.bold,
    textAlign:    'center',
    marginBottom: Layout.spacing.xs,
  },
  subtitle: {
    fontSize:     Layout.fontSize.sm,
    textAlign:    'center',
    opacity:      0.65,
    marginBottom: Layout.spacing.xl,
  },
  subtitleSinhala: {
    fontSize:     Layout.fontSize.sm,
    textAlign:    'center',
    opacity:      0.65,
    marginBottom: Layout.spacing.xl,
  },

  cardsRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            Layout.spacing.md,
  },
  imageCard: {
    borderRadius:  Layout.radius.lg,
    overflow:      'hidden',
    borderWidth:   2,
    borderColor:   'transparent',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     3,
  },
  cardCorrect: {
    borderColor: '#22C55E',
    borderWidth: 3,
  },
  cardWrong: {
    borderColor: '#FF4D6D',
    borderWidth: 2,
    opacity:     0.55,
  },
  cardsColumn: {
    gap:           Layout.spacing.md,
    paddingBottom: Layout.spacing.md,
  },
  imageWrapVertical: {
    position:    'relative',
    overflow:    'hidden',
    width:       '100%',
    aspectRatio: 16 / 9,
  },
  imageWrap: {
    position:    'relative',
    overflow:    'hidden',
    width:       '100%',
    aspectRatio: 4 / 3,
  },
  cardImage: {
    width:  '100%',
    height: '100%',
  },
  correctBadge: {
    position:        'absolute',
    top:             6,
    right:           6,
    backgroundColor: '#FFF',
    borderRadius:    12,
  },
  cardCaption: {
    fontSize:          Layout.fontSize.xs,
    fontWeight:        Layout.fontWeight.semibold,
    textAlign:         'center',
    paddingHorizontal: Layout.spacing.xs,
    paddingVertical:   Layout.spacing.sm,
  },

  /* Avatar */
  avatarRow: {
    flexDirection: 'column',
    alignItems:    'flex-end',
    marginTop:     Layout.spacing.md,
  },
  bubbleWrap: {
    width:       145,
    alignItems:  'center',
    alignSelf:   'flex-end',
    marginBottom: 2,
  },
  speechBubble: {
    backgroundColor:   '#FFFFFF',
    borderRadius:      Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical:   Layout.spacing.sm,
    maxWidth:          180,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.10,
    shadowRadius:      4,
    elevation:         2,
  },
  speechText: {
    fontSize:   Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    textAlign:  'center',
  },
  bubbleTail: {
    alignSelf:        'center',
    marginTop:        -1,
    width:            0,
    height:           0,
    borderLeftWidth:  8,
    borderRightWidth: 8,
    borderTopWidth:   10,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
  },
  avatarImg: {
    width:  145,
    height: 170,
  },

  /* Settings */
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  settingsSheet: {
    backgroundColor:      '#FFF',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              Layout.spacing.xl,
    paddingBottom:        Layout.spacing.xxl,
  },
  settingsTitle: {
    fontSize:     Layout.fontSize.md,
    fontWeight:   '700',
    color:        '#333',
    marginBottom: Layout.spacing.lg,
    textAlign:    'center',
  },
  settingsOption: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  settingsOptionText: {
    fontSize:   Layout.fontSize.md,
    fontWeight: '600',
    color:      '#333',
  },
  settingsDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical:  4,
  },

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
