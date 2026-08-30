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
import { TrendSparkline } from '../../../components/charts/TrendSparkline';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import {
  StatTile,
  TrendChart,
  InsightBox,
  ProgressRow,
  WordAvatar,
  SignalBar,
  Pill,
  REPORT_PALETTE,
} from '../../../components/dialogue/ReportVisuals';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { dialogueApi } from '../../../api/dialogue';
import { buildReportHtml, printReport, printTimestamp } from '../../../utils/reportPrint';
import { formatDate } from '../../../utils/formatters';

// ---------------------------------------------------------------------------
// Honest-labelling constants (TASK-43)
//
// These two strings are the honesty mechanism this screen exists to carry, not
// copy polish. They are constants precisely so that when calibrator remediation
// eventually changes what Tier 2's confidence represents, this file's wording
// is the only thing that has to change.
// ---------------------------------------------------------------------------

/**
 * DEC-07 — mandatory, verbatim, always rendered wherever a Tier 2 result is.
 * Exported (TASK-48) so the printed footnote carries this exact string and a
 * test can assert against it rather than a retyped copy.
 */
export const TIER2_RELIABILITY_CAVEAT =
  "This is an early hint from a still-learning model, based on a very small "
  + "amount of real data so far. It hasn't yet been shown to be reliable — right "
  + "now it gets it right about as often as a guess would. Use your own "
  + "observation of the session as the main guide, and treat this as one more "
  + "thing to consider, not a conclusion.";

/**
 * Buckets the raw RandomForest vote share into a plain phrase for display.
 *
 * The number this reads is the share of trees in the forest that voted for the
 * predicted label. It is NOT a calibrated probability and must never be shown
 * as a confidence percentage — hence "leaning", never "% sure". The raw value
 * stays on screen as a muted suffix, so nothing is hidden; this only changes
 * what carries the sentence. Boundaries intentionally coarse: do not present a
 * bucketed label as more precise than the number backing it actually is
 * (that's the whole point of DEC-07).
 *
 * TASK-45 supersedes TASK-43's "label it a RandomForest vote share" rule. When
 * calibrator remediation changes what this number represents, this function and
 * TIER2_RELIABILITY_CAVEAT are the only things that should need to change.
 */
function voteShareLabel(confidence) {
  if (confidence == null) return 'not available';
  if (confidence >= 0.85) return 'strongly leaning this way';
  if (confidence >= 0.70) return 'leaning this way';
  return 'weakly leaning this way';
}

/** Always rendered under every Tier 1 breakdown — never behind a disclosure. */
const TIER1_PLACEHOLDER_WEIGHTS_FOOTER =
  'These weights are literature-informed placeholders. They have not been '
  + 'derived from this cohort’s own data, so treat the balance between the '
  + 'terms as provisional.';

const CATEGORY_LABEL = {
  greetings:   'Greetings',
  magic_words: 'Magic words',
  abilities:   'Abilities',
};

const CATEGORY_ICON = {
  greetings:   'hand-left-outline',
  magic_words: 'sparkles-outline',
  abilities:   'walk-outline',
};

/** Why this word is on the "what to work on" list, in one plain sentence. */
function attentionReason(row) {
  if (row.tier === 'tier1' && row.explanation?.scored) {
    const weakest = [...(row.explanation.terms || [])]
      .sort((a, b) => a.normalizedValue - b.normalizedValue)[0];
    if (weakest) {
      return `${TERM_LABEL[weakest.term] || weakest.term} is the weakest signal here.`;
    }
  }
  if (row.tier === 'tier2') {
    const top = row.explanation?.attributions?.[0];
    if (top) {
      return `The model weighted ${(FEATURE_LABEL[top.feature] || top.feature).toLowerCase()} most heavily.`;
    }
    return 'Flagged by the model — see the breakdown below.';
  }
  return 'Several signals point this way.';
}

const TERM_LABEL = {
  speech:    'Speech score',
  phoneme:   'Pronunciation',
  echolalia: 'Echolalia',
  prompt:    'Prompts needed',
  latency:   'Response time',
};

