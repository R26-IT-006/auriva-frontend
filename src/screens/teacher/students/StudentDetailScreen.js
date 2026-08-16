import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
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

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={13} color={Colors.text.link} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// Only Pronunciation reports live progress today; the rest render an
// unavailable panel until those modules ship, so the selector stays honest
// about coverage.
const MODULES = [
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'dialogue',      tab: 'Dialogue',      title: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

/** Whole years between a date of birth and today; null when unparseable. */
function ageFrom(dateStr) {
  if (!dateStr) return null;
  const dob = new Date(dateStr);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student, setStudent] = useState(initialStudent);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModule, setActiveModule] = useState('pronunciation');
  const isStudentWorkspaceSession = route.name === 'StudentSession';

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

  useEffect(() => { fetch(); }, [fetch]);

  function handleStartSession() {
    navigation.navigate('PronunciationSessionSetup', { student });
  }

  function handleViewPronunciationResults() {
    navigation.navigate('PronunciationResultsHistory', { student });
  }

  if (!student) return null;

  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={Colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatarRing}>
            <Avatar name={student.full_name} uri={student.profile_photo_url} size={72} />
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.heroName} numberOfLines={2}>{student.full_name}</Text>
            <View style={styles.heroChips}>
              {student.student_code ? (
                <View style={styles.heroChip}>
                  <Ionicons name="card-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.heroChipText}>{student.student_code}</Text>
                </View>
              ) : null}
              {age != null ? (
                <View style={styles.heroChip}>
                  <Ionicons name="balloon-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.heroChipText}>{age} years old</Text>
                </View>
              ) : null}
              {student.disability ? (
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText} numberOfLines={1}>{student.disability}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Personal Info */}
        <SectionHeader icon="person-outline" title="Student Information" />
        <Card style={styles.infoCard} padding="none">
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(student.date_of_birth)} />
          <View style={styles.divider} />
          <InfoRow icon="medical-outline" label="Disability" value={student.disability} />
          {student.address && <View style={styles.divider} />}
          <InfoRow icon="home-outline" label="Address" value={student.address} />
        </Card>

        {/* Contact */}
        {(student.father_name || student.mother_name || student.mobile_number || student.home_number) && (
          <>
            <SectionHeader icon="call-outline" title="Contact Information" />
            <Card style={styles.infoCard} padding="none">
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

        {/* Module progress */}
        <SectionHeader icon="stats-chart-outline" title="Module Progress" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moduleTabs}
        >
          {MODULES.map((m) => {
            const active = m.key === activeModule;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setActiveModule(m.key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.moduleTab, active && styles.moduleTabActive]}
              >
                <Ionicons
                  name={m.icon}
                  size={15}
                  color={active ? '#FFFFFF' : Colors.text.muted}
                />
                <Text style={[styles.moduleTabText, active && styles.moduleTabTextActive]}>
                  {m.tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Card style={styles.infoCard} padding="none">
          {activeModule !== 'pronunciation' ? (
            <View style={styles.moduleEmpty}>
              <Ionicons name={activeMeta.icon} size={22} color={Colors.text.muted} />
              <Text style={styles.moduleEmptyText}>
                {activeMeta.title} isn't available yet. {student.full_name.split(' ')[0]}'s progress will
                appear here once the module is released.
              </Text>
            </View>
          ) : isStudentWorkspaceSession ? (
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
            <TouchableOpacity
              style={styles.progressAction}
              activeOpacity={0.82}
              onPress={handleViewPronunciationResults}
            >
              <View style={styles.progressBlock}>
                <Text style={styles.progressTitle}>Pronunciation Sessions</Text>
                <Text style={styles.progressHint}>
                  Review saved session scores and sound breakdowns.
                </Text>
              </View>
              <View style={styles.progressIcon}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.primary}
                />
              </View>
            </TouchableOpacity>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadow.md,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroMeta:  { flex: 1, marginLeft: Layout.spacing.lg },
  heroName:  {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: Layout.fontSize.xl * 1.25,
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroChipText: {
    fontSize: Layout.fontSize.xs,
    color: '#FFFFFF',
    fontFamily: 'Nunito_700Bold',
    maxWidth: 150,
  },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
  },
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md },
  infoIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: Layout.spacing.sm },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },

  // ── Module selector ───────────────────────────────────────────────────────
  moduleTabs: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
    paddingRight: Layout.spacing.md,
  },
  moduleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  moduleTabActive: {
    backgroundColor: Colors.text.link,
    borderColor: Colors.text.link,
  },
  moduleTabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.secondary,
  },
  moduleTabTextActive: { color: '#FFFFFF' },

  // ── Module — not yet available ───────────────────────────────────────────
  moduleEmpty: {
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  moduleEmptyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // ── Pronunciation — session control / progress ───────────────────────────
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Layout.spacing.md,
  },
  sessionInfo: { flex: 1, marginRight: Layout.spacing.md },
  sessionIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.icon.muted,
  },
  dotReady: { backgroundColor: Colors.primary },
  sessionStatus: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.text.primary,
  },
  sessionHint: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  progressBlock: {
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
  },
  progressAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.spacing.md,
    padding: Layout.spacing.md,
  },
  progressIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },
  progressHint: {
    marginTop: 6,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
  },
});
