import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Polygon, Path, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { storeLetterProgress } from '../../../utils/storage';
import { clampToCanvas, isImplausibleJump, pageToLocal, mapTouchToCanvas } from '../../../utils/touchPointSanitize';
import { getAllLetters } from '../../../constants/letterCategories';
import { fetchMasteredLetters, filterUnmasteredSequence } from '../../../utils/masteredLetterFiltering';
import { useLearningSessionActivity } from '../../../context/LearningSessionContext';
import BreakPromptModal from '../../../components/handwriting/BreakPromptModal';
import { LIVE_ACTIVITY_TYPES } from '../../../constants/liveSessionPolicy';
import { buildProgressPatch, buildScorePatch } from '../../../utils/liveSessionSnapshot';
import { DATA_COLLECTION_PROTOCOL } from '../../../constants/dataCollectionProtocol';
import { featuresToScore, DTW_CORRECT_THRESHOLD } from '../../../utils/adaptiveSequencing';
import { computeDTW, sampleSmoothPath, normalizeStrokes, computeMultiStrokeDTW } from '../../../utils/dtw';
import { buildDtwDebugExport } from '../../../utils/dtwDebugExport';
import { useToast } from '../../../context/ToastContext';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';
import AttemptAvatarFeedback from '../AttemptAvatarFeedback';
import {
  getDeviceMetadata, PROTOCOL_VERSION, FEATURE_VERSION, TEMPLATE_VERSION, NORMALIZATION_VERSION,
} from '../../../utils/collectionSession';
import { getLetterPrimitiveGroup, selectPreWritingActivities, getPreWritingActivityById } from '../../../constants/preWritingActivities';
import { primitiveGroupOnEntering } from '../../../utils/preWritingTransition';
import { buildLetterRemediationActivities } from '../../../utils/letterRemediationPlan';
import {
  createPreWritingInteractionId,
  markWarmupHandled,
  buildPreWritingNavigationParams,
  PRE_WRITING_REASON,
  hasWarmupHandled,
  resolveAdaptivePreWritingDetour,
  hasRemediationHandled,
  markRemediationHandled,
} from '../../../utils/preWritingSessionGuard';
// One-time category demonstration — see utils/demoPolicy.js. Decides only;
// writes nothing until the child presses "I'm Ready" on the demo screen.
import { useDemoDetour } from '../../../utils/demoDetour';
import { makeLetterCategoryDemoKey } from '../../../utils/demoPolicy';
import { SUPPORT_LEVELS, getSupportPresentation, resolveSessionSupportLevel } from '../../../constants/handwritingSupportLevels';
import { buildSessionAttemptRecord } from '../../../utils/handwritingAttemptPayload';
import { fetchRecommendedStartSupport, shouldApplyRecommendation, resolveRecommendedStartSupport } from '../../../utils/supportRecommendation';
import { fetchPreWritingRecommendation } from '../../../utils/preWritingRecommendation';
import { fetchRepetitionRecommendation } from '../../../utils/repetitionRecommendation';
import { DEMO_SPEED_LEVELS, getStrokeDurationForLevel } from '../../../constants/demoSpeedLevels';
import {
  fetchDemoSpeedRecommendation, shouldApplyDemoSpeedRecommendation, resolveRecommendedDemoSpeedLevel,
} from '../../../utils/demoSpeedRecommendation';
import { resolveActualDemoSpeedLevel } from '../../../utils/demoSpeedPersistence';
import { getAdaptiveRepetitionsUsed, incrementAdaptiveRepetitionsUsed } from '../../../utils/repetitionSessionGuard';
import { insertSpacedRepetition } from '../../../utils/controlledRepetition';
// The two-cycle-per-practice-date ceiling. Before this, a failed cycle
// reset the child to attempt 1 on the SAME letter with nothing bounding it.
import {
  recordCycleCompleted, getCyclesUsed, MAX_CYCLES_PER_LETTER_PER_DATE, MASTERY_ATTEMPT_NUMBER, MASTERY_ATTEMPT_INDEX,
} from '../../../utils/letterCycleGuard';
import {
  calculateTotalDistance, calculateAverageSpeed, calculateSpeedStats, calculatePauseMetrics,
  calculateAttemptDurationFromAbsoluteTime, calculateAttemptAverageSpeed, calculateAttemptPauseMetrics,
} from '../../../utils/trajectoryFeatures';
import { useLockLandscape } from '../../../utils/useOrientationLock';
import useGatedBack from '../../../utils/useGatedBack';
import { goBackToOrigin } from '../../../utils/backToOrigin';
// The shared letter-writing presentation - this screen and the demonstration
// render the SAME component, in different modes.
import LetterWritingStage from '../../../components/handwriting/LetterWritingStage';
import {
  SUPPORT_BADGE,
} from '../../../components/handwriting/LetterWritingStage';
import { instructionForSupport, SUPPORT_INSTRUCTION_KEY } from '../../../constants/childInstructions';
import { useInstructionAudioState } from '../../../utils/useInstructionAudio';
import { ukLetterSpeechOptions } from '../../../constants/speechLocale';
import { hasCanvasDrawing } from '../../../utils/canvasDrawingState';
import { actionRowMinHeight } from '../../../constants/writingActionRow';
import { startGuideReplayCycle } from '../../../utils/guideReplayCycle';
import {
  PAD, COL_L, LETTER_CARD_SIZE, CANVAS_W, CANVAS_H, ASPECT, aspectX,
  LINE_1, LINE_2, LINE_3, LINE_4,
} from '../../../constants/letterCanvasLayout';

// The canvas view's own borderWidth. measure() reports the BORDER box while
// the Svg starts inside the border, so this removes that systematic offset.
// Kept next to the import so one file has one value.
const CANVAS_BORDER_WIDTH = 1.5;

// Shapes occupy 0-5, lowercase letters occupy 6-15 — uppercase continues from 16.
const UPPERCASE_TASK_ORDER_OFFSET = 16;

// Canvas geometry (CANVAS_W/CANVAS_H, the 4-line ruling, the aspect
// correction, the column split) now lives in ONE place, imported above and
// shared with the "watch first" demonstration, so a demo can never render
// this letter at a different size. Every value is unchanged - the module is
// a move of this screen's own declarations, not a redesign.



// Feature 3 Step 2: keyed by SUPPORT_LEVELS (high/medium/low) instead of raw
// attempt number — see LetterWritingScreen.js's identical migration for the
// full rationale. Values are byte-identical to the pre-refactor
// ATTEMPT_BADGE and the attempt wording; only the lookup key changed.

const START_POS = {
  I: { fx: 0.50, fy: 0.12 }, L: { fx: 0.37, fy: 0.12 }, T: { fx: 0.50, fy: 0.12 },
  E: { fx: 0.37, fy: 0.12 }, F: { fx: 0.37, fy: 0.12 }, H: { fx: 0.35, fy: 0.12 },
  O: { fx: 0.50, fy: 0.12 }, C: { fx: 0.66, fy: 0.28 }, U: { fx: 0.34, fy: 0.12 },
  J: { fx: 0.56, fy: 0.12 }, S: { fx: 0.63, fy: 0.24 }, G: { fx: 0.66, fy: 0.28 },
  Q: { fx: 0.50, fy: 0.12 }, D: { fx: 0.36, fy: 0.12 }, P: { fx: 0.36, fy: 0.12 },
  B: { fx: 0.36, fy: 0.12 }, V: { fx: 0.29, fy: 0.12 }, Y: { fx: 0.29, fy: 0.12 },
  A: { fx: 0.39, fy: 0.12 }, K: { fx: 0.36, fy: 0.12 }, M: { fx: 0.28, fy: 0.12 },
  N: { fx: 0.32, fy: 0.12 }, R: { fx: 0.36, fy: 0.12 }, W: { fx: 0.22, fy: 0.12 },
  X: { fx: 0.29, fy: 0.12 }, Z: { fx: 0.31, fy: 0.12 },
};

const DEFAULT_START = { fx: 0.36, fy: 0.12 };


