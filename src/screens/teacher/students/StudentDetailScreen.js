import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
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
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { conceptApi } from '../../../api/concept';
import { formatDate, ageFrom } from '../../../utils/formatters';
import { formatPct } from '../../../utils/scoreColor';
import { getConceptItem } from '../../../data/conceptData';

// Same tinted pairs the teacher dashboard uses for its section panels, so a
// profile opened from a dashboard card keeps the same visual language.
const TINTS = {
  purple: { bg: '#EFEBFA', fg: '#6C5CE0' },
  green:  { bg: '#E3F7EC', fg: '#3FAE6F' },
  blue:   { bg: '#E6F1FC', fg: '#3B82C4' },
  amber:  { bg: '#FDF1DC', fg: '#E89A2E' },
};

const SECTION = {
  contact:  { icon: 'call-outline',          ...TINTS.green },
  progress: { icon: 'stats-chart-outline',   ...TINTS.purple },
  artwork:  { icon: 'color-palette-outline', ...TINTS.amber },
};

const PANEL_PAD = 16;

// ── Panel shell ──────────────────────────────────────────────────────────────

function Panel({ title, section, action, onAction, children, flush }) {
  const accent = SECTION[section];
  return (
    // Shadow on the outer view, clipping on the inner one: a view with
    // overflow:hidden clips its own shadow on iOS, so the two can't be the same.
    <View style={styles.panelShadowWrap}>
      <View style={[styles.panel, { borderColor: accent.fg + '33' }]}>
        <View style={[
          styles.panelHeader,
          { backgroundColor: accent.bg, borderBottomColor: accent.fg + '26' },
        ]}>
          <View style={styles.panelIcon}>
            <Ionicons name={accent.icon} size={16} color={accent.fg} />
          </View>
          <Text style={[styles.panelTitle, { color: accent.fg }]} numberOfLines={1}>
            {title}
          </Text>
          {action ? (
            <TouchableOpacity
              onPress={onAction}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.panelAction, { color: accent.fg }]}>{action}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={flush ? null : styles.panelBody}>{children}</View>
      </View>
    </View>
  );
}

