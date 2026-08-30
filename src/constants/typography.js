/**
 * typography.js
 *
 * The app's readable-text faces, in one place.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * App.js already sets a global default:
 *
 *   Text.defaultProps.style = { fontFamily: 'Nunito_400Regular' };
 *
 * so every <Text> renders in Nunito Regular. The Concept screens then pair
 * each weight with its own real Nunito FACE (Nunito_700Bold and friends).
 * The handwriting screens never did — they set `fontWeight: '700'` with no
 * matching family, and React Native does not synthesise a bold for a custom
 * single-weight face, so those styles rendered at regular weight. That is
 * the readability gap between the two modules: not a different font, an
 * unresolved one.
 *
 * This module is the single mapping from a numeric weight to the face that
 * actually exists in the bundle. It was extracted from the Concept screens'
 * own usage rather than invented, and nothing new is loaded — all five faces
 * are already registered in App.js's useFonts().
 *
 * ── Scope: READABLE TEXT ONLY ────────────────────────────────────────────
 * Never apply this to anything that is TRACED, COPIED or used as a
 * handwriting reference. Those are SVG <Path> geometry (letterPaths,
 * wordPaths, activityPreviewLetterPaths, the writing stages' guide paths)
 * and carry no font at all, so typography cannot reach them — but the rule
 * stands for any future glyph rendered as text.
 *
 * Use it per-style on a Text element. Do NOT spread it onto a container:
 * a parent-level fontFamily can leak into children a screen does not own.
 */

'use strict';

/** The five faces registered in App.js. */
export const FONT_FAMILY = Object.freeze({
  regular:    'Nunito_400Regular',
  semibold:   'Nunito_600SemiBold',
  bold:       'Nunito_700Bold',
  extrabold:  'Nunito_800ExtraBold',
  black:      'Nunito_900Black',
});

/**
 * Numeric fontWeight -> the face that renders it.
 *
 * React Native maps weights to faces only for system fonts; with a named
 * custom family the weight is ignored, so the face has to be chosen
 * explicitly. '500' has no Nunito face in the bundle and rounds to semibold
 * rather than silently falling back to regular.
 */
export const WEIGHT_TO_FAMILY = Object.freeze({
  '400':    FONT_FAMILY.regular,
  'normal': FONT_FAMILY.regular,
  '500':    FONT_FAMILY.semibold,
  '600':    FONT_FAMILY.semibold,
  '700':    FONT_FAMILY.bold,
  'bold':   FONT_FAMILY.bold,
  '800':    FONT_FAMILY.extrabold,
  '900':    FONT_FAMILY.black,
});

/**
 * @param {string|number|undefined} weight
 * @returns {string} the face for that weight; regular for anything unknown.
 */
export function familyForWeight(weight) {
  if (weight === undefined || weight === null) return FONT_FAMILY.regular;
  return WEIGHT_TO_FAMILY[String(weight)] ?? FONT_FAMILY.regular;
}

/**
 * Semantic roles, matching how the Concept screens already use these faces.
 * Weight and family always agree, so a role can never render unresolved.
 */
export const TEXT_ROLE = Object.freeze({
  screenTitle:  { fontFamily: FONT_FAMILY.extrabold, fontWeight: '800' },
  sectionTitle: { fontFamily: FONT_FAMILY.bold,      fontWeight: '700' },
  cardTitle:    { fontFamily: FONT_FAMILY.bold,      fontWeight: '700' },
  body:         { fontFamily: FONT_FAMILY.regular,   fontWeight: '400' },
  helper:       { fontFamily: FONT_FAMILY.regular,   fontWeight: '400' },
  caption:      { fontFamily: FONT_FAMILY.semibold,  fontWeight: '600' },
  button:       { fontFamily: FONT_FAMILY.bold,      fontWeight: '700' },
  tab:          { fontFamily: FONT_FAMILY.bold,      fontWeight: '700' },
  badge:        { fontFamily: FONT_FAMILY.bold,      fontWeight: '700' },
  statValue:    { fontFamily: FONT_FAMILY.extrabold, fontWeight: '800' },
  emptyState:   { fontFamily: FONT_FAMILY.regular,   fontWeight: '400' },
});
