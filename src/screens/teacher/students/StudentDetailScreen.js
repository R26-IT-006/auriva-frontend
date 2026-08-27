import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
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
// Teacher Dashboard integration fix — Feature 2's own current family
// thresholds, never the legacy student.personal_thresholds field.
// Read-only EXPLANATION of the current progression decision. Server-derived
// rule trace is authoritative; when it is unavailable the panel simply does
// not render. It changes no decision and writes nothing.
// Proposal FR-16, Phase 7B — compact "Live Handwriting Session" card, only
// rendered while the Writing tab is open (spec §14: "most appropriate
// teacher/student screen", "do not redesign TeacherReport completely").
import LiveSessionCard from '../../../components/teacher/LiveSessionCard';
import {
  fetchWritingSummary, buildWritingSummary,
  TOTAL_LOWERCASE as TOTAL_LOWERCASE_FORMS,
  TOTAL_UPPERCASE as TOTAL_UPPERCASE_FORMS,
} from '../../../utils/writingModuleSummary';

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

// Teacher Dashboard integration fix (final live-runtime-trace finding):
// this card previously read the LEGACY students.personal_thresholds field
// and displayed a hardcoded 55/100 fallback whenever no `.default` key was
// set — completely disconnected from Feature 2's real family thresholds.
// It now renders exactly what GET /handwriting/family-thresholds/:studentId


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