// ── Info rows ────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, accent }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: accent.bg }]}>
        <Ionicons name={icon} size={15} color={accent.fg} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * Renders only the rows that have a value, with dividers *between* them.
 *
 * Interleaving here rather than at each call site is what stops a missing
 * optional field (no father's name, say) from leaving a divider stranded at the
 * top of the card with nothing above it.
 */
function InfoList({ rows, section }) {
  const accent  = SECTION[section];
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((r, i) => (
        <React.Fragment key={r.label}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <InfoRow icon={r.icon} label={r.label} value={r.value} accent={accent} />
        </React.Fragment>
      ))}
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

function HeroStat({ value, label }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

/** Detail rows sitting on the hero gradient, so they get their own translucent
 *  treatment rather than the tinted-on-white one the panels use. */
function HeroInfoRow({ icon, label, value }) {
  return (
    <View style={styles.heroInfoRow}>
      <View style={styles.heroInfoIcon}>
        <Ionicons name={icon} size={14} color="#FFFFFF" />
      </View>
      <Text style={styles.heroInfoLabel}>{label}</Text>
      <Text style={styles.heroInfoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function HeroInfoList({ rows }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <View style={styles.heroInfo}>
      {visible.map((r, i) => (
        <React.Fragment key={r.label}>
          {i > 0 ? <View style={styles.heroInfoDivider} /> : null}
          <HeroInfoRow icon={r.icon} label={r.label} value={r.value} />
        </React.Fragment>
      ))}
    </View>
  );
}

// Only Concept Learning reports progress today; the rest render an unavailable
// panel until those modules ship, so the selector stays honest about coverage.
const MODULES = [
  { key: 'concept',       tab: 'Concepts',      title: 'Concept Learning',     icon: 'school-outline' },
  { key: 'writing',       tab: 'Writing',       title: 'Writing Module',       icon: 'create-outline' },
  { key: 'pronunciation', tab: 'Pronunciation', title: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'dialogue',      tab: 'Dialogue',      title: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

export default function TeacherStudentDetailScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const [student, setStudent] = useState(initialStudent);
  const [refreshing, setRefreshing] = useState(false);
  const [concepts, setConcepts] = useState(null);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('concept');
  const [artworks, setArtworks] = useState([]);

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

  const fetchArtworks = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      setArtworks(await conceptApi.listColoring({ studentId: initialStudent.sid }));
    } catch {
      setArtworks([]); // the section simply doesn't render
    }
  }, [initialStudent?.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  // Refetch on focus so returning from the report reflects a session just played.
  useFocusEffect(useCallback(() => {
    fetchConcepts();
    fetchArtworks();
  }, [fetchConcepts, fetchArtworks]));

  if (!student) return null;

  // Categories the child has actually touched — showing all nine when eight are
  // empty buries the signal.
  const activeCategories = (concepts?.categories || []).filter((c) => c.started > 0);
  const needsAttention = (concepts?.categories || [])
    .reduce((n, c) => n + c.needs_attention.length, 0);
  const age = ageFrom(student.date_of_birth);
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];
  const hasProgress = concepts && concepts.totals.started > 0;

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
          <View style={styles.heroTop}>
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
              </View>
            </View>
          </View>

          {/* The child's details live on the identity card itself rather than in a
              panel of their own — it is all the same "who is this student?"
              answer, and splitting it across two blocks made the reader hunt. */}
          <HeroInfoList
            rows={[
              { icon: 'calendar-outline', label: 'Date of Birth', value: formatDate(student.date_of_birth) },
              { icon: 'medical-outline',  label: 'Disability',    value: student.disability },
              { icon: 'home-outline',     label: 'Address',       value: student.address },
            ]}
          />

          {/* Headline numbers up top: opening a profile is usually a "how is this
              child doing?" question, and the answer shouldn't need a scroll. */}
          {hasProgress ? (
            <View style={styles.heroStats}>
              <HeroStat value={formatPct(concepts.totals.mastery_pct)} label="Mastery" />
              <View style={styles.heroStatDivider} />
              <HeroStat
                value={`${concepts.totals.mastered}/${concepts.totals.catalogue_concepts}`}
                label="Mastered"
              />
              <View style={styles.heroStatDivider} />
              <HeroStat value={String(needsAttention)} label="Needs work" />
            </View>
          ) : null}
        </LinearGradient>

        {/* Contact */}
        {(student.father_name || student.mother_name || student.mobile_number || student.home_number) && (
          <Panel title="Contact Information" section="contact" flush>
            <InfoList
              section="contact"
              rows={[
                { icon: 'person-outline',          label: "Father's Name", value: student.father_name },
                { icon: 'person-outline',          label: "Mother's Name", value: student.mother_name },
                { icon: 'phone-portrait-outline',  label: 'Mobile',        value: student.mobile_number },
                { icon: 'call-outline',            label: 'Home',          value: student.home_number },
              ]}
            />
          </Panel>
        )}

        {/* Module progress */}
        <Panel
          title="Module Progress"
          section="progress"
          flush
          action={activeModule === 'concept' && hasProgress ? 'Report' : null}
          onAction={() => navigation.navigate('ConceptReport', { student })}
        >
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

          <View style={styles.divider} />

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
              <ActivityIndicator color={SECTION.progress.fg} />
            </View>
          ) : !concepts ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="cloud-offline-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>Couldn't load concept progress.</Text>
              <TouchableOpacity onPress={() => { setConceptsLoading(true); fetchConcepts(); }}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !hasProgress ? (
            <View style={styles.conceptEmpty}>
              <Ionicons name="school-outline" size={22} color={Colors.text.muted} />
              <Text style={styles.conceptEmptyText}>
                No concept activity yet. Progress appears here once {firstName} starts a session.
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
                <Text style={[styles.reportLinkText, { color: SECTION.progress.fg }]}>
                  View full report
                </Text>
                <Ionicons name="chevron-forward" size={16} color={SECTION.progress.fg} />
              </TouchableOpacity>
            </>
          )}
        </Panel>

        {/* Colouring artwork — only appears once the child has coloured something */}
        {artworks.length > 0 && (
          <Panel title="Colouring Artwork" section="artwork" flush>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.artworkRow}
            >
              {artworks.map((art) => {
                const concept = getConceptItem(art.category_key, art.concept_key);
                return (
                  <View key={art.id} style={styles.artworkCard}>
                    <Image
                      source={{ uri: art.image_url }}
                      style={styles.artworkImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.artworkLabel} numberOfLines={1}>
                      {concept?.label ?? art.concept_key}
                    </Text>
                    <Text style={styles.artworkDate}>{formatDate(art.created_at)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.lg,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    ...Layout.shadow.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
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
    fontFamily: 'DMSans_800ExtraBold',
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
    fontFamily: 'DMSans_700Bold',
    maxWidth: 150,
  },
  heroInfo: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Layout.spacing.md,
  },
  heroInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingVertical: Layout.spacing.sm + 2,
  },
  heroInfoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroInfoLabel: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'DMSans_600SemiBold',
  },
  // Pushed right and given the slack: the label is a fixed short string, the
  // value is the part that can run long (an address especially).
  heroInfoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: Layout.fontSize.sm,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  heroInfoDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatValue: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: Layout.fontSize.xs,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'DMSans_600SemiBold',
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // ── Panels ────────────────────────────────────────────────────────────────
  // Shadow here, not on `panel` — overflow:hidden clips a view's own shadow.
  panelShadowWrap: {
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    ...Layout.shadow.sm,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: PANEL_PAD,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
  },
  panelIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_800ExtraBold',
  },
  panelAction: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'DMSans_700Bold',
  },
  panelBody: { padding: PANEL_PAD },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: PANEL_PAD,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.md,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginBottom: 2 },
  infoValue: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  // Indented to clear the icon column (pad 16 + icon 32 + gap 16), so the rule
  // separates the text, not the whole row.
  divider: { height: 1, backgroundColor: Colors.divider, marginLeft: 64 },

  // ── Module selector ───────────────────────────────────────────────────────
  moduleTabs: {
    gap: Layout.spacing.sm,
    padding: PANEL_PAD,
  },
  moduleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  moduleTabActive: {
    backgroundColor: SECTION.progress.fg,
    borderColor: SECTION.progress.fg,
  },
  moduleTabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
  },
  moduleTabTextActive: { color: '#FFFFFF' },

  // ── Concept Learning ──────────────────────────────────────────────────────
  conceptLoading: { paddingVertical: Layout.spacing.xl, alignItems: 'center' },
  conceptEmpty: {
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  conceptEmptyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Layout.fontSize.sm * 1.5,
  },
  retryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PANEL_PAD,
    gap: Layout.spacing.lg,
  },
  conceptStats: { flex: 1, gap: 8 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted },
  statValue: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    fontFamily: 'DMSans_700Bold',
  },
  categoryBlock: {
    paddingHorizontal: PANEL_PAD,
    paddingVertical: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PANEL_PAD,
    paddingVertical: Layout.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  reportLinkText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
  },

  // ── Colouring artwork ─────────────────────────────────────────────────────
  artworkRow: {
    gap: Layout.spacing.sm,
    padding: PANEL_PAD,
  },
  artworkCard: {
    width: 132,
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 8,
    ...Layout.shadow.sm,
  },
  artworkImage: {
    width: '100%',
    height: 116,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  artworkLabel: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    marginTop: 6,
  },
  artworkDate: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    marginTop: 1,
  },
});
