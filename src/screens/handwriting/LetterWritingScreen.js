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
import { storeLetterProgress } from '../../utils/storage';
import { clampToCanvas, isImplausibleJump, pageToLocal } from '../../utils/touchPointSanitize';
import { getAllLetters } from '../../constants/letterCategories';
import { fetchMasteredLetters, filterUnmasteredSequence } from '../../utils/masteredLetterFiltering';
import { useLearningSessionActivity } from '../../context/LearningSessionContext';
import BreakPromptModal from '../../components/handwriting/BreakPromptModal';
import { LIVE_ACTIVITY_TYPES } from '../../constants/liveSessionPolicy';
import { buildProgressPatch, buildScorePatch } from '../../utils/liveSessionSnapshot';
import { DATA_COLLECTION_PROTOCOL } from '../../constants/dataCollectionProtocol';
import { featuresToScore, DTW_CORRECT_THRESHOLD } from '../../utils/adaptiveSequencing';
import { computeDTW, sampleSmoothPath, normalizeStrokes, computeMultiStrokeDTW } from '../../utils/dtw';
import { buildDtwDebugExport } from '../../utils/dtwDebugExport';
import { useToast } from '../../context/ToastContext';
import client from '../../api/client';
import { ENDPOINTS } from '../../constants/api';
import AttemptAvatarFeedback from './AttemptAvatarFeedback';
import {
  getDeviceMetadata, PROTOCOL_VERSION, FEATURE_VERSION, TEMPLATE_VERSION, NORMALIZATION_VERSION,
} from '../../utils/collectionSession';
import { getLetterPrimitiveGroup, selectPreWritingActivities, getPreWritingActivityById } from '../../constants/preWritingActivities';
import {
  createPreWritingInteractionId, markWarmupHandled, buildPreWritingNavigationParams, PRE_WRITING_REASON,
  hasWarmupHandled, resolveAdaptivePreWritingDetour,
} from '../../utils/preWritingSessionGuard';
// One-time category demonstration — see utils/demoPolicy.js. Decides only;
// writes nothing until the child presses "I'm Ready" on the demo screen.
import { useDemoDetour } from '../../utils/demoDetour';
import { makeLetterCategoryDemoKey } from '../../utils/demoPolicy';
import { SUPPORT_LEVELS, getSupportPresentation, resolveSessionSupportLevel } from '../../constants/handwritingSupportLevels';
import { buildSessionAttemptRecord } from '../../utils/handwritingAttemptPayload';
import { fetchRecommendedStartSupport, shouldApplyRecommendation, resolveRecommendedStartSupport } from '../../utils/supportRecommendation';
import { fetchPreWritingRecommendation } from '../../utils/preWritingRecommendation';
import { fetchRepetitionRecommendation } from '../../utils/repetitionRecommendation';
import { DEMO_SPEED_LEVELS, getStrokeDurationForLevel } from '../../constants/demoSpeedLevels';
import {
  fetchDemoSpeedRecommendation, shouldApplyDemoSpeedRecommendation, resolveRecommendedDemoSpeedLevel,
} from '../../utils/demoSpeedRecommendation';
import { resolveActualDemoSpeedLevel } from '../../utils/demoSpeedPersistence';
import { getAdaptiveRepetitionsUsed, incrementAdaptiveRepetitionsUsed } from '../../utils/repetitionSessionGuard';
import { insertSpacedRepetition } from '../../utils/controlledRepetition';
// The two-cycle-per-practice-date ceiling. Before this, a failed cycle
// reset the child to attempt 1 on the SAME letter with nothing bounding it.
import {
  recordCycleCompleted, getCyclesUsed, MAX_CYCLES_PER_LETTER_PER_DATE, MASTERY_ATTEMPT_NUMBER, MASTERY_ATTEMPT_INDEX,
} from '../../utils/letterCycleGuard';
import {
  calculateTotalDistance, calculateAverageSpeed, calculateSpeedStats, calculatePauseMetrics,
  calculateAttemptDurationFromAbsoluteTime, calculateAttemptAverageSpeed, calculateAttemptPauseMetrics,
} from '../../utils/trajectoryFeatures';
import { useLockLandscape } from '../../utils/useOrientationLock';
import useGatedBack from '../../utils/useGatedBack';
// The shared letter-writing presentation - this screen and the demonstration
// render the SAME component, in different modes.
import LetterWritingStage from '../../components/handwriting/LetterWritingStage';
import {
  SUPPORT_BADGE, SUPPORT_INSTRUCTIONS, SUPPORT_HINTS,
} from '../../components/handwriting/LetterWritingStage';
import {
  PAD, COL_L, LETTER_CARD_SIZE, CANVAS_W, CANVAS_H, ASPECT, aspectX,
  LINE_1, LINE_2, LINE_3, LINE_4,
} from '../../constants/letterCanvasLayout';