// TASK-45 — what a Tier 1 row means, in a sentence. The score and the threshold
// it crossed are still shown directly underneath, just demoted: a teacher who
// wants the number finds it one line down rather than having to start there.
// Exported for TASK-48's print builder, so the printed sentence is literally
// this same string rather than a second copy that could drift from it.
export const PLAIN_SCORE_LEAD = {
  fast:       'This word is going well — the five signals below point the same way.',
  typical:    'This word is progressing at a typical pace.',
  struggling: 'This word may need extra support — several signals below point that way.',
};

/**
 * A Tier 1 signal's raw value in the units a teacher thinks in. The stored
 * numbers are not self-explanatory — a response time reads as `4389`, and an
 * echolalia flag as `true` — so each term gets its own rendering.
 */
function termValueText(t) {
  const raw = t.rawValue;
  switch (t.term) {
    case 'speech':    return raw == null ? '—' : `${raw}`;
    case 'phoneme':   return raw == null ? '—' : `${Math.round(raw * 100)}%`;
    case 'echolalia': return raw ? 'present' : 'none';
    case 'prompt':    return raw == null ? '—' : `${raw} prompt${raw === 1 ? '' : 's'}`;
    case 'latency':   return raw == null ? '—' : `${(raw / 1000).toFixed(1)}s`;
    default:          return formatValue(raw);
  }
}

/**
 * How much of the score this term was allowed to carry, after the
 * renormalisation that redistributes any missing term's weight. Kept as a bare
 * percentage: the sentence form it replaced was truncated to "counted for a..."
 * on a real tablet, which told a teacher nothing.
 */
function termWeightText(t) {
  return `${Math.round(t.renormalizedWeight * 100)}%`;
}

