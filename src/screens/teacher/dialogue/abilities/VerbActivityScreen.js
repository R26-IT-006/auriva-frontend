import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { LinearGradient } from 'expo-linear-gradient';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

const ANJALI_VIDEO = require('../../../../../assets/dialogue-videos/words/abilities/jump/Phase1And3.mp4');

export default function VerbActivityScreen({ route, navigation }) {
  const { student, verb = 'jump' } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const videoRef  = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function handleAvatarPress() {
    if (!videoRef.current || isPlaying) return;
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
    setIsPlaying(true);
  }

  function onPlaybackStatusUpdate(status) {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  }

  function goNext() {
    navigation.navigate('ClapActivity', { student });
  }

  const prompt = `Can you ${verb}? Tap on Anjali to see her ${verb}!`;

  return (
    <View style={styles.root}>

      {/* ── Header ────────────────────────────── */}
      <SafeAreaView
        style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={[styles.headerBtn, BACK_BUTTON]}
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      {/* ── Body ──────────────────────────────── */}
      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {/* Instruction text */}
            <Text style={[styles.prompt, { color: theme.headingText }]}>
              {prompt}
            </Text>

            {/* Avatar video — tap to play, no visible controls */}
            <View style={styles.avatarArea}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={1}
                style={styles.avatarTouchable}
              >
                <Video
                  ref={videoRef}
                  source={ANJALI_VIDEO}
                  style={[styles.avatar, { backgroundColor: theme.background }]}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls={false}
                  shouldPlay={false}
                  isLooping={false}
                  onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                />
              </TouchableOpacity>
            </View>

            {/* Next button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: theme.button }]}
                activeOpacity={0.85}
                onPress={goNext}
              >
                <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </LinearGradient>

    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: rs(12),
    paddingVertical:   rs(12),
  },
  headerSide: {
    width: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  headerTitle: {
    flex:       1,
    fontSize:   rf(17),
    fontFamily: 'DMSans_800ExtraBold',
    textAlign:  'center',
  },

  body: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.xl,
    paddingTop:        Layout.spacing.xl,
    paddingBottom:     Layout.spacing.lg,
  },

  prompt: {
    fontSize:       rf(22),
    fontFamily: 'DMSans_700Bold',
    textAlign:      'center',
    lineHeight:     rf(32),
    textDecorationLine: 'underline',
  },

  avatarArea: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarTouchable: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatar: {
    width:  rs(220),
    height: rs(320),
  },

  footer: {
    width:          '100%',
    alignItems:     'flex-end',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8),
    paddingHorizontal: rs(32),
    paddingVertical: rs(14),
    borderRadius: rs(16),
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
});
