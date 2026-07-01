import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { formatDate } from '../../../utils/formatters';
import { getAvatarTheme } from '../../../constants/avatarThemes';

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

const GLOBAL_DEFAULT = 55;

function ThresholdCard({ thresholds = {} }) {
  const effectiveDefault = typeof thresholds.default === 'number' ? thresholds.default : GLOBAL_DEFAULT;
  const wasRaised  = effectiveDefault > GLOBAL_DEFAULT;

  const letterOverrides = Object.entries(thresholds)
    .filter(([k]) => k !== 'default')
    .map(([letter, value]) => ({ letter, value }))
    .sort((a, b) => a.letter.localeCompare(b.letter));

  const noChanges = !wasRaised && letterOverrides.length === 0;

  return (
    <Card style={styles.infoCard}>
      <View style={styles.thresholdHeader}>
        <View style={[styles.thresholdIconWrap, wasRaised && styles.thresholdIconRaised]}>
          <Ionicons
            name="stats-chart-outline"
            size={16}
            color={wasRaised ? '#059669' : '#6366F1'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.thresholdScore}>{effectiveDefault} / 100</Text>
          <Text style={styles.thresholdNote}>
            {wasRaised
              ? `Raised from ${GLOBAL_DEFAULT} — student is improving consistently!`
              : 'Using the default writing standard'}
          </Text>
        </View>
        <View style={[styles.thresholdBadge, wasRaised && styles.thresholdBadgeGreen]}>
          <Text style={[styles.thresholdBadgeText, wasRaised && styles.thresholdBadgeTextGreen]}>
            {wasRaised ? '▲ Raised' : 'Default'}
          </Text>
        </View>
      </View>

      {letterOverrides.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.thresholdLetterSection}>
            <Text style={styles.thresholdLetterHeading}>Letters with a lower standard:</Text>
            {letterOverrides.map(({ letter, value }) => (
              <View key={letter} style={styles.thresholdLetterRow}>
                <View style={styles.thresholdLetterBadge}>
                  <Text style={styles.thresholdLetterChar}>{letter.toUpperCase()}</Text>
                </View>
                <Text style={styles.thresholdLetterLabel}>Letter '{letter}'</Text>
                <Text style={styles.thresholdLetterValue}>{value} / 100</Text>
                <Text style={styles.thresholdLetterTag}>↓ adjusted</Text>
              </View>
            ))}
            <Text style={styles.thresholdHint}>
              These letters were automatically adjusted after the student struggled
              with them repeatedly.
            </Text>
          </View>
        </>
      )}

      {noChanges && (
        <>
          <View style={styles.divider} />
          <Text style={styles.thresholdAllGood}>
            No adjustments yet — all letters use the standard setting.
          </Text>
        </>
      )}
    </Card>
  );
}

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student, setStudent] = useState(initialStudent);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { fetch(); }, [fetch]);

  async function handleSessionToggle() {
    setSessionLoading(true);
    try {
      if (hasActiveSession) {
        await teacherApi.endSession(student.sid);
        setHasActiveSession(false);
        Alert.alert('Session Ended', `Session with ${student.full_name} has been recorded.`);
      } else {
        await teacherApi.startSession(student.sid);
        setHasActiveSession(true);
        Alert.alert('Session Started', `Learning session with ${student.full_name} is now active.`);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSessionLoading(false);
    }
  }

  if (!student) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <View style={styles.profileHeader}>
          <Avatar name={student.full_name} uri={student.profile_photo_url} size={84} />
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{student.full_name}</Text>
            <Text style={styles.profileCode}>{student.student_code}</Text>
            <Badge label={student.disability} variant="info" style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Session control */}
        <Card style={[styles.sessionCard, hasActiveSession && styles.sessionCardActive]} padding="md">
          <View style={styles.sessionRow}>
            <View style={styles.sessionInfo}>
              <View style={styles.sessionIndicator}>
                <View style={[styles.dot, hasActiveSession && styles.dotActive]} />
                <Text style={styles.sessionStatus}>
                  {hasActiveSession ? 'Session Active' : 'No Active Session'}
                </Text>
              </View>
              {hasActiveSession && (
                <Text style={styles.sessionHint}>Session is currently in progress</Text>
              )}
            </View>
            <Button
              title={hasActiveSession ? 'End Session' : 'Start Session'}
              variant={hasActiveSession ? 'danger' : 'primary'}
              size="sm"
              onPress={handleSessionToggle}
              loading={sessionLoading}
              icon={
                <Ionicons
                  name={hasActiveSession ? 'stop-circle-outline' : 'play-circle-outline'}
                  size={16}
                  color={hasActiveSession ? Colors.status.error : '#FFF'}
                />
              }
            />
          </View>
        </Card>

        {/* Writing Standard */}
        <Text style={styles.sectionTitle}>Writing Standard</Text>
        <ThresholdCard thresholds={student.personal_thresholds ?? {}} />

        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Student Information</Text>
        <Card style={styles.infoCard}>
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(student.date_of_birth)} />
          <View style={styles.divider} />
          <InfoRow icon="medical-outline" label="Disability" value={student.disability} />
          {student.address && <View style={styles.divider} />}
          <InfoRow icon="home-outline" label="Address" value={student.address} />
        </Card>

        {/* Contact */}
        {(student.father_name || student.mother_name || student.mobile_number || student.home_number) && (
          <>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Card style={styles.infoCard}>
              <InfoRow icon="person-outline" label="Father's Name" value={student.father_name} />
              {student.mother_name && <View style={styles.divider} />}
              <InfoRow icon="person-outline" label="Mother's Name" value={student.mother_name} />
              {student.mobile_number && <View style={styles.divider} />}
              <InfoRow icon="phone-portrait-outline" label="Mobile" value={student.mobile_number} />
              {student.home_number && <View style={styles.divider} />}
              <InfoRow icon="call-outline" label="Home" value={student.home_number} />
            </Card>
          </>
        )}

        {/* ── Learning Reports ───────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Learning Reports</Text>
        <TouchableOpacity
          style={styles.reportCard}
          activeOpacity={0.75}
          onPress={() => {
            const theme = getAvatarTheme(student.avatar_key);
            navigation.navigate('StudentHandwritingReport', { student, theme });
          }}
        >
          <LinearGradient
            colors={['#6366F1', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.reportIconWrap}
          >
            <Ionicons name="document-text" size={22} color="#FFF" />
          </LinearGradient>

          <View style={styles.reportContent}>
            <Text style={styles.reportTitle}>Handwriting Report</Text>
            <Text style={styles.reportDesc}>
              Motor analysis · Letter mastery · AI recommendations
            </Text>
            <View style={styles.reportTagRow}>
              <View style={styles.reportTag}>
                <Ionicons name="analytics-outline" size={10} color="#6366F1" />
                <Text style={styles.reportTagText}>XAI Powered</Text>
              </View>
              <View style={styles.reportTag}>
                <Ionicons name="school-outline" size={10} color="#6366F1" />
                <Text style={styles.reportTagText}>End-of-Day</Text>
              </View>
            </View>
          </View>

          <View style={styles.reportArrow}>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg, marginBottom: Layout.spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Layout.shadow.md,
  },
  profileMeta: { flex: 1, marginLeft: Layout.spacing.lg },
  profileName: { fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.bold, color: Colors.text.primary },
  profileCode: { fontSize: Layout.fontSize.sm, color: Colors.text.link, marginTop: 2 },
  sessionCard: { marginBottom: Layout.spacing.md },
  sessionCardActive: { borderColor: Colors.status.success, borderWidth: 1.5 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionInfo: { flex: 1, marginRight: Layout.spacing.md },
  sessionIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.icon.muted },
  dotActive: { backgroundColor: Colors.status.success },
  sessionStatus: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.semibold, color: Colors.text.primary },
  sessionHint: { fontSize: Layout.fontSize.xs, color: Colors.status.success, marginTop: 4 },
  sectionTitle: { fontSize: Layout.fontSize.md, fontWeight: Layout.fontWeight.bold, color: Colors.text.primary, marginBottom: Layout.spacing.sm, marginTop: Layout.spacing.xs },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md },
  infoIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: Layout.spacing.sm },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontWeight: Layout.fontWeight.medium },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },
  reportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    padding: Layout.spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight,
    gap: Layout.spacing.md,
    ...Layout.shadow.sm,
    marginBottom: Layout.spacing.md,
  },
  reportIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  reportContent: { flex: 1 },
  reportTitle: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  reportDesc: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted, marginTop: 2,
  },
  reportTagRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  reportTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8,
  },
  reportTagText: { fontSize: 10, color: '#6366F1', fontWeight: '700' },
  reportArrow: { paddingLeft: 4 },

  // ── Threshold card ────────────────────────────────────────────────────────
  thresholdHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Layout.spacing.md, gap: Layout.spacing.sm,
  },
  thresholdIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  thresholdIconRaised: { backgroundColor: '#D1FAE5' },
  thresholdScore: {
    fontSize: Layout.fontSize.xl, fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  thresholdNote: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  thresholdBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, backgroundColor: '#EEF2FF',
  },
  thresholdBadgeGreen: { backgroundColor: '#D1FAE5' },
  thresholdBadgeText: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
  thresholdBadgeTextGreen: { color: '#059669' },
  thresholdLetterSection: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.md,
  },
  thresholdLetterHeading: {
    fontSize: Layout.fontSize.xs, color: Colors.text.muted,
    fontWeight: Layout.fontWeight.semibold, marginBottom: Layout.spacing.sm,
  },
  thresholdLetterRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Layout.spacing.sm, marginBottom: Layout.spacing.xs,
  },
  thresholdLetterBadge: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center',
  },
  thresholdLetterChar: { fontSize: 13, fontWeight: '800', color: '#D97706' },
  thresholdLetterLabel: { flex: 1, fontSize: Layout.fontSize.sm, color: Colors.text.primary },
  thresholdLetterValue: {
    fontSize: Layout.fontSize.sm, fontWeight: Layout.fontWeight.bold, color: '#D97706',
  },
  thresholdLetterTag: { fontSize: Layout.fontSize.xs, color: '#D97706' },
  thresholdHint: {
    fontSize: Layout.fontSize.xs, color: Colors.text.muted,
    marginTop: Layout.spacing.sm, fontStyle: 'italic',
  },
  thresholdAllGood: {
    fontSize: Layout.fontSize.xs, color: Colors.text.muted,
    padding: Layout.spacing.md, fontStyle: 'italic',
  },
});
