import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
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
import { useToast } from '../../../context/ToastContext';
import { Breadcrumb } from '../../../components/common/Breadcrumb';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={15} color={Colors.icon.active} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

export default function StudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const toast = useToast();
  const [student, setStudent] = useState(initialStudent);
  const [teachers, setTeachers] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmVisible,     setConfirmVisible]     = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [s, ts] = await Promise.all([
        principalApi.getStudent(initialStudent.sid),
        principalApi.getTeachers(),
      ]);
      setStudent(s);
      setTeachers(ts);
    } catch {
      // Use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent.sid]);

  useEffect(() => {
    fetch();
    // Refresh when screen regains focus (e.g., after editing)
    const unsubscribe = navigation.addListener('focus', fetch);
    return unsubscribe;
  }, [fetch, navigation]);

  function handleAssign() {
    const availableTeachers = teachers.filter(
      (t) => (t.students?.length ?? 0) < 3
    );

    if (availableTeachers.length === 0) {
      Alert.alert('No Available Teachers', 'All teachers are at full capacity (3 students each).');
      return;
    }

    setAssignModalVisible(true);
  }

  const availableTeachers = teachers.filter((t) => (t.students?.length ?? 0) < 3);

  async function doAssign(teacherId) {
    setAssigning(true);
    try {
      const updated = await principalApi.assignStudent(student.sid, teacherId);
      setStudent(updated);
      toast.show(teacherId ? 'Student assigned successfully!' : 'Student unassigned.');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  }

  function handleDelete() {
    setConfirmVisible(true);
  }

  async function confirmDelete() {
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await principalApi.deleteStudent(student.sid);
      navigation.popToTop();
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
    }
  }

  if (!student) return null;

  const profileSection = (
    <View style={[styles.profileHeader, isLandscape && styles.profileHeaderLandscape]}>
      <Avatar name={student.full_name} uri={student.profile_photo_url} size={isLandscape ? 72 : 84} />
      <View style={styles.profileMeta}>
        <Text style={styles.profileName}>{student.full_name}</Text>
        <Text style={styles.profileCode}>{student.student_code}</Text>
        <Badge label={student.disability} variant="info" style={{ marginTop: 6 }} />
      </View>
    </View>
  );

  const assignCard = (
    <Card style={styles.assignCard} padding="md">
      <View style={styles.assignRow}>
        <View style={styles.assignInfo}>
          <Text style={styles.assignLabel}>Assigned Teacher</Text>
          {student.teacher ? (
            <Text style={styles.assignValue}>{student.teacher.full_name}</Text>
          ) : (
            <Text style={[styles.assignValue, { color: Colors.text.muted }]}>Unassigned</Text>
          )}
        </View>
        <Button
          title={student.teacher_id ? 'Assigned' : 'Assign'}
          size="sm"
          variant="outline"
          onPress={handleAssign}
          loading={assigning}
          disabled={!!student.teacher_id}
        />
      </View>
      {student.teacher_id && (
        <Text style={styles.assignLocked}>
          Once assigned, a student cannot be reallocated to another teacher.
        </Text>
      )}
    </Card>
  );

  const personalSection = (
    <Section title="Personal Information">
      <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(student.date_of_birth)} />
      <View style={styles.divider} />
      <InfoRow icon="medical-outline" label="Disability" value={student.disability} />
      {student.address && <View style={styles.divider} />}
      <InfoRow icon="home-outline" label="Address" value={student.address} />
      {student.marital_status && <View style={styles.divider} />}
      <InfoRow icon="heart-outline" label="Marital Status" value={student.marital_status} />
    </Section>
  );

  const contactSection = (
    <Section title="Contact Information">
      <InfoRow icon="person-outline" label="Father's Name" value={student.father_name} />
      {student.mother_name && <View style={styles.divider} />}
      <InfoRow icon="person-outline" label="Mother's Name" value={student.mother_name} />
      {student.mobile_number && <View style={styles.divider} />}
      <InfoRow icon="phone-portrait-outline" label="Mobile" value={student.mobile_number} />
      {student.home_number && <View style={styles.divider} />}
      <InfoRow icon="call-outline" label="Home" value={student.home_number} />
    </Section>
  );

  const actionsSection = (
    <View style={styles.actions}>
      <Button
        title="Edit"
        variant="outline"
        icon={<Ionicons name="create-outline" size={16} color={Colors.primary} />}
        onPress={() => navigation.navigate('EditStudent', { student })}
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
      <Breadcrumb
        crumbs={[
          { label: 'Students', onPress: () => navigation.goBack() },
          { label: student.full_name },
        ]}
        title={student.full_name}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, isLandscape && styles.scrollLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {isLandscape ? (
          <View style={styles.landscapeLayout}>
            <View style={styles.landscapeLeft}>
              {profileSection}
              {assignCard}
              {actionsSection}
            </View>
            <View style={styles.landscapeRight}>
              {personalSection}
              {contactSection}
            </View>
          </View>
        ) : (
          <>
            {profileSection}
            {assignCard}
            {personalSection}
            {contactSection}
            {actionsSection}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Student"
        message={`Are you sure you want to delete ${student.full_name}? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* Teacher picker modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAssignModalVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Teacher</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Select a teacher for {student.full_name}</Text>

            <FlatList
              data={availableTeachers}
              keyExtractor={(t) => String(t.tid)}
              style={styles.teacherList}
              ItemSeparatorComponent={() => <View style={styles.teacherDivider} />}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={styles.teacherRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setAssignModalVisible(false);
                    doAssign(t.tid);
                  }}
                >
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherAvatarText}>
                      {t.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.teacherInfo}>
                    <Text style={styles.teacherName}>{t.full_name}</Text>
                    <Text style={styles.teacherMeta}>{t.teacher_code}</Text>
                  </View>
                  <View style={styles.slotBadge}>
                    <Text style={styles.slotText}>{t.students?.length ?? 0}/3</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No teachers with available slots.</Text>
              }
            />

            {student.teacher_id && (
              <>
                <View style={styles.teacherDivider} />
                <TouchableOpacity
                  style={styles.unassignRow}
                  onPress={() => {
                    setAssignModalVisible(false);
                    doAssign(null);
                  }}
                >
                  <Ionicons name="person-remove-outline" size={18} color={Colors.status.error} />
                  <Text style={styles.unassignText}>Unassign Teacher</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  profileName: { fontSize: Layout.fontSize.xl, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  profileCode: { fontSize: Layout.fontSize.sm, color: Colors.text.link, marginTop: 2 },
  assignCard: { marginBottom: Layout.spacing.md },
  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assignInfo: { flex: 1, marginRight: Layout.spacing.md },
  assignLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 4 },
  assignValue: { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_600SemiBold', color: Colors.text.primary },
  assignLocked: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 8, fontStyle: 'italic' },
  section: { marginBottom: Layout.spacing.md },
  sectionTitle: {
    fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary, marginBottom: Layout.spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md },
  infoIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Layout.spacing.sm,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },
  actions: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.md },
  // Landscape
  landscapeLayout: { flexDirection: 'row', gap: Layout.spacing.md },
  landscapeLeft: { flex: 1 },
  landscapeRight: { flex: 1 },
  // Teacher picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.radius.xl,
    borderTopRightRadius: Layout.radius.xl,
    paddingTop: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.lg,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
    paddingHorizontal: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
  },
  teacherList: {
    flexGrow: 0,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  teacherAvatarText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.primary,
  },
  teacherInfo: { flex: 1 },
  teacherName: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.text.primary,
  },
  teacherMeta: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: 2,
  },
  slotBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  slotText: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
    color: Colors.primary,
  },
  teacherDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Layout.spacing.lg,
  },
  unassignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  unassignText: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.status.error,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.text.muted,
    padding: Layout.spacing.lg,
    fontSize: Layout.fontSize.sm,
  },
});
