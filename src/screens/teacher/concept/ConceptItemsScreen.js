import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItemsForCategory } from '../../../constants/conceptData';
import { conceptApi } from '../../../api/concept';
import { Layout } from '../../../constants/layout';

function ConceptCard({ item, cardW, cardH, theme, isResume, onPress }) {
  const popAnim = useRef(new Animated.Value(isResume ? 0.8 : 1)).current;

  useEffect(() => {
    if (!isResume) return;
    const t = setTimeout(() => {
      Animated.spring(popAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 20,
        speed: 4,
      }).start();
    }, 350);
    return () => clearTimeout(t);
  }, [isResume]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLocked   = !item.is_unlocked;
  const isPassed   = item.tier1_status === 'passed';
  const isProgress = item.tier1_status === 'in_progress';

  return (
    <Animated.View style={{ transform: [{ scale: popAnim }] }}>
      <TouchableOpacity
        activeOpacity={isLocked ? 1 : 0.82}
        disabled={isLocked}
        style={[
          styles.card,
          {
            width: cardW,
            height: cardH,
            backgroundColor: isLocked ? '#F0F0F0' : theme.cardSurface,
            borderColor:     isPassed  ? '#4CAF50'
                           : isResume  ? theme.button
                           : isLocked  ? '#D0D0D0'
                           : theme.cardOutline,
            borderWidth: isResume ? 5 : 4,
          },
        ]}
        onPress={onPress}
      >
        {/* Fruit image */}
        <View style={styles.cardImageBox}>
          <Image
            source={item.real}
            style={[styles.cardImage, isLocked && styles.cardImageLocked]}
            resizeMode="cover"
          />
        </View>

        {/* Label */}
        <Text style={[styles.cardLabel, isLocked && styles.cardLabelLocked]}>
          {item.label}
        </Text>

        {/* Locked overlay */}
        {isLocked && (
          <View style={styles.lockedOverlay}>
            <Ionicons name="lock-closed" size={20} color="#AAA" />
          </View>
        )}

        {/* Passed badge */}
        {isPassed && (
          <View style={styles.passedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
        )}

        {/* Resume badge — replaces progress dot */}
        {isResume ? (
          <View style={[styles.resumeBadge, { backgroundColor: theme.button }]}>
            <Ionicons name="play" size={9} color="#FFF" />
          </View>
        ) : isProgress && !isPassed ? (
          <View style={[styles.progressDot, { backgroundColor: theme.button }]} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ConceptItemsScreen({ route, navigation }) {
  const { student, category } = route.params;
  const { width }             = useWindowDimensions();

  const [progressItems, setProgressItems] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const theme    = getAvatarTheme(student?.avatar_key);
  const H_PAD    = Layout.spacing.md;
  const GAP      = 18;
  const COLS     = 5;
  const cardW    = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
  const cardH    = cardW * 1.05;

  const localItems = getConceptItemsForCategory(category.key);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      conceptApi.getConceptItems(category.key, student.sid)
        .then((items) => { if (active) setProgressItems(items); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [category.key, student.sid])
  );

  const merged = localItems.map((local) => {
    const progress = progressItems.find((p) => p.concept_key === local.key);
    return {
      ...local,
      is_unlocked:  progress?.is_unlocked  ?? (local.key === localItems[0]?.key),
      tier1_status: progress?.tier1_status ?? 'not_started',
      tier1_score:  progress?.tier1_score  ?? null,
    };
  });

  // First unlocked concept that hasn't been passed — the resume point
  const resumeKey = loading
    ? null
    : (merged.find((i) => i.is_unlocked && i.tier1_status !== 'passed')?.key ?? null);

  function renderCard({ item }) {
    return (
      <ConceptCard
        item={item}
        cardW={cardW}
        cardH={cardH}
        theme={theme}
        isResume={item.key === resumeKey}
        onPress={() => navigation.navigate('ConceptImage', {
          student,
          category,
          conceptKey: item.key,
          sessionId:  null,
        })}
      />
    );
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.safe}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => navigation.navigate('ConceptCategories', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.headingText }]}>{category.label.toUpperCase()}</Text>
          </View>

          <View style={styles.iconBtn} />
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Tap a fruit to start learning
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.button} style={styles.loader} />
        ) : (
          <FlatList
            data={merged}
            keyExtractor={(item) => item.key}
            key={COLS}
            numColumns={COLS}
            renderItem={renderCard}
            contentContainerStyle={[styles.list, { paddingHorizontal: H_PAD }]}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  safeInner: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Nunito_900Black',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    marginTop: 2,
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
  },
  list: {
    paddingVertical: Layout.spacing.md,
  },
  card: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImageBox: {
    width: '72%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageLocked: {
    opacity: 0.25,
  },
  cardLabel: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  cardLabelLocked: {
    color: '#AAAAAA',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,240,240,0.55)',
  },
  passedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  resumeBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
