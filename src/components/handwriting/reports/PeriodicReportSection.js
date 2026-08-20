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
import { resolvePeriodRange, formatPeriodLabel, validateCustomRange } from '../../../utils/reportPeriod';
import { fetchPeriodicReport } from '../../../api/periodicReport';
import { exportAndSharePeriodicReportPdf } from '../../../utils/periodicReportPdf';

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

  const range = resolvePeriodRange(presetKey, customRange);
  const periodLabel = formatPeriodLabel(presetKey, range);

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
    const validation = validateCustomRange(candidate.startDate, candidate.endDate);
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

          <SubCard title="Learning Progress">
            <KeyValueRow label="Lowercase mastered (this period)" value={report.learning_progress.lowercase_mastered_during_period} />
            <KeyValueRow label="Uppercase mastered (this period)" value={report.learning_progress.uppercase_mastered_during_period} />
            <KeyValueRow label="Cumulative lowercase (as of end date)" value={report.learning_progress.cumulative_lowercase_mastered_by_end_date} />
            <KeyValueRow label="Cumulative uppercase (as of end date)" value={report.learning_progress.cumulative_uppercase_mastered_by_end_date} />
            <KeyValueRow label="Current stage" value={report.learning_progress.current_progression_stage} />
          </SubCard>

          <SubCard title="Motor Performance">
            <KeyValueRow label="Attempts in period" value={report.motor_performance.attempts_in_period} />
            <KeyValueRow label="Mean motor score" value={report.motor_performance.mean_motor_score ?? 'Not available'} />
            <KeyValueRow label="Mean smoothness" value={report.motor_performance.mean_smoothness_score ?? 'Not available'} />
          </SubCard>

          <SubCard
            title="Initial Shape Motor Profile"
            note={report.initial_shape_motor_profile.available ? 'Baseline context — may predate this period.' : null}
          >
            {report.initial_shape_motor_profile.available ? (
              <KeyValueRow label="Overall score" value={report.initial_shape_motor_profile.scores.overall} />
            ) : (
              <Text style={styles.note}>No initial motor baseline is recorded.</Text>
            )}
          </SubCard>

          <SubCard title="Letter Motor Development">
            <KeyValueRow
              label="State as of end date"
              value={report.letter_motor_development.state_as_of_end_date?.display_name ?? 'Not yet observed'}
            />
            <KeyValueRow label="Milestones during period" value={report.letter_motor_development.milestones_during_period.length} />
          </SubCard>

          <SubCard title="Word Writing">
            <KeyValueRow label="Words attempted (this period)" value={report.word_writing.words_attempted_during_period} />
            <KeyValueRow label="Words completed (this period)" value={report.word_writing.words_completed_during_period} />
          </SubCard>

          <Text style={styles.summaryText}>{report.summary_text}</Text>

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