const LETTER_PATHS = {
  A:[[{fx:0.28,fy:0.64},{fx:0.50,fy:0.08}],[{fx:0.50,fy:0.08},{fx:0.72,fy:0.64}],[{fx:0.40,fy:0.36},{fx:0.60,fy:0.36}]],
  B:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.52,fy:0.10},{fx:0.60,fy:0.16},{fx:0.60,fy:0.24},{fx:0.52,fy:0.34},{fx:0.34,fy:0.36}],
    [{fx:0.34,fy:0.36},{fx:0.52,fy:0.38},{fx:0.60,fy:0.44},{fx:0.60,fy:0.52},{fx:0.52,fy:0.62},{fx:0.34,fy:0.64}]
  ],
  C:[{fx:0.70,fy:0.18},{fx:0.60,fy:0.11},{fx:0.50,fy:0.08},{fx:0.38,fy:0.11},{fx:0.30,fy:0.19},{fx:0.27,fy:0.36},{fx:0.30,fy:0.53},{fx:0.38,fy:0.61},{fx:0.50,fy:0.64},{fx:0.60,fy:0.61},{fx:0.70,fy:0.54}],
  D:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.11},{fx:0.66,fy:0.22},{fx:0.68,fy:0.36},{fx:0.66,fy:0.50},{fx:0.54,fy:0.61},{fx:0.34,fy:0.64}]
  ],
  E:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.08},{fx:0.66,fy:0.08}],[{fx:0.34,fy:0.36},{fx:0.60,fy:0.36}],[{fx:0.34,fy:0.64},{fx:0.66,fy:0.64}]],
  F:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.66,fy:0.08}],
    [{fx:0.34,fy:0.36},{fx:0.60,fy:0.36}]
  ],
  G:[
    [{fx:0.66,fy:0.18},{fx:0.56,fy:0.10},{fx:0.44,fy:0.09},{fx:0.34,fy:0.15},{fx:0.29,fy:0.26},{fx:0.28,fy:0.36},{fx:0.29,fy:0.46},{fx:0.34,fy:0.57},{fx:0.44,fy:0.63},{fx:0.55,fy:0.64},{fx:0.64,fy:0.58},{fx:0.66,fy:0.50}],
    [{fx:0.50,fy:0.36},{fx:0.66,fy:0.36}],
    [{fx:0.66,fy:0.36},{fx:0.66,fy:0.50}]
  ],
  H:[
    [{fx:0.32,fy:0.08},{fx:0.32,fy:0.64}],
    [{fx:0.32,fy:0.36},{fx:0.68,fy:0.36}],
    [{fx:0.68,fy:0.08},{fx:0.68,fy:0.64}]
  ],
  I:[[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}],[{fx:0.38,fy:0.08},{fx:0.62,fy:0.08}],[{fx:0.38,fy:0.64},{fx:0.62,fy:0.64}]],
  J:[{fx:0.60,fy:0.08},{fx:0.60,fy:0.52},{fx:0.56,fy:0.60},{fx:0.46,fy:0.64},{fx:0.36,fy:0.60},{fx:0.33,fy:0.52}],
  K:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.36},{fx:0.66,fy:0.08}],
    [{fx:0.34,fy:0.36},{fx:0.68,fy:0.64}]
  ],
  L:[{fx:0.36,fy:0.08},{fx:0.36,fy:0.64},{fx:0.64,fy:0.64}],
  M:[
    [{fx:0.24,fy:0.64},{fx:0.24,fy:0.08}],
    [{fx:0.24,fy:0.08},{fx:0.50,fy:0.64}],
    [{fx:0.50,fy:0.64},{fx:0.76,fy:0.08}],
    [{fx:0.76,fy:0.08},{fx:0.76,fy:0.64}]
  ],
  N:[
    [{fx:0.30,fy:0.64},{fx:0.30,fy:0.08}],
    [{fx:0.30,fy:0.08},{fx:0.70,fy:0.64}],
    [{fx:0.70,fy:0.64},{fx:0.70,fy:0.08}]
  ],
  O:[{fx:0.50,fy:0.08},{fx:0.62,fy:0.11},{fx:0.70,fy:0.19},{fx:0.73,fy:0.36},{fx:0.70,fy:0.53},{fx:0.62,fy:0.61},{fx:0.50,fy:0.64},{fx:0.38,fy:0.61},{fx:0.30,fy:0.53},{fx:0.27,fy:0.36},{fx:0.30,fy:0.19},{fx:0.38,fy:0.11},{fx:0.50,fy:0.08}],
  P:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.10},{fx:0.63,fy:0.17},{fx:0.63,fy:0.27},{fx:0.54,fy:0.35},{fx:0.34,fy:0.37}]
  ],
  Q:[
    [{fx:0.50,fy:0.08},{fx:0.62,fy:0.11},{fx:0.70,fy:0.19},{fx:0.73,fy:0.36},{fx:0.70,fy:0.53},{fx:0.62,fy:0.61},{fx:0.50,fy:0.64},{fx:0.38,fy:0.61},{fx:0.30,fy:0.53},{fx:0.27,fy:0.36},{fx:0.30,fy:0.19},{fx:0.38,fy:0.11},{fx:0.50,fy:0.08}],
    [{fx:0.56,fy:0.52},{fx:0.72,fy:0.68}]
  ],
  R:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.08},{fx:0.54,fy:0.10},{fx:0.63,fy:0.17},{fx:0.63,fy:0.27},{fx:0.54,fy:0.35},{fx:0.34,fy:0.37}],
    [{fx:0.34,fy:0.37},{fx:0.66,fy:0.64}]
  ],
  S:[{fx:0.64,fy:0.20},{fx:0.62,fy:0.13},{fx:0.54,fy:0.09},{fx:0.45,fy:0.09},{fx:0.37,fy:0.12},{fx:0.33,fy:0.19},{fx:0.34,fy:0.26},{fx:0.40,fy:0.31},{fx:0.50,fy:0.35},{fx:0.59,fy:0.40},{fx:0.65,fy:0.46},{fx:0.66,fy:0.54},{fx:0.62,fy:0.60},{fx:0.54,fy:0.64},{fx:0.45,fy:0.64},{fx:0.37,fy:0.61},{fx:0.34,fy:0.55}],
  T:[[{fx:0.30,fy:0.08},{fx:0.70,fy:0.08}],[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}]],
  U:[{fx:0.30,fy:0.08},{fx:0.30,fy:0.46},{fx:0.34,fy:0.58},{fx:0.42,fy:0.63},{fx:0.50,fy:0.64},{fx:0.58,fy:0.63},{fx:0.66,fy:0.58},{fx:0.70,fy:0.46},{fx:0.70,fy:0.08}],
  V:[{fx:0.30,fy:0.08},{fx:0.50,fy:0.64},{fx:0.70,fy:0.08}],
  W:[{fx:0.22,fy:0.08},{fx:0.36,fy:0.64},{fx:0.50,fy:0.08},{fx:0.64,fy:0.64},{fx:0.78,fy:0.08}],
  X:[
    [{fx:0.30,fy:0.08},{fx:0.70,fy:0.64}],
    [{fx:0.70,fy:0.08},{fx:0.30,fy:0.64}]
  ],
  Y:[
    [{fx:0.30,fy:0.08},{fx:0.50,fy:0.36}],
    [{fx:0.70,fy:0.08},{fx:0.50,fy:0.36}],
    [{fx:0.50,fy:0.36},{fx:0.50,fy:0.64}]
  ],
  Z:[{fx:0.32,fy:0.08},{fx:0.68,fy:0.08},{fx:0.32,fy:0.64},{fx:0.68,fy:0.64}],
};

const ANGULAR_LETTERS = new Set([
  'x','y',
  'V','W','Z','X','Y','K','L','A','E','M','N','T','I','H','F',
]);

function sampleStraightStroke(waypoints, numSamples, canvasW, canvasH) {
  if (!waypoints || waypoints.length < 2) return { points: [], totalLength: 0 };
  const aspect = canvasW / canvasH;
  const pts = waypoints.map(p => ({
    x: (0.5 + (p.fx - 0.5) / aspect) * canvasW,
    y: p.fy * canvasH,
  }));
  const cumulativeLength = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cumulativeLength.push(cumulativeLength[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLength = cumulativeLength[cumulativeLength.length - 1];
  if (totalLength === 0) return { points: [pts[0]], totalLength: 0 };

  const points = [];
  for (let sample = 0; sample < numSamples; sample++) {
    const target = (sample / (numSamples - 1)) * totalLength;
    let segment = 0;
    while (
      segment < pts.length - 2
      && cumulativeLength[segment + 1] < target
    ) segment++;
    const span = cumulativeLength[segment + 1] - cumulativeLength[segment];
    const fraction = span > 0 ? (target - cumulativeLength[segment]) / span : 0;
    points.push({
      x: pts[segment].x + fraction * (pts[segment + 1].x - pts[segment].x),
      y: pts[segment].y + fraction * (pts[segment + 1].y - pts[segment].y),
    });
  }
  return { points, totalLength };
}

function getStrokeDirectionHint(stroke, showEverySegment = false) {
  if (!stroke?.length) return null;
  const points = stroke.map(point => ({
    x: aspectX(point.fx) * CANVAS_W,
    y: point.fy * CANVAS_H,
  }));
  const segmentCount = showEverySegment
    ? points.length - 1
    : Math.min(1, points.length - 1);
  const arrows = [];

  for (let index = 0; index < segmentCount; index++) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 2) continue;
    const ux = dx / distance;
    const uy = dy / distance;
    const shaftOffset = Math.min(22, distance * 0.35);
    const tipOffset = Math.max(shaftOffset + 10, Math.min(68, distance * 0.82));
    const shaftStart = {
      x: segmentStart.x + ux * shaftOffset,
      y: segmentStart.y + uy * shaftOffset,
    };
    const tip = {
      x: segmentStart.x + ux * tipOffset,
      y: segmentStart.y + uy * tipOffset,
    };
    const base = { x: tip.x - ux * 12, y: tip.y - uy * 12 };
    const px = -uy * 7;
    const py = ux * 7;
    arrows.push({
      shaftStart,
      tip,
      arrowHead: `${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`,
    });
  }

  const endGuides = points.length < 2
    ? []
    : showEverySegment ? points.slice(1) : points.slice(-1);

  return {
    start: points[0],
    arrows,
    endGuides,
  };
}

// Feature 6 Step 4 — TRACER_PX_PER_MS removed: its one and only usage (the
// tracer-stroke duration formula below) now goes through
// getStrokeDurationForLevel()/constants/demoSpeedLevels.js instead, which is
// byte-identical to the old `Math.max(600, Math.round(len / 0.28))` formula
// at 'standard' speed (spec §26). Unlike LetterWritingScreen.js, this file
// has no other (dead-code or otherwise) reference to the constant, so
// removing it is directly redundant because of this step's own activation,
// not unrelated cleanup (spec §23).
const ATTEMPT_FEEDBACK_MS = 2200;

