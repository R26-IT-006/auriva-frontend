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
import { TrendSparkline } from '../../../components/charts/TrendSparkline';
import TeacherTopBar from '../../../components/teacher/TeacherTopBar';
import HeaderPillButton from '../../../components/common/HeaderPillButton';
import { MasteryRing } from '../../../components/charts/MasteryRing';
import {
  ReportSection as Section, SummaryTile, SummaryTiles, PracticeTrendCard, shortList,
  REPORT_GREEN as GREEN, REPORT_BLUE as BLUE, REPORT_RED as RED,
} from '../../../components/teacher/DialogueReportKit';
import { Colors, LOGIN_BACKDROP } from '../../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Layout } from '../../../constants/layout';
import { dialogueApi } from '../../../api/dialogue';
import { buildReportHtml, printReport, printTimestamp } from '../../../utils/reportPrint';
import { rs, rf } from '../../../utils/responsive';

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

// ── Look ─────────────────────────────────────────────────────────────────────
// The Concept report's palette: its brand green for the headline card, and one
// light tint per section heading.
const BRAND = Colors.brandDeep;
const TILE_ACCENT = { fast: '#3FAE6F', typical: '#3B82C4', struggling: '#E0735F' };
const HEAD_TINT = {
  trend: { bg: '#E3F7EC', fg: '#3FAE6F' },   // green
  words: { bg: '#EFEBFA', fg: '#6C5CE0' },   // purple
};

const CATEGORY_ICON = {
  greetings:   'hand-left-outline',
  magic_words: 'sparkles-outline',
  abilities:   'walk-outline',
};

// A signal's bar colour follows how good that one signal was (0-1), so a slow
// response stands out even on a word that is going well overall.
function signalColor(v) {
  if (v == null) return Colors.icon.muted;
  if (v >= 0.67) return GREEN;
  if (v >= 0.34) return '#E0962B';
  return RED;
}

/** The raw signal as a teacher reads it: "3", "100%", "none", "1 prompt", "4.4s". */
function signalValue(term, raw) {
  if (raw == null) return '—';
  switch (term) {
    case 'phoneme':   return typeof raw === 'number' ? `${Math.round(raw * 100)}%` : formatValue(raw);
    case 'echolalia': return raw ? 'present' : 'none';
    case 'prompt':    return typeof raw === 'number' ? `${raw} ${raw === 1 ? 'prompt' : 'prompts'}` : formatValue(raw);
    case 'latency':   return typeof raw === 'number' ? `${(raw / 1000).toFixed(1)}s` : formatValue(raw);
    default:          return formatValue(raw);
  }
}

