import { useContext, useRef, useState } from 'react';
import { ButtonFeedback } from '../components/common/ButtonFeedback';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { SidebarContext } from '../../context/SidebarContext';
import { SIDEBAR_WIDTH, MINI_WIDTH } from '../../navigation/PrincipalNavigator';

const CX      = MINI_WIDTH / 2;   // 32 — x-centre of icon column
const ICON_SZ = 20;

const NAV_ITEMS = [
  { name: 'Dashboard', label: 'Dashboard', icon: 'home',          outline: 'home-outline',          color: '#4ACA8C' },
  { name: 'Teachers',  label: 'Faculty',   icon: 'people',        outline: 'people-outline',        color: '#6AB4E8' },
  { name: 'Students',  label: 'Students',  icon: 'school',        outline: 'school-outline',        color: '#A68FE8' },
];

// ── palette ───────────────────────────────────────────────────────────────────
const BG    = '#0D2535';
const BG2   = '#0A1E2B';
const WHITE = '#FFFFFF';
const MID   = 'rgba(255,255,255,0.45)';
const DIM   = 'rgba(255,255,255,0.18)';
const DIV   = 'rgba(255,255,255,0.06)';
const AMBER = '#F0A940';
const GREEN = '#4ACA8C';

export default function PrincipalSidebar({ navRef, activeRoute }) {
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const user   = useAuthStore((s) => s.user);
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

  // User initials
  const fullName = user?.full_name ?? 'Principal';
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>

      {/* ── Logo ── */}
      <View style={styles.logoRow}>
        <ButtonFeedback onPress={toggle} activeOpacity={0.75} style={styles.logoBox}>
          <Ionicons name={isOpen ? 'sparkles' : 'chevron-forward'} size={15} color={WHITE} />
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

      {/* ── User profile ── */}
      <View style={styles.profileRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Animated.View style={[styles.profileInfo, ls]}>
          <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>Administrator</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.divider} />

      {/* ── Category label ── */}
      <Animated.Text style={[styles.catLabel, ls]}>NAVIGATION</Animated.Text>

      {/* ── Nav items ── */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = activeRoute === item.name;
          return (
            <ButtonFeedback
              key={item.name}
              ref={(node) => { itemRefs.current[item.name] = node; }}
              onPress={() => navRef.current?.navigate(item.name)}
              onLongPress={() => showTooltip(item.name, item.label)}
              onPressOut={hideTooltip}
              onHoverIn={() => showTooltip(item.name, item.label)}
              onHoverOut={hideTooltip}
              delayLongPress={350}
              style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.75 }]}
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
                style={[styles.rowLabel, active && { color: WHITE, fontFamily: 'Nunito_700Bold' }, ls]}
              >
                {item.label}
              </Animated.Text>

              {active && (
                <Animated.View style={[styles.activeDot, ls]}>
                  <View style={[styles.activeDotInner, { backgroundColor: item.color }]} />
                </Animated.View>
              )}
            </ButtonFeedback>
          );
        })}
      </View>

      {/* ── Bottom ── */}
      <View style={styles.divider} />

      <ButtonFeedback
        ref={(node) => { itemRefs.current.signOut = node; }}
        onPress={() => setSignOutVisible(true)}
        onLongPress={() => showTooltip('signOut', 'Sign Out')}
        onPressOut={hideTooltip}
        onHoverIn={() => showTooltip('signOut', 'Sign Out')}
        onHoverOut={hideTooltip}
        delayLongPress={350}
        style={({ pressed }) => [styles.signOutRow, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.iconSlot}>
          <Ionicons name="log-out-outline" size={ICON_SZ} color="#F26B6B" />
        </View>
        <Animated.Text numberOfLines={1} style={[styles.signOutLabel, ls]}>
          Sign Out
        </Animated.Text>
      </ButtonFeedback>

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
    paddingLeft: CX - 18,   // centres 36px box at CX=32
    paddingRight: 12,
    gap: 10,
    marginBottom: 4,
  },
  logoBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#1E9D7A',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: { flex: 1, overflow: 'hidden' },
  logoTitle: { fontSize: 15, fontFamily: 'Nunito_900Black', color: WHITE, letterSpacing: 0.3 },
  logoSub:   { fontSize: 9,  fontFamily: 'Nunito_600SemiBold', color: DIM, letterSpacing: 0.5, marginTop: 1 },
  toggleBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // ── User profile ─────────────────────────────────────────────────────────
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: CX - 18,
    paddingRight: 12,
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A4A5E',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarInitials: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: WHITE },
  profileInfo: { flex: 1, overflow: 'hidden', gap: 3 },
  profileName: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: WHITE },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN },
  roleText: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: MID },

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
    fontFamily: 'Nunito_700Bold',
    color: AMBER,
    letterSpacing: 1.3,
    paddingLeft: CX - 18 + 4,   // slight indent past icon left edge
    marginBottom: 6,
    overflow: 'hidden',
  },

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
    fontFamily: 'Nunito_600SemiBold',
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
    backgroundColor: 'rgba(220,60,60,0.12)',
  },
  signOutLabel: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    color: '#F26B6B',
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
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
});
