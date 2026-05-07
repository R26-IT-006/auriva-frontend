import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import WordImageDisplay from './WordImageDisplay';

// Strip non-alpha chars (hyphens, spaces) so tiles are letters only.
function getLetters(word) {
  return word.replace(/[^a-z]/gi, '').toLowerCase().split('');
}

function buildTiles(word) {
  const wordLetters = getLetters(word);
  const extras = 'abcdefghijklmnopqrstuvwxyz'
    .split('')
    .filter(c => !wordLetters.includes(c))
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  return [...wordLetters, ...extras]
    .map((letter, i) => ({ id: i, letter }))
    .sort(() => Math.random() - 0.5);
}

export default function ExerciseD_SpellWord({ wordEntry, theme, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;
  const letters = useMemo(() => getLetters(word), [word]);

  const tiles = useMemo(() => buildTiles(word), [word]);

  const [filled,    setFilled]    = useState([]);
  const [tileUsed,  setTileUsed]  = useState(() => new Array(tiles.length).fill(false));
  const [errorId,   setErrorId]   = useState(null);
  const [done,      setDone]      = useState(false);

  const errorAnims = useRef(tiles.map(() => new Animated.Value(0))).current;

  function shakeError(tileIdx) {
    const anim = errorAnims[tileIdx];
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleTile(tileIdx) {
    if (done || tileUsed[tileIdx]) return;
    const tile = tiles[tileIdx];
    const pos  = filled.length;

    if (tile.letter === letters[pos]) {
      const newFilled   = [...filled, tile.letter];
      const newTileUsed = tileUsed.map((u, i) => (i === tileIdx ? true : u));
      setFilled(newFilled);
      setTileUsed(newTileUsed);

      if (newFilled.length === letters.length) {
        setDone(true);
        setTimeout(() => onComplete(true), 600);
      }
    } else {
      shakeError(tileIdx);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.instruction}>Spell the word!</Text>

      <WordImageDisplay imageKey={imageKey} emoji={emoji} size={110} />

      {/* Letter boxes — one per alphabetic letter (hyphens/spaces stripped) */}
      <View style={styles.boxRow}>
        {letters.map((ch, i) => {
          const isFilled = i < filled.length;
          return (
            <View
              key={i}
              style={[styles.box, isFilled && styles.boxFilled, done && styles.boxDone]}
            >
              <Text style={[styles.boxText, done && styles.boxTextDone]}>
                {isFilled ? filled[i].toUpperCase() : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Letter tiles */}
      <View style={styles.tileRow}>
        {tiles.map((tile, idx) => {
          if (tileUsed[idx]) return <View key={tile.id} style={styles.tileGhost} />;

          return (
            <Animated.View
              key={tile.id}
              style={{
                transform: [{
                  translateX: errorAnims[idx].interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-8, 0, 8],
                  }),
                }],
              }}
            >
              <TouchableOpacity
                style={styles.tile}
                onPress={() => handleTile(idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.tileText}>{tile.letter.toUpperCase()}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {done && (
        <Text style={styles.successLabel}>Well done! 🎉</Text>
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
  boxRow: {
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    width: 52,
    height: 56,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#BDBDBD',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: '#42A5F5',
    backgroundColor: '#E3F2FD',
  },
  boxDone: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  boxText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1565C0',
  },
  boxTextDone: {
    color: '#2E7D32',
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 360,
  },
  tile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#EDE7F6',
    borderWidth: 2,
    borderColor: '#9575CD',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tileGhost: {
    width: 58,
    height: 58,
  },
  tileText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4527A0',
  },
  successLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2E7D32',
  },
});
