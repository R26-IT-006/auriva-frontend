/**
 * TeacherReportScreen
 *
 * Sections:
 *  1. Header — student info, date, session duration, share
 *  2. Practice Summary — letters / words / attempts
 *  3. Motor Comfort Score — SVG gauge
 *  4. Motor Performance Metrics — smoothness breakdown per shape
 *  5. Letters Mastery Status — per-letter accuracy table
 *  6. Word Activities — per-letter exercise accuracy
 *  7. Learning Progress — XAI progress indicators
 *  8. Teacher Recommendations — XAI evidence-based suggestions
 *
 * Each section with a computed metric has an expandable XAI panel
 * (tap "ⓘ Why?" to see the exact formula and reasoning).
 */

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
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

import { getSessionProgress, getAssessmentSnapshot, getSessionDurationMinutes } from '../../../constants/sessionProgress';
import { getMotorProfile, getCompletedLetters, getLetterProgress, getAllWordProgress } from '../../../utils/storage';
import { generateReport } from '../../../utils/reportEngine';
import WordImageDisplay from '../../../components/word/WordImageDisplay';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 32, 560);

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLORS = {
  good:       { text: '#2E7D32', bg: '#E8F5E9', border: '#81C784' },
  moderate:   { text: '#E65100', bg: '#FFF3E0', border: '#FFB74D' },
  needsWork:  { text: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' },
  neutral:    { text: '#546E7A', bg: '#ECEFF1', border: '#B0BEC5' },
};

function statusColors(status) {
  if (status === 'good' || status === 'Mastered')         return COLORS.good;
  if (status === 'moderate' || status === 'Moderate' || status === 'Progressing') return COLORS.moderate;
  return COLORS.needsWork;
}

// ─── SVG Motor Gauge ──────────────────────────────────────────────────────────

function MotorGauge({ score }) {
  const W = 200, H = 130;
  const cx = W / 2, cy = 108, r = 80, sw = 14;

  function pt(deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function arcD(aDeg, bDeg) {
    const s = pt(aDeg), e = pt(bDeg);
    const large = Math.abs(aDeg - bDeg) > 180 ? 1 : 0;
    // sweep = 0: counter-clockwise in SVG (= going from higher angle to lower, through the top)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
  }

  const clampedScore = Math.max(0, Math.min(100, score ?? 0));
  const needleDeg = (1 - clampedScore / 100) * 180; // 0%→180°(left), 100%→0°(right)
  const needlePt  = pt(needleDeg);
  const outerNeedle = { x: cx + (r - sw * 0.6) * Math.cos(needleDeg * Math.PI / 180),
                        y: cy - (r - sw * 0.6) * Math.sin(needleDeg * Math.PI / 180) };

  const gaugeColor = clampedScore >= 70 ? '#4CAF50' : clampedScore >= 45 ? '#FF9800' : '#EF5350';

  return (
    <Svg width={W} height={H}>
      {/* Background track */}
      <Path d={arcD(180, 0)} stroke="#EEEEEE" strokeWidth={sw} fill="none" strokeLinecap="butt" />
      {/* Red zone 0-33 */}
      <Path d={arcD(180, 121)} stroke="#EF5350" strokeWidth={sw} fill="none" strokeLinecap="butt" />
      {/* Amber zone 33-66 */}
      <Path d={arcD(121, 61)} stroke="#FFA726" strokeWidth={sw} fill="none" strokeLinecap="butt" />
      {/* Green zone 66-100 */}
      <Path d={arcD(61, 0)} stroke="#66BB6A" strokeWidth={sw} fill="none" strokeLinecap="butt" />
      {/* Needle */}
      <Line x1={cx} y1={cy} x2={outerNeedle.x} y2={outerNeedle.y}
        stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={5} fill="#1A1A1A" />
      {/* Score */}
      <SvgText x={cx} y={cy - 14} textAnchor="middle" fontSize={28} fontWeight="bold" fill={gaugeColor}>
        {clampedScore}
      </SvgText>
      <SvgText x={cx} y={cy - 1} textAnchor="middle" fontSize={10} fill="#888">/ 100</SvgText>
      {/* Zone labels */}
      <SvgText x={8}   y={cy + 14} fontSize={9} fill="#EF5350">Low</SvgText>
      <SvgText x={W - 8} y={cy + 14} textAnchor="end" fontSize={9} fill="#66BB6A">High</SvgText>
    </Svg>
  );
}

// ─── XAI panel ────────────────────────────────────────────────────────────────

function XAIPanel({ explanation }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={xaiStyles.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={xaiStyles.btn} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={14} color="#7B1FA2" />
        <Text style={xaiStyles.btnText}>Why this score?</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#7B1FA2" />
      </TouchableOpacity>
      {open && (
        <View style={xaiStyles.panel}>
          <Text style={xaiStyles.text}>{explanation}</Text>
        </View>
      )}
    </View>
  );
}

const xaiStyles = StyleSheet.create({
  wrap: { marginTop: 8 },
  btn:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  btnText: { fontSize: 12, color: '#7B1FA2', fontWeight: '600' },
  panel: {
    marginTop: 6, backgroundColor: '#F3E5F5', borderRadius: 10,
    padding: 12, borderLeftWidth: 3, borderLeftColor: '#AB47BC',
  },
  text: { fontSize: 12, color: '#4A148C', lineHeight: 18 },
});

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, icon, children, style }) {
  return (
    <View style={[cardStyles.card, style]}>
      {title && (
        <View style={cardStyles.header}>
          {icon && <Ionicons name={icon} size={16} color="#555" style={{ marginRight: 6 }} />}
          <Text style={cardStyles.title}>{title}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18,
    marginBottom: 14, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title:  { fontSize: 14, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.3 },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ label, status }) {
  const c = statusColors(status);
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1.5 },
  text:  { fontSize: 11, fontWeight: '700' },
});

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY = {
  high:   { bg: '#FFEBEE', text: '#C62828', label: 'High' },
  medium: { bg: '#FFF8E1', text: '#F57F17', label: 'Medium' },
  low:    { bg: '#E8F5E9', text: '#2E7D32', label: 'Low' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherReportScreen({ route, navigation }) {
  const { student, theme } = route.params;

  const [loading,  setLoading]  = useState(true);
  const [report,   setReport]   = useState(null);
  const [duration, setDuration] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        try {
          const { assessmentData, motorProfile: snapProfile } = getAssessmentSnapshot();
          // Merge persistent word history with current-session memory (session wins)
          const persistent   = await getAllWordProgress(student?.sid ?? 0);
          const wordProgress = { ...persistent, ...getSessionProgress() };
          const motorProfile = snapProfile ?? (await getMotorProfile(student?.sid));
          const completedLetters = await getCompletedLetters(student?.sid ?? 0);

          // Load letter progress for all completed letters
          const letterProgressMap = {};
          for (const letter of (completedLetters ?? [])) {
            const lp = await getLetterProgress(student?.sid ?? 0, letter);
            if (lp) letterProgressMap[letter] = lp;
          }

          const computed = generateReport({
            assessmentData, motorProfile, letterProgressMap,
            wordProgress, completedLetters, student,
          });

          if (active) {
            setReport(computed);
            setDuration(getSessionDurationMinutes());
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
        ? `Motor Skills    Motor Comfort Score: ${motorScore.score}/100 (${motorScore.level})`
        : 'Motor Skills    No assessment data yet',
      '',
      summary.lettersPracticed > 0
        ? `Letters Practiced    ${summary.lettersPracticed} letters completed`
        : 'Letters Practiced    None yet',
      '',
      summary.totalWordsPracticed > 0
        ? `Word Activities    ${wordMastery.overall?.correct ?? 0}/${wordMastery.overall?.total ?? 0} exercises correct (${wordMastery.overall?.pct ?? 0}%)`
        : 'Word Activities    No word activities yet',
      '',
      ...(report.recommendations.slice(0, 3).map(r => `Recommendation    ${r.text}`)),
    ].join('\n');

    Share.share({ message: text, title: `Auriva Report — ${student?.full_name}` });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.topTitle, { color: theme.headingText }]}>
              End-of-Day Progress Report
            </Text>
            <Text style={[styles.topSub, { color: theme.headingText }]}>
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.button} />
            <Text style={[styles.loadingText, { color: theme.headingText }]}>
              Generating report…
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >

            {/* ══ 1. Student Info ══════════════════════════════════════════════ */}
            <View style={styles.infoRow}>
              <Card style={{ flex: 1, marginRight: 8 }}>
                <View style={styles.infoGrid}>
                  <InfoRow label="Student"   value={student?.full_name ?? '—'} />
                  <InfoRow label="Student ID" value={`#${student?.sid ?? '—'}`} />
                  <InfoRow label="Session"    value={`${duration} min`} />
                  <InfoRow label="Date"       value={new Date().toLocaleDateString()} />
                </View>
              </Card>

              <Card title="Practice Summary" icon="stats-chart-outline" style={{ flex: 1, marginLeft: 8 }}>
                <View style={styles.summaryGrid}>
                  <SummaryCell
                    value={report.summary.lettersPracticed}
                    label="Letters practiced"
                    color={theme.button}
                  />
                  <SummaryCell
                    value={report.summary.totalWordsPracticed}
                    label="Words practiced"
                    color="#2E7D32"
                  />
                  <SummaryCell
                    value={report.summary.totalAttempts}
                    label="Total attempts"
                    color="#E65100"
                  />
                  <SummaryCell
                    value={report.summary.wordLettersDone}
                    label="Letters in activities"
                    color="#1565C0"
                  />
                </View>
              </Card>
            </View>

            {/* ══ 2. Motor Comfort Score + Motor Metrics ══════════════════════ */}
            <View style={styles.infoRow}>

              {/* Gauge */}
              <Card title="Motor Comfort Score" icon="speedometer-outline" style={{ flex: 1, marginRight: 8, alignItems: 'center' }}>
                {report.motorScore.score !== null ? (
                  <>
                    <MotorGauge score={report.motorScore.score} />
                    <StatusBadge label={report.motorScore.level} status={
                      report.motorScore.score >= 70 ? 'good' :
                      report.motorScore.score >= 45 ? 'moderate' : 'needs-work'
                    } />
                    <XAIPanel explanation={report.motorScore.explanation} />
                  </>
                ) : (
                  <NoData message="Complete shape assessment to see motor score" />
                )}
              </Card>

              {/* Per-shape breakdown */}
              <Card title="Motor Performance" icon="pulse-outline" style={{ flex: 1, marginLeft: 8 }}>
                {report.motorScore.breakdown?.length > 0 ? (
                  <>
                    {report.motorScore.breakdown.map(shape => (
                      <View key={shape.shapeId} style={styles.shapeRow}>
                        <Text style={styles.shapeId} numberOfLines={1}>
                          {shape.shapeId.replace(/_/g, ' ')}
                        </Text>
                        <View style={styles.shapeBar}>
                          <View style={[styles.shapeBarFill, {
                            width: `${shape.score}%`,
                            backgroundColor: shape.score >= 70 ? '#4CAF50' : shape.score >= 45 ? '#FF9800' : '#EF5350',
                          }]} />
                        </View>
                        <Text style={[styles.shapeScore, {
                          color: shape.score >= 70 ? '#2E7D32' : shape.score >= 45 ? '#E65100' : '#C62828',
                        }]}>
                          {shape.score}%
                        </Text>
                        <Text style={styles.shapeLabel}>{shape.label}</Text>
                      </View>
                    ))}
                    <View style={styles.divider} />
                    {report.letterMetrics.avgDeviation !== null && (
                      <>
                        <MetricRow label="Avg stroke deviation"  value={`${report.letterMetrics.avgDeviation} px`} />
                        <MetricRow label="Avg pauses/letter"     value={report.letterMetrics.avgPauses ?? '—'} />
                        <MetricRow label="Avg time/letter"       value={report.letterMetrics.avgTime !== null ? `${report.letterMetrics.avgTime}s` : '—'} />
                      </>
                    )}
                    <XAIPanel explanation={report.letterMetrics.explanation} />
                  </>
                ) : (
                  <NoData message="No motor assessment data yet" />
                )}
              </Card>
            </View>

            {/* ══ 3. Letters Mastery ══════════════════════════════════════════ */}
            <Card title="Letters Mastery Status" icon="text-outline">
              {report.letterMetrics.letters.length > 0 ? (
                <>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.thCell, { flex: 1 }]}>Letter</Text>
                    <Text style={[styles.thCell, { width: 80 }]}>Accuracy</Text>
                    <Text style={[styles.thCell, { width: 70 }]}>Avg Time</Text>
                    <Text style={[styles.thCell, { width: 90 }]}>Status</Text>
                  </View>
                  {report.letterMetrics.letters.map(l => (
                    <View key={l.letter} style={styles.tableRow}>
                      <Text style={[styles.tdLetter, { flex: 1 }]}>{l.letter.toUpperCase()}</Text>
                      <View style={{ width: 80 }}>
                        <AccuracyBar pct={l.accuracy} />
                      </View>
                      <Text style={[styles.td, { width: 70 }]}>{l.avgTimeSec}s</Text>
                      <View style={{ width: 90 }}>
                        <StatusBadge label={l.status} status={l.status === 'Mastered' ? 'good' : l.status === 'Progressing' ? 'moderate' : 'needs-work'} />
                      </View>
                    </View>
                  ))}
                  <XAIPanel explanation={report.letterMetrics.explanation} />
                </>
              ) : (
                <NoData message="No letter practice recorded this session" />
              )}
            </Card>

            {/* ══ 4. Word Activities ══════════════════════════════════════════ */}
            <Card title="Word Activities" icon="book-outline">
              {report.wordMastery.byLetter.length > 0 ? (
                <>
                  {/* Overall bar */}
                  {report.wordMastery.overall && (
                    <View style={styles.overallBar}>
                      <Text style={styles.overallLabel}>
                        Overall: {report.wordMastery.overall.correct}/{report.wordMastery.overall.total} correct
                      </Text>
                      <AccuracyBar pct={report.wordMastery.overall.pct} wide />
                      <Text style={[styles.overallPct, {
                        color: report.wordMastery.overall.pct >= 75 ? '#2E7D32' : report.wordMastery.overall.pct >= 50 ? '#E65100' : '#C62828',
                      }]}>
                        {report.wordMastery.overall.pct}%
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* Per-letter rows */}
                  {report.wordMastery.byLetter.map(l => (
                    <WordLetterRow key={l.letter} data={l} />
                  ))}

                  <XAIPanel explanation={report.wordMastery.explanation} />
                </>
              ) : (
                <NoData message="No word activities completed yet" />
              )}
            </Card>

            {/* ══ 5. Learning Progress ════════════════════════════════════════ */}
            <Card title="Learning Progress" icon="trending-up-outline">
              {report.progressIndicators.length > 0 ? (
                <View style={styles.progressList}>
                  {report.progressIndicators.map((ind, i) => (
                    <ProgressIndicatorRow key={i} item={ind} />
                  ))}
                </View>
              ) : (
                <NoData message="Complete activities to see learning trends" />
              )}
            </Card>

            {/* ══ 6. Teacher Recommendations (XAI) ═══════════════════════════ */}
            <Card title="Teacher Recommendations" icon="bulb-outline">
              {report.recommendations.map((rec, i) => (
                <RecommendationRow key={i} rec={rec} />
              ))}
            </Card>

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <View style={subStyles.infoRow}>
      <Text style={subStyles.infoLabel}>{label}</Text>
      <Text style={subStyles.infoValue}>{value}</Text>
    </View>
  );
}

