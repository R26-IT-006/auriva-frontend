import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { getLetterSequence, getMotorProfile } from '../../utils/storage';
import { retryPendingFinalizationForStudent } from '../../utils/finalizeSync';
import { recordAssessmentSnapshot } from '../../constants/sessionProgress';
// Same parent-verification gate already used on back navigation in the
// Concept Learning section (e.g. Tier2ActivityScreen.js, ConceptItemsScreen.js)
// and on StudentDashboardScreen's "back to student picker" — a random
// 4-digit code shown as number-words that a child can't casually read past.
// Applied here to the Why/Assessment/View Progress buttons so a child can't
// wander into teacher-facing data the same way they couldn't back out of a
// concept lesson.
import { ParentGateModal } from '../../components/common/ParentGateModal';
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
import { fetchInitialAssessmentShapes } from '../../utils/initialAssessmentShapes';
import { isWordsUnlocked } from '../../utils/wordUnlockGate';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

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
        color:    '#1565C0',
        bg:       '#E3F2FD',
        border:   '#90CAF9',
      };
    case 'curved':
      return {
        icon:    'ellipse-outline',
        headline: "Smooth, confident curves!",
        detail:   "We'll start with letters like o, c, e that match your circle and arc strength.",
        color:    '#6A1B9A',
        bg:       '#F3E5F5',
        border:   '#CE93D8',
      };
    default:
      return {
        icon:    'checkmark-circle-outline',
        headline: "Well-rounded motor skills!",
        detail:   "You're balanced across all strokes. We'll practise step by step, easy to hard.",
        color:    '#2E7D32',
        bg:       '#E8F5E9',
        border:   '#A5D6A7',
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
function OverallScoreCard({ theme, label, score, note }) {
  const badge = getScoreBadge(score);
  return (
    <View style={[styles.overallCard, {
      backgroundColor: theme.button + '10',
      borderColor:     theme.button + '25',
    }]}>
      <View style={[styles.overallIconWrap, { backgroundColor: theme.button + '20' }]}>
        <Ionicons name="analytics-outline" size={22} color={theme.button} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.overallLabel}>{label}</Text>
        <Text style={[styles.overallValue, { color: theme.headingText }]}>
          {score != null ? `${score}%` : 'N/A'} · {badge.label}
        </Text>
        {note ? <Text style={styles.overallNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

// Circular "Overall Progress" ring — same underlying progressPercent value
// the old inline header/bar showed, just presented as a ring in the new
// side panel instead of a straight bar. No new data source.
function ProgressRing({ percent, size = 124, strokeWidth = 12, color = '#F5A623', trackColor = '#FCEACB' }) {
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
      <Text style={styles.ringPercentText}>{clamped}%</Text>
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

// Flat, static "rolling hills" scene filling the bottom of the Letters/
// Words cards — purely decorative (pointerEvents="none"), built from plain
// SVG shapes rather than an image asset. 'letters' keeps green tones and
// the small flower accent; 'words' reuses this app's existing purple Words
// theming instead of introducing a new color identity for just this card.
function CardLandscape({ variant }) {
  const isLetters = variant === 'letters';
  const hillBack  = isLetters ? '#BFE3B8' : '#DCC7EF';
  const hillFront = isLetters ? '#9ED895' : '#C7A3E0';
  const bush      = isLetters ? '#5CA85A' : '#9B62C4';

  return (
    // Anchored to just the bottom band of the card (not the full height) —
    // stretching a wide, flat scene across the whole card distorted it
    // against the card's actual (taller, narrower) proportions. A shorter
    // band close to the viewBox's own 300:160 aspect stretches cleanly.
    <Svg
      width="100%" height="100%"
      viewBox="0 0 300 160"
      preserveAspectRatio="none"
      style={styles.cardLandscapeSvg}
      pointerEvents="none"
    >
      {/* Clouds */}
      <Ellipse cx={46}  cy={22} rx={24} ry={12} fill="#FFFFFF" opacity={0.75} />
      <Ellipse cx={252} cy={16} rx={20} ry={10} fill="#FFFFFF" opacity={0.6} />

      {/* Rolling hills */}
      <Ellipse cx={70}  cy={195} rx={210} ry={70} fill={hillBack} opacity={0.8} />
      <Ellipse cx={230} cy={205} rx={220} ry={75} fill={hillFront} opacity={0.9} />

      {/* Small bushes tucked into the hill line */}
      <Circle cx={26}  cy={148} r={11} fill={bush} opacity={0.75} />
      <Circle cx={40}  cy={152} r={8}  fill={bush} opacity={0.6} />
      <Circle cx={272} cy={146} r={10} fill={bush} opacity={0.7} />

      {/* Tiny flower accent — letters card only */}
      {isLetters && (
        <>
          <Circle cx={264} cy={130} r={4} fill="#F8A5C2" />
          <Circle cx={270} cy={126} r={4} fill="#F8A5C2" />
          <Circle cx={274} cy={132} r={4} fill="#F8A5C2" />
          <Circle cx={268} cy={136} r={4} fill="#F8A5C2" />
          <Circle cx={269} cy={131} r={2.5} fill="#FFD966" />
        </>
      )}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LetterHomeScreen({ route, navigation }) {
  const {
    student,
    theme,
    assessmentData = [],
    motorProfile: passedProfile = null,
  } = route.params;

  const { width, height } = useWindowDimensions();

  const [showSummary,       setShowSummary]       = useState(false);
  const [showWhyModal,      setShowWhyModal]       = useState(false);
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
  const [pendingGateAction, setPendingGateAction] = useState(null); // 'why' | 'assessment' | 'progress'
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

  const progressPercent = Math.min(100, Math.round((lowercaseProgress / 26) * 100));
  // Pre-device P0 fix — previously hardcoded `true`, meaning Words was
  // never actually gated regardless of letter progress. See
  // utils/wordUnlockGate.js for the full audit of which unlock rule
  // applies and why (lowercase AND uppercase, both authoritatively
  // mastered — never AsyncStorage, never a local/client-only flag).
  const wordsUnlocked   = isWordsUnlocked(lowercaseProgress, uppercaseProgress);

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
    else if (pendingGateAction === 'progress') navigation.navigate('TeacherReport', { student, theme });
    setPendingGateAction(null);
  }

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
      {/* Decorative background bubbles */}
      <View style={[styles.bgBubbleLarge, {
        backgroundColor: theme.button + '0E',
        width: width * 0.50, height: width * 0.50, borderRadius: width * 0.25,
      }]} />
      <View style={[styles.bgBubbleMedium, {
        backgroundColor: theme.button + '09',
        width: width * 0.30, height: width * 0.30, borderRadius: width * 0.15,
      }]} />
      <View style={[styles.bgBubbleSmall, {
        backgroundColor: theme.button + '07',
        width: width * 0.18, height: width * 0.18, borderRadius: width * 0.09,
      }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          {/* Avatar moved out of the top bar — it now appears large, once,
              in the side column above "Your Progress" (see below), rather
              than being shown small here as well. */}
          <View style={styles.nameRow}>
            <Text style={[styles.studentName, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
            <Text style={styles.studentSubLabel}>Letter Writing</Text>
          </View>

          <View style={styles.topBtnGroup}>
            {/* Dashboard stays a normal, ungated, friendly action — it's
                just navigation, not teacher-facing data. */}
            <TouchableOpacity
              style={[styles.dashboardBtn, {
                backgroundColor: theme.button + '14',
                borderColor: theme.button + '40',
              }]}
              onPress={() => navigation.navigate('TeacherMain')}
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={15} color={theme.button} />
              <Text style={[styles.dashboardBtnText, { color: theme.button }]}>Dashboard</Text>
            </TouchableOpacity>

            {/* Assessment + Progress — same pill style as Dashboard above,
                so all three top-bar buttons read as one consistent group.
                Still gated by ParentGateModal on tap (requestGatedAction);
                only the visual treatment matches Dashboard now. */}
            <TouchableOpacity
              style={[styles.dashboardBtn, {
                backgroundColor: theme.button + '14',
                borderColor: theme.button + '40',
              }]}
              onPress={() => requestGatedAction('assessment')}
              activeOpacity={0.8}
              accessibilityLabel="Assessment — needs a code"
            >
              <Ionicons name="clipboard-outline" size={15} color={theme.button} />
              <Text style={[styles.dashboardBtnText, { color: theme.button }]}>Assessment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dashboardBtn, {
                backgroundColor: theme.button + '14',
                borderColor: theme.button + '40',
              }]}
              onPress={() => requestGatedAction('progress')}
              activeOpacity={0.8}
              accessibilityLabel="Progress report — needs a code"
            >
              <Ionicons name="document-text-outline" size={15} color={theme.button} />
              <Text style={[styles.dashboardBtnText, { color: theme.button }]}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main content ── */}
        <View style={styles.mainContent}>

          {/* ── Main column ── */}
          <View style={styles.mainColumn}>

            {/* ── Hero section ── */}
            {/* Avatar removed here — it now appears once, in the side
                column above "Your Progress", rather than twice on screen. */}
            <View style={styles.heroSection}>
              <Text style={[styles.heroGreeting, { color: theme.headingText }]}>
                Hello, {student?.full_name}!
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.button }]}>
                Ready to practice writing today?
              </Text>
            </View>

            {/* ── "Your Learning Path" card ── */}
            <View style={[styles.learningPathCard, {
              backgroundColor: pathContent.bg,
              borderColor: pathContent.border,
            }]}>
              {/* Decorative — the student's own avatar, reused rather than a
                  new illustration asset, sitting behind the text as a quiet
                  bit of personality in the corner. */}
              <Image
                source={AVATAR_MAP[student?.avatar_key]}
                style={styles.learningPathAvatar}
                resizeMode="contain"
                pointerEvents="none"
              />
              <View style={styles.learningPathHeader}>
                <View style={styles.learningPathLeft}>
                  <View style={[styles.pathIconBadge, { backgroundColor: pathContent.color + '20' }]}>
                    <Ionicons name={pathContent.icon} size={24} color={pathContent.color} />
                  </View>
                  <View style={styles.learningPathTextCol}>
                    <Text style={[styles.learningPathHeadline, { color: pathContent.color }]}>
                      {pathContent.headline}
                    </Text>
                    <Text style={styles.learningPathDetail}>
                      {pathContent.detail}
                    </Text>
                    {motorProfile && (
                      <Text style={[styles.sequenceTag, { color: pathContent.color + 'CC' }]}>
                        {motorProfile.recommendedSequence}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => requestGatedAction('why')}
                  style={[styles.whyBtn, { borderColor: pathContent.color + '50', backgroundColor: pathContent.color + '12' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="information-circle-outline" size={14} color={pathContent.color} />
                  <Text style={[styles.whyBtnText, { color: pathContent.color }]}>Why?</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Lowercase / Uppercase row ── */}
            <View style={styles.pathRow}>

              {/* Letters card */}
              <TouchableOpacity
                style={styles.lettersCard}
                onPress={() => navigation.navigate('LetterPractice', {
                  student,
                  theme,
                  letterSequence: adaptiveSequence,
                  motorProfile,
                })}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#EFFAEC', '#D8F0D0']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                <CardLandscape variant="letters" />
                <View style={styles.modeIconCircle}>
                  <Text style={styles.aaIconText}>Aa</Text>
                </View>
                <Text style={styles.lettersTitle}>Letters</Text>
                <Text style={styles.modeSubLabel}>{lowercaseProgress} / 26 done</Text>
                <View style={[styles.startBtn, { backgroundColor: '#2E7D32' }]}>
                  <Text style={styles.startBtnText}>Start Practice</Text>
                  <View style={styles.startBtnChevronWrap}>
                    <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Words card — locked until all 26 lowercase AND all 26
                  uppercase letters are authoritatively mastered (backend
                  LetterProgress-derived counts — see wordsUnlocked above).
                  Pre-device P0 fix: onPress itself is now gated, not just
                  the visual dimming — previously the card was cosmetically
                  "locked" but still navigated on every tap regardless of
                  wordsUnlocked. */}
              <TouchableOpacity
                style={styles.wordsCard}
                activeOpacity={wordsUnlocked ? 0.9 : 0.5}
                onPress={() => wordsUnlocked && navigation.navigate('WordLetterSelect', { student, theme })}
              >
                <LinearGradient
                  colors={wordsUnlocked ? ['#F6EEFC', '#E8D6F5'] : ['#F2F2F2', '#E6E6E6']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
                {wordsUnlocked && <CardLandscape variant="words" />}
                <View style={[styles.modeIconCircle, { backgroundColor: wordsUnlocked ? '#EDE7F6' : '#EEEEEE' }]}>
                  <Ionicons
                    name={wordsUnlocked ? 'book-outline' : 'lock-closed'}
                    size={38}
                    color={wordsUnlocked ? '#7B1FA2' : '#AAAAAA'}
                  />
                </View>
                <Text style={[styles.wordsTitle, !wordsUnlocked && { color: '#AAAAAA' }]}>
                  Words
                </Text>
                <Text style={[styles.modeSubLabel, !wordsUnlocked && { color: '#AAAAAA' }]}>
                  {wordsUnlocked ? 'Unlocked!' : 'Finish letters first'}
                </Text>
                {wordsUnlocked ? (
                  <View style={[styles.startBtn, { backgroundColor: '#7B1FA2' }]}>
                    <Text style={styles.startBtnText}>Start Practice</Text>
                    <View style={styles.startBtnChevronWrap}>
                      <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.startBtn, { backgroundColor: '#BBBBBB' }]}>
                    <Ionicons name="lock-closed" size={13} color="#FFFFFF" />
                    <Text style={styles.startBtnText}>Locked</Text>
                  </View>
                )}
              </TouchableOpacity>

            </View>

          </View>

          {/* ── Side column ── */}
          <View style={styles.sideColumn}>

            {/* The student's avatar, moved here from the top bar — sits at
                the top of this column, roughly level with the hero section
                on the left, so the column doesn't start with empty space
                above "Your Progress". No frame/border — just the image. */}
            <View style={styles.sideAvatarCard}>
              <Image
                source={AVATAR_MAP[student?.avatar_key]}
                style={styles.sideAvatarImg}
                resizeMode="contain"
              />
            </View>

            {/* "Your Progress" panel — pushed down by the avatar card above
                it, landing roughly level with the Learning Path / Letters-
                Words cards instead of starting at the very top. */}
            <View style={[styles.progressPanel, { borderColor: theme.button + '25' }]}>
              <View style={styles.progressPanelHeader}>
                <Ionicons name="trophy" size={18} color="#F5A623" />
                <Text style={styles.progressPanelTitle}>Your Progress</Text>
              </View>

              <ProgressRing percent={progressPercent} color={theme.button} />

              <Text style={styles.progressPanelLabel}>Overall Progress</Text>
              <Text style={styles.progressPanelNote}>{progressEncouragement(progressPercent)}</Text>

              <View style={styles.progressPanelStat}>
                <Ionicons name="book-outline" size={14} color={theme.button} />
                <Text style={styles.progressPanelStatText}>{lowercaseProgress} of 26 letters done</Text>
              </View>
            </View>

          </View>

        </View>

        {/* ── Assessment Summary Modal ── */}
        <Modal
          visible={showSummary}
          animationType="slide"
          onRequestClose={() => setShowSummary(false)}
        >
          <LinearGradient
            colors={theme.backgroundGradient}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <SafeAreaView style={styles.safe}>

              {/* Modal header bar */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <View style={[styles.modalTitleIcon, { backgroundColor: theme.button + '20' }]}>
                    <Ionicons name="clipboard-outline" size={18} color={theme.button} />
                  </View>
                  <Text style={[styles.modalTitle, { color: theme.headingText }]}>
                    Assessment Summary
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSummary(false)}
                  style={[styles.modalCloseBtn, { backgroundColor: theme.button + '15' }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={20} color={theme.headingText} />
                </TouchableOpacity>
              </View>

              {/* Main card — fills remaining space, no scroll */}
              <View style={styles.modalCard}>

                {/* Student banner */}
                <View style={[styles.modalStudentBanner, { backgroundColor: theme.button + '0F' }]}>
                  <Image
                    source={AVATAR_MAP[student?.avatar_key]}
                    style={styles.modalStudentAvatar}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={[styles.modalChildName, { color: theme.headingText }]}>
                      {student?.full_name}
                    </Text>
                    <Text style={styles.modalChildSub}>Shape Assessment Results</Text>
                  </View>
                </View>

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
                {summaryShapes.length > 0 ? (
                  <>
                    <View style={styles.modalShapeList}>
                      {summaryShapes.map((item, index) => {
                        const score    = shapeScores[index];
                        const badge    = getScoreBadge(score);
                        const iconName = SHAPE_ICONS[item.shapeId] ?? 'brush-outline';
                        return (
                          <View key={item.shapeId ?? index} style={styles.shapeRow}>
                            <View style={[styles.shapeIconWrap, { backgroundColor: badge.bg }]}>
                              <Ionicons name={iconName} size={18} color={badge.color} />
                            </View>
                            <Text style={styles.shapeName}>
                              {formatShapeName(item.shapeId ?? '')}
                            </Text>
                            <Text style={styles.shapeScoreText}>{score != null ? `${score}%` : 'N/A'}</Text>
                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.badgeText, { color: badge.color }]}>
                                {badge.label}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <OverallScoreCard theme={theme} label="Overall Assessment Score" score={overallShapeScore} />
                  </>
                ) : initialShapesSummary.status === 'loading' ? (
                  <View style={styles.summaryLoadingRow}>
                    <ActivityIndicator size="small" color={theme.button} />
                    <Text style={styles.summaryLoadingText}>Loading assessment results…</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No assessment data available.</Text>
                )}

              </View>

            </SafeAreaView>
          </LinearGradient>
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

  // Decorative background bubbles
  bgBubbleLarge: {
    position: 'absolute',
    top: '-6%',
    right: '-14%',
  },
  bgBubbleMedium: {
    position: 'absolute',
    bottom: '4%',
    left: '-10%',
  },
  bgBubbleSmall: {
    position: 'absolute',
    top: '42%',
    right: '-5%',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  // Column now — no avatar to sit alongside since it moved to the side
  // column (see sideAvatarCard below).
  nameRow: {
    flexDirection: 'column',
  },
  studentName: {
    fontSize: 17,
    fontWeight: '800',
  },
  studentSubLabel: {
    fontSize: 12,
    color: '#888888',
    marginTop: 1,
  },
  topBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dashboardBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Grown-ups-only cluster (Assessment + Progress, both gated) — quiet grey,
  // deliberately smaller and less colorful than Dashboard or the Letters/
  // Words cards, so a child's attention isn't pulled toward controls that
  // aren't meant for them.
  // Main content
  // Two columns: the main choice column (hero + learning path + Letters/
  // Words) alongside a dedicated "Your Progress" side panel — same data as
  // before (progressPercent/lowercaseProgress), just laid out the way a
  // wide tablet screen has room for, instead of a single centered column.
  // No flex:1 here, and alignItems:'stretch' (not 'flex-start') — the two
  // columns should size to match each other (sideColumn stretched to
  // mainColumn's natural content height), not to the full remaining screen
  // height, so "Your Progress" ends up matching the height of [Learning
  // Path card + Letters/Words row] rather than stretching to the bottom of
  // the screen.
  // More outer breathing room (32 → 44), and mainColumn now has a maxWidth
  // (see below) rather than filling all available width — so the whole
  // [mainColumn + sideColumn] block is narrower than the screen and
  // justifyContent:'center' actually has room to center it, instead of
  // mainColumn consuming every pixel up to sideColumn.
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 44,
    paddingTop: 6,
    paddingBottom: 20,
    gap: 20,
  },
  // Capped width so the Letters/Words cards come out closer to square
  // (width roughly matching their height) instead of being stretched wide
  // — also what makes the centering above actually visible. Widened back
  // up from an earlier, too-small 480 to 560. gap widened further (36 →
  // 44) so pathRow's bottom edge lands level with the progress panel's
  // bottom edge, instead of relying on stretching the progress panel
  // (see its own note — that caused a real overflow bug last time).
  mainColumn: {
    flex: 1,
    maxWidth: 560,
    gap: 44,
    alignItems: 'stretch',
  },

  // ── Hero section ──────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    gap: 6,
  },
  heroGreeting: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },

  // ── Learning Path Card ─────────────────────────────────────────────────────
  learningPathCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  learningPathAvatar: {
    position: 'absolute',
    right: -6,
    bottom: -10,
    width: 92,
    height: 92,
    opacity: 0.16,
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
    fontWeight: '800',
  },
  learningPathDetail: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
  },
  sequenceTag: {
    fontSize: 11,
    fontWeight: '700',
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
    fontWeight: '700',
  },

  // ── Letters / Words cards ──────────────────────────────────────────────────
  pathRow: {
    flexDirection: 'row',
    gap: 18,
    width: '100%',
  },

  lettersCard: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    borderRadius: 26,
    paddingVertical: 26,
    paddingHorizontal: 18,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#A5D6A7',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLandscapeSvg: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
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
    fontWeight: '900',
    color: '#2E7D32',
  },
  lettersTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2E7D32',
    zIndex: 1,
  },
  modeSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
    zIndex: 1,
  },
  // The card's real, filled "Start Practice" button — a visual affordance
  // only (the whole card is already the tap target), matching how clearly
  // spelled-out, unambiguous actions help an ASD child know exactly what
  // happens when they tap.
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 24,
    marginTop: 4,
    zIndex: 1,
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '800',
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

  wordsCard: {
    flex: 1,
    backgroundColor: '#F3E5F5',
    borderRadius: 26,
    paddingVertical: 26,
    paddingHorizontal: 18,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#CE93D8',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7B1FA2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  wordsTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#7B1FA2',
    zIndex: 1,
  },

  // ── Side column: avatar + Your Progress panel ──────────────────────────────
  sideColumn: {
    width: 260,
    gap: 18,
  },
  // Fills the vertical gap above the progress panel — roughly level with
  // the hero section on the left, so the side column doesn't start empty.
  // No border/background/shadow — just the image, no card frame around it.
  sideAvatarCard: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideAvatarImg: {
    width: '85%',
    height: '85%',
  },
  // flex:1 (matching the left column's stretched height) turned out
  // unreliable here — a flex-grow child inside a column whose own height
  // is itself content-derived (no ancestor gives mainContent an explicit
  // height) doesn't reliably get a definite size to grow into, and the
  // ring/text ended up overflowing past the card's rounded edges. Sized to
  // its own content instead, with generous padding so nothing is tight;
  // height parity with the left side is now achieved via more generous
  // spacing on the left (see mainColumn's gap) rather than stretching this
  // card to fit. overflow:hidden is a safety net, not the real fix — it
  // should never actually need to clip anything now.
  progressPanel: {
    width: '100%',
    backgroundColor: '#FFFBF0',
    borderRadius: 26,
    borderWidth: 1.5,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  progressPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  progressPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3A2E1F',
  },
  ringPercentText: {
    position: 'absolute',
    fontSize: 22,
    fontWeight: '900',
    color: '#3A2E1F',
  },
  progressPanelLabel: {
    fontSize: 14,
    fontWeight: '800',
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
    fontWeight: '700',
    color: '#555555',
  },
  // ── Assessment Summary Modal ───────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    flex: 1,
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modalStudentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
  },
  modalStudentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  modalChildName: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalChildSub: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  modalShapeList: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
  },
  shapeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shapeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
  },
  shapeScoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#666666',
    marginRight: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  overallIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overallLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  overallValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
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
    color: '#888888',
  },
  emptyText: {
    fontSize: 14,
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
    fontWeight: '900',
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
    fontWeight: '700',
    color: '#1A1A1A',
  },
  xaiCloseBtn: {
    borderRadius: 50,
    paddingVertical: 12,
    alignItems: 'center',
  },
  xaiCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
