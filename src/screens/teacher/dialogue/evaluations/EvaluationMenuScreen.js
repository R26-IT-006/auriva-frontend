import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  Animated,
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
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';
import { rs, rf } from '../../../../utils/responsive';

// Mirrors the backend's live EVAL_UNLOCK_THRESHOLD (evaluationService.js, DEC-04) —
// the task file text says "master 4 words to unlock", but the already-approved
// TASK-14 backend constant is 3 (see STATE.md DEC-04, resolved 2026-07-18).
// Using 4 here would show a locked card ("3/4") for a category the status API
// already reports as unlocked. Flagged in STATE.md for planner awareness.
const EVAL_UNLOCK_THRESHOLD = 3;

// Fixed per-category avatar. The cards themselves use the avatar theme's card
// colours, like the Level 1 category cards.
const CATEGORY_META = {
  greetings: {
    label: 'Greetings',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Lily_sunglasses.png'),
    avatarHeight: 192,
  },
  magic_words: {
    label: 'Magic Words',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Megatron_balloon.png'),
    avatarHeight: 192,
  },
  abilities: {
    label: 'Can You?',
    avatar: require('../../../../../assets/dialogue-images/Evaluations/Boba_superhero.png'),
    avatarHeight: 192,
  },
};

const AVATAR_OVERLAP = 64;

// The card itself matches the Level 1 category cards (DialogueCategoryScreen):
// theme card surface + outline, rounded, soft shadow, dark bold label, and a
// gentle press-in. The category's avatar still overlaps the top of the card.
function CategoryCard({ entry, meta, cardWidth, onPress, fontsLoaded, theme }) {
  const locked = !entry.unlocked;
  const scale  = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (locked) return;
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable
      disabled={locked}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.cardWrap, { width: cardWidth }]}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${meta.label}, locked` : `${meta.label}, start`}
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

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardSurface,
            borderColor: theme.cardOutline,
            paddingTop: AVATAR_OVERLAP + 16,
          },
          locked && styles.cardLocked,
        ]}
      >
        <View style={styles.cardTextWrap}>
          <Text
            style={[
              styles.cardTitle,
              fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', },
            ]}
            numberOfLines={1}
          >
            {meta.label}
          </Text>
          {locked ? (
            <Text
              style={[
                styles.cardSub,
                fontsLoaded && { fontFamily: 'DMSans_600SemiBold', },
              ]}
            >
              {`Master ${EVAL_UNLOCK_THRESHOLD} words to unlock • ${entry.mastered_count}/${EVAL_UNLOCK_THRESHOLD}`}
            </Text>
          ) : (
            <Text
              style={[
                styles.cardSub,
                fontsLoaded && { fontFamily: 'DMSans_600SemiBold', },
              ]}
            >
              Ready to try!
            </Text>
          )}
        </View>

        <View style={[styles.statusPill, { backgroundColor: locked ? '#94A3B8' : theme.button }]}>
          {locked ? (
            <>
              <Ionicons name="lock-closed" size={13} color="#FFF" />
              <Text
                style={[
                  styles.statusPillText,
                  fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', },
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
                  fontsLoaded && { fontFamily: 'DMSans_800ExtraBold', },
                ]}
              >
                Start
              </Text>
              <Ionicons name="chevron-forward" size={13} color="#FFF" />
            </>
          )}
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

export default function EvaluationMenuScreen({ route, navigation }) {
  const student = route.params?.student;
  const theme = getAvatarTheme(student?.avatar_key);
  const { width } = useWindowDimensions();

  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // DM Sans for the card text, from the @expo-google-fonts/dm-sans package.
  const [fontsLoaded] = useFonts({
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
        {/* Heading — the same top bar as the Level 1 category screen
            (DialogueCategoryScreen): round back button, icon circle + title,
            then a one-line subtitle. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('DialogueCategory', { student })}
            activeOpacity={0.7}
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }, BACK_BUTTON]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="trophy" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Evaluations</Text>
          </View>

          <View style={styles.iconBtn} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
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
                  theme={theme}
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

  // ── Heading — same as DialogueCategoryScreen ──────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: rs(40), height: rs(40),
    borderRadius: rs(20),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // Less top space than the landing screens (as L2 topic selection): the
  // avatar cards below are tall and must still fit a landscape tablet.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10),
    marginTop: rs(36),
  },
  titleIconCircle: {
    width: rs(34),
    height: rs(34),
    borderRadius: rs(17),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: rf(32),
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: rf(13),
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
    // Room for the avatars that overlap the top of each card.
    marginBottom: Layout.spacing.xl + AVATAR_OVERLAP - 20,
    paddingHorizontal: Layout.spacing.lg,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#FF4D6D', fontFamily: 'DMSans_600SemiBold', textAlign: 'center', paddingHorizontal: rs(32) },

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
  // Same card as the Level 1 category cards: theme surface + 2px outline
  // (set inline), rounded, soft shadow. Content is centred like theirs.
  card: {
    width: '100%',
    minHeight: rs(235),
    borderRadius: rs(20),
    borderWidth: 2,
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  // Locked: still readable, visibly not yet available.
  cardLocked: { opacity: 0.6 },

  cardTextWrap: { alignItems: 'center' },
  cardTitle: {
    fontSize: rf(20), fontFamily: 'DMSans_800ExtraBold', color: '#1A1A1A', textAlign: 'center',
  },
  cardSub: {
    fontSize: rf(12), fontFamily: 'DMSans_600SemiBold', color: '#555555', marginTop: rs(4), textAlign: 'center',
  },

  // Theme-coloured "Start" (grey when locked), like the app's other pills.
  statusPill: {
    marginTop: rs(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5),
    borderRadius: rs(100),
    paddingHorizontal: rs(16),
    paddingVertical: rs(8),
  },
  statusPillText: { fontSize: rf(13), fontFamily: 'DMSans_800ExtraBold', color: '#FFF' },
});