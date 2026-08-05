import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import Svg, { Line, Circle, Polyline, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import WordImageDisplay from './WordImageDisplay';
import { buildWordGuide, wordGuideToSvgPath, wordGuideGhostDots } from '../../constants/wordPaths';

// Image column shrunk / canvas widened vs. the original 230/430 split — a
// whole word needs more horizontal room than the small illustration does.
const CANVAS_W = 490;
const CANVAS_H = 220;
const LINE_1 = 22;
const LINE_2 = 82;
// Baseline/descender match the LETTER_PATHS fy=0.64/0.92 convention so the
// reference-path guide sits exactly on these ruling lines (see WordWritingScreen).
const LINE_3 = Math.round(CANVAS_H * 0.64);
const LINE_4 = Math.round(CANVAS_H * 0.92);

export default function ExerciseE_WriteWord({ wordEntry, theme, onComplete }) {
  const { word, emoji, imageKey } = wordEntry;
  const [currentPath, setCurrentPath] = useState([]);
  const [allPaths, setAllPaths] = useState([]);
  const [done, setDone] = useState(false);
  const startTimeRef = useRef(null);

  const hasDrawn = allPaths.length > 0;

  const wordGuide  = useMemo(() => buildWordGuide(word), [word]);
  const guidePathD = useMemo(
    () => wordGuideToSvgPath(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );
  const guideDots = useMemo(
    () => wordGuideGhostDots(wordGuide.strokeDescriptors, CANVAS_W, CANVAS_H),
    [wordGuide]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !done,
      onMoveShouldSetPanResponder: () => !done,
      onPanResponderGrant: (evt) => {
        startTimeRef.current = Date.now();
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY, t: 0 }]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => [
          ...prev,
          { x: locationX, y: locationY, t: Date.now() - startTimeRef.current },
        ]);
      },
      onPanResponderRelease: () => {
        setCurrentPath(prev => {
          if (prev.length > 2) {
            setAllPaths(paths => [...paths, prev]);
          }
          return [];
        });
      },
    })
  ).current;

  function handleClear() {
    if (done) return;
    setCurrentPath([]);
    setAllPaths([]);
  }

  function handleDone() {
    if (!hasDrawn || done) return;
    setDone(true);
    setTimeout(() => onComplete(true), 500);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.leftCol}>
        <View style={[styles.imageBg, { backgroundColor: theme.button + '10', borderColor: theme.button + '26' }]}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={130} />
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.instruction, { color: theme.headingText }]}>
          Write the word
        </Text>

        <View
          style={[styles.canvasCard, { borderColor: theme.button + '32' }]}
          {...panResponder.panHandlers}
        >
          <Svg width={CANVAS_W} height={CANVAS_H}>
            <Line x1="0" y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#9BC4E8" strokeWidth="1.5" />
            <Line x1="0" y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#9BC4E8" strokeWidth="1.5" />
            <Line
              x1="0"
              y1={LINE_3}
              x2={CANVAS_W}
              y2={LINE_3}
              stroke="#D88989"
              strokeWidth="1.5"
              strokeDasharray="8,7"
            />
            <Line x1="0" y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#9BC4E8" strokeWidth="1.5" />

            {/* Reference-path guide — same LETTER_PATHS-based system as
                letter tracing, instead of a flat ghost-text outline. */}
            {guidePathD && (
              <>
                <Path
                  d={guidePathD}
                  stroke={`${theme.button}24`}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {guideDots.map((dot, idx) => (
                  <Circle
                    key={`ghost-dot-${idx}`}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={3.5}
                    fill={`${theme.button}24`}
                  />
                ))}
              </>
            )}

            {allPaths.map((stroke, i) => (
              <Polyline
                key={i}
                points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                stroke={theme.button}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}

            {currentPath.length > 1 && (
              <Polyline
                points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                stroke={theme.button}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.75}
              />
            )}
          </Svg>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={handleClear}
            activeOpacity={0.72}
            disabled={done}
          >
            <Ionicons name="refresh" size={16} color={theme.headingText} />
            <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.doneBtn,
              { backgroundColor: hasDrawn ? theme.button : '#D6DAE3' },
            ]}
            onPress={handleDone}
            activeOpacity={0.82}
            disabled={!hasDrawn || done}
          >
            <Text style={[styles.doneText, { color: hasDrawn ? theme.buttonText : '#7B8190' }]}>
              Done
            </Text>
            {done && <Ionicons name="checkmark-circle" size={18} color={theme.buttonText} />}
          </TouchableOpacity>
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
    gap: 30,
    width: '100%',
  },
  leftCol: {
    width: 170,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageBg: {
    width: 150,
    height: 150,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  instruction: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  canvasCard: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
