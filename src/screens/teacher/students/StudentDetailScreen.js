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
import { dialogueApi } from '../../../api/dialogue';
import { level2Api } from '../../../api/level2';
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

// Concept Learning and Dialogue report progress today; Writing and Pronunciation
// still render an unavailable panel until those modules ship, so the selector
// stays honest about coverage.
const MODULES = [
  { key: 'concept',       tab: 'Concepts',      title: 'Concept Learning',     icon: 'school-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'dialogue',      tab: 'Dialogue',      title: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

// TASK-43 — the three categories the dialogue trajectory work covers. Days of
// the Week is permanently out of scope, so it never appears in this summary and
// never appears in the report either.
const DIALOGUE_CATEGORIES = [
  { key: 'greetings',   label: 'Greetings' },
  { key: 'magic_words', label: 'Magic words' },
  { key: 'abilities',   label: 'Abilities' },
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
  const [concepts, setConcepts] = useState(null);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [dialogue, setDialogue] = useState(null);
  const [dialogueLoading, setDialogueLoading] = useState(true);
  const [level2, setLevel2] = useState(null);
  const [activeModule, setActiveModule] = useState('concept');

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

  // TASK-43 — the summary panel deliberately reads word *progress*, not the
  // trajectory model. Deriving the trajectory counts here would run a prediction
  // (and possibly SHAP) for every word on every visit to this screen; the
  // prediction work belongs in the report the "View full report" link opens.
  const fetchDialogue = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      setDialogue(await dialogueApi.getLevel1Overview(initialStudent.sid));
    } catch {
      setDialogue(null); // section renders an inline error rather than blanking
    } finally {
      setDialogueLoading(false);
    }
  }, [initialStudent?.sid]);

  // TASK-46 — Level 2's summary comes from its own report endpoint's `totals`.
  // Unlike Level 1 there is no cheaper per-topic summary that covers all three
  // topics in one call (level2Api.getProgress returns a single topic), and this
  // report is plain database reads with no model or microservice behind it.
  const fetchLevel2 = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      const resp = await level2Api.getReport(initialStudent.sid);
      setLevel2(resp?.data ?? null);
    } catch {
      setLevel2(null); // the block renders nothing rather than blanking the tab
    }
  }, [initialStudent?.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => {
    fetchConcepts();
    fetchDialogue();
    fetchLevel2();
  }, [fetchConcepts, fetchDialogue, fetchLevel2]));

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);
  const needsAttention = (concepts?.categories || [])
    .reduce((n, c) => n + c.needs_attention.length, 0);
  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];

  // Dialogue summary. `status` here is the mastery state (Rules 1-3), not the
  // trajectory label — the report's 'struggling' is a prediction about where a
  // word is heading, this one is a record of what has already happened, so it is
  // surfaced as "Needs work" to keep the two readable side by side.
  const dialogueWords = (dialogue || [])
    .filter((w) => DIALOGUE_CATEGORIES.some((c) => c.key === w.category));
  const dialogueTotals = {
    total:      dialogueWords.length,
    mastered:   dialogueWords.filter((w) => w.status === 'mastered').length,
    inProgress: dialogueWords.filter((w) => w.status === 'in_progress').length,
    needsWork:  dialogueWords.filter((w) => w.status === 'struggling').length,
  };
  const dialogueStarted = dialogueWords.filter((w) => w.status !== 'not_started').length;
  const dialogueMastery = dialogueTotals.total > 0
    ? dialogueTotals.mastered / dialogueTotals.total
    : null;

  // TASK-46 — Level 2 lives in the same Dialogue tab, below Level 1.
  const level2Started = level2?.totals?.topics_started ?? 0;

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
        {/* TASK-43 — the dialogue trajectory report is offered exactly the way
            the concept report is: a "Report" action here while its own tab is
            selected, and a "View full report" link at the foot of the summary. */}
        <SectionHeader
          icon="stats-chart-outline"
          title="Module Progress"
          action={
            (activeModule === 'concept' && concepts && concepts.totals.started > 0)
            || (activeModule === 'dialogue' && dialogueStarted > 0)
              ? 'Report'
              : null
          }
          onAction={() => navigation.navigate(
            activeModule === 'dialogue' ? 'TrajectoryReport' : 'ConceptReport',
            { student }
          )}
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

        <Card style={styles.infoCard} padding="none">
          {activeModule === 'dialogue' ? (
            dialogueLoading ? (
              <View style={styles.conceptLoading}>
                <ActivityIndicator color={Colors.icon.active} />
              </View>
            ) : !dialogue ? (
              <View style={styles.conceptEmpty}>
                <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
                <Text style={styles.conceptEmptyText}>Couldn't load dialogue progress.</Text>
                <TouchableOpacity onPress={() => { setDialogueLoading(true); fetchDialogue(); }}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // TASK-46 — the Dialogue module has two levels. Level 1 (word
              // learning) and Level 2 (sentence construction) are shown as two
              // labelled blocks in this one tab, matching how the child-facing
              // DialogueLandingScreen presents them as two cards under one
              // module rather than as separate modules.
              <>
                <Text style={styles.levelHeading}>Level 1 · Dialogue word learning</Text>

                {dialogueStarted === 0 ? (
                  <View style={styles.conceptEmpty}>
                    <Ionicons name="chatbubbles-outline" size={22} color={Colors.text.muted} />
                    <Text style={styles.conceptEmptyText}>
                      No Level 1 activity yet. Progress appears here once {firstName} starts a session.
                    </Text>
                  </View>
                ) : (
                  <>
                <View style={styles.conceptHeader}>
                  <MasteryRing value={dialogueMastery} size={92} label="mastered" />
                  <View style={styles.conceptStats}>
                    <StatLine
                      label="Mastered"
                      value={`${dialogueTotals.mastered} / ${dialogueTotals.total}`}
                    />
                    <StatLine label="Started" value={String(dialogueStarted)} />
                    <StatLine label="In progress" value={String(dialogueTotals.inProgress)} />
                    <StatLine label="Needs work" value={String(dialogueTotals.needsWork)} />
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.categoryBlock}>
                  {DIALOGUE_CATEGORIES.map((c) => {
                    const rows = dialogueWords.filter((w) => w.category === c.key);
                    if (rows.length === 0) return null;
                    const mastered = rows.filter((w) => w.status === 'mastered').length;
                    return (
                      <StatLine
                        key={c.key}
                        label={c.label}
                        value={`${mastered} / ${rows.length} mastered`}
                      />
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.reportLink}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('TrajectoryReport', { student })}
                >
                  <Text style={styles.reportLinkText}>View full report</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.text.link} />
                </TouchableOpacity>
                  </>
                )}

                {/* Level 2 — always shown once the report has loaded, so the
                    level is visible (and its report reachable) even before the
                    child has started it. An untouched Level 2 gets a plain
                    not-started line rather than a block of zeroes. */}
                {level2 ? (
                  <>
                    <Text style={styles.levelHeading}>Level 2 · Sentence construction</Text>

                    {level2Started === 0 ? (
                      <View style={styles.conceptEmpty}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.text.muted} />
                        <Text style={styles.conceptEmptyText}>
                          Not started yet — all {level2.totals.topics_total} topics are
                          waiting for {firstName}'s first session.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.categoryBlock}>
                        <StatLine
                          label="Mastered"
                          value={`${level2.totals.mastered} / ${level2.totals.topics_total}`}
                        />
                        <StatLine label="Started" value={String(level2.totals.topics_started)} />
                        <StatLine label="In progress" value={String(level2.totals.in_progress)} />
                        <StatLine label="Needs support" value={String(level2.totals.struggling)} />
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.reportLink}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('Level2Report', { student })}
                    >
                      <Text style={styles.reportLinkText}>View full report</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.text.link} />
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            )
          ) : activeModule !== 'concept' ? (
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
  // TASK-46 — separates the two levels of the Dialogue module inside one tab.
  levelHeading: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.md,
  },
});
