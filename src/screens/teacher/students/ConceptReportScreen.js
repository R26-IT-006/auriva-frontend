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
import { MasteryRing } from '../../../components/charts/MasteryRing';
import { TierBar, TierLegend } from '../../../components/charts/TierBar';
import { TrendSparkline } from '../../../components/charts/TrendSparkline';
import { ConfusionList, formatConceptLabel } from '../../../components/charts/ConfusionList';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { teacherApi } from '../../../api/teacher';
import { scoreColor, formatPct, formatDuration } from '../../../utils/scoreColor';

const TIER_LABEL = { tier1_status: 'Identify', tier2_status: 'Name', tier3_status: 'Watch' };

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

  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);

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

  useEffect(() => { load(); }, [load]);

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

  const { totals, categories, concepts, confusions, response_times: rt, engagement, activities, timeline } = report;
  const activeCategories = categories.filter((c) => c.started > 0);

  // "Needs attention" = failed, or passed-but-weak. Ordered worst first so the
  // top of the list is where a teacher should start.
  const struggling = concepts
    .filter((c) => c.tier1_status === 'failed' || c.tier2_status === 'failed'
      || (typeof c.tier1_score === 'number' && c.tier1_score < 2 / 3))
    .sort((a, b) => (a.tier1_score ?? 1) - (b.tier1_score ?? 1));

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
        {/* Overview */}
        <Card style={styles.card}>
          <View style={styles.overview}>
            <MasteryRing value={totals.mastery_pct} size={104} label="mastery" />
            <View style={styles.overviewStats}>
              <StatCell label="Mastered" value={`${totals.mastered}/${totals.catalogue_concepts}`} />
              <StatCell label="Identified" value={String(totals.tier1_passed)} />
              <StatCell label="Named" value={String(totals.tier2_passed)} />
              <StatCell
                label="Needs work"
                value={String(struggling.length)}
                tint={struggling.length > 0 ? Colors.status.error : undefined}
              />
            </View>
          </View>
        </Card>

        <Section title="Accuracy trend" subtitle="Last 30 days · dashed line is the pass mark">
          <View style={styles.trendWrap}>
            <TrendSparkline points={timeline} width={width - Layout.spacing.lg * 2 - Layout.spacing.md * 2} />
          </View>
        </Section>

        <Section title="Categories" subtitle={`${activeCategories.length} of ${categories.length} started`}>
          <View style={styles.categoryBlock}>
            {activeCategories.length === 0 ? (
              <Text style={styles.muted}>No category started yet.</Text>
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
                              <Text style={styles.conceptName} numberOfLines={1}>
                                {formatConceptLabel(r.concept_key)}
                                {r.in_catalogue ? '' : ' *'}
                              </Text>
                              <View style={styles.pills}>
                                {Object.keys(TIER_LABEL).map((k) => (
                                  <TierPill key={k} status={r[k]} />
                                ))}
                              </View>
                              <Text style={[styles.conceptScore, { color: scoreColor(r.tier1_score) }]}>
                                {formatPct(r.tier1_score)}
                              </Text>
                              <Text style={styles.conceptMeta}>
                                {r.real_attempts > 0 ? `${r.real_attempts} tries` : '—'}
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

        {struggling.length > 0 && (
          <Section title="Needs attention" subtitle="Weakest first">
            <View style={styles.strugglingBlock}>
              {struggling.slice(0, 8).map((c) => (
                <View key={`${c.category_key}/${c.concept_key}`} style={styles.strugglingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.strugglingName}>{formatConceptLabel(c.concept_key)}</Text>
                    <Text style={styles.strugglingMeta}>
                      {c.real_attempts} attempts
                      {c.avg_response_ms ? ` · ${(c.avg_response_ms / 1000).toFixed(1)}s avg` : ''}
                      {c.tier1_retry_count > 0 ? ` · ${c.tier1_retry_count} retries` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.strugglingScore, { color: scoreColor(c.tier1_score) }]}>
                    {formatPct(c.tier1_score)}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Common mix-ups" subtitle="What was chosen instead of the right answer">
          <View style={styles.padded}>
            <ConfusionList items={confusions} />
          </View>
        </Section>

        <Section title="Response time" subtitle={rt.sample_size > 0 ? `${rt.sample_size} attempts` : 'No timed attempts yet'}>
          <View style={styles.padded}>
            <View style={styles.rtRow}>
              <StatCell label="Overall" value={rt.overall_avg_ms ? `${(rt.overall_avg_ms / 1000).toFixed(1)}s` : '—'} />
              <StatCell label="When right" value={rt.correct_avg_ms ? `${(rt.correct_avg_ms / 1000).toFixed(1)}s` : '—'} />
              <StatCell label="When wrong" value={rt.incorrect_avg_ms ? `${(rt.incorrect_avg_ms / 1000).toFixed(1)}s` : '—'} />
            </View>
            {guessing && (
              <View style={styles.hint}>
                <Ionicons name="information-circle-outline" size={16} color="#B4780A" />
                <Text style={styles.hintText}>
                  Wrong answers come noticeably faster than right ones — this often means guessing rather than
                  not knowing. Slowing the pace may help more than repeating the material.
                </Text>
              </View>
            )}
          </View>
        </Section>

        <Section title="Engagement">
          <View style={[styles.padded, styles.engagementGrid]}>
            <StatCell label="Image taps" value={String(engagement.total_taps)} />
            <StatCell label="Looking" value={formatDuration(engagement.exposure_ms)} />
            <StatCell label="Video" value={formatDuration(engagement.video_ms)} />
            <StatCell label="Colouring" value={String(engagement.coloring_sessions)} />
            {engagement.relearn_count > 0 && (
              <StatCell label="Re-taught" value={String(engagement.relearn_count)} />
            )}
          </View>
        </Section>

        {activities.length > 0 && (
          <Section title="Practice activities" subtitle="Mixed-concept rounds, scored on the server">
            <View style={styles.padded}>
              {activities.slice(0, 8).map((a, i) => (
                <View key={`${a.category_key}-${a.activity_number}-${i}`} style={styles.activityRow}>
                  <View style={styles.activityNum}>
                    <Text style={styles.activityNumText}>{a.activity_number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>
                      {(a.concept_keys || []).map(formatConceptLabel).join(', ') || 'Mixed practice'}
                    </Text>
                    <Text style={styles.activityMeta}>
                      Level {a.difficulty_level} · {a.correct_count}/{a.total_rounds} correct
                    </Text>
                  </View>
                  <Text style={[styles.activityScore, { color: scoreColor(a.score) }]}>
                    {formatPct(a.score)}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Text style={styles.footnote}>
          Based on activity from the last {report.window_days} days.
          {concepts.some((c) => !c.in_catalogue) ? '  * no longer in the concept list.' : ''}
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
  padded:  { padding: Layout.spacing.md },
  muted:   { fontSize: Layout.fontSize.sm, color: Colors.text.muted },

  overview:      { flexDirection: 'row', alignItems: 'center', padding: Layout.spacing.md, gap: Layout.spacing.lg },
  overviewStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: Layout.spacing.md },

  statCell:      { minWidth: 76, flexGrow: 1 },
  statCellValue: { fontSize: Layout.fontSize.lg, fontFamily: 'Nunito_800ExtraBold', color: Colors.text.primary },
  statCellLabel: { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },

  trendWrap:     { padding: Layout.spacing.md },
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
  conceptName: { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  pills:       { flexDirection: 'row', gap: 3 },
  tierPill:    { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  conceptScore:{ width: 42, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'Nunito_700Bold' },
  conceptMeta: { width: 56, textAlign: 'right', fontSize: 10, color: Colors.text.muted },

  strugglingBlock: { padding: Layout.spacing.md, gap: Layout.spacing.md },
  strugglingRow:   { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  strugglingName:  { fontSize: Layout.fontSize.sm, fontFamily: 'Nunito_700Bold', color: Colors.text.primary },
  strugglingMeta:  { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  strugglingScore: { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_800ExtraBold' },

  rtRow: { flexDirection: 'row', justifyContent: 'space-between' },
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
  activityNum:  {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.status.infoLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activityNumText: { fontSize: Layout.fontSize.xs, fontFamily: 'Nunito_700Bold', color: Colors.text.link },
  activityTitle:   { fontSize: Layout.fontSize.sm, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  activityMeta:    { fontSize: Layout.fontSize.xs, color: Colors.text.muted, marginTop: 1 },
  activityScore:   { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_800ExtraBold' },

  footnote: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Layout.spacing.lg,
  },
});
