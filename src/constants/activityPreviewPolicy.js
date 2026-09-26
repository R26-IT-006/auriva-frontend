/**
 * activityPreviewPolicy.js
 *
 * Feature 10 Step 2 — pure visual definitions + preview-building helpers.
 *
 * PURE DATA + PURE HELPERS ONLY. No React, no react-native-svg, no hooks,
 * no network, no persistence, no rendering — this file returns declarative
 * geometry data a future (Step 3) rendering component consumes. Matches
 * every prior feature's own "policy/config is pure, service/component
 * composes" discipline (worksheetRecommendationPolicy.js on the backend is
 * the closest precedent: pure family → content mapping, zero I/O).
 *
 * ── Family taxonomy (Feature 7/8's own three values, reused verbatim) ──
 * Exactly `straight`/`curved`/`complex` — Feature 7/8's own baseline-family
 * taxonomy, never a fourth family, never the backend's separate
 * `vertical_horizontal|curved|diagonal|mixed` motor-primitive taxonomy or
 * the frontend teaching taxonomy `straight|curved|mixed` (Step 1 audit
 * §9/confirmed research framing across every feature in this codebase).
 *
 * ── Geometry provenance (Step 2 spec §43) ───────────────────────────────
 * Family shapes: representative geometry adapted from the existing
 * handwriting-assessment guide shapes (ShapeAssessmentScreen.js's
 * unexported `GuideShape` component) — presentation-only copy, no
 * runtime/import dependency on that screen file.
 * Letter shapes: fractional waypoint data mirrors the handwriting letter
 * guide definitions — see activityPreviewLetterPaths.js's own header for
 * full provenance detail.
 *
 * ── Renderer-agnostic geometry format (Step 2 spec §11) ─────────────────
 * Every family shape is `{type: 'line'|'circle'|'path'|'polyline', ...}` —
 * plain data, never JSX — so a future SVG component (Step 3) or, later,
 * a hypothetical print/export feature could both consume the exact same
 * definitions without this file changing.
 *
 * ── What this module never does ──────────────────────────────────────────
 *   - never determines whether a recommendation exists, which family is
 *     difficult, or which letters are selected — all of that remains
 *     Feature 8's own responsibility; this file only maps an ALREADY-CHOSEN
 *     family/caseType/focusLetters to a visual representation;
 *   - never reads suggestedActivities, recommendationFingerprint,
 *     studentId, teacherId, or any Feature 1-7 data (Step 2 spec §35-39) —
 *     buildActivityPreview()'s only inputs are family/caseType/focusLetters;
 *   - never imports preWritingActivities.js, ShapeAssessmentScreen.js,
 *     LetterWritingScreen.js, or UppercaseWritingScreen.js (Step 2 spec
 *     §40-42) — geometry is copied/adapted, not cross-imported;
 *   - never mutates its inputs or its own constants — every returned value
 *     is a fresh, independently-mutable copy (Step 2 spec §30/§31).
 *
 * ── Research framing ─────────────────────────────────────────────────────
 * A visual preview means: "what this already-existing Feature 8
 * recommendation's practice movement looks like." It does not make an
 * adaptive decision, measure motor ability, score handwriting, diagnose,
 * or change support — those remain exclusively Features 1-9's own
 * responsibility.
 */

'use strict';

import { LOWERCASE_LETTER_PATHS, UPPERCASE_LETTER_PATHS } from './activityPreviewLetterPaths';

// ─── Vocabulary ──────────────────────────────────────────────────────────

export const VALID_FAMILIES = ['straight', 'curved', 'complex'];
export const VALID_CASE_TYPES = ['lowercase', 'uppercase'];

// Practical maximum of focus letters ever shown visually (Step 2 spec
// §21) — real Feature 7/8 evidence has never produced more than 1-2 in
// this codebase's own live/synthetic history; 3 leaves generous headroom
// without letting the card grow unbounded.
export const MAX_FOCUS_LETTER_PREVIEWS = 3;

// ─── Family geometry (Step 2 spec §5/§7/§9) ────────────────────────────
//
// Coordinates are viewBox-relative (a 100x60 unit box), never fixed child-
// screen pixel dimensions (Step 1 audit §25/Step 2 spec §5) — a future
// renderer applies `viewBox="0 0 100 60"` and whatever container width it
// has; this file has no opinion on final on-screen size.

