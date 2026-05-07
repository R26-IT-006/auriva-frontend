import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';

function makeChoices(correct) {
  const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => c !== correct);
  const extras = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  return [correct, ...extras].sort(() => Math.random() - 0.5);
}

// Finds the string index of the middle alphabetic character.
// Skips hyphens, spaces, etc. so the blank always lands on a real letter.
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

  // Build display: preserve original chars (hyphens, spaces) around the blank
  const before = word.slice(0, bi);
  const after  = word.slice(bi + 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.instruction}>Fill in the missing letter</Text>

      <View style={styles.wordRow}>
        <WordImageDisplay imageKey={imageKey} emoji={emoji} size={90} />
        <View style={styles.wordBox}>
          {before.length > 0 && <Text style={styles.letterText}>{before}</Text>}
          <Text style={styles.blankText}>_</Text>
          {after.length > 0 && <Text style={styles.letterText}>{after}</Text>}
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
                style={[styles.tile, {
                  backgroundColor: bg,
                  borderColor: isHinted ? '#F9A825' : '#E0E0E0',
                }]}
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
    gap: 2,
  },
  letterText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#333333',
    lineHeight: 60,
  },
  blankText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#E53935',
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
