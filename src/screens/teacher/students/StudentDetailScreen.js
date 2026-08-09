import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/common/Avatar';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
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

function StatLine({ label, value }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ icon, title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={13} color={Colors.text.link} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function StatTile({ icon, value, label, tint }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={16} color={tint || Colors.text.link} />
      <Text style={[styles.statTileValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.statTileLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

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
  const [refreshing, setRefreshing] = useState(false);
  const [concepts, setConcepts] = useState(null);
  const [conceptsLoading, setConceptsLoading] = useState(true);

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

  const fetchConcepts = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      setConcepts(await teacherApi.getConceptSummary(initialStudent.sid));
    } catch {
      setConcepts(null); // section renders an inline error rather than blanking
    } finally {
      setConceptsLoading(false);
    }
  }, [initialStudent?.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => { fetchConcepts(); }, [fetchConcepts]));

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);
  const needsAttention = (concepts?.categories || [])
    .reduce((n, c) => n + c.needs_attention.length, 0);
  const age = ageFrom(student.date_of_birth);

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
              {student.disability ? (
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText} numberOfLines={1}>{student.disability}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        {/* Quick stats — lifted onto the hero so the two read as one unit */}
        <View style={styles.statStrip}>
          <StatTile
            icon="balloon-outline"
            value={age != null ? age : '—'}
            label={age != null ? 'years old' : 'age unknown'}
          />
          <View style={styles.statDivider} />
          <StatTile
            icon="ribbon-outline"
            value={concepts ? concepts.totals.mastered : '—'}
            label="mastered"
            tint={Colors.status.success}
          />
          <View style={styles.statDivider} />
          <StatTile
            icon="alert-circle-outline"
            value={concepts ? needsAttention : '—'}
            label="needs work"
            tint={needsAttention > 0 ? Colors.status.warning : undefined}
          />
        </View>

        {/* Writing Standard */}
        <Text style={styles.sectionTitle}>Writing Standard</Text>
        <ThresholdCard thresholds={student.personal_thresholds ?? {}} />

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

        {/* Concept Learning */}
        <SectionHeader
          icon="school-outline"
          title="Concept Learning"
          action={concepts && concepts.totals.started > 0 ? 'Report' : null}
          onAction={() => navigation.navigate('ConceptReport', { student })}
        />
        <Card style={styles.infoCard} padding="none">
          {conceptsLoading ? (
            <View style={styles.conceptLoading}>
              <ActivityIndicator color={Colors.icon.active} />
            </View>
          ) : !concepts ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>Couldn't load concept progress.</Text>
              <TouchableOpacity onPress={() => { setConceptsLoading(true); fetchConcepts(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : concepts.totals.started === 0 ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="school-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                No concept activity yet. Progress appears here once {student.full_name.split(' ')[0]} starts a session.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.conceptHeader}>
                <MasteryRing value={concepts.totals.mastery_pct} size={92} label="mastery" />
                <View style={styles.conceptStats}>
                  <StatLine
                    label="Mastered"
                    value={`${concepts.totals.mastered} / ${concepts.totals.catalogue_concepts}`}
                  />
                  <StatLine label="Started" value={String(concepts.totals.started)} />
                  <StatLine label="Identified" value={String(concepts.totals.tier1_passed)} />
                  <StatLine label="Needs work" value={String(needsAttention)} />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.categoryBlock}>
                {activeCategories.map((c) => (
                  <TierBar
                    key={c.category_key}
                    label={c.label}
                    total={c.total}
                    tier1={c.tier1_passed}
                    tier2={c.tier2_passed}
                    tier3={c.tier3_passed}
                    right={`${c.mastered}/${c.total}`}
                  />
                ))}
                <TierLegend />
              </View>

              <TouchableOpacity
                style={styles.reportLink}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ConceptReport', { student })}
              >
                <Text style={styles.reportLinkText}>View full report</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.text.link} />
              </TouchableOpacity>
            </>
          )}
        </Card>
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
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    // Extra bottom padding so the stat strip can sit over the gradient without
    // covering the name.
    paddingBottom: Layout.spacing.xl + Layout.spacing.md,
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

  // ── Quick stats ───────────────────────────────────────────────────────────
  statStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginHorizontal: Layout.spacing.md,
    // Pull up over the gradient so hero + stats read as a single unit.
    marginTop: -Layout.spacing.xl,
    marginBottom: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    ...Layout.shadow.md,
  },
  statTile:      { flex: 1, alignItems: 'center', gap: 3 },
  statTileValue: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.text.primary,
  },
  statTileLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  statDivider:   { width: 1, backgroundColor: Colors.divider, marginVertical: 4 },

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
  sectionAction: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.link,
    fontFamily: 'Nunito_700Bold',
  },
  infoCard: { marginBottom: Layout.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Layout.spacing.sm, paddingHorizontal: Layout.spacing.md },
  infoIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.status.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: Layout.spacing.sm },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 58 },

  // ── Concept Learning ──────────────────────────────────────────────────────
  conceptLoading: { paddingVertical: Layout.spacing.xl, alignItems: 'center' },
  conceptEmpty: {
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.md,
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  conceptEmptyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  retryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'Nunito_700Bold',
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.spacing.md,
    gap: Layout.spacing.lg,
  },
  conceptStats: { flex: 1, gap: 6 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  statValue: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    fontFamily: 'Nunito_700Bold',
  },
  categoryBlock: {
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  reportLinkText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'Nunito_700Bold',
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
