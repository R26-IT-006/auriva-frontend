/**
 * DaysPhase1CalendarScreen — Familiarisation
 *
 * Shows a weekly calendar image with the target day highlighted.
 * Pre-generated audio plays the day name on each exposure.
 * Records phase1-exposure after each display.
 * Advances to DaysDragToLine once required exposures are complete.
 *
 * ASSETS REQUIRED:
 *   assets/dialogue-images/days_of_week/calendar_monday.png
 *   assets/dialogue-images/days_of_week/calendar_tuesday.png
 *   assets/dialogue-images/days_of_week/calendar_wednesday.png
 *   assets/dialogue-images/days_of_week/calendar_thursday.png
 *   assets/dialogue-images/days_of_week/calendar_friday.png
 *   assets/dialogue-images/days_of_week/calendar_saturday.png
 *   assets/dialogue-images/days_of_week/calendar_sunday.png
 *   assets/dialogue-audios/days/monday.mp3   (and for each day)
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

// ─ Phrase keys still need dedicated calendar images ──────────────────────────
const PLACEHOLDER_IMG = require('../../../../../assets/dialogue-images/words/magic_words/thank_you/correct_context1.png');
const CALENDAR_IMAGES = {
  monday:    require('../../../../../assets/dialogue-videos/words/days_of_week/monday/scene.png'),
  tuesday:   require('../../../../../assets/dialogue-videos/words/days_of_week/tuesday/scene.png'),
  wednesday: require('../../../../../assets/dialogue-videos/words/days_of_week/wednesday/scene.png'),
  thursday:  require('../../../../../assets/dialogue-videos/words/days_of_week/thursday/scene.png'),
  friday:    require('../../../../../assets/dialogue-videos/words/days_of_week/friday/scene.png'),
  saturday:  require('../../../../../assets/dialogue-videos/words/days_of_week/saturday/scene.png'),
  sunday:    require('../../../../../assets/dialogue-videos/words/days_of_week/sunday/scene.png'),
};
const PLACEHOLDER_AUDIO = require('../../../../../assets/dialogue-audios/magic_words/Thankyou.mp3');
const DAY_AUDIO = {
  monday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Monday.mp3'),
  tuesday:   require('../../../../../assets/dialogue-audios/days_of_the_week/Tuesday.mp3'),
  wednesday: require('../../../../../assets/dialogue-audios/days_of_the_week/Wednesday.mp3'),
  thursday:  require('../../../../../assets/dialogue-audios/days_of_the_week/Thursday.mp3'),
  friday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Friday.mp3'),
  saturday:  require('../../../../../assets/dialogue-audios/days_of_the_week/Saturday.mp3'),
  sunday:    require('../../../../../assets/dialogue-audios/days_of_the_week/Sunday.mp3'),
  whats_the_day_today: PLACEHOLDER_AUDIO,
  today_is:            PLACEHOLDER_AUDIO,
};

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  whats_the_day_today: "What's the day today?", today_is: 'Today is...',
};

const DAY_POSITIONS = {
  monday: '1st', tuesday: '2nd', wednesday: '3rd',
  thursday: '4th', friday: '5th', saturday: '6th', sunday: '7th',
};

export default function DaysPhase1CalendarScreen({ route, navigation }) {
  const {
    student,
    wordKey = 'monday',
    wordId,
    phase1RequiredExposures = 3,
    startIndex = 0,
  } = route.params ?? {};

  const theme     = getAvatarTheme(student?.avatar_key);
  const wordLabel = DAY_LABELS[wordKey] ?? wordKey;
  const position  = DAY_POSITIONS[wordKey] ?? '';
  const calImg    = CALENDAR_IMAGES[wordKey] ?? PLACEHOLDER_IMG;
  const dayAudio  = DAY_AUDIO[wordKey] ?? PLACEHOLDER_AUDIO;

  const [exposureIdx,  setExposureIdx]  = useState(startIndex);
  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');

  const soundRef     = useRef(null);
  const activeRef    = useRef(true);
  const settingsFade = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;

  // Progress: Phase 1 spans 10–70%
  const progressFraction = 0.10 + (exposureIdx / phase1RequiredExposures) * 0.60;

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

  // Play audio and record exposure on each display
  useEffect(() => {
    let cancelled = false;

    async function present() {
      // Fade in calendar image
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();

      // Play the day name audio
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        if (cancelled) return;
        const { sound } = await Audio.Sound.createAsync(dayAudio);
        if (cancelled) { sound.unloadAsync(); return; }
        soundRef.current = sound;
        await sound.playAsync();
        await new Promise(resolve => {
          sound.setOnPlaybackStatusUpdate(s => {
            if (s.didJustFinish) { sound.setOnPlaybackStatusUpdate(null); resolve(); }
          });
        });
      } catch { /* ignore */ }

      // Record exposure in the background
      if (!cancelled && student?.sid && wordId) {
        dialogueApi.recordPhase1Exposure(student.sid, wordId).catch(() => {});
      }
    }

    present();
    return () => { cancelled = true; };
  }, [exposureIdx]);

  function handleNext() {
    const nextIdx = exposureIdx + 1;
    if (nextIdx < phase1RequiredExposures) {
      setExposureIdx(nextIdx);
    } else {
      navigation.navigate('DaysDragToLine', { student, wordKey, wordId, phase1RequiredExposures });
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

            {/* Exposure counter */}
            <Text style={[styles.exposureCounter, { color: theme.headingText }]}>
              {exposureIdx + 1} of {phase1RequiredExposures}
            </Text>

            {/* Weekly calendar image */}
            <Animated.View style={[styles.calendarCard, { backgroundColor: theme.cardSurface, opacity: fadeAnim }]}>
              <Image source={calImg} style={styles.calendarImage} resizeMode="contain" />
            </Animated.View>

            {/* Day position label */}
            {position ? (
              <Text style={[styles.positionText, { color: theme.headingText }]}>
                {wordLabel} is the <Text style={{ fontWeight: '900', color: theme.button }}>{position}</Text> day of the week
              </Text>
            ) : null}

            {/* Word tile with speaker icon */}
            <TouchableOpacity
              style={[styles.wordTile, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}
              onPress={async () => {
                try {
                  const { sound } = await Audio.Sound.createAsync(dayAudio);
                  await sound.playAsync();
                  sound.setOnPlaybackStatusUpdate(s => {
                    if (s.didJustFinish) sound.unloadAsync();
                  });
                } catch { /* ignore */ }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="volume-high" size={20} color={theme.button} />
              <Text style={[styles.wordTileText, { color: theme.button }]}>{wordLabel}</Text>
            </TouchableOpacity>

            <Text style={[styles.tapHint, { color: theme.headingText }]}>
              Tap the card to hear the day name
            </Text>

            <View style={{ flex: 1 }} />

            {/* Next / Continue button */}
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.button }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>
                {exposureIdx + 1 < phase1RequiredExposures ? 'Next' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

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
  root:  { flex: 1 },
  body:  { flex: 1 },
  safe:  { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  levelLabel:    { fontSize: Layout.fontSize.sm, fontWeight: '700', opacity: 0.7 },
  progressTrack: {
    flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  content: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.md,
    paddingBottom:     Layout.spacing.lg,
  },

  exposureCounter: {
    fontSize:     Layout.fontSize.xs,
    fontWeight:   '700',
    opacity:      0.5,
    marginBottom: Layout.spacing.sm,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  calendarCard: {
    width:         '100%',
    maxWidth:      460,
    borderRadius:  Layout.radius.xl,
    overflow:      'hidden',
    ...Layout.shadow.md,
    marginBottom:  Layout.spacing.lg,
  },
  calendarImage: {
    width:  '100%',
    height: 200,
  },

  positionText: {
    fontSize:     Layout.fontSize.md,
    fontWeight:   '600',
    textAlign:    'center',
    marginBottom: Layout.spacing.md,
    opacity:      0.85,
  },

  wordTile: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.xl,
    borderWidth:       2,
    ...Layout.shadow.sm,
    marginBottom:      Layout.spacing.xs,
  },
  wordTileText: { fontSize: Layout.fontSize.xxl, fontWeight: '900' },

  tapHint: { fontSize: Layout.fontSize.xs, opacity: 0.45, fontWeight: '500' },

  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.xxl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },

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
