/**
 * DaysDragToLineScreen — Phase 1 Gate (3-attempt drag-to-line)
 *
 * Attempt 1: only the correct day tile — no distractors.
 * Attempt 2: correct tile + 1 distractor (next day in sequence).
 * Attempt 3: different calendar scene + correct + prev-day distractor.
 * Wrong drop on attempt 3 → DaysPhase1Calendar with startIndex:1.
 * Any correct drop advances; after all 3 → submitPhase1Gate → DaysPhase2Production.
 *
 * ASSETS REQUIRED:
 *   assets/dialogue-images/days_of_week/calendar_monday.png   (+ each day)
 *   assets/dialogue-images/days_of_week/calendar_monday_alt.png (+ each day, attempt 3 scene)
 */

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../../api/dialogue';

// ─ Phrase keys still need dedicated scene images ─────────────────────────────
const PLACEHOLDER_IMG = require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png');
const CALENDAR_SCENES = {
  monday:    require('../../../../../assets/dialogue-videos/words/days_of_week/monday/scene.png'),
  tuesday:   require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/scene.png'),
  wednesday: require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/scene.png'),
  thursday:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/scene.png'),
  friday:    require('../../../../../assets/dialogue-videos/words/days_of_week/friday/scene.png'),
  saturday:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/scene.png'),
  sunday:    require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/scene.png'),
  whats_the_day_today: PLACEHOLDER_IMG,
  today_is:            PLACEHOLDER_IMG,
};
const CALENDAR_SCENES_ALT = {
  monday:    require('../../../../../assets/dialogue-videos/words/days_of_week/monday/context_correct.png'),
  tuesday:   require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/context_correct.png'),
  wednesday: require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/context_correct.png'),
  thursday:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/context_correct.png'),
  friday:    require('../../../../../assets/dialogue-videos/words/days_of_week/friday/context_correct.png'),
  saturday:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/context_correct.png'),
  sunday:    require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/context_correct.png'),
  whats_the_day_today: PLACEHOLDER_IMG,
  today_is:            PLACEHOLDER_IMG,
};
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const DAY_SEQUENCE = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  whats_the_day_today: "What's the day today?", today_is: 'Today is...',
};

function buildAttempts(wordKey) {
  const label   = DAY_LABELS[wordKey] ?? wordKey;
  const dayIdx  = DAY_SEQUENCE.indexOf(wordKey);
  const nextDay = dayIdx !== -1 ? DAY_LABELS[DAY_SEQUENCE[(dayIdx + 1) % 7]] : 'Tuesday';
  const prevDay = dayIdx !== -1 ? DAY_LABELS[DAY_SEQUENCE[(dayIdx + 6) % 7]] : 'Monday';
  const scene   = CALENDAR_SCENES[wordKey]    ?? PLACEHOLDER_IMG;
  const sceneAlt = CALENDAR_SCENES_ALT[wordKey] ?? PLACEHOLDER_IMG;

  return [
    {
      scene,
      prompt: `Find "${label}" on the calendar`,
      cards:  [{ label, correct: true }],
    },
    {
      scene,
      prompt: `Find "${label}" on the calendar`,
      cards:  [
        { label, correct: true },
        { label: nextDay, correct: false },
      ],
    },
    {
      scene: sceneAlt,
      prompt: `Find "${label}" on the calendar`,
      cards:  [
        { label, correct: true },
        { label: prevDay, correct: false },
      ],
    },
  ];
}

