import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
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
  {
    key: 'level1',
    label: 'Level 1',
    subtitle: 'Dialogue Word Learning',
    image: require('../../../../assets/dialogue-icons/talking.png'),
  },
  {
    key: 'level2',
    label: 'Level 2',
    subtitle: 'Sentence Construction',
    image: require('../../../../assets/dialogue-icons/word-of-mouth.png'),
  },
];

// Mirrors ConceptCategoriesScreen's CategoryCard (press animation, surface/outline
// theming, rounded card + image + label) so the two module landing screens read
// as one visual system.
function LevelCard({ item, cardW, cardH, theme, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.card,
          { width: cardW, height: cardH, backgroundColor: theme.cardSurface, borderColor: theme.cardOutline },
        ]}
      >
        <Image source={item.image} style={styles.cardImage} resizeMode="contain" />
        <Text style={styles.cardLabel} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DialogueLandingScreen({ route, navigation }) {
  const student   = route.params?.student;
  const theme     = getAvatarTheme(student?.avatar_key);
  const firstName = student?.full_name?.split(' ')[0] ?? student?.full_name ?? 'Student';
  const { width } = useWindowDimensions();

  // Intercept Android hardware back → same destination as the UI back arrow
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('StudentDashboard', { student });
      return true;
    });
    return () => sub.remove();
  }, [student]));

  const H_PAD = Layout.spacing.lg;
  const GAP   = 20;
  const cardW = Math.min((width - H_PAD * 2 - GAP) / 2, 380);
  const cardH = cardW * 0.95;

  function goToLevel(key) {
    if (key === 'level1') {
      navigation.navigate('DialogueCategory', { student });
    } else if (key === 'level2') {
      navigation.navigate('L2TopicSelection', { student });
    }
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative floating shapes — same treatment as ConceptCategoriesScreen */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}
            onPress={() => navigation.navigate('StudentDashboard', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <Text style={[styles.heading, { color: theme.headingText }]}>
            Welcome back {firstName}!
          </Text>
          <Text style={[styles.subheading, { color: theme.headingText }]}>
            What shall we learn today?
          </Text>
        </View>

        {/* ── Body ────────────────────────────────────────────── */}
        <View style={styles.body}>

          <View style={[styles.levels, { gap: GAP }]}>
            {LEVELS.map((level) => (
              <LevelCard
                key={level.key}
                item={level}
                cardW={cardW}
                cardH={cardH}
                theme={theme}
                onPress={() => goToLevel(level.key)}
              />
            ))}
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Decorative background shapes ──────────────────────────────────────────
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  topBar: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop:    Layout.spacing.sm,
    paddingBottom: Layout.spacing.md,
  },
  iconBtn: {
    width:  40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },

  heading: {
    fontSize: 28,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: Layout.spacing.md,
  },

  subheading: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
  },

  levels: {
    flexDirection: 'row',
  },

  card: {
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardImage: {
    width: '62%',
    height: '50%',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  cardSubtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    lineHeight: 19,
    color: '#4A4A4A',
    marginTop: 4,
  },
});
