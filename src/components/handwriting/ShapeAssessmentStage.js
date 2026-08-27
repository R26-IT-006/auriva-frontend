/**
 * ShapeAssessmentStage.js
 *
 * The shape-assessment screen's instruction card + drawing canvas, as ONE
 * presentational component shared by two callers:
 *
 *   ShapeAssessmentScreen    mode="practice"
 *   HandwritingDemoScreen    mode="demo"
 *
 * Same reasoning as the letter and word stages: the demonstration the child
 * watches must BE the screen they meet next, down to the canvas size, the
 * dashed guide, the start dot and the moving pointer — not a resemblance of
 * it.
 *
 * `GuideShape` and this JSX were MOVED, unchanged, out of
 * ShapeAssessmentScreen. Nothing about the practice appearance changed.
 *
 * In demo mode: no panHandlers are attached at all, the canvas is
 * pointerEvents="none", and the child's stroke arrays are not read. There is
 * no path from a touch to a recorded point, and nothing here submits,
 * scores, or times anything in either mode.
 */

'use strict';

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Line, Circle, Path, Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import {
  CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_CX, CANVAS_CY, POINTER_SIZE, POINTER_HALF,
} from '../../constants/shapeCanvasLayout';

export const SHAPE_STAGE_MODES = Object.freeze({ PRACTICE: 'practice', DEMO: 'demo' });

/**
 * The dashed reference shape plus its start dot. Moved verbatim from
 * ShapeAssessmentScreen.js.
 */
export function GuideShape({ shapeId, theme }) {
  const cx = CANVAS_CX;
  const cy = CANVAS_CY;
  const dash = { stroke: '#B8C8E8', strokeWidth: 3, strokeDasharray: '10,6' };

  if (shapeId === 'horizontal_line') return (
    <>
      <Line x1={cx - 200} y1={cy} x2={cx + 200} y2={cy} {...dash} />
      <Circle cx={cx - 200} cy={cy} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'vertical_line') return (
    <>
      <Line x1={cx} y1={cy - 150} x2={cx} y2={cy + 150} {...dash} />
      <Circle cx={cx} cy={cy - 150} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'full_circle') return (
    <>
      <Circle cx={cx} cy={cy} r={120} fill="none" {...dash} />
      <Circle cx={cx} cy={cy - 120} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'half_circle') return (
    <>
      <Path
        d={`M ${cx - 150} ${cy} A 150 150 0 0 1 ${cx + 150} ${cy}`}
        fill="none" {...dash}
      />
      <Circle cx={cx - 150} cy={cy} r={12} fill={theme.button} />
    </>
  );

  if (shapeId === 'zigzag') {
    const pts = [
      { x: cx - 180, y: cy + 40 }, { x: cx - 120, y: cy - 40 },
      { x: cx - 60,  y: cy + 40 }, { x: cx,       y: cy - 40 },
      { x: cx + 60,  y: cy + 40 }, { x: cx + 120, y: cy - 40 },
      { x: cx + 180, y: cy + 40 },
    ];
    return (
      <>
        <Polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" {...dash} />
        <Circle cx={cx - 180} cy={cy + 40} r={12} fill={theme.button} />
      </>
    );
  }

  if (shapeId === 'curve_wave') return (
    <>
      <Path
        d={`M ${cx - 180} ${cy} Q ${cx - 120} ${cy - 60},${cx - 60} ${cy} Q ${cx} ${cy + 60},${cx + 60} ${cy} Q ${cx + 120} ${cy - 60},${cx + 180} ${cy}`}
        fill="none" {...dash}
      />
      <Circle cx={cx - 180} cy={cy} r={12} fill={theme.button} />
    </>
  );

  return null;
}

/**
 * @param {{
 *   mode?: 'practice'|'demo',
 *   theme: object,
 *   shape: {id: string, instruction: string, instructionSi: string, pageLabel: string},
 *   startDot: {x: number, y: number},
 *   allPaths?: Array, currentPath?: Array,
 *   showPulse?: boolean, pulseScale?: any, pulseOpacity?: any,
 *   pointerLeft: any, pointerTop: any,
 *   onSpeak?: () => void,
 *   canvasRef?: any, onCanvasLayout?: () => void, panHandlers?: object,
 * }} props
 */
