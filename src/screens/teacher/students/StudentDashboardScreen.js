import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../../constants/layout';
import { getAvatarTheme } from '../../../constants/avatarThemes';
import { teacherApi } from '../../../api/teacher';
import { useAuthStore } from '../../../store/authStore';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ParentGateModal } from '../../../components/common/ParentGateModal';
import { useToast } from '../../../context/ToastContext';

const AVATAR_MAP = {
  boba:     require('../../../../assets/avatar-images/Boba.png'),
  glitter:  require('../../../../assets/avatar-images/Glitter.png'),
  lily:     require('../../../../assets/avatar-images/Lily.png'),
  megatron: require('../../../../assets/avatar-images/Megatron.png'),
};

const AVATAR_NAMES = {
  boba: 'Boba', glitter: 'Glitter', lily: 'Lily', megatron: 'Megatron',
};

const MODULES = [
  { key: 'concept',       label: 'Concept Learning',    icon: 'bulb-outline' },
  { key: 'writing',       label: 'Writing Module',       icon: 'pencil-outline' },
  { key: 'pronunciation', label: 'Pronunciation Module', icon: 'mic-outline' },
  { key: 'dialogue',      label: 'Dialogue Module',      icon: 'chatbubbles-outline' },
];

export default function StudentDashboardScreen({ route, navigation }) {
  const initialStudent    = route.params?.student;
  const toast             = useToast();
  const logout            = useAuthStore((s) => s.logout);
  const { width } = useWindowDimensions();

  const [student,       setStudent]       = useState(initialStudent);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [gateVisible,   setGateVisible]   = useState(false);
  const [activeModule,  setActiveModule]  = useState(null);

  const fetch = useCallback(async () => {
    try {
      const data = await teacherApi.getStudent(initialStudent.sid);
      setStudent(data);
    } catch { /* keep cached */ }
  }, [initialStudent.sid]);

  useEffect(() => { fetch(); }, [fetch]);

  if (!student) return null;

  const theme     = getAvatarTheme(student.avatar_key);
  const firstName = student.full_name?.split(' ')[0] ?? student.full_name;

  // Card dimensions
  const H_PAD    = Layout.spacing.lg;
  const GAP      = 12;
  const cardSize  = Math.min((width - H_PAD * 2 - GAP) / 2, 175);

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
    <SafeAreaView style={styles.safeInner} edges={['top', 'bottom']}>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setGateVisible(true)} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.headingText} />
        </TouchableOpacity>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('StudentSession', { student })}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setLogoutVisible(true)} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color={theme.headingText} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: H_PAD }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero banner card ─────────────────────────────────── */}
        <View style={[styles.heroBanner, { backgroundColor: theme.cardSurface, borderColor: theme.cardOutline }]}>
          {/* Text side */}
          <View style={styles.heroText}>
            <Text style={[styles.heroGreeting, { color: theme.headingText, opacity: 0.5 }]}>Hello there 👋</Text>
            <Text style={[styles.heroName, { color: theme.headingText }]}>Welcome Back,{'\n'}{firstName}!</Text>
            {student.avatar_key && (
              <View style={[styles.avatarBadge, { backgroundColor: theme.background, borderColor: theme.cardOutline }]}>
                <Text style={[styles.avatarBadgeText, { color: theme.headingText }]}>
                  {AVATAR_NAMES[student.avatar_key]}
                </Text>
              </View>
            )}
          </View>

          {/* Avatar image */}
          {student.avatar_key && (
            <Image
              source={AVATAR_MAP[student.avatar_key]}
              style={styles.heroAvatar}
              resizeMode="contain"
            />
          )}
        </View>

        {/* ── Module grid ──────────────────────────────────────── */}
        <View style={[styles.grid, { gap: GAP }]}>
          {MODULES.map((m) => {
            const isActive = activeModule === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.moduleCard,
                  {
                    width: cardSize,
                    height: cardSize,
                    backgroundColor: isActive ? theme.button       : theme.cardSurface,
                    borderColor:     isActive ? theme.button       : theme.cardOutline,
                  },
                ]}
                onPress={() => {
                  if (m.key === 'dialogue') {
                    navigation.navigate('DialogueLanding', { student });
                    return;
                  }
                  setActiveModule(isActive ? null : m.key);
                  if (m.key === 'writing') {
                    navigation.navigate('HandwritingModule', { student });
                  } else {
                    toast.show('Coming soon!', 'info');
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.moduleIconWrap,
                  { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : theme.background },
                ]}>
                  <Ionicons
                    name={m.icon}
                    size={28}
                    color={isActive ? theme.buttonText : theme.cardOutline}
                  />
                </View>
                <Text style={[
                  styles.moduleLabel,
                  { color: isActive ? theme.buttonText : theme.headingText },
                ]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Bottom spacer for nav bar ─────────────────────────── */}
        <View style={{ height: 20 }} />
      </ScrollView>

      <ParentGateModal
        visible={gateVisible}
        onSuccess={() => { setGateVisible(false); navigation.goBack(); }}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.sm,
  },
  topRight: { flexDirection: 'row', gap: Layout.spacing.sm },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: {
    gap: Layout.spacing.md,
    paddingBottom: Layout.spacing.lg,
  },

  // ── Hero banner ──────────────────────────────────────────────
  heroBanner: {
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
    minHeight: 160,
    paddingLeft: Layout.spacing.lg,
    paddingBottom: Layout.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  heroText: {
    flex: 1,
    gap: 6,
    paddingTop: Layout.spacing.lg,
  },
  heroGreeting: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '500',
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  avatarBadge: {
    alignSelf: 'flex-start',
    borderRadius: Layout.radius.full,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  avatarBadgeText: {
    fontSize: Layout.fontSize.xs,
    fontWeight: '700',
  },
  heroAvatar: {
    width: 140,
    height: 160,
  },

  // ── Module grid ──────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moduleCard: {
    borderWidth: 2.5,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleIconWrap: {
    width: 52, height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleLabel: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 18,
  },

});