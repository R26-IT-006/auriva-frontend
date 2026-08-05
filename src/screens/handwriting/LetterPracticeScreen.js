import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function LetterPracticeScreen({ route, navigation }) {
  const { student, theme, letterSequence = [], motorProfile = null } = route.params;
  const { width } = useWindowDimensions();

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
      {/* Decorative background bubbles */}
      <View style={[styles.bgBubbleLarge, {
        backgroundColor: theme.button + '0E',
        width: width * 0.45, height: width * 0.45, borderRadius: width * 0.225,
      }]} />
      <View style={[styles.bgBubbleMedium, {
        backgroundColor: theme.button + '09',
        width: width * 0.28, height: width * 0.28, borderRadius: width * 0.14,
      }]} />
      <View style={[styles.bgBubbleSmall, {
        backgroundColor: theme.button + '07',
        width: width * 0.16, height: width * 0.16, borderRadius: width * 0.08,
      }]} />

      <SafeAreaView style={styles.safe}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={styles.nameRow}>
            <View style={[styles.avatarRing, { borderColor: theme.button + '40' }]}>
              <Image
                source={AVATAR_MAP[student?.avatar_key]}
                style={styles.avatarImg}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[styles.studentName, { color: theme.headingText }]}>
                {student?.full_name}
              </Text>
              <Text style={styles.studentSubLabel}>Letter Practice</Text>
            </View>
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
            <Ionicons name="document-text-outline" size={14} color={theme.buttonText} />
            <Text style={[styles.reportBtnText, { color: theme.buttonText }]}>
              View Progress Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Main content ── */}
        <View style={styles.content}>

          {/* Hero section */}
          <View style={styles.heroSection}>
            <Image
              source={AVATAR_MAP[student?.avatar_key]}
              style={styles.heroAvatar}
              resizeMode="contain"
            />
            <Text style={[styles.heroGreeting, { color: theme.headingText }]}>
              Choose your practice!
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.button }]}>
              What would you like to write today?
            </Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>

            {/* Progress section */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressHeaderLeft}>
                  <Ionicons name="trophy-outline" size={18} color="#F57F17" />
                  <Text style={styles.progressHeaderText}>
                    Lowercase: {lowercaseProgress} / 26 completed
                  </Text>
                </View>
                <Text style={styles.progressPercent}>{lowercasePercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${lowercasePercent}%` }]} />
              </View>
            </View>

            {/* ── Pills row ── */}
            <View style={styles.pillsRow}>

              {/* Lowercase — always unlocked */}
              <TouchableOpacity
                style={styles.lowercasePill}
                onPress={() => navigation.navigate('LetterWriting', {
                  student, theme, caseType: 'lowercase', letterSequence, motorProfile,
                })}
                activeOpacity={0.85}
              >
                <View style={styles.pillIconCircle}>
                  <Ionicons name="text-outline" size={32} color="#1B5E20" />
                </View>
                <Text style={styles.lowercaseTitle}>Lowercase</Text>
                <Text style={styles.pillSubLabel}>{lowercaseProgress} / 26 done</Text>
              </TouchableOpacity>

              {/* Uppercase — locked until lowercase done */}
              <TouchableOpacity
                style={[styles.uppercasePill, !lowercaseDone && styles.uppercaseLocked]}
                onPress={() => navigation.navigate('UppercaseWriting', {
                  student, theme, letterSequence, motorProfile,
                })}
                activeOpacity={0.85}
              >
                <View style={[
                  styles.pillIconCircle,
                  { backgroundColor: lowercaseDone ? '#CE93D8' : '#E0E0E0' },
                ]}>
                  <Ionicons
                    name={lowercaseDone ? 'arrow-up-circle-outline' : 'lock-closed'}
                    size={32}
                    color={lowercaseDone ? '#4A148C' : '#9E9E9E'}
                  />
                </View>
                <Text style={[styles.uppercaseTitle, !lowercaseDone && styles.lockedText]}>
                  Uppercase
                </Text>
                {lowercaseDone ? (
                  <Text style={styles.pillSubLabel}>Ready to go!</Text>
                ) : (
                  <Text style={[styles.pillSubLabel, styles.lockedSubLabel]}>
                    Finish all lowercase{'\n'}letters to unlock
                  </Text>
                )}
              </TouchableOpacity>

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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 20,
  },

  // Hero section
  heroSection: {
    alignItems: 'center',
    gap: 6,
  },
  heroAvatar: {
    width: 100,
    height: 100,
    marginBottom: 4,
  },
  heroGreeting: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    gap: 18,
  },

  // Progress section
  progressSection: {
    gap: 8,
  },
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
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#EEEEEE',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },

  // Pills row
  pillsRow: {
    flexDirection: 'row',
    gap: 14,
  },

  // Lowercase pill
  lowercasePill: {
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
  pillIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#DCEDC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowercaseTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E7D32',
  },
  pillSubLabel: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Uppercase pill
  uppercasePill: {
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
  uppercaseLocked: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDDDDD',
    shadowOpacity: 0,
    elevation: 0,
  },
  uppercaseTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4A148C',
  },
  lockedText: {
    color: '#AAAAAA',
  },
  lockedSubLabel: {
    color: '#BBBBBB',
  },
});