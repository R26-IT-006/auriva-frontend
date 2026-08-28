/**
 * WordWritingStage.js
 *
 * The word-writing screen's main area - image, word card, spelling, badge,
 * canvas, tracer - as ONE presentational component shared by two callers:
 *
 *   WordWritingScreen        mode="practice"
 *   HandwritingDemoScreen    mode="demo"
 *
 * Same reasoning as LetterWritingStage: the word demonstration has to be the
 * screen the child is about to use, not a resemblance of it. Word layout is
 * the case where that matters most - letter spacing, the guide boxes and the
 * per-letter positions all come from wordPaths.js's composed guide, and a
 * demo that spaced a word even slightly differently would be showing the
 * child the wrong target.
 *
 * This JSX was MOVED, unchanged, out of WordWritingScreen. Nothing about the
 * practice appearance was redesigned.
 *
 * In demo mode: no panHandlers are attached at all, the canvas is
 * pointerEvents="none", the child's stroke arrays are not read, and the
 * stroke-order markers are off. There is no path from a touch to a recorded
 * point.
 */

'use strict';

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Line, Path, Circle, Polyline, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import WordImageDisplay from '../word/WordImageDisplay';
import { writeWordInstruction } from '../../constants/childInstructions';
import {
  PAD, COL_L, IMG_SIZE, CANVAS_W, CANVAS_H, LINE_1, LINE_2, LINE_3, LINE_4,
} from '../../constants/wordCanvasLayout';

export const WORD_STAGE_MODES = Object.freeze({ PRACTICE: 'practice', DEMO: 'demo' });

/**
 * @param {{
 *   mode?: 'practice'|'demo',
 *   theme: object,
 *   imageKey?: string, emoji?: string, imageScale?: any,
 *   displayWord: string, word: string, spelling?: string,
 *   badge: {bg: string, border: string, text: string},
 *   instruction: {en: string, si: string},
 *   guideOpacity?: number, guidePathD?: string|null, guideDots?: Array,
 *   letterBoxes?: Array,
 *   attempt?: number, showStrokeOrder?: boolean,
 *   activeStrokeDesc?: object|null, activeDirectionHint?: object|null,
 *   allPaths?: Array, currentPath?: Array, hasDrawn?: boolean,
 *   tracerVisible?: boolean, tracerXInterp?: any, tracerYInterp?: any,
 *   onSpeakWord?: () => void,
 *   canvasRef?: any, onCanvasLayout?: () => void, panHandlers?: object,
 * }} props
 */
