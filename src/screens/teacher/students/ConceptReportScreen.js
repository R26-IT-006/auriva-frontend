import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/common/Card';
import { ImageViewerModal } from '../../../components/common/ImageViewerModal';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
import { AccuracyChart } from '../../../components/charts/AccuracyChart';
import { GroupProgress } from '../../../components/charts/GroupProgress';
import { ConceptThumb, conceptLabel } from '../../../components/charts/ConceptThumb';
import { MixUpCard, MixUpEmpty } from '../../../components/charts/MixUpCard';
import { DayByDay } from '../../../components/charts/DayByDay';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { scoreColor } from '../../../utils/scoreColor';
import { formatDateTime } from '../../../utils/formatters';
import {
  HEADING, SUBHEADING, ROUND_BY_STATUS_KEY,
  countOf, seconds, duration, tries, firstNameOf, overviewSentence, difficultyWord,
} from '../../../constants/teacherWording';

const TIER_LABEL = ROUND_BY_STATUS_KEY;

/**
 * A section of the report, optionally collapsed.
 *
 * `summary` is what makes collapsing safe. A closed section that shows only its
 * title tells a teacher nothing about whether opening it is worth their time, so
 * collapsing quietly turns into hiding. The summary line carries the section's
 * single most useful fact on the header itself — "4 of 9 started", "usually about
 * 4 seconds" — so the fact survives even when the detail is folded away.
 *
 * Detail sections default closed; the two a teacher acts on stay open.
 */
