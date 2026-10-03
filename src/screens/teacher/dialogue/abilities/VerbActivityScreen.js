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
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
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
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  headerSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Concept's round translucent header button (spacers keep headerSide).
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize:   17,
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
    fontSize:       22,
    fontFamily: 'DMSans_700Bold',
    textAlign:      'center',
    lineHeight:     32,
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
    width:  220,
    height: 320,
  },

  footer: {
    width:          '100%',
    alignItems:     'flex-end',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  nextBtnText: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
  },
});
