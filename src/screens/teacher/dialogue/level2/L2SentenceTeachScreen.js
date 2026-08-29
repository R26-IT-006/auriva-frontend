/**
 * L2SentenceTeachScreen
 * Teaches ONE sentence, picked from L2SentencePath (route.params.sentenceIndex).
 * Steps: activityPre (sentence 5 only) → step1 → step2 → step3 → step4
 * After step4 → navigate back to L2SentencePath, flagged as completed.
 * (Previously this screen looped through all 5 sentences internally and
 * ended at L2ListenTogether — that loop now lives one level up, as the
 * path screen's 6 separate stops.)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Image, BackHandler, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { useGuardedRecorder } from '../../../../utils/useGuardedRecorder';

// ── Shared audio helpers ──────────────────────────────────────────────────────
async function playBase64Audio(base64, soundRef) {
  if (!base64) return;
  try {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    const fileUri = FileSystem.cacheDirectory + `l2_tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    soundRef.current = sound;
    await sound.playAsync();
    await new Promise(resolve => {
      sound.setOnPlaybackStatusUpdate(s => { if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); } });
    });
  } catch { /* ignore */ }
}

async function uriToBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

// For gender activity (sentence 4)
const SAMAN_IMG   = require('../../../../../assets/avatar-images/Saman.png');
const ANJALI_IMG  = require('../../../../../assets/avatar-images/Anjali.png');

const ALL_ACTIVITIES = ['Singing', 'Dancing', 'Art', 'Cricket', 'Games', 'Reading'];
const ACT_ICONS = { Singing: 'musical-notes-outline', Dancing: 'body-outline', Art: 'color-palette-outline', Cricket: 'baseball-outline', Games: 'game-controller-outline', Reading: 'book-outline' };

export default function L2SentenceTeachScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1, returnTo = 'L2SentencePath' } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const avatarImg = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;

  const [step,     setStep]     = useState(sentenceIndex === 5 && sessionData?.topic === 'self_introduction' ? 'activityPre' : 'step1');
  const [showGate, setShowGate] = useState(false);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setShowGate(true); return true; });
    return () => sub.remove();
  }, []));

  const sentence = sessionData?.sentences?.find(s => s.index === sentenceIndex);
  const sessionId = sessionData?.session_id;

  // Steps for this one sentence only: activityPre (sentence 5) is step 0 of 5;
  // everyone else is 4 steps (step1–step4).
  const STEP_ORDER = sentenceIndex === 5 && sessionData?.topic === 'self_introduction'
    ? ['activityPre', 'step1', 'step2', 'step3', 'step4']
    : ['step1', 'step2', 'step3', 'step4'];
  const progress = (STEP_ORDER.indexOf(step) + 1) / STEP_ORDER.length;

  function advanceStep() {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    const curIdx = steps.indexOf(step);
    if (step === 'activityPre') { setStep('step1'); return; }
    if (curIdx < steps.length - 1) { setStep(steps[curIdx + 1]); return; }
    // Done with this sentence — back to the path, flagged as completed.
    navigation.navigate(returnTo, { student, sessionData, justCompleted: sentenceIndex });
  }

  function handleStep3Result(result) {
    if (sessionId && student?.sid) {
      level2Api.recordStep3(student.sid, sessionId, sentenceIndex, result).catch(() => {});
    }
    advanceStep();
  }

  function handleGenderTap(tapped) {
    if (sessionId && student?.sid) {
      level2Api.recordGenderSelection(student.sid, sessionId, {
        firstTap: tapped,
        requiredPrompt: false,
        autoAdvanced: false,
      }).catch(() => {});
    }
    advanceStep();
  }

  function handleActivitySelect(activity) {
    if (sessionId && student?.sid) {
      level2Api.recordActivitySelection(student.sid, sessionId, activity).catch(() => {});
    }
    advanceStep();
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => setShowGate(true)} style={styles.headerSide} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.button }]} />
          </View>
          <View style={[styles.headerSide, styles.sentBadge]}>
            <Text style={[styles.sentBadgeText, { color: theme.headingText }]}>Lesson {sentenceIndex}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Body */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          {step === 'activityPre' && sentence && (
            <ActivityPreScreen sentence={sentence} sessionData={sessionData} theme={theme} onSelect={handleActivitySelect} />
          )}
          {step === 'step1' && sentence && (
            <Step1Listen sentence={sentence} theme={theme} avatarImg={avatarImg} onNext={advanceStep} />
          )}
          {step === 'step2' && sentence && (
            <Step2DragOne sentence={sentence} theme={theme} onComplete={advanceStep} />
          )}
          {step === 'step3' && sentence && sentenceIndex === 4 && sessionData?.topic === 'self_introduction' && (
            <Step3Gender theme={theme} gender={sessionData?.gender} onSelect={handleGenderTap} />
          )}
          {step === 'step3' && sentence && !(sentenceIndex === 4 && sessionData?.topic === 'self_introduction') && (
            <Step3DragTwo sentence={sentence} theme={theme} onResult={handleStep3Result} />
          )}
          {step === 'step4' && sentence && (
            <Step4Speak sentence={sentence} theme={theme} avatarImg={avatarImg} studentId={student?.sid} sessionId={sessionId} sentenceIndex={sentenceIndex} onNext={advanceStep} />
          )}
        </SafeAreaView>
      </View>

      <ParentGateModal
        visible={showGate}
        onSuccess={() => { setShowGate(false); navigation.navigate(returnTo, { student, sessionData }); }}
        onCancel={() => setShowGate(false)}
      />
    </View>
  );
}