export default function WordWritingStage({
  mode = WORD_STAGE_MODES.PRACTICE,
  theme,
  imageKey,
  emoji,
  imageScale = null,
  displayWord,
  word,
  spelling = '',
  badge,
  instruction,
  guideOpacity = 0,
  guidePathD = null,
  guideDots = [],
  letterBoxes = [],
  attempt = 1,
  showStrokeOrder = false,
  activeStrokeDesc = null,
  activeDirectionHint = null,
  allPaths = [],
  currentPath = [],
  hasDrawn = false,
  tracerVisible = false,
  tracerXInterp = null,
  tracerYInterp = null,
  onSpeakWord,
  canvasRef = null,
  onCanvasLayout,
  panHandlers = null,
}) {

  // The word is passed through unchanged — this only wraps it in the
  // instruction the child is being given.
  const targetInstruction = writeWordInstruction(displayWord);
  const isDemo = mode === WORD_STAGE_MODES.DEMO;

  // In demo mode the touch handlers are not merely disabled - they are never
  // attached, so there is nothing to accidentally re-enable.
  const canvasTouchProps = isDemo
    ? { pointerEvents: 'none' }
    : { ref: canvasRef, onLayout: onCanvasLayout, ...(panHandlers ?? {}) };

  const drawnPaths = isDemo ? [] : allPaths;
  const livePath   = isDemo ? [] : currentPath;

  return (
    <View style={styles.mainRow}>

      {/* Left column — large image */}
      <View style={styles.imageCol}>
        <Animated.View style={{ transform: [{ scale: imageScale ?? 1 }] }}>
          <WordImageDisplay imageKey={imageKey} emoji={emoji} size={IMG_SIZE} />
        </Animated.View>
      </View>

      {/* Right column — word card + spelling + badge + canvas */}
      <View style={styles.contentCol}>

        {/* Word title card */}
        <View style={[styles.wordCard, {
          backgroundColor: theme.button + '14',
          borderColor:     theme.button + '35',
        }]}>
          <View style={styles.wordTexts}>
            <Text
              style={[styles.wordTitle, { color: theme.headingText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {targetInstruction.en}
            </Text>
            <Text
              style={[styles.wordTitleSi, { color: theme.headingText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {targetInstruction.si}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.soundBtn, { backgroundColor: theme.button }]}
            onPress={onSpeakWord}
            disabled={!onSpeakWord}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Replay pronunciation of ${word}`}
          >
            <Ionicons name="volume-high" size={18} color={theme.buttonText} />
          </TouchableOpacity>
        </View>

        {/* Spelling */}
        <Text style={[styles.spellingText, { color: theme.headingText }]}>
          {spelling}
        </Text>

        {/* Attempt badge */}
        <View style={[styles.attemptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          {/* The wording is passed in, so the demonstration can say "Watch
              first" in the same badge the practice screen uses for its
              instruction line the practice screen uses. The screen resolves
              it from constants/childInstructions.js, so both say the same
              words for the same support level. */}
          <Text style={[styles.attemptTitle, { color: badge.text }]}>{instruction?.en}</Text>
          <Text style={[styles.attemptHint, { color: badge.text }]}>{instruction?.si}</Text>
        </View>

        {/* Writing canvas — canvasOuter wraps the card so the tracer dot
            is never clipped by the card's overflow:hidden */}
        <View style={styles.canvasOuter}>
          <View
            style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
            {...canvasTouchProps}
            accessible
            accessibilityLabel="Word handwriting practice area"
          >
            <Svg width={CANVAS_W} height={CANVAS_H}>

              {/* 4-line ruling */}
              <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
              <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
              <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
              <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

              {/* Visible letter-size/spacing guide boxes — instructional
                  only, shown on every attempt. Thin, low-prominence
                  border; no fill; rendered below the guide path/tracer/
                  ink so handwriting always stays clearly on top. Purely
                  decorative — writing outside a box never clips strokes
                  or affects scoring (see wordPaths.js). */}
              {letterBoxes.map(box => (
                <Rect
                  key={`letter-box-${box.index}`}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  rx={4}
                  fill="rgba(120,120,140,0.05)"
                  stroke="rgba(120,120,140,0.45)"
                  strokeWidth={1}
                />
              ))}

              {/* Reference-path guide — built from the same per-letter
                  LETTER_PATHS waypoints letter tracing uses, laid out
                  left-to-right across the word. Ghost dots mark single-
                  point strokes (the 'i' / 'j' dots). */}
              {guideOpacity > 0 && guidePathD && (
                <>
                  <Path
                    d={guidePathD}
                    stroke={`rgba(80,80,80,${guideOpacity})`}
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
                      fill={`rgba(80,80,80,${guideOpacity})`}
                    />
                  ))}
                </>
              )}

              {/* Stroke-order marker (attempt 2) — same system as letter
                  tracing: numbered start dot + direction arrow(s) for
                  the current stroke, advancing letter by letter as each
                  stroke is completed. Number resets per letter (1, 2, 3…),
                  matching what single-letter tracing shows. */}
              {showStrokeOrder && activeStrokeDesc && activeDirectionHint && (
                <>
                  <Circle
                    cx={activeDirectionHint.start.x}
                    cy={activeDirectionHint.start.y}
                    r={11}
                    fill="none"
                    stroke={theme.button}
                    strokeWidth={2}
                    opacity={0.72}
                  />
                  <Circle
                    cx={activeDirectionHint.start.x}
                    cy={activeDirectionHint.start.y}
                    r={8}
                    fill={theme.button}
                    opacity={0.80}
                  />
                  <SvgText
                    x={activeDirectionHint.start.x}
                    y={activeDirectionHint.start.y + 4}
                    fontSize={11}
                    fill={theme.buttonText ?? '#FFFFFF'}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {activeStrokeDesc.localStrokeIndex + 1}
                  </SvgText>
                  {activeDirectionHint.endGuides.map((guide, index) => (
                    <Circle
                      key={`stroke-end-${index}`}
                      cx={guide.x}
                      cy={guide.y}
                      r={index === activeDirectionHint.endGuides.length - 1 ? 6 : 4.5}
                      fill="none"
                      stroke={theme.button}
                      strokeWidth={2}
                      opacity={0.72}
                    />
                  ))}
                  {activeDirectionHint.arrows.map((arrow, index) => (
                    <React.Fragment key={`stroke-arrow-${index}`}>
                      <Line
                        x1={arrow.shaftStart.x}
                        y1={arrow.shaftStart.y}
                        x2={arrow.tip.x}
                        y2={arrow.tip.y}
                        stroke={theme.button}
                        strokeWidth={3.5}
                        strokeLinecap="round"
                      />
                      <Polygon points={arrow.arrowHead} fill={theme.button} />
                    </React.Fragment>
                  ))}
                </>
              )}

              {/* Completed strokes */}
              {drawnPaths.map((stroke, i) => (
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

              {/* Live stroke */}
              {livePath.length > 1 && (
                <Polyline
                  points={livePath.map(p => `${p.x},${p.y}`).join(' ')}
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

          {/* Tracer dot — traces the whole word guide during Attempt 1 */}
          {(isDemo
            ? (tracerVisible && tracerXInterp)
            : (attempt === 1 && !hasDrawn && tracerVisible && tracerXInterp)
          ) && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View
                style={[
                  styles.tracerDot,
                  {
                    backgroundColor: theme.button,
                    transform: [
                      { translateX: tracerXInterp },
                      { translateY: tracerYInterp },
                    ],
                  },
                ]}
              />
            </View>
          )}
        </View>

      </View>
    </View>
  );
}

// Values moved verbatim from WordWritingScreen.js's own StyleSheet.
const styles = StyleSheet.create({
  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },

  // The same soft surface the activities give their support picture. COL_L and
  // IMG_SIZE are NOT touched: wordCanvasLayout derives CANVAS_W from COL_L, so
  // the column width is canvas geometry, not styling.
  imageCol: {
    borderRadius: 28,
    width: COL_L,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },

  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  wordTexts: {
    flexShrink: 1,
  },
  wordTitleSi: {
    // Matches the spelling line under the card, so no existing size changes.
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.75,
  },
  wordTitle: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: 'Nunito_900Black',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  soundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },

  spellingText: {
    fontSize: 12,
    fontStyle: 'italic',
    letterSpacing: 1.5,
    opacity: 0.65,
    paddingLeft: 2,
  },

  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },

  // Sub-instruction — the same size on every writing surface.
  attemptTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },

  // The Sinhala half of the same instruction — matched size, extra
  // leading so the vowel signs are never clipped.
  attemptHint: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 2,
    textAlign: 'center',
    opacity: 0.85,
  },

  canvasOuter: {
    width:  CANVAS_W,
    height: CANVAS_H,
  },

  canvasCard: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  tracerDot: {
    position: 'absolute',
    left: -13,
    top: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
  },
});
