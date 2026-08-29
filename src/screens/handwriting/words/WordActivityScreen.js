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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
// One-time demonstration for the letter-tile spelling activity (Exercise D)
// only — see utils/demoPolicy.js for why A/B/C and E get none.
import { useDemoDetour } from '../../../utils/demoDetour';
import { DEMO_KEYS } from '../../../utils/demoPolicy';
import ExerciseA_WriteFirst  from '../../../components/word/ExerciseA_WriteFirst';
import ExerciseB_CircleImage from '../../../components/word/ExerciseB_CircleImage';
import ExerciseC_FillBlank   from '../../../components/word/ExerciseC_FillBlank';
import ExerciseD_SpellWord   from '../../../components/word/ExerciseD_SpellWord';
import ExerciseE_WriteWord   from '../../../components/word/ExerciseE_WriteWord';
import { useLockLandscape } from '../../../utils/useOrientationLock';
import useGatedBack from '../../../utils/useGatedBack';
import { goBackToOrigin } from '../../../utils/backToOrigin';
import { SPEECH_LOCALE_EN } from '../../../constants/speechLocale';
import AttemptAvatarFeedback from '../AttemptAvatarFeedback';
import ResultGifFeedback from '../../../components/feedback/ResultGifFeedback';
import { RESULT_GIF_MS } from '../../../constants/resultGifFeedback';
import { spokenWord } from '../../../utils/wordSpeech';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../../../constants/childInstructions';
import { useInstructionAudioState } from '../../../utils/useInstructionAudio';
import InstructionReplayButton from '../../../components/handwriting/InstructionReplayButton';
import WordPracticeResultCard from '../../../components/word/WordPracticeResultCard';

// The same dwell the letter screens give their feedback.
const ATTEMPT_FEEDBACK_MS = 2200;
const INCOMPLETE_WORD_FEEDBACK = Object.freeze({
  passed: false,
  isWriting: true,
  note: 'Finish every letter',
});

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Exercise registry ────────────────────────────────────────────────────────

const EXERCISES = ['A', 'B', 'C', 'D', 'E'];
const WORD_EXERCISE_COUNT = EXERCISES.length;

const EXERCISE_LABELS = {
  A: 'First Letter',
  B: 'Find the Picture',
  C: 'Fill the Gap',
  D: 'Spell It!',
  E: 'Write the Word',
};

