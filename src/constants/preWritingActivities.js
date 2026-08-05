// Pre-writing warm-up activity catalogue.
//
// Geometry follows the same coordinate/template convention as
// ShapeAssessmentScreen's computePathPoints(shapeId): points are generated
// around a canvas center (cx, cy) passed in by the screen at render time
// (matching that screen's CANVAS_CX/CANVAS_CY), sampled at DEFAULT_N_POINTS.
// generatePoints always returns an array of strokes (array of point-arrays)
// rather than a flat point array, since a couple of these shapes (cross, X)
// are inherently two disconnected strokes — single-stroke shapes just return
// a one-element array. Feed a stroke through normalizePointsForDTW exactly
// as the existing zigzag/curve_wave templates do.

const DEFAULT_N_POINTS = 100;

const PRIMITIVE_GROUPS = {
  VERTICAL_HORIZONTAL: 'vertical_horizontal',
  CURVED:              'curved',
  DIAGONAL:            'diagonal',
  MIXED:               'mixed',
};

// ─── Geometry helpers (same math already inlined per-shape in
//     ShapeAssessmentScreen; factored out here since there are 14 shapes
//     instead of 6) ─────────────────────────────────────────────────────────

function straightLine(p0, p1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) });
  }
  return pts;
}

// Same node-interpolation pattern as ShapeAssessmentScreen's zigzag.
function polylineThroughNodes(nodes, n) {
  const segs   = nodes.length - 1;
  const perSeg = Math.floor(n / segs);
  const pts    = [];
  for (let s = 0; s < segs; s++) {
    const from  = nodes[s];
    const to    = nodes[s + 1];
    const count = s === segs - 1 ? n - s * perSeg + 1 : perSeg;
    for (let i = 0; i < count; i++) {
      const t = i / (count > 1 ? count - 1 : 1);
      pts.push({ x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) });
    }
  }
  return pts;
}

function arcPoints(cx, cy, r, angleStart, angleEnd, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t     = i / n;
    const angle = angleStart + t * (angleEnd - angleStart);
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
}

function spiralPoints(cx, cy, n) {
  const turns = 1.5;
  const pts   = [];
  for (let i = 0; i <= n; i++) {
    const t     = i / n;
    const angle = -Math.PI / 2 + t * turns * 2 * Math.PI;
    const r     = 15 + t * 105;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
}

// Lemniscate of Bernoulli — traces a figure-eight through (cx, cy).
function figureEightPoints(cx, cy, n) {
  const A   = 120;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI + (i / n) * 2 * Math.PI;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    pts.push({
      x: cx + (A * Math.cos(t)) / denom,
      y: cy + (A * Math.sin(t) * Math.cos(t)) / denom,
    });
  }
  return pts;
}

// ─── Activity catalogue ─────────────────────────────────────────────────────
// difficulty_rank follows the OT developmental sequence for pre-writing
// strokes (vertical → horizontal → circle → cross → square → diagonal → X →
// triangle); shapes not on that canonical list are slotted at a decimal rank
// near their nearest neighbor in difficulty.

