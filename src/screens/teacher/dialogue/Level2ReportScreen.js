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
import {
  StatTile,
  TrendChart,
  ProgressRow,
} from '../../../components/dialogue/ReportVisuals';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { level2Api } from '../../../api/level2';
import { formatDate } from '../../../utils/formatters';
import { buildReportHtml, printReport, printTimestamp } from '../../../utils/reportPrint';

// ---------------------------------------------------------------------------
// Plain-language mappings (TASK-46, following TASK-45's conventions)
//
// Nothing a teacher reads on this screen is a raw enum. Every stored value —
// status, pathway, step3_result, the element booleans — is turned into a
// sentence here, with the numbers kept as secondary detail rather than as the
// thing carrying the meaning.
// ---------------------------------------------------------------------------

/**
 * Topic names, taken verbatim from what the child sees on
 * L2TopicSelectionScreen.js, so a teacher recognises the topic the child
 * actually played rather than a second invented name for it.
 */
const TOPIC_LABEL = {
  self_introduction: 'Self-Introduction',
  describe_friend:   'Describing a Friend',
  describe_pet:      'Describing a Pet',
};

/**
 * Status wording and colour. The thresholds behind these are level2Service.js's
 * own: a session "passes" at a sentence-by-sentence score of 4+ out of 5,
 * mastery needs two passes on different days, and struggling means three
 * consecutive sessions scoring 1 or less.
 *
 * 'not_started' is deliberately muted and neutrally worded — a topic the child
 * simply has not reached yet must never read as a problem (AC5).
 */
const STATUS_META = {
  mastered:    { label: 'Mastered',      bg: Colors.status.successLight, fg: '#22A05F' },
  in_progress: { label: 'In progress',   bg: Colors.status.infoLight,    fg: Colors.text.link },
  struggling:  { label: 'Needs support', bg: Colors.status.errorLight,   fg: Colors.status.error },
  not_started: { label: 'Not started',   bg: Colors.surfaceAlt,          fg: Colors.text.muted },
};

/** How the child answered. Never rendered as the stored 'verbal'/'non_verbal'. */
const PATHWAY_LABEL = {
  verbal:     'speech',
  non_verbal: 'picture choices',
};

/** The five parts of the paragraph, named the way a teacher would say them. */
const ELEMENT_LABEL = {
  name:     'name',
  age:      'age',
  hometown: 'hometown',
  gender:   'boy or girl',
  activity: 'favourite activity',
};

const TOPIC_ORDER = ['self_introduction', 'describe_friend', 'describe_pet'];

const TOPIC_ICON = {
  self_introduction: 'person-outline',
  describe_friend:   'people-outline',
  describe_pet:      'paw-outline',
};

/** "a", "a and b", "a, b, and c" — so the sentences below read as English. */
function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const labelElements = (keys) => formatList(keys.map((k) => ELEMENT_LABEL[k] || k));

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