export default function ShapeAssessmentStage({
  mode = SHAPE_STAGE_MODES.PRACTICE,
  theme,
  shape,
  startDot,
  allPaths = [],
  currentPath = [],
  showPulse = true,
  pulseScale = 1,
  pulseOpacity = 1,
  pointerLeft,
  pointerTop,
  onSpeak,
  canvasRef = null,
  onCanvasLayout,
  panHandlers = null,
}) {
  const isDemo = mode === SHAPE_STAGE_MODES.DEMO;

  // In demo mode the touch handlers are not merely disabled — they are never
  // attached, so there is nothing to accidentally re-enable.
  const canvasTouchProps = isDemo
    ? { pointerEvents: 'none' }
    : { ref: canvasRef, onLayout: onCanvasLayout, ...(panHandlers ?? {}) };

  const drawnPaths = isDemo ? [] : allPaths;
  const livePath   = isDemo ? [] : currentPath;

  return (
    <>
      {/* TOP: assessment badge + instruction */}
      <View style={styles.topArea}>
        <View style={[styles.assessBadge, { backgroundColor: theme.button + '18', borderColor: theme.button + '40' }]}>
          <Ionicons name="pencil-outline" size={13} color={theme.button} />
          <Text style={[styles.assessBadgeText, { color: theme.button }]}>
            {shape.pageLabel}
          </Text>
        </View>

        <View style={[styles.instructionCard, { borderLeftColor: theme.button }]}>
          <View style={styles.instructionInner}>
            <View style={styles.instructionTexts}>
              <Text style={styles.instructionEn}>{shape.instruction}</Text>
              <Text style={styles.instructionSi}>{shape.instructionSi}</Text>
            </View>
            <TouchableOpacity
              onPress={onSpeak}
              disabled={!onSpeak}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.speakerBtn, { backgroundColor: theme.button + '18' }]}
              activeOpacity={0.7}
            >
              <Ionicons name="volume-high" size={24} color={theme.button} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* MIDDLE: drawing canvas */}
      <View style={styles.canvasArea}>
        <View
          style={[styles.canvasCard, { borderColor: theme.button + '30' }]}
          {...canvasTouchProps}
        >
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
            <GuideShape shapeId={shape.id} theme={theme} />

            {drawnPaths.map((stroke, i) => (
              <Polyline
                key={i}
                points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
                stroke={theme.button}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}

            {livePath.length > 1 && (
              <Polyline
                points={livePath.map(p => `${p.x},${p.y}`).join(' ')}
                stroke={theme.button}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.7}
              />
            )}
          </Svg>

          {/* Pulsing ring — guides child to start position */}
          {showPulse && startDot && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseDot,
                {
                  left:            startDot.x - 18,
                  top:             startDot.y - 18,
                  borderColor:     theme.button,
                  backgroundColor: theme.button + '20',
                  transform:       [{ scale: pulseScale }],
                  opacity:         pulseOpacity,
                },
              ]}
            />
          )}

          {/* Animated guide pointer */}
          {pointerLeft != null && pointerTop != null && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pointer,
                { backgroundColor: theme.button, left: pointerLeft, top: pointerTop },
              ]}
            />
          )}
        </View>
      </View>
    </>
  );
}

// Values moved verbatim from ShapeAssessmentScreen.js's own StyleSheet.
const styles = StyleSheet.create({
  topArea: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    flexShrink: 0,
  },

  assessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },

  assessBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  instructionCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  instructionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  instructionTexts: {
    flex: 1,
    gap: 4,
  },

  instructionEn: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 30,
  },

  instructionSi: {
    fontSize: 19,
    fontWeight: '600',
    color: '#7B7B9E',
    textAlign: 'center',
    lineHeight: 26,
  },

  speakerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  canvasArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },

  canvasCard: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: 'rgba(248,250,255,0.96)',
    borderRadius: 26,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },

  pulseDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },

  pointer: {
    position: 'absolute',
    width: POINTER_SIZE,
    height: POINTER_SIZE,
    borderRadius: POINTER_HALF,
    opacity: 0.8,
  },
});
