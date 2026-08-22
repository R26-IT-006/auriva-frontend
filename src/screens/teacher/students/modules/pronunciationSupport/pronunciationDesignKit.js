import React, { useEffect, useRef } from "react";
import { Animated, Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
