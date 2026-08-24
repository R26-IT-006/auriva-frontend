/**
 * PeriodicReportSection.js
 *
 * Proposal FR-19/FR-20, Phase 7C/7D — the periodic report UI, rendered
 * inside TeacherReportScreen.js above its existing current-state sections
 * (spec §14: "prefer current TeacherReport visual style", "do not
 * redesign TeacherReport completely" — this is one additive section, not
 * a rewrite).
 *
 * Fetch behavior (spec §15): changing the period refetches, shows a
 * loading state, and ignores a stale previous response via a monotonic
 * request-id ref — the same `let cancelled = false` / guarded-effect
 * discipline this codebase already uses elsewhere (e.g.
 * LetterWritingScreen.js's recommendation fetch), generalized to a
 * counter so an out-of-order (slower) earlier response can never
 * overwrite a newer one.
 *
 * Read-only (spec §4/§16): this component only ever performs GET requests
 * (fetchPeriodicReport) and local PDF generation — it never calls any
 * write endpoint.
 */

'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PeriodSelector from './PeriodSelector';
import { DEFAULT_REPORT_PRESET_KEY } from '../../../constants/reportPeriodPolicy';
import {
  resolvePeriodRange, formatPeriodLabel, validateCustomRange, startOfTodayUtc, toDateOnly, parseDateOnly,
} from '../../../utils/reportPeriod';
import { fetchPeriodicReport } from '../../../api/periodicReport';
import { exportAndSharePeriodicReportPdf } from '../../../utils/periodicReportPdf';
import { getLetterMotorPatternLabel, LETTER_MOTOR_PATTERN_CAPTION } from '../../../utils/letterMotorPatternLabels';
// Plain SVG charts + progress bar, built on react-native-svg (already a
// dependency, already used by the components/charts modules). No charting
// library is introduced.
import { MotorTrendChart, PracticeActivityChart, ProgressBarRow } from './ReportCharts';
import { buildPeriodSummaryText } from '../../../utils/periodSummaryText';

// Mirrors TeacherReportScreen.js's own tokens for visual consistency —
// that file does not export them, so they are restated here rather than
// pulled in as a cross-file private import.
const CARD_BG = '#FFFFFF';
const TEXT_1  = '#0F172A';
const TEXT_2  = '#475569';
const TEXT_3  = '#94A3B8';
const ACCENT  = '#6366F1';