function SummaryCell({ value, label, color }) {
  return (
    <View style={subStyles.summaryCell}>
      <Text style={[subStyles.summaryValue, { color }]}>{value}</Text>
      <Text style={subStyles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MetricRow({ label, value }) {
  return (
    <View style={subStyles.metricRow}>
      <Text style={subStyles.metricLabel}>{label}</Text>
      <Text style={subStyles.metricValue}>{value}</Text>
    </View>
  );
}

function AccuracyBar({ pct, wide }) {
  const color = pct >= 75 ? '#4CAF50' : pct >= 50 ? '#FF9800' : '#EF5350';
  return (
    <View style={[subStyles.barBg, wide && { height: 10, borderRadius: 5 }]}>
      <View style={[subStyles.barFill, { width: `${pct}%`, backgroundColor: color }, wide && { height: 10, borderRadius: 5 }]} />
    </View>
  );
}

function WordLetterRow({ data }) {
  const [open, setOpen] = useState(false);
  const c = statusColors(data.masteryStatus);
  return (
    <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
      <View style={subStyles.wordLetterRow}>
        <View style={[subStyles.letterCircle, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Text style={[subStyles.letterCircleText, { color: c.text }]}>{data.letter.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={subStyles.wordLetterMeta}>
            {data.words} word{data.words !== 1 ? 's' : ''} · {data.accuracy}% correct
            {data.bestEx ? `  ·  Best: ${data.bestEx.name}` : ''}
          </Text>
          <AccuracyBar pct={data.accuracy} />
        </View>
        <StatusBadge label={data.masteryStatus} status={data.masteryStatus === 'Mastered' ? 'good' : data.masteryStatus === 'Moderate' ? 'moderate' : 'needs-work'} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#888" />
      </View>

      {open && (
        <View style={subStyles.wordListExpanded}>
          {data.wordList.map((w, i) => (
            <View key={i} style={subStyles.wordItemRow}>
              <WordImageDisplay imageKey={w.imageKey ?? ''} emoji={w.emoji} size={28} />
              <Text style={subStyles.wordItemText}>{w.word}</Text>
              {['A', 'B', 'C', 'D'].map(ex => {
                const s = w.status[ex];
                const col = s === 'correct' ? '#2E7D32' : s === 'good' ? '#E65100' : '#9E9E9E';
                const icon = s === 'correct' ? '✓' : s === 'good' ? '~' : '·';
                return (
                  <View key={ex} style={[subStyles.exChip, { borderColor: col + '55', backgroundColor: col + '15' }]}>
                    <Text style={[subStyles.exChipText, { color: col }]}>{ex}{icon}</Text>
                  </View>
                );
              })}
              <View style={subStyles.stars}>
                {[0, 1, 2].map(i => <Text key={i} style={subStyles.star}>{i < w.stars ? '⭐' : '☆'}</Text>)}
              </View>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function ProgressIndicatorRow({ item }) {
  const [open, setOpen] = useState(false);
  const c = statusColors(item.status);
  return (
    <View style={subStyles.progressRow}>
      <View style={[subStyles.progressIcon, { backgroundColor: c.bg }]}>
        <Text style={[subStyles.progressIconText, { color: c.text }]}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={subStyles.progressLabel}>{item.label}</Text>
        <StatusBadge label={item.detail} status={item.status} />
      </View>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={xaiStyles.btn} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={14} color="#7B1FA2" />
        <Text style={xaiStyles.btnText}>Why?</Text>
      </TouchableOpacity>
      {open && (
        <View style={[xaiStyles.panel, { marginTop: 6, width: '100%' }]}>
          <Text style={xaiStyles.text}>{item.xai}</Text>
        </View>
      )}
    </View>
  );
}

function RecommendationRow({ rec }) {
  const [open, setOpen] = useState(false);
  const p = PRIORITY[rec.priority];
  return (
    <View style={subStyles.recCard}>
      <View style={subStyles.recTop}>
        <Text style={subStyles.recIcon}>{rec.icon}</Text>
        <Text style={subStyles.recText}>{rec.text}</Text>
        <View style={[subStyles.recPriority, { backgroundColor: p.bg }]}>
          <Text style={[subStyles.recPriorityText, { color: p.text }]}>{p.label}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={[xaiStyles.btn, { marginTop: 6 }]} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={13} color="#7B1FA2" />
        <Text style={xaiStyles.btnText}>Why this recommendation?</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color="#7B1FA2" />
      </TouchableOpacity>
      {open && (
        <View style={xaiStyles.panel}>
          <Text style={xaiStyles.text}>{rec.rationale}</Text>
        </View>
      )}
    </View>
  );
}

function NoData({ message }) {
  return (
    <View style={subStyles.noData}>
      <Ionicons name="alert-circle-outline" size={28} color="#BDBDBD" />
      <Text style={subStyles.noDataText}>{message}</Text>
    </View>
  );
}

// ─── Sub-component styles ─────────────────────────────────────────────────────

const subStyles = StyleSheet.create({
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel:  { fontSize: 12, color: '#888888', fontWeight: '500' },
  infoValue:  { fontSize: 12, color: '#1A1A1A', fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCell: { width: '47%', backgroundColor: '#F7F7F7', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue:{ fontSize: 28, fontWeight: '900' },
  summaryLabel:{ fontSize: 11, color: '#666', fontWeight: '500', textAlign: 'center', marginTop: 2 },

  metricRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { fontSize: 12, color: '#666' },
  metricValue: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },

  barBg:    { height: 6, borderRadius: 3, backgroundColor: '#EEEEEE', overflow: 'hidden', flex: 1 },
  barFill:  { height: 6, borderRadius: 3 },

  wordLetterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  letterCircle: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  letterCircleText: { fontSize: 16, fontWeight: '900' },
  wordLetterMeta:   { fontSize: 11, color: '#666' },

  wordListExpanded: {
    backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10,
    marginBottom: 8, gap: 8,
  },
  wordItemRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordItemText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#222' },
  exChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
  },
  exChipText: { fontSize: 11, fontWeight: '900' },
  stars: { flexDirection: 'row', gap: 1 },
  star:  { fontSize: 11 },

  progressRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  progressIcon:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  progressIconText: { fontSize: 16, fontWeight: '900' },
  progressLabel:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },

  recCard: {
    backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#EEEEEE',
  },
  recTop:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recIcon:        { fontSize: 22 },
  recText:        { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
  recPriority:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  recPriorityText:{ fontSize: 10, fontWeight: '800' },

  noData: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noDataText: { fontSize: 13, color: '#BDBDBD', textAlign: 'center' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  topTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  topSub:   { fontSize: 11, opacity: 0.6, fontWeight: '500', marginTop: 1 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600', opacity: 0.7 },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  infoRow: { flexDirection: 'row', marginBottom: 0 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },

  // Table
  tableHeader: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1.5, borderBottomColor: '#EEEEEE',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 8,
  },
  thCell:    { fontSize: 11, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  tdLetter:  { fontSize: 15, fontWeight: '900', color: '#1A1A1A' },
  td:        { fontSize: 13, color: '#555', fontWeight: '500' },

  // Shape rows
  shapeRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  shapeId:   { flex: 1, fontSize: 12, color: '#444', textTransform: 'capitalize' },
  shapeBar:  { width: 70, height: 6, borderRadius: 3, backgroundColor: '#EEEEEE', overflow: 'hidden' },
  shapeBarFill: { height: 6, borderRadius: 3 },
  shapeScore: { width: 32, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  shapeLabel: { width: 68, fontSize: 10, color: '#888' },

  // Overall bar
  overallBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  overallLabel: { fontSize: 13, fontWeight: '600', color: '#555', flex: 1 },
  overallPct:   { fontSize: 16, fontWeight: '900', minWidth: 42 },

  // Progress list
  progressList: { gap: 4 },
});
