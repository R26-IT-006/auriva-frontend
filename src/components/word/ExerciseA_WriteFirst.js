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

  const [wrongCount, setWrongCount]   = useState(0);
  const [selected,   setSelected]     = useState(null);
  const [done,       setDone]         = useState(false);

  const flashAnims = useRef(choices.map(() => new Animated.Value(1))).current;

  function flashButton(idx, success) {
    Animated.sequence([
      Animated.timing(flashAnims[idx], { toValue: success ? 0.3 : 0.15, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnims[idx], { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function handlePress(letter, idx) {
    if (done) return;
    setSelected(letter);

    if (letter === correct) {
      setDone(true);
      flashButton(idx, true);
      setTimeout(() => onComplete(wrongCount === 0), 500);
    } else {
      flashButton(idx, false);
      setWrongCount(w => w + 1);
    }
  }

  const wordDisplay = '_' + word.slice(1);
  const showHint = wrongCount >= 2;

  return (
    <View style={styles.wrap}>
      <Text style={styles.instruction}>Tap the missing first letter</Text>

      <View style={styles.wordRow}>
        <WordImageDisplay imageKey={imageKey} emoji={emoji} size={90} />
        <View style={styles.wordBox}>
          <Text style={styles.blank}>_</Text>
          <Text style={styles.rest}>{word.slice(1)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {choices.map((letter, idx) => {
          const isCorrect = letter === correct;
          const isHinted  = showHint && isCorrect;
          const bg = done && isCorrect
            ? '#4CAF50'
            : isHinted
            ? '#FFF176'
            : '#F5F5F5';

          return (
            <Animated.View key={letter} style={{ opacity: flashAnims[idx] }}>
              <TouchableOpacity
                style={[styles.tile, { backgroundColor: bg, borderColor: isHinted ? '#F9A825' : '#E0E0E0' }]}
                onPress={() => handlePress(letter, idx)}
                activeOpacity={0.7}
                disabled={done}
              >
                <Text style={[styles.tileText, isHinted && styles.hintText]}>
                  {letter.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 20,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444444',
    textAlign: 'center',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  wordBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  blank: {
    fontSize: 52,
    fontWeight: '900',
    color: '#E53935',
    lineHeight: 60,
  },
  rest: {
    fontSize: 52,
    fontWeight: '900',
    color: '#333333',
    lineHeight: 60,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 340,
  },
  tile: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333333',
  },
  hintText: {
    color: '#E65100',
  },
});
