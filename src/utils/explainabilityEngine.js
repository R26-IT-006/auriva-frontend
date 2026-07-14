/**
 * explainabilityEngine.js
 *
 * Client-side rule-based motor difficulty analyser.
 * Mirrors the backend explainabilityService so the TeacherReport works
 * fully offline without a network call.
 *
 * Input:
 *   assessmentData : [{ shapeId, features: { smoothness, avg_deviation } }]
 *   letterMetrics  : { avgPauses, avgTime } (optional)
 *   motorScore     : number (optional pre-computed 0-100 score)
 *
 * Output: structured explanation object (see analyzeMotorDifficulty)
 */

// ─── Difficulty rules (mirrors difficultyRules.js on the backend) ─────────────

const DIFFICULTY_RULES = {

  WEAK_CURVE_CONTROL: {
    label: 'Weak Curve Control',
    description: 'Difficulty forming smooth, continuous curved strokes such as circles and arcs.',
    icon: 'ellipse-outline',
    color: '#7B1FA2',
    bgColor: '#F3E5F5',
    conditions: [
      { featureKey: 'curveSmoothnessNorm',  featureName: 'Curve Smoothness',    threshold: 30, weight: 40, hint: 'Unsteady movements during curved strokes' },
      { featureKey: 'pauseNorm',            featureName: 'Pause Frequency',      threshold: 40, weight: 30, hint: 'Frequent mid-stroke pauses' },
      { featureKey: 'curveDeviationNorm',   featureName: 'Curve Accuracy',       threshold: 30, weight: 20, hint: 'Straying from the intended curve path' },
      { featureKey: 'speedNorm',            featureName: 'Speed Consistency',    threshold: 20, weight: 10, hint: 'Inconsistent writing speed' },
    ],
    explanationTemplates: {
      curveSmoothnessNorm: 'Unsteady hand movements during curved strokes affected writing smoothness.',
      pauseNorm:           'Frequent mid-stroke pauses interrupted continuous curve formation.',
      curveDeviationNorm:  'Strokes drifted from the intended curved path.',
      speedNorm:           'Inconsistent writing speed disrupted curved stroke rhythm.',
    },
    exercises: [
      { text: 'Circle tracing exercises',                    priority: 'high'   },
      { text: 'Letter C and O practice',                     priority: 'high'   },
      { text: 'Slow curved stroke repetition',               priority: 'medium' },
      { text: 'Half-circle tracing with visual guides',      priority: 'medium' },
      { text: 'Air-writing large circles before pencil use', priority: 'low'    },
    ],
    letterFocus: ['c', 'o', 'e', 'a', 'g', 'd', 'q', 'u'],
  },

  WEAK_STRAIGHT_LINE: {
    label: 'Weak Straight-Line Control',
    description: 'Difficulty maintaining straight, controlled line strokes.',
    icon: 'remove-outline',
    color: '#1565C0',
    bgColor: '#E3F2FD',
    conditions: [
      { featureKey: 'lineDeviationNorm',    featureName: 'Line Accuracy',        threshold: 40, weight: 40, hint: 'High deviation from straight-line path' },
      { featureKey: 'lineSmoothnessNorm',   featureName: 'Line Smoothness',      threshold: 30, weight: 30, hint: 'Unsteady straight-line movements' },
      { featureKey: 'pauseNorm',            featureName: 'Pause Frequency',      threshold: 40, weight: 20, hint: 'Pauses interrupting line flow' },
      { featureKey: 'speedNorm',            featureName: 'Speed Consistency',    threshold: 20, weight: 10, hint: 'Inconsistent speed affecting steadiness' },
    ],
    explanationTemplates: {
      lineDeviationNorm:  'High deviation from the ideal straight-line path was detected.',
      lineSmoothnessNorm: 'Unsteady hand movements during straight-line strokes.',
      pauseNorm:          'Frequent pauses interrupted the continuous line flow.',
      speedNorm:          'Inconsistent writing speed affected line steadiness.',
    },
    exercises: [
      { text: 'Horizontal line tracing exercises',     priority: 'high'   },
      { text: 'Vertical line exercises',               priority: 'high'   },
      { text: 'Letters L, T, H, I, E practice',        priority: 'medium' },
      { text: 'Ruler-guided tracing activities',       priority: 'medium' },
      { text: 'Whiteboard arm-movement line tracing',  priority: 'low'    },
    ],
    letterFocus: ['l', 't', 'h', 'i', 'e', 'f', 'b', 'p'],
  },

  ZIGZAG_INSTABILITY: {
    label: 'Zigzag Instability',
    description: 'Difficulty with direction changes and diagonal strokes.',
    icon: 'trending-up-outline',
    color: '#E65100',
    bgColor: '#FFF3E0',
    conditions: [
      { featureKey: 'zigzagSmoothnessNorm', featureName: 'Direction Change Control', threshold: 40, weight: 50, hint: 'Unsteady direction changes' },
      { featureKey: 'overallDeviationNorm', featureName: 'Stroke Accuracy',          threshold: 40, weight: 30, hint: 'High overall stroke deviation' },
      { featureKey: 'pauseNorm',            featureName: 'Pause Frequency',          threshold: 40, weight: 20, hint: 'Pauses at direction-change points' },
    ],
    explanationTemplates: {
      zigzagSmoothnessNorm: 'Difficulty controlling direction changes in diagonal strokes.',
      overallDeviationNorm: 'Strokes showed high deviation when changing direction.',
      pauseNorm:            'Frequent pauses at direction-change points interrupted flow.',
    },
    exercises: [
      { text: 'Zigzag tracing exercises',        priority: 'high'   },
      { text: 'Diagonal stroke activities',      priority: 'high'   },
      { text: 'Letters V, W, M, N, Z practice',  priority: 'medium' },
      { text: 'Pattern tracing worksheets',      priority: 'medium' },
      { text: 'Dot-to-dot diagonal activities',  priority: 'low'    },
    ],
    letterFocus: ['v', 'w', 'm', 'n', 'z', 'x', 'k', 'y'],
  },

  MOTOR_FATIGUE: {
    label: 'Motor Fatigue',
    description: 'Signs of reduced motor control consistent with tiredness or low stamina.',
    icon: 'battery-half-outline',
    color: '#C62828',
    bgColor: '#FFEBEE',
    conditions: [
      { featureKey: 'pauseNorm',              featureName: 'Pause Frequency',     threshold: 60, weight: 40, hint: 'Very frequent pauses across all shapes' },
      { featureKey: 'speedNorm',              featureName: 'Speed Consistency',   threshold: 30, weight: 35, hint: 'Slowing and inconsistent writing speed' },
      { featureKey: 'overallSmoothnessNorm',  featureName: 'Overall Smoothness',  threshold: 50, weight: 25, hint: 'Widespread shakiness across shapes' },
    ],
    explanationTemplates: {
      pauseNorm:             'A high number of pauses across all shapes suggests muscle fatigue.',
      speedNorm:             'Inconsistent and slowing writing speed indicates reduced stamina.',
      overallSmoothnessNorm: 'Widespread shakiness across multiple shapes points to fatigue.',
    },
    exercises: [
      { text: 'Short 5-minute breaks between writing activities',  priority: 'high'   },
      { text: 'Finger strengthening exercises before sessions',    priority: 'high'   },
      { text: 'Gradual increase in session length over weeks',     priority: 'medium' },
      { text: 'Stress-ball or therapy putty exercises',            priority: 'low'    },
    ],
    letterFocus: [],
  },
};

