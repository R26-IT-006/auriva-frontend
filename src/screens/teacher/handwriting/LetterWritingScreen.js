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
import { getAllLetters } from '../../../data/letterCategories';
import { DATA_COLLECTION_PROTOCOL } from '../../../constants/dataCollectionProtocol';
import { featuresToScore, DTW_CORRECT_THRESHOLD } from '../../../utils/adaptiveSequencing';
import { computeDTW, sampleSmoothPath, normalizeStrokes, computeMultiStrokeDTW } from '../../../utils/dtw';
import { buildDtwDebugExport } from '../../../utils/dtwDebugExport';
import { useToast } from '../../../context/ToastContext';
import client from '../../../api/client';
import { ENDPOINTS } from '../../../constants/api';
import AttemptAvatarFeedback from './AttemptAvatarFeedback';
import {
  getDeviceMetadata, PROTOCOL_VERSION, FEATURE_VERSION, TEMPLATE_VERSION, NORMALIZATION_VERSION,
} from '../../../utils/collectionSession';
import { getLetterPrimitiveGroup, selectPreWritingActivities } from '../../../data/preWritingActivities';

// Shapes occupy task_order 0-5 in the collection protocol; lowercase
// letters continue from 6, matching DATA_COLLECTION_PROTOCOL's fixed order.
const LOWERCASE_TASK_ORDER_OFFSET = 6;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 16;

// Two-column split — mirrors WordWritingScreen layout
const COL_L           = Math.round(SCREEN_W * 0.43);   // left column (letter card)
const LETTER_CARD_SIZE = COL_L - 8;                     // card fills the column
const CANVAS_W        = SCREEN_W - COL_L - PAD * 2;    // canvas = right column width
const CANVAS_H        = Math.round(SCREEN_H * 0.50);   // 50 % of screen height

// Aspect-ratio correction: map fx fractions so equal fx/fy deltas produce
// equal pixel distances, keeping letter shapes true across all devices.
const ASPECT  = CANVAS_W / CANVAS_H;
const aspectX = (fx) => 0.5 + (fx - 0.5) / ASPECT;

if (__DEV__) console.log('[LetterWriting] CANVAS_W =', CANVAS_W, ' CANVAS_H =', CANVAS_H, ' ASPECT =', ASPECT.toFixed(3), ' COL_L =', COL_L);

// 4-line handwriting ruling — evenly spaced (0.28 gap), 0.08 margins
const LINE_1 = Math.round(CANVAS_H * 0.08);  // cap line     — blue solid
const LINE_2 = Math.round(CANVAS_H * 0.36);  // x-height     — blue solid
const LINE_3 = Math.round(CANVAS_H * 0.64);  // baseline     — red dashed
const LINE_4 = Math.round(CANVAS_H * 0.92);  // descender    — blue solid

// â”€â”€â”€ Attempt badge colours (small indicator only — theme bg is never changed) â”€

const ATTEMPT_BADGE = {
  1: { bg: '#FFCBA8', border: '#FF8C42', text: '#7A2D00' },  // warm orange
  2: { bg: '#FFE97A', border: '#F0C000', text: '#5A4000' },  // golden yellow
  3: { bg: '#A8E6A8', border: '#4CAF50', text: '#1B5E20' },  // fresh green
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

// â”€â”€â”€ Per-letter start positions (fraction of canvas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const START_POS = {
  // Straight
  l: { fx: 0.50, fy: 0.12 }, i: { fx: 0.50, fy: 0.42 }, t: { fx: 0.50, fy: 0.16 },
  // Curved
  o: { fx: 0.50, fy: 0.28 }, c: { fx: 0.64, fy: 0.35 }, e: { fx: 0.38, fy: 0.53 },
  u: { fx: 0.36, fy: 0.42 }, a: { fx: 0.63, fy: 0.38 }, s: { fx: 0.62, fy: 0.35 },
  // Mixed
  b: { fx: 0.37, fy: 0.12 }, d: { fx: 0.60, fy: 0.38 }, f: { fx: 0.58, fy: 0.16 },
  g: { fx: 0.62, fy: 0.38 }, h: { fx: 0.37, fy: 0.12 }, j: { fx: 0.53, fy: 0.42 },
  k: { fx: 0.36, fy: 0.12 }, m: { fx: 0.24, fy: 0.42 }, n: { fx: 0.27, fy: 0.42 },
  p: { fx: 0.35, fy: 0.44 }, q: { fx: 0.60, fy: 0.38 }, r: { fx: 0.30, fy: 0.42 },
  v: { fx: 0.30, fy: 0.42 }, w: { fx: 0.22, fy: 0.42 }, x: { fx: 0.30, fy: 0.42 },
  y: { fx: 0.30, fy: 0.42 }, z: { fx: 0.31, fy: 0.42 },
  // Uppercase
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

const DEFAULT_START = { fx: 0.36, fy: 0.30 };

// â”€â”€â”€ Phonetics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PHONETICS = {
  a:'[eÉª]', b:'[biË]', c:'[siË]', d:'[diË]', e:'[iË]',
  f:'[É›f]',  g:'[dÊ’iË]', h:'[eÉªtÊƒ]', i:'[aÉª]', j:'[dÊ’eÉª]',
  k:'[keÉª]', l:'[É›l]',  m:'[É›m]',  n:'[É›n]', o:'[oÊŠ]',
  p:'[piË]', q:'[kjuË]', r:'[É‘Ër]', s:'[É›s]', t:'[tiË]',
  u:'[juË]', v:'[viË]',  w:'[dÊŒbljuË]', x:'[É›ks]', y:'[waÉª]', z:'[zÉ›d]',
};