// Returns total drawn length + bounding-box dimensions in one pass.
// Used on attempt 3 to catch cases where the child drew too little
// (e.g. a short line on 'O') regardless of how smooth it was.
function getDrawingBounds(paths) {
  const all = paths.flat();
  if (all.length === 0) return { length: 0, width: 0, height: 0 };
  let minX = all[0].x, maxX = all[0].x;
  let minY = all[0].y, maxY = all[0].y;
  let length = 0;
  for (let i = 1; i < all.length; i++) {
    if (all[i].x < minX) minX = all[i].x;
    if (all[i].x > maxX) maxX = all[i].x;
    if (all[i].y < minY) minY = all[i].y;
    if (all[i].y > maxY) maxY = all[i].y;
    const dx = all[i].x - all[i-1].x;
    const dy = all[i].y - all[i-1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return { length, width: maxX - minX, height: maxY - minY };
}

function didPassAttempt(features, paths) {
  const { length, width, height } = getDrawingBounds(paths);
  return features.smoothness < 0.35
    && length >= CANVAS_H * 0.25
    && (width >= CANVAS_W * 0.10 || height >= CANVAS_H * 0.15)
    && features.dtw_distance != null
    && features.dtw_distance < DTW_CORRECT_THRESHOLD;
}

// ML: total_distance/avg_speed/speed_std/speed_cv/pause-extras below are
// ADDITIVE new fields computed via the shared, stroke-aware
// utils/trajectoryFeatures.js (see Part 1-3 of the collection-mode
// ML-readiness pass). Every field already returned above this comment
// (smoothness, pauseCount, completionTime, strokeCount) is completely
// unchanged — same formulas, same variable names, same early-return shape
// — nothing below alters existing child-facing scoring/pass-fail logic.
function calculateDrawingFeatures(paths) {
  const allPoints = paths.flat();
  const totalDistance = calculateTotalDistance(paths);
  const pauseMetrics = calculatePauseMetrics(paths);
  // ML-safe duration pass: derived from tAbs (absolute, never resets between
  // strokes) rather than the legacy stroke-local `t` clock — see
  // utils/trajectoryFeatures.js's module doc comment. Every field above and
  // below this block is completely untouched; attempt_* are new, additive
  // fields only, never used for existing scoring/pass-fail.
  const attemptDurationMs = calculateAttemptDurationFromAbsoluteTime(paths);
  const mlFeatures = {
    total_distance: totalDistance,
    avg_speed:      calculateAverageSpeed(paths),
    ...calculateSpeedStats(paths),
    ...pauseMetrics,
    attempt_duration_ms: attemptDurationMs,
    attempt_avg_speed:   calculateAttemptAverageSpeed(totalDistance, attemptDurationMs),
    ...calculateAttemptPauseMetrics(pauseMetrics.pause_count, pauseMetrics.total_pause_duration_ms, attemptDurationMs),
  };
  if (allPoints.length < 2) {
    return { smoothness: 0, pauseCount: 0, completionTime: 0, strokeCount: paths.length, ...mlFeatures };
  }
  const completionTime = allPoints[allPoints.length - 1].t;
  let pauseCount = 0;
  for (let i = 1; i < allPoints.length; i++) {
    if (allPoints[i].t - allPoints[i - 1].t > 300) pauseCount++;
  }
  let smoothness = 0;
  if (allPoints.length >= 3) {
    const changes = [];
    for (let i = 1; i < allPoints.length - 1; i++) {
      const v1x = allPoints[i].x - allPoints[i-1].x, v1y = allPoints[i].y - allPoints[i-1].y;
      const v2x = allPoints[i+1].x - allPoints[i].x, v2y = allPoints[i+1].y - allPoints[i].y;
      const l1 = Math.sqrt(v1x*v1x + v1y*v1y), l2 = Math.sqrt(v2x*v2x + v2y*v2y);
      if (l1 > 0 && l2 > 0) {
        changes.push(Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / (l1*l2)))));
      }
    }
    if (changes.length > 0) smoothness = changes.reduce((a, b) => a + b, 0) / changes.length;
  }
  return { smoothness, pauseCount, completionTime, strokeCount: paths.length, ...mlFeatures };
}

function getAttemptBadge(smoothness) {
  if (smoothness < 0.15) return { label: 'Excellent! ✓', color: '#2E7D32', bg: '#E8F5E9' };
  if (smoothness < 0.35) return { label: 'Good effort!',      color: '#E65100', bg: '#FFF3E0' };
  return                        { label: 'Keep going!',        color: '#C62828', bg: '#FFEBEE' };
}

const CATEGORY_CELEBRATION = {
  straight: {
    icon: 'construct-outline',
    title: 'Tall Straight Capitals Done!',
    message: 'Those tall letters look amazing!\nYour lines are getting so steady.',
    color: '#1565C0',
  },
  curved: {
    icon: 'moon-outline',
    title: 'Curved Capitals Conquered!',
    message: 'Big beautiful curves!\nYour uppercase letters are shining.',
    color: '#6A1B9A',
  },
  mixed: {
    icon: 'star-outline',
    title: 'Complex Capitals Complete!',
    message: 'Those were the trickiest capitals!\nYou nailed every single one!',
    color: '#E65100',
  },
};

const ALL_DONE_CELEBRATION = {
  icon: 'trophy-outline',
  title: 'All Capitals Complete!',
  message: 'You wrote every capital letter!\nYou are a true alphabet champion!',
  color: '#2E7D32',
};

const NEXT_CATEGORY_LABEL = {
  straight: 'Straight capitals', curved: 'Curved capitals', mixed: 'Mixed capitals',
};

