import { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';

const CATEGORIES = [
  {
    key: 'magic_words',
    label: 'Magic Words',
    subtitle: 'Please, Thank You, and more!',
    icon: require('../../../../assets/dialogue-icons/magic words.png'),
    gradient: ['#C4B5FD', '#8B5CF6'],
  },
  {
    key: 'greetings',
    label: 'Greetings',
    subtitle: 'Say hello to the world!',
    icon: require('../../../../assets/dialogue-icons/greetings.png'),
    gradient: ['#FDA4AF', '#FB7185'],
  },
  {
    key: 'abilities',
    label: 'Can You?',
    subtitle: 'Run, jump, and climb in English!',
    icon: require('../../../../assets/dialogue-icons/activities.png'),
    gradient: ['#7DD3FC', '#38BDF8'],
  },
  {
    key: 'evaluations',
    label: 'Evaluations',
    subtitle: 'Show what you\'ve learned!',
    // No bespoke Evaluations icon exists yet (later asset task); reusing
    // days_of_the_week.png as the most neutral unused asset in dialogue-icons/
    // (magic words / greetings / activities are all already claimed above).
    icon: require('../../../../assets/dialogue-icons/days_of_the_week.png'),
    gradient: ['#FDE68A', '#F59E0B'],
  },
];

const H_PAD = 14;
const GAP   = 12;

const ROWS = [CATEGORIES.slice(0, 2), CATEGORIES.slice(2, 4)];

export default function DialogueCategoryScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme   = getAvatarTheme(student?.avatar_key);
  const { height } = useWindowDimensions();
  // Cap each row so tiles don't over-stretch on tall screens
  const rowH = Math.min(Math.round(height * 0.25), 175);

  // Intercept Android hardware back → same destination as the UI back arrow
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('DialogueLanding', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  return (
    <View style={styles.root}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <SafeAreaView
        style={{ backgroundColor: theme.headerBackground }}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('DialogueLanding', { student })}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Level 1</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      {/* ── Body (fills remaining space — no scroll) ───────────── */}
      <LinearGradient
        colors={theme.backgroundGradient}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.body}>

            {/* Heading */}
            <Text style={[styles.heading, { color: theme.headingText }]}>
              {'Ready to '}
              <Text style={[styles.accent, { color: theme.button }]}>grow</Text>
              {' your English?'}
            </Text>
            <Text style={[styles.subheading, { color: theme.headingText }]}>
              Pick a category and start your adventure!
            </Text>

            {/* 2 × 2 grid — flex fills the rest */}
            <View style={styles.grid}>
              {ROWS.map((row, ri) => (
                <View
                  key={ri}
                  style={[styles.row, { height: rowH }, ri < ROWS.length - 1 && { marginBottom: GAP }]}
                >
                  {row.map((cat, ci) => (
                    <TouchableOpacity
                      key={cat.key}
                      activeOpacity={0.85}
                      style={[styles.card, ci === 1 && { marginLeft: GAP }]}
                      onPress={() =>
                        cat.key === 'evaluations'
                          ? navigation.navigate('EvaluationMenu', { student })
                          : navigation.navigate('Level1Overview', { student, categoryKey: cat.key })
                      }
                    >
                      <LinearGradient
                        colors={cat.gradient}
                        style={styles.cardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.3, y: 1 }}
                      >
                        {/* Image zone — flex fills space above label */}
                        <View style={styles.imgZone}>
                          <Image
                            source={cat.icon}
                            style={styles.cardImg}
                            resizeMode="contain"
                          />
                        </View>

                        {/* Labels */}
                        <Text style={styles.cardTitle}>{cat.label}</Text>
                        <Text style={styles.cardSub}>{cat.subtitle}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

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
    paddingHorizontal: H_PAD,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    justifyContent: 'center',
  },

  heading: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  accent: { fontWeight: '900' },

  subheading: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: Layout.spacing.md,
  },

  grid: {},

  row: {
    flexDirection: 'row',
  },

  card: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  cardGradient: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 8,
  },

  imgZone: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },

  cardImg: {
    width: '70%',
    height: '90%',
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
  },

  cardSub: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 13,
  },
});
