import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../constants/layout';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';
import { getLetterSequence, getMotorProfile } from '../../../utils/storage';
import { retryPendingFinalizationForStudent } from '../../../utils/finalizeSync';
import { recordAssessmentSnapshot } from '../../../constants/sessionProgress';
// Same parent-verification gate already used on back navigation in the
// Concept Learning section (e.g. Tier2ActivityScreen.js, ConceptItemsScreen.js)
// and on StudentDashboardScreen's "back to student picker" — a random
// 4-digit code shown as number-words that a child can't casually read past.
// Applied here to the Why/Assessment/View Progress buttons so a child can't
// wander into teacher-facing data the same way they couldn't back out of a
// concept lesson.
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { useGatedHardwareBack } from '../../../utils/useGatedBack';
// Screen-consistency fix (Initial Motor Assessment scoring audit): reads
// features.motor_score, the SAME per-shape unified score
// AssessmentCompleteScreen.js reads (and the same one that produces the
// persisted Feature 1 baseline) — the Assessment Summary modal below no
// longer computes its own separate formula. Previously this used
// featuresToScore() from adaptiveSequencing.js; that function is unchanged
// and still used by letters/words/uppercase/pre-writing, just no longer
// here — see unifiedShapeScoreMirror.js for where motor_score comes from.
// Fallback authoritative source for the Assessment Summary modal when the
// in-memory assessmentData route param is empty (e.g. reopened in a later
// app session, or reached via "Skip Assessment") — reads the SAME
// per-shape data getInitialReport already derives for every assessment
// (finalized or not), so a later visit shows the exact same 6-shape
// breakdown instead of a coarser 3-family average (see
// initialAssessmentShapes.js's own header for why this replaced the
// earlier motorBaseline.js-based fallback, which required a finalized
// Feature 1 baseline that many real assessments never reach).
import { fetchInitialAssessmentShapes } from '../../../utils/initialAssessmentShapes';
import { useLockLandscape } from '../../../utils/useOrientationLock';
import ScreenBackButton from '../../../components/handwriting/ScreenBackButton';
import { returnToStudentModuleSelection } from '../../../utils/postAssessmentNavigation';
import FlowOverviewModal from '../../../components/common/FlowOverviewModal';
import HeaderPillButton from '../../../components/common/HeaderPillButton';
import { buildHandwritingFlow } from '../../../data/handwritingFlow';

// "How it works" stages — static for the session, so built once.
const HANDWRITING_FLOW = buildHandwritingFlow();

const SHAPE_ICONS = {
  horizontal_line: 'remove-outline',
  vertical_line:   'swap-vertical-outline',
  full_circle:     'ellipse-outline',
  half_circle:     'radio-button-off-outline',
  zigzag:          'pulse-outline',
  curve_wave:      'analytics-outline',
};

