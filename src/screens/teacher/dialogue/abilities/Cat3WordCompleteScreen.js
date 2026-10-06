import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { ParentGateModal } from '../../../../components/common/ParentGateModal';
import { cat3Api } from '../../../../api/cat3';
import { LinearGradient } from 'expo-linear-gradient';
import { rs, rf } from '../../../../utils/responsive';

export default function Cat3WordCompleteScreen({ route, navigation }) {
  const {
    student,
    wordId,
    wordKey,
    wordLabel = wordKey ?? '',
    sessionId,
    phase3Passed = false,
  } = route.params ?? {};

  const theme = getAvatarTheme(student?.avatar_key);

  const [result,       setResult]       = useState(null);   // { session_passed, mastered, status }
  const [loadingNext,  setLoadingNext]  = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [apiDone,      setApiDone]      = useState(false);

  const starScale   = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Call /complete on mount and animate in the result card
  useEffect(() => {
    cat3Api.completeWordSession(student?.sid, wordId, phase3Passed, sessionId)
      .then(res => {
        setResult(res);
        setApiDone(true);
        Animated.sequence([
          Animated.spring(starScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }),
          Animated.parallel([
            Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.spring(cardSlide,   { toValue: 0, useNativeDriver: true, bounciness: 10 }),
          ]),
        ]).start();
      })
      .catch(() => {
        // Still animate even on error
        setResult({ session_passed: phase3Passed, mastered: false, status: 'in_progress' });
        setApiDone(true);
        Animated.sequence([
          Animated.spring(starScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }),
          Animated.parallel([
            Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.spring(cardSlide,   { toValue: 0, useNativeDriver: true, bounciness: 10 }),
          ]),
        ]).start();
      });
  }, []);

  function tryAgain() {
    navigation.navigate('Cat3Landing', { student, wordId, wordKey, wordLabel });
  }

  async function goNextWord() {
    setLoadingNext(true);
    try {
      const nextWord = await cat3Api.getNextWord(student?.sid);
      if (!nextWord || !nextWord.id) {
        navigation.navigate('DialogueCategory', { student });
        return;
      }
      navigation.navigate('Cat3Landing', {
        student,
        wordId:    nextWord.id,
        wordKey:   nextWord.asset_key,
        wordLabel: nextWord.word,
      });
    } catch {
      navigation.navigate('DialogueCategory', { student });
    } finally {
      setLoadingNext(false);
    }
  }

  const mastered       = result?.mastered ?? false;
  const sessionPassed  = result?.session_passed ?? false;
  const heading        = mastered       ? 'Congratulations! 🎉' : sessionPassed ? 'Good Job! 🌟' : 'Keep Going! 💪';
  const subtext        = mastered       ? "You've mastered"     : sessionPassed ? "You're doing great with" : "You're learning";
  const iconName       = mastered       ? 'trophy'              : 'star';
  const iconColor      = mastered       ? '#22C55E'             : theme.button;

  if (!apiDone) {
    return (
      <LinearGradient
        colors={theme.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.button} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Exit → parent gate */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setShowGate(true)} activeOpacity={0.7} style={styles.exitBtn}>
            <Ionicons name="exit-outline" size={26} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          <Animated.Text style={[styles.stars, { transform: [{ scale: starScale }] }]}>
            ⭐⭐⭐
          </Animated.Text>

          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.cardSurface },
              { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
              <Ionicons name={iconName} size={32} color="#FFF" />
            </View>

            <Text style={[styles.heading, { color: theme.headingText }]}>
              {heading}
            </Text>

            <Text style={[styles.subtext, { color: theme.headingText }]}>
              {subtext}{'\n'}
              <Text style={[styles.wordAccent, { color: theme.button }]}>"{wordLabel}"</Text>
            </Text>

            {mastered && (
              <Text style={[styles.masteredNote, { color: theme.headingText }]}>
                This word is now mastered!
              </Text>
            )}
          </Animated.View>

          <Animated.View style={[styles.buttonsWrap, { opacity: cardOpacity }]}>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.button }]}
              onPress={tryAgain}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.button} />
              <Text style={[styles.secondaryBtnText, { color: theme.button }]}>
                Try this word again
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.button }]}
              onPress={goNextWord}
              activeOpacity={0.85}
              disabled={loadingNext}
            >
              {loadingNext ? (
                <ActivityIndicator color={theme.buttonText} />
              ) : (
                <>
                  <Text style={[styles.primaryBtnText, { color: theme.buttonText }]}>Next word</Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.buttonText} />
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        </View>
      </SafeAreaView>

      <ParentGateModal
        visible={showGate}
        onSuccess={() => {
          setShowGate(false);
          navigation.navigate('DialogueCategory', { student });
        }}
        onCancel={() => setShowGate(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.sm },
  exitBtn: { padding: Layout.spacing.xs },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.spacing.xl, gap: Layout.spacing.lg },

  stars: { fontSize: rf(48), letterSpacing: 4 },

  card: { width: '100%', borderRadius: Layout.radius.xl, padding: Layout.spacing.xl, alignItems: 'center', gap: Layout.spacing.md, ...Layout.shadow.lg },
  iconCircle: { width: rs(68), height: rs(68), borderRadius: rs(34), alignItems: 'center', justifyContent: 'center', marginBottom: rs(4) },
  heading:    { fontSize: Layout.fontSize.xxl, fontFamily: 'DMSans_900Black', textAlign: 'center' },
  subtext:    { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold', textAlign: 'center', opacity: 0.75, lineHeight: rf(26) },
  wordAccent: { fontFamily: 'DMSans_900Black', opacity: 1 },
  masteredNote: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', opacity: 0.55, marginTop: rs(4) },

  buttonsWrap: { width: '100%', gap: Layout.spacing.md },
  primaryBtn:  {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: rf(17),
    fontFamily: 'DMSans_800ExtraBold',
  },
  secondaryBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm, paddingVertical: Layout.spacing.md, borderRadius: Layout.radius.full, borderWidth: 2 },
  secondaryBtnText: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_600SemiBold' },
});
