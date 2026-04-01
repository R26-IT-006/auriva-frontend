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
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { principalApi } from '../../../api/principal';
import { formatDate } from '../../../utils/formatters';

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={Colors.icon.active} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function TeacherDetailScreen({ route, navigation }) {
  const initialTeacher = route.params?.teacher;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [teacher, setTeacher] = useState(initialTeacher);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await principalApi.getTeacher(initialTeacher.tid);
      setTeacher(data);
    } catch {
      // Use cached data
    } finally {
      setRefreshing(false);
    }
  }, [initialTeacher.tid]);

  useEffect(() => {
    fetch();
    // Refresh when screen regains focus (e.g., after editing)
    const unsubscribe = navigation.addListener('focus', fetch);
    return unsubscribe;
  }, [fetch, navigation]);

  function handleDelete() {
    Alert.alert(
      'Delete Teacher',
      `Are you sure you want to delete ${teacher.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await principalApi.deleteTeacher(teacher.tid);
              navigation.popToTop();
            } catch (err) {
              Alert.alert('Error', err.message);
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  if (!teacher) return null;

  const profileSection = (
    <View style={[styles.profileHeader, isLandscape && styles.profileHeaderLandscape]}>
      <Avatar name={teacher.full_name} uri={teacher.profile_photo_url} size={isLandscape ? 72 : 84} />
      <View style={styles.profileMeta}>
        <Text style={styles.profileName}>{teacher.full_name}</Text>
        <Text style={styles.profileCode}>{teacher.teacher_code}</Text>
        <Badge
          label={teacher.is_first_login ? 'Pending Setup' : 'Active'}
          variant={teacher.is_first_login ? 'warning' : 'success'}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );

  const infoSection = (
    <Card style={styles.infoCard}>
      <InfoRow icon="mail-outline" label="Email" value={teacher.email} />
      <View style={styles.divider} />
      <InfoRow icon="calendar-outline" label="Joined" value={formatDate(teacher.created_at)} />
      <View style={styles.divider} />
      <InfoRow
        icon="shield-checkmark-outline"
        label="Account Status"
        value={teacher.is_first_login ? 'Awaiting password setup' : 'Fully active'}
      />
    </Card>
  );

  const studentsSection = (
    <>
      <Text style={styles.sectionTitle}>
        Assigned Students ({teacher.students?.length ?? 0}/3)
      </Text>
      {teacher.students?.length > 0 ? (
        teacher.students.map((s) => (
          <Card key={s.sid} style={styles.studentRow} padding="md">
            <View style={styles.studentRowInner}>
              <Avatar name={s.full_name} size={36} />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{s.full_name}</Text>
                <Text style={styles.studentCode}>{s.student_code}</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyStudents} padding="md">
          <Text style={styles.emptyStudentsText}>No students assigned yet</Text>
        </Card>
      )}
    </>
  );

  const actionsSection = (
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
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {isLandscape ? (
          <View style={styles.landscapeLayout}>
            <View style={styles.landscapeLeft}>
              {profileSection}
              {infoSection}
              {actionsSection}
            </View>
            <View style={styles.landscapeRight}>
              {studentsSection}
            </View>
          </View>
        ) : (
          <>
            {profileSection}
            {infoSection}
            {studentsSection}
            {actionsSection}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  scrollLandscape: { padding: Layout.spacing.md, paddingBottom: Layout.spacing.xl },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  profileHeaderLandscape: { padding: Layout.spacing.md },
  profileMeta: { flex: 1, marginLeft: Layout.spacing.lg },
  profileName: { fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.bold, color: Colors.text.primary },
  profileCode: { fontSize: Layout.fontSize.sm, color: Colors.text.link, marginTop: 2 },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm },
  infoIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.md, color: Colors.text.primary, fontWeight: Layout.fontWeight.medium },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 48 },
  sectionTitle: {
    fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary, marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
  },
  studentRow: { marginBottom: Layout.spacing.sm },
  studentRowInner: { flexDirection: 'row', alignItems: 'center' },
  studentInfo: { marginLeft: Layout.spacing.sm },
  studentName: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  studentCode: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  emptyStudents: { alignItems: 'center', marginBottom: Layout.spacing.md },
  emptyStudentsText: { fontSize: Layout.fontSize.sm, color: Colors.text.muted },
  actions: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.lg },
  // Landscape
  landscapeLayout: { flexDirection: 'row', gap: Layout.spacing.md },
  landscapeLeft: { flex: 1 },
  landscapeRight: { flex: 1 },
});