export default function UppercaseWritingScreen({ route, navigation }) {
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  // Back returns to the interface this flow STARTED from, not one frame down.
  //
  // Every warm-up detour is entered with navigation.navigate('PreWritingActivity'
  // | 'HandwritingDemo') — a PUSH — and left with navigation.replace(nextRoute).
  // replace() swaps the top frame, so each detour permanently leaves the frame
  // it was pushed over behind it. After one category transition the stack reads
  // [LetterPractice, UppercaseWriting, UppercaseWriting], and goBack() landed on that stale
  // copy — a previous letter, mid-cycle, from before the detour. A second
  // detour left two.
  //
  // goBackToOrigin pops to the named route instead, so the depth of the stack
  // stops mattering. It falls back to goBack() when the origin is not below
  // this screen (an assessment or Writing-Check entry), which is the previous
  // behaviour and safe. Navigation only: nothing here writes an attempt,
  // consumes a cycle, or replays a warm-up.
  const backOrigin = route.params?.originRoute ?? 'LetterPractice';
  const { requestBack, gateModal } = useGatedBack(
    () => goBackToOrigin(navigation, backOrigin)
  );

  const {
    student,
    theme,
    letterSequence  = [],
    collectionMode  = false,
    collectionSessionId = null,
    interactionId: interactionIdParam = null,
    // Present only when this run is a Writing Check batch. Its ONLY effect is
    // where the flow goes when the batch finishes.
    writingCheckId = null,
  } = route.params;

  const caseType = 'uppercase';

  // Feature 4 Step 3 — see LetterWritingScreen.js's identical comment: falls
  // back to a fresh id (stable for this mount's lifetime) for entry points
  // that bypass LetterPracticeScreen.
  const [interactionId] = useState(() => interactionIdParam ?? createPreWritingInteractionId());

  const baseSequence = useMemo(() => {
    const filtered = letterSequence.filter(l => l.caseType === caseType);
    return filtered.length > 0 ? filtered : getAllLetters(caseType);
  }, [letterSequence]);

  const { show } = useToast();

  // Proposal FR-13, Phase 7A / FR-16, Phase 7B — see LetterWritingScreen.js's
  // identical block. collection_mode is a fixed, teacher-supervised
  // research-capture protocol, not open-ended self-paced practice — both
  // features are excluded from it entirely (spec item 13 / Phase 7B §19).
  const { notifyStrokeStart, notifyStrokeEnd, notifyLiveSessionUpdate } = useLearningSessionActivity({
    suspend: collectionMode,
    studentId: student.sid,
    activityType: LIVE_ACTIVITY_TYPES.UPPERCASE_LETTER,
  });

  // Feature 11B Phase 5 §2-§5 — see LetterWritingScreen.js's identical
  // block for the full rationale: normal-progression fix (NOT a Feature
  // 11B adaptation change), skips already-mastered letters using the
  // backend's authoritative LetterProgress state, never frontend
  // AsyncStorage. Collection mode always presents its exact predetermined
  // sequence unfiltered.
  const [effectiveSequence, setEffectiveSequence] = useState(null);
  const [masteredSequenceReady, setMasteredSequenceReady] = useState(collectionMode);

  useEffect(() => {
    if (collectionMode) {
      setEffectiveSequence(baseSequence);
      setMasteredSequenceReady(true);
      return undefined;
    }
    let cancelled = false;
    fetchMasteredLetters(student.sid).then(({ pairs }) => {
      if (cancelled) return;
      const filtered = filterUnmasteredSequence(baseSequence, pairs);
      if (filtered.length === 0 && baseSequence.length > 0) {
        show('All letters here are already mastered!', 'success');
        navigation.goBack();
        return;
      }
      setEffectiveSequence(filtered);
      setMasteredSequenceReady(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.sid, baseSequence, collectionMode]);

  // Feature 5 Step 3 — see LetterWritingScreen.js's identical block for the
  // full rationale: `sequence` is the mastery-filtered base sequence
  // (Feature 11B Phase 5 above) unless/until a spaced adaptive repetition
  // has been inserted this mount.
  const [runtimeSequence, setRuntimeSequence] = useState(null);
  const sequence = runtimeSequence ?? effectiveSequence ?? baseSequence;

  const [letterIdx,    setLetterIdx]    = useState(0);
  const [attempt,      setAttempt]      = useState(1);
  const [currentPath,  setCurrentPath]  = useState([]);
  const [allPaths,     setAllPaths]     = useState([]);
  // Clear follows the CANVAS, not the session: it appears with the
  // child's first point and disappears again the moment the canvas is
  // empty. Deliberately not `hasDrawn`, which gates the guide and the
  // tracer and stays true after a clear.
  const canClearCanvas = hasCanvasDrawing({ allPaths, currentPath });
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [celebration,  setCelebration]  = useState(null);
  const [reduceMotion,  setReduceMotion] = useState(false);

  // Feature 3 Step 6 — see LetterWritingScreen.js's identical block for the
  // full rationale.
  const [recommendation, setRecommendation] = useState({ letter: null, startSupport: null });

  // Feature 6 Step 4 — see LetterWritingScreen.js's identical block for the
  // full rationale (double-layer staleness guarantee, default 'standard').
  const [demoSpeedRecommendation, setDemoSpeedRecommendation] = useState({
    letter: null, caseType: null, speedLevel: DEMO_SPEED_LEVELS.STANDARD,
  });

  const startTimeRef       = useRef(null);
  const allPathsRef        = useRef([]);
  // Border-touch bug fix — see touchPointSanitize.js.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  // ORIGIN — View.measure() reports this view's own pageX/pageY, the SAME
  // space nativeEvent.pageX/pageY uses. measureInWindow() reports WINDOW
  // space, which on Android excludes the system inset the touch includes;
  // mixing the two left a constant vertical offset on Y and none on X.
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
        canvasOriginRef.current = { x: pageX, y: pageY };
      }
    });
  }, []);
  const attemptScoresRef   = useRef([]);   // accumulates featuresToScore result for each attempt
  // Server-issued retry key for a capture-fault cycle; null at all other times.
  const retrySessionKeyRef = useRef(null);
  const sessionAttemptsRef = useRef([]);   // ML: accumulates {attempt_number, features, strokes} per letter
  const strokeIdCounter    = useRef(0);    // ML: counts strokes within the current attempt
  const attemptRef  = useRef(1);
  const hasDrawnRef = useRef(false);
  // Feature 5 Step 3 — see LetterWritingScreen.js's identical block for the
  // full rationale (staleness + concurrent-request protection for the
  // repetition-recommendation fetch).
  const cycleTokenRef = useRef(0);
  attemptRef.current  = attempt;
  hasDrawnRef.current = hasDrawn;

  const tracerProgress    = useRef(new Animated.Value(0)).current;
  // The guide stops at the child's FIRST TOUCH, not when the stroke ends.
  // `hasDrawn` only flips on release, so it is too late to be the stop signal
  // here; this ref lets the grant handler cancel the cycle immediately
  // without changing what `hasDrawn` means to support, audio or scoring.
  const stopGuideRef = useRef(null);
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);

  const celebScale   = useRef(new Animated.Value(0.5)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;

  const letterObj     = sequence[letterIdx];
  const letter        = letterObj?.letter ?? 'A';
  const isLastLetter  = letterIdx >= sequence.length - 1;
  const isLastAttempt = attempt === 3;

  // Feature 3 Step 2 — formal support-level model. See
  // LetterWritingScreen.js's identical block for the full rationale:
  // `attempt` remains session-position source of truth; `supportLevel`/
  // `supportPresentation` are pure, derived-every-render values that now
  // own every "how much guidance is shown" decision.
  //
  // Feature 3 Step 6 — see LetterWritingScreen.js's identical block for the
  // full rationale: normal mode derives supportLevel from the adaptive
  // sequence; collection mode is completely untouched (spec §17).
  const recommendedStartSupport = resolveRecommendedStartSupport({ recommendation, currentLetter: letter });
  const supportLevel = resolveSessionSupportLevel({ attempt, collectionMode, recommendedStartSupport });
  const instructionKey = masteredSequenceReady && letterObj
    ? SUPPORT_INSTRUCTION_KEY[supportLevel]
    : null;
  const {
    replay: replayInstruction,
    instructionPlaying,
    canWrite,
    requestTargetSpeech,
  } = useInstructionAudioState(instructionKey, {
    autoPlay: Boolean(instructionKey),
    autoPlayToken: `${letter}:${attempt}:${supportLevel}`,
    fallbackText: instructionForSupport(supportLevel).en,
  });
  const canWriteRef = useRef(false);
  canWriteRef.current = canWrite;
  const targetSpokenAttemptRef = useRef(false);
  useEffect(() => { targetSpokenAttemptRef.current = false; }, [letter, attempt]);
  const supportPresentation = getSupportPresentation({ supportLevel, attempt, collectionMode });

  // Feature 6 Step 4 — see LetterWritingScreen.js's identical block for the
  // full rationale (recommended vs. actual-rendered vs. effective speed).
  const recommendedDemoSpeedLevel = resolveRecommendedDemoSpeedLevel({
    recommendation: demoSpeedRecommendation, currentLetter: letter, currentCaseType: caseType,
  });
  const actualDemoSpeedLevel = resolveActualDemoSpeedLevel({
    recommendedSpeedLevel: recommendedDemoSpeedLevel,
    supportLevel,
    showAnimatedTracer: supportPresentation?.showAnimatedTracer ?? false,
    reduceMotion,
    collectionMode,
  });
  const effectiveDemoSpeedLevel = actualDemoSpeedLevel ?? DEMO_SPEED_LEVELS.STANDARD;

  const templateStrokes = useMemo(
    () => normalizeStrokes(LETTER_PATHS[letter] ?? []),
    [letter]
  );
  const activeGuideStroke = Math.min(allPaths.length, templateStrokes.length - 1);
  const activeGuideStart = templateStrokes[activeGuideStroke]?.[0]
    ?? START_POS[letter]
    ?? DEFAULT_START;
  const activeDirectionHint = getStrokeDirectionHint(
    templateStrokes[activeGuideStroke],
    ANGULAR_LETTERS.has(letter)
  );

  // Same values as the pre-refactor inline ternary (attempt 1→0.14,
  // attempt 2→0.26, normal-mode attempt 3→0, collection-mode attempt 3→0.26).
  const guideOpacity  = supportPresentation?.guideOpacity ?? 0;
  const badge         = SUPPORT_BADGE[supportLevel];

  // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical block.
  useEffect(() => {
    if (collectionMode) return;
    notifyLiveSessionUpdate(buildProgressPatch({
      currentItem: letter, caseType, attemptNumber: attempt, supportLevel,
    }));
  }, [letter, caseType, attempt, supportLevel, collectionMode, notifyLiveSessionUpdate]);

  const tracerXInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange: tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.xRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  const tracerYInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange: tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.yRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Always the CURRENT letter — the same value the visible target renders
  // from. The optional argument exists for callers that already hold it; it
  // is never a cached or route-supplied character.
  const playLetterSound = useCallback((l = letter) => {
    const spoken = String(l ?? letter ?? '');
    if (!spoken) return;
    Speech.stop();
    Speech.speak(spoken.toUpperCase(), ukLetterSpeechOptions());
  }, [letter]);

  const playLetterSoundRef = useRef(playLetterSound);
  playLetterSoundRef.current = playLetterSound;
  const replaySupportInstruction = useCallback(() => {
    Speech.stop();
    return replayInstruction();
  }, [replayInstruction]);

  // Announce the letter the child can actually SEE.
  //
  // `sequence` is `runtimeSequence ?? effectiveSequence ?? baseSequence`, and
  // effectiveSequence is null until the mastered-letter filter resolves — so
  // on mount `letter` is the first UNFILTERED letter, not the one that will
  // be presented. The render is already gated on masteredSequenceReady, but
  // an effect is not: this spoke the pre-filter letter ("L") and only then
  // the real one ("O"). Gating the announcement on the same flag the render
  // uses means the audio can never name a letter that was never shown.
  // Feature 3 Step 6 — adaptive support recommendation fetch. See
  // LetterWritingScreen.js's identical block for the full rationale: once
  // per letter, skipped entirely in collection mode, never blocks
  // interaction, never retroactively changes support mid-attempt.
  useEffect(() => {
    if (collectionMode) return;
    let cancelled = false;

    fetchRecommendedStartSupport({ studentId: student.sid, letter, caseType }).then((startSupport) => {
      if (cancelled) return;
      if (shouldApplyRecommendation({ currentAttempt: attemptRef.current, hasDrawnCurrentAttempt: hasDrawnRef.current })) {
        setRecommendation({ letter, startSupport });
      }
    });

    return () => { cancelled = true; };
  }, [letter, caseType, collectionMode, student.sid]);

  // Feature 6 Step 4 — adaptive demo-speed recommendation fetch. See
  // LetterWritingScreen.js's identical block for the full rationale: once
  // per letter, completely independent of the Feature 3 fetch effect just
  // above, skipped entirely in collection mode (spec §13, HARD REQUIREMENT).
  useEffect(() => {
    if (collectionMode) return;
    let cancelled = false;

    fetchDemoSpeedRecommendation({ studentId: student.sid, letter, caseType }).then((response) => {
      if (shouldApplyDemoSpeedRecommendation({
        responseLetter: response.letter, responseCaseType: response.caseType,
        currentLetter: letter, currentCaseType: caseType,
        currentAttempt: attemptRef.current, hasDrawn: hasDrawnRef.current,
        collectionMode, cancelled,
      })) {
        setDemoSpeedRecommendation({ letter: response.letter, caseType: response.caseType, speedLevel: response.recommendedSpeedLevel });
      }
    });

    return () => { cancelled = true; };
  }, [letter, caseType, collectionMode, student.sid]);

  // Feature 4 Step 5 — adaptive pre-writing recommendation fetch + detour.
  // See LetterWritingScreen.js's identical block for the full rationale:
  // once per letter, completely independent of the Feature 3 fetch effect
  // just above (spec §26), skipped entirely in collection mode (spec §9/§25),
  // never stored in React state (only ever drives a one-time navigation
  // side effect, never a render decision).
  useEffect(() => {
    if (collectionMode) return;
    let cancelled = false;

    fetchPreWritingRecommendation({ studentId: student.sid, letter, caseType }).then((recommendation) => {
      if (cancelled) return;

      const activity = recommendation.activityId
        ? getPreWritingActivityById(recommendation.activityId)
        : null;

      const alreadyHandled = hasWarmupHandled({
        studentId: student.sid, caseType, letter, interactionId, collectionMode,
      });

      const decision = resolveAdaptivePreWritingDetour({
        recommendation: { ...recommendation, interactionId },
        activity,
        alreadyHandled,
        collectionMode,
        currentLetter: letter,
        currentCaseType: caseType,
        currentInteractionId: interactionId,
        currentAttempt: attemptRef.current,
        hasDrawn: hasDrawnRef.current,
        // The first letter of this sequence starts by writing. Every OTHER
        // route to index 0 (a category transition's slice(idx + 1), a
        // remediation or adaptive detour's slice(idx)) has already marked
        // that letter handled, so those were standing down here regardless —
        // an unmarked index 0 is a fresh session entry and nothing else.
        isSessionEntryLetter: letterIdx === 0,
      });

      if (!decision.shouldNavigate) return;

      markWarmupHandled({
        studentId: student.sid, caseType, letter, interactionId,
        reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
      });

      navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
        student, theme, activities: [activity], // exactly one activity (spec §17)
        targetLetter: letter, targetCaseType: caseType, interactionId,
        reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
        nextRoute: 'UppercaseWriting',
        // sequence.slice(letterIdx) — NOT letterIdx + 1 — so the SAME target
        // letter is still active[0] on return (spec §13/§14). No `caseType`
        // key here, matching this screen's own category-boundary nextParams
        // convention just below (caseType is hardcoded to 'uppercase' by
        // this component, never read from route params).
        nextParams: { student, theme, letterSequence: sequence.slice(letterIdx) },
      }));
    });

    return () => { cancelled = true; };
  }, [letter, caseType, collectionMode, student.sid, interactionId, letterIdx, sequence, navigation, student, theme]);


  // ── One-time category demonstration (utils/demoPolicy.js) ────────────────
  // The FIRST time this child meets a motor category — uppercase straight,
  // uppercase curved, uppercase mixed — they are taken to a full-screen
  // "watch first" demonstration of the real target letter before Attempt 1.
  //
  // This is NOT Attempt 1, and it does not replace it. Attempt 1 keeps its
  // HIGH support and its own on-canvas tracer exactly as before; the demo
  // adds the one thing that tracer cannot, a moment where the child is
  // asked to watch and there is nothing to draw on. Attempts 1/2/3 and
  // everything downstream of them are untouched.
  //
  // Once per category, ever — not per letter and not per session. Lowercase
  // and uppercase categories are independent keys, so a child who has done
  // lowercase curved still gets the uppercase curved demonstration.
  const categoryDemoKey = makeLetterCategoryDemoKey({
    caseType, category: letterObj?.category,
  });

  useDemoDetour({
    studentId: student?.sid,
    demoKey: categoryDemoKey,
    // Before the child has done anything: attempt 1, nothing drawn. A demo
    // must never interrupt work in progress.
    enabled: attempt === 1 && !hasDrawn,
    collectionMode,
    navigate: () => {
      navigation.navigate('HandwritingDemo', {
        student, theme,
        demoKey: categoryDemoKey,
        // THIS letter, from the same reference waypoints Attempt 1 traces —
        // never a stand-in letter.
        letter, caseType,
        nextRoute: 'UppercaseWriting',
        // slice(letterIdx), not letterIdx + 1: the same target letter must
        // still be active[0] on return, exactly as the adaptive pre-writing
        // detour above does it.
        nextParams: {
          student, theme, caseType,
          letterSequence: sequence.slice(letterIdx),
          collectionMode, collectionSessionId, interactionId,
        },
      });
    },
  });


  // ── DEV-ONLY practice-cycle diagnostics ──────────────────────────────────
  // Development builds only (`__DEV__`), console only, never rendered. Added
  // because a physical test could not tell WHY a letter advanced: the answer
  // needs the mode flags, the server's own verdict and the cycle count in one
  // place. Reads state, changes none.
  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    if (attempt !== 1 || hasDrawn) return;
    const used = getCyclesUsed({ studentId: student?.sid, letter, caseType, interactionId });
    console.log('[PRACTICE_CYCLE_STATUS]', JSON.stringify({
      letter, case_type: caseType, category: letterObj?.category ?? null,
      cycles_used_today: used,
      cycles_remaining_today: Math.max(0, MAX_CYCLES_PER_LETTER_PER_DATE - used),
      mode: collectionMode ? (writingCheckId ? 'writing_check' : 'research_collection') : 'normal',
      collectionMode, writingCheckId, collectionSessionId,
      interactionId, letterIdx, sequence_length: sequence.length,
    }));
  }, [letter, caseType, attempt, hasDrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tracer dot animation for HIGH support (originally "Attempt 1").
  useEffect(() => {
    const rawPath = LETTER_PATHS[letter];
    if (reduceMotion || !supportPresentation?.showAnimatedTracer || hasDrawn || !rawPath || rawPath.length < 1) {
      setTracerVisible(false);
      return;
    }

    const strokes = normalizeStrokes(rawPath);
    const isAngular = ANGULAR_LETTERS.has(letter);
    const sampledStrokes = strokes.map(stroke => {
      if (stroke?.length === 1) {
        const point = {
          x: aspectX(stroke[0].fx) * CANVAS_W,
          y: stroke[0].fy * CANVAS_H,
        };
        return { points: [point, point], totalLength: 0 };
      }
      return isAngular
        ? sampleStraightStroke(stroke, 60, CANVAS_W, CANVAS_H)
        : sampleSmoothPath(stroke, 60, CANVAS_W, CANVAS_H);
    });

    const inputRange = [];
    const xRange = [];
    const yRange = [];
    const strokeBounds = [];
    let offset = 0;
    for (const { points } of sampledStrokes) {
      if (points.length === 0) continue;
      const start = offset;
      for (const point of points) {
        inputRange.push(offset);
        xRange.push(point.x);
        yRange.push(point.y);
        offset++;
      }
      strokeBounds.push({ start, end: offset - 1 });
    }

    if (inputRange.length < 2) { setTracerVisible(false); return; }

    setTracerKeyframes({ inputRange, xRange, yRange });
    tracerProgress.setValue(0);
    setTracerVisible(true);

    // Rebuilt fresh for every pass, so no animation object carries state
    // between passes. Stroke order is the canonical order, played forward,
    // every time: nothing here reverses waypoints, the path, or the bounds.
    const buildForwardSequence = () => {
      const strokeAnimations = [];
      for (let index = 0; index < strokeBounds.length; index++) {
        if (index > 0) {
          strokeAnimations.push(Animated.delay(400));
          strokeAnimations.push(Animated.timing(tracerProgress, {
            toValue: strokeBounds[index].start,
            duration: 1,
            useNativeDriver: true,
          }));
        }
        // Feature 6 Step 4 — was `Math.max(600, Math.round(len / TRACER_PX_PER_MS))`.
        // See LetterWritingScreen.js's identical block for the full rationale.
        strokeAnimations.push(Animated.timing(tracerProgress, {
          toValue: strokeBounds[index].end,
          duration: getStrokeDurationForLevel(sampledStrokes[index].totalLength, effectiveDemoSpeedLevel),
          useNativeDriver: true,
        }));
      }
      return Animated.sequence([Animated.delay(350), ...strokeAnimations]);
    };

    // Forward-only: setValue(0) -> 0..1 -> idle pause -> setValue(0) -> 0..1.
    // The trailing Animated.delay(700) that used to pad the loop is now the
    // controller's idle gap. See guideReplayCycle.js for why Animated.loop's
    // resetBeforeIteration never reached tracerProgress and played it backward.
    const cycle = startGuideReplayCycle({
      progress: tracerProgress,
      buildForwardSequence,
    });
    stopGuideRef.current = () => cycle.stop();

    return () => { setTracerVisible(false); cycle.stop(); stopGuideRef.current = null; };
    // supportPresentation.showAnimatedTracer is derived purely from
    // attempt + collectionMode (+ recommendedStartSupport in normal mode,
    // Feature 3 Step 6) — depending on those primitives instead of the
    // whole (non-memoized) supportPresentation object keeps this effect's
    // re-run triggers correct without an infinite loop.
    // effectiveDemoSpeedLevel (Feature 6 Step 4) — see LetterWritingScreen.js's
    // identical block for the full rationale.
  }, [attempt, collectionMode, effectiveDemoSpeedLevel, hasDrawn, letter, reduceMotion, recommendedStartSupport, tracerProgress]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canWriteRef.current,
      onMoveShouldSetPanResponder:  () => canWriteRef.current,
      onPanResponderGrant: (evt) => {
        if (!canWriteRef.current) return;
        stopGuideRef.current?.();  // first touch cancels the idle replay
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        setAttemptFeedback(null);
        const { x: locationX, y: locationY } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_W, height: CANVAS_H },
          inset: CANVAS_BORDER_WIDTH,
        });
        const now = Date.now();
        startTimeRef.current = now;
        strokeIdCounter.current += 1;  // ML: new stroke begins
        setCurrentPath([{ x: locationX, y: locationY, t: 0, tAbs: now, stroke_id: strokeIdCounter.current }]);
        if (!targetSpokenAttemptRef.current) {
          targetSpokenAttemptRef.current = true;
          requestTargetSpeech(() => playLetterSoundRef.current?.());
        }
      },
      onPanResponderMove: (evt) => {
        const { x: locationX, y: locationY } = mapTouchToCanvas({
          pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
          origin: canvasOriginRef.current,
          logical: { width: CANVAS_W, height: CANVAS_H },
          inset: CANVAS_BORDER_WIDTH,
        });
        const now = Date.now();
        setCurrentPath(prev => {
          const last = prev[prev.length - 1];
          // Border-touch bug fix — see touchPointSanitize.js.
          if (last && isImplausibleJump(last, { x: locationX, y: locationY }, CANVAS_W, CANVAS_H)) return prev;
          if (last && Math.hypot(locationX - last.x, locationY - last.y) < 1.5) return prev;
          return [...prev, {
            x: locationX, y: locationY, t: now - startTimeRef.current, tAbs: now, stroke_id: strokeIdCounter.current,
          }];
        });
      },
      onPanResponderRelease: () => {
        notifyStrokeEnd(); // FR-13 — stroke finished; the break prompt may now be shown if eligible
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setHasDrawn(true);
          }
          return [];
        });
      },
      onPanResponderTerminate: () => {
        notifyStrokeEnd(); // FR-13 — same as release: an OS-interrupted gesture must not leave isWriting stuck true
        setCurrentPath(prev => {
          if (prev.length > 2) {
            const updated = [...allPathsRef.current, prev];
            allPathsRef.current = updated;
            setAllPaths(updated);
            setHasDrawn(true);
          }
          return [];
        });
      },
    })
  ).current;

  const resetCanvas = useCallback(() => {
    setAllPaths([]);
    allPathsRef.current = [];
    setCurrentPath([]);
    setHasDrawn(false);
    strokeIdCounter.current = 0;  // ML: stroke IDs restart from 1 on the next attempt
  }, []);

  const handleClear = useCallback(() => {
    setAttemptFeedback(null);
    resetCanvas();
  }, [resetCanvas]);

  const showCelebrationFor = useCallback((data, nextCategory, isAllDone) => {
    setCelebration({ data, nextCategory, isAllDone });
    celebScale.setValue(reduceMotion ? 1 : 0.5);
    celebOpacity.setValue(0);
    if (reduceMotion) {
      Animated.timing(celebOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.parallel([
      Animated.spring(celebScale,   { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(celebOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [celebOpacity, celebScale, reduceMotion]);

  const handleNext = useCallback(async () => {
    // Feature 5 Step 3 — see LetterWritingScreen.js's identical block for
    // the full rationale.
    cycleTokenRef.current += 1;
    const myCycleToken = cycleTokenRef.current;

    // ── Advance past this letter ───────────────────────────────────────────
    // Extracted verbatim from this function's own tail so BOTH the "letter
    // mastered" path and the new "two cycles used" path move on the same way:
    // same category celebrations, same end-of-run celebration, same index
    // step. A letter set aside after two failed cycles is NOT mastered - only
    // the unchanged pass logic sets mastered_at - it simply stops being
    // presented for the rest of this practice date.
    const advancePastLetter = () => {
      if (isLastLetter) {
        showCelebrationFor(ALL_DONE_CELEBRATION, null, true);
        resetCanvas();
        return;
      }

      const currentCat = sequence[letterIdx]?.category;
      const nextCat    = sequence[letterIdx + 1]?.category;

      if (currentCat !== nextCat) {
        showCelebrationFor(
          CATEGORY_CELEBRATION[currentCat] ?? CATEGORY_CELEBRATION.mixed,
          nextCat,
          false
        );
        resetCanvas();
      } else {
        setLetterIdx(i => i + 1);
        setAttempt(1);
        resetCanvas();
      }
    };

    /**
     * One 3-attempt cycle just failed. Decides between the immediate retry
     * (cycle 2) and moving on (the ceiling).
     *
     * `serverCyclesToday` is the backend's own count for this practice date,
     * returned on the blocked response. It is what stops a restarted app from
     * buying a third cycle: the guard seeds from it, and the two combine by
     * maximum, never by trusting either alone.
     */
      /** What handleFailedCycle is about to decide - for the log only. */
      const recordedCyclesWillReachCap = (serverCyclesToday) => {
        const local = getCyclesUsed({ studentId: student?.sid, letter, caseType, interactionId }) + 1;
        const known = Number.isInteger(serverCyclesToday) && serverCyclesToday > local
          ? serverCyclesToday : local;
        return known >= MAX_CYCLES_PER_LETTER_PER_DATE;
      };

      // DEV-ONLY: the single line that explains WHY this cycle ended the way
      // it did. Never rendered, never shipped to a child.
      const logCycleOutcome = (branch, res) => {
        if (typeof __DEV__ === 'undefined' || !__DEV__) return;
        console.log('[NORMAL_LETTER_CYCLE]', JSON.stringify({
          student_id: student?.sid, letter, case_type: caseType,
          category: letterObj?.category ?? null,
          mode: collectionMode ? (writingCheckId ? 'writing_check' : 'research_collection') : 'normal',
          collectionMode, writingCheckId, collectionSessionId,
          interactionId,
          client_attempt_scores: attemptScoresRef.current,
          attempts_in_payload: sessionAttemptsRef.current.length,
          attempt_numbers: sessionAttemptsRef.current.map(a => a.attempt_number),
          support_levels: sessionAttemptsRef.current.map(a => a.support_level),
          // The server's own verdict. bestScore is computed BACKEND-side from
          // the captured strokes; client scores above are diagnostic only.
          server_completed: res?.completed ?? null,
          server_bestScore: res?.bestScore ?? null,
          server_threshold: res?.threshold ?? null,
          server_thresholdSource: res?.thresholdSource ?? null,
          // bestScore null means EVERY attempt failed the coverage/geometry
          // check - not that the writing scored low.
          coverage_rejected_all: res?.completed === false && res?.bestScore == null,
          cycle_usage: res?.cycle_usage ?? null,
          branch,
          letterIdx, next_letterIdx: branch === 'FAILED_START_CYCLE_2' ? letterIdx : letterIdx + 1,
        }));
      };

    /**
     * A TECHNICAL capture fault on attempt 3 — the device recorded no strokes
     * (or no features), so the server had nothing to judge and explicitly
     * told us `cycle_consumed: false`.
     *
     * This is NOT a handwriting outcome, so none of the failed-cycle
     * machinery runs: no cycle is spent, no spaced repetition is scheduled,
     * no homework is created, the child does not advance, and they are not
     * told they need more practice. They simply retry ATTEMPT 3 of the SAME
     * cycle — attempts 1 and 2 stay exactly as captured, because a device
     * fault must never cost a child their valid guided practice.
     *
     * Only the failed attempt-3 record is dropped from the payload, so the
     * retry resends [attempt1, attempt2, newAttempt3].
     */
    const handleCaptureIncomplete = (retrySessionKey) => {
      // The server-issued key for THIS partial cycle. Sending it back on the
      // retry makes the backend complete the same session instead of opening
      // a second one — which is what stopped attempts 1 and 2 being stored
      // twice in the research data. Purely a courier: the server re-validates
      // it (student, letter, case, practice date, still unfinished) before
      // honouring it, and ignores it if anything fails.
      retrySessionKeyRef.current = retrySessionKey ?? null;

      // Drop ONLY the attempt-3 record this cycle just appended. The two
      // guided attempts are kept verbatim.
      sessionAttemptsRef.current = sessionAttemptsRef.current.slice(0, MASTERY_ATTEMPT_INDEX);
      attemptScoresRef.current   = attemptScoresRef.current.slice(0, MASTERY_ATTEMPT_INDEX);

      if (__DEV__) {
        console.log('[NORMAL_LETTER_CYCLE] capture incomplete — retrying attempt 3 only', {
          letter, caseType,
          attempts_kept: sessionAttemptsRef.current.length,
          case_label: 'uppercase',
        });
      }

      // Neutral, child-friendly, and deliberately says nothing about how
      // they wrote — because nothing about their writing was measured.
      show('We couldn’t record that attempt. Please try once more.', 'info');

      // Stay on THIS cycle, at attempt 3. Never setAttempt(1).
      setAttempt(MASTERY_ATTEMPT_NUMBER);
      resetCanvas();
    };

    const handleFailedCycle = (serverCyclesToday) => {
      attemptScoresRef.current   = [];
      sessionAttemptsRef.current = [];
      // This cycle is over (evaluated). The retry key belonged to it and must
      // never leak into the next one.
      retrySessionKeyRef.current = null;

      const used = recordCycleCompleted({
        studentId: student.sid, letter, caseType, interactionId, serverCyclesToday,
      });

      if (used >= MAX_CYCLES_PER_LETTER_PER_DATE) {
        // The ceiling. No cycle 3 today, by immediate retry or any other
        // route - Feature 5's spaced repetition is blocked by the same rule
        // on the server side, so it cannot reinsert this letter either.
        if (__DEV__) {
          console.log('[cycle cap] letter set aside for this practice date', { letter, caseType, used });
        }
        advancePastLetter();
        return;
      }

      // Two consumed failed cycles on this exact letter — a short motor
      // warm-up built from the letter's OWN strokeTypes, then cycle 3.
      //
      // This is NOT a cycle and NOT an attempt. Nothing below it touches the
      // cycle counter (already incremented by recordCycleCompleted above),
      // writes a LetterAttempt, or reaches mastery, Motor Score or the
      // threshold. Cycle 3 begins at attempt 1 exactly as cycle 2 did.
      //
      // Reached only from the evaluated-failure path: a capture fault returns
      // via handleCaptureIncomplete long before this, so a device fault can
      // never trigger it.
      if (used === MAX_CYCLES_PER_LETTER_PER_DATE - 1 && !collectionMode) {
        const remediationActivities = buildLetterRemediationActivities(letter);
        const alreadyRemediated = hasRemediationHandled({
          studentId: student.sid, caseType, letter, interactionId,
          cycleNumber: used + 1, collectionMode,
        });

        if (remediationActivities.length > 0 && !alreadyRemediated) {
          // Mark on OPEN, so a navigation replace or a re-render cannot
          // replay it — same discipline the other two triggers use.
          markRemediationHandled({
            studentId: student.sid, caseType, letter, interactionId,
            cycleNumber: used + 1,
          });
          navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
            student, theme, activities: remediationActivities,
            targetLetter: letter, targetCaseType: caseType, interactionId,
            reason: PRE_WRITING_REASON.CYCLE_3_REMEDIATION,
            nextRoute: 'UppercaseWriting',
            // slice(letterIdx) — NOT letterIdx + 1 — so the SAME letter is
            // still active[0] and cycle 3 is for the letter that failed.
            nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx), interactionId },
          }));
          return;
        }
      }

      // Cycle 2, immediately, on the same letter - attempt numbering restarts
      // at 1, exactly as cycle 1 did.
      setAttempt(1);
      resetCanvas();
    };


    const scheduleAdaptiveRepetitionIfEligible = () => {
      if (collectionMode) return;

      const failedLetter    = letter;
      const failedCaseType  = caseType;
      const failedLetterObj = letterObj;
      const failedLetterIdx = letterIdx;
      const failedSequence  = sequence;

      const alreadyUsed = getAdaptiveRepetitionsUsed({
        studentId: student.sid, caseType: failedCaseType, letter: failedLetter, interactionId,
      });

      fetchRepetitionRecommendation({
        studentId: student.sid, letter: failedLetter, caseType: failedCaseType,
        adaptiveRepetitionsUsed: alreadyUsed,
      }).then((recommendation) => {
        if (myCycleToken !== cycleTokenRef.current) return;
        if (recommendation.letter !== failedLetter || recommendation.caseType !== failedCaseType) return;
        if (!recommendation.shouldRepeat) return;

        const { sequence: nextSequence, inserted } = insertSpacedRepetition({
          sequence: failedSequence, currentIndex: failedLetterIdx, targetLetterEntry: failedLetterObj, interactionId,
        });
        if (!inserted) return;

        setRuntimeSequence(nextSequence);
        incrementAdaptiveRepetitionsUsed({
          studentId: student.sid, caseType: failedCaseType, letter: failedLetter, interactionId,
        });
      });
    };

    const features = calculateDrawingFeatures(allPathsRef.current);

    // DTW trajectory accuracy — same bezier template as the tracer animation.
    // Multi-stroke templates use per-stroke bipartite matching so the child's
    // stroke order doesn't affect the score.
    const templatePath = LETTER_PATHS[letter];
    const dtwResult = templatePath
      ? computeMultiStrokeDTW(templatePath, allPathsRef.current, CANVAS_W, CANVAS_H)
      : { normalizedDistance: null, strokeOrderMeta: null };
    features.dtw_distance = dtwResult.normalizedDistance;
    features.stroke_order_meta = dtwResult.strokeOrderMeta;

    // ML: snapshot before resetCanvas() wipes allPathsRef
    // ML: snapshot before resetCanvas() wipes allPathsRef.
    // Feature 3 Step 3: support_level is the exact value this render used
    // for THIS attempt (supportLevel, derived above via
    // resolveSessionSupportLevel — never recomputed differently here).
    // Feature 6 Step 5: demo_speed_level is `actualDemoSpeedLevel` — see
    // LetterWritingScreen.js's identical block for the full rationale.
    sessionAttemptsRef.current = [
      ...sessionAttemptsRef.current,
      buildSessionAttemptRecord({
        attemptNumber: attempt,
        supportLevel,
        demoSpeedLevel: actualDemoSpeedLevel,
        features,
        strokes: allPathsRef.current.map((pts, i) => ({
          stroke_id: i + 1,
          points:    pts,   // each point: {x, y, t, tAbs, stroke_id}
        })),
      }),
    ];

    const attemptScore = Math.round(featuresToScore({ smoothness: features.smoothness, dtw_distance: features.dtw_distance }));
    attemptScoresRef.current = [...attemptScoresRef.current, attemptScore];
    const attemptPassed = didPassAttempt(features, allPathsRef.current);
    setAttemptFeedback({ passed: attemptPassed, attempt, supportLevel });

    try {
      await Promise.all([
        // Data-collection isolation (final integration audit) — this local
        // AsyncStorage record is what TeacherReportScreen's normal progress
        // section (completedLetters / letterProgressMap) later reads back.
        // A collection-mode attempt must never contribute to it — matches
        // every other Feature 3/4/5/6 fetch in this same screen, which
        // already skips entirely under collectionMode.
        collectionMode ? Promise.resolve() : storeLetterProgress(student.sid, letter, {
          attempt,
          deviation:      0,
          pauseCount:     features.pauseCount,
          completionTime: features.completionTime,
          strokeCount:    features.strokeCount,
          smoothness:     features.smoothness,
          dtw_distance:   features.dtw_distance,
        }),
        new Promise(resolve => setTimeout(resolve, ATTEMPT_FEEDBACK_MS)),
      ]);
    } finally {
      setAttemptFeedback(null);
    }

    if (isLastAttempt) {
      const wroteCorrectly = attemptPassed;
      // DTW gate: shape must match the template within the calibrated threshold.
      // dtw_distance != null guard: if no template exists for this letter, do not
      // hard-fail the child — the bounds checks are still enforced.

      if (__DEV__) {
        console.log('[DTW debug]', {
          letter,
          dtw_distance: features.dtw_distance,
          threshold:    DTW_CORRECT_THRESHOLD,
          score:        attemptScore,
          passed:       wroteCorrectly,
        });
        // Developer-only export — full raw/normalized paths for offline
        // inspection. Never sent to the backend, never used for scoring.
        // JSON.stringify (not the raw object) — console.log's default
        // object-inspection depth truncates normalized_child_path (an
        // array of strokes of points, one level deeper than
        // normalized_template_path) to "[Object]"; stringifying bypasses
        // that depth limit entirely.
        console.log('[DTW debug export]', JSON.stringify(buildDtwDebugExport({
          childStrokes:   allPathsRef.current,
          templatePoints: templatePath ? sampleSmoothPath(templatePath, 60, CANVAS_W, CANVAS_H).points : [],
          dtwResult:      dtwResult,
          qualityScore:   attemptScore,
        })));
      }

      try {
        const response = await client.post(ENDPOINTS.LETTER_COMPLETE, {
          student_id:      student.sid,
          letter,
          case_type:       caseType,
          attempt_scores:  attemptScoresRef.current,
          wrote_correctly: wroteCorrectly,
          canvas_width:    CANVAS_W,                    // ML: coordinate space
          canvas_height:   CANVAS_H,                    // ML: coordinate space
          attempts:        sessionAttemptsRef.current,  // ML: per-attempt features + raw strokes
          collection_mode: collectionMode,
          collection_session_id: collectionSessionId,
          protocol_version:      PROTOCOL_VERSION,
          feature_version:       FEATURE_VERSION,
          template_version:      TEMPLATE_VERSION,
          normalization_version: NORMALIZATION_VERSION,
          task_order:            UPPERCASE_TASK_ORDER_OFFSET + letterIdx,
          // Null except immediately after a capture fault — see
          // handleCaptureIncomplete.
          retry_session_key:     retrySessionKeyRef.current,
          ...getDeviceMetadata(),
        });

        // Proposal FR-16, Phase 7B — see LetterWritingScreen.js's identical block.
        if (!collectionMode && attemptScoresRef.current.length > 0) {
          notifyLiveSessionUpdate(buildScorePatch(Math.max(...attemptScoresRef.current)));
        }
        // Coverage-fix audit: see LetterWritingScreen.js's identical change
        // — the server's `completed` result is now the sole signal;
        // wroteCorrectly still drives the cosmetic per-attempt badge but no
        // longer forces a retry the database already recorded as complete.
        if (!collectionMode && response.data.completed === false) {
          // P1 — a technical capture fault is not a failed cycle. The server
          // states this explicitly rather than us inferring it from the cycle
          // count, because "I did not count this" and "my count read failed"
          // must never be confused.
          if (response.data.cycle_consumed === false) {
            handleCaptureIncomplete(response.data.retry_session_key);
            return;
          }
          // Feature 5 Step 3 — see LetterWritingScreen.js's identical block.
          scheduleAdaptiveRepetitionIfEligible();
          logCycleOutcome(
            recordedCyclesWillReachCap(response.data?.cycle_usage?.cycles_today ?? null)
              ? 'FAILED_ADVANCE_AFTER_CYCLE_2' : 'FAILED_START_CYCLE_2',
            response.data,
          );
          handleFailedCycle(response.data?.cycle_usage?.cycles_today ?? null);
          return;
        }
      } catch {
        // network failure — gate only in normal mode
        if (!collectionMode && !wroteCorrectly) {
          // Feature 5 Step 3 — see LetterWritingScreen.js's identical block.
          scheduleAdaptiveRepetitionIfEligible();
          // No server opinion on a network failure - the in-interaction guard
          // is the whole limit here, which is the safe direction.
          logCycleOutcome(
            recordedCyclesWillReachCap(null) ? 'FAILED_ADVANCE_AFTER_CYCLE_2' : 'FAILED_START_CYCLE_2',
            null,
          );
          handleFailedCycle(null);
          return;
        }
      }
      attemptScoresRef.current   = [];
      sessionAttemptsRef.current = [];
    }

    if (!isLastAttempt) {
      setAttempt(a => a + 1);
      resetCanvas();
      return;
    }

    if (isLastLetter) {
      showCelebrationFor(ALL_DONE_CELEBRATION, null, true);
      resetCanvas();
      return;
    }

    const currentCat = sequence[letterIdx]?.category;
    const nextCat    = sequence[letterIdx + 1]?.category;

    if (currentCat !== nextCat) {
      showCelebrationFor(
        CATEGORY_CELEBRATION[currentCat] ?? CATEGORY_CELEBRATION.mixed,
        nextCat,
        false
      );
      resetCanvas();
    } else {
      setLetterIdx(i => i + 1);
      setAttempt(1);
      resetCanvas();
    }
    // supportLevel is a pure derivation of attempt + collectionMode (already
    // both listed below) — included explicitly since handleNext's body now
    // references it directly (Feature 3 Step 3). letterObj/interactionId
    // added for scheduleAdaptiveRepetitionIfEligible() (Feature 5 Step 3).
    // actualDemoSpeedLevel added for the same reason (Feature 6 Step 5) —
    // handleNext's body now reads it directly to build the attempt record.
  }, [attempt, actualDemoSpeedLevel, collectionMode, collectionSessionId, isLastAttempt, isLastLetter, letter, letterIdx,
      letterObj, interactionId, resetCanvas, sequence, show, showCelebrationFor, student.sid, supportLevel]);

  const handleDismissCelebration = useCallback(() => {
    const isAllDone = celebration?.isAllDone;
    setCelebration(null);
    if (isAllDone) {
      if (writingCheckId) {
        // A Writing Check batch is finished - back to the check, which
        // re-reads progress and completes. Never the research
        // data-collection end screen.
        navigation.navigate('WritingCheck', { student, theme });
      } else if (collectionMode) {
        navigation.navigate('DataCollectionDone', { student, theme, collectionSessionId });
      } else {
        navigation.goBack();
      }
    } else if (collectionMode) {
      // Fixed research protocol — always advance in place, never detour
      // through a warm-up. Unchanged from before this branch existed.
      setLetterIdx(i => i + 1);
      setAttempt(1);
    } else {
      // Category boundary mid-session — warm up the new primitive before
      // continuing, same gating LetterPracticeScreen does at session start.
      // A warm-up marks a CHANGE of motor primitive, never simply "a next
      // letter exists". This used to compute the next letter's group alone
      // and warm up before every letter whose group had activities, so a run
      // like l → i → t warmed up three times instead of none.
      const nextLetterObj = sequence[letterIdx + 1];
      const group      = primitiveGroupOnEntering(sequence, letterIdx + 1);
      const activities = group ? selectPreWritingActivities(group) : [];

      if (activities.length > 0) {
        // Feature 4 Step 3 — see LetterWritingScreen.js's identical block.
        markWarmupHandled({
          studentId: student?.sid, caseType, letter: nextLetterObj.letter, interactionId,
          reason: PRE_WRITING_REASON.CATEGORY_TRANSITION,
        });
        navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
          student, theme, activities,
          targetLetter: nextLetterObj.letter, targetCaseType: caseType, interactionId,
          reason: PRE_WRITING_REASON.CATEGORY_TRANSITION,
          nextRoute:  'UppercaseWriting',
          nextParams: { student, theme, letterSequence: sequence.slice(letterIdx + 1) },
        }));
      } else {
        setLetterIdx(i => i + 1);
        setAttempt(1);
      }
    }
  }, [celebration, collectionMode, collectionSessionId, navigation, student, theme, sequence, letterIdx, interactionId, caseType]);

  // Feature 11B Phase 5 — blank gate until the mastery-filtered sequence
  // is known — see LetterWritingScreen.js's identical gate for the
  // rationale.
  if (!masteredSequenceReady) {
    return <SafeAreaView style={styles.safe} />;
  }

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={requestBack}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={theme.headingText} />
          </TouchableOpacity>

          <Text style={[styles.counterText, { color: theme.headingText }]}>
            {letterIdx + 1} / {sequence.length}
          </Text>

          <View style={styles.attemptDots}>
            {[1, 2, 3].map(n => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n < attempt   && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { backgroundColor: 'transparent', borderColor: theme.button },
                  n > attempt   && { backgroundColor: 'transparent', borderColor: theme.button + '40' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main area: letter card LEFT | content RIGHT.
            Rendered by the SHARED LetterWritingStage so the "watch first"
            demonstration and this practice screen are the same layout from
            the same file, never two copies that can drift apart. */}
        <LetterWritingStage
          mode="practice"
          letter={letter}
          theme={theme}
          rawPath={LETTER_PATHS[letter]}
          isAngular={ANGULAR_LETTERS.has(letter)}
          guideOpacity={guideOpacity}
          supportPresentation={supportPresentation}
          activeGuideStart={activeGuideStart}
          activeGuideStroke={activeGuideStroke}
          activeDirectionHint={activeDirectionHint}
          allPaths={allPaths}
          currentPath={currentPath}
          hasDrawn={hasDrawn}
          tracerVisible={tracerVisible}
          tracerXInterp={tracerXInterp}
          tracerYInterp={tracerYInterp}
          badge={badge}
          instruction={instructionForSupport(supportLevel)}
          onPlayInstruction={replaySupportInstruction}
          onPlaySound={instructionPlaying ? undefined : () => playLetterSound()}
          canvasRef={canvasRef}
          onCanvasLayout={measureCanvasOrigin}
          panHandlers={panResponder.panHandlers}
          canvasPointerEvents={attemptFeedback || !canWrite ? 'none' : 'auto'}
        />

        {/* Feedback pill */}
        {/* Action buttons */}
        <View style={styles.buttonsRow}>
          {canClearCanvas && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
              onPress={handleClear}
              disabled={Boolean(attemptFeedback)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.headingText} />
              <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
            </TouchableOpacity>
          )}

          {hasDrawn && (
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: theme.button },
                attemptFeedback && { opacity: 0.55 },
              ]}
              onPress={handleNext}
              disabled={Boolean(attemptFeedback)}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextText, { color: theme.buttonText }]}>
                {isLastAttempt
                  ? (isLastLetter ? 'Finish ✓' : 'Next Letter →')
                  : `Attempt ${attempt + 1} →`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom attempt dots */}
        <View style={styles.bottomDots}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n < attempt   && { backgroundColor: theme.button, borderColor: theme.button },
                n === attempt && { borderColor: theme.button },
                n > attempt   && { borderColor: theme.button + '40' },
              ]}
            />
          ))}
        </View>

        {attemptFeedback && (
          <AttemptAvatarFeedback
            avatarKey={student?.avatar_key}
            passed={attemptFeedback.passed}
            attempt={attemptFeedback.attempt}
            supportLevel={attemptFeedback.supportLevel}
            theme={theme}
          />
        )}

        {/* Celebration overlay */}
        {celebration && (
          <View style={styles.celebOverlay}>
            <LinearGradient
              colors={theme.backgroundGradient}
              style={styles.celebGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Animated.View
                style={[styles.celebCard, {
                  opacity:   celebOpacity,
                  transform: [{ scale: celebScale }],
                }]}
              >
                <View style={[styles.celebIconWrap, { backgroundColor: celebration.data.color + '18' }]}>
                  <Ionicons name={celebration.data.icon} size={52} color={celebration.data.color} />
                </View>
                <Text style={[styles.celebTitle, { color: celebration.data.color }]}>
                  {celebration.data.title}
                </Text>
                <Text style={styles.celebMessage}>{celebration.data.message}</Text>

                {!celebration.isAllDone && celebration.nextCategory && (
                  <View style={[styles.celebNextBadge, { backgroundColor: celebration.data.color + '12', borderColor: celebration.data.color + '30' }]}>
                    <Text style={styles.celebNextLabel}>Up next: </Text>
                    <Text style={[styles.celebNextValue, { color: celebration.data.color }]}>
                      {NEXT_CATEGORY_LABEL[celebration.nextCategory]}
                    </Text>
                  </View>
                )}

                <View style={styles.celebStars}>
                  {[1, 2, 3].map(i => (
                    <Ionicons key={i} name="star" size={30} color="#FFCA28" />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.celebBtn, { backgroundColor: theme.button }]}
                  onPress={handleDismissCelebration}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.celebBtnText, { color: theme.buttonText }]}>
                    {celebration.isAllDone ? 'All done!' : 'Keep going!'}
                  </Text>
                  <Ionicons
                    name={celebration.isAllDone ? 'checkmark-circle-outline' : 'arrow-forward'}
                    size={18}
                    color={theme.buttonText}
                  />
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>
          </View>
        )}

        {!collectionMode && (
          <BreakPromptModal navigation={navigation} student={student} theme={theme} />
        )}

      </SafeAreaView>

      {/* Parent gate for the back button above. Rendered once, at the
          end of the tree, so it overlays the whole screen. */}
      {gateModal}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  attemptDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },

  feedbackBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },

  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },

  buttonsRow: {
    // Reserved BEFORE anything is in it. Clear appears on the first drawn
    // point and Next when the finger lifts; without this the row grew twice
    // mid-stroke and `mainRow` (flex: 1, centred) re-centred the canvas
    // upward under the child's finger. See constants/writingActionRow.js.
    minHeight: actionRowMinHeight({
      // Clear is the taller child: its 1.5px border outweighs Next's
      // extra 1px of padding.
      maxButtonPaddingVertical: 12, maxButtonBorderWidth: 1.5, rowPaddingVertical: 6,
    }),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAD,
    paddingVertical: 6,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  clearText: { fontSize: 14, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },
  nextBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: { fontSize: 14, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },

  celebOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
  },
  celebGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  celebCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  celebIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  celebTitle:     { fontSize: 26, fontWeight: '900', fontFamily: 'Nunito_900Black', textAlign: 'center', marginBottom: 12 },
  celebMessage:   { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebNextBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
  },
  celebNextLabel: { fontSize: 13, color: '#777777' },
  celebNextValue: { fontSize: 13, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
  celebStars:     { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 40, paddingVertical: 14, borderRadius: 50, width: '100%',
  },
  celebBtnText: { fontSize: 17, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
});
