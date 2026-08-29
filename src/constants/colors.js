export const Colors = {
  primary: '#6B8EE8',
  primaryDark: '#5070D0',
  primaryLight: '#8BAAF0',
  primaryGradient: ['#7B9EF0', '#5B7EE0'],

  // The teal → green pair on the sign-in button, and the flat teal that goes with
  // it. This is the app's "primary action" colour and the first thing anyone sees
  // of the product, so it is a shared token rather than a literal repeated at each
  // surface that wants to look like the front door.
  brand: '#3A9BA8',
  brandGradient: ['#4AABB8', '#52C07C'],

  // The same two hues, deepened until white text clears AA on them — 5.16:1 and
  // 4.56:1, against 2.69 and 2.29 for the pair above. The raw gradient is sized
  // for one short label on one button; anything larger, or any text that has to
  // be read rather than recognised, uses these instead.
  //
  // `brandDeep` is the flat counterpart, for brand-coloured TEXT on a light
  // surface — where the pale `brand` teal manages only 3.26:1.
  //
  // Dark enough to clear 4.5:1 on a pale brand TINT (4.56:1), not only on pure
  // white (5.18:1). The two are not the same test, and brand text lands on a
  // tinted plate at least as often as on white — an earlier value passed on white
  // at exactly 4.50 and then failed at 3.95 the moment it sat on its own tint.
  brandDeep: '#2A7B51',
  brandGradientDeep: ['#31777E', '#36845A'],

  background: '#F0F2FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FC',
  border: '#E2E6F0',
  borderLight: '#EEF0F8',

  text: {
    primary: '#1A1A2E',
    secondary: '#5A5F7A',
    muted: '#9B9FB0',
    link: '#6B8EE8',
    white: '#FFFFFF',
    inverse: '#FFFFFF',
  },

  status: {
    error: '#FF4D6D',
    errorLight: '#FFF0F3',
    success: '#22C55E',
    successLight: '#F0FDF4',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    info: '#6B8EE8',
    infoLight: '#EEF2FF',
  },

  icon: {
    default: '#9B9FB0',
    active: '#6B8EE8',
    muted: '#C4C8D8',
  },

  divider: '#ECEEF5',
  overlay: 'rgba(0, 0, 0, 0.4)',
  shadow: 'rgba(100, 120, 200, 0.12)',
};

/**
 * The teacher workspace's page backdrop — blue → sage → cream.
 *
 * The same progression WorkspaceSelectScreen and StudentPickerScreen use, so a
 * teacher moving between the dashboard, a student and their report stays on one
 * surface rather than crossing three unrelated greys.
 *
 * Paler than the picker screens on purpose. Those are sparse and can carry the
 * saturated version; the dashboard and the report are dense grids of pure-white
 * cards, and at full strength the backdrop competes with them until the cards
 * stop reading as cards.
 *
 * Diagonal rather than straight down: a two-column layout is wide enough that a
 * vertical ramp bands visibly across it.
 *
 * Lives here rather than in one screen because it was defined inside
 * DashboardScreen and a second screen needed it — two copies of a gradient drift
 * the moment one is nudged.
 */
export const BACKDROP = {
  colors: ['#DCEFF5', '#E4F0E6', '#EFF3E4', '#FAF8F1'],
  start:  { x: 0, y: 0 },
  end:    { x: 0.6, y: 1 },
};
