import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';

// Scene videos for the DragToLine screen — Drag_Activity.mp4 per word folder
const CAT3_SCENE = {
  cat3_yes: require('../../../../../assets/dialogue-videos/words/abilities/yes/Drag_Activity.mp4'),
  cat3_no:  require('../../../../../assets/dialogue-videos/words/abilities/no/Drag_Activity.mp4'),
  clap:     require('../../../../../assets/dialogue-videos/words/abilities/clap/Drag_Activity.mp4'),
  run:      require('../../../../../assets/dialogue-videos/words/abilities/run/Drag_Activity.mp4'),
  walk:     require('../../../../../assets/dialogue-videos/words/abilities/walk/Drag_Activity.mp4'),
  jump:     require('../../../../../assets/dialogue-videos/words/abilities/jump/Drag_Activity.mp4'),
  talk:     require('../../../../../assets/dialogue-videos/words/abilities/talk/Drag_Activity.mp4'),
  dance:    require('../../../../../assets/dialogue-videos/words/abilities/dance/Drag_Activity.mp4'),
  sing:     require('../../../../../assets/dialogue-videos/words/abilities/sing/Drag_Activity.mp4'),
  brush:    require('../../../../../assets/dialogue-videos/words/abilities/brush/Drag_Activity.mp4'),
  wash:     require('../../../../../assets/dialogue-videos/words/abilities/wash/Drag_Activity.mp4'),
  eat:      require('../../../../../assets/dialogue-videos/words/abilities/eat/Drag_Activity.mp4'),
  drink:    require('../../../../../assets/dialogue-videos/words/abilities/drink/Drag_Activity.mp4'),
  write:    require('../../../../../assets/dialogue-videos/words/abilities/write/Drag_Activity.mp4'),
  play:     require('../../../../../assets/dialogue-videos/words/abilities/play/Drag_Activity.mp4'),
  sleep:    require('../../../../../assets/dialogue-videos/words/abilities/sleep/Drag_Activity.mp4'),
  watch:    require('../../../../../assets/dialogue-videos/words/abilities/watch/Drag_Activity.mp4'),
};

const PROGRESS_FRACTION = 0.40;

const WORD_LABELS = {
  cat3_yes: 'Yes',
  cat3_no:  'No',
  clap:     'Clap',
  run:      'Run',
  walk:     'Walk',
  jump:     'Jump',
  talk:     'Talk',
  dance:    'Dance',
  sing:     'Sing',
  brush:    'Brush',
  wash:     'Wash',
  eat:      'Eat',
  drink:    'Drink',
  write:    'Write',
  play:     'Play',
  sleep:    'Sleep',
  watch:    'Watch',
};

// One distractor per word for the 2-card layout
const DISTRACTOR = {
  cat3_yes: 'No',
  cat3_no:  'Yes',
  clap:     'Run',
  run:      'Walk',
  walk:     'Jump',
  jump:     'Clap',
  talk:     'Dance',
  dance:    'Sing',
  sing:     'Talk',
  brush:    'Wash',
  wash:     'Eat',
  eat:      'Drink',
  drink:    'Write',
  write:    'Play',
  play:     'Sleep',
  sleep:    'Watch',
  watch:    'Brush',
};

function getSceneVideo(wordKey) {
  return CAT3_SCENE[wordKey] ?? null;
}

// ── Draggable card ────────────────────────────────────────────────────────────

