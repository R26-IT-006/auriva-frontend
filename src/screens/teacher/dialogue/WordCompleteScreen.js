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
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { dialogueApi } from '../../../api/dialogue';

function getCategoryStartScreen(category) {
  switch (category) {
    case 'days_of_week': return 'DaysPhase1Calendar';
    case 'greetings':    return 'GreetingPhase1Video';
    case 'magic_words':
    default:             return 'Phase1Video';
  }
}

export default function WordCompleteScreen({ route, navigation }) {
  const {
    student,
    wordKey,
    wordId,
    wordLabel     = wordKey?.replace(/_/g, ' ') ?? '',
    category      = 'magic_words',
    mastered      = false,
    sessionPassed = false,
    status        = 'in_progress',
  } = route.params ?? {};

  const theme = getAvatarTheme(student?.avatar_key);

  const starScale   = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const [loadingNext, setLoadingNext] = useState(false);
  const [showGate,    setShowGate]    = useState(false);

  const isCongrats = mastered;
  const heading    = isCongrats ? 'Congratulations!' : 'Good Job!';
  const subtext    = isCongrats
    ? "You've mastered"
    : "You're doing great with";

  useEffect(() => {
    Animated.sequence([
      Animated.spring(starScale, { toValue: 1, useNativeDriver: true, bounciness: 18, speed: 8 }),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardSlide,   { toValue: 0, useNativeDriver: true, bounciness: 10 }),
      ]),
    ]).start();
  }, []);

  function tryAgain() {
    navigation.navigate(getCategoryStartScreen(category), { student, wordKey, wordId });
  }

  async function goNextWord() {
    setLoadingNext(true);
    try {
      const nextWord = await dialogueApi.getNextWord(student?.sid, {
        category,
        excludeWordId: wordId,
        sessionPassed,
        status,
      });
      if (!nextWord || nextWord.done) {
        navigation.navigate('DialogueCategory', { student });
        return;
      }
      navigation.navigate(getCategoryStartScreen(category), {
        student,
        wordKey: nextWord.asset_key,
        wordId:  nextWord.id,
      });
    } catch {
      navigation.navigate('DialogueCategory', { student });
    } finally {
      setLoadingNext(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Exit icon — opens parent gate */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setShowGate(true)} activeOpacity={0.7} style={styles.exitBtn}>
            <Ionicons name="exit-outline" size={26} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

          {/* Stars burst */}
          <Animated.Text style={[styles.stars, { transform: [{ scale: starScale }] }]}>
            ⭐⭐⭐
          </Animated.Text>

          {/* Result card */}
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.cardSurface },
              { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: isCongrats ? '#22C55E' : theme.button }]}>
              <Ionicons name={isCongrats ? 'trophy' : 'star'} size={32} color="#FFF" />
            </View>

            <Text style={[styles.heading, { color: theme.headingText }]}>
              {heading} {isCongrats ? '🎉' : '🌟'}
            </Text>

            <Text style={[styles.subtext, { color: theme.headingText }]}>
              {subtext}{'\n'}
              <Text style={[styles.wordAccent, { color: theme.button }]}>"{wordLabel}"</Text>
            </Text>

            {isCongrats && (
              <Text style={[styles.masteredNote, { color: theme.headingText }]}>
                This word is now mastered!
              </Text>
            )}
          </Animated.View>

          {/* Action buttons */}
          <Animated.View style={[styles.buttonsWrap, { opacity: cardOpacity }]}>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.button }]}
              onPress={tryAgain}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.button} />
              <Text style={[styles.secondaryBtnText, { color: theme.button }]}>
                Try the word again
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
                  <Text style={[styles.primaryBtnText, { color: theme.buttonText }]}>
                    Next word
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.buttonText} />
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Parent gate — exit to category menu */}
      <ParentGateModal
        visible={showGate}
        onSuccess={() => {
          setShowGate(false);
          navigation.navigate('DialogueCategory', { student });
        }}
        onDismiss={() => setShowGate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:        Layout.spacing.sm,
  },
  exitBtn: {
    padding: Layout.spacing.xs,
  },

  body: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: Layout.spacing.xl,
    gap:               Layout.spacing.lg,
  },

  stars: {
    fontSize:      48,
    letterSpacing: 4,
  },

  card: {
    width:         '100%',
    borderRadius:  Layout.radius.xl,
    padding:       Layout.spacing.xl,
    alignItems:    'center',
    gap:           Layout.spacing.md,
    ...Layout.shadow.lg,
  },
  iconCircle: {
    width:           68,
    height:          68,
    borderRadius:    34,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  heading: {
    fontSize:   Layout.fontSize.xxl,
    fontWeight: '900',
    textAlign:  'center',
  },
  subtext: {
    fontSize:   Layout.fontSize.md,
    fontWeight: '600',
    textAlign:  'center',
    opacity:    0.75,
    lineHeight: 26,
  },
  wordAccent: {
    fontWeight: '900',
    opacity:    1,
  },
  masteredNote: {
    fontSize:   Layout.fontSize.sm,
    fontWeight: '700',
    opacity:    0.55,
    marginTop:  4,
  },

  buttonsWrap: {
    width: '100%',
    gap:   Layout.spacing.md,
  },
  primaryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Layout.spacing.sm,
    paddingVertical: Layout.spacing.md,
    borderRadius:   Layout.radius.full,
    ...Layout.shadow.md,
  },
  primaryBtnText: {
    fontSize:   Layout.fontSize.lg,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Layout.spacing.sm,
    paddingVertical: Layout.spacing.md,
    borderRadius:   Layout.radius.full,
    borderWidth:    2,
  },
  secondaryBtnText: {
    fontSize:   Layout.fontSize.md,
    fontWeight: '600',
  },
});
