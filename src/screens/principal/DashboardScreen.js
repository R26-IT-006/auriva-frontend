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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';
import { principalApi } from '../../api/principal';
import { useAuthStore } from '../../store/authStore';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

// ── palette ─────────────────────────────────────────────────────────────────
const GREEN      = '#3EBF78';
const GREEN_L    = '#E0F7EC';
const BLUE       = '#4A8FD8';
const BLUE_L     = '#DEEAF8';
const PURPLE     = '#7B68C8';
const PURPLE_L   = '#EEEBF8';
const CORAL      = '#D95F50';
const CORAL_L    = '#FDECEA';
const AMBER      = '#F0A940';
const BODY_BG    = '#F2F5F8';
const TEXT_DARK  = '#1A2E3B';
const TEXT_MUTED = '#8A93A8';

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, color, accent }) {
  const pct = `${Math.min(Math.round((progress ?? 0) * 100), 100)}%`;
  const trackColor = accent ? 'rgba(255,255,255,0.22)' : '#E8EEF2';
  const fillColor  = accent ? 'rgba(255,255,255,0.85)' : color;
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <View style={[styles.progressFill, { width: pct, backgroundColor: fillColor }]} />
    </View>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, iconBg, iconColor,
  badge, badgeColor, badgeBg,
  value, label,
  progressLabel, progressPct, progressColor,
  accent, onPress,
}) {
  const a = !!accent;
  const white = '#FFFFFF';
  const dim   = 'rgba(255,255,255,0.70)';
  return (
    <TouchableOpacity
      style={[styles.statCard, a && { backgroundColor: accent }]}
      onPress={onPress}
      activeOpacity={0.83}
    >
      {/* Icon + badge row */}
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: a ? 'rgba(255,255,255,0.18)' : iconBg }]}>
          <Ionicons name={icon} size={18} color={a ? white : iconColor} />
        </View>
        <View style={[styles.statBadge, { backgroundColor: a ? 'rgba(255,255,255,0.18)' : badgeBg }]}>
          <Text style={[styles.statBadgeTxt, { color: a ? white : badgeColor }]}>{badge}</Text>
        </View>
      </View>

      {/* Big number */}
      <Text style={[styles.statValue, a && { color: white }]}>{value ?? '—'}</Text>
      <Text style={[styles.statLabel, a && { color: dim }]}>{label}</Text>

      {/* Progress */}
      <View style={styles.progressMeta}>
        <Text style={[styles.progressLabel, a && { color: dim }]}>{progressLabel}</Text>
        <Text style={[styles.progressPct, { color: a ? white : progressColor }]}>
          {progressPct}
        </Text>
      </View>
      <ProgressBar progress={(progressPct ?? '0%').replace('%', '') / 100} color={progressColor} accent={a} />
    </TouchableOpacity>
  );
}

