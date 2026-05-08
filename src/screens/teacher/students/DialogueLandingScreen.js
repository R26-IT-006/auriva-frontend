import { useCallback } from 'react';
import {
  View,
  Text,
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

const LEVELS = [
  { key: 'level1', label: 'Level 1 - Dialogue word Learning' },
  { key: 'level2', label: 'Level 2 - Sentence Construction' },
  { key: 'level3', label: 'Level 3 - Conversation Builder' },
];

export default function DialogueLandingScreen({ route, navigation }) {
  const student   = route.params?.student;
  const theme     = getAvatarTheme(student?.avatar_key);
  const firstName = student?.full_name?.split(' ')[0] ?? student?.full_name ?? 'Student';

  // Intercept Android hardware back → same destination as the UI back arrow
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('StudentDashboard', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.78, 420);

  const cardColors = [
    { bg: '#94E0FA', text: theme.buttonText, border: '#94E0FA' },
    { bg: '#FFBEEB', text: theme.buttonText, border: '#FFBEEB' },
    { bg: '#CC8DE7', text: theme.buttonText, border: '#CC8DE7' },
  ];

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Top bar ─────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: theme.cardOutline }]}
            onPress={() => navigation.navigate('StudentDashboard', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* ── Body ────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Heading */}
          <Text style={[styles.heading, { color: theme.headingText }]}>
            Welcome back {firstName}!
          </Text>

          {/* Sub-heading */}
          <Text style={[styles.subheading, { color: theme.headingText }]}>
            What shall we learn today?
          </Text>

          {/* Level cards */}
          <View style={styles.levels}>
            {LEVELS.map((level, index) => {
              const c = cardColors[index];
              return (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.levelCard,
                    {
                      width: cardWidth,
                      backgroundColor: c.bg,
                      borderColor: c.border,
                    },
                  ]}
                  activeOpacity={0.82}
                  onPress={() => {
                    if (level.key === 'level1') {
                      navigation.navigate('DialogueCategory', { student });
                    } else if (level.key === 'level2') {
                      navigation.navigate('L2TopicSelection', { student });
                    }
                  }}
                >
                  <Text style={[styles.levelLabel, { color: c.text }]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
    width:  40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.md,
    paddingBottom: Layout.spacing.xl,
  },

  heading: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: Layout.spacing.xs,
  },

  subheading: {
    fontSize: Layout.fontSize.md,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: Layout.spacing.sm,
  },

  levels: {
    width: '100%',
    alignItems: 'center',
    gap: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
  },

  levelCard: {
    borderRadius: 22,
    borderWidth: 2,
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },

  levelLabel: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
});
