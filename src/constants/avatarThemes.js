import { Colors } from './colors';

/**
 * `heroGradient` is the saturated, two-stop counterpart to `backgroundGradient`.
 *
 * The pale `backgroundGradient` is built to sit *behind* white cards with dark
 * `headingText` on top — drop white text on it and nothing reads. Surfaces that
 * are themselves the colour block (the student profile hero) need the opposite:
 * a pair deep enough to carry white text. Each one is anchored on its avatar's
 * own identity hue, so the two gradients still look like the same character.
 *
 * Ordered light → dark to match `Colors.primaryGradient`, since they are drawn
 * on the same top-left → bottom-right diagonal.
 */
export const AVATAR_THEMES = {
  megatron: {
    background:         '#F7FBFF',
    backgroundGradient: ['#D6E8FA', '#EAF3FD', '#F7FBFF'],
    heroGradient:       ['#4C7FD1', '#302E91'],
    headerBackground:   '#DCF0FF',
    cardSurface:        '#FFFFFF',
    cardOutline:        '#85B7EB',
    button:             '#302E91',
    buttonText:         '#FFFFFF',
    headingText:        '#3D2C2C',
  },
  lily: {
    background:         '#F5FFFA',
    backgroundGradient: ['#C2EDD9', '#DDF5EB', '#F5FFFA'],
    heroGradient:       ['#4FB893', '#2F6459'],
    headerBackground:   '#D5FCEF',
    cardSurface:        '#FFFFFF',
    cardOutline:        '#5DCAA5',
    button:             '#3D7A6E',
    buttonText:         '#FFFFFF',
    headingText:        '#1A3040',
  },
  glitter: {
    background:         '#FFF8FE',
    backgroundGradient: ['#F7C5D8', '#FBDDE8', '#FFF8FE'],
    heroGradient:       ['#EE7C9E', '#C43F6B'],
    headerBackground:   '#FDE8F2',
    cardSurface:        '#FFFFFF',
    cardOutline:        '#EB6E94',
    button:             '#EB6E94',
    buttonText:         '#FFFFFF',
    headingText:        '#2A2018',
  },
  boba: {
    background:         '#F9FAFE',
    backgroundGradient: ['#FFD9B8', '#FDEBD6', '#F9FAFE'],
    heroGradient:       ['#FB8A3C', '#D95A0E'],
    headerBackground:   '#FFE8D0',
    cardSurface:        '#FFFFFF',
    cardOutline:        '#FF7518',
    button:             '#FD934B',
    buttonText:         '#FFFFFF',
    headingText:        '#1A2830',
  },
};

// Fallback theme if no avatar selected. The hero falls back to the app's own
// primary gradient rather than this theme's orange: with no avatar chosen there
// is no character to echo, so the neutral app chrome is the honest answer.
export const DEFAULT_THEME = {
  background:         '#EDEEF8',
  backgroundGradient: ['#C8CCEE', '#DCDFF5', '#EDEEF8'],
  heroGradient:       Colors.primaryGradient,
  headerBackground:   '#DDE0F8',
  cardSurface:        '#FFFFFF',
  cardOutline:        '#E8832A',
  button:             '#E8832A',
  buttonText:         '#FFFFFF',
  headingText:        '#1A1A1A',
};

export function getAvatarTheme(avatarKey) {
  return AVATAR_THEMES[avatarKey] ?? DEFAULT_THEME;
}
