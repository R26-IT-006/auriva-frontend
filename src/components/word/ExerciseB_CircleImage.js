import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../../constants/childInstructions';

// Shared with every other screen that asks for this action, so the child
// hears one sentence for one task — and one future recording covers it.
const ACTIVITY_INSTRUCTION = CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.CHOOSE_PICTURE];

export default function ExerciseB_CircleImage({ wordEntry, allWords, theme, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;

  const options = useMemo(() => {
    const others = allWords
      .filter(w => w.word !== word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...others, wordEntry].sort(() => Math.random() - 0.5);
  }, [word]);

  const [wrongCount, setWrongCount] = useState(0);
  const [done,       setDone]       = useState(false);

  const scaleAnims = useRef(options.map(() => new Animated.Value(1))).current;

  function bounce(idx) {
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnims[idx], { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
  }

  function shake(idx) {
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 0.88, duration: 80,  useNativeDriver: true }),
      Animated.timing(scaleAnims[idx], { toValue: 1,    duration: 160, useNativeDriver: true }),
    ]).start();
  }

  const showHint = wrongCount >= 2;

  function handlePress(opt, idx) {
    if (done) return;
    if (opt.word === word) {
      setDone(true);
      bounce(idx);
      setTimeout(() => onComplete(wrongCount === 0), 600);
    } else {
      shake(idx);
      setWrongCount(w => w + 1);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.wordPane}>
        <View style={[styles.wordChip, {
          backgroundColor: theme.button + '18',
          borderColor:     theme.button + '40',
        }]}>
          <Text style={[styles.wordText, { color: theme.headingText }]}>
            {word.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.taskPane}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          {ACTIVITY_INSTRUCTION.en}
        </Text>
        <Text style={[styles.instructionSi, { color: theme.headingText }]}>
          {ACTIVITY_INSTRUCTION.si}
        </Text>

        <View style={styles.grid}>
          {options.map((opt, idx) => {
            const isCorrect = opt.word === word;
            const isHinted  = showHint && isCorrect;
            const isDone    = done && isCorrect;

            return (
              <Animated.View
                key={opt.word}
                style={{ transform: [{ scale: scaleAnims[idx] }] }}
              >
                <TouchableOpacity
                  style={[
                    styles.cell,
                    isDone   && styles.cellCorrect,
                    isHinted && styles.cellHint,
                  ]}
                  onPress={() => handlePress(opt, idx)}
                  activeOpacity={0.8}
                  disabled={done}
                >
                  <WordImageDisplay imageKey={opt.imageKey} emoji={opt.emoji} size={118} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* The hint used to add a SECOND instruction here saying the same
            thing as the one above. The visual cue — the glow driven by
            showHint — is unchanged; only the duplicate wording is gone. */}
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
    gap: 34,
    width: '100%',
  },
  wordPane: {
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
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
  wordChip: {
    minWidth: 190,
    borderRadius: 26,
    borderWidth: 2,
    paddingHorizontal: 28,
    paddingVertical: 22,
    alignItems: 'center',
  },
  wordText: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    maxWidth: 320,
  },
  cell: {
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#E0E0E0',
    padding: 8,
    backgroundColor: '#FAFAFA',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cellCorrect: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  cellHint: {
    borderColor: '#FFB300',
    backgroundColor: '#FFF9C4',
  },
  hintLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    color: '#E65100',
  },
});