const EXERCISE_INSTRUCTION_KEY = Object.freeze({
  A: INSTRUCTION_KEYS.CHOOSE_FIRST_LETTER,
  B: INSTRUCTION_KEYS.CHOOSE_PICTURE,
  C: INSTRUCTION_KEYS.CHOOSE_MISSING_LETTER,
  D: INSTRUCTION_KEYS.MAKE_WORD,
  E: INSTRUCTION_KEYS.WRITE_WORD,
});

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

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Back returns to the interface this flow STARTED from, not one frame down.
  //
  // Every warm-up detour is entered with navigation.navigate('PreWritingActivity'
  // | 'HandwritingDemo') — a PUSH — and left with navigation.replace(nextRoute).
  // replace() swaps the top frame, so each detour permanently leaves the frame
  // it was pushed over behind it. After one category transition the stack reads
  // [WordLetterSelect, WordPractice, WordPractice], and goBack() landed on that stale
  // copy — a previous letter, mid-cycle, from before the detour. A second
  // detour left two.
  //
  // goBackToOrigin pops to the named route instead, so the depth of the stack
  // stops mattering. It falls back to goBack() when the origin is not below
  // this screen (an assessment or Writing-Check entry), which is the previous
  // behaviour and safe. Navigation only: nothing here writes an attempt,
  // consumes a cycle, or replays a warm-up.
  const backOrigin = route.params?.originRoute ?? 'WordLetterSelect';
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, backOrigin)
  );

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
  // Seeded from the route so a demonstration detour can hand the child back
  // to the exercise they were about to start, rather than restarting the
  // whole A→E run at A. Defaults to 0 for every normal entry.
  const [exIdx,      setExIdx]      = useState(() => {
    const requested = Number(route.params?.initialExerciseIndex ?? 0);
    return Number.isInteger(requested) && requested >= 0 && requested < WORD_EXERCISE_COUNT
      ? requested : 0;
  });
  const [exStatus, setExStatus] = useState(() => ({
    ...BLANK_STATUS,
    ...(route.params?.initialExerciseStatus ?? {}),
  }));
  const [score, setScore] = useState(() => ({
    correct: Object.values(route.params?.initialExerciseStatus ?? {}).filter(status => status === 'correct').length,
    total: Object.values(route.params?.initialExerciseStatus ?? {}).filter(status => status === 'correct' || status === 'good').length,
  }));

  // ── One-time spelling-tile demonstration (utils/demoPolicy.js) ───────────
  // Exercise D is the only word activity that gets one. A, B and C are all
  // "tap the correct large option" — an interaction this child already
  // performs throughout the concept tiers — and E is the same write-on-a-
  // guide canvas the word-writing introduction already demonstrated.
  // Arranging letter tiles into an order is genuinely new, so it is shown
  // once, the first time the child reaches it.
  const currentExercise = EXERCISES[exIdx];
  const {
    replay: replayInstruction,
    instructionPlaying,
    canWrite: instructionCanWrite,
    requestTargetSpeech,
  } = useInstructionAudioState(
    EXERCISE_INSTRUCTION_KEY[currentExercise],
    {
      autoPlay: currentExercise === 'E',
      autoPlayToken: currentExercise === 'E' ? `${currentWord?.word ?? ''}:E` : null,
      fallbackText: currentExercise === 'E'
        ? CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.WRITE_WORD].en
        : '',
    },
  );
  const replayCurrentInstruction = useCallback(() => {
    if (currentExercise === 'E') Speech.stop();
    return replayInstruction();
  }, [currentExercise, replayInstruction]);
  const spellDemoLetters = useMemo(
    () => (currentWord?.word ?? '').replace(/[^a-z]/gi, '').toLowerCase().split(''),
    [currentWord?.word],
  );

  useDemoDetour({
    studentId: student?.sid,
    demoKey: DEMO_KEYS.WORD_ACTIVITY_SPELL_TILES,
    enabled: currentExercise === 'D' && spellDemoLetters.length > 0,
    navigate: () => {
      navigation.navigate('HandwritingDemo', {
        student, theme,
        demoKey: DEMO_KEYS.WORD_ACTIVITY_SPELL_TILES,
        // The child's own current word, so the example is the task — the
        // demo calls no scoring or evaluation function with it.
        tapLetters: spellDemoLetters,
        nextRoute: 'WordPractice',
        nextParams: {
          ...buildWordRouteParams({
            student, theme,
            selectedLetter: letter, selectedWords: letterWords, currentWordIndex: wordIdx,
          }),
          // Resume at Exercise D, not back at A.
          initialExerciseIndex: exIdx,
          // The demo is a presentation detour, so the A-C outcomes already
          // earned for this word must return with the child as session state.
          initialExerciseStatus: exStatus,
        },
      });
    },
  });

  // Snapshot of all word results — set when letter is done, drives the summary modal

  // Accumulates word results throughout this letter (ref = no re-render overhead)

  // ── Celebration state (group or letter-done) ──────────────────────────────
  const cardAnim = useRef(new Animated.Value(1)).current;

  // ── Speak word on change ──────────────────────────────────────────────────
  // Every word speaks. This effect used to be wrapped in
  // `if (currentWord.word === 'ant')`, so ANT was the only word the child ever
  // heard — not a stale closure, an allow-list. It fires on the CURRENT word
  // and on nothing else: strokes, feedback, Clear and answer selection all
  // leave it alone because none of them appear in its dependencies.
  useEffect(() => {
    if (currentExercise === 'E') return undefined;
    const spoken = spokenWord(currentWord);
    if (!spoken) return undefined;
    Speech.stop();
    Speech.speak(spoken, { rate: 0.75, pitch: 1.0, language: SPEECH_LOCALE_EN });
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
  const [activityFeedback, setActivityFeedback] = useState(null);
  const [wordResult, setWordResult] = useState(null);
  const advancingRef  = useRef(false);
  const answerFeedbackRef = useRef(false);
  const incompleteFeedbackRef = useRef(false);
  const resultContinuingRef = useRef(false);
  const feedbackTimerRef = useRef(null);
  const wrongTimerRef    = useRef(null);

  // A screen torn down mid-feedback must not resolve into a navigate.
  useEffect(() => () => {
    clearTimeout(feedbackTimerRef.current);
    clearTimeout(wrongTimerRef.current);
  }, []);

  // ── A wrong ANSWER, shown and then gone ───────────────────────────────────
  // A-D report every wrong choice here. This presents the verdict and nothing
  // else: no save, no score, no advance, no completion. The exercise stays on
  // screen so the child can try again, which is the whole point.
  const showChoiceAnswerFeedback = useCallback((passed) => {
    if (advancingRef.current || answerFeedbackRef.current) return Promise.resolve(false);
    answerFeedbackRef.current = true;
    clearTimeout(wrongTimerRef.current);
    setActivityFeedback({ passed, isWriting: false });
    return new Promise((resolve) => {
      wrongTimerRef.current = setTimeout(() => {
        setActivityFeedback(null);
        answerFeedbackRef.current = false;
        resolve(true);
      }, RESULT_GIF_MS);
    });
  }, []);
  const showWrongAnswerFeedback = useCallback(
    () => showChoiceAnswerFeedback(false), [showChoiceAnswerFeedback]);
  const showCorrectAnswerFeedback = useCallback(
    () => showChoiceAnswerFeedback(true), [showChoiceAnswerFeedback]);
  const showIncompleteWritingFeedback = useCallback(() => {
    if (advancingRef.current || incompleteFeedbackRef.current) return Promise.resolve(false);
    incompleteFeedbackRef.current = true;
    clearTimeout(feedbackTimerRef.current);
    setActivityFeedback(INCOMPLETE_WORD_FEEDBACK);
    return new Promise((resolve) => {
      feedbackTimerRef.current = setTimeout(() => {
        setActivityFeedback(null);
        incompleteFeedbackRef.current = false;
        resolve(true);
      }, ATTEMPT_FEEDBACK_MS);
    });
  }, []);
  const handleExerciseComplete = useCallback(async (wasCorrect, note) => {
    // `advancing` is the double-progression guard. Each exercise already
    // waits ~500ms before reporting, and the feedback below adds its own
    // pause — a second report arriving in that window must not advance twice
    // or navigate twice.
    if (saving || advancingRef.current) return;
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

    // A-D present their selected verdict before reporting completion. E is
    // handwriting, so it keeps the existing themed-avatar dwell here.
    const isWriting = ex === 'E';
    advancingRef.current = true;
    // E alone reaches this presentation branch; choice GIFs are independent
    // of the saved first-try/with-help status.
    if (isWriting) {
      clearTimeout(wrongTimerRef.current);
      setActivityFeedback({ passed: wasCorrect, isWriting: true, note });
      await new Promise((resolve) => {
        feedbackTimerRef.current = setTimeout(resolve, ATTEMPT_FEEDBACK_MS);
      });
      setActivityFeedback(null);
    }

    if (exIdx < EXERCISES.length - 1) {
      // More exercises for this word → advance
      advancingRef.current = false;
      animateTransition(() => setExIdx(e => e + 1));
      return;
    }

    // The authoritative A-E statuses drive the per-word presentation. The
    // existing next-word/final-session transition runs only from Keep Going.
    setWordResult({ word: currentWord.word, statuses: newStatus });
  }, [wordIdx, exIdx, exStatus, currentWord, letterWords, saving, student, theme, letter, navigation]);

  const continueFromWordResult = useCallback(() => {
    if (!wordResult || resultContinuingRef.current) return;
    resultContinuingRef.current = true;
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
  }, [wordResult, wordIdx, letterWords, navigation, student, theme, letter]);

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
      onWrongAnswer: showWrongAnswerFeedback,
      onCorrectAnswer: showCorrectAnswerFeedback,
      onIncomplete: showIncompleteWritingFeedback,
      canWrite: currentExercise !== 'E' || instructionCanWrite,
      requestTargetSpeech,
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
            onPress={requestBack}
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
        {activityFeedback?.isWriting && (
          <AttemptAvatarFeedback
            avatarKey={student?.avatar_key}
            passed={activityFeedback.passed}
            note={activityFeedback.note}
            supportLevel="low"
            theme={theme}
          />
        )}
        <ResultGifFeedback
          visible={Boolean(activityFeedback) && !activityFeedback.isWriting}
          correct={Boolean(activityFeedback?.passed)}
        />

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

        <View style={styles.exLabelRow}>
          <Text style={[styles.exLabel, { color: theme.headingText }]}>
            {EXERCISE_LABELS[exKey]}
          </Text>
          <InstructionReplayButton
            onPress={replayCurrentInstruction}
            color={theme.buttonText}
            backgroundColor={theme.button}
            style={styles.instructionSpeaker}
          />
        </View>

        {/* ── Exercise card ── */}
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.card, { opacity: cardAnim }]}>
            <TouchableOpacity
              style={styles.wordHeader}
              onPress={() => {
                if (currentExercise === 'E' && instructionPlaying) return;
                // Resolved at PRESS time, from the word being displayed on the
                // line below — never a captured first word.
                const spoken = spokenWord(currentWord);
                if (!spoken) return;
                Speech.stop();            // no stacked utterances on repeat taps
                Speech.speak(spoken, { rate: 0.75, pitch: 1.0, language: SPEECH_LOCALE_EN });
              }}
              disabled={currentExercise === 'E' && instructionPlaying}
              activeOpacity={0.7}
            >
              <Text style={styles.wordDisplay}>{currentWord.word.toUpperCase()}</Text>
              <Ionicons name="volume-high-outline" size={22} color="#888888" />
            </TouchableOpacity>
            <View style={styles.divider} />
            {saveError && <Text accessibilityRole="alert" style={{ color:'#B91C1C', fontWeight:'700', fontFamily: 'Nunito_700Bold', textAlign:'center' }}>{saveError}</Text>}
            {renderExercise()}
          </Animated.View>
        </View>

        {wordResult && (
          <View style={[styles.resultScreen, { backgroundColor: theme.backgroundGradient?.[0] ?? '#F7FAFC' }]}>
            <TouchableOpacity
              style={styles.resultBack}
              onPress={requestBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={theme.headingText} />
            </TouchableOpacity>
            <WordPracticeResultCard
              word={wordResult.word}
              statuses={wordResult.statuses}
              theme={theme}
              onContinue={continueFromWordResult}
            />
          </View>
        )}

      </SafeAreaView>

      {/* ════════════════════════════════════════════════════════════════════
          Group celebration modal  (short / medium / long words done)
         ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════
          Letter-done modal  — full word-by-word results summary
         ════════════════════════════════════════════════════════════════════ */}

      <BreakPromptModal navigation={navigation} student={student} theme={theme} />

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

// ─── Word result row (inside letter-done modal) ───────────────────────────────

// ─── Stat pill ────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },
  resultScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultBack: { position: 'absolute', top: 18, left: 20, padding: 8 },

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
  letterBadgeText: { fontSize: 16, fontWeight: '900', fontFamily: 'Nunito_900Black' },
  counterText:     { fontSize: 15, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  scoreBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 50 },
  scoreText:  { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 4,
  },
  dotItem:  { alignItems: 'center', gap: 3 },
  dot:      { width: 12, height: 12, borderRadius: 6 },
  dotActive:{ width: 22, borderRadius: 11 },
  dotLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },

  exLabel: {
    fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold', textAlign: 'center',
    letterSpacing: 0.5, opacity: 0.7,
  },
  exLabelRow: {
    minHeight: 34,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionSpeaker: { position: 'absolute', right: 28 },

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
  celebTitle: { fontSize: 22, fontWeight: '900', fontFamily: 'Nunito_900Black', textAlign: 'center' },
  celebMsg:   { fontSize: 14, color: '#555555', textAlign: 'center', lineHeight: 21 },
  celebScore: { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#7B1FA2', marginTop: 2 },
  celebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 50, paddingHorizontal: 36, paddingVertical: 14,
    width: '100%', marginTop: 4,
  },
  celebBtnText: { fontSize: 17, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },

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
  ldTitle:  { fontSize: 20, fontWeight: '900', fontFamily: 'Nunito_900Black', color: '#1A1A1A' },
  ldScore:  { fontSize: 13, color: '#666666', marginTop: 2, fontWeight: '500', fontFamily: 'Nunito_600SemiBold' },
  ldPills:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ldDivider:{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  ldScroll: { maxHeight: SCREEN_H * 0.38 },
});
