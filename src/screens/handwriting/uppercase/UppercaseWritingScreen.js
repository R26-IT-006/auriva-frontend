import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Polygon, Path, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';
import { storeLetterProgress } from '../../../utils/storage';
import { getAllLetters } from '../../../constants/letterCategories';
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
import { getLetterPrimitiveGroup, selectPreWritingActivities } from '../../../constants/preWritingActivities';

// Shapes occupy 0-5, lowercase letters occupy 6-15 — uppercase continues from 16.
const UPPERCASE_TASK_ORDER_OFFSET = 16;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

const COL_L            = Math.round(SCREEN_W * 0.43);
const LETTER_CARD_SIZE = COL_L - 8;
const CANVAS_W         = SCREEN_W - COL_L - PAD * 2;
const CANVAS_H         = Math.round(SCREEN_H * 0.50);

const ASPECT  = CANVAS_W / CANVAS_H;
const aspectX = (fx) => 0.5 + (fx - 0.5) / ASPECT;

// 4-line handwriting ruling — evenly spaced (0.28 gap), 0.08 margins
const LINE_1 = Math.round(CANVAS_H * 0.08);
const LINE_2 = Math.round(CANVAS_H * 0.36);
const LINE_3 = Math.round(CANVAS_H * 0.64);
const LINE_4 = Math.round(CANVAS_H * 0.92);



const ATTEMPT_BADGE = {
  1: { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },
  2: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },
  3: { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },
};

const ATTEMPT_TITLES = {
  1: 'Attempt 1 · Watch & Trace',
  2: 'Attempt 2 · Follow the Guide',
  3: 'Attempt 3 · Write Freely',
};

const ATTEMPT_HINTS = {
  1: 'Watch the dot — then draw it yourself!',
  2: 'Start at the number, then follow the arrow.',
  3: 'Write from memory — no guide this time!',
};

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

const PHONETICS = {
  a:'[eɪ]', b:'[biː]', c:'[siː]', d:'[diː]', e:'[iː]',
  f:'[ɛf]',  g:'[dʒiː]', h:'[eɪtʃ]', i:'[aɪ]', j:'[dʒeɪ]',
  k:'[keɪ]', l:'[ɛl]', m:'[ɛm]', n:'[ɛn]', o:'[oʊ]',
  p:'[piː]', q:'[kjuː]', r:'[ɑːr]', s:'[ɛs]', t:'[tiː]',
  u:'[juː]', v:'[viː]', w:'[dʌbljуː]', x:'[ɛks]', y:'[waɪ]', z:'[zɛd]',
};

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

const TRACER_PX_PER_MS = 0.28;
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

