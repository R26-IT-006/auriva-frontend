import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';

function makeChoices(correct) {
  const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => c !== correct);
  const extras = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  return [correct, ...extras].sort(() => Math.random() - 0.5);
}

export default function ExerciseA_WriteFirst({ wordEntry, theme, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;
  const correct = word[0];

  const choices = useMemo(() => makeChoices(correct), [word]);

  const [wrongCount, setWrongCount] = useState(0);
  const [done,       setDone]       = useState(false);

  const flashAnims = useRef(choices.map(() => new Animated.Value(1))).current;

  function flashButton(idx, success) {
    Animated.sequence([
      Animated.timing(flashAnims[idx], { toValue: success ? 0.3 : 0.15, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnims[idx], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function handlePress(letter, idx) {
    if (done) return;
    if (letter === correct) {
      setDone(true);
      flashButton(idx, true);
      setTimeout(() => onComplete(wrongCount === 0), 500);
    } else {
      flashButton(idx, false);
      setWrongCount(w => w + 1);
    }
  }

  const showHint = wrongCount >= 2;
  const rest = word.slice(1).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.imagePane}>
        <View style={[styles.imageFrame, { backgroundColor: theme.button + '10', borderColor: theme.button + '26' }]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={170} />
        </View>
      </View>

      <View style={styles.taskPane}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Tap the missing first letter
        </Text>

        <View style={styles.wordBox}>
          <Text style={styles.blank}>_</Text>
          <Text style={styles.rest}>{rest}</Text>
        </View>

        <View style={styles.grid}>
          {choices.map((letter, idx) => {
            const isCorrect = letter === correct;
            const isHinted  = showHint && isCorrect;
            const bg = done && isCorrect ? '#4CAF50'
                     : isHinted          ? '#FFF176'
                     :                    '#F5F5F5';

            return (
              <Animated.View key={letter} style={{ opacity: flashAnims[idx] }}>
                <TouchableOpacity
                  style={[styles.tile, {
                    backgroundColor: bg,
                    borderColor: isHinted         ? '#F9A825'
                               : done && isCorrect ? '#388E3C'
                               :                    '#E0E0E0',
                  }]}
                  onPress={() => handlePress(letter, idx)}
                  activeOpacity={0.7}
                  disabled={done}
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
    gap: 34,
    width: '100%',
  },
  imagePane: {
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageFrame: {
    width: 212,
    height: 212,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  instruction: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  wordBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 78,
  },
  blank: {
    fontSize: 56,
    fontWeight: '900',
    color: '#E53935',
    lineHeight: 64,
  },
  rest: {
    fontSize: 56,
    fontWeight: '900',
    color: '#333333',
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
  hintText:    { color: '#E65100' },
  correctText: { color: '#FFFFFF' },
});
