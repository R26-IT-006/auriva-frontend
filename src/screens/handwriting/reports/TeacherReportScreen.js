import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
// Locks this screen to portrait while focused; releases on blur.
import { useLockPortrait } from '../../../utils/useOrientationLock';
import Svg, { Path, Line, Circle, Polyline, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { getSessionProgress, getAssessmentSnapshot, getSessionDurationMinutes } from '../../../constants/sessionProgress';
import { getMotorProfile, getCompletedLetters, getLetterProgress } from '../../../utils/storage';
import { computeShapePreviewPaths } from '../../../utils/shapePreviewGeometry';
import { fetchWordReport } from '../../../utils/wordApi';
import { generateReport } from '../../../utils/reportEngine';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import ContributionChart from '../../../components/handwriting/ContributionChart';
// Feature 8 Step 4 — read-only, longitudinal-evidence-based worksheet
// recommendations (distinct source from generateRecommendations() above —
// see the "Adaptive Practice Recommendations" subsection below).
import {
  fetchWorksheetRecommendations, formatCaseType, shouldShowFocusLetters, getWorksheetRecommendationEmptyState,
} from '../../../utils/worksheetRecommendations';
// Feature 9 Step 5 — teacher review controls + validation history for the
// Feature 8 recommendations rendered above. Completely separate fetch
// lifecycle from both the main report and the Feature 8 recommendations
// themselves (Step 5 spec §33/§47).
import {
  fetchTeacherRecommendationValidationHistory, fetchTeacherRecommendationValidationState,
  submitTeacherRecommendationValidation, formatTeacherReviewLabel, getOppositeValidationAction,
  filterHistoryForStream, formatReviewDate, TEACHER_NOTE_MAX_LENGTH,
} from '../../../utils/teacherRecommendationValidations';
// Feature 10 Step 3 — static visual companion to a Feature 8 recommendation
// (family movement example + focus-letter guides). Passive renderer only —
// see ActivityPreview.js's own header for its full "what this never does"
// list. Wrapped below by a small ActivityPreviewSection for expand/collapse,
// mirroring WhyPanel's own established interaction pattern.
import ActivityPreview from '../../../components/handwriting/ActivityPreview';
// Feature 9 repair (final integration audit finding) — one action_id per
// Confirm/Not-suitable button press, the sole idempotency key the backend
// now uses (see teacherRecommendationValidationService.js's own module
// header). Zero-dependency, already used elsewhere in this codebase for the
// same "one UUID per user action" pattern (collectionSession.js,
// preWritingSessionGuard.js) — no new dependency added.
import { generateUuidV4 } from '../../../utils/uuid';
// Initial Motor Baseline Summary — deterministic, no ML. Reads the existing
// persisted Feature 1 baseline endpoint and renders the backend's summary of
// the four authoritative scores.
//
// The legacy experimental L2 shape-motor clustering
// (utils/motorClusterProfile.js -> GET /handwriting/motor-cluster/:studentId)
// is retained in the repository for research/reference compatibility only.
// It is not used by the current teacher-facing baseline summary and does not
// influence adaptive progression — this screen deliberately does not import
// or call it.
import { fetchMotorBaseline } from '../../../utils/motorBaseline';
// Feature 11 Phase 6 — Teacher Report presentation for Feature 11B (Letter
// Motor Development). Strictly read-only, independently loaded/failed
// (spec §15) — see the util's own header for the full research-safe-
// terminology contract.
import {
  fetchLatestLetterMotorState, fetchLetterMotorStateHistory, fetchLetterMotorEvidenceTrend,
  fetchLetterMotorEvaluations, resolveLetterMotorEvaluationStatus, METRIC_LABELS,
  LETTER_MOTOR_PATTERN_CAPTION,
} from '../../../utils/letterMotorState';
// Proposal FR-19/FR-20, Phase 7C/7D — periodic report (flexible date
// ranges) + real PDF export/share. Additive section only — every existing
// section below (current-state Feature 8/9/10/11, family thresholds,
// motor patterns) is untouched.
import PeriodicReportSection from '../../../components/handwriting/reports/PeriodicReportSection';
// Writing Check — the dedicated, teacher-initiated route for the frozen letter
// motor pattern model. Read-only here; starting one navigates into its own flow.
import {
  fetchWritingCheckHistory, getWritingCheckPresentation,
} from '../../../utils/writingCheck';
// Homework worksheets — teacher-directed support material. Every action below
// is gated; none of them affect mastery, scores, thresholds or sequencing.
import {
  fetchWorksheetCandidates, fetchWorksheetHistory, generateWorksheet as apiGenerateWorksheet,
  assignWorksheet as apiAssignWorksheet, submitWorksheet as apiSubmitWorksheet,
  reviewSubmission as apiReviewSubmission,
} from '../../../utils/worksheetApi';
import {
  getWorksheetStatusLine, getIntensityLabel, formatWorksheetDate, describeMotorPreparation,
  REVIEW_OPTIONS, INTENSITY_OPTIONS, PRACTICE_SEQUENCE_TEXT, WORKSHEET_SUPPORTING_TEXT,
  EMPTY_NO_RECOMMENDATION, EMPTY_NO_HISTORY, EMPTY_NO_SUBMISSION,
  PENDING_REVIEW_TEXT, ALREADY_ASSIGNED_TEXT, UNMAPPED_LETTER_TEXT,
  isTwoCycleCandidate, TWO_CYCLE_SECTION_LABEL, TWO_CYCLE_STATUS_LABEL, TWO_CYCLE_DEFER_LABEL,
} from '../../../utils/worksheetLabels';
import { generateWorksheetPdf, shareWorksheetPdf } from '../../../utils/worksheetPdf';
// Reuses the existing preview modal rather than building a second preview
// framework; the SHARE itself is worksheet-specific (shareWorksheetPdf), so a
// practice sheet never carries report wording.
import ReportPreviewModal from '../../../components/handwriting/reports/ReportPreviewModal';
import * as ImagePicker from 'expo-image-picker';
import useGatedBack from '../../../utils/useGatedBack';
import { goBackToOrigin } from '../../../utils/backToOrigin';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  good:     { text: '#15803D', bg: '#F0FDF4', border: '#86EFAC', dot: '#22C55E' },
  moderate: { text: '#B45309', bg: '#FFFBEB', border: '#FCD34D', dot: '#F59E0B' },
  needs:    { text: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444' },
  neutral:  { text: '#475569', bg: '#F8FAFC', border: '#CBD5E1', dot: '#94A3B8' },
};

const PAGE_BG  = '#F0F4FF';
const CARD_BG  = '#FFFFFF';
const TEXT_1   = '#0F172A';
const TEXT_2   = '#475569';
const TEXT_3   = '#94A3B8';
const DIVIDER  = '#F1F5F9';

// Maps a server-stored difficultyKey → UI colours/icon for the report card
const DIFFICULTY_UI = {
  NONE:               { color: '#22C55E', bgColor: '#F0FDF4', icon: 'checkmark-circle',  noIssueDetected: true  },
  WEAK_CURVE_CONTROL: { color: '#F59E0B', bgColor: '#FFFBEB', icon: 'refresh-circle',    noIssueDetected: false },
  WEAK_STRAIGHT_LINE: { color: '#EF4444', bgColor: '#FEF2F2', icon: 'remove-circle',     noIssueDetected: false },
  ZIGZAG_INSTABILITY: { color: '#8B5CF6', bgColor: '#F5F3FF', icon: 'pulse',             noIssueDetected: false },
  MOTOR_FATIGUE:      { color: '#6366F1', bgColor: '#EEF2FF', icon: 'battery-half',      noIssueDetected: false },
};

const DIFFICULTY_DESCRIPTIONS = {
  NONE:               'Motor control is developing well. No significant difficulty patterns detected.',
  WEAK_CURVE_CONTROL: 'Difficulty maintaining smooth curved strokes. Affects letters with round shapes.',
  WEAK_STRAIGHT_LINE: 'Inconsistent straight-line control. Affects letters with verticals and horizontals.',
  ZIGZAG_INSTABILITY: 'Direction changes cause stroke instability. Affects angular letters.',
  MOTOR_FATIGUE:      'Signs of motor fatigue detected. Performance may drop during extended writing.',
};

function statusToken(status) {
  if (status === 'good'     || status === 'Mastered')                          return T.good;
  if (status === 'moderate' || status === 'Moderate' || status === 'Progressing') return T.moderate;
  return T.needs;
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function MotorGauge({ score }) {
  const W = 240, H = 150;
  const cx = W / 2, cy = 128, r = 96, sw = 16;

  function pt(deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }
  function arc(a, b) {
    const s = pt(a), e = pt(b);
    const lg = Math.abs(a - b) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${lg} 0 ${e.x} ${e.y}`;
  }

  const clamped   = Math.max(0, Math.min(100, score ?? 0));
  const ndeg      = (1 - clamped / 100) * 180;
  const nPt       = pt(ndeg);
  const nLen      = r - sw * 0.5;
  const nOuter    = {
    x: cx + nLen * Math.cos((ndeg * Math.PI) / 180),
    y: cy - nLen * Math.sin((ndeg * Math.PI) / 180),
  };
  const gColor    = clamped >= 70 ? '#22C55E' : clamped >= 45 ? '#F59E0B' : '#EF4444';

  return (
    <Svg width={W} height={H} style={{ alignSelf: 'center' }}>
      <Path d={arc(180, 0)}   stroke="#E2E8F0" strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Path d={arc(180, 121)} stroke="#FCA5A5" strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Path d={arc(121,  61)} stroke="#FCD34D" strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Path d={arc(61,    0)} stroke="#86EFAC" strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Line x1={cx} y1={cy} x2={nOuter.x} y2={nOuter.y}
        stroke={TEXT_1} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={7} fill={TEXT_1} />
      <Circle cx={cx} cy={cy} r={3} fill={CARD_BG} />
      <SvgText x={cx} y={cy - 18} textAnchor="middle" fontSize={36} fontWeight="900" fill={gColor}>
        {clamped}
      </SvgText>
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill={TEXT_3}>/ 100</SvgText>
      <SvgText x={14}   y={cy + 16} fontSize={10} fill="#EF4444">Low</SvgText>
      <SvgText x={W-14} y={cy + 16} textAnchor="end" fontSize={10} fill="#22C55E">High</SvgText>
    </Svg>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, accentColor = '#6366F1', children, style }) {
  return (
    <View style={[sc.card, style]}>
      <View style={[sc.accent, { backgroundColor: accentColor }]} />
      <View style={sc.inner}>
        {title ? (
          <View style={sc.header}>
            <View style={[sc.iconWrap, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name={icon} size={16} color={accentColor} />
            </View>
            <Text style={sc.title}>{title}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  accent: { width: 5, borderRadius: 0 },
  inner:  { flex: 1, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 15, fontWeight: '800', color: TEXT_1, letterSpacing: 0.2 },
});

// ─── XAI toggle ───────────────────────────────────────────────────────────────

function WhyPanel({ label = 'Why this score?', explanation }) {
  const [open, setOpen] = useState(false);
  if (!explanation) return null;
  return (
    <View style={wp.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={wp.btn} activeOpacity={0.7}>
        <Ionicons name="information-circle" size={15} color="#6366F1" />
        <Text style={wp.label}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#6366F1" />
      </TouchableOpacity>
      {open && (
        <View style={wp.panel}>
          <Text style={wp.text}>{explanation}</Text>
        </View>
      )}
    </View>
  );
}

const wp = StyleSheet.create({
  wrap:  { marginTop: 10 },
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  label: { fontSize: 12, color: '#6366F1', fontWeight: '700' },
  panel: {
    marginTop: 8, backgroundColor: '#EEF2FF', borderRadius: 12,
    padding: 13, borderLeftWidth: 3, borderLeftColor: '#6366F1',
  },
  text:  { fontSize: 12, color: '#3730A3', lineHeight: 19 },
});

// ─── Status pill ──────────────────────────────────────────────────────────────

function Pill({ label, status }) {
  const t = statusToken(status);
  return (
    <View style={[pill.wrap, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[pill.dot, { backgroundColor: t.dot }]} />
      <Text style={[pill.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ pct, height = 8 }) {
  const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <View style={[bar.bg, { height, borderRadius: height / 2 }]}>
      <View style={[bar.fill, { width: `${pct}%`, backgroundColor: color, height, borderRadius: height / 2 }]} />
    </View>
  );
}

const bar = StyleSheet.create({
  bg:   { backgroundColor: '#E2E8F0', overflow: 'hidden', flex: 1 },
  fill: {},
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ message }) {
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <Ionicons name="clipboard-outline" size={28} color={TEXT_3} />
      </View>
      <Text style={em.text}>{message}</Text>
    </View>
  );
}

const em = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingVertical: 24, gap: 10 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  text:     { fontSize: 13, color: TEXT_3, textAlign: 'center', lineHeight: 19, maxWidth: 240 },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherReportScreen({ route, navigation }) {
  const { student, theme } = route.params;

  // The child-facing writing activities are used in landscape; this report is
  // a long, dense, scrolling document that reads far better in portrait.
  // Locked on focus and released on blur, so no other screen is affected —
  // see utils/useLockPortrait.js for the release semantics. Applied here in
  // the SCREEN rather than in a navigator because this component is
  // registered under two different route names in two different navigators.
  useLockPortrait();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Returns to the screen this report was OPENED FROM (route param
  // `originRoute`), not to whatever sits directly below it in the stack —
  // see utils/backToOrigin.js. Falls back to goBack() when no origin was
  // passed, so an older navigation behaves exactly as before.
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, route.params?.originRoute)
  );

  const [loading,  setLoading]  = useState(true);
  const [report,   setReport]   = useState(null);
  const [duration, setDuration] = useState(0);
  const [letterProgressReport, setLetterProgressReport] = useState(null);
  // Report-load crash fix: several steps below (local AsyncStorage reads,
  // report computation) are NOT individually try/caught the way the network
  // calls are — if one of them throws (e.g. a legacy/corrupted local record
  // for an older student), the outer catch below swallows it, but `report`
  // was never set. The render used to assume "loading finished" meant
  // "report is ready" and read straight into report.summary/etc. with no
  // guard, crashing to a blank screen. loadError distinguishes "still
  // loading" from "finished, but nothing to show" so the render can fall
  // back to a clear retry message instead of crashing.
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        setLoadError(false);
        try {
          // 1. Fetch stored initial assessment + analysis from the server
          let serverData = null;
          try {
            const res = await client.get(ENDPOINTS.HANDWRITING_INITIAL_REPORT(student?.sid));
            if (res.data?.hasData) serverData = res.data;
          } catch (netErr) {
            console.warn('Could not reach server for initial report (falling back to local):', netErr?.message);
          }

          // 1b. Fetch per-letter attempt history + motor-pattern rollup (independent
          // of the shape assessment — non-fatal if unreachable, same as above)
          let letterReport = null;
          try {
            const lpRes = await client.get(ENDPOINTS.LETTER_PROGRESS_REPORT(student?.sid));
            letterReport = lpRes.data ?? null;
          } catch (netErr) {
            console.warn('Could not reach server for letter progress report:', netErr?.message);
          }

          // 2. Map server shapes → client format (shape_id → shapeId)
          const assessmentData = serverData?.assessment?.shapes?.map(s => ({
            shapeId:  s.shape_id,
            features: s.features,
            strokes:  s.strokes ?? [],
          })) ?? getAssessmentSnapshot().assessmentData ?? [];

          // 3. Motor profile — prefer server, fall back to AsyncStorage / snapshot
          const motorProfile =
            serverData?.assessment?.motor_profile ??
            getAssessmentSnapshot().motorProfile ??
            (await getMotorProfile(student?.sid));

          // 4. Local letter / word / session data (unchanged — these accumulate per session)
          let serverWordReport = { progress: {}, words: [], summary: {} };
          try { serverWordReport = await fetchWordReport(student); }
          catch (netErr) { console.warn('Could not reach server for word report:', netErr?.message); }
          const wordProgress = serverWordReport.progress ?? {};
          const completedLetters = await getCompletedLetters(student?.sid ?? 0);

          // Exact-match on letter string, which already encodes case
          // ('l' vs 'L') the same way AsyncStorage/completedLetters does —
          // no merging lowercase/uppercase scores together.
          const letterMasteryByLetter = {};
          for (const m of (serverData?.letterMastery ?? [])) {
            if (m.best_score != null) letterMasteryByLetter[m.letter] = m.best_score;
          }

          const letterProgressMap = {};
          for (const letter of (completedLetters ?? [])) {
            const lp = await getLetterProgress(student?.sid ?? 0, letter);
            if (lp) letterProgressMap[letter] = { ...lp, serverBestScore: letterMasteryByLetter[letter] ?? null };
          }

          // 5. Generate report using server-sourced motor data + local letter/word data
          const computed = generateReport({
            assessmentData, motorProfile, letterProgressMap,
            wordProgress, completedLetters, student,
          });
          computed.wordWritingHistory = serverWordReport;

          // 6. Override difficultyAnalysis with server-stored result if available
          if (serverData?.explanation) {
            const exp = serverData.explanation;
            const ui  = DIFFICULTY_UI[exp.difficultyKey] ?? DIFFICULTY_UI.NONE;
            computed.difficultyAnalysis = {
              difficulty:           exp.difficulty,
              difficultyKey:        exp.difficultyKey,
              confidence:           exp.confidence,
              description:          DIFFICULTY_DESCRIPTIONS[exp.difficultyKey] ?? exp.difficulty,
              color:                ui.color,
              bgColor:              ui.bgColor,
              icon:                 ui.icon,
              noIssueDetected:      ui.noIssueDetected,
              noDataAvailable:      false,
              featureContributions: exp.featureContributions ?? [],
              explanation:          exp.explanation ?? [],
              exercises:            (exp.recommendations ?? []).map(r =>
                typeof r === 'string' ? { text: r, priority: 'medium' } : r
              ),
              letterFocus:          exp.letterFocus ?? [],
              secondaryDifficulty:  exp.secondaryDifficulty ?? null,
            };
          }

          if (active) {
            setReport(computed);
            setDuration(getSessionDurationMinutes());
            setLetterProgressReport(letterReport);
          }
        } catch (e) {
          console.warn('Report load error:', e);
          if (active) setLoadError(true);
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [student])
  );

  // ── Feature 8 Step 4 — adaptive practice recommendations ──────────────────
  // Completely independent of the main report-loading effect above (Step 4
  // spec §18 — must never block the rest of the report): its own state,
  // its own loading indicator, its own failure handling. Fetched once per
  // (screen-focus, student) — never per card, never on expand/collapse
  // (Step 4 spec §17/§42). Same stale-response guard (`active`) the main
  // effect above already uses (Step 4 spec §43) — if the teacher navigates
  // to a different student before this resolves, the stale response is
  // silently discarded, never applied to the new student.
  const [worksheetRecs, setWorksheetRecs] = useState({ status: 'loading', recommendations: [], summary: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setWorksheetRecs({ status: 'loading', recommendations: [], summary: null });
      fetchWorksheetRecommendations({ studentId: student?.sid }).then((result) => {
        if (!active) return;
        setWorksheetRecs(result);
      });
      return () => { active = false; };
    }, [student])
  );

  // ── Feature 9 Step 5 — teacher validation history ─────────────────────────
  // Fetched ONCE per (screen-focus, student) — never per card (Step 5 spec
  // §46/§47) — independent of both the main report and the Feature 8
  // recommendation fetch above (its own loading state, its own failure
  // handling, same stale-response `active` guard). Each
  // AdaptivePracticeRecommendationCard filters this same array client-side
  // for its own stream (Step 5 spec §49) — no additional history request
  // is ever made per card.
  const [teacherHistory, setTeacherHistory] = useState({ status: 'loading', events: [], latestByStream: {} });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTeacherHistory({ status: 'loading', events: [], latestByStream: {} });
      fetchTeacherRecommendationValidationHistory({ studentId: student?.sid }).then((result) => {
        if (!active) return;
        setTeacherHistory(result);
      });
      return () => { active = false; };
    }, [student])
  );

  // ── Initial Motor Baseline Summary ────────────────────────────────────────
  // Reads the SAME persisted Feature 1 baseline endpoint the app already
  // uses (GET /handwriting/motor-baseline/:studentId) and renders the
  // backend's deterministic summary of the four authoritative scores. No ML
  // call, no clustering: the legacy experimental L2 shape-motor clustering
  // is retained in the repository for research/reference compatibility only
  // and is deliberately NOT fetched here.
  //
  // Completely independent of the main report load and of Feature 11B below
  // (spec §15: "One Feature failing must not hide the other") — its own
  // state, its own loading indicator, same stale-response `active` guard.
  // Strictly read-only: fetchMotorBaseline only ever GETs.
  const [motorBaseline, setMotorBaseline] = useState({ status: 'loading', baseline: null, summary: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setMotorBaseline({ status: 'loading', baseline: null, summary: null });
      fetchMotorBaseline({ studentId: student?.sid }).then((result) => {
        if (active) setMotorBaseline(result);
      });
      return () => { active = false; };
    }, [student])
  );

  // ── Feature 11B — Letter Motor Development ────────────────────────────────
  // 4 independent read-only fetches (latest state, state history,
  // mastery-evidence trend, and — S2 — the milestone evaluation log) — none
  // of them ever POSTs or triggers a milestone check/prediction (spec §16;
  // see the read-only guarantee tests). Fetched together per screen-focus,
  // same stale-response guard.
  const emptyLatest  = { status: 'loading', state: null };
  const emptyHistory = { status: 'loading', history: [] };
  const emptyTrend   = { status: 'loading', coverageN: 0, meanSmoothness: null, meanDtw: null, meanSpeedCv: null };
  const [letterMotorLatest,  setLetterMotorLatest]  = useState(emptyLatest);
  const [letterMotorHistory, setLetterMotorHistory] = useState(emptyHistory);
  const [letterMotorTrend,   setLetterMotorTrend]   = useState(emptyTrend);
  const emptyEvaluations = { status: 'loading', latest: null, results: [] };
  const [letterMotorEvaluations, setLetterMotorEvaluations] = useState(emptyEvaluations);
  // Writing Check history. Refetched on every screen FOCUS (not just mount), so
  // returning from a completed Writing Check shows the new result immediately,
  // with no app restart and no manual refresh.
  const emptyChecks = { status: 'loading', checks: [] };
  const [writingChecks, setWritingChecks] = useState(emptyChecks);

  // Homework worksheets. Refetched on every screen FOCUS and after every
  // teacher action (generate / upload / review), so the card never shows a
  // stale worksheet and no app restart is ever needed.
  const emptyWorksheets = { status: 'loading', worksheets: [], active: null };
  const [worksheetHistory, setWorksheetHistory] = useState(emptyWorksheets);
  const [worksheetCandidates, setWorksheetCandidates] = useState({ status: 'loading', candidates: [] });
  const [worksheetReloadToken, setWorksheetReloadToken] = useState(0);
  const refreshWorksheets = useCallback(() => setWorksheetReloadToken((t) => t + 1), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLetterMotorLatest(emptyLatest);
      setLetterMotorHistory(emptyHistory);
      setLetterMotorTrend(emptyTrend);
      setLetterMotorEvaluations(emptyEvaluations);
      setWritingChecks(emptyChecks);
      Promise.all([
        fetchLatestLetterMotorState(student?.sid),
        fetchLetterMotorStateHistory(student?.sid),
        fetchLetterMotorEvidenceTrend(student?.sid),
        fetchLetterMotorEvaluations(student?.sid),
        fetchWritingCheckHistory(student?.sid),
      ]).then(([latest, history, trend, evaluations, checks]) => {
        if (!active) return;
        setLetterMotorLatest(latest);
        setLetterMotorHistory(history);
        setLetterMotorTrend(trend);
        setLetterMotorEvaluations(evaluations);
        setWritingChecks(checks);
      });
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student])
  );

  // Worksheet data has its OWN focus effect keyed on a reload token, so a
  // generate/upload/review can refresh just this section without refetching
  // the whole report.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        fetchWorksheetHistory(student?.sid),
        fetchWorksheetCandidates(student?.sid),
      ]).then(([history, candidates]) => {
        if (!active) return;
        setWorksheetHistory(history);
        setWorksheetCandidates(candidates);
      });
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student, worksheetReloadToken])
  );

  async function handleShare() {
    if (!report) return;
    const { motorScore, wordMastery, summary } = report;
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const text = [
      `STUDENT REPORT — ${date}`,
      `Student: ${student?.full_name ?? 'Unknown'}`,
      `Session time: ${duration} minutes`,
      '',
      motorScore?.score !== null
        ? `Motor Comfort Score: ${motorScore.score}/100 (${motorScore.level})`
        : 'Motor assessment: not completed',
      '',
      `Letters practiced: ${summary.lettersPracticed}`,
      summary.totalWordsPracticed > 0
        ? `Word activities: ${wordMastery.overall?.correct ?? 0}/${wordMastery.overall?.total ?? 0} correct (${wordMastery.overall?.pct ?? 0}%)`
        : 'Word activities: none yet',
      '',
      ...report.recommendations.slice(0, 3).map(r => `• ${r.text}`),
    ].join('\n');
    Share.share({ message: text, title: `Auriva Report — ${student?.full_name}` });
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 0.3 }}
    >
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.topBtn} onPress={requestBack} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.topTitle, { color: theme.headingText }]}>Progress Report</Text>
            <Text style={[s.topDate,  { color: theme.headingText }]}>{dateStr}</Text>
          </View>
          {/* Proposal FR-19/FR-20, Phase 7C/7D §25 — this is the pre-
              existing PLAINTEXT current-state summary share (Share.share,
              unrelated to any date range). The new genuine PDF export/
              share for a selected period lives in PeriodicReportSection
              below, as its own distinctly-labeled "Export & Share PDF"
              button — the two are never both called "Share Report". */}
          <TouchableOpacity
            style={s.topBtn}
            onPress={handleShare}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Share text summary"
          >
            <Ionicons name="share-social-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* ── Student hero strip ── */}
        <View style={s.heroStrip}>
          <View style={[s.heroInitial, { backgroundColor: theme.button }]}>
            <Text style={s.heroInitialText}>
              {(student?.full_name ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroName, { color: theme.headingText }]} numberOfLines={1}>
              {student?.full_name ?? '—'}
            </Text>
            <Text style={[s.heroMeta, { color: theme.headingText }]}>
              ID #{student?.sid ?? '—'}  ·  {duration} min session
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={theme.button} />
            <Text style={[s.loadingText, { color: theme.headingText }]}>Generating report…</Text>
          </View>
        ) : !report || loadError ? (
          <View style={s.loadingWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.headingText} />
            <Text style={[s.loadingText, { color: theme.headingText }]}>
              Couldn't load this report. Check the connection and try again.
            </Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: theme.button }]}
              // route.name, not a hardcoded 'TeacherReport': this same
              // component is also registered as 'StudentHandwritingReport'
              // in TeacherNavigator, where the literal name is wrong. Also
              // carries originRoute through, so a retry does not lose the
              // back destination.
              onPress={() => navigation.replace(route.name, {
                ...route.params, student, theme,
              })}
              accessibilityRole="button"
              accessibilityLabel="Retry loading the report"
            >
              <Text style={s.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={s.scrollArea}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >

            {/* ══ 0. Periodic Report (FR-19/FR-20) ═══════════════════════════ */}
            <PeriodicReportSection student={student} theme={theme} />

            {/* ══ 1. Practice Summary ════════════════════════════════════════ */}
            <SectionCard title="Practice Summary" icon="stats-chart" accentColor="#6366F1">
              <View style={s.summaryGrid}>
                <StatTile value={report.summary.lettersPracticed} label="Letters"       color="#6366F1" bg="#EEF2FF" />
                <StatTile value={report.summary.totalWordsPracticed} label="Words"      color="#0891B2" bg="#ECFEFF" />
                <StatTile value={report.summary.totalAttempts}     label="Attempts"     color="#D97706" bg="#FFFBEB" />
                <StatTile value={report.summary.wordLettersDone}   label="In Activities" color="#059669" bg="#ECFDF5" />
              </View>
            </SectionCard>

            {/* ══ 2. Motor Comfort Score ════════════════════════════════════ */}
            <SectionCard title="Motor Comfort Score" icon="speedometer" accentColor="#7C3AED">
              {report.motorScore.score !== null ? (
                <>
                  <MotorGauge score={report.motorScore.score} />
                  <View style={{ alignItems: 'center', marginTop: 6, gap: 8 }}>
                    <Pill
                      label={report.motorScore.level}
                      status={report.motorScore.score >= 70 ? 'good' : report.motorScore.score >= 45 ? 'moderate' : 'needs-work'}
                    />
                    <WhyPanel explanation={report.motorScore.explanation} />
                  </View>
                </>
              ) : (
                <Empty message="Complete the shape assessment to see the motor comfort score" />
              )}
            </SectionCard>

            {/* ══ 3. Motor Performance (per shape) ════════════════════════ */}
            <SectionCard title="Motor Performance" icon="pulse" accentColor="#0891B2">
              {report.motorScore.breakdown?.length > 0 ? (
                <>
                  {report.motorScore.breakdown.map(shape => (
                    <ShapeRow key={shape.shapeId} shape={shape} />
                  ))}

                  {report.letterMetrics.avgDeviation !== null && (
                    <>
                      <View style={s.divider} />
                      <View style={s.metricsRow}>
                        <MetricTile icon="move-outline"  label="Avg deviation" value={`${report.letterMetrics.avgDeviation} px`} />
                        <MetricTile icon="hand-left-outline" label="Avg pauses"  value={report.letterMetrics.avgPauses ?? '—'} />
                        <MetricTile icon="timer-outline" label="Avg time"     value={report.letterMetrics.avgTime !== null ? `${report.letterMetrics.avgTime}s` : '—'} />
                      </View>
                    </>
                  )}
                  <WhyPanel label="How is this measured?" explanation={report.letterMetrics.explanation} />
                </>
              ) : (
                <Empty message="No motor assessment data yet" />
              )}
            </SectionCard>

            {/* ══ 4. Motor Difficulty Analysis ════════════════════════════ */}
            <MotorDifficultyCard analysis={report.difficultyAnalysis} />

            {/* ══ Motor Pattern Progress ══════════════════════════════════ */}
            <SectionCard title="Motor Pattern Progress" icon="git-network" accentColor="#0891B2">
              {letterProgressReport?.motorPatterns?.some(p => p.hasData) ? (
                <View style={{ gap: 14 }}>
                  {letterProgressReport.motorPatterns.map(p => (
                    <MotorPatternRow key={p.group} pattern={p} />
                  ))}
                </View>
              ) : (
                <Empty message="Complete letter practice to see motor pattern progress" />
              )}
            </SectionCard>

            {/* ══ Initial Motor Baseline Summary ═══════════════════════════ */}
            <InitialMotorBaselineSummaryCard result={motorBaseline} />

            {/* ══ Feature 11B — Letter Motor Development ═══════════════════ */}
            <LetterMotorDevelopmentCard
              latest={letterMotorLatest}
              history={letterMotorHistory}
              trend={letterMotorTrend}
              evaluations={letterMotorEvaluations}
            />

            {/* ══ Homework Practice ══════════════════════════════════════ */}
            <HomeworkPracticeCard
              student={student}
              theme={theme}
              candidates={worksheetCandidates}
              history={worksheetHistory}
              onChanged={refreshWorksheets}
            />

            {/* ══ Writing Check history ═══════════════════════════════════ */}
            <WritingCheckHistoryCard
              result={writingChecks}
              student={student}
              theme={theme}
              navigation={navigation}
            />

            {/* ══ 5. Letters Mastery ══════════════════════════════════════ */}
            <SectionCard title="Letters Mastery" icon="text" accentColor="#059669">
              {report.letterMetrics.letters.length > 0 ? (
                <>
                  <LetterMasteryGrid letters={report.letterMetrics.letters} />
                  <WhyPanel label="How is mastery measured?" explanation={report.letterMetrics.explanation} />
                </>
              ) : (
                <Empty message="No letter practice recorded in this session" />
              )}
            </SectionCard>

            {/* ══ 6. Word Activities ══════════════════════════════════════ */}
            <SectionCard title="Word Activities" icon="book" accentColor="#D97706">
              {report.wordMastery.byLetter.length > 0 ? (
                <>
                  {report.wordMastery.overall && (
                    <View style={s.overallBar}>
                      <Text style={s.overallLabel}>Overall accuracy</Text>
                      <View style={{ flex: 1 }}>
                        <ScoreBar pct={report.wordMastery.overall.pct} height={10} />
                      </View>
                      <Text style={[s.overallPct, {
                        color: report.wordMastery.overall.pct >= 75 ? '#15803D' :
                               report.wordMastery.overall.pct >= 50 ? '#B45309' : '#B91C1C',
                      }]}>
                        {report.wordMastery.overall.pct}%
                      </Text>
                    </View>
                  )}
                  <View style={s.divider} />
                  {report.wordMastery.byLetter.map(l => (
                    <WordLetterRow key={l.letter} data={l} />
                  ))}
                  <WhyPanel label="How is word accuracy measured?" explanation={report.wordMastery.explanation} />
                </>
              ) : (
                <Empty message="No word activities completed yet" />
              )}
            </SectionCard>

            {/* ══ 6b. Word Writing Performance (final-completion-pass task) ══
                Read-only detail: per-word writing score + letter-size/
                spacing consistency labels, sourced from the backend's own
                word-report (report.wordWritingHistory.words) — nothing
                recomputed here, no raw DTW/CV/gap-ratio numbers shown. */}
            <SectionCard title="Word Writing Performance" icon="create" accentColor="#0891B2">
              {report.wordWritingHistory?.words?.length > 0 ? (
                report.wordWritingHistory.words.map(w => (
                  <WordWritingRow key={w.word} data={w} />
                ))
              ) : (
                <Empty message="No word-writing attempts yet" />
              )}
            </SectionCard>

            {/* ══ 7. Learning Progress ════════════════════════════════════ */}
            <SectionCard title="Learning Progress" icon="trending-up" accentColor="#0284C7">
              {report.progressIndicators.length > 0 ? (
                <View style={s.progressGrid}>
                  {report.progressIndicators.map((ind, i) => (
                    <ProgressTile key={i} item={ind} />
                  ))}
                </View>
              ) : (
                <Empty message="Complete activities to see learning trends" />
              )}
            </SectionCard>

            {/* ══ 8. Teacher Recommendations ══════════════════════════════ */}
            <SectionCard title="Teacher Recommendations" icon="bulb" accentColor="#7C3AED">
              <View style={{ gap: 10 }}>
                {report.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </View>

              {/* ── Feature 8 Step 4 — a second, clearly-attributed recommendation
                  source: longitudinal practice evidence, never conflated with the
                  general recommendations above (Step 4 spec §3/§15). ── */}
              <View style={arp.divider} />
              <View style={arp.subHeader}>
                <Ionicons name="analytics-outline" size={15} color="#0D9488" />
                <Text style={arp.subTitle}>Adaptive Practice Recommendations</Text>
              </View>
              <Text style={arp.subSubtitle}>
                Suggested handwriting practice based on patterns observed across separate practice periods.
              </Text>

              {worksheetRecs.status === 'loading' && (
                <View style={arp.loadingRow}>
                  <ActivityIndicator size="small" color="#0D9488" />
                  <Text style={arp.loadingText}>Loading practice recommendations…</Text>
                </View>
              )}

              {(worksheetRecs.status === 'read_failed' || worksheetRecs.status === 'invalid_input') && (
                <Text style={arp.errorText}>Practice recommendations could not be loaded.</Text>
              )}

              {worksheetRecs.status === 'evaluated' && worksheetRecs.recommendations.length === 0 && (
                <Text style={arp.emptyText}>{getWorksheetRecommendationEmptyState(worksheetRecs.summary)}</Text>
              )}

              {worksheetRecs.status === 'evaluated' && worksheetRecs.recommendations.length > 0 && (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {worksheetRecs.recommendations.map((rec, i) => (
                    <AdaptivePracticeRecommendationCard
                      key={i}
                      recommendation={rec}
                      studentId={student?.sid}
                      historyEvents={teacherHistory.events}
                    />
                  ))}
                </View>
              )}
            </SectionCard>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ value, label, color, bg }) {
  return (
    <View style={[st.tile, { backgroundColor: bg }]}>
      <Text style={[st.value, { color }]}>{value ?? '—'}</Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, minWidth: '22%' },
  value: { fontSize: 30, fontWeight: '900' },
  label: { fontSize: 11, color: TEXT_2, fontWeight: '600', textAlign: 'center' },
});

// Small preview of the child's actual traced strokes for one shape — see
// shapePreviewGeometry.js. strokes were already sent to the client by
// getInitialReport (nothing new exposed); this only renders them. Shows a
// neutral placeholder icon rather than a blank box when a shape genuinely
// has no usable stroke data (never fabricates a drawing).
const SHAPE_PREVIEW_SIZE = 44;

function ShapePreview({ strokes }) {
  const paths = computeShapePreviewPaths(strokes, SHAPE_PREVIEW_SIZE, SHAPE_PREVIEW_SIZE, 5);
  return (
    <View style={sr.previewBox}>
      {paths.length > 0 ? (
        <Svg width={SHAPE_PREVIEW_SIZE} height={SHAPE_PREVIEW_SIZE}>
          {paths.map((points, i) => (
            <Polyline
              key={i}
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              stroke="#334155"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      ) : (
        <Ionicons name="image-outline" size={16} color="#CBD5E1" />
      )}
    </View>
  );
}

function ShapeRow({ shape }) {
  const color = shape.score >= 70 ? '#15803D' : shape.score >= 45 ? '#B45309' : '#B91C1C';
  const label = shape.label ?? (shape.score >= 70 ? 'Excellent' : shape.score >= 45 ? 'Good' : 'Practice');
  return (
    <View style={sr.wrap}>
      <ShapePreview strokes={shape.strokes} />
      <View style={sr.row}>
        <Text style={sr.name} numberOfLines={1}>
          {shape.shapeId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </Text>
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <ScoreBar pct={shape.score} height={10} />
        </View>
        <Text style={[sr.pct, { color }]}>{shape.score}%</Text>
        <View style={[sr.labelWrap, {
          backgroundColor: shape.score >= 70 ? '#F0FDF4' : shape.score >= 45 ? '#FFFBEB' : '#FEF2F2',
          borderColor: shape.score >= 70 ? '#86EFAC' : shape.score >= 45 ? '#FCD34D' : '#FCA5A5',
        }]}>
          <Text style={[sr.labelText, { color }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  previewBox: {
    width: SHAPE_PREVIEW_SIZE, height: SHAPE_PREVIEW_SIZE, borderRadius: 8,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  row:       { flex: 1, flexDirection: 'row', alignItems: 'center' },
  name:      { width: 110, fontSize: 13, color: TEXT_2, fontWeight: '500' },
  pct:       { width: 38, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  labelWrap: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  labelText: { fontSize: 10, fontWeight: '700' },
});

function MetricTile({ icon, label, value }) {
  return (
    <View style={mt.tile}>
      <Ionicons name={icon} size={16} color={TEXT_3} />
      <Text style={mt.value}>{value}</Text>
      <Text style={mt.label}>{label}</Text>
    </View>
  );
}
const mt = StyleSheet.create({
  tile:  { flex: 1, alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10 },
  value: { fontSize: 16, fontWeight: '800', color: TEXT_1 },
  label: { fontSize: 10, color: TEXT_3, fontWeight: '500', textAlign: 'center' },
});

function LetterMasteryGrid({ letters }) {
  const mastered    = letters.filter(l => l.status === 'Mastered').length;
  const progressing = letters.filter(l => l.status === 'Progressing').length;
  const needs       = letters.filter(l => l.status === 'Needs Practice').length;

  return (
    <View>
      {/* Summary row */}
      <View style={lg.summaryRow}>
        <LegendDot color={T.good.dot}     label={`${mastered} Mastered`} />
        <LegendDot color={T.moderate.dot} label={`${progressing} Progressing`} />
        <LegendDot color={T.needs.dot}    label={`${needs} Needs Practice`} />
      </View>

      {/* Letter chips */}
      <View style={lg.grid}>
        {letters.map(l => {
          const t = statusToken(l.status === 'Mastered' ? 'good' : l.status === 'Progressing' ? 'moderate' : 'needs-work');
          return (
            <View key={l.letter} style={[lg.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
              <Text style={[lg.chipLetter, { color: t.text }]}>{l.letter.toUpperCase()}</Text>
              <Text style={[lg.chipPct, { color: t.text }]}>{l.accuracy}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
function LegendDot({ color, label }) {
  return (
    <View style={lg.legendItem}>
      <View style={[lg.dot, { backgroundColor: color }]} />
      <Text style={lg.legendLabel}>{label}</Text>
    </View>
  );
}
const lg = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: 11, color: TEXT_2, fontWeight: '600' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: 52, height: 56, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  chipLetter: { fontSize: 18, fontWeight: '900' },
  chipPct:    { fontSize: 9,  fontWeight: '700' },
});

function ProgressTile({ item }) {
  const [open, setOpen] = useState(false);
  const t = statusToken(item.status);
  return (
    <View style={[pt.tile, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[pt.iconCircle, { backgroundColor: t.dot + '22' }]}>
        <Text style={{ fontSize: 18 }}>{item.icon}</Text>
      </View>
      <Text style={[pt.label, { color: t.text }]}>{item.label}</Text>
      <View style={[pt.badge, { backgroundColor: t.dot + '22' }]}>
        <Text style={[pt.badgeText, { color: t.text }]}>{item.detail}</Text>
      </View>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={pt.whyBtn} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={14} color="#6366F1" />
        <Text style={pt.whyText}>Why?</Text>
      </TouchableOpacity>
      {open && (
        <View style={pt.panel}>
          <Text style={pt.panelText}>{item.xai}</Text>
        </View>
      )}
    </View>
  );
}
const pt = StyleSheet.create({
  tile: {
    flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 12,
    alignItems: 'center', gap: 6, minWidth: '47%',
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label:      { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:  { fontSize: 11, fontWeight: '700' },
  whyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  whyText:    { fontSize: 11, color: '#6366F1', fontWeight: '600' },
  panel:      {
    marginTop: 4, backgroundColor: '#EEF2FF', borderRadius: 8,
    padding: 8, width: '100%',
  },
  panelText:  { fontSize: 11, color: '#3730A3', lineHeight: 16 },
});

function WordLetterRow({ data }) {
  const [open, setOpen] = useState(false);
  const t = statusToken(data.masteryStatus === 'Mastered' ? 'good' : data.masteryStatus === 'Moderate' ? 'moderate' : 'needs-work');
  return (
    <View style={wl.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.8} style={wl.row}>
        <View style={[wl.letterBubble, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Text style={[wl.letterText, { color: t.text }]}>{data.letter.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={wl.metaRow}>
            <Text style={wl.metaText}>{data.words} word{data.words !== 1 ? 's' : ''}</Text>
            <Text style={[wl.pctText, { color: t.text }]}>{data.accuracy}% correct</Text>
          </View>
          <ScoreBar pct={data.accuracy} height={8} />
        </View>
        <View style={{ marginLeft: 10, gap: 6, alignItems: 'flex-end' }}>
          <Pill label={data.masteryStatus} status={data.masteryStatus === 'Mastered' ? 'good' : data.masteryStatus === 'Moderate' ? 'moderate' : 'needs-work'} />
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={TEXT_3} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={wl.expanded}>
          {data.wordList.map((w, i) => (
            <View key={i} style={wl.wordRow}>
              <WordImageDisplay imageKey={w.imageKey ?? ''} emoji={w.emoji} size={30} />
              <Text style={wl.wordText}>{w.word}</Text>
              <View style={wl.exerciseChips}>
                {['A', 'B', 'C', 'D'].map(ex => {
                  const s = w.status[ex];
                  const col = s === 'correct' ? '#15803D' : s === 'good' ? '#B45309' : '#CBD5E1';
                  const ic  = s === 'correct' ? 'checkmark' : s === 'good' ? 'remove' : 'ellipse-outline';
                  return (
                    <View key={ex} style={[wl.exChip, { backgroundColor: col + '18', borderColor: col + '55' }]}>
                      <Text style={[wl.exLabel, { color: col }]}>{ex}</Text>
                      <Ionicons name={ic} size={9} color={col} />
                    </View>
                  );
                })}
              </View>
              <View style={wl.stars}>
                {[0,1,2].map(i => (
                  <Text key={i} style={{ fontSize: 12 }}>{i < w.stars ? '⭐' : '☆'}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const wl = StyleSheet.create({
  wrap:         { marginBottom: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  letterBubble: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  letterText:   { fontSize: 18, fontWeight: '900' },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:     { fontSize: 11, color: TEXT_3, fontWeight: '500' },
  pctText:      { fontSize: 11, fontWeight: '700' },
  expanded:     { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, gap: 8, marginTop: 2, marginLeft: 52 },
  wordRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordText:     { flex: 1, fontSize: 13, fontWeight: '700', color: TEXT_1, textTransform: 'capitalize' },
  exerciseChips:{ flexDirection: 'row', gap: 4 },
  exChip:       { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  exLabel:      { fontSize: 10, fontWeight: '800' },
  stars:        { flexDirection: 'row', gap: 1 },
});

// ─── Word Writing Performance (final-completion-pass task, section 22) ────────
// Small, read-only detail card for the backend's per-word writing scores —
// latest_score/best_score/attempt_count/passed/last_practised plus the
// letter_size/letter_spacing consistency LABELS (never the raw DTW distance,
// CV, or gap-ratio numbers those labels are derived from — see
// wordLayoutService.js's scoreToConsistencyLabel on the backend). Distinct
// from the "Word Activities" card above, which shows A–D/E exercise
// completion, not the writing/tracing SCORE itself.

function layoutConsistencyToken(value) {
  if (value === 'Consistent')      return T.good;
  if (value === 'Some variation')  return T.moderate;
  if (value === 'High variation')  return T.needs;
  // null from the backend (no layout data yet for this word, e.g. a
  // historical attempt predating this metric) — a neutral, non-judgemental
  // "not enough data" state, never a guessed label.
  return { bg: '#F1F5F9', border: '#E2E8F0', text: TEXT_3, dot: '#CBD5E1' };
}

function LayoutConsistencyPill({ label, value }) {
  const t = layoutConsistencyToken(value);
  return (
    <View style={[wwp.metricPill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[wwp.metricLabel, { color: t.text }]}>{label}: {value ?? 'Not enough writing data'}</Text>
    </View>
  );
}

function WordWritingRow({ data }) {
  return (
    <View style={wwp.row}>
      <View style={wwp.topLine}>
        <Text style={wwp.word}>{data.word}</Text>
        <Pill label={data.passed ? 'Passed' : 'In progress'} status={data.passed ? 'good' : 'moderate'} />
      </View>
      <View style={wwp.scoreLine}>
        <Text style={wwp.metaText}>Latest score {data.latest_score}</Text>
        <Text style={wwp.metaText}>·</Text>
        <Text style={wwp.metaText}>Best {data.best_score}</Text>
        <Text style={wwp.metaText}>·</Text>
        <Text style={wwp.metaText}>{data.attempt_count} attempt{data.attempt_count !== 1 ? 's' : ''}</Text>
      </View>
      <View style={wwp.metricsRow}>
        <LayoutConsistencyPill label="Letter size" value={data.letter_size} />
        <LayoutConsistencyPill label="Spacing" value={data.letter_spacing} />
      </View>
    </View>
  );
}

const wwp = StyleSheet.create({
  row:         { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 6 },
  topLine:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  word:        { fontSize: 14, fontWeight: '800', color: TEXT_1, textTransform: 'capitalize' },
  scoreLine:   { flexDirection: 'row', gap: 5 },
  metaText:    { fontSize: 11, color: TEXT_3, fontWeight: '500' },
  metricsRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metricPill:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1.5 },
  metricLabel: { fontSize: 10, fontWeight: '700' },
});

function RecommendationCard({ rec }) {
  const [open, setOpen] = useState(false);
  const colors = {
    high:   { bg: '#FEF2F2', accent: '#EF4444', text: '#B91C1C', pill: '#FEE2E2' },
    medium: { bg: '#FFFBEB', accent: '#F59E0B', text: '#B45309', pill: '#FEF3C7' },
    low:    { bg: '#F0FDF4', accent: '#22C55E', text: '#15803D', pill: '#DCFCE7' },
  };
  const c = colors[rec.priority] ?? colors.low;
  return (
    <View style={[rc.card, { backgroundColor: c.bg, borderLeftColor: c.accent }]}>
      <View style={rc.top}>
        <Text style={rc.icon}>{rec.icon}</Text>
        <Text style={rc.text}>{rec.text}</Text>
        <View style={[rc.priorityBadge, { backgroundColor: c.pill }]}>
          <Text style={[rc.priorityText, { color: c.text }]}>
            {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={rc.why} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={13} color="#6366F1" />
        <Text style={rc.whyText}>Why this recommendation?</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color="#6366F1" />
      </TouchableOpacity>
      {open && (
        <View style={rc.panel}>
          <Text style={rc.panelText}>{rec.rationale}</Text>
        </View>
      )}
    </View>
  );
}
const rc = StyleSheet.create({
  card:          { borderRadius: 14, borderLeftWidth: 4, padding: 14, gap: 8 },
  top:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon:          { fontSize: 20 },
  text:          { flex: 1, fontSize: 13, fontWeight: '600', color: TEXT_1, lineHeight: 20 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  priorityText:  { fontSize: 10, fontWeight: '800' },
  why:           { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  whyText:       { fontSize: 11, color: '#6366F1', fontWeight: '600' },
  panel:         { backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10 },
  panelText:     { fontSize: 12, color: '#3730A3', lineHeight: 18 },
});

// ─── Feature 8 Step 4 — Adaptive Practice Recommendation card ──────────────
//
// Deliberately a DEDICATED component, never a variant of RecommendationCard
// above (Step 4 spec §48 — lower regression risk; RecommendationCard's own
// existing priority-badge behavior is untouched). Feature 8 recommendations
// carry NO priority/severity/confidence field at all, so this card renders
// with one flat neutral accent color — never a red/orange/green severity
// palette (Step 4 spec §6/§7/§33). Reuses the existing WhyPanel component
// for the "Why this recommendation?" interaction (Step 4 spec §9) — each
// card instance gets its own independent expand/collapse state, since
// WhyPanel's `open` state lives inside WhyPanel itself (Step 4 spec §50).
//
// `rationale`/`title`/`suggestedActivities` are rendered EXACTLY as the
// backend sent them (Step 4 spec §9/§23) — this component performs no
// wording generation of its own beyond the caseType label
// (formatCaseType()) and the focus-letter join, both pure presentation
// only, never content invention.

function AdaptivePracticeRecommendationCard({ recommendation, studentId, historyEvents }) {
  const caseLabel = formatCaseType(recommendation.caseType);
  return (
    <View style={apc.card}>
      <View style={apc.top}>
        <View style={apc.iconWrap}>
          <Ionicons name="body-outline" size={16} color="#0D9488" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={apc.title}>{recommendation.title}</Text>
          {caseLabel ? <Text style={apc.caseLabel}>{caseLabel}</Text> : null}
        </View>
      </View>

      {shouldShowFocusLetters(recommendation.focusLetters) && (
        <Text style={apc.focusLetters}>
          Focus letters: <Text style={apc.focusLettersValue}>{recommendation.focusLetters.join(', ')}</Text>
        </Text>
      )}

      <ActivityPreviewSection
        family={recommendation.family}
        caseType={recommendation.caseType}
        focusLetters={recommendation.focusLetters}
      />

      {recommendation.suggestedActivities.length > 0 && (
        <View style={apc.activityList}>
          {recommendation.suggestedActivities.map((activity, i) => (
            <View key={i} style={apc.activityRow}>
              <View style={apc.bullet} />
              <Text style={apc.activityText}>{activity}</Text>
            </View>
          ))}
        </View>
      )}

      <WhyPanel label="Why this recommendation?" explanation={recommendation.rationale} />

      <TeacherReviewSection
        studentId={studentId}
        caseType={recommendation.caseType}
        family={recommendation.family}
        recommendationFingerprint={recommendation.recommendationFingerprint}
        historyEvents={historyEvents}
      />
    </View>
  );
}

// ─── Feature 9 Step 5 — Teacher Review section ─────────────────────────────
//
// Embedded beneath each AdaptivePracticeRecommendationCard's existing
// content (Step 5 spec §24). Never suppresses the recommendation itself,
// regardless of the teacher's judgement (Step 5 spec §31/§41) — this
// section is purely additive presentation.
//
// State machine (Step 5 spec §25 — presentation states only; the ONLY
// persisted values remain `confirmed`/`dismissed`):
//   loading -> not_reviewed | confirmed | dismissed
//   (confirmed | dismissed) --[opposite button pressed]--> saving -> refetch
//   any state --[submit fails]--> error (recommendation_changed /
//     recommendation_not_found / generic write failure)
//
// Current-state is fetched keyed by the exact
// (studentId, caseType, family, recommendationFingerprint) identity (Step 5
// spec §26/§27) — never refetched due to WhyPanel expand, note typing, or
// unrelated parent re-renders, since the effect below depends on nothing
// else. A stale in-flight request is discarded via the `mountedRef`/`active`
// guard if the fingerprint changes or the component unmounts before it
// resolves (Step 5 spec §28).
function TeacherReviewSection({ studentId, caseType, family, recommendationFingerprint, historyEvents }) {
  const [stateResult, setStateResult] = useState({ status: 'loading', current: null });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;

    if (!recommendationFingerprint) {
      // No identity to look up against — never a fake "not reviewed" write
      // path, just a safe empty current state (Step 5 spec §19).
      setStateResult({ status: 'evaluated', current: null });
      return () => { active = false; };
    }

    setStateResult((prev) => ({ ...prev, status: 'loading' }));
    fetchTeacherRecommendationValidationState({ studentId, caseType, family, recommendationFingerprint }).then((result) => {
      if (!active || !mountedRef.current) return; // stale-response guard (Step 5 spec §28)
      setStateResult(result);
    });

    return () => { active = false; };
  }, [studentId, caseType, family, recommendationFingerprint]);

  async function handleAction(validation) {
    if (!recommendationFingerprint || saving) return; // no automatic/duplicate POSTs (Step 5 spec §36/§61)
    setSaving(true);
    setSubmitMessage(null);

    // Feature 9 repair — generated exactly ONCE per button press, right
    // here at the user-gesture boundary, never inside the submit helper
    // below. Any transport-level retry of this same request (client.js's
    // response interceptor) resends the identical body — including this
    // same actionId — so the backend still sees it as one action; a
    // second, later button press always calls this handler again and
    // gets a fresh actionId here.
    const actionId = generateUuidV4();

    const result = await submitTeacherRecommendationValidation({
      studentId, caseType, family, validation, teacherNote: note, recommendationFingerprint, actionId,
    });

    if (!mountedRef.current) return;
    setSaving(false);

    if (result.status === 'validated') {
      // Refresh exact current state from the server rather than assuming
      // the local value (Step 5 spec §37/§38) — a duplicate (200) is
      // treated identically to a fresh success (201).
      setNote('');
      const refreshed = await fetchTeacherRecommendationValidationState({ studentId, caseType, family, recommendationFingerprint });
      if (!mountedRef.current) return;
      setStateResult(refreshed);
    } else {
      // recommendation_changed / recommendation_not_found / invalid_input /
      // write_failed — never save a local review, never fake success (Step
      // 5 spec §39/§40).
      setSubmitMessage(result.message);
    }
  }

  if (stateResult.status === 'loading') {
    return (
      <View style={trs.wrap}>
        <View style={trs.divider} />
        <ActivityIndicator size="small" color="#0D9488" />
      </View>
    );
  }

  const current = stateResult.current;
  const currentValidation = current?.validation ?? null;
  const opposite = getOppositeValidationAction(currentValidation);
  // Never re-offer the same action already recorded (Step 5 spec §42/§43) —
  // when never reviewed, both actions are available.
  const showConfirmButton = currentValidation === null || opposite === 'confirmed';
  const showDismissButton = currentValidation === null || opposite === 'dismissed';
  const relevantHistory = filterHistoryForStream(historyEvents, caseType, family);

  return (
    <View style={trs.wrap}>
      <View style={trs.divider} />
      <Text style={trs.label}>Teacher review</Text>
      <Text style={trs.statusText}>{formatTeacherReviewLabel(currentValidation)}</Text>
      {current?.validatedAt ? (
        <Text style={trs.dateText}>Reviewed: {formatReviewDate(current.validatedAt)}</Text>
      ) : null}

      {submitMessage ? <Text style={trs.messageText}>{submitMessage}</Text> : null}

      <View style={trs.buttonsRow}>
        {showConfirmButton && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Confirm this recommendation"
            disabled={saving || !recommendationFingerprint}
            onPress={() => handleAction('confirmed')}
            style={[trs.button, trs.confirmButton, (saving || !recommendationFingerprint) && trs.buttonDisabled]}
            activeOpacity={0.75}
          >
            <Text style={trs.buttonText}>{saving ? 'Saving…' : 'Confirm'}</Text>
          </TouchableOpacity>
        )}
        {showDismissButton && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mark this recommendation as not suitable"
            disabled={saving || !recommendationFingerprint}
            onPress={() => handleAction('dismissed')}
            style={[trs.button, trs.dismissButton, (saving || !recommendationFingerprint) && trs.buttonDisabled]}
            activeOpacity={0.75}
          >
            <Text style={trs.buttonText}>{saving ? 'Saving…' : 'Not suitable'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={trs.noteInput}
        placeholder="Optional note"
        placeholderTextColor="#94A3B8"
        multiline
        maxLength={TEACHER_NOTE_MAX_LENGTH}
        value={note}
        onChangeText={setNote}
        editable={!saving}
        accessibilityLabel="Optional note about this teacher review"
      />

      {relevantHistory.length > 0 && (
        <TouchableOpacity
          onPress={() => setShowHistory((v) => !v)}
          style={trs.historyToggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View review history"
        >
          <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={13} color="#0D9488" />
          <Text style={trs.historyToggleText}>View review history</Text>
        </TouchableOpacity>
      )}

      {showHistory && (
        <View style={trs.historyList}>
          {relevantHistory.map((event) => (
            <View key={event.id} style={trs.historyRow}>
              <Text style={trs.historyLine}>
                {formatReviewDate(event.validatedAt)} — {formatTeacherReviewLabel(event.validation)}
              </Text>
              {event.teacherNote ? <Text style={trs.historyNote}>Note: {event.teacherNote}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const apc = StyleSheet.create({
  card:              { borderRadius: 14, borderLeftWidth: 4, borderLeftColor: '#0D9488', backgroundColor: '#F0FDFA', padding: 14, gap: 10 },
  top:               { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap:          { width: 28, height: 28, borderRadius: 9, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  title:             { fontSize: 13, fontWeight: '700', color: TEXT_1, lineHeight: 19 },
  caseLabel:         { fontSize: 11, color: '#0F766E', fontWeight: '600', marginTop: 1 },
  focusLetters:      { fontSize: 12, color: TEXT_2, fontWeight: '500' },
  focusLettersValue: { fontWeight: '800', color: TEXT_1 },
  activityList:      { gap: 5 },
  activityRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bullet:            { width: 5, height: 5, borderRadius: 3, backgroundColor: '#0D9488', marginTop: 6 },
  activityText:      { flex: 1, fontSize: 12, color: TEXT_2, lineHeight: 18 },
});

// ─── Feature 10 Step 3 — Activity Preview expand/collapse wrapper ──────────
//
// Deliberately separate from ActivityPreview.js's own pure SVG rendering
// (Step 3 spec §22/§26) — this component owns ONLY the open/closed state
// and the toggle button, mirroring WhyPanel's own established pattern
// (own local useState, TouchableOpacity toggle, conditional content) one
// component instance per card, so two cards' preview sections never share
// state (Step 3 spec §25).
function ActivityPreviewSection({ family, caseType, focusLetters }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={aps.wrap}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={aps.toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide activity preview' : 'Show activity preview'}
      >
        <Ionicons name="eye-outline" size={14} color="#0D9488" />
        <Text style={aps.toggleLabel}>Preview activity</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#0D9488" />
      </TouchableOpacity>
      {open && (
        <View style={aps.previewContainer}>
          <ActivityPreview family={family} caseType={caseType} focusLetters={focusLetters} />
        </View>
      )}
    </View>
  );
}

const aps = StyleSheet.create({
  wrap:            { marginTop: 2 },
  toggle:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLabel:     { fontSize: 12, color: '#0D9488', fontWeight: '700' },
  previewContainer:{ marginTop: 8 },
});

// Feature 9 Step 5 — Teacher Review section styles. Deliberately ONE flat
// neutral accent (#0D9488, the same teal AdaptivePracticeRecommendationCard
// itself already uses) for both Confirm and Not-suitable — never a
// red/green correctness palette (Step 5 spec §54/§55/§56). "Not suitable"
// is never styled as an error/warning state; it's a neutral second option.
const trs = StyleSheet.create({
  wrap:            { marginTop: 2 },
  divider:         { height: 1, backgroundColor: '#CCFBF1', marginBottom: 10 },
  label:           { fontSize: 11, fontWeight: '800', color: '#0F766E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statusText:      { fontSize: 13, fontWeight: '700', color: TEXT_1 },
  dateText:        { fontSize: 11, color: TEXT_3, marginTop: 1, marginBottom: 8 },
  messageText:     { fontSize: 12, color: TEXT_2, lineHeight: 17, marginTop: 6, marginBottom: 6 },
  buttonsRow:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  button:          { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  confirmButton:   { backgroundColor: '#0D9488' },
  dismissButton:   { backgroundColor: '#64748B' },
  buttonDisabled:  { opacity: 0.5 },
  buttonText:      { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  noteInput: {
    marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF', padding: 10, fontSize: 12, color: TEXT_1,
    minHeight: 44, textAlignVertical: 'top',
  },
  historyToggle:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start' },
  historyToggleText: { fontSize: 11.5, color: '#0D9488', fontWeight: '700' },
  historyList:       { marginTop: 8, gap: 8 },
  historyRow:        { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8 },
  historyLine:       { fontSize: 11.5, color: TEXT_1, fontWeight: '600' },
  historyNote:       { fontSize: 11, color: TEXT_2, marginTop: 2, lineHeight: 15 },
});

// Adaptive Practice Recommendations subsection wrapper (inside the same
// "Teacher Recommendations" SectionCard as the general recommendations —
// Step 4 spec §1/§3, never a separate top-level section).
const arp = StyleSheet.create({
  divider:     { height: 1, backgroundColor: DIVIDER, marginVertical: 16 },
  subHeader:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  subTitle:    { fontSize: 13, fontWeight: '800', color: TEXT_1, letterSpacing: 0.1 },
  subSubtitle: { fontSize: 11.5, color: TEXT_3, lineHeight: 16, marginBottom: 12 },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  loadingText: { fontSize: 12, color: TEXT_3 },
  errorText:   { fontSize: 12, color: TEXT_2, lineHeight: 18 },
  emptyText:   { fontSize: 12, color: TEXT_3, lineHeight: 18 },
});

// ─── Motor Difficulty Analysis card ──────────────────────────────────────────

function MotorDifficultyCard({ analysis }) {
  const [showExercises, setShowExercises] = useState(false);
  if (!analysis) return null;

  const isGood  = analysis.noIssueDetected;
  const noData  = analysis.noDataAvailable;
  const color   = analysis.color   ?? '#7C3AED';
  const bgColor = analysis.bgColor ?? '#F5F3FF';

  return (
    <SectionCard title="Motor Difficulty Analysis" icon="analytics" accentColor={color}>
      {noData ? (
        <Empty message="Complete the shape assessment to see difficulty analysis" />
      ) : (
        <View style={{ gap: 16 }}>

          {/* Difficulty banner */}
          <View style={[mda.banner, { backgroundColor: bgColor, borderColor: color + '40' }]}>
            <View style={[mda.bannerIcon, { backgroundColor: color + '20' }]}>
              <Ionicons name={analysis.icon ?? 'analytics-outline'} size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mda.bannerTitle, { color }]}>{analysis.difficulty}</Text>
              <Text style={mda.bannerDesc}>{analysis.description}</Text>
            </View>
            {/* This number is a weighted sum of how far the configured rule
                conditions were exceeded — NOT a probability, a likelihood or
                a percentage of anything. It is therefore shown as a bare
                value with an "Activation" label: never a "%" and never the
                word "match" or "confidence". */}
            {analysis.confidence != null && (
              <View style={[mda.confBadge, { backgroundColor: color + '18' }]}>
                <Text style={[mda.confNum, { color }]}>{analysis.confidence}</Text>
                <Text style={[mda.confLabel, { color }]}>Activation</Text>
              </View>
            )}
          </View>

          {/* Secondary difficulty */}
          {analysis.secondaryDifficulty && (
            <View style={mda.secondary}>
              <Ionicons name="git-branch-outline" size={12} color={TEXT_3} />
              <Text style={mda.secondaryText}>
                Also present: {analysis.secondaryDifficulty.label} (rule activation {analysis.secondaryDifficulty.confidence})
              </Text>
            </View>
          )}

          {/* Contribution chart */}
          {!isGood && analysis.featureContributions?.length > 0 && (
            <View>
              <Text style={mda.sectionLabel}>Contributing Factors</Text>
              <ContributionChart contributions={analysis.featureContributions} accentColor={color} />
            </View>
          )}

          {/* Explanation */}
          {analysis.explanation?.length > 0 && (
            <View style={{ gap: 7 }}>
              <Text style={mda.sectionLabel}>Why was this detected?</Text>
              {analysis.explanation.map((line, i) => (
                <View key={i} style={mda.expRow}>
                  <View style={[mda.expDot, { backgroundColor: color }]} />
                  <Text style={mda.expText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Rule condition trace — server-derived, collapsed by default.
              Renders ONLY when the backend supplied conditionTraces; the
              local offline engine does not produce them (see thresholdTrace.js
              header), in which case the panel is simply absent. */}
          {analysis.conditionTraces?.length > 0 && (
            <ConditionTracePanel traces={analysis.conditionTraces} />
          )}

          {/* Letter focus */}
          {!isGood && analysis.letterFocus?.length > 0 && (
            <View>
              <Text style={mda.sectionLabel}>Suggested Focus Letters</Text>
              <View style={mda.letterRow}>
                {analysis.letterFocus.map(l => (
                  <View key={l} style={[mda.letterChip, { borderColor: color, backgroundColor: bgColor }]}>
                    <Text style={[mda.letterChipText, { color }]}>{l.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Exercises */}
          {analysis.exercises?.length > 0 && (
            <View>
              <TouchableOpacity onPress={() => setShowExercises(e => !e)} style={mda.exerciseToggle} activeOpacity={0.7}>
                <Ionicons name="fitness-outline" size={14} color={color} />
                <Text style={[mda.sectionLabel, { color, marginBottom: 0, flex: 1 }]}>Targeted Support Activities</Text>
                <Ionicons name={showExercises ? 'chevron-up' : 'chevron-down'} size={14} color={color} />
              </TouchableOpacity>
              {showExercises && (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {analysis.exercises.map((ex, i) => {
                    const pc = ex.priority === 'high' ? '#B91C1C' : ex.priority === 'medium' ? '#B45309' : '#15803D';
                    const pb = ex.priority === 'high' ? '#FEF2F2' : ex.priority === 'medium' ? '#FFFBEB' : '#F0FDF4';
                    return (
                      <View key={i} style={[mda.exRow, { backgroundColor: pb }]}>
                        <Ionicons name="checkmark-circle" size={16} color={pc} />
                        <Text style={mda.exText}>{ex.text}</Text>
                        <View style={[mda.exPill, { backgroundColor: pc + '22' }]}>
                          <Text style={[mda.exPillText, { color: pc }]}>{ex.priority}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </View>
      )}
    </SectionCard>
  );
}

const mda = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  bannerIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '900', marginBottom: 3 },
  bannerDesc:  { fontSize: 12, color: TEXT_2, lineHeight: 18 },
  confBadge:   { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 62 },
  confNum:     { fontSize: 20, fontWeight: '900' },
  confLabel:   { fontSize: 9, fontWeight: '700', opacity: 0.8 },

  secondary:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secondaryText: { fontSize: 11, color: TEXT_3, flex: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: TEXT_3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

  expRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  expDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  expText: { fontSize: 13, color: TEXT_2, lineHeight: 19, flex: 1 },

  letterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  letterChip: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  letterChipText: { fontSize: 15, fontWeight: '900' },

  exerciseToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  exText:     { flex: 1, fontSize: 12, color: TEXT_1, fontWeight: '500', lineHeight: 18 },
  exPill:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  exPillText: { fontSize: 10, fontWeight: '800' },
});

// ─── Rule condition trace ("Why this recommendation?") ─────────────────────
//
// Collapsed by default; the concise "Why was this detected?" list above stays
// the primary explanation. Shows the rule's own conditions — satisfied AND
// unsatisfied — with the observed value and the threshold each one compares
// against, so a teacher can see exactly why a factor did or did not count.
//
// Server-derived rule trace is authoritative. Internal identifiers
// (condition_id, rule_id) are deliberately NOT rendered. No ML/XAI attribution
// terminology, no probability or confidence wording.

function ConditionTracePanel({ traces }) {
  const [open, setOpen] = useState(false);
  if (!traces || traces.length === 0) return null;

  return (
    <View style={ct.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={ct.btn} activeOpacity={0.7}>
        <Ionicons name="information-circle" size={15} color="#6366F1" />
        <Text style={ct.btnLabel}>Why this recommendation?</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#6366F1" />
      </TouchableOpacity>

      {open && (
        <View style={ct.panel}>
          <View style={[ct.row, ct.headRow]}>
            <Text style={[ct.cellFactor, ct.headText]}>Factor</Text>
            <Text style={[ct.cellNum, ct.headText]}>Observed</Text>
            <Text style={[ct.cellNum, ct.headText]}>Rule threshold</Text>
            <Text style={[ct.cellMet, ct.headText]}>Condition met?</Text>
          </View>

          {traces.map(t => (
            <View key={t.condition_id ?? t.feature} style={ct.row}>
              <Text style={ct.cellFactor}>{t.feature_label}</Text>
              <Text style={ct.cellNum}>{t.observed_value ?? '—'}</Text>
              <Text style={ct.cellNum}>Above {t.threshold}</Text>
              <Text style={[ct.cellMet, t.satisfied ? ct.metYes : ct.metNo]}>
                {t.satisfied ? 'Yes' : 'No'}
              </Text>
            </View>
          ))}

          {traces.filter(t => !t.satisfied).map(t => (
            <Text key={`x-${t.condition_id ?? t.feature}`} style={ct.note}>
              {t.feature_label} was {t.observed_value ?? '—'}. This rule condition contributes only
              when the value is above {t.threshold}.
            </Text>
          ))}

          <Text style={ct.disclosure}>
            This summarizes how strongly the configured rule conditions were activated.
            It is not a probability.
          </Text>
        </View>
      )}
    </View>
  );
}

const ct = StyleSheet.create({
  wrap:     { marginTop: 4 },
  btn:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  btnLabel: { fontSize: 12, color: '#6366F1', fontWeight: '700' },
  panel: {
    marginTop: 8, backgroundColor: '#EEF2FF', borderRadius: 12,
    padding: 12, borderLeftWidth: 3, borderLeftColor: '#6366F1', gap: 6,
  },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headRow:    { borderBottomWidth: 1, borderBottomColor: '#C7D2FE', paddingBottom: 5, marginBottom: 2 },
  headText:   { fontSize: 9.5, fontWeight: '800', color: '#4338CA', textTransform: 'uppercase' },
  cellFactor: { flex: 2.2, fontSize: 11.5, color: TEXT_1, fontWeight: '600' },
  cellNum:    { flex: 1.3, fontSize: 11.5, color: TEXT_2, textAlign: 'right' },
  cellMet:    { flex: 1.2, fontSize: 11.5, textAlign: 'right', fontWeight: '700' },
  metYes:     { color: TEXT_1 },
  metNo:      { color: TEXT_3 },
  note:       { fontSize: 11, color: TEXT_2, lineHeight: 16, marginTop: 2 },
  disclosure: { fontSize: 10, color: TEXT_3, lineHeight: 14, fontStyle: 'italic', marginTop: 4 },
});

// ─── Initial Motor Baseline Summary ────────────────────────────────────────
//
// Read-only presentation of GET /handwriting/motor-baseline/:studentId. The
// card prioritises the actual measured values — overall score first, then
// the three movement-family scores — followed by the backend's neutral,
// deterministic within-learner summary sentence and its disclosure.
//
// No ML and no clustering is involved: the legacy experimental L2
// shape-motor clustering is retained in the repository for
// research/reference compatibility only, is not used here, and does not
// influence adaptive progression. Nothing on this card may show a cluster
// id, centroid distance, Profile A/B, "Distinct Motor Profile", a
// probability, or a confidence figure.
//
// `description`/`disclosure` are rendered verbatim from the backend so the
// in-app wording and the exported report can never drift apart, and so the
// neutral-language rules live in exactly one place
// (auriva-backend/src/utils/initialMotorBaselineSummary.js).

const FAMILY_ROW_LABELS = [
  ['straight', 'Straight'],
  ['curved',   'Curved'],
  ['complex',  'Complex'],
];

function formatScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
}

function InitialMotorBaselineSummaryCard({ result }) {
  const { status, baseline, summary } = result;

  // Visible title only — aligned with the Periodic Report's own "Initial
  // Handwriting Skills Summary" card so the same screen does not show two
  // different names for baseline data. The component name, state, endpoint,
  // response keys and the internal Motor Score vocabulary are deliberately
  // unchanged.
  return (
    <SectionCard title="Initial Handwriting Skills Summary" icon="body" accentColor="#7C3AED">
      {status === 'loading' ? (
        <View style={f11.loadingRow}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={f11.loadingText}>Loading initial motor baseline…</Text>
        </View>
      ) : status === 'baseline_not_found' ? (
        <Empty message="Complete the initial motor assessment to see the baseline summary" />
      ) : status !== 'found' || !baseline ? (
        <Empty message="Initial motor baseline is temporarily unavailable" />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={imb.overallRow}>
            <Text style={imb.overallLabel}>Overall Motor Score</Text>
            <Text style={imb.overallValue}>{formatScore(baseline.overall)}</Text>
          </View>

          <View>
            <Text style={mda.sectionLabel}>Movement-family baseline</Text>
            <View style={{ gap: 6 }}>
              {FAMILY_ROW_LABELS.map(([key, label]) => (
                <View key={key} style={imb.familyRow}>
                  <Text style={imb.familyLabel}>{label}</Text>
                  <Text style={imb.familyValue}>{formatScore(baseline[key])}</Text>
                </View>
              ))}
            </View>
          </View>

          {summary?.description ? (
            <View>
              <Text style={mda.sectionLabel}>Summary</Text>
              <Text style={imb.summaryText}>{summary.description}</Text>
            </View>
          ) : null}

          <Text style={imb.disclosure}>
            {summary?.disclosure
              ?? 'These values summarize performance during the initial motor assessment and are '
                 + 'intended for educational monitoring. They are not diagnostic or ASD-severity measures.'}
          </Text>
        </View>
      )}
    </SectionCard>
  );
}

const imb = StyleSheet.create({
  overallRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: '#F5F3FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#7C3AED30',
  },
  overallLabel: { fontSize: 12.5, fontWeight: '800', color: '#5B21B6' },
  overallValue: { fontSize: 24, fontWeight: '900', color: '#5B21B6' },

  familyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  familyLabel: { fontSize: 12.5, fontWeight: '700', color: TEXT_1 },
  familyValue: { fontSize: 15, fontWeight: '800', color: TEXT_1 },

  summaryText: { fontSize: 12.5, color: TEXT_2, lineHeight: 19 },
  disclosure:  { fontSize: 10.5, color: TEXT_3, lineHeight: 15, fontStyle: 'italic' },
});

// ─── Feature 11B technical-details helper ──────────────────────────────────
//
// Technical-details text for the Feature 11B (L3) letter-motor state card.
// Kept UNCHANGED — it was originally written for the retired Feature 11A
// card and is shared by Feature 11B, which is explicitly out of scope for
// the baseline-summary change. Feature 11B still passes its own
// modelVersion + geometric debug values through it; the profileCode branch
// is simply never taken from that call site.
//
// Deliberately defined ABOVE the Feature 11B section header below so the
// existing Feature 11B source-text guarantees (which assert that the 11B
// card's own code never contains the word "confidence") keep measuring the
// card itself, exactly as they did before this refactor.
function buildMotorClusterDebugText(profile, debug) {
  if (!profile && !debug) return null;
  const lines = [];
  if (profile?.profileCode)  lines.push(`Profile code: ${profile.profileCode}`);
  if (profile?.modelVersion) lines.push(`Model version: ${profile.modelVersion}`);
  if (debug?.clusterId != null) lines.push(`Cluster ID: ${debug.clusterId}`);
  if (debug?.nearestDistance != null) lines.push(`Nearest centroid distance: ${debug.nearestDistance.toFixed(3)}`);
  if (debug?.secondNearestDistance != null) lines.push(`Second-nearest centroid distance: ${debug.secondNearestDistance.toFixed(3)}`);
  if (debug?.separationMargin != null) lines.push(`Separation margin: ${debug.separationMargin.toFixed(3)}`);
  lines.push('These are geometric distances in the model\'s feature space — not a confidence, accuracy, or probability score.');
  return lines.join('\n');
}

// ─── Feature 11B — Letter Motor Development ────────────────────────────────
//
// Read-only presentation of the 3 Phase 5 endpoints (latest state, state
// history, mastery-evidence trend). Before the first eligible 14/20
// milestone this shows evidence-accumulation trends only — NEVER a
// State A/B (spec §1/§8). After 14/20, shows the current persisted state
// plus a compact chronological history. State A/B is rendered exactly as
// the backend's own display_name — never translated to good/bad/high/low
// (spec §6). DTW/speed_cv captions clarify "lower = better match/more
// consistent" as informational text only, never a red/green color (spec
// §11). Coverage is shown as an evidence count, never a fabricated
// "confidence %" (spec §12). nearest/second-nearest/separation are never
// shown in the main card (spec §13).

function CoverageBadge({ coverageN }) {
  return (
    <View style={f11.coverageBadge}>
      <Text style={f11.coverageNum}>{coverageN ?? 0}</Text>
      <Text style={f11.coverageDenom}>/ 20 reference letters</Text>
    </View>
  );
}

function LetterMotorMetricTiles({ smoothness, dtw, speedCv }) {
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');
  return (
    <View>
      <View style={s.metricsRow}>
        <MetricTile icon="analytics-outline"  label={METRIC_LABELS.smoothness.label} value={fmt(smoothness)} />
        <MetricTile icon="git-compare-outline" label={METRIC_LABELS.dtw.label}        value={fmt(dtw)} />
        <MetricTile icon="speedometer-outline" label={METRIC_LABELS.speedCv.label}    value={fmt(speedCv)} />
      </View>
      <Text style={f11.metricCaption}>{METRIC_LABELS.dtw.caption} · {METRIC_LABELS.speedCv.caption}</Text>
    </View>
  );
}

function LetterMotorHistoryList({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={mda.sectionLabel}>Milestone History</Text>
      {history.map(row => (
        <View key={row.id ?? row.milestone} style={f11.historyRow}>
          <View style={{ flex: 1 }}>
            <Text style={f11.historyMilestone}>{row.milestoneLabel}</Text>
            <Text style={f11.historyMeta}>{row.coverageN} / 20 · {row.patternLabel}</Text>
          </View>
          <Text style={f11.historyDate}>{formatReviewDate(row.observedAt) || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Homework Practice ────────────────────────────────────────────────────
//
// Turns an approved adaptive practice recommendation into a printable
// worksheet, then accepts the completed paper back for the teacher to read.
//
// Every action here is behind the same ParentGateModal the rest of this screen
// uses. Nothing in this card changes mastery, Motor Score, thresholds, the
// practice sequence, word unlock, or the Letter Motor Pattern — and an
// uploaded photo is stored and shown, never analysed or scored.
function HomeworkPracticeCard({ student, theme, candidates, history, onChanged }) {
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [intensity, setIntensity] = useState('standard');
  const [note, setNote] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [previewMessage, setPreviewMessage] = useState(null);
  const [reviewChoice, setReviewChoice] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  // A history row the teacher asked to view/reprint. Held in state so the gate
  // confirms before the historical sheet is rendered.
  const [reprintTarget, setReprintTarget] = useState(null);

  const loading = candidates.status === 'loading' || history.status === 'loading';
  const active = history.active ?? null;
  const worksheets = history.worksheets ?? [];
  // The recommendation to act on: the first persistent stream that does not
  // already have a live worksheet out.
  const recommendation = (candidates.candidates ?? []).find((c) => !c.alreadyAssigned) ?? null;
  const targetLetter = selectedLetter ?? recommendation?.suggestedLetter ?? null;

  const latestSubmission = active && Array.isArray(active.submissions) && active.submissions.length > 0
    ? active.submissions[0] : null;

  // Every teacher action runs behind the gate. One hook per action so each
  // button opens the gate for its own effect only.
  function gatedAction(fn) { return fn; }

  async function runGuarded(fn) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await fn(); } finally { setBusy(false); }
  }

  const doGenerate = () => runGuarded(async () => {
    if (!targetLetter || !recommendation) return;
    const res = await apiGenerateWorksheet({
      studentId: student?.sid,
      targetLetter,
      caseType: recommendation.caseType,
      motorFamily: recommendation.family,
      intensity,
      teacherNote: note.trim() || null,
      recommendationFingerprint: recommendation.recommendationFingerprint,
    });
    if (res.status === 'created') {
      setMessage('Worksheet created.');
      setNote(''); setSelectedLetter(null);
      onChanged();
    } else if (res.status === 'already_assigned') {
      setMessage(ALREADY_ASSIGNED_TEXT);
      onChanged();
    } else if (res.status === 'unmapped_letter') {
      setMessage(UNMAPPED_LETTER_TEXT);
    } else {
      setMessage('The worksheet could not be created. Please try again.');
    }
  });

  /**
   * Renders a worksheet and opens the real preview modal.
   *
   * `markAssigned` is false for a REPRINT from history: reprinting is
   * read-only and must not touch assigned_at, status, or anything else about
   * the original assignment.
   *
   * The worksheet is passed through so the renderer uses its OWN frozen plan —
   * a reprint reproduces the sheet the child was given, never a sheet the
   * current mapping would produce today.
   */
  const doPreview = (worksheet, { markAssigned = true } = {}) => runGuarded(async () => {
    if (!worksheet) { setMessage('That worksheet could not be opened.'); return; }
    const res = await generateWorksheetPdf({ student, worksheet, plan: null });
    if (res.status !== 'ok' || !res.fileUri || !res.html) {
      setMessage('The worksheet could not be prepared for printing.');
      return;
    }
    // The worksheet travels with the preview so a share names the sheet that
    // is actually on screen — including a historical reprint.
    setPreview({ uri: res.fileUri, filename: res.filename, html: res.html, worksheet });
    if (markAssigned) {
      // Producing the printable sheet for the FIRST time is what hands it out.
      await apiAssignWorksheet(worksheet.id, null);
      onChanged();
    }
  });

  /**
   * Shares the previewed worksheet. Worksheet wording throughout — a teacher
   * printing a practice sheet should never see report language.
   *
   * Read-only: sharing sends the already-rendered file and writes nothing.
   */
  const doSharePreview = async () => {
    if (!preview?.uri) { setPreviewMessage('There is no worksheet to share.'); return; }
    setSharing(true); setPreviewMessage(null);
    try {
      const res = await shareWorksheetPdf({
        fileUri: preview.uri, worksheet: preview.worksheet, student,
      });
      // A cancelled share is normal use, and says nothing to the teacher.
      if (res.status === 'sharing_unavailable') {
        setPreviewMessage('Sharing is not available on this device.');
      } else if (res.status === 'failed') {
        // Never surfaces a raw native error string to a teacher.
        setPreviewMessage('The worksheet could not be shared.');
      }
    } catch (err) {
      setPreviewMessage('The worksheet could not be shared.');
    } finally {
      setSharing(false);
    }
  };

  // Closing is always safe and always re-openable — nothing is torn down.
  const closePreview = () => { setPreview(null); setPreviewMessage(null); };

  const doUpload = (worksheet, fromCamera) => runGuarded(async () => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm?.granted) {
        setMessage(fromCamera
          ? 'Camera access is needed to photograph the worksheet.'
          : 'Photo access is needed to choose a worksheet image.');
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
          });
      if (result?.canceled) return;   // cancelling is not an error
      const asset = result?.assets?.[0];
      if (!asset?.uri) { setMessage('That file could not be used. Please try another.'); return; }

      const res = await apiSubmitWorksheet(worksheet.id, {
        uri: asset.uri,
        name: asset.fileName ?? `worksheet-${worksheet.worksheet_code}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      }, 'photo');
      if (res.status === 'submitted') {
        setMessage('Worksheet submitted for teacher review.');
        onChanged();
      } else {
        setMessage(res.message ?? 'The worksheet could not be uploaded. Please try again.');
      }
    } catch (err) {
      // A picker or upload failure must never take the report screen down.
      setMessage('The worksheet could not be uploaded. Please try again.');
    }
  });

  const doReview = (submission) => runGuarded(async () => {
    const option = REVIEW_OPTIONS.find((o) => o.key === reviewChoice);
    if (!option) { setMessage('Please choose a review option.'); return; }
    const res = await apiReviewSubmission(submission.id, option.status, reviewComment.trim() || null);
    if (res.status === 'reviewed') {
      setMessage('Review saved.');
      setReviewChoice(null); setReviewComment('');
      onChanged();
    } else {
      setMessage('The review could not be saved. Please try again.');
    }
  });

  // One gate per action, all using the shared ParentGateModal mechanism.
  const gGenerate = useGatedBack(doGenerate);
  const gPreview  = useGatedBack(() => active && doPreview(active));
  const gCamera   = useGatedBack(() => active && doUpload(active, true));
  const gGallery  = useGatedBack(() => active && doUpload(active, false));
  const gReview   = useGatedBack(() => latestSubmission && doReview(latestSubmission));
  const gReprint  = useGatedBack(() => reprintTarget && doPreview(reprintTarget, { markAssigned: false }));

  // Opening the gate is what a history "View" tap does; the render happens on
  // confirmation.
  useEffect(() => {
    if (reprintTarget) gReprint.requestBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprintTarget]);

  if (loading) {
    return (
      <SectionCard title="Homework Practice" icon="document-text-outline" accentColor="#7C3AED">
        <View style={f11.loadingRow}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={f11.loadingText}>Loading homework practice…</Text>
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Homework Practice" icon="document-text-outline" accentColor="#7C3AED">
      <View style={{ gap: 14 }}>

        {/* ── A. Current recommendation ──
            Two sources land here. The exact-letter one (two failed cycles on
            one practice date) is titled "Additional Home Practice" and shows
            the letter's mastery status; the family-level
            one (from the broader family-level analysis) keeps its existing
            presentation. Neither ever shows a cycle count, a threshold, a
            score or an internal identifier. */}
        {!active && recommendation && !dismissed ? (
          <View>
            <Text style={mda.sectionLabel}>
              {isTwoCycleCandidate(recommendation) ? TWO_CYCLE_SECTION_LABEL : 'Homework Recommendation'}
            </Text>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Letter</Text>
              <Text style={hw.rowValueBig}>{targetLetter ?? '—'}</Text>
            </View>
            {isTwoCycleCandidate(recommendation) ? (
              <View style={hw.row}>
                <Text style={hw.rowLabel}>Status</Text>
                <Text style={hw.rowValue}>{TWO_CYCLE_STATUS_LABEL}</Text>
              </View>
            ) : null}
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Reason</Text>
              <Text style={hw.rowValue}>{recommendation.rationale}</Text>
            </View>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Suggested Practice</Text>
              <Text style={hw.rowValue}>{PRACTICE_SEQUENCE_TEXT}</Text>
            </View>

            {/* Target override — only letters this recommendation actually
                names. An unrelated letter is never offered. */}
            {(recommendation.candidateLetters ?? []).length > 1 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={hw.rowLabel}>Other affected letters</Text>
                <View style={hw.chipRow}>
                  {recommendation.candidateLetters.map((c) => (
                    <TouchableOpacity
                      key={c.letter}
                      style={[hw.chip, targetLetter === c.letter && hw.chipOn]}
                      onPress={() => setSelectedLetter(c.letter)}
                      accessibilityLabel={`Choose letter ${c.letter}`}
                    >
                      <Text style={[hw.chipText, targetLetter === c.letter && hw.chipTextOn]}>{c.letter}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Practice type — neutral support levels, never a difficulty grade. */}
            <View style={{ marginTop: 8 }}>
              <Text style={hw.rowLabel}>Practice Type</Text>
              <View style={hw.chipRow}>
                {INTENSITY_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[hw.chip, intensity === o.key && hw.chipOn]}
                    onPress={() => setIntensity(o.key)}
                    accessibilityLabel={o.label}
                  >
                    <Text style={[hw.chipText, intensity === o.key && hw.chipTextOn]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={hw.rowLabel}>Teacher Note (optional)</Text>
              <TextInput
                style={hw.input}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Please practise slowly and focus on the curved movement."
                placeholderTextColor="#94A3B8"
                multiline
                accessibilityLabel="Teacher note"
              />
            </View>

            <View style={hw.btnRow}>
              <TouchableOpacity
                style={[hw.primaryBtn, busy && hw.btnDisabled]}
                onPress={gGenerate.requestBack}
                disabled={busy}
                accessibilityLabel="Generate worksheet — needs a code"
              >
                <Text style={hw.primaryBtnText}>Generate Worksheet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={hw.secondaryBtn}
                onPress={() => setDismissed(true)}
                accessibilityLabel="Dismiss recommendation"
              >
                <Text style={hw.secondaryBtnText}>
                  {isTwoCycleCandidate(recommendation) ? TWO_CYCLE_DEFER_LABEL : 'Dismiss'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!active && (!recommendation || dismissed) ? (
          <Text style={f11.patternCaption}>{EMPTY_NO_RECOMMENDATION}</Text>
        ) : null}

        {/* ── B. Active worksheet ── */}
        {active ? (
          <View>
            <Text style={mda.sectionLabel}>Active Homework Worksheet</Text>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Target Letter</Text>
              <Text style={hw.rowValueBig}>{active.target_letter}</Text>
            </View>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Practice Type</Text>
              <Text style={hw.rowValue}>{getIntensityLabel(active.worksheet_intensity)}</Text>
            </View>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Assigned</Text>
              <Text style={hw.rowValue}>
                {formatWorksheetDate(active.assigned_at ?? active.generated_at) || 'Not available'}
              </Text>
            </View>
            <View style={hw.row}>
              <Text style={hw.rowLabel}>Status</Text>
              <Text style={hw.rowValue}>{getWorksheetStatusLine(active)}</Text>
            </View>

            <View style={hw.btnRow}>
              <TouchableOpacity
                style={[hw.primaryBtn, busy && hw.btnDisabled]}
                onPress={gPreview.requestBack}
                disabled={busy}
                accessibilityLabel="Preview and print worksheet — needs a code"
              >
                <Text style={hw.primaryBtnText}>Preview / Print</Text>
              </TouchableOpacity>
            </View>

            {active.status === 'submitted' && latestSubmission ? (
              <Text style={f11.patternCaption}>{PENDING_REVIEW_TEXT}</Text>
            ) : (
              <>
                <Text style={hw.rowLabel}>Upload Completed Worksheet</Text>
                <View style={hw.btnRow}>
                  <TouchableOpacity
                    style={[hw.secondaryBtn, busy && hw.btnDisabled]}
                    onPress={gCamera.requestBack}
                    disabled={busy}
                    accessibilityLabel="Take photo of completed worksheet — needs a code"
                  >
                    <Text style={hw.secondaryBtnText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[hw.secondaryBtn, busy && hw.btnDisabled]}
                    onPress={gGallery.requestBack}
                    disabled={busy}
                    accessibilityLabel="Choose worksheet image from gallery — needs a code"
                  >
                    <Text style={hw.secondaryBtnText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── D. Teacher review of a returned worksheet ── */}
            {latestSubmission && latestSubmission.review_status === 'pending_review' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={mda.sectionLabel}>Teacher Review</Text>
                {REVIEW_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={hw.radioRow}
                    onPress={() => setReviewChoice(o.key)}
                    accessibilityLabel={o.label}
                  >
                    <View style={[hw.radio, reviewChoice === o.key && hw.radioOn]} />
                    <Text style={hw.radioText}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={hw.input}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Teacher comment (optional)"
                  placeholderTextColor="#94A3B8"
                  multiline
                  accessibilityLabel="Teacher comment"
                />
                <TouchableOpacity
                  style={[hw.primaryBtn, busy && hw.btnDisabled]}
                  onPress={gReview.requestBack}
                  disabled={busy}
                  accessibilityLabel="Save review — needs a code"
                >
                  <Text style={hw.primaryBtnText}>Save Review</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── C. History — ONE card per worksheet, newest first ── */}
        <View>
          <Text style={mda.sectionLabel}>Worksheet History</Text>
          {worksheets.length === 0 ? (
            <Text style={f11.patternCaption}>{EMPTY_NO_HISTORY}</Text>
          ) : (
            worksheets.map((w) => (
              <View key={w.id} style={f11.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={f11.historyMilestone}>
                    {w.target_letter} · {getIntensityLabel(w.worksheet_intensity)}
                  </Text>
                  <Text style={f11.historyMeta}>{getWorksheetStatusLine(w)}</Text>
                </View>
                <Text style={f11.historyDate}>
                  {formatWorksheetDate(w.assigned_at ?? w.generated_at) || '—'}
                </Text>
                {/* Reprint is READ-ONLY: it renders from the worksheet's frozen
                    plan and changes no date, status or review. */}
                <TouchableOpacity
                  style={hw.linkBtn}
                  onPress={() => setReprintTarget(w)}
                  accessibilityLabel={`View worksheet for ${w.target_letter} — needs a code`}
                >
                  <Text style={hw.linkBtnText}>View</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          {worksheets.length > 0 && !worksheets.some((w) => (w.submissions ?? []).length > 0) ? (
            <Text style={f11.patternCaption}>{EMPTY_NO_SUBMISSION}</Text>
          ) : null}
        </View>

        {message ? <Text style={hw.message}>{message}</Text> : null}

        <Text style={f11.patternCaption}>{WORKSHEET_SUPPORTING_TEXT}</Text>
      </View>

      {/* Real preview, reusing the report PDF preview + share modal. */}
      <ReportPreviewModal
        title="Writing Practice Worksheet"
        visible={!!preview}
        html={preview?.html ?? null}
        filename={preview?.filename ?? null}
        sharing={sharing}
        message={previewMessage}
        onShare={doSharePreview}
        onClose={closePreview}
      />

      {gGenerate.gateModal}
      {gPreview.gateModal}
      {gReprint.gateModal}
      {gCamera.gateModal}
      {gGallery.gateModal}
      {gReview.gateModal}
    </SectionCard>
  );
}

const hw = StyleSheet.create({
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, gap: 12 },
  rowLabel:     { fontSize: 13, color: '#64748B', flex: 1 },
  rowValue:     { fontSize: 13, fontWeight: '600', color: '#0F172A', textAlign: 'right', flex: 1.4 },
  rowValueBig:  { fontSize: 20, fontWeight: '700', color: '#0F172A', textAlign: 'right', flex: 1.4 },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  chip:         { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1' },
  chipOn:       { backgroundColor: '#7C3AED14', borderColor: '#7C3AED' },
  chipText:     { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextOn:   { color: '#7C3AED' },
  input:        { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 9, minHeight: 58,
                  fontSize: 13, color: '#0F172A', marginTop: 5, textAlignVertical: 'top' },
  btnRow:       { flexDirection: 'row', gap: 9, marginTop: 10, flexWrap: 'wrap' },
  primaryBtn:   { flexGrow: 1, backgroundColor: '#7C3AED', borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { flexGrow: 1, borderWidth: 1, borderColor: '#7C3AED', borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  secondaryBtnText:{ color: '#7C3AED', fontSize: 14, fontWeight: '700' },
  btnDisabled:  { opacity: 0.5 },
  radioRow:     { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  radio:        { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#94A3B8' },
  radioOn:      { borderColor: '#7C3AED', backgroundColor: '#7C3AED' },
  radioText:    { fontSize: 13, color: '#0F172A' },
  linkBtn:      { paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  linkBtnText:  { fontSize: 12.5, color: '#7C3AED', fontWeight: '700' },
  message:      { fontSize: 12.5, color: '#7C3AED', fontWeight: '600', marginTop: 4 },
});

// ─── Writing Check history ────────────────────────────────────────────────
//
// The dedicated, teacher-initiated route for the frozen letter motor pattern
// model, kept visually separate from the legacy 14/17/20 milestone card above.
//
// Rendered as a dated LIST, never a chart. Pattern A and Pattern B are NOMINAL
// categories, so a line or bar over time would falsely suggest they are ordinal
// — there are deliberately no arrows, no colour coding, no green/red, and no
// improvement/decline wording anywhere below. Each check is an independent
// descriptive observation.
//
// Only EVALUATED checks appear in history; an in-progress check is never shown
// as a completed result. Cluster ids, model versions and OOD diagnostics stay
// internal and are never rendered.
function WritingCheckHistoryCard({ result, student, theme, navigation }) {
  // Starting a Writing Check leaves the teacher report for a child activity, so
  // it goes through the SAME ParentGateModal every other teacher-facing action
  // on this screen uses — no new authentication concept.
  const { requestBack: requestStartCheck, gateModal } = useGatedBack(
    () => navigation.navigate('WritingCheck', { student, theme })
  );

  if (result.status === 'loading') {
    return (
      <SectionCard title="Writing Check" icon="create-outline" accentColor="#0891B2">
        <View style={f11.loadingRow}>
          <ActivityIndicator size="small" color="#0891B2" />
          <Text style={f11.loadingText}>Loading Writing Checks…</Text>
        </View>
      </SectionCard>
    );
  }
  if (result.status !== 'found') {
    return (
      <SectionCard title="Writing Check" icon="create-outline" accentColor="#0891B2">
        <Empty message="Writing Check information could not be loaded at this time." />
        {gateModal}
      </SectionCard>
    );
  }

  const checks = result.checks ?? [];
  // Only evaluated checks are real results. An in-progress one drives the
  // Start/Resume label instead of appearing as a completed history entry.
  const evaluated = checks.filter((c) => c.status === 'evaluated');
  const inProgress = checks.find((c) => c.status === 'in_progress') ?? null;
  const failed = checks.find((c) => c.status === 'evaluation_failed') ?? null;
  const latest = evaluated[0] ?? null;
  const latestPresentation = latest ? getWritingCheckPresentation(latest) : null;

  const supportingText = latest
    ? (latest.evaluation_status === 'outside_reference_range'
        ? 'The available handwriting evidence differs from the data represented by the '
          + 'current pattern model, so no writing pattern was assigned.'
        : 'Writing patterns describe movement characteristics only and do not indicate '
          + 'ability, ASD severity, or improvement.')
    : 'A Writing Check has not yet been completed.';

  return (
    <SectionCard title="Writing Check" icon="create-outline" accentColor="#0891B2">
      <View style={{ gap: 12 }}>
        <View>
          <Text style={mda.sectionLabel}>Latest Writing Check</Text>
          {latest ? (
            <>
              <View style={wc.row}>
                <Text style={wc.rowLabel}>Date</Text>
                <Text style={wc.rowValue}>{formatReviewDate(latest.observed_at) || '—'}</Text>
              </View>
              <View style={wc.row}>
                <Text style={wc.rowLabel}>Current Writing Pattern</Text>
                <Text style={wc.rowValue}>{latestPresentation.patternValue}</Text>
              </View>
              <View style={wc.row}>
                <Text style={wc.rowLabel}>Reference Status</Text>
                <Text style={wc.rowValue}>{latestPresentation.referenceStatus}</Text>
              </View>
            </>
          ) : (
            <View style={wc.row}>
              <Text style={wc.rowLabel}>Latest Writing Check</Text>
              <Text style={wc.rowValue}>Not yet available</Text>
            </View>
          )}
          <Text style={f11.patternCaption}>{supportingText}</Text>
          {failed && !latest ? (
            <Text style={f11.patternCaption}>
              The Writing Check was completed, but pattern information could not be evaluated at this time.
            </Text>
          ) : null}
        </View>

        {evaluated.length > 1 ? (
          <View>
            <Text style={mda.sectionLabel}>Writing Check History</Text>
            {evaluated.map((c) => {
              const p = getWritingCheckPresentation(c);
              return (
                <View key={c.id} style={f11.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={f11.historyMilestone}>{p.patternValue}</Text>
                    <Text style={f11.historyMeta}>{p.referenceStatus}</Text>
                  </View>
                  <Text style={f11.historyDate}>{formatReviewDate(c.observed_at) || '—'}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <TouchableOpacity
          style={[wc.startBtn, { borderColor: '#0891B2' }]}
          onPress={requestStartCheck}
          activeOpacity={0.8}
          accessibilityLabel={inProgress ? 'Resume Writing Check — needs a code' : 'Start Writing Check — needs a code'}
        >
          <Ionicons name="create-outline" size={15} color="#0891B2" />
          <Text style={wc.startBtnText}>
            {inProgress ? 'Resume Writing Check' : 'Start Writing Check'}
          </Text>
        </TouchableOpacity>
      </View>
      {gateModal}
    </SectionCard>
  );
}

const wc = StyleSheet.create({
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowLabel:    { fontSize: 13, color: '#64748B', flex: 1 },
  rowValue:    { fontSize: 13, fontWeight: '600', color: '#0F172A', textAlign: 'right', flex: 1 },
  startBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                 borderWidth: 1, borderRadius: 10, paddingVertical: 11, marginTop: 2 },
  startBtnText:{ fontSize: 14, fontWeight: '700', color: '#0891B2' },
});

function LetterMotorDevelopmentCard({ latest, history, trend, evaluations }) {
  const anyLoading = latest.status === 'loading' || history.status === 'loading'
    || trend.status === 'loading' || evaluations?.status === 'loading';

  if (anyLoading) {
    return (
      <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
        <View style={f11.loadingRow}>
          <ActivityIndicator size="small" color="#0891B2" />
          <Text style={f11.loadingText}>Loading letter motor patterns…</Text>
        </View>
      </SectionCard>
    );
  }

  if (latest.status === 'unavailable') {
    return (
      <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
        <Empty message="Letter motor pattern data is temporarily unavailable" />
      </SectionCard>
    );
  }

  // latest.status === 'found' — a persisted state exists (14/20 or later).
  if (latest.status === 'found') {
    const currentState = latest.state;
    return (
      <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
        <View style={{ gap: 14 }}>
          <View style={[mda.banner, { backgroundColor: '#ECFEFF', borderColor: '#0891B240' }]}>
            <View style={[mda.bannerIcon, { backgroundColor: '#0891B220' }]}>
              <Ionicons name="trending-up-outline" size={20} color="#0891B2" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f11.currentLabel}>Current Letter Motor Pattern</Text>
              <Text style={[mda.bannerTitle, { color: '#0891B2' }]}>{currentState.patternLabel}</Text>
              <Text style={mda.bannerDesc}>
                Milestone: {currentState.milestoneLabel} · Last updated {formatReviewDate(currentState.observedAt) || '—'}
              </Text>
            </View>
          </View>

          {/* Always rendered next to a pattern label so the label can never
              be read as a ranking, a severity level or a stage. */}
          <Text style={f11.patternCaption}>{LETTER_MOTOR_PATTERN_CAPTION}</Text>

          <CoverageBadge coverageN={currentState.coverageN} />

          <View>
            <Text style={mda.sectionLabel}>Supporting Measurements</Text>
            <LetterMotorMetricTiles smoothness={currentState.smoothnessScore} dtw={currentState.dtwDistance} speedCv={currentState.speedCv} />
          </View>

          <LetterMotorHistoryList history={history.history} />

          <WhyPanel
            label="Technical details"
            explanation={buildMotorClusterDebugText(
              { profileCode: null, modelVersion: currentState.modelVersion },
              currentState.debug
            )}
          />
        </View>
      </SectionCard>
    );
  }

  // latest.status === 'not_found' — no pattern is persisted. S2 replaced the
  // previous coverage>=20 HEURISTIC with the real persisted fact: a
  // reference-range rejection now writes a letter_motor_state_evaluations
  // row, so this branch reads what actually happened instead of inferring it
  // from how much evidence exists.
  //
  // The old heuristic was conservative but wrong in both directions: a
  // student rejected at the 14 milestone showed "still accumulating" until
  // they reached 20, and a student who simply had 20 letters of evidence
  // without any milestone ever being evaluated would have been described as
  // rejected. Neither can happen now.
  //
  // NEVER shows a pattern label in any branch below.
  const evaluationStatus = resolveLetterMotorEvaluationStatus(latest, evaluations);
  const rejectedEvaluation = evaluations?.latest ?? null;

  if (evaluationStatus === 'unavailable') {
    return (
      <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
        <Empty message="Writing pattern information could not be evaluated at this time." />
      </SectionCard>
    );
  }

  if (evaluationStatus === 'outside_reference_range') {
    return (
      <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
        <View style={{ gap: 14 }}>
          <View style={f11.notReportedBanner}>
            <Ionicons name="remove-circle-outline" size={18} color={TEXT_3} />
            <View style={{ flex: 1 }}>
              <Text style={f11.notReportedTitle}>Letter motor pattern not reported</Text>
              <Text style={f11.notReportedText}>
                The available handwriting evidence differs from the data represented by the
                current pattern model, so no writing pattern was assigned.
              </Text>
              {rejectedEvaluation?.milestone ? (
                <Text style={f11.notReportedText}>
                  Evaluated at milestone {rejectedEvaluation.milestone} on{' '}
                  {formatReviewDate(rejectedEvaluation.observed_at) || '—'}.
                </Text>
              ) : null}
            </View>
          </View>

          <CoverageBadge coverageN={trend.coverageN} />

          <View>
            <Text style={mda.sectionLabel}>Current Cumulative Trends</Text>
            <LetterMotorMetricTiles smoothness={trend.meanSmoothness} dtw={trend.meanDtw} speedCv={trend.meanSpeedCv} />
          </View>

          <LetterMotorHistoryList history={history.history} />
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Letter Motor Patterns" icon="trending-up" accentColor="#0891B2">
      <View style={{ gap: 14 }}>
        <View style={f11.accumulatingBanner}>
          <Ionicons name="hourglass-outline" size={18} color="#0891B2" />
          <Text style={f11.accumulatingText}>
            More eligible handwriting evidence is needed before a writing pattern can be described.
          </Text>
        </View>

        <CoverageBadge coverageN={trend.coverageN} />

        {trend.coverageN > 0 && (
          <View>
            <Text style={mda.sectionLabel}>Current Cumulative Trends</Text>
            <LetterMotorMetricTiles smoothness={trend.meanSmoothness} dtw={trend.meanDtw} speedCv={trend.meanSpeedCv} />
          </View>
        )}

        <LetterMotorHistoryList history={history.history} />
      </View>
    </SectionCard>
  );
}

const f11 = StyleSheet.create({
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  loadingText: { fontSize: 12, color: TEXT_3, fontWeight: '600' },

  coverageBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  coverageNum:   { fontSize: 22, fontWeight: '900', color: TEXT_1 },
  coverageDenom: { fontSize: 12, color: TEXT_2, fontWeight: '600' },

  metricCaption: { fontSize: 10, color: TEXT_3, marginTop: 6, textAlign: 'center' },

  currentLabel: { fontSize: 10, fontWeight: '800', color: '#0891B2', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },

  accumulatingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFEFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#0891B230',
  },
  accumulatingText: { flex: 1, fontSize: 12.5, color: '#0E7490', lineHeight: 18, fontWeight: '600' },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  historyMilestone: { fontSize: 12.5, fontWeight: '800', color: TEXT_1 },
  historyMeta:       { fontSize: 11, color: TEXT_2, marginTop: 1 },
  historyDate:       { fontSize: 11, color: TEXT_3, fontWeight: '600' },

  patternCaption: { fontSize: 10.5, color: TEXT_3, lineHeight: 15, fontStyle: 'italic' },

  notReportedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#CBD5E1',
  },
  notReportedTitle: { fontSize: 13, fontWeight: '800', color: TEXT_1 },
  notReportedText:  { fontSize: 12, color: TEXT_2, lineHeight: 18, marginTop: 2 },
});

// ─── Motor Pattern Progress row ──────────────────────────────────────────────

function MotorPatternRow({ pattern }) {
  if (!pattern.hasData) {
    return (
      <View style={mp.row}>
        <Text style={mp.label}>{pattern.label}</Text>
        <Text style={mp.noData}>No data yet</Text>
      </View>
    );
  }
  const color = pattern.delta > 0 ? '#15803D' : pattern.delta < 0 ? '#B91C1C' : '#475569';
  return (
    <View style={mp.row}>
      <Text style={mp.label}>{pattern.label}</Text>
      <View style={mp.scoreLine}>
        <Text style={mp.scoreText}>{pattern.initial}%</Text>
        <Ionicons name="arrow-forward" size={12} color="#94A3B8" />
        <Text style={mp.scoreText}>{pattern.current}%</Text>
        <Text style={[mp.delta, { color }]}>
          {pattern.delta > 0 ? '+' : ''}{pattern.delta}
        </Text>
      </View>
      <Text style={[mp.message, { color }]}>{pattern.message}</Text>
    </View>
  );
}

const mp = StyleSheet.create({
  row:       { gap: 4 },
  label:     { fontSize: 13, fontWeight: '800', color: TEXT_1 },
  noData:    { fontSize: 12, color: TEXT_3, fontStyle: 'italic' },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreText: { fontSize: 14, fontWeight: '700', color: TEXT_2 },
  delta:     { fontSize: 13, fontWeight: '900', marginLeft: 4 },
  message:   { fontSize: 12, lineHeight: 17 },
});

// ─── Screen-level styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  topBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.2 },
  topDate:  { fontSize: 11, opacity: 0.65, fontWeight: '500', marginTop: 1 },

  heroStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  heroInitial: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  heroInitialText: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  heroName:        { fontSize: 20, fontWeight: '900' },
  heroMeta:        { fontSize: 12, opacity: 0.7, fontWeight: '500', marginTop: 2 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, fontWeight: '600', opacity: 0.75, textAlign: 'center' },
  retryBtn:     { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 50 },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  scrollArea: { flex: 1, backgroundColor: PAGE_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  scroll:     { padding: 16, paddingTop: 20 },

  summaryGrid: { flexDirection: 'row', gap: 8 },

  divider: { height: 1, backgroundColor: DIVIDER, marginVertical: 12 },

  metricsRow: { flexDirection: 'row', gap: 8 },

  overallBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  overallLabel: { fontSize: 13, fontWeight: '600', color: TEXT_2 },
  overallPct:   { fontSize: 18, fontWeight: '900', minWidth: 44 },

  progressGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
