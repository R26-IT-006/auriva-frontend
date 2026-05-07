import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';

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
      Animated.timing(scaleAnims[idx], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }

  function shake(idx) {
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnims[idx], { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }

  const [selectedIdx, setSelectedIdx] = useState(null);
  const showHint = wrongCount >= 2;

  function handlePress(opt, idx) {
    if (done) return;
    setSelectedIdx(idx);

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
      <Text style={styles.instruction}>Find the picture for this word</Text>

      <View style={styles.wordChip}>
        <Text style={styles.wordText}>{word.toUpperCase()}</Text>
      </View>

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
                <WordImageDisplay imageKey={opt.imageKey} emoji={opt.emoji} size={100} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {showHint && !done && (
        <Text style={styles.hintLabel}>Tap the glowing picture!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 18,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
  },
  wordChip: {
    backgroundColor: '#E3F2FD',
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  wordText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D47A1',
    letterSpacing: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 280,
  },
  cell: {
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#E0E0E0',
    padding: 6,
    backgroundColor: '#FAFAFA',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
});
