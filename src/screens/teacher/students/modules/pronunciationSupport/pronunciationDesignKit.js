import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Darkens a "#RRGGBB" theme color by `amount` (0-1) so a single avatar-theme
// button color can become a 2-stop gradient — the same lighter-to-darker
// diagonal fill components/common/Button.js uses for its primary variant,
// just derived from whichever avatar theme is active instead of a fixed hue.
function shadeColor(hex, amount) {
  const clean = (hex || "#000000").replace("#", "");
  const num = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  const channel = (shift) => {
    const value = (num >> shift) & 0xff;
    return Math.max(0, Math.min(255, Math.round(value * (1 - amount))));
  };
  const r = channel(16);
  const g = channel(8);
  const b = channel(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function themeButtonGradient(theme) {
  const base = theme?.button || "#6B8EE8";
  return [base, shadeColor(base, 0.22)];
}

// Primary-CTA gradient fill matching Button.js's diagonal primary variant,
// but keyed off the child's avatar theme instead of the fixed teal/green.
// Wrap the existing ButtonFeedback children in this; ButtonFeedback still
// owns the press-scale spring, this only owns the fill.
export function ThemedGradientFill({ theme, style, children }) {
  return (
    <LinearGradient
      colors={themeButtonGradient(theme)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

// Same 4 keys as constants/avatarThemes.js — the character the child picked
// during onboarding, reused here so the session flow keeps showing "their"
// avatar instead of only borrowing its color palette.
export const AVATAR_IMAGE_MAP = {
  megatron: require("../../../../../../assets/avatar-images/Megatron.png"),
  lily: require("../../../../../../assets/avatar-images/Lily.png"),
  glitter: require("../../../../../../assets/avatar-images/Glitter.png"),
  boba: require("../../../../../../assets/avatar-images/Boba.png"),
};

export function getAvatarImageSource(avatarKey) {
  return AVATAR_IMAGE_MAP[avatarKey] || null;
}

// Small circular portrait of the child's avatar, meant to sit beside their
// name in a session header — the identity marker every other module gives
// the child (dashboard hub video, handwriting's welcome thumbnail) that this
// module never showed.
export function AvatarIdentityBadge({ avatarKey, size = 40, theme, style }) {
  const source = getAvatarImageSource(avatarKey);
  const shapeStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: theme?.cardOutline || "#FFFFFF",
    backgroundColor: theme?.cardSurface || "#FFFFFF",
  };

  // No avatar chosen yet (or an unknown key) — keep the same footprint as a
  // neutral placeholder rather than collapsing the header layout.
  if (!source) {
    return <View style={[shapeStyle, style]} />;
  }

  return <Image source={source} style={[shapeStyle, style]} />;
}

// Matches the entrance recipe already established by the app's most
// animated screen (teacher/students/StudentDashboardScreen ModuleCard):
// spring fade + scale-up from 0.6, staggered by index. Kept as a one-time
// mount animation (never a loop) so it stays inside the "entrance", not the
// "celebration effects" the reduce_stimulation setting is meant to gate.
export function EntranceItem({ index = 0, style, children }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      delay: index * 70,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Animated.View style={[style, { opacity: enter, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// Selection language
//
// Every pick-one surface in this module (session mode, category, word,
// mouth shape) used to signal "selected" with nothing but a border going
// from `theme.cardOutline` to `theme.button` and 1px to 2px. On the warmer
// avatar themes those two colours are near-identical — boba's outline is
// #FF7518 and its button is #FD934B — so an untouched card and the chosen
// one looked the same, and the teacher had no way to tell what was armed.
//
// The replacement follows how selection actually reads in shipped pickers
// (iOS list checkmarks, Material 3 selected cards): the unselected state
// goes quiet and neutral, and the selected state stacks four independent
// signals so it survives colour-blindness, glare on a shared tablet, and
// an arm's-length glance:
//
//   1. a neutral hairline becomes a 2pt border in the avatar's own colour
//   2. the card body picks up a soft wash of that same colour
//   3. the card lifts on a real offset shadow
//   4. a filled checkmark badge appears, which is the only signal that
//      carries no colour dependency at all
//
// Shadow and border live on different views on purpose: these cards clip
// their contents with `overflow: "hidden"`, and on iOS that same property
// clips the shadow away. `selectionElevation` goes on the outer wrapper
// (EntranceItem accepts a style), `selectionSurface` on the card itself.

// The quiet state. Deliberately not derived from the avatar theme — a
// themed outline on an unselected card is exactly what made every card
// look chosen.
export const SELECTION_NEUTRAL_OUTLINE = "#D9E0EA";

function withAlpha(hex, alpha) {
  const clean = (hex || "#000000").replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const channel = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${full}${channel}`;
}

// A wash rather than a fill when selected: the card's own artwork panel
// still has to read on top of it.
function selectionFill(theme, selected) {
  return selected
    ? withAlpha(theme?.button || "#6B8EE8", 0.12)
    : theme?.cardSurface || "#FFFFFF";
}

// The raw avatar button colour is a fill colour, tuned to sit under white
// text. Two of the four themes (boba #FD934B, glitter #EB6E94) are far too
// light to serve as a 2pt state border on white — around 2:1 against the
// panel, under the 3:1 that a non-text state indicator owes. Darkening
// keeps the child's hue and buys the contrast: 18% for the frame and badge,
// 45% for text on the tinted wash.
function selectionAccent(theme) {
  return shadeColor(theme?.button || "#6B8EE8", 0.18);
}

// Goes on the wrapper (EntranceItem), never on a card that clips.
//
// `radius` must match the card's own borderRadius: Android derives its
// elevation shadow from the view outline, so a wrapper left at radius 0
// casts a square shadow behind a rounded card. The matching fill keeps the
// wrapper from showing as a seam under the card's border.
export function selectionElevation(theme, selected, radius = 12) {
  const accent = selectionAccent(theme);
  const base = {
    borderRadius: radius,
    backgroundColor: selectionFill(theme, selected),
  };

  if (!selected) {
    return {
      ...base,
      shadowColor: "#1A2030",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    };
  }

  return {
    ...base,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
  };
}

// Goes on the card. Replaces both the inline backgroundColor and the
// borderColor ternary each screen used to carry.
export function selectionSurface(theme, selected) {
  return {
    backgroundColor: selectionFill(theme, selected),
    borderColor: selected ? selectionAccent(theme) : SELECTION_NEUTRAL_OUTLINE,
    borderWidth: selected ? 2 : 1,
  };
}

// Screens that colour their own title text can lift it to the avatar
// colour when chosen, so the label agrees with the frame around it. Deeply
// shaded so it clears 4.5:1 against the tinted wash it sits on.
export function selectionTextColor(theme, selected, fallback) {
  if (!selected) return fallback;
  return shadeColor(theme?.button || fallback, 0.45);
}

/**
 * SelectionCheck
 *
 * The colour-independent half of the selection language. Springs in when a
 * card becomes the chosen one and collapses when it loses the selection —
 * the one authored motion on these screens, so the eye is pulled to what
 * just changed rather than to five cards animating at once.
 *
 * Absolutely positioned by default (top-right inside the card). Pass
 * `style` to move it.
 */
export function SelectionCheck({ selected = false, theme, size = 26, style }) {
  const accent = selectionAccent(theme);
  // Always starts collapsed, even when the card mounts already selected —
  // the badge then springs in on entry, which is what makes an already-made
  // choice announce itself when the screen appears.
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  }, [pop, selected]);

  // Overshoots slightly on the way in, which is what makes the badge read
  // as a confirmation rather than as a static corner ornament.
  const scale = pop.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.2, 1.08, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.selectionCheck,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent,
        },
        style,
        { opacity: pop, transform: [{ scale }] },
      ]}
    >
      <Ionicons name="checkmark" size={Math.round(size * 0.62)} color="#FFFFFF" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  selectionCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    alignItems: "center",
    justifyContent: "center",
    // White ring so the badge holds its edge over any artwork panel colour.
    borderWidth: 2,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
});