// ── Helper: split sentence around dynamic value ───────────────────────────────
function splitSentence(text, dynamicValue) {
  if (!text || !dynamicValue) return ['', text ?? '', ''];
  const idx = text.toLowerCase().indexOf(dynamicValue.toLowerCase());
  if (idx === -1) return ['', text, ''];
  return [text.slice(0, idx), text.slice(idx, idx + dynamicValue.length), text.slice(idx + dynamicValue.length)];
}

// ── Step 1: Listen ────────────────────────────────────────────────────────────
function Step1Listen({ sentence, theme, avatarImg, onNext }) {
  const [before, dynamic, after] = splitSentence(sentence.text, sentence.dynamic_value);
  const soundRef   = useRef(null);
  const [playing, setPlaying] = useState(false);
  const hasAudio   = !!sentence.audio_base64;

  useEffect(() => {
    if (hasAudio) { handlePlay(); }
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handlePlay() {
    setPlaying(true);
    await playBase64Audio(sentence.audio_base64, soundRef);
    setPlaying(false);
  }

  return (
    <View style={styles.stepBody}>
      <Text style={[styles.stepTitle, { color: theme.headingText, opacity: 0.55 }]}>Step 1 · Listen</Text>
      <Text style={[styles.prompt, { color: theme.headingText }]}>{sentence.prompt}</Text>
      <View style={[styles.sentenceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>
          {before}
          <Text style={[styles.underlined, { color: theme.button }]}>{dynamic}</Text>
          {after}
        </Text>
      </View>
      <Image source={avatarImg} style={styles.avatarMd} resizeMode="contain" />
      {hasAudio ? (
        <TouchableOpacity style={[styles.ttsBtn, { borderColor: theme.button, backgroundColor: playing ? theme.button + '22' : 'transparent' }]} onPress={handlePlay} disabled={playing} activeOpacity={0.8}>
          <Ionicons name={playing ? 'volume-high' : 'volume-medium-outline'} size={22} color={theme.button} />
          <Text style={[styles.ttsBtnText, { color: theme.button }]}>{playing ? 'Playing…' : 'Listen again'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.ttsDisabled, { borderColor: theme.cardOutline }]}>
          <Ionicons name="volume-mute-outline" size={22} color="#AAA" />
          <Text style={styles.ttsDisabledText}>No audio available</Text>
        </View>
      )}
      <View style={styles.stepFooter}>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.button }]} onPress={onNext} activeOpacity={0.85}>
          <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {},
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  sentBadge: { width: 74 },
  sentBadgeText: { fontSize: Layout.fontSize.sm, fontWeight: '700' },
  progressTrack: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  body: { flex: 1 },
  stepBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md, gap: Layout.spacing.md },
  stepTitle: { fontSize: Layout.fontSize.xs, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  stepTitleSinhala: { fontSize: Layout.fontSize.xs, fontWeight: '500', opacity: 0.6, marginTop: -6, textAlign: 'center' },
  prompt: { fontSize: Layout.fontSize.xl, fontWeight: '900', textAlign: 'center', lineHeight: 30 },
  sentenceCard: { width: '100%', borderRadius: Layout.radius.xl, borderWidth: 2, paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', ...Layout.shadow.sm },
  sentenceText: { fontSize: Layout.fontSize.xl, fontWeight: '700', textAlign: 'center' },
  underlined: { textDecorationLine: 'underline', fontWeight: '900' },
  avatarMd: { width: 120, height: 140 },
  ttsDisabled: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Layout.radius.full, paddingHorizontal: Layout.spacing.md, paddingVertical: 8, borderStyle: 'dashed' },
  ttsDisabledText: { fontSize: Layout.fontSize.sm, color: '#AAA', fontWeight: '600' },
  ttsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Layout.radius.full, paddingHorizontal: Layout.spacing.md, paddingVertical: 8 },
  ttsBtnText: { fontSize: Layout.fontSize.sm, fontWeight: '700' },
  stepFooter: { width: '100%', alignItems: 'flex-end', marginTop: Layout.spacing.sm },
  nextBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md, borderRadius: Layout.radius.full, ...Layout.shadow.md },
  nextText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
  dropSlot: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)', borderRadius: Layout.radius.md, paddingHorizontal: Layout.spacing.lg, paddingVertical: 10, minWidth: 80, alignItems: 'center', marginHorizontal: 4 },
  dropSlotPlaceholder: { fontSize: Layout.fontSize.xl, color: 'rgba(0,0,0,0.3)', fontWeight: '700' },
  dropSlotFilled: { fontSize: Layout.fontSize.xl, fontWeight: '900', color: '#22C55E' },
  dragHint: { fontSize: Layout.fontSize.sm, opacity: 0.5, fontWeight: '600' },
  dragHintSinhala: { fontSize: Layout.fontSize.xs, opacity: 0.45, fontWeight: '500', textAlign: 'center', marginTop: -6 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: Layout.spacing.xl, borderRadius: Layout.radius.xl, borderWidth: 2, borderColor: 'rgba(0,0,0,0.08)', ...Layout.shadow.md },
  tileText: { fontSize: Layout.fontSize.lg, fontWeight: '800', color: '#1A1A2E' },
  tilesRow: { flexDirection: 'row', gap: Layout.spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  tileWrong: { borderColor: '#FF4D6D' },
  wrongMsg: { fontSize: Layout.fontSize.sm, color: '#FF4D6D', fontWeight: '700' },
  genderBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.lg, paddingHorizontal: Layout.spacing.lg },
  genderPrompt: { fontSize: Layout.fontSize.xxl, fontWeight: '900', textAlign: 'center' },
  genderPromptSinhala: { fontSize: Layout.fontSize.md, fontWeight: '500', textAlign: 'center', opacity: 0.65, marginTop: -6 },
  genderRow: { flexDirection: 'row', gap: Layout.spacing.xl },
  genderCard: { alignItems: 'center', gap: Layout.spacing.sm, borderRadius: Layout.radius.xl, borderWidth: 3, padding: Layout.spacing.md, flex: 1, ...Layout.shadow.md, backgroundColor: '#FFF' },
  genderAvatar: { width: 110, height: 150 },
  genderLabel: { fontSize: Layout.fontSize.lg, fontWeight: '800' },
  actPreBody: { flex: 1, paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md },
  actPreTitle: { fontSize: Layout.fontSize.xs, fontWeight: '600', opacity: 0.55, textTransform: 'uppercase', textAlign: 'center', marginBottom: Layout.spacing.sm },
  actPrePrompt: { fontSize: Layout.fontSize.xl, fontWeight: '900', textAlign: 'center', marginBottom: Layout.spacing.sm },
  actPreSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.md },
  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.md, justifyContent: 'center', flex: 1 },
  actCard: { alignItems: 'center', gap: 8, borderRadius: Layout.radius.xl, borderWidth: 2.5, paddingVertical: Layout.spacing.lg, paddingHorizontal: Layout.spacing.lg, width: 100, backgroundColor: '#FFF', ...Layout.shadow.sm },
  actCardSel: {},
  actCardLabel: { fontSize: Layout.fontSize.sm, fontWeight: '700' },
  actConfirmBtn: { borderRadius: Layout.radius.full, paddingVertical: Layout.spacing.md, alignItems: 'center', marginTop: Layout.spacing.md, ...Layout.shadow.md },
  actConfirmText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  micBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', ...Layout.shadow.md },
  micDisabledText: { fontSize: Layout.fontSize.sm, color: '#AAA', fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, ...Layout.shadow.sm, position: 'relative' },
  bubbleText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
  bubbleSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.7, marginTop: 2 },
  bubbleTail: { position: 'absolute', right: -10, bottom: 12, width: 0, height: 0, borderTopWidth: 8, borderTopColor: 'transparent', borderBottomWidth: 8, borderBottomColor: 'transparent', borderLeftWidth: 10 },
});

