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
import { Audio, Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';
import { getRestartCount, incrementRestartCount, clearRestartCount, MAX_SAME_SITTING_RESTARTS } from '../../../../utils/sessionRetryTracker';
import { LinearGradient } from 'expo-linear-gradient';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';
import {
  abilityLabel, isAbilityAnswerWord, abilityWordAtOffset,
  ABILITY_DRAG_VIDEOS, ABILITY_PHOTOS,
} from '../../../../data/abilitiesWords';

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

// Shared drag-and-drop instruction audio — same clip across every category.
const DRAG_DROP_AUDIO = require('../../../../../assets/dialogue-audios/DragAndDropCommon.mp3');

// Three activities per word, the same progression as Greetings: one card,
// then the word against one other word, then against a different one.
// Activities 1–2 use the word's drag scene video, activity 3 its photo.
const ANSWER_PROMPTS = {
  // Yes / No are answers to a "Can you…?" question.
  cat3_yes: [
    'Your friend asks,\n"Can you jump?"\nYou can! You say...',
    'Your friend asks,\n"Can you jump?"\nYou can! You say...',
    'Your teacher asks,\n"Can you clap?"\nYou can! You say...',
  ],
  cat3_no: [
    'Your friend asks,\n"Can you fly?"\nYou cannot. You say...',
    'Your friend asks,\n"Can you fly?"\nYou cannot. You say...',
    'Your teacher asks,\n"Can you swim like a fish?"\nYou cannot. You say...',
  ],
};

function getActivities(wordKey) {
  const label     = abilityLabel(wordKey);
  const other1    = abilityLabel(isAbilityAnswerWord(wordKey)
    ? (wordKey === 'cat3_yes' ? 'cat3_no' : 'cat3_yes')
    : abilityWordAtOffset(wordKey, 1));
  const other2    = abilityLabel(abilityWordAtOffset(wordKey, isAbilityAnswerWord(wordKey) ? 2 : 3));
  const video     = ABILITY_DRAG_VIDEOS[wordKey] ?? null;
  const photo     = ABILITY_PHOTOS[wordKey] ?? null;
  const prompts   = ANSWER_PROMPTS[wordKey] ?? [
    'Watch the video.\nCan you...',
    'Watch the video.\nCan you...',
    'Look at the picture.\nCan you...',
  ];
  return [
    { id: 1, video, image: video ? null : photo, prompt: prompts[0],
      cards: [{ label, correct: true }] },
    { id: 2, video, image: video ? null : photo, prompt: prompts[1],
      cards: [{ label, correct: true }, { label: other1, correct: false }] },
    { id: 3, video: null, image: photo, prompt: prompts[2],
      cards: [{ label, correct: true }, { label: other2, correct: false }] },
  ];
}

const IMAGE_FRAME_PADDING = 10;
const IMAGE_FRAME_BORDER  = 3;

function DraggableCard({ label, correct, dropZoneBounds, onCorrectDrop, onWrongDrop, disabled, accent, textColor }) {
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
        accent && { borderColor: accent },
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
      <Text style={[styles.wordCardText, textColor && { color: textColor }]}>{label}</Text>
      <Text style={styles.wordCardIcon}>✨</Text>
    </Animated.View>
  );
}

