import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image, TouchableOpacity } from 'react-native';
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

/** Build minimal session data from questionnaire when TTS fails */
function buildFallbackSession(q) {
  const name = q.child_first_name;
  const age  = q.child_age;
  const town = q.child_hometown;
  const gen  = q.child_gender;
  const act  = q.favourite_activities[0];

  const sentences = [
    { index: 1, prompt: "What's your name?",           text: `My name is ${name}.`,  dynamic_value: name, distractor: 'Anika', audio_base64: null },
    { index: 2, prompt: 'How old are you?',             text: `I am ${age} years old.`, dynamic_value: String(age), distractor: String(age + 1), audio_base64: null },
    { index: 3, prompt: 'Where do you live?',           text: `I live in ${town}.`,   dynamic_value: town, distractor: 'Kandy', audio_base64: null },
    { index: 4, prompt: 'Are you a girl or a boy?',     text: `I am a ${gen}.`,       dynamic_value: gen,  distractor: gen === 'boy' ? 'girl' : 'boy', audio_base64: null },
    { index: 5, prompt: "What's your favourite activity?", text: `I like ${act}.`,   dynamic_value: act,  distractor: 'Dancing', audio_base64: null },
  ];
  return {
    session_id:     null,
    topic:          'self_introduction',
    sentences,
    full_paragraph: { text: `Hello! My name is ${name}. I am ${age} years old. I live in ${town}. I am a ${gen}. I like ${act}.`, audio_base64: null },
    gender:         gen,
    activities:     q.favourite_activities,
  };
}

export default function L2LoadingScreen({ route, navigation }) {
  const { student, questionnaire, topic = 'self_introduction' } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);
  const avatarImg = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;

  const [status, setStatus]   = useState('loading'); // 'loading' | 'error'
  const [errMsg, setErrMsg]   = useState('');
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    ).start();
    attemptStart();
  }, []);

  async function attemptStart() {
    setStatus('loading');
    try {
      const resp = await level2Api.startSession(student.sid, null, topic);
      proceed(resp.data);
    } catch (err) {
      // TTS not available – use fallback session data from questionnaire.
      // Fallback is only supported for self_introduction (other topics have
      // variable sentence structures that can't be safely reconstructed here).
      if (questionnaire && topic === 'self_introduction') {
        proceed(buildFallbackSession(questionnaire));
      } else {
        setStatus('error');
        setErrMsg('Could not start session. Please check your connection and try again.');
      }
    }
  }

  function proceed(sessionData) {
    navigation.replace('L2Contrastive', { student, sessionData });
  }

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Animated.Image source={avatarImg} style={[styles.avatar, { transform: [{ scale: pulse }] }]} resizeMode="contain" />

          {status === 'loading' && (
            <>
              <Text style={[styles.heading, { color: theme.headingText }]}>Getting your lesson ready...</Text>
              <Text style={[styles.sub, { color: theme.headingText }]}>Just a moment! 🌟</Text>
              <Text style={[styles.subSinhala, { color: theme.headingText }]}>ටිකකින් සූදානම් වෙයි!</Text>
              <View style={styles.dotsRow}>
                {[0, 1, 2].map(i => <LoadingDot key={i} delay={i * 250} color={theme.button} />)}
              </View>
            </>
          )}

          {status === 'error' && (
            <>
              <Text style={[styles.heading, { color: theme.headingText }]}>{errMsg}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.button }]} onPress={attemptStart} activeOpacity={0.85}>
                <Ionicons name="refresh" size={18} color={theme.buttonText} />
                <Text style={[styles.retryText, { color: theme.buttonText }]}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function LoadingDot({ delay, color }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(y, { toValue: -10, duration: 400, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0,   duration: 400, useNativeDriver: true }),
      ])).start();
    }, delay);
  }, []);
  return <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ translateY: y }] }]} />;
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.md, paddingHorizontal: Layout.spacing.xl },
  avatar: { width: 180, height: 200 },
  heading: { fontSize: Layout.fontSize.xxl, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  sub: { fontSize: Layout.fontSize.md, fontWeight: '500', opacity: 0.6 },
  subSinhala: { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.55, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 10, marginTop: Layout.spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Layout.spacing.xl, paddingVertical: Layout.spacing.md, borderRadius: Layout.radius.full, marginTop: Layout.spacing.md },
  retryText: { fontSize: Layout.fontSize.md, fontWeight: '700' },
});
