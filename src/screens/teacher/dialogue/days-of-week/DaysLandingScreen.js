/**
 * DaysLandingScreen — "Let's learn the day MONDAY"
 *
 * Plays the Days of the Week song video automatically, shows the target day
 * name, then the teacher taps Next to begin Phase 1 familiarisation.
 *
 * ASSET REQUIRED:
 *   assets/dialogue-videos/days/days_of_week_song.mp4
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';

const SONG_VIDEO = require('../../../../../assets/dialogue-videos/words/days_of_week/Days_of_the_week_song.mp4');

const DAY_DISPLAY = {
  monday:              'MONDAY',
  tuesday:             'TUESDAY',
  wednesday:           'WEDNESDAY',
  thursday:            'THURSDAY',
  friday:              'FRIDAY',
  saturday:            'SATURDAY',
  sunday:              'SUNDAY',
  whats_the_day_today: "WHAT'S THE DAY TODAY?",
  today_is:            'TODAY IS...',
};

const PROGRESS_FRACTION = 0.05;

export default function DaysLandingScreen({ route, navigation }) {
  const { student, wordKey = 'monday', wordId, phase1RequiredExposures = 4 } = route.params ?? {};
  const theme      = getAvatarTheme(student?.avatar_key);
  const wordLabel  = DAY_DISPLAY[wordKey] ?? wordKey.replace(/_/g, ' ').toUpperCase();
  const videoRef   = useRef(null);

  const [showGate,     setShowGate]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatePurpose,  setGatePurpose]  = useState('settings');
  const settingsFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setGatePurpose('back');
      setShowGate(true);
      return true;
    });
    return () => {
      sub.remove();
      videoRef.current?.pauseAsync().catch(() => {});
    };
  }, []));

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

        {/* Title */}
        <Text style={[styles.title, { color: theme.headingText }]}>
          {"Let's learn the days of the week!"}
        </Text>

        {/* Song video — fills all remaining space */}
        <Video
          ref={videoRef}
          source={SONG_VIDEO}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted={false}
        />

        {/* Next button — pinned at bottom */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.button }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DaysPhase1Calendar', {
              student, wordKey, wordId, phase1RequiredExposures,
            })}
          >
            <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.buttonText} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
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

  headerWrap: {},
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   12,
    gap:               8,
  },
  headerSide:    { width: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    flex:            1,
    height:          8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius:    4,
    overflow:        'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  title: {
    fontSize:          Layout.fontSize.xl,
    fontWeight:        '700',
    textAlign:         'center',
    opacity:           0.85,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   Layout.spacing.md,
  },

  video: { flex: 1, width: '100%' },

  bottomBar: {
    alignItems:      'center',
    paddingVertical: Layout.spacing.md,
  },
  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },

  settingsOverlay: {
    flex:            1,
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
  settingsOptionText: { fontSize: Layout.fontSize.md, fontWeight: '600', color: '#333' },
  settingsDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
    marginVertical:  4,
  },
});
