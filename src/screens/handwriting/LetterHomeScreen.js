import React, { useState } from 'react';
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

const AVATAR_MAP = {
  boba: require('../../../assets/avatar-images/Boba.png'),
  glitter: require('../../../assets/avatar-images/Glitter.png'),
  lily: require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

const SHAPE_EMOJI = {
  horizontal_line: '━',
  vertical_line: '┃',
  full_circle: '○',
  half_circle: '⌒',
  zigzag: '〰',
  curve_wave: '∿',
};

function formatShapeName(key) {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getBadge(smoothness) {
  if (smoothness < 20) return { label: 'Good', bg: '#E8F5E9', color: '#2E7D32' };
  if (smoothness < 40) return { label: 'Needs practice', bg: '#FFF3E0', color: '#E65100' };
  return { label: 'Moderate', bg: '#FFFDE7', color: '#F57F17' };
}

function getOverallLabel(avgSmoothness) {
  if (avgSmoothness < 20) return 'Good';
  if (avgSmoothness < 40) return 'Needs practice';
  return 'Moderate';
}

// Derives a two-stop gradient from the theme's background + cardOutline tint.
function getBgGradient(theme) {
  return [theme.background, theme.cardOutline + '28'];
}

export default function LetterHomeScreen({ route, navigation }) {
  const { student, theme, assessmentData = [] } = route.params;

  const [showSummary, setShowSummary] = useState(false);
  const [letterProgress] = useState(0); // 0–26; replace with stored progress when available

  const bgGradient = getBgGradient(theme);
  const buttonColor = theme.primaryButton;

  const avgSmoothness =
    assessmentData.length > 0
      ? assessmentData.reduce((sum, s) => sum + (s.smoothness ?? 0), 0) / assessmentData.length
      : 0;

  const progressPercent = Math.round((letterProgress / 26) * 100);

  return (
    <LinearGradient colors={bgGradient} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>

        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          {/* Left: avatar + name */}
          <View style={styles.nameRow}>
            <Image
              source={AVATAR_MAP[student.avatar_key]}
              style={styles.avatarImg}
            />
            <Text style={[styles.studentName, { color: theme.headingText }]}>
              {student.full_name}
            </Text>
          </View>

          {/* Right: Assessment Summary button */}
          <TouchableOpacity
            style={[
              styles.summaryBtn,
              {
                backgroundColor: theme.cardOutline + '30',
                borderColor: buttonColor,
              },
            ]}
            onPress={() => setShowSummary(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.summaryBtnText, { color: buttonColor }]}>
              Assessment Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── MAIN CONTENT ── */}
        <View style={styles.content}>
          <View style={styles.card}>

            {/* Learning path cards row */}
            <View style={styles.pathRow}>

              {/* Letters card (unlocked) */}
              <TouchableOpacity
                style={styles.lettersCard}
                onPress={() => navigation.navigate('LetterPractice', { student, theme })}
                activeOpacity={0.85}
              >
                <Text style={styles.lettersTitle}>Letters</Text>

                {/* Progress bar */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {letterProgress} / 26 letters
                </Text>
              </TouchableOpacity>

              {/* Words card (locked) */}
              <TouchableOpacity
                style={styles.wordsCard}
                disabled
                activeOpacity={1}
              >
                <Text style={styles.wordsTitle}>Words</Text>
                <Ionicons
                  name="lock-closed"
                  size={32}
                  color="#7B1FA2"
                  style={styles.lockIcon}
                />
                <Text style={styles.wordsNote}>
                  *Complete all letter categories to unlock words.
                </Text>
              </TouchableOpacity>

            </View>

            {/* Footer note */}
            <Text style={styles.footerNote}>
              Complete each letter to track your progress and unlock new content.
            </Text>

          </View>
        </View>

        {/* ── ASSESSMENT SUMMARY MODAL ── */}
        <Modal
          visible={showSummary}
          animationType="slide"
          onRequestClose={() => setShowSummary(false)}
        >
          <LinearGradient colors={bgGradient} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.headingText }]}>
                  Assessment Summary
                </Text>
                <TouchableOpacity onPress={() => setShowSummary(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={theme.headingText} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalCard}>

                  {/* Child name */}
                  <Text style={[styles.modalChildName, { color: theme.headingText }]}>
                    {student.full_name}
                  </Text>

                  {/* Shape rows */}
                  {assessmentData.map((item, index) => {
                    const badge = getBadge(item.smoothness ?? 0);
                    const emoji = SHAPE_EMOJI[item.shape_type] ?? '◆';
                    return (
                      <View key={item.shape_type ?? index} style={styles.shapeRow}>
                        <Text style={styles.shapeEmoji}>{emoji}</Text>
                        <Text style={styles.shapeName}>
                          {formatShapeName(item.shape_type ?? '')}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.color }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Overall summary */}
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

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },

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

  // Main content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '85%',
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

  // Learning path row
  pathRow: {
    flexDirection: 'row',
    gap: 20,
  },

  // Letters card
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
    backgroundColor: 'rgba(255,255,255,0.5)',
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

  // Words card
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
    opacity: 0.6,
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

  // Footer note
  footerNote: {
    marginTop: 20,
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal
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

  // Shape rows
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

  // Overall summary card
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
});
