import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

const ANJALI = require('../../../../../assets/avatar_actions-images/Anjalie_Jumping.png');

export default function VerbActivityScreen({ route, navigation }) {
  const { student, verb = 'jump' } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const jumpY     = useRef(new Animated.Value(0)).current;
  const scaleY    = useRef(new Animated.Value(1)).current;
  const [hasJumped, setHasJumped] = useState(false);

  function handleAvatarPress() {
    setHasJumped(true);

    Animated.sequence([
      // Rise
      Animated.parallel([
        Animated.timing(jumpY,  { toValue: -110, duration: 220, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1.08, duration: 220, useNativeDriver: true }),
      ]),
      // Fall + squash on land
      Animated.parallel([
        Animated.spring(jumpY,  { toValue: 0, bounciness: 10, speed: 14, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleY, { toValue: 0.82, duration: 80, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1, bounciness: 14, speed: 18, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
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
              {prompt}
            </Text>

            {/* Avatar — tappable jump trigger */}
            <View style={styles.avatarArea}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.9}
                style={styles.avatarTouchable}
              >
                <Animated.Image
                  source={ANJALI}
                  style={[
                    styles.avatar,
                    { transform: [{ translateY: jumpY }, { scaleY }] },
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
                onPress={goNext}
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
    fontSize:       22,
    fontWeight:     '700',
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