function StatusChip({ status }) {
  const s = STATUS_META[status] || STATUS_META.not_started;
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text style={[styles.chipText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/** A plain sentence plus its supporting number, at TASK-45's two weights. */
function Line({ text, detail }) {
  return (
    <View>
      <Text style={styles.lineText}>{text}</Text>
      {detail ? <Text style={styles.lineDetail}>{detail}</Text> : null}
    </View>
  );
}

/** "Last attempted 18 Aug 2026, using speech" — or an unalarming absence. */
export function attemptSentence(topic) {
  if (!topic.last_session_date) return 'Not attempted yet.';
  const how = PATHWAY_LABEL[topic.last_pathway];
  const when = formatDate(topic.last_session_date);
  return how ? `Last attempted ${when}, using ${how}.` : `Last attempted ${when}.`;
}

/**
 * What came through in the full paragraph. A null score means the paragraph
 * step was never reached, which must not be reported as "all five missing".
 */
export function paragraphSentence(topic) {
  if (topic.paragraph_score == null) {
    return 'The full-paragraph step was not reached in this session.';
  }
  const included = topic.elements_included;
  const missing = topic.elements_missing;
  if (missing.length === 0) return `Included all five parts: ${labelElements(included)}.`;
  if (included.length === 0) {
    return `None of the five parts came through — ${labelElements(missing)} were all missing.`;
  }
  const wereWas = missing.length === 1 ? 'was' : 'were';
  return `Included ${labelElements(included)}; ${labelElements(missing)} ${wereWas} missing.`;
}

/**
 * TASK-47 — one topic's session-by-session accuracy, fetched only when opened
 * and cached in this component's own state, so reopening costs nothing. Never
 * part of the batch report payload.
 */
function TopicHistory({ studentId, topic }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (!next || points !== null || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const data = await level2Api.getTopicTimeline(studentId, topic);
      setPoints(data?.data?.points ?? data?.points ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [open, points, loading, studentId, topic]);

  return (
    <View>
      <TouchableOpacity style={styles.historyToggle} activeOpacity={0.7} onPress={toggle}>
        <Ionicons name="time-outline" size={13} color={Colors.text.link} />
        <Text style={styles.historyToggleText}>History</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.text.link} />
      </TouchableOpacity>

      {open ? (
        <View style={styles.historyBody}>
          {/* Practice over time, not the mastery status on the chip above. */}
          <Text style={styles.historyNote}>
            Session-by-session accuracy for this topic — separate from the status above.
          </Text>
          {loading ? (
            <ActivityIndicator color={Colors.icon.active} style={styles.historyLoading} />
          ) : failed ? (
            <Text style={styles.historyNote}>Could not load this topic’s history.</Text>
          ) : (
            <TrendSparkline points={points ?? []} width={220} height={48} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function TopicBlock({ topic, studentId }) {
  const started = topic.status !== 'not_started';

  return (
    <View style={styles.topicBlock}>
      <Line text={attemptSentence(topic)} />

      {started && topic.sessions_attempted > 0 ? (
        <Line
          text={topic.sessions_attempted === 1
            ? 'One session so far.'
            : `${topic.sessions_attempted} sessions so far.`}
        />
      ) : null}

      {topic.last_session_date ? (
        <>
          <Line
            text={paragraphSentence(topic)}
            detail={topic.paragraph_score != null
              ? `${topic.paragraph_score} of 5 parts detected`
              : null}
          />

          {topic.sentence_by_sentence_score != null ? (
            <Line
              text="Saying the sentences one at a time is the part mastery is judged on."
              detail={`${topic.sentence_by_sentence_score} of 5 sentences`}
            />
          ) : null}

          {/* Omitted entirely when there were no sentences, rather than
              rendering a "0 of 0" line. */}
          {topic.sentences_total > 0 ? (
            <Line
              text={topic.sentences_needing_hints === 0
                ? `Needed no hints across ${topic.sentences_total} sentences.`
                : `Needed a hint on ${topic.sentences_needing_hints} of ${topic.sentences_total} sentences.`}
            />
          ) : null}

          {/* Only rendered when true — the house convention is to say nothing
              rather than to render an absent thing as "no". */}
          {topic.used_picture_fallback ? (
            <Line text="Used the picture-choice fallback during this session." />
          ) : null}

          {topic.silence_timeout ? (
            <Line text="The session waited through a silence without an answer at least once." />
          ) : null}

          <TopicHistory studentId={studentId} topic={topic.topic} />
        </>
      ) : null}
    </View>
  );
}

/**
 * TASK-48 — the printable shape of this report, built from state already on
 * screen. Every line comes from the same helpers the topic sections render
 * with, so print and screen cannot drift. Charts are excluded (task §0).
 */
export function buildLevel2PrintModel(report, studentName) {
  const { totals, topics } = report;

  const sections = TOPIC_ORDER
    .map((key) => topics.find((t) => t.topic === key))
    .filter(Boolean)
    .map((topic) => {
      const lines = [
        `Status: ${(STATUS_META[topic.status] || STATUS_META.not_started).label}`,
        attemptSentence(topic),
      ];
      if (topic.status !== 'not_started' && topic.sessions_attempted > 0) {
        lines.push(topic.sessions_attempted === 1
          ? 'One session so far.'
          : `${topic.sessions_attempted} sessions so far.`);
      }
      if (topic.last_session_date) {
        lines.push(paragraphSentence(topic));
        if (topic.sentence_by_sentence_score != null) {
          lines.push(
            'Saying the sentences one at a time is the part mastery is judged on: '
            + `${topic.sentence_by_sentence_score} of 5 sentences.`
          );
        }
        if (topic.sentences_total > 0) {
          lines.push(topic.sentences_needing_hints === 0
            ? `Needed no hints across ${topic.sentences_total} sentences.`
            : `Needed a hint on ${topic.sentences_needing_hints} of ${topic.sentences_total} sentences.`);
        }
        // Same convention as the screen: absent things are simply not mentioned.
        if (topic.used_picture_fallback) {
          lines.push('Used the picture-choice fallback during this session.');
        }
        if (topic.silence_timeout) {
          lines.push('The session waited through a silence without an answer at least once.');
        }
      }
      return { heading: TOPIC_LABEL[topic.topic] || topic.topic, lines };
    });

  return {
    title: 'Level 2 Sentence Construction Report',
    studentName,
    generatedAt: printTimestamp(),
    overview: [
      { label: 'Mastered', value: String(totals.mastered) },
      { label: 'In progress', value: String(totals.in_progress) },
      { label: 'Needs support', value: String(totals.struggling) },
      { label: 'Not started', value: String(totals.not_started) },
      {
        label: 'Topics started',
        value: `${totals.topics_started} of ${totals.topics_total}`,
      },
    ],
    sections,
    footnote:
      'Each topic shows its most recent session. Mastery needs two sessions '
      + 'scoring 4 or more out of 5 on different days; "Needs support" appears '
      + 'after three sessions in a row scoring 1 or less.',
  };
}

export default function Level2ReportScreen({ route, navigation }) {
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

  const load = useCallback(async () => {
    if (!student?.sid) return;
    try {
      setError(null);
      // Both started together — the trend never queues behind the report.
      const [reportResult, timelineResult] = await Promise.allSettled([
        level2Api.getReport(student.sid),
        level2Api.getModuleTimeline(student.sid),
      ]);

      if (reportResult.status === 'rejected') throw reportResult.reason;
      setReport(reportResult.value?.data ?? null);
      // A failing trend degrades to its own empty state, never the whole screen.
      setTimeline(timelineResult.status === 'fulfilled'
        ? (timelineResult.value?.data?.points ?? timelineResult.value?.points ?? [])
        : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => { load(); }, [load]);

  // TASK-48 — print what is already on screen; never triggers a fetch.
  const handlePrint = useCallback(async () => {
    if (!report || printing) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const model = buildLevel2PrintModel(report, student?.full_name ?? '');
      await printReport(buildReportHtml(model));
    } catch (err) {
      setPrintError(err?.message || 'Could not open the print dialog.');
    } finally {
      setPrinting(false);
    }
  }, [report, printing, student?.full_name]);

  useEffect(() => {
    navigation.setOptions({
      title: student?.full_name ? `${student.full_name} · Level 2` : 'Level 2 Report',
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

  const { totals, topics } = report;
  const byTopic = TOPIC_ORDER
    .map((key) => topics.find((t) => t.topic === key))
    .filter(Boolean);

  // The trend stated in words above the chart; the chart is the evidence.
  const scored = timeline.filter((p) => typeof p.accuracy === 'number');
  const trendRange = scored.length > 0
    ? (scored.length === 1
      ? formatDate(scored[0].date)
      : `${formatDate(scored[0].date)} — ${formatDate(scored[scored.length - 1].date)}`)
    : null;
  const trendLead = (() => {
    if (scored.length === 0) return 'No completed Level 2 session has been recorded in this window yet.';
    const latest = scored[scored.length - 1];
    const outOfFive = Math.round(latest.accuracy * 5 * 10) / 10;
    if (scored.length === 1) {
      return `${firstName} scored ${outOfFive} out of 5 on the one session recorded.`;
    }
    const delta = latest.accuracy - scored[0].accuracy;
    const shape = delta > 0.08 ? 'improving' : delta < -0.08 ? 'slipping' : 'steady';
    const sessions = scored.reduce((n, p) => n + (p.attempts || 0), 0);
    if (shape === 'steady') {
      return `${firstName} is holding steady around ${outOfFive} out of 5, across ${sessions} sessions on ${scored.length} days.`;
    }
    return shape === 'improving'
      ? `${firstName} is improving — ${outOfFive} out of 5 most recently, up from ${Math.round(scored[0].accuracy * 5 * 10) / 10}, across ${sessions} sessions.`
      : `${firstName} has slipped to ${outOfFive} out of 5, down from ${Math.round(scored[0].accuracy * 5 * 10) / 10}, across ${sessions} sessions.`;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.tileRow}>
          <StatTile
            icon="ribbon-outline"
            label="Mastered"
            value={`${totals.mastered} / ${totals.topics_total}`}
            sub={`${totals.topics_started} started`}
            tone="plain"
          />
          <StatTile icon="hourglass-outline" label="In progress" value={String(totals.in_progress)} tone="neutral" />
        </View>
        <View style={styles.tileRow}>
          <StatTile
            icon="alert-circle-outline"
            label="Needs support"
            value={String(totals.struggling)}
            tone={totals.struggling > 0 ? 'warn' : 'idle'}
          />
          <StatTile icon="ellipse-outline" label="Not started" value={String(totals.not_started)} tone="idle" />
        </View>

        {/* TASK-48 — a print failure is reported here and nowhere else; the
            report below stays exactly as it was. */}
        {printError ? (
          <View style={styles.hint}>
            <Ionicons name="alert-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>{printError}</Text>
          </View>
        ) : null}

        {/* TASK-47 — practice over time across all three topics. */}
        <Section
          title="Practice trend"
          subtitle="Session score per day, out of five"
          right={trendRange ? <View style={styles.rangeChip}><Text style={styles.rangeChipText}>{trendRange}</Text></View> : null}
        >
          <View style={styles.trendWrap}>
            <Text style={styles.trendLead}>{trendLead}</Text>
            <TrendChart
              points={timeline}
              width={width - Layout.spacing.lg * 2 - Layout.spacing.md * 2}
              accentLabel="Session score"
            />
          </View>
        </Section>

        {/* Topic progress at a glance, before the per-topic detail. */}
        <Section title="Topics" subtitle="How far each one has come">
          <View style={styles.categoryBlock}>
            {byTopic.map((topic) => {
              const meta = STATUS_META[topic.status] || STATUS_META.not_started;
              return (
                <ProgressRow
                  key={topic.topic}
                  icon={TOPIC_ICON[topic.topic]}
                  iconBg={meta.bg}
                  label={TOPIC_LABEL[topic.topic] || topic.topic}
                  done={topic.sentence_by_sentence_score ?? 0}
                  total={5}
                  right={meta.label}
                  color={meta.fg}
                />
              );
            })}
          </View>
        </Section>

        {totals.topics_started === 0 && (
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>
              No Level 2 topic has been started yet. Each topic below will fill in
              once a session has been played.
            </Text>
          </View>
        )}

        {byTopic.map((topic) => (
          <Section
            key={topic.topic}
            title={TOPIC_LABEL[topic.topic] || topic.topic}
            right={<StatusChip status={topic.status} />}
          >
            <View style={styles.topicCard}>
              <TopicBlock topic={topic} studentId={student?.sid} />
            </View>
          </Section>
        ))}

        <Text style={styles.footnote}>
          Each topic shows its most recent session. Mastery needs two sessions
          scoring 4 or more out of 5 on different days; “Needs support” appears
          after three sessions in a row scoring 1 or less.
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

  overview:      { padding: Layout.spacing.md, gap: Layout.spacing.sm },
  overviewStats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },
  overviewMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted },

  // Redesign — headline tiles + trend card.
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
  categoryBlock: { padding: Layout.spacing.md, gap: Layout.spacing.lg },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'Nunito_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  topicCard:  { padding: Layout.spacing.md },
  topicBlock: { gap: Layout.spacing.sm },

  lineText:   { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_600SemiBold', color: Colors.text.primary, lineHeight: 19 },
  lineDetail: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 1 },

  chip:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Layout.radius.full },
  chipText: { fontSize: 10, fontFamily: 'Nunito_700Bold' },

  // TASK-47 — module trend + per-topic history
  trendWrap: { padding: Layout.spacing.md },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  historyToggleText: { fontSize: 10, color: Colors.text.link, fontFamily: 'Nunito_700Bold' },
  historyBody:    { paddingTop: 2, gap: 4 },
  historyNote:    { fontSize: 10, color: Colors.text.muted, lineHeight: 15 },
  historyLoading: { alignSelf: 'flex-start', paddingVertical: Layout.spacing.sm },

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
