import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';
import { getRestartCount, incrementRestartCount, clearRestartCount, MAX_SAME_SITTING_RESTARTS } from '../../../../utils/sessionRetryTracker';

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const ACTIVITIES = {
  hello: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You see your friend\nfor the first time today.\nYou should say...',
      cards:  [{ label: 'Hello', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You see your friend\nfor the first time today.\nYou should say...',
      cards:  [
        { label: 'Hello',   correct: true  },
        { label: 'Goodbye', correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context2.png'),
      prompt: 'You meet your teacher\nat school. You should say...',
      cards:  [
        { label: 'Hello',        correct: true  },
        { label: 'Good Morning', correct: false },
      ],
    },
  ],

  goodbye: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
      prompt: 'Your friend is going home.\nYou should say...',
      cards:  [{ label: 'Goodbye', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context1.png'),
      prompt: 'Your friend is going home.\nYou should say...',
      cards:  [
        { label: 'Goodbye', correct: true  },
        { label: 'Hello',   correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/goodbye/correct_context2.png'),
      prompt: 'School is over for the day.\nYou should say...',
      cards:  [
        { label: 'Goodbye',    correct: true  },
        { label: 'Good Night', correct: false },
      ],
    },
  ],

  good_morning: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
      prompt: 'You see your teacher\nin the morning. You should say...',
      cards:  [{ label: 'Good Morning', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context1.png'),
      prompt: 'You see your teacher\nin the morning. You should say...',
      cards:  [
        { label: 'Good Morning', correct: true  },
        { label: 'Goodbye',      correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/good_morning/correct_context2.png'),
      prompt: 'You greet your classmates\nat breakfast. You should say...',
      cards:  [
        { label: 'Good Morning', correct: true  },
        { label: 'Hello',        correct: false },
      ],
    },
  ],

  good_afternoon: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is the afternoon.\nYou see your neighbour.\nYou should say...',
      cards:  [{ label: 'Good Afternoon', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is the afternoon.\nYou see your neighbour.\nYou should say...',
      cards:  [
        { label: 'Good Afternoon', correct: true  },
        { label: 'Good Morning',   correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You meet your teacher\nafter lunch. You should say...',
      cards:  [
        { label: 'Good Afternoon', correct: true  },
        { label: 'Good Night',     correct: false },
      ],
    },
  ],

  good_night: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is bedtime.\nYou should say...',
      cards:  [{ label: 'Good Night', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is bedtime.\nYou should say...',
      cards:  [
        { label: 'Good Night', correct: true  },
        { label: 'Goodbye',    correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You are going to sleep.\nYou should say...',
      cards:  [
        { label: 'Good Night',     correct: true  },
        { label: 'Good Afternoon', correct: false },
      ],
    },
  ],

  happy_birthday: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is your friend\'s birthday.\nYou should say...',
      cards:  [{ label: 'Happy Birthday', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is your friend\'s birthday.\nYou should say...',
      cards:  [
        { label: 'Happy Birthday', correct: true  },
        { label: 'Hello',          correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'Your friend is celebrating.\nYou should say...',
      cards:  [
        { label: 'Happy Birthday', correct: true  },
        { label: 'Happy New Year', correct: false },
      ],
    },
  ],

  how_are_you: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You want to know how\nyour friend feels.\nYou should say...',
      cards:  [{ label: 'How Are You?', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You want to know how\nyour friend feels.\nYou should say...',
      cards:  [
        { label: 'How Are You?', correct: true  },
        { label: 'Hello',        correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'You see a friend\nyou haven\'t seen in a while.\nYou should say...',
      cards:  [
        { label: 'How Are You?', correct: true  },
        { label: "I'm Fine",     correct: false },
      ],
    },
  ],

  im_fine: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'Someone asks how you are.\nYou should say...',
      cards:  [{ label: "I'm Fine", correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'Someone asks how you are.\nYou should say...',
      cards:  [
        { label: "I'm Fine",    correct: true  },
        { label: 'How Are You?', correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'Your teacher asks\nhow you are feeling.\nYou should say...',
      cards:  [
        { label: "I'm Fine", correct: true  },
        { label: 'Goodbye',  correct: false },
      ],
    },
  ],

  happy_new_year: [
    {
      id: 1,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is the new year!\nYou should say...',
      cards:  [{ label: 'Happy New Year', correct: true }],
    },
    {
      id: 2,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'It is the new year!\nYou should say...',
      cards:  [
        { label: 'Happy New Year', correct: true  },
        { label: 'Happy Birthday', correct: false },
      ],
    },
    {
      id: 3,
      image:  require('../../../../../assets/dialogue-images/words/greetings/hello/correct_context1.png'),
      prompt: 'Everyone is celebrating\nthe new year. You should say...',
      cards:  [
        { label: 'Happy New Year', correct: true  },
        { label: 'Hello',          correct: false },
      ],
    },
  ],
};

function getActivities(wordKey) {
  return ACTIVITIES[wordKey] ?? ACTIVITIES.hello;
}

function DraggableCard({ label, correct, dropZoneBounds, onCorrectDrop, onWrongDrop, disabled }) {
  const pan    = useRef(new Animated.ValueXY()).current;
  const scale  = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const [placed, setPlaced] = useState(false);

  const liveRef = useRef({ dropZoneBounds, correct, disabled, placed, onCorrectDrop, onWrongDrop });
  liveRef.current = { dropZoneBounds, correct, disabled, placed, onCorrectDrop, onWrongDrop };

  function snapBack() {
    Animated.spring(pan,   { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 10 }).start();
    Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
  }

  function shakeCard() {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10,  duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 8,   duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -8,  duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 0,   duration: 50, useNativeDriver: false }),
    ]).start(() => snapBack());
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !liveRef.current.disabled && !liveRef.current.placed,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gesture) => {
        pan.flattenOffset();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();

        const { dropZoneBounds: bounds, correct: isCorrect, onCorrectDrop: onCorrect, onWrongDrop: onWrong } = liveRef.current;
        const MARGIN = 40;
        const inZone = bounds && (
          gesture.moveX >= bounds.x - MARGIN &&
          gesture.moveX <= bounds.x + bounds.width  + MARGIN &&
          gesture.moveY >= bounds.y - MARGIN &&
          gesture.moveY <= bounds.y + bounds.height + MARGIN
        );

        if (inZone) {
          if (isCorrect) {
            setPlaced(true);
            onCorrect(label);
          } else {
            onWrong(label);
            shakeCard();
          }
        } else {
          snapBack();
        }
      },
    })
  ).current;

  if (placed) return null;

  return (
    <Animated.View
      style={[
        styles.wordCard,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
            { translateX: shakeX },
          ],
          zIndex: 20,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Text style={styles.wordCardText}>{label}</Text>
      <Text style={styles.wordCardIcon}>✨</Text>
    </Animated.View>
  );
}

export default function GreetingDragToLineScreen({ route, navigation }) {
  const { student, wordKey = 'hello', wordId } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const activities = getActivities(wordKey);

  const avatarKey   = student?.avatar_key ?? 'lily';
  const avatarImage = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const [activityIdx,  setActivityIdx]  = useState(0);
  const [dropState,    setDropState]    = useState('idle');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');
  const settingsFade = useRef(new Animated.Value(0)).current;

  const dropZoneRef = useRef(null);
  const [dropZoneBounds, setDropZoneBounds] = useState(null);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const dropZoneGlow    = useRef(new Animated.Value(0)).current;
  const avatarSlideY    = useRef(new Animated.Value(250)).current;
  const avatarOpacity   = useRef(new Animated.Value(0)).current;

  const [cardKey, setCardKey] = useState(0);

  const current          = activities[activityIdx];
  const progressFraction = 0.75 + (activityIdx / activities.length) * 0.15;

  function goBackSmart() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackSmart();
      return true;
    });
    return () => { sub.remove(); };
  }, []));

  function measureDropZone() {
    dropZoneRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setDropZoneBounds({ x: pageX, y: pageY, width, height });
    });
  }

  function advanceActivity() {
    const nextIdx = activityIdx + 1;
    if (nextIdx >= activities.length) {
      if (wordId && student?.sid) {
        dialogueApi.submitPhase1Gate(student.sid, wordId, true).catch(() => {});
      }
      navigation.navigate('GreetingPhase1Complete', { student, wordKey, wordId });
      return;
    }
    setActivityIdx(nextIdx);
    setDropState('idle');
    setCardKey(k => k + 1);
  }

  function showFeedback(msg, type) {
    setFeedbackMsg(msg);
    setDropState(type);

    if (type === 'correct') {
      Animated.parallel([
        Animated.spring(avatarSlideY, { toValue: 0, useNativeDriver: true, bounciness: 14, speed: 8 }),
        Animated.timing(avatarOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      Animated.timing(dropZoneGlow, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
        Animated.timing(dropZoneGlow, { toValue: 0, duration: 500, useNativeDriver: false }).start();
      });

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(avatarOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.spring(avatarSlideY, { toValue: 250, useNativeDriver: true, bounciness: 0, speed: 20 }),
        ]).start(() => {
          avatarSlideY.setValue(250);
          advanceActivity();
        });
      }, 1800);
    } else {
      Animated.sequence([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(feedbackOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setDropState('idle'));
    }
  }

  const dropZoneBorderColor = dropZoneGlow.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(0,0,0,0.18)', '#22C55E'],
  });
  const dropZoneBgColor = dropZoneGlow.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,255,255,0.55)', 'rgba(34,197,94,0.12)'],
  });

  const handleCorrectDrop = useCallback(() => {
    showFeedback('Great job!', 'correct');
  }, [activityIdx]);

  const handleWrongDrop = useCallback(() => {
    const isLastActivity = activityIdx === activities.length - 1;
    if (!isLastActivity) {
      showFeedback("Oops! Try again! 😊", 'wrong');
      return;
    }

    // TASK-44 — same-sitting loop cap: only rewatch the video once for a
    // failed gate check.
    const alreadyRestarted = getRestartCount(student?.sid, wordId) >= MAX_SAME_SITTING_RESTARTS;

    if (!alreadyRestarted) {
      incrementRestartCount(student?.sid, wordId);
      showFeedback("Let's watch again! 👀", 'wrong');
      setTimeout(() => {
        navigation.replace('GreetingPhase1Video', { student, wordKey, wordId, startIndex: 1 });
      }, 1800);
      return;
    }

    // Loop cap hit: don't rewatch a second time. Record the honest
    // gate-failed signal (previously never sent — see Objective) and let
    // the child continue forward instead of looping again. No feedback
    // banner here — Phase 1 is exposure, not a scored evaluation, and this
    // path must not read as a right/wrong judgement to the child.
    clearRestartCount(student?.sid, wordId);
    if (wordId && student?.sid) {
      dialogueApi.submitPhase1Gate(student.sid, wordId, false).catch(() => {});
    }
    setTimeout(() => {
      navigation.navigate('GreetingPhase1Complete', { student, wordKey, wordId });
    }, 1800);
  }, [activityIdx]);

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      navigation.navigate('DialogueCategory', { student });
      return;
    }
    setShowSettings(true);
    Animated.timing(settingsFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function closeSettings() {
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
      setShowSettings(false)
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

  return (
    <View style={styles.root}>
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={goBackSmart} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressFraction * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            <View style={[styles.imageWrap, { backgroundColor: theme.cardSurface }]}>
              <Image source={current.image} style={styles.sceneImage} resizeMode="cover" />
            </View>

            <View style={styles.rightPanel}>
              <View style={styles.promptCard}>
                <Text style={[styles.promptText, { color: theme.headingText }]}>
                  {`"${current.prompt}"`}
                </Text>
              </View>

              <Animated.View
                ref={dropZoneRef}
                onLayout={measureDropZone}
                style={[styles.dropZone, { borderColor: dropZoneBorderColor, backgroundColor: dropZoneBgColor }]}
              >
                {dropState === 'correct' ? (
                  <Text style={styles.dropZoneFilledText}>
                    {current.cards.find(c => c.correct)?.label} ✓
                  </Text>
                ) : (
                  <Text style={styles.dropZonePlaceholder}>Drop the correct phrase here</Text>
                )}
              </Animated.View>

              <View style={styles.cardsRow}>
                <View style={styles.dragHint}>
                  <Ionicons name="hand-left-outline" size={16} color={theme.headingText} style={{ opacity: 0.5 }} />
                  <Text style={[styles.dragHintText, { color: theme.headingText }]}>Drag the card</Text>
                </View>
                <View style={styles.cardsArea}>
                  {current.cards.map((card) => (
                    <DraggableCard
                      key={`${cardKey}-${card.label}`}
                      label={card.label}
                      correct={card.correct}
                      dropZoneBounds={dropZoneBounds}
                      onCorrectDrop={handleCorrectDrop}
                      onWrongDrop={handleWrongDrop}
                      disabled={dropState === 'correct'}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <Animated.View style={[styles.feedbackBanner, { opacity: feedbackOpacity }]} pointerEvents="none">
        <Text style={styles.feedbackText}>{feedbackMsg}</Text>
      </Animated.View>

      <Animated.View
        style={[styles.avatarPopup, { opacity: avatarOpacity, transform: [{ translateY: avatarSlideY }] }]}
        pointerEvents="none"
      >
        <View style={styles.avatarRow}>
          <View style={styles.speechBubble}>
            <Text style={styles.speechBubbleText}>Good Job! 🌟</Text>
            <View style={styles.speechBubbleTail} />
          </View>
          <Image source={avatarImage} style={styles.avatarImage} resizeMode="contain" />
        </View>
      </Animated.View>

      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onCancel={() => setShowGate(false)}
      />

      <Modal visible={showSettings} transparent animationType="none" onRequestClose={closeSettings}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={closeSettings}>
          <Animated.View style={[styles.settingsSheet, { opacity: settingsFade }]}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.settingsTitle}>Session Options</Text>
              <TouchableOpacity style={styles.settingsOption} onPress={handleSkipWord} activeOpacity={0.7}>
                <Ionicons name="play-skip-forward-outline" size={20} color="#555" />
                <Text style={styles.settingsOptionText}>Skip this word</Text>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              <TouchableOpacity style={styles.settingsOption} onPress={handleExitSession} activeOpacity={0.7}>
                <Ionicons name="exit-outline" size={20} color="#FF4D6D" />
                <Text style={[styles.settingsOptionText, { color: '#FF4D6D' }]}>Exit session</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },

  imageWrap: {
    flex: 11,
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    ...Layout.shadow.md,
  },
  sceneImage: { width: '100%', height: '100%' },

  rightPanel: {
    flex: 9,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: Layout.spacing.lg,
  },

  promptCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: Layout.radius.xl,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.lg,
    ...Layout.shadow.sm,
  },
  promptText: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },

  dropZone: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderRadius: Layout.radius.lg,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  dropZonePlaceholder: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(0,0,0,0.35)',
    fontWeight: '600',
    textAlign: 'center',
  },
  dropZoneFilledText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '800',
    color: '#22C55E',
    textAlign: 'center',
  },

  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    flexWrap: 'wrap',
  },
  dragHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dragHintText: { fontSize: Layout.fontSize.sm, opacity: 0.5, fontWeight: '600' },
  cardsArea: {
    flexDirection: 'row',
    gap: Layout.spacing.md,
    flexWrap: 'wrap',
    flex: 1,
  },

  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: Layout.spacing.xl,
    borderRadius: Layout.radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
    ...Layout.shadow.md,
  },
  wordCardText: { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#1A1A2E' },
  wordCardIcon: { fontSize: 16 },

  feedbackBanner: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
  },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)',
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },

  avatarPopup: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    zIndex: 100,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 16,
    ...Layout.shadow.md,
    position: 'relative',
  },
  speechBubbleText: { fontSize: Layout.fontSize.md, fontWeight: '800', color: '#333' },
  speechBubbleTail: {
    position: 'absolute',
    right: -10,
    bottom: 12,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
    borderLeftWidth: 10,
    borderLeftColor: '#FFFFFF',
  },
  avatarImage: { width: 90, height: 115 },

  settingsOverlay: {
    flex: 1,
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
  settingsTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    color: '#333',
    marginBottom: Layout.spacing.lg,
    textAlign: 'center',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: 4,
  },
});