// Shapes occupy task_order 0-5 in the collection protocol; lowercase
// letters continue from 6, matching DATA_COLLECTION_PROTOCOL's fixed order.
const LOWERCASE_TASK_ORDER_OFFSET = 6;

// Canvas geometry (CANVAS_W/CANVAS_H, the 4-line ruling, the aspect
// correction, the column split) now lives in ONE place, imported above and
// shared with the "watch first" demonstration, so a demo can never render
// this letter at a different size. Every value is unchanged - the module is
// a move of this screen's own declarations, not a redesign.

// â”€â”€â”€ Support badge colours (small indicator only — theme bg is never changed) â”€
// Feature 3 Step 2: keyed by SUPPORT_LEVELS (high/medium/low) instead of raw
// attempt number — the badge describes the guidance being shown right now,
// which is a support-level concept, not a session-position one. Values are
// byte-identical to the pre-refactor ATTEMPT_BADGE/ATTEMPT_TITLES/
// ATTEMPT_HINTS — only the lookup key changed (attempt → supportLevel).

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
  // utils/trajectoryFeatures.js's module doc comment. `duration_ms`/
  // `avg_speed`/`pauseCount`/`pause_frequency`/`pause_duration_ratio` above
  // and below are completely untouched; attempt_* are new, additive fields
  // only, never used for existing scoring/pass-fail (Part 6-9 of the
  // duration-correction pass).
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
// Feature 6 Step 4 — this constant is NO LONGER the runtime source of truth
// for the tracer animation below (that now goes through
// getStrokeDurationForLevel()/constants/demoSpeedLevels.js, byte-identical
// to this value at 'standard' speed). It is kept only because the
// already-dead getSegmentDuration() (Step 1 audit finding — never called
// anywhere in this file) still references it; removing either is out of
// scope for this step (spec §23 — no unrelated cleanup).
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
  // The handwriting activities are designed for a tablet held in landscape:
  // the canvas, tracer and avatar feedback all assume a wide viewport. Locked
  // on focus, released on blur — see utils/useOrientationLock.js. The teacher
  // progress report is the one screen that locks portrait instead.
  useLockLandscape();

  // Leaving a learning activity is an adult decision — the back button
  // opens the parent gate first, exactly as LetterHomeScreen and the
  // Concept screens do. Cancelling navigates nowhere.
  const { requestBack, gateModal } = useGatedBack(() => navigation.goBack());

  const {
    student,
    theme,
    caseType        = 'lowercase',
    letterSequence  = [],
    collectionMode  = false,
    collectionSessionId = null,
    interactionId: interactionIdParam = null,
    // Present only when this run is a Writing Check batch. Its ONLY effect is
    // where the flow goes when the batch finishes - capture, attempts,
    // scoring and every collection-mode behaviour are untouched.
    writingCheckId = null,
  } = route.params;

  // Feature 4 Step 3: normally seeded by LetterPracticeScreen and carried
  // through route params. A couple of entry points (AssessmentCompleteScreen,
  // ShapeAssessmentScreen) navigate straight into 'LetterWriting', bypassing
  // LetterPracticeScreen entirely — for those, fall back to a fresh id
  // generated once for the life of this mount (lazy initializer, never
  // regenerated on re-render) so this screen's own category-boundary guard
  // marking still has a stable interaction identity to use.
  const [interactionId] = useState(() => interactionIdParam ?? createPreWritingInteractionId());

  const baseSequence = useMemo(() => {
    const filtered = letterSequence.filter(l => l.caseType === caseType);
    return filtered.length > 0 ? filtered : getAllLetters(caseType);
  }, [letterSequence, caseType]);

  const { show } = useToast();

  // Proposal FR-13, Phase 7A — registers this screen as active learning
  // time for as long as it's mounted (never independent per-screen timer
  // logic — see LearningSessionContext.js). notifyStrokeStart/End are
  // wired into the PanResponder below so the break prompt can never
  // interrupt an in-progress stroke.
  // collection_mode is a fixed, teacher-supervised research-capture protocol,
  // not open-ended self-paced practice — FR-13's break flow AND FR-16's
  // live-session monitoring are both excluded from it entirely (spec item
  // 13 / Phase 7B spec §19; see useLearningSessionActivity's own doc).
  // Proposal FR-16, Phase 7B — studentId/activityType give this screen a
  // live-session identity; notifyLiveSessionUpdate pushes its own
  // meaningful events below (letter/attempt/support changed, saved score).
  const { notifyStrokeStart, notifyStrokeEnd, notifyLiveSessionUpdate } = useLearningSessionActivity({
    suspend: collectionMode,
    studentId: student.sid,
    activityType: LIVE_ACTIVITY_TYPES.LOWERCASE_LETTER,
  });

  // Feature 11B Phase 5 §2-§5 — normal-progression fix (NOT a Feature 11B
  // adaptation change): skip already-mastered letters and resume at the
  // first remaining unmastered one, using the backend's authoritative
  // LetterProgress state (never frontend AsyncStorage). Collection mode is
  // a fixed research protocol and must always present its exact
  // predetermined sequence unfiltered — never skips anything.
  //
  // masteredSequenceReady starts false and gates the main render below
  // (mirrors WelcomeScreen's checkingReturningStudent gate) so the child
  // never sees a flash of an already-mastered letter's template before it
  // gets swapped out — filtering must be decided before the first letter
  // is ever shown, unlike the non-blocking recommendation fetches above.
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
        // Every letter in this case is already mastered — nothing left to
        // present. Reuse the existing goBack() destination the all-done
        // celebration already uses, rather than rendering an empty screen.
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

  // Feature 5 Step 3 — `sequence` is the mastery-filtered base sequence
  // (Feature 11B Phase 5 above) UNLESS a spaced adaptive repetition has
  // been inserted this mount, in which case `runtimeSequence` (the
  // immutable result of insertSpacedRepetition()) takes over.
  const [runtimeSequence, setRuntimeSequence] = useState(null);
  const sequence = runtimeSequence ?? effectiveSequence ?? baseSequence;

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [letterIdx,    setLetterIdx]    = useState(0);
  const [attempt,      setAttempt]      = useState(1);
  const [currentPath,  setCurrentPath]  = useState([]);
  const [allPaths,     setAllPaths]     = useState([]);
  const [hasDrawn,     setHasDrawn]     = useState(false);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [celebration,  setCelebration]  = useState(null);
  const [reduceMotion,  setReduceMotion] = useState(false);

  // Feature 3 Step 6 — the adaptive support recommendation, tagged with the
  // exact letter it was resolved for. Reading it back below via
  // `recommendation.letter === letter` (rather than trusting effect-cleanup
  // timing alone) guarantees a stale previous letter's recommendation can
  // never leak into a newly-started letter, even for the render tick before
  // the fetch effect itself would otherwise reset it.
  const [recommendation, setRecommendation] = useState({ letter: null, startSupport: null });

  // Feature 6 Step 4 — the adaptive demo-speed recommendation, tagged with
  // the exact (letter, caseType) it was resolved for — same double-layer
  // staleness guarantee as `recommendation` above (see
  // utils/demoSpeedRecommendation.js's resolveRecommendedDemoSpeedLevel).
  // Default is `standard`, so the very first render — and any render before
  // this letter's own fetch resolves — reproduces today's exact, unmodified
  // tracer speed (spec §15/§16).
  const [demoSpeedRecommendation, setDemoSpeedRecommendation] = useState({
    letter: null, caseType: null, speedLevel: DEMO_SPEED_LEVELS.STANDARD,
  });

  // â”€â”€ Refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startTimeRef       = useRef(null);
  const allPathsRef        = useRef([]);
  // Border-touch bug fix — see touchPointSanitize.js.
  const canvasRef       = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  const measureCanvasOrigin = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y) => { canvasOriginRef.current = { x, y }; });
  }, []);
  const attemptScoresRef   = useRef([]);   // accumulates featuresToScore result for each attempt
  // Server-issued retry key for a capture-fault cycle; null at all other times.
  const retrySessionKeyRef = useRef(null);
  const sessionAttemptsRef = useRef([]);   // ML: accumulates {attempt_number, features, strokes} per letter
  const strokeIdCounter    = useRef(0);    // ML: counts strokes within the current attempt
  // Feature 3 Step 6 — mirrors of attempt/hasDrawn state, read inside the
  // recommendation fetch's async callback (which cannot safely read fresh
  // React state directly) to decide whether it's still safe to apply an
  // arriving recommendation: never retroactively change support once the
  // child has already started drawing this letter's first attempt.
  const attemptRef  = useRef(1);
  const hasDrawnRef = useRef(false);
  // Feature 5 Step 3 — incremented at the top of every handleNext() call
  // (both success and failure). The repetition-recommendation fetch started
  // inside a failed cycle captures the token AT THAT MOMENT; when the fetch
  // resolves, it compares against the CURRENT value here. If a newer cycle
  // has since started — whether a fresh failure/retry OR the letter finally
  // SUCCEEDING and advancing — the token will have moved on, and the stale
  // response is discarded rather than inserting a repetition for a letter
  // the child has already left (spec §30/§32/§33/§34 — this single counter
  // covers both the staleness and the concurrent-request-protection
  // requirements at once).
  const cycleTokenRef = useRef(0);

  // True while a completion cycle (including its network POST) is running.
  // See handleNext's own comment for why this guard exists and why it is a
  // ref rather than state.
  const submitInFlightRef = useRef(false);
  attemptRef.current  = attempt;
  hasDrawnRef.current = hasDrawn;

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

  // Feature 3 Step 2 — formal support-level model. `attempt` remains the
  // single source of truth for session position (progression, dots, score
  // indexing — all untouched below); `supportLevel`/`supportPresentation`
  // are pure, derived-every-render values (same pattern as guideOpacity/
  // badge already used) that now own every "how much guidance is shown"
  // decision.
  //
  // Feature 3 Step 6 — normal mode now derives supportLevel from the
  // adaptive sequence (starting point = the backend's read-only
  // recommendation for THIS letter, or the legacy default when none has
  // (yet) resolved). Collection mode is completely untouched: it still
  // resolves via the fixed Step 2 identity mapping, never consulting the
  // adaptive recommendation at all (spec §17). Feature 3 Step 7 extracted
  // this whole branch into resolveSessionSupportLevel() (see
  // constants/handwritingSupportLevels.js) so the collection-mode
  // guarantee is directly unit-testable without RN component rendering —
  // same behavior as before, just named and independently provable now.
  const recommendedStartSupport = resolveRecommendedStartSupport({ recommendation, currentLetter: letter });
  const supportLevel = resolveSessionSupportLevel({ attempt, collectionMode, recommendedStartSupport });
  const supportPresentation = getSupportPresentation({ supportLevel, attempt, collectionMode });

  // Feature 6 Step 4 — demo-speed resolution. `recommendedDemoSpeedLevel` is
  // ONLY the backend's software recommendation (what Feature 2/3 signals
  // suggest); it says nothing about whether a tracer is actually on screen.
  // `actualDemoSpeedLevel` (utils/demoSpeedPersistence.js's
  // resolveActualDemoSpeedLevel, unmodified since Step 3) is the
  // persistence-semantics-correct value — `null` unless the tracer is truly
  // being rendered right now (HIGH support, tracer actually shown, no
  // reduce-motion, not collection mode). `effectiveDemoSpeedLevel` is what
  // the animation itself uses: `actualDemoSpeedLevel ?? standard`, so a
  // `null` (no tracer showing) never reaches the duration calculation as
  // anything other than the safe default (spec §31).
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
  // attempt 2→0.26, normal-mode attempt 3→0, collection-mode attempt 3→0.26)
  // — now resolved by getSupportPresentation() instead of an inline ternary.
  const guideOpacity  = supportPresentation?.guideOpacity ?? 0;
  const phonetic      = PHONETICS[letter.toLowerCase()] ?? '';
  const badge         = SUPPORT_BADGE[supportLevel];

  // Proposal FR-16, Phase 7B — one bundled "meaningful event" push whenever
  // the letter, attempt number, or support level changes (spec §8/§3). Not
  // sent in collection_mode (notifyLiveSessionUpdate is already a no-op
  // there — the hook never wires the live-session identity for it).
  useEffect(() => {
    if (collectionMode) return;
    notifyLiveSessionUpdate(buildProgressPatch({
      currentItem: letter, caseType, attemptNumber: attempt, supportLevel,
    }));
  }, [letter, caseType, attempt, supportLevel, collectionMode, notifyLiveSessionUpdate]);

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

  // â”€â”€ Feature 3 Step 6 — adaptive support recommendation fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Once per letter (never per render, never per stroke, never polled —
  // spec §18). Skipped entirely in collection mode (spec §17) — the fixed
  // research protocol must never even attempt this network call. Renders
  // the legacy default sequence (getAdaptiveSupportSequence's own fallback)
  // for the entire time this is pending or fails — no loading UI, no
  // blocked interaction (spec §19/§20).
  useEffect(() => {
    if (collectionMode) return;
    let cancelled = false;

    fetchRecommendedStartSupport({ studentId: student.sid, letter, caseType }).then((startSupport) => {
      if (cancelled) return;
      // Only apply if the child hasn't already started drawing this
      // letter's first attempt — never retroactively change support
      // mid-attempt (spec §19). If they've already started, this letter
      // simply keeps the legacy sequence it already began rendering with.
      if (shouldApplyRecommendation({ currentAttempt: attemptRef.current, hasDrawnCurrentAttempt: hasDrawnRef.current })) {
        setRecommendation({ letter, startSupport });
      }
    });

    return () => { cancelled = true; };
  }, [letter, caseType, collectionMode, student.sid]);

  // ── Feature 6 Step 4 — adaptive demo-speed recommendation fetch ───────────
  // Once per letter (never per render, never per stroke, never polled —
  // mirrors the Feature 3 fetch effect immediately above; completely
  // independent of it, spec §43/§44). Skipped entirely in collection mode
  // (spec §13, HARD REQUIREMENT) — collection must never even attempt this
  // network call. Renders `standard` (this screen's own already-shipped
  // speed) for the entire time this is pending or fails — no loading UI, no
  // blocked interaction (spec §5/§40).
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

  // ── Feature 4 Step 5 — adaptive pre-writing recommendation fetch + detour ──
  // Once per letter (never per render, never per stroke) — completely
  // independent of the Feature 3 fetch effect just above (spec §26: the two
  // adaptive fetches must never be coupled; they may resolve in any order).
  // Skipped entirely in collection mode (spec §9/§25). Unlike Feature 3's
  // recommendation, this one never needs to live in React state — it only
  // ever drives a one-time navigation side effect, never a render decision.
  useEffect(() => {
    if (collectionMode) return;
    let cancelled = false;

    fetchPreWritingRecommendation({ studentId: student.sid, letter, caseType }).then((recommendation) => {
      if (cancelled) return;

      const activity = recommendation.activityId
        ? getPreWritingActivityById(recommendation.activityId)
        : null;

      // The Step 3 guard — true if the fixed session-start/category-boundary
      // trigger (or an earlier adaptive detour) already warmed up THIS
      // exact letter for THIS exact interaction (spec §19/§20/§25).
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
      });

      if (!decision.shouldNavigate) return;

      // Mark BEFORE navigating — same "mark on open" discipline the two
      // fixed triggers already use (Step 3/Step 5 spec §11/§12): teacher
      // skip and a failed POST /pre-writing-activity save must still count
      // as handled, and this call never depends on either succeeding.
      markWarmupHandled({
        studentId: student.sid, caseType, letter, interactionId,
        reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
      });

      navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
        student, theme, activities: [activity], // exactly one activity (spec §17) — never the group's full pool
        targetLetter: letter, targetCaseType: caseType, interactionId,
        reason: PRE_WRITING_REASON.ADAPTIVE_DIFFICULTY,
        nextRoute: 'LetterWriting',
        // sequence.slice(letterIdx) — NOT letterIdx + 1 — so the SAME target
        // letter is still active[0] on return, unlike the category-boundary
        // detour's slice(letterIdx + 1) (spec §13/§14).
        nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx) },
      }));
    });

    return () => { cancelled = true; };
  }, [letter, caseType, collectionMode, student.sid, interactionId, letterIdx, sequence, navigation, student, theme]);


  // ── One-time category demonstration (utils/demoPolicy.js) ────────────────
  // The FIRST time this child meets a motor category — lowercase straight,
  // uppercase curved, and so on — they are taken to a full-screen "watch
  // first" demonstration of the real target letter before Attempt 1.
  //
  // This is NOT Attempt 1, and it does not replace it. Attempt 1 keeps its
  // HIGH support and its own on-canvas tracer exactly as before; the demo
  // adds the one thing that tracer cannot, a moment where the child is
  // asked to watch and there is nothing to draw on. Attempts 1/2/3 and
  // everything downstream of them are untouched.
  //
  // Once per category, ever — not per letter and not per session. The
  // second letter of the same category goes straight to Attempt 1.
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
        nextRoute: 'LetterWriting',
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

  // â”€â”€ Tracer dot animation for HIGH support (originally "Attempt 1") â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const rawPath = LETTER_PATHS[letter];
    if (reduceMotion || !supportPresentation?.showAnimatedTracer || hasDrawn || !rawPath || rawPath.length < 1) {
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
      // Feature 6 Step 4 — was `Math.max(600, Math.round(len / TRACER_PX_PER_MS))`.
      // getStrokeDurationForLevel() (constants/demoSpeedLevels.js) reproduces
      // that exact formula byte-for-byte whenever effectiveDemoSpeedLevel is
      // 'standard' (spec §26 backward-compatibility) — the 600ms floor and
      // 0.28 px/ms baseline both live in that one shared helper now, so this
      // screen no longer duplicates them (spec §21/§23).
      const dur = getStrokeDurationForLevel(len, effectiveDemoSpeedLevel);
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
    // supportPresentation.showAnimatedTracer is derived from attempt +
    // collectionMode (+ recommendedStartSupport in normal mode, Feature 3
    // Step 6) — depending on those primitives instead of the whole
    // (non-memoized, new-every-render) supportPresentation object keeps
    // this effect's re-run triggers correct without an infinite loop.
    // effectiveDemoSpeedLevel (Feature 6 Step 4) is added for the same
    // reason: a demo-speed recommendation arriving while the tracer is
    // already looping (but before the child has drawn anything) must
    // restart the loop at the correct speed, exactly like
    // recommendedStartSupport already does for support-level changes.
  }, [attempt, collectionMode, effectiveDemoSpeedLevel, hasDrawn, letter, reduceMotion, recommendedStartSupport, tracerProgress]);

  // â”€â”€ Show feedback badge after first stroke â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ PanResponder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => {
        notifyStrokeStart(); // FR-13 — a stroke is now in progress; the break prompt must not appear
        setAttemptFeedback(null);
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x: locationX, y: locationY } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
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
        const local = pageToLocal(evt.nativeEvent.pageX, evt.nativeEvent.pageY, canvasOriginRef.current);
        const { x: locationX, y: locationY } = clampToCanvas(local.x, local.y, CANVAS_W, CANVAS_H);
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
  const runNextCycle = useCallback(async () => {
    // Feature 5 Step 3 — a fresh token for THIS cycle (success or failure),
    // incremented before anything else in handleNext runs. Captured by
    // scheduleAdaptiveRepetitionIfEligible() below so its async response
    // can tell whether a NEWER cycle (another failure/retry, or this
    // letter finally succeeding) has since started — see cycleTokenRef's
    // own declaration for the full rationale.
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
          case_label: 'lowercase',
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

      // Cycle 2, immediately, on the same letter - attempt numbering restarts
      // at 1, exactly as cycle 1 did.
      setAttempt(1);
      resetCanvas();
    };


    // Feature 5 Step 3 — evaluates whether the cycle that is ABOUT TO FAIL
    // should schedule ONE spaced repetition later in `sequence`. Fire-and-
    // forget: never awaited by either failure branch below — the existing
    // immediate retry (setAttempt(1)/resetCanvas(), unchanged) must never
    // be delayed or blocked by this network call (spec §2/§12/§31).
    // Collection mode never calls this at all (spec §42). Captures every
    // piece of "this failed cycle's" identity (letter/caseType/letterObj/
    // letterIdx/sequence) from the current closure, which is guaranteed
    // fresh for THIS invocation of handleNext.
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
        // Stale-response / concurrent-request safety (spec §32/§33/§34):
        // if a newer cycle has since started — another failure/retry, OR
        // this letter finally succeeding and letterIdx advancing — discard
        // rather than inserting into a sequence position the child has
        // already moved past. Letter/case are also checked defensively,
        // matching Feature 4's own "two independent layers" discipline,
        // even though within one screen mount they cannot actually differ
        // from what was requested.
        if (myCycleToken !== cycleTokenRef.current) return;
        if (recommendation.letter !== failedLetter || recommendation.caseType !== failedCaseType) return;
        if (!recommendation.shouldRepeat) return;

        const { sequence: nextSequence, inserted } = insertSpacedRepetition({
          sequence: failedSequence, currentIndex: failedLetterIdx, targetLetterEntry: failedLetterObj, interactionId,
        });
        if (!inserted) return; // e.g. a repetition for this exact target is already pending

        // Increment ONLY after a real insertion actually happens (spec §10)
        // — never merely because the backend said shouldRepeat=true.
        setRuntimeSequence(nextSequence);
        incrementAdaptiveRepetitionsUsed({
          studentId: student.sid, caseType: failedCaseType, letter: failedLetter, interactionId,
        });
      });
    };

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

    // ML: snapshot before resetCanvas() wipes allPathsRef.
    // Feature 3 Step 3: support_level is the exact value this render used
    // for THIS attempt (supportLevel, derived above via
    // resolveSessionSupportLevel — never recomputed differently here).
    // Feature 6 Step 5: demo_speed_level is `actualDemoSpeedLevel` — the
    // ACTUAL value resolveActualDemoSpeedLevel() resolved for THIS attempt
    // (null unless a tracer genuinely rendered), never the raw backend
    // recommendation (spec §35/§39).
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
          task_order:            LOWERCASE_TASK_ORDER_OFFSET + letterIdx,
          // Null except immediately after a capture fault — see
          // handleCaptureIncomplete.
          retry_session_key:     retrySessionKeyRef.current,
          ...getDeviceMetadata(),
        });

        // Proposal FR-16, Phase 7B — a saved attempt result just persisted
        // (spec §3/§8's "latest_saved_score if available"). Never sent in
        // collection_mode. The score itself, never raw strokes.
        if (!collectionMode && attemptScoresRef.current.length > 0) {
          notifyLiveSessionUpdate(buildScorePatch(Math.max(...attemptScoresRef.current)));
        }
        // Coverage-fix audit: the server's `completed` result is now the
        // sole signal — it already reflects a coverage/geometry check (see
        // attemptCoverageValidity.js), so the client no longer second-
        // guesses a confirmed pass with its own wroteCorrectly. wroteCorrectly
        // is still computed/sent/logged and still drives the cosmetic
        // per-attempt badge above (setAttemptFeedback) — it just can't force
        // a retry the database already recorded as complete.
        if (!collectionMode && response.data.completed === false) {
          // P1 — a technical capture fault is not a failed cycle. The server
          // states this explicitly rather than us inferring it from the cycle
          // count, because "I did not count this" and "my count read failed"
          // must never be confused.
          if (response.data.cycle_consumed === false) {
            handleCaptureIncomplete(response.data.retry_session_key);
            return;
          }
          if (response.data.completed === false) {
            show('Keep practising — try again!', 'info');
          }
          // Feature 5 Step 3 — a full 3-attempt cycle has now definitively
          // failed (backend-confirmed). Schedule (never await) the spaced-
          // repetition evaluation before the existing immediate retry
          // proceeds exactly as it always has.
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
          // Feature 5 Step 3 — same activation point as the backend-
          // confirmed failure above: a network error still means this
          // cycle failed locally and will immediately retry exactly as
          // before.
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
  }, [attempt, actualDemoSpeedLevel, caseType, collectionMode, collectionSessionId, isLastAttempt, isLastLetter, letter, letterIdx,
      letterObj, interactionId, resetCanvas, sequence, showCelebrationFor, student.sid, supportLevel]);

  // ── Double-submit guard ──────────────────────────────────────────────────
  // The Next button is disabled only while `attemptFeedback` is showing, and
  // that flag is cleared BEFORE the completion POST is sent. Between the
  // feedback clearing and the response landing the button is live again, so a
  // second tap fires a whole second completion — a duplicate set of attempt
  // rows under a NEW session_key.
  //
  // Live data confirms this happens: 10 pairs of attempt-3 rows for the same
  // student and letter exist less than 3 seconds apart under different
  // session_keys. Feature 7 dedupes by session_key, so those two bursts count
  // as two independent longitudinal cycles rather than the one the child
  // actually performed.
  //
  // A ref, not state: two taps in the same frame would both read a stale
  // `false` from state before either re-render, so the check must be
  // synchronous. Cleared in `finally` so a failed/rejected cycle can be
  // retried normally.
  const handleNext = useCallback(async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
      await runNextCycle();
    } finally {
      submitInFlightRef.current = false;
    }
  }, [runNextCycle]);

  const handleDismissCelebration = useCallback(() => {
    const isAllDone = celebration?.isAllDone;
    setCelebration(null);
    if (isAllDone) {
      if (writingCheckId) {
        // A Writing Check batch is finished. Go back to the check, which
        // re-reads progress and either hands over the uppercase batch or
        // completes. Never into the research data-collection protocol, whose
        // uppercase list is a different set of letters entirely.
        navigation.navigate('WritingCheck', { student, theme });
      } else if (collectionMode && caseType === 'lowercase') {
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
        // Feature 4 Step 3: mark BEFORE navigating (see
        // preWritingSessionGuard.js) and thread interactionId through so a
        // later PreWritingActivity detour later in this same sequence can
        // still tell this letter was already warmed up this interaction.
        markWarmupHandled({
          studentId: student?.sid, caseType, letter: nextLetterObj.letter, interactionId,
          reason: PRE_WRITING_REASON.CATEGORY_TRANSITION,
        });
        navigation.navigate('PreWritingActivity', buildPreWritingNavigationParams({
          student, theme, activities,
          targetLetter: nextLetterObj.letter, targetCaseType: caseType, interactionId,
          reason: PRE_WRITING_REASON.CATEGORY_TRANSITION,
          nextRoute:  'LetterWriting',
          nextParams: { student, theme, caseType, letterSequence: sequence.slice(letterIdx + 1) },
        }));
      } else {
        setLetterIdx(i => i + 1);
        setAttempt(1);
      }
    }
  }, [celebration, collectionMode, collectionSessionId, caseType, navigation, student, theme, sequence, letterIdx, interactionId, writingCheckId]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Feature 11B Phase 5 — blank gate until the mastery-filtered sequence
  // is known, so the child never sees a flash of an already-mastered
  // letter's template before it swaps out. Mirrors WelcomeScreen's
  // checkingReturningStudent gate.
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

        {/* â”€â”€ Header: back · counter · attempt dots â”€â”€ */}
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
                  n < attempt  && { backgroundColor: theme.button, borderColor: theme.button },
                  n === attempt && { backgroundColor: 'transparent', borderColor: theme.button },
                  n > attempt  && { backgroundColor: 'transparent', borderColor: theme.button + '40' },
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
          phonetic={phonetic}
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
          badgeTitle={`Attempt ${attempt} · ${SUPPORT_INSTRUCTIONS[supportLevel]}`}
          badgeHint={SUPPORT_HINTS[supportLevel]}
          onPlaySound={() => playLetterSound()}
          canvasRef={canvasRef}
          onCanvasLayout={measureCanvasOrigin}
          panHandlers={panResponder.panHandlers}
          canvasPointerEvents={attemptFeedback ? 'none' : 'auto'}
        />

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
            supportLevel={attemptFeedback.supportLevel}
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
  // Left: letter card column
  // Right: stacked content column
  // Title card: "Write 'A'" + sound button
  // Attempt badge (inside right column)
  // Canvas
  // â”€â”€ Tracer dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
