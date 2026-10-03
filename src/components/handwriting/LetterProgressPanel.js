/**
 * LetterProgressPanel.js
 *
 * The child's letter progress — name banner (Done / Next / Total), then a
 * Lowercase and an Uppercase section, each with its bar and Next Letter
 * badge. Shown in LetterPracticeScreen's Progress pop-up; this used to be
 * the body of ProgressReportScreen (which now renders this same panel), so
 * there is one copy of the data reads and the next-letter rule, not two.
 *
 * Owns its own reads (LETTER_PROGRESS + mastered letters) so it shows fresh
 * numbers each time it mounts — the pop-up only mounts its content while
 * open. initLow / initUp are the caller's last-known counts, shown until the
 * read resolves and kept if it fails.
 */

'use strict';

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import { fetchMasteredLetters, filterUnmasteredSequence } from '../../utils/masteredLetterFiltering';
import { getAllLetters } from '../../data/letterCategories';

/**
 * The next letter to write — the first entry of the student's own sequence
 * that is not yet mastered.
 *
 * This is deliberately NOT `alphabet[completedCount]`, which is what this
 * screen and the backend's next_*_letter fields both did. That is only ever
 * right when the child works straight down the alphabet with no gaps, and
 * neither assumption holds: the sequence is adaptive (generateAdaptiveSequence
 * orders by motor category, not A-Z), and a letter can be left unmastered
 * while later ones are completed, so the count says nothing about WHICH letter
 * comes next. A child resuming at, say, 'c' would be told to write 'e' simply
 * because four letters happened to be done.
 *
 * Same two helpers, same order of operations, as LetterWritingScreen and
 * UppercaseWritingScreen — so the letter shown here is the letter that screen
 * will actually present.
 */
function deriveNextLetter(letterSequence, caseType, masteredPairs) {
  const forCase = Array.isArray(letterSequence)
    ? letterSequence.filter(l => l?.caseType === caseType)
    : [];
  // Same fallback the writing screens use when no adaptive sequence was
  // stored (a student assessed before sequences were saved).
  const base = forCase.length > 0 ? forCase : getAllLetters(caseType);
  return filterUnmasteredSequence(base, masteredPairs)[0]?.letter ?? null;
}

const AVATAR_MAP = {
  boba:     require('../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../assets/avatar-images/Megatron.png'),
};

