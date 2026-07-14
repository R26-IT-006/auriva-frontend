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
import { Layout } from '../../constants/layout';
import { teacherApi } from '../../api/teacher';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const TEAL      = '#3A9BA8';
const TEAL_GRAD = ['#4AABB8', '#52C07C'];
const AMBER     = '#F0A940';

function StatCard({ icon, value, label, color, bg }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, label, sub, color, bg, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.actionIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <View style={[styles.actionChevron, { backgroundColor: bg }]}>
        <Ionicons name="chevron-forward" size={16} color={color} />
      </View>
    </TouchableOpacity>
  );
}

export default function TeacherDashboardScreen({ navigation }) {
  const [data,          setData]          = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  const load = useCallback(async () => {
    try {
      const res = await teacherApi.getDashboard();
      setData(res);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const profile = data?.profile;
  const stats   = data?.stats;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const engagementDisplay = stats?.avgEngagement != null
    ? `${Math.round(stats.avgEngagement * 100)}%`
    : null;

  return (
    <LinearGradient
      colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
      style={styles.root}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={TEAL}
            />
          }
        >

          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Text style={styles.topGreeting}>{greeting}</Text>
              <Text style={styles.topName} numberOfLines={1}>
                {profile?.full_name ?? '...'}
              </Text>
            </View>
            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.getParent()?.getParent()?.navigate('WorkspaceSelect')}
                activeOpacity={0.75}
              >
                <Ionicons name="grid-outline" size={20} color="#2A5A48" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setLogoutVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="log-out-outline" size={20} color="#2A5A48" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Profile card ── */}
          <View style={styles.profileCard}>
            <Avatar
              name={profile?.full_name}
              uri={profile?.profile_photo_url}
              size={64}
              style={styles.avatar}
            />
            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{profile?.full_name ?? '...'}</Text>
              <View style={styles.profileCodeRow}>
                <Ionicons name="id-card-outline" size={13} color={TEAL} />
                <Text style={styles.profileCode}>{profile?.teacher_code ?? '—'}</Text>
              </View>
              <View style={styles.profileBadge}>
                <Text style={styles.profileBadgeText}>Teacher</Text>
              </View>
            </View>
          </View>

          {/* ── Stats row — 3 cards ── */}
          <View style={styles.statsRow}>
            <StatCard
              icon="people-outline"
              value={stats?.totalStudents}
              label="Students"
              color={TEAL}
              bg="#D6F0F4"
            />
            <View style={styles.statDivider} />
            <StatCard
              icon="checkmark-circle-outline"
              value={stats?.conceptsMastered}
              label="Mastered"
              color="#52C07C"
              bg="#DCF5E8"
            />
            <View style={styles.statDivider} />
            <StatCard
              icon="pulse-outline"
              value={engagementDisplay}
              label="Engagement"
              color={AMBER}
              bg="#FDF0D6"
            />
          </View>

          {/* ── Quick actions ── */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsCol}>
            <ActionCard
              icon="people-outline"
              label="My Students"
              sub="View and manage your class"
              color={TEAL}
              bg="#D6F0F4"
              onPress={() => navigation.navigate('Students')}
            />
          </View>

          {/* ── Banner ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.bannerWrap}
            onPress={() => navigation.navigate('Students')}
          >
            <LinearGradient
              colors={TEAL_GRAD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.banner}
            >
              <View style={styles.bannerLeft}>
                <Text style={styles.bannerTitle}>Ready to teach?</Text>
                <Text style={styles.bannerSub}>
                  Select a student and start today's learning session.
                </Text>
              </View>
              <View style={styles.bannerIconCircle}>
                <Ionicons name="school-outline" size={30} color="rgba(255,255,255,0.9)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.md,
  },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  topBarLeft: { gap: 1 },
  topGreeting: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: '#4A7A60',
  },
  topName: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    color: '#1A3D2E',
  },
  topBarRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Profile card ──────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: { borderWidth: 3, borderColor: '#D6F0F4' },
  profileMeta: { flex: 1, gap: 4 },
  profileName: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A3D2E',
  },
  profileCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileCode: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    color: TEAL,
  },
  profileBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D6F0F4',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  profileBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: TEAL,
  },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 5 },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Nunito_900Black',
    color: '#1A3D2E',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: '#6B8A80',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8F0EC',
    marginHorizontal: 8,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A3D2E',
    marginTop: 4,
  },

  // ── Quick actions ─────────────────────────────────────────────────────────
  actionsCol: { gap: 10 },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 2 },
  actionLabel: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    color: '#1A3D2E',
  },
  actionSub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: '#6B8A80',
  },
  actionChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Banner ────────────────────────────────────────────────────────────────
  bannerWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  bannerLeft: { flex: 1, gap: 5 },
  bannerTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFF',
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  bannerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
