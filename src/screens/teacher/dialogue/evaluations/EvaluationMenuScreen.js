import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { evaluationApi } from '../../../../api/evaluation';

// Mirrors the backend's live EVAL_UNLOCK_THRESHOLD (evaluationService.js, DEC-04) —
// the task file text says "master 4 words to unlock", but the already-approved
// TASK-14 backend constant is 3 (see STATE.md DEC-04, resolved 2026-07-18).
// Using 4 here would show a locked card ("3/4") for a category the status API
// already reports as unlocked. Flagged in STATE.md for planner awareness.
const EVAL_UNLOCK_THRESHOLD = 3;

const CATEGORY_META = {
  greetings: {
    label: 'Greetings',
    icon: require('../../../../../assets/dialogue-icons/greetings.png'),
    gradient: ['#FDA4AF', '#FB7185'],
  },
  magic_words: {
    label: 'Magic Words',
    icon: require('../../../../../assets/dialogue-icons/magic words.png'),
    gradient: ['#C4B5FD', '#8B5CF6'],
  },
  abilities: {
    label: 'Can You?',
    icon: require('../../../../../assets/dialogue-icons/activities.png'),
    gradient: ['#7DD3FC', '#38BDF8'],
  },
};

export default function EvaluationMenuScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);

  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await evaluationApi.getStatus(student.sid);
        if (active) setStatus(data);
      } catch {
        if (active) setError('Could not load evaluations. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [student?.sid]);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('DialogueCategory', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ backgroundColor: theme.headerBackground }} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('DialogueCategory', { student })}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Evaluations</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>
            <Text style={[styles.subheading, { color: theme.headingText }]}>
              Pick a category to show what you've learned!
            </Text>

            {loading && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.button} />
              </View>
            )}

            {!loading && error && (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && status && status.map((entry) => {
              const meta = CATEGORY_META[entry.category];
              if (!meta) return null;
              const locked = !entry.unlocked;

              return (
                <TouchableOpacity
                  key={entry.category}
                  activeOpacity={locked ? 1 : 0.85}
                  disabled={locked}
                  style={styles.cardWrap}
                  onPress={() =>
                    navigation.navigate('EvaluationMatch', { student, category: entry.category })
                  }
                >
                  <LinearGradient
                    colors={locked ? ['#CBD5E1', '#94A3B8'] : meta.gradient}
                    style={styles.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0.4 }}
                  >
                    <Image source={meta.icon} style={styles.cardIcon} resizeMode="contain" />
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>{meta.label}</Text>
                      {locked ? (
                        <Text style={styles.cardSub}>
                          {`Master ${EVAL_UNLOCK_THRESHOLD} words to unlock • ${entry.mastered_count}/${EVAL_UNLOCK_THRESHOLD}`}
                        </Text>
                      ) : (
                        <Text style={styles.cardSub}>Ready to try!</Text>
                      )}
                    </View>
                    {locked ? (
                      <Ionicons name="lock-closed" size={22} color="rgba(255,255,255,0.9)" />
                    ) : (
                      <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  gradient: { flex: 1 },
  safe:     { flex: 1 },

  body: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.lg,
    gap: Layout.spacing.md,
  },

  subheading: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Layout.spacing.sm,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF4D6D',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  cardWrap: {
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    ...Layout.shadow.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
});
