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
import { GroupGrid } from '../../../components/charts/GroupGrid';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { formatDate, ageFrom } from '../../../utils/formatters';
import { ROUND } from '../../../constants/teacherWording';

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
// The module panel's own rhythm. Everything inside it — header, tab bar, cards,
// the gaps between them — is a multiple of this, which is most of what makes the
// section read as laid out rather than assembled.
const PANEL_PAD_LG = 24;
const CARD_GAP     = 16;

// ── Panel shell ──────────────────────────────────────────────────────────────

/**
 * `size="lg"` is the spacious variant, used for the one panel that carries a
 * whole workspace rather than a list of fields.
 *
 * The difference is not only scale. The small panel wears its accent as a tinted
 * header band, which is what tells a short list of contact details apart from the
 * card above it. At the module panel's size that band became a coloured stripe
 * across the widest thing on the screen and started competing with the content
 * under it, so the large variant keeps the accent to the icon plate and the
 * action, and lets the title carry the weight in plain ink.
 */
function Panel({ title, section, action, onAction, children, flush, size = 'md' }) {
  const accent = SECTION[section];
  const lg = size === 'lg';

  return (
    // Shadow on the outer view, clipping on the inner one: a view with
    // overflow:hidden clips its own shadow on iOS, so the two can't be the same.
    <View style={[styles.panelShadowWrap, lg && styles.panelShadowWrapLg]}>
      <View style={[
        styles.panel,
        lg ? styles.panelLg : { borderColor: accent.fg + '33' },
      ]}>
        <View style={[
          styles.panelHeader,
          lg
            ? styles.panelHeaderLg
            : { backgroundColor: accent.bg, borderBottomColor: accent.fg + '26' },
        ]}>
          <View style={[
            styles.panelIcon,
            lg && [styles.panelIconLg, { backgroundColor: accent.bg }],
          ]}>
            <Ionicons name={accent.icon} size={lg ? 22 : 16} color={accent.fg} />
          </View>

          <Text
            style={[styles.panelTitle, lg ? styles.panelTitleLg : { color: accent.fg }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {action ? (
            <TouchableOpacity
              onPress={onAction}
              activeOpacity={0.75}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
            >
              <Text style={[
                styles.panelAction,
                lg && styles.panelActionLg,
                { color: accent.fg },
              ]}>
                {action}
              </Text>
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

/** One figure on the progress panel: a small-caps label over a large number. */
function ProgressStat({ label, value, of, tint }) {
  return (
    <View style={styles.progressStat}>
      <Text style={styles.progressStatLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.progressStatRow}>
        <Text style={[styles.progressStatValue, tint ? { color: tint } : null]}>{value}</Text>
        {of ? <Text style={styles.progressStatOf}>/ {of}</Text> : null}
      </View>
    </View>
  );
}

/** One fact on the identity card: an icon plate, a small-caps label, the value. */
function IdFact({ icon, label, value }) {
  return (
    <View style={styles.idFact}>
      <View style={styles.idFactIcon}>
        <Ionicons name={icon} size={17} color="rgba(255,255,255,0.95)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.idFactLabel}>{label}</Text>
        <Text style={styles.idFactValue} numberOfLines={2}>{value}</Text>
      </View>
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
  // The newest note a teacher has written about this child, for the identity card.
  // Null until it loads and null if it fails — the card simply shows the address
  // instead, rather than an empty quote box.
  const [latestNote, setLatestNote] = useState(null);

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

  const fetchNote = useCallback(async () => {
    if (!initialStudent?.sid) return;
    try {
      const notes = await teacherApi.getStudentNotes(initialStudent.sid);
      const newest = Array.isArray(notes) ? notes[0] : null;
      setLatestNote(newest?.body ?? null);
    } catch {
      setLatestNote(null);
    }
  }, [initialStudent?.sid]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { fetchNote(); }, [fetchNote]);

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


  // The card itself is the brand teal now, so the child's avatar theme survives
  // as the badge on the photo — the deep end of their own pair. It is still the
  // mark a teacher who knows Lily from Boba reads before the name, and it is
  // still the colour the child sees in the concept activities.
  const avatarPair = getAvatarTheme(student.avatar_key).heroGradient;
  const avatarDeep = avatarPair[avatarPair.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* The identity card, in the sign-in button's teal → green, on the same
            diagonal as that button so it reads as the same surface rather than a
            coincidence of hue. */}
        <LinearGradient
          colors={Colors.brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.idCard}
        >
          {/* Measured, not taste. The brand pair is a button colour: white on it
              is 2.69:1 at the teal end and 2.29:1 at the green, which is fine for
              four words on a control and fails everything on a card carrying a
              name, two dates and an address. The scrim deepens the same two hues
              to 5.16:1 and 4.56:1 — so the card keeps the brand colour and the
              text on it can actually be read. */}
          <View style={styles.idScrim} pointerEvents="none" />

          <View style={styles.idBody}>
            {/* Left: who they are. */}
            <View style={styles.idLeft}>
              <View style={styles.idAvatarWrap}>
                <Avatar
                  name={student.full_name}
                  uri={student.profile_photo_url}
                  size={104}
                  style={styles.idAvatar}
                />
                {/* The child's own avatar colour, kept as a badge on the photo.
                    It is the one thing a teacher recognises before reading, and
                    it had nowhere left to live once the card went dark. */}
                <View style={[styles.idAvatarBadge, { backgroundColor: avatarDeep }]}>
                  <Ionicons name="school" size={14} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.idName} numberOfLines={2}>{student.full_name}</Text>

              <View style={styles.idChips}>
                {student.student_code ? (
                  <View style={styles.idChip}>
                    <Text style={styles.idChipText}>{student.student_code}</Text>
                  </View>
                ) : null}
                {age != null ? (
                  <>
                    <View style={styles.idDot} />
                    <Text style={styles.idAge}>{age} years old</Text>
                  </>
                ) : null}
              </View>
            </View>

            {/* Right: the facts, as tiles on the dark. */}
            <View style={styles.idRight}>
              <View style={styles.idFactRow}>
                {student.date_of_birth ? (
                  <IdFact icon="gift-outline" label="Date of birth" value={formatDate(student.date_of_birth)} />
                ) : null}
                {student.disability ? (
                  <IdFact icon="pulse-outline" label="Diagnosis" value={student.disability} />
                ) : null}
              </View>

              {/* The most recent note a teacher wrote about this child. Real, not a
                  placeholder — an invented line here would read as clinical record.
                  Absent until one exists, and absent if the fetch fails. */}
              {latestNote ? (
                <View style={styles.idNote}>
                  <View style={styles.idNoteBadge}>
                    <Text style={styles.idNoteQuote}>“</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idFactLabel}>Teacher's note</Text>
                    <Text style={styles.idNoteText} numberOfLines={3}>{latestNote}</Text>
                  </View>
                </View>
              ) : student.address ? (
                <View style={styles.idNote}>
                  <View style={styles.idNoteBadge}>
                    <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.95)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idFactLabel}>Address</Text>
                    <Text style={styles.idNoteText} numberOfLines={2}>{student.address}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
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
          size="lg"
          flush
          action={activeModule === 'concept' && hasProgress ? 'Report' : null}
          onAction={() => navigation.navigate('ConceptReport', { student })}
        >
          {/* One track holding four equal tabs, rather than a scrolling row of
              chips. There are exactly four modules and there always will be until
              one ships, so the set is small enough to show whole — and a fixed
              set shown whole is a segmented control, which says "these are the
              four choices" where a scroller says "there may be more offscreen". */}
          <View style={styles.tabBar} accessibilityRole="tablist">
            {MODULES.map((m) => {
              const active = m.key === activeModule;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setActiveModule(m.key)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={active ? '#FFFFFF' : Colors.text.muted}
                  />
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                    numberOfLines={1}
                  >
                    {m.tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
              <View style={styles.conceptBody}>
              {/* The ring beside a 2x2 of figures. It stays here — unlike the
                  full report, where it restated the Learned tile — because this
                  panel has no headline sentence, so the ring IS the summary.
                  Both sides are cards on the same light fill so the row reads as
                  one block of five surfaces rather than a chart with a list. */}
              <View style={styles.statRow}>
                <View style={styles.ringCard}>
                  <MasteryRing value={concepts.totals.mastery_pct} size={168} label="learned" />
                </View>

                <View style={styles.statGrid}>
                  <ProgressStat
                    label="Learned"
                    value={String(concepts.totals.mastered)}
                    of={concepts.totals.catalogue_concepts}
                  />
                  <ProgressStat label="Tried so far" value={String(concepts.totals.started)} />
                  <ProgressStat label={ROUND.tier1.label} value={String(concepts.totals.tier1_passed)} />
                  {/* Coral whatever the count, matching the Revisit tile on the
                      report. The two show the same figure and had drifted to
                      different rules for the zero case. */}
                  <ProgressStat
                    label="Worth another look"
                    value={String(needsAttention)}
                    tint="#C4674F"
                  />
                </View>
              </View>

              <View style={styles.breakdownHead}>
                <Ionicons name="list-outline" size={16} color={Colors.text.secondary} />
                <Text style={styles.breakdownTitle}>Category breakdown</Text>
              </View>

              {/* Cards two to a row rather than the report's full-width rows.
                  Nothing opens here, so the row's horizontal space bought nothing
                  and nine of them made this the tallest panel on the screen. Same
                  faces and same three bands as the report, so it still reads as
                  one chart across the two screens. */}
              <GroupGrid
                categories={concepts.categories || []}
                showLegend
                initialCount={6}
              />

              </View>

              {/* On its own ruled footer. Floating at the end of the last bar it
                  read as belonging to that category rather than to the panel. */}
              <View style={styles.reportFooter}>
                <TouchableOpacity
                  style={styles.reportBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ConceptReport', { student })}
                  accessibilityRole="button"
                >
                  <Text style={styles.reportBtnText}>View full report</Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </Panel>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Module progress ────────────────────────────────────────────────────────
  // The panel is `flush`, so the body supplies its own padding. Without it the
  // progress bars ran to the card's edges and the whole section read as though it
  // had been pasted in rather than laid out.
  conceptBody: {
    padding: PANEL_PAD_LG,
    paddingTop: Layout.spacing.lg,
    gap: Layout.spacing.lg,
  },

  reportFooter: {
    alignItems: 'flex-end',
    paddingHorizontal: PANEL_PAD_LG,
    paddingBottom: PANEL_PAD_LG,
    paddingTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  // Carries the same surface, radius and border as the four tiles beside it, so
  // the row reads as five cards of one family. It used to be bare on the argument
  // that the ring is already a closed shape — true of the ring alone, but with
  // tiles either side the bare version read as a gap in the row rather than as a
  // deliberate absence.
  ringCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 220,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  progressStat: {
    // Just under half, so two sit per row with the gap between them. Fixed height
    // rather than content-sized: "Worth another look" wraps to two lines and used
    // to make its row taller than the one above it. Two of these plus the gap is
    // what sets the height the ring card stretches to.
    flexGrow: 1,
    flexBasis: '46%',
    // 130, not 140. On a portrait phone the grid is ~292 wide, so two cards plus
    // the 16 gap have 138 each — a 140 floor tipped them onto separate rows and
    // turned the 2x2 into a stack of four.
    minWidth: 130,
    height: 108,
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  progressStatLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressStatRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  progressStatValue: { fontSize: 30, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  progressStatOf:    { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_700Bold', color: Colors.text.muted },

  // Margins rather than relying on conceptBody's gap alone: the breakdown is a
  // second subject under the same tab, so it wants a wider gap above it than the
  // one holding the stat row and the tabs together.
  breakdownHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Layout.spacing.md,
    marginBottom: 0,
  },
  breakdownTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
  },

  // Dark and filled, not a text link. It leaves this screen for another, which is
  // a bigger move than anything else on the panel and should look like one.
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Layout.radius.full,
    backgroundColor: '#2B2E32',
  },
  reportBtnText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },

  // ── Identity card ──────────────────────────────────────────────────────────
  // Colour comes from the gradient at the call site; the shadow takes the brand
  // teal so the card does not cast the app's default blue over a green surface.
  idCard: {
    borderRadius: 28,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
    ...Layout.shadow.md,
    shadowColor: Colors.brand,
  },
  // Radius repeated rather than clipping the gradient with overflow:hidden — a
  // clipping view swallows its own shadow on iOS, and the card wants its lift.
  // Near-black teal rather than neutral black, so it deepens the hue instead of
  // greying it.
  idScrim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(11,42,40,0.40)',
  },
  idBody: { flexDirection: 'row', gap: Layout.spacing.lg, flexWrap: 'wrap' },

  idLeft:  { minWidth: 200, justifyContent: 'flex-start' },
  idRight: { flex: 1, minWidth: 260, gap: 12 },

  idAvatarWrap: { alignSelf: 'flex-start' },
  idAvatar: {
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  // On the photo's corner, carrying the child's own avatar hue — the one thing a
  // teacher recognises before reading, which the card's own colour would lose.
  //
  // Ringed in white rather than in the card's colour: the card is a gradient now,
  // so no single value matches it at the badge's position, and two of the five
  // avatar hues are greens that would sink into it without a break.
  idAvatarBadge: {
    position: 'absolute',
    right: -4, bottom: -4,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  idName: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: Layout.spacing.md,
  },
  idChips: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  idChip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: Layout.radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  idChipText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.5,
  },
  idDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  idAge: { fontSize: Layout.fontSize.sm, color: 'rgba(255,255,255,0.90)' },

  // Wraps, and the tiles are allowed to be narrow. Two 160px minimums in a
  // non-wrapping row needed 328pt in a column that is 294 on a portrait phone,
  // so the second tile ran off the card.
  idFactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  idFact: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    // 0.06 was calibrated against the charcoal card it used to sit on. On a
    // mid-tone teal it lifts the surface by 1.05x — invisible — so the tiles had
    // stopped reading as tiles. 0.14 plus a hairline gives them their edge back.
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  idFactIcon: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  idFactLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.90)',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  idFactValue: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    marginTop: 3,
  },

  // Same surface as the fact tiles either side of it, for the same reason.
  idNote: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  idNoteBadge: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  idNoteQuote: { fontSize: 20, lineHeight: 26, color: 'rgba(255,255,255,0.9)', fontFamily: 'DMSans_800ExtraBold' },
  idNoteText: {
    fontSize: Layout.fontSize.sm,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 20,
    marginTop: 3,
  },


  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.xxl,
    gap: Layout.spacing.lg,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  // backgroundColor and shadowColor are both supplied at the call site from the
  // student's avatar theme; everything else about the card is fixed.
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

  // ── Panel, large variant ──────────────────────────────────────────────────
  panelShadowWrapLg: { borderRadius: Layout.radius.xl, ...Layout.shadow.md },
  panelLg: { borderRadius: Layout.radius.xl, borderWidth: 1, borderColor: Colors.borderLight },
  // No tinted fill and no rule under it. At this width a coloured band read as a
  // stripe across the panel; the space below the title is what separates the
  // header from the tabs instead.
  panelHeaderLg: {
    gap: Layout.spacing.md,
    paddingHorizontal: PANEL_PAD_LG,
    paddingTop: PANEL_PAD_LG,
    paddingBottom: Layout.spacing.lg,
    borderBottomWidth: 0,
  },
  panelIconLg: { width: 52, height: 52, borderRadius: 16 },
  panelTitleLg: {
    fontSize: Layout.fontSize.xxl,
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  panelActionLg: { fontSize: Layout.fontSize.md },

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
  // A single recessed track with the four tabs inside it. The track is what makes
  // the unselected tabs read as available rather than as disabled text — they
  // have no fill or border of their own, so the group has to supply the edge.
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 5,
    marginHorizontal: PANEL_PAD_LG,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  tab: {
    // Equal shares of the track, so the four sit on a regular rhythm rather than
    // each taking the width of its own label.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: Layout.radius.md,
  },
  tabActive: {
    backgroundColor: SECTION.progress.fg,
    ...Layout.shadow.sm,
    shadowColor: SECTION.progress.fg,
  },
  tabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.secondary,
  },
  tabTextActive: { color: '#FFFFFF' },

  // ── Concept Learning ──────────────────────────────────────────────────────
  // Both sit in the same box the stat row would occupy, so switching to a module
  // that has not shipped does not collapse the panel to a third of its height.
  conceptLoading: {
    minHeight: 232,
    margin: PANEL_PAD_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  conceptEmpty: {
    minHeight: 232,
    margin: PANEL_PAD_LG,
    paddingHorizontal: Layout.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.md,
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  conceptEmptyText: {
    fontSize: Layout.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Layout.fontSize.md * 1.55,
    maxWidth: 380,
  },
  retryText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text.link,
    fontFamily: 'DMSans_700Bold',
  },
  // `stretch` is what squares the two sides off against each other: the grid's
  // two fixed-height rows set the row's height, and the ring card grows to match
  // rather than ending short and leaving a notch beside it.
  //
  // Wrapping, not a hard breakpoint. On a portrait tablet the two bases fit side
  // by side; on a phone the grid drops below the ring and both go full width,
  // without either needing to know which device it is on.
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: CARD_GAP,
  },
  statGrid: {
    flexGrow: 1.5,
    flexBasis: 340,
    minWidth: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
});
