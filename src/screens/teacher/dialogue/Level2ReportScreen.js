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
  ReportSection, SummaryTile, SummaryTiles, PracticeTrendCard, shortList,
} from '../../../components/teacher/DialogueReportKit';

// The Level 1 Trajectory report's look, so the two dialogue reports match.
const BRAND = Colors.brandDeep;
const TILE_ACCENT = { mastered: '#3FAE6F', in_progress: '#3B82C4', struggling: '#E0735F' };
const HEAD_TINT = {
  trend:  { bg: '#E3F7EC', fg: '#3FAE6F' },   // green
  topics: { bg: '#EFEBFA', fg: '#6C5CE0' },   // purple
};
import { Colors, LOGIN_BACKDROP } from '../../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
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
  mastered:    { label: 'Mastered',      bg: '#E3F7EC', fg: '#2E9E62' },
  in_progress: { label: 'In progress',   bg: '#E6F1FC', fg: '#3B82C4' },
  struggling:  { label: 'Needs support', bg: '#FBE7E2', fg: '#E0735F' },
  not_started: { label: 'Not started',   bg: '#EEF1F4', fg: Colors.text.muted },
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

/** "a", "a and b", "a, b, and c" — so the sentences below read as English. */
function formatList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const labelElements = (keys) => formatList(keys.map((k) => ELEMENT_LABEL[k] || k));

const TOPIC_ICON = {
  self_introduction: 'person-outline',
  describe_friend:   'people-outline',
  describe_pet:      'paw-outline',
};

