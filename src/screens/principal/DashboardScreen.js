import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../../components/common/Card';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { principalApi } from '../../api/principal';
import { useAuthStore } from '../../store/authStore';

function StatCard({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.statCardWrapper}>
      <Card style={styles.statCard} padding="md">
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </TouchableOpacity>
  );
}

function ActionCard({ icon, label, iconBg, iconColor, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PrincipalDashboardScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const fetchStats = useCallback(async () => {
    try {
      const data = await principalApi.getDashboard();
      setStats(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  function onRefresh() {
    setRefreshing(true);
    fetchStats();
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  const actions = [
    {
      icon: 'person-add-outline', label: 'Add Teacher',
      iconBg: Colors.status.infoLight, iconColor: Colors.primary,
      onPress: () => navigation.navigate('Teachers', { screen: 'CreateTeacher' }),
    },
    {
      icon: 'add-circle-outline', label: 'Add Student',
      iconBg: '#FFF3F0', iconColor: '#F4845F',
      onPress: () => navigation.navigate('Students', { screen: 'CreateStudent' }),
    },
    {
      icon: 'list-outline', label: 'All Teachers',
      iconBg: Colors.status.successLight, iconColor: Colors.status.success,
      onPress: () => navigation.navigate('Teachers', { screen: 'TeacherList' }),
    },
    {
      icon: 'school-outline', label: 'All Students',
      iconBg: Colors.status.warningLight, iconColor: Colors.status.warning,
      onPress: () => navigation.navigate('Students', { screen: 'StudentList' }),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#1A1A2E', '#2D2B6B']} style={[styles.header, isLandscape && styles.headerLandscape]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.role}>Principal</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF80" />
          </TouchableOpacity>
        </View>
        {!isLandscape && (
          <View style={styles.headerLogoRow}>
            <View style={styles.headerLogo}>
              <Ionicons name="flash" size={18} color="#FFF" />
            </View>
            <Text style={styles.appName}>Auriva Dashboard</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isLandscape ? (
          // Landscape: side-by-side stats and actions
          <View style={styles.landscapeLayout}>
            <View style={styles.landscapeStats}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsColumn}>
                <StatCard icon="people-outline" label="Teachers" value={stats?.teacherCount} color={Colors.primary} onPress={() => navigation.navigate('Teachers')} />
                <StatCard icon="person-outline" label="Students" value={stats?.studentCount} color="#F4845F" onPress={() => navigation.navigate('Students')} />
                <StatCard icon="radio-button-on-outline" label="Active Sessions" value={stats?.activeSessionCount} color={Colors.status.success} />
              </View>
            </View>
            <View style={styles.landscapeActions}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGridLandscape}>
                {actions.map((a) => (
                  <ActionCard key={a.label} {...a} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          // Portrait: stacked layout
          <>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="people-outline" label="Teachers" value={stats?.teacherCount} color={Colors.primary} onPress={() => navigation.navigate('Teachers')} />
              <StatCard icon="person-outline" label="Students" value={stats?.studentCount} color="#F4845F" onPress={() => navigation.navigate('Students')} />
              <StatCard icon="radio-button-on-outline" label="Active Sessions" value={stats?.activeSessionCount} color={Colors.status.success} />
            </View>

            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {actions.map((a) => (
                <ActionCard key={a.label} {...a} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
  },
  headerLandscape: {
    paddingBottom: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Layout.spacing.sm,
  },
  greeting: { fontSize: Layout.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '400' },
  role: { fontSize: Layout.fontSize.xl, color: '#FFFFFF', fontWeight: Layout.fontWeight.bold },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerLogoRow: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: Layout.spacing.xs,
  },
  appName: { fontSize: Layout.fontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: Layout.fontWeight.medium },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  scrollLandscape: { padding: Layout.spacing.md, paddingBottom: Layout.spacing.xl },
  sectionTitle: {
    fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary, marginBottom: Layout.spacing.md,
    marginTop: Layout.spacing.sm,
  },
  // Portrait
  statsGrid: { flexDirection: 'row', gap: Layout.spacing.sm, marginBottom: Layout.spacing.lg },
  statCardWrapper: { flex: 1 },
  statCard: { alignItems: 'center' },
  statIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  statValue: { fontSize: Layout.fontSize.xxl, fontWeight: Layout.fontWeight.extrabold, color: Colors.text.primary },
  statLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 2, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm },
  actionCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  actionIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.sm,
  },
  actionLabel: {
    fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary, textAlign: 'center',
  },
  // Landscape
  landscapeLayout: { flexDirection: 'row', gap: Layout.spacing.lg },
  landscapeStats: { flex: 1 },
  statsColumn: { gap: Layout.spacing.sm },
  landscapeActions: { flex: 1.5 },
  actionsGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
  },
});