// â”€â”€â”€ Letter stroke waypoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Each array is an ordered list of (fx, fy) key points the animated tracer dot
// follows in Attempt 1, giving children a visual "watch how to write" demo.
// Coordinates are fractions of CANVAS_W / CANVAS_H, matching the 4-line ruling:
//   fy â‰ˆ 0.08 = cap line   |  fy â‰ˆ 0.36 = x-height  |  fy â‰ˆ 0.64 = baseline  |  fy â‰ˆ 0.92 = descender

const LETTER_PATHS = {
  // â”€â”€ Lowercase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // x-height = fy 0.36 · baseline = fy 0.64 · descender = fy 0.92
  a:[{fx:0.63,fy:0.42},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.57,fy:0.625},{fx:0.63,fy:0.58},{fx:0.63,fy:0.42},{fx:0.63,fy:0.64}],
  b:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.41},{fx:0.44,fy:0.36},{fx:0.54,fy:0.38},{fx:0.60,fy:0.45},{fx:0.62,fy:0.50},{fx:0.60,fy:0.57},{fx:0.54,fy:0.625},{fx:0.44,fy:0.64},{fx:0.34,fy:0.60}]],
  c:[{fx:0.62,fy:0.42},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.57,fy:0.625},{fx:0.62,fy:0.58}],
  d:[[{fx:0.58,fy:0.08},{fx:0.58,fy:0.64}],[{fx:0.58,fy:0.41},{fx:0.48,fy:0.36},{fx:0.38,fy:0.38},{fx:0.32,fy:0.45},{fx:0.30,fy:0.50},{fx:0.32,fy:0.57},{fx:0.38,fy:0.625},{fx:0.48,fy:0.64},{fx:0.58,fy:0.60}]],
  e:[{fx:0.37,fy:0.50},{fx:0.63,fy:0.50},{fx:0.63,fy:0.44},{fx:0.57,fy:0.375},{fx:0.50,fy:0.36},{fx:0.43,fy:0.375},{fx:0.38,fy:0.42},{fx:0.36,fy:0.50},{fx:0.38,fy:0.58},{fx:0.43,fy:0.625},{fx:0.50,fy:0.64},{fx:0.58,fy:0.625}],
  f:[
    [{fx:0.58,fy:0.16},{fx:0.50,fy:0.11},{fx:0.42,fy:0.14},{fx:0.40,fy:0.22},{fx:0.40,fy:0.64}],
    [{fx:0.30,fy:0.36},{fx:0.56,fy:0.36}]
  ],
  g:[
    [{fx:0.58,fy:0.41},{fx:0.50,fy:0.36},{fx:0.40,fy:0.37},{fx:0.34,fy:0.43},{fx:0.32,fy:0.50},{fx:0.34,fy:0.57},{fx:0.40,fy:0.625},{fx:0.50,fy:0.64},{fx:0.58,fy:0.60}],
    [{fx:0.58,fy:0.36},{fx:0.58,fy:0.80},{fx:0.54,fy:0.88},{fx:0.44,fy:0.90},{fx:0.36,fy:0.86}]
  ],
  h:[[{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.44},{fx:0.40,fy:0.38},{fx:0.48,fy:0.36},{fx:0.56,fy:0.39},{fx:0.60,fy:0.46},{fx:0.60,fy:0.64}]],
  i:[[{fx:0.50,fy:0.36},{fx:0.50,fy:0.64}],[{fx:0.50,fy:0.25}]],
  j:[
    [{fx:0.52,fy:0.36},{fx:0.52,fy:0.80},{fx:0.48,fy:0.88},{fx:0.40,fy:0.90},{fx:0.34,fy:0.86}],
    [{fx:0.52,fy:0.25}]
  ],
  k:[
    [{fx:0.34,fy:0.08},{fx:0.34,fy:0.64}],
    [{fx:0.34,fy:0.50},{fx:0.60,fy:0.36}],
    [{fx:0.34,fy:0.50},{fx:0.62,fy:0.64}]
  ],
  l:[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}],
  m:[[{fx:0.26,fy:0.36},{fx:0.26,fy:0.64}],[{fx:0.26,fy:0.42},{fx:0.31,fy:0.37},{fx:0.38,fy:0.36},{fx:0.44,fy:0.39},{fx:0.47,fy:0.45},{fx:0.47,fy:0.64}],[{fx:0.47,fy:0.45},{fx:0.50,fy:0.39},{fx:0.57,fy:0.36},{fx:0.64,fy:0.37},{fx:0.69,fy:0.42},{fx:0.71,fy:0.48},{fx:0.71,fy:0.64}]],
  n:[[{fx:0.34,fy:0.36},{fx:0.34,fy:0.64}],[{fx:0.34,fy:0.42},{fx:0.40,fy:0.37},{fx:0.48,fy:0.36},{fx:0.56,fy:0.39},{fx:0.60,fy:0.45},{fx:0.60,fy:0.64}]],
  o:[{fx:0.50,fy:0.36},{fx:0.57,fy:0.375},{fx:0.62,fy:0.42},{fx:0.64,fy:0.50},{fx:0.62,fy:0.58},{fx:0.57,fy:0.625},{fx:0.50,fy:0.64},{fx:0.43,fy:0.625},{fx:0.38,fy:0.58},{fx:0.36,fy:0.50},{fx:0.38,fy:0.42},{fx:0.43,fy:0.375},{fx:0.50,fy:0.36}],
  p:[[{fx:0.34,fy:0.36},{fx:0.34,fy:0.90}],[{fx:0.34,fy:0.41},{fx:0.44,fy:0.36},{fx:0.54,fy:0.38},{fx:0.60,fy:0.45},{fx:0.62,fy:0.50},{fx:0.60,fy:0.57},{fx:0.54,fy:0.625},{fx:0.44,fy:0.64},{fx:0.34,fy:0.60}]],
  q:[[{fx:0.58,fy:0.36},{fx:0.58,fy:0.90}],[{fx:0.58,fy:0.41},{fx:0.48,fy:0.36},{fx:0.38,fy:0.38},{fx:0.32,fy:0.45},{fx:0.30,fy:0.50},{fx:0.32,fy:0.57},{fx:0.38,fy:0.625},{fx:0.48,fy:0.64},{fx:0.58,fy:0.60}]],
  r:[[{fx:0.38,fy:0.36},{fx:0.38,fy:0.64}],[{fx:0.38,fy:0.42},{fx:0.45,fy:0.37},{fx:0.53,fy:0.38}]],
  s:[{fx:0.62,fy:0.41},{fx:0.56,fy:0.375},{fx:0.48,fy:0.37},{fx:0.42,fy:0.40},{fx:0.41,fy:0.45},{fx:0.46,fy:0.49},{fx:0.54,fy:0.51},{fx:0.60,fy:0.55},{fx:0.59,fy:0.61},{fx:0.52,fy:0.64},{fx:0.44,fy:0.635},{fx:0.38,fy:0.60}],
  t:[[{fx:0.50,fy:0.14},{fx:0.50,fy:0.64}],[{fx:0.38,fy:0.36},{fx:0.62,fy:0.36}]],
  u:[{fx:0.37,fy:0.36},{fx:0.37,fy:0.55},{fx:0.40,fy:0.61},{fx:0.45,fy:0.64},{fx:0.50,fy:0.64},{fx:0.56,fy:0.62},{fx:0.61,fy:0.57},{fx:0.63,fy:0.36},{fx:0.63,fy:0.64}],
  v:[{fx:0.36,fy:0.36},{fx:0.50,fy:0.64},{fx:0.64,fy:0.36}],
  w:[{fx:0.28,fy:0.36},{fx:0.40,fy:0.64},{fx:0.50,fy:0.36},{fx:0.60,fy:0.64},{fx:0.72,fy:0.36}],
  x:[
    [{fx:0.36,fy:0.36},{fx:0.64,fy:0.64}],
    [{fx:0.64,fy:0.36},{fx:0.36,fy:0.64}]
  ],
  y:[
    [{fx:0.36,fy:0.36},{fx:0.50,fy:0.60}],
    [{fx:0.64,fy:0.36},{fx:0.36,fy:0.90}]
  ],
  z:[{fx:0.36,fy:0.36},{fx:0.64,fy:0.36},{fx:0.36,fy:0.64},{fx:0.64,fy:0.64}],
  // â”€â”€ Uppercase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // cap line = fy 0.08 · baseline = fy 0.64 · midheight ≈ fy 0.36
  A:[{fx:0.28,fy:0.72},{fx:0.50,fy:0.10},{fx:0.72,fy:0.72},{fx:0.34,fy:0.50},{fx:0.66,fy:0.50}],
  B:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.56,fy:0.12},{fx:0.64,fy:0.22},{fx:0.64,fy:0.35},{fx:0.56,fy:0.44},{fx:0.36,fy:0.44},{fx:0.58,fy:0.46},{fx:0.66,fy:0.56},{fx:0.66,fy:0.64},{fx:0.56,fy:0.72},{fx:0.36,fy:0.72}],
  C:[{fx:0.68,fy:0.26},{fx:0.50,fy:0.10},{fx:0.32,fy:0.26},{fx:0.32,fy:0.56},{fx:0.50,fy:0.72},{fx:0.68,fy:0.58}],
  D:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.56,fy:0.13},{fx:0.66,fy:0.28},{fx:0.66,fy:0.54},{fx:0.56,fy:0.70},{fx:0.36,fy:0.72}],
  E:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.66,fy:0.10},{fx:0.36,fy:0.41},{fx:0.62,fy:0.41},{fx:0.36,fy:0.72},{fx:0.66,fy:0.72}],
  F:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.66,fy:0.10},{fx:0.36,fy:0.41},{fx:0.62,fy:0.41}],
  G:[{fx:0.68,fy:0.26},{fx:0.50,fy:0.10},{fx:0.32,fy:0.26},{fx:0.32,fy:0.56},{fx:0.50,fy:0.72},{fx:0.68,fy:0.58},{fx:0.68,fy:0.41},{fx:0.50,fy:0.41}],
  H:[{fx:0.34,fy:0.10},{fx:0.34,fy:0.72},{fx:0.34,fy:0.41},{fx:0.66,fy:0.41},{fx:0.66,fy:0.10},{fx:0.66,fy:0.72}],
  I:[{fx:0.50,fy:0.10},{fx:0.50,fy:0.72}],
  J:[{fx:0.57,fy:0.10},{fx:0.57,fy:0.56},{fx:0.50,fy:0.68},{fx:0.40,fy:0.72},{fx:0.32,fy:0.68},{fx:0.30,fy:0.57}],
  K:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.41},{fx:0.66,fy:0.10},{fx:0.36,fy:0.41},{fx:0.66,fy:0.72}],
  L:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.64,fy:0.72}],
  M:[{fx:0.28,fy:0.72},{fx:0.28,fy:0.10},{fx:0.50,fy:0.48},{fx:0.72,fy:0.10},{fx:0.72,fy:0.72}],
  N:[{fx:0.30,fy:0.72},{fx:0.30,fy:0.10},{fx:0.70,fy:0.72},{fx:0.70,fy:0.10}],
  O:[{fx:0.59,fy:0.14},{fx:0.50,fy:0.10},{fx:0.41,fy:0.14},{fx:0.32,fy:0.41},{fx:0.41,fy:0.68},{fx:0.50,fy:0.72},{fx:0.59,fy:0.68},{fx:0.68,fy:0.41},{fx:0.59,fy:0.14}],
  P:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.56,fy:0.13},{fx:0.65,fy:0.22},{fx:0.65,fy:0.36},{fx:0.56,fy:0.46},{fx:0.36,fy:0.44}],
  Q:[{fx:0.59,fy:0.14},{fx:0.50,fy:0.10},{fx:0.41,fy:0.14},{fx:0.32,fy:0.41},{fx:0.41,fy:0.68},{fx:0.50,fy:0.72},{fx:0.59,fy:0.68},{fx:0.68,fy:0.41},{fx:0.59,fy:0.14},{fx:0.56,fy:0.60},{fx:0.70,fy:0.76}],
  R:[{fx:0.36,fy:0.10},{fx:0.36,fy:0.72},{fx:0.36,fy:0.10},{fx:0.56,fy:0.13},{fx:0.65,fy:0.22},{fx:0.65,fy:0.36},{fx:0.56,fy:0.46},{fx:0.36,fy:0.44},{fx:0.66,fy:0.72}],
  S:[{fx:0.66,fy:0.22},{fx:0.50,fy:0.10},{fx:0.34,fy:0.22},{fx:0.50,fy:0.41},{fx:0.66,fy:0.58},{fx:0.50,fy:0.72},{fx:0.34,fy:0.62}],
  T:[[{fx:0.30,fy:0.08},{fx:0.70,fy:0.08}],[{fx:0.50,fy:0.08},{fx:0.50,fy:0.64}]],
  U:[{fx:0.34,fy:0.10},{fx:0.34,fy:0.54},{fx:0.40,fy:0.68},{fx:0.50,fy:0.72},{fx:0.60,fy:0.68},{fx:0.66,fy:0.54},{fx:0.66,fy:0.10}],
  V:[{fx:0.28,fy:0.10},{fx:0.50,fy:0.72},{fx:0.72,fy:0.10}],
  W:[{fx:0.22,fy:0.10},{fx:0.35,fy:0.72},{fx:0.50,fy:0.44},{fx:0.65,fy:0.72},{fx:0.78,fy:0.10}],
  X:[{fx:0.28,fy:0.10},{fx:0.50,fy:0.41},{fx:0.72,fy:0.72},{fx:0.72,fy:0.10},{fx:0.50,fy:0.41},{fx:0.28,fy:0.72}],
  Y:[{fx:0.28,fy:0.10},{fx:0.50,fy:0.41},{fx:0.72,fy:0.10},{fx:0.50,fy:0.41},{fx:0.50,fy:0.72}],
  Z:[{fx:0.28,fy:0.10},{fx:0.72,fy:0.10},{fx:0.28,fy:0.72},{fx:0.72,fy:0.72}],
};

