/**
 * DaysMenuScreen — Entry point for the Days of the Week category.
 *
 * Shows two options:
 *   Activities  — full teaching flow (always available)
 *   Assessment  — Spinning Wheel (locked until ≥3 days are IN_PROGRESS or MASTERED)
 *
 * Fetches next word + wheel availability on mount, so both cards render
 * with live state without an extra loading screen.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';
import { dialogueApi, daysApi } from '../../../../api/dialogue';

const PHASE1_REQUIRED_EXPOSURES = 3; // default; mastery algorithm may reduce to 2

export default function DaysMenuScreen({ route, navigation }) {
  const { student } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const [loading,        setLoading]        = useState(true);
  const [nextWord,       setNextWord]       = useState(null);
  const [wheelAvailable, setWheelAvailable] = useState(false);

  // Reload data every time screen comes into focus (e.g. returning from a completed word)
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const [word, wheel] = await Promise.all([
          dialogueApi.getNextWord(student?.sid, { category: 'days_of_week' }).catch(() => null),
          daysApi.getSpinningWheelRound(student?.sid, []).catch(() => null),
        ]);
        if (cancelled) return;
        setNextWord(word ?? null);
        setWheelAvailable(wheel?.available ?? false);
      } catch {
        if (!cancelled) { setNextWord(null); setWheelAvailable(false); }
      }
      if (!cancelled) setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, [student?.sid]));

  function handleActivities() {
    if (!nextWord) {
      // All days learned — nothing left in Activities
      return;
    }
    navigation.navigate('DaysLanding', {
      student,
      wordKey:                 nextWord.asset_key,
      wordId:                  nextWord.id,
      phase1RequiredExposures: nextWord.required_exposures ?? PHASE1_REQUIRED_EXPOSURES,
    });
  }

  function handleAssessment() {
    if (!wheelAvailable) return;
    navigation.navigate('DaysSpinningWheel', { student });
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const activitiesDone = !loading && !nextWord;
  const dayLabel       = nextWord ? (nextWord.asset_key.charAt(0).toUpperCase() + nextWord.asset_key.slice(1)) : null;

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <SafeAreaView style={[styles.headerWrap, { backgroundColor: theme.headerBackground }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity onPress={() => navigation.navigate('DialogueCategory', { student })} activeOpacity={0.7} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headingText }]}>Days of the Week</Text>
          <View style={styles.headerSide} />
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <LinearGradient colors={theme.backgroundGradient} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>

            {loading ? (
              <ActivityIndicator size="large" color={theme.button} style={{ marginTop: 60 }} />
            ) : (
              <>
                <Text style={[styles.greeting, { color: theme.headingText }]}>
                  What would you like to do?
                </Text>

                {/* ── Activities card ── */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardSurface },
                    activitiesDone && styles.cardDone,
                  ]}
                  onPress={handleActivities}
                  activeOpacity={activitiesDone ? 0.6 : 0.85}
                  disabled={activitiesDone}
                >
                  <View style={[styles.cardIconCircle, { backgroundColor: theme.button + '22' }]}>
                    <Ionicons name="book-outline" size={28} color={theme.button} />
                  </View>

                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: theme.headingText }]}>Activities</Text>
                    <Text style={[styles.cardDesc, { color: theme.headingText }]}>
                      Learn and practise the days of the week
                    </Text>
                    {activitiesDone ? (
                      <View style={styles.badgeRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                        <Text style={[styles.badgeText, { color: '#22C55E' }]}>All days learned!</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeRow}>
                        <Ionicons name="arrow-forward-circle-outline" size={14} color={theme.button} />
                        <Text style={[styles.badgeText, { color: theme.button }]}>
                          Next up: {dayLabel}
                        </Text>
                      </View>
                    )}
                  </View>

                  {!activitiesDone && (
                    <Ionicons name="chevron-forward" size={20} color={theme.button} style={{ opacity: 0.6 }} />
                  )}
                </TouchableOpacity>

                {/* ── Assessment card ── */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardSurface },
                    !wheelAvailable && styles.cardLocked,
                  ]}
                  onPress={handleAssessment}
                  activeOpacity={wheelAvailable ? 0.85 : 1}
                  disabled={!wheelAvailable}
                >
                  <View style={[
                    styles.cardIconCircle,
                    { backgroundColor: wheelAvailable ? theme.button + '22' : 'rgba(0,0,0,0.06)' },
                  ]}>
                    <Ionicons
                      name={wheelAvailable ? 'trophy-outline' : 'lock-closed-outline'}
                      size={28}
                      color={wheelAvailable ? theme.button : 'rgba(0,0,0,0.28)'}
                    />
                  </View>

                  <View style={styles.cardText}>
                    <Text style={[
                      styles.cardTitle,
                      { color: wheelAvailable ? theme.headingText : 'rgba(0,0,0,0.3)' },
                    ]}>
                      Assessment
                    </Text>
                    <Text style={[
                      styles.cardDesc,
                      { color: wheelAvailable ? theme.headingText : 'rgba(0,0,0,0.25)' },
                    ]}>
                      Spinning Wheel: identify the days you've learned
                    </Text>
                    <View style={styles.badgeRow}>
                      {wheelAvailable ? (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                          <Text style={[styles.badgeText, { color: '#22C55E' }]}>Ready to play!</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="lock-closed" size={12} color="rgba(0,0,0,0.28)" />
                          <Text style={[styles.badgeText, { color: 'rgba(0,0,0,0.35)' }]}>
                            Learn 3 days to unlock
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {wheelAvailable && (
                    <Ionicons name="chevron-forward" size={20} color={theme.button} style={{ opacity: 0.6 }} />
                  )}
                </TouchableOpacity>

              </>
            )}

          </View>
        </SafeAreaView>
      </LinearGradient>

    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  headerWrap: {},
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  headerSide:  { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },

  content: {
    flex: 1,
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.xl,
    gap: Layout.spacing.lg,
  },

  greeting: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
    opacity: 0.85,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Layout.radius.xl,
    padding: Layout.spacing.lg,
    gap: Layout.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardDone:   { opacity: 0.65 },
  cardLocked: { opacity: 0.7 },

  cardIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },

  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: Layout.fontSize.lg, fontWeight: '800' },
  cardDesc:  { fontSize: Layout.fontSize.sm, fontWeight: '500', opacity: 0.7, lineHeight: 18 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  badgeText: { fontSize: Layout.fontSize.xs, fontWeight: '700' },
});