/** One Tier 1 signal: name and value over a bar, its weight beside the value. */
function SignalBar({ term }) {
  const v = typeof term.normalizedValue === 'number'
    ? term.normalizedValue
    : (term.renormalizedWeight ? term.contribution / term.renormalizedWeight : null);
  const color = signalColor(v);
  return (
    <View style={styles.signal}>
      <View style={styles.signalHead}>
        <Text style={styles.signalLabel}>{TERM_LABEL[term.term] || term.term}</Text>
        <Text style={[styles.signalValue, { color }]}>{signalValue(term.term, term.rawValue)}</Text>
        <Text style={styles.signalWeight}>{Math.round((term.renormalizedWeight || 0) * 100)}%</Text>
      </View>
      <View style={styles.signalTrack}>
        <View style={[styles.signalFill, { width: `${Math.max(2, Math.round((v ?? 0) * 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/**
 * One SHAP bar. `magnitude` is 0-1 relative to the largest bar in the same
 * group, so bars are comparable within a word but never imply a shared scale
 * across words.
 */
function ContributionBar({ label, detail, contribution, magnitude }) {
  const positive = contribution >= 0;
  return (
    <View style={styles.signal}>
      <View style={styles.signalHead}>
        <Text style={styles.signalLabel}>{label}</Text>
        {detail != null ? <Text style={styles.signalDetail}>{detail}</Text> : null}
        <Text style={styles.signalWeight}>{positive ? '+' : '−'}{Math.abs(contribution).toFixed(2)}</Text>
      </View>
      <View style={styles.signalTrack}>
        <View
          style={[
            styles.signalFill,
            {
              width: `${Math.max(2, Math.round(magnitude * 100))}%`,
              backgroundColor: positive ? Colors.status.info : Colors.icon.muted,
            },
          ]}
        />
      </View>
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
function Tier1Breakdown({ explanation, wide }) {
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
    <View style={styles.breakdown}>
      {/* The plain sentence is the card's summary line; the score-vs-threshold
          detail that backs it opens here. */}
      {explanation.scored ? <Text style={styles.leadDetail}>{crossed}</Text> : null}

      <View style={styles.signalGrid}>
        {terms.map((t) => (
          <View key={t.term} style={wide ? styles.signalHalf : styles.signalFull}>
            <SignalBar term={t} />
          </View>
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
function Tier2Breakdown({ explanation, wide }) {
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
    <View style={styles.breakdown}>
      {/* The plain phrase and the raw vote share are the card's summary line. */}
      <View style={styles.signalGrid}>
        {shown.map((a) => (
          <View key={a.feature} style={wide ? styles.signalHalf : styles.signalFull}>
            <ContributionBar
              label={FEATURE_LABEL[a.feature] || a.feature}
              detail={formatValue(a.value)}
              contribution={a.contribution}
              magnitude={Math.abs(a.contribution) / maxAbs}
            />
          </View>
        ))}
      </View>

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
        <Ionicons name="time-outline" size={14} color={Colors.text.link} />
        <Text style={styles.historyToggleText}>History</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.text.link} />
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
            <TrendSparkline points={points ?? []} width={260} height={48} />
          )}
        </View>
      ) : null}
    </View>
  );
}

// How each trajectory reads on a word card: a plain phrase, its colour and tint.
const WORD_STATUS = {
  fast:       { label: 'Going well',    fg: '#2E9E62', bg: '#E3F7EC' },
  typical:    { label: 'Typical pace',  fg: '#3B82C4', bg: '#E6F1FC' },
  struggling: { label: 'Needs support', fg: '#E0735F', bg: '#FBE7E2' },
  none:       { label: 'No prediction', fg: Colors.text.muted, bg: '#EEF1F4' },
};
const statusKeyOf = (row) => (row.tier === 'disabled' ? 'none' : (WORD_STATUS[row.trajectory] ? row.trajectory : 'typical'));

/** The one line a folded card shows — the same sentence the open card leads with. */
function wordSummary(row) {
  if (row.tier === 'disabled') return row.caveat || 'No prediction for this word yet.';
  if (row.tier === 'tier1') {
    if (!row.explanation) return 'No breakdown available for this word.';
    return row.explanation.scored
      ? PLAIN_SCORE_LEAD[row.explanation.label]
      : 'No score — none of the five terms had data.';
  }
  return `The model’s prediction: ${voteShareLabel(row.confidence)}`
    + (row.confidence != null ? ` (${row.confidence.toFixed(2)})` : '');
}

/**
 * One predicted word as a card. Folded it is a glance — score, name, status;
 * open, it shows everything the row always carried: the plain sentence, the
 * breakdown with its placeholder-weights footer, the row's caveat, and history.
 */
function WordCard({ row, studentId, open, onToggle, wide }) {
  const s = WORD_STATUS[statusKeyOf(row)];
  const scored = row.tier === 'tier1' && row.explanation?.scored;

  return (
    <View style={[styles.wordCard, { borderLeftColor: s.fg }]}>
      <TouchableOpacity
        style={styles.wordTop}
        activeOpacity={0.75}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${row.word}, ${s.label}. ${open ? 'Tap to fold' : 'Tap for details'}`}
      >
        {scored ? (
          <MasteryRing value={row.explanation.score} size={60} strokeWidth={5} color={s.fg} />
        ) : (
          <View style={[styles.wordIcon, { backgroundColor: s.bg }]}>
            <Ionicons name="sparkles" size={22} color={s.fg} />
          </View>
        )}

        <View style={styles.wordMain}>
          <Text style={styles.wordName} numberOfLines={1}>{row.word}</Text>
          <Text style={styles.wordTier}>{row.tier === 'tier2' ? 'AI estimate' : 'Rule-based'}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusPillText, { color: s.fg }]}>{s.label}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.icon.default} />
      </TouchableOpacity>

      {open ? (
        <View style={styles.wordBody}>
          <Text style={styles.wordLead}>{wordSummary(row)}</Text>
          {row.tier === 'tier1' ? (
            <Tier1Breakdown explanation={row.explanation} wide={wide} />
          ) : (
            <Tier2Breakdown explanation={row.explanation} wide={wide} />
          )}
          {row.caveat ? <Text style={styles.rowCaveat}>{row.caveat}</Text> : null}
          <WordHistory studentId={studentId} wordId={row.word_id} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The words with no prediction, together. Their caveat is the same sentence for
 * each, so it is said once rather than on every row; the words are chips, and
 * tapping one opens that word's history beneath.
 */
function NotPredictedGroup({ rows, studentId }) {
  const [openId, setOpenId] = useState(null);
  const notes = [...new Set(rows.map((r) => r.caveat).filter(Boolean))];
  const openRow = rows.find((r) => r.word_id === openId);

  return (
    <View style={styles.noneGroup}>
      <View style={styles.noneHead}>
        <View style={styles.noneIcon}>
          <Ionicons name="remove" size={18} color={Colors.text.muted} />
        </View>
        <Text style={styles.noneTitle}>Not predicted yet</Text>
        <Text style={styles.noneCount}>{rows.length} {rows.length === 1 ? 'word' : 'words'}</Text>
      </View>
      {notes.map((n) => <Text key={n} style={styles.noneNote}>{n}</Text>)}
      <View style={styles.noneChips}>
        {rows.map((r) => {
          const on = r.word_id === openId;
          return (
            <TouchableOpacity
              key={r.word_id}
              style={[styles.noneChip, on && styles.noneChipOn]}
              activeOpacity={0.75}
              onPress={() => setOpenId(on ? null : r.word_id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              accessibilityLabel={`${r.word}. Tap for its history`}
            >
              <Text style={[styles.noneChipText, on && styles.noneChipTextOn]}>{r.word}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {openRow ? (
        <View style={styles.noneHistory}>
          <Text style={styles.noneHistoryTitle}>{openRow.word}</Text>
          <WordHistory key={openRow.word_id} studentId={studentId} wordId={openRow.word_id} />
        </View>
      ) : null}
    </View>
  );
}

/** The selected category at a glance: its status, the split, and the counts. */
function CategoryOverview({ label, icon, rows, status, allOpen, onToggleAll }) {
  const counts = ['fast', 'typical', 'struggling', 'none'].map((k) => ({
    key: k, n: rows.filter((r) => statusKeyOf(r) === k).length,
  }));
  const predicted = rows.length - counts[3].n;
  // Only the predicted words open, so Expand all is offered only when there are some.

  return (
    <View style={[styles.overview, { backgroundColor: status.color + '12' }]}>
      <View style={styles.overviewHead}>
        <View style={[styles.overviewIcon, { backgroundColor: status.color }]}>
          <Ionicons name={icon.replace(/-outline$/, '')} size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.overviewTitle}>{label} {status.phrase}</Text>
          <Text style={styles.overviewMeta}>{predicted} of {rows.length} predicted</Text>
        </View>
        {predicted > 0 ? (
          <TouchableOpacity onPress={onToggleAll} activeOpacity={0.7} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.expandAll}>{allOpen ? 'Collapse all' : 'Expand all'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.splitTrack}>
        {counts.filter((c) => c.n > 0).map((c) => (
          <View key={c.key} style={{ flex: c.n, backgroundColor: c.key === 'none' ? '#D9DEE4' : WORD_STATUS[c.key].fg }} />
        ))}
      </View>

    </View>
  );
}

/** "Greetings going well" — read off the category's own predicted rows. */
function categoryStatus(rows) {
  const predicted = rows.filter((r) => r.tier !== 'disabled');
  if (predicted.length === 0) return { phrase: 'not predicted yet', color: Colors.text.muted };
  const n = (t) => predicted.filter((r) => r.trajectory === t).length;
  if (n('struggling') > 0 && n('struggling') >= n('fast')) return { phrase: 'needs support', color: RED };
  if (n('fast') >= predicted.length / 2) return { phrase: 'going well', color: GREEN };
  return { phrase: 'progressing', color: BLUE };
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

  const [report, setReport]         = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [printError, setPrintError] = useState(null);
  // The word category on show, and which word cards are open.
  const [selected, setSelected]     = useState(null);
  const [openWords, setOpenWords]   = useState({});
  const { width: screenW } = useWindowDimensions();

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

  // The header is drawn inside the page (TeacherTopBar), like every other
  // teacher-workspace screen, so the navigator's own bar is hidden.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Print sits on the bar once there is a report to print.
  const topBar = (
    <TeacherTopBar
      title={student?.full_name ? `${student.full_name} · Trajectory` : 'Trajectory Report'}
      onBack={() => navigation.goBack()}
      right={report ? (
        <HeaderPillButton
          variant="outline"
          icon="print-outline"
          label={printing ? 'Printing…' : 'Print'}
          theme={{ button: Colors.brandDeep, buttonText: '#FFFFFF', headingText: Colors.text.primary }}
          onPress={handlePrint}
          accessibilityLabel="Print report"
        />
      ) : null}
    />
  );

  if (loading) {
    return (
      <LinearGradient colors={LOGIN_BACKDROP.colors} start={LOGIN_BACKDROP.start} end={LOGIN_BACKDROP.end} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.icon.active} /></View>
      </SafeAreaView>
    </LinearGradient>
    );
  }

  if (error || !report) {
    return (
      <LinearGradient colors={LOGIN_BACKDROP.colors} start={LOGIN_BACKDROP.start} end={LOGIN_BACKDROP.end} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={34} color={Colors.text.muted} />
          <Text style={styles.errorText}>{error || 'Could not load the report.'}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retry}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
    );
  }

  const { totals, words } = report;
  const categories = Object.keys(CATEGORY_LABEL)
    .map((key) => [key, words.filter((w) => w.category === key)])
    .filter(([, rows]) => rows.length > 0);
  const activeKey = categories.some(([k]) => k === selected) ? selected : categories[0]?.[0];
  const activeRows = categories.find(([k]) => k === activeKey)?.[1] ?? [];
  const predictedRows = activeRows.filter((r) => r.tier !== 'disabled');
  const noneRows = activeRows.filter((r) => r.tier === 'disabled');
  const status = categoryStatus(activeRows);

  const firstName = String(student?.full_name || 'This child').trim().split(/\s+/)[0];
  const goingWell = words.filter((w) => w.tier !== 'disabled' && w.trajectory === 'fast').map((w) => w.word);
  const needsHelp = words.filter((w) => w.tier !== 'disabled' && w.trajectory === 'struggling').map((w) => w.word);

  return (
    <LinearGradient colors={LOGIN_BACKDROP.colors} start={LOGIN_BACKDROP.start} end={LOGIN_BACKDROP.end} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {topBar}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Overview — the predicted count, then the three outcomes as tiles. */}
        <SummaryTiles oneRow>
          <SummaryTile
            icon="checkmark-done"
            label="Predicted"
            value={String(totals.words_predicted)}
            of={totals.words_total}
            progress={totals.words_total ? totals.words_predicted / totals.words_total : 0}
            sub={`${totals.tier2} AI · ${totals.tier1} rule-based`}
            accent={BRAND}
            compact
          />
          <SummaryTile icon="trending-up" label="Going well" value={String(totals.fast)} accent={TILE_ACCENT.fast} compact />
          <SummaryTile icon="remove" label="Typical" value={String(totals.typical)} accent={TILE_ACCENT.typical} compact />
          {/* Coral only when there is something to act on; at zero it wears the
              brand green, as the Concept report's "Revisit" card does. */}
          <SummaryTile
            icon="alert-circle"
            label="Needs support"
            value={String(totals.struggling)}
            accent={totals.struggling > 0 ? TILE_ACCENT.struggling : BRAND}
            compact
          />
        </SummaryTiles>

        {/* TASK-48 — a print failure is reported here and nowhere else; the
            report below stays exactly as it was. */}
        {printError ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>{printError}</Text>
          </View>
        ) : null}

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

        {/* TASK-47 — how practice is going over time. This is practice
            accuracy, not the mastery status shown per word below. */}
        <PracticeTrendCard
          points={timeline}
          firstName={firstName}
          subtitle="How often answers were right, day by day"
          icon="trending-up"
          iconTint={HEAD_TINT.trend}
          inside
          insights={[
            ...(goingWell.length ? [`Going well on ${shortList(goingWell)}.`] : []),
            ...(needsHelp.length ? [`Needs support on ${shortList(needsHelp)}.`] : []),
          ]}
        />

        {categories.length > 0 ? (
          <Section title="Words" subtitle="Pick a category to see its words" icon="chatbubbles" iconTint={HEAD_TINT.words} inside>
            {/* Equal segments across the card, so the three categories read as one
                switch rather than a row of loose buttons. */}
            <View style={styles.segments}>
              {categories.map(([key, rows]) => {
                const on = key === activeKey;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.segment, on && styles.segmentOn]}
                    activeOpacity={0.8}
                    onPress={() => setSelected(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={CATEGORY_ICON[key] || 'chatbubble-outline'} size={16} color={on ? BRAND : Colors.text.secondary} />
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>{CATEGORY_LABEL[key]}</Text>
                    <View style={[styles.segmentCount, on && styles.segmentCountOn]}>
                      <Text style={[styles.segmentCountText, on && styles.segmentCountTextOn]}>{rows.length}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CategoryOverview
              label={CATEGORY_LABEL[activeKey]}
              icon={CATEGORY_ICON[activeKey] || 'chatbubble-outline'}
              rows={activeRows}
              status={status}
              allOpen={predictedRows.length > 0 && predictedRows.every((r) => openWords[r.word_id])}
              onToggleAll={() => {
                const all = predictedRows.length > 0 && predictedRows.every((r) => openWords[r.word_id]);
                setOpenWords((prev) => {
                  const next = { ...prev };
                  predictedRows.forEach((r) => { next[r.word_id] = !all; });
                  return next;
                });
              }}
            />

            <View style={styles.wordList}>
              {predictedRows.map((row) => (
                <WordCard
                  key={row.word_id}
                  row={row}
                  studentId={student.sid}
                  open={!!openWords[row.word_id]}
                  onToggle={() => setOpenWords((prev) => ({ ...prev, [row.word_id]: !prev[row.word_id] }))}
                  wide={screenW >= 700}
                />
              ))}
              {noneRows.length > 0 ? <NotPredictedGroup rows={noneRows} studentId={student.sid} /> : null}
            </View>
          </Section>
        ) : null}

        <Text style={styles.footnote}>
          Based on each word’s most recent recorded session. “Rule-based” rows
          come from a fixed weighted score, “AI estimate” rows from the
          trajectory model — which has not yet been shown to be reliable on real
          data.
        </Text>
      </ScrollView>
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeInner: { flex: 1 },
  safe:     { flex: 1 },
  scroll:   { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Layout.spacing.sm, padding: Layout.spacing.xl },
  errorText:{ fontSize: Layout.fontSize.sm, color: Colors.text.secondary, textAlign: 'center' },
  retry:    { fontSize: Layout.fontSize.sm, color: Colors.text.link, fontFamily: 'DMSans_700Bold' },
  muted:    { fontSize: rf(12), color: Colors.text.muted, lineHeight: rf(17) },

  segments: {
    flexDirection: 'row', gap: rs(4), padding: rs(4),
    borderRadius: rs(14), backgroundColor: '#EEF1F5',
    marginBottom: rs(14),
  },
  segment: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6),
    paddingVertical: rs(10), paddingHorizontal: rs(8), borderRadius: rs(11),
  },
  segmentOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  segmentText:        { flexShrink: 1, fontSize: rf(14), fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },
  segmentTextOn:      { color: Colors.text.primary },
  segmentCount:       { minWidth: rs(22), paddingHorizontal: rs(6), paddingVertical: 1, borderRadius: rs(10), alignItems: 'center', backgroundColor: '#DFE4EA' },
  segmentCountOn:     { backgroundColor: '#E4F4EC' },
  segmentCountText:   { fontSize: rf(11), fontFamily: 'DMSans_700Bold', color: Colors.text.secondary },
  segmentCountTextOn: { color: BRAND },

  overview:      { borderRadius: rs(16), padding: rs(18), gap: rs(14), marginBottom: rs(20) },
  overviewHead:  { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  overviewIcon:  { width: rs(40), height: rs(40), borderRadius: rs(20), alignItems: 'center', justifyContent: 'center' },
  overviewTitle: { fontSize: rf(16), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  overviewMeta:  { fontSize: rf(13), color: Colors.text.secondary, marginTop: 2 },
  expandAll:     { fontSize: rf(13), fontFamily: 'DMSans_700Bold', color: Colors.text.link },
  splitTrack:    { flexDirection: 'row', height: rs(8), borderRadius: rs(4), overflow: 'hidden', backgroundColor: '#EEF1F4', gap: 2 },

  wordList: { gap: rs(14) },
  wordCard: {
    borderRadius: rs(18),
    borderWidth: 1,
    borderColor: '#EEF1F4',
    borderLeftWidth: 4,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  wordTop:   { flexDirection: 'row', alignItems: 'center', gap: rs(16), paddingVertical: rs(16), paddingHorizontal: rs(18) },
  wordIcon:  { width: rs(60), height: rs(60), borderRadius: rs(30), alignItems: 'center', justifyContent: 'center' },
  wordMain:  { flex: 1, gap: rs(3) },
  wordName:  { fontSize: rf(17), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  wordTier:  { fontSize: rf(12), color: Colors.text.muted },
  statusPill:     { paddingHorizontal: rs(12), paddingVertical: rs(5), borderRadius: Layout.radius.full },
  statusPillText: { fontSize: rf(13), fontFamily: 'DMSans_700Bold' },
  wordBody: {
    gap: rs(14),
    paddingHorizontal: rs(18), paddingBottom: rs(18), paddingTop: rs(16),
    borderTopWidth: 1, borderTopColor: '#EEF1F4',
  },
  wordLead: { fontSize: rf(14), lineHeight: rf(20), fontFamily: 'DMSans_600SemiBold', color: Colors.text.primary },

  noneGroup: {
    borderRadius: rs(18), padding: rs(18), gap: rs(12),
    backgroundColor: '#F6F8FA',
    marginTop: rs(6),
  },
  noneHead:  { flexDirection: 'row', alignItems: 'center', gap: rs(10) },
  noneIcon:  { width: rs(32), height: rs(32), borderRadius: rs(16), alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6EAEF' },
  noneTitle: { flex: 1, fontSize: rf(15), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  noneCount: { fontSize: rf(13), color: Colors.text.secondary },
  noneNote:  { fontSize: rf(12), lineHeight: rf(18), color: Colors.text.muted },
  noneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  noneChip: {
    paddingVertical: rs(8), paddingHorizontal: rs(14), borderRadius: Layout.radius.full,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EE',
  },
  noneChipOn:       { borderColor: Colors.text.link, backgroundColor: '#EEF4FD' },
  noneChipText:     { fontSize: rf(14), color: Colors.text.primary },
  noneChipTextOn:   { color: Colors.text.link, fontFamily: 'DMSans_600SemiBold' },
  noneHistory:      { gap: rs(4), padding: rs(12), borderRadius: rs(12), backgroundColor: '#FFFFFF' },
  noneHistoryTitle: { fontSize: rf(14), fontFamily: 'DMSans_700Bold', color: Colors.text.primary },


  breakdown: { gap: rs(8) },
  leadDetail:{ fontSize: rf(11), color: Colors.text.muted, lineHeight: rf(16), marginTop: 2 },

  signalGrid:   { flexDirection: 'row', flexWrap: 'wrap', columnGap: rs(20), rowGap: rs(10) },
  signalHalf:   { flexBasis: '46%', flexGrow: 1 },
  signalFull:   { flexBasis: '100%' },
  signal:       { gap: rs(5) },
  signalHead:   { flexDirection: 'row', alignItems: 'baseline', gap: rs(8) },
  signalLabel:  { flex: 1, fontSize: rf(13), color: Colors.text.primary },
  signalValue:  { fontSize: rf(13), fontFamily: 'DMSans_700Bold' },
  signalDetail: { fontSize: rf(12), color: Colors.text.secondary },
  signalWeight: { width: rs(38), textAlign: 'right', fontSize: rf(11), color: Colors.text.muted },
  signalTrack:  { height: rs(5), borderRadius: rs(3), backgroundColor: '#EEF1F4', overflow: 'hidden' },
  signalFill:   { height: '100%', borderRadius: rs(3) },

  absentNote: { fontSize: rf(11), color: Colors.text.muted, lineHeight: rf(16) },
  disclaimer: { fontSize: rf(11), color: Colors.text.muted, lineHeight: rf(16), fontStyle: 'italic' },
  rowCaveat:  { fontSize: rf(11), color: Colors.text.muted, lineHeight: rf(16) },

  // TASK-47 — per-word history
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    alignSelf: 'flex-start', paddingVertical: rs(4),
  },
  historyToggleText: { fontSize: rf(12), color: Colors.text.link, fontFamily: 'DMSans_600SemiBold' },
  historyBody:    { gap: rs(6) },
  historyNote:    { fontSize: rf(11), color: Colors.text.muted, lineHeight: rf(16) },
  historyLoading: { alignSelf: 'flex-start', paddingVertical: Layout.spacing.sm },

  hint: {
    flexDirection: 'row',
    gap: rs(8),
    marginTop: Layout.spacing.md,
    padding: rs(12),
    borderRadius: rs(12),
    backgroundColor: Colors.status.warningLight,
  },
  hintText: { flex: 1, fontSize: rf(12), color: '#8A5D06', lineHeight: rf(17) },

  footnote: {
    fontSize: rf(12),
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
