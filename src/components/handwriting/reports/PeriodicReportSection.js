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
import { generatePeriodicReportPdf, sharePeriodicReportPdf } from '../../../utils/periodicReportPdf';
import ReportPreviewModal from './ReportPreviewModal';
import {
  getLetterMotorPresentation, buildReferenceProgressText, LETTER_MOTOR_PATTERN_CAPTION,
  getWritingCheckPresentation,
} from '../../../utils/letterMotorPatternLabels';
// Plain SVG charts + progress bar, built on react-native-svg (already a
// dependency, already used by the components/charts modules). No charting
// library is introduced.
import { MotorTrendChart, PracticeActivityChart, ProgressBarRow } from './ReportCharts';
import { buildPeriodSummaryText } from '../../../utils/periodSummaryText';
// Homework worksheet wording comes from the SAME shared module the
// TeacherReport card and the PDF use, so the three cannot drift.
import {
  getWorksheetStatusLabel, getReviewStatusLabel, getIntensityLabel,
  formatWorksheetDate, EMPTY_NO_PERIOD_ACTIVITY,
} from '../../../utils/worksheetLabels';

// Mirrors TeacherReportScreen.js's own tokens for visual consistency —
// that file does not export them, so they are restated here rather than
// pulled in as a cross-file private import.
const CARD_BG = '#FFFFFF';
const TEXT_1  = '#0F172A';
const TEXT_2  = '#475569';
const TEXT_3  = '#94A3B8';
const ACCENT  = '#6366F1';

