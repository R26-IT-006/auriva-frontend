import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { DMSans_800ExtraBold, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { evaluationApi } from '../../../../api/evaluation';

// Mirrors the backend's live EVAL_UNLOCK_THRESHOLD (evaluationService.js, DEC-04) —
// the task file text says "master 4 words to unlock", but the already-approved
// TASK-14 backend constant is 3 (see STATE.md DEC-04, resolved 2026-07-18).
// Using 4 here would show a locked card ("3/4") for a category the status API
// already reports as unlocked. Flagged in STATE.md for planner awareness.
const EVAL_UNLOCK_THRESHOLD = 3;

// Fixed per-category identity (avatar + gradient) — the cards themselves keep a fixed
// illustrated identity regardless of avatar theme, but the screen background below
// still uses theme.backgroundGradient like the rest of the app.
const CATEGORY_META = {
  greetings: {
    label: 'Greetings',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Lily_sunglasses.png'),
    gradient: ['#FF8FAB', '#E8336F'],
    shadowColor: 'rgba(232, 51, 111, 0.4)',
    avatarHeight: 192,
  },
  magic_words: {
    label: 'Magic Words',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Megatron_balloon.png'),
    gradient: ['#67E5C2', '#1AA898'],
    shadowColor: 'rgba(26, 168, 152, 0.4)',
    avatarHeight: 192,
  },
  abilities: {
    label: 'Can You?',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Boba_superhero.png'),
    gradient: ['#FFB347', '#E06B00'],
    shadowColor: 'rgba(224, 107, 0, 0.4)',
    avatarHeight: 192,
  },
};

const LOCKED_GRADIENT = ['#CBD5E1', '#94A3B8'];
const AVATAR_OVERLAP = 64;

// Same cycling palette as AnimatedWord (components/common/AnimatedWord.js) —
// used here statically (no per-letter animation) for the "Evaluations" title.
const TITLE_LETTER_COLORS = [
  '#4C8BF5', // blue
  '#FF6FA5', // pink
  '#F4C430', // yellow
  '#4CAF7D', // green
  '#A66BE8', // purple
  '#FF7F5C', // coral
  '#2CBFAE', // teal
  '#E0A526', // gold
];

function ColorfulTitle({ text, fontSize, fontsLoaded }) {
  return (
    <View style={styles.colorfulTitleRow}>
      {text.split('').map((char, i) => (
        <Text
          key={i}
          style={[
            styles.headerTitle,
            {
              fontSize,
              color: char === ' ' ? 'transparent' : TITLE_LETTER_COLORS[i % TITLE_LETTER_COLORS.length],
            },
            fontsLoaded && { fontFamily: 'Colora', fontWeight: 'normal' },
          ]}
        >
          {char}
        </Text>
      ))}
    </View>
  );
}

function CategoryCard({ entry, meta, cardWidth, onPress, fontsLoaded }) {
  const locked = !entry.unlocked;

  return (
    <TouchableOpacity
      activeOpacity={locked ? 1 : 0.88}
      disabled={locked}
      onPress={onPress}
      style={[styles.cardWrap, { width: cardWidth }]}
    >
      {/* Avatar — overlaps above the card. Needs its own elevation higher than
          the card's (8) too: on Android, elevation decides paint order between
          siblings ahead of zIndex, so without it the card renders on top and
          hides the overlapping part of the avatar. */}
      <View style={[styles.avatarWrap, { marginBottom: -AVATAR_OVERLAP }]}>
        <Image
          source={meta.avatar}
          style={{ height: meta.avatarHeight, width: cardWidth * 0.72 }}
          resizeMode="contain"
        />
      </View>

      <LinearGradient
        colors={locked ? LOCKED_GRADIENT : meta.gradient}
        style={[styles.card, { shadowColor: locked ? '#475569' : meta.shadowColor, paddingTop: AVATAR_OVERLAP + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
      >
        {/* Decorative circles */}
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        <View style={styles.cardTextWrap}>
          <Text
            style={[
              styles.cardTitle,
              fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', fontWeight: 'normal' },
            ]}
            numberOfLines={1}
          >
            {meta.label}
          </Text>
          {locked ? (
            <Text
              style={[
                styles.cardSub,
                fontsLoaded && { fontFamily: 'DMSans_600SemiBold', fontWeight: 'normal' },
              ]}
            >
              {`Master ${EVAL_UNLOCK_THRESHOLD} words to unlock • ${entry.mastered_count}/${EVAL_UNLOCK_THRESHOLD}`}
            </Text>
          ) : (
            <Text
              style={[
                styles.cardSub,
                fontsLoaded && { fontFamily: 'DMSans_600SemiBold', fontWeight: 'normal' },
              ]}
            >
              Ready to try!
            </Text>
          )}
        </View>

        <View style={styles.statusPill}>
          {locked ? (
            <>
              <Ionicons name="lock-closed" size={13} color="#FFF" />
              <Text
                style={[
                  styles.statusPillText,
                  fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', fontWeight: 'normal' },
                ]}
              >
                Locked
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.statusPillText,
                  fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', fontWeight: 'normal' },
                ]}
              >
                Start
              </Text>
              <Ionicons name="chevron-forward" size={13} color="#FFF" />
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function EvaluationMenuScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Same pattern as L2TopicSelectionScreen — Colora loaded locally,
  // DM Sans pulled from the @expo-google-fonts/dm-sans package.
  const [fontsLoaded] = useFonts({
    Colora: require('../../../../../assets/fonts/COLORA.ttf'),
    DMSans_800ExtraBold,
    DMSans_600SemiBold,
  });

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

  const cardWidth = Math.min(width * 0.31, 320);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('DialogueCategory', { student })}
            activeOpacity={0.7}
            style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.12)' }]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <ColorfulTitle text="Evaluations" fontSize={44} fontsLoaded={fontsLoaded} />
          <View style={styles.backBtn} />
        </View>

        <Text
          style={[
            styles.subheading,
            { color: theme.headingText },
            fontsLoaded && { fontFamily: 'Colora', fontWeight: 'normal' },
          ]}
        >
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

        {!loading && !error && status && (
          <View style={styles.cardsRow}>
            {status.map((entry) => {
              const meta = CATEGORY_META[entry.category];
              if (!meta) return null;
              return (
                <CategoryCard
                  key={entry.category}
                  entry={entry}
                  meta={meta}
                  cardWidth={cardWidth}
                  fontsLoaded={fontsLoaded}
                  onPress={() =>
                    navigation.navigate('EvaluationMatch', { student, category: entry.category })
                  }
                />
              );
            })}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
    paddingBottom: Layout.spacing.xs,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  colorfulTitleRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: '900', letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  subheading: {
    fontSize: 20, fontWeight: '600',
    textAlign: 'center', opacity: 0.85,
    marginTop: 4, marginBottom: Layout.spacing.xl + AVATAR_OVERLAP - 20,
    paddingHorizontal: Layout.spacing.lg,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#FF4D6D', fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },

  cardsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xl,
  },

  cardWrap: { alignItems: 'center' },
  avatarWrap: { alignItems: 'center', zIndex: 2, elevation: 12 },
  card: {
    width: '100%',
    minHeight: 235,
    borderRadius: 26,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    overflow: 'hidden',
    zIndex: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  circleTopRight: {
    position: 'absolute', top: -30, right: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  circleBottomLeft: {
    position: 'absolute', bottom: -18, left: -18,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  cardTextWrap: { zIndex: 1 },
  cardTitle: {
    fontSize: 20, fontWeight: '900', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  cardSub: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4,
  },

  statusPill: {
    zIndex: 1,
    alignSelf: 'flex-end',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});