// ── Step 2: Single drag-drop ──────────────────────────────────────────────────
function Step2DragOne({ sentence, theme, onComplete }) {
  const [placed, setPlaced] = useState(false);
  const dropRef = useRef(null);
  const [dropBounds, setDropBounds] = useState(null);
  const pan   = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  // liveRef avoids stale closures in PanResponder callbacks
  const liveRef = useRef({ dropBounds, placed, onComplete });
  liveRef.current = { dropBounds, placed, onComplete };

  function measureDrop() { dropRef.current?.measure((x, y, w, h, px, py) => setDropBounds({ x: px, y: py, w, h })); }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !liveRef.current.placed,
    onPanResponderGrant: () => { pan.setOffset({ x: pan.x._value, y: pan.y._value }); pan.setValue({ x: 0, y: 0 }); Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start(); },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (e, g) => {
      pan.flattenOffset(); Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
      const { dropBounds: db, onComplete: oc } = liveRef.current;
      const MARGIN = 50;
      const inZone = db && g.moveX >= db.x - MARGIN && g.moveX <= db.x + db.w + MARGIN && g.moveY >= db.y - MARGIN && g.moveY <= db.y + db.h + MARGIN;
      if (inZone) { setPlaced(true); setTimeout(oc, 800); }
      else { Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 10 }).start(); }
    },
  })).current;

  const [before, , after] = splitSentence(sentence.text, sentence.dynamic_value);

  return (
    <View style={styles.stepBody}>
      <Text style={[styles.stepTitle, { color: theme.headingText, opacity: 0.55 }]}>Step 2 · Drag & Drop</Text>
      <Text style={[styles.prompt, { color: theme.headingText }]}>{sentence.prompt}</Text>
      <View style={[styles.sentenceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>
          {before}
        </Text>
        <Animated.View ref={dropRef} onLayout={measureDrop} style={[styles.dropSlot, placed && { backgroundColor: '#D1FAE5', borderColor: '#22C55E' }]}>
          {placed ? <Text style={styles.dropSlotFilled}>{sentence.dynamic_value} ✓</Text>
                  : <Text style={styles.dropSlotPlaceholder}>________</Text>}
        </Animated.View>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>{after}</Text>
      </View>
      <Text style={[styles.dragHint, { color: theme.headingText }]}>
        <Ionicons name="hand-left-outline" size={14} /> Drag the card below into the blank
      </Text>
      {!placed && (
        <Animated.View style={[styles.tile, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }]} {...panResponder.panHandlers}>
          <Text style={styles.tileText}>{sentence.dynamic_value}</Text>
          <Text style={{ fontSize: 16 }}>✨</Text>
        </Animated.View>
      )}
    </View>
  );
}