export default function LetterProgressPanel({
  student,
  theme,
  letterSequence = [],
  initLow = 0,
  initUp = 0,
}) {
  const [report, setReport] = useState(null);
  // Authoritative mastered (letter, caseType) pairs — the same backend read
  // the writing screens gate on. null until it resolves; fetchMasteredLetters
  // never throws, so a failure resolves to an empty list and the next letter
  // falls back to the first of the sequence rather than showing nothing.
  const [masteredPairs, setMasteredPairs] = useState(null);

  useEffect(() => {
    client.get(ENDPOINTS.LETTER_PROGRESS(student.sid))
      .then(res => setReport(res.data))
      .catch(() => setReport({
        lowercase_completed: initLow,
        uppercase_completed: initUp,
        reason:              'Continue regular letter practice.',
      }));
  }, [student.sid]);

  useEffect(() => {
    let cancelled = false;
    fetchMasteredLetters(student.sid).then(({ pairs }) => {
      if (!cancelled) setMasteredPairs(pairs);
    });
    return () => { cancelled = true; };
  }, [student.sid]);

  const lowercase = report?.lowercase_completed ?? initLow;
  const uppercase = report?.uppercase_completed ?? initUp;
  const reason    = report?.reason              ?? 'Continue regular letter practice.';

  // Held back until the mastered read resolves — a letter derived from an
  // empty pair list would name the first of the sequence, which is wrong for
  // any child mid-way through. The counts and bars render immediately; only
  // this one value waits.
  const nextLetter = masteredPairs === null
    ? null
    : deriveNextLetter(letterSequence, 'lowercase', masteredPairs);
  const nextUppercaseLetter = masteredPairs === null
    ? null
    : deriveNextLetter(letterSequence, 'uppercase', masteredPairs);

  const lowercasePercent = Math.min(100, Math.round((lowercase / 26) * 100));
  const uppercasePercent = Math.min(100, Math.round((uppercase / 26) * 100));
  const lowercaseDone    = lowercase >= 26;
  const totalCompleted = lowercase + uppercase;
  const totalPercent = Math.min(100, Math.round((totalCompleted / 52) * 100));
  const nextDisplayLetter = nextLetter && !lowercaseDone
    ? nextLetter
    : (lowercaseDone && nextUppercaseLetter) || '-';

  return (
    <View style={styles.panel}>

      {/* Student banner — white, framed in the avatar theme like the landing
          pages' cards; the overall % as a ring on the right. */}
      <View style={[styles.studentBanner, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
        <View style={[styles.avatarFrame, { backgroundColor: theme.cardOutline + '1F' }]}>
          <Image
            source={AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.megatron}
            style={styles.bannerAvatar}
            resizeMode="contain"
          />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerName, { color: theme.headingText }]} numberOfLines={1}>
            {student?.full_name}
          </Text>
          <Text style={styles.bannerSub}>Handwriting progress</Text>
          <View style={styles.summaryPills}>
            <View style={[styles.summaryPill, { borderColor: theme.cardOutline + '66' }]}>
              <Text style={styles.summaryPillLabel}>Done</Text>
              <Text style={[styles.summaryPillValue, { color: theme.headingText }]}>
                {totalCompleted}/52
              </Text>
            </View>
            <View style={[styles.summaryPill, { borderColor: theme.cardOutline + '66' }]}>
              <Text style={styles.summaryPillLabel}>Next</Text>
              <Text style={[styles.summaryPillValue, { color: theme.headingText }]}>
                {nextDisplayLetter}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.totalRingWrap}>
          <TotalRing percent={totalPercent} color={theme.cardOutline} textColor={theme.headingText} />
          <Text style={styles.totalRingLabel}>Total</Text>
        </View>
      </View>

      {/* The two cases side by side — the landscape pop-up has the width,
          and it halves the height of the stacked layout. */}
      <View style={styles.sectionsRow}>

        {/* ── Lowercase section ── */}
        <View style={[styles.sectionCard, { borderColor: '#A5D6A7' }]}>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#E6F4D7' }]}>
              <Ionicons name="text-outline" size={20} color="#2E7D32" />
            </View>
            <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Lowercase Letters</Text>
            {lowercaseDone ? (
              <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
            ) : (
              <Text style={[styles.sectionPercent, { color: '#2E7D32' }]}>{lowercasePercent}%</Text>
            )}
          </View>

          <Text style={styles.sectionSub}>{lowercase} / 26 letters completed</Text>

          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${lowercasePercent}%`, backgroundColor: '#4CAF50' }]} />
          </View>

          <View style={styles.detailRow}>
            {nextLetter && !lowercaseDone && (
              <View style={[styles.nextLetterBadge, { borderColor: '#C5E1A5' }]}>
                <Text style={styles.nextLetterLabel}>Next Letter</Text>
                <Text style={[styles.nextLetterValue, { color: '#2E7D32' }]}>{nextLetter}</Text>
              </View>
            )}
            <View style={[styles.reasonRow, { backgroundColor: '#F6FBF1' }]}>
              <Ionicons name="information-circle-outline" size={15} color="#66BB6A" />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          </View>

        </View>

        {/* ── Uppercase section ── */}
        <View style={[styles.sectionCard, { borderColor: '#CE93D8' }]}>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#F1E1F5' }]}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#7B1FA2" />
            </View>
            <Text style={[styles.sectionTitle, { color: '#7B1FA2' }]}>
              Uppercase Letters
            </Text>
            <Text style={[styles.sectionPercent, { color: '#7B1FA2' }]}>
              {uppercasePercent}%
            </Text>
          </View>

          <Text style={styles.sectionSub}>
            {uppercase} / 26 letters completed
          </Text>

          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${uppercasePercent}%`, backgroundColor: '#AB47BC' }]} />
          </View>

          {/* Same badge as the lowercase section. nextUppercaseLetter is
              null once every uppercase letter is mastered, so this hides
              itself without needing a separate "done" condition. */}
          {nextUppercaseLetter && (
            <View style={styles.detailRow}>
              <View style={[styles.nextLetterBadge, { borderColor: '#E1C9EC' }]}>
                <Text style={styles.nextLetterLabel}>Next Letter</Text>
                <Text style={[styles.nextLetterValue, { color: '#7B1FA2' }]}>
                  {nextUppercaseLetter}
                </Text>
              </View>
            </View>
          )}

        </View>

      </View>

    </View>
  );
}

// The overall % as a ring — same drawing as LetterHomeScreen's ProgressRing,
// sized for the banner.
function TotalRing({ percent, color, textColor, size = 76, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const offset = circumference * (1 - clamped / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color + '33'} strokeWidth={strokeWidth} fill="none" />
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
      <Text style={[styles.totalRingText, { color: textColor }]}>{clamped}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 24,
  },

  // Student banner
  studentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  avatarFrame: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerAvatar: {
    width: 68,
    height: 68,
    flexShrink: 0,
  },
  bannerText: {
    flex: 1,
  },
  bannerName: {
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    marginTop: 2,
  },
  summaryPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  summaryPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 76,
  },
  summaryPillLabel: {
    fontSize: 10,
    color: '#7B8190',
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryPillValue: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    marginTop: 1,
  },
  totalRingWrap: {
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  totalRingText: {
    position: 'absolute',
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
  },
  totalRingLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#7B8190',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section cards — side by side, white with a case-coloured frame.
  sectionsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  sectionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 2,
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#666666',
  },
  sectionPercent: {
    fontSize: 20,
    fontFamily: 'DMSans_800ExtraBold',
    flexShrink: 0,
  },

  // Progress bar
  barTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },

  // Detail row (next letter + reason)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  // A letter tile: white, case-coloured frame (set inline), big letter.
  nextLetterBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexShrink: 0,
  },
  nextLetterLabel: {
    fontSize: 11,
    color: '#888888',
    fontFamily: 'DMSans_600SemiBold',
  },
  nextLetterValue: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    lineHeight: 40,
  },
  reasonRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#555555',
    lineHeight: 19,
  },
});
