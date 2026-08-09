/**
 * DaysSpinningWheelScreen — UC2 Spinning Wheel Activity
 *
 * Accessible once ≥3 individual days are IN_PROGRESS or MASTERED.
 * Runs 3–4 rounds per session (system picks target, student taps the matching day).
 * Each round: wheel spins → slows to target → student taps → feedback → next round.
 *
 * API:
 *   daysApi.getSpinningWheelRound(studentId, attemptedWordIds) → { available, target, options }
 *   daysApi.recordSpinningWheelAttempt(studentId, { targetWordId, selectedWordId, sessionId })
 *
 * ASSETS REQUIRED:
 *   assets/dialogue-images/days_of_week/wheel_background.png
 *   assets/dialogue-audios/days/[day].mp3  (already needed for Phase 1/2)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { daysApi } from '../../../../api/dialogue';

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');
const DAY_AUDIO = {
  monday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Monday.mp3'),
  tuesday:   require('../../../../../assets/dialogue-audios/days_of_the_week/Tuesday.mp3'),
  wednesday: require('../../../../../assets/dialogue-audios/days_of_the_week/Wednesday.mp3'),
  thursday:  require('../../../../../assets/dialogue-audios/days_of_the_week/Thursday.mp3'),
  friday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Friday.mp3'),
  saturday:  require('../../../../../assets/dialogue-audios/days_of_the_week/Saturday.mp3'),
  sunday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Sunday.mp3'),
};
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const DAY_COLORS = [
  '#FF6B6B', '#FFB347', '#FFD700', '#90EE90',
  '#87CEEB', '#DDA0DD', '#F0A0C0',
];

const MAX_ROUNDS = 4;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function DaysSpinningWheelScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const [loading,       setLoading]       = useState(true);
  const [roundData,     setRoundData]     = useState(null);
  const [roundIdx,      setRoundIdx]      = useState(0);
  const [phase,         setPhase]         = useState('idle'); // idle | spinning | tapping | feedback | done
  const [selectedId,    setSelectedId]    = useState(null);
  const [lastCorrect,   setLastCorrect]   = useState(null);
  const [cloudText,     setCloudText]     = useState('Tap SPIN to start!');
  const [showGate,      setShowGate]      = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [gatePurpose,   setGatePurpose]   = useState('settings');

  const spinAnim     = useRef(new Animated.Value(0)).current;
  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const attemptedIds = useRef([]);
  const sessionIdRef = useRef(null);
  const settingsFade = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    loadNextRound();
  }, []);

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
        sound.setOnPlaybackStatusUpdate(s => {
          if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); }
        });
      });
    } catch { /* ignore */ }
  }

  async function loadNextRound() {
    setLoading(true);
    setSelectedId(null);
    setLastCorrect(null);
    try {
      const data = await daysApi.getSpinningWheelRound(student?.sid, attemptedIds.current);
      if (!activeRef.current) return;
      if (!data.available) {
        setPhase('done');
        setCloudText('Great work today!');
        setLoading(false);
        return;
      }
      setRoundData(data);
      setPhase('idle');
      setCloudText(`Tap SPIN to start!`);
    } catch {
      if (activeRef.current) { setPhase('done'); setCloudText('Great work today!'); }
    }
    setLoading(false);
  }

  async function handleSpin() {
    if (phase !== 'idle' || !roundData) return;
    setPhase('spinning');
    setCloudText('Watch the wheel!');

    // Spin animation: fast then slow to ~random large rotation
    const fullSpins = 5 + Math.random() * 3; // 5–8 full spins
    const targetDeg = fullSpins * 360;

    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: targetDeg,
      duration: 3200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      if (!activeRef.current) return;
      setPhase('tapping');
      setCloudText(`Tap "${DAY_LABELS[roundData.target.asset_key] ?? roundData.target.word}"!`);
      // Play the target day's audio as the cue
      const src = DAY_AUDIO[roundData.target.asset_key] ?? PLACEHOLDER_AUDIO;
      await playSound(src).catch(() => {});
    });
  }

  async function handleOptionTap(option) {
    if (phase !== 'tapping') return;
    const isCorrect = option.word_id === roundData.target.word_id;
    setSelectedId(option.word_id);
    setLastCorrect(isCorrect);
    setPhase('feedback');

    daysApi.recordSpinningWheelAttempt(student?.sid, {
      targetWordId:   roundData.target.word_id,
      selectedWordId: option.word_id,
      sessionId:      sessionIdRef.current,
    }).then(res => {
      if (res?.session_id && !sessionIdRef.current) sessionIdRef.current = res.session_id;
    }).catch(() => {});

    if (isCorrect) {
      setCloudText('Well done! 🌟');
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
    } else {
      setCloudText('Almost! Try next time 😊');
    }

    // Track attempted target to avoid repeats within session
    if (!attemptedIds.current.includes(roundData.target.word_id)) {
      attemptedIds.current = [...attemptedIds.current, roundData.target.word_id];
    }

    await delay(1800);
    if (!activeRef.current) return;

    const nextRound = roundIdx + 1;
    if (nextRound >= MAX_ROUNDS) {
      setPhase('done');
      setCloudText('Amazing job today! 🎉');
    } else {
      setRoundIdx(nextRound);
      await loadNextRound();
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  function openSettings() { setGatePurpose('settings'); setShowGate(true); }

  function onGateSuccess() {
    setShowGate(false);
    if (gatePurpose === 'back') {
      navigation.navigate('DaysMenuScreen', { student });
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

  function handleExitSession() {
    closeSettings();
    setTimeout(() => navigation.navigate('DaysMenuScreen', { student }), 300);
  }

  // ── Wheel render ──────────────────────────────────────────────────────────

  const spinInterpolate = spinAnim.interpolate({
    inputRange:  [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const segments = roundData?.options ?? [];

  const WHEEL_SIZE = 300;
  const CENTER     = WHEEL_SIZE / 2;
  const RADIUS     = CENTER - 10;

  // Renders a single pie wedge using a clipped rectangle rotated around the wheel centre.
  // Works for any segDeg <= 180° (always true for N >= 2 segments).
  function renderPieSlice(color, startDeg, segDeg, key) {
    const half = CENTER;
    return (
      <View
        key={key}
        style={{ position: 'absolute', width: WHEEL_SIZE, height: WHEEL_SIZE, transform: [{ rotate: `${startDeg - 90}deg` }] }}
      >
        <View style={{ position: 'absolute', left: half, top: 0, width: half, height: WHEEL_SIZE, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              left: 0, top: 0,
              width: half, height: WHEEL_SIZE,
              backgroundColor: color,
              transform: [
                { translateX: -(half / 2) },
                { rotate: `${180 - segDeg}deg` },
                { translateX: half / 2 },
              ],
            }}
          />
        </View>
      </View>
    );
  }

  function renderWheel() {
    if (!segments.length) {
      return (
        <View style={[styles.wheelPlaceholder, { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: CENTER }]}>
          <Text style={styles.wheelPlaceholderText}>🎡</Text>
        </View>
      );
    }

    const segAngle = 360 / segments.length;

    return (
      <Animated.View
        style={[
          styles.wheelContainer,
          { width: WHEEL_SIZE, height: WHEEL_SIZE, transform: [{ rotate: spinInterpolate }] },
        ]}
      >
        {/* Coloured pie slices */}
        {segments.map((seg, i) =>
          renderPieSlice(DAY_COLORS[i % DAY_COLORS.length], segAngle * i, segAngle, `slice-${seg.word_id}`)
        )}

        {/* Labels at each segment midpoint */}
        {segments.map((seg, i) => {
          const midAngle = segAngle * i + segAngle / 2 - 90;
          const midRad   = (midAngle * Math.PI) / 180;
          const labelR   = RADIUS * 0.60;
          const lx       = CENTER + labelR * Math.cos(midRad);
          const ly       = CENTER + labelR * Math.sin(midRad);

          return (
            <Text
              key={`label-${seg.word_id}`}
              style={[
                styles.wheelLabel,
                {
                  position: 'absolute',
                  left: lx - 36,
                  top:  ly - 10,
                  transform: [{ rotate: `${midAngle + 90}deg` }],
                  color: '#FFF',
                },
              ]}
              numberOfLines={1}
            >
              {seg.word}
            </Text>
          );
        })}

        {/* Centre cap */}
        <View style={[styles.wheelCenter, { left: CENTER - 20, top: CENTER - 20 }]} />
      </Animated.View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.button} />
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => { setGatePurpose('back'); setShowGate(true); }} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Spinning Wheel</Text>
          <Text style={[styles.roundCounter, { color: theme.headingText }]}>
            {phase !== 'done' ? `Round ${roundIdx + 1} of ${MAX_ROUNDS}` : 'Complete!'}
          </Text>
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="settings-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            {/* Cloud text instruction */}
            <Text style={[styles.instructionText, { color: theme.headingText }]}>{cloudText}</Text>

            {/* Wheel + pointer */}
            <View style={styles.wheelArea}>
              <View style={styles.wheelPointer}>
                <Ionicons name="caret-down" size={28} color={theme.button} />
              </View>
              {renderWheel()}
            </View>

            {/* Spin button */}
            {phase === 'idle' && (
              <TouchableOpacity
                style={[styles.spinBtn, { backgroundColor: theme.button }]}
                onPress={handleSpin}
                activeOpacity={0.85}
              >
                <Text style={[styles.spinBtnText, { color: theme.buttonText }]}>SPIN!</Text>
              </TouchableOpacity>
            )}

            {/* Day option buttons — shown during tapping phase */}
            {(phase === 'tapping' || phase === 'feedback') && roundData?.options?.length > 0 && (
              <View style={styles.optionsGrid}>
                {roundData.options.map(opt => {
                  const isSelected = selectedId === opt.word_id;
                  const isTarget   = opt.word_id === roundData.target.word_id;
                  const showGreen  = isSelected && isTarget;
                  const showRed    = isSelected && !isTarget;

                  return (
                    <TouchableOpacity
                      key={opt.word_id}
                      style={[
                        styles.optionBtn,
                        { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline ?? 'transparent' },
                        showGreen && styles.optionCorrect,
                        showRed   && styles.optionWrong,
                      ]}
                      onPress={() => handleOptionTap(opt)}
                      activeOpacity={phase === 'feedback' ? 1 : 0.82}
                      disabled={phase === 'feedback'}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: theme.button },
                        showGreen && { color: '#22C55E' },
                        showRed   && { color: '#FF4D6D' },
                      ]}>
                        {opt.word}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Done state */}
            {phase === 'done' && (
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: theme.button }]}
                onPress={() => navigation.navigate('DaysMenuScreen', { student })}
                activeOpacity={0.85}
              >
                <Text style={[styles.doneBtnText, { color: theme.buttonText }]}>Finish</Text>
                <Ionicons name="checkmark" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <Image source={avatarImg} style={styles.avatarImg} resizeMode="contain" />
            </View>

          </View>
        </SafeAreaView>
      </View>

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
  headerTitle:   { fontSize: Layout.fontSize.md, fontWeight: '800', flex: 1 },
  roundCounter:  { fontSize: Layout.fontSize.sm, fontWeight: '600', opacity: 0.6 },

  content: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.md,
  },

  instructionText: {
    fontSize: Layout.fontSize.xl, fontWeight: '800',
    textAlign: 'center', marginBottom: Layout.spacing.lg,
  },

  wheelArea: { alignItems: 'center', marginBottom: Layout.spacing.lg },
  wheelPointer: { alignItems: 'center', marginBottom: -4, zIndex: 10 },

  wheelContainer: {
    position: 'relative', overflow: 'hidden', borderRadius: 9999,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)',
  },
  wheelLabel: {
    fontSize: 13, fontWeight: '800', width: 72, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  wheelCenter: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  wheelPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  wheelPlaceholderText: { fontSize: 64 },

  spinBtn: {
    paddingHorizontal: Layout.spacing.xxl, paddingVertical: Layout.spacing.lg,
    borderRadius: Layout.radius.full, ...Layout.shadow.md, marginBottom: Layout.spacing.lg,
  },
  spinBtnText: { fontSize: Layout.fontSize.xxl, fontWeight: '900', letterSpacing: 2 },

  optionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: Layout.spacing.sm,
    width: '100%', marginBottom: Layout.spacing.md,
  },
  optionBtn: {
    paddingHorizontal: Layout.spacing.lg, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.xl, borderWidth: 2, ...Layout.shadow.sm, minWidth: 100, alignItems: 'center',
  },
  optionCorrect: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  optionWrong:   { borderColor: '#FF4D6D', backgroundColor: 'rgba(255,77,109,0.08)' },
  optionText:    { fontSize: Layout.fontSize.md, fontWeight: '900' },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.spacing.xxl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.full, ...Layout.shadow.md,
  },
  doneBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },

  avatarWrap: { alignItems: 'flex-end', width: '100%' },
  avatarImg:  { width: 90, height: 110 },

  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  settingsSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Layout.spacing.xl, paddingBottom: Layout.spacing.xxl,
  },
  settingsTitle:      { fontSize: Layout.fontSize.md, fontWeight: '700', color: '#333', marginBottom: Layout.spacing.lg, textAlign: 'center' },
  settingsOption:     { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, paddingVertical: Layout.spacing.md },
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider:    { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginVertical: 4 },
});
