/**
 * WordActivityScreen
 *
 * One-word practice unit:
 *   • Exercises A→E stay on the route's current word
 *   • Passed E returns to WordWriting for the next selected word
 *   • Passed E on the final word opens server-backed WordProgress
 *
 * ── How to add a new exercise type ──────────────────────────────────────────
 *  1. Create ExerciseE_YourName.js in src/components/word/
 *  2. Add 'E' to EXERCISES array below
 *  3. Add a label to EXERCISE_LABELS
 *  4. Add a case in renderExercise()
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useLearningSessionActivity } from '../../../context/LearningSessionContext';
import { LIVE_ACTIVITY_TYPES } from '../../../constants/liveSessionPolicy';
import { buildProgressPatch } from '../../../utils/liveSessionSnapshot';
import BreakPromptModal from '../../../components/handwriting/BreakPromptModal';

import WORD_DATA from '../../../constants/wordData';
import { saveWordActivity } from '../../../utils/wordApi';
import { afterExerciseESuccess, buildWordRouteParams, resolveWordSession } from '../../../utils/wordWorkflow';
import ExerciseA_WriteFirst  from '../../../components/word/ExerciseA_WriteFirst';
import ExerciseB_CircleImage from '../../../components/word/ExerciseB_CircleImage';
import ExerciseC_FillBlank   from '../../../components/word/ExerciseC_FillBlank';
import ExerciseD_SpellWord   from '../../../components/word/ExerciseD_SpellWord';
import ExerciseE_WriteWord   from '../../../components/word/ExerciseE_WriteWord';
import { useLockLandscape } from '../../../utils/useOrientationLock';

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

// ─────────────────────────────────────────────────────────────────────────────

export default function WordActivityScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  const { student, theme } = route.params;
  const { selectedLetter: letter, selectedWords: letterWords, currentWordIndex: wordIdx, currentWord } = resolveWordSession(route.params);

  // Proposal FR-13, Phase 7A / FR-16, Phase 7B — registers the WHOLE A→E
  // practice flow as one active learning screen (word writing/practice —
  // spec item 4). Stroke notification for Exercise E's own canvas happens
  // inside ExerciseE_WriteWord.js itself, via the base (non-registering)
  // hook. The return value is used here only for its own current_item
  // (word) push below — Exercise E's own score save is out of this
  // screen's scope (it saves through the same saveWordActivity path as
  // Exercises A-D; no separate score push is added there in this pass).
  const { notifyLiveSessionUpdate } = useLearningSessionActivity({
    studentId: student.sid,
    activityType: LIVE_ACTIVITY_TYPES.WORD_ACTIVITY,
  });

  // ── Letter-scoped word list ───────────────────────────────────────────────
  // ── Word / exercise state ─────────────────────────────────────────────────
  const [exIdx,      setExIdx]      = useState(0);
  const [exStatus,   setExStatus]   = useState(BLANK_STATUS);
  const [score,      setScore]      = useState({ correct: 0, total: 0 });

  // Snapshot of all word results — set when letter is done, drives the summary modal

  // Accumulates word results throughout this letter (ref = no re-render overhead)

  // ── Celebration state (group or letter-done) ──────────────────────────────
  const cardAnim = useRef(new Animated.Value(1)).current;

  // ── Speak word on change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentWord) return;
    Speech.stop();
    if (currentWord.word === 'ant') {
      Speech.speak(currentWord.word, { rate: 0.75, pitch: 1.0, language: 'en-US' });
    }
    return () => Speech.stop();
  }, [currentWord?.word]);

  // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical block.
  // No case_type/support_level/attempt_number concept at this screen's
  // level (exercises A-E are not "attempts" in the letter-writing sense).
  useEffect(() => {
    if (!currentWord?.word) return;
    notifyLiveSessionUpdate(buildProgressPatch({ currentItem: currentWord.word }));
  }, [currentWord?.word, notifyLiveSessionUpdate]);

  // ── Card transition animation ─────────────────────────────────────────────
  function animateTransition(cb) {
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start(cb);
  }

  // ── Core exercise handler ─────────────────────────────────────────────────
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const handleExerciseComplete = useCallback(async (wasCorrect) => {
    if (saving) return;
    const ex        = EXERCISES[exIdx];
    const result    = wasCorrect ? 'correct' : 'good';
    if (ex !== 'E') {
      setSaving(true); setSaveError(null);
      try { await saveWordActivity({ student, word: currentWord.word, activity: ex, status: result }); }
      catch { setSaveError('Could not save yet. Check the connection and try again.'); setSaving(false); return; }
      setSaving(false);
    }
    const newStatus = { ...exStatus, [ex]: result };

    setExStatus(newStatus);
    setScore(s => ({ correct: s.correct + (wasCorrect ? 1 : 0), total: s.total + 1 }));

    if (exIdx < EXERCISES.length - 1) {
      // More exercises for this word → advance
      animateTransition(() => setExIdx(e => e + 1));
      return;
    }

    // ── Last exercise of this word ────────────────────────────────────────
    const transition = afterExerciseESuccess(wordIdx, letterWords.length);
    if (transition.route === 'WordWriting') {
      navigation.replace('WordWriting', buildWordRouteParams({
        student,
        theme,
        selectedLetter: letter,
        selectedWords: letterWords,
        currentWordIndex: transition.currentWordIndex,
      }));
      return;
    }
    navigation.replace('WordProgress', { student, studentId: Number(student?.sid), theme });
  }, [wordIdx, exIdx, exStatus, currentWord, letterWords, saving, student, theme, letter, navigation]);

  // ── Celebration dismiss ───────────────────────────────────────────────────
  // ── Letter summary stats (computed from snapshot) ─────────────────────────
  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentWord) return null;

  const exKey     = EXERCISES[exIdx];
  // ── Exercise renderer ─────────────────────────────────────────────────────
  function renderExercise() {
    const props = {
      wordEntry:  currentWord,
      allWords:   WORD_DATA,
      theme,
      student,
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
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
            {saveError && <Text accessibilityRole="alert" style={{ color:'#B91C1C', fontWeight:'700', textAlign:'center' }}>{saveError}</Text>}
            {renderExercise()}
          </Animated.View>
        </View>

      </SafeAreaView>

      {/* ════════════════════════════════════════════════════════════════════
          Group celebration modal  (short / medium / long words done)
         ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════
          Letter-done modal  — full word-by-word results summary
         ════════════════════════════════════════════════════════════════════ */}

      <BreakPromptModal navigation={navigation} student={student} theme={theme} />
    </LinearGradient>
  );
}

// ─── Word result row (inside letter-done modal) ───────────────────────────────

// ─── Stat pill ────────────────────────────────────────────────────────────────

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
