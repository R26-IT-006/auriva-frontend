import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { getLetterSequence, getMotorProfile } from '../../utils/storage';
import { recordAssessmentSnapshot } from '../../constants/sessionProgress';

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

function getBadge(smoothness) {
  if (smoothness < 0.15) return { label: 'Good',           bg: '#E8F5E9', color: '#2E7D32' };
  if (smoothness < 0.4)  return { label: 'Moderate',       bg: '#FFFDE7', color: '#F57F17' };
  return                        { label: 'Needs practice',  bg: '#FFF3E0', color: '#E65100' };
}

function getOverallLabel(avg) {
  if (avg < 0.15) return 'Good';
  if (avg < 0.4)  return 'Moderate';
  return 'Needs practice';
}

function getLearningPathContent(primaryStrength) {
  switch (primaryStrength) {
    case 'straight':
      return {
        icon:    '━',
        headline: "Great at straight lines!",
        detail:   "We'll start with letters like l, i, t that use the strokes you already control well.",
        color:    '#1565C0',
        bg:       '#E3F2FD',
        border:   '#90CAF9',
      };
    case 'curved':
      return {
        icon:    '○',
        headline: "Smooth, confident curves!",
        detail:   "We'll start with letters like o, c, e that match your circle and arc strength.",
        color:    '#6A1B9A',
        bg:       '#F3E5F5',
        border:   '#CE93D8',
      };
    default:
      return {
        icon:    '✓',
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
  const [motorProfile,      setMotorProfile]      = useState(passedProfile);
  const [adaptiveSequence,  setAdaptiveSequence]  = useState([]);

  useFocusEffect(
    useCallback(() => {
      client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
        .then(res => setLowercaseProgress(res.data.lowercase_completed ?? 0))
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
    }, [student.sid])
  );

  const progressPercent = Math.min(100, Math.round((lowercaseProgress / 26) * 100));
  const wordsUnlocked   = lowercaseProgress >= 26;

  const avgSmoothness = assessmentData.length > 0
    ? assessmentData.reduce((sum, s) => sum + (s.features?.smoothness ?? 0), 0) / assessmentData.length
    : 0;

  const pathContent = getLearningPathContent(motorProfile?.primaryStrength ?? 'balanced');

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
          <View style={styles.nameRow}>
            <View style={[styles.avatarRing, { borderColor: theme.button + '40' }]}>
              <Image source={AVATAR_MAP[student?.avatar_key]} style={styles.avatarImg} />
            </View>
            <View>
              <Text style={[styles.studentName, { color: theme.headingText }]}>
                {student?.full_name}
              </Text>
              <Text style={styles.studentSubLabel}>Letter Writing</Text>
            </View>
          </View>

          <View style={styles.topBtnGroup}>
            <TouchableOpacity
              style={[styles.summaryBtn, {
                backgroundColor: theme.button + '14',
                borderColor: theme.button + '40',
              }]}
              onPress={() => setShowSummary(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="clipboard-outline" size={14} color={theme.button} />
              <Text style={[styles.summaryBtnText, { color: theme.button }]}>Assessment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportBtn, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('TeacherReport', { student, theme })}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
              <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>
                View Progress Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main content ── */}
        <View style={styles.mainContent}>

          {/* ── Hero section ── */}
          <View style={styles.heroSection}>
            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.heroAvatar}
              resizeMode="contain"
            />
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
            <View style={styles.learningPathHeader}>
              <View style={styles.learningPathLeft}>
                <View style={[styles.pathIconBadge, { backgroundColor: pathContent.color + '20' }]}>
                  <Text style={styles.learningPathIcon}>{pathContent.icon}</Text>
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
                onPress={() => setShowWhyModal(true)}
                style={[styles.whyBtn, { borderColor: pathContent.color + '50', backgroundColor: pathContent.color + '12' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle-outline" size={14} color={pathContent.color} />
                <Text style={[styles.whyBtnText, { color: pathContent.color }]}>Why?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Main Lowercase / Uppercase card ── */}
          <View style={styles.card}>

            {/* Progress header inside card */}
            <View style={styles.progressHeader}>
              <View style={styles.progressHeaderLeft}>
                <Ionicons name="trophy-outline" size={20} color="#F57F17" />
                <Text style={styles.progressHeaderText}>
                  Letters: {lowercaseProgress} / 26 completed
                </Text>
              </View>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrackWide}>
              <View style={[styles.progressFillWide, { width: `${progressPercent}%` }]} />
            </View>

            {/* Lowercase / Uppercase row */}
            <View style={styles.pathRow}>

              {/* Lowercase card */}
              <TouchableOpacity
                style={styles.lettersCard}
                onPress={() => navigation.navigate('LetterPractice', {
                  student,
                  theme,
                  letterSequence: adaptiveSequence,
                  motorProfile,
                })}
                activeOpacity={0.85}
              >
                <View style={styles.modeIconCircle}>
                  <Ionicons name="text-outline" size={34} color="#2E7D32" />
                </View>
                <Text style={styles.lettersTitle}>Letters</Text>
                <Text style={styles.modeSubLabel}>{lowercaseProgress} / 26 done</Text>
              </TouchableOpacity>

              {/* Words card — locked until all lowercase completed */}
              <TouchableOpacity
                style={styles.wordsCard}
                activeOpacity={wordsUnlocked ? 0.85 : 0.5}
                onPress={() => navigation.navigate('WordLetterSelect', { student, theme })}
              >
                <View style={[styles.modeIconCircle, { backgroundColor: wordsUnlocked ? '#EDE7F6' : '#EEEEEE' }]}>
                  <Ionicons
                    name={wordsUnlocked ? 'book-outline' : 'lock-closed'}
                    size={34}
                    color={wordsUnlocked ? '#7B1FA2' : '#AAAAAA'}
                  />
                </View>
                <Text style={[styles.wordsTitle, !wordsUnlocked && { color: '#AAAAAA' }]}>
                  Words
                </Text>
                <Text style={[styles.modeSubLabel, !wordsUnlocked && { color: '#AAAAAA' }]}>
                  {wordsUnlocked ? 'Unlocked!' : 'Finish letters first'}
                </Text>
              </TouchableOpacity>

            </View>

            {/* Word progress link */}
            <TouchableOpacity
              style={styles.progressLink}
              onPress={() => navigation.navigate('WordProgress', { student, theme })}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={15} color="#7B1FA2" />
              <Text style={styles.progressLinkText}>View Word Progress</Text>
              <Ionicons name="chevron-forward" size={14} color="#7B1FA2" />
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Complete all 26 Letters to unlock the Words section.
            </Text>

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

                {/* Shape rows — fills available space evenly */}
                <View style={styles.modalShapeList}>
                  {assessmentData.map((item, index) => {
                    const badge    = getBadge(item.features?.smoothness ?? 0);
                    const iconName = SHAPE_ICONS[item.shapeId] ?? 'brush-outline';
                    return (
                      <View key={item.shapeId ?? index} style={styles.shapeRow}>
                        <View style={[styles.shapeIconWrap, { backgroundColor: badge.bg }]}>
                          <Ionicons name={iconName} size={18} color={badge.color} />
                        </View>
                        <Text style={styles.shapeName}>
                          {formatShapeName(item.shapeId ?? '')}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.color }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Overall motor control card */}
                {assessmentData.length > 0 && (
                  <View style={[styles.overallCard, {
                    backgroundColor: theme.button + '10',
                    borderColor:     theme.button + '25',
                  }]}>
                    <View style={[styles.overallIconWrap, { backgroundColor: theme.button + '20' }]}>
                      <Ionicons name="analytics-outline" size={22} color={theme.button} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overallLabel}>Overall motor control</Text>
                      <Text style={[styles.overallValue, { color: theme.headingText }]}>
                        {getOverallLabel(avgSmoothness)}
                      </Text>
                    </View>
                  </View>
                )}

                {assessmentData.length === 0 && (
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
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Main content
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 20,
    gap: 18,
    alignItems: 'center',
  },

  // ── Hero section ──────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    gap: 6,
  },
  heroAvatar: {
    width: 100,
    height: 100,
    marginBottom: 6,
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
    maxWidth: 620,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  learningPathIcon: {
    fontSize: 22,
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

  // ── Letters / Words card ───────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    gap: 16,
  },

  // Progress header
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444444',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4CAF50',
  },
  progressTrackWide: {
    width: '100%',
    height: 10,
    backgroundColor: '#EEEEEE',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: -8,
  },
  progressFillWide: {
    backgroundColor: '#4CAF50',
    height: '100%',
    borderRadius: 5,
  },

  pathRow: {
    flexDirection: 'row',
    gap: 16,
  },

  lettersCard: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#A5D6A7',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  modeIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DCEDC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettersTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E7D32',
  },
  modeSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
  },

  wordsCard: {
    flex: 1,
    backgroundColor: '#F3E5F5',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#CE93D8',
    shadowColor: '#7B1FA2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  wordsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7B1FA2',
  },
  progressLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  progressLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B1FA2',
  },
  footerNote: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -6,
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