// Deliberately identical to periodicReportPdf.js's own fmtDate(), including
// the 'Not available' fallback, so a teacher-review date reads the same on
// screen as in the exported PDF built from the same payload.
function formatValidationDate(iso) {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

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

  // Report export is two deliberate steps: GENERATE (writes the PDF to this
  // device and opens a preview) and then SHARE (only after the teacher has
  // read it). Sharing a child's report cannot be undone once it has left the
  // device, so the review step sits between them by design.
  const [exportState, setExportState] = useState('idle'); // 'idle' | 'generating' | 'error'
  const [exportMessage, setExportMessage] = useState(null);
  const [preview, setPreview] = useState(null); // { html, filename, fileUri }
  const [sharing, setSharing] = useState(false);
  const [previewMessage, setPreviewMessage] = useState(null);

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
  // Four distinct states, deliberately NOT collapsed:
  //   a persisted pattern            -> the mapped Pattern A/B label
  //   no milestone evaluated yet     -> "Not yet observed"
  //   evidence rejected by the guard -> "Not reported"
  //   evaluation could not be read   -> "Unavailable"
  // A/B is never forced when the reference-range guard declined to assign one,
  // and there is no third pattern.
  //
  // S2 removed this card's previous limitation. A rejected evaluation used to
  // persist nothing at all — the history table's pattern columns are NOT NULL —
  // so "the guard rejected the evidence" and "no milestone reached yet" were
  // indistinguishable here. Both are now real, separately persisted outcomes
  // (letter_motor_state_evaluations), and the server reports which one applies
  // as `evaluation_status`.
  const patternState = report?.letter_motor_development?.state_as_of_end_date ?? null;

  // S2 — the server now says which of the four states this is, so nothing
  // here has to infer meaning from an absent state_code. An older server
  // that sends no evaluation_status falls back to the previous
  // pattern-present/absent reading, which is exactly what it used to do.
  const evaluationStatus = report?.letter_motor_development?.evaluation_status
    ?? (patternState ? 'assigned' : 'not_reached');

  const presentation = getLetterMotorPresentation(evaluationStatus, {
    stateCode: patternState?.state_code,
  });
  const patternLabel = presentation.patternValue;
  const referenceStatus = presentation.referenceStatus;

  // Explains WHY there is no pattern yet, instead of leaving the card
  // reading "Not yet observed / 0 / Not yet observed", which looks like a
  // broken section rather than a stage the child has not reached. Counted
  // in frozen evidence letters, because that — not letters mastered — is
  // what the first milestone requires. Absent on an older server, in which
  // case no note is shown at all (never a fabricated count).
  // Real milestone progress, shown ONLY while no milestone has been
  // evaluated. Once the guard has actually declined to report a pattern,
  // "N of 14" would be misleading — the evidence is complete, it simply
  // falls outside the range the model represents.
  const referenceProgress = report?.letter_motor_development?.reference_progress ?? null;
  const patternPendingNote = evaluationStatus === 'not_reached'
    ? buildReferenceProgressText(referenceProgress)
    : null;

  // Server-built baseline narrative (same builder as the dashboard card and
  // the PDF). Absent on an older server — rendered only when present.
  const baselineSummary = report?.initial_shape_motor_profile?.summary ?? null;

  // Adaptive support — the SAME report.adaptive_support object the PDF's own
  // section 7 renders. Previously this screen showed neither the current
  // worksheet recommendations nor the teacher review actions, so a teacher
  // reading the report on screen and then exporting it to PDF got materially
  // different documents from one payload.
  // Writing Check — the dedicated, teacher-initiated route. Kept in its own
  // fields so it is never silently merged with legacy milestone history.
  const latestWritingCheck = report?.letter_motor_development?.latest_writing_check ?? null;
  const writingChecksDuringPeriod = report?.letter_motor_development?.writing_checks_during_period ?? [];
  const latestCheckPresentation = latestWritingCheck ? getWritingCheckPresentation(latestWritingCheck) : null;

  // Home practice — period-scoped worksheet activity. `activeWorksheet` is the
  // one live ON the report end date, never a later assignment.
  const homePractice = report?.home_practice ?? null;
  const activeWorksheet = homePractice?.active_worksheet_as_of_end_date ?? null;
  const worksheetsDuringPeriod = homePractice?.worksheets_during_period ?? [];
  const reviewsDuringPeriod = homePractice?.teacher_reviews_during_period ?? [];

  const adaptiveSupport = report?.adaptive_support ?? null;
  const worksheetRecommendations = adaptiveSupport?.worksheet_recommendations_current ?? [];
  const teacherValidations = adaptiveSupport?.teacher_validations_during_period ?? [];

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

  // STEP 1 — build the PDF and show it. Nothing leaves the device here.
  async function handleGeneratePdf() {
    if (!report) return;
    setExportState('generating');
    setExportMessage(null);
    setPreviewMessage(null);

    const result = await generatePeriodicReportPdf({
      report, studentName: student?.full_name ?? 'Student',
      startDate: range?.startDate ?? '', endDate: range?.endDate ?? '',
    });

    if (result.status === 'generated') {
      setExportState('idle');
      setPreview({ html: result.html, filename: result.filename, fileUri: result.fileUri });
      return;
    }
    setExportState('error');
    setExportMessage('Could not generate the PDF. Please try again.');
  }

  // STEP 2 — share the file the teacher just reviewed. Takes the uri from the
  // preview, so it cannot send a different document from the one shown.
  async function handleSharePdf() {
    if (!preview?.fileUri) return;
    setSharing(true);
    setPreviewMessage(null);

    const result = await sharePeriodicReportPdf({
      fileUri: preview.fileUri,
      studentName: student?.full_name ?? 'Student',
    });
    setSharing(false);

    if (result.status === 'shared') {
      setPreview(null); // sent — close the preview
    } else if (result.status === 'cancelled') {
      // Backing out of the share sheet is not an error: stay in the preview so
      // the teacher can read on, or close deliberately.
      setPreviewMessage(null);
    } else if (result.status === 'sharing_unavailable') {
      setPreviewMessage('Sharing is not available on this device. The report is saved on this device.');
    } else {
      setPreviewMessage('Could not share the report. Please try again.');
    }
  }

  function handleClosePreview() {
    setPreview(null);
    setSharing(false);
    setPreviewMessage(null);
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
              <>
                {/* The same four scores the dashboard's baseline card shows.
                    Reporting only the overall figure hid the shape-group
                    detail that makes the baseline useful to a teacher. Read
                    straight from the persisted StudentMotorBaseline row — no
                    recomputation, no derived index. */}
                <KeyValueRow label="Straight Line Shapes" value={report.initial_shape_motor_profile.scores.straight ?? 'Not available'} />
                <KeyValueRow label="Curved Shapes" value={report.initial_shape_motor_profile.scores.curved ?? 'Not available'} />
                <KeyValueRow label="Complex Shapes" value={report.initial_shape_motor_profile.scores.complex ?? 'Not available'} />
                <KeyValueRow label="Overall Score" value={report.initial_shape_motor_profile.scores.overall ?? 'Not available'} />
                {/* Report parity with the dashboard's own baseline card and
                    with the PDF: the same server-built summary narrative,
                    from the same builder. Rendered only when the server sent
                    one — an older server omits the field entirely, and
                    nothing is fabricated in its place. */}
                {baselineSummary?.description ? (
                  <Text style={styles.note}>{baselineSummary.description}</Text>
                ) : null}
                {baselineSummary?.disclosure ? (
                  <Text style={styles.note}>{baselineSummary.disclosure}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.note}>
                Initial handwriting assessment not yet available. It appears here once the
                student completes the shape assessment.
              </Text>
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
            {/* S2 — the supporting sentence for whichever of the four states
                this is, from the shared copy the PDF and the dashboard card
                also use. */}
            <Text style={styles.note}>{presentation.supportingText}</Text>
            {patternPendingNote && <Text style={styles.note}>{patternPendingNote}</Text>}
            <Text style={styles.note}>{LETTER_MOTOR_PATTERN_CAPTION}</Text>

            {/* Writing Check — a dated LIST, never a chart. Pattern A and B are
                NOMINAL categories, so plotting them over time would falsely
                imply an ordering. No arrows, no colour coding, no
                improvement/decline wording: each check stands alone. */}
            <Text style={styles.subHeading}>Latest Writing Check</Text>
            {latestWritingCheck ? (
              <>
                <KeyValueRow label="Date" value={formatValidationDate(latestWritingCheck.observed_at)} />
                <KeyValueRow label="Current Writing Pattern" value={latestCheckPresentation.patternValue} />
                <KeyValueRow label="Reference Status" value={latestCheckPresentation.referenceStatus} />
              </>
            ) : (
              <>
                <KeyValueRow label="Latest Writing Check" value="Not yet available" />
                <Text style={styles.note}>A Writing Check has not yet been completed.</Text>
              </>
            )}

            <Text style={styles.subHeading}>Writing Checks During This Period</Text>
            {writingChecksDuringPeriod.length > 0 ? (
              writingChecksDuringPeriod.slice().reverse().map((c) => {
                const p = getWritingCheckPresentation(c);
                return (
                  <KeyValueRow
                    key={c.pattern_check_id}
                    label={formatValidationDate(c.observed_at)}
                    value={`${p.patternValue} · ${p.referenceStatus}`}
                  />
                );
              })
            ) : (
              // Deliberately NOT "Not yet observed" — that means no pattern
              // evaluation exists at all. This means no check happened in the
              // selected window, which is a different fact.
              <Text style={styles.note}>No Writing Checks were completed during this period.</Text>
            )}
          </SubCard>

          {/* -- 8. Word Writing Progress -- */}
          <SubCard title="Word Writing Progress">
            <KeyValueRow label="Words Practiced" value={report.word_writing.words_attempted_during_period} />
            <KeyValueRow label="Words Completed" value={report.word_writing.words_completed_during_period} />
            {wordCompletionPct != null && (
              <KeyValueRow label="Completion" value={`${wordCompletionPct}%`} />
            )}
            {wordsPractised === 0 && (
              <Text style={styles.note}>
                No word writing was practised during this period.
              </Text>
            )}
          </SubCard>

          {/* -- 9. Adaptive Practice Recommendation -- */}
          {/* Same report.adaptive_support payload as the PDF's section 7, and
              the same empty-state sentence, so screen and export never
              disagree. Recommendations are listed exactly as the server
              produced them — never re-derived, re-sorted or re-worded here. */}
          <SubCard title="Adaptive Practice Recommendation">
            {worksheetRecommendations.length > 0 ? (
              worksheetRecommendations.map((r, i) => (
                <KeyValueRow
                  key={`${r.case_type}-${r.family}-${i}`}
                  label={`${r.case_type} / ${r.family}`}
                  value={r.title}
                />
              ))
            ) : (
              <Text style={styles.note}>
                No worksheet recommendations are currently active.
              </Text>
            )}
          </SubCard>

          {/* -- 10. Recommendations / Teacher Notes -- */}
          <SubCard title="Recommendations / Teacher Notes">
            {teacherValidations.length > 0 ? (
              teacherValidations.map((v, i) => (
                <KeyValueRow
                  key={`${v.case_type}-${v.family}-${i}`}
                  label={`${formatValidationDate(v.at)} · ${v.title}`}
                  value={v.decision}
                />
              ))
            ) : (
              <Text style={styles.note}>
                No teacher review actions were recorded during this period.
              </Text>
            )}
          </SubCard>


          {/* -- Home Practice -- */}
          <SubCard title="Home Practice">
            <KeyValueRow label="Worksheets Assigned"  value={homePractice?.worksheets_assigned ?? 0} />
            <KeyValueRow label="Worksheets Submitted" value={homePractice?.worksheets_submitted ?? 0} />
            <KeyValueRow label="Worksheets Reviewed"  value={homePractice?.worksheets_reviewed ?? 0} />

            {activeWorksheet ? (
              <>
                <Text style={styles.subHeading}>Current Active Worksheet</Text>
                <KeyValueRow label="Target" value={activeWorksheet.target_letter} />
                <KeyValueRow label="Practice Type" value={getIntensityLabel(activeWorksheet.worksheet_intensity)} />
                <KeyValueRow label="Status" value={getWorksheetStatusLabel(activeWorksheet.status)} />
              </>
            ) : null}

            <Text style={styles.subHeading}>Recent Worksheet Activity</Text>
            {worksheetsDuringPeriod.length > 0 ? (
              worksheetsDuringPeriod.map((w) => (
                <KeyValueRow
                  key={w.worksheet_code}
                  label={formatWorksheetDate(w.assigned_at)}
                  value={`${w.target_letter} — ${getWorksheetStatusLabel(w.status)}`}
                />
              ))
            ) : (
              <Text style={styles.note}>{EMPTY_NO_PERIOD_ACTIVITY}</Text>
            )}

            {reviewsDuringPeriod.length > 0 ? (
              <>
                <Text style={styles.subHeading}>Teacher Reviews</Text>
                {reviewsDuringPeriod.map((r, i) => (
                  <KeyValueRow
                    key={`${r.target_letter}-${i}`}
                    label={formatWorksheetDate(r.reviewed_at)}
                    value={`${r.target_letter ?? ''} — ${getReviewStatusLabel(r.review_status)}`.trim()}
                  />
                ))}
              </>
            ) : null}
          </SubCard>

          {/* -- 11. Period Summary -- */}
          <SubCard title="Period Summary">
            <Text style={styles.summaryText}>{periodSummary}</Text>
          </SubCard>

          {/* Generates and opens the report for review. Sharing is a separate,
              deliberate action inside the preview — see handleSharePdf. */}
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleGeneratePdf}
            activeOpacity={0.85}
            disabled={exportState === 'generating'}
            accessibilityRole="button"
            accessibilityLabel="Download report and open it for review"
          >
            {exportState === 'generating' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.exportBtnText}>Download & Review Report</Text>
          </TouchableOpacity>

          {exportState === 'error' && exportMessage && (
            <Text style={styles.errorText}>{exportMessage}</Text>
          )}
        </>
      )}

      {/* Review-before-send. Rendered once, outside the ready-branch, so a
          period change while the preview is open cannot unmount it mid-read. */}
      <ReportPreviewModal
        visible={!!preview}
        html={preview?.html ?? null}
        filename={preview?.filename ?? null}
        sharing={sharing}
        message={previewMessage}
        onShare={handleSharePdf}
        onClose={handleClosePreview}
      />
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
  subHeading: { fontSize: 13, fontWeight: '700', color: TEXT_1, marginTop: 12, marginBottom: 4 },
  note: { fontSize: 11, color: TEXT_3, fontStyle: 'italic', marginTop: 2 },
  summaryText: { marginTop: 14, fontSize: 12.5, color: TEXT_2, lineHeight: 18, backgroundColor: '#F7F8FC', borderRadius: 10, padding: 10 },
  exportBtn: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12,
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
