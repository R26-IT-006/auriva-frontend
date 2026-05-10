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

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function WelcomeScreen({ route, navigation }) {
  const { student, theme } = route.params;
  const { width, height } = useWindowDimensions();
  const mascot = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron;

  const themeColor  = theme?.button     ?? '#312E81';
  const textOnBtn   = theme?.buttonText ?? '#FFFFFF';

  // Bubble sizes relative to the left panel width (~55% of screen)
  const panelW = width * 0.55;
  const bL = panelW * 0.62;   // large bubble diameter
  const bM = panelW * 0.38;   // medium bubble diameter
  const bS = panelW * 0.22;   // small bubble diameter

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <View style={styles.left}>

          {/* ── Decorative bubbles (theme-tinted, matching StudentWelcomeScreen) */}
          <View style={[styles.bubbleLarge, {
            backgroundColor: themeColor + '14',
            width: bL, height: bL, borderRadius: bL / 2,
          }]} />
          <View style={[styles.bubbleMedium, {
            backgroundColor: themeColor + '0E',
            width: bM, height: bM, borderRadius: bM / 2,
          }]} />
          <View style={[styles.bubbleSmall, {
            backgroundColor: themeColor + '09',
            width: bS, height: bS, borderRadius: bS / 2,
          }]} />

          {/* Brand block — no logo, large name fills the space */}
          <View style={styles.brandBlock}>
            <Text style={[styles.appName, { color: themeColor }]}>Auriva</Text>
            <View style={[styles.moduleTag, { backgroundColor: themeColor + '18', borderColor: themeColor + '30' }]}>
              <Text style={[styles.moduleName, { color: themeColor }]}>LETTER WRITING</Text>
            </View>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Learn to write letters at your own{'\n'}pace with friendly guide!
          </Text>

          {/* Start button */}
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: themeColor, shadowColor: themeColor }]}
            onPress={() => navigation.navigate('Instructions', { student, theme })}
            activeOpacity={0.85}
          >
            <Text style={[styles.startBtnText, { color: textOnBtn }]}>Start Learning</Text>
          </TouchableOpacity>

        </View>

        {/* ── Right panel — unchanged ─────────────────────────────────────── */}
        <View style={styles.right}>

          <Image
            source={mascot}
            style={[styles.mascot, { height: height * 0.72 }]}
            resizeMode="contain"
          />

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
  safe: { flex: 1, backgroundColor: '#E8EEF8' },
  root: { flex: 1, flexDirection: 'row' },

  // ── Left panel ──────────────────────────────────────────────────────────────
  left: {
    flex: 1.1,
    backgroundColor: '#E8EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 28,
    overflow: 'hidden',   // clips decorative bubbles at the panel edge
  },

  // Decorative bubbles — same pattern as StudentWelcomeScreen
  bubbleLarge: {
    position: 'absolute',
    top: '-8%',
    right: '-18%',
  },
  bubbleMedium: {
    position: 'absolute',
    bottom: '4%',
    left: '-12%',
  },
  bubbleSmall: {
    position: 'absolute',
    top: '44%',
    left: '-6%',
  },

  brandBlock: {
    alignItems: 'center',
    gap: 10,
  },
  appName: {
    fontSize: 62,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  moduleTag: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  moduleName: {
    fontSize: 11,
    fontWeight: '800',
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
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Right panel — pixel-identical to original ────────────────────────────────
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
  mascot: { width: '90%' },
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