function formatShapeName(key) {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Screen-consistency fix: same score → same label wherever it's shown,
// bucketed with the exact thresholds AssessmentCompleteScreen.js uses
// (getScoreColor/getDifficulty there) so "Good"/"Moderate"/"Needs practice"
// here always agrees with "Easy"/"Moderate"/"Needs Practice" there for the
// identical underlying score.
// score === null (motor_score genuinely unavailable) is its own explicit
// grey state — never silently falls through to "Needs practice", which
// would misrepresent missing data as a real, poor result.
function getScoreBadge(score) {
  if (score == null) return { label: 'Not available', bg: '#EEEEEE', color: '#757575' };
  if (score >= 75) return { label: 'Good',           bg: '#E8F5E9', color: '#2E7D32' };
  if (score >= 50) return { label: 'Moderate',       bg: '#FFFDE7', color: '#F57F17' };
  return                   { label: 'Needs practice', bg: '#FFF3E0', color: '#E65100' };
}

// Real Ionicons instead of raw Unicode glyphs (━ ○ ✓) — renders consistently
// across devices/fonts, and matches the same icon language SHAPE_ICONS
// already uses for these exact concepts elsewhere on this screen.
function getLearningPathContent(primaryStrength) {
  switch (primaryStrength) {
    case 'straight':
      return {
        icon:    'remove-outline',
        headline: "Great at straight lines!",
        detail:   "We'll start with letters like l, i, t that use the strokes you already control well.",
      };
    case 'curved':
      return {
        icon:    'ellipse-outline',
        headline: "Smooth, confident curves!",
        detail:   "We'll start with letters like o, c, e that match your circle and arc strength.",
      };
    default:
      return {
        icon:    'checkmark-circle-outline',
        headline: "Well-rounded motor skills!",
        detail:   "You're balanced across all strokes. We'll practise step by step, easy to hard.",
      };
  }
}

function getXAIExplanation(motorProfile) {
  if (!motorProfile) {
    return "Letters are arranged from easiest strokes to hardest, so every new letter builds on skills you've already practised.";
  }
  const { straightScore, curvedScore, primaryStrength, recommendedSequence } = motorProfile;

  const strengthDesc = primaryStrength === 'straight'
    ? `straight-line shapes (score ${straightScore}/100)`
    : primaryStrength === 'curved'
    ? `curve and circle shapes (score ${curvedScore}/100)`
    : `all stroke types equally`;

  return (
    `During the shape assessment, ${strengthDesc} stood out as a current strength.\n\n` +
    `To build motor confidence early, letters are ordered so familiar strokes come first: ${recommendedSequence}.\n\n` +
    `Within each group, complexity increases step by step — easy letters first, then medium, then hard. ` +
    `This matches how the child's motor memory develops, making each new letter feel achievable.`
  );
}

// Shared "Overall Assessment Score" card — used identically for both the
// in-memory (just-completed) and persisted-baseline (later visit) data
// states, so the two never drift into visually different presentations of
// the same kind of number.
// Shown as a progress circle (the same ProgressRing as the Progress pop-up),
// coloured by the result band — green Good, amber Moderate, orange Needs
// practice, grey when unavailable — with the label and result badge beneath.
function OverallScoreCard({ theme, label, score, note }) {
  const badge = getScoreBadge(score);
  return (
    <View style={styles.overallCard}>
      <ProgressRing
        percent={score ?? 0}
        color={badge.color}
        trackColor={badge.bg}
        centerText={score != null ? `${score}%` : 'N/A'}
        textColor={theme.headingText}
      />
      <Text style={styles.overallLabel}>{label}</Text>
      <View style={styles.overallResultRow}>
        <View style={[styles.overallBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.overallBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
      {note ? <Text style={styles.overallNote}>{note}</Text> : null}
    </View>
  );
}

// Calm, consistent line drawings for the six assessment shapes. These are
// presentation-only and use the existing shapeId without changing results.
function AssessmentShapeIcon({ shapeId, color }) {
  const common = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', fill: 'none' };
  let mark;
  switch (shapeId) {
    case 'horizontal_line':
      mark = <Line x1="4" y1="12" x2="20" y2="12" {...common} />;
      break;
    case 'vertical_line':
      mark = <Line x1="12" y1="4" x2="12" y2="20" {...common} />;
      break;
    case 'full_circle':
      mark = <Circle cx="12" cy="12" r="8" {...common} />;
      break;
    case 'half_circle':
      mark = <Path d="M4 16 A8 8 0 0 1 20 16" {...common} />;
      break;
    case 'zigzag':
      mark = <Path d="M3 17 L7.5 7 L12 17 L16.5 7 L21 17" {...common} />;
      break;
    case 'curve_wave':
      mark = <Path d="M3 13 C6 6 9 6 12 13 C15 20 18 20 21 13" {...common} />;
      break;
    default:
      return <Ionicons name={SHAPE_ICONS[shapeId] ?? 'brush-outline'} size={18} color={color} />;
  }
  return <Svg width={24} height={24} viewBox="0 0 24 24">{mark}</Svg>;
}

// Circular "Overall Progress" ring — same underlying progressPercent value
// the old inline header/bar showed, just presented as a ring in the new
// side panel instead of a straight bar. No new data source.
// centerText / textColor are optional: the Assessment Summary passes 'N/A'
// when a score is unavailable, rather than showing a misleading 0%.
function ProgressRing({
  percent, size = 112, strokeWidth = 11, color = '#F5A623', trackColor = '#FCEACB',
  centerText, textColor,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const offset = circumference * (1 - clamped / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.ringPercentText, textColor ? { color: textColor } : null]}>
        {centerText ?? `${clamped}%`}
      </Text>
    </View>
  );
}

// Short, encouraging note derived purely from the existing progressPercent
// value — presentation only, no new progress-tracking feature/data.
function progressEncouragement(percent) {
  if (percent >= 100) return "All done — fantastic job!";
  if (percent >= 50)  return "Almost there — amazing work!";
  if (percent > 0)    return "Keep going! You're doing great!";
  return "Let's get started!";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LetterHomeScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const {
    student,
    theme,
    assessmentData = [],
    motorProfile: passedProfile = null,
  } = route.params;

  const [showSummary,       setShowSummary]       = useState(false);
  const [showWhyModal,      setShowWhyModal]       = useState(false);
  const [showProgress,      setShowProgress]      = useState(false);
  const [showFlow,          setShowFlow]          = useState(false);
  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [uppercaseProgress, setUppercaseProgress] = useState(0);
  const [motorProfile,      setMotorProfile]      = useState(passedProfile);
  const [adaptiveSequence,  setAdaptiveSequence]  = useState([]);
  // Parent-verification gate (same ParentGateModal used on back navigation
  // in Concept Learning) — guards the Why/Assessment/View Progress buttons.
  // pendingGateAction records which of the three was tapped so a single
  // modal instance can dispatch the right action once the code is entered,
  // rather than needing three separate gate/modal pairs.
  const [gateVisible,       setGateVisible]       = useState(false);
  const [pendingGateAction, setPendingGateAction] = useState(null); // 'why' | 'assessment' | 'back'
  // Screen-consistency fix: fallback authoritative source for the
  // Assessment Summary modal, fetched only when there's no in-memory
  // assessmentData to show (see effect below) — never fetched, and never
  // shown, when the just-completed session's data is already available.
  const [initialShapesSummary, setInitialShapesSummary] = useState({ status: 'idle', shapes: null });

  useEffect(() => {
    if (!showSummary) return;               // only fetch while the modal is actually open
    if (assessmentData.length > 0) return;   // in-memory data already covers this visit
    if (initialShapesSummary.status !== 'idle') return; // fetch once per screen instance
    setInitialShapesSummary({ status: 'loading', shapes: null });
    fetchInitialAssessmentShapes({ studentId: student.sid }).then(setInitialShapesSummary);
  }, [showSummary, assessmentData.length, initialShapesSummary.status, student.sid]);

  // Reliability Step 3: guards against useFocusEffect firing a second
  // overlapping retry attempt (e.g. the child navigates away and quickly
  // back again while the previous attempt's single PATCH is still in
  // flight). A ref rather than state — it must not trigger a re-render or
  // itself become a focus-effect dependency.
  const pendingRetryInFlightRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
        .then(res => {
          setLowercaseProgress(res.data.lowercase_completed ?? 0);
          setUppercaseProgress(res.data.uppercase_completed ?? 0);
        })
        .catch(() => {});

      getLetterSequence(student.sid)
        .then(seq => { if (seq) setAdaptiveSequence(seq); })
        .catch(() => {});

      getMotorProfile(student.sid)
        .then(profile => {
          if (profile) {
            setMotorProfile(profile);
            recordAssessmentSnapshot(assessmentData, profile);
          }
        })
        .catch(() => {});

      // Quiet, bounded, one-shot retry of any pending assessment
      // finalization for this student (Reliability Step 3) — see
      // utils/finalizeSync.js. Works from student.sid alone (no
      // assessmentId route param needed), so it discovers a pending record
      // the same way whether this is the first LetterHome visit right after
      // AssessmentComplete or a much later one after an app restart.
      // Deliberately silent either way: no loader, no toast, no blocking —
      // LetterHome renders and behaves identically regardless of outcome.
      if (!pendingRetryInFlightRef.current) {
        pendingRetryInFlightRef.current = true;
        retryPendingFinalizationForStudent(student.sid)
          .catch(() => {}) // defense-in-depth; retryPendingFinalizationForStudent never rejects
          .finally(() => { pendingRetryInFlightRef.current = false; });
      }
    }, [student.sid])
  );

  // Display-only rollup of the two existing authoritative 26-letter counts.
  // The underlying progress API and unlock rule remain unchanged.
  const completedLetterCount = Math.min(
    52,
    Math.max(0, lowercaseProgress) + Math.max(0, uppercaseProgress),
  );
  const progressPercent = Math.min(100, Math.round((completedLetterCount / 52) * 100));

  // Assessment Summary modal's shape data — the just-completed session's
  // in-memory assessmentData when available, otherwise the same per-shape
  // breakdown fetched from the server above. One unified 6-shape source
  // either way (see initialAssessmentShapes.js) — the modal never falls
  // back to a coarser 3-family view any more.
  const summaryShapes = assessmentData.length > 0 ? assessmentData : (initialShapesSummary.shapes ?? []);

  // Screen-consistency fix: per-shape scores read from the SAME
  // features.motor_score AssessmentCompleteScreen.js reads — replaces the
  // old smoothness-only avgSmoothness/getOverallLabel calculation, which
  // could disagree with the "Overall X%" AssessmentCompleteScreen had just
  // shown moments earlier for the identical assessment.
  // null (not 50) when a shape's motor_score is genuinely unavailable — see
  // getScoreBadge's explicit "Not available" state above.
  const shapeScores = summaryShapes.map(item => {
    const v = item.features?.motor_score;
    return v == null ? null : Math.round(v);
  });
  const realShapeScores = shapeScores.filter(s => s != null);
  const overallShapeScore = realShapeScores.length
    ? Math.round(realShapeScores.reduce((a, b) => a + b, 0) / realShapeScores.length)
    : null;

  const pathContent = getLearningPathContent(motorProfile?.primaryStrength ?? 'balanced');

  // Opens the gate for one of the three guarded actions; the actual
  // navigation/modal only fires from handleGateSuccess once the code is
  // entered correctly.
  function requestGatedAction(action) {
    setPendingGateAction(action);
    setGateVisible(true);
  }

  function handleGateSuccess() {
    setGateVisible(false);
    if (pendingGateAction === 'why') setShowWhyModal(true);
    else if (pendingGateAction === 'assessment') setShowSummary(true);
    // Writing Check is a TEACHER-initiated assessment, so it goes through the
    // same ParentGateModal as every other teacher-facing action here. A child
    // cannot reach it unaided.
    else if (pendingGateAction === 'writingCheck') navigation.navigate('WritingCheck', { student, theme });
    else if (pendingGateAction === 'back') {
      returnToStudentModuleSelection(navigation, { student });
    }
    setPendingGateAction(null);
  }

  // The Android hardware back button opens the SAME gate as the on-screen
  // back button, rather than navigating straight out of the writing module.
  // Disabled while the gate is already showing so the hardware button can
  // dismiss the modal instead of re-opening it. This screen owns its
  // ParentGateModal directly (three gated actions), so it wires the shared
  // hook itself rather than going through useGatedBack.
  useGatedHardwareBack(() => requestGatedAction('back'), !gateVisible);

  function handleGateCancel() {
    setGateVisible(false);
    setPendingGateAction(null);
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative shapes — same treatment as the Concept / Dialogue landing pages */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          {/* Back out of the writing module. Gated by ParentGateModal for the
              same reason the Concept screens gate their own back button
              (Tier2ActivityScreen.js, ConceptItemsScreen.js): leaving a
              learning session is an adult decision, and a child tapping it
              mid-activity would otherwise drop straight out.

              This screen is the beginning of the explicit assessment Back
              chain; its own gated Back retains the module-level exit. */}
          <View style={styles.leftGroup}>
            {/* Round, translucent white — the landing pages' iconBtn. */}
            <ScreenBackButton
              onPress={() => requestGatedAction('back')}
              gated
              tint={theme.button}
              color={theme.headingText}
              accessibilityLabel="Back"
              style={styles.iconBtn}
            />
          </View>

          {/* Module title — same icon circle + 34pt heading as
              ConceptCategoriesScreen / DialogueLandingScreen. */}
          <View style={styles.titleRow}>
            <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
              <Ionicons name="create" size={18} color="#FFF" />
            </View>
            <Text style={[styles.title, { color: theme.headingText }]}>Writing Module</Text>
          </View>

          <View style={styles.topBtnGroup}>
            {/* Shared header pills (HeaderPillButton).
                How it works — teacher-facing overview of the module's flow
                (FlowOverviewModal). Not gated: it only explains. */}
            <HeaderPillButton
              variant="outline"
              icon="map"
              label="How it works"
              theme={theme}
              onPress={() => setShowFlow(true)}
            />

            {/* Progress — the child's own progress, in a small pop-up. Not
                gated: it is the same child-facing summary that used to sit
                on screen as the "Your Progress" box. */}
            <HeaderPillButton
              variant="primary"
              icon="trophy"
              label="Progress"
              theme={theme}
              onPress={() => setShowProgress(true)}
            />

            {/* Assessment — the grown-up control, gated by ParentGateModal
                on tap (requestGatedAction). No Dashboard or Report button
                here: the gated Back is the one way out, and the teacher
                report opens from the student's profile. */}
            <HeaderPillButton
              variant="soft"
              icon="clipboard-outline"
              label="Assessment"
              accessibilityLabel="Assessment — needs a code"
              theme={theme}
              onPress={() => requestGatedAction('assessment')}
            />
          </View>
        </View>

        {/* One short instruction, like the other landing pages' subtitles
            ("Choose a category to explore", "Choose a level to begin"). */}
        <Text style={[styles.subtitle, { color: theme.headingText }]} numberOfLines={1}>
          Choose letters or words to practise
        </Text>

        {/* ── Main content ── */}
        <View style={styles.mainContent}>

          {/* ── Main column ── */}
          <View style={styles.mainColumn}>

            {/* ── "Your Learning Path" card ── */}
            {/* White, framed in the avatar theme's outline like the landing
                pages' cards, with the icon, heading and Why? in that same
                outline colour. */}
            <View style={[styles.learningPathCard, {
              backgroundColor: theme.cardSurface,
              borderColor: theme.cardOutline,
            }]}>
              <View style={styles.learningPathHeader}>
                <View style={styles.learningPathLeft}>
                  <View style={[styles.pathIconBadge, { backgroundColor: theme.cardOutline + '20' }]}>
                    <Ionicons name={pathContent.icon} size={24} color={theme.cardOutline} />
                  </View>
                  <View style={styles.learningPathTextCol}>
                    <Text style={[styles.learningPathHeadline, { color: theme.cardOutline }]}>
                      {pathContent.headline}
                    </Text>
                    <Text style={styles.learningPathDetail}>
                      {pathContent.detail}
                    </Text>
                    {motorProfile && (
                      <Text style={[styles.sequenceTag, { color: theme.cardOutline + 'CC' }]}>
                        {motorProfile.recommendedSequence}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => requestGatedAction('why')}
                  style={[styles.whyBtn, { borderColor: theme.cardOutline + '50', backgroundColor: theme.cardOutline + '12' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="information-circle-outline" size={14} color={theme.cardOutline} />
                  <Text style={[styles.whyBtnText, { color: theme.cardOutline }]}>Why?</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Lowercase / Uppercase row ── */}
            <View style={styles.pathRow}>

              {/* Letters card */}
              <TouchableOpacity
                style={[styles.learningModeCard, styles.lettersCard]}
                onPress={() => navigation.navigate('LetterPractice', {
                  student,
                  theme,
                  letterSequence: adaptiveSequence,
                  motorProfile,
                })}
                activeOpacity={0.9}
              >
                <View style={styles.modeIconCircle}>
                  <Text style={styles.aaIconText}>Aa</Text>
                </View>
                <Text style={styles.lettersTitle}>Letters</Text>
                <Text style={styles.modeSubLabel}>{completedLetterCount} / 52 done</Text>
                <View style={[styles.startBtn, { backgroundColor: '#2E7D32' }]}>
                  <Text style={styles.startBtnText}>Start Practice</Text>
                  <View style={styles.startBtnChevronWrap}>
                    <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Words card — open from the start, exactly like Letters.
                  There is no progress gate in front of it, so it has one
                  appearance and one behaviour rather than an earned/locked
                  pair. */}
              <TouchableOpacity
                style={[styles.learningModeCard, styles.wordsCard]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('WordLetterSelect', { student, theme })}
                accessibilityRole="button"
                accessibilityLabel="Words"
              >
                <View style={[styles.modeIconCircle, { backgroundColor: '#EDE7F6' }]}>
                  <Ionicons name="book-outline" size={38} color="#7B1FA2" />
                </View>
                <Text style={styles.wordsTitle}>
                  Words
                </Text>
                <Text style={styles.modeSubLabel}>
                  Ready to practise words
                </Text>
                <View style={[styles.startBtn, { backgroundColor: '#7B1FA2' }]}>
                  <Text style={styles.startBtnText}>Start Practice</Text>
                  <View style={styles.startBtnChevronWrap}>
                    <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>

            </View>

          </View>

        </View>

        {/* ── "How it works" pop-up ── */}
        <FlowOverviewModal
          visible={showFlow}
          onClose={() => setShowFlow(false)}
          theme={theme}
          stages={HANDWRITING_FLOW}
          subtitle="How the Writing module works"
        />

        {/* ── "Your Progress" pop-up (Progress button) ──
            The same panel that used to sit beside the cards, now opened on
            demand so the cards have the screen to themselves. Tapping the
            dimmed backdrop or Close dismisses it. */}
        <Modal
          visible={showProgress}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProgress(false)}
        >
          <TouchableOpacity
            style={styles.popupOverlay}
            activeOpacity={1}
            onPress={() => setShowProgress(false)}
          >
            {/* Inner touchable swallows taps so only the backdrop closes it. */}
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.progressPanel, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
                <View style={styles.progressPanelHeader}>
                  <Ionicons name="trophy" size={18} color="#F5A623" />
                  <Text style={styles.progressPanelTitle}>Your Progress</Text>
                </View>

                <ProgressRing percent={progressPercent} color={theme.button} />

                <Text style={styles.progressPanelLabel}>Overall Progress</Text>
                <Text style={styles.progressPanelNote}>{progressEncouragement(progressPercent)}</Text>

                <View style={styles.progressPanelStat}>
                  <Ionicons name="book-outline" size={14} color={theme.button} />
                  <Text style={styles.progressPanelStatText}>{completedLetterCount} of 52 letters done</Text>
                </View>
                <View style={[styles.progressPanelStat, styles.wordsProgressStat]}>
                  <Ionicons name="book-outline" size={14} color="#7B1FA2" />
                  <Text style={styles.progressPanelStatText}>
                    Words are unlocked
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.progressCloseBtn, { backgroundColor: theme.button }]}
                  onPress={() => setShowProgress(false)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.progressCloseText, { color: theme.buttonText }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── Assessment Summary Modal ──
            A pop-up card over the dimmed screen, like the Progress pop-up,
            rather than a full-screen page. Still opened only through the
            grown-up gate (requestGatedAction('assessment')). Tapping the
            backdrop or the close button dismisses it. */}
        <Modal
          visible={showSummary}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSummary(false)}
        >
          <TouchableOpacity
            style={styles.popupOverlay}
            activeOpacity={1}
            onPress={() => setShowSummary(false)}
          >
            {/* Inner touchable swallows taps so only the backdrop closes it. */}
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.modalCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}
            >

              {/* Modal header bar */}
              <View style={styles.modalHeader}>
                {/* Same icon circle as the landing pages' titles. */}
                <View style={styles.modalTitleRow}>
                  <View style={[styles.modalTitleIcon, { backgroundColor: theme.cardOutline }]}>
                    <Ionicons name="clipboard" size={18} color="#FFF" />
                  </View>
                  <Text style={[styles.modalTitle, { color: theme.headingText }]}>
                    Assessment Summary
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSummary(false)}
                  style={[styles.modalCloseBtn, { backgroundColor: theme.cardOutline + '1F' }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={theme.headingText} />
                </TouchableOpacity>
              </View>

              {/* Card body — sized to its content, no scroll */}
              <View style={styles.modalBody}>

                {/* Top line: the one number that sums it up, centred, so the
                    overall result is seen first. */}
                {summaryShapes.length > 0 && (
                  <View style={styles.summaryTopRow}>
                    <OverallScoreCard theme={theme} label="Overall Assessment Score" score={overallShapeScore} />
                  </View>
                )}

                {/* Shape rows — fills available space evenly.
                    Screen-consistency fix: ONE 6-shape data shape and ONE
                    rendering path regardless of source, never a coarser
                    fallback view that could disagree with what the child
                    saw moments earlier.
                    1. assessmentData present (same session as the just-
                       completed assessment) → in-memory, no fetch needed.
                    2. assessmentData empty (a later visit) → the same
                       6-shape breakdown fetched from the server (see
                       initialAssessmentShapes.js) — real per-shape scores
                       derived from stored stroke data even when the
                       assessment was never finalized into a Feature 1
                       baseline.
                    3. Neither available yet → loading / empty state. */}
                {/* Shapes as a 2-column grid of tiles (3 rows of 2) — uses the
                    pop-up's width instead of one long list. Each tile: icon,
                    name and result label on top; bar and % underneath. */}
                {summaryShapes.length > 0 ? (
                  <View style={styles.modalShapeList}>
                    {summaryShapes.map((item, index) => {
                      const score    = shapeScores[index];
                      const badge    = getScoreBadge(score);
                      const indicatorPercent = Math.max(0, Math.min(100, score ?? 0));
                      return (
                        <View key={item.shapeId ?? index} style={styles.shapeRow}>
                          <View style={styles.shapeTileTop}>
                            <View style={[styles.shapeIconWrap, { backgroundColor: badge.bg }]}>
                              <AssessmentShapeIcon shapeId={item.shapeId} color={badge.color} />
                            </View>
                            <Text style={styles.shapeName} numberOfLines={1}>
                              {formatShapeName(item.shapeId ?? '')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.badgeText, { color: badge.color }]}>
                                {badge.label}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.shapeMetricColumn}>
                            <View style={styles.shapeProgressTrack}>
                              <View style={[
                                styles.shapeProgressFill,
                                { width: `${indicatorPercent}%`, backgroundColor: badge.color },
                              ]} />
                            </View>
                            <Text style={styles.shapeScoreText}>{score != null ? `${score}%` : 'N/A'}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : initialShapesSummary.status === 'loading' ? (
                  <View style={styles.summaryLoadingRow}>
                    <ActivityIndicator size="small" color={theme.button} />
                    <Text style={styles.summaryLoadingText}>Loading assessment results…</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No assessment data available.</Text>
                )}

              </View>

            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── "Why this order?" XAI Modal ── */}
        <Modal
          visible={showWhyModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowWhyModal(false)}
        >
          <View style={styles.xaiOverlay}>
            <View style={styles.xaiCard}>

              <View style={styles.xaiHeader}>
                <Text style={styles.xaiTitle}>Why this learning order?</Text>
                <TouchableOpacity
                  onPress={() => setShowWhyModal(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color="#333333" />
                </TouchableOpacity>
              </View>

              <Text style={styles.xaiBody}>
                {getXAIExplanation(motorProfile)}
              </Text>

              {motorProfile && (
                <View style={styles.xaiScores}>
                  <View style={styles.xaiScoreRow}>
                    <Text style={styles.xaiScoreLabel}>Straight lines</Text>
                    <Text style={styles.xaiScoreValue}>{motorProfile.straightScore}/100</Text>
                  </View>
                  <View style={styles.xaiScoreRow}>
                    <Text style={styles.xaiScoreLabel}>Curves & circles</Text>
                    <Text style={styles.xaiScoreValue}>{motorProfile.curvedScore}/100</Text>
                  </View>
                  <View style={styles.xaiScoreRow}>
                    <Text style={styles.xaiScoreLabel}>Direction changes</Text>
                    <Text style={styles.xaiScoreValue}>{motorProfile.complexScore}/100</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.xaiCloseBtn, { backgroundColor: theme.button }]}
                onPress={() => setShowWhyModal(false)}
              >
                <Text style={[styles.xaiCloseBtnText, { color: theme.buttonText }]}>Got it</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>

        <ParentGateModal
          visible={gateVisible}
          onSuccess={handleGateSuccess}
          onCancel={handleGateCancel}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Decorative background shapes (Concept / Dialogue landing pages) ──────
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  blobTopRight: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
    bottom: -80,
    left: -80,
  },

  // ── Top bar: back | title | grown-up buttons ───────────────────────────
  // The two side groups share the leftover width equally (flex: 1) so the
  // title stays centred even though the button group is wider than Back.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  leftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Overrides ScreenBackButton's tinted look with the landing pages' round,
  // translucent white button (its 40px size comes from ScreenBackButton).
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // marginTop matches ConceptCategoriesScreen / DialogueLandingScreen, so the
  // title sits at the same height on every module landing page.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 70,
  },
  titleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: Layout.spacing.md,
    paddingHorizontal: Layout.spacing.lg,
  },
  topBtnGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  // Grown-ups-only cluster (Assessment + Progress, both gated) — quiet,
  // deliberately smaller and less colorful than the Letters/Words cards,
  // so a child's attention isn't pulled toward controls that
  // aren't meant for them.
  // Main content
  // One column (learning path + Letters/Words), centred both ways in the
  // space under the subtitle — the same placement as DialogueLandingScreen's
  // body. "Your Progress" used to sit in a side column here; it now opens
  // from the Progress button as a pop-up. The extra bottom padding lifts
  // the centred block a little, as the landing pages do.
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 44,
    paddingBottom: 48,
  },
  // Capped width so the Letters/Words cards stay close to square instead of
  // being stretched wide — and so justifyContent:'center' above has room to
  // centre the column. Wider than before (560 → 680) now that the side
  // panel is gone.
  mainColumn: {
    flex: 1,
    maxWidth: 680,
    gap: 22,
    alignItems: 'stretch',
  },

  // ── Learning Path Card ─────────────────────────────────────────────────────
  // Landing-page card frame (28 radius, 3px outline, soft shadow); surface
  // and outline colours come from the avatar theme.
  learningPathCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 3,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  learningPathHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  learningPathLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pathIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  learningPathTextCol: {
    flex: 1,
    gap: 3,
  },
  learningPathHeadline: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
  },
  learningPathDetail: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
  },
  sequenceTag: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  whyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  whyBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },

  // ── Letters / Words cards ──────────────────────────────────────────────────
  pathRow: {
    flexDirection: 'row',
    gap: 18,
    width: '100%',
  },

  // Same frame as the landing pages' CategoryCard / LevelCard: 28 radius,
  // 3px outline, soft shadow. Each card keeps its own colour identity.
  learningModeCard: {
    flex: 1,
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 18,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  // White, like the landing pages' cards; the green lives in the outline,
  // icon circle and title.
  lettersCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#A5D6A7',
  },
  modeIconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#DCEDC8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  // "Aa" badge for the Letters card, in place of a generic text icon —
  // matches the reference design directly.
  aaIconText: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#2E7D32',
  },
  lettersTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#2E7D32',
    zIndex: 1,
  },
  modeSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontFamily: 'DMSans_600SemiBold',
    lineHeight: 18,
    minHeight: 36,
    maxWidth: '94%',
    textAlign: 'center',
    zIndex: 1,
  },
  // The card's real, filled "Start Practice" button — a visual affordance
  // only (the whole card is already the tap target), matching how clearly
  // spelled-out, unambiguous actions help an ASD child know exactly what
  // happens when they tap.
  // The concept screens' raised 3D "Ready!" button, card-sized.
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.22)',
    marginTop: 4,
    minWidth: 150,
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#FFFFFF',
  },
  startBtnChevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // White, with the purple in the outline and the bottom hills.
  wordsCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CE93D8',
  },
  wordsTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#7B1FA2',
    zIndex: 1,
  },

  // ── "Your Progress" pop-up ─────────────────────────────────────────────────
  // Dimmed backdrop shared by the Progress and Assessment pop-ups; the card
  // is centred on it, and tapping the backdrop closes.
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Landing-page card frame; surface and outline come from the avatar theme.
  // Sized to its own content — a small pop-up, not a full sheet.
  progressPanel: {
    width: 300,
    borderRadius: 28,
    borderWidth: 3,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  progressPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  progressPanelTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#3A2E1F',
  },
  ringPercentText: {
    position: 'absolute',
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#3A2E1F',
  },
  progressPanelLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#3A2E1F',
    marginTop: 10,
  },
  progressPanelNote: {
    fontSize: 12,
    color: '#8A7A5C',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 2,
  },
  progressPanelStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  progressPanelStatText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#555555',
  },
  wordsProgressStat: {
    marginTop: 6,
    backgroundColor: '#F7F1FA',
  },
  // The concept screens' 3D button, small.
  progressCloseBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.22)',
  },
  progressCloseText: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
  },
  // ── Assessment Summary Modal ───────────────────────────────────────────────
  // The pop-up card itself: landing-page frame (28 radius, 3px theme
  // outline), sized to its content and capped so it always fits on screen.
  modalCard: {
    width: '92%',
    maxWidth: 760,
    maxHeight: '94%',
    borderRadius: 28,
    borderWidth: 3,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Same icon circle as the landing pages' titles (titleIconCircle).
  modalTitleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 14,
  },

  // ── Top line: overall score, centred ────────────────────────────────────
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  // ── Shape tiles: 2 columns × 3 rows ─────────────────────────────────────
  // No flex here: the pop-up sizes to its content. flexBasis just under
  // half + flexGrow puts exactly two tiles on each row, filling the width.
  modalShapeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  shapeRow: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    // White tile, light-brown frame.
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCC7B0',
  },
  shapeTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shapeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shapeName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#333333',
  },
  // Bottom line of a tile: the bar, then its %.
  shapeMetricColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shapeProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E7E9ED',
    overflow: 'hidden',
  },
  shapeProgressFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  shapeScoreText: {
    minWidth: 44,
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#3F4550',
    textAlign: 'right',
  },
  badge: {
    minWidth: 84,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  // Ring, label and badge stacked and centred; sized to its content so it
  // sits centred on its line.
  overallCard: {
    alignItems: 'center',
    gap: 6,
  },
  overallLabel: {
    marginTop: 4,
    fontSize: 14,
    color: '#6D7280',
    fontFamily: 'DMSans_700Bold',
  },
  overallResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallBadge: {
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
  },
  overallBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
  },
  overallNote: {
    fontSize: 11,
    color: '#999999',
    marginTop: 3,
  },
  summaryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  summaryLoadingText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
  },

  // ── XAI Modal ─────────────────────────────────────────────────────────────
  xaiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  xaiCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  xaiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  xaiTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#1A1A1A',
    flexShrink: 1,
    marginRight: 8,
  },
  xaiBody: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
    marginBottom: 16,
  },
  xaiScores: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  xaiScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xaiScoreLabel: {
    fontSize: 13,
    color: '#555555',
  },
  xaiScoreValue: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1A1A',
  },
  xaiCloseBtn: {
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  xaiCloseBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