const ANGULAR_LETTERS = new Set([
  'v','w','z','x','y','k','l',
  'V','W','Z','X','Y','K','L','A','E','M','N','T','I','H','F',
]);


// â”€â”€â”€ Feature calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Returns total drawn length + bounding-box dimensions in one pass.
// Used on attempt 3 to catch cases where the child drew too little
// (e.g. a short line on 'o') regardless of how smooth it was.
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

function getAttemptBadge(smoothness) {
  if (smoothness < 0.15) return { label: 'Excellent! ✓', color: '#2E7D32', bg: '#E8F5E9' };
  if (smoothness < 0.35) return { label: 'Good effort!', color: '#E65100', bg: '#FFF3E0' };
  return                        { label: 'Keep going!',  color: '#C62828', bg: '#FFEBEE' };
}

// Builds a smooth catmull-rom SVG path from LETTER_PATHS waypoints.
// Supports multi-stroke paths: each stroke gets its own M command (pen-lift gaps).
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
  const cumLen = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
    cumLen.push(cumLen[i-1] + Math.sqrt(dx*dx + dy*dy));
  }
  const totalLength = cumLen[cumLen.length - 1];
  if (totalLength === 0) return { points: [pts[0]], totalLength: 0 };
  const points = [];
  for (let k = 0; k < numSamples; k++) {
    const target = (k / (numSamples - 1)) * totalLength;
    let seg = 0;
    while (seg < pts.length - 2 && cumLen[seg + 1] < target) seg++;
    const span = cumLen[seg + 1] - cumLen[seg];
    const frac = span > 0 ? (target - cumLen[seg]) / span : 0;
    points.push({
      x: pts[seg].x + frac * (pts[seg+1].x - pts[seg].x),
      y: pts[seg].y + frac * (pts[seg+1].y - pts[seg].y),
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

// Constant-speed tracer: duration proportional to segment pixel distance.
const TRACER_PX_PER_MS = 0.28; // ~280 px/s — slow enough for children to follow
const ATTEMPT_FEEDBACK_MS = 2200;
function getSegmentDuration(p1, p2) {
  const dx = (aspectX(p2.fx) - aspectX(p1.fx)) * CANVAS_W;
  const dy = (p2.fy - p1.fy) * CANVAS_H;
  return Math.max(180, Math.round(Math.sqrt(dx * dx + dy * dy) / TRACER_PX_PER_MS));
}

// â”€â”€â”€ Category celebrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_CELEBRATION = {
  straight: {
    icon: 'create-outline', title: 'Straight Lines Mastered!',
    message: 'You drew perfect lines!\nYour hand is getting stronger every letter.',
    color: '#1565C0',
  },
  curved: {
    icon: 'ellipse-outline', title: 'Curves Conquered!',
    message: 'Beautiful circles and arcs!\nYour strokes are becoming so smooth.',
    color: '#6A1B9A',
  },
  mixed: {
    icon: 'star-outline', title: 'Complex Letters Done!',
    message: 'You handled the trickiest letters!\nThat took real focus and skill.',
    color: '#E65100',
  },
};

const ALL_DONE_CELEBRATION = {
  icon: 'trophy-outline', title: 'All Letters Complete!',
  message: 'Amazing work! You practised every single letter.\nYou are a handwriting star!',
  color: '#2E7D32',
};

const NEXT_CATEGORY_LABEL = {
  straight: 'Straight letters', curved: 'Curved letters', mixed: 'Mixed letters',
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function LetterWritingScreen({ route, navigation }) {
  const {
    student,
    theme,
    caseType        = 'lowercase',
    letterSequence  = [],
    collectionMode  = false,
    collectionSessionId = null,
  } = route.params;

  const sequence = useMemo(() => {
    const filtered = letterSequence.filter(l => l.caseType === caseType);
    return filtered.length > 0 ? filtered : getAllLetters(caseType);
  }, [letterSequence, caseType]);

  const { show } = useToast();

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [letterIdx,    setLetterIdx]    = useState(0);
  const [attempt,      setAttempt]      = useState(1);
  const [currentPath,  setCurrentPath]  = useState([]);
  const [allPaths,     setAllPaths]     = useState([]);
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [celebration,  setCelebration]  = useState(null);
  const [reduceMotion,  setReduceMotion] = useState(false);

  // â”€â”€ Refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startTimeRef       = useRef(null);
  const allPathsRef        = useRef([]);
  const attemptScoresRef   = useRef([]);   // accumulates featuresToScore result for each attempt
  const sessionAttemptsRef = useRef([]);   // ML: accumulates {attempt_number, features, strokes} per letter
  const strokeIdCounter    = useRef(0);    // ML: counts strokes within the current attempt

  // â”€â”€ Tracer dot animation (Attempt 1 "Watch & Trace") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tracerProgress    = useRef(new Animated.Value(0)).current;
  const [tracerVisible,   setTracerVisible]   = useState(false);
  const [tracerKeyframes, setTracerKeyframes] = useState(null);

  // â”€â”€ Celebration animation refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const celebScale    = useRef(new Animated.Value(0.5)).current;
  const celebOpacity  = useRef(new Animated.Value(0)).current;

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const letterObj     = sequence[letterIdx];
  const letter        = letterObj?.letter ?? 'a';
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

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // Stable interpolation nodes rebuilt only when the keyframe table changes (per letter).
  // Calling interpolate() here rather than in render keeps the node identity stable so
  // the running animation stays connected across re-renders.
  const tracerXInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.xRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  const tracerYInterp = useMemo(() => {
    if (!tracerKeyframes) return null;
    return tracerProgress.interpolate({
      inputRange:  tracerKeyframes.inputRange,
      outputRange: tracerKeyframes.yRange,
      extrapolate: 'clamp',
    });
  }, [tracerKeyframes, tracerProgress]);

  // â”€â”€ Speech â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const playLetterSound = useCallback((l = letter) => {
    Speech.stop();
    Speech.speak(l.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
  }, [letter]);

  // Keep a stable ref so the PanResponder closure can call it without staling
  const playLetterSoundRef = useRef(playLetterSound);
  playLetterSoundRef.current = playLetterSound;

  // Auto-announce the letter whenever it changes
  useEffect(() => {
    Speech.speak(letter.toUpperCase(), { rate: 0.8, pitch: 1.0, language: 'en-US' });
    return () => Speech.stop();
  }, [letter]);

  // â”€â”€ Tracer dot animation for Attempt 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const rawPath = LETTER_PATHS[letter];
    if (reduceMotion || attempt !== 1 || hasDrawn || !rawPath || rawPath.length < 1) {
      setTracerVisible(false);
      return;
    }

    const strokes = normalizeStrokes(rawPath);
    const isAngular = ANGULAR_LETTERS.has(letter);
    const perStroke = strokes.map(s => {
      if (s && s.length === 1) {
        const pt = { x: aspectX(s[0].fx) * CANVAS_W, y: s[0].fy * CANVAS_H };
        return { points: [pt, pt], totalLength: 0 };
      }
      return isAngular
        ? sampleStraightStroke(s, 60, CANVAS_W, CANVAS_H)
        : sampleSmoothPath(s, 60, CANVAS_W, CANVAS_H);
    });

    const inputRange = [];
    const xRange = [];
    const yRange = [];
    const strokeBounds = [];
    let offset = 0;
    for (const { points } of perStroke) {
      if (points.length === 0) continue;
      const start = offset;
      for (let k = 0; k < points.length; k++) {
        inputRange.push(offset + k);
        xRange.push(points[k].x);
        yRange.push(points[k].y);
      }
      offset += points.length;
      strokeBounds.push({ start, end: offset - 1 });
    }

    if (inputRange.length < 2) { setTracerVisible(false); return; }

    setTracerKeyframes({ inputRange, xRange, yRange });
    tracerProgress.setValue(0);
    setTracerVisible(true);

    const strokeAnims = [];
    for (let s = 0; s < strokeBounds.length; s++) {
      if (s > 0) {
        strokeAnims.push(Animated.delay(400));
        strokeAnims.push(Animated.timing(tracerProgress, {
          toValue: strokeBounds[s].start, duration: 1, useNativeDriver: true,
        }));
      }
      const len = perStroke[s].totalLength;
      const dur = Math.max(600, Math.round(len / TRACER_PX_PER_MS));
      strokeAnims.push(Animated.timing(tracerProgress, {
        toValue: strokeBounds[s].end, duration: dur, useNativeDriver: true,
      }));
    }

    const anim = Animated.loop(
      Animated.sequence([Animated.delay(350), ...strokeAnims, Animated.delay(700)]),
      { resetBeforeIteration: true }
    );
    anim.start();

    return () => {
      setTracerVisible(false);
      anim.stop();
    };
  }, [attempt, hasDrawn, letter, reduceMotion, tracerProgress]);

  // â”€â”€ Show feedback badge after first stroke â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ PanResponder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        // Speak the letter name when the child first touches the canvas
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

  // â”€â”€ Canvas helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Show celebration overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Next attempt / next letter logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNext = useCallback(async () => {
    const features = calculateDrawingFeatures(allPathsRef.current);

    // DTW trajectory accuracy — uses the same 60-point bezier sample the ghost/tracer use.
    // Multi-stroke templates (e.g. 't') use per-stroke bipartite matching so
    // the child's stroke order doesn't affect the score.
    const templatePath   = LETTER_PATHS[letter];
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
          task_order:            LOWERCASE_TASK_ORDER_OFFSET + letterIdx,
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
  }, [attempt, caseType, collectionMode, collectionSessionId, isLastAttempt, isLastLetter, letter, letterIdx,
      resetCanvas, sequence, showCelebrationFor, student.sid]);

  const handleDismissCelebration = useCallback(() => {
    const isAllDone = celebration?.isAllDone;
    setCelebration(null);
    if (isAllDone) {
      if (collectionMode && caseType === 'lowercase') {
        navigation.navigate('UppercaseWriting', {
          student,
          theme,
          letterSequence: DATA_COLLECTION_PROTOCOL.uppercase,
          collectionMode: true,
          collectionSessionId,
        });
      } else {
        navigation.goBack();
      }
    } else if (collectionMode) {
      // Fixed research protocol — always advance in place, never detour
      // through a warm-up. Unchanged from before this branch existed.
      setLetterIdx(i => i + 1);
      setAttempt(1);
    } else {
      // Category boundary mid-session (e.g. straight letters done, curved
      // letters next) — warm up the new primitive before continuing, same
      // gating LetterPracticeScreen does at session start. Detours through
      // a fresh LetterWriting instance starting at the next letter rather
      // than continuing in place, since PreWritingActivityScreen is a
      // separate screen in the stack.
      const nextLetterObj = sequence[letterIdx + 1];
      const group      = nextLetterObj ? getLetterPrimitiveGroup(nextLetterObj.letter) : null;
      const activities = group ? selectPreWritingActivities(group) : [];

      if (activities.length > 0) {
        navigation.navigate('PreWritingActivity', {
          student, theme, activities,
          nextRoute:  'LetterWriting',
          nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx + 1) },
        });
      } else {
        setLetterIdx(i => i + 1);
        setAttempt(1);
      }
    }
  }, [celebration, collectionMode, collectionSessionId, caseType, navigation, student, theme, sequence, letterIdx]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>

        {/* â”€â”€ Header: back · counter · attempt dots â”€â”€ */}
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
                  n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { backgroundColor: 'transparent', borderColor: theme.button },
                  n > attempt  && { backgroundColor: 'transparent', borderColor: theme.button + '40' },
                ]}
              />
            ))}
          </View>
        </View>

        {/* â”€â”€ Main area: letter card LEFT · content RIGHT â”€â”€ */}
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

            {/* Title card: "Write 'A'" + filled sound button */}
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

            {/* Phonetic symbol */}
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

            {/* Writing canvas — canvasOuter wraps the card so the tracer dot
                is never clipped by overflow:hidden */}
            <View style={styles.canvasOuter}>
              <View
                style={[styles.canvasCard, { borderColor: theme.cardOutline ?? '#D0D0D0' }]}
                pointerEvents={attemptFeedback ? 'none' : 'auto'}
                {...panResponder.panHandlers}
              >
                <Svg width={CANVAS_W} height={CANVAS_H}>

                  {/* 4-line ruling */}
                  <Line x1={0} y1={LINE_1} x2={CANVAS_W} y2={LINE_1} stroke="#90CAF9" strokeWidth={1.5} />
                  <Line x1={0} y1={LINE_2} x2={CANVAS_W} y2={LINE_2} stroke="#90CAF9" strokeWidth={1} />
                  <Line x1={0} y1={LINE_3} x2={CANVAS_W} y2={LINE_3} stroke="#EF9A9A" strokeWidth={1.5} strokeDasharray="10,6" />
                  <Line x1={0} y1={LINE_4} x2={CANVAS_W} y2={LINE_4} stroke="#90CAF9" strokeWidth={1.5} />

                  {/* Ghost letter: drawn from LETTER_PATHS so the ghost,
                      tracer dot, and DTW template all share one shape. */}
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
                  {/* Attempt 2: stroke-order start dot */}
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

                  {/* Completed strokes */}
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

                  {/* Live stroke */}
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

              {/* Tracer dot lives outside overflow:hidden.
                  tracerXInterp/tracerYInterp are Animated.interpolation nodes
                  derived from tracerProgress — they follow the exact bezier curve
                  that the ghost Path renders, not the raw waypoint chords. */}
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

        {/* â”€â”€ Feedback pill â”€â”€ */}
        {/* â”€â”€ Action buttons â”€â”€ */}
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

        {/* â”€â”€ Attempt dots â”€â”€ */}
        <View style={styles.bottomDots}>
          {[1, 2, 3].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                n === attempt && { borderColor: theme.button },
                n > attempt  && { borderColor: theme.button + '40' },
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

        {/* â”€â”€ Category celebration overlay â”€â”€ */}
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe:     { flex: 1 },

  // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Main two-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  mainRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: PAD,
    paddingBottom: 4,
  },

  // Left: letter card column
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

  // Right: stacked content column
  contentCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },

  // Title card: "Write 'A'" + sound button
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

  // Attempt badge (inside right column)
  attemptBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  attemptTitle: { fontSize: 12, fontWeight: '800' },
  attemptHint:  { fontSize: 10, marginTop: 2, textAlign: 'center', opacity: 0.85 },

  // Canvas
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

  // â”€â”€ Tracer dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Feedback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  feedbackBadge: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  feedbackText: { fontSize: 13, fontWeight: '700' },

  // â”€â”€ Attempt dots (bottom) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  bottomDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },

  // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Celebration overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  celebTitle:    { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  celebMessage:  { fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  celebNextBadge:{
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
  },
  celebNextLabel:{ fontSize: 13, color: '#777777' },
  celebNextValue:{ fontSize: 13, fontWeight: '800' },
  celebStars:    { flexDirection: 'row', gap: 8, marginBottom: 24 },
  celebBtn:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 40, paddingVertical: 14, borderRadius: 50, width: '100%',
  },
  celebBtnText:  { fontSize: 17, fontWeight: '800' },
});
