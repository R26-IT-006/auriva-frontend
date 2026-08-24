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
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { getConceptItemsForCategory } from '../../../data/conceptData';
import { getConclusionForCategory } from '../../../data/conceptConclusions';
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

  const isLocked     = !item.is_unlocked;
  const isPassed     = item.tier1_status === 'passed';
  const isProgress   = item.tier1_status === 'in_progress';
  const isPriority   = item.is_priority && !isPassed;

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
            borderColor:     isPassed    ? '#4CAF50'
                           : isPriority  ? '#FF9800'
                           : isResume    ? theme.button
                           : isLocked    ? '#D0D0D0'
                           : theme.cardOutline,
            borderWidth: isResume || isPriority ? 5 : 4,
          },
        ]}
        onPress={onPress}
      >
        {/* Fruit image */}
        <View style={styles.cardImageBox}>
          <Image
            source={item.icon ?? item.real}
            style={[styles.cardImage, isLocked && styles.cardImageLocked]}
            resizeMode="contain"
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

        {/* Priority (focus) badge — star icon in orange */}
        {isPriority && !isResume && (
          <View style={styles.priorityBadge}>
            <Ionicons name="star" size={13} color="#FF9800" />
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

  const [progressItems,  setProgressItems]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [gateVisible,    setGateVisible]    = useState(false);
  const [activityStatus, setActivityStatus] = useState(null);

  const theme    = getAvatarTheme(student?.avatar_key);
  const H_PAD    = Layout.spacing.md;
  const GAP      = 18;
  const COLS     = 6;
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

      // Fetched separately from the items call so the banner doesn't wait on that
      // request's GKB round-trip.
      conceptApi.getActivityStatus(category.key, student.sid)
        .then((status) => { if (active) setActivityStatus(status); })
        .catch(() => { if (active) setActivityStatus(null); });

      return () => { active = false; };
    }, [category.key, student.sid])
  );

  // Build a quick-lookup map from server items
  const serverMap = {};
  progressItems.forEach((item) => { serverMap[item.concept_key] = item; });

  // Sort localItems by the server's adaptive sequence_index when available,
  // otherwise keep the original local order.
  const sortedLocal = progressItems.length > 0
    ? [...localItems].sort((a, b) => {
        const ai = serverMap[a.key]?.sequence_index ?? localItems.indexOf(a);
        const bi = serverMap[b.key]?.sequence_index ?? localItems.indexOf(b);
        return ai - bi;
      })
    : localItems;

  // Merge server progress data into (adaptively) sorted local items.
  // Always produces exactly localItems.length entries — never filtered.
  const merged = sortedLocal.map((local) => {
    const s = serverMap[local.key];
    return {
      ...local,
      is_unlocked:  s?.is_unlocked  ?? (local.key === localItems[0]?.key),
      is_priority:  s?.is_priority  || false,
      tier1_status: s?.tier1_status || 'not_started',
      tier1_score:  s?.tier1_score  ?? null,
      tier2_status: s?.tier2_status || 'not_started',
      tier3_status: s?.tier3_status || 'not_started',
    };
  });

  // Re-entry point: first unlocked concept not yet fully through tier 3
  const resumeKey = loading
    ? null
    : (merged.find((i) => i.is_unlocked && i.tier3_status !== 'passed')?.key ?? null);

  // Category complete when every concept has passed tier 1
  const allTier1Passed = !loading && merged.length > 0 && merged.every((i) => i.tier1_status === 'passed');

  // Bottom 3 by tier1_score for the review section (only when all passed)
  const weakConcepts = allTier1Passed
    ? [...merged]
        .filter((i) => i.tier1_score !== null && i.tier1_score < 1.0)
        .sort((a, b) => (a.tier1_score ?? 1) - (b.tier1_score ?? 1))
        .slice(0, 3)
    : [];

  // Route to the correct tier screen based on what the student last completed
  function routeForItem(item) {
    if (item.tier1_status !== 'passed') {
      return ['ConceptImage', { student, category, conceptKey: item.key, sessionId: null }];
    }
    if (item.tier2_status !== 'passed') {
      const screen = item.tier2_status === 'in_progress' ? 'Tier2Activity' : 'Tier2Image';
      return [screen, { student, category, conceptKey: item.key, sessionId: null }];
    }
    if (item.tier3_status !== 'passed') {
      return ['Tier3Video', { student, category, conceptKey: item.key }];
    }
    // Fully complete — allow re-practice from the top
    return ['ConceptImage', { student, category, conceptKey: item.key, sessionId: null }];
  }

  function renderCard({ item }) {
    return (
      <ConceptCard
        item={item}
        cardW={cardW}
        cardH={cardH}
        theme={theme}
        isResume={item.key === resumeKey}
        onPress={() => {
          const [screen, params] = routeForItem(item);
          navigation.navigate(screen, params);
        }}
      />
    );
  }

  // Deliberately a banner and not an auto-navigate: dropping a child straight into
  // a new activity type without warning is the kind of unannounced transition that
  // causes distress. The child (or teacher) starts it.
  function renderActivityBanner() {
    if (!activityStatus?.eligible) return null;

    const isResume = Boolean(activityStatus.pending_activity_id);
    const previewKeys = (activityStatus.mastered_uncovered || []).slice(0, 3);
    const previews = previewKeys
      .map((k) => localItems.find((i) => i.key === k))
      .filter(Boolean);

    return (
      <TouchableOpacity
        style={[styles.activityBanner, { backgroundColor: theme.button }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ConceptActivity', { student, category, sessionId: null })}
      >
        <View style={styles.activityBannerIcon}>
          <Ionicons name="ribbon" size={26} color={theme.button} />
        </View>

        <View style={styles.activityBannerText}>
          <Text style={[styles.activityBannerTitle, { color: theme.buttonText }]}>
            {isResume ? 'Continue your activity' : 'Activity Ready! 🎯'}
          </Text>
          <Text style={[styles.activityBannerSub, { color: theme.buttonText }]}>
            {isResume
              ? 'Pick up where you left off.'
              : 'Practise the concepts you have learned.'}
          </Text>
        </View>

        <View style={styles.activityBannerPreviews}>
          {previews.map((item) => (
            <View key={item.key} style={styles.activityBannerThumb}>
              <Image source={item.icon ?? item.real} style={styles.activityBannerThumbImg} resizeMode="contain" />
            </View>
          ))}
        </View>

        <Ionicons name="chevron-forward" size={22} color={theme.buttonText} />
      </TouchableOpacity>
    );
  }

  // The end-of-category send-off, offered once every concept here is mastered
  // (tier 1 and tier 2 — `fully_mastered` comes from the same predicate the
  // dashboard and analytics count with). Like the activity banner above it, this
  // waits to be tapped rather than auto-navigating.
  function renderConclusionBanner() {
    const conclusion = getConclusionForCategory(category.key);
    if (!conclusion || !activityStatus?.fully_mastered) return null;

    return (
      <TouchableOpacity
        style={[styles.activityBanner, styles.conclusionBanner]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate(conclusion.screen, { student, category })}
      >
        <View style={styles.activityBannerIcon}>
          <Ionicons name="trophy" size={26} color="#C77800" />
        </View>

        <View style={styles.activityBannerText}>
          <Text style={[styles.activityBannerTitle, { color: '#4A2E00' }]}>
            {conclusion.title} 🏆
          </Text>
          <Text style={[styles.activityBannerSub, { color: '#4A2E00' }]}>
            You finished {category.label}! {conclusion.subtitle}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#4A2E00" />
      </TouchableOpacity>
    );
  }

  function renderHeader() {
    return (
      <>
        {renderConclusionBanner()}
        {renderActivityBanner()}
      </>
    );
  }

  function renderReviewSection() {
    if (weakConcepts.length === 0) return null;
    return (
      <View style={styles.reviewSection}>
        <Text style={[styles.reviewHeading, { color: theme.headingText }]}>
          Review Weaker Concepts
        </Text>
        <View style={styles.reviewRow}>
          {weakConcepts.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.reviewCard, { backgroundColor: theme.cardSurface, borderColor: '#FF9800' }]}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Tier2Activity', { student, category, conceptKey: item.key, sessionId: null })}
            >
              <View style={styles.reviewImageBox}>
                <Image source={item.icon ?? item.real} style={styles.reviewImage} resizeMode="contain" />
              </View>
              <Text style={styles.reviewLabel}>{item.label}</Text>
              <View style={styles.reviewScoreBadge}>
                <Text style={styles.reviewScoreText}>{Math.round((item.tier1_score ?? 0) * 100)}%</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.6)' }]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="school" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: theme.headingText }]}>
          Tap a picture to start learning
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
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderReviewSection}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => {
          setGateVisible(false);
          navigation.navigate('StudentConceptProgress', { student, category });
        }}
        onCancel={() => setGateVisible(false)}
      />

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
    fontFamily: 'DMSans_900Black',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
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
    fontFamily: 'DMSans_800ExtraBold',
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
  priorityBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
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

  // ── Activity banner ────────────────────────────────────────────────────────
  activityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  // Gold rather than the avatar theme's button colour, so finishing a category
  // does not look like one more practice prompt.
  conclusionBanner: {
    backgroundColor: '#FFC93C',
    borderWidth: 3,
    borderColor: '#E0A100',
  },
  activityBannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBannerText: { flex: 1, gap: 2 },
  activityBannerTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
  },
  activityBannerSub: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.85,
  },
  activityBannerPreviews: {
    flexDirection: 'row',
    gap: 6,
  },
  activityBannerThumb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  activityBannerThumbImg: { width: '100%', height: '100%' },

  reviewSection: {
    marginTop: 28,
    paddingHorizontal: 4,
    gap: 12,
  },
  reviewHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: 0.3,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 16,
  },
  reviewCard: {
    width: 110,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  reviewImageBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reviewScoreBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewScoreText: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#E65100',
  },
});