const FAMILY_PREVIEWS = Object.freeze({
  straight: Object.freeze({
    family: 'straight',
    label: 'Straight Movement Preview', // never "Straight Difficulty" (Step 2 spec §6)
    viewBox: '0 0 100 60',
    shapes: Object.freeze([
      // vertical line
      Object.freeze({ type: 'line', x1: 22, y1: 10, x2: 22, y2: 50 }),
      // horizontal line
      Object.freeze({ type: 'line', x1: 42, y1: 50, x2: 88, y2: 50 }),
    ]),
  }),

  curved: Object.freeze({
    family: 'curved',
    label: 'Curved Movement Preview', // Step 2 spec §8
    viewBox: '0 0 100 60',
    shapes: Object.freeze([
      // full circle
      Object.freeze({ type: 'circle', cx: 22, cy: 30, r: 16 }),
      // half circle (adapted from GuideShape's own half_circle arc math,
      // scaled to this file's own 100x60 viewBox)
      Object.freeze({ type: 'path', d: 'M 54 48 A 16 16 0 0 1 86 48' }),
    ]),
  }),

  // Representative movement example only (Step 2 spec §10). The complex
  // family includes multiple combined/direction-changing movement
  // patterns (Step 1 audit §13 — Feature 7/8's `complex` family is
  // confirmed broader than zigzag-shaped letters alone) — this
  // zigzag-style polyline is ONE representative example, not a claim that
  // every complex-family letter looks like this. The label reflects that:
  // "Complex Movement Preview", never "Zigzag Difficulty" or any wording
  // implying all complex-family difficulty is zigzag-based.
  complex: Object.freeze({
    family: 'complex',
    label: 'Complex Movement Preview', // never "Zigzag Difficulty" (Step 2 spec §9)
    viewBox: '0 0 100 60',
    shapes: Object.freeze([
      Object.freeze({
        type: 'polyline',
        points: Object.freeze([
          Object.freeze({ x: 10, y: 45 }), Object.freeze({ x: 25, y: 15 }),
          Object.freeze({ x: 40, y: 45 }), Object.freeze({ x: 55, y: 15 }),
          Object.freeze({ x: 70, y: 45 }), Object.freeze({ x: 85, y: 15 }),
        ]),
      }),
    ]),
  }),
});

// Teacher-facing accessibility phrasing (Step 2 spec §33/§34) — no
// severity, no diagnosis, no difficulty score, no correctness language.
const FAMILY_ACCESSIBILITY_PHRASES = Object.freeze({
  straight: 'Straight movement practice preview.',
  curved: 'Curved movement practice preview.',
  complex: 'Complex movement practice preview.',
});

// ─── Defensive cloning (Step 2 spec §30/§31) ────────────────────────────
// Every value returned to a caller is a fresh copy — a caller mutating the
// returned preview must never be able to alter these frozen constants.

function cloneShape(shape) {
  if (shape.type === 'polyline') {
    return { type: shape.type, points: shape.points.map((p) => ({ x: p.x, y: p.y })) };
  }
  return { ...shape };
}

function cloneFamilyPreview(preview) {
  if (!preview) return null;
  return {
    family: preview.family,
    label: preview.label,
    viewBox: preview.viewBox,
    shapes: preview.shapes.map(cloneShape),
  };
}

// ─── Letter geometry lookup + normalization ─────────────────────────────

/**
 * Resolves a single letter's raw waypoint data, checking BOTH the
 * lowercase and uppercase tables by the letter's own actual character
 * case — deliberately never gated by the caller-supplied `caseType`
 * parameter (Step 2 spec §28): Feature 8's own `focusLetters` values are
 * the authoritative source of truth for what to render; `caseType` is
 * accepted by `buildActivityPreview()` for API completeness but never
 * used to override or reject an individual letter's own case.
 *
 * @param {*} letter
 * @returns {Array|undefined} the raw LETTER_PATHS entry, or undefined if
 *   no path exists for this exact character.
 */
function getRawLetterPath(letter) {
  if (typeof letter !== 'string' || letter.length !== 1) return undefined;
  if (Object.prototype.hasOwnProperty.call(LOWERCASE_LETTER_PATHS, letter)) return LOWERCASE_LETTER_PATHS[letter];
  if (Object.prototype.hasOwnProperty.call(UPPERCASE_LETTER_PATHS, letter)) return UPPERCASE_LETTER_PATHS[letter];
  return undefined;
}

