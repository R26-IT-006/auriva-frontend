/**
 * LetterWritingStage.js
 *
 * The letter-writing screen's main area — letter card, title card,
 * attempt badge, canvas, tracer — as ONE presentational component shared by
 * three callers:
 *
 *   LetterWritingScreen      mode="practice"
 *   UppercaseWritingScreen   mode="practice"
 *   HandwritingDemoScreen    mode="demo"
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 * The demonstration must look like the screen the child is about to use —
 * not like a tidy approximation of it. The only way to guarantee that
 * permanently is for the demo and the real activity to render the same JSX
 * from the same file. A copy would look right today and drift the first time
 * either screen is adjusted.
 *
 * This JSX was MOVED, unchanged, out of the two writing screens (which had
 * carried structurally identical copies of it). Nothing about the practice
 * appearance was redesigned in the move.
 *
 * ── The two modes ───────────────────────────────────────────────────────
 * The layout is identical in both. `mode` changes only whether the canvas
 * accepts touch:
 *
 *   practice  the caller's panHandlers are spread onto the canvas, the
 *             child's strokes render, the sound button works — exactly as
 *             before.
 *   demo      no panHandlers are spread AT ALL (not merely ignored), the
 *             canvas is pointerEvents="none", and the stroke arrays are not
 *             read. There is no path from a touch to a recorded point.
 *
 * This component owns no state, performs no scoring, and makes no network
 * call in either mode. Everything it draws is passed in.
 */

'use strict';

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Line, Path, Circle, Polyline, Polygon, Text as SvgText } from 'react-native-svg';
import { writeLetterInstruction } from '../../constants/childInstructions';
import { Ionicons } from '@expo/vector-icons';
import InstructionReplayButton from './InstructionReplayButton';

import { normalizeStrokes } from '../../utils/dtw';
import { SUPPORT_LEVELS } from '../../constants/handwritingSupportLevels';
import {
  PAD, COL_L, LETTER_CARD_SIZE, CANVAS_W, CANVAS_H, aspectX,
  LINE_1, LINE_2, LINE_3, LINE_4,
} from '../../constants/letterCanvasLayout';

// ─── Support badge vocabulary ───────────────────────────────────────────
// Moved here from the two writing screens, which held identical copies. The
// demonstration renders the same badge chrome, so these must be one source.

export const SUPPORT_BADGE = {
  [SUPPORT_LEVELS.HIGH]:   { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },  // warm orange
  [SUPPORT_LEVELS.MEDIUM]: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },  // golden yellow
  [SUPPORT_LEVELS.LOW]:    { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },  // fresh green
};

// The support wording and its Sinhala now live in constants/childInstructions.js
// so lowercase, uppercase, word writing and the demonstration all say the same
// sentence — and one future recording per key covers all four. The long second
// hint that used to sit under each of these repeated the same instruction in
// more words and has been removed from the child UI.

// ─── Ghost-letter path builders ─────────────────────────────────────────
// Moved verbatim from the two writing screens, which each held an identical
// private copy. They render the ghost guide the tracer and the DTW template
// already share, so all three stay one shape.

/** Smooth catmull-rom SVG path. Multi-stroke: each stroke gets its own M. */
function toSmoothPath(rawPath) {
  const strokes = normalizeStrokes(rawPath);
  let d = '';
  for (const waypoints of strokes) {
    if (!waypoints || waypoints.length < 2) continue;
    const pts = waypoints.map(p => [aspectX(p.fx) * CANVAS_W, p.fy * CANVAS_H]);
    d += ` M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
  }
  return d.trim();
}

function toStraightPath(rawPath) {
  const strokes = normalizeStrokes(rawPath);
  let d = '';
  for (const waypoints of strokes) {
    if (!waypoints || waypoints.length < 2) continue;
    const pts = waypoints.map(p => [aspectX(p.fx) * CANVAS_W, p.fy * CANVAS_H]);
    d += ` M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
  }
  return d.trim();
}

/** Single-point strokes (the dot on i/j) rendered as dots, not lines. */
function getGhostDots(rawPath) {
  const strokes = normalizeStrokes(rawPath);
  const dots = [];
  for (const s of strokes) {
    if (s && s.length === 1) {
      dots.push({ cx: aspectX(s[0].fx) * CANVAS_W, cy: s[0].fy * CANVAS_H });
    }
  }
  return dots;
}