// ─── Feature vector builder ───────────────────────────────────────────────────

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function buildFeatureVector(assessmentData, letterMetrics) {
  const curveShapeIds = ['full_circle', 'half_circle', 'curve_wave'];
  const lineShapeIds  = ['horizontal_line', 'vertical_line'];

  const shapes      = Array.isArray(assessmentData) ? assessmentData : [];
  const curveShapes = shapes.filter(s => curveShapeIds.includes(s.shapeId));
  const lineShapes  = shapes.filter(s => lineShapeIds.includes(s.shapeId));
  const zigzag      = shapes.find(s => s.shapeId === 'zigzag');

  // Smoothness 0-1 → normalised 0-100 (higher = worse)
  const curveSmoothnessNorm   = avg(curveShapes.map(s => (s.features?.smoothness ?? 0.5) * 100));
  const lineSmoothnessNorm    = avg(lineShapes.map(s => (s.features?.smoothness ?? 0.5) * 100));
  const zigzagSmoothnessNorm  = zigzag ? (zigzag.features?.smoothness ?? 0.5) * 100 : 50;
  const overallSmoothnessNorm = avg(shapes.map(s => (s.features?.smoothness ?? 0.5) * 100));

  // Deviation px → normalised 0-100 (50 px = 100)
  const lineDeviationNorm    = Math.min(100, avg(lineShapes.map(s => (s.features?.avg_deviation ?? 0) * 2)));
  const curveDeviationNorm   = Math.min(100, avg(curveShapes.map(s => (s.features?.avg_deviation ?? 0) * 2)));
  const overallDeviationNorm = Math.min(100, avg(shapes.map(s => (s.features?.avg_deviation ?? 0) * 2)));

  // Pauses: 5 pauses = 100
  const pauseNorm = Math.min(100, (letterMetrics?.avgPauses ?? 0) * 20);

  // Speed: ideal 3-12 s; outside = problematic
  const t = letterMetrics?.avgTime ?? 7;
  let speedNorm = 0;
  if (t < 2)       speedNorm = Math.min(100, (2 - t) * 50);
  else if (t < 3)  speedNorm = Math.min(100, (3 - t) * 33);
  else if (t > 15) speedNorm = Math.min(100, (t - 15) * 10);
  else if (t > 12) speedNorm = Math.min(100, (t - 12) * 8);

  return {
    curveSmoothnessNorm,
    lineSmoothnessNorm,
    zigzagSmoothnessNorm,
    overallSmoothnessNorm,
    lineDeviationNorm,
    curveDeviationNorm,
    overallDeviationNorm,
    pauseNorm,
    speedNorm,
  };
}

