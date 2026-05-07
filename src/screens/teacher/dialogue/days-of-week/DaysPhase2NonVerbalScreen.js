/**
 * DaysPhase2NonVerbalScreen — Word-to-Calendar Matching
 *
 * Shows 3 calendar images, each with a different day highlighted.
 * Student taps the one matching the target day.
 * Up to 3 wrong attempts before auto-revealing and advancing.
 * Always advances to DaysPhase3Sequence.
 *
 * ASSETS REQUIRED:
 *   assets/dialogue-images/days_of_week/nv/calendar_monday_correct.png
 *   assets/dialogue-images/days_of_week/nv/calendar_monday_wrong1.png
 *   assets/dialogue-images/days_of_week/nv/calendar_monday_wrong2.png
 *   (+ same set for each day + phrase keys)
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
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

const PROGRESS_FRACTION = 0.90;

// ─ Phrase keys still need dedicated NV images ────────────────────────────────
const PLACEHOLDER_IMG = require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png');

const CALENDAR_NV_IMAGES = {
  monday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/monday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/monday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/monday/context_wrong_2.png'),
  },
  tuesday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/context_wrong_2.png'),
  },
  wednesday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/context_wrong_2.png'),
  },
  thursday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/context_wrong_2.png'),
  },
  friday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/friday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/friday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/friday/context_wrong_2.png'),
  },
  saturday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/context_wrong_2.png'),
  },
  sunday: {
    correct: require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/context_correct.png'),
    wrong1:  require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/context_wrong.png'),
    wrong2:  require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/context_wrong_2.png'),
  },
  whats_the_day_today: { correct: PLACEHOLDER_IMG, wrong1: PLACEHOLDER_IMG, wrong2: PLACEHOLDER_IMG },
  today_is:            { correct: PLACEHOLDER_IMG, wrong1: PLACEHOLDER_IMG, wrong2: PLACEHOLDER_IMG },
};
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_IMAGES = {
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
};

const AUDIO_GOOD_JOB = require('../../../../../assets/dialogue-audios/Good_job.mp3');

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  whats_the_day_today: "What's the day today?", today_is: 'Today is...',
};

const DAY_SEQUENCE = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getDistractorLabels(wordKey) {
  const idx = DAY_SEQUENCE.indexOf(wordKey);
  if (idx !== -1) {
    return [
      DAY_LABELS[DAY_SEQUENCE[(idx + 1) % 7]],
      DAY_LABELS[DAY_SEQUENCE[(idx + 2) % 7]],
    ];
  }
  return ['Monday', 'Tuesday'];
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DaysPhase2NonVerbalScreen({ route, navigation }) {
  const { student, wordKey = 'monday', wordId, sessionId } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = DAY_LABELS[wordKey] ?? wordKey;
  const avatarKey = student?.avatar_key ?? 'lily';
  const avatarImg = AVATAR_IMAGES[avatarKey] ?? AVATAR_IMAGES.lily;

  const { width: screenWidth } = useWindowDimensions();
  const cardW = Math.min(Math.floor((screenWidth - 64) / 3), 200);

  const nvImages = CALENDAR_NV_IMAGES[wordKey] ?? CALENDAR_NV_IMAGES.monday;
  const [d1, d2] = getDistractorLabels(wordKey);

  const imageItems = useMemo(() => shuffleArray([
    { id: 'correct', image: nvImages.correct, caption: wordLabel, isCorrect: true  },
    { id: 'wrong1',  image: nvImages.wrong1,  caption: d1,        isCorrect: false },
    { id: 'wrong2',  image: nvImages.wrong2,  caption: d2,        isCorrect: false },
  ]), []);

  const [cloudText,       setCloudText]       = useState('');
  const [selectedId,      setSelectedId]      = useState(null);
  const [wrongCount,      setWrongCount]      = useState(0);
  const [correctRevealed, setCorrectRevealed] = useState(false);
  const [settled,         setSettled]         = useState(false);
  const [showGate,        setShowGate]        = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [gatePurpose,     setGatePurpose]     = useState('settings');

  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const apiCalledRef = useRef(false);
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

  function goToPhase3(imageSelectedCorrect) {
    if (!apiCalledRef.current) {
      apiCalledRef.current = true;
      dialogueApi.recordPhase2Nonverbal(
        student?.sid, wordId,
        { imageSelectedCorrect, sessionId }
      ).catch(() => {});
    }
    setTimeout(() => {
      if (activeRef.current) {
        navigation.navigate('DaysPhase3Sequence', {
          student, wordKey, wordId, sessionId,
        });
      }
    }, 1800);
  }

  async function handleImageTap(item) {
    if (settled) return;
    setSelectedId(item.id);

    if (item.isCorrect) {
      setSettled(true);
      setCloudText('Good job!');
      await playSound(AUDIO_GOOD_JOB).catch(() => {});
      goToPhase3(true);
    } else {
      const newCount = wrongCount + 1;
      setWrongCount(newCount);
      if (newCount === 1) {
        setCloudText('Try again!');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else if (newCount === 2) {
        setCloudText('Look carefully!');
        setTimeout(() => { if (activeRef.current) setSelectedId(null); }, 1200);
      } else {
        setSettled(true);
        setCorrectRevealed(true);
        setCloudText("Let's keep going!");
        goToPhase3(false);
      }
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────

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
          <TouchableOpacity onPress={() => { setGatePurpose('back'); setShowGate(true); }} activeOpacity={0.7} style={styles.headerSide}>
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

            <Text style={[styles.title, { color: theme.headingText }]}>
              {'Which calendar shows '}
              <Text style={{ color: theme.button, fontWeight: '900' }}>
                {wordLabel}
              </Text>
              {'?'}
            </Text>

            <Text style={[styles.subtitle, { color: theme.headingText }]}>
              Look at the calendars and tap the correct one
            </Text>

            {/* 3 calendar image cards */}
            <View style={styles.cardsRow}>
              {imageItems.map(item => {
                const isSelected        = selectedId === item.id;
                const isRevealedCorrect = correctRevealed && item.isCorrect;
                const showGreenBorder   = (isSelected && item.isCorrect) || isRevealedCorrect;
                const showRedDim        = isSelected && !item.isCorrect && !settled;

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
                    <Text
                      style={[
                        styles.cardCaption,
                        { color: theme.headingText },
                        (isSelected && item.isCorrect) && { color: '#22C55E', fontWeight: '900' },
                      ]}
                      numberOfLines={2}
                    >
                      {item.caption}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flex: 1 }} />

            {/* Avatar row */}
            <View style={styles.avatarRow}>
              {cloudText ? (
                <View style={styles.bubbleWrap}>
                  <View style={styles.speechBubble}>
                    <Text style={[styles.speechText, { color: theme.button }]}>{cloudText}</Text>
                  </View>
                  <View style={styles.bubbleTail} />
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

  headerWrap: { zIndex: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm, gap: Layout.spacing.sm,
  },
  headerSide:    { width: 32, alignItems: 'center' },
  levelLabel:    { fontSize: Layout.fontSize.sm, fontWeight: '700' },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: Layout.radius.full, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: Layout.radius.full },

  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.lg,
    paddingBottom:     Layout.spacing.md,
  },

  title: { fontSize: Layout.fontSize.xl, fontWeight: '700', textAlign: 'center', marginBottom: Layout.spacing.xs },
  subtitle: { fontSize: Layout.fontSize.sm, textAlign: 'center', opacity: 0.65, marginBottom: Layout.spacing.xl },

  cardsRow: { flexDirection: 'row', justifyContent: 'center', gap: Layout.spacing.sm },
  imageCard: {
    borderRadius: Layout.radius.lg, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardCorrect: { borderColor: '#22C55E', borderWidth: 3 },
  cardWrong:   { borderColor: '#FF4D6D', borderWidth: 2, opacity: 0.65 },
  imageWrap:   { position: 'relative', overflow: 'hidden' },
  cardImage:   { width: '100%', height: '100%' },
  correctBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: '#FFF', borderRadius: 12,
  },
  cardCaption: {
    fontSize: Layout.fontSize.xs, fontWeight: '600', textAlign: 'center',
    paddingHorizontal: Layout.spacing.xs, paddingVertical: Layout.spacing.sm,
  },

  avatarRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: Layout.spacing.md },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 6, marginRight: -4 },
  speechBubble: {
    backgroundColor: '#FFFFFF', borderRadius: Layout.radius.lg,
    paddingHorizontal: Layout.spacing.md, paddingVertical: Layout.spacing.sm,
    maxWidth: 160,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 4, elevation: 2,
  },
  speechText:  { fontSize: Layout.fontSize.sm, fontWeight: '700', textAlign: 'center' },
  bubbleTail: {
    alignSelf: 'flex-end', marginRight: 24,
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
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