const PRE_WRITING_ACTIVITIES = [
  {
    id: 'connect_vertical_dots',
    name: 'Connect the dots (up and down)',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 1,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx, y: cy - 150 }, { x: cx, y: cy + 150 }, n),
      ],
    },
    prompt_text: 'Connect the two dots with a line, top to bottom!',
  },
  {
    id: 'connect_horizontal_dots',
    name: 'Connect the dots (side to side)',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 2,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx - 200, y: cy }, { x: cx + 200, y: cy }, n),
      ],
    },
    prompt_text: 'Connect the two dots with a line, left to right!',
  },
  {
    id: 'trace_corner',
    name: 'Trace the corner',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 3,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx - 80, y: cy - 100 },
          { x: cx - 80, y: cy + 100 },
          { x: cx + 80, y: cy + 100 },
        ], n),
      ],
    },
    prompt_text: 'Trace down, then trace across, to make a corner!',
  },
  {
    id: 'trace_cross',
    name: 'Trace the cross',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 4,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx, y: cy - 100 }, { x: cx, y: cy + 100 }, Math.floor(n / 2)),
        straightLine({ x: cx - 100, y: cy }, { x: cx + 100, y: cy }, Math.floor(n / 2)),
      ],
    },
    prompt_text: 'Trace down, then trace across, to make a cross!',
  },
  {
    id: 'trace_square',
    name: 'Trace the square',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 5,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx - 100, y: cy - 100 },
          { x: cx + 100, y: cy - 100 },
          { x: cx + 100, y: cy + 100 },
          { x: cx - 100, y: cy + 100 },
          { x: cx - 100, y: cy - 100 },
        ], n),
      ],
    },
    prompt_text: 'Trace all the way around the square!',
  },
  {
    id: 'trace_ladder',
    name: 'Trace the ladder',
    primitive_group: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
    difficulty_rank: 5.5,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx - 90, y: cy - 120 }, { x: cx - 90, y: cy + 120 }, Math.floor(n / 5)),
        straightLine({ x: cx + 90, y: cy - 120 }, { x: cx + 90, y: cy + 120 }, Math.floor(n / 5)),
        straightLine({ x: cx - 90, y: cy - 60 },  { x: cx + 90, y: cy - 60 },  Math.floor(n / 5)),
        straightLine({ x: cx - 90, y: cy },       { x: cx + 90, y: cy },       Math.floor(n / 5)),
        straightLine({ x: cx - 90, y: cy + 60 },  { x: cx + 90, y: cy + 60 },  Math.floor(n / 5)),
      ],
    },
    prompt_text: 'Trace the two sides, then each rung of the ladder!',
  },
  {
    id: 'connect_curve_dots',
    name: 'Connect the dots (curvy path)',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 2.5,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx - 160, y: cy + 40 },
          { x: cx - 80,  y: cy - 40 },
          { x: cx,       y: cy - 70 },
          { x: cx + 80,  y: cy - 40 },
          { x: cx + 160, y: cy + 40 },
        ], n),
      ],
    },
    prompt_text: 'Connect the dots along the curvy path!',
  },
  {
    id: 'trace_half_circle_cw',
    name: 'Trace the arc (over the top)',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 3.0,
    target_shape: {
      // Matches ShapeAssessmentScreen's existing half_circle geometry exactly.
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        arcPoints(cx, cy, 150, Math.PI, 2 * Math.PI, n),
      ],
    },
    prompt_text: 'Trace the curve from left to right, over the top!',
  },
  {
    id: 'trace_half_circle_ccw',
    name: 'Trace the arc (under the bottom)',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 3.1,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        arcPoints(cx, cy, 150, Math.PI, 0, n),
      ],
    },
    prompt_text: 'Trace the curve from left to right, under the bottom!',
  },
  {
    id: 'trace_circle',
    name: 'Trace the circle',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 3.5,
    target_shape: {
      // Matches ShapeAssessmentScreen's existing full_circle geometry exactly.
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        arcPoints(cx, cy, 120, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI, n),
      ],
    },
    prompt_text: 'Trace all the way around the circle!',
  },
  {
    id: 'trace_spiral',
    name: 'Trace the spiral',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 3.8,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        spiralPoints(cx, cy, n),
      ],
    },
    prompt_text: 'Follow the spiral from the middle, out!',
  },
  {
    id: 'trace_figure_eight',
    name: 'Trace the figure eight',
    primitive_group: PRIMITIVE_GROUPS.CURVED,
    difficulty_rank: 3.9,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        figureEightPoints(cx, cy, n),
      ],
    },
    prompt_text: 'Follow the loop all the way around, crossing in the middle!',
  },
  {
    id: 'trace_diagonal_forward',
    name: 'Connect the dots (diagonal /)',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 6.0,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx - 100, y: cy + 100 }, { x: cx + 100, y: cy - 100 }, n),
      ],
    },
    prompt_text: 'Connect the two dots with a slanted line!',
  },
  {
    id: 'trace_diagonal_back',
    name: 'Connect the dots (diagonal \\)',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 6.1,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx - 100, y: cy - 100 }, { x: cx + 100, y: cy + 100 }, n),
      ],
    },
    prompt_text: 'Connect the two dots with a slanted line!',
  },
  {
    id: 'trace_zigzag',
    name: 'Trace the zigzag',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 6.5,
    target_shape: {
      // Matches ShapeAssessmentScreen's existing zigzag geometry exactly.
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx - 180, y: cy + 40 },
          { x: cx - 120, y: cy - 40 },
          { x: cx - 60,  y: cy + 40 },
          { x: cx,       y: cy - 40 },
          { x: cx + 60,  y: cy + 40 },
          { x: cx + 120, y: cy - 40 },
          { x: cx + 180, y: cy + 40 },
        ], n),
      ],
    },
    prompt_text: 'Follow the zigzag from left to right!',
  },
  {
    id: 'trace_x',
    name: 'Trace the X',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 7.0,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        straightLine({ x: cx - 100, y: cy - 100 }, { x: cx + 100, y: cy + 100 }, Math.floor(n / 2)),
        straightLine({ x: cx + 100, y: cy - 100 }, { x: cx - 100, y: cy + 100 }, Math.floor(n / 2)),
      ],
    },
    prompt_text: 'Trace one slanted line, then the other, to make an X!',
  },
  {
    id: 'trace_triangle',
    name: 'Trace the triangle',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 8.0,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx,       y: cy - 120 },
          { x: cx + 120, y: cy + 80 },
          { x: cx - 120, y: cy + 80 },
          { x: cx,       y: cy - 120 },
        ], n),
      ],
    },
    prompt_text: 'Trace all the way around the triangle!',
  },
  {
    id: 'trace_diamond',
    name: 'Trace the diamond',
    primitive_group: PRIMITIVE_GROUPS.DIAGONAL,
    difficulty_rank: 8.5,
    target_shape: {
      generatePoints: (cx, cy, n = DEFAULT_N_POINTS) => [
        polylineThroughNodes([
          { x: cx,       y: cy - 100 },
          { x: cx + 100, y: cy },
          { x: cx,       y: cy + 100 },
          { x: cx - 100, y: cy },
          { x: cx,       y: cy - 100 },
        ], n),
      ],
    },
    prompt_text: 'Trace all the way around the diamond!',
  },
];