function StatusChip({ status }) {
  const s = STATUS_META[status] || STATUS_META.not_started;
  return (
    <View style={[styles.statusChip, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusChipText, { color: s.fg }]}>{s.label}</Text>
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

/** One measure out of a known total, as a labelled bar. `good` sets the colour. */
function MeasureBar({ label, value, total, good }) {
  const pct = total ? Math.max(0, Math.min(1, value / total)) : 0;
  const color = good == null ? '#3B82C4' : good >= 0.67 ? '#2E9E62' : good >= 0.34 ? '#E0962B' : '#E0735F';
  return (
    <View style={styles.measure}>
      <View style={styles.measureHead}>
        <Text style={styles.measureLabel}>{label}</Text>
        <Text style={[styles.measureValue, { color }]}>{value} of {total}</Text>
      </View>
      <View style={styles.measureTrack}>
        <View style={[styles.measureFill, { width: `${Math.max(2, Math.round(pct * 100))}%`, backgroundColor: color }]} />
      </View>
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
        <Ionicons name="time-outline" size={14} color={Colors.text.link} />
        <Text style={styles.historyToggleText}>History</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.text.link} />
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
            <TrendSparkline points={points ?? []} width={260} height={48} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function TopicBlock({ topic, studentId, wide }) {
  const started = topic.status !== 'not_started';
  const sentences = topic.sentence_by_sentence_score;

  return (
    <View style={styles.topicBlock}>
      {/* The measure mastery is judged on, as a ring beside the sentence that
          explains it. */}
      {topic.last_session_date && sentences != null ? (
        <View style={styles.leadRow}>
          <MasteryRing
            value={sentences / 5}
            size={72}
            strokeWidth={5}
            color={(STATUS_META[topic.status] || STATUS_META.not_started).fg}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.leadText}>
              Saying the sentences one at a time is the part mastery is judged on.
            </Text>
            <Text style={styles.lineDetail}>{`${sentences} of 5 sentences`}</Text>
          </View>
        </View>
      ) : null}

      {started && topic.sessions_attempted > 0 ? (
        <Line
          text={topic.sessions_attempted === 1
            ? 'One session so far.'
            : `${topic.sessions_attempted} sessions so far.`}
        />
      ) : null}

      {topic.last_session_date ? (
        <>
          <View style={styles.measureGrid}>
          {topic.paragraph_score != null ? (
            <View style={wide ? styles.measureHalf : styles.measureFull}>
              <MeasureBar label="Paragraph parts" value={topic.paragraph_score} total={5} good={topic.paragraph_score / 5} />
            </View>
          ) : null}
          {/* Omitted entirely when there were no sentences, rather than
              rendering a "0 of 0" bar. Fewer hints is better, so it colours
              by the share answered without one. */}
          {topic.sentences_total > 0 ? (
            <View style={wide ? styles.measureHalf : styles.measureFull}>
              <MeasureBar
                label="Hints needed"
                value={topic.sentences_needing_hints}
                total={topic.sentences_total}
                good={1 - topic.sentences_needing_hints / topic.sentences_total}
              />
            </View>
          ) : null}
          </View>

          <Line
            text={paragraphSentence(topic)}
            detail={topic.paragraph_score != null
              ? `${topic.paragraph_score} of 5 parts detected`
              : null}
          />

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

  const [report, setReport]         = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [printError, setPrintError] = useState(null);
  // The topic on show.
  const [selected, setSelected]     = useState(null);
  const { width: screenW } = useWindowDimensions();

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

  // The header is drawn inside the page (TeacherTopBar), like every other
  // teacher-workspace screen, so the navigator's own bar is hidden.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Print sits on the bar once there is a report to print.
  const topBar = (
    <TeacherTopBar
      title={student?.full_name ? `${student.full_name} · Level 2` : 'Level 2 Report'}
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

  const { totals, topics } = report;
  const byTopic = TOPIC_ORDER
    .map((key) => topics.find((t) => t.topic === key))
    .filter(Boolean);
  const active = byTopic.find((t) => t.topic === selected) ?? byTopic[0];

  const firstName = String(student?.full_name || 'This child').trim().split(/\s+/)[0];
  const named = (status) => byTopic
    .filter((t) => t.status === status)
    .map((t) => TOPIC_LABEL[t.topic] || t.topic);
  const mastered = named('mastered');
  const struggling = named('struggling');

  return (
    <LinearGradient colors={LOGIN_BACKDROP.colors} start={LOGIN_BACKDROP.start} end={LOGIN_BACKDROP.end} style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>
        {topBar}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Overview — topics started, then the three outcomes as tiles. */}
        <SummaryTiles oneRow>
          <SummaryTile
            icon="checkmark-done"
            label="Topics started"
            value={String(totals.topics_started)}
            of={totals.topics_total}
            progress={totals.topics_total ? totals.topics_started / totals.topics_total : 0}
            sub={`${totals.not_started} not started`}
            accent={BRAND}
            compact
          />
          <SummaryTile icon="trophy" label="Mastered" value={String(totals.mastered)} accent={TILE_ACCENT.mastered} compact />
          <SummaryTile icon="trending-up" label="In progress" value={String(totals.in_progress)} accent={TILE_ACCENT.in_progress} compact />
          {/* Coral only when there is something to act on, as on Level 1. */}
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

        {totals.topics_started === 0 && (
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
            <Text style={styles.hintText}>
              No Level 2 topic has been started yet. Each topic below will fill in
              once a session has been played.
            </Text>
          </View>
        )}

        {/* TASK-47 — practice over time across all three topics. Sits with the
            at-a-glance summary, above the per-topic detail. */}
        <PracticeTrendCard
          points={timeline}
          firstName={firstName}
          subtitle="Session score per day"
          unit="session"
          icon="trending-up"
          iconTint={HEAD_TINT.trend}
          inside
          insights={[
            ...(mastered.length ? [`Mastered ${shortList(mastered)}.`] : []),
            ...(struggling.length ? [`Needs support on ${shortList(struggling)}.`] : []),
          ]}
        />

        {byTopic.length > 0 ? (
          <ReportSection
            title="Topics"
            subtitle="Pick a topic to see how it went"
            icon="chatbubbles"
            iconTint={HEAD_TINT.topics}
            inside
          >
            {/* Equal segments across the card, as on Level 1's Words. */}
            <View style={styles.segments}>
              {byTopic.map((t) => {
                const on = t.topic === active?.topic;
                return (
                  <TouchableOpacity
                    key={t.topic}
                    style={[styles.segment, on && styles.segmentOn]}
                    activeOpacity={0.8}
                    onPress={() => setSelected(t.topic)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={TOPIC_ICON[t.topic] || 'chatbubble-outline'} size={16} color={on ? BRAND : Colors.text.secondary} />
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
                      {TOPIC_LABEL[t.topic] || t.topic}
                    </Text>
                    <View style={[styles.segmentDot, { backgroundColor: (STATUS_META[t.status] || STATUS_META.not_started).fg }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {active ? (() => {
              const meta = STATUS_META[active.status] || STATUS_META.not_started;
              return (
                <>
                  {/* The topic at a glance, tinted by its status. */}
                  <View style={[styles.topicPanel, { backgroundColor: meta.fg + '12' }]}>
                    <View style={[styles.topicIcon, { backgroundColor: meta.fg }]}>
                      <Ionicons name={(TOPIC_ICON[active.topic] || 'chatbubble-outline').replace(/-outline$/, '')} size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topicTitle}>{TOPIC_LABEL[active.topic] || active.topic}</Text>
                      <Text style={styles.topicMeta}>{attemptSentence(active)}</Text>
                    </View>
                    <StatusChip status={active.status} />
                  </View>
                  <TopicBlock topic={active} studentId={student?.sid} wide={screenW >= 700} />
                </>
              );
            })() : null}
          </ReportSection>
        ) : null}

        <Text style={styles.footnote}>
          Each topic shows its most recent session. Mastery needs two sessions
          scoring 4 or more out of 5 on different days; “Needs support” appears
          after three sessions in a row scoring 1 or less.
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

  segments: {
    flexDirection: 'row', gap: 4, padding: 4,
    borderRadius: 14, backgroundColor: '#EEF1F5',
    marginBottom: 20,
  },
  segment: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 11,
  },
  segmentOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  segmentText:   { flexShrink: 1, fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text.secondary },
  segmentTextOn: { color: Colors.text.primary },
  segmentDot:    { width: 8, height: 8, borderRadius: 4 },

  topicPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 18, marginBottom: 20 },
  topicIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text.primary },
  topicMeta:  { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  topicBlock: { gap: 16 },

  statusChip:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Layout.radius.full },
  statusChipText: { fontSize: 13, fontFamily: 'DMSans_700Bold' },

  leadRow:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  leadText: { fontSize: 14, lineHeight: 20, fontFamily: 'DMSans_600SemiBold', color: Colors.text.primary },

  lineText:   { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  lineDetail: { fontSize: 11, color: Colors.text.muted, lineHeight: 16, marginTop: 1 },

  measureGrid:  { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 14 },
  measureHalf:  { flexBasis: '46%', flexGrow: 1 },
  measureFull:  { flexBasis: '100%' },
  measure:      { gap: 6 },
  measureHead:  { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  measureLabel: { flex: 1, fontSize: 13, color: Colors.text.primary },
  measureValue: { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  measureTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF1F4', overflow: 'hidden' },
  measureFill:  { height: '100%', borderRadius: 3 },

  // TASK-47 — per-topic history
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingVertical: 4,
  },
  historyToggleText: { fontSize: 12, color: Colors.text.link, fontFamily: 'DMSans_600SemiBold' },
  historyBody:    { gap: 6 },
  historyNote:    { fontSize: 11, color: Colors.text.muted, lineHeight: 16 },
  historyLoading: { alignSelf: 'flex-start', paddingVertical: Layout.spacing.sm },

  hint: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Layout.spacing.md,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.status.warningLight,
  },
  hintText: { flex: 1, fontSize: 12, color: '#8A5D06', lineHeight: 17 },

  footnote: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
