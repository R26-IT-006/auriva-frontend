import { useContext, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { SidebarContext } from '../../context/SidebarContext';
import { SIDEBAR_WIDTH, MINI_WIDTH } from '../../navigation/PrincipalNavigator';

// All rows share the same icon size and alignment.
// Icon center = MINI_WIDTH / 2 = 32px from sidebar edge.
// Rows have marginHorizontal: ROW_MX, so:
//   paddingLeft = (MINI_WIDTH / 2) - ROW_MX - (ICON_SIZE / 2)
const ICON_SIZE = 20;
const ROW_MX    = 8;
const ROW_PAD_L = MINI_WIDTH / 2 - ROW_MX - ICON_SIZE / 2; // = 14

// Logo icon box is 36px — needs its own left padding (no row margin)
const LOGO_ICON_SIZE = 36;
const LOGO_PAD_L     = MINI_WIDTH / 2 - LOGO_ICON_SIZE / 2; // = 14

const NAV_ITEMS = [
  { name: 'Dashboard', label: 'Dashboard', icon: 'home',   iconOutline: 'home-outline'   },
  { name: 'Teachers',  label: 'Teachers',  icon: 'people', iconOutline: 'people-outline' },
  { name: 'Students',  label: 'Students',  icon: 'person', iconOutline: 'person-outline' },
];

// Shared colours
const WHITE       = '#FFFFFF';
const WHITE_MID   = 'rgba(255,255,255,0.55)';
const WHITE_DIM   = 'rgba(255,255,255,0.35)';
const DIVIDER_CLR = 'rgba(255,255,255,0.08)';

export default function PrincipalSidebar({ navRef, activeRoute }) {
  const insets = useSafeAreaInsets();
  const logout  = useAuthStore((s) => s.logout);
  const { isOpen, toggle, sidebarAnim } = useContext(SidebarContext);
  const [signOutVisible, setSignOutVisible] = useState(false);

  const labelOpacity = sidebarAnim.interpolate({
    inputRange:  [MINI_WIDTH, SIDEBAR_WIDTH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const labelTranslate = sidebarAnim.interpolate({
    inputRange:  [MINI_WIDTH, SIDEBAR_WIDTH],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });
  const labelStyle = { opacity: labelOpacity, transform: [{ translateX: labelTranslate }] };

  return (
    <LinearGradient
      colors={['#1A6B7A', '#226F80', '#2E8FA3']}
      style={[styles.sidebar, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
    >

      {/* ── Top: logo + toggle ───────────────────────────────────────────── */}
      <View style={styles.top}>
        <View style={styles.logoRow}>
          <View style={styles.logoIconBox}>
            <Ionicons name="sparkles" size={16} color={WHITE} />
          </View>
          <Animated.View style={[styles.logoTextWrap, labelStyle]}>
            <Text style={styles.logoTitle} numberOfLines={1}>Auriva</Text>
            <Text style={styles.logoSub}   numberOfLines={1}>Principal Portal</Text>
          </Animated.View>
        </View>

        <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.toggleBtn}>
          <Ionicons
            name={isOpen ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={WHITE_DIM}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* ── Main: nav items ──────────────────────────────────────────────── */}
      <View style={styles.navSection}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => navRef.current?.navigate(item.name)}
              activeOpacity={0.7}
              style={[styles.row, isActive && styles.rowActive]}
            >
              <Ionicons
                name={isActive ? item.icon : item.iconOutline}
                size={ICON_SIZE}
                color={isActive ? WHITE : WHITE_MID}
              />
              <Animated.Text
                numberOfLines={1}
                style={[styles.rowLabel, isActive && styles.rowLabelActive, labelStyle]}
              >
                {item.label}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Bottom: sign-out ─────────────────────────────────────────────── */}
      <View style={styles.divider} />
      <TouchableOpacity
        onPress={() => setSignOutVisible(true)}
        activeOpacity={0.7}
        style={[styles.row, styles.signOutRow]}
      >
        <Ionicons name="log-out-outline" size={ICON_SIZE} color="#222222" />
        <Animated.Text numberOfLines={1} style={[styles.rowLabel, styles.signOutLabel, labelStyle]}>
          Sign Out
        </Animated.Text>
      </TouchableOpacity>

      <ConfirmDialog
        visible={signOutVisible}
        title="Sign Out"
        message="Are you sure you want to end your session?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        icon="log-out-outline"
        onConfirm={logout}
        onCancel={() => setSignOutVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    flex: 1,
  },

  // ── Top ──────────────────────────────────────────────────────────────────
  top: {
    gap: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: LOGO_PAD_L,
    paddingRight: 12,
    gap: 10,
  },
  logoIconBox: {
    width: LOGO_ICON_SIZE,
    height: LOGO_ICON_SIZE,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoTextWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  logoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.2,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: '500',
    color: WHITE_DIM,
    marginTop: 1,
  },

  toggleBtn: {
    alignSelf: 'flex-start',
    marginLeft: MINI_WIDTH / 2 - 14,  // centres the 28px button under the logo icon
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: DIVIDER_CLR,
    marginHorizontal: ROW_MX,
    marginVertical: 10,
  },

  // ── Shared row (nav items + sign-out) ─────────────────────────────────────
  navSection: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: ROW_PAD_L,
    paddingRight: 14,
    marginHorizontal: ROW_MX,
    borderRadius: 12,
    gap: 12,
  },
  rowActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: WHITE_MID,
    flexShrink: 1,
  },
  rowLabelActive: {
    color: WHITE,
  },

  signOutRow: {
    backgroundColor: '#F2F2F2',
  },
  signOutLabel: {
    color: '#222222',
  },
});
