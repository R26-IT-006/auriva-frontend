import React, { useState, useMemo, useEffect } from 'react';
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
import { fetchWordProgress } from '../../../../utils/wordApi';
import WordImageDisplay from '../../../../components/word/WordImageDisplay';
import { useLockLandscape } from '../../../../utils/useOrientationLock';
import useGatedBack from '../../../../utils/useGatedBack';
import { resolveWordImageKey, resolveWordEmoji } from '../../../../utils/wordImageResolver';
import { BACK_BUTTON, BACK_ICON_SIZE } from '../../../../constants/backButton';

const ALPHABET  = 'abcdefghijklmnopqrstuvwxyz'.split('');
const EXERCISES = ['A', 'B', 'C', 'D', 'E'];

const EXERCISE_LABELS = {
  A: 'First Letter',
  B: 'Find the Picture',
  C: 'Fill the Gap',
  D: 'Spell It!',
  E: 'Write Word',
};

// A–Z as a compact grid: 9 tiles a row on a tablet (6 on a phone), sized to
// fill the width — three short rows instead of 26 tall ones.
const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PAD  = 24;
const GRID_GAP  = 10;
const GRID_COLS = SCREEN_W >= 900 ? 9 : 6;
const TILE_W    = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
const TILE_H    = 92;

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

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  const { requestBack, gateModal } = useGatedBack(() => navigation.goBack());

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

  // Show the first started letter's words by default, so the details card
  // is never empty when there is something to show.
  useEffect(() => {
    if (expandedLetter && progress[expandedLetter]) return;
    const first = ALPHABET.find(l => progress[l]);
    setExpandedLetter(first ?? null);
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  // How each activity type went across every saved word: done on the
  // child's own, with help, or not yet. Shows a teacher WHICH kind of task
  // needs support, not only how much.
  const activityStats = useMemo(() => {
    const stats = Object.fromEntries(EXERCISES.map(ex => [ex, { own: 0, help: 0, words: 0 }]));
    Object.values(progress).forEach(words => words.forEach(w => {
      EXERCISES.forEach(ex => {
        stats[ex].words++;
        if (w.status?.[ex] === 'correct') stats[ex].own++;
        else if (w.status?.[ex] === 'good') stats[ex].help++;
      });
    }));
    return stats;
  }, [progress]);

  function toggleLetter(letter) {
    setExpandedLetter(letter);
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Decorative shapes — same treatment as the other module screens */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTopRight, { backgroundColor: theme.cardOutline }]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottomLeft, { backgroundColor: theme.cardOutline }]} />

      <SafeAreaView style={styles.safe}>

        {/* Top bar — round back | centred icon title | spacer */}
        <View style={styles.topBar}>
          <View style={styles.sideGroup}>
            <TouchableOpacity
              style={[styles.backBtn, BACK_BUTTON]}
              onPress={requestBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          <View style={styles.topMid}>
            <View style={styles.titleRow}>
              <View style={[styles.titleIconCircle, { backgroundColor: theme.cardOutline }]}>
                <Ionicons name="ribbon" size={18} color="#FFF" />
              </View>
              <Text style={[styles.topTitle, { color: theme.headingText }]}>
                Word Progress
              </Text>
            </View>
            <Text style={[styles.topStudent, { color: theme.headingText }]}>
              {student?.full_name}
            </Text>
          </View>

          <View style={styles.sideGroup} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* Session summary banner */}
          <View style={[styles.summaryCard, { borderColor: theme.cardOutline }]}>
            <View style={styles.summaryIntro}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.cardOutline + '26' }]}>
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
              <View style={[styles.accuracyBadge, { backgroundColor: theme.button }]}>
                <Text style={[styles.accuracyValue, { color: theme.buttonText }]}>
                  {sessionStats.accuracyPct}%
                </Text>
                <Text style={[styles.accuracyLabel, { color: theme.buttonText }]}>Accuracy</Text>
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

            {sessionStats.totalEx > 0 && (
              <View style={styles.activitySection}>
                <Text style={styles.activityHeading}>By activity</Text>
                <View style={styles.activityRow}>
                  {EXERCISES.map(ex => {
                    const a = activityStats[ex];
                    const ownPct  = a.words ? a.own  / a.words : 0;
                    const helpPct = a.words ? a.help / a.words : 0;
                    const needsSupport = a.help > 0 && a.help >= a.own;
                    return (
                      <View key={ex} style={styles.activityItem}>
                        <View style={styles.activityTitleRow}>
                          <Text style={styles.activityName} numberOfLines={1}>{EXERCISE_LABELS[ex]}</Text>
                          {needsSupport && (
                            <Ionicons name="alert-circle" size={14} color="#E65100" />
                          )}
                        </View>
                        <View style={styles.activityBar}>
                          <View style={[styles.activityBarOwn,  { flex: ownPct }]} />
                          <View style={[styles.activityBarHelp, { flex: helpPct }]} />
                          <View style={{ flex: Math.max(0, 1 - ownPct - helpPct) }} />
                        </View>
                        <Text style={styles.activityCounts}>
                          {a.own} on own · {a.help} with help
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* A–Z as a compact grid of letter tiles. Started letters are
              coloured with their score; tap one to see its words below. */}
          <Text style={[styles.sectionTitle, { color: theme.headingText }]}>Letters</Text>
          <View style={styles.grid}>
            {ALPHABET.map(letter => {
              const wordResults = progress[letter];
              const done        = Boolean(wordResults);
              const selected    = expandedLetter === letter;
              const score       = done ? calcLetterScore(wordResults) : null;
              const pct         = done && score.total > 0 ? score.correct / score.total : 0;
              const neededHelp  = done && wordResults.some(w => Object.values(w.status ?? {}).includes('good'));

              return (
                <TouchableOpacity
                  key={letter}
                  style={[
                    styles.tile,
                    done ? { backgroundColor: '#FFFFFF', borderColor: theme.cardOutline } : styles.tilePending,
                    selected && { borderColor: theme.button, borderWidth: 3 },
                  ]}
                  onPress={() => done && toggleLetter(letter)}
                  activeOpacity={done ? 0.75 : 1}
                  disabled={!done}
                  accessibilityRole="button"
                  accessibilityLabel={done
                    ? `Letter ${letter.toUpperCase()}: ${score.correct} of ${score.total} correct`
                    : `Letter ${letter.toUpperCase()}: not started`}
                >
                  {neededHelp && (
                    <View style={styles.tileHelpMark} accessibilityLabel="Needed help">
                      <Ionicons name="help" size={11} color="#FFFFFF" />
                    </View>
                  )}
                  <Text style={[styles.tileLetter, { color: done ? theme.headingText : '#B3B8BE' }]}>
                    {letter.toUpperCase()}
                  </Text>
                  {done ? (
                    <>
                      <Text style={[styles.tileScore, { color: scoreColor(score.correct, score.total) }]}>
                        {score.correct} / {score.total}
                      </Text>
                      <View style={styles.tileBarBg}>
                        <View style={[
                          styles.tileBarFill,
                          { width: `${pct * 100}%`, backgroundColor: scoreColor(score.correct, score.total) },
                        ]} />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.tilePendingText}>Not started</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Words for the selected letter */}
          {expandedLetter && progress[expandedLetter] ? (() => {
            const wordResults = progress[expandedLetter];
            const score = calcLetterScore(wordResults);
            return (
              <View style={[styles.detailCard, { borderColor: theme.cardOutline }]}>
                <View style={styles.detailHeader}>
                  <View style={[styles.letterCircle, { backgroundColor: theme.button }]}>
                    <Text style={[styles.letterCircleText, { color: theme.buttonText }]}>
                      {expandedLetter.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.letterInfo}>
                    <Text style={[styles.detailTitle, { color: theme.headingText }]}>
                      Letter {expandedLetter.toUpperCase()}
                    </Text>
                    <Text style={[styles.letterScore, { color: scoreColor(score.correct, score.total) }]}>
                      {wordResults.length} {wordResults.length === 1 ? 'word' : 'words'} · {score.correct} / {score.total} correct
                    </Text>
                  </View>
                  {/* Legend — the three states, in words */}
                  <View style={styles.legend}>
                    {LEGEND.map(item => (
                      <View key={item.key} style={[styles.legendItem, { backgroundColor: item.bg }]}>
                        <Ionicons name={item.icon} size={13} color={item.color} />
                        <Text style={[styles.legendLabel, { color: item.color }]}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* One card per word: picture, word, and each activity with
                    its result spelled out. */}
                <View style={styles.wordGrid}>
                  {wordResults.map((item, i) => (
                    <WordRow key={`${item.word}-${i}`} item={item} />
                  ))}
                </View>
              </View>
            );
          })() : (
            <View style={[styles.detailCard, styles.emptyCard, { borderColor: theme.cardOutline }]}>
              <Ionicons name="hand-left-outline" size={22} color={theme.button} />
              <Text style={[styles.emptyText, { color: theme.headingText }]}>
                {sessionStats.lettersCompleted > 0
                  ? 'Tap a coloured letter to see its words.'
                  : 'No word practice saved yet.'}
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>

      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

// The three result states, spelled out — a teacher should not have to decode
// an icon. Shared by the legend and every word card.
const RESULT = {
  correct: { key: 'correct', label: 'On own',    icon: 'checkmark-circle',    color: '#2E7D32', bg: '#E8F5E9' },
  good:    { key: 'good',    label: 'With help', icon: 'help-circle',         color: '#E65100', bg: '#FFF3E0' },
  pending: { key: 'pending', label: 'Not yet',   icon: 'ellipse-outline',     color: '#8A9096', bg: '#F2F4F6' },
};
const LEGEND = [RESULT.correct, RESULT.good, RESULT.pending];

// Big enough to recognise the picture at a glance.
const WORD_ROW_IMAGE_SIZE = 56;

function WordRow({ item }) {
  const neededHelp = Object.values(item.status ?? {}).includes('good');
  const correct = Object.values(item.status).filter(s => s === 'correct').length;
  const stars   = correct === 4 ? 3 : correct >= 2 ? 2 : correct >= 1 ? 1 : 0;

  return (
    <View style={wordRowStyles.card}>
      <View style={wordRowStyles.head}>
        {/* Resolved FROM THE WORD, exactly as the Progress Report does it.
            These rows are the backend's word-progress payload - { word, status }
            and nothing else. Same canonical catalogue the child activities use. */}
        <WordImageDisplay
          imageKey={resolveWordImageKey(item.word)}
          emoji={resolveWordEmoji(item.word)}
          size={WORD_ROW_IMAGE_SIZE}
        />
        <Text style={wordRowStyles.word} numberOfLines={1}>
          {item.word.charAt(0).toUpperCase() + item.word.slice(1)}
        </Text>
        {neededHelp && (
          <View style={wordRowStyles.supportTag}>
            <Ionicons name="help-circle" size={13} color="#E65100" />
            <Text style={wordRowStyles.supportText}>Needed help</Text>
          </View>
        )}
      </View>

      <View style={wordRowStyles.chips}>
        {EXERCISES.map(ex => {
          const r = RESULT[item.status?.[ex]] ?? RESULT.pending;
          return (
            <View key={ex} style={[wordRowStyles.chip, { backgroundColor: r.bg }]}
              accessibilityLabel={`${EXERCISE_LABELS[ex]}: ${r.label}`}>
              <Ionicons name={r.icon} size={14} color={r.color} />
              <View style={wordRowStyles.chipText}>
                <Text style={wordRowStyles.chipName} numberOfLines={1}>{EXERCISE_LABELS[ex]}</Text>
                <Text style={[wordRowStyles.chipResult, { color: r.color }]}>{r.label}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* The word's overall star rating (0–3), as before. */}
      <View style={wordRowStyles.stars} accessibilityLabel={`${stars} of 3 stars`}>
        {[0, 1, 2].map(i => (
          <Ionicons
            key={i}
            name={i < stars ? 'star' : 'star-outline'}
            size={16}
            color={i < stars ? '#FFCA28' : '#CCCCCC'}
          />
        ))}
      </View>
    </View>
  );
}

const wordRowStyles = StyleSheet.create({
  // Two cards a row inside the details card.
  card: {
    width: '48.8%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    padding: 12,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { flex: 1, fontSize: 18, fontFamily: 'DMSans_800ExtraBold', color: '#222222' },
  supportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  supportText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#E65100' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexBasis: '31%',
    flexGrow: 1,
  },
  stars: { flexDirection: 'row', gap: 2, alignSelf: 'flex-end' },
  chipText:   { flex: 1 },
  chipName:   { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#5F6368' },
  chipResult: { fontSize: 12, fontFamily: 'DMSans_800ExtraBold' },
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
  value: { fontSize: 24, fontFamily: 'DMSans_800ExtraBold', lineHeight: 28 },
  of:    { fontSize: 12, color: '#8A8A8A', fontFamily: 'DMSans_700Bold', marginBottom: 3 },
  label: { fontSize: 12, color: '#5F6368', fontFamily: 'DMSans_700Bold', marginTop: 3 },
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // ── Decorative background shapes (same as the other module screens) ─────
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.08 },
  blobTopRight:   { width: 220, height: 220, top: -60, right: -60 },
  blobBottomLeft: { width: 260, height: 260, bottom: -80, left: -80 },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sideGroup: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  // The landing pages' round, translucent white button.
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  topMid: { alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  topTitle: {
    fontSize: 30,
    fontFamily: 'DMSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  topStudent: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    opacity: 0.6,
    marginTop: 2,
  },

  scroll: {
    paddingHorizontal: GRID_PAD,
    gap: 14,
  },

  // ── Overview card (landing-page frame) ────────────────────────────────────
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 3,
    padding: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
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
  summaryTitle: { fontSize: 20, fontFamily: 'DMSans_800ExtraBold' },
  summarySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6E7378',
    fontFamily: 'DMSans_600SemiBold',
    marginTop: 2,
  },
  accuracyBadge: {
    minWidth: 100,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  accuracyValue: { fontSize: 24, fontFamily: 'DMSans_800ExtraBold', lineHeight: 28 },
  accuracyLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', opacity: 0.9 },
  summaryStatsRow: { flexDirection: 'row', gap: 12 },

  sectionTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    marginTop: 4,
    marginLeft: 4,
  },

  // ── A–Z grid ──────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  tilePending: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderColor: 'rgba(255,255,255,0.0)',
    shadowOpacity: 0,
    elevation: 0,
  },
  tileLetter: { fontSize: 26, fontFamily: 'DMSans_800ExtraBold', lineHeight: 30 },
  tileScore:  { fontSize: 13, fontFamily: 'DMSans_800ExtraBold' },
  tilePendingText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#A9AFB5' },
  tileBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EEF1F4',
    overflow: 'hidden',
  },
  tileBarFill: { height: '100%', borderRadius: 3 },

  // ── By activity (inside the overview) ─────────────────────────────────────
  activitySection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F2',
    gap: 10,
  },
  activityHeading: { fontSize: 14, fontFamily: 'DMSans_800ExtraBold', color: '#3A3F45' },
  activityRow: { flexDirection: 'row', gap: 14 },
  activityItem: { flex: 1, gap: 6 },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityName: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#3A3F45', flexShrink: 1 },
  activityBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEF1F4',
    overflow: 'hidden',
  },
  activityBarOwn:  { backgroundColor: '#4CAF50' },
  activityBarHelp: { backgroundColor: '#FFA726' },
  activityCounts: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#6E7378' },

  // Letter tile marker: this letter needed help somewhere.
  tileHelpMark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFA726',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Word cards, two a row.
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
    paddingTop: 4,
  },

  // ── Selected letter's words ───────────────────────────────────────────────
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  letterCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  letterCircleText: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold' },
  letterInfo:  { flex: 1 },
  detailTitle: { fontSize: 18, fontFamily: 'DMSans_800ExtraBold' },
  letterScore: { fontSize: 13, fontFamily: 'DMSans_700Bold', marginTop: 2 },

  legend: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendLabel: { fontSize: 11, color: '#5F6368', fontFamily: 'DMSans_700Bold' },


  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 22,
  },
  emptyText: { fontSize: 15, fontFamily: 'DMSans_700Bold', opacity: 0.75 },
});
