import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
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

function KpiTile({ icon, value, label, colors }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kpiTile}>
      <Ionicons
        name={icon}
        size={64}
        color="rgba(255,255,255,0.16)"
        style={styles.kpiWatermark}
      />
      <View style={styles.kpiIconBox}>
        <Ionicons name={icon} size={18} color="#FFF" />
      </View>
      <Text style={styles.kpiValue}>{value ?? '—'}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </LinearGradient>
  );
}

function StudentCard({ student, width, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.studentCard, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={student.fullName}
    >
      <Avatar name={student.fullName} uri={student.profilePhotoUrl} size={52} />
      <Text style={styles.studentName} numberOfLines={1}>{student.fullName}</Text>
    </TouchableOpacity>
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

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActivityRow({ icon, iconColor, iconBg, title, subtitle, time }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.activitySubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  );
}

export default function TeacherDashboardScreen({ navigation }) {
  const [data,          setData]          = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const toast  = useToast();

  // Two student cards per row once there is room; one on a phone.
  const { width } = useWindowDimensions();
  const GRID_GAP     = 12;
  const contentWidth = width - Layout.spacing.lg * 2;
  const twoCol       = contentWidth >= 620;
  const cardW        = twoCol ? (contentWidth - GRID_GAP) / 2 : contentWidth;

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

  const profile            = data?.profile;
  const stats               = data?.stats;
  const proficiency         = data?.proficiency ?? [];
  const recentSessions      = data?.recentSessions ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!data) {
    return (
      <LinearGradient
        colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']}
        style={styles.root}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView style={[styles.safe, styles.loadingCenter]} edges={['top', 'bottom']}>
          <ActivityIndicator color={TEAL} size="large" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
                onPress={() => navigation.getParent()?.navigate('WorkspaceSelect')}
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

          {/* ── KPI tiles ── */}
          <View style={styles.kpiRow}>
            <KpiTile
              icon="people-outline"
              value={stats?.totalStudents ?? '—'}
              label="Students"
              colors={['#4AABB8', '#3A9BA8']}
            />
            <KpiTile
              icon="today-outline"
              value={stats?.weeklySessions ?? '—'}
              label="This Week"
              colors={['#5FCB8C', '#3FAE6F']}
            />
          </View>

          {/* ── Students ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Students</Text>
            {proficiency.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('TeacherStudentList')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionLink}>View all ({proficiency.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          {proficiency.length > 0 ? (
            <View style={styles.studentGrid}>
              {proficiency.map((s) => (
                <StudentCard
                  key={s.studentId}
                  student={s}
                  width={cardW}
                  onPress={() => navigation.navigate('TeacherStudentDetail', {
                    student: { sid: s.studentId, full_name: s.fullName, profile_photo_url: s.profilePhotoUrl },
                  })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={26} color={TEAL} />
              </View>
              <Text style={styles.emptyTitle}>No students yet</Text>
              <Text style={styles.emptySub}>Once students are assigned to you, their progress will show up here.</Text>
            </View>
          )}

          {/* ── Quick actions ── */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsCol}>
            <ActionCard
              icon="people-outline"
              label="My Students"
              sub="View and manage your class"
              color={TEAL}
              bg="#D6F0F4"
              onPress={() => navigation.navigate('TeacherStudentList')}
            />
            <ActionCard
              icon="checkmark-done-outline"
              label="Review Queue"
              sub="Confirm AI scores to improve future accuracy"
              color="#B8860B"
              bg="#FDF3D7"
              onPress={() => navigation.navigate('PronunciationReviewQueue')}
            />
          </View>

          {/* ── Recent activity ── */}
          {recentSessions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <View style={styles.listCard}>
                {recentSessions.map((s, i) => (
                  <ActivityRow
                    key={i}
                    icon={s.isActive ? 'radio-button-on-outline' : 'time-outline'}
                    iconColor={TEAL}
                    iconBg="#D6F0F4"
                    title={`Session with ${s.studentName}`}
                    subtitle={s.isActive ? 'In progress' : 'Completed'}
                    time={timeAgo(s.startedAt)}
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Banner ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.bannerWrap}
            onPress={() => navigation.navigate('TeacherStudentList')}
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
  loadingCenter: { alignItems: 'center', justifyContent: 'center' },
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

  // ── KPI tiles ─────────────────────────────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiTile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiWatermark: {
    position: 'absolute',
    right: -12,
    bottom: -14,
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 26,
    fontFamily: 'Nunito_900Black',
    color: '#FFF',
  },
  kpiLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Student cards ─────────────────────────────────────────────────────────
  studentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  studentName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A3D2E',
  },

  // ── Empty states ──────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D6F0F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: '#1A3D2E',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: '#6B8A80',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#1A3D2E',
    marginTop: 4,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: TEAL,
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

  // ── Activity / achievements lists ────────────────────────────────────────
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  activityIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityText: { flex: 1, gap: 1 },
  activityTitle: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: '#1A3D2E',
  },
  activitySubtitle: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: '#6B8A80',
  },
  activityTime: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: '#9BAFA8',
    flexShrink: 0,
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