function DraggableCard({ label, isCorrect, dropZoneBounds, onDrop, disabled, theme }) {
  const pan    = useRef(new Animated.ValueXY()).current;
  const scale  = useRef(new Animated.Value(1)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const [placed, setPlaced] = useState(false);

  const live = useRef({ dropZoneBounds, isCorrect, onDrop, disabled, placed });
  live.current = { dropZoneBounds, isCorrect, onDrop, disabled, placed };

  function snapBack() {
    Animated.spring(pan,   { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 10 }).start();
    Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10,  duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 8,   duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -8,  duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 0,   duration: 50, useNativeDriver: false }),
    ]).start(() => snapBack());
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled && !live.current.placed,
    onPanResponderGrant: () => {
      pan.setOffset({ x: pan.x._value, y: pan.y._value });
      pan.setValue({ x: 0, y: 0 });
      Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start();
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (e, g) => {
      pan.flattenOffset();
      Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();

      const { dropZoneBounds: bounds } = live.current;
      const MARGIN = 40;
      const inZone = bounds && (
        g.moveX >= bounds.x - MARGIN && g.moveX <= bounds.x + bounds.width  + MARGIN &&
        g.moveY >= bounds.y - MARGIN && g.moveY <= bounds.y + bounds.height + MARGIN
      );

      if (inZone) {
        if (live.current.isCorrect) {
          setPlaced(true);
          live.current.onDrop(true);
        } else {
          live.current.onDrop(false);
          shake();
        }
      } else {
        snapBack();
      }
    },
  })).current;

  if (placed) return null;

  return (
    <Animated.View
      style={[
        styles.wordCard,
        { backgroundColor: theme.cardSurface, transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }, { translateX: shakeX }], zIndex: 20 },
      ]}
      {...panResponder.panHandlers}
    >
      <Text style={[styles.wordCardText, { color: theme.button }]}>{label}</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Cat3DragToLineScreen({ route, navigation }) {
  const { student, wordId, wordKey, wordLabel: labelParam, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = labelParam ?? WORD_LABELS[wordKey] ?? wordKey;
  const sceneVideo = getSceneVideo(wordKey);
  const distractor = DISTRACTOR[wordKey] ?? 'Dance';

  const [attempt,      setAttempt]      = useState(1);   // 1 or 2
  const [dropState,    setDropState]    = useState('idle');  // idle | correct | wrong
  const [feedbackMsg,  setFeedbackMsg]  = useState('');
  const [cardKey,      setCardKey]      = useState(0);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

  const dropZoneRef   = useRef(null);
  const [dropZoneBounds, setDropZoneBounds] = useState(null);
  const activeRef     = useRef(true);
  const submittedRef  = useRef(false);
  const settingsFade  = useRef(new Animated.Value(0)).current;
  const feedbackOp    = useRef(new Animated.Value(0)).current;
  const dropGlow      = useRef(new Animated.Value(0)).current;

  function goBackSmart() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DialogueCategory', { student });
    }
  }

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackSmart();
      return true;
    });
    return () => { activeRef.current = false; sub.remove(); };
  }, []));

  function measureDropZone() {
    dropZoneRef.current?.measure((x, y, w, h, pageX, pageY) => {
      setDropZoneBounds({ x: pageX, y: pageY, width: w, height: h });
    });
  }

  function advanceToPhase2(result) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    cat3Api.recordDragToLine(student?.sid, wordId, result, sessionId).catch(() => {});
    setTimeout(() => {
      if (activeRef.current) {
        navigation.navigate('Cat3Phase2', { student, wordId, wordKey, wordLabel, sessionId, cueGrapheme: route.params?.cueGrapheme ?? null });
      }
    }, 1600);
  }

  function handleDrop(correct) {
    if (!correct) {
      if (attempt === 1) {
        setAttempt(2);
        showFeedbackMsg("Try again! 😊", 'wrong');
        setTimeout(() => {
          if (activeRef.current) {
            setDropState('idle');
            setCardKey(k => k + 1);
          }
        }, 1400);
      } else {
        // Second wrong → auto_advanced
        setDropState('wrong');
        showFeedbackMsg("Let's move on!", 'wrong');
        advanceToPhase2('auto_advanced');
      }
      return;
    }

    // Correct drop
    setDropState('correct');
    Animated.timing(dropGlow, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
      Animated.timing(dropGlow, { toValue: 0, duration: 500, useNativeDriver: false }).start();
    });
    const result = attempt === 1 ? 'success' : 'retry_correct';
    advanceToPhase2(result);
  }

  function showFeedbackMsg(msg, type) {
    setFeedbackMsg(msg);
    Animated.sequence([
      Animated.timing(feedbackOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(feedbackOp, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  const borderColor = dropGlow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0.18)', '#22C55E'] });
  const bgColor     = dropGlow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.55)', 'rgba(34,197,94,0.12)'] });

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
    Animated.timing(settingsFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setShowSettings(false),
    );
  }

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DialogueCategory', { student }), 300);
  }

  // Shuffle cards so correct word isn't always first
  const cards = [
    { label: wordLabel, isCorrect: true },
    { label: distractor, isCorrect: false },
  ].sort(() => Math.random() - 0.5);

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={goBackSmart} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_FRACTION * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.row}>

            {/* Left: scene video */}
            {sceneVideo ? (
              <View style={[styles.imageWrap, { backgroundColor: theme.cardSurface }]}>
                <Video
                  source={sceneVideo}
                  style={styles.sceneImg}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls={false}
                  shouldPlay
                  isLooping
                />
              </View>
            ) : (
              <View style={[styles.imageWrap, { backgroundColor: theme.button + '22', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[styles.wordFallback, { color: theme.button }]}>{wordLabel}</Text>
              </View>
            )}

            {/* Right: prompt + drop zone + cards */}
            <View style={styles.rightPanel}>

              <View style={styles.promptCard}>
                <Text style={[styles.promptText, { color: theme.headingText }]}>
                  {'Can you '}
                  <Text style={[styles.blank, { color: theme.button }]}>_____</Text>
                  {'?'}
                </Text>
                <Text style={[styles.promptSub, { color: theme.headingText }]}>
                  Drag the correct word!
                </Text>
              </View>

              <Animated.View
                ref={dropZoneRef}
                onLayout={measureDropZone}
                style={[styles.dropZone, { borderColor, backgroundColor: bgColor }]}
              >
                {dropState === 'correct' ? (
                  <Text style={styles.dropZoneFilled}>{wordLabel} ✓</Text>
                ) : (
                  <Text style={styles.dropZonePlaceholder}>Drop here</Text>
                )}
              </Animated.View>

              <View style={styles.cardsRow}>
                <View style={styles.dragHint}>
                  <Ionicons name="hand-left-outline" size={14} color={theme.headingText} style={{ opacity: 0.45 }} />
                  <Text style={[styles.dragHintText, { color: theme.headingText }]}>Drag the card</Text>
                </View>
                <View style={styles.cardsArea}>
                  {cards.map(c => (
                    <DraggableCard
                      key={`${cardKey}-${c.label}`}
                      label={c.label}
                      isCorrect={c.isCorrect}
                      dropZoneBounds={dropZoneBounds}
                      onDrop={handleDrop}
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

      {/* ── Feedback toast ── */}
      <Animated.View style={[styles.feedbackBanner, { opacity: feedbackOp }]} pointerEvents="none">
        <Text style={styles.feedbackText}>{feedbackMsg}</Text>
      </Animated.View>

      {/* ── Parent Gate ── */}
      <ParentGateModal visible={showGate} onSuccess={onGateSuccess} onCancel={() => setShowGate(false)} />

      {/* ── Settings Sheet ── */}
      <Modal visible={showSettings} transparent animationType="none" onRequestClose={closeSettings}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={closeSettings}>
          <Animated.View style={[styles.settingsSheet, { opacity: settingsFade }]}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.settingsTitle}>Session Options</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },

  row: {
    flex:              1,
    flexDirection:     'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.lg,
    gap:               Layout.spacing.lg,
  },

  imageWrap: {
    flex:         11,
    borderRadius: Layout.radius.xl,
    overflow:     'hidden',
    ...Layout.shadow.md,
  },
  sceneImg:    { width: '100%', height: '100%' },
  wordFallback: { fontSize: 56, fontWeight: '900' },

  rightPanel: { flex: 9, flexDirection: 'column', justifyContent: 'center', gap: Layout.spacing.lg },

  promptCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius:    Layout.radius.xl,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.lg,
    ...Layout.shadow.sm,
  },
  promptText: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  blank:      { textDecorationLine: 'underline' },
  promptSub:  { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.6, marginTop: 4 },

  dropZone: {
    borderWidth:    2.5,
    borderStyle:    'dashed',
    borderRadius:   Layout.radius.lg,
    paddingVertical:   Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.md,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      80,
  },
  dropZonePlaceholder: { fontSize: Layout.fontSize.sm, color: 'rgba(0,0,0,0.35)', fontWeight: '600' },
  dropZoneFilled:      { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#22C55E' },

  cardsRow:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, flexWrap: 'wrap' },
  dragHint:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dragHintText: { fontSize: Layout.fontSize.sm, opacity: 0.5, fontWeight: '600' },
  cardsArea: { flexDirection: 'row', gap: Layout.spacing.md, flexWrap: 'wrap', flex: 1 },

  wordCard: {
    paddingVertical:   14,
    paddingHorizontal: Layout.spacing.xl,
    borderRadius:      Layout.radius.xl,
    borderWidth:       2,
    borderColor:       'rgba(0,0,0,0.08)',
    ...Layout.shadow.md,
  },
  wordCardText: { fontSize: Layout.fontSize.lg, fontWeight: '800' },

  feedbackBanner: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 60 },
  feedbackText: {
    backgroundColor: 'rgba(255,77,109,0.9)',
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontWeight: '700',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    overflow:          'hidden',
  },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl },
  settingsTitle:  { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
});
