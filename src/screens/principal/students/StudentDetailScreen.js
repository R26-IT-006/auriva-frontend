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
  const [confirmVisible, setConfirmVisible] = useState(false);

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
      (t) => !t.is_first_login && (t.students?.length ?? 0) < 3
    );

    if (availableTeachers.length === 0) {
      Alert.alert('No Available Teachers', 'All teachers are at full capacity (3 students each).');
      return;
    }

    const options = [
      ...availableTeachers.map((t) => ({
        text: `${t.full_name} (${t.students?.length ?? 0}/3)`,
        onPress: () => doAssign(t.tid),
      })),
      ...(student.teacher_id ? [{ text: 'Unassign Teacher', style: 'destructive', onPress: () => doAssign(null) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ];

    Alert.alert('Assign Teacher', 'Select a teacher for this student:', options);
  }

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
  assignCard: { marginBottom: Layout.spacing.md },
  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assignInfo: { flex: 1, marginRight: Layout.spacing.md },
  assignLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 4 },
  assignValue: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  assignLocked: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 8, fontStyle: 'italic' },
  section: { marginBottom: Layout.spacing.md },
  sectionTitle: {
    fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold,
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
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontWeight: Layout.fontWeight.medium },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },
  actions: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.md },
  // Landscape
  landscapeLayout: { flexDirection: 'row', gap: Layout.spacing.md },
  landscapeLeft: { flex: 1 },
  landscapeRight: { flex: 1 },
});
