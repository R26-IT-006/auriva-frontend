import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../../components/common/Avatar";
import { Badge } from "../../../components/common/Badge";
import { Card } from "../../../components/common/Card";
import { Button } from "../../../components/common/Button";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { teacherApi } from "../../../api/teacher";
import { formatDate } from "../../../utils/formatters";

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
    try {
      const s = await teacherApi.getStudent(initialStudent.sid);
      setStudent(s);
    } catch {
      // Use cached
    } finally {
      setRefreshing(false);
    }
  }, [initialStudent.sid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  function handleStartSession() {
    navigation.navigate("PronunciationSessionSetup", { student });
  }

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

        {/* Session control / progress */}
        <Card style={styles.sessionCard} padding="md">
          {isStudentWorkspaceSession ? (
            <View style={styles.sessionRow}>
              <View style={styles.sessionInfo}>
                <View style={styles.sessionIndicator}>
                  <View style={[styles.dot, styles.dotReady]} />
                  <Text style={styles.sessionStatus}>Ready to Start</Text>
                </View>
                <Text style={styles.sessionHint}>
                  Open Pronunciation Support Module setup
                </Text>
              </View>
              <Button
                title="Start Session"
                variant="primary"
                size="sm"
                onPress={handleStartSession}
                icon={
                  <Ionicons name="play-circle-outline" size={16} color="#FFF" />
                }
              />
            </View>
          ) : (
            <View style={styles.progressBlock}>
              <Text style={styles.progressTitle}>Session Progress</Text>
              <Text style={styles.progressHint}>
                Completed words for this student will appear here.
              </Text>
            </View>
          )}
        </Card>

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
  profileName: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  profileCode: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    marginTop: 2,
  },
  sessionCard: { marginBottom: Layout.spacing.md },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionInfo: { flex: 1, marginRight: Layout.spacing.md },
  sessionIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.icon.muted,
  },
  dotReady: { backgroundColor: Colors.primary },
  sessionStatus: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.primary,
  },
  sessionHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  progressBlock: {
    minHeight: 54,
    justifyContent: "center",
  },
  progressTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  progressHint: {
    marginTop: 6,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
  },
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
  infoLabel: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.medium,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },
});
