import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';

const AVATAR_EMOJI = {
  boba:     '🧋',
  glitter:  '✨',
  lily:     '🌸',
  megatron: '🤖',
};

export default function LetterPracticeScreen({ route, navigation }) {
  const { student, theme, letterSequence = [], motorProfile = null } = route.params;

  const [lowercaseProgress, setLowercaseProgress] = useState(0);
  const [uppercaseProgress, setUppercaseProgress] = useState(0);

  useFocusEffect(
    useCallback(() => {
      client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
        .then(res => {
          setLowercaseProgress(res.data.lowercase_completed ?? 0);
          setUppercaseProgress(res.data.uppercase_completed ?? 0);
        })
        .catch(() => {});
    }, [student.sid])
  );

  const lowercaseDone    = lowercaseProgress >= 26;
  const lowercasePercent = Math.min(100, Math.round((lowercaseProgress / 26) * 100));

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
            <Text style={styles.avatarEmoji}>
              {AVATAR_EMOJI[student?.avatar_key] ?? '😊'}
            </Text>
            <Text style={[styles.studentName, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: theme.button }]}
            onPress={() => navigation.navigate('ProgressReport', {
              student,
              theme,
              lowercaseProgress,
              uppercaseProgress,
            })}
            activeOpacity={0.8}
          >
            <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>
              View Progress Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Main card ── */}
        <View style={styles.content}>
          <View style={styles.card}>

            <View style={styles.pillsRow}>

              {/* Lowercase — always unlocked */}
              <TouchableOpacity
                style={styles.lowercasePill}
                onPress={() => navigation.navigate('LetterWriting', {
                  student, theme, caseType: 'lowercase', letterSequence, motorProfile,
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.lowercaseText}>Lowercase</Text>
              </TouchableOpacity>

              {/* Uppercase — always tappable for demo; lock icon shown until lowercase done */}
              <TouchableOpacity
                style={[styles.uppercasePill, !lowercaseDone && styles.pillLocked]}
                onPress={() => navigation.navigate('UppercaseWriting', {
                  student, theme, letterSequence, motorProfile,
                })}
                activeOpacity={0.85}
              >
                <Text style={styles.uppercaseText}>Uppercase</Text>
                {!lowercaseDone && (
                  <Ionicons name="lock-closed" size={18} color="#6A1B9A" style={styles.lockIcon} />
                )}
              </TouchableOpacity>

            </View>

            {/* Progress bar — below lowercase */}
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${lowercasePercent}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                {lowercaseProgress} / 26 letters completed
              </Text>
            </View>

          </View>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

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
    gap: 8,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
  },
  reportBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '85%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },

  pillsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },

  lowercasePill: {
    flex: 1,
    backgroundColor: '#AAFF96',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
  },
  lowercaseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B5E20',
  },

  uppercasePill: {
    flex: 1,
    backgroundColor: '#D9AAFF',
    borderRadius: 50,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillLocked: {
    opacity: 0.55,
  },
  uppercaseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4A148C',
  },
  lockIcon: {
    marginTop: 1,
  },

  progressSection: {
    gap: 6,
  },
  progressTrack: {
    width: '55%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 13,
    color: '#666666',
  },
});
