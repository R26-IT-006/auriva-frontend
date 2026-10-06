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
    // "Needs teacher review" amber — a distinct semantic from warning
    // (low-confidence AI scoring flagged for a human, not an error state).
    // Was hand-copied as raw hex across 3 pronunciationSupport files.
    review: '#8A6D1D',
    reviewLight: '#FDF3D7',
    reviewBorder: '#EAD9A0',
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
 * The teacher workspace's page backdrop — the dashboard, the student profile and
 * the reports — built from the app's signature gradient, sky blue → mint → pale
 * green → cream (['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']), which the sign-in
 * screens, WorkspaceSelectScreen and StudentPickerScreen all draw. The workspace
 * then reads as the same app a teacher just signed in to and picked a workspace in.
 *
 * Its first stop is that gradient's own sky blue, so stepping in from the
 * workspace picker the top of the screen does not change colour. It then softens through
 * the same mint and settles, by just under half the screen height, on a mint-cream
 * a step down from the gradient's cream.
 *
 * Not the full-strength gradient end to end. The picker screens are a few big
 * cards and can carry it; these are dense pages of white panels and text, and
 * under saturated mint the panels' edges and the grey body text both lose
 * contrast. Nor washed out to near-white everywhere — that was tried, and the
 * pages stopped looking like part of the app.
 *
 * Vertical, matching the signature gradient's direction (expo's default is
 * top → bottom).
 *
 * Lives here rather than in one screen because it was defined inside
 * DashboardScreen and a second screen needed it — two copies of a gradient drift
 * the moment one is nudged.
 */
export const BACKDROP = {
  colors: ['#B8E4F0', '#C3E5D3', '#E5F0E2', '#EFF3EA'],
  start:  { x: 0, y: 0 },
  end:    { x: 0, y: 0.45 },
};

/**
 * The sign-in screen's gradient (LoginScreen.js), top to bottom: sky blue →
 * green → cream. Used by the teacher dashboard and student profile so they
 * share the login page's background.
 */
export const LOGIN_BACKDROP = {
  colors: ['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0'],
  start:  { x: 0, y: 0 },
  end:    { x: 0, y: 1 },
};
