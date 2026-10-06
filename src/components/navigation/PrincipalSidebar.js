import { useContext, useRef, useState } from 'react';
import { ButtonFeedback } from '../common/ButtonFeedback';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { SidebarContext } from '../../context/SidebarContext';
import { SIDEBAR_WIDTH, MINI_WIDTH } from '../../constants/layout';

// The Auriva logo — the app icon's artwork, on its white tile.
const AURIVA_MARK = require('../../../assets/icon.png');

const CX      = MINI_WIDTH / 2;   // 32 — x-centre of icon column
const ICON_SZ = 20;
// Logo size: as large as fits centred in the collapsed (64pt) rail.
const LOGO    = 46;

const NAV_ITEMS = [
  { name: 'Dashboard', label: 'Dashboard', icon: 'home',          outline: 'home-outline',          color: '#4ACA8C' },
  { name: 'Teachers',  label: 'Faculty',   icon: 'people',        outline: 'people-outline',        color: '#6AB4E8' },
  { name: 'Students',  label: 'Students',  icon: 'school',        outline: 'school-outline',        color: '#A68FE8' },
  { name: 'Reports',   label: 'Reports',   icon: 'document-text', outline: 'document-text-outline', color: '#F0A940' },
];

// Under their own SETTINGS heading, below the main navigation.
const SETTINGS_ITEMS = [
  { name: 'Settings',  label: 'Theme Settings', icon: 'color-palette', outline: 'color-palette-outline', color: '#F28AB2' },
];

// ── palette ───────────────────────────────────────────────────────────────────
const BG    = '#0D2535';
const BG2   = '#0A1E2B';
const WHITE = '#FFFFFF';
const MID   = 'rgba(255,255,255,0.45)';
const DIM   = 'rgba(255,255,255,0.18)';
const DIV   = 'rgba(255,255,255,0.06)';
const AMBER = '#F0A940';