function Section({ title, subtitle, summary, children, right, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  const head = (
    <View style={styles.sectionHead}>
      {collapsible && (
        <Ionicons
          name={isOpen ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={Colors.text.muted}
          style={styles.sectionChevron}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {/* When closed, the summary replaces the subtitle: the subtitle explains
            how to read the contents, which is not useful until they are visible. */}
        {isOpen
          ? (subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null)
          : (summary ? <Text style={styles.sectionSummary}>{summary}</Text> : null)}
      </View>
      {right}
    </View>
  );

  return (
    <View style={styles.section}>
      {collapsible ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`${title}. ${isOpen ? 'Tap to hide' : 'Tap to show'}`}
        >
          {head}
        </TouchableOpacity>
      ) : head}

      {isOpen && <Card style={styles.card}>{children}</Card>}
    </View>
  );
}

/**
 * A headline number as a tile: icon badge, value, label.
 *
 * The plain number-over-label version made the three figures read as one run-on
 * row, and a teacher scanning for "how many need another look" had to read all
 * three labels to find it. Giving each its own surface and a badge means the row
 * can be scanned by shape and colour before any of it is read.
 *
 * `tone` colours the badge by what the number MEANS, not by position — green for
 * things learned, blue for progress, amber only when there is something to act on.
 * A count of zero on "worth another look" is good news and must not wear a warning
 * colour, so the tone is chosen by the caller from the value.
 */
function StatTile({ label, value, icon, tone = 'neutral' }) {
  const t = STAT_TONES[tone] || STAT_TONES.neutral;
  return (
    <View style={styles.statTile}>
      <View style={[styles.statBadge, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={14} color={t.fg} />
      </View>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const STAT_TONES = {
  good:    { bg: '#E6F4EA', fg: '#2A7146' },
  info:    { bg: '#E5EEF9', fg: '#27609F' },
  warn:    { bg: '#FAF0DF', fg: '#945D08' },
  neutral: { bg: Colors.surfaceAlt, fg: Colors.text.muted },
};

/** Kept for the rows that are genuinely a bare figure — game counts, time spent. */
function StatCell({ label, value, tint }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statCellValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

/**
 * A game's result as one dot per round, filled for right and hollow for wrong.
 *
 * "4/6" and a colour is a number a teacher decodes; six dots is a shape they read.
 * It also shows the size of the thing — a 3-round game and a 6-round game score
 * the same 100% but are not the same evidence, and the fraction hid that.
 */
function ScorePips({ correct = 0, total = 0 }) {
  if (!total) return null;
  const capped = Math.min(total, 8);
  return (
    <View style={styles.pips}>
      {Array.from({ length: capped }, (_, i) => (
        <View key={i} style={[styles.pip, i < correct ? styles.pipOn : styles.pipOff]} />
      ))}
    </View>
  );
}

/**
 * Right-versus-wrong answer speed as two bars against the same scale.
 *
 * Three numbers in a row made the teacher subtract to find the point. The point
 * is which bar is longer, so draw the bars.
 */
function SpeedBars({ correctMs, incorrectMs }) {
  if (!correctMs && !incorrectMs) return null;
  const peak = Math.max(correctMs || 0, incorrectMs || 0, 1);
  const rows = [
    { label: 'When right', ms: correctMs,   color: '#3FAE6F' },
    { label: 'When wrong', ms: incorrectMs, color: '#E0A030' },
  ];
  return (
    <View style={styles.speedWrap}>
      {rows.map((r) => (
        <View key={r.label} style={styles.speedRow}>
          <Text style={styles.speedLabel}>{r.label}</Text>
          <View style={styles.speedTrack}>
            <View
              style={[
                styles.speedFill,
                { width: `${Math.max(6, ((r.ms || 0) / peak) * 100)}%`, backgroundColor: r.color },
              ]}
            />
          </View>
          <Text style={styles.speedValue}>{seconds(r.ms)}</Text>
        </View>
      ))}
    </View>
  );
}

/** "12 Aug" — enough to place an activity in the week without a full date. */
function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function TierPill({ status }) {
  const map = {
    passed:      { bg: '#E6F7EE', fg: '#22A05F', icon: 'checkmark' },
    failed:      { bg: Colors.status.errorLight, fg: Colors.status.error, icon: 'close' },
    in_progress: { bg: Colors.status.warningLight, fg: '#B4780A', icon: 'ellipsis-horizontal' },
    not_started: { bg: Colors.surfaceAlt, fg: Colors.text.muted, icon: 'remove' },
    locked:      { bg: Colors.surfaceAlt, fg: Colors.icon.muted, icon: 'lock-closed' },
  };
  const s = map[status] || map.not_started;
  return (
    <View style={[styles.tierPill, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={11} color={s.fg} />
    </View>
  );
}

export default function ConceptReportScreen({ route, navigation }) {
  const student = route.params?.student;
  const { width } = useWindowDimensions();
  // Same theme the child sees in the activities and the profile hero, so the one
  // coloured control in the drawing dialog belongs to this student too.
  const theme = getAvatarTheme(student?.avatar_key);

  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showAllWork, setShowAllWork] = useState(false);
  // The drawing being looked at full-size, or null. Holding the artwork itself
  // rather than a boolean keeps the title and date in the modal correct while it
  // animates out.
  const [openArt, setOpenArt] = useState(null);

  // Deliberately separate from `report`: the narrative is a model call that can be
  // slow, disabled, or fail outright, and none of that may hold up or break the
  // report itself. Its errors are swallowed — an absent card, never a banner.
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeRefreshing, setNarrativeRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!student?.sid) return;
    try {
      setError(null);
      setReport(await teacherApi.getConceptReport(student.sid));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student?.sid]);

  const loadNarrative = useCallback(async (refresh = false) => {
    if (!student?.sid) return;
    if (refresh) setNarrativeRefreshing(true); else setNarrativeLoading(true);
    try {
      setNarrative(await teacherApi.getConceptNarrative(student.sid, refresh));
    } catch {
      setNarrative({ available: false });
    } finally {
      setNarrativeLoading(false);
      setNarrativeRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => { load(); }, [load]);

  // Chained off `report` rather than fired alongside it: on a cache miss this is
  // the slowest request on the screen, and there is no reason to have it
  // competing with the data the teacher actually came for.
  useEffect(() => {
    if (report) loadNarrative(false);
  }, [report, loadNarrative]);

  useEffect(() => {
    navigation.setOptions({ title: student?.full_name ? `${student.full_name} · Concepts` : 'Concept Report' });
  }, [navigation, student?.full_name]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.icon.active} /></View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={34} color={Colors.text.muted} />
          <Text style={styles.errorText}>{error || 'Could not load the report.'}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Everything defaulted. `days` and `mix_ups` are new fields, so a client running
  // against a backend that has not been restarted yet gets a working report rather
  // than a crash — and the same guard covers a partial response from any cause.
  const {
    totals = {},
    categories = [],
    concepts = [],
    response_times: rt = {},
    engagement = {},
    activities = [],
    timeline = [],
    days = [],
    mix_ups: mixUps = [],
  } = report;
  const activeCategories = categories.filter((c) => c.started > 0);

  // Two pair-cards per row on a tablet, one on a phone. Below this a half-width
  // card cannot fit two thumbnails, the swap arrow and a sentence without the
  // labels wrapping mid-word.
  const twoCol = width >= 720;

  // Declared before workList below, which consumes it. It used to sit further down
  // the file, and Babel compiles `const` to `var` — so instead of a temporal-dead-zone
  // error naming the variable, `struggling` was simply `undefined` at the point
  // workList read it, and the screen died on `undefined.filter`.
  //
  // "Worth another look" = failed, or passed-but-weak. Worst first, so the top of
  // the list is where a teacher should start.
  const struggling = concepts
    .filter((c) => c.tier1_status === 'failed' || c.tier2_status === 'failed'
      || (typeof c.tier1_score === 'number' && c.tier1_score < 2 / 3))
    .sort((a, b) => (a.tier1_score ?? 1) - (b.tier1_score ?? 1));
  const name = firstNameOf(student?.full_name);

  // The model's per-pair sentences, keyed the way it was asked to key them so each
  // lands on the right card. Matching by position would silently mis-attribute an
  // explanation the moment the model reorders or omits one, and a wrong reason on a
  // mix-up card is worse than no reason.
  const noteFor = {};
  for (const n of narrative?.summary?.mix_up_notes || []) {
    if (n?.pair && n?.note) noteFor[n.pair] = n.note;
  }

  // What the model is still allowed to say on this screen. Its `watch_areas`,
  // `mix_ups` and `suggested_focus` lists are deliberately not rendered any more:
  // every one of them restated something a section below shows with pictures and
  // counts, so a teacher met the same fact two and three times and could not tell
  // which mentions were new. The model keeps the two jobs nothing else can do —
  // the opening sentence, and the per-pair explanations on the mix-up cards.
  const aiHeadline = narrative?.available ? narrative.summary?.headline : null;
  const strengths  = (narrative?.available && narrative.summary?.strengths) || [];
  const caveat     = narrative?.available ? narrative.summary?.caveat : null;

  // The one list a teacher acts on, built from the two that used to be separate.
  //
  // Pairs come first, and not just for variety: a muddled pair arrives with an
  // explanation attached, and a reason is the part you can do something about. A
  // struggling concept on its own says "this is hard" and stops there.
  //
  // A concept already named in a pair is dropped from the singles, which is the
  // overlap that made two lists confusing — mango appearing in both read as two
  // problems when it is one.
  const pairedKeys = new Set(mixUps.flatMap((m) => [m.concept_a, m.concept_b]));
  const workList = [
    ...mixUps.map((item) => ({ kind: 'pair', item })),
    ...struggling
      .filter((c) => !pairedKeys.has(c.concept_key))
      .map((item) => ({ kind: 'concept', item })),
  ];

  // Header lines for the folded sections. Without these, collapsing hides the fact
  // as well as the detail — see the note on Section.
  const furthest = [...categories]
    .filter((c) => c.started > 0 && c.total > 0)
    .sort((a, b) => b.mastered / b.total - a.mastered / a.total)[0];
  const groupSummary = activeCategories.length === 0
    ? 'Nothing started yet'
    : `${activeCategories.length} of ${categories.length} started`
      + (furthest ? ` · ${furthest.label} furthest along` : '');

  const gamesTotal = activities.reduce((n, a) => n + (a.total_rounds || 0), 0);
  const gamesRight = activities.reduce((n, a) => n + (a.correct_count || 0), 0);
  const gamesSummary = activities.length === 0
    ? 'None played yet'
    : `${activities.length} played · got ${countOf(gamesRight, gamesTotal)} right`;

  const headline = aiHeadline || overviewSentence({
    name,
    learned:   totals.mastered,
    catalogue: totals.catalogue_concepts,
    mixUps:    mixUps.length,
    days:      days.length,
  });

  // Fast-and-wrong suggests guessing; slow-and-right suggests effortful recall.
  // Only worth surfacing when there is a real sample behind it.
  const guessing = rt.sample_size >= 10
    && rt.incorrect_avg_ms != null && rt.correct_avg_ms != null
    && rt.incorrect_avg_ms < rt.correct_avg_ms * 0.8;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* The glance layer, and now the ONLY thing above the fold.

            The summary card and the AI card used to be two cards saying the same
            thing in two voices — a computed sentence in one, the model's headline
            in the other, with the trend chart in a third section below. They are
            one idea: "how is this child doing?" So they are one card.

            The model's headline is preferred over the computed sentence because it
            can say things the template cannot; the template stays as the fallback
            for when the feature is off or the call failed, so the card never opens
            with a blank space where the summary should be. */}
        <Card style={styles.card}>
          <View style={styles.overview}>
            <MasteryRing value={totals.mastery_pct} size={104} label="learned" />

            <View style={styles.overviewStats}>
              {/* Each icon says what its number counts, not what the app is about.
                  A graduation cap on "Learned" and a picture frame on "Finds the
                  picture" both described the product rather than the figure —
                  double-tick reads as finished, an eye reads as recognised. */}
              <StatTile
                icon="checkmark-done-outline"
                label="Learned"
                value={countOf(totals.mastered, totals.catalogue_concepts)}
                tone="good"
              />
              <StatTile
                icon="eye-outline"
                label="Finds the picture"
                value={String(totals.tier1_passed)}
                tone="info"
              />
              {/* Amber only when there is actually something to look at. Zero here
                  is good news, and dressing it in a warning colour would have the
                  row read as a problem on the child's best possible day. */}
              {/* `repeat`, not `refresh`. Refresh means reload the screen — a
                  control, not a count. Repeat means go over it again, which is
                  what the number is telling the teacher to do. */}
              <StatTile
                icon="repeat-outline"
                label="Worth another look"
                value={String(struggling.length)}
                tone={struggling.length > 0 ? 'warn' : 'neutral'}
              />
            </View>
          </View>

          <View style={styles.glanceBlock}>
            <Text style={styles.glance}>{headline}</Text>

            {/* Provenance stays visible even though the card is no longer badged as
                an AI panel. A teacher acting on a sentence should know a machine
                wrote it, and the refresh has to remain reachable. */}
            {/* While the summary is still being written the card already shows the
                computed sentence, so this says a better one is coming rather than
                letting the text change under the reader with no explanation. */}
            {narrativeLoading && !aiHeadline ? (
              <View style={styles.aiRow}>
                <ActivityIndicator size="small" color={Colors.icon.muted} />
                <Text style={styles.aiTag}>Writing a fuller summary…</Text>
              </View>
            ) : null}

            {aiHeadline ? (
              <View style={styles.aiRow}>
                <Ionicons name="sparkles" size={11} color={Colors.primary} />
                <Text style={styles.aiTag}>Written from {name}'s activity</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => loadNarrative(true)}
                  disabled={narrativeRefreshing}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {narrativeRefreshing
                    ? <ActivityIndicator size="small" color={Colors.icon.muted} />
                    : <Ionicons name="refresh" size={14} color={Colors.icon.default} />}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Two at most. The model returns up to three and the third is reliably
                the weakest — it is what it writes when it has run out of things to
                say, which is exactly the padding rule 4 forbids. */}
            {strengths.slice(0, 2).map((s, i) => (
              <View key={i} style={styles.strengthRow}>
                <Ionicons name="trending-up-outline" size={13} color="#22A05F" />
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* The trend belongs to the headline — it is the evidence for "getting
              better" or "holding steady" — so it sits in this card rather than
              owning a section of its own. */}
          <View style={styles.trendWrap}>
            <AccuracyChart
              points={timeline}
              width={width - Layout.spacing.lg * 2 - Layout.spacing.md * 2}
              height={132}
            />
          </View>
        </Card>

        {/* One section, not two. "Mixed up" and "Worth another look" both answered
            "where do I put my attention?", and a concept is frequently in both —
            so a teacher read two lists and had to work out the overlap themselves.
            Muddled pairs lead because they arrive with a reason attached, and a
            reason is the part you can act on. */}
        <Section
          title="What to work on"
          subtitle={workList.length ? 'Most worth your time first' : null}
        >
          {/* A wrapping grid, two pair-cards to a row on a tablet. Stacked full
              width they ran to a very tall column for what is a short list, and
              each card is squarish — two side by side let a teacher take in the
              whole list without scrolling.

              Single concepts stay full width: they are a row, not a card, and at
              half width they would leave a ragged hole beside them. Because pairs
              always sort ahead of singles, the pairs fill their rows first and the
              singles land underneath on their own lines. */}
          {workList.length === 0 ? (
            <MixUpEmpty />
          ) : (
            <View style={styles.mixUpList}>
              {workList.slice(0, showAllWork ? workList.length : 4).map((w) =>
                w.kind === 'pair' ? (
                  <View
                    key={`p:${w.item.category_key}/${w.item.concept_a}|${w.item.concept_b}`}
                    style={twoCol ? styles.pairHalf : styles.pairFull}
                  >
                    <MixUpCard
                      pair={w.item}
                      note={noteFor[`${w.item.concept_a}|${w.item.concept_b}`]}
                    />
                  </View>
                ) : (
                  <View key={`c:${w.item.category_key}/${w.item.concept_key}`} style={styles.workRow}>
                    <ConceptThumb
                      categoryKey={w.item.category_key}
                      conceptKey={w.item.concept_key}
                      size={40}
                      tone="tricky"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.strugglingName}>
                        {conceptLabel(w.item.category_key, w.item.concept_key)}
                      </Text>
                      <Text style={styles.strugglingMeta}>
                        Got {countOf(w.item.correct_attempts, w.item.real_attempts)} right
                        {w.item.avg_response_ms ? ` · ${seconds(w.item.avg_response_ms)} each` : ''}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
          )}

          {/* Outside the wrapping grid — inside it, the button became another flex
              item and tried to sit beside a card. */}
          {workList.length > 4 && (
            <TouchableOpacity
              style={styles.moreBtn}
              activeOpacity={0.7}
              onPress={() => setShowAllWork((v) => !v)}
            >
              <Text style={styles.moreText}>
                {showAllWork ? 'Show fewer' : `Show ${workList.length - 4} more`}
              </Text>
              <Ionicons
                name={showAllWork ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={Colors.text.link}
              />
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Recent sessions" subtitle={SUBHEADING.dayByDay}>
          <DayByDay days={days} onOpenArtwork={setOpenArt} accent={theme.button} />
        </Section>

        {/* From here down is reference rather than action, so it starts folded.
            Each header carries the one fact worth knowing without opening it. */}
        <Section
          title={HEADING.categories}
          subtitle="Tap a group to see the things inside it"
          summary={groupSummary}
          collapsible
          defaultOpen={false}
        >
          <View style={styles.groupChartWrap}>
            <GroupProgress categories={categories} />
          </View>

          <View style={styles.categoryBlock}>
            {activeCategories.length === 0 ? (
              <Text style={styles.muted}>No group started yet.</Text>
            ) : (
              <>
                {activeCategories.map((c) => {
                  const isOpen = expanded === c.category_key;
                  const rows = concepts.filter((x) => x.category_key === c.category_key);
                  return (
                    <View key={c.category_key}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setExpanded(isOpen ? null : c.category_key)}
                      >
                        <TierBar
                          label={c.label}
                          total={c.total}
                          tier1={c.tier1_passed}
                          tier2={c.tier2_passed}
                          tier3={c.tier3_passed}
                          right={`${c.mastered}/${c.total}`}
                        />
                      </TouchableOpacity>

                      {isOpen && (
                        <View style={styles.conceptRows}>
                          {rows.map((r) => (
                            <View key={r.concept_key} style={styles.conceptRow}>
                              <ConceptThumb
                                categoryKey={r.category_key}
                                conceptKey={r.concept_key}
                                size={26}
                              />
                              <Text style={styles.conceptName} numberOfLines={1}>
                                {conceptLabel(r.category_key, r.concept_key)}
                                {r.in_catalogue ? '' : ' *'}
                              </Text>
                              <View style={styles.pills}>
                                {Object.keys(TIER_LABEL).map((k) => (
                                  <TierPill key={k} status={r[k]} />
                                ))}
                              </View>
                              <Text style={[styles.conceptScore, { color: scoreColor(r.tier1_score) }]}>
                                {r.real_attempts > 0 ? `${r.correct_attempts}/${r.real_attempts}` : '—'}
                              </Text>
                              <Text style={styles.conceptMeta}>
                                {r.real_attempts > 0 ? tries(r.real_attempts) : '—'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
                <TierLegend />
              </>
            )}
          </View>
        </Section>

        {/* Answer speed and time spent were two sections of behavioural context,
            neither of which is a finding on its own. Together they answer one
            question — how does this child go about it? */}
        <Section
          title="How they work"
          subtitle={rt.sample_size > 0 ? `Based on ${tries(rt.sample_size)}` : 'No timed answers yet'}
          summary={rt.overall_avg_ms ? `Usually ${seconds(rt.overall_avg_ms)} per answer` : 'No timed answers yet'}
          collapsible
          defaultOpen={false}
        >
          <View style={styles.padded}>
            <Text style={styles.rtLead}>
              {name} usually answers in {seconds(rt.overall_avg_ms)}.
            </Text>
            <SpeedBars correctMs={rt.correct_avg_ms} incorrectMs={rt.incorrect_avg_ms} />
            {guessing && (
              <View style={styles.hint}>
                <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
                <Text style={styles.hintText}>
                  {name} answers faster when wrong than when right. That often means guessing
                  rather than not knowing — slowing the pace may help more than going over the
                  same material again.
                </Text>
              </View>
            )}

            <View style={styles.subDivider} />

            <View style={styles.engagementGrid}>
              <StatCell label="Pictures tapped" value={String(engagement.total_taps)} />
              <StatCell label="Looking at pictures" value={duration(engagement.exposure_ms)} />
              <StatCell label="Watching videos" value={duration(engagement.video_ms)} />
              <StatCell label="Colouring" value={String(engagement.coloring_sessions)} />
              {engagement.relearn_count > 0 && (
                <StatCell label="Went over again" value={String(engagement.relearn_count)} />
              )}
            </View>
          </View>
        </Section>

        {activities.length > 0 && (
          <Section
            title={HEADING.games}
            subtitle={SUBHEADING.games}
            summary={gamesSummary}
            collapsible
            defaultOpen={false}
          >
            <View style={styles.padded}>
              {/* Four, not eight. Older than the last handful is history rather
                  than information — the trend it would show is already the chart
                  in the summary card. */}
              {activities.slice(0, 4).map((a, i) => (
                <View key={`${a.category_key}-${a.activity_number}-${i}`} style={styles.activityRow}>
                  {/* Which concepts the game covered, as the pictures themselves.
                      A comma-separated list of names made the teacher reconstruct
                      the game in their head; three thumbnails just show it. */}
                  <View style={styles.activityThumbs}>
                    {(a.concept_keys || []).slice(0, 3).map((k) => (
                      <ConceptThumb key={k} categoryKey={a.category_key} conceptKey={k} size={30} />
                    ))}
                    {(a.concept_keys || []).length > 3 && (
                      <Text style={styles.activityMore}>+{a.concept_keys.length - 3}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>
                      Got {countOf(a.correct_count, a.total_rounds)} right
                    </Text>
                    <Text style={styles.activityMeta}>
                      {difficultyWord(a.difficulty_level)}
                      {a.completed_at ? ` · ${shortDate(a.completed_at)}` : ''}
                    </Text>
                  </View>
                  <ScorePips correct={a.correct_count} total={a.total_rounds} />
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* The model's own statement of what it does not know. Kept at the bottom
            rather than under the headline: it qualifies the whole report, and
            putting it directly beneath the opening sentence made the first thing a
            teacher read into a disclaimer. */}
        {caveat ? <Text style={styles.caveat}>{caveat}</Text> : null}

        <Text style={styles.footnote}>
          Covers the last {report.window_days} days.
          {concepts.some((c) => !c.in_catalogue) ? '  * no longer in the list of things taught.' : ''}
        </Text>
      </ScrollView>

      {/* Outside the ScrollView: a Modal nested in a scroller inherits its
          clipping on Android and comes up cropped. */}
      <ImageViewerModal
        visible={!!openArt}
        uri={openArt?.image_url}
        title={openArt ? conceptLabel(openArt.category_key, openArt.concept_key) : ''}
        subtitle={openArt ? formatDateTime(openArt.created_at) : ''}
        accent={theme.button}
        accentText={theme.buttonText}
        onClose={() => setOpenArt(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  scroll:   { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm, padding: Layout.spacing.xl },
  errorText:{ fontSize: Layout.fontSize.sm, color: Colors.text.secondary, textAlign: 'center' },
  retry:    { fontSize: Layout.fontSize.sm, color: Colors.text.link, fontFamily: 'DMSans_700Bold' },

  card:    { marginBottom: 0 },
  section: { marginTop: Layout.spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Layout.spacing.sm },
  sectionTitle: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  sectionSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  // Darker than the subtitle: when a section is closed this line IS the content,
  // so it should not read as secondary to a heading nobody can act on.
  sectionSummary: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 1 },
  sectionChevron: { marginRight: 6, marginBottom: 2 },

  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  subDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Layout.spacing.md,
  },
  moreBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6 },
  moreText: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: Colors.text.link },
  padded:  { padding: Layout.spacing.md },
  muted:   { fontSize: Layout.fontSize.sm, color: Colors.text.muted },

  overview:      { flexDirection: 'row', alignItems: 'center', padding: Layout.spacing.md, gap: Layout.spacing.lg },
  // Three equal tiles that stay on one line. They wrapped before, so on a narrow
  // tablet the third dropped underneath and the row lost its shape.
  overviewStats: { flex: 1, flexDirection: 'row', gap: Layout.spacing.sm },

  // Tightened all round. These are three supporting figures beside the ring, and
  // at the old size they took more height than the ring itself — a summary card
  // where the summary was the smallest thing on it.
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  statTileValue: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_800ExtraBold',
    color: Colors.text.primary,
  },
  statTileLabel: {
    fontSize: 10,
    color: Colors.text.secondary,
    textAlign: 'center',
    // Tight enough that "Worth another look" wrapping to two lines does not make
    // its tile taller than the two beside it.
    lineHeight: 13,
  },

  // The glance sentence. Separated from the stats by a hairline rather than a gap:
  // it is a reading OF those numbers, not a separate fact alongside them.
  glanceBlock: {
    paddingHorizontal: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 2,
    gap: 6,
  },
  glance: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.primary,
    lineHeight: 21,
  },
  aiRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiTag:  { fontSize: 10, color: Colors.text.muted },

  strengthRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  strengthText: { flex: 1, fontSize: Layout.fontSize.sm, color: Colors.text.secondary, lineHeight: 18 },

  caveat: {
    marginTop: Layout.spacing.lg,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
    color: Colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  mixUpList: {
    padding: Layout.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.md,
  },
  // 48%, not 50%: the gap between the two has to come out of the row somewhere,
  // and at 50% the second card wraps to its own line on every width.
  pairHalf: { width: '48%' },
  pairFull: { width: '100%' },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  trendWrap:      { padding: Layout.spacing.md },
  groupChartWrap: { padding: Layout.spacing.md },
  categoryBlock: { padding: Layout.spacing.md, gap: Layout.spacing.sm },

  conceptRows: {
    marginTop: Layout.spacing.sm,
    marginBottom: Layout.spacing.xs,
    marginLeft: Layout.spacing.sm,
    paddingLeft: Layout.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
    gap: 6,
  },
  conceptRow:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  conceptName: { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  pills:       { flexDirection: 'row', gap: 3 },
  tierPill:    { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  conceptScore:{ width: 42, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold' },
  conceptMeta: { width: 56, textAlign: 'right', fontSize: 10, color: Colors.text.muted },

  strugglingName:  { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  strugglingMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  rtLead: { fontSize: Layout.fontSize.sm, color: Colors.text.primary, marginBottom: Layout.spacing.sm },

  speedWrap:  { gap: 8 },
  speedRow:   { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  speedLabel: { width: 74, fontSize: Layout.fontSize.xs, color: Colors.text.secondary },
  speedTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: Colors.surfaceAlt, overflow: 'hidden',
  },
  speedFill:  { height: '100%', borderRadius: 5 },
  speedValue: { width: 92, textAlign: 'right', fontSize: Layout.fontSize.xs, color: Colors.text.secondary },

  pips:   { flexDirection: 'row', gap: 3, alignItems: 'center' },
  pip:    { width: 8, height: 8, borderRadius: 4 },
  pipOn:  { backgroundColor: '#3FAE6F' },
  pipOff: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },

  activityThumbs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityMore:   { fontSize: 10, color: Colors.text.muted, fontFamily: 'DMSans_700Bold' },
  hint: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Layout.spacing.md,
    padding: Layout.spacing.sm,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.status.warningLight,
  },
  hintText: { flex: 1, fontSize: Layout.fontSize.xs, color: '#8A5D06', lineHeight: 17 },

  engagementGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },

  activityRow:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm, paddingVertical: 7 },
  activityTitle:   { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  activityMeta:    { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  footnote: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