// Concept Learning and the Writing module report progress today; the rest
// render an unavailable panel until they ship, so the selector stays honest
// about coverage.
const MODULES = [
  { key: 'concept',       tab: 'Concepts',      title: 'Concept Learning',     icon: 'school-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
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

/**
 * A compact bar for one mastery row. Deliberately small: this is an
 * at-a-glance overview, not the report's charts.
 */
function MiniBar({ percent }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <View style={styles.wsBarTrack}>
      <View style={[styles.wsBarFill, { width: `${pct}%` }]} />
    </View>
  );
}

function WsRow({ label, value, percent }) {
  return (
    <View style={styles.wsRow}>
      <View style={styles.wsRowHead}>
        <Text style={styles.wsRowLabel}>{label}</Text>
        <Text style={styles.wsRowValue}>{value}</Text>
      </View>
      <MiniBar percent={percent} />
    </View>
  );
}

function WsStatus({ icon, label, value, muted }) {
  return (
    <View style={styles.wsStatus}>
      <Ionicons name={icon} size={14} color={muted ? Colors.text.muted : Colors.text.link} />
      <View style={styles.wsStatusText}>
        <Text style={styles.wsStatusLabel}>{label}</Text>
        <Text style={[styles.wsStatusValue, muted && styles.wsStatusValueMuted]}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * WRITING PROGRESS summary.
 *
 * Information priority, top to bottom: overall letters mastered, the two
 * case breakdowns, word status, then two or three teacher-relevant statuses,
 * then the single report action.
 *
 * Every value comes from utils/writingModuleSummary.js, which reads only
 * backend-authoritative counts. Nothing here is derived from a demo/preview
 * flag, and nothing shows raw DTW, motor features, thresholds, cycle counts
 * or clustering terminology.
 */
function WritingSummaryCard({ state, onOpenReport, onRetry }) {
  const s = state.summary;
  // Tablet landscape: let the headline and the two case rows share the width
  // instead of stacking into a tall column. One breakpoint, no horizontal
  // scrolling, and the hierarchy is identical in both layouts.
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  return (
    <Card style={styles.wsCard} padding="none">
      {state.status === 'loading' ? (
        <View style={styles.wsLoading}>
          <ActivityIndicator color={Colors.icon.active} />
        </View>
      ) : state.status === 'partial' ? (
        // Core letter progress did not load. Secondary items degrade on their
        // own (a missing Writing Check simply reads "Not checked yet"), but
        // without the letter counts there is no summary to show — and a made-up
        // 0/52 would read as real. Never a status code, never "read_failed".
        <View style={styles.wsUnavailable}>
          <Ionicons name="cloud-offline-outline" size={20} color={Colors.text.muted} />
          <Text style={styles.wsUnavailableText}>
            Writing progress isn&apos;t available right now.
          </Text>
          <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
            <Text style={styles.wsRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Priority 1 — the headline. 52 letter FORMS (26 lowercase +
              26 uppercase); words are a separate module and never counted
              into this percentage. */}
          <View style={[styles.wsBody, wide && styles.wsBodyWide]}>
          <View style={[styles.wsHeadline, wide && styles.wsHeadlineWide]}>
            <View>
              <Text style={styles.wsHeadlineLabel}>Letters Mastered</Text>
              <Text style={styles.wsHeadlineValue}>
                {s.totalMastered}
                <Text style={styles.wsHeadlineTotal}> / {s.totalLetterForms}</Text>
              </Text>
            </View>
            <View style={styles.wsPercentPill}>
              <Text style={styles.wsPercentText}>{s.masteredPercent}%</Text>
            </View>
          </View>

          {/* Priority 2 — the two cases, counted independently. */}
          <View style={[styles.wsRows, wide && styles.wsRowsWide]}>
            <WsRow
              label="Lowercase Letters"
              value={`${s.lowercaseMastered} / ${TOTAL_LOWERCASE_FORMS}`}
              percent={s.lowercasePercent}
            />
            <WsRow
              label="Uppercase Letters"
              value={`${s.uppercaseMastered} / ${TOTAL_UPPERCASE_FORMS}`}
              percent={s.uppercasePercent}
            />
          </View>

          </View>

          {/* Priority 3 — words. Locked until BOTH cases are complete; the
              same rule the child-facing gate uses. */}
          <View style={styles.wsDivider} />
          <View style={styles.wsStatusGrid}>
            <WsStatus
              icon={s.wordsUnlocked ? 'text-outline' : 'lock-closed-outline'}
              label="Word Practice"
              value={s.wordsUnlocked ? 'Available' : 'Locked'}
              muted={!s.wordsUnlocked}
            />
            {!s.wordsUnlocked ? (
              <Text style={styles.wsLockedHint}>
                Complete all lowercase and uppercase letters first.
              </Text>
            ) : null}

            {/* Priority 5 — home practice, counted rather than listed. */}
            {s.homePracticeCount != null && s.homePracticeCount > 0 ? (
              <WsStatus
                icon="home-outline"
                label="Home Practice"
                value={
                  s.homePracticeCount === 1 && s.homePracticeLetters.length === 1
                    ? `${s.homePracticeLetters[0]} needs additional practice`
                    : `${s.homePracticeCount} letters recommended`
                }
              />
            ) : null}

            {/* Priority 6 — latest Writing Check status only. Never a
                cluster id, never a chart, never framed as good or bad. */}
            <WsStatus
              icon="pulse-outline"
              label="Writing Pattern"
              value={s.writingPatternLabel}
              muted={s.writingPatternLabel === 'Not checked yet'}
            />
          </View>

          {/* The single action out to the existing report. */}
          <TouchableOpacity
            style={styles.wsReportBtn}
            activeOpacity={0.75}
            onPress={onOpenReport}
            accessibilityRole="button"
            accessibilityLabel="View Writing Progress Report"
          >
            <Text style={styles.wsReportText}>View Writing Progress Report</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.link} />
          </TouchableOpacity>
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
  const [activeModule, setActiveModule] = useState('concept');
  // The per-family "Writing Standard" targets are NOT shown in this compact
  // summary — a threshold is report-level detail, not an at-a-glance status.
  // The request, state and effect that fed that card were removed with it, so
  // opening the Writing tab no longer costs a call whose result is never
  // rendered. Nothing about threshold logic changed: the resolver, history,
  // family mapping and teacher overrides all keep operating internally.

  // Writing tab summary. Lazy — fetched only once the Writing tab is
  // actually open, matching the existing threshold-loading convention on
  // this screen. Seeded with the neutral empty summary so a brand-new child
  // reads 0/52 and "Locked" rather than blank or an error.
  const [writingSummary, setWritingSummary] = useState({
    status: 'loading', summary: buildWritingSummary({}),
  });

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

  const loadWritingSummary = useCallback(async () => {
    if (!initialStudent?.sid) return;
    setWritingSummary((prev) => ({ ...prev, status: 'loading' }));
    setWritingSummary(await fetchWritingSummary(initialStudent.sid));
  }, [initialStudent?.sid]);


  useEffect(() => { fetch(); }, [fetch]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => { fetchConcepts(); }, [fetchConcepts]));

  // Lazy-load only when the Writing tab is actually selected (mirrors
  // getConceptReport's own "expensive, lazy-load from the report screen"
  // convention) — fetched once per (student, module-becomes-writing), not
  // on every render or every tab switch back to Writing.
  useEffect(() => {
    if (activeModule === 'writing') loadWritingSummary();
  }, [activeModule, loadWritingSummary]);

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);
  const needsAttention = (concepts?.categories || [])
    .reduce((n, c) => n + c.needs_attention.length, 0);
  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];

  // The header's "Report" shortcut points at whichever module is on screen —
  // Concept only once there is something to report on, Writing always, since
  // the handwriting report renders its own empty state.
  const reportAction =
    activeModule === 'writing' ? 'Report'
      : activeModule === 'concept' && concepts && concepts.totals.started > 0 ? 'Report'
        : null;

  function openHandwritingReport() {
    navigation.navigate('StudentHandwritingReport', {
      student,
      theme: getAvatarTheme(student.avatar_key),
      // Where the report's back button returns to. Without it the report
      // fell through to a bare goBack(), which lands wherever the stack
      // happens to point rather than on the profile the teacher opened it
      // from — see utils/backToOrigin.js. `activeModule` is preserved for
      // free: this screen is not unmounted, so Writing is still selected.
      originRoute: route.name,
    });
  }

  function openActiveReport() {
    if (activeModule === 'writing') openHandwritingReport();
    else if (activeModule === 'concept') navigation.navigate('ConceptReport', { student });
  }

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
        <SectionHeader
          icon="stats-chart-outline"
          title="Module Progress"
          action={reportAction}
          onAction={openActiveReport}
        />

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

        {activeModule === 'writing' ? (
          <>
            {/* Proposal FR-16, Phase 7B — near-real-time (not sub-second,
                not biometric) live handwriting-session monitoring. Polls on
                its own focus-gated interval; entirely independent of the
                other Writing-tab sections above/below it. */}
            <LiveSessionCard studentId={initialStudent?.sid} compactWhenInactive />

            {/* WRITING PROGRESS — a compact OVERVIEW only, following the
                Concepts pattern: a small summary here, the detail behind a
                single report action.
                Deliberately NOT here: the motor performance chart, initial
                shape assessment, difficulty analysis, Writing Check history,
                per-letter history, worksheet history and periodic charts —
                all of which live in the Writing Progress Report this card
                links to. The per-family "Writing Standard" targets moved
                there too: a threshold is report-level detail, not an
                at-a-glance status. */}
            <SectionHeader icon="create-outline" title="Writing Progress" />
            <WritingSummaryCard
              state={writingSummary}
              onOpenReport={openHandwritingReport}
              onRetry={loadWritingSummary}
            />
          </>
        ) : (
          <Card style={styles.infoCard} padding="none">
            {activeModule !== 'concept' ? (
              <View style={styles.conceptEmpty}>
                <Ionicons name={activeMeta.icon} size={22} color={Colors.text.muted} />
                <Text style={styles.conceptEmptyText}>
                  {activeMeta.title} isn't available yet. {firstName}'s progress will
                  appear here once the module is released.
                </Text>
              </View>
            ) : conceptsLoading ? (
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
        )}
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
  // ── Writing Progress summary ─────────────────────────────────────────
  // Compact by design: the whole card sits inside the Module Progress area
  // without turning it into the full report. No fixed heights and no nested
  // ScrollView — the Student Profile already owns scrolling.
  wsCard: { marginBottom: 12, overflow: 'hidden' },
  wsLoading: { paddingVertical: 28, alignItems: 'center' },
  wsUnavailable: { paddingVertical: 24, paddingHorizontal: 18, alignItems: 'center', gap: 7 },
  wsUnavailableText: { fontSize: 12.5, color: Colors.text.muted, textAlign: 'center' },
  wsRetryText: { fontSize: 12.5, fontWeight: '600', color: Colors.text.link },

  wsHeadline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
  },
  wsHeadlineLabel: { fontSize: 12, color: Colors.text.muted, marginBottom: 2 },
  wsHeadlineValue: { fontSize: 26, fontWeight: '700', color: Colors.text.primary },
  wsHeadlineTotal: { fontSize: 15, fontWeight: '600', color: Colors.text.muted },
  wsPercentPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  wsPercentText: { fontSize: 15, fontWeight: '700', color: '#6366F1' },

  wsBody: {},
  wsBodyWide: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingRight: 14 },
  wsHeadlineWide: { paddingRight: 0, flexShrink: 0, minWidth: 190 },
  wsRows: { paddingHorizontal: 14, gap: 10 },
  wsRowsWide: { flex: 1, paddingLeft: 0 },
  wsRow: { gap: 5 },
  wsRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  wsRowLabel: { fontSize: 12.5, color: Colors.text.secondary },
  wsRowValue: { fontSize: 12.5, fontWeight: '600', color: Colors.text.primary },
  wsBarTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(99,102,241,0.12)', overflow: 'hidden',
  },
  wsBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#6366F1' },

  wsDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border ?? 'rgba(0,0,0,0.08)',
    marginTop: 14, marginHorizontal: 14,
  },
  wsStatusGrid: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  wsStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  wsStatusText: { flex: 1 },
  wsStatusLabel: { fontSize: 11.5, color: Colors.text.muted },
  wsStatusValue: { fontSize: 13, fontWeight: '600', color: Colors.text.primary, marginTop: 1 },
  wsStatusValueMuted: { color: Colors.text.secondary, fontWeight: '500' },
  wsLockedHint: {
    fontSize: 11.5, color: Colors.text.muted, marginTop: -4, marginLeft: 23, lineHeight: 16,
  },

  wsReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border ?? 'rgba(0,0,0,0.08)',
  },
  wsReportText: { fontSize: 13.5, fontWeight: '600', color: Colors.text.link },


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
  },
});
