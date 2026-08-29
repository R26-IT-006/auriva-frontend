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
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { dialogueApi } from '../../../api/dialogue';
import { buildReportHtml, printReport, printTimestamp } from '../../../utils/reportPrint';

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
 * TASK-45 — the same three numbers the old `0.78 → 0.78 × 0.35` expression
 * carried, as a phrase. The weight is the renormalized one, so it already
 * accounts for any term that was missing from the payload.
 */
function plainContributionDetail(t) {
  const weightPct = Math.round(t.renormalizedWeight * 100);
  return `${formatValue(t.rawValue)} — counted for about ${weightPct}% of the score`;
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

/**
 * One contribution bar. `magnitude` is 0-1 relative to the largest bar in the
 * same group, so bars are comparable within a word but never imply a shared
 * scale across words.
 */
function ContributionBar({ label, detail, contribution, magnitude }) {
  const positive = contribution >= 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelWrap}>
        <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
        {detail != null ? (
          <Text style={styles.barDetail} numberOfLines={1}>{detail}</Text>
        ) : null}
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.max(2, Math.round(magnitude * 100))}%`,
              backgroundColor: positive ? Colors.status.info : Colors.icon.muted,
            },
          ]}
        />
      </View>
      <Text style={styles.barValue}>
        {positive ? '+' : '−'}{Math.abs(contribution).toFixed(2)}
      </Text>
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
  const maxAbs = terms.reduce((m, t) => Math.max(m, Math.abs(t.contribution)), 0) || 1;
  const crossed = explanation.scored
    ? (explanation.label === 'fast'
      ? `scored ${explanation.score.toFixed(2)}, at or above the ${explanation.thresholds.fast} "fast" mark`
      : explanation.label === 'struggling'
        ? `scored ${explanation.score.toFixed(2)}, at or below the ${explanation.thresholds.struggling} "struggling" mark`
        : `scored ${explanation.score.toFixed(2)}, between the ${explanation.thresholds.struggling} and ${explanation.thresholds.fast} marks`)
    : 'no score — none of the five terms had data';

  return (
    <View>
      {/* Plain sentence first, the score-vs-threshold detail demoted beneath it.
          The unscored case has no number to demote, so it stands alone. */}
      <View style={styles.leadBlock}>
        <Text style={styles.plainLead}>
          {explanation.scored ? PLAIN_SCORE_LEAD[explanation.label] : crossed}
        </Text>
        {explanation.scored ? (
          <Text style={styles.leadDetail}>{crossed}</Text>
        ) : null}
      </View>

      {terms.map((t) => (
        <ContributionBar
          key={t.term}
          label={TERM_LABEL[t.term] || t.term}
          detail={plainContributionDetail(t)}
          contribution={t.contribution}
          magnitude={Math.abs(t.contribution) / maxAbs}
        />
      ))}

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

      {shown.map((a) => (
        <ContributionBar
          key={a.feature}
          label={FEATURE_LABEL[a.feature] || a.feature}
          detail={formatValue(a.value)}
          contribution={a.contribution}
          magnitude={Math.abs(a.contribution) / maxAbs}
        />
      ))}

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

  const [report, setReport]         = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [printError, setPrintError] = useState(null);

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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Overview */}
        <Card style={styles.card}>
          <View style={styles.overview}>
            <View style={styles.overviewStats}>
              <StatCell label="Fast" value={String(totals.fast)} tint={TRAJECTORY_TINT.fast} />
              <StatCell label="Typical" value={String(totals.typical)} />
              <StatCell
                label="Struggling"
                value={String(totals.struggling)}
                tint={totals.struggling > 0 ? Colors.status.error : undefined}
              />
              <StatCell label="No prediction" value={String(totals.disabled)} />
            </View>
            <Text style={styles.overviewMeta}>
              {totals.words_predicted} of {totals.words_total} words have a prediction
              {' · '}{totals.tier2} AI estimate{totals.tier2 === 1 ? '' : 's'}, {totals.tier1} rule-based
            </Text>
          </View>
        </Card>

        {/* TASK-48 — a print failure is reported here and nowhere else; the
            report below stays exactly as it was. */}
        {printError ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>{printError}</Text>
          </View>
        ) : null}

        {/* TASK-47 — how practice is going over time. Sits with the at-a-glance
            summary rather than under the per-word detail. This is practice
            accuracy, not the mastery status shown per word below. */}
        <Section title="Practice trend" subtitle="Accuracy per day · dashed line is the pass mark">
          <View style={styles.trendWrap}>
            <TrendSparkline
              points={timeline}
              width={width - Layout.spacing.lg * 2 - Layout.spacing.md * 2}
            />
          </View>
        </Section>

        {/* DEC-07 — mandatory reliability caveat, placed immediately under the
            overview so it is on screen before any Tier 2 result can be read. */}
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

        {categories.map(([key, rows]) => (
          <Section
            key={key}
            title={CATEGORY_LABEL[key]}
            subtitle={`${rows.filter((r) => r.tier !== 'disabled').length} of ${rows.length} predicted`}
          >
            <View style={styles.wordBlock}>
              {rows.map((row) => (
                <WordRow key={row.word_id} row={row} studentId={student.sid} />
              ))}
            </View>
          </Section>
        ))}

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
  retry:    { fontSize: Layout.fontSize.sm, color: Colors.text.link, fontFamily: 'DMSans_700Bold' },

  card:    { marginBottom: 0 },
  section: { marginTop: Layout.spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Layout.spacing.sm },
  sectionTitle: { fontSize: Layout.fontSize.md, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  sectionSub:   { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  muted:   { fontSize: Layout.fontSize.xs, color: Colors.text.muted, lineHeight: 17 },

  overview:      { padding: Layout.spacing.md, gap: Layout.spacing.sm },
  overviewStats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },
  overviewMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'DMSans_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  wordBlock: { padding: Layout.spacing.md, gap: Layout.spacing.md },
  wordRow:   { gap: 6 },
  wordHead:  { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  wordName:  { flex: 1, fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  wordLabel: { fontSize: Layout.fontSize.sm, fontFamily: 'DMSans_800ExtraBold', textAlign: 'right' },

  tierPill:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Layout.radius.full },
  tierPillText: { fontSize: 10, fontFamily: 'DMSans_700Bold' },

  // TASK-45 — plain sentence carries the meaning, the numbers sit under it at
  // the same visual weight as a bar's detail line.
  leadBlock:  { marginBottom: Layout.spacing.xs },
  plainLead:  {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text.primary,
    lineHeight: 19,
  },
  leadDetail: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 1 },

  barRow:      { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm, paddingVertical: 3 },
  barLabelWrap:{ width: 108 },
  barLabel:    { fontSize: Layout.fontSize.xs, color: Colors.text.primary, fontFamily: 'DMSans_600SemiBold' },
  barDetail:   { fontSize: 10, color: Colors.text.muted },
  barTrack:    { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4 },
  barValue:    { width: 46, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'DMSans_700Bold', color: Colors.text.secondary },

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
  historyToggleText: { fontSize: 10, color: Colors.text.link, fontFamily: 'DMSans_700Bold' },
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