// ─── Letter → primitive group map ───────────────────────────────────────────
// Single source of truth for which warm-up group gates a given letter.
// Note: this is a separate, coarser classification from
// constants/letterCategories.js's straight/curved/mixed categories (used by
// utils/adaptiveSequencing.js to order the child's letter sequence from
// assessment scores). The two are not meant to agree letter-for-letter —
// they answer different questions — but it's worth knowing both exist.
//
// Groups not explicitly assigned below default to MIXED, per spec: curved
// (a,c,e,o,s,g,C,O,S,G), diagonal (v,w,x,y,z,k,A,V,W,X,Y,Z,K),
// vertical_horizontal (i,l,t,f,E,F,H,I,L,T), mixed (everything else).

const LETTER_PRIMITIVE_MAP = {
  // ── lowercase ──
  a: PRIMITIVE_GROUPS.CURVED,
  b: PRIMITIVE_GROUPS.MIXED,
  c: PRIMITIVE_GROUPS.CURVED,
  d: PRIMITIVE_GROUPS.MIXED,
  e: PRIMITIVE_GROUPS.CURVED,
  f: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  g: PRIMITIVE_GROUPS.CURVED,
  h: PRIMITIVE_GROUPS.MIXED,
  i: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  j: PRIMITIVE_GROUPS.MIXED,
  k: PRIMITIVE_GROUPS.DIAGONAL,
  l: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  m: PRIMITIVE_GROUPS.MIXED,
  n: PRIMITIVE_GROUPS.MIXED,
  o: PRIMITIVE_GROUPS.CURVED,
  p: PRIMITIVE_GROUPS.MIXED,
  q: PRIMITIVE_GROUPS.MIXED,
  r: PRIMITIVE_GROUPS.MIXED,
  s: PRIMITIVE_GROUPS.CURVED,
  t: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  u: PRIMITIVE_GROUPS.MIXED,
  v: PRIMITIVE_GROUPS.DIAGONAL,
  w: PRIMITIVE_GROUPS.DIAGONAL,
  x: PRIMITIVE_GROUPS.DIAGONAL,
  y: PRIMITIVE_GROUPS.DIAGONAL,
  z: PRIMITIVE_GROUPS.DIAGONAL,

  // ── uppercase ──
  A: PRIMITIVE_GROUPS.DIAGONAL,
  B: PRIMITIVE_GROUPS.MIXED,
  C: PRIMITIVE_GROUPS.CURVED,
  D: PRIMITIVE_GROUPS.MIXED,
  E: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  F: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  G: PRIMITIVE_GROUPS.CURVED,
  H: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  I: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  J: PRIMITIVE_GROUPS.MIXED,
  K: PRIMITIVE_GROUPS.DIAGONAL,
  L: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  M: PRIMITIVE_GROUPS.MIXED,
  N: PRIMITIVE_GROUPS.MIXED,
  O: PRIMITIVE_GROUPS.CURVED,
  P: PRIMITIVE_GROUPS.MIXED,
  Q: PRIMITIVE_GROUPS.MIXED,
  R: PRIMITIVE_GROUPS.MIXED,
  S: PRIMITIVE_GROUPS.CURVED,
  T: PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL,
  U: PRIMITIVE_GROUPS.MIXED,
  V: PRIMITIVE_GROUPS.DIAGONAL,
  W: PRIMITIVE_GROUPS.DIAGONAL,
  X: PRIMITIVE_GROUPS.DIAGONAL,
  Y: PRIMITIVE_GROUPS.DIAGONAL,
  Z: PRIMITIVE_GROUPS.DIAGONAL,
};

