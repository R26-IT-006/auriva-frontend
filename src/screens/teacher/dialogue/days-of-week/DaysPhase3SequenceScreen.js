/**
 * DaysPhase3SequenceScreen — Phase 3 comprehension check for days.
 *
 * Fetches question from daysApi.getPhase3Question which returns one of:
 *   type: 'sequence'          → "What comes after [day]?"  (individual days)
 *   type: 'phrase_completion' → "What's the day today?" scene (phrases)
 *
 * Flow:
 *   Attempt 1 — student picks from 3 options freely.
 *   Attempt 2 — wrong options dimmed, correct glows (guided tap).
 *   After 2 attempts: recordPhase3Scenario(attempt 1 label or 'B')
 *                     + submitPhase3(phase3_passed = true) → navigate to next word.
 *
 * ASSETS REQUIRED:
 *   assets/dialogue-images/days_of_week/calendar_[day]_sequence.png
 *   assets/dialogue-images/days_of_week/classroom_scene.png
 *   assets/dialogue-audios/days/what_comes_after_monday.mp3  (+ each day)
 *   assets/dialogue-audios/days/whats_the_day_today_scene.mp3
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { dialogueApi, daysApi } from '../../../../api/dialogue';

const PROGRESS_FRACTION = 0.93;

const PLACEHOLDER_IMG   = require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png');
const PLACEHOLDER_AUDIO = require('../../../../../assets/dialogue-audios/magic_words/Thankyou.mp3');

const SEQUENCE_SCENE_IMAGES = {
  monday:    require('../../../../../assets/dialogue-videos/words/days_of_week/monday/scene.png'),
  tuesday:   require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/scene.png'),
  wednesday: require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/scene.png'),
  thursday:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/scene.png'),
  friday:    require('../../../../../assets/dialogue-videos/words/days_of_week/friday/scene.png'),
  saturday:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/scene.png'),
  sunday:    require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/scene.png'),
};
const CLASSROOM_SCENE_IMAGE = PLACEHOLDER_IMG;

const SEQUENCE_QUESTION_AUDIO = {
  monday:    PLACEHOLDER_AUDIO,
  tuesday:   PLACEHOLDER_AUDIO,
  wednesday: PLACEHOLDER_AUDIO,
  thursday:  PLACEHOLDER_AUDIO,
  friday:    PLACEHOLDER_AUDIO,
  saturday:  PLACEHOLDER_AUDIO,
  sunday:    PLACEHOLDER_AUDIO,
};
const PHRASE_QUESTION_AUDIO = {
  whats_the_day_today: PLACEHOLDER_AUDIO,
  today_is:            PLACEHOLDER_AUDIO,
};
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function DaysPhase3SequenceScreen({ route, navigation }) {
  const { student, wordKey = 'monday', wordId, sessionId } = route.params ?? {};
  const theme    = getAvatarTheme(student?.avatar_key);
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const [loading,      setLoading]      = useState(true);
  const [question,     setQuestion]     = useState(null);
  const [attempt,      setAttempt]      = useState(1);
  const [selectedId,   setSelectedId]   = useState(null);
  const [settled,      setSettled]      = useState(false);
  const [cloudText,    setCloudText]    = useState('');
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const soundRef      = useRef(null);
  const activeRef     = useRef(true);
  const attempt1Id    = useRef(null); // track first attempt word_id for API call
  const settingsFade  = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []));

  // Fetch question on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const q = await daysApi.getPhase3Question(student?.sid, wordId);
        if (!cancelled) { setQuestion(q); setLoading(false); }
      } catch {
        // Fallback: build a minimal local sequence question so screen doesn't hang
        if (!cancelled) {
          setQuestion({ type: 'sequence', question: 'Continue the sequence', options: [], correct_word_id: null });
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Play question audio after question loads
  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    async function playIntro() {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      if (cancelled) return;
      const src = question.type === 'sequence'
        ? (SEQUENCE_QUESTION_AUDIO[question.previous_day_asset_key] ?? PLACEHOLDER_AUDIO)
        : (PHRASE_QUESTION_AUDIO[wordKey] ?? PLACEHOLDER_AUDIO);
      await playSound(src);
    }
    playIntro();
    return () => { cancelled = true; };
  }, [question]);

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

  async function completePhase3(phase3Passed) {
    let result = { session_passed: false, mastered: false, status: 'in_progress' };
    try {
      result = await dialogueApi.submitPhase3(student?.sid, wordId, { phase3Passed, sessionId });
    } catch { /* ignore */ }

    await delay(1600);
    if (activeRef.current) {
      const wordLabel = wordKey
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      navigation.navigate('WordComplete', {
        student,
        wordKey,
        wordId,
        wordLabel,
        category:      'days_of_week',
        mastered:      result.mastered       ?? false,
        sessionPassed: result.session_passed  ?? false,
        status:        result.status          ?? 'in_progress',
      });
    }
  }

  async function handleOptionTap(option) {
    if (settled) return;
    const isCorrect = option.word_id === question.correct_word_id;

    if (attempt === 1) {
      attempt1Id.current = option.word_id;
      setSelectedId(option.word_id);

      if (isCorrect) {
        setSettled(true);
        setCloudText('Well done!');
        dialogueApi.submitPhase3Scenario(student?.sid, wordId, {
          scenarioLabel: 'A', selectedCorrect: true, sessionId,
        }).catch(() => {});
        await playSound(AUDIO_GOOD_JOB).catch(() => {});
        await completePhase3(true);
      } else {
        setCloudText('Try again!');
        dialogueApi.submitPhase3Scenario(student?.sid, wordId, {
          scenarioLabel: 'A', selectedCorrect: false, sessionId,
        }).catch(() => {});
        setTimeout(() => {
          if (activeRef.current) {
            setSelectedId(null);
            setAttempt(2);
            setCloudText('');
          }
        }, 1000);
      }
    } else {
      // Attempt 2 — guided tap, always correct
      setSettled(true);
      setSelectedId(option.word_id);
      setCloudText('Good job!');
      dialogueApi.submitPhase3Scenario(student?.sid, wordId, {
        scenarioLabel: 'B', selectedCorrect: isCorrect, sessionId,
      }).catch(() => {});
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
      await completePhase3(true);
    }
  }

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

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderOptions() {
    if (!question?.options?.length) return null;

    return question.options.map(opt => {
      const isCorrectOpt  = opt.word_id === question.correct_word_id;
      const isSelected    = selectedId === opt.word_id;
      const dimmed        = attempt === 2 && !isCorrectOpt && !settled;
      const glowing       = attempt === 2 && isCorrectOpt && !settled;

      return (
        <TouchableOpacity
          key={opt.word_id}
          style={[
            styles.optionBtn,
            { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline ?? 'transparent' },
            isSelected && isCorrectOpt && styles.optionCorrect,
            isSelected && !isCorrectOpt && styles.optionWrong,
            dimmed  && styles.optionDimmed,
            glowing && { borderColor: theme.button, borderWidth: 3 },
          ]}
          onPress={() => handleOptionTap(opt)}
          activeOpacity={dimmed ? 1 : 0.82}
          disabled={settled}
        >
          <Text style={[
            styles.optionText,
            { color: theme.button },
            isSelected && isCorrectOpt && { color: '#22C55E' },
            isSelected && !isCorrectOpt && { color: '#FF4D6D' },
            dimmed && { opacity: 0.35 },
          ]}>
            {opt.word}
          </Text>
        </TouchableOpacity>
      );
    });
  }

  function renderSceneImage() {
    if (!question) return null;
    if (question.type === 'sequence') {
      return SEQUENCE_SCENE_IMAGES[question.previous_day_asset_key] ?? PLACEHOLDER_IMG;
    }
    return CLASSROOM_SCENE_IMAGE;
  }

  function renderQuestionText() {
    if (!question) return '';
    return question.question ?? '';
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
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.levelLabel, { color: theme.headingText }]}>Level 1</Text>
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
          <View style={styles.content}>

            {/* Scene image */}
            <View style={[styles.sceneCard, { backgroundColor: theme.cardSurface }]}>
              <Image source={renderSceneImage()} style={styles.sceneImage} resizeMode="contain" />
            </View>

            {/* Question text */}
            <Text style={[styles.questionText, { color: theme.headingText }]}>
              {renderQuestionText()}
            </Text>

            {attempt === 2 && !settled && (
              <Text style={[styles.guidedHint, { color: theme.button }]}>
                Tap the highlighted answer
              </Text>
            )}

            {/* Options */}
            <View style={styles.optionsRow}>
              {renderOptions()}
            </View>

            <View style={{ flex: 1 }} />

            {/* Avatar + feedback */}
            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={[styles.speechBubble, { backgroundColor: theme.cardSurface }]}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={[styles.bubbleTail, { borderTopColor: theme.cardSurface }]} />
                </View>
              ) : null}
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
  levelLabel:    { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  progressTrack: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },

  content: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.lg,
  },

  sceneCard: {
    width: '100%', maxWidth: 440,
    borderRadius: Layout.radius.xl, overflow: 'hidden',
    ...Layout.shadow.md, marginBottom: Layout.spacing.lg,
  },
  sceneImage: { width: '100%', height: 180 },

  questionText: {
    fontSize: Layout.fontSize.xl, fontWeight: '800',
    textAlign: 'center', marginBottom: Layout.spacing.md,
  },
  guidedHint: {
    fontSize: Layout.fontSize.sm, fontWeight: '600',
    opacity: 0.8, marginBottom: Layout.spacing.md,
  },

  optionsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: Layout.spacing.md,
    width: '100%',
  },
  optionBtn: {
    paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md,
    borderRadius: Layout.radius.xl, borderWidth: 2,
    ...Layout.shadow.sm, minWidth: 110, alignItems: 'center',
  },
  optionCorrect: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  optionWrong:   { borderColor: '#FF4D6D', backgroundColor: 'rgba(255,77,109,0.08)' },
  optionDimmed:  { opacity: 0.4 },
  optionText:    { fontSize: Layout.fontSize.lg, fontWeight: '900' },

  avatarRow:  { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', width: '100%' },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 6, marginRight: -4 },
  speechBubble: {
    borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm,
    maxWidth: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4, elevation: 2,
  },
  speechText:  { fontSize: Layout.fontSize.sm, fontWeight: '700', textAlign: 'center' },
  bubbleTail: {
    alignSelf: 'flex-end', marginRight: 24,
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  avatarImg: { width: 115, height: 135 },

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