/** "th_fronting" → "Th fronting". Never show a teacher a stored enum. */
function humanizeEnum(value) {
  const s = String(value).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A SHAP feature's value, in readable units. */
function featureValueText(feature, value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  // Categorical features arrive as their stored enum — `category` as
  // "magic_words", `phoneme_error_class` as "th_fronting" — and were being
  // rendered verbatim.
  if (feature === 'category') return CATEGORY_LABEL[value] ?? humanizeEnum(value);
  if (feature === 'phoneme_error_class') return humanizeEnum(value);
  if (/latency/.test(feature) && typeof value === 'number') return `${(value / 1000).toFixed(1)}s`;
  if (/accuracy|ratio/.test(feature) && typeof value === 'number' && value >= 0 && value <= 1) {
    return `${Math.round(value * 100)}%`;
  }
  if (typeof value === 'string') return humanizeEnum(value);
  return formatValue(value);
}

const FEATURE_LABEL = {
  phase1_exposure_ratio:      'Phase 1 exposure',
  speech_score:               'Speech score',
  phoneme_accuracy:           'Pronunciation accuracy',
  phoneme_error_class:        'Pronunciation error type',
  response_latency_ms_phase2: 'Phase 2 response time',
  echolalia_flag:             'Echolalia',
  response_latency_ms_phase3: 'Phase 3 response time',
  first_tap_correct:          'First tap correct',
  selection_change_count:     'Changed answer',
  prompt_count:               'Prompts needed',
  difficulty:                 'Word difficulty',
  category:                   'Category',
  phase1_applicable:          'Phase 1 applies',
};

const TRAJECTORY_TINT = {
  fast:       '#22A05F',
  typical:    Colors.text.secondary,
  struggling: Colors.status.error,
};

/**
 * TASK-48 — the one-line summary this row shows, as plain text.
 *
 * Exported and used by both the print builder and (via the components below)
 * the screen itself, so the printed line and the on-screen line are the same
 * string by construction. A disabled row has no finding, so it reports its
 * caveat rather than a trajectory it never predicted.
 */
export function wordSummaryLine(row) {
  if (row.tier === 'disabled') {
    return `${row.word} — no prediction. ${row.caveat ?? ''}`.trim();
  }
  const lead = row.tier === 'tier1'
    ? (row.explanation?.scored === false
      ? 'No score — none of the five terms had data.'
      // The screen keys this off the explanation's own label; do the same here
      // rather than off row.trajectory, so the two can never disagree.
      : PLAIN_SCORE_LEAD[row.explanation?.label ?? row.trajectory] ?? '')
    : `The model’s prediction: ${voteShareLabel(row.confidence)}.`;
  return `${row.word} — ${row.trajectory}. ${lead}`.trim();
}

// How many SHAP factors to draw per word. The full 13 per row would bury the
// signal; the remainder is counted, never silently dropped.
const MAX_SHAP_BARS = 6;

function Section({ title, subtitle, children, right }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function StatCell({ label, value, tint }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statCellValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

/**
 * Which of the two prediction paths produced this row, at a glance.
 *
 * TASK-45: the keys and colours are unchanged — only the visible wording. A
 * teacher has no reason to know the words "tier", "formula" or "model", but
 * does need to know whether a row came from the AI or from a fixed rule.
 */
function TierPill({ tier }) {
  const map = {
    tier2:    { bg: Colors.status.infoLight,    fg: Colors.text.link,  label: 'AI estimate' },
    tier1:    { bg: Colors.status.warningLight, fg: '#B4780A',         label: 'Rule-based' },
    disabled: { bg: Colors.surfaceAlt,          fg: Colors.text.muted, label: 'Off' },
  };
  const s = map[tier] || map.disabled;
  return (
    <View style={[styles.tierPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.tierPillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/** Formats a raw feature value for display without pretending to precision. */
function formatValue(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  if (value == null) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

/**
 * The exact Tier 1 decomposition. The placeholder-weights footer is part of
 * this component and is rendered unconditionally — there is no code path that
 * produces a Tier 1 breakdown without it.
 */
function Tier1Breakdown({ explanation }) {
  if (!explanation) {
    return (
      <View>
        <Text style={styles.muted}>No breakdown available for this word.</Text>
        <Text style={styles.disclaimer}>{TIER1_PLACEHOLDER_WEIGHTS_FOOTER}</Text>
      </View>
    );
  }

  const terms = explanation.terms || [];
  const crossed = explanation.scored
    ? (explanation.label === 'fast'
      ? `scored ${explanation.score.toFixed(2)}, at or above the ${explanation.thresholds.fast} "fast" mark`
      : explanation.label === 'struggling'
        ? `scored ${explanation.score.toFixed(2)}, at or below the ${explanation.thresholds.struggling} "struggling" mark`
        : `scored ${explanation.score.toFixed(2)}, between the ${explanation.thresholds.struggling} and ${explanation.thresholds.fast} marks`)
    : 'no score — none of the five terms had data';

  return (
    <View>
      {/* The score as a dial, the finding as a sentence beside it. Reuses the
          shared MasteryRing rather than adding another chart. */}
      <View style={styles.tier1Head}>
        {/* MasteryRing sizes its value text at 24% of `size` and defaults to a
            10px stroke, so at 72 a three-digit "100%" outgrew the inner circle
            and sat on the ring. A larger diameter with a thinner stroke leaves
            the number and its label clear of the arc. */}
        {explanation.scored ? (
          <MasteryRing value={explanation.score} size={84} strokeWidth={7} label="score" />
        ) : null}
        <View style={styles.tier1Lead}>
          <Text style={styles.plainLead}>
            {explanation.scored ? PLAIN_SCORE_LEAD[explanation.label] : crossed}
          </Text>
          {explanation.scored ? (
            <Text style={styles.leadDetail}>{crossed}</Text>
          ) : null}
        </View>
      </View>

      {/* One signal per row: name, its value in real units, and a bar filled to
          how well it went. The right-hand number is that signal's share of the
          score. */}
      <View style={styles.signalList}>
        {terms.map((t) => (
          <SignalBar
            key={t.term}
            label={TERM_LABEL[t.term] || t.term}
            value={termValueText(t)}
            fill={t.normalizedValue}
            meta={termWeightText(t)}
          />
        ))}
      </View>

      {explanation.absentTerms?.length > 0 && (
        <Text style={styles.absentNote}>
          No data for {explanation.absentTerms.map((k) => TERM_LABEL[k] || k).join(', ')}
          {' '}— their weight was shared out across the terms above, so those
          {' '}terms count for more here than their usual share.
        </Text>
      )}

      {/* Always visible, never gated (AC12). */}
      <Text style={styles.disclaimer}>{TIER1_PLACEHOLDER_WEIGHTS_FOOTER}</Text>
    </View>
  );
}

/** SHAP attributions for the class the model predicted. */
function Tier2Breakdown({ explanation, confidence }) {
  if (!explanation) {
    return (
      <Text style={styles.muted}>
        The model produced this label, but its explanation could not be generated.
        The label itself is unaffected.
      </Text>
    );
  }

  const all = explanation.attributions || [];
  const shown = all.slice(0, MAX_SHAP_BARS);
  const maxAbs = shown.reduce((m, a) => Math.max(m, Math.abs(a.contribution)), 0) || 1;

  return (
    <View>
      {/* Plain phrase carries the sentence; the raw vote share stays visible as
          a muted suffix so the number is never hidden, only de-emphasised. */}
      <Text style={styles.plainLead}>
        The model’s prediction: {voteShareLabel(confidence)}
        {confidence != null ? (
          <Text style={styles.leadDetail}> ({confidence.toFixed(2)})</Text>
        ) : null}
      </Text>

      {/* Bar length is how much each input mattered, relative to the strongest.
          Direction is carried by colour alone — a per-row "for"/"against" label
          duplicated that and wrapped mid-word in the narrow meta column, so it
          is explained once underneath instead. */}
      <View style={styles.signalList}>
        {shown.map((a) => (
          <SignalBar
            key={a.feature}
            label={FEATURE_LABEL[a.feature] || a.feature}
            value={featureValueText(a.feature, a.value)}
            fill={Math.abs(a.contribution) / maxAbs}
            negative={a.contribution < 0}
          />
        ))}
      </View>

      {shown.some((a) => a.contribution < 0) && (
        <Text style={styles.absentNote}>
          Grey bars are the things that pointed away from this result.
        </Text>
      )}

      {all.length > shown.length && (
        <Text style={styles.absentNote}>
          {all.length - shown.length} smaller factors not shown.
        </Text>
      )}
    </View>
  );
}

/**
 * TASK-47 — one word's session-by-session accuracy, fetched only when a teacher
 * opens it. Deliberately not part of the batch report: that call already runs a
 * SHAP pass per word, and most rows are never expanded.
 *
 * The result is cached in this row's own state, so collapsing and reopening the
 * same row costs nothing.
 */
function WordHistory({ studentId, wordId }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    // Fetch once per row per session — an already-loaded row never refetches.
    if (!next || points !== null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const data = await dialogueApi.getWordTimeline(studentId, wordId);
      setPoints(data?.points ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [open, points, loading, studentId, wordId]);

  return (
    <View>
      <TouchableOpacity style={styles.historyToggle} activeOpacity={0.7} onPress={toggle}>
        <Ionicons name="time-outline" size={13} color={Colors.text.link} />
        <Text style={styles.historyToggleText}>History</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={Colors.text.link}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.historyBody}>
          {/* Says plainly that this is practice over time, not the mastery
              status shown above — the two must not be read as the same thing. */}
          <Text style={styles.historyNote}>
            Session-by-session accuracy for this word — separate from the status above.
          </Text>
          {loading ? (
            <ActivityIndicator color={Colors.icon.active} style={styles.historyLoading} />
          ) : failed ? (
            <Text style={styles.muted}>Could not load this word’s history.</Text>
          ) : (
            <TrendSparkline points={points ?? []} width={220} height={48} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function WordRow({ row, studentId }) {
  const tint = TRAJECTORY_TINT[row.trajectory] || Colors.text.secondary;
  const isDisabled = row.tier === 'disabled';

  return (
    <View style={styles.wordRow}>
      <View style={styles.wordHead}>
        <Text style={styles.wordName} numberOfLines={1}>{row.word}</Text>
        <TierPill tier={row.tier} />
        {/* A disabled row has no finding, so it gets no trajectory label —
            rendering its 'typical' here would read as a prediction. */}
        <Text style={[styles.wordLabel, { color: isDisabled ? Colors.text.muted : tint }]}>
          {isDisabled ? 'no prediction' : row.trajectory}
        </Text>
      </View>

      {isDisabled ? (
        <Text style={styles.muted}>{row.caveat}</Text>
      ) : row.tier === 'tier1' ? (
        <Tier1Breakdown explanation={row.explanation} />
      ) : (
        <Tier2Breakdown explanation={row.explanation} confidence={row.confidence} />
      )}

      {!isDisabled && row.caveat ? (
        <Text style={styles.rowCaveat}>{row.caveat}</Text>
      ) : null}

      <WordHistory studentId={studentId} wordId={row.word_id} />
    </View>
  );
}

/**
 * TASK-48 — the printable shape of this report, built from state already on
 * screen. No fetching, no re-deriving: every sentence comes from the same
 * helpers the screen renders with, and the charts are deliberately excluded
 * (they are SVG components, not DOM — see the task's §0).
 */
export function buildTrajectoryPrintModel(report, studentName) {
  const { totals, words } = report;
  const sections = Object.keys(CATEGORY_LABEL)
    .map((key) => ({
      heading: CATEGORY_LABEL[key],
      lines: words.filter((w) => w.category === key).map(wordSummaryLine),
    }))
    .filter((s) => s.lines.length > 0);

  return {
    title: 'Level 1 Trajectory Report',
    studentName,
    generatedAt: printTimestamp(),
    overview: [
      { label: 'Fast', value: String(totals.fast) },
      { label: 'Typical', value: String(totals.typical) },
      { label: 'Struggling', value: String(totals.struggling) },
      { label: 'No prediction', value: String(totals.disabled) },
      {
        label: 'Words with a prediction',
        value: `${totals.words_predicted} of ${totals.words_total}`,
      },
    ],
    sections,
    // The DEC-07 disclosure travels with the printout: a page handed to someone
    // else must not present the model as more reliable than it is.
    footnote: totals.tier2 > 0
      ? `${TIER2_RELIABILITY_CAVEAT} Based on each word’s most recent recorded session.`
      : 'Based on each word’s most recent recorded session.',
  };
}

export default function TrajectoryReportScreen({ route, navigation }) {
  const student = route.params?.student;
  const { width } = useWindowDimensions();
  const firstName = student?.full_name?.trim().split(/\s+/)[0] ?? 'This student';

  const [report, setReport]         = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [printError, setPrintError] = useState(null);
  // Which category's words are on screen. Defaults to the first that has any.
  const [activeCategory, setActiveCategory] = useState(null);

  const load = useCallback(async () => {
    if (!student?.sid) return;
    try {
      setError(null);
      // Started together, not one after the other: the report runs a SHAP pass
      // per word, and making the trend queue behind it would add its latency to
      // an already-slow call for no reason.
      const [reportResult, timelineResult] = await Promise.allSettled([
        dialogueApi.getTrajectoryReport(student.sid),
        dialogueApi.getModuleTimeline(student.sid),
      ]);

      if (reportResult.status === 'rejected') throw reportResult.reason;
      setReport(reportResult.value);
      // A failing trend must not take the report down with it — the chart just
      // shows its own empty state.
      setTimeline(timelineResult.status === 'fulfilled'
        ? (timelineResult.value?.points ?? [])
        : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => { load(); }, [load]);

  // TASK-48 — print the report as it currently stands. Builds from state that
  // is already loaded, so pressing this never triggers a fetch.
  const handlePrint = useCallback(async () => {
    if (!report || printing) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const model = buildTrajectoryPrintModel(report, student?.full_name ?? '');
      await printReport(buildReportHtml(model));
    } catch (err) {
      // A failed print must never blank the report underneath it.
      setPrintError(err?.message || 'Could not open the print dialog.');
    } finally {
      setPrinting(false);
    }
  }, [report, printing, student?.full_name]);

  useEffect(() => {
    navigation.setOptions({
      title: student?.full_name ? `${student.full_name} · Trajectory` : 'Trajectory Report',
      headerRight: () => (
        report ? (
          <TouchableOpacity
            onPress={handlePrint}
            disabled={printing}
            accessibilityRole="button"
            accessibilityLabel="Print report"
            hitSlop={8}
          >
            {printing ? (
              <ActivityIndicator size="small" color={Colors.icon.active} />
            ) : (
              <Ionicons name="print-outline" size={22} color={Colors.text.link} />
            )}
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, student?.full_name, report, printing, handlePrint]);

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

  const { totals, words } = report;
  const categories = Object.keys(CATEGORY_LABEL)
    .map((key) => [key, words.filter((w) => w.category === key)])
    .filter(([, rows]) => rows.length > 0);

  // Fall back to the first available category rather than trusting the stored
  // selection — a refresh can leave a category with no words behind.
  const selectable = categories.map(([key]) => key);
  const currentCategory = selectable.includes(activeCategory) ? activeCategory : selectable[0];
  const activeRows = categories.find(([key]) => key === currentCategory)?.[1] ?? [];

  // Struggling words, worst-looking first. Capped so the section stays a
  // shortlist a teacher can act on rather than a second full listing.
  const needsAttention = words
    .filter((w) => w.tier !== 'disabled' && w.trajectory === 'struggling')
    .slice(0, 5);

  // The trend, described in words above the chart — the chart is the evidence,
  // the sentence is the finding.
  const scored = timeline.filter((p) => typeof p.accuracy === 'number');
  const trendRange = scored.length > 0
    ? (scored.length === 1
      ? formatDate(scored[0].date)
      : `${formatDate(scored[0].date)} — ${formatDate(scored[scored.length - 1].date)}`)
    : null;
  const trendLead = (() => {
    if (scored.length === 0) return 'No practice has been recorded in this window yet.';
    const latest = scored[scored.length - 1];
    const pct = Math.round(latest.accuracy * 100);
    if (scored.length === 1) {
      return `${firstName} answered ${pct}% of ${latest.attempts} tries correctly on the one day recorded.`;
    }
    const first = scored[0];
    const delta = Math.round((latest.accuracy - first.accuracy) * 100);
    const direction = delta > 4 ? 'up' : delta < -4 ? 'down' : 'steady';
    const totalTries = scored.reduce((n, p) => n + (p.attempts || 0), 0);
    if (direction === 'steady') {
      return `${firstName} is holding steady around ${pct}%, across ${totalTries} tries on ${scored.length} days.`;
    }
    return direction === 'up'
      ? `${firstName} is trending up — ${pct}% on the latest day, ${Math.abs(delta)} points above the first, across ${totalTries} tries.`
      : `${firstName} is trending down — ${pct}% on the latest day, ${Math.abs(delta)} points below the first, across ${totalTries} tries.`;
  })();

  const insightLines = (() => {
    const out = [];
    if (totals.fast > 0) {
      const names = words.filter((w) => w.trajectory === 'fast' && w.tier !== 'disabled')
        .slice(0, 3).map((w) => w.word);
      if (names.length) out.push(`Going well on ${names.join(', ')}.`);
    }
    if (needsAttention.length > 0) {
      out.push(`${needsAttention.length} word${needsAttention.length === 1 ? '' : 's'} flagged for extra support — listed below.`);
    }
    const best = scored.reduce((b, p) => (b && b.accuracy >= p.accuracy ? b : p), null);
    if (best) out.push(`Best day so far was ${formatDate(best.date)} at ${Math.round(best.accuracy * 100)}%.`);
    return out;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Headline numbers first — a teacher should get the shape of the week
            before reading a single sentence. */}
        <View style={styles.tileRow}>
          <StatTile
            icon="checkmark-done-outline"
            label="Predicted"
            value={`${totals.words_predicted} / ${totals.words_total}`}
            sub={`${totals.tier2} AI · ${totals.tier1} rule-based`}
            tone="plain"
          />
          <StatTile icon="trending-up-outline" label="Going well" value={String(totals.fast)} tone="good" />
        </View>
        <View style={styles.tileRow}>
          <StatTile icon="remove-outline" label="Typical" value={String(totals.typical)} tone="neutral" />
          <StatTile
            icon="alert-circle-outline"
            label="Needs support"
            value={String(totals.struggling)}
            tone={totals.struggling > 0 ? 'warn' : 'idle'}
          />
        </View>

        {/* TASK-48 — a print failure is reported here and nowhere else; the
            report below stays exactly as it was. */}
        {printError ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>{printError}</Text>
          </View>
        ) : null}

        {/* TASK-47 — how practice is going over time. This is practice accuracy,
            not the mastery status shown per word below. */}
        <Section
          title="Practice trend"
          subtitle="How often answers were right, day by day"
          right={trendRange ? <View style={styles.rangeChip}><Text style={styles.rangeChipText}>{trendRange}</Text></View> : null}
        >
          <View style={styles.trendWrap}>
            <Text style={styles.trendLead}>{trendLead}</Text>
            <TrendChart
              points={timeline}
              width={width - Layout.spacing.lg * 2 - Layout.spacing.md * 2}
            />
            <InsightBox lines={insightLines} />
          </View>
        </Section>

        {/* DEC-07 — mandatory reliability caveat, placed immediately under the
            at-a-glance summary so it is on screen before any Tier 2 result. */}
        {totals.tier2 > 0 && (
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>{TIER2_RELIABILITY_CAVEAT}</Text>
          </View>
        )}

        {totals.words_predicted === 0 && (
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>
              No word has a trajectory prediction yet. Every word below shows the
              system default rather than a finding about this child.
            </Text>
          </View>
        )}

        {/* What to work on — the whole point of opening the report. */}
        {needsAttention.length > 0 && (
          <Section title="What to work on" subtitle="Most worth your time first">
            <View style={styles.attentionBlock}>
              {needsAttention.map((row) => (
                <View key={row.word_id} style={styles.attentionRow}>
                  <WordAvatar word={row.word} size={44} tint={REPORT_PALETTE.warn} bg={REPORT_PALETTE.warnBg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionName}>{row.word}</Text>
                    <Text style={styles.attentionWhy} numberOfLines={2}>{attentionReason(row)}</Text>
                  </View>
                  <Pill
                    label={row.tier === 'tier2' ? 'AI estimate' : 'Rule-based'}
                    fg={row.tier === 'tier2' ? Colors.text.link : '#B4780A'}
                    bg={row.tier === 'tier2' ? Colors.status.infoLight : Colors.status.warningLight}
                  />
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* One category at a time. Showing all three stacked made the screen a
            long scroll of near-identical cards; a teacher works through one
            category at a sitting anyway. */}
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Words</Text>
            <Text style={styles.sectionSub}>Pick a category to see its words</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          {categories.map(([key, rows]) => {
            const active = key === currentCategory;
            const flagged = rows.filter((r) => r.tier !== 'disabled' && r.trajectory === 'struggling').length;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveCategory(key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.categoryTab, active && styles.categoryTabActive]}
              >
                <Ionicons
                  name={CATEGORY_ICON[key]}
                  size={14}
                  color={active ? '#FFFFFF' : Colors.text.muted}
                />
                <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                  {CATEGORY_LABEL[key]}
                </Text>
                <View style={[styles.categoryTabCount, active && styles.categoryTabCountActive]}>
                  <Text style={[styles.categoryTabCountText, active && styles.categoryTabTextActive]}>
                    {rows.length}
                  </Text>
                </View>
                {/* A dot rather than a number: it flags that this category has
                    something to look at without competing with the count. */}
                {flagged > 0 && !active ? <View style={styles.categoryTabDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeRows.length > 0 ? (
          <Card style={styles.card}>
            <View style={styles.categoryBlock}>
              <ProgressRow
                icon={CATEGORY_ICON[currentCategory]}
                iconBg={REPORT_PALETTE.goodBg}
                label={`${CATEGORY_LABEL[currentCategory]} going well`}
                done={activeRows.filter((r) => r.trajectory === 'fast' && r.tier !== 'disabled').length}
                total={activeRows.length}
                right={`${activeRows.filter((r) => r.tier !== 'disabled').length} of ${activeRows.length} predicted`}
                color={REPORT_PALETTE.good}
              />
            </View>
            <View style={styles.wordBlock}>
              {activeRows.map((row) => (
                <WordRow key={row.word_id} row={row} studentId={student.sid} />
              ))}
            </View>
          </Card>
        ) : null}

        <Text style={styles.footnote}>
          Based on each word’s most recent recorded session. “Rule-based” rows
          come from a fixed weighted score, “AI estimate” rows from the
          trajectory model — which has not yet been shown to be reliable on real
          data.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  scroll:   { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm, padding: Layout.spacing.xl },
  errorText:{ fontSize: Layout.fontSize.sm, color: Colors.text.secondary, textAlign: 'center' },
  retry:    { fontSize: Layout.fontSize.sm, color: Colors.text.link, fontFamily: 'Nunito_700Bold' },

  card:    { marginBottom: 0 },
  section: { marginTop: Layout.spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Layout.spacing.sm },
  sectionTitle: { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  sectionSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  muted:   { fontSize: Layout.fontSize.xs, color: Colors.text.muted, lineHeight: 17 },

  overview:      { padding: Layout.spacing.md, gap: Layout.spacing.sm },
  overviewStats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },
  overviewMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted },

  // Redesign — headline tiles, trend card, "what to work on".
  tileRow: { flexDirection: 'row', gap: Layout.spacing.md, marginBottom: Layout.spacing.md },
  rangeChip: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Layout.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  rangeChipText: { fontSize: 10, color: Colors.text.secondary, fontFamily: 'Nunito_600SemiBold' },
  trendLead: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: Layout.spacing.md,
  },

  attentionBlock: { padding: Layout.spacing.md, gap: Layout.spacing.md },
  attentionRow:   { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  attentionName:  { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  attentionWhy:   { fontSize: Layout.fontSize.xs, color: Colors.text.secondary, marginTop: 2, lineHeight: 17 },

  categoryBlock: { padding: Layout.spacing.md, gap: Layout.spacing.lg },

  // Category tabs — same pill treatment as the module tabs on Student Profile,
  // so the two screens' tab strips read as the same control.
  categoryTabs: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.sm,
    paddingRight: Layout.spacing.md,
  },
  categoryTab: {
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
  categoryTabActive: { backgroundColor: Colors.text.link, borderColor: Colors.text.link },
  categoryTabText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.secondary,
  },
  categoryTabTextActive: { color: '#FFFFFF' },
  categoryTabCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Layout.radius.full,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  categoryTabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  categoryTabCountText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: Colors.text.secondary },
  categoryTabDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.status.error,
  },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'Nunito_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  wordBlock: { padding: Layout.spacing.md, gap: Layout.spacing.md },
  wordRow:   { gap: 6 },
  wordHead:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  wordName:  { flex: 1, fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  wordLabel: { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_800ExtraBold', textAlign: 'right' },

  tierPill:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Layout.radius.full },
  tierPillText: { fontSize: 10, fontFamily: 'Nunito_700Bold' },

  // TASK-45 — plain sentence carries the meaning, the numbers sit under it at
  // the same visual weight as a bar's detail line.
  leadBlock:  { marginBottom: Layout.spacing.xs },
  plainLead:  {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
    lineHeight: 19,
  },
  leadDetail: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 1 },

  // Score dial beside the finding, then the signal bars beneath.
  tier1Head:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.md, marginBottom: Layout.spacing.sm },
  tier1Lead:  { flex: 1 },
  signalList: { gap: Layout.spacing.sm, marginTop: 2 },


  absentNote: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 2 },

  // TASK-47 — module trend + per-word history
  trendWrap: { padding: Layout.spacing.md },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 2,
  },
  historyToggleText: { fontSize: 10, color: Colors.text.link, fontFamily: 'Nunito_700Bold' },
  historyBody:    { paddingTop: 2, gap: 4 },
  historyNote:    { fontSize: 10, color: Colors.text.muted, lineHeight: 15 },
  historyLoading: { alignSelf: 'flex-start', paddingVertical: Layout.spacing.sm },
  disclaimer: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: Layout.spacing.xs, fontStyle: 'italic' },
  rowCaveat:  { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 2 },

  hint: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Layout.spacing.md,
    padding: Layout.spacing.sm,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.status.warningLight,
  },
  hintText: { flex: 1, fontSize: Layout.fontSize.xs, color: '#8A5D06', lineHeight: 17 },

  footnote: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
