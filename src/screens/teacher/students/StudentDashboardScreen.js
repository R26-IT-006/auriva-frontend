import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, Pressable, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { useAuthStore } from '../../../store/authStore';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { useToast } from '../../../context/ToastContext';

// ── Assets ────────────────────────────────────────────────────────────────────
const AVATAR_VIDEOS = {
  boba:     require('../../../../assets/avatar-videos/BobaGreeting.mp4'),
  lily:     require('../../../../assets/avatar-videos/LilyGreeting.mp4'),
  glitter:  require('../../../../assets/avatar-videos/GlitterGreeting.mp4'),
  megatron: require('../../../../assets/avatar-videos/MegatronGreeting.mp4'),
};

const MODULE_ICONS = {
  concept:       require('../../../../assets/modules/Icons/Concept Learning Icon.png'),
  writing:       require('../../../../assets/modules/Icons/Writing Module Icon.png'),
  pronunciation: require('../../../../assets/modules/Icons/Pronunciation Module Icon.png'),
  dialogue:      require('../../../../assets/modules/Icons/Dialogue Module Icon.png'),
};

// All four cards take their accent from the child's avatar theme rather than
// owning a colour each, so the screen stays a single calm colour world. The
// module icons already carry the distinction between them.
const MODULES = [
  { key: 'concept',       label: 'Concept Learning',     image: MODULE_ICONS.concept,       corner: 'tl' },
  { key: 'writing',       label: 'Writing Module',       image: MODULE_ICONS.writing,       corner: 'tr' },
  { key: 'pronunciation', label: 'Pronunciation Module', image: MODULE_ICONS.pronunciation, corner: 'bl' },
  { key: 'dialogue',      label: 'Dialogue Module',      image: MODULE_ICONS.dialogue,      corner: 'br' },
];

// Theme colours are opaque hex; the card needs the accent at low alpha for the
// icon plate and the surface wash, so it stays a tint rather than a second block
// of colour competing with the icon.
function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ── Geometry ──────────────────────────────────────────────────────────────────
/** Avatar at the centre, one module parked in each corner — no implied order. */
function buildHub(width, height) {
  const cx  = width / 2;
  const cy  = height / 2;
  // Sized from the space actually available rather than fixed pixel caps. The
  // old caps (hub 115, card 225×170, spread at 27% of the box) were tuned for a
  // phone, so on a tablet they drew small cards that stopped ~170dp short of
  // each edge and left the screen mostly empty.
  const gutter = 10;

  // The cards are square, so one side length has to satisfy both axes. Two cards
  // sit side by side and stacked, so it may not exceed half the box either way;
  // those caps are applied last so they always beat the preferred size — a short
  // landscape phone gets a smaller card rather than one that overflows.
  const preferred = Math.max(160, Math.min(340, Math.min(width, height) * 0.40));
  const cardSize  = Math.max(
    100,
    Math.min(preferred, width / 2 - gutter * 1.5, height / 2 - gutter * 1.5),
  );
  const cardW = cardSize;
  const cardH = cardSize;

  // Corner-most position, then drawn back toward the centre so the four cards
  // read as one cluster around the child rather than four things pushed apart.
  // Vertically they are pulled in less, which opens up the gap between the two
  // cards stacked on each side.
  const pullInX = 0.82;
  const pullInY = 0.96;
  const dx = (width  / 2 - cardW / 2 - gutter) * pullInX;
  const dy = (height / 2 - cardH / 2 - gutter) * pullInY;

  // The cards are placed first, so the hub takes whatever the middle leaves. It
  // clears the corner cards as long as its box starts inboard of them on either
  // axis — hence the max() of the two clearances, not the min().
  const hubRoom = Math.max(dx - cardW / 2 - gutter, dy - cardH / 2 - gutter);
  const hubR = Math.max(60, Math.min(hubRoom, Math.max(80, Math.min(190, Math.min(width, height) * 0.22))));

  const offsets = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
  const cards = MODULES.map((m) => {
    const [sx, sy] = offsets[m.corner];
    return { ...m, x: cx + sx * dx, y: cy + sy * dy };
  });

  // Contents scale with the card, so a larger card is actually more readable
  // rather than the same 66px icon floating in more padding. The plate, its gap
  // and two lines of label have to clear the card height on the smallest card,
  // which is what holds the icon down at a third of the side.
  const iconSize   = Math.round(cardSize * 0.34);
  const plateSize  = Math.round(iconSize * 1.44);
  const labelSize  = Math.round(Math.max(12, Math.min(18, cardSize * 0.072)));
  const cardRadius = Math.round(Math.max(22, Math.min(34, cardSize * 0.19)));

  return { cx, cy, hubR, cardW, cardH, cards, iconSize, plateSize, labelSize, cardRadius };
}

