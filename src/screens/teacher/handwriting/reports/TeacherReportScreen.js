import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
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
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { getSessionProgress, getAssessmentSnapshot, getSessionDurationMinutes } from '../../../../constants/sessionProgress';
import { getMotorProfile, getCompletedLetters, getLetterProgress, getAllWordProgress } from '../../../../utils/storage';
import { generateReport } from '../../../../utils/reportEngine';
import client from '../../../../api/client';
import { ENDPOINTS } from '../../../../constants/api';
import WordImageDisplay from '../../../../components/word/WordImageDisplay';
import ContributionChart from '../../../../components/handwriting/ContributionChart';

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

  const [loading,  setLoading]  = useState(true);
  const [report,   setReport]   = useState(null);
  const [duration, setDuration] = useState(0);
  const [letterProgressReport, setLetterProgressReport] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
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
          const persistent       = await getAllWordProgress(student?.sid ?? 0);
          const wordProgress     = { ...persistent, ...getSessionProgress() };
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
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [student])
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
          <TouchableOpacity style={s.topBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.topTitle, { color: theme.headingText }]}>Progress Report</Text>
            <Text style={[s.topDate,  { color: theme.headingText }]}>{dateStr}</Text>
          </View>
          <TouchableOpacity style={s.topBtn} onPress={handleShare} activeOpacity={0.75}>
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
        ) : (
          <ScrollView
            style={s.scrollArea}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >

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
            </SectionCard>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
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

function ShapeRow({ shape }) {
  const color = shape.score >= 70 ? '#15803D' : shape.score >= 45 ? '#B45309' : '#B91C1C';
  const label = shape.label ?? (shape.score >= 70 ? 'Excellent' : shape.score >= 45 ? 'Good' : 'Practice');
  return (
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
  );
}
const sr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
            {analysis.confidence != null && (
              <View style={[mda.confBadge, { backgroundColor: color + '18' }]}>
                <Text style={[mda.confNum, { color }]}>{analysis.confidence}%</Text>
                <Text style={[mda.confLabel, { color }]}>match</Text>
              </View>
            )}
          </View>

          {/* Secondary difficulty */}
          {analysis.secondaryDifficulty && (
            <View style={mda.secondary}>
              <Ionicons name="git-branch-outline" size={12} color={TEXT_3} />
              <Text style={mda.secondaryText}>
                Also present: {analysis.secondaryDifficulty.label} ({analysis.secondaryDifficulty.confidence}%)
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
  confBadge:   { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
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

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, fontWeight: '600', opacity: 0.75 },

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