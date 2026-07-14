import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
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

const MODULES = [
  { key: 'concept',       label: 'Concept Learning',    image: MODULE_ICONS.concept },
  { key: 'writing',       label: 'Writing Module',       image: MODULE_ICONS.writing },
  { key: 'pronunciation', label: 'Pronunciation Module', image: MODULE_ICONS.pronunciation },
  { key: 'dialogue',      label: 'Dialogue Module',      image: MODULE_ICONS.dialogue },
];

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
      setStudent((current) => ({
        ...data,
        avatar_key:
          data.avatar_key ?? current?.avatar_key ?? initialStudent.avatar_key,
      }));
    } catch {
      /* keep cached */
    }
  }, [initialStudent.sid]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (!student) return null;

  const theme      = getAvatarTheme(student.avatar_key);
  const avatarName = AVATAR_NAMES[student.avatar_key] ?? '';

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

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setLogoutVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="exit-outline" size={20} color="#1A2E3B" />
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroInfo}>
            <Text style={styles.heroHello}>Hello there 👋</Text>
            <Text style={styles.heroName}>
              Welcome Back,{'\n'}{student.full_name}!
            </Text>
            {avatarName ? (
              <View style={[styles.avatarPill, { borderColor: theme.cardOutline }]}>
                <Text style={[styles.avatarPillText, { color: theme.button }]}>{avatarName}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroAvatarWrap}>
            {student.avatar_key && AVATAR_VIDEOS[student.avatar_key] && (
              <Video
                source={AVATAR_VIDEOS[student.avatar_key]}
                style={styles.heroVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay isLooping isMuted
              />
            )}
          </View>
        </View>

        {/* Module cards */}
        <View style={styles.modulesRow}>
          {MODULES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.moduleCard, { borderColor: theme.cardOutline }]}
              onPress={() => handleModulePress(m.key)}
              activeOpacity={0.8}
            >
              <Image source={m.image} style={styles.moduleIcon} resizeMode="contain" />
              <Text style={styles.moduleLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
    paddingVertical: 12,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  heroInfo: { flex: 1, paddingVertical: 28, gap: 6 },
  heroHello: {
    fontSize: 14, fontFamily: 'Nunito_400Regular',
    color: '#7A8A9A',
  },
  heroName: {
    fontSize: 30, fontFamily: 'Nunito_900Black',
    color: '#1A2E3B', lineHeight: 38,
  },
  avatarPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4,
    marginTop: 4,
  },
  avatarPillText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },

  heroAvatarWrap: { width: 210, height: 210 },
  heroVideo:      { width: 210, height: 210 },

  // ── Module cards ──────────────────────────────────────────────────────────
  modulesRow: { flex: 1, flexDirection: 'row', gap: 16 },
  moduleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  moduleIcon:  { width: 130, height: 130 },
  moduleLabel: {
    fontSize: 15, fontFamily: 'Nunito_600SemiBold',
    color: '#1A2E3B', textAlign: 'center', paddingHorizontal: 10,
  },
});