// ─── Rule scorer ─────────────────────────────────────────────────────────────

function scoreRule(rule, features) {
  let totalActivatedWeight = 0;
  const contributions = {};

  rule.conditions.forEach(cond => {
    const value = features[cond.featureKey] ?? 0;
    let activation = 0;
    if (value > cond.threshold) {
      activation = Math.min(1, (value - cond.threshold) / Math.max(1, 100 - cond.threshold));
    }
    const activatedWeight = cond.weight * activation;
    totalActivatedWeight += activatedWeight;
    contributions[cond.featureKey] = {
      featureName: cond.featureName,
      hint: cond.hint,
      activation,
      activatedWeight,
      triggered: activation > 0,
    };
  });

  return { confidence: Math.round(totalActivatedWeight), contributions, totalActivatedWeight };
}

// ─── Main analyser ────────────────────────────────────────────────────────────

/**
 * Analyse motor difficulty from shape-assessment data.
 * Pure client-side — no network required.
 *
 * @param {Array}  assessmentData
 * @param {Object} letterMetrics   optional { avgPauses, avgTime }
 * @param {number} motorScore      optional
 * @returns {Object}
 */
export function analyzeMotorDifficulty(assessmentData, letterMetrics, motorScore) {
  if (!assessmentData || assessmentData.length === 0) {
    return {
      difficulty:           'No Data',
      difficultyKey:        null,
      confidence:           null,
      description:          'Complete the shape assessment to see difficulty analysis.',
      motorScore:           motorScore ?? null,
      color:                '#9E9E9E',
      bgColor:              '#F5F5F5',
      featureContributions: [],
      explanation:          ['No shape assessment data available.'],
      exercises:            [],
      letterFocus:          [],
      secondaryDifficulty:  null,
      noDataAvailable:      true,
    };
  }

  const features = buildFeatureVector(assessmentData, letterMetrics);

  // Score every rule
  const allScores = Object.entries(DIFFICULTY_RULES).map(([key, rule]) => ({
    key, rule, ...scoreRule(rule, features),
  }));
  allScores.sort((a, b) => b.confidence - a.confidence);
  const primary = allScores[0];

  if (primary.confidence < 25) {
    return {
      difficulty:           'Good Motor Control',
      difficultyKey:        'NONE',
      confidence:           null,
      description:          'No significant motor difficulty detected. Motor movements showed good overall control.',
      motorScore:           motorScore ?? null,
      color:                '#2E7D32',
      bgColor:              '#E8F5E9',
      featureContributions: [],
      explanation: [
        'All motor control indicators are within the expected range.',
        'Continue regular handwriting practice to build on these skills.',
      ],
      exercises: [
        { text: 'Continue regular letter practice sessions',    priority: 'low' },
        { text: 'Introduce slightly more complex letter forms', priority: 'low' },
      ],
      letterFocus:         [],
      secondaryDifficulty: null,
      noIssueDetected:     true,
    };
  }

  // Feature contributions
  const triggered = Object.entries(primary.contributions)
    .filter(([, c]) => c.triggered)
    .sort((a, b) => b[1].activatedWeight - a[1].activatedWeight);
  const totalActivated = triggered.reduce((s, [, c]) => s + c.activatedWeight, 0);

  const featureContributions = triggered.map(([featureKey, c]) => ({
    feature:  c.featureName,
    pct:      totalActivated > 0 ? Math.round((c.activatedWeight / totalActivated) * 100) : 0,
    severity: c.activatedWeight >= 25 ? 'high' : c.activatedWeight >= 10 ? 'medium' : 'low',
    hint:     c.hint,
  }));

  const explanation = triggered
    .map(([featureKey]) => primary.rule.explanationTemplates[featureKey])
    .filter(Boolean);

  const secondary = allScores[1]?.confidence >= 20 ? {
    label:      allScores[1].rule.label,
    confidence: allScores[1].confidence,
    color:      allScores[1].rule.color,
  } : null;

  return {
    difficulty:           primary.rule.label,
    difficultyKey:        primary.key,
    confidence:           primary.confidence,
    description:          primary.rule.description,
    icon:                 primary.rule.icon,
    color:                primary.rule.color,
    bgColor:              primary.rule.bgColor,
    motorScore:           motorScore ?? null,
    featureContributions,
    explanation,
    exercises:            primary.rule.exercises,
    letterFocus:          primary.rule.letterFocus ?? [],
    secondaryDifficulty:  secondary,
  };
}

export default analyzeMotorDifficulty;