import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../../constants/childInstructions';
import { SUPPORT_IMAGE, BODY, supportImageFrameStyle } from './wordActivityLayout';
import { isHintUnlocked, unlocksHint, HINT_REVEAL_DELAY_MS, HINT_COLORS }
  from './wordHintPolicy';

// Shared with every other screen that asks for this action, so the child
// hears one sentence for one task — and one future recording covers it.
const ACTIVITY_INSTRUCTION = CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.CHOOSE_MISSING_LETTER];

function makeChoices(correct) {
  const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => c !== correct);
  const extras = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  return [correct, ...extras].sort(() => Math.random() - 0.5);
}

// Finds the string index of the middle alphabetic character.
function getBlankInfo(word) {
  const alphaPositions = [...word]
    .map((ch, i) => (/[a-z]/i.test(ch) ? i : -1))
    .filter(i => i !== -1);
  const mid = alphaPositions[Math.floor((alphaPositions.length - 1) / 2)];
  return { blankAt: mid, correct: word[mid].toLowerCase() };
}

export default function ExerciseC_FillBlank({ wordEntry, theme, onComplete, onWrongAnswer }) {
  const { word, emoji, imageKey } = wordEntry;
  const { blankAt: bi, correct }  = useMemo(() => getBlankInfo(word), [word]);

  const choices = useMemo(() => makeChoices(correct), [word]);

  const [wrongCount, setWrongCount] = useState(0);
  const [done,       setDone]       = useState(false);

  // The hint waits for the second wrong answer's feedback to finish, so the
  // child sees the verdict on their own answer before the support appears.
  const [hintReady, setHintReady] = useState(false);
  const hintTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(hintTimerRef.current), []);

  const flashAnims = useRef(choices.map(() => new Animated.Value(1))).current;

  function flash(idx, success) {
    Animated.sequence([
      Animated.timing(flashAnims[idx], { toValue: success ? 0.3 : 0.15, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnims[idx], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function handlePress(letter, idx) {
    if (done) return;
    if (letter === correct) {
      setDone(true);
      flash(idx, true);
      setTimeout(() => onComplete(wrongCount === 0), 500);
    } else {
      flash(idx, false);
      onWrongAnswer?.();                    // verdict on THIS answer: wrong.gif
      setWrongCount((w) => {
        const next = w + 1;                 // answers only
        if (unlocksHint(next)) {
          hintTimerRef.current = setTimeout(() => setHintReady(true), HINT_REVEAL_DELAY_MS);
        }
        return next;
      });
    }
  }

  const showHint = isHintUnlocked(wrongCount) && hintReady;
  const before   = word.slice(0, bi).toUpperCase();
  const after    = word.slice(bi + 1).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.imagePane}>
        <View style={[styles.imageFrame, supportImageFrameStyle(theme)]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={SUPPORT_IMAGE.imageSize} />
        </View>
      </View>

      <View style={styles.taskPane}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          {ACTIVITY_INSTRUCTION.en}
        </Text>
        <Text style={[styles.instructionSi, { color: theme.headingText }]}>
          {ACTIVITY_INSTRUCTION.si}
        </Text>

        <View style={styles.wordBox}>
          {before.length > 0 && <Text style={styles.letterText}>{before}</Text>}
          <Text style={styles.blankText}>_</Text>
          {after.length > 0  && <Text style={styles.letterText}>{after}</Text>}
        </View>

        <View style={styles.grid}>
          {choices.map((letter, idx) => {
            const isCorrect = letter === correct;
            const isHinted  = showHint && isCorrect;
            const bg = done && isCorrect ? '#4CAF50'
                     : isHinted          ? HINT_COLORS.surface
                     :                    '#F5F5F5';

            return (
              <Animated.View key={letter} style={{ opacity: flashAnims[idx] }}>
                <TouchableOpacity
                  style={[styles.tile, {
                    backgroundColor: bg,
                    borderColor: isHinted         ? HINT_COLORS.border
                               : done && isCorrect ? '#388E3C'
                               :                    '#E0E0E0',
                  }]}
                  onPress={() => handlePress(letter, idx)}
                  activeOpacity={0.7}
                  disabled={done}
                  accessibilityRole="button"
                  accessibilityLabel={letter.toUpperCase()}
                  accessibilityHint={isHinted ? 'Hint: this is the answer' : undefined}
                  accessibilityState={{ disabled: done }}
                >
                  <Text style={[
                    styles.tileText,
                    isHinted          && styles.hintText,
                    done && isCorrect && styles.correctText,
                  ]}>
                    {letter.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BODY.columnGap,
    width: '100%',
  },
  imagePane: {
    width: SUPPORT_IMAGE.paneWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Size, radius, border and tint all come from the shared spec — see
  // supportImageFrameStyle. Left here only so the style object exists.
  imageFrame: {},
  taskPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  instruction: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  instructionSi: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.75,
    textAlign: 'center',
  },
  wordBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    minHeight: 78,
  },
  letterText: {
    fontSize: 56,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    color: '#333333',
    lineHeight: 64,
  },
  blankText: {
    fontSize: 56,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    color: '#E53935',
    lineHeight: 64,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 320,
  },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  tileText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333333',
  },
  hintText:    { color: HINT_COLORS.text },
  correctText: { color: '#FFFFFF' },
});
