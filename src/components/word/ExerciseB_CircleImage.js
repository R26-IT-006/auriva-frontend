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
          Find the picture for this word
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

        {showHint && !done && (
          <Text style={styles.hintLabel}>Tap the glowing picture!</Text>
        )}
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
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
