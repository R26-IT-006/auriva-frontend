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

const ANJALIE_VIDEO = require('../../../../../assets/dialogue-videos/words/abilities/run/Phase1And3.mp4');

export default function RunActivityScreen({ route, navigation }) {
  const { student } = route.params ?? {};
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
            style={styles.headerSide}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      {/* ── Body ──────────────────────────────── */}
      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {/* Instruction text */}
            <Text style={[styles.prompt, { color: theme.headingText }]}>
              Can you run? Tap on Anjalie to see her run!
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
                  source={ANJALIE_VIDEO}
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
                onPress={() => navigation.navigate('DialogueCategory', { student })}
              >
                <Text style={[styles.nextBtnText, { color: theme.buttonText }]}>Next</Text>
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   12,
  },
  headerSide: {
    width:          40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex:       1,
    fontSize:   17,
    fontWeight: '800',
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
    fontSize:           22,
    fontWeight:         '700',
    textAlign:          'center',
    lineHeight:         32,
    textDecorationLine: 'underline',
  },

  avatarArea: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
    width:          '100%',
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
    width:      '100%',
    alignItems: 'flex-end',
  },
  nextBtn: {
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical:   Layout.spacing.md,
    borderRadius:      Layout.radius.full,
    ...Layout.shadow.md,
  },
  nextBtnText: {
    fontSize:   Layout.fontSize.lg,
    fontWeight: '700',
  },
});