// ── DragCard: single draggable tile used by Step3DragTwo ─────────────────────
function DragCard({ label, isCorrect, isHint, dropBounds, placed, onCorrect, onWrong, theme }) {
  const pan   = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const liveRef = useRef({ dropBounds, placed, isCorrect, onCorrect, onWrong });
  liveRef.current = { dropBounds, placed, isCorrect, onCorrect, onWrong };

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !liveRef.current.placed,
    onPanResponderGrant: () => { pan.setOffset({ x: pan.x._value, y: pan.y._value }); pan.setValue({ x: 0, y: 0 }); Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start(); },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (e, g) => {
      pan.flattenOffset(); Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
      const { dropBounds: db, isCorrect: ic, onCorrect: oc, onWrong: ow } = liveRef.current;
      const MARGIN = 50;
      const inZone = db && g.moveX >= db.x - MARGIN && g.moveX <= db.x + db.w + MARGIN && g.moveY >= db.y - MARGIN && g.moveY <= db.y + db.h + MARGIN;
      if (inZone) {
        if (ic) oc(); else { ow(); Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 10 }).start(); }
      } else { Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 10 }).start(); }
    },
  })).current;

  if (placed && isCorrect) return null;
  if (placed && !isCorrect) return null;
  return (
    <Animated.View style={[styles.tile, isHint && { borderColor: theme.button, borderWidth: 3 }, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }]} {...pr.panHandlers}>
      <Text style={styles.tileText}>{label}</Text>
      {isHint && <Ionicons name="star" size={14} color={theme.button} />}
    </Animated.View>
  );
}

