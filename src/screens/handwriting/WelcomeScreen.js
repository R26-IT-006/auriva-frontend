import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const BRAND_IMAGE = require('../../../assets/brand.png');

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function WelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { height } = useWindowDimensions();
  const mascot = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <View style={styles.left}>

          {/* Logo + title block */}
          <View style={styles.brandBlock}>
            <Image source={BRAND_IMAGE} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>Auriva</Text>
            <Text style={styles.moduleName}>LETTER WRITING</Text>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Learn to write letters at your own{'\n'}pace with friendly guide!
          </Text>

          {/* Start button */}
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.navigate('Instructions', { student, theme })}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>Start Learning</Text>
          </TouchableOpacity>

        </View>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <View style={styles.right}>

          {/* Mascot */}
          <Image source={mascot} style={[styles.mascot, { height: height * 0.72 }]} resizeMode="contain" />

          {/* Speech bubble */}
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Hi there!</Text>
            <Text style={styles.bubbleText}>Let's write together!</Text>
          </View>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#E8EEF8',
  },
  root: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Left panel ────────────────────────────────────────────────────────────
  left: {
    flex: 1.1,
    backgroundColor: '#E8EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 28,
  },

  brandBlock: {
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1B1B4B',
    letterSpacing: 0.3,
  },
  moduleName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  tagline: {
    fontSize: 18,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 27,
    fontWeight: '400',
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312E81',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 50,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Right panel ───────────────────────────────────────────────────────────
  right: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderBottomLeftRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },

  mascot: {
    width: '90%',
  },

  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginLeft: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  bubbleText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
    lineHeight: 22,
  },
});
