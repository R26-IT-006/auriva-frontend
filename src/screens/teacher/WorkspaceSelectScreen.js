import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../constants/layout';
import { useAuthStore } from '../../store/authStore';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const WORKSPACES = [
  {
    key:    'teacher',
    label:  'Teacher workspace',
    sub:    'Manage classes & resources',
    image:  require('../../../assets/teacher.png'),
    route:  'TeacherMain',
    iconBg: '#E1F5EE',
  },
  {
    key:    'student',
    label:  'Student workspace',
    sub:    'Access lessons & assignments',
    image:  require('../../../assets/students.png'),
    route:  'StudentPicker',
    iconBg: '#E8F0FB',
  },
];

export default function WorkspaceSelectScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - Layout.spacing.lg * 2, 420);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  return (
    <LinearGradient colors={['#B8E4F0', '#A8D5BC', '#D4EAC8', '#EDE8D0']} style={styles.safe}>
      <SafeAreaView style={styles.safeInner}>

        {/* Top-right logout button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setLogoutVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={20} color="#555" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
          <Text style={styles.title}>Choose Your Workspace</Text>

          <View style={{ gap: Layout.spacing.md, width: cardWidth }}>
            {WORKSPACES.map((ws) => (
              <TouchableOpacity
                key={ws.key}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(ws.route)}
                style={styles.card}
              >
                <View style={[styles.iconBox, { backgroundColor: ws.iconBg }]}>
                  <Image source={ws.image} style={styles.iconImage} resizeMode="contain" />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardLabel}>{ws.label}</Text>
                  <Text style={styles.cardSub}>{ws.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9FBFB8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ConfirmDialog
          visible={logoutVisible}
          title="Sign Out"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign Out"
          cancelLabel="Cancel"
          icon="log-out-outline"
          onConfirm={logout}
          onCancel={() => setLogoutVisible(false)}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: Layout.fontSize.sm,
    fontWeight: '600',
    color: '#555',
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.spacing.lg,
    gap: Layout.spacing.xl,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    fontFamily: 'sans-serif-rounded',
    color: '#020f0c',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 48,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#E0EDE9',
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.lg,
    shadowColor: '#0F6E56',
    shadowOpacity: 0,
    elevation: 0,
  },
  iconBox: {
    width: 90,
    height: 90,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconImage: {
    width: 68,
    height: 68,
  },
  textWrap: {
    flex: 1,
    gap: 6,
  },
  cardLabel: {
    fontSize: Layout.fontSize.xl,
    fontWeight: '600',
    color: '#1A2E26',
  },
  cardSub: {
    fontSize: Layout.fontSize.md,
    color: '#6B8A80',
  },
});