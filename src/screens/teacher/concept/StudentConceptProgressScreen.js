import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { Layout } from '../../../constants/layout';
import { getConceptItemsForCategory } from '../../../data/conceptData';
import { conceptApi } from '../../../api/concept';

const S_COLOR = {
  passed:      '#4CAF50',
  in_progress: '#FF9800',
  failed:      '#F44336',
  not_started: '#BDBDBD',
  locked:      '#DDE0E8',
};
const S_BG = {
  passed:      '#E8F5E9',
  in_progress: '#FFF8E1',
  failed:      '#FFEBEE',
  not_started: '#F5F6FA',
  locked:      '#F5F6FA',
};
const S_ICON = {
  passed:      'checkmark-circle',
  in_progress: 'time-outline',
  failed:      'close-circle',
  not_started: 'ellipse-outline',
  locked:      'lock-closed-outline',
};

function cardAccent(item, themeButton) {
  if (item.tier3_status === 'passed') return '#4CAF50';
  if (item.tier2_status === 'passed') return themeButton;
  if (item.tier1_status === 'passed') return '#FF9800';
  if (item.tier1_status === 'in_progress') return '#FFC107';
  return '#DDE0E8';
}

function TierPill({ label, status }) {
  const color = S_COLOR[status] ?? S_COLOR.not_started;
  const bg    = S_BG[status]   ?? S_BG.not_started;
  return (
    <View style={[styles.tierPill, { backgroundColor: bg, borderColor: color }]}>
      <Ionicons name={S_ICON[status] ?? 'ellipse-outline'} size={9} color={color} />
      <Text style={[styles.tierPillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function StatCard({ count, total, label, sublabel, color, iconName, theme }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <View style={[styles.statCard, { backgroundColor: theme.cardSurface, borderTopColor: color }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIconBox, { backgroundColor: color + '22' }]}>
          <Ionicons name={iconName} size={16} color={color} />
        </View>
        <Text style={[styles.statCount, { color }]}>
          {count}
          <Text style={[styles.statDenom, { color: theme.headingText }]}>/{total}</Text>
        </Text>
      </View>
      <Text style={[styles.statLabel, { color: theme.headingText }]}>{label}</Text>
      <Text style={styles.statSublabel}>{sublabel}</Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.statPct, { color }]}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function ConceptCard({ item, cardW, theme }) {
  const isLocked  = !item.is_unlocked;
  const t2Visible = item.tier1_status === 'passed' ? item.tier2_status : 'locked';
  const t3Visible = item.tier2_status === 'passed' ? item.tier3_status : 'locked';
  const accent    = isLocked ? '#DDE0E8' : cardAccent(item, theme.button);

  return (
    <View style={[styles.card, { width: cardW, backgroundColor: theme.cardSurface, borderTopColor: accent }]}>
      {item.is_priority && !isLocked && (
        <View style={styles.priorityBadge}>
          <Ionicons name="star" size={11} color="#FF9800" />
        </View>
      )}

      <View style={styles.cardImageBox}>
        <Image
          source={item.icon ?? item.real}
          style={[styles.cardImage, isLocked && { opacity: 0.2 }]}
          resizeMode="contain"
        />
      </View>

      <Text
        style={[styles.cardName, { color: isLocked ? '#BDBDBD' : theme.headingText }]}
        numberOfLines={1}
      >
        {item.label}
      </Text>

      {isLocked ? (
        <View style={styles.lockedRow}>
          <Ionicons name="lock-closed" size={12} color="#BDBDBD" />
          <Text style={styles.lockedText}>Locked</Text>
        </View>
      ) : (
        <View style={styles.pillRow}>
          <TierPill label="T1" status={item.tier1_status} />
          <TierPill label="T2" status={t2Visible} />
          <TierPill label="T3" status={t3Visible} />
        </View>
      )}

      {item.tier1_score !== null && item.tier1_status === 'passed' && (
        <Text style={[styles.scoreText, { color: theme.headingText + '99' }]}>
          {Math.round(item.tier1_score * 100)}%
        </Text>
      )}
    </View>
  );
}

export default function StudentConceptProgressScreen({ route, navigation }) {
  const { student, category } = route.params;
  const { width }             = useWindowDimensions();
  const theme                 = getAvatarTheme(student?.avatar_key);

  const [progressItems, setProgressItems] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const localItems = getConceptItemsForCategory(category.key);

  const COLS  = 5;
  const H_PAD = Layout.spacing.md;
  const GAP   = 10;
  const cardW = (width - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

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

  const serverMap = {};
  progressItems.forEach((item) => { serverMap[item.concept_key] = item; });

  const merged = localItems.map((local) => {
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

  const total    = merged.length;
  const t1Passed = merged.filter((i) => i.tier1_status === 'passed').length;
  const t2Passed = merged.filter((i) => i.tier2_status === 'passed').length;
  const t3Passed = merged.filter((i) => i.tier3_status === 'passed').length;

  const displayName = student.full_name ?? student.name ?? 'Student';
  const initials    = displayName[0]?.toUpperCase() ?? '?';
  const photoUri    = student.profile_photo_url ?? null;

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardOutline + '40' }]}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: theme.cardOutline + '30' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={[styles.headerAvatar, { borderColor: theme.button + '60' }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.headerAvatarPhoto} />
              ) : (
                <View style={[styles.headerAvatarFallback, { backgroundColor: theme.button + '25' }]}>
                  <Text style={[styles.headerAvatarText, { color: theme.button }]}>{initials}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={[styles.headerName, { color: theme.headingText }]}>{displayName}</Text>
              <Text style={[styles.headerSub, { color: theme.headingText + 'AA' }]}>
                {category.label}  ·  Progress Report
              </Text>
            </View>
          </View>

          <View style={[styles.headerBtn, { backgroundColor: theme.button + '20' }]}>
            <Ionicons name="school" size={20} color={theme.button} />
          </View>
        </View>

        {/* Stat bar */}
        {!loading && (
          <View style={[styles.statsBar, { backgroundColor: theme.cardSurface + 'CC', borderBottomColor: theme.cardOutline + '40' }]}>
            <StatCard
              count={t1Passed} total={total}
              label="Tier 1" sublabel="Identify"
              color="#4CAF50" iconName="image-outline"
              theme={theme}
            />
            <StatCard
              count={t2Passed} total={total}
              label="Tier 2" sublabel="Name Match"
              color={theme.button} iconName="text-outline"
              theme={theme}
            />
            <StatCard
              count={t3Passed} total={total}
              label="Tier 3" sublabel="Video"
              color="#FF9800" iconName="play-circle-outline"
              theme={theme}
            />
          </View>
        )}

        {/* Concept grid */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.button} style={styles.loader} />
        ) : (
          <FlatList
            data={merged}
            keyExtractor={(item) => item.key}
            numColumns={COLS}
            key={COLS}
            renderItem={({ item }) => <ConceptCard item={item} cardW={cardW} theme={theme} />}
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
  root: { flex: 1 },
  safe: { flex: 1 },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    overflow: 'hidden',
  },
  headerAvatarPhoto: {
    width: '100%',
    height: '100%',
  },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontFamily: 'DMSans_900Black',
  },
  headerName: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    marginTop: 1,
  },

  /* ── Stat bar ── */
  statsBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statCard: {
    flex: 1,
    borderRadius: Layout.radius.md,
    padding: 12,
    borderTopWidth: 3,
    gap: 3,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCount: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
  },
  statDenom: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
  },
  statSublabel: {
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
    color: '#9E9E9E',
  },
  statTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginTop: 4,
  },
  statFill: {
    height: '100%',
    borderRadius: 3,
  },
  statPct: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'right',
  },

  /* ── Concept grid ── */
  loader: { flex: 1, alignSelf: 'center' },
  list: {
    paddingVertical: Layout.spacing.md,
  },

  card: {
    borderRadius: Layout.radius.md,
    borderTopWidth: 3,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  priorityBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  cardImageBox: {
    width: '45%',
    aspectRatio: 1,
    borderRadius: Layout.radius.sm,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardName: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  tierPillLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_800ExtraBold',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#BDBDBD',
  },
  scoreText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
});