// ── A module card ─────────────────────────────────────────────────────────────
function ModuleCard({ item, index, w, h, iconSize, plateSize, labelSize, radius, theme, onPress }) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1, delay: index * 90, friction: 6, tension: 70, useNativeDriver: true,
    }).start();
  }, [enter, index]);

  function pressIn() {
    Animated.spring(press, { toValue: 0.92, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.spring(press, { toValue: 1, speed: 20, bounciness: 12, useNativeDriver: true }).start();
  }

  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
    press,
  );

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { left: item.x - w / 2, top: item.y - h / 2, width: w, height: h },
        { opacity: enter, transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={[styles.cardPress, { borderRadius: radius }]}
      >
        <View style={[styles.card, { borderRadius: radius, borderColor: theme.cardOutline }]}>
          {/* The plate gives every icon the same footprint, so four artworks of
              different weight and aspect stop looking randomly sized. */}
          <View
            style={[
              styles.iconPlate,
              {
                width: plateSize, height: plateSize,
                borderRadius: Math.round(plateSize * 0.32),
                backgroundColor: tint(theme.cardOutline, 0.16),
              },
            ]}
          >
            <Image
              source={item.image}
              style={{ width: iconSize, height: iconSize }}
              resizeMode="contain"
            />
          </View>

          <Text
            style={[
              styles.cardLabel,
              { fontSize: labelSize, lineHeight: Math.round(labelSize * 1.25), color: theme.headingText },
            ]}
            numberOfLines={2}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Hub + spokes ──────────────────────────────────────────────────────────────
function ModuleHub({ student, theme, onModulePress }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  // The greeting loops by default to hold the child's attention on the screen,
  // but a looping video overwhelms some children and there is no way to know
  // which from here — so the adult in the room gets a stop. Also satisfies
  // WCAG 2.2 SC 2.2.2, which requires motion over 5s to be pausable.
  const [playing, setPlaying] = useState(true);
  const hubIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(hubIn, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [hubIn]);

  function handleLayout(e) {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  }

  const ready = box.width > 0 && box.height > 0;
  const hub   = ready ? buildHub(box.width, box.height) : null;

  return (
    <View style={styles.hubArea} onLayout={handleLayout}>
      {ready && (
        <>
          {/* spokes — every module hangs off the centre equally */}
          <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill}>
            {hub.cards.map((c) => (
              <Line
                key={c.key}
                x1={hub.cx} y1={hub.cy} x2={c.x} y2={c.y}
                stroke={theme.cardOutline} strokeOpacity={0.3}
                strokeWidth={3} strokeDasharray="7 9" strokeLinecap="round"
              />
            ))}
          </Svg>

          {/* the child at the centre */}
          <Animated.View
            style={[
              styles.hub,
              {
                left: hub.cx - hub.hubR, top: hub.cy - hub.hubR,
                width: hub.hubR * 2, height: hub.hubR * 2, borderRadius: hub.hubR,
                borderColor: theme.cardOutline,
                opacity: hubIn,
                transform: [{ scale: hubIn.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          >
            {student.avatar_key && AVATAR_VIDEOS[student.avatar_key] && (
              <Pressable
                onPress={() => setPlaying((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pause the greeting' : 'Play the greeting'}
                style={styles.hubPress}
              >
                <Video
                  source={AVATAR_VIDEOS[student.avatar_key]}
                  style={{ width: hub.hubR * 1.9, height: hub.hubR * 1.9 }}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={playing}
                  isLooping
                  isMuted
                />
              </Pressable>
            )}
          </Animated.View>

          {/* Play state indicator — visual only, the whole hub is the target. */}
          {student.avatar_key && AVATAR_VIDEOS[student.avatar_key] && (
            <View
              pointerEvents="none"
              style={[
                styles.playBadge,
                { left: hub.cx - 17, top: hub.cy + hub.hubR - 17, backgroundColor: theme.button },
              ]}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
            </View>
          )}

          {hub.cards.map((c, i) => (
            <ModuleCard
              key={c.key}
              item={c}
              index={i}
              w={hub.cardW}
              h={hub.cardH}
              iconSize={hub.iconSize}
              plateSize={hub.plateSize}
              labelSize={hub.labelSize}
              radius={hub.cardRadius}
              theme={theme}
              onPress={() => onModulePress(c.key)}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function StudentDashboardScreen({ route, navigation }) {
  const initialStudent = route.params?.student;
  const toast          = useToast();
  const logout         = useAuthStore((s) => s.logout);

  const [student,       setStudent]       = useState(initialStudent);
  const [gateVisible,   setGateVisible]   = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await teacherApi.getStudent(initialStudent.sid);
      setStudent(data);
    } catch { /* keep cached */ }
  }, [initialStudent.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  if (!student) return null;

  const theme     = getAvatarTheme(student.avatar_key);
  const firstName = student.full_name?.trim().split(/\s+/)[0] ?? '';

  function handleModulePress(key) {
    if (key === 'concept') navigation.navigate('ConceptCategories', { student });
    else if (key === 'writing') navigation.navigate('HandwritingModule', { student });
    else if (key === 'dialogue') navigation.navigate('DialogueLanding', { student });
    else if (key === 'pronunciation') navigation.navigate('PronunciationSessionSetup', { student });
    else toast.show('Coming soon!', 'info');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        {/* Both take the child's own accent, the way the cards and the hub do */}
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: tint(theme.cardOutline, 0.55) }]}
          onPress={() => setGateVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Back to student list"
        >
          <Ionicons name="arrow-back" size={24} color={theme.button} />
        </TouchableOpacity>

        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Hi, {firstName}! 👋</Text>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: tint(theme.cardOutline, 0.55) }]}
          onPress={() => setLogoutVisible(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="exit-outline" size={24} color={theme.button} />
        </TouchableOpacity>
      </View>

      <ModuleHub student={student} theme={theme} onModulePress={handleModulePress} />

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.navigate('StudentPicker'); }}
        onCancel={() => setGateVisible(false)}
      />
      <ConfirmDialog
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        onConfirm={() => { setLogoutVisible(false); logout(); }}
        onCancel={() => setLogoutVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFFFFF',
    // borderColor is set per button — accent for back, red for sign out.
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  // Sits a little below the two icon buttons it shares the row with, rather than
  // centred against them.
  greeting: { alignItems: 'center', gap: 5, marginTop: 28 },
  greetingText: {
    fontSize: 27, fontFamily: 'DMSans_900Black', color: '#1A2E3B',
  },
  // ── Hub ───────────────────────────────────────────────────────────────────
  hubArea: { flex: 1, marginHorizontal: 16, marginBottom: 12 },

  hubPress: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 5, elevation: 4,
  },
  hub: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 6,
  },

  // ── Module cards ──────────────────────────────────────────────────────────
  cardWrap: { position: 'absolute' },
  // The shadow and the fill live on the Pressable, the border on the view inside
  // it: a shadow on the clipping view would be cut off with the corners.
  cardPress: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A2E3B', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13, shadowRadius: 16, elevation: 5,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  iconPlate: {
    alignItems: 'center', justifyContent: 'center',
  },
  // fontSize / lineHeight are set per-card from buildHub so the label tracks the
  // card size; everything else is fixed.
  cardLabel: {
    // Slight negative tracking — DM Sans Bold is a touch loose at display size.
    fontFamily: 'DMSans_700Bold',
    color: '#1A2E3B', textAlign: 'center',
    letterSpacing: -0.2,
  },
});
