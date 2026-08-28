/**
 * ActivityPreview.js
 *
 * Feature 10 Step 3 — static SVG rendering component. Consumes Step 2's
 * `buildActivityPreview()` unchanged — this file performs NO preview-
 * building logic of its own (Step 3 spec §1): it is a passive renderer
 * only.
 *
 * ── Component API (Step 3 spec §2) ──────────────────────────────────────
 *   <ActivityPreview family={...} caseType={...} focusLetters={...} />
 * No studentId, teacherId, recommendationFingerprint, suggestedActivities,
 * rationale, threshold, support level, or persistent status — this
 * component needs nothing beyond what Feature 8 already returns as
 * display data (Step 3 spec §2/§30/§31/§32/§33).
 *
 * ── What this component never does (Step 3 spec §3) ─────────────────────
 *   - never decides which family is difficult, never selects focus
 *     letters, never scores handwriting, never adapts support — all of
 *     that is exclusively Feature 7/8's own responsibility, already
 *     resolved before this component ever receives its props;
 *   - never reads Feature 7 data, never writes Feature 9 history — it has
 *     no import of either;
 *   - never makes a network request, never writes to AsyncStorage/any
 *     persistence — purely a synchronous render of data already in
 *     memory (Step 3 spec §34/§35);
 *   - never animates, never accepts touch/trace input (Step 3 spec
 *     §21/§22) — the SVG itself is a passive renderer; any expand/collapse
 *     interaction lives in the caller (TeacherReportScreen's own
 *     ActivityPreviewSection), never here.
 *
 * ── Fallback behavior (Step 3 spec §17/§18) ─────────────────────────────
 * An invalid/unrecognized family renders no family-preview block (never an
 * invented generic shape). If BOTH the family preview and every focus-
 * letter preview are unavailable, the whole component renders `null` — no
 * broken placeholder.
 */

'use strict';

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Path, Polyline } from 'react-native-svg';

import {
  buildActivityPreview, buildActivityPreviewAccessibilityLabel,
} from '../../constants/activityPreviewPolicy';
import { scaleStrokeToPreview, toPolylinePoints } from '../../utils/activityPreviewGeometry';

// ── Visual language (Step 3 spec §8) ────────────────────────────────────
// Light dashed guide stroke for the family movement example — matches the
// existing handwriting-assessment guide-shape visual language (Step 1
// audit §26/§41: `GuideShape`'s own `#B8C8E8` dashed style, adapted here
// without importing that screen). Solid teal for focus-letter guides —
// matches AdaptivePracticeRecommendationCard's own accent color, never a
// severity palette (no red = poor / green = correct anywhere).
const FAMILY_GUIDE_COLOR = '#B8C8E8';
const LETTER_GUIDE_COLOR = '#0D9488';

const FAMILY_PREVIEW_HEIGHT = 90;
const LETTER_CELL = { width: 50, height: 60, padding: 8 };
const LETTER_DOT_RADIUS = 2.5;

/**
 * Renders one declarative family shape as its react-native-svg
 * equivalent. Unknown `shape.type` is skipped safely — never crashes,
 * never invents rendering behavior (Step 3 spec §7).
 */
function renderPreviewShape(shape, index) {
  if (!shape || typeof shape.type !== 'string') return null;

  const dashProps = { fill: 'none', stroke: FAMILY_GUIDE_COLOR, strokeWidth: 3, strokeDasharray: '6,4', strokeLinecap: 'round' };

  switch (shape.type) {
    case 'line':
      return <Line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...dashProps} />;
    case 'circle':
      return <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} {...dashProps} />;
    case 'path':
      return <Path key={index} d={shape.d} {...dashProps} />;
    case 'polyline':
      return <Polyline key={index} points={toPolylinePoints(shape.points)} {...dashProps} strokeLinejoin="round" />;
    default:
      return null; // future/unrecognized shape type — skip safely (Step 3 spec §7)
  }
}

