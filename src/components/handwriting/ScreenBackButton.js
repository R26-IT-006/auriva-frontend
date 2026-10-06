/**
 * ScreenBackButton.js
 *
 * The one back control for the handwriting module, so every screen's back
 * affordance looks and behaves the same instead of each one growing its own.
 *
 * ── Why a `gated` prop ─────────────────────────────────────────────────────
 * Two different situations need two different behaviours:
 *
 *   gated={false}  Informational / chooser screens (instructions, greeting,
 *                  practice hub). Nothing is lost by leaving, so the button
 *                  navigates immediately.
 *
 *   gated={true}   Screens with work IN PROGRESS (an assessment being
 *                  captured, a pre-writing activity). A child tapping back
 *                  here would abandon captured strokes, so the caller routes
 *                  the tap through ParentGateModal exactly as LetterHomeScreen
 *                  and the Concept screens already do — this component never
 *                  navigates on its own in that case, it just reports the tap.
 *
 * The component itself is deliberately dumb: it renders a button and calls
 * `onPress`. Deciding what "back" means, and whether a code is required, stays
 * with the screen that knows its own state.
 */

'use strict';

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// `tint` is still accepted for compatibility but no longer changes the look:
// every back button in the student workspace shares the same style
// (constants/backButton.js BACK_BUTTON — mirrored in styles.btn below).
export default function ScreenBackButton({
  onPress,
  color = '#5A5F7A',
  // eslint-disable-next-line no-unused-vars
  tint,
  gated = false,
  style,
  accessibilityLabel,
}) {
  return (
    <TouchableOpacity
      // styles.btn last, so a caller's style can position the button but not restyle it.
      style={[style, styles.btn]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      // The label states the code requirement so a screen reader announces it
      // before the tap, not after the modal appears.
      accessibilityLabel={accessibilityLabel ?? (gated ? 'Back — needs a grown-up code' : 'Back')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="arrow-back" size={20} color={color} />
    </TouchableOpacity>
  );
}

// Same values as constants/backButton.js BACK_BUTTON.
const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