/**
 * @param {string} letter
 * @returns {'vertical_horizontal'|'curved'|'diagonal'|'mixed'}
 */
function getLetterPrimitiveGroup(letter) {
  return LETTER_PRIMITIVE_MAP[letter] ?? PRIMITIVE_GROUPS.MIXED;
}

// ─── Sequencing config ───────────────────────────────────────────────────────
// How many warm-up activities to show per group before a letter set begins.
// Each group's catalogue pool is 6 activities (kept roughly equal on
// purpose); how many of those are actually shown scales with how demanding
// that primitive is developmentally — vertical/horizontal strokes come
// first and easiest in the OT sequence, so a child only needs a couple of
// reps, while curved and diagonal strokes are harder to control and get a
// fuller warm-up. No entry (or MIXED, which the catalogue has no activities
// for) → 0, i.e. no warm-up is shown and the letter flow proceeds exactly
// as it does today.

const GROUP_ACTIVITY_COUNT = {
  [PRIMITIVE_GROUPS.VERTICAL_HORIZONTAL]: 3,
  [PRIMITIVE_GROUPS.CURVED]:              6,
  [PRIMITIVE_GROUPS.DIAGONAL]:            6,
  [PRIMITIVE_GROUPS.MIXED]:               0,
};

// Global on/off switch for skipping an activity the child already passed
// recently. Off by default — every warm-up is shown every time until this
// is deliberately turned on.
const SKIP_RECENTLY_COMPLETED_DEFAULT = false;

/**
 * Picks the warm-up activities for a primitive group, easiest first.
 *
 * Persistence-agnostic by design (Step 4 storage isn't decided yet):
 * callers that want the skip-if-recently-passed behaviour must supply
 * `recentResults` themselves, already filtered down to whatever "recent"
 * should mean — this function only consumes it, it doesn't query anything.
 *
 * @param {'vertical_horizontal'|'curved'|'diagonal'|'mixed'} primitiveGroup
 * @param {{
 *   count?: number,
 *   skipCompleted?: boolean,
 *   recentResults?: Array<{ activity_id: string, passed: boolean }>,
 * }} [options]
 * @returns {Array} ordered subset of PRE_WRITING_ACTIVITIES
 */
function selectPreWritingActivities(primitiveGroup, options = {}) {
  const {
    count         = GROUP_ACTIVITY_COUNT[primitiveGroup] ?? 0,
    skipCompleted = SKIP_RECENTLY_COMPLETED_DEFAULT,
    recentResults = [],
  } = options;

  if (count <= 0) return [];

  let candidates = PRE_WRITING_ACTIVITIES
    .filter(a => a.primitive_group === primitiveGroup)
    .sort((a, b) => a.difficulty_rank - b.difficulty_rank);

  if (skipCompleted && recentResults.length > 0) {
    const passedIds = new Set(
      recentResults.filter(r => r.passed).map(r => r.activity_id)
    );
    candidates = candidates.filter(a => !passedIds.has(a.id));
  }

  return candidates.slice(0, count);
}

export {
  DEFAULT_N_POINTS,
  PRIMITIVE_GROUPS,
  PRE_WRITING_ACTIVITIES,
  LETTER_PRIMITIVE_MAP,
  GROUP_ACTIVITY_COUNT,
  SKIP_RECENTLY_COMPLETED_DEFAULT,
  getLetterPrimitiveGroup,
  selectPreWritingActivities,
};