function calculateDrawingFeatures(paths) {
  const allPoints = paths.flat();
  if (allPoints.length < 2) {
    return { smoothness: 0, pauseCount: 0, completionTime: 0, strokeCount: paths.length };
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
  return { smoothness, pauseCount, completionTime, strokeCount: paths.length };
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
  const {
    student,
    theme,
    letterSequence  = [],
    collectionMode  = false,
    collectionSessionId = null,
  } = route.params;

  const caseType = 'uppercase';

  const sequence = useMemo(() => {
    const filtered = letterSequence.filter(l => l.caseType === caseType);
    return filtered.length > 0 ? filtered : getAllLetters(caseType);
  }, [letterSequence]);

  const [letterIdx,    setLetterIdx]    = useState(0);
  const [attempt,      setAttempt]      = useState(1);
  const [currentPath,  setCurrentPath]  = useState([]);
  const [allPaths,     setAllPaths]     = useState([]);
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [celebration,  setCelebration]  = useState(null);
  const [reduceMotion,  setReduceMotion] = useState(false);

  const startTimeRef       = useRef(null);
  const allPathsRef        = useRef([]);
  const attemptScoresRef   = useRef([]);   // accumulates featuresToScore result for each attempt
  const sessionAttemptsRef = useRef([]);   // ML: accumulates {attempt_number, features, strokes} per letter
  const strokeIdCounter    = useRef(0);    // ML: counts strokes within the current attempt

  const tracerProgress    = useRef(new Animated.Value(0)).current;
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);

  const celebScale   = useRef(new Animated.Value(0.5)).current;
  const celebOpacity = useRef(new Animated.Value(0)).current;

  const { show } = useToast();

  const letterObj     = sequence[letterIdx];
  const letter        = letterObj?.letter ?? 'A';
  const isLastLetter  = letterIdx >= sequence.length - 1;
  const isLastAttempt = attempt === 3;
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

  const guideOpacity  = (attempt === 3 && !collectionMode) ? 0 : attempt === 1 ? 0.14 : 0.26;
  const phonetic      = PHONETICS[letter.toLowerCase()] ?? '';
  const badge         = ATTEMPT_BADGE[attempt];

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

  const playLetterSound = useCallback((l = letter) => {
    Speech.stop();
    Speech.speak(l.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
  }, [letter]);

  const playLetterSoundRef = useRef(playLetterSound);
  playLetterSoundRef.current = playLetterSound;

  useEffect(() => {
    Speech.speak(letter.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
    return () => Speech.stop();
  }, [letter]);

  useEffect(() => {
    const rawPath = LETTER_PATHS[letter];
    if (reduceMotion || attempt !== 1 || hasDrawn || !rawPath || rawPath.length < 1) {
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
      strokeAnimations.push(Animated.timing(tracerProgress, {
        toValue: strokeBounds[index].end,
        duration: Math.max(600, Math.round(sampledStrokes[index].totalLength / TRACER_PX_PER_MS)),
        useNativeDriver: true,
      }));
    }

    const anim = Animated.loop(
      Animated.sequence([Animated.delay(350), ...strokeAnimations, Animated.delay(700)]),
      { resetBeforeIteration: true }
    );
    anim.start();

    return () => { setTracerVisible(false); anim.stop(); };
  }, [attempt, hasDrawn, letter, reduceMotion, tracerProgress]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        setAttemptFeedback(null);
        const { locationX, locationY } = evt.nativeEvent;
        const now = Date.now();
        startTimeRef.current = now;
        strokeIdCounter.current += 1;  // ML: new stroke begins
        setCurrentPath([{ x: locationX, y: locationY, t: 0, tAbs: now, stroke_id: strokeIdCounter.current }]);
        if (allPathsRef.current.length === 0) {
          playLetterSoundRef.current?.();
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const now = Date.now();
        setCurrentPath(prev => {
          const last = prev[prev.length - 1];
          if (last && Math.hypot(locationX - last.x, locationY - last.y) < 1.5) return prev;
          return [...prev, {
            x: locationX, y: locationY, t: now - startTimeRef.current, tAbs: now, stroke_id: strokeIdCounter.current,
          }];
        });
      },
      onPanResponderRelease: () => {
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
    sessionAttemptsRef.current = [
      ...sessionAttemptsRef.current,
      {
        attempt_number: attempt,
        features: {
          smoothness:       features.smoothness,
          pauseCount:       features.pauseCount,
          completionTime:   features.completionTime,
          strokeCount:      features.strokeCount,
          dtw_distance:     features.dtw_distance,
          stroke_order_meta: features.stroke_order_meta,
        },
        strokes: allPathsRef.current.map((pts, i) => ({
          stroke_id: i + 1,
          points:    pts,   // each point: {x, y, t, tAbs, stroke_id}
        })),
      },
    ];

    const attemptScore = Math.round(featuresToScore({ smoothness: features.smoothness, dtw_distance: features.dtw_distance }));
    attemptScoresRef.current = [...attemptScoresRef.current, attemptScore];
    const attemptPassed = didPassAttempt(features, allPathsRef.current);
    setAttemptFeedback({ passed: attemptPassed, attempt });

    try {
      await Promise.all([
        storeLetterProgress(student.sid, letter, {
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
        console.log('[DTW debug export]', buildDtwDebugExport({
          childStrokes:   allPathsRef.current,
          templatePoints: templatePath ? sampleSmoothPath(templatePath, 60, CANVAS_W, CANVAS_H).points : [],
          dtwResult:      dtwResult,
          qualityScore:   attemptScore,
        }));
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
          ...getDeviceMetadata(),
        });
        if (!collectionMode && (!wroteCorrectly || response.data.completed === false)) {
          if (response.data.completed === false) {
            show('Keep practising — try again!', 'info');
          }
          attemptScoresRef.current   = [];
          sessionAttemptsRef.current = [];
          setAttempt(1);
          resetCanvas();
          return;
        }
      } catch {
        // network failure — gate only in normal mode
        if (!collectionMode && !wroteCorrectly) {
          attemptScoresRef.current   = [];
          sessionAttemptsRef.current = [];
          setAttempt(1);
          resetCanvas();
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
  }, [attempt, collectionMode, collectionSessionId, isLastAttempt, isLastLetter, letter, letterIdx,
      resetCanvas, sequence, show, showCelebrationFor, student.sid]);

  const handleDismissCelebration = useCallback(() => {
    const isAllDone = celebration?.isAllDone;
    setCelebration(null);
    if (isAllDone) {
      if (collectionMode) {
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
      const nextLetterObj = sequence[letterIdx + 1];
      const group      = nextLetterObj ? getLetterPrimitiveGroup(nextLetterObj.letter) : null;
      const activities = group ? selectPreWritingActivities(group) : [];

      if (activities.length > 0) {
        navigation.navigate('PreWritingActivity', {
          student, theme, activities,
          nextRoute:  'UppercaseWriting',
          nextParams: { student, theme, letterSequence: sequence.slice(letterIdx + 1) },
        });
      } else {
        setLetterIdx(i => i + 1);
        setAttempt(1);
      }
    }
  }, [celebration, collectionMode, collectionSessionId, navigation, student, theme, sequence, letterIdx]);

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
            onPress={() => navigation.goBack()}
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

        {/* Main area: letter card LEFT · content RIGHT */}
        <View style={styles.mainRow}>

          {/* Left column — large letter card */}
          <View style={styles.letterCol}>
            <View style={[styles.letterCard, { backgroundColor: theme.button }]}>
              <Text style={[styles.letterCardText, { color: theme.buttonText }]}>
                {letter}
              </Text>
            </View>
          </View>

          {/* Right column — title + phonetic + badge + canvas */}
          <View style={styles.contentCol}>

            {/* Title card */}
            <View style={[styles.titleCard, {
              backgroundColor: theme.button + '14',
              borderColor:     theme.button + '35',
            }]}>
              <Text style={[styles.writeLabel, { color: theme.headingText }]}>
                Write '{letter.toUpperCase()}'
              </Text>
              <TouchableOpacity
                style={[styles.soundBtn, { backgroundColor: theme.button }]}
                onPress={() => playLetterSound()}
                activeOpacity={0.75}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="volume-high" size={18} color={theme.buttonText} />
              </TouchableOpacity>
            </View>

            {/* Phonetic */}
            <Text style={[styles.phoneticText, { color: theme.headingText }]}>
              {phonetic}
            </Text>

            {/* Attempt badge */}
            <View style={[styles.attemptBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.attemptTitle, { color: badge.text }]}>
                {ATTEMPT_TITLES[attempt]}
              </Text>
              <Text style={[styles.attemptHint, { color: badge.text }]}>
                {ATTEMPT_HINTS[attempt]}
              </Text>
            </View>

            {/* Writing canvas */}
            <View style={styles.canvasOuter}>
              <View
                style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
                pointerEvents={attemptFeedback ? 'none' : 'auto'}
                {...panResponder.panHandlers}
              >
                <Svg width={CANVAS_W} height={CANVAS_H}>

                  <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
                  <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
                  <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
                  <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

                  {guideOpacity > 0 && LETTER_PATHS[letter] && (
                    <>
                      <Path
                        d={ANGULAR_LETTERS.has(letter) ? toStraightPath(LETTER_PATHS[letter]) : toSmoothPath(LETTER_PATHS[letter])}
                        stroke={`rgba(80,80,80,${guideOpacity})`}
                        strokeWidth={7}
                        strokeLinecap="round"
                        strokeLinejoin={ANGULAR_LETTERS.has(letter) ? 'miter' : 'round'}
                        fill="none"
                      />
                      {getGhostDots(LETTER_PATHS[letter]).map((dot, idx) => (
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

                  {attempt === 2
                    && activeGuideStart
                    && (
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
                      {activeDirectionHint && (
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
                    </>
                  )}

                  {allPaths.map((stroke, i) => (
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

                  {currentPath.length > 1 && (
                    <Polyline
                      points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
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

              {attempt === 1 && !hasDrawn && tracerVisible && tracerXInterp && (
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

        {/* Feedback pill */}
        {/* Action buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.button + '55' }]}
            onPress={handleClear}
            disabled={Boolean(attemptFeedback)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.headingText} />
            <Text style={[styles.clearText, { color: theme.headingText }]}>Clear</Text>
          </TouchableOpacity>

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

      </SafeAreaView>
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
  counterText: { fontSize: 13, fontWeight: '700' },
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
  writeLabel: {
    fontSize: 26,
    fontWeight: '900',
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
  phoneticText: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
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
  attemptTitle: { fontSize: 12, fontWeight: '800' },
  attemptHint:  { fontSize: 10, marginTop: 2, textAlign: 'center', opacity: 0.85 },

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

  feedbackBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },

  buttonsRow: {
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
  clearText: { fontSize: 14, fontWeight: '600' },
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
  nextText: { fontSize: 14, fontWeight: '800' },

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
  celebTitle:     { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  celebMessage:   { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebNextBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
  },
  celebNextLabel: { fontSize: 13, color: '#777777' },
  celebNextValue: { fontSize: 13, fontWeight: '800' },
  celebStars:     { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 40, paddingVertical: 14, borderRadius: 50, width: '100%',
  },
  celebBtnText: { fontSize: 17, fontWeight: '800' },
});
