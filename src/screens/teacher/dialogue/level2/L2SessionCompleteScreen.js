import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { level2Api } from '../../../../api/level2';

const AVATAR_MAP = {
  boba:     require('../../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../../assets/avatar-images/Megatron.png'),
};

export default function L2SessionCompleteScreen({ route, navigation }) {
  const { student, sessionData } = route.params ?? {};
  const theme     = getAvatarTheme(student?.avatar_key);
  const avatarImg = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;
  const sentences = sessionData?.sentences ?? [];

  const scale   = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Call completeSession silently
    if (sessionData?.session_id && student?.sid) {
      level2Api.completeSession(student.sid, sessionData.session_id).catch(() => {});
    }
    // Entrance animation
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, bounciness: 14 }),
      Animated.timing(opacity, { toValue: 1,   duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  function handleDone() {
    navigation.navigate('L2TopicSelection', { student });
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Star burst */}
          <Animated.View style={[styles.starBox, { transform: [{ scale }], opacity }]}>
            <Text style={styles.star}>🌟</Text>
          </Animated.View>

          {/* Avatar */}
          <Image source={avatarImg} style={styles.avatar} resizeMode="contain" />

          {/* Heading */}
          <Text style={[styles.heading, { color: theme.headingText }]}>Amazing Work! 🎉</Text>
          <Text style={[styles.sub, { color: theme.headingText }]}>
            You practised all 5 sentences today!
          </Text>

          {/* Sentences recap */}
          <View style={[styles.recapCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={[styles.recapTitle, { color: theme.headingText }]}>What we learnt today</Text>
            {sentences.map((s, i) => (
              <View key={s.index} style={styles.recapRow}>
                <View style={[styles.checkCircle, { backgroundColor: theme.button }]}>
                  <Ionicons name="checkmark" size={14} color={theme.buttonText} />
                </View>
                <Text style={[styles.recapSentence, { color: theme.headingText }]}>{s.text}</Text>
              </View>
            ))}
          </View>

          {/* Stars/confetti decoration */}
          <Text style={styles.confetti}>🎊 ⭐ 🎉 ⭐ 🎊</Text>

          {/* Done button */}
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.button }]} onPress={handleDone} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={20} color={theme.buttonText} />
            <Text style={[styles.doneText, { color: theme.buttonText }]}>Back to Lessons</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.xl, gap: Layout.spacing.md },
  starBox: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  star: { fontSize: 72 },
  avatar: { width: 160, height: 180 },
  heading: { fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: Layout.fontSize.lg, fontWeight: '500', textAlign: 'center', opacity: 0.65 },
  subSinhala: { fontSize: Layout.fontSize.md, fontWeight: '500', textAlign: 'center', opacity: 0.6, marginTop: -Layout.spacing.sm },
  recapCard: { width: '100%', borderRadius: Layout.radius.xl, borderWidth: 2, padding: Layout.spacing.lg, gap: Layout.spacing.sm, ...Layout.shadow.sm },
  recapTitle: { fontSize: Layout.fontSize.md, fontWeight: '800', marginBottom: 4 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recapSentence: { flex: 1, fontSize: Layout.fontSize.md, fontWeight: '500' },
  confetti: { fontSize: 28, letterSpacing: 8 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md, borderRadius: Layout.radius.full, ...Layout.shadow.md },
  doneText: { fontSize: Layout.fontSize.lg, fontWeight: '700' },
});
