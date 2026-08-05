/**
 * WordActivityScreen
 *
 * Per-letter activity loop:
 *   • 4 exercises (A→D) per word
 *   • After every word → next word immediately (no per-word summary)
 *   • After ALL words for this letter → show Letter Summary modal
 *   • Teacher can view all-letter progress via WordProgress screen
 *
 * ── How to add a new exercise type ──────────────────────────────────────────
 *  1. Create ExerciseE_YourName.js in src/components/word/
 *  2. Add 'E' to EXERCISES array below
 *  3. Add a label to EXERCISE_LABELS
 *  4. Add a case in renderExercise()
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

import WORD_DATA from '../../../constants/wordData';
import { recordLetterProgress } from '../../../constants/sessionProgress';
import { storeWordProgress } from '../../../utils/storage';
import WordImageDisplay from '../../../components/word/WordImageDisplay';
import ExerciseA_WriteFirst  from '../../../components/word/ExerciseA_WriteFirst';
import ExerciseB_CircleImage from '../../../components/word/ExerciseB_CircleImage';
import ExerciseC_FillBlank   from '../../../components/word/ExerciseC_FillBlank';
import ExerciseD_SpellWord   from '../../../components/word/ExerciseD_SpellWord';
import ExerciseE_WriteWord   from '../../../components/word/ExerciseE_WriteWord';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Exercise registry ────────────────────────────────────────────────────────

const EXERCISES = ['A', 'B', 'C', 'D', 'E'];

const EXERCISE_LABELS = {
  A: 'First Letter',
  B: 'Find the Picture',
  C: 'Fill the Gap',
  D: 'Spell It!',
  E: 'Write the Word',
};

// ─── Status display config ────────────────────────────────────────────────────

const STATUS = {
  pending: { icon: 'ellipse-outline',     dotColor: '#E0E0E0', badgeBg: '#F5F5F5', badgeBorder: '#E0E0E0', iconColor: '#9E9E9E', label: 'Not done'  },
  correct: { icon: 'checkmark-circle',    dotColor: '#4CAF50', badgeBg: '#E8F5E9', badgeBorder: '#81C784', iconColor: '#2E7D32', label: 'Correct!'   },
  good:    { icon: 'help-circle-outline', dotColor: '#FF9800', badgeBg: '#FFF3E0', badgeBorder: '#FFB74D', iconColor: '#E65100', label: 'With help'  },
};

const BLANK_STATUS = { A: 'pending', B: 'pending', C: 'pending', D: 'pending', E: 'pending' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function getLengthGroup(word) {
  const l = word.length;
  if (l <= 3) return 3;
  if (l <= 4) return 4;
  return 5;
}

// 0-3 stars from a status map
function calcStars(statusMap) {
  const correct = Object.values(statusMap).filter(s => s === 'correct').length;
  if (correct === EXERCISES.length)                      return 3;
  if (correct >= Math.ceil(EXERCISES.length / 2))       return 2;
  if (correct >= 1)                                      return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WordActivityScreen({ route, navigation }) {
  const { student, theme, letter = 'a' } = route.params;

  // ── Letter-scoped word list ───────────────────────────────────────────────
  const letterWords = useMemo(() =>
    WORD_DATA
      .filter(e => e.letter === letter)
      .sort((a, b) => getLengthGroup(a.word) - getLengthGroup(b.word)),
    [letter]
  );

  const nextLetter = useMemo(() => {
    const idx = ALPHABET.indexOf(letter);
    return idx < 25 ? ALPHABET[idx + 1] : null;
  }, [letter]);

  // Length-group celebrations (between short/medium/long word groups)
  const GROUP_CELEBRATIONS = useMemo(() => ({
    3: { icon: 'star-outline',   title: 'Short words done!',   msg: `Great with short '${letter.toUpperCase()}' words! Keep going!` },
    4: { icon: 'star',           title: '4-letter words done!', msg: `Stronger every time with '${letter.toUpperCase()}'!` },
    5: { icon: 'trophy-outline', title: 'Long words done!',     msg: `You nailed all the long '${letter.toUpperCase()}' words!` },
  }), [letter]);

  // ── Word / exercise state ─────────────────────────────────────────────────
  const [wordIdx,    setWordIdx]    = useState(0);
  const [exIdx,      setExIdx]      = useState(0);
  const [exStatus,   setExStatus]   = useState(BLANK_STATUS);
  const [score,      setScore]      = useState({ correct: 0, total: 0 });

  // Snapshot of all word results — set when letter is done, drives the summary modal
  const [letterDoneData, setLetterDoneData] = useState(null);

  // Accumulates word results throughout this letter (ref = no re-render overhead)
  const letterStatsRef = useRef([]);

  // ── Celebration state (group or letter-done) ──────────────────────────────
  const [celebrating, setCelebrating] = useState(null); // '3'|'4'|'5'|'done'

  const pendingNextWordIdx = useRef(null);
  const cardAnim = useRef(new Animated.Value(1)).current;

  const currentWord = letterWords[wordIdx];

  // ── Speak word on change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentWord) return;
    Speech.stop();
    if (currentWord.word === 'ant') {
      Speech.speak(currentWord.word, { rate: 0.75, pitch: 1.0, language: 'en-US' });
    }
    return () => Speech.stop();
  }, [currentWord?.word]);

  // ── Card transition animation ─────────────────────────────────────────────
  function animateTransition(cb) {
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start(cb);
  }

  // ── Core exercise handler ─────────────────────────────────────────────────
  const handleExerciseComplete = useCallback((wasCorrect) => {
    const ex        = EXERCISES[exIdx];
    const result    = wasCorrect ? 'correct' : 'good';
    const newStatus = { ...exStatus, [ex]: result };

    setExStatus(newStatus);
    setScore(s => ({ correct: s.correct + (wasCorrect ? 1 : 0), total: s.total + 1 }));

    if (exIdx < EXERCISES.length - 1) {
      // More exercises for this word → advance
      animateTransition(() => setExIdx(e => e + 1));
      return;
    }

    // ── Last exercise of this word ────────────────────────────────────────
    const wordResult = {
      word:     currentWord.word,
      emoji:    currentWord.emoji,
      imageKey: currentWord.imageKey,
      status:   newStatus,
    };
    letterStatsRef.current = [...letterStatsRef.current, wordResult];

    const nextWordIdx = wordIdx + 1;
    pendingNextWordIdx.current = nextWordIdx;

    if (nextWordIdx >= letterWords.length) {
      // All words for this letter complete — show letter summary
      setLetterDoneData(letterStatsRef.current);
      setCelebrating('done');
      return;
    }

    const curGroup  = getLengthGroup(letterWords[wordIdx].word);
    const nextGroup = getLengthGroup(letterWords[nextWordIdx].word);

    if (nextGroup > curGroup) {
      setCelebrating(curGroup.toString());
    } else {
      animateTransition(() => {
        setWordIdx(nextWordIdx);
        setExIdx(0);
        setExStatus(BLANK_STATUS);
      });
    }
  }, [wordIdx, exIdx, exStatus, currentWord, letterWords]);

  // ── Celebration dismiss ───────────────────────────────────────────────────
  function handleCelebrationDone() {
    const nextIdx = pendingNextWordIdx.current;
    pendingNextWordIdx.current = null;
    setCelebrating(null);

    if (celebrating === 'done') {
      // Persist this letter's results — memory cache + AsyncStorage
      recordLetterProgress(letter, letterStatsRef.current);
      storeWordProgress(student?.sid ?? 0, letter, letterStatsRef.current);
      if (nextLetter) {
        navigation.replace('WordWriting', { student, theme, letter: nextLetter });
      } else {
        navigation.navigate('LetterHome', { student, theme });
      }
      return;
    }

    // Length-group celebration dismissed → advance to next word
    if (nextIdx === null || nextIdx >= letterWords.length) return;
    animateTransition(() => {
      setWordIdx(nextIdx);
      setExIdx(0);
      setExStatus(BLANK_STATUS);
    });
  }

  // ── Letter summary stats (computed from snapshot) ─────────────────────────
  const letterStats = useMemo(() => {
    if (!letterDoneData) return null;
    const totalEx   = letterDoneData.length * EXERCISES.length;
    const correctEx = letterDoneData.reduce(
      (sum, w) => sum + Object.values(w.status).filter(s => s === 'correct').length, 0
    );
    const goodEx    = letterDoneData.reduce(
      (sum, w) => sum + Object.values(w.status).filter(s => s === 'good').length, 0
    );
    return { totalEx, correctEx, goodEx };
  }, [letterDoneData]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentWord) return null;

  const exKey     = EXERCISES[exIdx];
  const celebrate = celebrating && celebrating !== 'done'
    ? GROUP_CELEBRATIONS[celebrating]
    : null;

  // ── Exercise renderer ─────────────────────────────────────────────────────
  function renderExercise() {
    const props = {
      wordEntry:  currentWord,
      allWords:   WORD_DATA,
      theme,
      onComplete: handleExerciseComplete,
    };
    switch (exKey) {
      case 'A': return <ExerciseA_WriteFirst  key={`${currentWord.word}-A`} {...props} />;
      case 'B': return <ExerciseB_CircleImage key={`${currentWord.word}-B`} {...props} />;
      case 'C': return <ExerciseC_FillBlank   key={`${currentWord.word}-C`} {...props} />;
      case 'D': return <ExerciseD_SpellWord   key={`${currentWord.word}-D`} {...props} />;
      case 'E': return <ExerciseE_WriteWord   key={`${currentWord.word}-E`} {...props} />;
      default:  return null;
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.headingText} />
          </TouchableOpacity>

          <View style={styles.counterRow}>
            <View style={[styles.letterBadge, { backgroundColor: theme.button }]}>
              <Text style={[styles.letterBadgeText, { color: theme.buttonText }]}>
                {letter.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.counterText, { color: theme.headingText }]}>
              Word {wordIdx + 1} / {letterWords.length}
            </Text>
            <View style={[styles.scoreBadge, { backgroundColor: theme.button }]}>
              <Text style={[styles.scoreText, { color: theme.buttonText }]}>
                {score.correct} / {score.total}
              </Text>
            </View>
          </View>

          {/* Teacher shortcut to all-letters progress */}
          <TouchableOpacity
            onPress={() => navigation.navigate('WordProgress', { student, theme })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="bar-chart-outline" size={22} color={theme.headingText} />
          </TouchableOpacity>
        </View>

        {/* ── Exercise progress dots (live status colours) ── */}
        <View style={styles.dotsRow}>
          {EXERCISES.map((ex, i) => {
            const cfg       = STATUS[exStatus?.[ex]] ?? STATUS.pending;
            const isCurrent = i === exIdx;
            return (
              <View key={ex} style={styles.dotItem}>
                <View style={[
                  styles.dot,
                  { backgroundColor: isCurrent ? theme.button : cfg.dotColor },
                  isCurrent && styles.dotActive,
                ]} />
                <Text style={[styles.dotLabel, { color: isCurrent ? theme.button : cfg.dotColor }]}>
                  {ex}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.exLabel, { color: theme.headingText }]}>
          {EXERCISE_LABELS[exKey]}
        </Text>

        {/* ── Exercise card ── */}
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { opacity: cardAnim }]}>
            <TouchableOpacity
              style={styles.wordHeader}
              onPress={() => {
                if (currentWord.word === 'ant') {
                  Speech.stop();
                  Speech.speak(currentWord.word, { rate: 0.75, pitch: 1.0, language: 'en-US' });
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.wordDisplay}>{currentWord.word.toUpperCase()}</Text>
              <Ionicons name="volume-high-outline" size={22} color="#888888" />
            </TouchableOpacity>
            <View style={styles.divider} />
            {renderExercise()}
          </Animated.View>
        </View>

      </SafeAreaView>

      {/* ════════════════════════════════════════════════════════════════════
          Group celebration modal  (short / medium / long words done)
         ════════════════════════════════════════════════════════════════════ */}
      {celebrate && (
        <Modal visible transparent animationType="fade" onRequestClose={handleCelebrationDone}>
          <View style={styles.overlay}>
            <View style={styles.simpleCelebCard}>
              <View style={[styles.celebIconWrap, { backgroundColor: theme.button + '18' }]}>
                <Ionicons name={celebrate.icon} size={44} color={theme.button} />
              </View>
              <Text style={[styles.celebTitle, { color: theme.headingText }]}>{celebrate.title}</Text>
              <Text style={styles.celebMsg}>{celebrate.msg}</Text>
              <Text style={styles.celebScore}>Score so far: {score.correct} / {score.total}</Text>
              <TouchableOpacity
                style={[styles.celebBtn, { backgroundColor: theme.button }]}
                onPress={handleCelebrationDone}
                activeOpacity={0.8}
              >
                <Text style={[styles.celebBtnText, { color: theme.buttonText }]}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.buttonText} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Letter-done modal  — full word-by-word results summary
         ════════════════════════════════════════════════════════════════════ */}
      {celebrating === 'done' && letterDoneData && letterStats && (
        <Modal visible transparent animationType="slide" onRequestClose={handleCelebrationDone}>
          <View style={styles.overlay}>
            <View style={styles.letterDoneCard}>

              {/* Header */}
              <View style={styles.ldHeader}>
                <View style={[styles.ldIconWrap, { backgroundColor: theme.button + '18' }]}>
                  <Ionicons name="trophy-outline" size={36} color={theme.button} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.ldTitle}>
                    Letter {letter.toUpperCase()} Complete!
                  </Text>
                  <Text style={styles.ldScore}>
                    {letterStats.correctEx} / {letterStats.totalEx} exercises correct
                    {letterStats.goodEx > 0 ? `  ·  ${letterStats.goodEx} with help` : ''}
                  </Text>
                </View>
              </View>

              {/* Stat pills */}
              <View style={styles.ldPills}>
                <StatPill count={letterStats.correctEx} label="Correct"  color="#2E7D32" bg="#E8F5E9" />
                <StatPill count={letterStats.goodEx}    label="With help" color="#E65100" bg="#FFF3E0" />
                <StatPill
                  count={letterStats.totalEx - letterStats.correctEx - letterStats.goodEx}
                  label="Pending"
                  color="#9E9E9E" bg="#F5F5F5"
                />
              </View>

              <View style={styles.ldDivider} />

              {/* Scrollable word results */}
              <ScrollView
                style={styles.ldScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {letterDoneData.map((item, i) => (
                  <WordResultRow key={`${item.word}-${i}`} item={item} />
                ))}
              </ScrollView>

              <View style={styles.ldDivider} />

              {/* Action button */}
              <TouchableOpacity
                style={[styles.celebBtn, { backgroundColor: theme.button }]}
                onPress={handleCelebrationDone}
                activeOpacity={0.85}
              >
                <Text style={[styles.celebBtnText, { color: theme.buttonText }]}>
                  {nextLetter
                    ? `Next: Letter ${nextLetter.toUpperCase()}`
                    : 'All Done!'}
                </Text>
                <Ionicons
                  name={nextLetter ? 'arrow-forward' : 'checkmark-circle-outline'}
                  size={16}
                  color={theme.buttonText}
                />
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      )}
    </LinearGradient>
  );
}

// ─── Word result row (inside letter-done modal) ───────────────────────────────

function WordResultRow({ item }) {
  const stars = calcStars(item.status);
  return (
    <View style={rowStyles.row}>
      <WordImageDisplay imageKey={item.imageKey} emoji={item.emoji} size={36} />
      <Text style={rowStyles.word} numberOfLines={1}>{item.word}</Text>
      <View style={rowStyles.badges}>
        {EXERCISES.map(ex => {
          const cfg = STATUS[item.status?.[ex]] ?? STATUS.pending;
          return (
            <View key={ex} style={[rowStyles.badge, { backgroundColor: cfg.badgeBg, borderColor: cfg.badgeBorder }]}>
              <Text style={[rowStyles.badgeLetter, { color: cfg.iconColor }]}>{ex}</Text>
              <Ionicons name={cfg.icon} size={10} color={cfg.iconColor} />
            </View>
          );
        })}
      </View>
      <View style={rowStyles.stars}>
        {[0, 1, 2].map(i => (
          <Ionicons
            key={i}
            name={i < stars ? 'star' : 'star-outline'}
            size={14}
            color={i < stars ? '#FFCA28' : '#CCCCCC'}
          />
        ))}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  word: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
    textTransform: 'capitalize',
  },
  badges: {
    flexDirection: 'row',
    gap: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 1,
  },
  badgeLetter: { fontSize: 10, fontWeight: '900' },
  badgeIcon:   { fontSize: 10, fontWeight: '900' },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  star: { fontSize: 12 },
});

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ count, label, color, bg }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg }]}>
      <Text style={[pillStyles.count, { color }]}>{count}</Text>
      <Text style={[pillStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill:  { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 2 },
  count: { fontSize: 22, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '600' },
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
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  letterBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  letterBadgeText: { fontSize: 16, fontWeight: '900' },
  counterText:     { fontSize: 15, fontWeight: '700' },
  scoreBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 50 },
  scoreText:  { fontSize: 13, fontWeight: '700' },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 4,
  },
  dotItem:  { alignItems: 'center', gap: 3 },
  dot:      { width: 12, height: 12, borderRadius: 6 },
  dotActive:{ width: 22, borderRadius: 11 },
  dotLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  exLabel: {
    fontSize: 13, fontWeight: '700', textAlign: 'center',
    letterSpacing: 0.5, marginBottom: 8, opacity: 0.7,
  },

  cardContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 18,
    alignItems: 'center',
  },
  card: {
    flex: 1,
    width: '100%', maxWidth: 780,
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 30,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
    gap: 16,
  },
  wordHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  wordDisplay: { fontSize: 32, fontWeight: '900', color: '#1A1A1A', letterSpacing: 4 },
  divider:     { height: 1, backgroundColor: '#F0F0F0' },

  // ── Shared celebration elements ───────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  celebIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  celebTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  celebMsg:   { fontSize: 14, color: '#555555', textAlign: 'center', lineHeight: 21 },
  celebScore: { fontSize: 13, fontWeight: '700', color: '#7B1FA2', marginTop: 2 },
  celebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 50, paddingHorizontal: 36, paddingVertical: 14,
    width: '100%', marginTop: 4,
  },
  celebBtnText: { fontSize: 17, fontWeight: '800' },

  // ── Simple group celebration card ─────────────────────────────────────────
  simpleCelebCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 32, alignItems: 'center',
    gap: 10, elevation: 8,
  },

  // ── Letter-done card ──────────────────────────────────────────────────────
  letterDoneCard: {
    width: '100%', maxWidth: 480,
    backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 24, elevation: 8,
    maxHeight: SCREEN_H * 0.82,
  },
  ldHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ldIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  ldTitle:  { fontSize: 20, fontWeight: '900', color: '#1A1A1A' },
  ldScore:  { fontSize: 13, color: '#666666', marginTop: 2, fontWeight: '500' },
  ldPills:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ldDivider:{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  ldScroll: { maxHeight: SCREEN_H * 0.38 },
});
