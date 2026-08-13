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

const AVATAR_NAMES = { boba: 'Boba', glitter: 'Glitter', lily: 'Lily', megatron: 'Megatron' };

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

// ── Geometry ──────────────────────────────────────────────────────────────────
/** Avatar at the centre, one module parked in each corner — no implied order. */
function buildHub(width, height) {
  const cx  = width / 2;
  const cy  = height / 2;
  const hubR   = Math.max(70, Math.min(115, Math.min(width, height) * 0.19));
  const cardW  = Math.max(130, Math.min(225, width * 0.23));
  const cardH  = Math.max(110, Math.min(170, cardW * 0.74));
  const dx     = Math.max(cardW / 2 + hubR * 0.55, width * 0.27);
  const dy     = Math.max(cardH / 2 + 6, height * 0.27);

  const offsets = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
  const cards = MODULES.map((m) => {
    const [sx, sy] = offsets[m.corner];
    return { ...m, x: cx + sx * dx, y: cy + sy * dy };
  });

  return { cx, cy, hubR, cardW, cardH, cards };
}

// ── A module card ─────────────────────────────────────────────────────────────
function ModuleCard({ item, index, w, h, theme, onPress }) {
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
        style={[styles.card, { borderColor: theme.cardOutline }]}
      >
        <Image source={item.image} style={styles.cardIcon} resizeMode="contain" />
        <Text style={styles.cardLabel} numberOfLines={2}>{item.label}</Text>
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

  const theme      = getAvatarTheme(student.avatar_key);
  const avatarName = AVATAR_NAMES[student.avatar_key] ?? '';
  const firstName  = student.full_name?.trim().split(/\s+/)[0] ?? '';

  function handleModulePress(key) {
    if (key === 'concept') navigation.navigate('ConceptCategories', { student });
    else toast.show('Coming soon!', 'info');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setGateVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={20} color="#1A2E3B" />
        </TouchableOpacity>

        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Hi, {firstName}! 👋</Text>
          {avatarName ? (
            <View style={[styles.avatarPill, { borderColor: theme.cardOutline }]}>
              <Text style={[styles.avatarPillText, { color: theme.button }]}>
                with {avatarName}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setLogoutVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="exit-outline" size={20} color="#1A2E3B" />
        </TouchableOpacity>
      </View>

      <Text style={styles.prompt}>What shall we play today?</Text>

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
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  greeting: { alignItems: 'center', gap: 4 },
  greetingText: {
    fontSize: 22, fontFamily: 'Nunito_900Black', color: '#1A2E3B',
  },
  avatarPill: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  avatarPillText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },

  prompt: {
    fontSize: 14, fontFamily: 'Nunito_600SemiBold',
    color: '#7A8A9A', textAlign: 'center', marginTop: 2,
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
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  cardIcon: { width: 66, height: 66 },
  cardLabel: {
    fontSize: 13, fontFamily: 'Nunito_800ExtraBold',
    color: '#1A2E3B', textAlign: 'center', lineHeight: 17,
  },
});
