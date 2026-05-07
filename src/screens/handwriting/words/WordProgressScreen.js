/**
 * WordProgressScreen — Teacher's overview of word activity results.
 *
 * Shows all 26 letters. Completed letters are expanded with per-word,
 * per-exercise results. Pending letters are shown as "Not started".
 *
 * Data comes from the sessionProgress module (in-memory, current session only).
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getSessionProgress } from '../../../constants/sessionProgress';
import { getAllWordProgress } from '../../../utils/storage';
import WordImageDisplay from '../../../components/word/WordImageDisplay';

const { width: SCREEN_W } = Dimensions.get('window');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const EXERCISES = ['A', 'B', 'C', 'D'];

const EXERCISE_LABELS = {
  A: 'First Letter',
  B: 'Find the Picture',
  C: 'Fill the Gap',
  D: 'Spell It!',
};

// ─── Status display config ────────────────────────────────────────────────────

const STATUS = {
  pending: { icon: '·', badgeBg: '#F5F5F5', badgeBorder: '#E0E0E0', iconColor: '#BDBDBD' },
  correct: { icon: '✓', badgeBg: '#E8F5E9', badgeBorder: '#81C784', iconColor: '#2E7D32' },
  good:    { icon: '~', badgeBg: '#FFF3E0', badgeBorder: '#FFB74D', iconColor: '#E65100' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLetterScore(wordResults) {
  let correct = 0, total = 0;
  wordResults.forEach(w => {
    Object.values(w.status).forEach(s => {
      total++;
      if (s === 'correct') correct++;
    });
  });
  return { correct, total };
}

function scoreColor(correct, total) {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.85) return '#2E7D32';
  if (pct >= 0.5)  return '#E65100';
  return '#C62828';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WordProgressScreen({ route, navigation }) {
  const { student, theme } = route.params;

  const [progress,       setProgress]       = useState({});
  const [expandedLetter, setExpandedLetter] = useState(null);

  // Reload progress every time this screen comes into focus.
  // Merge persistent (AsyncStorage) + current-session (memory); session wins for
  // any letter completed this session so the latest result is always shown.
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      async function load() {
        const persistent = await getAllWordProgress(student?.sid ?? 0);
        const session    = getSessionProgress();
        if (active) setProgress({ ...persistent, ...session });
      }
      load();
      return () => { active = false; };
    }, [student?.sid])
  );

  // Overall session stats
  const sessionStats = useMemo(() => {
    const letters = Object.keys(progress);
    let totalEx = 0, correctEx = 0, goodEx = 0;
    letters.forEach(letter => {
      progress[letter].forEach(w => {
        Object.values(w.status).forEach(s => {
          totalEx++;
          if (s === 'correct') correctEx++;
          else if (s === 'good') goodEx++;
        });
      });
    });
    return {
      lettersCompleted: letters.length,
      totalEx,
      correctEx,
      goodEx,
    };
  }, [progress]);

  function toggleLetter(letter) {
    setExpandedLetter(prev => (prev === letter ? null : letter));
  }

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.topMid}>
            <Text style={[styles.topTitle, { color: theme.headingText }]}>
              Word Progress
            </Text>
            <Text style={[styles.topStudent, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
          </View>

          {/* Empty right slot to balance layout */}
          <View style={{ width: 22 }} />
        </View>

        {/* ── Session summary banner ── */}
        <View style={[styles.banner, { borderColor: theme.button + '44' }]}>
          <SummaryPill
            value={sessionStats.lettersCompleted}
            of={26}
            label="Letters done"
            color={theme.button}
          />
          <View style={styles.bannerDivider} />
          <SummaryPill
            value={sessionStats.correctEx}
            of={sessionStats.totalEx || 1}
            label="Correct"
            color="#2E7D32"
          />
          <View style={styles.bannerDivider} />
          <SummaryPill
            value={sessionStats.goodEx}
            of={sessionStats.totalEx || 1}
            label="With help"
            color="#E65100"
          />
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          {[
            { icon: '✓', color: '#2E7D32', label: 'Correct on first try' },
            { icon: '~', color: '#E65100', label: 'Correct with help'    },
            { icon: '·', color: '#BDBDBD', label: 'Not attempted'        },
          ].map(item => (
            <View key={item.icon} style={styles.legendItem}>
              <Text style={[styles.legendIcon, { color: item.color }]}>{item.icon}</Text>
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── A–Z letter list ── */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {ALPHABET.map(letter => {
            const wordResults = progress[letter];
            const done        = Boolean(wordResults);
            const expanded    = expandedLetter === letter;
            const score       = done ? calcLetterScore(wordResults) : null;

            return (
              <View key={letter} style={styles.letterSection}>

                {/* ── Letter header row ── */}
                <TouchableOpacity
                  style={[
                    styles.letterRow,
                    done && { borderColor: theme.button + '55', backgroundColor: theme.button + '08' },
                  ]}
                  onPress={() => done && toggleLetter(letter)}
                  activeOpacity={done ? 0.7 : 1}
                >
                  {/* Letter circle */}
                  <View style={[
                    styles.letterCircle,
                    { backgroundColor: done ? theme.button : '#E0E0E0' },
                  ]}>
                    <Text style={[styles.letterCircleText, { color: done ? theme.buttonText : '#9E9E9E' }]}>
                      {letter.toUpperCase()}
                    </Text>
                  </View>

                  {/* Status text */}
                  {done ? (
                    <View style={styles.letterInfo}>
                      <Text style={styles.letterDoneLabel}>
                        {wordResults.length} {wordResults.length === 1 ? 'word' : 'words'}
                      </Text>
                      <Text style={[styles.letterScore, { color: scoreColor(score.correct, score.total) }]}>
                        {score.correct} / {score.total} correct
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.letterPending}>Not started</Text>
                  )}

                  {/* Score bar */}
                  {done && (
                    <View style={styles.scoreBarWrap}>
                      <View style={styles.scoreBarBg}>
                        <View style={[
                          styles.scoreBarFill,
                          {
                            width: `${(score.correct / score.total) * 100}%`,
                            backgroundColor: scoreColor(score.correct, score.total),
                          },
                        ]} />
                      </View>
                    </View>
                  )}

                  {done && (
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.button}
                    />
                  )}
                </TouchableOpacity>

                {/* ── Expanded word results ── */}
                {done && expanded && (
                  <View style={styles.expandedSection}>

                    {/* Exercise column headers */}
                    <View style={styles.tableHeader}>
                      <View style={{ width: 42 }} />
                      <Text style={[styles.thWord, { flex: 1 }]}>Word</Text>
                      {EXERCISES.map(ex => (
                        <View key={ex} style={styles.thEx}>
                          <Text style={styles.thExText}>{ex}</Text>
                          <Text style={styles.thExLabel} numberOfLines={1}>
                            {EXERCISE_LABELS[ex].split(' ')[0]}
                          </Text>
                        </View>
                      ))}
                      <View style={{ width: 54 }} />
                    </View>

                    {/* Word rows */}
                    {wordResults.map((item, i) => (
                      <WordRow key={`${item.word}-${i}`} item={item} />
                    ))}

                  </View>
                )}

              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Word result row ──────────────────────────────────────────────────────────

function WordRow({ item }) {
  const correct = Object.values(item.status).filter(s => s === 'correct').length;
  const stars   = correct === 4 ? 3 : correct >= 2 ? 2 : correct >= 1 ? 1 : 0;

  return (
    <View style={wordRowStyles.row}>
      <WordImageDisplay imageKey={item.imageKey} emoji={item.emoji} size={34} />

      <Text style={wordRowStyles.word} numberOfLines={1}>
        {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
      </Text>

      {EXERCISES.map(ex => {
        const cfg = STATUS[item.status[ex]];
        return (
          <View key={ex} style={[wordRowStyles.badge, { backgroundColor: cfg.badgeBg, borderColor: cfg.badgeBorder }]}>
            <Text style={[wordRowStyles.badgeIcon, { color: cfg.iconColor }]}>{cfg.icon}</Text>
          </View>
        );
      })}

      <View style={wordRowStyles.stars}>
        {[0, 1, 2].map(i => (
          <Text key={i} style={wordRowStyles.star}>{i < stars ? '⭐' : '☆'}</Text>
        ))}
      </View>
    </View>
  );
}

const wordRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  word: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
  },
  badge: {
    width: 30,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: { fontSize: 14, fontWeight: '900' },
  stars: { flexDirection: 'row', gap: 1 },
  star:  { fontSize: 11 },
});

// ─── Summary pill ─────────────────────────────────────────────────────────────

function SummaryPill({ value, of, label, color }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={[pillStyles.value, { color }]}>{value}</Text>
      <Text style={pillStyles.of}>/ {of}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill:  { flex: 1, alignItems: 'center', paddingVertical: 4 },
  value: { fontSize: 22, fontWeight: '900' },
  of:    { fontSize: 11, color: '#999999', fontWeight: '500' },
  label: { fontSize: 11, color: '#666666', fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topMid: {
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  topStudent: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.65,
    marginTop: 1,
  },

  // Summary banner
  banner: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  bannerDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendIcon: { fontSize: 13, fontWeight: '900' },
  legendLabel:{ fontSize: 11, color: '#777777', fontWeight: '500' },

  // Letter list
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },
  letterSection: {},

  // Letter header row
  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  letterCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  letterCircleText: { fontSize: 18, fontWeight: '900' },
  letterInfo:    { flex: 1 },
  letterDoneLabel: { fontSize: 13, fontWeight: '700', color: '#222222' },
  letterScore:   { fontSize: 12, fontWeight: '600', marginTop: 1 },
  letterPending: { flex: 1, fontSize: 13, color: '#BDBDBD', fontWeight: '500' },

  // Score bar
  scoreBarWrap: { width: 80 },
  scoreBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 3 },

  // Expanded section
  expandedSection: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
    elevation: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  thWord: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thEx: { width: 30, alignItems: 'center' },
  thExText: { fontSize: 11, fontWeight: '900', color: '#555555' },
  thExLabel: { fontSize: 9, color: '#AAAAAA', fontWeight: '500' },
});
