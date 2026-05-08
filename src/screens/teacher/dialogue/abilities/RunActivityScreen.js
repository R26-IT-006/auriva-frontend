import { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

const ANJALIE = require('../../../../../assets/avatar_actions-images/Anjalie_Running.png');

// Subtle up-down oscillation while running
function buildBounce(translateY) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(translateY, { toValue: -10, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue:   0, duration: 120, useNativeDriver: true }),
    ]),
    { iterations: 20 },
  );
}

export default function RunActivityScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const { width: screenWidth } = useWindowDimensions();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const isRunning  = useRef(false);

  const startX = -(screenWidth * 0.55);
  const endX   =  (screenWidth * 0.55);

  function handleAvatarPress() {
    if (isRunning.current) return;
    isRunning.current = true;

    // Reset to left side instantly, then run to the right
    translateX.setValue(startX);
    translateY.setValue(0);

    const bounce = buildBounce(translateY);
    bounce.start();

    Animated.timing(translateX, {
      toValue:  endX,
      duration: 1400,
      useNativeDriver: true,
    }).start(() => {
      bounce.stop();
      // Snap back to centre after a brief pause
      setTimeout(() => {
        translateX.setValue(0);
        translateY.setValue(0);
        isRunning.current = false;
      }, 300);
    });
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

            {/* Avatar — tappable run trigger */}
            <View style={styles.avatarArea}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.9}
                style={styles.avatarTouchable}
              >
                <Animated.Image
                  source={ANJALIE}
                  style={[
                    styles.avatar,
                    { transform: [{ translateX }, { translateY }] },
                  ]}
                  resizeMode="contain"
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