// ── Step 3: Two-option drag-drop ──────────────────────────────────────────────
function Step3DragTwo({ sentence, theme, onResult }) {
  const [placed,   setPlaced]   = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [wrongMsg, setWrongMsg] = useState('');
  const [hint,     setHint]     = useState(false);
  const dropRef = useRef(null);
  const [dropBounds, setDropBounds] = useState(null);
  const attRef = useRef(0);

  function measureDrop() { dropRef.current?.measure((x, y, w, h, px, py) => setDropBounds({ x: px, y: py, w, h })); }

  function handleCorrect() {
    setPlaced(true);
    const r = attRef.current === 0 ? 'first_attempt' : 'required_hint';
    onResult(r);
  }
  function handleWrong() {
    const next = attRef.current + 1; attRef.current = next; setAttempts(next);
    if (next >= 3) { setPlaced(true); onResult('auto_advanced'); }
    else { setWrongMsg('Try again! 😊'); setHint(next >= 2); setTimeout(() => setWrongMsg(''), 1200); }
  }

  const [before, , after] = splitSentence(sentence.text, sentence.dynamic_value);

  return (
    <View style={styles.stepBody}>
      <Text style={[styles.stepTitle, { color: theme.headingText, opacity: 0.55 }]}>Step 3 · Pick the Right One</Text>
      <Text style={[styles.prompt, { color: theme.headingText }]}>{sentence.prompt}</Text>
      <View style={[styles.sentenceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>{before}</Text>
        <Animated.View ref={dropRef} onLayout={measureDrop} style={[styles.dropSlot, placed && { backgroundColor: '#D1FAE5', borderColor: '#22C55E' }]}>
          {placed ? <Text style={styles.dropSlotFilled}>{sentence.dynamic_value} ✓</Text>
                  : <Text style={styles.dropSlotPlaceholder}>________</Text>}
        </Animated.View>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>{after}</Text>
      </View>
      {wrongMsg ? <Text style={styles.wrongMsg}>{wrongMsg}</Text> : null}
      {!placed && (
        <View style={styles.tilesRow}>
          <DragCard label={sentence.dynamic_value} isCorrect={true}  isHint={hint} dropBounds={dropBounds} placed={placed} onCorrect={handleCorrect} onWrong={handleWrong} theme={theme} />
          <DragCard label={sentence.distractor}    isCorrect={false} isHint={false} dropBounds={dropBounds} placed={placed} onCorrect={handleCorrect} onWrong={handleWrong} theme={theme} />
        </View>
      )}
    </View>
  );
}

// ── Step 3 (Sentence 4): Gender image tap ─────────────────────────────────────
function Step3Gender({ theme, gender, onSelect }) {
  return (
    <View style={styles.genderBody}>
      <Text style={[styles.stepTitle, { color: theme.headingText, opacity: 0.55 }]}>Step 3 · Tap the Picture</Text>
      <Text style={[styles.genderPrompt, { color: theme.headingText }]}>
        Tap the picture that looks like you!
      </Text>
      <View style={styles.genderRow}>
        {[{ g: 'boy', img: SAMAN_IMG, label: 'Boy' }, { g: 'girl', img: ANJALI_IMG, label: 'Girl' }].map(({ g, img, label }) => (
          <TouchableOpacity key={g} style={[styles.genderCard, { borderColor: gender === g ? theme.button : theme.cardOutline }]} onPress={() => onSelect(g)} activeOpacity={0.85}>
            <Image source={img} style={styles.genderAvatar} resizeMode="contain" />
            <Text style={[styles.genderLabel, { color: theme.headingText }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Activity Pre-Screen (Sentence 5) ─────────────────────────────────────────
function ActivityPreScreen({ sessionData, theme, onSelect }) {
  const [selected, setSelected] = useState(null);
  return (
    <View style={styles.actPreBody}>
      <Text style={[styles.actPreTitle, { color: theme.headingText }]}>Getting Ready · Sentence 5</Text>
      <Text style={[styles.actPrePrompt, { color: theme.headingText }]}>What do you like doing?</Text>
      <View style={styles.actGrid}>
        {ALL_ACTIVITIES.map(act => {
          const sel = selected === act;
          return (
            <TouchableOpacity key={act} style={[styles.actCard, { borderColor: sel ? theme.button : theme.cardOutline }, sel && { backgroundColor: theme.button + '22' }]} onPress={() => setSelected(act)} activeOpacity={0.8}>
              <Ionicons name={ACT_ICONS[act]} size={26} color={sel ? theme.button : theme.headingText} />
              <Text style={[styles.actCardLabel, { color: sel ? theme.button : theme.headingText }]}>{act}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={[styles.actConfirmBtn, { backgroundColor: selected ? theme.button : '#CCC' }]} onPress={() => selected && onSelect(selected)} activeOpacity={selected ? 0.85 : 1} disabled={!selected}>
        <Text style={[styles.actConfirmText, { color: selected ? theme.buttonText : '#888' }]}>That's my favourite! →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Step 4: Speak ─────────────────────────────────────────────────────────────
const S4 = { IDLE: 'idle', PLAYING: 'playing', PROCESSING: 'processing', DONE: 'done' };

function Step4Speak({ sentence, theme, avatarImg, studentId, sessionId, sentenceIndex, onNext }) {
  const [phase,   setPhase]   = useState(S4.IDLE);
  const [feedbk,  setFeedbk]  = useState('');
  const soundRef    = useRef(null);
  const hasAudio    = !!sentence.audio_base64;

  const { state: recorderState, toggleRecording, reset: resetRecorder } = useGuardedRecorder({
    onStart: () => setFeedbk(''),
    onStop: uri => submitRecording(uri),
    onError: () => setPhase(S4.IDLE),
  });

  useEffect(() => {
    if (hasAudio) { handlePlay(); }
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      resetRecorder();
    };
  }, []);

  async function handlePlay() {
    setPhase(S4.PLAYING);
    await playBase64Audio(sentence.audio_base64, soundRef);
    setPhase(S4.IDLE);
  }

  function handleRecordBtn() {
    if (recorderState === 'idle' && phase !== S4.IDLE) return;
    toggleRecording();
  }

  async function submitRecording(uri) {
    setPhase(S4.PROCESSING);
    try {
      const b64 = await uriToBase64(uri);
      if (studentId && sessionId) {
        const res = await level2Api.assessStep4(studentId, sessionId, sentenceIndex, b64, 'audio/m4a');
        if (res?.data?.score >= 2) { setFeedbk('Great job! 🌟'); }
        else if (res?.data?.score === 1) { setFeedbk('Good try! 👍'); }
        else { setFeedbk('Keep practising! 💪'); }
      }
      setPhase(S4.DONE);
      setTimeout(onNext, 1200);
    } catch { setPhase(S4.IDLE); }
  }

  const isRecording  = recorderState === 'recording';
  const isProcessing = phase === S4.PROCESSING || recorderState === 'starting' || recorderState === 'stopping';
  const micColor     = isRecording ? '#FF4D6D' : theme.button;

  return (
    <View style={styles.stepBody}>
      <Text style={[styles.stepTitle, { color: theme.headingText, opacity: 0.55 }]}>Step 4 · Say It!</Text>
      <View style={styles.bubbleRow}>
        <View style={[styles.bubble, { backgroundColor: theme.cardSurface }]}>
          <Text style={[styles.bubbleText, { color: theme.headingText }]}>Repeat after me!</Text>
          <View style={[styles.bubbleTail, { borderLeftColor: theme.cardSurface }]} />
        </View>
        <Image source={avatarImg} style={styles.avatarMd} resizeMode="contain" />
      </View>
      <View style={[styles.sentenceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
        <Text style={[styles.sentenceText, { color: theme.headingText }]}>{sentence.text}</Text>
      </View>
      {hasAudio && (
        <TouchableOpacity style={[styles.ttsBtn, { borderColor: theme.button }]} onPress={handlePlay} disabled={phase === S4.PLAYING || isRecording || isProcessing} activeOpacity={0.8}>
          <Ionicons name="volume-medium-outline" size={18} color={theme.button} />
          <Text style={[styles.ttsBtnText, { color: theme.button }]}>Listen again</Text>
        </TouchableOpacity>
      )}
      <View style={styles.micRow}>
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: isRecording ? '#FF4D6D' : isProcessing ? '#CCC' : micColor }]}
          onPress={handleRecordBtn}
          disabled={isProcessing || phase === S4.DONE || phase === S4.PLAYING}
          activeOpacity={0.85}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.micDisabledText, { color: theme.headingText }]}>
          {isRecording ? 'Recording… tap to stop' : isProcessing ? 'Processing…' : phase === S4.DONE ? feedbk : 'Tap to record'}
        </Text>
      </View>
      <View style={styles.stepFooter}>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.button }]} onPress={onNext} disabled={isProcessing} activeOpacity={0.85}>
          <Text style={[styles.nextText, { color: theme.buttonText }]}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}