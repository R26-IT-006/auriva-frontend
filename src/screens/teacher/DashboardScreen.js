import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/common/Avatar';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { teacherApi } from '../../api/teacher';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/formatters';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, bg }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Quick-action card ─────────────────────────────────────────────────────────
function ActionCard({ icon, label, sub, color, bg, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TeacherDashboardScreen({ navigation }) {
  const [data,       setData]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  const fetch = useCallback(async () => {
    try {
      const res = await teacherApi.getDashboard();
      setData(res);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const profile = data?.profile;
  const stats   = data?.stats;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <LinearGradient colors={['#3D3A8C', '#5B56C0']} style={styles.header}>

        {/* Top row: avatar + name + buttons */}
        <View style={styles.headerTop}>
          <Avatar
            name={profile?.full_name}
            uri={profile?.profile_photo_url}
            size={54}
            style={styles.avatar}
          />
          <View style={styles.headerMeta}>
            <Text style={styles.headerGreeting}>Good day,</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {profile?.full_name ?? '...'}
            </Text>
            <Text style={styles.headerCode}>{profile?.teacher_code}</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.getParent()?.getParent()?.navigate('WorkspaceSelect')}
              activeOpacity={0.75}
            >
              <Ionicons name="grid-outline" size={19} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setLogoutVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stat cards sit inside the header banner */}
        <View style={styles.statsRow}>
          <StatCard
            icon="layers-outline"
            value={stats?.totalSessions}
            label="Total Sessions"
            color="#7B9EF0"
            bg="rgba(123,158,240,0.15)"
          />
          <View style={styles.statDivider} />
          <StatCard
            icon="today-outline"
            value={stats?.weeklySessions}
            label="This Week"
            color="#6DD5A0"
            bg="rgba(109,213,160,0.15)"
          />
        </View>
      </LinearGradient>

      {/* ── Body ───────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Last session */}
        {stats?.lastSession && (
          <>
            <Text style={styles.sectionTitle}>Last Session</Text>
            <View style={styles.lastSessionCard}>
              <View style={styles.lastSessionIconWrap}>
                <Ionicons name="time-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.lastSessionBody}>
                <Text style={styles.lastSessionName}>{stats.lastSession.studentName}</Text>
                <Text style={styles.lastSessionCode}>{stats.lastSession.studentCode}</Text>
                <Text style={styles.lastSessionDate}>{formatDateTime(stats.lastSession.date)}</Text>
              </View>
              <View style={styles.lastSessionBadge}>
                <Text style={styles.lastSessionBadgeText}>Completed</Text>
              </View>
            </View>
          </>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="people-outline"
            label="My Students"
            sub="View your class"
            color={Colors.primary}
            bg={Colors.status.infoLight}
            onPress={() => navigation.navigate('Students')}
          />
          <ActionCard
            icon="play-circle-outline"
            label="Start Session"
            sub="Begin learning"
            color={Colors.status.success}
            bg={Colors.status.successLight}
            onPress={() => navigation.navigate('Students')}
          />
        </View>

        {/* Overview banner */}
        <View style={styles.overviewBanner}>
          <LinearGradient
            colors={['#4B47A8', '#6B67C8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.overviewGradient}
          >
            <View style={styles.overviewLeft}>
              <Text style={styles.overviewTitle}>Ready to teach?</Text>
              <Text style={styles.overviewSub}>
                Your students are waiting. Start a new session from My Students.
              </Text>
            </View>
            <View style={styles.overviewIconWrap}>
              <Ionicons name="school-outline" size={40} color="rgba(255,255,255,0.25)" />
            </View>
          </LinearGradient>
        </View>

      </ScrollView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to end your session?"
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
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.md,
  },
  avatar: {
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerMeta: { flex: 1 },
  headerGreeting: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  headerName: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
    color: '#FFF',
    marginTop: 1,
  },
  headerCode: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Stat cards (inside header) ───────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 3,
    paddingTop: Layout.spacing.sm,
  },
  statIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: Layout.fontSize.xxl,
    fontWeight: Layout.fontWeight.extrabold,
    color: '#FFF',
  },
  statLabel: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: Layout.fontWeight.medium,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
    marginHorizontal: Layout.spacing.md,
  },

  // ── Body scroll ─────────────────────────────────────────────────────────────
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    marginTop: Layout.spacing.xs,
  },

  // ── Last session ─────────────────────────────────────────────────────────────
  lastSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Layout.spacing.md,
    ...Layout.shadow.sm,
  },
  lastSessionIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  lastSessionBody: { flex: 1 },
  lastSessionName: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
  },
  lastSessionCode: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.link,
    marginTop: 2,
  },
  lastSessionDate: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: 3,
  },
  lastSessionBadge: {
    backgroundColor: Colors.status.successLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lastSessionBadgeText: {
    fontSize: 10,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.status.success,
  },

  // ── Quick actions ────────────────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
    ...Layout.shadow.sm,
  },
  actionIconBox: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  actionSub: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
  },

  // ── Overview banner ──────────────────────────────────────────────────────────
  overviewBanner: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    ...Layout.shadow.sm,
    marginTop: Layout.spacing.xs,
  },
  overviewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.lg,
  },
  overviewLeft: { flex: 1, gap: 6 },
  overviewTitle: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.extrabold,
    color: '#FFF',
  },
  overviewSub: {
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 19,
  },
  overviewIconWrap: {
    marginLeft: Layout.spacing.md,
  },
});
