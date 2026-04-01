import React, { useEffect, useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/common/Avatar';
import { Card } from '../../components/common/Card';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { teacherApi } from '../../api/teacher';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/formatters';

function StatPill({ icon, value, label, color }) {
  return (
    <View style={[styles.statPill, { borderLeftColor: color }]}>
      <View style={[styles.statPillIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statPillValue}>{value ?? '—'}</Text>
        <Text style={styles.statPillLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function TeacherDashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const fetch = useCallback(async () => {
    try {
      const res = await teacherApi.getDashboard();
      setData(res);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  const profile = data?.profile;
  const stats = data?.stats;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={Colors.primaryGradient} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Avatar
              name={profile?.full_name}
              uri={profile?.profile_photo_url}
              size={52}
              style={styles.headerAvatar}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerGreeting}>Welcome back,</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {profile?.full_name ?? '...'}
              </Text>
              <Text style={styles.headerCode}>{profile?.teacher_code}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Text style={styles.sectionTitle}>Session Statistics</Text>
        <View style={styles.statsRow}>
          <StatPill
            icon="layers-outline"
            value={stats?.totalSessions}
            label="Total Sessions"
            color={Colors.primary}
          />
          <StatPill
            icon="today-outline"
            value={stats?.weeklySessions}
            label="This Week"
            color={Colors.status.success}
          />
        </View>

        {/* Last session */}
        {stats?.lastSession && (
          <>
            <Text style={styles.sectionTitle}>Last Session</Text>
            <Card style={styles.lastSessionCard} padding="md">
              <View style={styles.lastSessionRow}>
                <View style={[styles.sessionIcon, { backgroundColor: Colors.status.infoLight }]}>
                  <Ionicons name="time-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.lastSessionInfo}>
                  <Text style={styles.lastSessionStudent}>{stats.lastSession.studentName}</Text>
                  <Text style={styles.lastSessionCode}>{stats.lastSession.studentCode}</Text>
                  <Text style={styles.lastSessionDate}>{formatDateTime(stats.lastSession.date)}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Students')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.status.infoLight }]}>
              <Ionicons name="people-outline" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>My Students</Text>
            <Text style={styles.actionSub}>View assigned students</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Students')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.status.successLight }]}>
              <Ionicons name="play-circle-outline" size={26} color={Colors.status.success} />
            </View>
            <Text style={styles.actionLabel}>Start Session</Text>
            <Text style={styles.actionSub}>Begin a learning session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Layout.spacing.lg, paddingTop: Layout.spacing.md, paddingBottom: Layout.spacing.xl },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  headerText: { marginLeft: Layout.spacing.md, flex: 1 },
  headerGreeting: { fontSize: Layout.fontSize.xs, color: 'rgba(255,255,255,0.75)' },
  headerName: { fontSize: Layout.fontSize.lg, fontWeight: Layout.fontWeight.bold, color: '#FFF' },
  headerCode: { fontSize: Layout.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  logoutBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  sectionTitle: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold, color: Colors.text.primary, marginBottom: Layout.spacing.sm, marginTop: Layout.spacing.xs },
  statsRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginBottom: Layout.spacing.lg },
  statPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Layout.radius.lg, padding: Layout.spacing.md,
    borderLeftWidth: 4, borderWidth: 1, borderColor: Colors.borderLight, ...Layout.shadow.sm,
  },
  statPillIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statPillValue: { fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.extrabold, color: Colors.text.primary },
  statPillLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  lastSessionCard: { marginBottom: Layout.spacing.lg },
  lastSessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: Layout.spacing.md },
  lastSessionInfo: { flex: 1 },
  lastSessionStudent: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  lastSessionCode: { fontSize: Layout.fontSize.xs, color: Colors.text.link, marginTop: 2 },
  lastSessionDate: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 4 },
  actionsGrid: { flexDirection: 'row', gap: Layout.spacing.sm },
  actionCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Layout.radius.lg, padding: Layout.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, ...Layout.shadow.sm },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Layout.spacing.sm },
  actionLabel: { fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary, textAlign: 'center' },
  actionSub: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, textAlign: 'center', marginTop: 2 },
});
