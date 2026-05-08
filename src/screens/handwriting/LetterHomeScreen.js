import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
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

const SHAPE_EMOJI = {
  horizontal_line: '━',
  vertical_line:   '┃',
  full_circle:     '○',
  half_circle:     '⌒',
  zigzag:          '〰',
  curve_wave:      '∿',
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

// ─── Learning-path card content ───────────────────────────────────────────────
// Returns the icon, headline, and detail sentence for the motor profile summary.

function getLearningPathContent(primaryStrength) {
  switch (primaryStrength) {
    case 'straight':
      return {
        icon:    '━',
        headline: "Great at straight lines!",
        detail:   "We'll start with letters like l, i, t that use the strokes you already control well.",
        color:    '#1565C0',
        bg:       '#E3F2FD',
      };
    case 'curved':
      return {
        icon:    '○',
        headline: "Smooth, confident curves!",
        detail:   "We'll start with letters like o, c, e that match your circle and arc strength.",
        color:    '#6A1B9A',
        bg:       '#F3E5F5',
      };
    default:
      return {
        icon:    '✓',
        headline: "Well-rounded motor skills!",
        detail:   "You're balanced across all strokes. We'll practise step by step, easy to hard.",
        color:    '#2E7D32',
        bg:       '#E8F5E9',
      };
  }
}

// ─── XAI explanation text (proposal Section 137) ─────────────────────────────
// Explains, in plain language, why letters are ordered the way they are.

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

  const [showSummary,       setShowSummary]       = useState(false);
  const [showWhyModal,      setShowWhyModal]       = useState(false);
  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [motorProfile,      setMotorProfile]      = useState(passedProfile);
  const [adaptiveSequence,  setAdaptiveSequence]  = useState([]);

  useFocusEffect(
    useCallback(() => {
      // Refresh live progress from backend
      client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
        .then(res => setLowercaseProgress(res.data.lowercase_completed ?? 0))
        .catch(() => {});

      // Load adaptive sequence + motor profile from storage
      // (set by AssessmentCompleteScreen after the initial assessment)
      getLetterSequence(student.sid)
        .then(seq => { if (seq) setAdaptiveSequence(seq); })
        .catch(() => {});

      getMotorProfile(student.sid)
        .then(profile => {
          if (profile) {
            setMotorProfile(profile);
            // Persist for teacher report (assessmentData comes from route params)
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
      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={styles.nameRow}>
            <Image source={AVATAR_MAP[student?.avatar_key]} style={styles.avatarImg} />
            <Text style={[styles.studentName, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
          </View>

          <View style={styles.topBtnGroup}>
            <TouchableOpacity
              style={[styles.summaryBtn, {
                backgroundColor: theme.cardOutline + '30',
                borderColor: theme.button,
              }]}
              onPress={() => setShowSummary(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.summaryBtnText, { color: theme.button }]}>
                Assessment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportBtn, { backgroundColor: theme.button }]}
              onPress={() => navigation.navigate('TeacherReport', { student, theme })}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
              <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>
                Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ── "Your Learning Path" card ── */}
          <View style={[styles.learningPathCard, {
            borderLeftColor: theme.button,
            backgroundColor: pathContent.bg,
          }]}>
            <View style={styles.learningPathHeader}>
              <Text style={[styles.learningPathTitle, { color: theme.headingText }]}>
                Your Personalised Learning Path
              </Text>
              <TouchableOpacity
                onPress={() => setShowWhyModal(true)}
                style={[styles.whyBtn, { borderColor: theme.button }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.whyBtnText, { color: theme.button }]}>
                  Why this order?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.learningPathBody}>
              <Text style={styles.learningPathIcon}>{pathContent.icon}</Text>
              <View style={styles.learningPathTextCol}>
                <Text style={[styles.learningPathHeadline, { color: pathContent.color }]}>
                  {pathContent.headline}
                </Text>
                <Text style={styles.learningPathDetail}>
                  {pathContent.detail}
                </Text>
                {motorProfile && (
                  <Text style={[styles.sequenceTag, { color: theme.button }]}>
                    {motorProfile.recommendedSequence}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Letters / Words card ── */}
          <View style={styles.card}>

            <View style={styles.pathRow}>

              {/* Letters card — always unlocked */}
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
                <Text style={styles.lettersTitle}>Letters</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{lowercaseProgress} / 26 letters</Text>
              </TouchableOpacity>

              {/* Words card — always tappable for demo; lock icon shown until lowercase done */}
              <TouchableOpacity
                style={[styles.wordsCard, !wordsUnlocked && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('WordLetterSelect', { student, theme })}
              >
                <Text style={styles.wordsTitle}>Words</Text>
                {!wordsUnlocked ? (
                  <>
                    <Ionicons name="lock-closed" size={32} color="#7B1FA2" style={styles.lockIcon} />
                    <Text style={styles.wordsNote}>
                      Complete all lowercase letters to unlock words.
                    </Text>
                  </>
                ) : (
                  <Ionicons name="checkmark-circle" size={32} color="#7B1FA2" style={styles.lockIcon} />
                )}
              </TouchableOpacity>

            </View>

            {/* Word progress link for teacher */}
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
              Complete each letter to track your progress and unlock new content.
            </Text>
          </View>

        </ScrollView>

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

              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.headingText }]}>
                  Assessment Summary
                </Text>
                <TouchableOpacity
                  onPress={() => setShowSummary(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={24} color={theme.headingText} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalCard}>

                  <Text style={[styles.modalChildName, { color: theme.headingText }]}>
                    {student?.full_name}
                  </Text>

                  {assessmentData.map((item, index) => {
                    const badge = getBadge(item.features?.smoothness ?? 0);
                    const emoji = SHAPE_EMOJI[item.shapeId] ?? '◆';
                    return (
                      <View key={item.shapeId ?? index} style={styles.shapeRow}>
                        <Text style={styles.shapeEmoji}>{emoji}</Text>
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

                  {assessmentData.length > 0 && (
                    <View style={[styles.overallCard, { backgroundColor: theme.background }]}>
                      <Text style={[styles.overallText, { color: theme.headingText }]}>
                        Overall motor control:{' '}
                        <Text style={styles.overallValue}>
                          {getOverallLabel(avgSmoothness)}
                        </Text>
                      </Text>
                    </View>
                  )}

                  {assessmentData.length === 0 && (
                    <Text style={styles.emptyText}>No assessment data available.</Text>
                  )}

                </View>
              </ScrollView>

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

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  summaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 20,
  },

  // ── Learning Path Card ─────────────────────────────────────────────────────
  learningPathCard: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
  },
  learningPathHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  learningPathTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  whyBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  whyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  learningPathBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  learningPathIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  learningPathTextCol: {
    flex: 1,
    gap: 4,
  },
  learningPathHeadline: {
    fontSize: 15,
    fontWeight: '800',
  },
  learningPathDetail: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
  },
  sequenceTag: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // ── Letters / Words card ───────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  pathRow: {
    flexDirection: 'row',
    gap: 20,
  },
  lettersCard: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    padding: 24,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#66BB6A',
  },
  lettersTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E7D32',
    marginBottom: 8,
  },
  progressTrack: {
    width: '90%',
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    backgroundColor: '#4CAF50',
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#555555',
  },
  wordsCard: {
    flex: 1,
    backgroundColor: '#F3E5F5',
    borderRadius: 20,
    padding: 24,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CE93D8',
  },
  wordsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7B1FA2',
    marginBottom: 8,
  },
  lockIcon: {
    marginBottom: 8,
  },
  wordsNote: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  progressLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  progressLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B1FA2',
  },
  footerNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Assessment Summary Modal ───────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalScroll: {
    paddingBottom: 32,
  },
  modalCard: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  modalChildName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  shapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  shapeEmoji: {
    fontSize: 20,
    width: 30,
  },
  shapeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  overallCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  overallText: {
    fontSize: 14,
    fontWeight: '500',
  },
  overallValue: {
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
  },

  // ── XAI "Why this order?" Modal ───────────────────────────────────────────
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