function KeyValueRow({ label, value }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function SubCard({ title, children, note }) {
  return (
    <View style={styles.subCard}>
      <Text style={styles.subCardTitle}>{title}</Text>
      {children}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

// `teacherName` is intentionally NOT a prop — the report's teacher_name
// comes from the backend's own metadata (derived from req.user.id, the
// authenticated teacher), never a value the frontend passes in.
export default function PeriodicReportSection({ student, theme }) {
  const [presetKey, setPresetKey] = useState(DEFAULT_REPORT_PRESET_KEY);
  const [customRange, setCustomRange] = useState(null);
  const [customError, setCustomError] = useState(null);

  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'empty_range'
  const [report, setReport] = useState(null);

  const [exportState, setExportState] = useState('idle'); // 'idle' | 'exporting' | 'error'
  const [exportMessage, setExportMessage] = useState(null);

  // Stale-response guard (spec §15/§22) — only the MOST RECENT request's
  // result is ever applied to state.
  const requestIdRef = useRef(0);

  // Custom-range bounds. The earliest selectable day is the day the student
  // was registered — there is no data before that, so a range starting
  // earlier can only ever be misleading. The latest is today: the report
  // describes what has happened, never a future window.
  //
  // The student's created_at is present on the object the teacher flow passes
  // in (teacherService.getOwnStudentById returns the full row). The child-side
  // flow can reach this screen with a lighter object, so a missing value
  // falls back to NO lower bound rather than blocking the teacher outright.
  const registeredOn = parseDateOnly(toDateOnly(student?.created_at));
  const today = startOfTodayUtc();

  const range = resolvePeriodRange(presetKey, customRange);
  const periodLabel = formatPeriodLabel(presetKey, range);

  // Charts size to the card rather than a fixed width, so the section reads
  // correctly on a tablet in both portrait and landscape. The fallback is only
  // used for the first frame before onLayout reports a real width.
  const [chartWidth, setChartWidth] = useState(320);
  const handleChartLayout = useCallback((event) => {
    const width = Math.round(event?.nativeEvent?.layout?.width ?? 0);
    if (width > 0 && width !== chartWidth) setChartWidth(width);
  }, [chartWidth]);

  // Per-day points behind both charts. Absent on an older server, in which
  // case each chart renders its own empty state rather than breaking.
  const dailySeries = report?.motor_performance?.daily_series ?? [];

  // ── Writing Pattern Summary values ──────────────────────────────────────
  // Three distinct states, deliberately NOT collapsed into two:
  //   a persisted pattern            -> the mapped Pattern A/B label
  //   no pattern yet                 -> "Not yet observed"
  //   evidence rejected by the guard -> "Not reported"
  // A/B is never forced when the reference-range guard declined to assign one.
  //
  // LIMITATION: an outside-reference-range observation is not persisted (the
  // history table's pattern columns are NOT NULL by design), so the report API
  // cannot currently distinguish "guard rejected the evidence" from "no
  // milestone reached yet". This screen therefore reports the honest,
  // observable state and never guesses. Surfacing the rejected case here needs
  // the additive ood_* columns described in the OOD guard design.
  const patternState = report?.letter_motor_development?.state_as_of_end_date ?? null;
  const patternRejected = patternState?.outside_reference_range === true;

  const patternLabel = patternRejected
    ? 'Not reported'
    : (patternState ? getLetterMotorPatternLabel(patternState.state_code) : 'Not yet observed');

  const referenceStatus = patternRejected
    ? 'Outside represented reference range'
    : (patternState ? 'Within represented reference range' : 'Not yet observed');

  // Optional completion figure, computed only from values already in the
  // report — never shown when nothing was practised (0/0 is not 0%).
  const wordsPractised = report?.word_writing?.words_attempted_during_period ?? 0;
  const wordsCompleted = report?.word_writing?.words_completed_during_period ?? 0;
  const wordCompletionPct = wordsPractised > 0
    ? Math.round((wordsCompleted / wordsPractised) * 100)
    : null;

  const periodSummary = report ? buildPeriodSummaryText(report) : '';

  const loadReport = useCallback(async (studentId, r) => {
    if (!studentId || !r) {
      setStatus('empty_range');
      return;
    }
    const myRequestId = ++requestIdRef.current;
    setStatus('loading');
    const result = await fetchPeriodicReport({ studentId, startDate: r.startDate, endDate: r.endDate });
    if (myRequestId !== requestIdRef.current) return; // a newer request has since started — ignore this stale one
    if (result.status !== 'ok') {
      setStatus('error');
      return;
    }
    setReport(result.report);
    setStatus('ready');
  }, []);

  useEffect(() => {
    loadReport(student?.sid, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.sid, range?.startDate, range?.endDate]);

  function handleSelectPreset(key) {
    setCustomError(null);
    setPresetKey(key);
  }

  function handleApplyCustomRange(candidate) {
    const validation = validateCustomRange(candidate.startDate, candidate.endDate, undefined, registeredOn);
    if (!validation.ok) {
      setCustomError(validation.error);
      return;
    }
    setCustomError(null);
    setCustomRange(candidate);
  }

  async function handleExportPdf() {
    if (!report) return;
    setExportState('exporting');
    setExportMessage(null);
    const result = await exportAndSharePeriodicReportPdf({
      report, studentName: student?.full_name ?? 'Student',
      startDate: range?.startDate ?? '', endDate: range?.endDate ?? '',
    });
    if (result.status === 'shared' || result.status === 'cancelled') {
      setExportState('idle'); // cancellation is not an error — spec §21/§22
    } else if (result.status === 'sharing_unavailable') {
      setExportState('error');
      setExportMessage('Sharing is not available on this device.');
    } else {
      setExportState('error');
      setExportMessage('Could not generate the PDF. Please try again.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar-outline" size={16} color={ACCENT} />
        </View>
        <Text style={styles.title}>Periodic Report</Text>
      </View>

      <PeriodSelector
        presetKey={presetKey}
        onSelectPreset={handleSelectPreset}
        customRange={customRange}
        onApplyCustomRange={handleApplyCustomRange}
        customError={customError}
        minDate={registeredOn}
        maxDate={today}
      />

      <Text style={styles.periodLabel}>{periodLabel}</Text>

      {status === 'loading' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={ACCENT} />
          <Text style={styles.loadingText}>Generating report…</Text>
        </View>
      )}

      {status === 'error' && (
        <Text style={styles.errorText}>Couldn't load this report. Check the connection and try again.</Text>
      )}

      {status === 'empty_range' && (
        <Text style={styles.errorText}>Select a valid date range to generate a report.</Text>
      )}

      {status === 'ready' && report && (
        <>
          {!report.has_activity_in_period && (
            <Text style={styles.emptyNote}>No handwriting activity was recorded during this period.</Text>
          )}

          {/* -- 2. Letter Learning Progress -- */}
          {/* Counts against the alphabet size the backend already uses for the
              practice-level label (learning_progress.lowercase_total /
              uppercase_total) -- never a second hardcoded 26 here. The bars are
              a count against a known total and carry no evaluative colouring at
              any level. */}
          <SubCard title="Letter Learning Progress">
            <ProgressBarRow
              label="Lowercase Letters"
              value={report.learning_progress.cumulative_lowercase_mastered_by_end_date}
              total={report.learning_progress.lowercase_total}
              color={ACCENT}
            />
            <ProgressBarRow
              label="Uppercase Letters"
              value={report.learning_progress.cumulative_uppercase_mastered_by_end_date}
              total={report.learning_progress.uppercase_total}
              color={ACCENT}
            />
            <KeyValueRow label="Lowercase Letters Mastered" value={report.learning_progress.lowercase_mastered_during_period} />
            <KeyValueRow label="Uppercase Letters Mastered" value={report.learning_progress.uppercase_mastered_during_period} />
            <KeyValueRow label="Total Lowercase Letters Mastered" value={report.learning_progress.cumulative_lowercase_mastered_by_end_date} />
            <KeyValueRow label="Total Uppercase Letters Mastered" value={report.learning_progress.cumulative_uppercase_mastered_by_end_date} />
            <KeyValueRow label="Current Practice Level" value={report.learning_progress.current_progression_stage} />
          </SubCard>

          {/* -- 3. Handwriting Performance -- */}
          <SubCard title="Handwriting Performance">
            <KeyValueRow label="Practice Attempts" value={report.motor_performance.attempts_in_period} />
            <KeyValueRow label="Average Motor Performance Score" value={report.motor_performance.mean_motor_score ?? 'Not available'} />
            <KeyValueRow label="Average Writing Smoothness" value={report.motor_performance.mean_smoothness_score ?? 'Not available'} />
          </SubCard>

          {/* -- 4. Motor Performance Over Time -- */}
          {/* Uses motor_performance.daily_series: a per-day regrouping of the
              same attempts the averages above are computed from. Days without
              practice are absent rather than plotted as zero. */}
          <SubCard title="Motor Performance Over Time">
            <View onLayout={handleChartLayout}>
              <MotorTrendChart points={dailySeries} width={chartWidth} color={ACCENT} />
            </View>
          </SubCard>

          {/* -- 5. Practice Activity -- */}
          <SubCard title="Practice Activity">
            <PracticeActivityChart points={dailySeries} width={chartWidth} color="#0891B2" />
          </SubCard>

          {/* -- 6. Initial Handwriting Skills Summary -- */}
          {/* Visible terminology only: the initial_shape_motor_profile response
              key is deliberately unchanged so the periodic-report JSON contract
              is not broken. The data source is, and always was,
              StudentMotorBaseline directly (no ML call). */}
          <SubCard
            title="Initial Handwriting Skills Summary"
            note={report.initial_shape_motor_profile.available ? 'Baseline context — may predate this period.' : null}
          >
            {report.initial_shape_motor_profile.available ? (
              <KeyValueRow label="Overall score" value={report.initial_shape_motor_profile.scores.overall} />
            ) : (
              <Text style={styles.note}>Initial handwriting assessment not yet available.</Text>
            )}
          </SubCard>

          {/* -- 7. Writing Pattern Summary -- */}
          {/* Descriptive card ONLY: never a graph, gauge, percentage, bar,
              ranking or score. The visible label comes from state_code via the
              shared presentation mapping, never the persisted display_name
              (legacy values on historical rows are left unmodified). */}
          <SubCard title="Writing Pattern Summary">
            <KeyValueRow label="Current Writing Pattern" value={patternLabel} />
            <KeyValueRow label="Pattern Updates" value={report.letter_motor_development.milestones_during_period.length} />
            <KeyValueRow label="Reference Status" value={referenceStatus} />
            <Text style={styles.note}>{LETTER_MOTOR_PATTERN_CAPTION}</Text>
          </SubCard>

          {/* -- 8. Word Writing Progress -- */}
          <SubCard title="Word Writing Progress">
            <KeyValueRow label="Words Practiced" value={report.word_writing.words_attempted_during_period} />
            <KeyValueRow label="Words Completed" value={report.word_writing.words_completed_during_period} />
            {wordCompletionPct != null && (
              <KeyValueRow label="Completion" value={`${wordCompletionPct}%`} />
            )}
          </SubCard>

          {/* -- 9. Period Summary -- */}
          <SubCard title="Period Summary">
            <Text style={styles.summaryText}>{periodSummary}</Text>
          </SubCard>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportPdf}
            activeOpacity={0.85}
            disabled={exportState === 'exporting'}
            accessibilityRole="button"
            accessibilityLabel="Export and share PDF"
          >
            {exportState === 'exporting' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="document-attach-outline" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.exportBtnText}>Export & Share PDF</Text>
          </TouchableOpacity>

          {exportState === 'error' && exportMessage && (
            <Text style={styles.errorText}>{exportMessage}</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 20, marginBottom: 14, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  title: { fontSize: 15, fontWeight: '700', color: TEXT_1 },
  periodLabel: { marginTop: 10, fontSize: 12, fontWeight: '600', color: TEXT_2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  loadingText: { fontSize: 12.5, color: TEXT_2 },
  errorText: { marginTop: 12, fontSize: 12.5, color: '#DC2626' },
  emptyNote: { marginTop: 12, fontSize: 12.5, color: TEXT_2, fontStyle: 'italic' },
  subCard: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  subCardTitle: { fontSize: 12.5, fontWeight: '700', color: TEXT_1, marginBottom: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  kvLabel: { fontSize: 11.5, color: TEXT_2, flex: 1 },
  kvValue: { fontSize: 11.5, fontWeight: '700', color: TEXT_1 },
  note: { fontSize: 11, color: TEXT_3, fontStyle: 'italic', marginTop: 2 },
  summaryText: { marginTop: 14, fontSize: 12.5, color: TEXT_2, lineHeight: 18, backgroundColor: '#F7F8FC', borderRadius: 10, padding: 10 },
  exportBtn: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12,
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
