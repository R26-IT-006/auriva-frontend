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
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { formatDate, ageFrom } from '../../../utils/formatters';
import { countOf, ROUND } from '../../../constants/teacherWording';

// Same tinted pairs the teacher dashboard uses for its section panels, so a
// profile opened from a dashboard card keeps the same visual language.
const TINTS = {
  purple: { bg: '#EFEBFA', fg: '#6C5CE0' },
  green:  { bg: '#E3F7EC', fg: '#3FAE6F' },
  blue:   { bg: '#E6F1FC', fg: '#3B82C4' },
  amber:  { bg: '#FDF1DC', fg: '#E89A2E' },
};

const SECTION = {
  contact:  { icon: 'call-outline',        ...TINTS.green },
  progress: { icon: 'stats-chart-outline', ...TINTS.purple },
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

/** One fact on the hero gradient: a translucent tile with the label above the
 *  value, so the eye reads a grid of short blocks instead of a stack of rows. */
function HeroFact({ icon, label, value, wide }) {
  return (
    <View style={[styles.factTile, wide && styles.factTileWide]}>
      <View style={styles.factLabelRow}>
        <Ionicons name={icon} size={12} color="rgba(255,255,255,0.78)" />
        <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/**
 * Lays the filled-in facts out as a wrapping grid.
 *
 * Short facts take half a row and grow to fill whatever is left, so one missing
 * field re-flows the rest instead of leaving a gap; anything marked `wide` (an
 * address, which is the one value that reliably runs long) claims a full row.
 */
function HeroFacts({ rows }) {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <View style={styles.heroFacts}>
      {visible.map((r) => (
        <HeroFact key={r.label} icon={r.icon} label={r.label} value={r.value} wide={r.wide} />
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
  const activeMeta = MODULES.find((m) => m.key === activeModule) ?? MODULES[0];
  const firstName  = student.full_name.split(' ')[0];
  const hasProgress = concepts && concepts.totals.started > 0;

  // Code and age were two pill chips; as one quiet line under the name they read
  // as a caption on the name rather than as two more things to look at.
  const identityMeta = [
    student.student_code,
    age != null ? `${age} years old` : null,
  ].filter(Boolean).join('  ·  ');

  // The hero wears the child's own avatar colours, so a teacher who knows Lily
  // from Boba recognises whose profile this is before reading the name — and it
  // matches what the child sees in the concept activities.
  const heroColors = getAvatarTheme(student.avatar_key).heroGradient;
  const heroDeep   = heroColors[heroColors.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — shadow on the wrapper, clipping on the gradient: the gradient
            has to clip so the soft highlight circles stay inside its corners,
            and a clipping view swallows its own shadow on iOS. */}
        <View style={[
          styles.heroShadowWrap,
          // Backing colour and shadow both take the deep end of the gradient:
          // the backing only shows through the rounded corners, and a shadow in
          // the card's own hue keeps a warm avatar from casting a blue one.
          { backgroundColor: heroDeep, shadowColor: heroDeep },
        ]}>
          <LinearGradient
            colors={heroColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowTop} pointerEvents="none" />
            <View style={styles.heroGlowBottom} pointerEvents="none" />

            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                {/* Initials fall back to the deep end rather than Avatar's own
                    name-hashed palette, which would drop an unrelated colour
                    into a card that is otherwise all one hue. */}
                <Avatar
                  name={student.full_name}
                  uri={student.profile_photo_url}
                  size={72}
                  style={{ backgroundColor: heroDeep }}
                />
              </View>

              <View style={styles.heroMeta}>
                <Text style={styles.heroName} numberOfLines={2}>{student.full_name}</Text>
                {identityMeta ? (
                  <Text style={styles.heroSub} numberOfLines={1}>{identityMeta}</Text>
                ) : null}
              </View>
            </View>

            {/* The child's details live on the identity card itself rather than in a
                panel of their own — it is all the same "who is this student?"
                answer, and splitting it across two blocks made the reader hunt.
                Progress deliberately stays out of here: the hero answers "who is
                this?", and "how are they doing?" is the Module Progress panel's
                job — duplicating its numbers up top only split the reader's
                attention between two places showing the same thing. */}
            <HeroFacts
              rows={[
                // Guarded rather than leaning on formatDate, which answers "—" for
                // a missing date — a tile that says nothing is the clutter we're
                // cutting, so it should just not be there.
                { icon: 'calendar-outline', label: 'Date of Birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : null },
                { icon: 'medical-outline',  label: 'Disability',    value: student.disability },
                { icon: 'home-outline',     label: 'Address',       value: student.address, wide: true },
              ]}
            />
          </LinearGradient>
        </View>

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
                <MasteryRing value={concepts.totals.mastery_pct} size={92} label="learned" />
                <View style={styles.conceptStats}>
                  <StatLine
                    label="Learned"
                    value={countOf(concepts.totals.mastered, concepts.totals.catalogue_concepts)}
                  />
                  <StatLine label="Tried so far" value={String(concepts.totals.started)} />
                  <StatLine label={ROUND.tier1.label} value={String(concepts.totals.tier1_passed)} />
                  <StatLine label="Worth another look" value={String(needsAttention)} />
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
  // backgroundColor and shadowColor are both supplied at the call site from the
  // student's avatar theme; everything else about the card is fixed.
  heroShadowWrap: {
    borderRadius: Layout.radius.xl,
    ...Layout.shadow.md,
  },
  hero: {
    borderRadius: Layout.radius.xl,
    overflow: 'hidden',
    padding: Layout.spacing.lg,
    // One rhythm for the whole card: identity → facts → numbers all sit a full
    // step apart, instead of each block bringing its own margin.
    gap: Layout.spacing.lg,
  },
  // Two barely-there highlights bled off the corners. They give the flat
  // gradient some depth without adding anything the reader has to look at.
  heroGlowTop: {
    position: 'absolute',
    top: -54,
    right: -34,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -70,
    left: -46,
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  // A thin ring rather than the old fat halo — it frames the photo instead of
  // competing with it.
  avatarRing: {
    padding: 3,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  heroMeta:  { flex: 1, marginLeft: Layout.spacing.md },
  heroName:  {
    fontSize: Layout.fontSize.xxl,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
    lineHeight: Layout.fontSize.xxl * 1.2,
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 5,
    fontSize: Layout.fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: 0.2,
  },

  // ── Hero facts ────────────────────────────────────────────────────────────
  heroFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.spacing.sm },
  // flexBasis just under half leaves room for the gap, and flexGrow lets a lone
  // tile take the whole row rather than sitting stranded at 46%.
  factTile: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 5,
    paddingHorizontal: Layout.spacing.md - 4,
    paddingVertical: 11,
    borderRadius: Layout.radius.md,
    // A dark scrim rather than a white one. Now that the gradient follows the
    // child's avatar, the tiles sit on anything from deep indigo to bright
    // orange; darkening always helps the white text, where a white wash would
    // wipe it out on the lighter themes.
    backgroundColor: 'rgba(0,0,0,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  factTileWide: { flexBasis: '100%' },
  factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factLabel: {
    fontSize: Layout.fontSize.xs - 1,
    color: 'rgba(255,255,255,0.80)',
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  factValue: {
    fontSize: Layout.fontSize.sm,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
    lineHeight: Layout.fontSize.sm * 1.35,
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
});
