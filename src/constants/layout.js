import { Dimensions } from 'react-native';
import { rs, rf } from '../utils/responsive';

const { width, height } = Dimensions.get('window');

export const Layout = {
  window: { width, height },
  isSmallDevice: width < 375,

  // Sized for the 1280 × 800 design tablet and scaled to this device — see
  // utils/responsive.js. On the design tablet these are exactly the numbers
  // written here.
  spacing: {
    xs: rs(4),
    sm: rs(8),
    md: rs(16),
    lg: rs(24),
    xl: rs(32),
    xxl: rs(48),
  },

  radius: {
    sm: rs(8),
    md: rs(12),
    lg: rs(16),
    xl: rs(24),
    full: 9999,
  },

  fontSize: {
    xs: rf(11),
    sm: rf(13),
    md: rf(15),
    lg: rf(17),
    xl: rf(20),
    xxl: rf(24),
    xxxl: rf(30),
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  fonts: {
    regular:   'DMSans_400Regular',
    semibold:  'DMSans_600SemiBold',
    bold:      'DMSans_700Bold',
    extrabold: 'DMSans_800ExtraBold',
    black:     'DMSans_900Black',
  },

  shadow: {
    sm: {
      shadowColor: '#6478C8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#6478C8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#6478C8',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
  },

  headerHeight: 56,
  tabBarHeight: 60,
};

// Principal sidebar rail widths, expanded and collapsed. They live here rather
// than in PrincipalNavigator because PrincipalSidebar needs them too, and a
// component importing from the navigator that renders it is a cycle.
export const SIDEBAR_WIDTH = 230;
export const MINI_WIDTH    = 64;