export default function PrincipalSidebar({ navRef, activeRoute }) {
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const { isOpen, toggle, sidebarAnim } = useContext(SidebarContext);
  const [signOutVisible, setSignOutVisible] = useState(false);

  // Collapsed-mode tooltip: shown on hover (mouse/trackpad) or long-press (touch).
  // Rendered in a Modal so it isn't clipped by the sidebar's overflow:hidden container.
  const [tooltip, setTooltip] = useState(null); // { label, x, y }
  const itemRefs = useRef({});

  function showTooltip(key, label) {
    if (isOpen) return;
    const node = itemRefs.current[key];
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      setTooltip({ label, x: x + width, y: y + height / 2 });
    });
  }
  function hideTooltip() {
    setTooltip(null);
  }

  // Animated values for label fade/slide
  const labelOpacity = sidebarAnim.interpolate({
    inputRange: [MINI_WIDTH, SIDEBAR_WIDTH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const labelX = sidebarAnim.interpolate({
    inputRange: [MINI_WIDTH, SIDEBAR_WIDTH],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });
  const ls = { opacity: labelOpacity, transform: [{ translateX: labelX }] };

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>

      {/* ── Logo ── */}
      <View style={styles.logoRow}>
        {/* The logo doubles as the expand / collapse control, as the box did. */}
        <ButtonFeedback
          onPress={toggle}
          activeOpacity={0.75}
          style={styles.logoBox}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Auriva. Collapse the menu' : 'Auriva. Expand the menu'}
        >
          <Image source={AURIVA_MARK} style={styles.logoImage} resizeMode="cover" />
        </ButtonFeedback>
        <Animated.View style={[styles.logoText, ls]}>
          <Text style={styles.logoTitle} numberOfLines={1}>Auriva</Text>
          <Text style={styles.logoSub} numberOfLines={1}>Principal Portal</Text>
        </Animated.View>
        <Animated.View style={[{ overflow: 'hidden' }, ls]}>
          <ButtonFeedback onPress={toggle} activeOpacity={0.7} style={styles.toggleBtn}>
            <Ionicons name="chevron-back" size={13} color={MID} />
          </ButtonFeedback>
        </Animated.View>
      </View>

      <View style={styles.divider} />

      {/* ── Category label ── */}
      <Animated.Text style={[styles.catLabel, ls]}>NAVIGATION</Animated.Text>

      {/* ── Nav items ── */}
      <View style={styles.nav}>
        {[...NAV_ITEMS, null, ...SETTINGS_ITEMS].map((item) => {
          if (item === null) {
            return (
              <Animated.Text key="settings-label" style={[styles.catLabel, styles.catLabelGroup, ls]}>
                SETTINGS
              </Animated.Text>
            );
          }
          const active = activeRoute === item.name;
          return (
            // ButtonFeedback is a TouchableOpacity: it takes a plain style (a
            // ({ pressed }) => style function is silently dropped, which left
            // each row stacking icon over label) and cannot hold a ref, so the
            // tooltip measures this wrapping View instead.
            <View
              key={item.name}
              ref={(node) => { itemRefs.current[item.name] = node; }}
              collapsable={false}
            >
            <ButtonFeedback
              onPress={() => navRef.current?.navigate(item.name)}
              onLongPress={() => showTooltip(item.name, item.label)}
              onPressOut={hideTooltip}
              onHoverIn={() => showTooltip(item.name, item.label)}
              onHoverOut={hideTooltip}
              delayLongPress={350}
              activeOpacity={0.75}
              style={[styles.row, active && styles.rowActive]}
            >
              {/* Left accent bar */}
              <View style={[styles.accentBar, active && { backgroundColor: item.color }]} />

              <View style={[styles.iconSlot, active && { backgroundColor: item.color + '18' }]}>
                <Ionicons
                  name={active ? item.icon : item.outline}
                  size={ICON_SZ}
                  color={active ? item.color : MID}
                />
              </View>

              <Animated.Text
                numberOfLines={1}
                style={[styles.rowLabel, active && { color: WHITE, fontFamily: 'DMSans_700Bold' }, ls]}
              >
                {item.label}
              </Animated.Text>

              {active && (
                <Animated.View style={[styles.activeDot, ls]}>
                  <View style={[styles.activeDotInner, { backgroundColor: item.color }]} />
                </Animated.View>
              )}
            </ButtonFeedback>
            </View>
          );
        })}
      </View>

      {/* ── Bottom ── */}
      <View style={styles.divider} />

      <View ref={(node) => { itemRefs.current.signOut = node; }} collapsable={false}>
      <ButtonFeedback
        onPress={() => setSignOutVisible(true)}
        onLongPress={() => showTooltip('signOut', 'Sign Out')}
        onPressOut={hideTooltip}
        onHoverIn={() => showTooltip('signOut', 'Sign Out')}
        onHoverOut={hideTooltip}
        delayLongPress={350}
        activeOpacity={0.75}
        style={styles.signOutRow}
      >
        <View style={styles.iconSlot}>
          <Ionicons name="log-out-outline" size={ICON_SZ} color="#D94848" />
        </View>
        <Animated.Text numberOfLines={1} style={[styles.signOutLabel, ls]}>
          Sign Out
        </Animated.Text>
      </ButtonFeedback>
      </View>

      <ConfirmDialog
        visible={signOutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        icon="log-out-outline"
        danger
        onConfirm={logout}
        onCancel={() => setSignOutVisible(false)}
      />

      {/* ── Collapsed-mode tooltip ── */}
      {tooltip && (
        <Modal transparent visible animationType="none" onRequestClose={hideTooltip}>
          <View style={styles.tooltipLayer} pointerEvents="none">
            <View style={[styles.tooltipBubble, { left: tooltip.x + 8, top: tooltip.y - 14 }]}>
              <View style={styles.tooltipArrow} />
              <Text style={styles.tooltipText} numberOfLines={1}>{tooltip.label}</Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    flex: 1,
    backgroundColor: BG,
    borderRightWidth: 1,
    borderRightColor: DIV,
  },

  // ── Logo ─────────────────────────────────────────────────────────────────
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: CX - LOGO / 2,   // centres the logo on the icon column (CX=32)
    paddingRight: 12,
    gap: 10,
    marginBottom: 4,
  },
  logoBox: {
    width: LOGO, height: LOGO, borderRadius: 13,
    backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImage: { width: LOGO, height: LOGO },
  logoText: { flex: 1, overflow: 'hidden' },
  logoTitle: { fontSize: 17, fontFamily: 'DMSans_900Black', color: WHITE, letterSpacing: 0.3 },
  logoSub:   { fontSize: 9,  fontFamily: 'DMSans_600SemiBold', color: DIM, letterSpacing: 0.5, marginTop: 1 },
  toggleBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: DIV,
    marginHorizontal: 14,
    marginVertical: 14,
  },

  // ── Category label ────────────────────────────────────────────────────────
  catLabel: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: AMBER,
    letterSpacing: 1.3,
    paddingLeft: CX - 18 + 4,   // slight indent past icon left edge
    marginBottom: 6,
    overflow: 'hidden',
  },
  // A second heading inside the list, set apart from the items above it.
  catLabelGroup: { marginTop: 16 },

  // ── Nav items ─────────────────────────────────────────────────────────────
  nav: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  rowActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  accentBar: {
    position: 'absolute',
    left: 0, top: 8, bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  iconSlot: {
    width: MINI_WIDTH - 20,   // 44px
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: MID,
    flex: 1,
    flexShrink: 1,
  },
  activeDot: { paddingRight: 14, overflow: 'hidden' },
  activeDotInner: { width: 6, height: 6, borderRadius: 3 },

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    // A white button on the dark rail; the red icon and text still say 'sign out'.
    backgroundColor: WHITE,
  },
  signOutLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#D94848',
    flexShrink: 1,
  },

  // ── Collapsed-mode tooltip ───────────────────────────────────────────────
  tooltipLayer: { flex: 1 },
  tooltipBubble: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12303F',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  tooltipArrow: {
    position: 'absolute',
    left: -4,
    width: 8, height: 8,
    backgroundColor: '#12303F',
    transform: [{ rotate: '45deg' }],
  },
  tooltipText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