export const LETTER_STAGE_MODES = Object.freeze({ PRACTICE: 'practice', DEMO: 'demo' });

/**
 * @param {{
 *   mode?: 'practice'|'demo',
 *   letter: string,
 *   theme: object,
 *   rawPath: any,                 // this letter's entry from the screen's LETTER_PATHS
 *   isAngular?: boolean,
 *   guideOpacity?: number,
 *   supportPresentation?: object,
 *   activeGuideStart?: object|null,
 *   activeGuideStroke?: number,
 *   activeDirectionHint?: object|null,
 *   allPaths?: Array, currentPath?: Array,
 *   hasDrawn?: boolean,
 *   tracerVisible?: boolean, tracerXInterp?: any, tracerYInterp?: any,
 *   badge: {bg: string, border: string, text: string},
 *   instruction: {en: string, si: string},
 *   onPlaySound?: () => void, onPlayInstruction?: () => void,
 *   canvasRef?: any, onCanvasLayout?: () => void,
 *   panHandlers?: object,         // practice only — never spread in demo mode
 *   canvasPointerEvents?: 'auto'|'none',
 *   children?: React.ReactNode,   // demo overlay slot, drawn above the canvas
 * }} props
 */
export default function LetterWritingStage({
  mode = LETTER_STAGE_MODES.PRACTICE,
  letter,
  theme,
  rawPath,
  isAngular = false,
  guideOpacity = 0,
  supportPresentation = null,
  activeGuideStart = null,
  activeGuideStroke = 0,
  activeDirectionHint = null,
  allPaths = [],
  currentPath = [],
  hasDrawn = false,
  tracerVisible = false,
  tracerXInterp = null,
  tracerYInterp = null,
  badge,
  instruction,
  onPlaySound,
  onPlayInstruction,
  canvasRef = null,
  onCanvasLayout,
  panHandlers = null,
  canvasPointerEvents = 'auto',
}) {
  const isDemo = mode === LETTER_STAGE_MODES.DEMO;

  // The character is passed through with its own case — 'a' and 'A' are
  // different targets, and the old unconditional .toUpperCase() here made the
  // lowercase screen tell the child to write 'A'.
  const targetInstruction = writeLetterInstruction(letter);

  // In demo mode the touch handlers are not merely disabled — they are never
  // attached, so there is nothing to accidentally re-enable.
  const canvasTouchProps = isDemo
    ? { pointerEvents: 'none' }
    : { pointerEvents: canvasPointerEvents, ref: canvasRef, onLayout: onCanvasLayout, ...(panHandlers ?? {}) };

  // Likewise the child's own strokes: a demo has none to draw.
  const drawnPaths = isDemo ? [] : allPaths;
  const livePath   = isDemo ? [] : currentPath;

  return (
    <View style={styles.mainRow}>

      {/* Left column — large letter card */}
      <View style={styles.letterCol}>
        <View style={[styles.letterCard, { backgroundColor: theme.button }]}>
          <Text style={[styles.letterCardText, { color: theme.buttonText }]}>
            {letter}
          </Text>
        </View>
      </View>

      {/* Right column — title + badge + canvas */}
      <View style={styles.contentCol}>

        {/* Title card: "Write 'A'" + filled sound button */}
        <View style={[styles.titleCard, {
          backgroundColor: theme.button + '14',
          borderColor:     theme.button + '35',
        }]}>
          <View style={styles.titleTexts}>
            <Text style={[styles.writeLabel, { color: theme.headingText }]}>
              {targetInstruction.en}
            </Text>
            <Text style={[styles.writeLabelSi, { color: theme.headingText }]}>
              {targetInstruction.si}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.soundBtn, { backgroundColor: theme.button }]}
            onPress={onPlaySound}
            disabled={!onPlaySound}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="volume-high" size={18} color={theme.buttonText} />
          </TouchableOpacity>
        </View>

        {/* Attempt badge */}
        <View style={[styles.attemptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <View style={styles.attemptTexts}>
            <Text style={[styles.attemptTitle, { color: badge.text }]}>{instruction?.en}</Text>
            <Text style={[styles.attemptHint, { color: badge.text }]}>{instruction?.si}</Text>
          </View>
          <InstructionReplayButton
            onPress={onPlayInstruction}
            color={badge.text}
            backgroundColor={badge.border + '35'}
          />
        </View>

        {/* Writing canvas — canvasOuter wraps the card so the tracer dot
            is never clipped by overflow:hidden */}
        <View style={styles.canvasOuter}>
          <View
            style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
            {...canvasTouchProps}
          >
            <Svg width={CANVAS_W} height={CANVAS_H}>

              {/* 4-line ruling */}
              <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
              <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
              <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
              <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

              {/* Ghost letter: drawn from LETTER_PATHS so the ghost,
                  tracer dot, and DTW template all share one shape. */}
              {guideOpacity > 0 && rawPath && (
                <>
                  <Path
                    d={isAngular ? toStraightPath(rawPath) : toSmoothPath(rawPath)}
                    stroke={`rgba(80,80,80,${guideOpacity})`}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeLinejoin={isAngular ? 'miter' : 'round'}
                    fill="none"
                  />
                  {getGhostDots(rawPath).map((dot, idx) => (
                    <Circle
                      key={`ghost-dot-${idx}`}
                      cx={dot.cx}
                      cy={dot.cy}
                      r={5}
                      fill={`rgba(80,80,80,${guideOpacity})`}
                    />
                  ))}
                </>
              )}

              {/* MEDIUM support: numbered stroke-order start dot. Gated on
                  supportPresentation.showStartMarker (see
                  handwritingSupportLevels.js). */}
              {supportPresentation?.showStartMarker && activeGuideStart && (
                <>
                  <Circle
                    cx={aspectX(activeGuideStart.fx) * CANVAS_W}
                    cy={activeGuideStart.fy * CANVAS_H}
                    r={12}
                    fill="none"
                    stroke={theme.button}
                    strokeWidth={2}
                    opacity={0.72}
                  />
                  <Circle
                    cx={aspectX(activeGuideStart.fx) * CANVAS_W}
                    cy={activeGuideStart.fy * CANVAS_H}
                    r={9} fill={theme.button} opacity={0.80}
                  />
                  <SvgText
                    x={aspectX(activeGuideStart.fx) * CANVAS_W}
                    y={activeGuideStart.fy * CANVAS_H + 5}
                    fontSize={12}
                    fill={theme.buttonText ?? '#FFFFFF'}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {activeGuideStroke + 1}
                  </SvgText>
                </>
              )}

              {/* MEDIUM support: stroke-direction arrows + end markers. */}
              {supportPresentation?.showDirectionHint && activeGuideStart && activeDirectionHint && (
                <>
                  {activeDirectionHint.endGuides.map((guide, index) => (
                    <Circle
                      key={`stroke-end-${index}`}
                      cx={guide.x}
                      cy={guide.y}
                      r={index === activeDirectionHint.endGuides.length - 1 ? 7 : 5}
                      fill="none"
                      stroke={theme.button}
                      strokeWidth={2.5}
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
                        strokeWidth={4}
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
                  strokeWidth={5}
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
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={0.75}
                />
              )}

            </Svg>
          </View>

          {/* Tracer dot lives outside overflow:hidden.
              tracerXInterp/tracerYInterp are Animated.interpolation nodes —
              they follow the exact bezier curve the ghost Path renders, not
              the raw waypoint chords. In demo mode the same node is driven by
              the demonstration's own timeline instead of the Attempt-1
              tracer, which is why the dot looks identical in both. */}
          {(isDemo
            ? (tracerVisible && tracerXInterp)
            : (supportPresentation?.showAnimatedTracer && !hasDrawn && tracerVisible && tracerXInterp)
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

// Values moved verbatim from the two writing screens' own StyleSheets, which
// held identical copies of every key below.
const styles = StyleSheet.create({
  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },

  letterCol: {
    width: COL_L,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },

  letterCard: {
    width: LETTER_CARD_SIZE,
    height: LETTER_CARD_SIZE,
    borderRadius: Math.round(LETTER_CARD_SIZE * 0.22),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },

  letterCardText: {
    fontSize: Math.round(LETTER_CARD_SIZE * 0.60),
    fontWeight: '900',
    lineHeight: Math.round(LETTER_CARD_SIZE * 0.75),
  },

  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  titleTexts: {
    flexShrink: 1,
  },
  writeLabelSi: {
    // Subordinate to the English line above it, so the Sinhala reads as the
    // second line of one instruction rather than a competing heading.
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    opacity: 0.75,
  },
  writeLabel: {
    fontSize: 26,
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


  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  attemptTexts: { flex: 1, alignItems: 'center' },

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
    left: -15,
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
  },
});