export default function AbilityDragToLineScreen({ route, navigation }) {
  const { student, wordKey = 'clap', wordId } = route.params ?? {};
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
  const soundRef = useRef(null);
  const [dropZoneBounds, setDropZoneBounds] = useState(null);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const dropZoneGlow    = useRef(new Animated.Value(0)).current;
  const avatarSlideY    = useRef(new Animated.Value(250)).current;
  const avatarOpacity   = useRef(new Animated.Value(0)).current;

  const [cardKey, setCardKey] = useState(0);

  const current          = activities[activityIdx];

  // Fit the picture frame to the picture's own shape, so no empty white
  // bands sit above and below a wide scene.
  const [imageBox, setImageBox] = useState(null);
  const imageAsset = current.image ? Image.resolveAssetSource(current.image) : null;
  const imageRatio = current.video
    ? 16 / 9
    : (imageAsset?.width && imageAsset?.height ? imageAsset.width / imageAsset.height : 4 / 3);
  const FRAME_INSET = 2 * (IMAGE_FRAME_PADDING + IMAGE_FRAME_BORDER);
  let imageFrame = null;
  if (imageBox) {
    const innerW = Math.min(imageBox.width - FRAME_INSET, (imageBox.height - FRAME_INSET) * imageRatio);
    imageFrame = { width: innerW + FRAME_INSET, height: innerW / imageRatio + FRAME_INSET };
  }
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
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(DRAG_DROP_AUDIO);
        soundRef.current = sound;
        await sound.playAsync();
      } catch { /* ignore */ }
    })();
    return () => {
      sub.remove();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
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
        const result = getRestartCount(student.sid, wordId) > 0 ? 'retry_correct' : 'success';
        cat3Api.recordDragToLine(student.sid, wordId, result).catch(() => {});
      }
      navigation.navigate('AbilityPhase1Complete', { student, wordKey, wordId });
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
    outputRange: [theme.cardOutline, '#22C55E'],
  });
  const dropZoneBgColor = dropZoneGlow.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,255,255,0.7)', 'rgba(34,197,94,0.15)'],
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
        navigation.replace('AbilityPhase1Video', { student, wordKey, wordId, startIndex: 1 });
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
      cat3Api.recordDragToLine(student.sid, wordId, 'auto_advanced').catch(() => {});
    }
    setTimeout(() => {
      navigation.navigate('AbilityPhase1Complete', { student, wordKey, wordId });
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
          <TouchableOpacity onPress={goBackSmart} activeOpacity={0.7} style={[styles.headerBtn, BACK_BUTTON]}>
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressFraction * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {/* Left: scene image, framed to its own shape */}
            <View
              style={styles.imageCol}
              onLayout={(e) => setImageBox(e.nativeEvent.layout)}
            >
              {imageFrame && (
                <View style={[styles.imageWrap, imageFrame, { borderColor: theme.cardOutline }]}>
                  {current.video ? (
                    <Video
                      key={`video-${current.id}`}
                      source={current.video}
                      style={styles.sceneImage}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay
                      isLooping
                      isMuted
                    />
                  ) : (
                    <Image source={current.image} style={styles.sceneImage} resizeMode="contain" />
                  )}
                </View>
              )}
            </View>

            <View style={styles.rightPanel}>
              <View style={[styles.promptCard, { borderColor: theme.cardOutline }]}>
                <View style={[styles.promptBadge, { backgroundColor: theme.button }]}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={theme.buttonText ?? '#FFFFFF'} />
                </View>
                <Text style={[styles.promptText, { color: theme.headingText }]}>
                  {current.prompt}
                </Text>
              </View>

              <Animated.View
                ref={dropZoneRef}
                onLayout={measureDropZone}
                style={[styles.dropZone, { borderColor: dropZoneBorderColor, backgroundColor: dropZoneBgColor }]}
              >
                {dropState === 'correct' ? (
                  <View style={styles.dropZoneRow}>
                    <Ionicons name="checkmark-circle" size={30} color="#22C55E" />
                    <Text style={styles.dropZoneFilledText}>
                      {current.cards.find(c => c.correct)?.label}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.dropZoneRow}>
                    <Ionicons name="arrow-down-circle-outline" size={26} color={theme.cardOutline} />
                    <Text style={[styles.dropZonePlaceholder, { color: theme.headingText }]}>
                      Drop the correct word here
                    </Text>
                  </View>
                )}
              </Animated.View>

              <View style={styles.cardsRow}>
                <View style={styles.dragHint}>
                  <Ionicons name="hand-left-outline" size={16} color={theme.headingText} />
                  <Text style={[styles.dragHintText, { color: theme.headingText }]}>Drag a card into the box</Text>
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
                      accent={theme.cardOutline}
                      textColor={theme.headingText}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

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
    paddingHorizontal: rs(12),
    paddingVertical: rs(12),
    gap: rs(8),
  },
  headerSide: { width: rs(40), alignItems: 'center', justifyContent: 'center' },
  // Concept's round translucent header button (spacers keep headerSide).
  headerBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  progressTrack: {
    flex: 1,
    height: rs(8),
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: rs(4),
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: rs(4) },

  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },

  /* Left: scene image */
  imageCol: {
    flex: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.xl,
    borderWidth: IMAGE_FRAME_BORDER,
    padding: IMAGE_FRAME_PADDING,
    overflow: 'hidden',
    ...Layout.shadow.md,
  },
  sceneImage: {
    width: '100%',
    height: '100%',
    borderRadius: Layout.radius.md,
  },

  /* Right panel */
  rightPanel: {
    flex: 9,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: Layout.spacing.lg,
  },

  /* Prompt card */
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Layout.radius.xl,
    borderWidth: 3,
    paddingHorizontal: Layout.spacing.xl,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.lg,
    marginTop: rs(20),
    alignItems: 'center',
    ...Layout.shadow.sm,
  },
  promptBadge: {
    position: 'absolute',
    top: rs(-22),
    width: rs(44),
    height: rs(44),
    borderRadius: rs(22),
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Layout.shadow.sm,
  },
  promptText: {
    fontSize: rf(22),
    fontFamily: 'DMSans_800ExtraBold',
    lineHeight: rf(32),
    textAlign: 'center',
  },

  /* Drop zone */
  dropZone: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: Layout.radius.xl,
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: rs(96),
  },
  dropZoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
  },
  dropZonePlaceholder: {
    fontSize: Layout.fontSize.md,
    opacity: 0.55,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
  },
  dropZoneFilledText: {
    fontSize: rf(24),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#16A34A',
    textAlign: 'center',
  },

  /* Drag hint + cards */
  cardsRow: {
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: rs(14),
    paddingVertical: rs(6),
    borderRadius: Layout.radius.full,
  },
  dragHintText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
  },
  cardsArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Layout.spacing.lg,
    flexWrap: 'wrap',
  },

  /* Word card — 3D, like the buttons in the other modules */
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    backgroundColor: '#FFFFFF',
    paddingVertical: rs(14),
    paddingHorizontal: Layout.spacing.xl,
    borderRadius: rs(18),
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: 'rgba(0,0,0,0.12)',
    ...Layout.shadow.md,
  },
  wordCardText: {
    fontSize: rf(22),
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A1A2E',
  },
  wordCardIcon: {
    fontSize: rf(16),
  },

  feedbackBanner: {
    position: 'absolute',
    bottom: rs(60),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
  },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)',
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full,
    overflow: 'hidden',
  },

  avatarPopup: {
    position: 'absolute',
    bottom: 0,
    right: rs(20),
    zIndex: 100,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: rs(4) },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: rs(16),
    paddingHorizontal: rs(18),
    paddingVertical: rs(10),
    marginBottom: rs(16),
    ...Layout.shadow.md,
    position: 'relative',
  },
  speechBubbleText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_800ExtraBold', color: '#333' },
  speechBubbleTail: {
    position: 'absolute',
    right: rs(-10),
    bottom: rs(12),
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
    borderLeftWidth: 10,
    borderLeftColor: '#FFFFFF',
  },
  avatarImage: { width: rs(90), height: rs(115) },

  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    padding: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
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
  settingsOptionText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold', color: '#333' },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical: rs(4),
  },
});