// ── Action tile ───────────────────────────────────────────────────────────────
function ActionTile({ icon, iconBg, iconColor, label, sub, onPress }) {
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PrincipalDashboardScreen({ navigation }) {
  const [stats,         setStats]         = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [now,           setNow]           = useState(new Date());

  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const user   = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    try {
      const data = await principalApi.getDashboard();
      setStats(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hour      = now.getHours();
  const greeting  = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = user?.full_name?.split(' ')[0] ?? 'Principal';
  const today     = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const tc          = stats?.teacherCount      ?? 0;
  const sc          = stats?.studentCount      ?? 0;
  const ua          = stats?.unassignedStudents ?? 0;
  const capacity    = tc * 3;
  const assigned    = sc - ua;
  const capPct      = capacity > 0 ? Math.round((sc / capacity) * 100) : 0;
  const assignPct   = sc > 0 ? Math.round((assigned / sc) * 100) : 100;
  const systemOk    = ua === 0;

  const nav = (tab, screen) => () => navigation.getParent()?.navigate(tab, { screen });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />
        }
      >

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
          <View>
            <View style={styles.welcomeBadge}>
              <View style={styles.welcomeDot} />
              <Text style={styles.welcomeText}>Welcome Back</Text>
            </View>
            <Text style={styles.greeting}>{greeting}, {firstName}! 👋</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutVisible(true)} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        {/* ── Today's Overview ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>TODAY'S OVERVIEW</Text>
            </View>
            <TouchableOpacity onPress={nav('Teachers', 'TeacherList')}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardsRow}>
            <StatCard
              icon="school-outline" iconBg={BLUE_L}   iconColor={BLUE}
              badge="Enrolled"      badgeColor={BLUE}  badgeBg={BLUE_L}
              value={sc > 0 ? sc.toLocaleString() : '—'}
              label="Total Students"
              progressLabel="Capacity"
              progressPct={`${capPct}%`}
              progressColor={BLUE}
              onPress={nav('Students', 'StudentList')}
            />
            <StatCard
              icon="people-outline" iconBg={GREEN_L}   iconColor={GREEN}
              badge="Active"        badgeColor={GREEN}  badgeBg={GREEN_L}
              value={tc > 0 ? String(tc) : '—'}
              label="Teaching Staff"
              progressLabel="Utilization"
              progressPct={tc > 0 ? `${capPct}%` : '0%'}
              progressColor={GREEN}
              onPress={nav('Teachers', 'TeacherList')}
            />
            <StatCard
              icon="checkmark-circle-outline" iconBg={PURPLE_L}   iconColor={PURPLE}
              badge={systemOk ? 'Healthy' : 'Review'}
              badgeColor={systemOk ? GREEN : AMBER}
              badgeBg={systemOk ? GREEN_L : '#FDF0D6'}
              value={sc > 0 ? `${assigned}/${sc}` : '—'}
              label="Students Assigned"
              progressLabel="Assignment Rate"
              progressPct={`${assignPct}%`}
              progressColor={PURPLE}
            />
            <StatCard
              icon="alert-circle-outline"
              value={String(ua)}
              label="Need Assignment"
              badge={ua === 0 ? '✓ Good' : '! Urgent'}
              badgeColor={ua === 0 ? GREEN : '#fff'}
              badgeBg={ua === 0 ? GREEN_L : 'rgba(255,255,255,0.18)'}
              progressLabel="Resolved"
              progressPct={`${assignPct}%`}
              progressColor={CORAL}
              accent={ua > 0 ? CORAL : undefined}
              iconBg={ua === 0 ? CORAL_L : undefined}
              iconColor={ua === 0 ? CORAL : undefined}
            />
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
            </View>
          </View>
          <View style={styles.cardsRow}>
            <ActionTile
              icon="person-add-outline" iconBg={BLUE_L}   iconColor={BLUE}
              label="Add Teacher" sub="Onboard new faculty"
              onPress={nav('Teachers', 'CreateTeacher')}
            />
            <ActionTile
              icon="add-circle-outline" iconBg={GREEN_L}   iconColor={GREEN}
              label="Add Student" sub="Enroll & assign"
              onPress={nav('Students', 'CreateStudent')}
            />
            <ActionTile
              icon="people-outline" iconBg="#FDF0D6" iconColor={AMBER}
              label="View Teachers" sub="Manage faculty"
              onPress={nav('Teachers', 'TeacherList')}
            />
            <ActionTile
              icon="school-outline" iconBg={PURPLE_L} iconColor={PURPLE}
              label="View Students" sub="Student registry"
              onPress={nav('Students', 'StudentList')}
            />
          </View>
        </View>

      </ScrollView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        icon="log-out-outline"
        onConfirm={logout}
        onCancel={() => setLogoutVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: BODY_BG },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },

  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  welcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  welcomeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GREEN,
  },
  welcomeText: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: GREEN,
  },
  greeting: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: TEXT_DARK,
    lineHeight: 28,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: TEXT_MUTED,
    marginTop: 2,
  },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F2F5F8',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBar: {
    width: 3, height: 16, borderRadius: 2,
    backgroundColor: GREEN,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 1.2,
  },
  viewAll: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: BLUE,
  },

  // ── Cards row (shared) ────────────────────────────────────────────────────
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },

  // ── Stat card ─────────────────────────────────────────────────────────────
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1A2E3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statBadgeTxt: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Nunito_900Black',
    color: TEXT_DARK,
    lineHeight: 28,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: TEXT_MUTED,
    marginTop: 2,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 5,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    color: TEXT_MUTED,
  },
  progressPct: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  // ── Action tile ───────────────────────────────────────────────────────────
  actionTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    shadowColor: '#1A2E3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: TEXT_DARK,
  },
  actionSub: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: TEXT_MUTED,
  },
});
