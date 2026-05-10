import React, { useState, useEffect } from 'react';
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
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function ProgressReportScreen({ route, navigation }) {
  const {
    student,
    theme,
    lowercaseProgress: initLow = 0,
    uppercaseProgress: initUp  = 0,
  } = route.params;

  const { width } = useWindowDimensions();
  const [report, setReport] = useState(null);

  useEffect(() => {
    client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
      .then(res => setReport(res.data))
      .catch(() => setReport({
        lowercase_completed:   initLow,
        uppercase_completed:   initUp,
        next_lowercase_letter: LETTERS[initLow] ?? null,
        reason:                'Continue regular letter practice.',
      }));
  }, [student.sid]);

  const lowercase  = report?.lowercase_completed   ?? initLow;
  const uppercase  = report?.uppercase_completed   ?? initUp;
  const nextLetter = report?.next_lowercase_letter ?? (lowercase < 26 ? LETTERS[lowercase] : null);
  const reason     = report?.reason                ?? 'Continue regular letter practice.';

  const lowercasePercent = Math.min(100, Math.round((lowercase / 26) * 100));
  const uppercasePercent = Math.min(100, Math.round((uppercase / 26) * 100));
  const lowercaseDone    = lowercase >= 26;

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

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.button + '18' }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>
            Progress Report
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Main card ── */}
        <View style={styles.content}>
          <View style={styles.card}>

            {/* Student banner */}
            <View style={[styles.studentBanner, { backgroundColor: theme.button + '10' }]}>
              <Image
                source={AVATAR_MAP[student?.avatar_key]}
                style={styles.bannerAvatar}
                resizeMode="contain"
              />
              <View style={styles.bannerText}>
                <Text style={[styles.bannerName, { color: theme.headingText }]}>
                  {student?.full_name}
                </Text>
                <Text style={styles.bannerSub}>Letter Progress</Text>
              </View>
              <View style={[styles.overallBadge, { backgroundColor: theme.button }]}>
                <Text style={[styles.overallBadgeValue, { color: theme.buttonText }]}>
                  {lowercasePercent}%
                </Text>
                <Text style={[styles.overallBadgeLabel, { color: theme.buttonText }]}>
                  Overall
                </Text>
              </View>
            </View>

            {/* ── Lowercase section ── */}
            <View style={[styles.sectionCard, { borderColor: '#A5D6A7', backgroundColor: '#F1F8E9' }]}>

              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: '#DCEDC8' }]}>
                  <Ionicons name="text-outline" size={20} color="#2E7D32" />
                </View>
                <View style={styles.sectionTitleCol}>
                  <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Lowercase Letters</Text>
                  <Text style={styles.sectionSub}>{lowercase} / 26 letters completed</Text>
                </View>
                {lowercaseDone ? (
                  <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                ) : (
                  <Text style={[styles.sectionPercent, { color: '#2E7D32' }]}>{lowercasePercent}%</Text>
                )}
              </View>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${lowercasePercent}%`, backgroundColor: '#4CAF50' }]} />
              </View>

              <View style={styles.detailRow}>
                {nextLetter && !lowercaseDone && (
                  <View style={styles.nextLetterBadge}>
                    <Text style={styles.nextLetterLabel}>Next Letter</Text>
                    <Text style={[styles.nextLetterValue, { color: '#2E7D32' }]}>{nextLetter}</Text>
                  </View>
                )}
                <View style={styles.reasonRow}>
                  <Ionicons name="information-circle-outline" size={15} color="#66BB6A" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              </View>

            </View>

            {/* ── Uppercase section ── */}
            <View style={[
              styles.sectionCard,
              lowercaseDone
                ? { borderColor: '#CE93D8', backgroundColor: '#F3E5F5' }
                : { borderColor: '#E0E0E0', backgroundColor: '#F8F8F8' },
            ]}>

              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, {
                  backgroundColor: lowercaseDone ? '#E1BEE7' : '#EEEEEE',
                }]}>
                  <Ionicons
                    name={lowercaseDone ? 'arrow-up-circle-outline' : 'lock-closed'}
                    size={20}
                    color={lowercaseDone ? '#7B1FA2' : '#AAAAAA'}
                  />
                </View>
                <View style={styles.sectionTitleCol}>
                  <Text style={[styles.sectionTitle, {
                    color: lowercaseDone ? '#7B1FA2' : '#AAAAAA',
                  }]}>
                    Uppercase Letters
                  </Text>
                  <Text style={styles.sectionSub}>
                    {lowercaseDone
                      ? `${uppercase} / 26 letters completed`
                      : 'Complete all lowercase to unlock'}
                  </Text>
                </View>
                {lowercaseDone && (
                  <Text style={[styles.sectionPercent, { color: '#7B1FA2' }]}>
                    {uppercasePercent}%
                  </Text>
                )}
              </View>

              {lowercaseDone && (
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${uppercasePercent}%`, backgroundColor: '#AB47BC' }]} />
                </View>
              )}

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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },

  // Student banner
  studentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 14,
  },
  bannerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 20,
    fontWeight: '900',
  },
  bannerSub: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  overallBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  overallBadgeValue: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  overallBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Section cards
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitleCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  sectionPercent: {
    fontSize: 20,
    fontWeight: '900',
    flexShrink: 0,
  },

  // Progress bar
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },

  // Detail row (next letter + reason)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nextLetterBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  nextLetterLabel: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '600',
  },
  nextLetterValue: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  reasonRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
  },
});