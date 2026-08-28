import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WordImageDisplay from './WordImageDisplay';

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

/**
 * `demoMode` turns this exact component into the "watch first" demonstration
 * for the spelling activity — the SAME instruction, image, letter boxes,
 * tiles, sizes, spacing and fill animation the child is about to use, with
 * the taps performed by an animated hand instead of by the child.
 *
 * In demo mode the tiles are not tappable, and completing the word calls
 * `onDemoPassComplete` instead of `onComplete` — so the real activity's
 * scoring/advance path is never reached. Nothing else about this component
 * changes between the two modes, which is the point: the demonstration
 * cannot drift away from the activity because it IS the activity.
 */
export default function ExerciseD_SpellWord({
  wordEntry, theme, onComplete,
  demoMode = false, demoPlayToken = 0, onDemoPassComplete,
}) {
  const { word, emoji, imageKey } = wordEntry;
  const letters = useMemo(() => getLetters(word), [word]);
  const tiles   = useMemo(() => buildTiles(word), [word]);

  const [filled,   setFilled]   = useState([]);
  const [tileUsed, setTileUsed] = useState(() => new Array(tiles.length).fill(false));
  const [done,     setDone]     = useState(false);

  const errorAnims  = useRef(tiles.map(() => new Animated.Value(0))).current;
  const fillAnims   = useRef(letters.map(() => new Animated.Value(0))).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop   = useRef(null);

  // Pulse the next empty box
  useEffect(() => {
    pulseAnim.setValue(1);
    if (done) {
      pulseLoop.current?.stop();
      return;
    }
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 480, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 480, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, [filled.length, done]);

  function shakeError(tileIdx) {
    const anim = errorAnims[tileIdx];
    Animated.sequence([
      Animated.timing(anim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  function animateFill(pos) {
    fillAnims[pos].setValue(0);
    Animated.spring(fillAnims[pos], {
      toValue: 1,
      useNativeDriver: true,
      tension: 160,
      friction: 7,
    }).start();
  }

  function handleTile(tileIdx) {
    if (done || tileUsed[tileIdx]) return;
    const tile = tiles[tileIdx];
    const pos  = filled.length;

    if (tile.letter === letters[pos]) {
      animateFill(pos);
      const newFilled   = [...filled, tile.letter];
      const newTileUsed = tileUsed.map((u, i) => (i === tileIdx ? true : u));
      setFilled(newFilled);
      setTileUsed(newTileUsed);

      if (newFilled.length === letters.length) {
        setDone(true);
        Animated.spring(successAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
        // Demo mode never calls the activity's own completion path.
        setTimeout(() => {
          if (demoMode) onDemoPassComplete?.();
          else onComplete(true);
        }, 800);
      }
    } else {
      shakeError(tileIdx);
    }
  }

  // ── Demonstration driver ────────────────────────────────────────────────
  // Adapted from the concept tiers' own interaction demo (ConceptDemoScreen /
  // Tier2DemoScreen): a hand fades in, travels to the target, press-scales
  // while a ripple expands, and the target settles. Here the "target" is a
  // real tile of this real activity, and the tap it performs is this
  // component's own handleTile — so the boxes fill with the same spring
  // animation the child will see.
  const handOpacity   = useRef(new Animated.Value(0)).current;
  const handX         = useRef(new Animated.Value(0)).current;
  const handY         = useRef(new Animated.Value(0)).current;
  const handScale     = useRef(new Animated.Value(1)).current;
  const rippleScale   = useRef(new Animated.Value(0.3)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const tileLayouts   = useRef([]);
  const demoTimers    = useRef([]);

  useEffect(() => {
    if (!demoMode) return undefined;

    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    setFilled([]);
    setTileUsed(new Array(tiles.length).fill(false));
    setDone(false);
    handOpacity.setValue(0);
    handScale.setValue(1);
    rippleOpacity.setValue(0);
    rippleScale.setValue(0.3);

    const at = (ms, fn) => { demoTimers.current.push(setTimeout(fn, ms)); };
    const TRAVEL = 620, PRESS = 150, SETTLE = 420;

    at(200, () => {
      Animated.timing(handOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    // One step per letter, in spelling order — the demonstration's whole
    // point is the ORDER, so it always taps the correct next tile.
    const used = new Array(tiles.length).fill(false);
    letters.forEach((ch, i) => {
      const tileIdx = tiles.findIndex((t, k) => !used[k] && t.letter === ch);
      if (tileIdx < 0) return;
      used[tileIdx] = true;

      const base = 500 + i * (TRAVEL + PRESS + SETTLE);

      at(base, () => {
        const layout = tileLayouts.current[tileIdx];
        if (!layout) return;
        Animated.parallel([
          Animated.timing(handX, {
            toValue: layout.x + layout.width / 2 - 20, duration: TRAVEL,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(handY, {
            toValue: layout.y + layout.height - 6, duration: TRAVEL,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]).start();
      });

      at(base + TRAVEL, () => {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(handScale, { toValue: 0.72, duration: PRESS, useNativeDriver: true }),
            Animated.timing(handScale, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.parallel([
              Animated.timing(rippleOpacity, { toValue: 0.45, duration: 120, useNativeDriver: true }),
              Animated.timing(rippleScale, { toValue: 1.3, duration: 380, useNativeDriver: true }),
            ]),
            Animated.timing(rippleOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]),
        ]).start(() => { rippleScale.setValue(0.3); });
        // The activity's own tap handler — same fill, same ghosting.
        handleTile(tileIdx);
      });
    });

    return () => {
      demoTimers.current.forEach(clearTimeout);
      demoTimers.current = [];
    };
    // demoPlayToken changes on every Replay press — that is what restarts it.
  }, [demoMode, demoPlayToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextPos = filled.length;

  return (
    <View style={styles.wrap}>

      {/* Left: image with soft themed background */}
      <View style={styles.leftCol}>
        <View style={[styles.imageBg, { backgroundColor: theme.button + '10', borderColor: theme.button + '26' }]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={170} />
        </View>
      </View>

      {/* Right: instruction + boxes + tiles */}
      <View style={styles.rightCol}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Spell the word!
        </Text>

        {/* Letter boxes */}
        <View style={styles.boxRow}>
          {letters.map((ch, i) => {
            const isFilled = i < filled.length;
            const isNext   = i === nextPos && !done;

            const letterScale = fillAnims[i].interpolate({
              inputRange:  [0, 0.55, 1],
              outputRange: [0.5, 1.18, 1],
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.box,
                  isFilled && !done && { borderColor: theme.button, backgroundColor: theme.button + '10' },
                  done && styles.boxDone,
                  isNext && { borderColor: theme.button, borderWidth: 2.5 },
                  isNext && { transform: [{ scale: pulseAnim }] },
                ]}
              >
                {isFilled && (
                  <Animated.Text
                    style={[
                      styles.boxText,
                      done ? styles.boxTextDone : { color: theme.button },
                      { transform: [{ scale: letterScale }] },
                    ]}
                  >
                    {filled[i].toUpperCase()}
                  </Animated.Text>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Letter tiles */}
        <View style={[styles.tileRow, demoMode && styles.tileRowDemo]} pointerEvents={demoMode ? 'none' : 'auto'}>
          {tiles.map((tile, idx) => {
            if (tileUsed[idx]) return <View key={tile.id} style={styles.tileGhost} />;

            return (
              <Animated.View
                key={tile.id}
                onLayout={(e) => { tileLayouts.current[idx] = e.nativeEvent.layout; }}
                style={{
                  transform: [{
                    translateX: errorAnims[idx].interpolate({
                      inputRange:  [-1, 0, 1],
                      outputRange: [-8, 0, 8],
                    }),
                  }],
                }}
              >
                <TouchableOpacity
                  style={[styles.tile, {
                    backgroundColor:  theme.button + '20',
                    borderColor:      theme.button + '50',
                    borderBottomColor: theme.button + '80',
                    shadowColor:      theme.button,
                  }]}
                  onPress={() => handleTile(idx)}
                  disabled={demoMode}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.tileText, { color: theme.headingText }]}>
                    {tile.letter.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          {demoMode && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.demoRipple,
                  {
                    backgroundColor: theme.button,
                    opacity: rippleOpacity,
                    transform: [
                      { translateX: handX }, { translateY: handY }, { scale: rippleScale },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.demoHand,
                  {
                    opacity: handOpacity,
                    transform: [
                      { translateX: handX }, { translateY: handY }, { scale: handScale },
                    ],
                  },
                ]}
              >
                <Ionicons name="hand-left" size={46} color={theme.button} />
              </Animated.View>
            </>
          )}
        </View>

        {done && (
          <Animated.View
            style={[
              styles.successRow,
              {
                opacity: successAnim,
                transform: [{ scale: successAnim }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.successLabel}>Well done!</Text>
          </Animated.View>
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
  leftCol: {
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageBg: {
    width: 212,
    height: 212,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  instruction: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  boxRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 58,
    height: 62,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DEDEDE',
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  boxText: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
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
    width: 62,
    height: 62,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  tileGhost: {
    width: 62,
    height: 62,
  },

  // Demo-only overlay. Adds nothing to the practice layout - `tileRowDemo`
  // only makes the row a positioning context for the hand.
  tileRowDemo: { position: 'relative' },
  demoHand:    { position: 'absolute', left: 0, top: 0 },
  demoRipple:  { position: 'absolute', left: -11, top: -42, width: 62, height: 62, borderRadius: 31 },
  tileText: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successLabel: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    color: '#2E7D32',
  },
});
