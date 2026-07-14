export const AVATAR_THEMES = {
  megatron: {
    background:         '#F7FBFF',
    backgroundGradient: ['#D6E8FA', '#EAF3FD', '#F7FBFF'],
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
    headerBackground:   '#FFE8D0',
    cardSurface:        '#FFFFFF',
    cardOutline:        '#FF7518',
    button:             '#FD934B',
    buttonText:         '#FFFFFF',
    headingText:        '#1A2830',
  },
};

// Fallback theme if no avatar selected
export const DEFAULT_THEME = {
  background:         '#EDEEF8',
  backgroundGradient: ['#C8CCEE', '#DCDFF5', '#EDEEF8'],
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