/** The family movement example — one small, responsive SVG. */
function FamilyPreviewSvg({ familyPreview }) {
  if (!familyPreview) return null;
  return (
    <Svg width="100%" height={FAMILY_PREVIEW_HEIGHT} viewBox={familyPreview.viewBox}>
      {familyPreview.shapes.map((shape, i) => renderPreviewShape(shape, i))}
    </Svg>
  );
}

/**
 * One focus-letter guide cell. Renders each stroke as a separate
 * `<Polyline>` (Step 3 spec §12/§13) — strokes are never connected to one
 * another, matching activityPreviewPolicy.js's own "preserve multi-stroke
 * structure exactly" discipline. A single-point stroke (e.g. the dot above
 * `i`/`j`) is rendered as a small dot rather than silently dropped, since
 * a one-point polyline has no visible line to draw — no new semantic
 * claim, just the letter's own existing dot rendered as a dot.
 */
function LetterGuide({ letter, strokes }) {
  const { width, height, padding } = LETTER_CELL;
  return (
    <View style={ap.letterCell}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {strokes.map((stroke, i) => {
          const scaled = scaleStrokeToPreview(stroke, { width, height, padding });
          if (scaled.length === 0) return null; // defensive — every point in this stroke was malformed
          if (scaled.length === 1) {
            return <Circle key={i} cx={scaled[0].x} cy={scaled[0].y} r={LETTER_DOT_RADIUS} fill={LETTER_GUIDE_COLOR} />;
          }
          return (
            <Polyline
              key={i}
              points={toPolylinePoints(scaled)}
              fill="none"
              stroke={LETTER_GUIDE_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </Svg>
      {/* A small letter label avoids ambiguity, since the guide outline
          alone can be hard to read at this size — the existing "Focus
          letters: c, o" text above already states the letters once, so
          this is a supplementary, not a duplicate, label (Step 3 spec §42). */}
      <Text style={ap.letterLabel}>{letter}</Text>
    </View>
  );
}

/**
 * @param {Object} props
 * @param {string} props.family
 * @param {string} [props.caseType]
 * @param {Array} [props.focusLetters]
 */
export default function ActivityPreview({ family, caseType, focusLetters }) {
  const preview = buildActivityPreview({ family, caseType, focusLetters });

  // Fully unavailable (Step 3 spec §18) — neither a family example nor any
  // focus-letter guide could be produced. No broken placeholder.
  if (!preview.familyPreview && preview.focusLetterPreviews.length === 0) {
    return null;
  }

  const accessibilityLabel = buildActivityPreviewAccessibilityLabel(preview);

  return (
    <View style={ap.container} accessibilityLabel={accessibilityLabel}>
      {preview.familyPreview && (
        <View style={ap.familyPreviewContainer}>
          <FamilyPreviewSvg familyPreview={preview.familyPreview} />
        </View>
      )}

      {preview.focusLetterPreviews.length > 0 && (
        <View style={ap.focusPreviewRow}>
          {preview.focusLetterPreviews.map((letterPreview, index) => (
            <LetterGuide key={`${index}-${letterPreview.letter}`} letter={letterPreview.letter} strokes={letterPreview.strokes} />
          ))}
        </View>
      )}

      {preview.hiddenFocusLetterCount > 0 && (
        <Text style={ap.hiddenFocusText}>+{preview.hiddenFocusLetterCount} more focus letters</Text>
      )}
    </View>
  );
}

const ap = StyleSheet.create({
  container: { gap: 10 },
  familyPreviewContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
  },
  focusPreviewRow: { flexDirection: 'row', gap: 8 },
  letterCell: {
    flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 4,
  },
  letterLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#0F766E', marginTop: 2 },
  hiddenFocusText: { fontSize: 11, color: '#64748B', fontWeight: '500', fontFamily: 'Nunito_600SemiBold' },
});
