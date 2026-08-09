import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';

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

export default function ExerciseC_FillBlank({ wordEntry, theme, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;
  const { blankAt: bi, correct }  = useMemo(() => getBlankInfo(word), [word]);

  const choices = useMemo(() => makeChoices(correct), [word]);

  const [wrongCount, setWrongCount] = useState(0);
  const [done,       setDone]       = useState(false);

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
      setWrongCount(w => w + 1);
    }
  }

  const showHint = wrongCount >= 2;
  const before   = word.slice(0, bi).toUpperCase();
  const after    = word.slice(bi + 1).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.imagePane}>
        <View style={[styles.imageFrame, { backgroundColor: theme.button + '10', borderColor: theme.button + '26' }]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={170} />
        </View>
      </View>

      <View style={styles.taskPane}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Fill in the missing letter
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
    gap: 2,
    minHeight: 78,
  },
  letterText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#333333',
    lineHeight: 64,
  },
  blankText: {
    fontSize: 56,
    fontWeight: '900',
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
  hintText:    { color: '#E65100' },
  correctText: { color: '#FFFFFF' },
});
