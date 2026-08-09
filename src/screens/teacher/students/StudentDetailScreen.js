import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { formatDate } from '../../../utils/formatters';

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

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student, setStudent] = useState(initialStudent);
  const [refreshing, setRefreshing] = useState(false);
  const isStudentWorkspaceSession = route.name === "StudentSession";

  const fetch = useCallback(async () => {
    if (!initialStudent?.sid) { setRefreshing(false); return; }
    try {
      const s = await teacherApi.getStudent(initialStudent.sid);
      setStudent(s);
    } catch {
      // Use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent?.sid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (!student) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <View style={styles.profileHeader}>
          <Avatar
            name={student.full_name}
            uri={student.profile_photo_url}
            size={84}
          />
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{student.full_name}</Text>
            <Text style={styles.profileCode}>{student.student_code}</Text>
            <Badge
              label={student.disability}
              variant="info"
              style={{ marginTop: 6 }}
            />
          </View>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Student Information</Text>
        <Card style={styles.infoCard}>
          <InfoRow
            icon="calendar-outline"
            label="Date of Birth"
            value={formatDate(student.date_of_birth)}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="medical-outline"
            label="Disability"
            value={student.disability}
          />
          {student.address && <View style={styles.divider} />}
          <InfoRow
            icon="home-outline"
            label="Address"
            value={student.address}
          />
        </Card>

        {/* Contact */}
        {(student.father_name ||
          student.mother_name ||
          student.mobile_number ||
          student.home_number) && (
          <>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Card style={styles.infoCard}>
              <InfoRow
                icon="person-outline"
                label="Father's Name"
                value={student.father_name}
              />
              {student.mother_name && <View style={styles.divider} />}
              <InfoRow
                icon="person-outline"
                label="Mother's Name"
                value={student.mother_name}
              />
              {student.mobile_number && <View style={styles.divider} />}
              <InfoRow
                icon="phone-portrait-outline"
                label="Mobile"
                value={student.mobile_number}
              />
              {student.home_number && <View style={styles.divider} />}
              <InfoRow
                icon="call-outline"
                label="Home"
                value={student.home_number}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Layout.shadow.md,
  },
  profileMeta: { flex: 1, marginLeft: Layout.spacing.lg },
  profileName: { fontSize: Layout.fontSize.xl, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  profileCode: { fontSize: Layout.fontSize.sm, color: Colors.text.link, marginTop: 2 },
  sectionTitle: { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold', color: Colors.text.primary, marginBottom: Layout.spacing.sm, marginTop: Layout.spacing.xs },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.status.infoLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Layout.spacing.sm,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },
});
