import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

/**
 * Responsive sizing for tablets of any size and shape.
 *
 * The app was designed on a 1280 × 800 tablet (the 9.5" × 6.4" teacher
 * tablet). Every size in a stylesheet is a size *on that tablet*; rs() and rf()
 * turn it into the size for the device the app is running on:
 *
 *   k = min(shortSide / 800, longSide / 1280)
 *
 * Sides, not width and height, so the factor is the same in portrait and
 * landscape — the teacher screens are portrait and the child's are landscape,
 * and both must keep the same proportions. Taking the smaller of the two ratios
 * means a layout always fits the tighter dimension: a squarer 4:3 tablet scales
 * to its width, a long 16:9 one to its height, so nothing is cut off.
 *
 *   1280 × 800 (design tablet) → k = 1    — sizes unchanged
 *    960 × 600 (7" tablet)     → k = 0.75 — everything a quarter smaller
 *   1024 × 768 (4:3 tablet)    → k = 0.8
 *   1366 × 1024 (12.9" tablet) → k ≈ 1.07 — a little larger, no wasted margins
 *
 * k is clamped so a phone or a very large screen degrades gracefully rather than
 * producing unreadably small or comically large UI.
 *
 * Text uses rf(), which scales half as much as layout: a 7" tablet gets type
 * about 12% smaller, not 25%, so it stays readable for a child.
 */

const BASE_SHORT = 800;
const BASE_LONG = 1280;
const K_MIN = 0.7;
const K_MAX = 1.3;

export function scaleFactorFor(width, height) {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const k = Math.min(short / BASE_SHORT, long / BASE_LONG);
  return Math.max(K_MIN, Math.min(K_MAX, k));
}

// The SCREEN, not the window: on Android the window excludes the status and
// navigation bars (a 1280 × 800 tablet reports a window of about 1280 × 752),
// which would shrink everything ~6% on the very tablet the app was designed on.
// The screen's sides also do not change when it rotates, so a factor computed
// at launch is right in both orientations. (useResponsive below gives the live
// window for layouts that need the current orientation.)
const screen = Dimensions.get('screen');
export const K = scaleFactorFor(screen.width, screen.height);

const round = (n) => PixelRatio.roundToNearestPixel(n);

/** A layout size (width, height, padding, margin, gap, radius…) for this device. */
export function rs(n) {
  return round(n * K);
}

/** A font size or line height for this device — scales half as much as layout. */
export function rf(n) {
  return round(n * (1 + (K - 1) * 0.5));
}

/**
 * The live window plus the helpers, for layouts that depend on the current
 * width, height or orientation (column counts, image sizes as a share of the
 * screen, landscape-only arrangements).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  // The same device factor as rs()/rf() — taken from the screen, not the window.
  const k = K;
  return {
    width,
    height,
    k,
    isLandscape: width > height,
    short: Math.min(width, height),
    long: Math.max(width, height),
    // Smaller than the design tablet in its tighter dimension — e.g. 7".
    isCompact: k < 0.9,
    rs: (n) => round(n * k),
    rf: (n) => round(n * (1 + (k - 1) * 0.5)),
  };
}
