import { useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { getAvatarImage, ANJALIE_IMAGE } from './_components';

export default function L3LandingScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme       = getAvatarTheme(student?.avatar_key);
  const avatarKey   = student?.avatar_key ?? 'lily';
  const firstName   = student?.full_name?.split(' ')[0] ?? 'Student';
  const avatarName  = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('DialogueLanding', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  // Wave animation for both avatars
  const waveL = useRef(new Animated.Value(0)).current;
  const waveR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (val) => Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1,  duration: 400, useNativeDriver: true }),
        Animated.timing(val, { toValue: -1, duration: 400, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    );
    const al = anim(waveL);
    const ar = anim(waveR);
    al.start();
    setTimeout(() => ar.start(), 300);
    return () => { al.stop(); ar.stop(); };
  }, []);

  const waveStyle = (val) => ({
    transform: [{ rotate: val.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }],
  });

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => navigation.navigate('DialogueLanding', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.headingText }]}>Introduction to Conversations</Text>
          <Text style={[styles.body_text, { color: theme.headingText }]}>
            {avatarName} and Anjalie are friends.{'\n'}They are having a simple conversation.
          </Text>
          <Text style={[styles.sinhalaText, { color: theme.headingText }]}>
            {avatarName} සහ Anjalie හොඳ මිත්‍රයන් වෙති.{'\n'}ඔවුන් සරල සංවාදයක් කරයි.
          </Text>

          {/* Avatars with speech bubbles */}
          <View style={styles.avatarRow}>
            {/* Left — child's avatar */}
            <View style={styles.avatarSlot}>
              <View style={[styles.speechBubble, styles.speechBubbleLeft, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
                <Text style={styles.speechText}>Hello! I'm {avatarName}!</Text>
              </View>
              <Animated.Image
                source={getAvatarImage(avatarKey)}
                style={[styles.avatarImg, waveStyle(waveL)]}
                resizeMode="contain"
              />
            </View>

            {/* Right — Anjalie */}
            <View style={styles.avatarSlot}>
              <View style={[styles.speechBubble, styles.speechBubbleRight, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
                <Text style={styles.speechText}>Hello! I'm Anjalie!</Text>
              </View>
              <Animated.Image
                source={ANJALIE_IMAGE}
                style={[styles.avatarImg, styles.avatarImgRight, waveStyle(waveR)]}
                resizeMode="contain"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('L3Demo', { student })}
            activeOpacity={0.85}
          >
            <Text style={[styles.startBtnText, { color: theme.buttonText }]}>Let's Begin!</Text>
            <Ionicons name="arrow-forward" size={24} color={theme.buttonText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },
  topBar: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical:   Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body_text: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.65,
    lineHeight: 28,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: Layout.spacing.lg,
  },
  avatarSlot: {
    alignItems: 'center',
    width: '44%',
  },
  avatarImg: {
    width: 210,
    height: 210,
  },
  avatarImgRight: {
    transform: [{ scaleX: -1 }],
  },
  speechBubble: {
    borderRadius: Layout.radius.xl,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 3,
  },
  speechBubbleLeft:  { borderBottomLeftRadius:  4 },
  speechBubbleRight: { borderBottomRightRadius: 4 },
  speechText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.xl,
    paddingVertical: 20,
    paddingHorizontal: 52,
    marginTop: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  startBtnText: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '800',
  },
  sinhalaText: {
    fontSize: Layout.fontSize.md,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.72,
    lineHeight: 24,
    marginTop: -6,
  },
});
