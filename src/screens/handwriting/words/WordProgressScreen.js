import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchWordProgress } from '../../../utils/wordApi';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import { useLockLandscape } from '../../../utils/useOrientationLock';

const ALPHABET  = 'abcdefghijklmnopqrstuvwxyz'.split('');
const EXERCISES = ['A', 'B', 'C', 'D', 'E'];

const EXERCISE_LABELS = {
  A: 'First Letter',
  B: 'Find the Picture',
  C: 'Fill the Gap',
  D: 'Spell It!',
  E: 'Write Word',
};

const STATUS = {
  pending: { icon: 'ellipse-outline',     iconSize: 12, badgeBg: '#F5F5F5', badgeBorder: '#E0E0E0', iconColor: '#BDBDBD' },
  correct: { icon: 'checkmark-circle',    iconSize: 14, badgeBg: '#E8F5E9', badgeBorder: '#81C784', iconColor: '#2E7D32' },
  good:    { icon: 'help-circle-outline', iconSize: 14, badgeBg: '#FFF3E0', badgeBorder: '#FFB74D', iconColor: '#E65100' },
};

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

export default function WordProgressScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const { student, theme } = route.params;

  const [progress,       setProgress]       = useState({});
  const [expandedLetter, setExpandedLetter] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      async function load() {
        try {
          const authoritative = await fetchWordProgress(student);
          if (active) setProgress(authoritative ?? {});
        } catch {
          if (active) setProgress({});
        }
      }
      load();
      return () => { active = false; };
    }, [student?.sid])
  );

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
    const accuracyPct = totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : 0;
    return { lettersCompleted: letters.length, totalEx, correctEx, goodEx, accuracyPct };
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

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.button + '18' }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.topMid}>
            <Text style={[styles.topTitle, { color: theme.headingText }]}>
              Word Progress
            </Text>
            <Text style={[styles.topStudent, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* Session summary banner */}
        <View style={[styles.summaryCard, { borderColor: theme.button + '28' }]}>
          <View style={styles.summaryIntro}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.button + '14' }]}>
              <Ionicons name="bar-chart-outline" size={24} color={theme.button} />
            </View>
            <View style={styles.summaryTextBlock}>
              <Text style={[styles.summaryTitle, { color: theme.headingText }]}>
                Learning overview
              </Text>
              <Text style={styles.summarySubtitle}>
                {student?.full_name ? `${student.full_name}'s saved word practice results` : 'Saved word practice results'}
              </Text>
            </View>
            <View style={[styles.accuracyBadge, { backgroundColor: theme.button + '10', borderColor: theme.button + '28' }]}>
              <Text style={[styles.accuracyValue, { color: theme.button }]}>
                {sessionStats.accuracyPct}%
              </Text>
              <Text style={styles.accuracyLabel}>Accuracy</Text>
            </View>
          </View>

          <View style={styles.summaryStatsRow}>
            <SummaryPill
              icon="book-outline"
              value={sessionStats.lettersCompleted}
              of={26}
              label="Letters done"
              color={theme.button}
            />
            <SummaryPill
              icon="checkmark-circle"
              value={sessionStats.correctEx}
              of={sessionStats.totalEx || 1}
              label="Correct"
              color="#2E7D32"
            />
            <SummaryPill
              icon="help-circle-outline"
              value={sessionStats.goodEx}
              of={sessionStats.totalEx || 1}
              label="With help"
              color="#E65100"
            />
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { icon: 'checkmark-circle',    color: '#2E7D32', label: 'Correct on first try' },
            { icon: 'help-circle-outline', color: '#E65100', label: 'Correct with help'    },
            { icon: 'ellipse-outline',     color: '#BDBDBD', label: 'Not attempted'        },
          ].map(item => (
            <View key={item.icon} style={styles.legendItem}>
              <Ionicons name={item.icon} size={14} color={item.color} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* A–Z letter list */}
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

                <TouchableOpacity
                  style={[
                    styles.letterRow,
                    done && styles.letterRowDone,
                  ]}
                  onPress={() => done && toggleLetter(letter)}
                  activeOpacity={done ? 0.7 : 1}
                >
                  <View style={[
                    styles.letterCircle,
                    { backgroundColor: done ? theme.button : '#E0E0E0' },
                  ]}>
                    <Text style={[styles.letterCircleText, { color: done ? theme.buttonText : '#9E9E9E' }]}>
                      {letter.toUpperCase()}
                    </Text>
                  </View>

                  {done ? (
                    <View style={styles.letterInfo}>
                      <View style={styles.letterTitleRow}>
                        <Text style={styles.letterDoneLabel}>
                          {wordResults.length} {wordResults.length === 1 ? 'word' : 'words'}
                        </Text>
                        <View style={styles.statusChip}>
                          <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
                          <Text style={styles.statusChipText}>Started</Text>
                        </View>
                      </View>
                      <Text style={[styles.letterScore, { color: scoreColor(score.correct, score.total) }]}>
                        {score.correct} / {score.total} correct
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.letterInfo}>
                      <Text style={styles.letterPending}>Not started</Text>
                      <Text style={styles.letterPendingHint}>No word practice saved yet</Text>
                    </View>
                  )}

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

                {done && expanded && (
                  <View style={styles.expandedSection}>

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

function WordRow({ item }) {
  const correct = Object.values(item.status).filter(s => s === 'correct').length;
  const stars   = correct === 4 ? 3 : correct >= 2 ? 2 : correct >= 1 ? 1 : 0;

  return (
    <View style={wordRowStyles.row}>
      <WordImageDisplay imageKey={item.imageKey} emoji={item.emoji} size={36} />

      <Text style={wordRowStyles.word} numberOfLines={1}>
        {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
      </Text>

      {EXERCISES.map(ex => {
        const cfg = STATUS[item.status[ex]] ?? STATUS.pending;
        return (
          <View key={ex} style={[wordRowStyles.badge, { backgroundColor: cfg.badgeBg, borderColor: cfg.badgeBorder }]}>
            <Ionicons name={cfg.icon} size={cfg.iconSize} color={cfg.iconColor} />
          </View>
        );
      })}

      <View style={wordRowStyles.stars}>
        {[0, 1, 2].map(i => (
          <Ionicons
            key={i}
            name={i < stars ? 'star' : 'star-outline'}
            size={13}
            color={i < stars ? '#FFCA28' : '#CCCCCC'}
          />
        ))}
      </View>
    </View>
  );
}

const wordRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stars: { flexDirection: 'row', gap: 2 },
});

function SummaryPill({ icon, value, of, label, color }) {
  return (
    <View style={[pillStyles.pill, { borderColor: color + '24', backgroundColor: color + '08' }]}>
      <View style={[pillStyles.iconWrap, { backgroundColor: color + '14' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={pillStyles.copy}>
        <View style={pillStyles.valueRow}>
          <Text style={[pillStyles.value, { color }]}>{value}</Text>
          <Text style={pillStyles.of}>/ {of}</Text>
        </View>
        <Text style={pillStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  value: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  of:    { fontSize: 12, color: '#8A8A8A', fontWeight: '700', marginBottom: 3 },
  label: { fontSize: 12, color: '#5F6368', fontWeight: '700', marginTop: 3 },
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMid: {
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  topStudent: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.65,
    marginTop: 1,
  },

  summaryCard: {
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  summaryIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextBlock: { flex: 1 },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  summarySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6E7378',
    fontWeight: '600',
    marginTop: 2,
  },
  accuracyBadge: {
    minWidth: 92,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  accuracyValue: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  accuracyLabel: {
    fontSize: 11,
    color: '#6E7378',
    fontWeight: '800',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 24,
    flexWrap: 'wrap',
  },
  legendItem:  {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendLabel: { fontSize: 11, color: '#5F6368', fontWeight: '700' },

  list: {
    paddingHorizontal: 24,
    gap: 12,
  },
  letterSection: {},

  letterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E6EBF0',
    paddingHorizontal: 18,
    paddingVertical: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    minHeight: 76,
  },
  letterRowDone: {
    borderColor: '#D9E4F5',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.07,
  },
  letterCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  letterCircleText: { fontSize: 20, fontWeight: '900' },
  letterInfo:       { flex: 1 },
  letterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  letterDoneLabel:  { fontSize: 14, fontWeight: '700', color: '#222222' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: { fontSize: 10, color: '#2E7D32', fontWeight: '900' },
  letterScore:      { fontSize: 12, fontWeight: '700', marginTop: 4 },
  letterPending:    { fontSize: 14, color: '#8F969C', fontWeight: '800' },
  letterPendingHint:{ fontSize: 11, color: '#B4BAC0', fontWeight: '600', marginTop: 3 },

  scoreBarWrap: { width: 112 },
  scoreBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEF1F4',
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 5 },

  expandedSection: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EBF0',
    overflow: 'hidden',
    elevation: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  thWord:    { fontSize: 11, fontWeight: '700', color: '#888888', textTransform: 'uppercase', letterSpacing: 0.5 },
  thEx:      { width: 30, alignItems: 'center' },
  thExText:  { fontSize: 11, fontWeight: '900', color: '#555555' },
  thExLabel: { fontSize: 9, color: '#AAAAAA', fontWeight: '500' },
});