// ── Draggable card ────────────────────────────────────────────────────────────
function DraggableCard({ label, correct, dropZoneBounds, onCorrectDrop, onWrongDrop, disabled, theme }) {
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
          if (isCorrect) { setPlaced(true); onCorrect(); }
          else           { onWrong(); shakeCard(); }
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
        { borderColor: theme.cardOutline ?? 'rgba(0,0,0,0.08)' },
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
      <Text style={[styles.wordCardText, { color: theme.button }]}>{label}</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DaysDragToLineScreen({ route, navigation }) {
  const {
    student,
    wordKey = 'monday',
    wordId,
    phase1RequiredExposures = 4,
  } = route.params ?? {};

  const theme    = getAvatarTheme(student?.avatar_key);
  const attempts = buildAttempts(wordKey);

  const avatarKey   = student?.avatar_key ?? 'lily';
  const avatarImage = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const [attemptIdx,   setAttemptIdx]   = useState(0);
  const [dropState,    setDropState]    = useState('idle');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cardKey,      setCardKey]      = useState(0);

  const settingsFade    = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const dropZoneGlow    = useRef(new Animated.Value(0)).current;
  const avatarSlideY    = useRef(new Animated.Value(250)).current;
  const avatarOpacity   = useRef(new Animated.Value(0)).current;

  const dropZoneRef = useRef(null);
  const [dropZoneBounds, setDropZoneBounds] = useState(null);

  const current          = attempts[attemptIdx];
  const progressFraction = 0.70 + (attemptIdx / attempts.length) * 0.15;

  function measureDropZone() {
    dropZoneRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setDropZoneBounds({ x: pageX, y: pageY, width, height });
    });
  }

  function advanceAttempt() {
    const nextIdx = attemptIdx + 1;
    if (nextIdx >= attempts.length) {
      if (wordId && student?.sid) {
        dialogueApi.submitPhase1Gate(student.sid, wordId, true).catch(() => {});
      }
      navigation.navigate('DaysPhase2Production', { student, wordKey, wordId });
      return;
    }
    setAttemptIdx(nextIdx);
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
          advanceAttempt();
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

  const handleCorrectDrop = useCallback(() => {
    showFeedback('Great job!', 'correct');
  }, [attemptIdx]);

  const handleWrongDrop = useCallback(() => {
    const isLastAttempt = attemptIdx === attempts.length - 1;
    if (isLastAttempt) {
      showFeedback("Let's look again! 👀", 'wrong');
      setTimeout(() => {
        navigation.replace('DaysPhase1Calendar', {
          student, wordKey, wordId, phase1RequiredExposures, startIndex: 1,
        });
      }, 1800);
    } else {
      showFeedback('Oops! Try again! 😊', 'wrong');
    }
  }, [attemptIdx]);

  const dropZoneBorderColor = dropZoneGlow.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(0,0,0,0.18)', '#22C55E'],
  });
  const dropZoneBgColor = dropZoneGlow.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,255,255,0.55)', 'rgba(34,197,94,0.12)'],
  });

  // ── Settings ──────────────────────────────────────────────────────────────

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

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerSide}>
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

      {/* ── Body ── */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            {/* Left: calendar scene */}
            <View style={[styles.imageWrap, { backgroundColor: theme.cardSurface }]}>
              <Image source={current.scene} style={styles.sceneImage} resizeMode="cover" />
            </View>

            {/* Right: prompt + drop zone + cards */}
            <View style={styles.rightPanel}>

              <View style={[styles.promptCard, { backgroundColor: theme.cardSurface }]}>
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
                  <Text style={styles.dropZoneFilledText}>
                    {current.cards.find(c => c.correct)?.label} ✓
                  </Text>
                ) : (
                  <Text style={styles.dropZonePlaceholder}>Drop the day here</Text>
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
                      theme={theme}
                    />
                  ))}
                </View>
              </View>

            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* ── Wrong feedback toast ── */}
      <Animated.View style={[styles.feedbackBanner, { opacity: feedbackOpacity }]} pointerEvents="none">
        <Text style={styles.feedbackText}>{feedbackMsg}</Text>
      </Animated.View>

      {/* ── Correct: avatar popup ── */}
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

      {/* ── Parent Gate ── */}
      <ParentGateModal
        visible={showGate}
        onSuccess={onGateSuccess}
        onCancel={() => setShowGate(false)}
      />

      {/* ── Settings Sheet ── */}
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
  root: { flex: 1 },
  body: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  content: {
    flex: 1, flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.lg,
    gap:               Layout.spacing.lg,
  },

  imageWrap: {
    flex: 11, borderRadius: Layout.radius.xl,
    overflow: 'hidden', ...Layout.shadow.md,
  },
  sceneImage: { width: '100%', height: '100%' },

  rightPanel: {
    flex: 9, flexDirection: 'column',
    justifyContent: 'center', gap: Layout.spacing.lg,
  },

  promptCard: {
    borderRadius:      Layout.radius.xl,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.lg,
    ...Layout.shadow.sm,
  },
  promptText: {
    fontSize: 20, fontWeight: '800',
    lineHeight: 30, textAlign: 'center',
  },

  dropZone: {
    borderWidth: 2.5, borderStyle: 'dashed',
    borderRadius: Layout.radius.lg,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 80,
  },
  dropZonePlaceholder: {
    fontSize: Layout.fontSize.sm, color: 'rgba(0,0,0,0.35)',
    fontWeight: '600', textAlign: 'center',
  },
  dropZoneFilledText: {
    fontSize: Layout.fontSize.lg, fontWeight: '800',
    color: '#22C55E', textAlign: 'center',
  },

  cardsRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Layout.spacing.md, flexWrap: 'wrap',
  },
  dragHint:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dragHintText: { fontSize: Layout.fontSize.sm, opacity: 0.5, fontWeight: '600' },
  cardsArea: {
    flexDirection: 'row', gap: Layout.spacing.md,
    flexWrap: 'wrap', flex: 1,
  },

  wordCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14, paddingHorizontal: Layout.spacing.xl,
    borderRadius: Layout.radius.xl,
    borderWidth: 2,
    ...Layout.shadow.md,
  },
  wordCardText: { fontSize: Layout.fontSize.lg, fontWeight: '900' },

  feedbackBanner: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center', zIndex: 60,
  },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)', color: '#FFF',
    fontSize: Layout.fontSize.md, fontWeight: '700',
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full, overflow: 'hidden',
  },

  avatarPopup: { position: 'absolute', bottom: 0, right: 20, zIndex: 100 },
  avatarRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  speechBubble: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 10,
    marginBottom: 16, ...Layout.shadow.md, position: 'relative',
  },
  speechBubbleText: { fontSize: Layout.fontSize.md, fontWeight: '800', color: '#333' },
  speechBubbleTail: {
    position: 'absolute', right: -10, bottom: 12,
    width: 0, height: 0,
    borderTopWidth: 8, borderTopColor: 'transparent',
    borderBottomWidth: 8, borderBottomColor: 'transparent',
    borderLeftWidth: 10, borderLeftColor: '#FFFFFF',
  },
  avatarImage: { width: 90, height: 115 },

  settingsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle: {
    fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333',
    marginBottom: Layout.spacing.lg, textAlign: 'center',
  },
  settingsOption: {
    flexDirection: 'row', alignItems: 'center',
    gap: Layout.spacing.md, paddingVertical: Layout.spacing.md,
  },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: 4 },
});
