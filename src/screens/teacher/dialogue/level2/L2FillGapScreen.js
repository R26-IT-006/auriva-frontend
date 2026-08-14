/**
 * L2FillGapScreen  (TASK-18 — Step 3 of Sentence Familiarisation Ladder)
 * The sentence is shown with exactly one blank where the personalised value belongs.
 * Three options are offered: the CORRECT answer always comes from the DB questionnaire
 * value (sentence.dynamic_value), NOT hardcoded here. Two distractors: one from the
 * backend (sentence.distractor) and one from a frontend constant pool, both filtered
 * to never accidentally match the correct answer.
 *
 * Params: { student, sessionData, sentenceIndex }
 * Output: navigate('L2SentenceMatch', { student, sessionData, sentenceIndex })
 */
import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Layout } from '../../../../constants/layout';
import { getAvatarTheme } from '../../../../constants/avatarThemes';

// Sentence emojis matching L2SentencePathScreen STOPS
const SENTENCE_EMOJIS = { 1: '👤', 2: '🎂', 3: '🏠', 4: '⭐', 5: '🎨' };

/**
 * Second distractor pool — one entry per sentence index (1-indexed).
 * These are static distractors that make contextual sense as WRONG options
 * alongside the DB distractor.  Filtered at render time if they accidentally
 * match dynamic_value (shouldn't happen for the designed closed sets, but
 * we guard defensively).
 * - S1 (name)     : another common SL name, different from the DB distractor
 * - S2 (age)      : '3'  — always far from school-age children
 * - S3 (hometown) : 'Colombo' — most-recognised Sri Lankan city, likely differs from distractor
 * - S4 (gender)   : 'teacher' — clearly wrong in "I am a ___", aids discrimination
 * - S5 (activity) : 'Sleeping' — not in the ALL_ACTIVITIES enum, always safe
 */
const POOL_DISTRACTORS = ['Saman', '3', 'Colombo', 'teacher', 'Sleeping'];

/**
 * Build the blank sentence by replacing the first occurrence of dynamic_value
 * in the sentence text with three underscores.
 * Falls back to appending "___" if the value isn't found (shouldn't happen in
 * normal questionnaire data).
 */
function buildBlankSentence(text, dynamicValue) {
  const dv = String(dynamicValue ?? '');
  const idx = text.indexOf(dv);
  if (idx === -1) return text + ' ___';
  return text.slice(0, idx) + '___' + text.slice(idx + dv.length);
}

/** Fisher-Yates shuffle (pure). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build the three option strings; returns in shuffled order. */
function buildOptions(sentence, sentenceIndex) {
  const correct = String(sentence.dynamic_value ?? '');
  const dist1   = String(sentence.distractor  ?? '');

  // Pick pool distractor, fall back to a safe string if it clashes
  let pool = POOL_DISTRACTORS[(sentenceIndex - 1) % POOL_DISTRACTORS.length];
  if (pool === correct || pool === dist1) {
    // Fallback: use the distractor from the next sentence if available, otherwise use 'Other'
    pool = sentenceIndex === 2 ? '15' : 'Matara';
    if (pool === correct || pool === dist1) pool = 'Other';
  }

  return shuffle([correct, dist1, pool]);
}

export default function L2FillGapScreen({ route, navigation }) {
  const { student, sessionData, sentenceIndex = 1 } = route.params ?? {};
  const theme = getAvatarTheme(student?.avatar_key);

  const sentence    = (sessionData?.sentences ?? []).find((s) => s.index === sentenceIndex);
  const correct     = String(sentence?.dynamic_value ?? '');
  const blankText   = buildBlankSentence(sentence?.text ?? '___', correct);
  const options     = useRef(buildOptions(sentence ?? {}, sentenceIndex)).current;
  const emoji       = SENTENCE_EMOJIS[sentenceIndex] ?? '📖';

  const [selected,  setSelected]  = useState(null);   // null | 'correct' | 'wrong'
  const [chosenOpt, setChosenOpt] = useState(null);   // which option string was tapped
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []));

  function handleOption(opt) {
    if (selected === 'correct') return; // already done
    setChosenOpt(opt);
    if (opt === correct) {
      setSelected('correct');
      // Short pause, then advance
      setTimeout(() => {
        navigation.navigate('L2SentenceMatch', { student, sessionData, sentenceIndex });
      }, 900);
    } else {
      setSelected('wrong');
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
      ]).start(() => {
        setSelected(null);
        setChosenOpt(null);
      });
    }
  }

  // Split blankText on '___' for styled rendering
  const parts = blankText.split('___');

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <View style={styles.stepBadge}>
            <Text style={[styles.stepLabel, { color: theme.button }]}>FILL IN THE BLANK</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardOutline }]}>
            <View style={[styles.progressFill, { width: '75%', backgroundColor: theme.button }]} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Emoji */}
          <Text style={styles.emojiLarge}>{emoji}</Text>

          {/* Sentence with blank */}
          <View style={[styles.sentenceCard, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
            <Text style={[styles.sentenceText, { color: theme.headingText }]}>
              {parts[0]}
              <Text style={[styles.blank, { color: theme.button }]}>{'    ___    '}</Text>
              {parts[1] ?? ''}
            </Text>
          </View>

          {/* Instruction */}
          <Text style={[styles.instruction, { color: theme.headingText }]}>
            Tap the correct word to fill the blank!
          </Text>

          {/* Options */}
          <Animated.View
            style={[
              styles.optionsRow,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {options.map((opt) => {
              const isSelected = chosenOpt === opt;
              const isCorrect  = selected === 'correct' && isSelected;
              const isWrong    = selected === 'wrong'   && isSelected;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    { borderColor: theme.cardOutline, backgroundColor: theme.cardSurface },
                    isCorrect && styles.optionCorrect,
                    isWrong   && styles.optionWrong,
                  ]}
                  onPress={() => handleOption(opt)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Option: ${opt}`}
                >
                  {isCorrect && (
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={{ marginRight: 6 }} />
                  )}
                  {isWrong && (
                    <Ionicons name="close-circle" size={22} color="#EF4444" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[
                    styles.optionText,
                    { color: theme.headingText },
                    isCorrect && { color: '#22C55E', fontWeight: '800' },
                    isWrong   && { color: '#EF4444' },
                  ]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
    alignItems: 'center',
    gap: Layout.spacing.xs,
  },
  stepBadge: { alignItems: 'center' },
  stepLabel: { fontSize: Layout.fontSize.xs, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  progressTrack: { height: 6, width: '80%', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Layout.spacing.xl, gap: Layout.spacing.lg,
  },

  emojiLarge: { fontSize: 52 },

  sentenceCard: {
    borderRadius: Layout.radius.lg ?? 16,
    borderWidth: 2,
    padding: Layout.spacing.lg,
    width: '100%',
    alignItems: 'center',
    ...Layout.shadow?.sm,
  },
  sentenceText: {
    fontSize: Layout.fontSize.lg ?? 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  blank: { fontWeight: '900', letterSpacing: 3 },

  instruction: { fontSize: Layout.fontSize.sm, fontWeight: '600', opacity: 0.7, textAlign: 'center' },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, width: '100%' },
  option: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 2,
    paddingVertical: 14, paddingHorizontal: 20,
    minWidth: 110, justifyContent: 'center',
    ...Layout.shadow?.sm,
  },
  optionCorrect: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  optionWrong:   { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  optionText: { fontSize: Layout.fontSize.lg ?? 18, fontWeight: '700' },
});
