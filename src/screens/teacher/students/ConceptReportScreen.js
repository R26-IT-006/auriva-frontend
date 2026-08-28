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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/common/Card';
import { ImageViewerModal } from '../../../components/common/ImageViewerModal';
import { AccuracyChart } from '../../../components/charts/AccuracyChart';
import { GroupProgress } from '../../../components/charts/GroupProgress';
import { ConceptThumb, conceptLabel } from '../../../components/charts/ConceptThumb';
import { MixUpCard, MixUpEmpty } from '../../../components/charts/MixUpCard';
import { DayByDay } from '../../../components/charts/DayByDay';
import { Colors, BACKDROP } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { scoreColor } from '../../../utils/scoreColor';
import { formatDateTime } from '../../../utils/formatters';
import {
  HEADING, SUBHEADING, ROUND_BY_STATUS_KEY,
  countOf, seconds, duration, tries, firstNameOf, overviewSentence, difficultyWord, GAME_NAME,
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
function Section({
  title, subtitle, summary, children, right, icon, tone = 'neutral',
  collapsible = false, defaultOpen = true, inPair = false, headerInside = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  const t = STAT_TONES[tone] || STAT_TONES.neutral;

  const head = (
    <View style={styles.sectionHead}>
      {/* An icon per section, so the page can be navigated by shape before any of
          it is read. Five headings set in the same weight and colour made one
          undifferentiated ladder — a teacher scrolling for the games had to read
          every title on the way past. */}
      {icon ? (
        <View style={[styles.sectionIcon, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={17} color={t.fg} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {/* When closed, the summary replaces the subtitle: the subtitle explains
            how to read the contents, which is not useful until they are visible. */}
        {isOpen
          ? (subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null)
          : (summary ? <Text style={styles.sectionSummary}>{summary}</Text> : null)}
      </View>

      {right}

      {/* Moved to the trailing edge. On the left it sat between the page margin and
          the title, so the five headings started at two different indents depending
          on whether they happened to fold. */}
      {collapsible ? (
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.icon.default}
          style={styles.sectionChevron}
        />
      ) : null}
    </View>
  );

  const tap = (node) => (collapsible ? (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      accessibilityLabel={`${title}. ${isOpen ? 'Tap to hide' : 'Tap to show'}`}
    >
      {node}
    </TouchableOpacity>
  ) : node);

  // `headerInside` puts the heading in the card rather than above it on the page
  // backdrop. It exists for the paired rows: a section whose heading sits outside
  // starts its CARD lower than a plain Card beside it, so the two cards in a row
  // never line up however they are stretched.
  if (headerInside) {
    return (
      <View style={[styles.section, inPair && styles.sectionInPair]}>
        <Card style={[styles.card, inPair && styles.cardFill]}>
          {tap(<View style={styles.headInCard}>{head}</View>)}
          {isOpen && children}
        </Card>
      </View>
    );
  }

  return (
    // `inPair` drops the top margin and lets the card fill the row. A section
    // sitting beside a bare Card started 32px lower than it — the margin that
    // separates stacked sections has nothing to separate it from at the top of a
    // column — and without the fill the two cards ended at different heights,
    // which is what makes a two-column row look accidental rather than laid out.
    <View style={[styles.section, inPair && styles.sectionInPair]}>
      {tap(head)}
      {isOpen && <Card style={[styles.card, inPair && styles.cardFill]}>{children}</Card>}
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
function StatTile({ label, value, of, note, noteTone, icon, tone = 'neutral' }) {
  const t = STAT_TONES[tone] || STAT_TONES.neutral;
  return (
    // The tile takes its own tint rather than the shared cold grey.
    //
    // This is a learning product, and the teacher's side of it had drifted into
    // reading like a finance dashboard: every surface the same blue-grey, every
    // caption at 10px, colour confined to small badges. Letting each tile sit on
    // the colour it already carries costs nothing — the tints are the validated
    // ones the badges use — and the row stops looking like a spreadsheet header.
    <View style={[styles.statTile, { backgroundColor: t.bg }, tone === 'plain' && styles.statTilePlain]}>
      {/* Badge beside the figure, not above it. Stacked and centred, the tile
          needed three lines of height for one number and the label had to shrink
          to 9px to fit — a row puts the badge in the margin where it costs no
          vertical space and lets the number be the biggest thing in the tile. */}
      {/* White, not the tone's tint — the tile is already wearing that, and a tint
          on a tint at this size turns to mush. On colour, white reads as a chip. */}
      <View style={[styles.statBadge, { backgroundColor: t.chip || '#FFFFFF' }]}>
        <Ionicons name={icon} size={17} color={t.ink || t.fg} />
      </View>

      <View style={styles.statBody}>
        {/* Label first, then the number. Reading order matches the question — a
            teacher asks "how many learned?", so the tile answers in that order
            rather than making them find the number's caption underneath it. */}
        <Text style={[styles.statTileLabel, { color: t.fg }]} numberOfLines={1}>
          {label}
        </Text>

        <View style={styles.statValueRow}>
          <Text style={[styles.statTileValue, { color: t.ink || Colors.text.primary }]}>{value}</Text>
          {/* The denominator, kept small and grey. "9 of 93" set at one size makes
              93 look like part of the answer; the child's score is the 9. */}
          {of ? <Text style={[styles.statTileOf, { color: t.fg }]}>/ {of}</Text> : null}
        </View>

        {note ? (
          <Text style={[styles.statTileNote, { color: t.fg }, noteTone ? { color: noteTone } : null]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// One face per game. The icon names what the game IS — a puzzle piece for
// matching, a brain for recall — so a row of four is scannable before any of the
// titles are read. Keyed on activity_type, never on position.
const GAME_FACE = {
  pair_match: { icon: 'extension-puzzle-outline', bg: '#E6F4EA', fg: '#2A7146' },
  memory:     { icon: 'sparkles-outline',         bg: '#E5EEF9', fg: '#27609F' },
  practice:   { icon: 'shuffle-outline',          bg: '#FBE7E2', fg: '#C4674F' },
};

// The coral the "Wrong" segment of the response-time bar is drawn in. Named once
// and shared, so the Revisit tile and that segment cannot drift apart — they are
// deliberately the same colour, because they are the same idea: the part that is
// not going well.
const WRONG_CORAL = '#EE9080';

const STAT_TONES = {
  good:    { bg: '#E6F4EA', fg: '#2A7146' },
  info:    { bg: '#E5EEF9', fg: '#27609F' },
  warn:    { bg: '#FAF0DF', fg: '#945D08' },
  neutral: { bg: Colors.surfaceAlt, fg: Colors.text.muted },

  // Summary-band tiles, at the design's own values.
  //
  // Noted for whoever reads this next: white on #7A9DB0 measures 2.89:1 and on
  // #EE9080 2.35:1, both under the 4.5:1 floor for body text. Darker steps of the
  // same hues were tried and rejected in favour of the design as drawn. If these
  // figures turn out hard to read on a tablet in classroom light, the fix that
  // keeps the palette is dark ink on these fills rather than white.
  plain:      { bg: '#FFFFFF', fg: Colors.text.secondary, ink: Colors.text.primary, chip: Colors.surfaceAlt },
  solidBlue:  { bg: '#7A9DB0', fg: 'rgba(255,255,255,0.92)', ink: '#FFFFFF', chip: 'rgba(255,255,255,0.28)' },
  solidCoral: { bg: WRONG_CORAL, fg: 'rgba(255,255,255,0.92)', ink: '#FFFFFF', chip: 'rgba(255,255,255,0.28)' },
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
function ScorePips({ correct = 0, total = 0, tone }) {
  if (!total) return null;
  const capped = Math.min(total, 8);
  return (
    <View style={styles.pips}>
      {Array.from({ length: capped }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            // The filled pips take the card's own hue rather than a single green,
            // so each card reads as one object instead of a tinted badge with an
            // unrelated score under it.
            i < correct
              ? [styles.pipOn, tone ? { backgroundColor: tone } : null]
              : styles.pipOff,
          ]}
        />
      ))}
    </View>
  );
}

/** "6.5s" — the compact form, for a headline figure where the sentence is elsewhere. */
function shortSeconds(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = ms / 1000;
  return s < 10 ? `${Math.round(s * 10) / 10}s` : `${Math.round(s)}s`;
}

function pctOf(part, total) {
  if (!total || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((Number(part) || 0) / total * 100);
}

/**
 * One bar divided between two measures, with the labels underneath.
 *
 * Used for right-versus-wrong answer speed, where the point is which side is
 * bigger. Two separate bars measured against a shared peak said the same thing
 * in twice the height, and in a narrow column the second bar's label wrapped.
 */
function SplitBar({ parts = [] }) {
  const usable = parts.filter((p) => Number(p.ms) > 0);
  if (usable.length === 0) return null;

  return (
    <View style={styles.splitBarWrap}>
      <View style={styles.splitBarTrack}>
        {usable.map((p, i) => (
          <View
            key={p.key}
            style={[
              styles.splitBarSeg,
              { flexGrow: Number(p.ms), backgroundColor: p.color, marginLeft: i === 0 ? 0 : 2 },
            ]}
          />
        ))}
      </View>
      <View style={styles.splitBarLegend}>
        {usable.map((p) => (
          <View key={p.key} style={styles.splitBarLegendItem}>
            <View style={[styles.splitBarDot, { backgroundColor: p.color }]} />
            <Text style={[styles.splitBarLabel, { color: p.color }]}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const TIME_TONES = {
  info:  { bg: '#E5EEF9', fg: '#4A7C95' },
  coral: { bg: '#FBE7E2', fg: '#C4674F' },
};

/** A named share of the child's time: icon, label, percentage. */
function TimeRow({ icon, tone, label, pct }) {
  const t = TIME_TONES[tone] || TIME_TONES.info;
  return (
    <View style={styles.timeRow}>
      <View style={[styles.timeIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={16} color={t.fg} />
      </View>
      <Text style={styles.timeLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.timePct}>{pct == null ? '—' : `${pct}%`}</Text>
    </View>
  );
}

/** A bare count in its own box — a tally, not a share of anything. */
function CountBox({ value, label }) {
  return (
    <View style={styles.countBox}>
      <Text style={styles.countValue}>{value ?? 0}</Text>
      <Text style={styles.countLabel}>{label}</Text>
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  // The game being looked at, or null. Holds the activity itself rather than an
  // index, so the sheet keeps its contents while it animates out.
  const [openGame, setOpenGame] = useState(null);
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
      <LinearGradient colors={BACKDROP.colors} start={BACKDROP.start} end={BACKDROP.end} style={styles.safe}>
        <SafeAreaView style={[styles.safeInner, styles.centered]} edges={['bottom']}>
          <ActivityIndicator size="large" color={Colors.icon.active} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error || !report) {
    return (
      <LinearGradient colors={BACKDROP.colors} start={BACKDROP.start} end={BACKDROP.end} style={styles.safe}>
        <SafeAreaView style={[styles.safeInner, styles.centered]} edges={['bottom']}>
          <Ionicons name="cloud-offline-outline" size={34} color={Colors.text.muted} />
          <Text style={styles.errorText}>{error || 'Could not load the report.'}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
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
  // How many concepts became learned in the last seven days.
  //
  // Dated on tier2_passed_at, not tier1: a concept counts as learned only once
  // both rounds are passed, and tier 1 is the earlier of the two — dating it there
  // would credit this week with concepts that were half-learned a fortnight ago.
  //
  // Falls to 0 when the field is absent, which is what a client sees against a
  // backend that has not been restarted. The tile then shows its plain caption
  // rather than a confident "+0 this week".
  // The span the chart actually covers, taken from its own first and last points
  // rather than from `window_days`. The window is how far back we LOOKED; this is
  // where the data starts, and quoting 90 days over a chart holding five would be
  // wrong in the direction that flatters.
  const trendPoints = timeline.filter((p) => typeof p.accuracy === 'number');
  const trendRange = trendPoints.length > 1
    ? `${shortDate(trendPoints[0].date)} — ${shortDate(trendPoints[trendPoints.length - 1].date)}`
    : (trendPoints.length === 1 ? shortDate(trendPoints[0].date) : null);

  // The trend card spans the page, so the chart gets the full content width less
  // the page padding and the card's own.
  const chartWidth = width - Layout.spacing.lg * 2 - Layout.spacing.md * 2;

  const weekAgo = Date.now() - 7 * 86400000;
  const learnedThisWeek = concepts.filter((c) => {
    if (!c.mastered || !c.tier2_passed_at) return false;
    const t = new Date(c.tier2_passed_at).getTime();
    return Number.isFinite(t) && t >= weekAgo;
  }).length;

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

  // Finished games only. An abandoned one contributes a null score, which the
  // `|| 0` swallowed into the denominator as a zero-round game — so a child who
  // walked away from one had their headline accuracy quietly diluted by it.
  const doneGames  = activities.filter((a) => a.status === 'passed' || a.status === 'failed');
  const gamesTotal = doneGames.reduce((n, a) => n + (a.total_rounds || 0), 0);
  const gamesRight = doneGames.reduce((n, a) => n + (a.correct_count || 0), 0);
  const gamesSummary = doneGames.length === 0
    ? (activities.length ? 'None finished yet' : 'None played yet')
    : `${doneGames.length} played · got ${countOf(gamesRight, gamesTotal)} right`;

  const headline = aiHeadline || overviewSentence({
    name,
    learned:   totals.mastered,
    catalogue: totals.catalogue_concepts,
    mixUps:    mixUps.length,
    days:      days.length,
  });

  // Fast-and-wrong suggests guessing; slow-and-right suggests effortful recall.
  // Only worth surfacing when there is a real sample behind it.
  const timed = rt.sample_size >= 10
    && rt.incorrect_avg_ms != null && rt.correct_avg_ms != null;

  const guessing = timed && rt.incorrect_avg_ms < rt.correct_avg_ms * 0.8;

  // The mirror case, which had no hint at all — and it is the one the data keeps
  // producing. A child answering in 4.5 seconds when right and 16 when wrong shows
  // the single most striking thing on this screen (one bar over three times the
  // other) and the report said nothing about it, leaving the teacher to guess
  // whether a long bar was good or bad. It is good: they are working at it.
  const labouring = timed && rt.incorrect_avg_ms > rt.correct_avg_ms * 1.6;

  return (
    // The backdrop the rest of the teacher workspace sits on. This screen was on
    // the flat Colors.background, so opening a report from the dashboard dropped
    // the teacher onto a different surface for no reason — and the report is the
    // screen they spend the longest on.
    <LinearGradient
      colors={BACKDROP.colors}
      start={BACKDROP.start}
      end={BACKDROP.end}
      style={styles.safe}
    >
      <SafeAreaView style={styles.safeInner} edges={['bottom']}>
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
        {/* Three tiles, no ring. The donut restated the Learned tile beside it —
            11 of 93 and 12% are the same fact twice, and the percentage was the
            less useful half: a teacher acts on "11 of 93", not on 12%. Dropping it
            gives the three figures the full width of the band. */}
        <View style={styles.band}>
          <View style={styles.overview}>
            <View style={styles.overviewStats}>
              {/* Each icon says what its number counts, not what the app is about.
                  A graduation cap on "Learned" and a picture frame on "Finds the
                  picture" both described the product rather than the figure —
                  double-tick reads as finished, an eye reads as recognised. */}
              {/* Short label, big number, plain caption underneath. The caption is
                  where the descriptive wording went — "LEARNED" alone is not enough
                  for a reader who has never met the app, and "Finds the picture" as
                  the headline label made the number look like an afterthought. */}
              <StatTile
                icon="checkmark-done-outline"
                label="Learned"
                value={String(totals.mastered)}
                of={totals.catalogue_concepts}
                note={learnedThisWeek > 0 ? `+${learnedThisWeek} this week` : 'Both rounds passed'}
                noteTone={learnedThisWeek > 0 ? STAT_TONES.good.fg : undefined}
                tone="plain"
              />
              <StatTile
                icon="eye-outline"
                label="Pictures"
                value={String(totals.tier1_passed)}
                note="Finds the picture"
                tone="solidBlue"
              />
              {/* Amber only when there is actually something to look at. Zero here
                  is good news, and dressing it in a warning colour would have the
                  row read as a problem on the child's best possible day. */}
              <StatTile
                icon="repeat-outline"
                label="Revisit"
                value={String(struggling.length)}
                note="Worth another look"
                tone="solidCoral"
              />
            </View>
          </View>
        </View>

        {/* The trend and its reading, in their own card. They were inside the
            summary block, which made one very tall card doing two jobs — the band
            above answers "where is this child", this answers "which way are they
            going". */}

        {/* Full width. The trend is the one block on the page that is a chart,
            and a chart squeezed into 60% of a tablet is the first thing to
            become unreadable — it was sharing the row to keep the page short,
            which is the wrong thing to optimise for on the one graph here. */}
        <Card style={styles.card}>
          {/* The card names itself now. It carried the headline sentence straight
              off the top edge, so on a page of titled sections this was the one
              block with nothing saying what it was. */}
          <View style={styles.trendHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trendTitle}>Progress trend</Text>
              <Text style={styles.trendSub}>
                {totals.started > 0
                  ? `${name} has finished ${totals.mastered} of ${totals.started} things.`
                  : `${name} has not started anything yet.`}
              </Text>
            </View>

            {/* The span the chart is drawn over, said in words. The axis labels its
                two ends, but only once you are already reading the plot — the pill
                answers "what period is this?" before you look. */}
            {trendRange ? (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{trendRange}</Text>
              </View>
            ) : null}
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

            {/* A heading for the lines under it rather than a footnote under the
                sentence above. It has to say two things at once — that a machine
                wrote these, and that they are about this child — and as a caption
                trailing the headline it read as a disclaimer on the headline
                instead of a label on the list. */}
            {aiHeadline && strengths.length ? (
              <View style={styles.aiRow}>
                <Ionicons name="sparkles" size={11} color={Colors.primary} />
                <Text style={styles.aiTag}>Insights from {name}'s activity</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => loadNarrative(true)}
                  disabled={narrativeRefreshing}
                  accessibilityRole="button"
                  accessibilityLabel="Rewrite these insights"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {narrativeRefreshing
                    ? <ActivityIndicator size="small" color={Colors.icon.muted} />
                    : <Ionicons name="refresh" size={14} color={Colors.icon.default} />}
                </TouchableOpacity>
              </View>
            ) : null}

          </View>

          <View style={styles.trendWrap}>
            <AccuracyChart
              points={timeline}
              width={chartWidth}
              height={210}
            />
          </View>

          {/* The model's observations, boxed and titled, under the chart rather
              than loose above it. Two bare sentences between the headline and the
              plot read as more of the headline; in a box under the evidence they
              read as remarks about it, which is what they are. */}
          {strengths.length > 0 && (
            <View style={styles.insightsBox}>
              <View style={styles.insightsIcon}>
                <Ionicons name="bulb-outline" size={15} color="#8A7A3D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsTitle}>Activity insights</Text>
                {/* Two at most. The model returns up to three and the third is
                    reliably the weakest — what it writes once it has run out of
                    things to say, which is the padding its own rule 4 forbids. */}
                {strengths.slice(0, 2).map((s, i) => (
                  <Text key={i} style={styles.insightsText}>{s}</Text>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* What to work on beside how they work: the list of things to do, and
            the behaviour behind them. These are the two halves of one question —
            what is hard, and why — so they belong on a line together.

            The section is lifted verbatim rather than re-typed, so its heading,
            its "view all" control and its modal come with it unchanged. */}
        <View style={twoCol ? styles.pairRow : null}>
          <View style={twoCol ? styles.pairMain : null}>
          {/* One section, not two. "Mixed up" and "Worth another look" both answered
              "where do I put my attention?", and a concept is frequently in both —
              so a teacher read two lists and had to work out the overlap themselves.
              Muddled pairs lead because they arrive with a reason attached, and a
              reason is the part you can act on. */}
          <Section
            title="What to work on"
            subtitle={workList.length ? 'Most worth your time first' : null}
            icon="flag-outline"
            tone="warn"
            headerInside
            inPair={twoCol}
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
                {workList.slice(0, 2).map((w) =>
                  w.kind === 'pair' ? (
                    <View
                      key={`p:${w.item.category_key}/${w.item.concept_a}|${w.item.concept_b}`}
                      style={styles.pairFull}
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

            {/* At the foot, not in the header. A control that opens the REST of a
                list belongs after the part you can already see — beside the title
                it read as an action on the section rather than the end of it. */}
            {workList.length > 0 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setInsightsOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View all ${workList.length} insights`}
              >
                <Text style={styles.viewAll}>
                  {workList.length > 2 ? `View all ${workList.length} insights` : 'View all insights'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#8FA9BC" />
              </TouchableOpacity>
            )}
          </Section>
          </View>

          <View style={twoCol ? styles.pairSide : null}>
              {/* A Card with its own header rather than a Section, so its title sits
                  INSIDE the card the way "Progress trend" does. As a Section the
                  heading sat outside on the backdrop, which pushed the card top down
                  by the height of that heading — the two cards in the row started at
                  different heights and no amount of stretching fixed it, because they
                  were never aligned to begin with. */}
              <Card style={[styles.card, twoCol && styles.cardFill]}>
                <View style={styles.trendHead}>
                  <View style={[styles.sectionIcon, { backgroundColor: STAT_TONES.info.bg }]}>
                    <Ionicons name="pulse-outline" size={17} color={STAT_TONES.info.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendTitle}>How they work</Text>
                    <Text style={styles.trendSub}>
                      {rt.sample_size > 0 ? `Based on ${tries(rt.sample_size)}` : 'No timed answers yet'}
                    </Text>
                  </View>
                </View>

                <View style={styles.padded}>
                  {/* The average as a headline figure with its label beside it, then
                      the right/wrong split as one two-segment bar. Two stacked bars
                      against a shared scale showed the same thing but took four lines
                      to say it; one bar puts the comparison in a single shape. */}
                  <View style={styles.rtHead}>
                    <Text style={styles.rtHeadLabel}>Response time</Text>
                    <Text style={styles.rtHeadValue}>{shortSeconds(rt.overall_avg_ms)} avg.</Text>
                  </View>

                  <SplitBar
                    parts={[
                      { key: 'right', ms: rt.correct_avg_ms,   color: '#8FB8A0', label: `Right (${shortSeconds(rt.correct_avg_ms)})` },
                      { key: 'wrong', ms: rt.incorrect_avg_ms, color: WRONG_CORAL, label: `Wrong (${shortSeconds(rt.incorrect_avg_ms)})` },
                    ]}
                  />

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

                  {labouring && (
                    <View style={[styles.hint, styles.hintGood]}>
                      <Ionicons name="information-circle-outline" size={16} color="#1B7A47" />
                      <Text style={[styles.hintText, styles.hintTextGood]}>
                        {name} takes about {Math.round(rt.incorrect_avg_ms / rt.correct_avg_ms)} times
                        longer on the ones they get wrong — usually a good sign, meaning they are
                        working the answer out rather than guessing.
                      </Text>
                    </View>
                  )}

                  {/* The time split as two labelled rows rather than a stacked bar.
                      In a narrow right-hand column a two-segment bar is a few pixels
                      of each colour; a percentage beside a named row survives it. */}
                  <TimeRow
                    icon="eye-outline"
                    tone="info"
                    label="Looking at pictures"
                    pct={pctOf(engagement.exposure_ms, engagement.exposure_ms + engagement.video_ms)}
                  />
                  <TimeRow
                    icon="film-outline"
                    tone="coral"
                    label="Watching videos"
                    pct={pctOf(engagement.video_ms, engagement.exposure_ms + engagement.video_ms)}
                  />

                  {/* Boxed figures. These are tallies, not shares of the split above,
                      and as two more rows they read as part of it. */}
                  <View style={styles.countRow}>
                    <CountBox value={engagement.total_taps} label="Taps" />
                    <CountBox value={engagement.coloring_sessions} label="Drawings" />
                  </View>

                  {engagement.relearn_count > 0 && (
                    <Text style={styles.relearnNote}>
                      Went over {engagement.relearn_count} {engagement.relearn_count === 1 ? 'thing' : 'things'} again
                    </Text>
                  )}
                </View>
              </Card>
          </View>
        </View>


        <Section
          title="Recent sessions"
          subtitle={SUBHEADING.dayByDay}
          icon="calendar-outline"
          tone="info"
          headerInside
        >
          <DayByDay days={days} onOpenArtwork={setOpenArt} accent={theme.button} />
        </Section>

        {/* From here down is reference rather than action, so it starts folded.
            Each header carries the one fact worth knowing without opening it. */}
        <Section
          title={HEADING.categories}
          subtitle="Tap a group to see the things inside it"
          icon="albums-outline"
          tone="good"
          summary={groupSummary}
          headerInside
          collapsible
          defaultOpen={false}
        >
          {/* ONE chart, and the concepts open inside it.
              This section rendered the same three groups twice — the shared-scale
              bars, and then a second full set of TierBar rows underneath carrying
              the identical labels and fractions with a different legend and a
              different colour meaning. Two charts of one thing is worse than
              either alone: the rows disagreed on bar length while agreeing on the
              numbers, so a teacher had to work out which one to believe.
              The bars stayed because they share a scale, which is the whole point
              of the section; the expandable behaviour moved onto them. */}
          <View style={styles.groupChartWrap}>
            <GroupProgress
              categories={categories}
              selectedKey={expanded}
              onSelect={setExpanded}
              renderDetail={(c) => {
                const rows = concepts.filter((x) => x.category_key === c.category_key);
                if (rows.length === 0) {
                  return <Text style={styles.muted}>Nothing tried in this group yet.</Text>;
                }
                return rows.map((r) => (
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
                  </View>
                ));
              }}
            />
          </View>
        </Section>

        {/* Answer speed and time spent were two sections of behavioural context,
            neither of which is a finding on its own. Together they answer one
            question — how does this child go about it? */}

        {activities.length > 0 && (
          <Section
            title={HEADING.games}
            subtitle={SUBHEADING.games}
            icon="game-controller-outline"
            tone="good"
            summary={gamesSummary}
            headerInside
            collapsible
            defaultOpen={false}
          >
            <View style={styles.gameGrid}>
              {/* Four, not eight. Older than the last handful is history rather
                  than information — the trend it would show is already the chart
                  in the summary card. */}
              {activities.slice(0, 4).map((a, i) => {
                // A game still open has no score yet, and the row said "Got — right"
                // beside an empty space where the dots go — a broken sentence about
                // nothing. It is worth showing (a game started and left is real
                // information) but it has to say what it is.
                const done = a.status === 'passed' || a.status === 'failed';
                const face = GAME_FACE[a.activity_type] || GAME_FACE.practice;

                // Assembled from whatever exists rather than concatenated blind:
                // card games carry no difficulty level, so the old version opened
                // every one of those rows with a stray "· ".
                const meta = [
                  done ? `Got ${countOf(a.correct_count, a.total_rounds)} right` : 'Not finished',
                  a.completed_at ? shortDate(a.completed_at) : null,
                ].filter(Boolean).join(' · ');

                return (
                  <TouchableOpacity
                    key={`${a.category_key}-${a.activity_number}-${i}`}
                    style={styles.gameCard}
                    activeOpacity={0.75}
                    onPress={() => setOpenGame(a)}
                    accessibilityRole="button"
                    accessibilityLabel={`${GAME_NAME[a.activity_type] || GAME_NAME.practice}, ${meta}. Opens the details.`}
                  >
                    <View style={[styles.gameFace, { backgroundColor: face.bg }]}>
                      <Ionicons name={face.icon} size={24} color={face.fg} />
                    </View>

                    {/* The game's name leads. Two entries with the same thumbnails
                        and the same date were indistinguishable before — they were
                        a memory game and a pair match, and the report drew them as
                        twins because it never said which was which. */}
                    <Text style={styles.gameName} numberOfLines={2}>
                      {GAME_NAME[a.activity_type] || GAME_NAME.practice}
                    </Text>
                    <Text style={styles.gameMeta} numberOfLines={1}>{meta}</Text>

                    {done
                      ? <ScorePips correct={a.correct_count} total={a.total_rounds} tone={face.fg} />
                      : <ScorePips correct={0} total={a.total_rounds || 4} tone={face.fg} />}
                  </TouchableOpacity>
                );
              })}
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

      {/* Every muddled pair and every struggling concept, not just the four the
          card shows. The section caps its list so the page stays readable; this is
          where a teacher goes when they want the whole picture rather than the
          top of it — so it scrolls, and it does not truncate. */}
      <Modal
        visible={insightsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInsightsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>What to work on</Text>
                <Text style={styles.modalSub}>
                  {workList.length} {workList.length === 1 ? 'thing' : 'things'} worth your time, most first
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInsightsOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {workList.map((w) => (
                w.kind === 'pair' ? (
                  <MixUpCard
                    key={`mp:${w.item.category_key}/${w.item.concept_a}|${w.item.concept_b}`}
                    pair={w.item}
                    note={noteFor[`${w.item.concept_a}|${w.item.concept_b}`]}
                  />
                ) : (
                  <View key={`mc:${w.item.category_key}/${w.item.concept_key}`} style={styles.workRow}>
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
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* What one game actually was. The card can only carry a name, a result and
          a row of dots — this is where "which things did she practise?" gets
          answered, which is the question a teacher asks when a score surprises
          them. */}
      <Modal
        visible={!!openGame}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenGame(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.gameModalCard]}>
            {openGame && (() => {
              const face = GAME_FACE[openGame.activity_type] || GAME_FACE.practice;
              const done = openGame.status === 'passed' || openGame.status === 'failed';
              const keys = openGame.concept_keys || [];

              return (
                <>
                  <View style={styles.modalHead}>
                    <View style={[styles.gameFace, { backgroundColor: face.bg, marginBottom: 0 }]}>
                      <Ionicons name={face.icon} size={24} color={face.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>
                        {GAME_NAME[openGame.activity_type] || GAME_NAME.practice}
                      </Text>
                      <Text style={styles.modalSub}>
                        {[
                          openGame.completed_at ? shortDate(openGame.completed_at) : 'Not finished',
                          done ? difficultyWord(openGame.difficulty_level) : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setOpenGame(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={22} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                    <View style={styles.gameResult}>
                      <Text style={[styles.gameResultValue, { color: face.fg }]}>
                        {done ? countOf(openGame.correct_count, openGame.total_rounds) : 'Not finished'}
                      </Text>
                      <Text style={styles.gameResultLabel}>
                        {done ? 'answered correctly' : 'this game was left part-way'}
                      </Text>
                      {done && (
                        <View style={{ marginTop: Layout.spacing.sm }}>
                          <ScorePips
                            correct={openGame.correct_count}
                            total={openGame.total_rounds}
                            tone={face.fg}
                          />
                        </View>
                      )}
                    </View>

                    <Text style={styles.subHeading}>
                      What was in it{keys.length ? ` · ${keys.length}` : ''}
                    </Text>

                    {keys.length === 0 ? (
                      <Text style={styles.muted}>
                        This game did not record which things it covered.
                      </Text>
                    ) : (
                      // The pictures, not a list of names. This is the one place
                      // the report can show what a game actually put in front of
                      // the child, and a teacher recognises those pictures faster
                      // than they read the words for them.
                      <View style={styles.gameConcepts}>
                        {keys.map((k) => (
                          <ConceptThumb
                            key={k}
                            categoryKey={openGame.category_key}
                            conceptKey={k}
                            size={56}
                            showLabel
                          />
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Colour comes from the BACKDROP gradient this is applied to.
  safe:      { flex: 1 },
  safeInner: { flex: 1 },
  scroll:   { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm, padding: Layout.spacing.xl },
  errorText:{ fontSize: Layout.fontSize.sm, color: Colors.text.secondary, textAlign: 'center' },
  retry:    { fontSize: Layout.fontSize.sm, color: Colors.text.link, fontFamily: 'DMSans_700Bold' },

  card:    { marginBottom: 0 },
  // More air above a heading than below it, so each one reads as opening the block
  // under it rather than floating between two. Headings sit on the page backdrop
  // rather than inside a card, so they need the separation to hold their own.
  section: { marginTop: Layout.spacing.xl },

  // The paired row. Main is the wider of the two — it holds a chart, which needs
  // the room; the side column holds short labelled rows that survive being narrow.
  // Both drop to full width below `twoCol`, where two columns leave the chart
  // too cramped to read.
  // The gap above is larger than the one between stacked sections, deliberately.
  // `sectionInPair` zeroes each column's own top margin so the two cards line up,
  // which left this row butted straight against the card above it — and a paired
  // row needs MORE separation than a stacked one, not less, or the four cards read
  // as one undifferentiated block.
  pairRow: {
    flexDirection: 'row',
    gap: Layout.spacing.lg,
    alignItems: 'stretch',
    marginTop: 40,
  },
  // How-they-work takes the larger share now. It carries a chart, a paragraph and
  // four figures; the list beside it is two cards that were never using the 61% it
  // had. Close to even, with the edge to the denser side — a 60/40 the other way
  // would just move the crowding rather than remove it.
  pairMain: { flex: 1 },
  pairSide: { flex: 1.18 },
  sectionInPair: { marginTop: 0, flex: 1 },
  headInCard:    { padding: Layout.spacing.md, paddingBottom: 0 },
  cardFill:      { flex: 1 },
  // Centre-aligned, not flex-end: with an icon badge in the row, baseline-ish
  // alignment left the badge hanging below the title it belongs to.
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  sectionIcon: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Layout.fontSize.lg,
    fontFamily: 'DMSans_900Black',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  sectionSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2 },
  // Darker than the subtitle: when a section is closed this line IS the content,
  // so it should not read as secondary to a heading nobody can act on.
  sectionSummary: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2, fontFamily: 'DMSans_600SemiBold' },
  sectionChevron: { marginLeft: 2 },

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
  viewAll: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#8FA9BC' },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Layout.spacing.md,
    marginHorizontal: Layout.spacing.md,
    marginBottom: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 28, 24, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Layout.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    // Capped so the sheet never grows past the screen on a long list — the body
    // scrolls inside it instead of the whole card running off the bottom.
    maxHeight: '85%',
    borderRadius: Layout.radius.xl,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  modalSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2 },
  modalBody:  { padding: Layout.spacing.lg, gap: Layout.spacing.md },

  // Narrower than the insights sheet: this holds one game's worth of pictures,
  // and at 680 they spread into a thin band across the top of an empty box.
  gameModalCard: { maxWidth: 520 },

  gameResult: {
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  gameResultValue: { fontSize: 26, fontFamily: 'DMSans_800ExtraBold' },
  gameResultLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2 },

  gameConcepts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.md,
    justifyContent: 'center',
  },

  padded:  { padding: Layout.spacing.md },
  muted:   { fontSize: 12, color: Colors.text.muted },

  overview:      { flexDirection: 'row', alignItems: 'stretch' },
  // Three equal tiles that stay on one line. They wrapped before, so on a narrow
  // tablet the third dropped underneath and the row lost its shape.
  // The band: one tinted block holding the ring and the three tiles, so the
  // summary reads as a single answer rather than four cards that happen to be
  // adjacent. Tinted rather than white because everything below it is white — a
  // white summary on a white stack has no top to the page.
  band: {
    backgroundColor: '#DFEBE3',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.md,
    marginBottom: Layout.spacing.md,
  },
  overviewStats: { flex: 1, flexDirection: 'row', gap: Layout.spacing.md },

  // Tightened all round. These are three supporting figures beside the ring, and
  // at the old size they took more height than the ring itself — a summary card
  // where the summary was the smallest thing on it.
  // One set of properties, not two. Successive edits had left this with
  // paddingVertical, paddingHorizontal, alignItems and flexDirection all declared
  // twice — the later ones won, so the tile looked right while the style read as
  // a contradiction.
  statTile: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
  },
  statTilePlain: { borderWidth: 1, borderColor: Colors.borderLight },

  statBadge: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Layout.spacing.md,
  },
  statBody: { alignSelf: 'stretch', gap: 0 },

  statTileLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 3 },
  statTileValue: {
    fontSize: 28,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.6,
  },
  statTileOf:   { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold' },
  statTileNote: { fontSize: 11, marginTop: 5 },

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
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text.primary,
    lineHeight: 21,
  },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  aiTag: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  strengthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  strengthBadge: {
    width: 20, height: 20, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  strengthText: { flex: 1, fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },

  caveat: {
    marginTop: Layout.spacing.lg,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
    color: Colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  mixUpList: { padding: Layout.spacing.md, gap: Layout.spacing.md },
  // Kept as a full-width wrapper rather than dropped: the section is a column of
  // its own now, and a card that sized to its content would leave the second one
  // a different width from the first.
  pairFull: { width: '100%' },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  trendWrap:      { paddingHorizontal: Layout.spacing.md, paddingBottom: Layout.spacing.md },

  trendHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  trendTitle: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary, letterSpacing: -0.3 },
  trendSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2 },

  datePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  datePillText: { fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },

  insightsBox: {
    flexDirection: 'row',
    gap: Layout.spacing.sm,
    margin: Layout.spacing.md,
    marginTop: 0,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  insightsIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F6EFD6',
  },
  insightsTitle: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.text.primary, marginBottom: 3 },
  insightsText:  { fontSize: 12, color: Colors.text.secondary, lineHeight: 19, marginTop: 1 },
  groupChartWrap: { padding: Layout.spacing.md },

  // The indent rule that used to wrap these lives in GroupProgress now, since the
  // rows render inside its expanded row rather than in a list of their own.
  conceptRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm, paddingVertical: 3 },
  conceptName: { flex: 1, fontSize: 11, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  pills:       { flexDirection: 'row', gap: 3 },
  tierPill:    { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  conceptScore:{ width: 42, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold' },

  strugglingName:  { fontSize: 12, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  strugglingMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  rtHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  rtHeadLabel: {
    fontSize: Layout.fontSize.xs,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rtHeadValue: { fontSize: Layout.fontSize.xxl, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },

  splitBarWrap:  { marginTop: Layout.spacing.sm, gap: 9 },
  splitBarTrack: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceAlt },
  splitBarSeg:   { height: '100%' },
  splitBarLegend:     { flexDirection: 'row', justifyContent: 'space-between' },
  splitBarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  splitBarDot:        { width: 9, height: 9, borderRadius: 5 },
  splitBarLabel:      { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },

  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, marginTop: Layout.spacing.lg },
  timeIcon:  { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timeLabel: { flex: 1, fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_600SemiBold', color: Colors.text.primary },
  timePct:   { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },

  countRow: { flexDirection: 'row', gap: Layout.spacing.sm, marginTop: Layout.spacing.lg },
  countBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  countValue: { fontSize: 30, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  countLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 2,
  },

  relearnNote: { fontSize: 11, color: Colors.text.muted, marginTop: Layout.spacing.md },

  pips:   { flexDirection: 'row', gap: 3, alignItems: 'center' },
  pip:    { width: 8, height: 8, borderRadius: 4 },
  pipOn:  { backgroundColor: '#3FAE6F' },
  pipOff: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },

  // A row of cards, not a list of rows. Four games as stacked rows filled the
  // section with repeated left-aligned text; as cards they are four small objects
  // a teacher takes in at once.
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Layout.spacing.sm,
    padding: Layout.spacing.md,
  },
  gameCard: {
    // Just under a quarter, so four sit on one line with the gaps between them.
    // Floored at 150 so they wrap to two rows on a phone rather than shrinking
    // until the names break mid-word.
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 150,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Layout.spacing.lg,
    paddingHorizontal: Layout.spacing.sm,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  gameFace: {
    width: 52, height: 52, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  gameName: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  gameMeta: { fontSize: 11, color: Colors.text.muted, textAlign: 'center' },

  hint: {
    flexDirection: 'row',
    gap: 9,
    marginTop: Layout.spacing.lg,
    padding: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.status.warningLight,
  },
  hintText: { flex: 1, fontSize: 12, color: '#8A5D06', lineHeight: 19 },
  // The good-news variant. Same shape, green rather than amber — an encouraging
  // reading dressed in a warning colour would be read as a warning.
  hintGood:     { backgroundColor: '#E6F4EA' },
  hintTextGood: { color: '#1B5E3A' },

  subHeading: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: Layout.spacing.sm,
  },

  engagementGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },

  footnote: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
