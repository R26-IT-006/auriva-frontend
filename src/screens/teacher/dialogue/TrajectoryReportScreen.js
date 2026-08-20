import { useState, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../components/common/Card';
import { Colors } from '../../../constants/colors';
import { Layout } from '../../../constants/layout';
import { dialogueApi } from '../../../api/dialogue';
import { scoreColor } from '../../../utils/scoreColor';

// ---------------------------------------------------------------------------
// Honest-labelling constants (TASK-43)
//
// These two strings are the honesty mechanism this screen exists to carry, not
// copy polish. They are constants precisely so that when calibrator remediation
// eventually changes what Tier 2's confidence represents, this file's wording
// is the only thing that has to change.
// ---------------------------------------------------------------------------

/** DEC-07 — mandatory, verbatim, always rendered wherever a Tier 2 result is. */
const TIER2_RELIABILITY_CAVEAT =
  "This is an early hint from a still-learning model, based on a very small "
  + "amount of real data so far. It hasn't yet been shown to be reliable — right "
  + "now it gets it right about as often as a guess would. Use your own "
  + "observation of the session as the main guide, and treat this as one more "
  + "thing to consider, not a conclusion.";

/**
 * Tier 2's number is the share of trees in the forest that voted for this
 * label. It is NOT a calibrated probability and must never be labelled as a
 * confidence percentage.
 */
const TIER2_CONFIDENCE_LABEL = 'RandomForest vote share';

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

/** Which tier produced this row, at a glance. */
function TierPill({ tier }) {
  const map = {
    tier2:    { bg: Colors.status.infoLight,    fg: Colors.text.link, label: 'Model' },
    tier1:    { bg: Colors.status.warningLight, fg: '#B4780A',        label: 'Formula' },
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
      <View style={styles.scoreLine}>
        <Text style={styles.scoreLineText}>{crossed}</Text>
        {explanation.scored ? (
          <Text style={[styles.scoreLineValue, { color: scoreColor(explanation.score) }]}>
            {explanation.score.toFixed(2)}
          </Text>
        ) : null}
      </View>

      {terms.map((t) => (
        <ContributionBar
          key={t.term}
          label={TERM_LABEL[t.term] || t.term}
          detail={`${formatValue(t.rawValue)} → ${t.normalizedValue.toFixed(2)} × ${t.renormalizedWeight.toFixed(2)}`}
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
      <Text style={styles.scoreLineText}>
        {TIER2_CONFIDENCE_LABEL}: {confidence != null ? confidence.toFixed(2) : '—'}
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

function WordRow({ row }) {
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
    </View>
  );
}

export default function TrajectoryReportScreen({ route, navigation }) {
  const student = route.params?.student;

  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!student?.sid) return;
    try {
      setError(null);
      setReport(await dialogueApi.getTrajectoryReport(student.sid));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    navigation.setOptions({
      title: student?.full_name ? `${student.full_name} · Trajectory` : 'Trajectory Report',
    });
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
              {' · '}{totals.tier2} from the model, {totals.tier1} from the formula
            </Text>
          </View>
        </Card>

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
              {rows.map((row) => <WordRow key={row.word_id} row={row} />)}
            </View>
          </Section>
        ))}

        <Text style={styles.footnote}>
          Based on each word’s most recent recorded session. “Formula” rows come
          from a fixed weighted score, “Model” rows from the trajectory model —
          which has not yet been shown to be reliable on real data.
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

  scoreLine:      { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm },
  scoreLineText:  { flex: 1, fontSize: Layout.fontSize.xs, color: Colors.text.secondary },
  scoreLineValue: { fontSize: Layout.fontSize.md, fontFamily: 'Nunito_800ExtraBold' },

  barRow:      { flexDirection: 'row', alignItems: 'center', gap: Layout.spacing.sm, paddingVertical: 3 },
  barLabelWrap:{ width: 108 },
  barLabel:    { fontSize: Layout.fontSize.xs, color: Colors.text.primary, fontFamily: 'Nunito_600SemiBold' },
  barDetail:   { fontSize: 10, color: Colors.text.muted },
  barTrack:    { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4 },
  barValue:    { width: 46, textAlign: 'right', fontSize: Layout.fontSize.xs, fontFamily: 'Nunito_700Bold', color: Colors.text.secondary },

  absentNote: { fontSize: 10, color: Colors.text.muted, lineHeight: 15, marginTop: 2 },
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
