import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { principalApi } from '../../api/principal';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  teal:       '#4AADA3',
  tealLight:  '#E8F6F5',
  coral:      '#D97B6C',
  coralLight: '#FAF0EE',
  amber:      '#C9973A',
  amberLight: '#FBF4E6',
  green:      '#5BAF85',
  greenLight: '#EAF6F1',
  blue:       '#6A96C8',
  blueLight:  '#EBF2FB',
  sky:        '#6AAFD4',
  pink:       '#C47FA0',
  pinkLight:  '#F8EEF4',
  bg:         '#F2F1F8',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ iconName, iconBg, tag, value, subtitle, subtitleColor, description, dimValue, onPress }) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderTopColor: iconBg, borderTopWidth: 4 }]} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.statCardTop}>
        <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.statTag}>{tag}</Text>
      </View>
      <Text style={[styles.statValue, dimValue && { color: '#C4C8D8' }]}>
        {value ?? '00'}
      </Text>
      {subtitle ? (
        <Text style={[styles.statSubtitle, { color: subtitleColor || Colors.text.muted }]}>
          {subtitle}
        </Text>
      ) : null}
      {description ? (
        <Text style={styles.statDescription}>{description}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Action Tile ─────────────────────────────────────────────────────────────
function ActionTile({ iconName, label, iconBg, iconColor, onPress }) {
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <Text style={[styles.actionLabel, { color: iconColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ecosystem Metric ─────────────────────────────────────────────────────────
function EcoMetric({ tag, tagColor, value, valueColor, actionLabel, actionColor, iconName, onPress }) {
  return (
    <View style={styles.ecoMetric}>
      <View style={[styles.ecoIconBadge, { backgroundColor: tagColor + '22' }]}>
        <Ionicons name={iconName} size={15} color={tagColor} />
      </View>
      <Text style={[styles.ecoTag, { color: tagColor }]}>{tag}</Text>
      <Text style={[styles.ecoValue, { color: valueColor }]}>{value ?? '00'}</Text>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
          <Text style={[styles.ecoAction, { color: actionColor }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.ecoAction, { color: actionColor }]}>{actionLabel}</Text>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PrincipalDashboardScreen({ navigation }) {
  const [stats, setStats]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await principalApi.getDashboard();
      setStats(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const unassigned =
    stats?.studentCount != null && stats?.teacherCount != null
      ? Math.max(0, stats.studentCount - stats.teacherCount * 3)
      : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStats(); }}
            tintColor={K.purple}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Greeting ────────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <View style={styles.greetingIconBox}>
              <Ionicons name="school" size={22} color="#2E9CBB" />
            </View>
            <View style={styles.greetingTexts}>
              <Text style={styles.greetingDate}>{today}</Text>
              <Text style={styles.greetingText}>
                {greeting}, <Text style={styles.greetingBold}>Principal!</Text>
              </Text>
            </View>
          </View>
          <View style={styles.greetingBadge}>
            <Ionicons name="star" size={11} color="#C9973A" />
            <Text style={styles.greetingBadgeText}>Welcome back</Text>
          </View>
        </View>

        {/* ── Stat Cards ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            iconName="people"
            iconBg={K.purple}
            tag="TEACHERS"
            value={String(stats?.teacherCount ?? '0').padStart(2, '0')}
            subtitle="Active"
            subtitleColor={K.purple}
            description="Teaching staff"
            onPress={() => navigation.navigate('Teachers', { screen: 'TeacherList' })}
          />
          <StatCard
            iconName="school"
            iconBg={K.teal}
            tag="STUDENTS"
            value={String(stats?.studentCount ?? '0').padStart(2, '0')}
            subtitle="Enrolled"
            subtitleColor={K.teal}
            description="Learners enrolled"
            onPress={() => navigation.navigate('Students', { screen: 'StudentList' })}
          />
          <StatCard
            iconName="radio-button-on"
            iconBg={K.sky}
            tag="SESSIONS"
            value={String(stats?.activeSessionCount ?? '0').padStart(2, '0')}
            subtitle="Live now"
            subtitleColor={K.sky}
            dimValue={!stats?.activeSessionCount}
          />
        </View>

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionEmoji}>⚡</Text>
          </View>
          <View style={styles.actionsGrid}>
            <ActionTile
              iconName="person-add"
              label="Add Teacher"
              iconBg={K.purpleLight}
              iconColor={K.purple}
              onPress={() => navigation.navigate('Teachers', { screen: 'CreateTeacher' })}
            />
            <ActionTile
              iconName="add-circle"
              label="Add Student"
              iconBg={K.coralLight}
              iconColor={K.coral}
              onPress={() => navigation.navigate('Students', { screen: 'CreateStudent' })}
            />
            <ActionTile
              iconName="people"
              label="View Teachers"
              iconBg={K.tealLight}
              iconColor={K.teal}
              onPress={() => navigation.navigate('Teachers', { screen: 'TeacherList' })}
            />
            <ActionTile
              iconName="school"
              label="View Students"
              iconBg={K.amberLight}
              iconColor={K.amber}
              onPress={() => navigation.navigate('Students', { screen: 'StudentList' })}
            />
          </View>
        </View>

        {/* ── School Overview ──────────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>School Overview</Text>
            <Text style={styles.sectionEmoji}>🌟</Text>
          </View>
          <View style={styles.ecoCard}>
            <View style={styles.ecoMetricsRow}>
              <EcoMetric
                tag="Faculty"
                tagColor={K.purple}
                iconName="people"
                value={String(stats?.teacherCount ?? '0').padStart(2, '0')}
                valueColor={K.purple}
                actionLabel="Manage →"
                actionColor={K.purple}
                onPress={() => navigation.navigate('Teachers', { screen: 'TeacherList' })}
              />
              <View style={styles.ecoDiv} />
              <EcoMetric
                tag="Enrolled"
                tagColor={K.teal}
                iconName="school"
                value={String(stats?.studentCount ?? '0').padStart(2, '0')}
                valueColor={K.teal}
                actionLabel="Registry →"
                actionColor={K.teal}
                onPress={() => navigation.navigate('Students', { screen: 'StudentList' })}
              />
              <View style={styles.ecoDiv} />
              <EcoMetric
                tag="Live Now"
                tagColor={K.sky}
                iconName="radio-button-on"
                value={String(stats?.activeSessionCount ?? '0').padStart(2, '0')}
                valueColor={K.sky}
                actionLabel="Sessions"
                actionColor={Colors.text.muted}
              />
              <View style={styles.ecoDiv} />
              <EcoMetric
                tag="Attention"
                tagColor={unassigned === 0 ? K.green : K.coral}
                iconName="notifications"
                value={String(unassigned ?? '0').padStart(2, '0')}
                valueColor={unassigned === 0 ? K.green : K.coral}
                actionLabel={unassigned === 0 ? '✓ Healthy' : `${unassigned} pending`}
                actionColor={unassigned === 0 ? K.green : K.coral}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: K.bg,
  },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.lg,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greetingIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E4F4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTexts: {
    gap: 2,
  },
  greetingDate: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  greetingText: {
    fontSize: Layout.fontSize.xl,
    color: Colors.text.primary,
    fontWeight: '400',
  },
  greetingBold: {
    fontWeight: '900',
    color: Colors.text.primary,
  },
  greetingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBF4E6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  greetingBadgeText: {
    fontSize: Layout.fontSize.xs,
    color: '#C9973A',
    fontWeight: '600',
  },

  // Header card
  headerCard: {
    borderRadius: 24,
    padding: Layout.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  headerDate: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: Layout.fontWeight.semibold,
    letterSpacing: 0.3,
  },
  greeting: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    color: '#FFFFFF',
    lineHeight: 28,
  },
  greetingAccent: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: Layout.fontWeight.extrabold,
    color: '#FFFFFF',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  headerBadgeText: {
    fontSize: Layout.fontSize.xs,
    color: '#FFFFFF',
    fontWeight: Layout.fontWeight.semibold,
  },
  headerIllustration: {
    marginLeft: Layout.spacing.md,
    alignItems: 'center',
  },
  headerEmojiTop: {
    fontSize: 44,
    lineHeight: 50,
  },
  headerEmojiBottom: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: -4,
  },

  // Stat cards
  statsRow: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
    gap: 4,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Layout.spacing.xs,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTag: {
    fontSize: 9,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.muted,
    letterSpacing: 0.6,
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '55%',
  },
  statValue: {
    fontSize: Layout.fontSize.xxxl,
    fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary,
    lineHeight: 36,
  },
  statSubtitle: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  statDescription: {
    fontSize: 10,
    color: Colors.text.muted,
    lineHeight: 14,
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    marginBottom: Layout.spacing.sm,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.extrabold,
    color: Colors.text.primary,
  },
  sectionEmoji: {
    fontSize: 16,
  },

  // Action tiles — 2×2 grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
  actionTile: {
    width: '47.5%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    textAlign: 'center',
  },

  // Ecosystem card
  ecoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  ecoMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  ecoMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: Layout.spacing.xs,
  },
  ecoIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ecoTag: {
    fontSize: 10,
    fontWeight: Layout.fontWeight.bold,
    letterSpacing: 0.3,
  },
  ecoValue: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.extrabold,
  },
  ecoAction: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  ecoDiv: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 6,
  },
});
