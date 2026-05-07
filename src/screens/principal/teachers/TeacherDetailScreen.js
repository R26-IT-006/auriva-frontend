import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Button } from '../../../components/common/Button';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';
import { formatDate } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { Breadcrumb } from '../../../components/common/Breadcrumb';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';

const K = {
  purple:      '#7C6FCD',
  purpleLight: '#EFEDF8',
  purpleDark:  '#5A4FB0',
  teal:        '#4AADA3',
  tealLight:   '#E8F6F5',
  amber:       '#C9973A',
  amberLight:  '#FBF4E6',
  green:       '#5BAF85',
  greenLight:  '#EAF6F1',
  bg:          '#F2F1F8',
};

export default function TeacherDetailScreen({ route, navigation }) {
  const initialTeacher = route.params?.teacher;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const toast = useToast();
  const [teacher, setTeacher]         = useState(initialTeacher);
  const [deleting, setDeleting]       = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await principalApi.getTeacher(initialTeacher.tid);
      setTeacher(data);
    } catch {
      // use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialTeacher.tid]);

  useEffect(() => {
    fetch();
    const unsub = navigation.addListener('focus', fetch);
    return unsub;
  }, [fetch, navigation]);

  function handleDelete() {
    setConfirmVisible(true);
  }

  async function confirmDelete() {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await principalApi.deleteTeacher(teacher.tid);
      navigation.popToTop();
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
    }
  }

  if (!teacher) return null;

  const isActive     = !teacher.is_first_login;
  const studentCount = teacher.students?.length ?? 0;
  const capacityPct  = (studentCount / 3) * 100;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Breadcrumb
        crumbs={[
          { label: 'Teachers', onPress: () => navigation.goBack() },
          { label: teacher.full_name },
        ]}
        title={teacher.full_name}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetch(); }}
            tintColor={K.purple}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Header ─────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          {/* Avatar with status badge */}
          <View style={styles.avatarWrap}>
            <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={isLandscape ? 72 : 84} />
            <View style={[styles.activeBadge, { backgroundColor: isActive ? K.green : K.amber }]}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>{isActive ? 'Active' : 'Pending'}</Text>
            </View>
          </View>

          {/* Name + code + capacity */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{teacher.full_name}</Text>
            <Text style={styles.profileCode}>{teacher.teacher_code}</Text>

            <View style={styles.capacityRow}>
              <Text style={styles.capacityLabel}>Class Capacity</Text>
              <Text style={[styles.capacityCount, { color: K.purple }]}>
                Students {studentCount}/3
              </Text>
            </View>
            <View style={styles.capacityTrack}>
              <View style={[styles.capacityFill, { width: `${capacityPct}%` }]} />
            </View>
          </View>
        </View>

        {/* ── Account Details ───────────────────────────────────── */}
        <View>
          <View style={[styles.card, styles.accountCard]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: K.purpleLight }]}>
                <Ionicons name="calendar-outline" size={14} color={K.purple} />
              </View>
              <Text style={styles.cardTitle}>Account Details</Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: '#EDE9FF' }]}>
                <Ionicons name="mail-outline" size={14} color={K.purple} />
              </View>
              <View>
                <Text style={styles.infoLabel}>EMAIL ADDRESS</Text>
                <Text style={styles.infoValue}>{teacher.email}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: K.tealLight }]}>
                <Ionicons name="calendar-outline" size={14} color={K.teal} />
              </View>
              <View>
                <Text style={styles.infoLabel}>JOINED DATE</Text>
                <Text style={styles.infoValue}>{formatDate(teacher.created_at)}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: K.amberLight }]}>
                <Ionicons name="shield-checkmark-outline" size={14} color={K.amber} />
              </View>
              <View>
                <Text style={styles.infoLabel}>ACCOUNT STATUS</Text>
                <Text style={styles.infoValue}>{isActive ? 'Fully active' : 'Awaiting setup'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Assigned Students ─────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Students</Text>
            <View style={styles.cohortBadge}>
              <Text style={styles.cohortBadgeText}>Primary Cohort</Text>
            </View>
          </View>

          {studentCount > 0 ? (
            <View style={styles.studentsList}>
              {teacher.students.map((s) => (
                <View key={s.sid} style={styles.studentRow}>
                  <Avatar name={s.full_name} size={42} />
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{s.full_name}</Text>
                    <View style={styles.studentMeta}>
                      <Text style={styles.studentCode}>{s.student_code}</Text>
                      <Text style={styles.studentDot}> · </Text>
                      <Text style={styles.studentStatus}>IN CLASS</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.icon.muted} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStudents}>
              <Text style={{ fontSize: 28 }}>🎒</Text>
              <Text style={styles.emptyText}>No students assigned yet</Text>
            </View>
          )}
        </View>

        {/* ── Actions ───────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Button
            title="Edit Teacher"
            variant="outline"
            icon={<Ionicons name="create-outline" size={16} color={Colors.primary} />}
            onPress={() => navigation.navigate('EditTeacher', { teacher })}
            style={{ flex: 1 }}
          />
          <Button
            title="Delete"
            variant="danger"
            icon={<Ionicons name="trash-outline" size={16} color={Colors.status.error} />}
            onPress={handleDelete}
            loading={deleting}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${teacher.full_name}? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: K.bg },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl, gap: Layout.spacing.lg },

  // Profile header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  activeBadge: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: [{ translateX: -26 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  activeDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  activeBadgeText: {
    fontSize: 9,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.text.primary,
  },
  profileCode: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Layout.spacing.sm,
  },
  capacityLabel: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
  },
  capacityCount: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
  },
  capacityTrack: {
    height: 7,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  capacityFill: {
    height: '100%',
    backgroundColor: K.purple,
    borderRadius: 4,
  },

  // Card base
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },

  // Account details card
  accountCard: {
    gap: Layout.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.xs,
    marginBottom: Layout.spacing.xs,
  },
  cardHeaderIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: 9,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.text.primary,
    marginTop: 1,
  },

  // Students section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.sm,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.text.primary,
  },
  cohortBadge: {
    backgroundColor: K.purpleLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cohortBadgeText: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
    color: K.purple,
  },
  studentsList: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Layout.shadow.sm,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    gap: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  studentInfo: { flex: 1 },
  studentName: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  studentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  studentCode: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
  },
  studentDot: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
  },
  studentStatus: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
    color: K.teal,
  },
  emptyStudents: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Layout.spacing.lg,
    alignItems: 'center',
    gap: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
  },
});