/**
 * Normalizes a raw LETTER_PATHS entry (which may be a flat single-stroke
 * point array OR an array of point-arrays for a multi-stroke letter) into
 * a uniform "always array of strokes" shape (Step 2 spec §27), without
 * mutating the source constant — every point is rebuilt as a new object.
 *
 * @param {Array} rawPath
 * @returns {Array<Array<{fx:number, fy:number}>>|null}
 */
function normalizeStrokes(rawPath) {
  if (!Array.isArray(rawPath) || rawPath.length === 0) return null;
  const isMultiStroke = Array.isArray(rawPath[0]);
  const strokes = isMultiStroke ? rawPath : [rawPath];
  return strokes.map((stroke) => stroke.map((pt) => ({ fx: pt.fx, fy: pt.fy })));
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Pure builder: translates an already-chosen Feature 8 recommendation
 * identity (family/caseType/focusLetters) into declarative, renderer-
 * agnostic preview geometry. Never mutates inputs, never uses random
 * values or mutable global state — identical input always yields an
 * identical (deep-equal, freshly-allocated) result (Step 2 spec §30).
 *
 * @param {Object} params
 * @param {string} params.family - one of VALID_FAMILIES; anything else -> familyPreview: null (never invents a fourth family, Step 2 spec §3/§45).
 * @param {string} [params.caseType] - accepted for API completeness; never overrides a letter's own actual case (Step 2 spec §28).
 * @param {Array} [params.focusLetters] - Feature 8's own focusLetters array, order/case preserved exactly, duplicates preserved (Step 2 spec §20/§29).
 * @returns {{
 *   familyPreview: {family:string, label:string, viewBox:string, shapes:Array<Object>}|null,
 *   focusLetterPreviews: Array<{letter:string, strokes:Array<Array<{fx:number,fy:number}>>}>,
 *   hiddenFocusLetterCount: number,
 * }}
 */
export function buildActivityPreview({ family, caseType, focusLetters } = {}) {
  const familyPreview = VALID_FAMILIES.includes(family) ? cloneFamilyPreview(FAMILY_PREVIEWS[family]) : null;

  const rawList = Array.isArray(focusLetters) ? focusLetters : [];
  const focusLetterPreviews = [];
  let hiddenFocusLetterCount = 0;

  for (const entry of rawList) {
    if (focusLetterPreviews.length >= MAX_FOCUS_LETTER_PREVIEWS) {
      // Beyond the visible limit: only a genuinely valid, path-resolvable
      // letter counts toward "+N more" (Step 2 spec §24) — a malformed
      // entry or a letter with no path is silently ignored, never inflating
      // the hidden count.
      if (getRawLetterPath(entry)) hiddenFocusLetterCount += 1;
      continue;
    }

    const raw = getRawLetterPath(entry);
    if (!raw) continue; // malformed entry or missing path — skip, consumes no visible slot (Step 2 spec §22/§23)

    const strokes = normalizeStrokes(raw);
    if (!strokes) continue;

    focusLetterPreviews.push({ letter: entry, strokes });
  }

  return { familyPreview, focusLetterPreviews, hiddenFocusLetterCount };
}

/**
 * Builds a plain-language accessibility label summarizing a preview
 * result (Step 2 spec §33/§34) — no severity, no diagnosis, no difficulty
 * score, no correctness wording, ever.
 *
 * Step 4 spec §19 — minimal defensive fix: an invalid family combined with
 * at least one still-resolvable focus letter (a combination that cannot
 * occur with real Feature 8 output, which only ever emits one of its own
 * three valid families) now produces a letters-only label instead of an
 * empty string — low-risk since this branch is only reachable when
 * `familyPreview` is already null, so no valid-family behavior changes.
 *
 * @param {ReturnType<typeof buildActivityPreview>} preview
 * @returns {string} e.g. "Curved movement practice preview. Focus letters c, o."
 *   or "Curved movement practice preview." with no focus letters, or
 *   "Focus letters c." when family is invalid but a letter still resolves,
 *   or "" when nothing at all is available.
 */
export function buildActivityPreviewAccessibilityLabel(preview) {
  if (!preview) return '';
  const letters = preview.focusLetterPreviews.map((p) => p.letter);

  if (!preview.familyPreview) {
    if (letters.length === 0) return '';
    return `Focus letters ${letters.join(', ')}.`;
  }

  const base = FAMILY_ACCESSIBILITY_PHRASES[preview.familyPreview.family] ?? `${preview.familyPreview.label}.`;
  if (letters.length === 0) return base;
  return `${base} Focus letters ${letters.join(', ')}.`;
}
